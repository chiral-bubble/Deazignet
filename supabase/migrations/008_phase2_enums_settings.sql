-- ==============================================================================
-- DEZIGNET PHASE 2: 008_phase2_enums_settings.sql
-- Enums, App Settings, Plan Limits, and Designer Plan Column Protection
-- ==============================================================================

-- 1. Create Phase 2 ENUMs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE public.project_status AS ENUM (
            'draft',
            'open',
            'awarded',
            'closed',
            'cancelled'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type') THEN
        CREATE TYPE public.payment_type AS ENUM (
            'milestone',
            'hourly'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'proposal_status') THEN
        CREATE TYPE public.proposal_status AS ENUM (
            'pending',
            'viewed',
            'shortlisted',
            'accepted',
            'declined',
            'withdrawn'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
        CREATE TYPE public.plan_tier AS ENUM (
            'free',
            'basic',
            'upgraded'
        );
    END IF;
END $$;

-- 2. App Settings Table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Seed initial app settings
INSERT INTO public.app_settings (key, value, description)
VALUES
    ('platform_fee_percent', '10.0'::jsonb, 'Default platform fee percentage for escrow'),
    ('proposal_edit_before_view', 'true'::jsonb, 'Allow designers to edit pending proposals before client views them'),
    ('withdrawn_restores_slot', 'false'::jsonb, 'Whether withdrawing a proposal restores the monthly plan quota'),
    ('default_currency', '"USD"'::jsonb, 'Default currency for projects and proposals')
ON CONFLICT (key) DO NOTHING;

-- 3. Plan Limits Table
CREATE TABLE IF NOT EXISTS public.plan_limits (
    plan public.plan_tier PRIMARY KEY,
    monthly_proposal_limit INT NOT NULL CHECK (monthly_proposal_limit >= 0),
    portfolio_item_limit INT NOT NULL CHECK (portfolio_item_limit >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_plan_limits_updated_at ON public.plan_limits;
CREATE TRIGGER trg_plan_limits_updated_at
    BEFORE UPDATE ON public.plan_limits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Seed initial plan limits
INSERT INTO public.plan_limits (plan, monthly_proposal_limit, portfolio_item_limit)
VALUES
    ('free', 5, 10),
    ('basic', 20, 30),
    ('upgraded', 60, 100)
ON CONFLICT (plan) DO NOTHING;

-- 4. Add plan column to designer_profiles with protection trigger
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'designer_profiles'
          AND column_name = 'plan'
    ) THEN
        ALTER TABLE public.designer_profiles
        ADD COLUMN plan public.plan_tier NOT NULL DEFAULT 'free';
    END IF;
END $$;

-- Column protection trigger: prevent non-admins from changing their own plan
CREATE OR REPLACE FUNCTION public.check_designer_plan_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.plan IS DISTINCT FROM NEW.plan) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Users cannot modify their own plan tier. Plan must be updated via official billing.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_designer_plan ON public.designer_profiles;
CREATE TRIGGER trg_protect_designer_plan
    BEFORE UPDATE OF plan ON public.designer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_designer_plan_update();

-- 5. RLS Policies on app_settings and plan_limits
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read app_settings" ON public.app_settings;
CREATE POLICY "Authenticated users can read app_settings"
    ON public.app_settings
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage app_settings" ON public.app_settings;
CREATE POLICY "Admins can manage app_settings"
    ON public.app_settings
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can read plan_limits" ON public.plan_limits;
CREATE POLICY "Authenticated users can read plan_limits"
    ON public.plan_limits
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage plan_limits" ON public.plan_limits;
CREATE POLICY "Admins can manage plan_limits"
    ON public.plan_limits
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
