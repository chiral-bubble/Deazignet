-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 028_projects_schema_amendments.sql
-- Schema Updates for Projects, Profiles, Client Profiles, Private Site Details & Updates
-- ==============================================================================

-- 1. Profiles Table additions for onboarding & terms compliance
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '2026.1',
    ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;

-- 2. Client Profiles Table additions (account type, company, private phone)
ALTER TABLE public.client_profiles
    ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'individual',
    ADD COLUMN IF NOT EXISTS company_name TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'client_profiles_account_type_check'
    ) THEN
        ALTER TABLE public.client_profiles
            ADD CONSTRAINT client_profiles_account_type_check
            CHECK (account_type IN ('individual', 'company'));
    END IF;
END $$;

-- 3. Projects Table Modifications
-- Safe column rename / addition
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'budget'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'design_budget'
    ) THEN
        ALTER TABLE public.projects RENAME COLUMN budget TO design_budget;
    END IF;
END $$;

-- In case projects was freshly created or budget didn't exist
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS design_budget NUMERIC(12,2) CHECK (design_budget > 0),
    ADD COLUMN IF NOT EXISTS construction_cost_estimate NUMERIC(14,2) CHECK (construction_cost_estimate IS NULL OR construction_cost_estimate > 0),
    ADD COLUMN IF NOT EXISTS disciplines TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS building_status TEXT,
    ADD COLUMN IF NOT EXISTS site_status TEXT,
    ADD COLUMN IF NOT EXISTS existing_documents TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS proposal_deadline DATE,
    ADD COLUMN IF NOT EXISTS area_unit TEXT DEFAULT 'sqft',
    ADD COLUMN IF NOT EXISTS included_revisions_requested INT,
    ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS wizard_step INT DEFAULT 1;

-- Add constraints on building_status, site_status, area_unit
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_building_status_check') THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_building_status_check
            CHECK (building_status IS NULL OR building_status IN ('new_build', 'renovation', 'extension'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_site_status_check') THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_site_status_check
            CHECK (site_status IS NULL OR site_status IN ('has_land', 'no_land_yet'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_area_unit_check') THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_area_unit_check
            CHECK (area_unit IS NULL OR area_unit IN ('sqft', 'sqm'));
    END IF;
END $$;

-- 4. Private Site Details Table (Strictly Owner and Admin only; engagement designer after signed contract)
CREATE TABLE IF NOT EXISTS public.project_private_details (
    project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
    street TEXT,
    postal_code TEXT,
    site_notes TEXT,
    access_instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_project_private_details_updated_at ON public.project_private_details;
CREATE TRIGGER trg_project_private_details_updated_at
    BEFORE UPDATE ON public.project_private_details
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Project Updates Table (Owner and designers with proposals)
CREATE TABLE IF NOT EXISTS public.project_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON public.project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_created_at ON public.project_updates(created_at);

