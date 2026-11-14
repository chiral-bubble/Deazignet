-- ==============================================================================
-- Migration 049: Comprehensive Admin Console, Capability-Based Authorization,
-- Financial Actions Queue, Fee Schedule Versions, Promotions, Unified Reports,
-- and Append-Only Security Audit Log Trigger
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Append-Only Trigger on admin_audit_log
-- Strictly prevents any UPDATE or DELETE operations on admin_audit_log
-- ------------------------------------------------------------------------------

-- Ensure admin_audit_log has reason column for private content reads
ALTER TABLE public.admin_audit_log 
    ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE OR REPLACE FUNCTION public.trg_prevent_admin_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'admin_audit_log is append-only and cannot be modified or deleted.' 
        USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_changes ON public.admin_audit_log;
CREATE TRIGGER trg_prevent_audit_log_changes
    BEFORE UPDATE OR DELETE ON public.admin_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_prevent_admin_audit_log_modification();

-- ------------------------------------------------------------------------------
-- 2. Admin Roles & Capability-Based Access Control
-- Roles: super_admin, moderator, support, finance, verifier
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admin_roles (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'moderator', 'support', 'finance', 'verifier')),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_admin_roles_user ON public.admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON public.admin_roles(role);

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin roles" ON public.admin_roles;
CREATE POLICY "Admins can view admin roles"
    ON public.admin_roles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.admin_capabilities (
    role TEXT NOT NULL,
    capability TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (role, capability)
);

-- Seed role capability matrix
INSERT INTO public.admin_capabilities (role, capability, description) VALUES
    -- super_admin: full system control
    ('super_admin', 'users_manage', 'Search, inspect, view, suspend, and grant complimentary plans to users'),
    ('super_admin', 'projects_manage', 'Inspect, unpublish, remove, and restore client projects'),
    ('super_admin', 'moderation_manage', 'Dismiss, warn, hide content, and suspend reported entities'),
    ('super_admin', 'credentials_manage', 'Review and approve/reject professional credentials'),
    ('super_admin', 'disputes_manage', 'Review and resolve contract disputes with financial payouts'),
    ('super_admin', 'financial_manage', 'Approve, reject, and execute refunds and financial actions'),
    ('super_admin', 'plans_fees_manage', 'Update plan prices, limits, and fee schedule versions'),
    ('super_admin', 'promotions_manage', 'Create, update, and toggle designer promotions'),
    ('super_admin', 'analytics_view', 'View platform analytics and export metrics'),
    ('super_admin', 'support_manage', 'Manage support tickets and internal notes'),
    ('super_admin', 'roles_manage', 'Assign and revoke admin team roles'),
    ('super_admin', 'audit_view', 'View append-only audit trail and export CSV'),
    ('super_admin', 'private_content_read', 'Read private messages and documents with mandatory written reason'),

    -- moderator: content, projects, users
    ('moderator', 'moderation_manage', 'Dismiss, warn, hide content, and suspend reported entities'),
    ('moderator', 'projects_manage', 'Inspect, unpublish, remove, and restore client projects'),
    ('moderator', 'users_manage', 'Search, inspect, view, suspend users'),
    ('moderator', 'private_content_read', 'Read private messages and documents with mandatory written reason'),

    -- support: user tickets & accounts
    ('support', 'support_manage', 'Manage support tickets and internal notes'),
    ('support', 'users_manage', 'Search, inspect, view users'),
    ('support', 'private_content_read', 'Read private messages and documents with mandatory written reason'),

    -- finance: financial actions, disputes payouts, fees
    ('finance', 'financial_manage', 'Approve, reject, and execute refunds and financial actions'),
    ('finance', 'disputes_manage', 'Review and resolve contract disputes with financial payouts'),
    ('finance', 'plans_fees_manage', 'Update plan prices, limits, and fee schedule versions'),
    ('finance', 'analytics_view', 'View platform analytics and export metrics'),
    ('finance', 'audit_view', 'View append-only audit trail and export CSV'),

    -- verifier: credential checks
    ('verifier', 'credentials_manage', 'Review and approve/reject professional credentials')
ON CONFLICT (role, capability) DO NOTHING;

ALTER TABLE public.admin_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read admin capabilities" ON public.admin_capabilities;
CREATE POLICY "Anyone can read admin capabilities"
    ON public.admin_capabilities
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Function: check_admin_capability
CREATE OR REPLACE FUNCTION public.check_admin_capability(
    p_user_id UUID,
    p_capability TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_has_super BOOLEAN;
    v_has_role_entry BOOLEAN;
    v_has_cap BOOLEAN;
BEGIN
    IF p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Must have admin profile role
    SELECT (role = 'admin'::public.user_role) INTO v_is_admin
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_is_admin IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- Check if super_admin in admin_roles
    SELECT EXISTS (
        SELECT 1 FROM public.admin_roles
        WHERE user_id = p_user_id AND role = 'super_admin'
    ) INTO v_has_super;

    IF v_has_super THEN
        RETURN TRUE;
    END IF;

    -- Bootstrap fallback: If user is admin profile but has no entry in admin_roles yet, grant all
    SELECT EXISTS (
        SELECT 1 FROM public.admin_roles WHERE user_id = p_user_id
    ) INTO v_has_role_entry;

    IF NOT v_has_role_entry THEN
        RETURN TRUE;
    END IF;

    -- Check mapped capability for assigned roles
    SELECT EXISTS (
        SELECT 1 
        FROM public.admin_roles ar
        JOIN public.admin_capabilities ac ON ac.role = ar.role
        WHERE ar.user_id = p_user_id AND ac.capability = p_capability
    ) INTO v_has_cap;

    RETURN v_has_cap;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Profile & Project Safety Columns
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
    ADD COLUMN IF NOT EXISTS admin_notes TEXT;

ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS complimentary_plan_id TEXT,
    ADD COLUMN IF NOT EXISTS complimentary_plan_expires_at TIMESTAMPTZ;

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS is_admin_removed BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_removal_reason TEXT;

-- ------------------------------------------------------------------------------
-- 4. Unified Reports & Moderation Table
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL CHECK (target_type IN ('message', 'review', 'project', 'profile', 'proposal')),
    target_id TEXT NOT NULL,
    target_preview TEXT,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_email TEXT,
    reason TEXT NOT NULL CHECK (length(trim(reason)) >= 3),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON public.reports(created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports"
    ON public.reports
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users can file reports" ON public.reports;
CREATE POLICY "Users can file reports"
    ON public.reports
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 5. Financial Actions Queue Table
-- (refund, payout_release, split_resolution, fee_adjustment, compensation)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.financial_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('refund', 'payout_release', 'split_resolution', 'fee_adjustment', 'compensation')),
    engagement_id UUID REFERENCES public.engagements(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES public.engagement_milestones(id) ON DELETE SET NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'executed', 'rejected')),
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    second_approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    executed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_actions_status ON public.financial_actions(status);
CREATE INDEX IF NOT EXISTS idx_financial_actions_engagement ON public.financial_actions(engagement_id);
CREATE INDEX IF NOT EXISTS idx_financial_actions_created ON public.financial_actions(created_at DESC);

ALTER TABLE public.financial_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view financial actions" ON public.financial_actions;
CREATE POLICY "Admins can view financial actions"
    ON public.financial_actions
    FOR ALL
    TO authenticated
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. Fee Schedule Versions Table
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fee_schedule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    tiers JSONB NOT NULL,
    marginal_mode BOOLEAN NOT NULL DEFAULT true,
    basis TEXT NOT NULL DEFAULT 'cumulative_project',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (length(trim(reason)) >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_schedule_versions_effective ON public.fee_schedule_versions(effective_from DESC);

ALTER TABLE public.fee_schedule_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view fee schedules" ON public.fee_schedule_versions;
CREATE POLICY "Admins can view fee schedules"
    ON public.fee_schedule_versions
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Insert initial baseline fee schedule if empty
INSERT INTO public.fee_schedule_versions (
    version,
    effective_from,
    tiers,
    marginal_mode,
    basis,
    reason
)
SELECT 
    'v1.0.0',
    now(),
    '[
        {"up_to_cents": 500000, "rate": 0.10, "label": "First $5,000 (10%)"},
        {"up_to_cents": 1000000, "rate": 0.05, "label": "$5,000 to $10,000 (5%)"},
        {"up_to_cents": null, "rate": 0.025, "label": "Over $10,000 (2.5%)"}
    ]'::jsonb,
    true,
    'cumulative_project',
    'Initial launch progressive platform fee structure'
WHERE NOT EXISTS (SELECT 1 FROM public.fee_schedule_versions);

-- ------------------------------------------------------------------------------
-- 7. Promotions Table (Controlled by promotions_enabled app setting)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(id) ON DELETE CASCADE,
    placement TEXT NOT NULL CHECK (placement IN ('search_top', 'featured_card', 'hero', 'badge')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
    label TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promotions_designer ON public.promotions(designer_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(starts_at, ends_at);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
CREATE POLICY "Admins can manage promotions"
    ON public.promotions
    FOR ALL
    TO authenticated
    USING (public.is_admin());

-- Support tickets updates
ALTER TABLE public.support_tickets
    ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- ------------------------------------------------------------------------------
-- 8. Seed Default Settings
-- ------------------------------------------------------------------------------

INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('financial_approval_threshold', '{"threshold_usd": 1000, "threshold_cents": 100000}'::jsonb, 'Dollar amount above which financial actions require approval by a second admin under the two-person rule'),
    ('promotions_enabled', 'false'::jsonb, 'Feature switch enabling designer marketplace promotions and sponsored placements')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. Security Definer RPC Functions
-- ------------------------------------------------------------------------------

-- Helper to record private read with mandatory written reason
CREATE OR REPLACE FUNCTION public.admin_log_private_read(
    p_target_type TEXT,
    p_target_id TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_email TEXT;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'private_content_read') THEN
        RAISE EXCEPTION 'Admin authorization required for reading private content.' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A specific written reason is required (minimum 5 characters) to access private user content.' 
            USING ERRCODE = 'P0002';
    END IF;

    SELECT email INTO v_email FROM public.profiles WHERE id = v_admin_id;

    INSERT INTO public.admin_audit_log (
        admin_id,
        admin_email,
        action,
        target_type,
        target_id,
        reason,
        before_state,
        after_state
    )
    VALUES (
        v_admin_id,
        v_email,
        'read_private_content',
        p_target_type,
        p_target_id,
        trim(p_reason),
        NULL,
        jsonb_build_object('read_at', now(), 'reason', trim(p_reason))
    );

    RETURN jsonb_build_object('success', true, 'recorded', true);
END;
$$;

-- Overview Counts & Queue Ages
CREATE OR REPLACE FUNCTION public.admin_get_overview_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_pending_reports BIGINT;
    v_pending_credentials BIGINT;
    v_pending_disputes BIGINT;
    v_pending_financial BIGINT;
    v_open_tickets BIGINT;
    v_suspended_users BIGINT;
    v_active_promotions BIGINT;
    v_oldest_report_age_hrs NUMERIC;
    v_oldest_credential_age_hrs NUMERIC;
    v_oldest_dispute_age_hrs NUMERIC;
    v_oldest_financial_age_hrs NUMERIC;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*), COALESCE(ROUND(EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 3600, 1), 0)
    INTO v_pending_reports, v_oldest_report_age_hrs
    FROM public.reports WHERE status = 'pending';

    SELECT COUNT(*), COALESCE(ROUND(EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 3600, 1), 0)
    INTO v_pending_credentials, v_oldest_credential_age_hrs
    FROM public.designer_credentials WHERE status = 'pending';

    SELECT COUNT(*), COALESCE(ROUND(EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 3600, 1), 0)
    INTO v_pending_disputes, v_oldest_dispute_age_hrs
    FROM public.disputes WHERE status = 'open';

    SELECT COUNT(*), COALESCE(ROUND(EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 3600, 1), 0)
    INTO v_pending_financial, v_oldest_financial_age_hrs
    FROM public.financial_actions WHERE status = 'pending';

    SELECT COUNT(*) INTO v_open_tickets
    FROM public.support_tickets WHERE status = 'open';

    SELECT COUNT(*) INTO v_suspended_users
    FROM public.profiles WHERE is_suspended = true;

    SELECT COUNT(*) INTO v_active_promotions
    FROM public.promotions WHERE now() BETWEEN starts_at AND ends_at;

    RETURN jsonb_build_object(
        'pending_reports', v_pending_reports,
        'pending_credentials', v_pending_credentials,
        'pending_disputes', v_pending_disputes,
        'pending_financial_actions', v_pending_financial,
        'open_support_tickets', v_open_tickets,
        'suspended_users', v_suspended_users,
        'active_promotions', v_active_promotions,
        'oldest_report_age_hrs', v_oldest_report_age_hrs,
        'oldest_credential_age_hrs', v_oldest_credential_age_hrs,
        'oldest_dispute_age_hrs', v_oldest_dispute_age_hrs,
        'oldest_financial_age_hrs', v_oldest_financial_age_hrs
    );
END;
$$;

-- User Management: Suspension & Complimentary Plans
CREATE OR REPLACE FUNCTION public.admin_toggle_user_suspension(
    p_user_id UUID,
    p_suspend BOOLEAN,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_before RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'users_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability users_manage required.' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A clear reason is required (minimum 5 characters).' USING ERRCODE = 'P0002';
    END IF;

    SELECT id, email, role, is_suspended, suspension_reason INTO v_before 
    FROM public.profiles WHERE id = p_user_id;

    IF v_before.id IS NULL THEN
        RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_before.role = 'admin'::public.user_role THEN
        RAISE EXCEPTION 'Cannot suspend an admin profile directly.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.profiles
    SET is_suspended = p_suspend,
        suspended_at = CASE WHEN p_suspend THEN now() ELSE NULL END,
        suspension_reason = CASE WHEN p_suspend THEN trim(p_reason) ELSE NULL END,
        updated_at = now()
    WHERE id = p_user_id;

    PERFORM public.log_admin_action(
        CASE WHEN p_suspend THEN 'suspend_user' ELSE 'unsuspend_user' END,
        'profiles',
        p_user_id::TEXT,
        to_jsonb(v_before),
        jsonb_build_object('is_suspended', p_suspend, 'reason', trim(p_reason))
    );

    RETURN jsonb_build_object('success', true, 'is_suspended', p_suspend);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_complimentary_plan(
    p_designer_id UUID,
    p_plan_id TEXT,
    p_months INT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_before RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'users_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability users_manage required.' USING ERRCODE = '42501';
    END IF;

    IF p_plan_id NOT IN ('basic', 'gold') THEN
        RAISE EXCEPTION 'Invalid complimentary plan ID.' USING ERRCODE = 'P0002';
    END IF;

    IF p_months < 1 OR p_months > 24 THEN
        RAISE EXCEPTION 'Duration must be between 1 and 24 months.' USING ERRCODE = 'P0002';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A reason is required (minimum 5 characters).' USING ERRCODE = 'P0002';
    END IF;

    SELECT id, complimentary_plan_id, complimentary_plan_expires_at INTO v_before
    FROM public.designer_profiles WHERE id = p_designer_id;

    IF v_before.id IS NULL THEN
        RAISE EXCEPTION 'Designer profile not found.' USING ERRCODE = 'P0002';
    END IF;

    v_expires_at := now() + (p_months || ' months')::INTERVAL;

    UPDATE public.designer_profiles
    SET complimentary_plan_id = p_plan_id,
        complimentary_plan_expires_at = v_expires_at,
        updated_at = now()
    WHERE id = p_designer_id;

    PERFORM public.log_admin_action(
        'grant_complimentary_plan',
        'designer_profiles',
        p_designer_id::TEXT,
        to_jsonb(v_before),
        jsonb_build_object('plan_id', p_plan_id, 'expires_at', v_expires_at, 'reason', trim(p_reason))
    );

    RETURN jsonb_build_object('success', true, 'plan_id', p_plan_id, 'expires_at', v_expires_at);
END;
$$;

-- Projects Management (unpublish, remove, restore)
CREATE OR REPLACE FUNCTION public.admin_manage_project(
    p_project_id UUID,
    p_action TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_proj RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'projects_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability projects_manage required.' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A clear reason is required (minimum 5 characters).' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF p_action = 'unpublish' THEN
        UPDATE public.projects
        SET status = 'draft'::public.project_status,
            updated_at = now()
        WHERE id = p_project_id;
    ELSIF p_action = 'remove' THEN
        UPDATE public.projects
        SET is_admin_removed = true,
            admin_removal_reason = trim(p_reason),
            status = 'closed'::public.project_status,
            updated_at = now()
        WHERE id = p_project_id;
    ELSIF p_action = 'restore' THEN
        UPDATE public.projects
        SET is_admin_removed = false,
            admin_removal_reason = NULL,
            status = 'open'::public.project_status,
            updated_at = now()
        WHERE id = p_project_id;
    ELSE
        RAISE EXCEPTION 'Unsupported project management action.' USING ERRCODE = 'P0002';
    END IF;

    PERFORM public.log_admin_action(
        'project_' || p_action,
        'projects',
        p_project_id::TEXT,
        to_jsonb(v_proj),
        jsonb_build_object('action', p_action, 'reason', trim(p_reason))
    );

    RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- Moderation & Reports Resolution
CREATE OR REPLACE FUNCTION public.admin_resolve_report(
    p_report_id UUID,
    p_action TEXT, -- 'dismiss', 'warn', 'hide_content', 'suspend'
    p_resolution_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_rep RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'moderation_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability moderation_manage required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rep FROM public.reports WHERE id = p_report_id;
    IF v_rep.id IS NULL THEN
        RAISE EXCEPTION 'Report not found.' USING ERRCODE = 'P0002';
    END IF;

    IF p_action NOT IN ('dismiss', 'warn', 'hide_content', 'suspend') THEN
        RAISE EXCEPTION 'Invalid moderation action.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.reports
    SET status = CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
        assignee_id = v_admin_id,
        resolution = p_action || ': ' || COALESCE(trim(p_resolution_notes), 'Action taken by moderator'),
        resolved_at = now(),
        updated_at = now()
    WHERE id = p_report_id;

    PERFORM public.log_admin_action(
        'resolve_report',
        'reports',
        p_report_id::TEXT,
        to_jsonb(v_rep),
        jsonb_build_object('action', p_action, 'resolution', p_resolution_notes)
    );

    RETURN jsonb_build_object('success', true, 'status', CASE WHEN p_action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END);
END;
$$;

-- Financial Actions: Approval & Two-Person Rule Enforcement
CREATE OR REPLACE FUNCTION public.admin_approve_financial_action(
    p_action_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_action RECORD;
    v_threshold_cents BIGINT;
    v_thresh_setting JSONB;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'financial_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability financial_manage required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_action FROM public.financial_actions WHERE id = p_action_id;
    IF v_action.id IS NULL THEN
        RAISE EXCEPTION 'Financial action not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_action.status <> 'pending' THEN
        RAISE EXCEPTION 'Action is not pending approval.' USING ERRCODE = 'P0002';
    END IF;

    -- Retrieve approval threshold from app settings (default $1,000 = 100,000 cents)
    SELECT value INTO v_thresh_setting FROM public.app_settings WHERE key = 'financial_approval_threshold';
    v_threshold_cents := COALESCE((v_thresh_setting->>'threshold_cents')::BIGINT, 100000);

    -- Check if amount exceeds threshold requiring two-person rule
    IF v_action.amount_cents > v_threshold_cents THEN
        IF v_action.approved_by IS NULL THEN
            -- First approval
            UPDATE public.financial_actions
            SET approved_by = v_admin_id,
                notes = COALESCE(notes || E'\n', '') || 'First approval by ' || v_admin_id::TEXT || ': ' || COALESCE(p_notes, 'Approved'),
                updated_at = now()
            WHERE id = p_action_id;

            PERFORM public.log_admin_action(
                'approve_financial_action_first',
                'financial_actions',
                p_action_id::TEXT,
                to_jsonb(v_action),
                jsonb_build_object('amount_cents', v_action.amount_cents, 'two_person_required', true)
            );

            RETURN jsonb_build_object('success', true, 'status', 'pending', 'requires_second_approval', true);
        ELSIF v_action.approved_by = v_admin_id THEN
            RAISE EXCEPTION 'Two-person rule violation: action cannot be approved twice by the same administrator.' 
                USING ERRCODE = '42501';
        ELSE
            -- Second approval by different admin
            UPDATE public.financial_actions
            SET second_approved_by = v_admin_id,
                status = 'approved',
                notes = COALESCE(notes || E'\n', '') || 'Second approval by ' || v_admin_id::TEXT || ': ' || COALESCE(p_notes, 'Approved'),
                updated_at = now()
            WHERE id = p_action_id;

            PERFORM public.log_admin_action(
                'approve_financial_action_second',
                'financial_actions',
                p_action_id::TEXT,
                to_jsonb(v_action),
                jsonb_build_object('amount_cents', v_action.amount_cents, 'status', 'approved')
            );

            RETURN jsonb_build_object('success', true, 'status', 'approved', 'requires_second_approval', false);
        END IF;
    ELSE
        -- Below threshold: single approval suffices
        UPDATE public.financial_actions
        SET approved_by = v_admin_id,
            status = 'approved',
            notes = COALESCE(notes || E'\n', '') || 'Approved by ' || v_admin_id::TEXT || ': ' || COALESCE(p_notes, 'Approved'),
            updated_at = now()
        WHERE id = p_action_id;

        PERFORM public.log_admin_action(
            'approve_financial_action',
            'financial_actions',
            p_action_id::TEXT,
            to_jsonb(v_action),
            jsonb_build_object('amount_cents', v_action.amount_cents, 'status', 'approved')
        );

        RETURN jsonb_build_object('success', true, 'status', 'approved', 'requires_second_approval', false);
    END IF;
END;
$$;

-- Financial Actions: Rejection
CREATE OR REPLACE FUNCTION public.admin_reject_financial_action(
    p_action_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_action RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'financial_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability financial_manage required.' USING ERRCODE = '42501';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A rejection reason is required (minimum 5 characters).' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_action FROM public.financial_actions WHERE id = p_action_id;
    IF v_action.id IS NULL THEN
        RAISE EXCEPTION 'Financial action not found.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.financial_actions
    SET status = 'rejected',
        notes = COALESCE(notes || E'\n', '') || 'Rejected by ' || v_admin_id::TEXT || ': ' || trim(p_reason),
        updated_at = now()
    WHERE id = p_action_id;

    PERFORM public.log_admin_action(
        'reject_financial_action',
        'financial_actions',
        p_action_id::TEXT,
        to_jsonb(v_action),
        jsonb_build_object('reason', trim(p_reason))
    );

    RETURN jsonb_build_object('success', true, 'status', 'rejected');
END;
$$;

-- Financial Actions: Execution
CREATE OR REPLACE FUNCTION public.admin_execute_financial_action(
    p_action_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_action RECORD;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'financial_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability financial_manage required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_action FROM public.financial_actions WHERE id = p_action_id;
    IF v_action.id IS NULL THEN
        RAISE EXCEPTION 'Financial action not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_action.status <> 'approved' THEN
        RAISE EXCEPTION 'Only fully approved actions can be executed.' USING ERRCODE = 'P0002';
    END IF;

    -- Update milestone payout status if applicable
    IF v_action.milestone_id IS NOT NULL THEN
        IF v_action.type = 'payout_release' THEN
            UPDATE public.engagement_milestones
            SET payout_status = 'paid'::public.milestone_payout_status,
                paid_at = now(),
                status = 'approved'::public.milestone_status
            WHERE id = v_action.milestone_id;
        ELSIF v_action.type = 'refund' THEN
            UPDATE public.engagement_milestones
            SET payout_status = 'refunded'::public.milestone_payout_status,
                status = 'cancelled'::public.milestone_status
            WHERE id = v_action.milestone_id;
        END IF;
    END IF;

    UPDATE public.financial_actions
    SET status = 'executed',
        executed_at = now(),
        updated_at = now()
    WHERE id = p_action_id;

    PERFORM public.log_admin_action(
        'execute_financial_action',
        'financial_actions',
        p_action_id::TEXT,
        to_jsonb(v_action),
        jsonb_build_object('executed_at', now())
    );

    RETURN jsonb_build_object('success', true, 'status', 'executed');
END;
$$;

-- Disputes Console: Resolution
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(
    p_dispute_id UUID,
    p_outcome TEXT, -- 'release', 'refund', 'split'
    p_notes TEXT,
    p_split_percent INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_disp RECORD;
    v_ms RECORD;
    v_action_id UUID;
    v_designer_amount BIGINT;
    v_client_amount BIGINT;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'disputes_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability disputes_manage required.' USING ERRCODE = '42501';
    END IF;

    IF p_outcome NOT IN ('release', 'refund', 'split') THEN
        RAISE EXCEPTION 'Outcome must be release, refund, or split.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_disp FROM public.disputes WHERE id = p_dispute_id;
    IF v_disp.id IS NULL THEN
        RAISE EXCEPTION 'Dispute not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = v_disp.milestone_id;

    -- Mark dispute resolved
    UPDATE public.disputes
    SET status = 'resolved'::public.dispute_status,
        resolved_at = now()
    WHERE id = p_dispute_id;

    -- Create corresponding financial actions
    IF p_outcome = 'release' THEN
        INSERT INTO public.financial_actions (
            type,
            engagement_id,
            milestone_id,
            amount_cents,
            requested_by,
            notes
        )
        VALUES (
            'payout_release',
            v_disp.engagement_id,
            v_disp.milestone_id,
            COALESCE(v_ms.amount_cents, 0),
            v_admin_id,
            'Dispute ' || p_dispute_id::TEXT || ' resolved: Full release to designer. ' || COALESCE(p_notes, '')
        )
        RETURNING id INTO v_action_id;

    ELSIF p_outcome = 'refund' THEN
        INSERT INTO public.financial_actions (
            type,
            engagement_id,
            milestone_id,
            amount_cents,
            requested_by,
            notes
        )
        VALUES (
            'refund',
            v_disp.engagement_id,
            v_disp.milestone_id,
            COALESCE(v_ms.amount_cents, 0),
            v_admin_id,
            'Dispute ' || p_dispute_id::TEXT || ' resolved: Full refund to client. ' || COALESCE(p_notes, '')
        )
        RETURNING id INTO v_action_id;

    ELSIF p_outcome = 'split' THEN
        v_designer_amount := ROUND(COALESCE(v_ms.amount_cents, 0) * (p_split_percent::NUMERIC / 100.0));
        v_client_amount := COALESCE(v_ms.amount_cents, 0) - v_designer_amount;

        INSERT INTO public.financial_actions (
            type,
            engagement_id,
            milestone_id,
            amount_cents,
            requested_by,
            notes
        )
        VALUES (
            'split_resolution',
            v_disp.engagement_id,
            v_disp.milestone_id,
            v_designer_amount,
            v_admin_id,
            'Dispute ' || p_dispute_id::TEXT || ' split payout: ' || p_split_percent || '% (' || v_designer_amount || ' cents) to designer. ' || COALESCE(p_notes, '')
        );

        INSERT INTO public.financial_actions (
            type,
            engagement_id,
            milestone_id,
            amount_cents,
            requested_by,
            notes
        )
        VALUES (
            'refund',
            v_disp.engagement_id,
            v_disp.milestone_id,
            v_client_amount,
            v_admin_id,
            'Dispute ' || p_dispute_id::TEXT || ' split refund: ' || (100 - p_split_percent) || '% (' || v_client_amount || ' cents) to client. ' || COALESCE(p_notes, '')
        );
    END IF;

    PERFORM public.log_admin_action(
        'resolve_dispute',
        'disputes',
        p_dispute_id::TEXT,
        to_jsonb(v_disp),
        jsonb_build_object('outcome', p_outcome, 'notes', p_notes, 'split_percent', p_split_percent)
    );

    RETURN jsonb_build_object('success', true, 'outcome', p_outcome);
END;
$$;

-- Fee Schedule Versioning
CREATE OR REPLACE FUNCTION public.admin_create_fee_schedule_version(
    p_version TEXT,
    p_tiers JSONB,
    p_marginal_mode BOOLEAN,
    p_basis TEXT,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_new_id UUID;
BEGIN
    v_admin_id := auth.uid();
    IF NOT public.check_admin_capability(v_admin_id, 'plans_fees_manage') THEN
        RAISE EXCEPTION 'Unauthorized: capability plans_fees_manage required.' USING ERRCODE = '42501';
    END IF;

    IF p_version IS NULL OR length(trim(p_version)) < 2 THEN
        RAISE EXCEPTION 'Version identifier required (e.g. v1.1.0).' USING ERRCODE = 'P0002';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'A justification reason is required (minimum 5 characters).' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.fee_schedule_versions (
        version,
        effective_from,
        tiers,
        marginal_mode,
        basis,
        created_by,
        reason
    )
    VALUES (
        trim(p_version),
        now(),
        p_tiers,
        COALESCE(p_marginal_mode, true),
        COALESCE(p_basis, 'cumulative_project'),
        v_admin_id,
        trim(p_reason)
    )
    RETURNING id INTO v_new_id;

    -- Update active platform fee tiers in app_settings
    INSERT INTO public.app_settings (key, value, description)
    VALUES ('platform_fee_tiers', p_tiers, 'Platform fee progressive brackets')
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value;

    PERFORM public.log_admin_action(
        'create_fee_schedule_version',
        'fee_schedule_versions',
        v_new_id::TEXT,
        NULL,
        jsonb_build_object('version', p_version, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'version', p_version);
END;
$$;

-- Super Admin: Admin Role Management
CREATE OR REPLACE FUNCTION public.admin_manage_admin_role(
    p_target_user_id UUID,
    p_role TEXT,
    p_action TEXT -- 'grant', 'revoke'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID;
    v_is_super BOOLEAN;
BEGIN
    v_admin_id := auth.uid();

    -- Check if calling user is super_admin
    SELECT check_admin_capability(v_admin_id, 'roles_manage') INTO v_is_super;
    IF NOT v_is_super THEN
        RAISE EXCEPTION 'Unauthorized: only super_admin can manage administrative roles.' 
            USING ERRCODE = '42501';
    END IF;

    IF p_role NOT IN ('super_admin', 'moderator', 'support', 'finance', 'verifier') THEN
        RAISE EXCEPTION 'Invalid admin role.' USING ERRCODE = 'P0002';
    END IF;

    IF p_action = 'grant' THEN
        -- Ensure target profile has admin role in profiles
        UPDATE public.profiles
        SET role = 'admin'::public.user_role
        WHERE id = p_target_user_id;

        INSERT INTO public.admin_roles (user_id, role, granted_by, granted_at)
        VALUES (p_target_user_id, p_role, v_admin_id, now())
        ON CONFLICT (user_id, role) DO UPDATE
        SET granted_by = EXCLUDED.granted_by,
            granted_at = now();

        PERFORM public.log_admin_action(
            'grant_admin_role',
            'admin_roles',
            p_target_user_id::TEXT,
            NULL,
            jsonb_build_object('role', p_role)
        );

        RETURN jsonb_build_object('success', true, 'action', 'granted', 'role', p_role);

    ELSIF p_action = 'revoke' THEN
        IF p_target_user_id = v_admin_id AND p_role = 'super_admin' THEN
            RAISE EXCEPTION 'Cannot revoke your own super_admin role.' USING ERRCODE = '42501';
        END IF;

        DELETE FROM public.admin_roles
        WHERE user_id = p_target_user_id AND role = p_role;

        PERFORM public.log_admin_action(
            'revoke_admin_role',
            'admin_roles',
            p_target_user_id::TEXT,
            NULL,
            jsonb_build_object('role', p_role)
        );

        RETURN jsonb_build_object('success', true, 'action', 'revoked', 'role', p_role);
    ELSE
        RAISE EXCEPTION 'Invalid action. Must be grant or revoke.' USING ERRCODE = 'P0002';
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Grants
-- ------------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.check_admin_capability(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_log_private_read(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_overview_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_user_suspension(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_complimentary_plan(UUID, TEXT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_project(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_financial_action(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_financial_action(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_execute_financial_action(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_dispute(UUID, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_fee_schedule_version(TEXT, JSONB, BOOLEAN, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_admin_role(UUID, TEXT, TEXT) TO authenticated;
