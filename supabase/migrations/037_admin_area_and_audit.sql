-- ==============================================================================
-- Migration 037: Minimal Admin Area, Reference Data Editor & Audit Log
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

        -- Update designer profile verified badge
        UPDATE public.designer_profiles
        SET is_verified = true
        WHERE id = v_cred.designer_id;

        -- Notify designer
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

        -- Notify designer with reason
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
    p_action TEXT, -- 'add_category', 'rename_category', 'hide_category', 'add_subcategory', 'rename_subcategory', 'hide_subcategory'
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
    v_is_hidden BOOLEAN;
    v_sort INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    v_name := p_data->>'name';
    v_is_hidden := COALESCE((p_data->>'is_hidden')::BOOLEAN, false);
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
    p_action TEXT, -- 'update', 'add', 'delete'
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
    v_new_id UUID;
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

        -- Verify that sum across active templates equals 100 for 5-phase set
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

-- 11. Grants
GRANT EXECUTE ON FUNCTION public.admin_get_feedback(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_feedback_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_pending_credentials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_credential(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_reference_category(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_phase_template(TEXT, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_app_setting(TEXT, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_user_email(UUID) TO authenticated;
