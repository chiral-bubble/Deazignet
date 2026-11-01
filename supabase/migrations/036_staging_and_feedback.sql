-- ==============================================================================
-- Migration 036: Staging Environment, Tester Flags, Dev Helpers & In-App Feedback
-- ==============================================================================

-- 1. App Settings: Add environment and staging operational settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('environment', '"staging"'::jsonb, 'Deployment environment: development, staging, or production'),
    ('auto_approval_days', '5'::jsonb, 'Business days before a submitted milestone automatically approves if no action taken'),
    ('security_period_days', '5'::jsonb, 'Security hold days on approved milestone escrow funds before release to designer'),
    ('max_revisions_per_phase', '2'::jsonb, 'Standard included revisions per milestone phase before additional hourly billing'),
    ('proposals_per_month_limit', '10'::jsonb, 'Monthly proposal submission limit for standard tier designers')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- 2. Profiles: Add is_tester flag
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_tester BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_tester ON public.profiles(is_tester) WHERE is_tester = true;

-- 3. Extend notification_type for feedback
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.notification_type'::regtype 
        AND enumlabel = 'feedback_received'
    ) THEN
        ALTER TYPE public.notification_type ADD VALUE 'feedback_received';
    END IF;
END $$;

-- 4. In-App Feedback Table
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    author_name TEXT,
    author_email TEXT,
    type TEXT NOT NULL CHECK (type IN ('broken', 'confusing', 'change', 'missing')),
    severity TEXT NOT NULL CHECK (severity IN ('blocker', 'annoying', 'minor')),
    message TEXT NOT NULL CHECK (char_length(message) >= 5 AND char_length(message) <= 2000),
    screenshot_path TEXT,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'planned', 'fixed', 'wont_fix')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_author ON public.feedback(author_id);

-- 5. Updated At Trigger for Feedback
DROP TRIGGER IF EXISTS trg_feedback_updated_at ON public.feedback;
CREATE TRIGGER trg_feedback_updated_at
    BEFORE UPDATE ON public.feedback
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Helper to check if current environment is production
CREATE OR REPLACE FUNCTION public.is_production()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE((SELECT (value#>>'{}') = 'production' FROM public.app_settings WHERE key = 'environment'), false);
$$;

-- 7. Dev / Staging Fast-Forward Helper
-- Advances milestone timestamps by N days to test auto-approval and 5-day security hold
DROP FUNCTION IF EXISTS public.dev_fast_forward CASCADE;
CREATE OR REPLACE FUNCTION public.dev_fast_forward(p_days INT, p_engagement_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_env TEXT;
    v_updated_submissions INT := 0;
    v_updated_milestones INT := 0;
    v_auto_approved INT := 0;
    v_released INT := 0;
    v_ms RECORD;
    v_shift INTERVAL;
BEGIN
    SELECT COALESCE((value#>>'{}'), 'development') INTO v_env 
    FROM public.app_settings 
    WHERE key = 'environment';

    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_fast_forward is strictly blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    IF p_days <= 0 THEN
        RAISE EXCEPTION 'Fast-forward days must be positive.' USING ERRCODE = 'P0002';
    END IF;

    v_shift := (p_days || ' days')::INTERVAL;

    -- Shift submitted_at for submitted milestones
    UPDATE public.engagement_milestones
    SET submitted_at = submitted_at - v_shift
    WHERE status = 'submitted'
      AND submitted_at IS NOT NULL
      AND (p_engagement_id IS NULL OR engagement_id = p_engagement_id);
    GET DIAGNOSTICS v_updated_milestones = ROW_COUNT;

    -- Shift submission records
    UPDATE public.milestone_submissions
    SET created_at = created_at - v_shift
    WHERE (p_engagement_id IS NULL OR milestone_id IN (
        SELECT id FROM public.engagement_milestones WHERE engagement_id = p_engagement_id
    ));
    GET DIAGNOSTICS v_updated_submissions = ROW_COUNT;

    -- Check auto-approval for milestones submitted > 5 days ago
    FOR v_ms IN 
        SELECT id, engagement_id, name, amount 
        FROM public.engagement_milestones
        WHERE status = 'submitted'
          AND submitted_at <= now() - INTERVAL '5 days'
          AND (p_engagement_id IS NULL OR engagement_id = p_engagement_id)
    LOOP
        UPDATE public.engagement_milestones
        SET status = 'approved',
            approved_at = now()
        WHERE id = v_ms.id;

        v_auto_approved := v_auto_approved + 1;

        -- Record event
        INSERT INTO public.engagement_events (engagement_id, event_type, metadata)
        VALUES (
            v_ms.engagement_id,
            'milestone_approved',
            jsonb_build_object(
                'milestone_id', v_ms.id,
                'milestone_name', v_ms.name,
                'note', 'Auto-approved via test controls fast-forward'
            )
        );
    END LOOP;

    -- Shift approved_at for approved milestones to test 5-day security hold
    UPDATE public.engagement_milestones
    SET approved_at = approved_at - v_shift
    WHERE status = 'approved'
      AND approved_at IS NOT NULL
      AND payout_status != 'released'
      AND (p_engagement_id IS NULL OR engagement_id = p_engagement_id);

    -- Release payouts where 5-day security hold has elapsed
    FOR v_ms IN
        SELECT id, engagement_id, name, amount
        FROM public.engagement_milestones
        WHERE status = 'approved'
          AND payout_status != 'released'
          AND approved_at <= now() - INTERVAL '5 days'
          AND (p_engagement_id IS NULL OR engagement_id = p_engagement_id)
    LOOP
        UPDATE public.engagement_milestones
        SET payout_status = 'released',
            released_at = now()
        WHERE id = v_ms.id;

        v_released := v_released + 1;

        INSERT INTO public.engagement_events (engagement_id, event_type, metadata)
        VALUES (
            v_ms.engagement_id,
            'funds_released',
            jsonb_build_object(
                'milestone_id', v_ms.id,
                'amount', v_ms.amount,
                'note', 'Funds released after 5-day security hold via test controls'
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'days_shifted', p_days,
        'milestones_shifted', v_updated_milestones,
        'submissions_shifted', v_updated_submissions,
        'auto_approved', v_auto_approved,
        'payouts_released', v_released
    );
END;
$$;

-- 8. Dev Simulate Client Message Helper
CREATE OR REPLACE FUNCTION public.dev_simulate_message(
    p_conversation_id UUID,
    p_body TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_env TEXT;
    v_conv RECORD;
    v_sender_id UUID;
    v_msg_id UUID;
BEGIN
    SELECT COALESCE((value#>>'{}'), 'development') INTO v_env 
    FROM public.app_settings 
    WHERE key = 'environment';

    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_simulate_message is strictly blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF v_conv.id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Send as client participant
    v_sender_id := v_conv.client_id;

    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (p_conversation_id, v_sender_id, p_body)
    RETURNING id INTO v_msg_id;

    UPDATE public.conversations
    SET last_message_at = now()
    WHERE id = p_conversation_id;

    RETURN jsonb_build_object(
        'success', true,
        'message_id', v_msg_id,
        'conversation_id', p_conversation_id
    );
END;
$$;

-- 9. Dev Simulate Notification Helper
CREATE OR REPLACE FUNCTION public.dev_simulate_notification(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_type TEXT DEFAULT 'general'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_env TEXT;
    v_notif_id UUID;
    v_enum_val public.notification_type;
BEGIN
    SELECT COALESCE((value#>>'{}'), 'development') INTO v_env 
    FROM public.app_settings 
    WHERE key = 'environment';

    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_simulate_notification is strictly blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    BEGIN
        v_enum_val := p_type::public.notification_type;
    EXCEPTION WHEN OTHERS THEN
        v_enum_val := 'system'::public.notification_type;
    END;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (p_user_id, v_enum_val, p_title, p_body, '{"simulated": true}'::jsonb)
    RETURNING id INTO v_notif_id;

    RETURN jsonb_build_object(
        'success', true,
        'notification_id', v_notif_id
    );
END;
$$;

-- 10. Submit Feedback Function
CREATE OR REPLACE FUNCTION public.submit_feedback(
    p_type TEXT,
    p_severity TEXT,
    p_message TEXT,
    p_screenshot_path TEXT DEFAULT NULL,
    p_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_name TEXT;
    v_email TEXT;
    v_feedback_id UUID;
    v_admin RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
        SELECT full_name, email INTO v_name, v_email FROM public.profiles WHERE id = v_user_id;
    END IF;

    INSERT INTO public.feedback (
        author_id,
        author_name,
        author_email,
        type,
        severity,
        message,
        screenshot_path,
        context
    )
    VALUES (
        v_user_id,
        COALESCE(v_name, 'Anonymous Tester'),
        v_email,
        p_type,
        p_severity,
        p_message,
        p_screenshot_path,
        p_context
    )
    RETURNING id INTO v_feedback_id;

    -- Notify all active admins
    FOR v_admin IN 
        SELECT id FROM public.profiles WHERE role = 'admin'
    LOOP
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            body,
            data
        )
        VALUES (
            v_admin.id,
            'feedback_received',
            'New Tester Feedback: ' || p_type || ' (' || p_severity || ')',
            SUBSTRING(p_message FROM 1 FOR 120),
            jsonb_build_object(
                'feedback_id', v_feedback_id,
                'author_id', v_user_id,
                'type', p_type,
                'severity', p_severity
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'feedback_id', v_feedback_id
    );
END;
$$;

-- 11. Row Level Security for Feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authors can read their own feedback" ON public.feedback;
CREATE POLICY "Authors can read their own feedback"
    ON public.feedback
    FOR SELECT
    TO authenticated
    USING (author_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Anyone authenticated can insert feedback" ON public.feedback;
CREATE POLICY "Anyone authenticated can insert feedback"
    ON public.feedback
    FOR INSERT
    TO authenticated
    WITH CHECK (author_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback;
CREATE POLICY "Admins can update feedback"
    ON public.feedback
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 12. Execution Grants
GRANT EXECUTE ON FUNCTION public.is_production() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.dev_fast_forward(INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_simulate_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_simulate_notification(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;

