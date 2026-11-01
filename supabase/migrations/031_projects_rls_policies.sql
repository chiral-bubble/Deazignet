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

