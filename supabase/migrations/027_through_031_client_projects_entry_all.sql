-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 027_categories_and_templates.sql
-- Categories, Subcategories, Phase Templates & Global Project Settings
-- ==============================================================================

-- 1. Categories Table (Single source of truth for projects and designer specializations)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Subcategories Table
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- Seed Standard Categories and Subcategories (Production Single Source of Truth)
DO $$
DECLARE
    v_cat_res UUID;
    v_cat_comm UUID;
    v_cat_inst UUID;
    v_cat_health UUID;
    v_cat_ind UUID;
BEGIN
    -- Remove old test subcategories that conflict with clean structure
    DELETE FROM public.subcategories WHERE name IN (
        'Kitchen & Bath Design', 'Luxury Estate', 'Tiny Home & Modular', 'Sustainable Living',
        'Civic Centers', 'Municipal Buildings', 'Public Works', 'Educational Facilities',
        'Pop-Up & Experiential', 'Flagship Retail', 'ADU / Guest House'
    );

    -- 1. Residential
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Residential', 1)
    ON CONFLICT (name) DO UPDATE SET sort_order = 1
    RETURNING id INTO v_cat_res;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_res, 'Detached house / bungalow', 1),
        (v_cat_res, 'Duplex', 2),
        (v_cat_res, 'Terrace / semi-detached', 3),
        (v_cat_res, 'Apartment block', 4),
        (v_cat_res, 'Housing estate', 5),
        (v_cat_res, 'Student hostel', 6)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 2. Commercial
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Commercial', 2)
    ON CONFLICT (name) DO UPDATE SET sort_order = 2
    RETURNING id INTO v_cat_comm;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_comm, 'Office building', 1),
        (v_cat_comm, 'Retail / shopping', 2),
        (v_cat_comm, 'Hotel & hospitality', 3),
        (v_cat_comm, 'Restaurant & cafe', 4),
        (v_cat_comm, 'Mixed-use', 5),
        (v_cat_comm, 'Filling station', 6)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 3. Institutional
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Institutional', 3)
    ON CONFLICT (name) DO UPDATE SET sort_order = 3
    RETURNING id INTO v_cat_inst;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_inst, 'School & university', 1),
        (v_cat_inst, 'Church / mosque / worship', 2),
        (v_cat_inst, 'Government building', 3),
        (v_cat_inst, 'Cultural & civic', 4),
        (v_cat_inst, 'Sports & recreation', 5)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 4. Healthcare
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Healthcare', 4)
    ON CONFLICT (name) DO UPDATE SET sort_order = 4
    RETURNING id INTO v_cat_health;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_health, 'Hospital', 1),
        (v_cat_health, 'Clinic', 2),
        (v_cat_health, 'Laboratory', 3),
        (v_cat_health, 'Pharmacy', 4)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 5. Industrial
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Industrial', 5)
    ON CONFLICT (name) DO UPDATE SET sort_order = 5
    RETURNING id INTO v_cat_ind;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_ind, 'Warehouse', 1),
        (v_cat_ind, 'Factory', 2),
        (v_cat_ind, 'Logistics', 3)
    ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- 2. Phase Templates Table (Standard architectural phases)
CREATE TABLE IF NOT EXISTS public.phase_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order INT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    deliverables TEXT[] DEFAULT '{}',
    billing_trigger TEXT,
    default_fee_percent NUMERIC(5,2) NOT NULL CHECK (default_fee_percent >= 0 AND default_fee_percent <= 100),
    fee_percent_without_predesign NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (fee_percent_without_predesign >= 0 AND fee_percent_without_predesign <= 100),
    is_optional BOOLEAN NOT NULL DEFAULT false
);

-- In case columns already exist
ALTER TABLE public.phase_templates
    ADD COLUMN IF NOT EXISTS fee_percent_without_predesign NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_phase_templates_sort_order ON public.phase_templates(sort_order);

-- Seed Standard Phase Templates
-- Five phases default (Schematic 20, DD 25, CD 35, Bidding 5, CA 15 = 100)
-- With Pre-Design (10, 15, 20, 35, 5, 15 = 100)
DELETE FROM public.phase_templates;

INSERT INTO public.phase_templates (
    sort_order,
    name,
    description,
    deliverables,
    billing_trigger,
    default_fee_percent,
    fee_percent_without_predesign,
    is_optional
) VALUES
    (
        1,
        'Pre-Design / Site Feasibility',
        'Review of site survey, zoning and setbacks, feasibility diagrams',
        ARRAY['Site survey review', 'Zoning setback clearance', 'Feasibility diagrams'],
        'Approval of site feasibility document',
        10.00,
        0.00,
        true
    ),
    (
        2,
        'Schematic Design',
        'Layout options and building concepts',
        ARRAY['Concept floor plans', 'Massing 3D sketches', 'Spatial relationship matrix'],
        'Client selection and sign-off of schematic concept',
        15.00,
        20.00,
        false
    ),
    (
        3,
        'Design Development',
        'Refine the selected design, coordinate with consultants',
        ARRAY['Dimensioned floor plans', 'Exterior elevations', 'Consultant coordination overlay'],
        'Approval of coordinated design development package',
        20.00,
        25.00,
        false
    ),
    (
        4,
        'Construction Documents',
        'Permit and construction-ready drawing set',
        ARRAY['Full permit drawing set', 'Technical specifications', 'Foundation and framing details'],
        'Delivery of signed architectural permit set',
        35.00,
        35.00,
        false
    ),
    (
        5,
        'Bidding & Permitting',
        'Assist with contractor selection and permit responses',
        ARRAY['Permit submission support', 'Bid tender evaluation', 'Bill of quantities review'],
        'Statutory permit approval & contractor award',
        5.00,
        5.00,
        false
    ),
    (
        6,
        'Construction Administration',
        'Support during construction and respond to RFIs',
        ARRAY['Site observation reports', 'RFI responses', 'Defects punch list'],
        'Final certificate of completion',
        15.00,
        15.00,
        false
    );

-- 3. App Settings for Projects & Auto-Close
INSERT INTO public.app_settings (key, value, description)
VALUES
    ('project_auto_close_days', '60'::jsonb, 'Days of inactivity before an open project is automatically closed'),
    ('auto_close_warning_days', '7'::jsonb, 'Days before auto-close when a warning notification is sent to client'),
    ('max_project_images', '8'::jsonb, 'Maximum reference images per project'),
    ('max_description_chars', '2000'::jsonb, 'Maximum character length of project description')
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());
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

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 029_projects_functions.sql
-- Project Lifecycle Functions, Edit Lockdown Rules & Notification Triggers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: get_site_details (Private Details Access Gate)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_site_details(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_details RECORD;
    v_has_signed_engagement BOOLEAN := FALSE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Check if caller is engagement designer (contract signed requirement in future phases)
    SELECT EXISTS (
        SELECT 1 FROM public.engagements e
        WHERE e.project_id = p_project_id
          AND e.designer_id = v_caller_id
          AND e.status IN ('active'::public.engagement_status, 'completed'::public.engagement_status)
    ) INTO v_has_signed_engagement;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() AND NOT v_has_signed_engagement THEN
        RAISE EXCEPTION 'Access denied to private site details.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_details FROM public.project_private_details WHERE project_id = p_project_id;
    IF v_details.project_id IS NULL THEN
        RETURN jsonb_build_object(
            'street', NULL,
            'postal_code', NULL,
            'site_notes', NULL,
            'access_instructions', NULL
        );
    END IF;

    RETURN jsonb_build_object(
        'project_id', v_details.project_id,
        'street', v_details.street,
        'postal_code', v_details.postal_code,
        'site_notes', v_details.site_notes,
        'access_instructions', v_details.access_instructions,
        'updated_at', v_details.updated_at
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. publish_project
-- Comprehensive server-side validation before transitioning from draft -> open
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_profile RECORD;
    v_max_desc_chars INT;
    v_phase_count INT;
    v_phase_sum NUMERIC(6,2);
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can publish this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status = 'open'::public.project_status THEN
        RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'open');
    END IF;

    IF v_proj.status <> 'draft'::public.project_status THEN
        RAISE EXCEPTION 'Only draft projects can be published (current: %).', v_proj.status
            USING HINT = 'invalid_status', ERRCODE = 'P0001';
    END IF;

    -- Validate client profile completeness
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id;
    IF v_profile.full_name IS NULL OR char_length(trim(v_profile.full_name)) = 0
       OR v_profile.location IS NULL OR char_length(trim(v_profile.location)) = 0 THEN
        RAISE EXCEPTION 'Client profile is incomplete. Full name and location are required before publishing.'
            USING HINT = 'profile_incomplete', ERRCODE = 'P0001';
    END IF;

    -- Validate required project fields
    IF v_proj.title IS NULL OR char_length(trim(v_proj.title)) = 0 THEN
        RAISE EXCEPTION 'Project title is required.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF v_proj.category IS NULL OR char_length(trim(v_proj.category)) = 0 THEN
        RAISE EXCEPTION 'Project category is required.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate disciplines ("Professional needed")
    IF v_proj.disciplines IS NULL OR array_length(v_proj.disciplines, 1) IS NULL OR array_length(v_proj.disciplines, 1) = 0 THEN
        RAISE EXCEPTION 'At least one professional discipline is required before publishing.'
            USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate description limits
    SELECT COALESCE((value->>0)::INT, 2000) INTO v_max_desc_chars
    FROM public.app_settings WHERE key = 'max_description_chars';

    IF v_proj.description IS NULL OR char_length(trim(v_proj.description)) = 0 THEN
        RAISE EXCEPTION 'Project description is required.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF char_length(v_proj.description) > v_max_desc_chars THEN
        RAISE EXCEPTION 'Project description exceeds maximum allowable length of % characters.', v_max_desc_chars
            USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate design budget
    IF v_proj.design_budget IS NULL OR v_proj.design_budget <= 0 THEN
        RAISE EXCEPTION 'Design budget must be greater than zero.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate deadline in future
    IF v_proj.deadline IS NOT NULL AND v_proj.deadline <= CURRENT_DATE THEN
        RAISE EXCEPTION 'Project completion deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate proposal deadline (must be before project deadline)
    IF v_proj.proposal_deadline IS NOT NULL THEN
        IF v_proj.proposal_deadline <= CURRENT_DATE THEN
            RAISE EXCEPTION 'Proposal deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        IF v_proj.deadline IS NOT NULL AND v_proj.proposal_deadline >= v_proj.deadline THEN
            RAISE EXCEPTION 'Proposal deadline must be earlier than the project completion deadline.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Scope & Payment Validation
    IF v_proj.payment_type = 'milestone'::public.payment_type THEN
        SELECT COUNT(*), COALESCE(SUM(fee_percent), 0)
        INTO v_phase_count, v_phase_sum
        FROM public.project_milestones
        WHERE project_id = p_project_id;

        IF v_phase_count = 0 THEN
            RAISE EXCEPTION 'Milestone projects must include at least one phase.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        IF ABS(v_phase_sum - 100.00) > 0.01 THEN
            RAISE EXCEPTION 'Milestone phase percentages must total exactly 100 percent (current sum: %).', v_phase_sum
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    ELSIF v_proj.payment_type = 'hourly'::public.payment_type THEN
        IF v_proj.hourly_rate_max IS NULL OR v_proj.hourly_rate_max <= 0 THEN
            RAISE EXCEPTION 'Hourly projects require a maximum hourly rate.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        SELECT COUNT(*) INTO v_phase_count
        FROM public.project_milestones
        WHERE project_id = p_project_id;

        IF v_phase_count > 0 THEN
            RAISE EXCEPTION 'Hourly projects cannot have milestone phases.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Transition status
    UPDATE public.projects
    SET
        status = 'open'::public.project_status,
        published_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    -- Create in-app notification for client
    PERFORM public.create_notification(
        v_caller_id,
        'system_announcement'::public.notification_type,
        'Project Published',
        'Your project "' || v_proj.title || '" is now live and accepting proposals from designers.',
        jsonb_build_object('project_id', p_project_id, 'title', v_proj.title)
    );

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'status', 'open',
        'published_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. close_project
-- Stops accepting new proposals; existing proposals can still be evaluated
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can close this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status = 'closed'::public.project_status THEN
        RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'closed');
    END IF;

    IF v_proj.status <> 'open'::public.project_status THEN
        RAISE EXCEPTION 'Only open projects can be closed (current: %).', v_proj.status
            USING HINT = 'invalid_status', ERRCODE = 'P0001';
    END IF;

    UPDATE public.projects
    SET
        status = 'closed'::public.project_status,
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'closed');
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. cancel_project
-- Allowed only while NO engagement exists. Declines all open proposals and notifies.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_project(
    p_project_id UUID,
    p_reason TEXT DEFAULT 'Project cancelled by the client'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_prop RECORD;
    v_declined_count INT := 0;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can cancel this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status = 'cancelled'::public.project_status THEN
        RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'cancelled');
    END IF;

    -- Rule: Cannot cancel if any engagement exists
    IF EXISTS (
        SELECT 1 FROM public.engagements
        WHERE project_id = p_project_id
    ) THEN
        RAISE EXCEPTION 'Cannot cancel project because an engagement has already been established.'
            USING HINT = 'project_has_engagement', ERRCODE = 'P0001';
    END IF;

    -- Decline all active proposals on this project
    FOR v_prop IN
        SELECT id, designer_id FROM public.proposals
        WHERE project_id = p_project_id
          AND status IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status, 'shortlisted'::public.proposal_status)
    LOOP
        UPDATE public.proposals
        SET
            status = 'declined'::public.proposal_status,
            client_feedback = COALESCE(p_reason, 'Project cancelled by the client'),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_prop.id;

        -- Notify affected designer
        PERFORM public.create_notification(
            v_prop.designer_id,
            'proposal_declined'::public.notification_type,
            'Project Cancelled',
            'The client has cancelled project "' || v_proj.title || '". Your proposal was automatically closed.',
            jsonb_build_object('project_id', p_project_id, 'proposal_id', v_prop.id)
        );

        v_declined_count := v_declined_count + 1;
    END LOOP;

    UPDATE public.projects
    SET
        status = 'cancelled'::public.project_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'status', 'cancelled',
        'declined_proposals_count', v_declined_count
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. duplicate_project
-- Copies fields, phases, and image records (references, not files) into a new draft
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.duplicate_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_orig RECORD;
    v_new_id UUID;
    v_priv RECORD;
    v_pm RECORD;
    v_img RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_orig FROM public.projects WHERE id = p_project_id;
    IF v_orig.id IS NULL THEN
        RAISE EXCEPTION 'Original project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_orig.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can duplicate this project.' USING ERRCODE = '42501';
    END IF;

    v_new_id := gen_random_uuid();

    -- Insert new project as draft
    INSERT INTO public.projects (
        id,
        client_id,
        title,
        description,
        category,
        subcategory,
        project_type_notes,
        design_budget,
        currency,
        payment_type,
        hourly_rate_max,
        timeline_days,
        deadline,
        area_sqft,
        location_text,
        city,
        state_region,
        building_status,
        site_status,
        existing_documents,
        proposal_deadline,
        area_unit,
        included_revisions_requested,
        status,
        wizard_step,
        last_saved_at
    )
    VALUES (
        v_new_id,
        v_caller_id,
        v_orig.title || ' (Copy)',
        v_orig.description,
        v_orig.category,
        v_orig.subcategory,
        v_orig.project_type_notes,
        v_orig.design_budget,
        v_orig.currency,
        v_orig.payment_type,
        v_orig.hourly_rate_max,
        v_orig.timeline_days,
        NULL, -- Reset deadline for copy
        v_orig.area_sqft,
        v_orig.location_text,
        v_orig.city,
        v_orig.state_region,
        v_orig.building_status,
        v_orig.site_status,
        v_orig.existing_documents,
        NULL, -- Reset proposal deadline
        v_orig.area_unit,
        v_orig.included_revisions_requested,
        'draft'::public.project_status,
        1,
        timezone('utc'::text, now())
    );

    -- Copy private site details if any
    SELECT * INTO v_priv FROM public.project_private_details WHERE project_id = p_project_id;
    IF v_priv.project_id IS NOT NULL THEN
        INSERT INTO public.project_private_details (
            project_id,
            street,
            postal_code,
            site_notes,
            access_instructions
        )
        VALUES (
            v_new_id,
            v_priv.street,
            v_priv.postal_code,
            v_priv.site_notes,
            v_priv.access_instructions
        );
    END IF;

    -- Copy milestone phases
    FOR v_pm IN SELECT * FROM public.project_milestones WHERE project_id = p_project_id ORDER BY sort_order ASC LOOP
        INSERT INTO public.project_milestones (
            project_id,
            sort_order,
            name,
            description,
            deliverables,
            billing_trigger,
            fee_percent
        )
        VALUES (
            v_new_id,
            v_pm.sort_order,
            v_pm.name,
            v_pm.description,
            v_pm.deliverables,
            v_pm.billing_trigger,
            v_pm.fee_percent
        );
    END LOOP;

    -- Copy image references
    FOR v_img IN SELECT * FROM public.project_images WHERE project_id = p_project_id ORDER BY sort_order ASC LOOP
        INSERT INTO public.project_images (
            project_id,
            path,
            sort_order,
            file_id
        )
        VALUES (
            v_new_id,
            v_img.path,
            v_img.sort_order,
            v_img.file_id
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'new_project_id', v_new_id,
        'title', v_orig.title || ' (Copy)'
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. delete_project
-- Drafts only. Cascade removes all related project data.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can delete this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status <> 'draft'::public.project_status THEN
        RAISE EXCEPTION 'Only draft projects can be deleted. Published projects must be closed or cancelled.'
            USING HINT = 'not_allowed', ERRCODE = 'P0001';
    END IF;

    DELETE FROM public.projects WHERE id = p_project_id;

    RETURN jsonb_build_object('success', true, 'deleted_project_id', p_project_id);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. add_project_update
-- Owner only while open or awarded; notifies designers with proposals
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_project_update(
    p_project_id UUID,
    p_body TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_update_id UUID;
    v_designer RECORD;
    v_clean_body TEXT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_clean_body := trim(p_body);
    IF v_clean_body IS NULL OR char_length(v_clean_body) = 0 THEN
        RAISE EXCEPTION 'Update body cannot be empty.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF char_length(v_clean_body) > 1000 THEN
        RAISE EXCEPTION 'Update body cannot exceed 1000 characters.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can post updates.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status NOT IN ('open'::public.project_status, 'awarded'::public.project_status) THEN
        RAISE EXCEPTION 'Project updates can only be added while open or awarded.'
            USING HINT = 'not_allowed', ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.project_updates (project_id, author_id, body)
    VALUES (p_project_id, v_caller_id, v_clean_body)
    RETURNING id INTO v_update_id;

    -- Notify all designers who submitted a proposal
    FOR v_designer IN
        SELECT DISTINCT designer_id FROM public.proposals
        WHERE project_id = p_project_id
          AND status <> 'withdrawn'::public.proposal_status
    LOOP
        PERFORM public.create_notification(
            v_designer.designer_id,
            'message_received'::public.notification_type,
            'Project Update: ' || v_proj.title,
            'The client added an update: "' || substring(v_clean_body from 1 for 80) || '..."',
            jsonb_build_object('project_id', p_project_id, 'update_id', v_update_id)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'update_id', v_update_id,
        'project_id', p_project_id,
        'created_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 8. extend_deadline
-- Client extends project completion deadline; must be strictly in the future
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extend_deadline(
    p_project_id UUID,
    p_new_deadline DATE
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_designer RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can extend the deadline.' USING ERRCODE = '42501';
    END IF;

    IF p_new_deadline <= CURRENT_DATE THEN
        RAISE EXCEPTION 'New deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF v_proj.deadline IS NOT NULL AND p_new_deadline <= v_proj.deadline THEN
        RAISE EXCEPTION 'New deadline must be later than the existing deadline (%)' , v_proj.deadline
            USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    UPDATE public.projects
    SET
        deadline = p_new_deadline,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    -- Notify designers
    FOR v_designer IN
        SELECT DISTINCT designer_id FROM public.proposals
        WHERE project_id = p_project_id
          AND status <> 'withdrawn'::public.proposal_status
    LOOP
        PERFORM public.create_notification(
            v_designer.designer_id,
            'message_received'::public.notification_type,
            'Project Deadline Extended',
            'The client has extended the deadline for "' || v_proj.title || '" to ' || p_new_deadline || '.',
            jsonb_build_object('project_id', p_project_id, 'new_deadline', p_new_deadline)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'new_deadline', p_new_deadline
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 9. Trigger: Proposal Edit Lockdown on Projects
-- Once ANY proposal exists:
-- - design_budget, payment_type, category cannot change
-- - description changes must go through project updates
-- - title can only be corrected within 24 hours of publishing
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_project_updates()
RETURNS TRIGGER AS $$
DECLARE
    v_has_proposals BOOLEAN := FALSE;
BEGIN
    -- Draft projects can be edited freely by owner
    IF OLD.status = 'draft'::public.project_status THEN
        RETURN NEW;
    END IF;

    -- Check if proposals exist
    SELECT EXISTS (
        SELECT 1 FROM public.proposals WHERE project_id = NEW.id
    ) INTO v_has_proposals;

    IF v_has_proposals THEN
        -- 1. Budget and payment type lock
        IF (OLD.design_budget IS DISTINCT FROM NEW.design_budget OR OLD.payment_type IS DISTINCT FROM NEW.payment_type) THEN
            RAISE EXCEPTION 'Cannot modify design budget or payment type once proposals have been received.'
                USING HINT = 'not_editable', ERRCODE = 'P0001';
        END IF;

        -- 2. Category and Subcategory lock
        IF (OLD.category IS DISTINCT FROM NEW.category OR OLD.subcategory IS DISTINCT FROM NEW.subcategory) THEN
            RAISE EXCEPTION 'Cannot modify project category once proposals have been received.'
                USING HINT = 'not_editable', ERRCODE = 'P0001';
        END IF;

        -- 3. Description change lock (must use project updates)
        IF (OLD.description IS DISTINCT FROM NEW.description) THEN
            RAISE EXCEPTION 'Project description cannot be edited once proposals exist. Please use Project Updates to communicate scope clarifications.'
                USING HINT = 'not_editable', ERRCODE = 'P0001';
        END IF;

        -- 4. Title correction window (max 24 hours from published_at)
        IF (OLD.title IS DISTINCT FROM NEW.title) THEN
            IF OLD.published_at IS NOT NULL AND (timezone('utc'::text, now()) - OLD.published_at) > INTERVAL '24 hours' THEN
                RAISE EXCEPTION 'Project title can only be corrected within 24 hours of publishing.'
                    USING HINT = 'not_editable', ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 10. Trigger: Prevent Milestone Modifications Once Proposals Exist
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_project_milestone_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_proj_id UUID;
    v_has_proposals BOOLEAN;
BEGIN
    v_proj_id := COALESCE(NEW.project_id, OLD.project_id);

    SELECT EXISTS (
        SELECT 1 FROM public.proposals WHERE project_id = v_proj_id
    ) INTO v_has_proposals;

    IF v_has_proposals THEN
        RAISE EXCEPTION 'Milestone scope cannot be modified once proposals have been received.'
            USING HINT = 'not_editable', ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_project_milestone_lock ON public.project_milestones;
CREATE TRIGGER trg_check_project_milestone_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.project_milestones
    FOR EACH ROW
    EXECUTE FUNCTION public.check_project_milestone_lock();

-- ------------------------------------------------------------------------------
-- 11. Trigger: proposal_received Client Notification
-- When designer submits proposal, notify client
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_proposal_received_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id UUID;
    v_proj_title TEXT;
BEGIN
    SELECT client_id, title INTO v_client_id, v_proj_title
    FROM public.projects WHERE id = NEW.project_id;

    IF v_client_id IS NOT NULL THEN
        PERFORM public.create_notification(
            v_client_id,
            'proposal_received'::public.notification_type,
            'New Proposal Received',
            'A designer submitted a proposal for "' || v_proj_title || '".',
            jsonb_build_object(
                'project_id', NEW.project_id,
                'proposal_id', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_proposal_received_notification ON public.proposals;
CREATE TRIGGER trg_proposal_received_notification
    AFTER INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_proposal_received_notification();

-- ------------------------------------------------------------------------------
-- 12. Scheduled Maintenance Job: Project Auto-Close & Warning
-- Warn 7 days before auto_close_days, close at auto_close_days, close expired proposal deadlines
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_project_auto_close()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auto_close_days INT;
    v_warning_days INT;
    v_warn_count INT := 0;
    v_close_count INT := 0;
    v_deadline_close_count INT := 0;
    v_proj RECORD;
    v_lock_acquired BOOLEAN;
BEGIN
    -- Advisory lock to guarantee single-instance execution
    v_lock_acquired := pg_try_advisory_xact_lock(hashtext('check_project_auto_close'));
    IF NOT v_lock_acquired THEN
        RETURN jsonb_build_object('status', 'skipped', 'reason', 'lock_not_acquired');
    END IF;

    SELECT COALESCE((value->>0)::INT, 60) INTO v_auto_close_days
    FROM public.app_settings WHERE key = 'project_auto_close_days';

    SELECT COALESCE((value->>0)::INT, 7) INTO v_warning_days
    FROM public.app_settings WHERE key = 'auto_close_warning_days';

    -- 1. Close projects that passed proposal_deadline
    FOR v_proj IN
        SELECT id, client_id, title FROM public.projects
        WHERE status = 'open'::public.project_status
          AND proposal_deadline IS NOT NULL
          AND proposal_deadline < CURRENT_DATE
    LOOP
        UPDATE public.projects
        SET
            status = 'closed'::public.project_status,
            closed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_proj.id;

        PERFORM public.create_notification(
            v_proj.client_id,
            'system_announcement'::public.notification_type,
            'Proposal Window Closed',
            'The proposal deadline for "' || v_proj.title || '" has passed. The project is no longer accepting new proposals.',
            jsonb_build_object('project_id', v_proj.id)
        );

        v_deadline_close_count := v_deadline_close_count + 1;
    END LOOP;

    -- 2. Send 7-day warning notification for inactive open projects
    FOR v_proj IN
        SELECT id, client_id, title FROM public.projects
        WHERE status = 'open'::public.project_status
          AND published_at <= (timezone('utc'::text, now()) - ((v_auto_close_days - v_warning_days) || ' days')::INTERVAL)
          AND published_at > (timezone('utc'::text, now()) - (v_auto_close_days || ' days')::INTERVAL)
    LOOP
        PERFORM public.create_notification(
            v_proj.client_id,
            'system_announcement'::public.notification_type,
            'Project Expiring Soon',
            'Your project "' || v_proj.title || '" will be automatically closed in ' || v_warning_days || ' days due to inactivity.',
            jsonb_build_object('project_id', v_proj.id)
        );
        v_warn_count := v_warn_count + 1;
    END LOOP;

    -- 3. Auto-close projects reaching 60 days
    FOR v_proj IN
        SELECT id, client_id, title FROM public.projects
        WHERE status = 'open'::public.project_status
          AND published_at <= (timezone('utc'::text, now()) - (v_auto_close_days || ' days')::INTERVAL)
    LOOP
        UPDATE public.projects
        SET
            status = 'closed'::public.project_status,
            closed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_proj.id;

        PERFORM public.create_notification(
            v_proj.client_id,
            'system_announcement'::public.notification_type,
            'Project Automatically Closed',
            'Your project "' || v_proj.title || '" has been closed after ' || v_auto_close_days || ' days.',
            jsonb_build_object('project_id', v_proj.id)
        );
        v_close_count := v_close_count + 1;
    END LOOP;

    -- Log run
    INSERT INTO public.job_runs (job_name, items_processed, error_count, details)
    VALUES (
        'check_project_auto_close',
        v_warn_count + v_close_count + v_deadline_close_count,
        0,
        jsonb_build_object(
            'warnings_sent', v_warn_count,
            'auto_closed', v_close_count,
            'deadline_closed', v_deadline_close_count
        )
    );

    RETURN jsonb_build_object(
        'warnings_sent', v_warn_count,
        'auto_closed', v_close_count,
        'deadline_closed', v_deadline_close_count
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 10. request_account_deletion
-- Validates eligibility (no open projects, active engagements, or held escrow funds)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_email TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_user_email TEXT;
    v_has_open_projects BOOLEAN := FALSE;
    v_has_active_engagements BOOLEAN := FALSE;
    v_has_escrow_funds BOOLEAN := FALSE;
    v_ticket_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_caller_id;
    IF v_user_email IS NULL OR lower(trim(p_email)) <> lower(trim(v_user_email)) THEN
        RAISE EXCEPTION 'Provided email does not match your registered account email.' USING ERRCODE = 'P0001';
    END IF;

    -- Check open projects
    SELECT EXISTS (
        SELECT 1 FROM public.projects
        WHERE client_id = v_caller_id
          AND status IN ('open'::public.project_status, 'under_review'::public.project_status)
    ) INTO v_has_open_projects;

    IF v_has_open_projects THEN
        RAISE EXCEPTION 'Cannot delete account while you have open or under-review projects. Please close or cancel them first.' USING ERRCODE = 'P0001';
    END IF;

    -- Check active engagements
    SELECT EXISTS (
        SELECT 1 FROM public.engagements
        WHERE (client_id = v_caller_id OR designer_id = v_caller_id)
          AND status IN ('active'::public.engagement_status, 'in_dispute'::public.engagement_status)
    ) INTO v_has_active_engagements;

    IF v_has_active_engagements THEN
        RAISE EXCEPTION 'Cannot delete account while you have active engagements or ongoing work.' USING ERRCODE = 'P0001';
    END IF;

    -- Check funds in escrow
    SELECT EXISTS (
        SELECT 1 FROM public.engagement_milestones em
        JOIN public.engagements e ON e.id = em.engagement_id
        WHERE (e.client_id = v_caller_id OR e.designer_id = v_caller_id)
          AND em.escrow_status IN ('funded'::public.escrow_status, 'held'::public.escrow_status)
    ) INTO v_has_escrow_funds;

    IF v_has_escrow_funds THEN
        RAISE EXCEPTION 'Cannot delete account with funds held in escrow. Please complete or refund remaining milestones.' USING ERRCODE = 'P0001';
    END IF;

    -- Record deletion request timestamp on profile
    UPDATE public.profiles
    SET deletion_requested_at = timezone('utc'::text, now())
    WHERE id = v_caller_id;

    -- Create support ticket for manual compliance/legal handling
    INSERT INTO public.support_tickets (
        user_id,
        type,
        subject,
        details
    )
    VALUES (
        v_caller_id,
        'help'::public.ticket_type,
        'Account Deletion Request',
        'User ' || v_user_email || ' (ID: ' || v_caller_id || ') has submitted an official account deletion request. Please review compliance records and process accordingly.'
    )
    RETURNING id INTO v_ticket_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Account deletion request received and logged for administrative processing.',
        'ticket_id', v_ticket_id,
        'requested_at', now()
    );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 030_projects_views_update.sql
-- Update open_projects & client_summaries Views + public_project_teasers View
-- ==============================================================================

-- 1. Update open_projects view
DROP VIEW IF EXISTS public.open_projects CASCADE;

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
    p.design_budget,
    p.design_budget AS budget, -- Backwards compatibility alias
    p.construction_cost_estimate,
    p.currency,
    p.payment_type,
    p.hourly_rate_max,
    p.timeline_days,
    p.deadline,
    p.proposal_deadline,
    p.area_sqft,
    p.area_unit,
    p.location_text,
    p.city,
    p.state_region,
    p.building_status,
    p.site_status,
    p.existing_documents,
    p.disciplines,
    p.status,
    p.published_at,
    p.search,
    -- Aggregate proposal count (excluding withdrawn)
    (
        SELECT COUNT(*)::INT
        FROM public.proposals prop
        WHERE prop.project_id = p.id
          AND prop.status <> 'withdrawn'::public.proposal_status
    ) AS proposal_count,
    -- has_applied indicator for caller
    EXISTS (
        SELECT 1
        FROM public.proposals my_prop
        WHERE my_prop.project_id = p.id
          AND my_prop.designer_id = (SELECT auth.uid())
          AND my_prop.status <> 'withdrawn'::public.proposal_status
    ) AS has_applied,
    -- is_saved indicator for caller
    EXISTS (
        SELECT 1
        FROM public.saved_projects sp
        WHERE sp.project_id = p.id
          AND sp.user_id = (SELECT auth.uid())
    ) AS is_saved,
    -- JSON aggregated milestones plan
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
        -- OR designer has a proposal on this project
        OR EXISTS (
            SELECT 1 FROM public.proposals my_prop
            WHERE my_prop.project_id = p.id
              AND my_prop.designer_id = (SELECT auth.uid())
        )
        -- OR project owner / admin
        OR p.client_id = (SELECT auth.uid())
        OR public.is_admin()
    );

GRANT SELECT ON public.open_projects TO authenticated;
REVOKE SELECT ON public.open_projects FROM anon;

-- 2. Update client_summaries view (preserves security barrier and privacy)
DROP VIEW IF EXISTS public.client_summaries CASCADE;

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
    cp.account_type,
    cp.company_name,
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

GRANT SELECT ON public.client_summaries TO authenticated;
REVOKE SELECT ON public.client_summaries FROM anon;

-- 3. Public Project Teasers View (Minimal public preview; setting controlled)
INSERT INTO public.app_settings (key, value, description)
VALUES ('public_project_teasers_enabled', 'false'::jsonb, 'Whether anonymous visitors can see anonymized project teasers')
ON CONFLICT (key) DO NOTHING;

DROP VIEW IF EXISTS public.public_project_teasers CASCADE;

CREATE OR REPLACE VIEW public.public_project_teasers
WITH (security_barrier = true) AS
SELECT
    p.id,
    p.title,
    p.category,
    p.subcategory,
    p.disciplines,
    p.city,
    p.state_region,
    p.design_budget,
    p.currency,
    p.payment_type,
    p.published_at
FROM public.projects p
WHERE p.status = 'open'::public.project_status
  AND COALESCE((SELECT (value)::boolean FROM public.app_settings WHERE key = 'public_project_teasers_enabled'), false) = true;

GRANT SELECT ON public.public_project_teasers TO authenticated, anon;

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 031_projects_rls_policies.sql
-- Row Level Security (RLS) on Categories, Phase Templates, Private Details, Updates & Grants
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Categories & Subcategories RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_read_all" ON public.categories;
CREATE POLICY "categories_read_all"
    ON public.categories
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "categories_admin_all" ON public.categories;
CREATE POLICY "categories_admin_all"
    ON public.categories
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subcategories_read_all" ON public.subcategories;
CREATE POLICY "subcategories_read_all"
    ON public.subcategories
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "subcategories_admin_all" ON public.subcategories;
CREATE POLICY "subcategories_admin_all"
    ON public.subcategories
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 2. Phase Templates RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.phase_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "phase_templates_read_all" ON public.phase_templates;
CREATE POLICY "phase_templates_read_all"
    ON public.phase_templates
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "phase_templates_admin_all" ON public.phase_templates;
CREATE POLICY "phase_templates_admin_all"
    ON public.phase_templates
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 3. Project Private Details RLS
-- Deny by default: Only project owner, admin, or engagement designer after contract signed
-- ------------------------------------------------------------------------------
ALTER TABLE public.project_private_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "private_details_select" ON public.project_private_details;
CREATE POLICY "private_details_select"
    ON public.project_private_details
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_private_details.project_id
              AND p.client_id = (SELECT auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.project_id = project_private_details.project_id
              AND e.designer_id = (SELECT auth.uid())
              AND e.status IN ('active'::public.engagement_status, 'completed'::public.engagement_status)
        )
    );

DROP POLICY IF EXISTS "private_details_insert" ON public.project_private_details;
CREATE POLICY "private_details_insert"
    ON public.project_private_details
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_private_details.project_id
              AND p.client_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "private_details_update" ON public.project_private_details;
CREATE POLICY "private_details_update"
    ON public.project_private_details
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_private_details.project_id
              AND p.client_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_private_details.project_id
              AND p.client_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "private_details_delete" ON public.project_private_details;
CREATE POLICY "private_details_delete"
    ON public.project_private_details
    FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_private_details.project_id
              AND p.client_id = (SELECT auth.uid())
        )
    );

-- ------------------------------------------------------------------------------
-- 4. Project Updates RLS
-- ------------------------------------------------------------------------------
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_updates_select" ON public.project_updates;
CREATE POLICY "project_updates_select"
    ON public.project_updates
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = project_updates.project_id
              AND p.client_id = (SELECT auth.uid())
        )
        OR EXISTS (
            SELECT 1 FROM public.proposals prop
            WHERE prop.project_id = project_updates.project_id
              AND prop.designer_id = (SELECT auth.uid())
              AND prop.status <> 'withdrawn'::public.proposal_status
        )
    );

DROP POLICY IF EXISTS "project_updates_insert" ON public.project_updates;
CREATE POLICY "project_updates_insert"
    ON public.project_updates
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR (
            author_id = (SELECT auth.uid())
            AND EXISTS (
                SELECT 1 FROM public.projects p
                WHERE p.id = project_updates.project_id
                  AND p.client_id = (SELECT auth.uid())
                  AND p.status IN ('open'::public.project_status, 'awarded'::public.project_status)
            )
        )
    );

-- ------------------------------------------------------------------------------
-- 5. Onboarding Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_onboarding_step(
    p_role TEXT,
    p_step INT,
    p_data JSONB
)
RETURNS JSONB
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

    IF p_role = 'client' THEN
        -- Save client profile details
        IF p_data ? 'account_type' THEN
            UPDATE public.client_profiles
            SET
                account_type = p_data->>'account_type',
                company_name = NULLIF(trim(p_data->>'company_name'), ''),
                phone = NULLIF(trim(p_data->>'phone'), ''),
                updated_at = timezone('utc'::text, now())
            WHERE user_id = v_caller_id;
        END IF;

        -- Update location on profiles if provided
        IF p_data ? 'location' AND p_data->>'location' IS NOT NULL THEN
            UPDATE public.profiles
            SET
                location = NULLIF(trim(p_data->>'location'), ''),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_caller_id;
        END IF;

    ELSIF p_role = 'designer' THEN
        -- Save designer practice details
        UPDATE public.designer_profiles
        SET
            professional_type = COALESCE((p_data->>'professional_type')::public.professional_type, professional_type),
            specializations = CASE
                WHEN p_data ? 'specializations' AND jsonb_typeof(p_data->'specializations') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(p_data->'specializations'))
                ELSE specializations
            END,
            years_experience = COALESCE((p_data->>'years_experience')::INT, years_experience),
            updated_at = timezone('utc'::text, now())
        WHERE user_id = v_caller_id;

        IF p_data ? 'location' AND p_data->>'location' IS NOT NULL THEN
            UPDATE public.profiles
            SET
                location = NULLIF(trim(p_data->>'location'), ''),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_caller_id;
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'step', p_step);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_role TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
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

    -- Apply optional final data
    IF p_data IS NOT NULL AND p_data <> '{}'::jsonb THEN
        PERFORM public.save_onboarding_step(p_role, 2, p_data);
    END IF;

    UPDATE public.profiles
    SET
        onboarding_completed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_caller_id;

    RETURN jsonb_build_object(
        'success', true,
        'onboarding_completed_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. Grants on Tables & Functions
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.categories TO authenticated, anon;
GRANT SELECT ON public.subcategories TO authenticated, anon;
GRANT SELECT ON public.phase_templates TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_private_details TO authenticated;
GRANT SELECT, INSERT ON public.project_updates TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_site_details(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_project(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_project(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_project(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duplicate_project(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_project(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_project_update(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extend_deadline(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_project_auto_close() TO service_role;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(TEXT, INT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(TEXT) TO authenticated, service_role;

