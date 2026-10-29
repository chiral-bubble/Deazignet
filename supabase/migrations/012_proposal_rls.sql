-- ==============================================================================
-- DEZIGNET PHASE 2: 012_proposal_rls.sql
-- Proposal RLS, Saved Items Tables & Permissions
-- ==============================================================================

-- 1. Enable RLS on Proposals, Milestones, Portfolio Items, Events & Versions
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

-- Proposals RLS Policies
DROP POLICY IF EXISTS "Designers and Clients can view relevant proposals" ON public.proposals;
CREATE POLICY "Designers and Clients can view relevant proposals"
    ON public.proposals
    FOR SELECT
    TO authenticated
    USING (
        -- Designer can see their own proposal
        designer_id = (SELECT auth.uid())
        -- Client can see proposals for projects they own
        OR EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = proposals.project_id
              AND p.client_id = (SELECT auth.uid())
        )
        OR public.is_admin()
    );

-- Block direct INSERT/UPDATE/DELETE on proposals (must use SECURITY DEFINER functions)
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

-- 2. Saved Projects Table
CREATE TABLE IF NOT EXISTS public.saved_projects (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, project_id)
);

ALTER TABLE public.saved_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saved projects" ON public.saved_projects;
CREATE POLICY "Users can manage own saved projects"
    ON public.saved_projects
    FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (
        user_id = (SELECT auth.uid())
        -- Cannot save own project
        AND NOT EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = saved_projects.project_id
              AND p.client_id = (SELECT auth.uid())
        )
    );

-- 3. Saved Designers Table
CREATE TABLE IF NOT EXISTS public.saved_designers (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, designer_id),
    CONSTRAINT chk_cannot_save_self CHECK (user_id <> designer_id)
);

ALTER TABLE public.saved_designers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saved designers" ON public.saved_designers;
CREATE POLICY "Users can manage own saved designers"
    ON public.saved_designers
    FOR ALL
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND user_id <> designer_id
        -- Designer must have show_in_search = true
        AND EXISTS (
            SELECT 1 FROM public.designer_profiles dp
            WHERE dp.user_id = saved_designers.designer_id
              AND dp.show_in_search = true
        )
    );

-- 4. Full-Text Search on Public Designer Profiles View
-- Replace or extend public_designer_profiles view to include a generated search tsvector
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
    p.created_at AS member_since,
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

-- 5. Grants for Stored Functions
GRANT EXECUTE ON FUNCTION public.submit_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_proposal_viewed TO authenticated;
GRANT EXECUTE ON FUNCTION public.shortlist_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.proposal_usage TO authenticated;
