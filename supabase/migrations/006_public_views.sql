-- ==============================================================================
-- Migration 006: Public Read Access Views (Security Barrier Views)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VIEW: public_designer_profiles
--
-- SECURITY ARCHITECTURE RATIONALE:
-- - Base tables (profiles, designer_profiles) have RLS denying all non-owner reads.
-- - This view provides safe public access to designer ateliers for the talent search
--   and public profile page without bypassing safety controls.
-- - Private columns (email, phone, private metadata, session data) are strictly EXCLUDED.
-- - 'hourly_rate' is automatically projected as NULL whenever 'show_hourly_rate' is FALSE.
-- - Enforces visibility guard: only returns profiles where 'show_in_search' is TRUE,
--   or where the requesting authenticated user is the owner of the profile.
-- ------------------------------------------------------------------------------

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

COMMENT ON VIEW public.public_designer_profiles IS 
'Safe public view for designer profiles. Strictly excludes private contact data (phone/email) and masks rates based on privacy toggles.';

-- ------------------------------------------------------------------------------
-- 2. VIEW: public_portfolio
--
-- SECURITY ARCHITECTURE RATIONALE:
-- - Allows marketplace visitors and clients to review published architectural projects.
-- - Only displays projects belonging to designers who are discoverable in search
--   or owned by the requesting session.
-- - Includes project metadata and sorted image references.
-- ------------------------------------------------------------------------------

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

COMMENT ON VIEW public.public_portfolio IS 
'Safe public view for portfolio works and media belonging to visible designers.';

-- ------------------------------------------------------------------------------
-- 3. VIEW: public_credentials
--
-- SECURITY ARCHITECTURE RATIONALE:
-- - Exposes verified or pending professional qualifications for public trust.
-- - Masked registration number: displays only the last 3 alphanumeric characters
--   (e.g., •••••••491) to protect the professional from identity impersonation.
-- - Strictly suppresses admin review notes, reviewer user IDs, and timestamps.
-- ------------------------------------------------------------------------------

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

COMMENT ON VIEW public.public_credentials IS 
'Safe public view for credentials with masked registration numbers and zero administrative audit notes.';

-- Grant permissions on views to authenticated and anonymous users
GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;
GRANT SELECT ON public.public_portfolio TO authenticated, anon;
GRANT SELECT ON public.public_credentials TO authenticated, anon;

