-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PROJECT INTAKE, TAXONOMY, PROPOSALS & LICENSURE
-- 046_project_intake_taxonomy_licensure_saved_searches.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENUMS & TYPE EXPANSIONS
-- ------------------------------------------------------------------------------

-- 1.1 Update professional_type enum
DO $$
BEGIN
    ALTER TYPE public.professional_type ADD VALUE IF NOT EXISTS 'bim_specialist';
    ALTER TYPE public.professional_type ADD VALUE IF NOT EXISTS 'visualization_professional';
    ALTER TYPE public.professional_type ADD VALUE IF NOT EXISTS 'drafter_cad';
    ALTER TYPE public.professional_type ADD VALUE IF NOT EXISTS 'other_consultant';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 Update payment_type enum to include fixed_fee
DO $$
BEGIN
    ALTER TYPE public.payment_type ADD VALUE IF NOT EXISTS 'fixed_fee';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 2. SERVICES CATALOG TABLE (19 Admin-Editable Services with Sort Order)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sort_order INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_services_catalog_sort ON public.services_catalog (sort_order ASC);

ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_catalog_read_all" ON public.services_catalog;
CREATE POLICY "services_catalog_read_all"
    ON public.services_catalog
    FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "services_catalog_admin_all" ON public.services_catalog;
CREATE POLICY "services_catalog_admin_all"
    ON public.services_catalog
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Seed the 19 standard architectural & engineering services
INSERT INTO public.services_catalog (name, sort_order) VALUES
    ('New construction', 1),
    ('Renovation', 2),
    ('Tenant improvement', 3),
    ('Residential design', 4),
    ('Commercial architecture', 5),
    ('Interior design', 6),
    ('Landscape and site planning', 7),
    ('Feasibility', 8),
    ('Master planning', 9),
    ('Civil engineering', 10),
    ('Structural engineering', 11),
    ('MEP engineering', 12),
    ('Revit and BIM', 13),
    ('CAD drafting', 14),
    ('Scan-to-BIM and as-builts', 15),
    ('3D visualization', 16),
    ('Permit drawings', 17),
    ('Construction documents', 18),
    ('Construction administration', 19)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- ------------------------------------------------------------------------------
-- 3. DESIGNER PROFILES: Services Offered & Service Area
-- ------------------------------------------------------------------------------

ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS services_offered TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS service_area_states TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_designer_profiles_services ON public.designer_profiles USING GIN (services_offered);

-- ------------------------------------------------------------------------------
-- 4. PROJECTS TABLE: Intake & Governance Amendments
-- ------------------------------------------------------------------------------

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS budget_min NUMERIC(12,2) CHECK (budget_min IS NULL OR budget_min > 0),
    ADD COLUMN IF NOT EXISTS requested_services TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS licensure_requirement TEXT NOT NULL DEFAULT 'not_sure',
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS deliverables_checklist TEXT[] DEFAULT '{}';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_licensure_requirement_check'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_licensure_requirement_check
            CHECK (licensure_requirement IN (
                'licensed_professional_required',
                'stamping_required',
                'not_required',
                'not_sure'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_visibility_check'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_visibility_check
            CHECK (visibility IN ('public', 'invitation_only'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_projects_visibility ON public.projects (visibility);
CREATE INDEX IF NOT EXISTS idx_projects_services ON public.projects USING GIN (requested_services);

-- ------------------------------------------------------------------------------
-- 5. PROPOSALS TABLE: Licensure Disclosure & Scope Additions
-- ------------------------------------------------------------------------------

ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS project_understanding TEXT CHECK (project_understanding IS NULL OR char_length(project_understanding) <= 1000),
    ADD COLUMN IF NOT EXISTS deliverables TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS can_offer_regulated_services TEXT,
    ADD COLUMN IF NOT EXISTS service_area_states TEXT[] DEFAULT '{}';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proposals_can_offer_regulated_check'
    ) THEN
        ALTER TABLE public.proposals
            ADD CONSTRAINT proposals_can_offer_regulated_check
            CHECK (can_offer_regulated_services IS NULL OR can_offer_regulated_services IN (
                'licensed_in_project_state',
                'will_partner_with_licensed_professional',
                'not_required_for_this_service',
                'cannot_offer_regulated_services'
            ));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. SAVED SEARCHES TABLE (Max 10 per user per type)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('projects', 'designers')),
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    notify BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON public.saved_searches (user_id, type);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own saved searches" ON public.saved_searches;
CREATE POLICY "Users can read own saved searches"
    ON public.saved_searches
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can create own saved searches" ON public.saved_searches;
CREATE POLICY "Users can create own saved searches"
    ON public.saved_searches
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own saved searches" ON public.saved_searches;
CREATE POLICY "Users can update own saved searches"
    ON public.saved_searches
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete own saved searches" ON public.saved_searches;
CREATE POLICY "Users can delete own saved searches"
    ON public.saved_searches
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

-- Enforce maximum 10 saved searches per user per type
CREATE OR REPLACE FUNCTION public.check_max_saved_searches()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.saved_searches
    WHERE user_id = NEW.user_id AND type = NEW.type;

    IF v_count >= 10 THEN
        RAISE EXCEPTION 'Maximum of 10 saved searches allowed per search type.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_saved_searches_limit ON public.saved_searches;
CREATE TRIGGER trg_check_saved_searches_limit
    BEFORE INSERT ON public.saved_searches
    FOR EACH ROW
    EXECUTE FUNCTION public.check_max_saved_searches();

-- ------------------------------------------------------------------------------
-- 7. PHASE TEMPLATES UPDATE & HISTORICAL MIGRATION
-- ------------------------------------------------------------------------------

-- Seed 9 Standard Phase Templates
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
        'Programming',
        'Project goals, space requirements, code analysis, and functional scope definition.',
        ARRAY['Functional space program', 'Code & zoning summary', 'Client brief sign-off'],
        'Sign-off on architectural program document',
        5.00,
        0.00,
        true
    ),
    (
        2,
        'Feasibility',
        'Review of site survey, zoning setbacks, utility availability, and feasibility diagrams.',
        ARRAY['Site survey review', 'Zoning setback clearance', 'Feasibility diagrams'],
        'Approval of site feasibility document',
        5.00,
        0.00,
        true
    ),
    (
        3,
        'Conceptual Design',
        'Initial design directions, massing models, and aesthetic exploration.',
        ARRAY['Initial concept sketches', 'Massing diagrams', 'Aesthetic mood boards'],
        'Client selection of conceptual direction',
        10.00,
        0.00,
        true
    ),
    (
        4,
        'Schematic Design',
        'Layout options, spatial relationship matrix, and defined architectural concepts.',
        ARRAY['Concept floor plans', 'Massing 3D sketches', 'Spatial relationship matrix'],
        'Client selection and sign-off of schematic concept',
        20.00,
        20.00,
        false
    ),
    (
        5,
        'Design Development',
        'Refine the selected design, coordinate structural and MEP consultant requirements.',
        ARRAY['Dimensioned floor plans', 'Exterior elevations', 'Consultant coordination overlay'],
        'Approval of coordinated design development package',
        25.00,
        25.00,
        false
    ),
    (
        6,
        'Construction Documents',
        'Permit- and construction-ready drawing set with detailed specifications.',
        ARRAY['Full permit drawing set', 'Technical specifications', 'Foundation and framing details'],
        'Delivery of signed architectural permit set',
        35.00,
        35.00,
        false
    ),
    (
        7,
        'Permitting',
        'Statutory authority filings, permit document submission, and plan-check response coordination.',
        ARRAY['Permit application package', 'Plan check response letters', 'Permit revision drawings'],
        'Submission and municipal plan check clearance',
        5.00,
        0.00,
        true
    ),
    (
        8,
        'Bidding',
        'Assist with general contractor selection, tender packages, and bid evaluation.',
        ARRAY['Bid tender documentation', 'Tender evaluation report', 'Contractor selection memo'],
        'Contractor award / construction contract execution',
        5.00,
        5.00,
        false
    ),
    (
        9,
        'Construction Administration',
        'On-site design observation, RFI responses, submittal review, and final punch list.',
        ARRAY['Site observation reports', 'RFI responses', 'Defects punch list'],
        'Final certificate of substantial completion',
        15.00,
        15.00,
        false
    );

-- Migrate historical projects and engagements using legacy phase names
UPDATE public.project_milestones
SET name = 'Feasibility'
WHERE name ILIKE '%pre-design%' OR name ILIKE '%site feasibility%';

UPDATE public.project_milestones
SET name = 'Bidding'
WHERE name ILIKE '%bidding & permitting%' OR name ILIKE '%bidding and permitting%';

UPDATE public.engagement_milestones
SET name = 'Feasibility'
WHERE name ILIKE '%pre-design%' OR name ILIKE '%site feasibility%';

UPDATE public.engagement_milestones
SET name = 'Bidding'
WHERE name ILIKE '%bidding & permitting%' OR name ILIKE '%bidding and permitting%';

-- ------------------------------------------------------------------------------
-- 8. APP SETTINGS SEEDING & MATCHING WEIGHTS
-- ------------------------------------------------------------------------------

INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('min_project_budget', 'null'::jsonb, 'Minimum project budget required to publish (null for none)'),
    ('prohibited_project_categories', '[]'::jsonb, 'Array of category names prohibited from being published')
ON CONFLICT (key) DO NOTHING;

-- Update matching_weights to include services_overlap (+20)
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'matching_weights',
    '{"specialization_match": 30, "services_overlap": 20, "subcategory_portfolio": 15, "same_city": 15, "same_state": 10, "rating": 10, "completed_projects": 5}'::jsonb,
    'Scoring weights for candidate designer suggestion algorithm'
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
    COALESCE(public.app_settings.value, '{}'::jsonb),
    '{services_overlap}',
    '20'::jsonb,
    true
);

-- ------------------------------------------------------------------------------
-- 9. VIEW UPDATES: open_projects & public_designer_profiles
-- ------------------------------------------------------------------------------

-- 9.1 open_projects view
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
    p.design_budget AS budget,
    p.budget_min,
    p.requested_services,
    p.licensure_requirement,
    p.visibility,
    p.deliverables_checklist,
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
    COALESCE(
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
        (
            p.status = 'open'::public.project_status
            AND (
                COALESCE(p.visibility, 'public') = 'public'
                OR EXISTS (
                    SELECT 1 FROM public.project_invitations pi
                    WHERE pi.project_id = p.id
                      AND pi.designer_id = (SELECT auth.uid())
                )
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.proposals my_prop
            WHERE my_prop.project_id = p.id
              AND my_prop.designer_id = (SELECT auth.uid())
        )
        OR p.client_id = (SELECT auth.uid())
        OR public.is_admin()
    );

GRANT SELECT ON public.open_projects TO authenticated;
REVOKE SELECT ON public.open_projects FROM anon;

-- 9.2 public_project_teasers view (only public visibility)
DROP VIEW IF EXISTS public.public_project_teasers CASCADE;

CREATE OR REPLACE VIEW public.public_project_teasers AS
SELECT
    p.id,
    p.title,
    p.category,
    p.subcategory,
    p.design_budget,
    p.budget_min,
    p.requested_services,
    p.licensure_requirement,
    p.city,
    p.state_region,
    p.payment_type,
    p.timeline_days,
    p.proposal_deadline,
    p.published_at,
    (
        SELECT COUNT(*)::INT
        FROM public.proposals prop
        WHERE prop.project_id = p.id
          AND prop.status <> 'withdrawn'::public.proposal_status
    ) AS proposal_count
FROM public.projects p
WHERE p.status = 'open'::public.project_status
  AND COALESCE(p.visibility, 'public') = 'public';

GRANT SELECT ON public.public_project_teasers TO authenticated, anon;

-- 9.3 public_designer_profiles view
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;

CREATE OR REPLACE VIEW public.public_designer_profiles AS
SELECT
    dp.user_id,
    dp.professional_type,
    dp.title,
    dp.studio_name,
    dp.bio,
    dp.specializations,
    dp.services_offered,
    dp.service_area_states,
    dp.languages,
    dp.years_experience,
    dp.city,
    dp.state,
    p.full_name,
    p.avatar_path,
    p.location,
    p.created_at AS member_since,
    dp.hourly_rate,
    dp.show_hourly_rate,
    dp.show_in_search,
    dp.is_available,
    dp.accepts_invitations,
    dp.studio_slug,
    p.plan_key,
    (p.plan_key IN ('basic', 'upgraded')) AS member_badge,
    (p.plan_key IN ('basic', 'upgraded')) AS has_member_badge,
    (p.plan_key IN ('basic', 'upgraded')) AS verified,
    COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 1) 
         FROM public.reviews r 
         WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0.0
    ) AS rating_average,
    COALESCE(
        (SELECT COUNT(*)::INT 
         FROM public.reviews r 
         WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0
    ) AS rating_count,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE would_hire_again = true)::numeric / COUNT(*)) * 100, 0)
         FROM public.reviews r 
         WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        100
    ) AS would_hire_again_percent,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', c.id,
                    'credential_type', c.credential_type,
                    'title', c.title,
                    'issuing_body', c.issuing_body,
                    'issuing_state', c.issuing_state,
                    'status', c.status,
                    'status_label', CASE 
                        WHEN c.status = 'expired' OR (c.expiration_date IS NOT NULL AND c.expiration_date < CURRENT_DATE) THEN 'Expired'
                        ELSE 'Self-reported'
                    END
                ) ORDER BY c.created_at ASC
            )
            FROM public.credentials c
            WHERE c.designer_id = dp.user_id
        ),
        '[]'::jsonb
    ) AS credentials,
    COALESCE(
        (SELECT COUNT(*) > 0 
         FROM public.designer_insurance di 
         WHERE di.designer_id = dp.user_id 
           AND di.status = 'verified' 
           AND di.expiration_date >= CURRENT_DATE),
        FALSE
    ) AS is_insured,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', pj.id,
                    'title', pj.title,
                    'cover_image_path', pj.cover_image_path,
                    'category', pj.category,
                    'sort_order', pj.sort_order
                ) ORDER BY pj.sort_order ASC
            )
            FROM public.portfolio_projects pj
            WHERE pj.designer_id = dp.user_id
        ),
        '[]'::jsonb
    ) AS portfolio_items
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.show_in_search = TRUE
  AND p.plan_key <> 'free';

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 10. FUNCTION: publish_project (Updated with Governance & Fixed Fee)
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
    v_min_budget NUMERIC(12,2);
    v_prohibited JSONB;
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

    -- Governance Check: Prohibited Project Categories
    SELECT value INTO v_prohibited FROM public.app_settings WHERE key = 'prohibited_project_categories';
    IF v_prohibited IS NOT NULL AND jsonb_typeof(v_prohibited) = 'array' THEN
        IF v_prohibited ? v_proj.category THEN
            RAISE EXCEPTION 'Projects in the category "%" are currently prohibited from being published.', v_proj.category
                USING HINT = 'prohibited_category', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Validate requested services (At least 1 required)
    IF (v_proj.requested_services IS NULL OR array_length(v_proj.requested_services, 1) IS NULL OR array_length(v_proj.requested_services, 1) = 0)
       AND (v_proj.disciplines IS NULL OR array_length(v_proj.disciplines, 1) IS NULL OR array_length(v_proj.disciplines, 1) = 0) THEN
        RAISE EXCEPTION 'At least one requested service or discipline is required before publishing.'
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

    -- Governance Check: Minimum Project Budget
    SELECT (value->>0)::NUMERIC INTO v_min_budget FROM public.app_settings WHERE key = 'min_project_budget';
    IF v_min_budget IS NOT NULL AND v_proj.design_budget < v_min_budget THEN
        RAISE EXCEPTION 'Project design budget must be at least $% to be published.', v_min_budget
            USING HINT = 'below_min_budget', ERRCODE = 'P0001';
    END IF;

    -- Validate deadline in future
    IF v_proj.deadline IS NOT NULL AND v_proj.deadline <= CURRENT_DATE THEN
        RAISE EXCEPTION 'Project completion deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate proposal deadline
    IF v_proj.proposal_deadline IS NOT NULL THEN
        IF v_proj.proposal_deadline <= CURRENT_DATE THEN
            RAISE EXCEPTION 'Proposal deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        IF v_proj.deadline IS NOT NULL AND v_proj.proposal_deadline >= v_proj.deadline THEN
            RAISE EXCEPTION 'Proposal deadline must be earlier than the project completion deadline.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Payment Type & Scope Validation
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
    ELSIF v_proj.payment_type = 'fixed_fee'::public.payment_type THEN
        -- Auto-create single 100% milestone if none exists
        SELECT COUNT(*) INTO v_phase_count
        FROM public.project_milestones
        WHERE project_id = p_project_id;

        IF v_phase_count = 0 THEN
            INSERT INTO public.project_milestones (
                project_id,
                sort_order,
                name,
                description,
                deliverables,
                billing_trigger,
                fee_percent
            ) VALUES (
                p_project_id,
                1,
                'Full Project Completion',
                COALESCE(v_proj.description, 'Complete design engagement deliverables.'),
                COALESCE(v_proj.deliverables_checklist, ARRAY['Complete design package and permit drawings']),
                'Approval and delivery of completed architectural package',
                100.00
            );
        ELSE
            SELECT COALESCE(SUM(fee_percent), 0) INTO v_phase_sum
            FROM public.project_milestones
            WHERE project_id = p_project_id;

            IF ABS(v_phase_sum - 100.00) > 0.01 THEN
                RAISE EXCEPTION 'Fixed fee projects require milestone total to equal 100 percent.'
                    USING HINT = 'validation_failed', ERRCODE = 'P0001';
            END IF;
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

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'status', 'open',
        'published_at', timezone('utc'::text, now())
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. FUNCTION: get_project_designer_suggestions (With Services Overlap +20)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_project_designer_suggestions(
    p_project_id UUID,
    p_limit INT DEFAULT 6,
    p_exclude_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE (
    designer_id UUID,
    full_name TEXT,
    avatar_path TEXT,
    professional_type TEXT,
    title TEXT,
    studio_name TEXT,
    city TEXT,
    state TEXT,
    years_experience INT,
    hourly_rate NUMERIC,
    show_hourly_rate BOOLEAN,
    plan_key TEXT,
    rating_avg NUMERIC,
    rating_cnt INT,
    match_score INT,
    match_reasons JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project RECORD;
    v_cand RECORD;
    v_weights JSONB;
    v_total_score INT;
    v_reasons JSONB;
    v_spec_match INT;
    v_services_match INT;
    v_city_match INT;
    v_state_match INT;
    v_plan_boost INT;
    v_rating_match INT;
BEGIN
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
    IF v_project.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT COALESCE(value, '{}'::jsonb) INTO v_weights 
    FROM public.app_settings 
    WHERE key = 'matching_weights';

    FOR v_cand IN
        SELECT 
            dp.user_id,
            p.full_name,
            p.avatar_path,
            dp.professional_type::text AS professional_type,
            dp.title,
            dp.studio_name,
            dp.city,
            dp.state,
            dp.years_experience,
            dp.hourly_rate,
            dp.show_hourly_rate,
            dp.services_offered,
            p.plan_key,
            COALESCE(r.rating_avg, 0) as rating_avg,
            COALESCE(r.rating_cnt, 0) as rating_cnt,
            COALESCE(cmp.completed_cnt, 0) as completed_cnt
        FROM public.designer_profiles dp
        JOIN public.profiles p ON p.id = dp.user_id
        LEFT JOIN (
            SELECT designer_id, ROUND(AVG(rating)::numeric, 1) as rating_avg, COUNT(*)::int as rating_cnt
            FROM public.reviews WHERE status = 'visible' GROUP BY designer_id
        ) r ON r.designer_id = dp.user_id
        LEFT JOIN (
            SELECT designer_id, COUNT(*)::int as completed_cnt
            FROM public.projects WHERE status = 'completed' GROUP BY designer_id
        ) cmp ON cmp.designer_id = dp.user_id
        WHERE dp.show_in_search = TRUE
          AND p.plan_key != 'free'
          AND dp.is_available = TRUE
          AND dp.user_id != ALL(p_exclude_ids)
    LOOP
        v_reasons := '[]'::jsonb;
        v_total_score := 0;

        -- 1. Category / Specialization match
        IF v_cand.professional_type = v_project.category OR v_cand.professional_type = ANY(COALESCE(v_project.disciplines, ARRAY[]::text[])) THEN
            v_spec_match := COALESCE((v_weights->>'specialization_match')::int, 30);
            v_total_score := v_total_score + v_spec_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'category', 'text', 'Professional specialization matches project');
        END IF;

        -- 2. Services overlap match (+20 weight)
        IF v_project.requested_services IS NOT NULL AND array_length(v_project.requested_services, 1) > 0 THEN
            IF v_cand.services_offered && v_project.requested_services THEN
                v_services_match := COALESCE((v_weights->>'services_overlap')::int, 20);
                v_total_score := v_total_score + v_services_match;
                v_reasons := v_reasons || jsonb_build_object('type', 'services', 'text', 'Offers services requested by client');
            END IF;
        END IF;

        -- 3. Location matches
        IF v_cand.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(v_cand.city) = LOWER(v_project.city) THEN
            v_city_match := COALESCE((v_weights->>'same_city')::int, 15);
            v_total_score := v_total_score + v_city_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in same city (' || v_cand.city || ')');
        ELSIF v_cand.state IS NOT NULL AND v_project.state_region IS NOT NULL AND LOWER(v_cand.state) = LOWER(v_project.state_region) THEN
            v_state_match := COALESCE((v_weights->>'same_state')::int, 10);
            v_total_score := v_total_score + v_state_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in same state (' || v_cand.state || ')');
        END IF;

        -- 4. Plan Priority Boost (Upgraded: +20, Basic: +10, Free: +0)
        IF v_cand.plan_key = 'upgraded' THEN
            v_plan_boost := 20;
            v_total_score := v_total_score + v_plan_boost;
            v_reasons := v_reasons || jsonb_build_object('type', 'plan_boost', 'text', 'Upgraded studio membership boost (+20)');
        ELSIF v_cand.plan_key = 'basic' THEN
            v_plan_boost := 10;
            v_total_score := v_total_score + v_plan_boost;
            v_reasons := v_reasons || jsonb_build_object('type', 'plan_boost', 'text', 'Basic studio membership boost (+10)');
        END IF;

        -- 5. Rating score
        IF v_cand.rating_cnt >= 3 AND v_cand.rating_avg >= 4.0 THEN
            v_rating_match := COALESCE((v_weights->>'rating')::int, 10);
            v_total_score := v_total_score + v_rating_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'rating', 'text', 'Top client rating (' || v_cand.rating_avg || ')');
        END IF;

        -- Output candidate row
        designer_id := v_cand.user_id;
        full_name := v_cand.full_name;
        avatar_path := v_cand.avatar_path;
        professional_type := v_cand.professional_type;
        title := v_cand.title;
        studio_name := v_cand.studio_name;
        city := v_cand.city;
        state := v_cand.state;
        years_experience := v_cand.years_experience;
        hourly_rate := v_cand.hourly_rate;
        show_hourly_rate := v_cand.show_hourly_rate;
        plan_key := v_cand.plan_key;
        rating_avg := v_cand.rating_avg;
        rating_cnt := v_cand.rating_cnt;
        match_score := v_total_score;
        match_reasons := v_reasons;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. CONTRACT VIEW & RPC UPDATE: Include Licensure Disclosure in Section 1 Header
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_contract(p_engagement_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eng RECORD;
    v_proj RECORD;
    v_prop RECORD;
    v_client RECORD;
    v_designer RECORD;
    v_designer_prof RECORD;
    v_terms_ver RECORD;
    v_milestones JSONB;
    v_content JSONB;
    v_hash TEXT;
    v_contract_num TEXT;
    v_seq_num BIGINT;
    v_sign_days INT;
    v_expires_at TIMESTAMPTZ;
    v_contract_id UUID;
BEGIN
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_eng.project_id;
    SELECT * INTO v_prop FROM public.proposals WHERE id = v_eng.proposal_id;
    SELECT * INTO v_client FROM public.profiles WHERE id = v_eng.client_id;
    SELECT * INTO v_designer FROM public.profiles WHERE id = v_eng.designer_id;
    SELECT * INTO v_designer_prof FROM public.designer_profiles WHERE user_id = v_eng.designer_id;

    SELECT * INTO v_terms_ver
    FROM public.contract_terms_versions
    WHERE is_current = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_terms_ver.id IS NULL THEN
        RAISE EXCEPTION 'Current contract terms version not found.' USING ERRCODE = 'P0002';
    END IF;

    v_seq_num := nextval('public.contract_number_seq');
    v_contract_num := 'DZ-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_seq_num::text, 4, '0');

    SELECT COALESCE((value->>0)::INT, 7) INTO v_sign_days
    FROM public.app_settings
    WHERE key = 'contract_sign_deadline_days';

    v_expires_at := timezone('utc'::text, now()) + (v_sign_days || ' days')::INTERVAL;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', em.id,
            'sort_order', em.sort_order,
            'name', em.name,
            'description', em.description,
            'deliverables', em.deliverables,
            'billing_trigger', em.billing_trigger,
            'fee_percent', em.fee_percent,
            'amount', em.amount
        )
        ORDER BY em.sort_order ASC
    )
    INTO v_milestones
    FROM public.engagement_milestones em
    WHERE em.engagement_id = v_eng.id;

    v_content := jsonb_build_object(
        'section_1_header', jsonb_build_object(
            'contract_number', v_contract_num,
            'date', CURRENT_DATE,
            'project_title', v_proj.title,
            'category', v_proj.category,
            'subcategory', v_proj.subcategory,
            'client', jsonb_build_object(
                'name', v_client.full_name,
                'location', v_client.location
            ),
            'designer', jsonb_build_object(
                'name', v_designer.full_name,
                'studio_name', v_designer_prof.studio_name,
                'professional_type', v_designer_prof.professional_type,
                'location', v_designer.location,
                'can_offer_regulated_services', v_prop.can_offer_regulated_services,
                'service_area_states', v_prop.service_area_states
            )
        ),
        'section_2_scope', jsonb_build_object(
            'project_description', v_proj.description,
            'cover_letter', v_prop.cover_letter,
            'project_understanding', v_prop.project_understanding,
            'deliverables', v_prop.deliverables
        ),
        'section_3_assumptions_exclusions', jsonb_build_object(
            'assumptions', v_prop.assumptions,
            'exclusions', v_prop.exclusions
        ),
        'section_4_compensation', jsonb_build_object(
            'total_price', v_eng.total_price,
            'currency', v_eng.currency,
            'payment_type', v_eng.payment_type,
            'hourly_rate', v_eng.hourly_rate,
            'weekly_hours_cap', v_eng.weekly_hours_cap,
            'milestones', COALESCE(v_milestones, '[]'::jsonb)
        ),
        'section_5_reimbursable_additional', jsonb_build_object(
            'reimbursable_expenses_type', v_prop.reimbursable_expenses_type,
            'reimbursable_cap', v_prop.reimbursable_cap,
            'additional_services_rate', COALESCE(v_prop.additional_services_rate, v_prop.hourly_rate)
        ),
        'section_6_revisions', jsonb_build_object(
            'included_revisions_per_phase', v_prop.included_revisions_per_phase,
            'policy', 'Revisions beyond the included count shall be billed as Additional Services.'
        ),
        'section_7_timeline', jsonb_build_object(
            'delivery_days', v_prop.delivery_days,
            'schedule', v_prop.schedule,
            'policy', 'Milestone due dates are computed upon activation and funding of each phase.'
        ),
        'section_8_payment_terms', jsonb_build_object(
            'escrow_funding', 'Milestones must be funded in escrow before design commencement.',
            'review_period_days', 14,
            'security_hold_days', 5,
            'platform_fee_percent', v_eng.platform_fee_percent
        ),
        'section_9_standard_terms', jsonb_build_object(
            'terms_version', v_terms_ver.version,
            'body_markdown', v_terms_ver.body_markdown
        ),
        'section_10_signatures', jsonb_build_object(
            'status', 'awaiting_signatures'
        )
    );

    v_hash := encode(digest(v_content::text, 'sha256'), 'hex');

    INSERT INTO public.contracts (
        engagement_id,
        number,
        status,
        terms_version_id,
        content,
        content_hash,
        expires_at
    ) VALUES (
        p_engagement_id,
        v_contract_num,
        'awaiting_signatures'::public.contract_status,
        v_terms_ver.id,
        v_content,
        v_hash,
        v_expires_at
    )
    RETURNING id INTO v_contract_id;

    RETURN v_contract_id;
END;
$$;
