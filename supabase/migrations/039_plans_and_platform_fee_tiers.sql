-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PLANS & PLATFORM SERVICE FEE TIERS
-- 039_plans_and_platform_fee_tiers.sql
-- Plans, Fee Tiers, Fee Calculation RPC, Fee Snapshot, Proposal Designer Cards
-- ==============================================================================

-- 1. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL CHECK (key IN ('free', 'basic', 'upgraded')),
    name TEXT NOT NULL,
    monthly_price_cents INT NOT NULL DEFAULT 0,
    yearly_price_cents INT NOT NULL DEFAULT 0,
    monthly_proposal_limit INT, -- NULL means unlimited
    images_per_portfolio_project INT NOT NULL DEFAULT 0,
    directory_listing BOOLEAN NOT NULL DEFAULT FALSE,
    public_profile BOOLEAN NOT NULL DEFAULT FALSE,
    portfolio_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    direct_invitations BOOLEAN NOT NULL DEFAULT FALSE,
    verified_badge BOOLEAN NOT NULL DEFAULT FALSE,
    studio_insights BOOLEAN NOT NULL DEFAULT FALSE,
    studio_url BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Plans
INSERT INTO public.plans (
    key, name, monthly_price_cents, yearly_price_cents, 
    monthly_proposal_limit, images_per_portfolio_project, 
    directory_listing, public_profile, portfolio_enabled, 
    direct_invitations, verified_badge, studio_insights, studio_url, sort_order
) VALUES
('free', 'Free', 0, 0, 5, 0, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 1),
('basic', 'Basic', 2999, 29900, 10, 2, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, 2),
('upgraded', 'Upgraded', 4999, 49900, NULL, 12, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 3)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    monthly_price_cents = EXCLUDED.monthly_price_cents,
    yearly_price_cents = EXCLUDED.yearly_price_cents,
    monthly_proposal_limit = EXCLUDED.monthly_proposal_limit,
    images_per_portfolio_project = EXCLUDED.images_per_portfolio_project,
    directory_listing = EXCLUDED.directory_listing,
    public_profile = EXCLUDED.public_profile,
    portfolio_enabled = EXCLUDED.portfolio_enabled,
    direct_invitations = EXCLUDED.direct_invitations,
    verified_badge = EXCLUDED.verified_badge,
    studio_insights = EXCLUDED.studio_insights,
    studio_url = EXCLUDED.studio_url,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plans" ON public.plans
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "Admins can manage plans" ON public.plans
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 2. Plan Fee Tiers Table
CREATE TABLE IF NOT EXISTS public.plan_fee_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_key TEXT NOT NULL REFERENCES public.plans(key) ON DELETE CASCADE,
    from_amount_cents BIGINT NOT NULL DEFAULT 0,
    rate_percent NUMERIC(5, 2) NOT NULL CHECK (rate_percent >= 0 AND rate_percent <= 100),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed Plan Fee Tiers
-- Free: 0: 10%, 5000: 5% (500,000 cents)
-- Basic: 0: 5%, 20000: 2.5% (2,000,000 cents)
-- Upgraded: 0: 4%, 20000: 2.0% (2,000,000 cents)
DELETE FROM public.plan_fee_tiers;
INSERT INTO public.plan_fee_tiers (plan_key, from_amount_cents, rate_percent, sort_order) VALUES
('free', 0, 10.00, 1),
('free', 500000, 5.00, 2),
('basic', 0, 5.00, 1),
('basic', 2000000, 2.50, 2),
('upgraded', 0, 4.00, 1),
('upgraded', 2000000, 2.00, 2);

ALTER TABLE public.plan_fee_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan fee tiers" ON public.plan_fee_tiers
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "Admins can manage fee tiers" ON public.plan_fee_tiers
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 3. Settings updates for Plans and Fees
INSERT INTO public.app_settings (key, value) VALUES
('fee_tier_mode', '"whole_amount"'::jsonb),
('fee_basis', '"per_milestone"'::jsonb),
('verified_badge_requires_paid_plan', 'true'::jsonb),
('free_show_rating_on_proposals', 'true'::jsonb),
('free_proposal_bio_max_chars', '300'::jsonb),
('basic_account_note', '"Basic account: portfolio not available"'::jsonb),
('matching_plan_boost', '{"free": 0, "basic": 5, "upgraded": 15}'::jsonb),
('priority_label_mode', '"label"'::jsonb),
('client_service_fee_percent', '0'::jsonb),
('client_deposit_percent', 'null'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Calculate Platform Fee Function
-- Single source of truth for platform service fee calculation
CREATE OR REPLACE FUNCTION public.calculate_platform_fee(
    p_plan_key TEXT,
    p_amount_cents BIGINT,
    p_cumulative_before_cents BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mode TEXT;
    v_basis TEXT;
    v_target_amount BIGINT;
    v_fee_cents BIGINT := 0;
    v_net_cents BIGINT;
    v_chosen_rate NUMERIC(5,2);
    v_breakdown JSONB;
BEGIN
    IF p_amount_cents <= 0 THEN
        RETURN jsonb_build_object(
            'plan_key', p_plan_key,
            'amount_cents', 0,
            'fee_cents', 0,
            'net_cents', 0,
            'fee_dollars', 0.00,
            'net_dollars', 0.00,
            'rate_percent', 0.0,
            'breakdown', '[]'::jsonb
        );
    END IF;

    -- Fetch mode and basis
    SELECT COALESCE(value #>> '{}', 'whole_amount') INTO v_mode FROM public.app_settings WHERE key = 'fee_tier_mode';
    SELECT COALESCE(value #>> '{}', 'per_milestone') INTO v_basis FROM public.app_settings WHERE key = 'fee_basis';

    IF v_basis = 'cumulative_project' THEN
        v_target_amount := p_cumulative_before_cents + p_amount_cents;
    ELSE
        v_target_amount := p_amount_cents;
    END IF;

    IF v_mode = 'whole_amount' THEN
        -- In whole_amount mode, "Over the threshold means strictly greater than the threshold"
        -- exactly $5,000 (500000 cents) stays at 10% on Free.
        -- Therefore, tier applies where from_amount_cents < v_target_amount.
        SELECT rate_percent INTO v_chosen_rate
        FROM public.plan_fee_tiers
        WHERE plan_key = p_plan_key AND from_amount_cents < v_target_amount
        ORDER BY from_amount_cents DESC
        LIMIT 1;

        -- Fallback to lowest tier if amount is 0 or no lower tier matched
        IF v_chosen_rate IS NULL THEN
            SELECT rate_percent INTO v_chosen_rate
            FROM public.plan_fee_tiers
            WHERE plan_key = p_plan_key
            ORDER BY from_amount_cents ASC
            LIMIT 1;
        END IF;

        -- Fee is computed by applying the chosen rate to the whole milestone amount
        -- Round half up
        v_fee_cents := ROUND((p_amount_cents::NUMERIC * v_chosen_rate) / 100.0);
        v_breakdown := jsonb_build_array(
            jsonb_build_object(
                'from_amount_cents', 0,
                'rate_percent', v_chosen_rate,
                'taxable_amount_cents', p_amount_cents,
                'fee_cents', v_fee_cents
            )
        );
    ELSE
        -- Marginal mode: compute bracket by bracket
        DECLARE
            t RECORD;
            v_curr_from BIGINT := 0;
            v_next_from BIGINT;
            v_slice BIGINT;
            v_slice_fee BIGINT;
            v_accum BIGINT := 0;
            v_slices JSONB := '[]'::jsonb;
        BEGIN
            FOR t IN 
                SELECT from_amount_cents, rate_percent,
                       LEAD(from_amount_cents) OVER (ORDER BY from_amount_cents ASC) as next_from
                FROM public.plan_fee_tiers
                WHERE plan_key = p_plan_key
                ORDER BY from_amount_cents ASC
            LOOP
                IF p_amount_cents > t.from_amount_cents THEN
                    IF t.next_from IS NOT NULL THEN
                        v_slice := LEAST(p_amount_cents, t.next_from) - t.from_amount_cents;
                    ELSE
                        v_slice := p_amount_cents - t.from_amount_cents;
                    END IF;
                    v_slice_fee := ROUND((v_slice::NUMERIC * t.rate_percent) / 100.0);
                    v_accum := v_accum + v_slice_fee;
                    v_slices := v_slices || jsonb_build_object(
                        'from_amount_cents', t.from_amount_cents,
                        'rate_percent', t.rate_percent,
                        'taxable_amount_cents', v_slice,
                        'fee_cents', v_slice_fee
                    );
                    v_chosen_rate := t.rate_percent;
                END IF;
            END LOOP;
            v_fee_cents := v_accum;
            v_breakdown := v_slices;
        END;
    END IF;

    v_net_cents := p_amount_cents - v_fee_cents;

    RETURN jsonb_build_object(
        'plan_key', p_plan_key,
        'amount_cents', p_amount_cents,
        'fee_cents', v_fee_cents,
        'net_cents', v_net_cents,
        'fee_dollars', ROUND((v_fee_cents::NUMERIC / 100.0), 2),
        'net_dollars', ROUND((v_net_cents::NUMERIC / 100.0), 2),
        'rate_percent', v_chosen_rate,
        'breakdown', v_breakdown
    );
END;
$$;

-- 5. Add fee_schedule_snapshot to contracts / engagements
ALTER TABLE public.contracts
    ADD COLUMN IF NOT EXISTS fee_schedule_snapshot JSONB;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'engagements'
    ) THEN
        ALTER TABLE public.engagements
            ADD COLUMN IF NOT EXISTS fee_schedule_snapshot JSONB;
    END IF;
END $$;

-- 6. dev_switch_designer_plan Function (Admin only, blocked in production)
CREATE OR REPLACE FUNCTION public.dev_switch_designer_plan(
    p_designer_id UUID,
    p_new_plan_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_env TEXT;
BEGIN
    SELECT COALESCE(value #>> '{}', 'development') INTO v_env 
    FROM public.app_settings 
    WHERE key = 'environment';

    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_function_blocked_in_production'
            USING ERRCODE = '42501';
    END IF;

    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can switch designer plans directly.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = p_new_plan_key) THEN
        RAISE EXCEPTION 'Invalid plan key: %', p_new_plan_key;
    END IF;

    UPDATE public.profiles
    SET plan_key = p_new_plan_key, updated_at = NOW()
    WHERE id = p_designer_id;

    RETURN jsonb_build_object(
        'success', true,
        'designer_id', p_designer_id,
        'plan_key', p_new_plan_key
    );
END;
$$;

-- 7. Update public_designer_profiles view to strictly enforce directory_listing
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
    COALESCE(
        (SELECT COUNT(*) > 0 
         FROM public.credentials c 
         WHERE c.designer_id = dp.user_id 
           AND c.status = 'verified' 
           AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)),
        false
    ) AS verified,
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
    COALESCE(
        (SELECT dls.licensed_states 
         FROM public.designer_licensed_states dls 
         WHERE dls.designer_id = dp.user_id),
        ARRAY[]::TEXT[]
    ) AS licensed_states,
    COALESCE(
        (SELECT COUNT(*) > 0 
         FROM public.designer_insurance di 
         WHERE di.designer_id = dp.user_id 
           AND di.status = 'verified' 
           AND di.expiration_date >= CURRENT_DATE),
        false
    ) AS is_insured
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
JOIN public.plans pl ON pl.key = p.plan_key
WHERE dp.show_in_search = true 
  AND pl.directory_listing = true;

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- 8. Proposal Designer Cards View
-- Readable only by the project client (for proposals on their project) and admins
CREATE OR REPLACE VIEW public.proposal_designer_cards AS
SELECT
    prop.id AS proposal_id,
    prop.project_id,
    proj.client_id AS project_client_id,
    dp.user_id AS designer_id,
    p.full_name,
    dp.professional_type AS discipline,
    dp.studio_name,
    dp.city,
    dp.state,
    dp.years_experience,
    CASE 
        WHEN pl.key = 'free' THEN 
            LEFT(dp.bio, COALESCE((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars'), 300))
        ELSE dp.bio
    END AS short_bio,
    pl.key AS plan_key,
    pl.name AS plan_name,
    pl.directory_listing AS plan_has_directory_listing,
    pl.portfolio_enabled AS plan_has_portfolio,
    pl.verified_badge AS plan_has_verified_badge,
    COALESCE(
        (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'basic_account_note'),
        'Basic account: portfolio not available'
    ) AS basic_account_note,
    CASE
        WHEN (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'free_show_rating_on_proposals') = 'true' OR pl.key != 'free' THEN
            COALESCE(
                (SELECT ROUND(AVG(rating)::numeric, 1) 
                 FROM public.reviews r 
                 WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
                0.0
            )
        ELSE NULL
    END AS rating_average,
    CASE
        WHEN (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'free_show_rating_on_proposals') = 'true' OR pl.key != 'free' THEN
            COALESCE(
                (SELECT COUNT(*)::INT 
                 FROM public.reviews r 
                 WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
                0
            )
        ELSE NULL
    END AS rating_count,
    COALESCE(
        (SELECT dls.licensed_states 
         FROM public.designer_licensed_states dls 
         WHERE dls.designer_id = dp.user_id),
        ARRAY[]::TEXT[]
    ) AS licensed_states,
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'license_type', c.license_type,
                'issuing_state', c.issuing_state,
                'status_label', CASE 
                    WHEN c.status = 'verified' AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE) AND pl.verified_badge = true 
                        THEN 'Verified'
                    ELSE 'Self-reported, not verified by Dezignet'
                END
            )
        )
        FROM public.credentials c
        WHERE c.designer_id = dp.user_id AND c.status IN ('verified', 'pending')),
        '[]'::jsonb
    ) AS licenses,
    COALESCE(
        (SELECT COUNT(*) > 0 
         FROM public.designer_insurance di 
         WHERE di.designer_id = dp.user_id 
           AND di.status = 'verified' 
           AND di.expiration_date >= CURRENT_DATE),
        false
    ) AS is_insured
FROM public.proposals prop
JOIN public.projects proj ON proj.id = prop.project_id
JOIN public.designer_profiles dp ON dp.user_id = prop.designer_id
JOIN public.profiles p ON p.id = dp.user_id
JOIN public.plans pl ON pl.key = p.plan_key;

GRANT SELECT ON public.proposal_designer_cards TO authenticated;

