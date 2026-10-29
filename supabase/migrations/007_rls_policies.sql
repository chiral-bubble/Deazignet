-- ==============================================================================
-- Migration 007: Row Level Security Policies
-- Deny by default, explicit ownership policies using (SELECT auth.uid()), admin override
-- ==============================================================================

-- 1. PROFILES RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Deny direct inserts: only the system trigger 'on_auth_user_created' creates profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated
    USING (public.is_admin());

-- 2. DESIGNER_PROFILES RLS
ALTER TABLE public.designer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "designer_profiles_select_own" ON public.designer_profiles;
CREATE POLICY "designer_profiles_select_own" ON public.designer_profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "designer_profiles_insert_own" ON public.designer_profiles;
CREATE POLICY "designer_profiles_insert_own" ON public.designer_profiles
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "designer_profiles_update_own" ON public.designer_profiles;
CREATE POLICY "designer_profiles_update_own" ON public.designer_profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "designer_profiles_delete_own" ON public.designer_profiles;
CREATE POLICY "designer_profiles_delete_own" ON public.designer_profiles
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "designer_profiles_admin_all" ON public.designer_profiles;
CREATE POLICY "designer_profiles_admin_all" ON public.designer_profiles
    FOR ALL TO authenticated
    USING (public.is_admin());

-- 3. PORTFOLIO_PROJECTS RLS
ALTER TABLE public.portfolio_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_projects_select_own" ON public.portfolio_projects;
CREATE POLICY "portfolio_projects_select_own" ON public.portfolio_projects
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = designer_id);

DROP POLICY IF EXISTS "portfolio_projects_insert_own" ON public.portfolio_projects;
CREATE POLICY "portfolio_projects_insert_own" ON public.portfolio_projects
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = designer_id);

DROP POLICY IF EXISTS "portfolio_projects_update_own" ON public.portfolio_projects;
CREATE POLICY "portfolio_projects_update_own" ON public.portfolio_projects
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = designer_id)
    WITH CHECK ((SELECT auth.uid()) = designer_id);

DROP POLICY IF EXISTS "portfolio_projects_delete_own" ON public.portfolio_projects;
CREATE POLICY "portfolio_projects_delete_own" ON public.portfolio_projects
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = designer_id);

DROP POLICY IF EXISTS "portfolio_projects_admin_all" ON public.portfolio_projects;
CREATE POLICY "portfolio_projects_admin_all" ON public.portfolio_projects
    FOR ALL TO authenticated
    USING (public.is_admin());

-- 4. PORTFOLIO_IMAGES RLS
ALTER TABLE public.portfolio_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "portfolio_images_select_own" ON public.portfolio_images;
CREATE POLICY "portfolio_images_select_own" ON public.portfolio_images
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.portfolio_projects p
            WHERE p.id = portfolio_project_id
              AND p.designer_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "portfolio_images_insert_own" ON public.portfolio_images;
CREATE POLICY "portfolio_images_insert_own" ON public.portfolio_images
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.portfolio_projects p
            WHERE p.id = portfolio_project_id
              AND p.designer_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "portfolio_images_update_own" ON public.portfolio_images;
CREATE POLICY "portfolio_images_update_own" ON public.portfolio_images
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.portfolio_projects p
            WHERE p.id = portfolio_project_id
              AND p.designer_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.portfolio_projects p
            WHERE p.id = portfolio_project_id
              AND p.designer_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "portfolio_images_delete_own" ON public.portfolio_images;
CREATE POLICY "portfolio_images_delete_own" ON public.portfolio_images
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.portfolio_projects p
            WHERE p.id = portfolio_project_id
              AND p.designer_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "portfolio_images_admin_all" ON public.portfolio_images;
CREATE POLICY "portfolio_images_admin_all" ON public.portfolio_images
    FOR ALL TO authenticated
    USING (public.is_admin());

-- 5. CREDENTIALS RLS
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credentials_select_own" ON public.credentials;
CREATE POLICY "credentials_select_own" ON public.credentials
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = designer_id);

DROP POLICY IF EXISTS "credentials_insert_own" ON public.credentials;
CREATE POLICY "credentials_insert_own" ON public.credentials
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = designer_id
        AND status = 'pending'::public.credential_status
    );

DROP POLICY IF EXISTS "credentials_update_own" ON public.credentials;
CREATE POLICY "credentials_update_own" ON public.credentials
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = designer_id)
    WITH CHECK ((SELECT auth.uid()) = designer_id);

-- Owners can delete only if pending or rejected (verified credentials cannot be deleted without audit)
DROP POLICY IF EXISTS "credentials_delete_own" ON public.credentials;
CREATE POLICY "credentials_delete_own" ON public.credentials
    FOR DELETE TO authenticated
    USING (
        (SELECT auth.uid()) = designer_id
        AND status IN ('pending'::public.credential_status, 'rejected'::public.credential_status)
    );

DROP POLICY IF EXISTS "credentials_admin_all" ON public.credentials;
CREATE POLICY "credentials_admin_all" ON public.credentials
    FOR ALL TO authenticated
    USING (public.is_admin());

