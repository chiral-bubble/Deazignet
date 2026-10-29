-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 4
-- 020_notifications.sql
-- Notification Types, Preferences, Creation & Management Functions
-- ==============================================================================

-- 1. Create notification_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM (
            'proposal_received',
            'proposal_viewed',
            'proposal_shortlisted',
            'proposal_accepted',
            'proposal_declined',
            'milestone_funded',
            'deliverable_submitted',
            'review_reminder',
            'deliverable_approved',
            'approved_automatically',
            'revision_requested',
            'payment_released',
            'dispute_opened',
            'dispute_resolved',
            'withdrawal_paid',
            'withdrawal_failed',
            'message_received',
            'credential_verified',
            'credential_rejected',
            'plan_renewal',
            'system_announcement'
        );
    END IF;
END $$;

-- 2. Drop tables if recreating
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 3. Notifications Table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 4. Notification Preferences Table
CREATE TABLE public.notification_preferences (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    in_app BOOLEAN NOT NULL DEFAULT true,
    email BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON public.notifications(deleted_at);

-- ------------------------------------------------------------------------------
-- 5. Helper Function: create_notification (Security Definer, Idempotent, Opt-Out)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type public.notification_type,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_in_app BOOLEAN;
    v_idempotency_key TEXT;
    v_existing_id UUID;
    v_notification_id UUID;
BEGIN
    -- Check user preference for this notification type
    SELECT in_app INTO v_in_app
    FROM public.notification_preferences
    WHERE user_id = p_user_id AND type = p_type;

    IF v_in_app IS FALSE THEN
        -- User explicitly turned off in-app notifications for this type
        RETURN NULL;
    END IF;

    -- Idempotency check: avoid duplicate notifications for the same underlying event
    v_idempotency_key := p_data->>'idempotency_key';
    IF v_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.notifications
        WHERE user_id = p_user_id
          AND type = p_type
          AND (data->>'idempotency_key') = v_idempotency_key
          AND created_at >= (timezone('utc'::text, now()) - INTERVAL '30 days')
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        p_user_id,
        p_type,
        trim(p_title),
        trim(p_body),
        p_data
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. Notification Management Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(
    p_id UUID,
    p_read BOOLEAN DEFAULT true
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
    SET read_at = CASE WHEN p_read THEN timezone('utc'::text, now()) ELSE NULL END
    WHERE id = p_id
      AND (user_id = v_caller_id OR public.is_admin());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
    p_type public.notification_type DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
    SET read_at = timezone('utc'::text, now())
    WHERE user_id = v_caller_id
      AND read_at IS NULL
      AND (p_type IS NULL OR type = p_type);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.delete_notification(p_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- Soft delete to allow 10-second undo
    UPDATE public.notifications
    SET deleted_at = timezone('utc'::text, now())
    WHERE id = p_id
      AND (user_id = v_caller_id OR public.is_admin());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.undo_delete_notification(p_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_notif RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_notif FROM public.notifications WHERE id = p_id;
    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'Notification not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_notif.user_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    -- Undo permitted only within 10 seconds
    IF v_notif.deleted_at IS NULL OR v_notif.deleted_at < (timezone('utc'::text, now()) - INTERVAL '10 seconds') THEN
        RAISE EXCEPTION 'Undo delete window has expired (exceeded 10 seconds).' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.notifications
    SET deleted_at = NULL
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INT := 0;
BEGIN
    -- Purge notifications older than 180 days, and soft-deleted after 7 days
    WITH deleted_rows AS (
        DELETE FROM public.notifications
        WHERE created_at < (timezone('utc'::text, now()) - INTERVAL '180 days')
           OR deleted_at < (timezone('utc'::text, now()) - INTERVAL '7 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. Automatic Event Wiring: Proposal Events & Credential Verification
-- ------------------------------------------------------------------------------

-- Trigger on proposal_events: dispatches notifications to designer
CREATE OR REPLACE FUNCTION public.handle_proposal_event_to_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_prop RECORD;
    v_proj RECORD;
BEGIN
    SELECT * INTO v_prop FROM public.proposals WHERE id = NEW.proposal_id;
    IF v_prop.id IS NULL THEN RETURN NEW; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;

    CASE NEW.event_type
        WHEN 'viewed' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_viewed'::public.notification_type,
                'Client viewed your proposal',
                'Your proposal for "' || v_proj.title || '" was viewed by the client.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_viewed_' || v_prop.id
                )
            );
        WHEN 'shortlisted' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_shortlisted'::public.notification_type,
                'Proposal shortlisted!',
                'Congratulations! Your proposal for "' || v_proj.title || '" was shortlisted.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_shortlisted_' || v_prop.id
                )
            );
        WHEN 'accepted' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_accepted'::public.notification_type,
                'Proposal accepted! Project awarded',
                'Your proposal for "' || v_proj.title || '" was accepted. Engagement has started.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_accepted_' || v_prop.id
                )
            );
        WHEN 'declined' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_declined'::public.notification_type,
                'Proposal update',
                'Your proposal for "' || v_proj.title || '" was declined.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_declined_' || v_prop.id
                )
            );
        ELSE
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_event_to_notification ON public.proposal_events;
CREATE TRIGGER trg_proposal_event_to_notification
AFTER INSERT ON public.proposal_events
FOR EACH ROW EXECUTE FUNCTION public.handle_proposal_event_to_notification();

-- Trigger on credentials table for Admin Review Notifications
CREATE OR REPLACE FUNCTION public.handle_credential_status_to_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'verified'::public.credential_status THEN
            PERFORM public.create_notification(
                NEW.designer_id,
                'credential_verified'::public.notification_type,
                'Professional credential verified',
                'Your credential "' || NEW.title || '" has been verified by the Dezignet review team.',
                jsonb_build_object('credential_id', NEW.id)
            );
        ELSIF NEW.status = 'rejected'::public.credential_status THEN
            PERFORM public.create_notification(
                NEW.designer_id,
                'credential_rejected'::public.notification_type,
                'Credential review decision',
                'Your credential "' || NEW.title || '" was rejected: ' || COALESCE(NEW.rejection_reason, 'Information could not be validated.'),
                jsonb_build_object('credential_id', NEW.id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credential_status_to_notif ON public.credentials;
CREATE TRIGGER trg_credential_status_to_notif
AFTER UPDATE OF status ON public.credentials
FOR EACH ROW EXECUTE FUNCTION public.handle_credential_status_to_notification();

-- Admin broadcast: announce_system
CREATE OR REPLACE FUNCTION public.announce_system(
    p_title TEXT,
    p_body TEXT,
    p_audience TEXT DEFAULT 'all' -- 'all', 'designer', 'client'
)
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_count INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin authorization required.' USING ERRCODE = '42501';
    END IF;

    FOR v_user IN (
        SELECT id FROM public.profiles
        WHERE (p_audience = 'all' OR role::TEXT = p_audience)
    ) LOOP
        PERFORM public.create_notification(
            v_user.id,
            'system_announcement'::public.notification_type,
            p_title,
            p_body,
            jsonb_build_object('audience', p_audience)
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

