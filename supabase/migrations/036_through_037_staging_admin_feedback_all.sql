-- ==============================================================================
-- Consolidated Migration: 036_through_037_staging_admin_feedback_all.sql
-- Covers Staging Environment, Profiles.is_tester, In-App Feedback,
-- Dev/Staging Test Helpers (Fast-Forward, Simulate Message & Notification),
-- Minimal Admin Area, Reference Data Editor, and Admin Audit Logging.
-- ==============================================================================

-- ==============================================================================
-- PART 1: 036_staging_and_feedback.sql
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

-- 12. Execution Grants for Part 1
GRANT EXECUTE ON FUNCTION public.is_production() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.dev_fast_forward(INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_simulate_message(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_simulate_notification(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback(TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;


-- ==============================================================================
-- PART 2: 037_admin_area_and_audit.sql
-- ==============================================================================

-- 1. Admin Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    admin_email TEXT,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    before_state JSONB,
    after_state JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_log(target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit logs"
    ON public.admin_audit_log
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- 2. Audit Helper Procedure
CREATE OR REPLACE FUNCTION public.log_admin_action(
    p_action TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_before JSONB DEFAULT NULL,
    p_after JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_email TEXT;
BEGIN
    v_admin_id := auth.uid();
    IF v_admin_id IS NULL OR NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    SELECT email INTO v_email FROM public.profiles WHERE id = v_admin_id;

    INSERT INTO public.admin_audit_log (
        admin_id,
        admin_email,
        action,
        target_type,
        target_id,
        before_state,
        after_state
    )
    VALUES (
        v_admin_id,
        v_email,
        p_action,
        p_target_type,
        p_target_id,
        p_before,
        p_after
    );
END;
$$;

-- 3. Admin: Get Feedback Items
CREATE OR REPLACE FUNCTION public.admin_get_feedback(
    p_status TEXT DEFAULT 'all',
    p_type TEXT DEFAULT 'all',
    p_severity TEXT DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    author_id UUID,
    author_name TEXT,
    author_email TEXT,
    type TEXT,
    severity TEXT,
    message TEXT,
    screenshot_path TEXT,
    context JSONB,
    status TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        f.id,
        f.author_id,
        f.author_name,
        f.author_email,
        f.type,
        f.severity,
        f.message,
        f.screenshot_path,
        f.context,
        f.status,
        f.admin_notes,
        f.created_at,
        f.updated_at
    FROM public.feedback f
    WHERE (p_status = 'all' OR f.status = p_status)
      AND (p_type = 'all' OR f.type = p_type)
      AND (p_severity = 'all' OR f.severity = p_severity)
    ORDER BY f.created_at DESC;
END;
$$;

-- 4. Admin: Update Feedback Status & Notes
CREATE OR REPLACE FUNCTION public.admin_update_feedback_status(
    p_feedback_id UUID,
    p_status TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    IF p_status NOT IN ('new', 'seen', 'planned', 'fixed', 'wont_fix') THEN
        RAISE EXCEPTION 'Invalid feedback status.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_before FROM public.feedback WHERE id = p_feedback_id;
    IF v_before.id IS NULL THEN
        RAISE EXCEPTION 'Feedback record not found.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.feedback
    SET status = p_status,
        admin_notes = COALESCE(p_notes, admin_notes),
        updated_at = now()
    WHERE id = p_feedback_id;

    PERFORM public.log_admin_action(
        'update_feedback',
        'feedback',
        p_feedback_id::TEXT,
        to_jsonb(v_before),
        jsonb_build_object('status', p_status, 'admin_notes', p_notes)
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Admin: Get Pending Designer Credentials
CREATE OR REPLACE FUNCTION public.admin_get_pending_credentials()
RETURNS TABLE (
    id UUID,
    designer_id UUID,
    designer_name TEXT,
    designer_email TEXT,
    body_name TEXT,
    license_number TEXT,
    state_region TEXT,
    verification_year INT,
    certificate_path TEXT,
    status TEXT,
    submitted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        c.id,
        c.designer_id,
        p.full_name AS designer_name,
        p.email AS designer_email,
        c.body_name,
        c.license_number,
        c.state_region,
        c.verification_year,
        c.certificate_path,
        c.status::TEXT,
        c.created_at AS submitted_at
    FROM public.designer_credentials c
    JOIN public.profiles p ON p.id = c.designer_id
    WHERE c.status = 'pending'
    ORDER BY c.created_at ASC;
END;
$$;

-- 6. Admin: Review Designer Credential (Approve / Reject)
CREATE OR REPLACE FUNCTION public.admin_review_credential(
    p_credential_id UUID,
    p_decision TEXT, -- 'approved' or 'rejected'
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cred RECORD;
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    IF p_decision NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'Decision must be approved or rejected.' USING ERRCODE = 'P0002';
    END IF;

    IF p_decision = 'rejected' AND (p_rejection_reason IS NULL OR char_length(trim(p_rejection_reason)) < 5) THEN
        RAISE EXCEPTION 'A clear rejection reason is required (minimum 5 characters).' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_cred FROM public.designer_credentials WHERE id = p_credential_id;
    IF v_cred.id IS NULL THEN
        RAISE EXCEPTION 'Credential not found.' USING ERRCODE = 'P0002';
    END IF;

    IF p_decision = 'approved' THEN
        UPDATE public.designer_credentials
        SET status = 'approved',
            verified_at = now(),
            rejection_reason = NULL
        WHERE id = p_credential_id;

        UPDATE public.designer_profiles
        SET is_verified = true
        WHERE id = v_cred.designer_id;

        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
            v_cred.designer_id,
            'credential_approved',
            'License Verified',
            'Your professional license with ' || v_cred.body_name || ' has been approved. Your profile now shows the Verified badge.',
            jsonb_build_object('credential_id', p_credential_id)
        );
    ELSE
        UPDATE public.designer_credentials
        SET status = 'rejected',
            rejection_reason = p_rejection_reason,
            verified_at = NULL
        WHERE id = p_credential_id;

        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
            v_cred.designer_id,
            'credential_rejected',
            'License Verification Update',
            'Your credential submission requires revision: ' || p_rejection_reason,
            jsonb_build_object('credential_id', p_credential_id, 'reason', p_rejection_reason)
        );
    END IF;

    PERFORM public.log_admin_action(
        'review_credential',
        'designer_credentials',
        p_credential_id::TEXT,
        to_jsonb(v_cred),
        jsonb_build_object('decision', p_decision, 'reason', p_rejection_reason)
    );

    RETURN jsonb_build_object('success', true, 'status', p_decision);
END;
$$;

-- 7. Admin: Reference Categories & Subcategories Editor
CREATE OR REPLACE FUNCTION public.admin_update_reference_category(
    p_action TEXT,
    p_target_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_name TEXT;
    v_cat_id UUID;
    v_sort INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    v_name := p_data->>'name';
    v_sort := COALESCE((p_data->>'sort_order')::INT, 10);

    IF p_action = 'add_category' THEN
        INSERT INTO public.categories (name, sort_order)
        VALUES (v_name, v_sort)
        RETURNING id INTO v_cat_id;
        
        PERFORM public.log_admin_action('add_category', 'categories', v_cat_id::TEXT, NULL, p_data);
        RETURN jsonb_build_object('success', true, 'id', v_cat_id);

    ELSIF p_action = 'rename_category' THEN
        UPDATE public.categories SET name = v_name WHERE id = p_target_id;
        PERFORM public.log_admin_action('rename_category', 'categories', p_target_id::TEXT, NULL, p_data);
        RETURN jsonb_build_object('success', true);

    ELSIF p_action = 'add_subcategory' THEN
        v_cat_id := (p_data->>'category_id')::UUID;
        INSERT INTO public.subcategories (category_id, name, sort_order)
        VALUES (v_cat_id, v_name, v_sort)
        RETURNING id INTO p_target_id;

        PERFORM public.log_admin_action('add_subcategory', 'subcategories', p_target_id::TEXT, NULL, p_data);
        RETURN jsonb_build_object('success', true, 'id', p_target_id);

    ELSIF p_action = 'rename_subcategory' THEN
        UPDATE public.subcategories SET name = v_name WHERE id = p_target_id;
        PERFORM public.log_admin_action('rename_subcategory', 'subcategories', p_target_id::TEXT, NULL, p_data);
        RETURN jsonb_build_object('success', true);

    ELSE
        RAISE EXCEPTION 'Unsupported category action.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- 8. Admin: Phase Template Editor
CREATE OR REPLACE FUNCTION public.admin_update_phase_template(
    p_action TEXT,
    p_template_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before RECORD;
    v_split5 NUMERIC;
    v_split6 NUMERIC;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'update' THEN
        SELECT * INTO v_before FROM public.phase_templates WHERE id = p_template_id;
        IF v_before.id IS NULL THEN
            RAISE EXCEPTION 'Phase template not found.' USING ERRCODE = 'P0002';
        END IF;

        UPDATE public.phase_templates
        SET name = COALESCE(p_data->>'name', name),
            description = COALESCE(p_data->>'description', description),
            billing_trigger = COALESCE(p_data->>'billing_trigger', billing_trigger),
            recommended_split_5_percent = COALESCE((p_data->>'recommended_split_5_percent')::NUMERIC, recommended_split_5_percent),
            recommended_split_6_percent = COALESCE((p_data->>'recommended_split_6_percent')::NUMERIC, recommended_split_6_percent),
            is_optional = COALESCE((p_data->>'is_optional')::BOOLEAN, is_optional)
        WHERE id = p_template_id;

        SELECT COALESCE(SUM(recommended_split_5_percent), 0) INTO v_split5 
        FROM public.phase_templates WHERE recommended_split_5_percent > 0;

        SELECT COALESCE(SUM(recommended_split_6_percent), 0) INTO v_split6 
        FROM public.phase_templates WHERE recommended_split_6_percent > 0;

        IF v_split5 <> 100.00 THEN
            RAISE EXCEPTION 'Five-phase recommended split must total exactly 100 percent (current sum: %).', v_split5 USING ERRCODE = 'P0002';
        END IF;

        IF v_split6 <> 100.00 THEN
            RAISE EXCEPTION 'Six-phase recommended split must total exactly 100 percent (current sum: %).', v_split6 USING ERRCODE = 'P0002';
        END IF;

        PERFORM public.log_admin_action('update_phase_template', 'phase_templates', p_template_id::TEXT, to_jsonb(v_before), p_data);
        RETURN jsonb_build_object('success', true);
    ELSE
        RAISE EXCEPTION 'Action not supported.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- 9. Admin: App Settings Value Editor
CREATE OR REPLACE FUNCTION public.admin_update_app_setting(
    p_key TEXT,
    p_value JSONB,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_before RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_before FROM public.app_settings WHERE key = p_key;

    INSERT INTO public.app_settings (key, value, description)
    VALUES (p_key, p_value, COALESCE(p_description, v_before.description, 'Platform operational setting'))
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
        description = COALESCE(EXCLUDED.description, app_settings.description);

    PERFORM public.log_admin_action('update_app_setting', 'app_settings', p_key, to_jsonb(v_before), jsonb_build_object('value', p_value));
    RETURN jsonb_build_object('success', true, 'key', p_key);
END;
$$;

-- 10. Admin: Verify Test User Email (when SMTP delivery fails for testers)
CREATE OR REPLACE FUNCTION public.admin_verify_user_email(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = p_user_id;

    PERFORM public.log_admin_action('verify_user_email', 'auth.users', p_user_id::TEXT, NULL, jsonb_build_object('confirmed', true));
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 11. Final Grants
GRANT EXECUTE ON FUNCTION public.admin_get_feedback(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_credential(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_reference_category(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_phase_template(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_app_setting(TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_user_email(UUID) TO authenticated;
