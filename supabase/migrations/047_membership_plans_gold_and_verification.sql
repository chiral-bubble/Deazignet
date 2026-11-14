-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - MEMBERSHIP PLANS GOLD & VERIFICATION ALIGNMENT
-- 047_membership_plans_gold_and_verification.sql
-- Aligns membership plans, profile tiers, direct invitations, and manual
-- credential verification with the product brief:
-- 1. Rename 'upgraded' to 'gold' everywhere ($0, $19/mo, $49/mo)
-- 2. Proposal limits: Free = 3, Basic = 15, Gold = null (unlimited)
-- 3. Portfolio limits: Free = 3, Basic = 12, Gold = null (unlimited)
-- 4. Single images_per_portfolio_project admin setting (default 10)
-- 5. Entitlements per plan (directory_listing, public_profile, portfolio_enabled,
--    direct_invitations, verification_eligible, search_priority, analytics_level,
--    profile_page_level, studio_url)
-- 6. Complimentary plan grants & get_effective_plan()
-- 7. Free designers visible in search; direct invitations require entitlement
-- 8. Profile completeness uniform across plans (no credential required)
-- 9. Priority placement (Gold only: matching_plan_boost free 0, basic 0, gold 15)
-- 10. Manual credential verification with state & date; remove paid member badge
-- 11. Proposal credits calendar month reset, unlimited daily cap (25), duplicate flagging
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATE PLANS TABLE SCHEMA & RENAME UPGRADED TO GOLD
-- ------------------------------------------------------------------------------

-- Update plans key check constraint if it exists
DO $$ BEGIN
    ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_key_check;
    ALTER TABLE public.plans ADD CONSTRAINT plans_key_check CHECK (key IN ('free', 'basic', 'gold'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add new entitlement and limit columns to public.plans
ALTER TABLE public.plans
    ADD COLUMN IF NOT EXISTS portfolio_project_limit INT,
    ADD COLUMN IF NOT EXISTS verification_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS search_priority BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS analytics_level TEXT NOT NULL DEFAULT 'basic' CHECK (analytics_level IN ('basic', 'profile_views', 'full')),
    ADD COLUMN IF NOT EXISTS profile_page_level TEXT NOT NULL DEFAULT 'listing' CHECK (profile_page_level IN ('listing', 'portfolio', 'enhanced'));

-- Rename 'upgraded' plan row to 'gold' if exists
UPDATE public.plans
SET key = 'gold', name = 'Gold'
WHERE key = 'upgraded';

-- Ensure all 3 plans are properly populated with new prices, limits, and entitlements
INSERT INTO public.plans (
    key, name, monthly_price_cents, yearly_price_cents,
    monthly_proposal_limit, portfolio_project_limit, images_per_portfolio_project,
    directory_listing, public_profile, portfolio_enabled,
    direct_invitations, verification_eligible, search_priority,
    analytics_level, profile_page_level, studio_url, sort_order
) VALUES
(
    'free', 'Free', 0, 0,
    3, 3, 10,
    TRUE, TRUE, TRUE,
    FALSE, TRUE, FALSE,
    'basic', 'listing', FALSE, 1
),
(
    'basic', 'Basic', 1900, 19000,
    15, 12, 10,
    TRUE, TRUE, TRUE,
    TRUE, TRUE, FALSE,
    'profile_views', 'portfolio', FALSE, 2
),
(
    'gold', 'Gold', 4900, 49000,
    NULL, NULL, 10,
    TRUE, TRUE, TRUE,
    TRUE, TRUE, TRUE,
    'full', 'enhanced', TRUE, 3
)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    yearly_price_cents = EXCLUDED.yearly_price_cents,
    monthly_proposal_limit = EXCLUDED.monthly_proposal_limit,
    portfolio_project_limit = EXCLUDED.portfolio_project_limit,
    images_per_portfolio_project = EXCLUDED.images_per_portfolio_project,
    directory_listing = EXCLUDED.directory_listing,
    public_profile = EXCLUDED.public_profile,
    portfolio_enabled = EXCLUDED.portfolio_enabled,
    direct_invitations = EXCLUDED.direct_invitations,
    verification_eligible = EXCLUDED.verification_eligible,
    search_priority = EXCLUDED.search_priority,
    analytics_level = EXCLUDED.analytics_level,
    profile_page_level = EXCLUDED.profile_page_level,
    studio_url = EXCLUDED.studio_url,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Drop member_badge from plans if present (no longer a paid plan badge)
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'plans' AND column_name = 'member_badge'
    ) THEN
        ALTER TABLE public.plans ALTER COLUMN member_badge DROP NOT NULL;
        UPDATE public.plans SET member_badge = FALSE;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. MIGRATE EXISTING UPGRADED REFERENCES IN DATABASE TABLES
-- ------------------------------------------------------------------------------

-- Update plan_fee_tiers: change upgraded to gold
UPDATE public.plan_fee_tiers SET plan_key = 'gold' WHERE plan_key = 'upgraded';

-- If plan_fee_tiers constraint exists, update it
DO $$ BEGIN
    ALTER TABLE public.plan_fee_tiers DROP CONSTRAINT IF EXISTS plan_fee_tiers_plan_key_fkey;
    ALTER TABLE public.plan_fee_tiers ADD CONSTRAINT plan_fee_tiers_plan_key_fkey
        FOREIGN KEY (plan_key) REFERENCES public.plans(key) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Update profiles table
UPDATE public.profiles SET plan_key = 'gold' WHERE plan_key = 'upgraded';

-- Update designer_profiles table
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'designer_profiles' AND column_name = 'plan'
    ) THEN
        -- If plan is an enum or text, handle casting
        BEGIN
            UPDATE public.designer_profiles SET plan = 'gold'::text::public.plan_tier WHERE plan::text = 'upgraded';
        EXCEPTION WHEN OTHERS THEN
            UPDATE public.designer_profiles SET plan = 'gold' WHERE plan::text = 'upgraded';
        END;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 3. APP SETTINGS UPDATES
-- ------------------------------------------------------------------------------

DELETE FROM public.app_settings WHERE key IN ('member_badge_label', 'verified_badge_requires_paid_plan');

INSERT INTO public.app_settings (key, value) VALUES
('annual_billing_enabled', 'false'::jsonb),
('images_per_portfolio_project', '10'::jsonb),
('matching_plan_boost', '{"free": 0, "basic": 0, "gold": 15}'::jsonb),
('credential_verification_enabled', 'true'::jsonb),
('verification_mode', '"manual"'::jsonb),
('unlimited_daily_proposal_cap', '25'::jsonb),
('proposal_credit_reset', '"calendar_month"'::jsonb),
('profile_completeness_min_portfolio_projects', '1'::jsonb),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 20, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ------------------------------------------------------------------------------
-- 4. COMPLIMENTARY PLAN GRANTS TABLE & GET_EFFECTIVE_PLAN FUNCTION
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.complimentary_plan_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_key TEXT NOT NULL CHECK (plan_key IN ('free', 'basic', 'gold')),
    reason TEXT,
    expires_at TIMESTAMPTZ, -- NULL means permanent / until revoked
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_grants_user ON public.complimentary_plan_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_grants_expires ON public.complimentary_plan_grants(expires_at);

ALTER TABLE public.complimentary_plan_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own complimentary grants" ON public.complimentary_plan_grants;
CREATE POLICY "Users can read own complimentary grants" ON public.complimentary_plan_grants
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage complimentary grants" ON public.complimentary_plan_grants;
CREATE POLICY "Admins manage complimentary grants" ON public.complimentary_plan_grants
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Get effective plan: highest of paid subscription and active complimentary grant
CREATE OR REPLACE FUNCTION public.get_effective_plan(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_paid_plan TEXT := 'free';
    v_grant_plan TEXT := NULL;
    v_paid_rank INT := 1;
    v_grant_rank INT := 0;
BEGIN
    -- 1. Fetch paid plan
    SELECT COALESCE(plan_key, 'free') INTO v_paid_plan
    FROM public.profiles
    WHERE id = p_user_id;

    IF v_paid_plan = 'gold' THEN v_paid_rank := 3;
    ELSIF v_paid_plan = 'basic' THEN v_paid_rank := 2;
    ELSE v_paid_rank := 1; v_paid_plan := 'free';
    END IF;

    -- 2. Fetch highest active complimentary grant
    SELECT plan_key INTO v_grant_plan
    FROM public.complimentary_plan_grants
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY 
        CASE plan_key 
            WHEN 'gold' THEN 3
            WHEN 'basic' THEN 2
            ELSE 1
        END DESC
    LIMIT 1;

    IF v_grant_plan = 'gold' THEN v_grant_rank := 3;
    ELSIF v_grant_plan = 'basic' THEN v_grant_rank := 2;
    ELSIF v_grant_plan = 'free' THEN v_grant_rank := 1;
    ELSE v_grant_rank := 0;
    END IF;

    -- Return highest
    IF v_grant_rank > v_paid_rank THEN
        RETURN v_grant_plan;
    ELSE
        RETURN v_paid_plan;
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. PORTFOLIO CASE STUDY COLUMNS & LIMIT ENFORCEMENT TRIGGER
-- ------------------------------------------------------------------------------

-- Add case-study sections to portfolio projects (Gold enhanced profile feature)
ALTER TABLE public.portfolio_projects
    ADD COLUMN IF NOT EXISTS challenge TEXT,
    ADD COLUMN IF NOT EXISTS approach TEXT,
    ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Enforce portfolio_project_limit in database with typed error plan_portfolio_limit
CREATE OR REPLACE FUNCTION public.check_portfolio_project_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eff_plan TEXT;
    v_limit INT;
    v_current_count INT;
BEGIN
    -- Determine effective plan
    v_eff_plan := public.get_effective_plan(NEW.designer_id);

    -- Fetch limit for this plan
    SELECT portfolio_project_limit INTO v_limit
    FROM public.plans
    WHERE key = v_eff_plan;

    -- NULL limit means unlimited (e.g. Gold)
    IF v_limit IS NOT NULL THEN
        SELECT COUNT(*)::INT INTO v_current_count
        FROM public.portfolio_projects
        WHERE designer_id = NEW.designer_id;

        IF v_current_count >= v_limit THEN
            RAISE EXCEPTION 'plan_portfolio_limit'
                USING ERRCODE = '22023',
                      HINT = 'Your current plan allows up to ' || v_limit || ' portfolio projects. Upgrade to add more.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_portfolio_project_limit ON public.portfolio_projects;
CREATE TRIGGER trg_check_portfolio_project_limit
    BEFORE INSERT ON public.portfolio_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.check_portfolio_project_limit();

-- ------------------------------------------------------------------------------
-- 6. PUBLIC DESIGNER PROFILES VIEW (FREE DESIGNERS VISIBLE, PROJECT LIMITS ENFORCED)
-- ------------------------------------------------------------------------------

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
    public.get_effective_plan(dp.user_id) AS plan_key,
    -- Credential-based verified status (NOT a paid plan badge)
    COALESCE(
        (SELECT COUNT(*) > 0
         FROM public.credentials c
         WHERE c.designer_id = dp.user_id
           AND c.status = 'verified'
           AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)),
        FALSE
    ) AS is_verified,
    COALESCE(
        (SELECT COUNT(*) > 0
         FROM public.credentials c
         WHERE c.designer_id = dp.user_id
           AND c.status = 'verified'
           AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)),
        FALSE
    ) AS verified,
    -- Search priority placement marker (Gold only)
    (public.get_effective_plan(dp.user_id) = 'gold') AS is_promoted,
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
    -- Credentials list: "Verified: [State], [Date]" if approved, else "Self-reported"
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
                        WHEN c.status = 'verified' THEN 'Verified: ' || COALESCE(c.issuing_state, 'US') || ', ' || TO_CHAR(COALESCE(c.verified_at, c.updated_at, CURRENT_DATE), 'MM/DD/YYYY')
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
    -- Portfolio projects limited by plan's portfolio_project_limit (hidden by sort_order on downgrade)
    COALESCE(
        (
            WITH ranked_projects AS (
                SELECT 
                    pj.*,
                    ROW_NUMBER() OVER (PARTITION BY pj.designer_id ORDER BY pj.sort_order ASC, pj.created_at ASC) as rk
                FROM public.portfolio_projects pj
                WHERE pj.designer_id = dp.user_id
            )
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', rp.id,
                    'title', rp.title,
                    'category', rp.category,
                    'subcategory', rp.subcategory,
                    'cover_image_path', rp.cover_image_path,
                    'featured', rp.featured,
                    'sort_order', rp.sort_order,
                    'challenge', rp.challenge,
                    'approach', rp.approach,
                    'outcome', rp.outcome
                ) ORDER BY rp.sort_order ASC
            )
            FROM ranked_projects rp
            CROSS JOIN public.plans pl
            WHERE pl.key = public.get_effective_plan(dp.user_id)
              AND (pl.portfolio_project_limit IS NULL OR rp.rk <= pl.portfolio_project_limit)
        ),
        '[]'::jsonb
    ) AS portfolio_projects
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.show_in_search = TRUE;

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 7. DIRECT INVITATIONS ENFORCEMENT & SUGGESTED DESIGNERS
-- ------------------------------------------------------------------------------

-- Update invite_designer function: rejects without direct_invitations with typed error 'invitations_unavailable'
CREATE OR REPLACE FUNCTION public.invite_designer(
    p_project_id UUID,
    p_designer_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id UUID := auth.uid();
    v_project RECORD;
    v_designer RECORD;
    v_eff_plan TEXT;
    v_has_direct_invites BOOLEAN;
    v_max_per_project INT;
    v_max_per_client_day INT;
    v_expiry_days INT;
    v_proj_inv_count INT;
    v_daily_inv_count INT;
    v_new_inv_id UUID;
BEGIN
    -- 1. Verify project ownership and state
    SELECT id, client_id, status, title, proposal_deadline INTO v_project
    FROM public.projects
    WHERE id = p_project_id;

    IF v_project IS NULL OR (v_project.client_id != v_client_id AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'project_not_found' USING ERRCODE = '42501';
    END IF;

    IF v_project.status::text NOT IN ('open', 'published') THEN
        RAISE EXCEPTION 'project_not_open' USING ERRCODE = '22023';
    END IF;

    IF v_project.proposal_deadline IS NOT NULL AND v_project.proposal_deadline < CURRENT_DATE THEN
        RAISE EXCEPTION 'project_not_open' USING ERRCODE = '22023';
    END IF;

    -- 2. Verify designer eligibility and effective plan
    SELECT dp.user_id, dp.is_available, dp.show_in_search, dp.accepts_invitations, p.role
    INTO v_designer
    FROM public.designer_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    WHERE dp.user_id = p_designer_id;

    IF v_designer IS NULL OR v_designer.role != 'designer' THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
    END IF;

    v_eff_plan := public.get_effective_plan(p_designer_id);

    SELECT direct_invitations INTO v_has_direct_invites
    FROM public.plans
    WHERE key = v_eff_plan;

    -- Direct invitations require direct_invitations on designer's effective plan
    IF NOT COALESCE(v_has_direct_invites, FALSE) THEN
        RAISE EXCEPTION 'invitations_unavailable' USING ERRCODE = '22023';
    END IF;

    -- Availability and settings check
    IF NOT (v_designer.show_in_search = true AND v_designer.is_available = true) THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
    END IF;

    IF v_designer.accepts_invitations = false THEN
        RAISE EXCEPTION 'invitations_off' USING ERRCODE = '22023';
    END IF;

    -- 3. Check for existing proposal or active invitation
    IF EXISTS (
        SELECT 1 FROM public.proposals 
        WHERE project_id = p_project_id AND designer_id = p_designer_id AND status != 'withdrawn'
    ) THEN
        RAISE EXCEPTION 'already_proposed' USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.project_invitations 
        WHERE project_id = p_project_id AND designer_id = p_designer_id 
          AND status IN ('sent', 'viewed')
    ) THEN
        RAISE EXCEPTION 'already_invited' USING ERRCODE = '23505';
    END IF;

    -- 4. Check limits
    SELECT COALESCE(value::int, 10) INTO v_max_per_project 
    FROM public.app_settings WHERE key = 'invitations_per_project_max';
    
    SELECT COALESCE(value::int, 20) INTO v_max_per_client_day 
    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';

    SELECT COALESCE(value::int, 14) INTO v_expiry_days 
    FROM public.app_settings WHERE key = 'invitation_expiry_days';

    SELECT COUNT(*) INTO v_proj_inv_count
    FROM public.project_invitations
    WHERE project_id = p_project_id AND status NOT IN ('expired', 'withdrawn', 'declined');

    IF v_proj_inv_count >= v_max_per_project THEN
        RAISE EXCEPTION 'limit_reached' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_daily_inv_count
    FROM public.project_invitations
    WHERE client_id = v_client_id AND created_at >= CURRENT_DATE;

    IF v_daily_inv_count >= v_max_per_client_day THEN
        RAISE EXCEPTION 'limit_reached' USING ERRCODE = '22023';
    END IF;

    -- 5. Insert invitation
    INSERT INTO public.project_invitations (
        project_id, client_id, designer_id, message, expires_at
    ) VALUES (
        p_project_id, v_client_id, p_designer_id, TRIM(p_message),
        NOW() + (v_expiry_days || ' days')::INTERVAL
    )
    RETURNING id INTO v_new_inv_id;

    -- 6. Send notification
    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',
        jsonb_build_object(
            'invitation_id', v_new_inv_id,
            'project_id', p_project_id,
            'project_title', v_project.title
        ),
        '/projects/' || p_project_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', v_new_inv_id
    );
END;
$$;

-- Update suggest_designers: ONLY include designers who can be invited (Basic and Gold)
CREATE OR REPLACE FUNCTION public.suggest_designers(
    p_project_id UUID,
    p_limit INT DEFAULT 6,
    p_exclude_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project RECORD;
    v_weights JSONB;
    v_plan_boosts JSONB;
    v_max_active INT;
    v_require_state_license BOOLEAN;
    v_new_boost INT;
    v_results JSONB := '[]'::jsonb;
    v_cand RECORD;
BEGIN
    SELECT p.*, c.name AS category_name
    INTO v_project
    FROM public.projects p
    LEFT JOIN public.categories c ON c.id::text = p.category OR c.name = p.category
    WHERE p.id = p_project_id;

    IF v_project IS NULL THEN
        RAISE EXCEPTION 'project_not_found';
    END IF;

    IF v_project.client_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(value::jsonb, '{"specialization_match":30,"subcategory_portfolio":10,"state_license":20,"same_city":15,"same_state":10,"verified":10,"rating":10,"completed_projects":5}'::jsonb)
    INTO v_weights FROM public.app_settings WHERE key = 'matching_weights';

    SELECT COALESCE(value::jsonb, '{"free":0,"basic":0,"gold":15}'::jsonb)
    INTO v_plan_boosts FROM public.app_settings WHERE key = 'matching_plan_boost';

    SELECT COALESCE(value::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';
    SELECT COALESCE(value::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';
    SELECT COALESCE(value::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';

    FOR v_cand IN
        WITH candidate_pool AS (
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
                public.get_effective_plan(dp.user_id) AS plan_key,
                p.created_at AS member_since,
                COALESCE((
                    SELECT ROUND(AVG(r.rating)::numeric, 1) 
                    FROM public.reviews r 
                    WHERE r.designer_id = dp.user_id AND r.status = 'visible'
                ), 0.0) AS rating_avg,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.reviews r 
                    WHERE r.designer_id = dp.user_id AND r.status = 'visible'
                ), 0) AS rating_cnt,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.contracts c 
                    WHERE c.designer_id = dp.user_id AND c.status = 'completed'
                ), 0) AS completed_cnt,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.contracts c 
                    WHERE c.designer_id = dp.user_id AND c.status IN ('active', 'in_progress', 'signed')
                ), 0) AS active_cnt,
                EXISTS (
                    SELECT 1 FROM public.credentials cr 
                    WHERE cr.designer_id = dp.user_id 
                      AND cr.status = 'verified' 
                      AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                ) AS is_verified,
                EXISTS (
                    SELECT 1 FROM public.credentials cr 
                    WHERE cr.designer_id = dp.user_id 
                      AND cr.issuing_state = v_project.state
                      AND cr.status = 'verified' 
                      AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                ) AS has_state_license,
                (v_project.category_name = ANY(dp.specializations) OR v_project.category = ANY(dp.specializations)) AS matches_category,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.portfolio_projects pp 
                    WHERE pp.designer_id = dp.user_id 
                      AND pp.subcategory = v_project.subcategory
                ), 0) AS subcategory_portfolio_count
            FROM public.designer_profiles dp
            JOIN public.profiles p ON p.id = dp.user_id
            JOIN public.plans pl ON pl.key = public.get_effective_plan(dp.user_id)
            WHERE p.role = 'designer'
              AND pl.direct_invitations = true -- ONLY designers who can be invited (Basic and Gold)
              AND dp.show_in_search = true
              AND dp.is_available = true
              AND dp.accepts_invitations = true
              AND dp.bio IS NOT NULL
              AND dp.user_id != v_project.client_id
              AND dp.user_id != ALL(COALESCE(p_exclude_ids, ARRAY[]::UUID[]))
              AND NOT EXISTS (
                  SELECT 1 FROM public.proposals prop 
                  WHERE prop.project_id = p_project_id 
                    AND prop.designer_id = dp.user_id 
                    AND prop.status != 'withdrawn'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status IN ('sent', 'viewed', 'declined')
              )
        ),
        scored_candidates AS (
            SELECT 
                cp.*,
                (
                    (CASE WHEN cp.matches_category THEN COALESCE((v_weights->>'specialization_match')::int, 30) ELSE 0 END)
                    + LEAST(cp.subcategory_portfolio_count * COALESCE((v_weights->>'subcategory_portfolio')::int, 10), 20)
                    + (CASE WHEN cp.has_state_license THEN COALESCE((v_weights->>'state_license')::int, 20) ELSE 0 END)
                    + (CASE 
                        WHEN cp.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(cp.city) = LOWER(v_project.city) THEN COALESCE((v_weights->>'same_city')::int, 15)
                        WHEN cp.state IS NOT NULL AND v_project.state IS NOT NULL AND cp.state = v_project.state THEN COALESCE((v_weights->>'same_state')::int, 10)
                        ELSE 0 
                      END)
                    -- Restored verified score (+10)
                    + (CASE WHEN cp.is_verified THEN COALESCE((v_weights->>'verified')::int, 10) ELSE 0 END)
                    + (CASE WHEN cp.rating_cnt >= 3 THEN ROUND((cp.rating_avg / 5.0) * COALESCE((v_weights->>'rating')::int, 10)) ELSE 0 END)
                    + LEAST(ROUND((cp.completed_cnt::numeric / 10.0) * COALESCE((v_weights->>'completed_projects')::int, 5)), 5)
                    + (CASE WHEN cp.member_since >= NOW() - INTERVAL '90 days' THEN v_new_boost ELSE 0 END)
                    -- Plan boost (Gold 15, Basic 0, Free 0)
                    + COALESCE((v_plan_boosts->>cp.plan_key)::int, 0)
                )::int AS match_score,
                md5(p_project_id::text || CURRENT_DATE::text || cp.user_id::text) AS daily_hash
            FROM candidate_pool cp
            WHERE cp.active_cnt < v_max_active
              AND (NOT v_require_state_license OR cp.has_state_license = true)
        )
        SELECT * FROM scored_candidates
        ORDER BY match_score DESC, daily_hash ASC
        LIMIT p_limit
    LOOP
        DECLARE
            v_reasons JSONB := '[]'::jsonb;
        BEGIN
            IF v_cand.matches_category THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'category', 'text', 'Specializes in ' || COALESCE(v_project.category_name, v_project.category));
            END IF;
            IF v_cand.is_verified THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'verified', 'text', 'Verified professional credentials (+10)');
            END IF;
            IF v_cand.plan_key = 'gold' THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'plan_boost', 'text', 'Promoted Gold placement (+15)');
            END IF;

            v_results := v_results || jsonb_build_object(
                'designer_id', v_cand.user_id,
                'full_name', v_cand.full_name,
                'avatar_path', v_cand.avatar_path,
                'discipline', v_cand.professional_type,
                'title', v_cand.title,
                'studio_name', v_cand.studio_name,
                'city', v_cand.city,
                'state', v_cand.state,
                'years_experience', v_cand.years_experience,
                'hourly_rate', v_cand.hourly_rate,
                'plan_key', v_cand.plan_key,
                'is_promoted', (v_cand.plan_key = 'gold'),
                'is_verified', v_cand.is_verified,
                'rating_average', v_cand.rating_avg,
                'rating_count', v_cand.rating_cnt,
                'completed_projects_count', v_cand.completed_cnt,
                'match_score', LEAST(100, v_cand.match_score),
                'reasons', v_reasons
            );
        END;
    END LOOP;

    RETURN v_results;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. UNIFORM PROFILE COMPLETENESS (NO CREDENTIAL REQUIRED)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_profile_completeness(p_designer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_has_photo BOOLEAN := FALSE;
    v_has_bio BOOLEAN := FALSE;
    v_has_prof_type BOOLEAN := FALSE;
    v_has_specialization BOOLEAN := FALSE;
    v_has_location BOOLEAN := FALSE;
    v_portfolio_count INTEGER := 0;
    v_min_portfolio INTEGER := 1;
    v_has_portfolio BOOLEAN := FALSE;
    v_completed_count INTEGER := 0;
    v_score INTEGER := 0;
    v_checklist JSONB;
BEGIN
    SELECT COALESCE((value)::INT, 1) INTO v_min_portfolio
    FROM public.app_settings
    WHERE key = 'profile_completeness_min_portfolio_projects';

    -- 1. Check profile photo
    SELECT (avatar_path IS NOT NULL AND length(trim(avatar_path)) > 0)
    INTO v_has_photo
    FROM public.profiles
    WHERE id = p_designer_id;

    -- 2. Check bio, prof type, specialization, location
    SELECT 
        (bio IS NOT NULL AND length(trim(bio)) >= 50),
        (professional_type IS NOT NULL AND length(trim(professional_type)) > 0),
        (cardinality(specializations) > 0),
        (city IS NOT NULL AND (state IS NOT NULL OR location IS NOT NULL))
    INTO v_has_bio, v_has_prof_type, v_has_specialization, v_has_location
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    -- 3. Check portfolio count
    SELECT COUNT(*)
    INTO v_portfolio_count
    FROM public.portfolio_projects
    WHERE designer_id = p_designer_id;

    v_has_portfolio := (v_portfolio_count >= v_min_portfolio);

    IF COALESCE(v_has_photo, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_bio, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_prof_type, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_specialization, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_location, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF v_has_portfolio THEN v_completed_count := v_completed_count + 1; END IF;

    v_score := ROUND((v_completed_count::NUMERIC / 6.0) * 100);

    v_checklist := jsonb_build_array(
        jsonb_build_object('id', 'photo', 'label', 'Profile photo', 'tab', 'profile', 'completed', COALESCE(v_has_photo, FALSE)),
        jsonb_build_object('id', 'bio', 'label', 'About & bio (min 50 chars)', 'tab', 'profile', 'completed', COALESCE(v_has_bio, FALSE)),
        jsonb_build_object('id', 'professional_type', 'label', 'Professional discipline', 'tab', 'profile', 'completed', COALESCE(v_has_prof_type, FALSE)),
        jsonb_build_object('id', 'specialization', 'label', 'Specializations & services', 'tab', 'profile', 'completed', COALESCE(v_has_specialization, FALSE)),
        jsonb_build_object('id', 'location', 'label', 'Location (City, State)', 'tab', 'profile', 'completed', COALESCE(v_has_location, FALSE)),
        jsonb_build_object('id', 'portfolio', 'label', 'Portfolio (min ' || v_min_portfolio || ' project)', 'tab', 'portfolio', 'completed', v_has_portfolio)
    );

    RETURN jsonb_build_object(
        'score', v_score,
        'checklist', v_checklist
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 9. PROPOSAL CREDITS RESET, FAIR USE DAILY CAP & DUPLICATE FLAGGING
-- ------------------------------------------------------------------------------

-- Admin proposal flags queue for duplicate cover letter detection
CREATE TABLE IF NOT EXISTS public.admin_proposal_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL DEFAULT 'duplicate_cover_letter',
    similarity_percent NUMERIC(5, 2) NOT NULL,
    matched_proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_flags_designer ON public.admin_proposal_flags(designer_id);
CREATE INDEX IF NOT EXISTS idx_proposal_flags_created ON public.admin_proposal_flags(created_at DESC);

ALTER TABLE public.admin_proposal_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view proposal flags" ON public.admin_proposal_flags
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Proposal usage RPC: resets on 1st day of each month (UTC), withdrawn does not restore credit
CREATE OR REPLACE FUNCTION public.proposal_usage(p_designer_id UUID)
RETURNS TABLE (
    used INT,
    "limit" INT,
    period_end DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eff_plan TEXT;
    v_limit INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
    v_used INT := 0;
BEGIN
    v_eff_plan := public.get_effective_plan(p_designer_id);

    SELECT monthly_proposal_limit INTO v_limit
    FROM public.plans
    WHERE key = v_eff_plan;

    -- Calendar month reset in UTC (1st day of month)
    v_month_start := date_trunc('month', NOW() AT TIME ZONE 'UTC');
    v_month_end := v_month_start + INTERVAL '1 month';

    -- Count proposals submitted this calendar month (withdrawn does not restore credit)
    SELECT COUNT(*)::INT INTO v_used
    FROM public.proposals
    WHERE designer_id = p_designer_id
      AND sent_at >= v_month_start
      AND sent_at < v_month_end;

    RETURN QUERY
    SELECT v_used, v_limit, (v_month_end::DATE - 1);
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. STUDIO INSIGHTS ANALYTICS TIERS (BASIC, PROFILE_VIEWS, FULL)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_studio_insights(
    p_designer_id UUID,
    p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eff_plan TEXT;
    v_analytics_level TEXT;
    v_current RECORD;
    v_previous RECORD;
    v_win_rate NUMERIC(5,1) := 0.0;
BEGIN
    IF auth.uid() != p_designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    v_eff_plan := public.get_effective_plan(p_designer_id);

    SELECT analytics_level INTO v_analytics_level
    FROM public.plans
    WHERE key = v_eff_plan;

    IF v_analytics_level = 'basic' THEN
        -- Basic analytics tier: return empty / limited stats
        RETURN jsonb_build_object(
            'analytics_level', 'basic',
            'period_days', p_days,
            'current', jsonb_build_object('profile_views', 0, 'search_appearances', 0),
            'win_rate', 0.0
        );
    END IF;

    IF p_days NOT IN (7, 30, 90) THEN
        p_days := 30;
    END IF;

    SELECT
        COALESCE(SUM(profile_views), 0) AS profile_views,
        COALESCE(SUM(search_appearances), 0) AS search_appearances,
        COALESCE(SUM(suggestion_appearances), 0) AS suggestion_appearances,
        COALESCE(SUM(invitations_received), 0) AS invitations_received,
        COALESCE(SUM(invitations_declined), 0) AS invitations_declined,
        COALESCE(SUM(proposals_sent), 0) AS proposals_sent,
        COALESCE(SUM(proposals_viewed), 0) AS proposals_viewed,
        COALESCE(SUM(proposals_shortlisted), 0) AS proposals_shortlisted,
        COALESCE(SUM(proposals_declined), 0) AS proposals_declined,
        COALESCE(SUM(proposals_accepted), 0) AS proposals_accepted
    INTO v_current
    FROM public.designer_analytics_daily
    WHERE designer_id = p_designer_id
      AND date >= CURRENT_DATE - (p_days || ' days')::INTERVAL;

    SELECT
        COALESCE(SUM(profile_views), 0) AS profile_views,
        COALESCE(SUM(search_appearances), 0) AS search_appearances,
        COALESCE(SUM(suggestion_appearances), 0) AS suggestion_appearances,
        COALESCE(SUM(invitations_received), 0) AS invitations_received,
        COALESCE(SUM(invitations_declined), 0) AS invitations_declined,
        COALESCE(SUM(proposals_sent), 0) AS proposals_sent,
        COALESCE(SUM(proposals_viewed), 0) AS proposals_viewed,
        COALESCE(SUM(proposals_shortlisted), 0) AS proposals_shortlisted,
        COALESCE(SUM(proposals_declined), 0) AS proposals_declined,
        COALESCE(SUM(proposals_accepted), 0) AS proposals_accepted
    INTO v_previous
    FROM public.designer_analytics_daily
    WHERE designer_id = p_designer_id
      AND date >= CURRENT_DATE - (p_days * 2 || ' days')::INTERVAL
      AND date < CURRENT_DATE - (p_days || ' days')::INTERVAL;

    IF v_current.proposals_sent > 0 THEN
        v_win_rate := ROUND((v_current.proposals_accepted::NUMERIC / v_current.proposals_sent) * 100.0, 1);
    END IF;

    -- If tier is profile_views (Basic), return profile views only
    IF v_analytics_level = 'profile_views' THEN
        RETURN jsonb_build_object(
            'analytics_level', 'profile_views',
            'period_days', p_days,
            'current', jsonb_build_object(
                'profile_views', v_current.profile_views,
                'search_appearances', v_current.search_appearances
            ),
            'previous', jsonb_build_object(
                'profile_views', v_previous.profile_views,
                'search_appearances', v_previous.search_appearances
            ),
            'win_rate', 0.0
        );
    END IF;

    -- Full analytics (Gold)
    RETURN jsonb_build_object(
        'analytics_level', 'full',
        'period_days', p_days,
        'current', row_to_json(v_current),
        'previous', row_to_json(v_previous),
        'win_rate', v_win_rate
    );
END;
$$;
