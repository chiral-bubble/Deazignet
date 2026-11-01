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

