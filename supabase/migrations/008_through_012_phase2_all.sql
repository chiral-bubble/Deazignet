-- ==============================================================================
-- DEZIGNET PHASE 2: COMPLETE CONSOLIDATED MIGRATION (008 through 012)
-- Client Projects, Designer Proposals, Milestones, RLS, Views, Functions & Search
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: 008_phase2_enums_settings.sql
-- ------------------------------------------------------------------------------

-- Create Phase 2 ENUMs
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

-- App Settings Table
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

-- Plan Limits Table
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

-- Add plan column to designer_profiles with protection trigger
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

-- RLS Policies on app_settings and plan_limits
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

-- ------------------------------------------------------------------------------
-- PART 2: 009_client_profiles_projects.sql
-- ------------------------------------------------------------------------------

-- Drop legacy prototype tables if present from earlier testing to ensure clean schema
DROP TABLE IF EXISTS public.proposal_versions CASCADE;
DROP TABLE IF EXISTS public.proposal_events CASCADE;
DROP TABLE IF EXISTS public.proposal_portfolio_items CASCADE;
DROP TABLE IF EXISTS public.proposal_milestones CASCADE;
DROP TABLE IF EXISTS public.proposals CASCADE;
DROP TABLE IF EXISTS public.project_images CASCADE;
DROP TABLE IF EXISTS public.project_milestones CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.client_profiles CASCADE;
DROP VIEW IF EXISTS public.open_projects CASCADE;
DROP VIEW IF EXISTS public.client_summaries CASCADE;

-- Client Profiles Table
CREATE TABLE IF NOT EXISTS public.client_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    payment_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_client_profiles_updated_at ON public.client_profiles;
CREATE TRIGGER trg_client_profiles_updated_at
    BEFORE UPDATE ON public.client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-initialize client_profiles on new client registration
CREATE OR REPLACE FUNCTION public.handle_new_client_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'client'::public.user_role THEN
        INSERT INTO public.client_profiles (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_client_profile ON public.profiles;
CREATE TRIGGER trg_init_client_profile
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_client_profile();

-- Protect payment_verified from unauthorized client modification
CREATE OR REPLACE FUNCTION public.protect_client_payment_verified()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.payment_verified IS DISTINCT FROM NEW.payment_verified) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Clients cannot verify their own payment method.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_payment_verified ON public.client_profiles;
CREATE TRIGGER trg_protect_payment_verified
    BEFORE UPDATE OF payment_verified ON public.client_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_client_payment_verified();

-- Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.client_profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    project_type_notes TEXT,
    budget NUMERIC(12,2) NOT NULL CHECK (budget > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    payment_type public.payment_type NOT NULL,
    hourly_rate_max NUMERIC(12,2) CHECK (hourly_rate_max IS NULL OR hourly_rate_max > 0),
    timeline_days INT CHECK (timeline_days IS NULL OR timeline_days > 0),
    deadline DATE,
    area_sqft NUMERIC(10,2) CHECK (area_sqft IS NULL OR area_sqft >= 0),
    location_text TEXT,
    city TEXT,
    state_region TEXT,
    status public.project_status NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    search TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english',
            coalesce(title, '') || ' ' ||
            coalesce(description, '') || ' ' ||
            coalesce(category, '') || ' ' ||
            coalesce(subcategory, '') || ' ' ||
            coalesce(location_text, '') || ' ' ||
            coalesce(city, '') || ' ' ||
            coalesce(state_region, '')
        )
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Search and filter indexes on projects
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_budget ON public.projects(budget);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON public.projects(published_at);
CREATE INDEX IF NOT EXISTS idx_projects_search ON public.projects USING GIN(search);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Project Milestones Table (Client Project Plan)
CREATE TABLE IF NOT EXISTS public.project_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    sort_order INT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    deliverables TEXT[] DEFAULT '{}',
    billing_trigger TEXT,
    fee_percent NUMERIC(5,2) NOT NULL CHECK (fee_percent > 0 AND fee_percent <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON public.project_milestones(project_id);

DROP TRIGGER IF EXISTS trg_project_milestones_updated_at ON public.project_milestones;
CREATE TRIGGER trg_project_milestones_updated_at
    BEFORE UPDATE ON public.project_milestones
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Project Images Table
CREATE TABLE IF NOT EXISTS public.project_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON public.project_images(project_id);

-- Project Lifecycle and Validation Trigger
CREATE OR REPLACE FUNCTION public.check_project_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
    v_milestone_count INT;
    v_percent_sum NUMERIC(6,2);
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        IF OLD.status = 'awarded'::public.project_status THEN
            RAISE EXCEPTION 'An awarded project cannot be reopened or modified.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.status = 'draft'::public.project_status AND NEW.status NOT IN ('open'::public.project_status, 'cancelled'::public.project_status) THEN
            RAISE EXCEPTION 'A draft project can only transition to open or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.status = 'open'::public.project_status AND NEW.status NOT IN ('awarded'::public.project_status, 'closed'::public.project_status, 'cancelled'::public.project_status) THEN
            RAISE EXCEPTION 'An open project can only transition to awarded, closed, or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        IF NEW.status = 'open'::public.project_status THEN
            IF NEW.published_at IS NULL THEN
                NEW.published_at := NOW();
            END IF;

            IF NEW.budget <= 0 THEN
                RAISE EXCEPTION 'Project budget must be greater than zero to publish.'
                    USING ERRCODE = 'P0001';
            END IF;

            IF NEW.deadline IS NOT NULL AND NEW.deadline < CURRENT_DATE THEN
                RAISE EXCEPTION 'Project deadline must be in the future to publish.'
                    USING ERRCODE = 'P0001';
            END IF;

            IF NEW.payment_type = 'milestone'::public.payment_type THEN
                SELECT COUNT(*), coalesce(SUM(fee_percent), 0)
                INTO v_milestone_count, v_percent_sum
                FROM public.project_milestones
                WHERE project_id = NEW.id;

                IF v_milestone_count = 0 THEN
                    RAISE EXCEPTION 'Milestone projects must have at least one milestone phase before opening.'
                        USING ERRCODE = 'P0001';
                END IF;

                IF abs(v_percent_sum - 100.0) > 0.01 THEN
                    RAISE EXCEPTION 'Project milestone fee percentages must total exactly 100 percent before opening. Current total: %', v_percent_sum
                        USING ERRCODE = 'P0001';
                END IF;
            ELSIF NEW.payment_type = 'hourly'::public.payment_type THEN
                SELECT COUNT(*) INTO v_milestone_count
                FROM public.project_milestones
                WHERE project_id = NEW.id;

                IF v_milestone_count > 0 THEN
                    RAISE EXCEPTION 'Hourly projects cannot have milestone phases.'
                        USING ERRCODE = 'P0001';
                END IF;
            END IF;
        END IF;

        IF NEW.status IN ('awarded'::public.project_status, 'closed'::public.project_status, 'cancelled'::public.project_status) AND NEW.closed_at IS NULL THEN
            NEW.closed_at := NOW();
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_project_lifecycle ON public.projects;
CREATE TRIGGER trg_project_lifecycle
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.check_project_lifecycle();

-- ------------------------------------------------------------------------------
-- PART 3: 010_project_rls_views.sql & 011_proposals.sql
-- ------------------------------------------------------------------------------

-- Proposals Table
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.proposal_status NOT NULL DEFAULT 'pending',
    cover_letter TEXT NOT NULL CHECK (char_length(cover_letter) <= 1500),
    total_price NUMERIC(12,2) NOT NULL CHECK (total_price > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    delivery_days INT NOT NULL CHECK (delivery_days > 0),
    hourly_rate NUMERIC(12,2) CHECK (hourly_rate IS NULL OR hourly_rate > 0),
    estimated_hours NUMERIC(8,2) CHECK (estimated_hours IS NULL OR estimated_hours > 0),
    exclusions TEXT,
    question_for_client TEXT,
    client_answer TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    decline_reason TEXT,
    withdraw_reason TEXT,
    version_count INT NOT NULL DEFAULT 1 CHECK (version_count >= 1),
    project_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_proposals_project_designer UNIQUE (project_id, designer_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON public.proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_designer_id ON public.proposals(designer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_sent_at ON public.proposals(sent_at);

DROP TRIGGER IF EXISTS trg_proposals_updated_at ON public.proposals;
CREATE TRIGGER trg_proposals_updated_at
    BEFORE UPDATE ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Proposal Milestones Table
CREATE TABLE IF NOT EXISTS public.proposal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    project_milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    fee_percent NUMERIC(5,2) NOT NULL CHECK (fee_percent > 0 AND fee_percent <= 100),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_milestones_proposal_id ON public.proposal_milestones(proposal_id);

-- Proposal Portfolio Items Table
CREATE TABLE IF NOT EXISTS public.proposal_portfolio_items (
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    portfolio_project_id UUID NOT NULL REFERENCES public.portfolio_projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (proposal_id, portfolio_project_id)
);

-- Trigger to enforce maximum 5 portfolio items
CREATE OR REPLACE FUNCTION public.check_max_proposal_portfolio_items()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.proposal_portfolio_items
    WHERE proposal_id = NEW.proposal_id;

    IF v_count >= 5 THEN
        RAISE EXCEPTION 'A proposal can include a maximum of 5 portfolio projects.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_portfolio_items_count ON public.proposal_portfolio_items;
CREATE TRIGGER trg_check_portfolio_items_count
    BEFORE INSERT ON public.proposal_portfolio_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_max_proposal_portfolio_items();

-- Proposal Events Timeline Table
CREATE TABLE IF NOT EXISTS public.proposal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('sent', 'viewed', 'shortlisted', 'declined', 'withdrawn', 'edited', 'accepted')
    ),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_events_proposal_id ON public.proposal_events(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_events_created_at ON public.proposal_events(created_at);

-- Proposal Versions Table
CREATE TABLE IF NOT EXISTS public.proposal_versions (
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    version INT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (proposal_id, version)
);

-- Trigger to prevent clients from editing budget or payment_type once proposals exist
CREATE OR REPLACE FUNCTION public.check_project_updates()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status <> 'draft'::public.project_status THEN
        IF (OLD.budget IS DISTINCT FROM NEW.budget OR OLD.payment_type IS DISTINCT FROM NEW.payment_type) THEN
            IF EXISTS (SELECT 1 FROM public.proposals WHERE project_id = NEW.id) THEN
                RAISE EXCEPTION 'Cannot modify project budget or payment type once proposals have been received.'
                    USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_project_updates ON public.projects;
CREATE TRIGGER trg_check_project_updates
    BEFORE UPDATE ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.check_project_updates();

-- Saved Projects Table
CREATE TABLE IF NOT EXISTS public.saved_projects (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, project_id)
);

-- Saved Designers Table
CREATE TABLE IF NOT EXISTS public.saved_designers (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, designer_id),
    CONSTRAINT chk_cannot_save_self CHECK (user_id <> designer_id)
);

-- ------------------------------------------------------------------------------
-- PART 4: Views & Functions
-- ------------------------------------------------------------------------------

-- Helper Function: proposal_usage
CREATE OR REPLACE FUNCTION public.proposal_usage(p_designer_id UUID)
RETURNS TABLE (
    used INT,
    "limit" INT,
    period_end DATE
) AS $$
DECLARE
    v_plan public.plan_tier;
    v_limit INT;
    v_withdrawn_restores BOOLEAN := FALSE;
    v_used INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
BEGIN
    v_month_start := date_trunc('month', NOW());
    v_month_end := v_month_start + INTERVAL '1 month';

    SELECT coalesce(plan, 'free'::public.plan_tier) INTO v_plan
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    IF v_plan IS NULL THEN
        v_plan := 'free'::public.plan_tier;
    END IF;

    SELECT monthly_proposal_limit INTO v_limit
    FROM public.plan_limits
    WHERE plan = v_plan;

    IF v_limit IS NULL THEN
        v_limit := 5;
    END IF;

    SELECT coalesce((value)::BOOLEAN, FALSE) INTO v_withdrawn_restores
    FROM public.app_settings
    WHERE key = 'withdrawn_restores_slot';

    IF v_withdrawn_restores THEN
        SELECT COUNT(*)::INT INTO v_used
        FROM public.proposals
        WHERE designer_id = p_designer_id
          AND sent_at >= v_month_start
          AND sent_at < v_month_end
          AND status <> 'withdrawn'::public.proposal_status;
    ELSE
        SELECT COUNT(*)::INT INTO v_used
        FROM public.proposals
        WHERE designer_id = p_designer_id
          AND sent_at >= v_month_start
          AND sent_at < v_month_end;
    END IF;

    RETURN QUERY
    SELECT v_used, v_limit, (v_month_end::DATE - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Database Function: submit_proposal
CREATE OR REPLACE FUNCTION public.submit_proposal(
    p_project_id UUID,
    p_cover_letter TEXT,
    p_total_price NUMERIC,
    p_currency TEXT DEFAULT 'USD',
    p_delivery_days INT DEFAULT 14,
    p_hourly_rate NUMERIC DEFAULT NULL,
    p_estimated_hours NUMERIC DEFAULT NULL,
    p_exclusions TEXT DEFAULT NULL,
    p_question_for_client TEXT DEFAULT NULL,
    p_milestone_offers JSONB DEFAULT '[]'::JSONB,
    p_portfolio_item_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS UUID AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role public.user_role;
    v_project public.projects%ROWTYPE;
    v_completeness_score INT;
    v_usage RECORD;
    v_snapshot JSONB;
    v_proposal_id UUID;
    v_item JSONB;
    v_item_fee_sum NUMERIC(6,2) := 0;
    v_port_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated'
            USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_caller_role
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role <> 'designer'::public.user_role THEN
        RAISE EXCEPTION 'Only registered designers can submit proposals.'
            USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_project
    FROM public.projects
    WHERE id = p_project_id;

    IF v_project.id IS NULL OR v_project.status <> 'open'::public.project_status THEN
        RAISE EXCEPTION 'project_closed'
            USING HINT = 'project_closed', ERRCODE = 'P0001';
    END IF;

    IF v_project.client_id = v_caller_id THEN
        RAISE EXCEPTION 'Designers cannot submit proposals to their own projects.'
            USING ERRCODE = 'P0001';
    END IF;

    SELECT (get_profile_completeness(v_caller_id)->>'score')::INT
    INTO v_completeness_score;

    IF v_completeness_score IS NULL OR v_completeness_score < 60 THEN
        RAISE EXCEPTION 'profile_incomplete'
            USING HINT = 'profile_incomplete', ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.proposals
        WHERE project_id = p_project_id AND designer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'already_applied'
            USING HINT = 'already_applied', ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_usage FROM public.proposal_usage(v_caller_id);
    IF v_usage.used >= v_usage.limit THEN
        RAISE EXCEPTION 'limit_reached'
            USING HINT = 'limit_reached', ERRCODE = 'P0001';
    END IF;

    IF p_total_price <= 0 THEN
        RAISE EXCEPTION 'Total price must be greater than zero.'
            USING ERRCODE = 'P0001';
    END IF;

    IF char_length(p_cover_letter) > 1500 THEN
        RAISE EXCEPTION 'Cover letter exceeds maximum allowed length of 1500 characters.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_project.payment_type = 'milestone'::public.payment_type THEN
        IF p_milestone_offers IS NULL OR jsonb_array_length(p_milestone_offers) = 0 THEN
            RAISE EXCEPTION 'Milestone proposals must include phase offers.'
                USING ERRCODE = 'P0001';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_milestone_offers) LOOP
            v_item_fee_sum := v_item_fee_sum + (v_item->>'fee_percent')::NUMERIC;
        END LOOP;

        IF abs(v_item_fee_sum - 100.0) > 0.01 THEN
            RAISE EXCEPTION 'invalid_percentages'
                USING HINT = 'invalid_percentages', ERRCODE = 'P0001';
        END IF;
    ELSIF v_project.payment_type = 'hourly'::public.payment_type THEN
        IF p_hourly_rate IS NULL OR p_hourly_rate <= 0 THEN
            RAISE EXCEPTION 'invalid_hourly_fields'
                USING HINT = 'invalid_hourly_fields', ERRCODE = 'P0001';
        END IF;
    END IF;

    SELECT json_build_object(
        'project', row_to_json(v_project),
        'milestones', (
            SELECT json_agg(row_to_json(pm))
            FROM public.project_milestones pm
            WHERE pm.project_id = v_project.id
        )
    )::JSONB INTO v_snapshot;

    INSERT INTO public.proposals (
        project_id,
        designer_id,
        status,
        cover_letter,
        total_price,
        currency,
        delivery_days,
        hourly_rate,
        estimated_hours,
        exclusions,
        question_for_client,
        sent_at,
        project_snapshot
    ) VALUES (
        p_project_id,
        v_caller_id,
        'pending'::public.proposal_status,
        p_cover_letter,
        p_total_price,
        coalesce(p_currency, 'USD'),
        p_delivery_days,
        p_hourly_rate,
        p_estimated_hours,
        p_exclusions,
        p_question_for_client,
        NOW(),
        v_snapshot
    ) RETURNING id INTO v_proposal_id;

    IF v_project.payment_type = 'milestone'::public.payment_type THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_milestone_offers) LOOP
            INSERT INTO public.proposal_milestones (
                proposal_id,
                project_milestone_id,
                fee_percent,
                amount
            ) VALUES (
                v_proposal_id,
                (v_item->>'project_milestone_id')::UUID,
                (v_item->>'fee_percent')::NUMERIC,
                (v_item->>'amount')::NUMERIC
            );
        END LOOP;
    END IF;

    IF p_portfolio_item_ids IS NOT NULL THEN
        FOREACH v_port_id IN ARRAY p_portfolio_item_ids LOOP
            INSERT INTO public.proposal_portfolio_items (
                proposal_id,
                portfolio_project_id
            ) VALUES (
                v_proposal_id,
                v_port_id
            ) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        v_proposal_id,
        'sent',
        v_caller_id,
        'Proposal submitted by designer'
    );

    RETURN v_proposal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Database Function: update_proposal
CREATE OR REPLACE FUNCTION public.update_proposal(
    p_proposal_id UUID,
    p_cover_letter TEXT,
    p_total_price NUMERIC,
    p_delivery_days INT,
    p_hourly_rate NUMERIC DEFAULT NULL,
    p_estimated_hours NUMERIC DEFAULT NULL,
    p_exclusions TEXT DEFAULT NULL,
    p_question_for_client TEXT DEFAULT NULL,
    p_milestone_offers JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_allow_edit_if_viewed BOOLEAN := FALSE;
    v_item JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;

    IF v_prop.id IS NULL OR v_prop.designer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Proposal not found or unauthorized.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status <> 'pending'::public.proposal_status THEN
        RAISE EXCEPTION 'not_editable'
            USING HINT = 'not_editable', ERRCODE = 'P0001';
    END IF;

    SELECT coalesce((value)::BOOLEAN, TRUE) INTO v_allow_edit_if_viewed
    FROM public.app_settings
    WHERE key = 'proposal_edit_before_view';

    IF v_allow_edit_if_viewed AND v_prop.viewed_at IS NOT NULL THEN
        RAISE EXCEPTION 'not_editable'
            USING HINT = 'not_editable', ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.proposal_versions (
        proposal_id,
        version,
        data
    ) VALUES (
        v_prop.id,
        v_prop.version_count,
        row_to_json(v_prop)::JSONB
    );

    UPDATE public.proposals
    SET
        cover_letter = coalesce(p_cover_letter, cover_letter),
        total_price = coalesce(p_total_price, total_price),
        delivery_days = coalesce(p_delivery_days, delivery_days),
        hourly_rate = coalesce(p_hourly_rate, hourly_rate),
        estimated_hours = coalesce(p_estimated_hours, estimated_hours),
        exclusions = coalesce(p_exclusions, exclusions),
        question_for_client = coalesce(p_question_for_client, question_for_client),
        version_count = version_count + 1,
        updated_at = NOW()
    WHERE id = p_proposal_id;

    IF p_milestone_offers IS NOT NULL AND jsonb_array_length(p_milestone_offers) > 0 THEN
        DELETE FROM public.proposal_milestones WHERE proposal_id = p_proposal_id;
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_milestone_offers) LOOP
            INSERT INTO public.proposal_milestones (
                proposal_id,
                project_milestone_id,
                fee_percent,
                amount
            ) VALUES (
                p_proposal_id,
                (v_item->>'project_milestone_id')::UUID,
                (v_item->>'fee_percent')::NUMERIC,
                (v_item->>'amount')::NUMERIC
            );
        END LOOP;
    END IF;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'edited',
        v_caller_id,
        'Proposal updated to version ' || (v_prop.version_count + 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Database Function: withdraw_proposal
CREATE OR REPLACE FUNCTION public.withdraw_proposal(
    p_proposal_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;

    IF v_prop.id IS NULL OR (v_prop.designer_id <> v_caller_id AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'Proposal not found or unauthorized.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status NOT IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status, 'shortlisted'::public.proposal_status) THEN
        RAISE EXCEPTION 'Only pending, viewed, or shortlisted proposals can be withdrawn.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET
        status = 'withdrawn'::public.proposal_status,
        withdraw_reason = p_reason,
        decided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'withdrawn',
        v_caller_id,
        coalesce(p_reason, 'Withdrawn by designer')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Database Function: mark_proposal_viewed
CREATE OR REPLACE FUNCTION public.mark_proposal_viewed(p_proposal_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_proj public.projects%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can mark proposals as viewed.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.viewed_at IS NULL THEN
        UPDATE public.proposals
        SET
            viewed_at = NOW(),
            status = CASE
                WHEN status = 'pending'::public.proposal_status THEN 'viewed'::public.proposal_status
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = p_proposal_id;

        INSERT INTO public.proposal_events (
            proposal_id,
            event_type,
            actor_id,
            note
        ) VALUES (
            p_proposal_id,
            'viewed',
            v_caller_id,
            'Client viewed proposal'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Database Function: shortlist_proposal
CREATE OR REPLACE FUNCTION public.shortlist_proposal(p_proposal_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_proj public.projects%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can shortlist proposals.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status NOT IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status) THEN
        RAISE EXCEPTION 'Only pending or viewed proposals can be shortlisted.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET
        status = 'shortlisted'::public.proposal_status,
        decided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'shortlisted',
        v_caller_id,
        'Proposal shortlisted by client'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Database Function: decline_proposal
CREATE OR REPLACE FUNCTION public.decline_proposal(
    p_proposal_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_proj public.projects%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can decline proposals.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status IN ('accepted'::public.proposal_status, 'withdrawn'::public.proposal_status) THEN
        RAISE EXCEPTION 'Cannot decline an accepted or withdrawn proposal.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET
        status = 'declined'::public.proposal_status,
        decline_reason = p_reason,
        decided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'declined',
        v_caller_id,
        coalesce(p_reason, 'Proposal declined by client')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- PART 5: Views and Security Barriers
-- ------------------------------------------------------------------------------

-- Drop views first to avoid column data type mismatch errors
DROP VIEW IF EXISTS public.client_summaries CASCADE;
DROP VIEW IF EXISTS public.open_projects CASCADE;
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;

-- Client Summaries View
CREATE OR REPLACE VIEW public.client_summaries
WITH (security_barrier = true) AS
SELECT
    cp.user_id,
    CASE
        WHEN POSITION(' ' IN trim(p.full_name)) > 0 THEN
            SPLIT_PART(trim(p.full_name), ' ', 1) || ' ' ||
            SUBSTRING(SPLIT_PART(trim(p.full_name), ' ', 2), 1, 1) || '.'
        ELSE
            trim(p.full_name)
    END AS display_name,
    p.location AS city,
    p.location AS state_region,
    TO_CHAR(p.created_at, 'Month YYYY') AS member_since,
    (
        SELECT COUNT(*)::INT
        FROM public.projects prj
        WHERE prj.client_id = cp.user_id
          AND prj.status <> 'cancelled'::public.project_status
    ) AS projects_posted,
    cp.payment_verified
FROM public.client_profiles cp
JOIN public.profiles p ON p.id = cp.user_id
WHERE
    (SELECT auth.role()) = 'authenticated'
    AND (
        EXISTS (
            SELECT 1 FROM public.projects op
            WHERE op.client_id = cp.user_id
              AND op.status = 'open'::public.project_status
        )
        OR EXISTS (
            SELECT 1
            FROM public.proposals prop
            JOIN public.projects p2 ON p2.id = prop.project_id
            WHERE p2.client_id = cp.user_id
              AND prop.designer_id = (SELECT auth.uid())
        )
        OR cp.user_id = (SELECT auth.uid())
        OR public.is_admin()
    );

-- Open Projects View
CREATE OR REPLACE VIEW public.open_projects
WITH (security_barrier = true) AS
SELECT
    p.id,
    p.client_id,
    p.title,
    p.description,
    p.category,
    p.subcategory,
    p.project_type_notes,
    p.budget,
    p.currency,
    p.payment_type,
    p.hourly_rate_max,
    p.timeline_days,
    p.deadline,
    p.area_sqft,
    p.location_text,
    p.city,
    p.state_region,
    p.status,
    p.published_at,
    p.search,
    (
        SELECT COUNT(*)::INT
        FROM public.proposals prop
        WHERE prop.project_id = p.id
          AND prop.status <> 'withdrawn'::public.proposal_status
    ) AS proposal_count,
    EXISTS (
        SELECT 1
        FROM public.proposals my_prop
        WHERE my_prop.project_id = p.id
          AND my_prop.designer_id = (SELECT auth.uid())
          AND my_prop.status <> 'withdrawn'::public.proposal_status
    ) AS has_applied,
    EXISTS (
        SELECT 1
        FROM public.saved_projects sp
        WHERE sp.project_id = p.id
          AND sp.user_id = (SELECT auth.uid())
    ) AS is_saved,
    coalesce(
        (
            SELECT json_agg(
                json_build_object(
                    'id', pm.id,
                    'sort_order', pm.sort_order,
                    'name', pm.name,
                    'description', pm.description,
                    'deliverables', pm.deliverables,
                    'billing_trigger', pm.billing_trigger,
                    'fee_percent', pm.fee_percent
                ) ORDER BY pm.sort_order ASC
            )
            FROM public.project_milestones pm
            WHERE pm.project_id = p.id
        ),
        '[]'::json
    ) AS milestones
FROM public.projects p
WHERE
    (SELECT auth.role()) = 'authenticated'
    AND (
        p.status = 'open'::public.project_status
        OR EXISTS (
            SELECT 1 FROM public.proposals my_prop
            WHERE my_prop.project_id = p.id
              AND my_prop.designer_id = (SELECT auth.uid())
        )
        OR p.client_id = (SELECT auth.uid())
        OR public.is_admin()
    );

-- Full-Text Search on Public Designer Profiles View
CREATE OR REPLACE VIEW public.public_designer_profiles
WITH (security_barrier = true) AS
SELECT
    p.id AS designer_id,
    p.full_name,
    p.avatar_path,
    p.location,
    dp.title,
    dp.studio_name,
    dp.bio,
    dp.professional_type,
    dp.specializations,
    dp.languages,
    dp.years_experience,
    dp.is_available,
    dp.availability_note,
    TO_CHAR(p.created_at, 'Month YYYY') AS member_since,
    CASE
        WHEN dp.show_hourly_rate = true THEN dp.hourly_rate
        ELSE NULL
    END AS hourly_rate,
    dp.show_hourly_rate,
    dp.show_in_search,
    EXISTS (
        SELECT 1 FROM public.credentials c
        WHERE c.designer_id = p.id AND c.status = 'verified'::public.credential_status
    ) AS verified,
    to_tsvector('english',
        coalesce(p.full_name, '') || ' ' ||
        coalesce(dp.title, '') || ' ' ||
        coalesce(dp.studio_name, '') || ' ' ||
        coalesce(dp.bio, '') || ' ' ||
        coalesce(p.location, '') || ' ' ||
        coalesce(array_to_string(dp.specializations, ' '), '')
    ) AS search
FROM public.profiles p
JOIN public.designer_profiles dp ON dp.user_id = p.id
WHERE
    dp.show_in_search = true
    AND (
        (SELECT auth.role()) = 'authenticated'
        OR (SELECT auth.role()) = 'anon'
    );

-- ------------------------------------------------------------------------------
-- PART 6: Comprehensive RLS Policies & Grants
-- ------------------------------------------------------------------------------

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_designers ENABLE ROW LEVEL SECURITY;

-- Client Profiles RLS
DROP POLICY IF EXISTS "Clients and admins can read client profiles" ON public.client_profiles;
CREATE POLICY "Clients and admins can read client profiles"
    ON public.client_profiles
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Clients can insert own client profile" ON public.client_profiles;
CREATE POLICY "Clients can insert own client profile"
    ON public.client_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Clients can update own client profile" ON public.client_profiles;
CREATE POLICY "Clients can update own client profile"
    ON public.client_profiles
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- Projects Table RLS
DROP POLICY IF EXISTS "Clients can view own projects" ON public.projects;
CREATE POLICY "Clients can view own projects"
    ON public.projects
    FOR SELECT
    TO authenticated
    USING (client_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Clients can create projects" ON public.projects;
CREATE POLICY "Clients can create projects"
    ON public.projects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = (SELECT auth.uid()) AND role = 'client'::public.user_role
        )
    );

DROP POLICY IF EXISTS "Clients can update own projects" ON public.projects;
CREATE POLICY "Clients can update own projects"
    ON public.projects
    FOR UPDATE
    TO authenticated
    USING (client_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (client_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Clients can delete draft projects" ON public.projects;
CREATE POLICY "Clients can delete draft projects"
    ON public.projects
    FOR DELETE
    TO authenticated
    USING (
        (client_id = (SELECT auth.uid()) AND status = 'draft'::public.project_status)
        OR public.is_admin()
    );

-- Project Milestones RLS
DROP POLICY IF EXISTS "Project owners can view milestones" ON public.project_milestones;
CREATE POLICY "Project owners can view milestones"
    ON public.project_milestones
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_milestones.project_id
              AND (p.client_id = (SELECT auth.uid()) OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Project owners can manage milestones" ON public.project_milestones;
CREATE POLICY "Project owners can manage milestones"
    ON public.project_milestones
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_milestones.project_id
              AND p.client_id = (SELECT auth.uid())
              AND p.status = 'draft'::public.project_status
        ) OR public.is_admin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_milestones.project_id
              AND p.client_id = (SELECT auth.uid())
              AND p.status = 'draft'::public.project_status
        ) OR public.is_admin()
    );

-- Project Images RLS
DROP POLICY IF EXISTS "Project owners can view images" ON public.project_images;
CREATE POLICY "Project owners can view images"
    ON public.project_images
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_images.project_id
              AND (p.client_id = (SELECT auth.uid()) OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Project owners can manage images" ON public.project_images;
CREATE POLICY "Project owners can manage images"
    ON public.project_images
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_images.project_id
              AND p.client_id = (SELECT auth.uid())
              AND p.status = 'draft'::public.project_status
        ) OR public.is_admin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_images.project_id
              AND p.client_id = (SELECT auth.uid())
              AND p.status = 'draft'::public.project_status
        ) OR public.is_admin()
    );

-- Proposals RLS Policies
DROP POLICY IF EXISTS "Designers and Clients can view relevant proposals" ON public.proposals;
CREATE POLICY "Designers and Clients can view relevant proposals"
    ON public.proposals
    FOR SELECT
    TO authenticated
    USING (
        designer_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = proposals.project_id
              AND p.client_id = (SELECT auth.uid())
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Deny direct proposal insert" ON public.proposals;
CREATE POLICY "Deny direct proposal insert"
    ON public.proposals
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

DROP POLICY IF EXISTS "Deny direct proposal update" ON public.proposals;
CREATE POLICY "Deny direct proposal update"
    ON public.proposals
    FOR UPDATE
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "Deny direct proposal delete" ON public.proposals;
CREATE POLICY "Deny direct proposal delete"
    ON public.proposals
    FOR DELETE
    TO authenticated
    USING (false);

-- Proposal Milestones RLS
DROP POLICY IF EXISTS "View proposal milestones" ON public.proposal_milestones;
CREATE POLICY "View proposal milestones"
    ON public.proposal_milestones
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.proposals prop
            JOIN public.projects proj ON proj.id = prop.project_id
            WHERE prop.id = proposal_milestones.proposal_id
              AND (
                  prop.designer_id = (SELECT auth.uid())
                  OR proj.client_id = (SELECT auth.uid())
                  OR public.is_admin()
              )
        )
    );

-- Proposal Portfolio Items RLS
DROP POLICY IF EXISTS "View proposal portfolio items" ON public.proposal_portfolio_items;
CREATE POLICY "View proposal portfolio items"
    ON public.proposal_portfolio_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.proposals prop
            JOIN public.projects proj ON proj.id = prop.project_id
            WHERE prop.id = proposal_portfolio_items.proposal_id
              AND (
                  prop.designer_id = (SELECT auth.uid())
                  OR proj.client_id = (SELECT auth.uid())
                  OR public.is_admin()
              )
        )
    );

-- Proposal Events RLS
DROP POLICY IF EXISTS "View proposal events timeline" ON public.proposal_events;
CREATE POLICY "View proposal events timeline"
    ON public.proposal_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.proposals prop
            JOIN public.projects proj ON proj.id = prop.project_id
            WHERE prop.id = proposal_events.proposal_id
              AND (
                  prop.designer_id = (SELECT auth.uid())
                  OR proj.client_id = (SELECT auth.uid())
                  OR public.is_admin()
              )
        )
    );

-- Proposal Versions RLS
DROP POLICY IF EXISTS "View proposal versions" ON public.proposal_versions;
CREATE POLICY "View proposal versions"
    ON public.proposal_versions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.proposals prop
            WHERE prop.id = proposal_versions.proposal_id
              AND (prop.designer_id = (SELECT auth.uid()) OR public.is_admin())
        )
    );

-- Saved Projects RLS
DROP POLICY IF EXISTS "Users can manage own saved projects" ON public.saved_projects;
CREATE POLICY "Users can manage own saved projects"
    ON public.saved_projects
    FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND NOT EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = saved_projects.project_id
              AND p.client_id = (SELECT auth.uid())
        )
    );

-- Saved Designers RLS
DROP POLICY IF EXISTS "Users can manage own saved designers" ON public.saved_designers;
CREATE POLICY "Users can manage own saved designers"
    ON public.saved_designers
    FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND user_id <> designer_id
        AND EXISTS (
            SELECT 1 FROM public.designer_profiles dp
            WHERE dp.user_id = saved_designers.designer_id
              AND dp.show_in_search = true
        )
    );

-- Grants
GRANT SELECT ON public.open_projects TO authenticated;
GRANT SELECT ON public.client_summaries TO authenticated;
GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.submit_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_viewed TO authenticated;
GRANT EXECUTE ON FUNCTION public.shortlist_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.proposal_usage TO authenticated;

