-- ==============================================================================
-- DEZIGNET PHASE 2: 010_project_rls_views.sql
-- Project RLS Policies, Open Projects View & Client Summaries View
-- ==============================================================================

-- 1. Trigger to prevent clients from editing budget or payment_type once proposals exist
CREATE OR REPLACE FUNCTION public.check_project_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- If project is not draft and any proposal exists, lock budget and payment_type
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

-- Note: proposals table will be created in 011, so we conditionally attach or run trigger
-- using dynamic execution or AFTER proposals table exists. Let's make the function robust if proposals doesn't exist yet.
CREATE OR REPLACE FUNCTION public.check_project_updates()
RETURNS TRIGGER AS $$
DECLARE
    v_has_proposals BOOLEAN := FALSE;
BEGIN
    IF OLD.status <> 'draft'::public.project_status THEN
        IF (OLD.budget IS DISTINCT FROM NEW.budget OR OLD.payment_type IS DISTINCT FROM NEW.payment_type) THEN
            BEGIN
                SELECT EXISTS (SELECT 1 FROM public.proposals WHERE project_id = NEW.id) INTO v_has_proposals;
            EXCEPTION WHEN undefined_table THEN
                v_has_proposals := FALSE;
            END;

            IF v_has_proposals THEN
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

-- 2. Enable RLS on Client Profiles, Projects, Milestones & Images
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;

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
-- Designers DO NOT read the projects table directly — they read through open_projects view.
-- Clients can only see their own projects.
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

-- 3. Security-Barrier View: client_summaries
-- Safely exposes minimal client details for open projects or projects where designer applied.
-- NEVER exposes email, phone, full name or full address.
CREATE OR REPLACE VIEW public.client_summaries
WITH (security_barrier = true) AS
SELECT
    cp.user_id,
    -- Display Name: First name + First letter of Last name + '.'
    CASE
        WHEN POSITION(' ' IN trim(p.full_name)) > 0 THEN
            SPLIT_PART(trim(p.full_name), ' ', 1) || ' ' ||
            SUBSTRING(SPLIT_PART(trim(p.full_name), ' ', 2), 1, 1) || '.'
        ELSE
            trim(p.full_name)
    END AS display_name,
    p.location AS city,
    p.location AS state_region,
    p.created_at AS member_since,
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
        -- Client has at least one open project
        EXISTS (
            SELECT 1 FROM public.projects op
            WHERE op.client_id = cp.user_id
              AND op.status = 'open'::public.project_status
        )
        -- OR caller is a designer with a proposal on one of this client's projects
        OR EXISTS (
            SELECT 1
            FROM public.proposals prop
            JOIN public.projects p2 ON p2.id = prop.project_id
            WHERE p2.client_id = cp.user_id
              AND prop.designer_id = (SELECT auth.uid())
        )
        -- OR caller is admin or the client themself
        OR cp.user_id = (SELECT auth.uid())
        OR public.is_admin()
    );

-- 4. Security-Barrier View: open_projects
-- Primary view for designers to explore open projects and track projects they proposed on.
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
    -- Aggregate proposal count (excluding withdrawn)
    (
        SELECT COUNT(*)::INT
        FROM public.proposals prop
        WHERE prop.project_id = p.id
          AND prop.status <> 'withdrawn'::public.proposal_status
    ) AS proposal_count,
    -- has_applied indicator for current user
    EXISTS (
        SELECT 1
        FROM public.proposals my_prop
        WHERE my_prop.project_id = p.id
          AND my_prop.designer_id = (SELECT auth.uid())
          AND my_prop.status <> 'withdrawn'::public.proposal_status
    ) AS has_applied,
    -- is_saved indicator for current user
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
        -- OR the authenticated designer has a proposal on this project (so My Work shows it even if closed/awarded)
        OR EXISTS (
            SELECT 1 FROM public.proposals my_prop
            WHERE my_prop.project_id = p.id
              AND my_prop.designer_id = (SELECT auth.uid())
        )
        -- OR project owner / admin
        OR p.client_id = (SELECT auth.uid())
        OR public.is_admin()
    );

-- Permissions
GRANT SELECT ON public.open_projects TO authenticated;
GRANT SELECT ON public.client_summaries TO authenticated;
REVOKE SELECT ON public.open_projects FROM anon;
REVOKE SELECT ON public.client_summaries FROM anon;
