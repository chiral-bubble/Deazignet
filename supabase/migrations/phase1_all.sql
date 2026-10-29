-- ==============================================================================
-- DEZIGNET PHASE 1: COMPLETE CONSOLIDATED MIGRATIONS
-- Applies Migrations 001 through 007 in correct dependency sequence
-- ==============================================================================

-- 1. Create custom ENUMs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('client', 'designer', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'professional_type') THEN
        CREATE TYPE public.professional_type AS ENUM (
            'architect',
            'interior_designer',
            'landscape_architect',
            'engineer'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_status') THEN
        CREATE TYPE public.credential_status AS ENUM ('pending', 'verified', 'rejected');
    END IF;
END $$;

-- 2. Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Profiles Table (1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'client',
    full_name TEXT NOT NULL,
    avatar_path TEXT,
    location TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Admin check helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'::public.user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    chosen_role TEXT;
    assigned_role public.user_role;
    user_name TEXT;
BEGIN
    chosen_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'client'));
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    IF chosen_role = 'designer' THEN
        assigned_role := 'designer'::public.user_role;
    ELSE
        assigned_role := 'client'::public.user_role;
    END IF;

    INSERT INTO public.profiles (id, role, full_name)
    VALUES (NEW.id, assigned_role, user_name)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Trigger to prevent users from updating their own role
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Users cannot alter account role. Contact support.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

-- 7. Designer Profiles Table
CREATE TABLE IF NOT EXISTS public.designer_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    professional_type public.professional_type NOT NULL DEFAULT 'architect',
    title TEXT,
    studio_name TEXT,
    bio VARCHAR(600),
    specializations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    languages TEXT[] NOT NULL DEFAULT ARRAY['English']::TEXT[],
    years_experience INTEGER NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    hourly_rate NUMERIC(10, 2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
    show_hourly_rate BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    availability_note TEXT,
    show_in_search BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_designer_profiles_type ON public.designer_profiles(professional_type);
CREATE INDEX IF NOT EXISTS idx_designer_profiles_search ON public.designer_profiles(show_in_search, is_available);

DROP TRIGGER IF EXISTS trg_designer_profiles_updated_at ON public.designer_profiles;
CREATE TRIGGER trg_designer_profiles_updated_at
    BEFORE UPDATE ON public.designer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Auto-init designer_profiles
CREATE OR REPLACE FUNCTION public.handle_designer_profile_init()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'designer'::public.user_role THEN
        INSERT INTO public.designer_profiles (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_designer_profile_init ON public.profiles;
CREATE TRIGGER on_designer_profile_init
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_designer_profile_init();

-- 8. Portfolio Projects & Images
CREATE TABLE IF NOT EXISTS public.portfolio_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    year INTEGER CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
    category TEXT,
    location TEXT,
    description TEXT,
    role TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    cover_image_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_designer ON public.portfolio_projects(designer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_sort ON public.portfolio_projects(designer_id, sort_order);

DROP TRIGGER IF EXISTS trg_portfolio_projects_updated_at ON public.portfolio_projects;
CREATE TRIGGER trg_portfolio_projects_updated_at
    BEFORE UPDATE ON public.portfolio_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.portfolio_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_project_id UUID NOT NULL REFERENCES public.portfolio_projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_images_project ON public.portfolio_images(portfolio_project_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_images_sort ON public.portfolio_images(portfolio_project_id, sort_order);

DROP TRIGGER IF EXISTS trg_portfolio_images_updated_at ON public.portfolio_images;
CREATE TRIGGER trg_portfolio_images_updated_at
    BEFORE UPDATE ON public.portfolio_images
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 9. Credentials Table
CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    number TEXT NOT NULL,
    state_region TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1950 AND year <= 2100),
    certificate_path TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credentials_designer ON public.credentials(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(designer_id, status);

DROP TRIGGER IF EXISTS trg_credentials_updated_at ON public.credentials;
CREATE TRIGGER trg_credentials_updated_at
    BEFORE UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: protect credential review fields
CREATE OR REPLACE FUNCTION public.protect_credential_review_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status != 'verified' THEN
            RAISE EXCEPTION 'Only administrators can update credential review status.';
        END IF;

        IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
           NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
           NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
            RAISE EXCEPTION 'Only administrators can modify verification audit records.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_credential_review_fields ON public.credentials;
CREATE TRIGGER trg_protect_credential_review_fields
    BEFORE UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_credential_review_fields();

-- Trigger: reset verified credential on edit
CREATE OR REPLACE FUNCTION public.reset_verified_credential_on_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'verified'::public.credential_status THEN
        IF (NEW.body IS DISTINCT FROM OLD.body) OR
           (NEW.number IS DISTINCT FROM OLD.number) OR
           (NEW.state_region IS DISTINCT FROM OLD.state_region) OR
           (NEW.year IS DISTINCT FROM OLD.year) OR
           (NEW.certificate_path IS DISTINCT FROM OLD.certificate_path) THEN
            NEW.status := 'pending'::public.credential_status;
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
            NEW.rejection_reason := NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_verified_credential ON public.credentials;
CREATE TRIGGER trg_reset_verified_credential
    BEFORE UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.reset_verified_credential_on_edit();

-- 10. Profile Completeness Function
CREATE OR REPLACE FUNCTION public.get_profile_completeness(p_designer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_has_photo BOOLEAN := FALSE;
    v_has_bio BOOLEAN := FALSE;
    v_has_specialization BOOLEAN := FALSE;
    v_portfolio_count INTEGER := 0;
    v_credential_count INTEGER := 0;
    v_completed_count INTEGER := 0;
    v_score INTEGER := 0;
    v_checklist JSONB;
BEGIN
    SELECT (avatar_path IS NOT NULL AND length(trim(avatar_path)) > 0)
    INTO v_has_photo
    FROM public.profiles
    WHERE id = p_designer_id;

    SELECT 
        (bio IS NOT NULL AND length(trim(bio)) >= 50),
        (title IS NOT NULL AND length(trim(title)) > 0 AND cardinality(specializations) > 0)
    INTO v_has_bio, v_has_specialization
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    SELECT COUNT(*) INTO v_portfolio_count
    FROM public.portfolio_projects
    WHERE designer_id = p_designer_id;

    SELECT COUNT(*) INTO v_credential_count
    FROM public.credentials
    WHERE designer_id = p_designer_id;

    IF COALESCE(v_has_photo, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_bio, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_specialization, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF v_portfolio_count >= 3 THEN v_completed_count := v_completed_count + 1; END IF;
    IF v_credential_count >= 1 THEN v_completed_count := v_completed_count + 1; END IF;

    v_score := ROUND((v_completed_count::NUMERIC / 5.0) * 100);

    v_checklist := jsonb_build_array(
        jsonb_build_object(
            'id', 'photo',
            'label', 'Profile photo',
            'tab', 'profile',
            'completed', COALESCE(v_has_photo, FALSE)
        ),
        jsonb_build_object(
            'id', 'bio',
            'label', 'About & bio (min 50 characters)',
            'tab', 'profile',
            'completed', COALESCE(v_has_bio, FALSE)
        ),
        jsonb_build_object(
            'id', 'specialization',
            'label', 'Specialization & title',
            'tab', 'profile',
            'completed', COALESCE(v_has_specialization, FALSE)
        ),
        jsonb_build_object(
            'id', 'portfolio',
            'label', 'Portfolio (min 3 projects)',
            'tab', 'portfolio',
            'completed', (v_portfolio_count >= 3)
        ),
        jsonb_build_object(
            'id', 'credentials',
            'label', 'Professional registration / credentials',
            'tab', 'credentials',
            'completed', (v_credential_count >= 1)
        )
    );

    RETURN jsonb_build_object(
        'score', v_score,
        'checklist', v_checklist
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 11. Public Read Views
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;
CREATE OR REPLACE VIEW public.public_designer_profiles
WITH (security_barrier = TRUE) AS
SELECT
    d.user_id AS designer_id,
    p.full_name,
    p.avatar_path,
    p.location,
    d.title,
    d.studio_name,
    d.bio,
    d.professional_type,
    d.specializations,
    d.languages,
    d.years_experience,
    d.is_available,
    d.availability_note,
    TO_CHAR(p.created_at, 'Month YYYY') AS member_since,
    CASE 
        WHEN d.show_hourly_rate = TRUE THEN d.hourly_rate 
        ELSE NULL 
    END AS hourly_rate,
    d.show_hourly_rate,
    d.show_in_search,
    EXISTS (
        SELECT 1 
        FROM public.credentials c 
        WHERE c.designer_id = d.user_id 
          AND c.status = 'verified'::public.credential_status
    ) AS verified
FROM public.designer_profiles d
JOIN public.profiles p ON p.id = d.user_id
WHERE (d.show_in_search = TRUE) 
   OR (d.user_id = (SELECT auth.uid()));

DROP VIEW IF EXISTS public.public_portfolio CASCADE;
CREATE OR REPLACE VIEW public.public_portfolio
WITH (security_barrier = TRUE) AS
SELECT
    proj.id AS project_id,
    proj.designer_id,
    proj.title,
    proj.year,
    proj.category,
    proj.location,
    proj.description,
    proj.role,
    proj.sort_order,
    proj.cover_image_path,
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', img.id,
                    'path', img.path,
                    'sort_order', img.sort_order
                ) ORDER BY img.sort_order ASC
            )
            FROM public.portfolio_images img
            WHERE img.portfolio_project_id = proj.id
        ),
        '[]'::jsonb
    ) AS images
FROM public.portfolio_projects proj
JOIN public.designer_profiles d ON d.user_id = proj.designer_id
WHERE (d.show_in_search = TRUE) 
   OR (d.user_id = (SELECT auth.uid()));

DROP VIEW IF EXISTS public.public_credentials CASCADE;
CREATE OR REPLACE VIEW public.public_credentials
WITH (security_barrier = TRUE) AS
SELECT
    cred.id,
    cred.designer_id,
    cred.body,
    cred.state_region,
    cred.year,
    cred.status,
    CASE 
        WHEN length(cred.number) > 3 THEN '••••' || right(cred.number, 3)
        ELSE '••••'
    END AS masked_number,
    cred.certificate_path
FROM public.credentials cred
JOIN public.designer_profiles d ON d.user_id = cred.designer_id
WHERE (d.show_in_search = TRUE) 
   OR (d.user_id = (SELECT auth.uid()));

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;
GRANT SELECT ON public.public_portfolio TO authenticated, anon;
GRANT SELECT ON public.public_credentials TO authenticated, anon;

-- 12. Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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
