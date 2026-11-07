-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PRO MEMBER BADGE & NO VERIFICATION CLAIM
-- 044_pro_member_badge_no_verification.sql
-- Converts verified badge to paid member badge ("Pro member")
-- Credentials stay optional and self-reported; no verification claim
-- ==============================================================================

-- 1. Update plans schema: rename verified_badge to member_badge
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'verified_badge'
    ) THEN
        ALTER TABLE public.plans RENAME COLUMN verified_badge TO member_badge;
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'member_badge'
    ) THEN
        ALTER TABLE public.plans ADD COLUMN member_badge BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- Ensure values: free false, basic true, upgraded true
UPDATE public.plans SET member_badge = FALSE WHERE key = 'free';
UPDATE public.plans SET member_badge = TRUE WHERE key IN ('basic', 'upgraded');

-- 2. Update app_settings
-- Remove verified_badge_requires_paid_plan
DELETE FROM public.app_settings WHERE key = 'verified_badge_requires_paid_plan';

-- Add member_badge_label (default "Pro member") and credential_verification_enabled (default false)
INSERT INTO public.app_settings (key, value) VALUES
('member_badge_label', '"Pro member"'::jsonb),
('credential_verification_enabled', 'false'::jsonb),
('matching_weights', '{"specialization_match": 40, "subcategory_portfolio": 20, "same_city": 15, "same_state": 10, "rating": 10, "completed_projects": 5}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 3. Update public_designer_profiles view
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;

CREATE OR REPLACE VIEW public.public_designer_profiles AS
SELECT
    dp.user_id,
    dp.professional_type,
    dp.title,
    dp.studio_name,
    dp.bio,
    dp.specializations,
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
    -- Member badge: earned strictly by having a paid plan (basic or upgraded)
    (p.plan_key IN ('basic', 'upgraded')) AS member_badge,
    (p.plan_key IN ('basic', 'upgraded')) AS has_member_badge,
    (p.plan_key IN ('basic', 'upgraded')) AS verified, -- backward-compatibility alias for client components
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
    -- Credentials list: self-reported while verification is disabled
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
                    'category', pj.category,
                    'subcategory', pj.subcategory,
                    'cover_image_path', pj.cover_image_path,
                    'featured', pj.featured,
                    'display_order', pj.display_order
                ) ORDER BY pj.display_order ASC
            )
            FROM public.portfolio_projects pj
            WHERE pj.designer_id = dp.user_id
        ),
        '[]'::jsonb
    ) AS portfolio_projects
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.show_in_search = TRUE 
  AND p.plan_key != 'free';

-- 4. Update get_project_designer_suggestions function without verified score
CREATE OR REPLACE FUNCTION public.get_project_designer_suggestions(
    p_project_id UUID,
    p_limit INT DEFAULT 5,
    p_exclude_ids UUID[] DEFAULT ARRAY[]::UUID[]
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
    hourly_rate INT,
    show_hourly_rate BOOLEAN,
    plan_key TEXT,
    rating_avg NUMERIC,
    rating_cnt INT,
    completed_cnt INT,
    is_verified BOOLEAN,
    has_member_badge BOOLEAN,
    match_score INT,
    match_reasons JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project RECORD;
    v_weights JSONB;
    v_cand RECORD;
    v_spec_match INT := 0;
    v_subcat_match INT := 0;
    v_city_match INT := 0;
    v_state_match INT := 0;
    v_rating_match INT := 0;
    v_comp_match INT := 0;
    v_plan_boost INT := 0;
    v_total_score INT := 0;
    v_reasons JSONB;
BEGIN
    SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Load weights from app_settings
    SELECT COALESCE(value, '{}'::jsonb) INTO v_weights 
    FROM public.app_settings 
    WHERE key = 'matching_weights';

    FOR v_cand IN
        SELECT 
            dp.user_id,
            p.full_name,
            p.avatar_path,
            dp.professional_type,
            dp.title,
            dp.studio_name,
            dp.city,
            dp.state,
            dp.years_experience,
            dp.hourly_rate,
            dp.show_hourly_rate,
            p.plan_key,
            COALESCE(r.rating_avg, 0) as rating_avg,
            COALESCE(r.rating_cnt, 0) as rating_cnt,
            COALESCE(cmp.completed_cnt, 0) as completed_cnt,
            (p.plan_key IN ('basic', 'upgraded')) as is_member
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
        IF v_cand.professional_type = v_project.category OR v_project.category = ANY(COALESCE(v_cand.professional_type, ARRAY[]::text[])) THEN
            v_spec_match := COALESCE((v_weights->>'specialization_match')::int, 40);
            v_total_score := v_total_score + v_spec_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'category', 'text', 'Specialization matches project category');
        END IF;

        -- 2. Location matches
        IF v_cand.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(v_cand.city) = LOWER(v_project.city) THEN
            v_city_match := COALESCE((v_weights->>'same_city')::int, 15);
            v_total_score := v_total_score + v_city_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in same city (' || v_cand.city || ')');
        ELSIF v_cand.state IS NOT NULL AND v_project.state IS NOT NULL AND LOWER(v_cand.state) = LOWER(v_project.state) THEN
            v_state_match := COALESCE((v_weights->>'same_state')::int, 10);
            v_total_score := v_total_score + v_state_match;
            v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in same state (' || v_cand.state || ')');
        END IF;

        -- 3. Plan Priority Boost (Upgraded: +20, Basic: +10, Free: +0)
        IF v_cand.plan_key = 'upgraded' THEN
            v_plan_boost := 20;
            v_total_score := v_total_score + v_plan_boost;
            v_reasons := v_reasons || jsonb_build_object('type', 'plan_boost', 'text', 'Upgraded studio membership boost (+20)');
        ELSIF v_cand.plan_key = 'basic' THEN
            v_plan_boost := 10;
            v_total_score := v_total_score + v_plan_boost;
            v_reasons := v_reasons || jsonb_build_object('type', 'plan_boost', 'text', 'Basic studio membership boost (+10)');
        END IF;

        -- 4. Rating score
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
        completed_cnt := v_cand.completed_cnt;
        is_verified := v_cand.is_member;
        has_member_badge := v_cand.is_member;
        match_score := LEAST(100, v_total_score);
        match_reasons := v_reasons;
        RETURN NEXT;
    END LOOP;
END;
$$;

