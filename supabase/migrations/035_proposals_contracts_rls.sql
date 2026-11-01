-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - RLS & GRANTS
-- 035_proposals_contracts_rls.sql
-- Row Level Security for Contracts, Signatures, Reviews, Updated Views & Grants
-- ==============================================================================

-- 1. Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 2. Contracts RLS (Only parties and admins can view; immutable to direct writes)
DROP POLICY IF EXISTS "contracts_read_parties" ON public.contracts;
CREATE POLICY "contracts_read_parties"
    ON public.contracts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = contracts.engagement_id
              AND (e.client_id = (SELECT auth.uid()) OR e.designer_id = (SELECT auth.uid()))
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "contracts_deny_direct_write" ON public.contracts;
CREATE POLICY "contracts_deny_direct_write"
    ON public.contracts
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 3. Contract Signatures RLS
DROP POLICY IF EXISTS "contract_signatures_read_parties" ON public.contract_signatures;
CREATE POLICY "contract_signatures_read_parties"
    ON public.contract_signatures
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.contracts c
            JOIN public.engagements e ON e.id = c.engagement_id
            WHERE c.id = contract_signatures.contract_id
              AND (e.client_id = (SELECT auth.uid()) OR e.designer_id = (SELECT auth.uid()))
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "contract_signatures_deny_direct_write" ON public.contract_signatures;
CREATE POLICY "contract_signatures_deny_direct_write"
    ON public.contract_signatures
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 4. Terms Versions (Readable by all authenticated users)
DROP POLICY IF EXISTS "terms_versions_read_all" ON public.contract_terms_versions;
CREATE POLICY "terms_versions_read_all"
    ON public.contract_terms_versions
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. Reviews RLS (Visible reviews readable by all logged-in users; client can insert)
DROP POLICY IF EXISTS "reviews_read_visible" ON public.reviews;
CREATE POLICY "reviews_read_visible"
    ON public.reviews
    FOR SELECT
    TO authenticated
    USING (status = 'visible' OR public.is_admin());

-- 6. Update public_designer_profiles View with Ratings
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;

CREATE OR REPLACE VIEW public.public_designer_profiles
WITH (security_barrier = true) AS
SELECT
    dp.user_id AS designer_id,
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
    dp.hourly_rate,
    dp.show_hourly_rate,
    dp.show_in_search,
    COALESCE(
        (SELECT COUNT(*) > 0 FROM public.credentials c WHERE c.designer_id = dp.user_id AND c.status = 'verified'),
        false
    ) AS verified,
    COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews r WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0.0
    ) AS rating_average,
    COALESCE(
        (SELECT COUNT(*)::INT FROM public.reviews r WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0
    ) AS rating_count,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE would_hire_again = true)::numeric / COUNT(*)) * 100, 0)
         FROM public.reviews r WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        100
    ) AS would_hire_again_percent
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.show_in_search = true;

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- 7. Function Grants
GRANT EXECUTE ON FUNCTION public.get_project_proposals(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compare_proposals(UUID, UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_proposal_question(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_proposal(UUID, public.decline_reason_code, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_proposal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_contract(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sign_contract(UUID, TEXT, public.signature_style_type, UUID, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_contract(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contract(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_contract(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_review(UUID, INT, TEXT, BOOLEAN, INT, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reply_to_review(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_client_dashboard() TO authenticated, service_role;

