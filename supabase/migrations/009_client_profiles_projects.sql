-- ==============================================================================
-- DEZIGNET PHASE 2: 009_client_profiles_projects.sql
-- Client Profiles, Projects, Milestones, Images & Lifecycle Enforcement
-- ==============================================================================

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

-- 1. Client Profiles Table
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

-- 2. Projects Table
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

-- 3. Project Milestones Table (Client Project Plan)
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

-- 4. Project Images Table
CREATE TABLE IF NOT EXISTS public.project_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_images_project_id ON public.project_images(project_id);

-- 5. Project Lifecycle and Validation Trigger
CREATE OR REPLACE FUNCTION public.check_project_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
    v_milestone_count INT;
    v_percent_sum NUMERIC(6,2);
BEGIN
    -- Only run checks if status is changing
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Rule: Reopening an awarded project is strictly forbidden
        IF OLD.status = 'awarded'::public.project_status THEN
            RAISE EXCEPTION 'An awarded project cannot be reopened or modified.'
                USING ERRCODE = 'P0001';
        END IF;

        -- Valid transitions:
        -- draft -> open
        -- open -> awarded | closed | cancelled
        -- draft -> cancelled
        IF OLD.status = 'draft'::public.project_status AND NEW.status NOT IN ('open'::public.project_status, 'cancelled'::public.project_status) THEN
            RAISE EXCEPTION 'A draft project can only transition to open or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        IF OLD.status = 'open'::public.project_status AND NEW.status NOT IN ('awarded'::public.project_status, 'closed'::public.project_status, 'cancelled'::public.project_status) THEN
            RAISE EXCEPTION 'An open project can only transition to awarded, closed, or cancelled.'
                USING ERRCODE = 'P0001';
        END IF;

        -- When transitioning to open:
        IF NEW.status = 'open'::public.project_status THEN
            -- Record published_at timestamp if first time
            IF NEW.published_at IS NULL THEN
                NEW.published_at := NOW();
            END IF;

            -- Validate budget
            IF NEW.budget <= 0 THEN
                RAISE EXCEPTION 'Project budget must be greater than zero to publish.'
                    USING ERRCODE = 'P0001';
            END IF;

            -- Validate deadline is in the future
            IF NEW.deadline IS NOT NULL AND NEW.deadline < CURRENT_DATE THEN
                RAISE EXCEPTION 'Project deadline must be in the future to publish.'
                    USING ERRCODE = 'P0001';
            END IF;

            -- Check milestone vs hourly rules
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

        -- Record closed_at when project closes, awards, or cancels
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
