-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - US MARKET CONVERSION & LICENSING
-- 038_us_market_tax_license_updates.sql
-- US States, Tax Info Status, US Professional Credentials, Insurance, Categories
-- ==============================================================================

-- 1. US State 2-letter Domain
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'us_state_code') THEN
        CREATE DOMAIN public.us_state_code AS TEXT
        CHECK (VALUE ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$');
    END IF;
END $$;

-- 2. Add 'expired' to credential_status if not present
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.credential_status'::regtype AND enumlabel = 'expired'
    ) THEN
        ALTER TYPE public.credential_status ADD VALUE 'expired';
    END IF;
END $$;

-- 3. Profiles updates: time_zone, tax_info_status, plan_key
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'America/New_York',
    ADD COLUMN IF NOT EXISTS tax_info_status TEXT NOT NULL DEFAULT 'not_provided',
    ADD COLUMN IF NOT EXISTS plan_key TEXT NOT NULL DEFAULT 'free';

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tax_info_status_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_tax_info_status_check
            CHECK (tax_info_status IN ('not_provided', 'provided'));
    END IF;
END $$;

-- 4. Designer profiles updates: city, state, zip_code, accepts_invitations
ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS zip_code TEXT,
    ADD COLUMN IF NOT EXISTS accepts_invitations BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS studio_slug TEXT,
    ADD COLUMN IF NOT EXISTS studio_slug_updated_at TIMESTAMPTZ;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'designer_profiles_zip_code_check'
    ) THEN
        ALTER TABLE public.designer_profiles
            ADD CONSTRAINT designer_profiles_zip_code_check
            CHECK (zip_code IS NULL OR zip_code ~ '^\d{5}(-\d{4})?$');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'designer_profiles_state_check'
    ) THEN
        ALTER TABLE public.designer_profiles
            ADD CONSTRAINT designer_profiles_state_check
            CHECK (state IS NULL OR state ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$');
    END IF;
END $$;

-- 5. Projects updates: permit jurisdiction, HOA/historic district, ZIP code
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS permit_jurisdiction TEXT,
    ADD COLUMN IF NOT EXISTS hoa_or_historic_district TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS zip_code TEXT;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_hoa_district_check'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_hoa_district_check
            CHECK (hoa_or_historic_district IS NULL OR hoa_or_historic_district IN ('yes', 'no', 'unsure'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_zip_code_check'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_zip_code_check
            CHECK (zip_code IS NULL OR zip_code ~ '^\d{5}(-\d{4})?$');
    END IF;
END $$;

-- Populate state on projects from state_region if 2 letters
UPDATE public.projects 
SET state = UPPER(state_region)
WHERE state IS NULL AND state_region ~* '^[a-z]{2}$';

-- 6. Proposals updates: license acknowledgement
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS license_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS license_acknowledgement_text TEXT;

-- 7. US Professional Credentials Table
-- Drop and replace with US Model schema
DROP TABLE IF EXISTS public.credentials CASCADE;

CREATE TABLE public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    license_type TEXT NOT NULL,
    issuing_state TEXT NOT NULL,
    license_number TEXT NOT NULL,
    issue_year INTEGER CHECK (issue_year IS NULL OR (issue_year >= 1950 AND issue_year <= 2100)),
    expiration_date DATE,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT credentials_license_type_check CHECK (license_type IN ('architect', 'professional_engineer', 'landscape_architect', 'interior_designer', 'other')),
    CONSTRAINT credentials_issuing_state_check CHECK (issuing_state ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$')
);

CREATE INDEX IF NOT EXISTS idx_credentials_designer_id ON public.credentials(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(designer_id, status);
CREATE INDEX IF NOT EXISTS idx_credentials_issuing_state ON public.credentials(issuing_state);

-- Trigger: protect review fields and reset status on edit
CREATE OR REPLACE FUNCTION public.handle_credential_ownership_and_reset()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Check if non-admin is updating
    IF NOT public.is_admin() THEN
        -- Owner cannot set or change status manually
        IF (TG_OP = 'INSERT' AND NEW.status != 'pending') OR 
           (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND OLD.status != 'verified') THEN
            RAISE EXCEPTION 'owners_cannot_set_status'
                USING ERRCODE = '42501';
        END IF;

        -- Non-admin cannot set admin review audit fields
        IF (TG_OP = 'UPDATE') AND (
            NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
            NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
            NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
        ) THEN
            RAISE EXCEPTION 'owners_cannot_set_review_fields'
                USING ERRCODE = '42501';
        END IF;

        -- If editing an existing verified credential, reset it to pending
        IF TG_OP = 'UPDATE' AND OLD.status = 'verified' AND (
            NEW.license_type IS DISTINCT FROM OLD.license_type OR
            NEW.issuing_state IS DISTINCT FROM OLD.issuing_state OR
            NEW.license_number IS DISTINCT FROM OLD.license_number OR
            NEW.issue_year IS DISTINCT FROM OLD.issue_year OR
            NEW.expiration_date IS DISTINCT FROM OLD.expiration_date OR
            NEW.certificate_file IS DISTINCT FROM OLD.certificate_file
        ) THEN
            NEW.status = 'pending';
            NEW.reviewed_by = NULL;
            NEW.reviewed_at = NULL;
            NEW.rejection_reason = NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_credential_ownership_reset ON public.credentials;
CREATE TRIGGER trg_credential_ownership_reset
    BEFORE INSERT OR UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_credential_ownership_and_reset();

-- RLS for credentials
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified credentials" ON public.credentials;
CREATE POLICY "Public can view verified credentials" ON public.credentials
    FOR SELECT TO authenticated, anon
    USING (status = 'verified');

DROP POLICY IF EXISTS "Designers can view own credentials" ON public.credentials;
CREATE POLICY "Designers can view own credentials" ON public.credentials
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can insert own credentials" ON public.credentials;
CREATE POLICY "Designers can insert own credentials" ON public.credentials
    FOR INSERT TO authenticated
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can update own credentials" ON public.credentials;
CREATE POLICY "Designers can update own credentials" ON public.credentials
    FOR UPDATE TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can delete own credentials" ON public.credentials;
CREATE POLICY "Designers can delete own credentials" ON public.credentials
    FOR DELETE TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to credentials" ON public.credentials;
CREATE POLICY "Admins have full access to credentials" ON public.credentials
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. Professional Liability Insurance Table
CREATE TABLE IF NOT EXISTS public.designer_insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.designer_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verified insurance" ON public.designer_insurance
    FOR SELECT TO authenticated, anon
    USING (status = 'verified' AND expiration_date >= CURRENT_DATE);

CREATE POLICY "Designers can view and manage own insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

CREATE POLICY "Admins have full access to insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. Licensed States View
CREATE OR REPLACE VIEW public.designer_licensed_states AS
SELECT 
    designer_id,
    array_agg(issuing_state ORDER BY issuing_state) AS licensed_states
FROM public.credentials
WHERE status = 'verified' 
  AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
GROUP BY designer_id;

GRANT SELECT ON public.designer_licensed_states TO authenticated, anon, service_role;

-- 10. Credential Expiration Scheduled Job Function
CREATE OR REPLACE FUNCTION public.check_credential_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Mark expired credentials
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type
        FROM public.credentials
        WHERE status = 'verified' AND expiration_date < CURRENT_DATE
    LOOP
        UPDATE public.credentials
        SET status = 'expired', updated_at = NOW()
        WHERE id = r.id;

        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;

    -- Notify credentials expiring in 30 days
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type, expiration_date
        FROM public.credentials
        WHERE status = 'verified' 
          AND expiration_date = CURRENT_DATE + INTERVAL '30 days'
    LOOP
        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'expiration_date', r.expiration_date,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;
END;
$$;

-- 11. US Categories & Subcategories Seed
DO $$
DECLARE
    v_res UUID;
    v_comm UUID;
    v_hosp UUID;
    v_inst UUID;
    v_health UUID;
    v_ind UUID;
BEGIN
    -- Truncate / clean subcategories and re-seed
    DELETE FROM public.subcategories;
    DELETE FROM public.categories;

    -- Residential
    INSERT INTO public.categories (name, sort_order) VALUES ('Residential', 1) RETURNING id INTO v_res;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_res, 'Single-family home', 1),
        (v_res, 'Custom home', 2),
        (v_res, 'Home addition or remodel', 3),
        (v_res, 'ADU (accessory dwelling unit)', 4),
        (v_res, 'Townhome', 5),
        (v_res, 'Multifamily', 6),
        (v_res, 'Student housing', 7);

    -- Commercial
    INSERT INTO public.categories (name, sort_order) VALUES ('Commercial', 2) RETURNING id INTO v_comm;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_comm, 'Office', 1),
        (v_comm, 'Retail', 2),
        (v_comm, 'Restaurant', 3),
        (v_comm, 'Mixed-use', 4),
        (v_comm, 'Medical office', 5);

    -- Hospitality
    INSERT INTO public.categories (name, sort_order) VALUES ('Hospitality', 3) RETURNING id INTO v_hosp;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_hosp, 'Hotel', 1),
        (v_hosp, 'Short-term rental', 2);

    -- Institutional
    INSERT INTO public.categories (name, sort_order) VALUES ('Institutional', 4) RETURNING id INTO v_inst;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_inst, 'K-12 school', 1),
        (v_inst, 'Higher education', 2),
        (v_inst, 'Religious', 3),
        (v_inst, 'Government and civic', 4),
        (v_inst, 'Cultural', 5),
        (v_inst, 'Recreation', 6);

    -- Healthcare
    INSERT INTO public.categories (name, sort_order) VALUES ('Healthcare', 5) RETURNING id INTO v_health;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_health, 'Hospital', 1),
        (v_health, 'Clinic', 2),
        (v_health, 'Dental or specialty', 3),
        (v_health, 'Senior living', 4);

    -- Industrial
    INSERT INTO public.categories (name, sort_order) VALUES ('Industrial', 6) RETURNING id INTO v_ind;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_ind, 'Warehouse', 1),
        (v_ind, 'Manufacturing', 2),
        (v_ind, 'Logistics', 3);
END $$;
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
    SELECT COALESCE(value, 'development') INTO v_env 
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
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - STUDIO INSIGHTS & STUDIO WEB ADDRESS
-- 040_studio_insights_and_slugs.sql
-- Daily Aggregate Analytics, Slug Reservations, 90-day Redirects, Funnel
-- ==============================================================================

-- 1. Daily Designer Analytics Table (Kept for 13 months, aggregated daily)
CREATE TABLE IF NOT EXISTS public.designer_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    profile_views INT NOT NULL DEFAULT 0,
    search_appearances INT NOT NULL DEFAULT 0,
    suggestion_appearances INT NOT NULL DEFAULT 0,
    invitations_received INT NOT NULL DEFAULT 0,
    invitations_declined INT NOT NULL DEFAULT 0,
    proposals_sent INT NOT NULL DEFAULT 0,
    proposals_viewed INT NOT NULL DEFAULT 0,
    proposals_shortlisted INT NOT NULL DEFAULT 0,
    proposals_declined INT NOT NULL DEFAULT 0,
    proposals_accepted INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (designer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_designer_date ON public.designer_analytics_daily(designer_id, date DESC);

ALTER TABLE public.designer_analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Designers can view own analytics" ON public.designer_analytics_daily
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

CREATE POLICY "Admins can view all analytics" ON public.designer_analytics_daily
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 2. Studio Slug History & 90-day Redirects
CREATE TABLE IF NOT EXISTS public.studio_slug_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    redirect_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_studio_slug_history_slug ON public.studio_slug_history(slug);
CREATE INDEX IF NOT EXISTS idx_studio_slug_history_designer ON public.studio_slug_history(designer_id);

ALTER TABLE public.studio_slug_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can lookup slug history for redirects" ON public.studio_slug_history
    FOR SELECT TO authenticated, anon
    USING (true);

-- 3. Reserved Slugs Table
CREATE TABLE IF NOT EXISTS public.reserved_slugs (
    slug TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'system_reserved'
);

ALTER TABLE public.reserved_slugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reserved slugs" ON public.reserved_slugs
    FOR SELECT TO authenticated, anon
    USING (true);

INSERT INTO public.reserved_slugs (slug, reason) VALUES
('admin', 'system'),
('api', 'system'),
('auth', 'system'),
('app', 'system'),
('studio', 'system'),
('explore', 'system'),
('dezignet', 'system'),
('settings', 'system'),
('profile', 'system'),
('projects', 'system'),
('proposals', 'system'),
('contracts', 'system'),
('billing', 'system'),
('payments', 'system'),
('support', 'system'),
('help', 'system'),
('legal', 'system'),
('terms', 'system'),
('privacy', 'system'),
('dashboard', 'system'),
('messages', 'system'),
('conversations', 'system'),
('find-designers', 'system')
ON CONFLICT (slug) DO NOTHING;

-- 4. Record Analytics Event RPC
CREATE OR REPLACE FUNCTION public.record_analytics_event(
    p_designer_id UUID,
    p_event_type TEXT,
    p_viewer_hash TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Ignore self-views
    IF auth.uid() = p_designer_id THEN
        RETURN;
    END IF;

    -- Ensure daily counter row exists
    INSERT INTO public.designer_analytics_daily (designer_id, date)
    VALUES (p_designer_id, CURRENT_DATE)
    ON CONFLICT (designer_id, date) DO NOTHING;

    CASE p_event_type
        WHEN 'profile_view' THEN
            UPDATE public.designer_analytics_daily
            SET profile_views = profile_views + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'search_appearance' THEN
            UPDATE public.designer_analytics_daily
            SET search_appearances = search_appearances + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'suggestion_appearance' THEN
            UPDATE public.designer_analytics_daily
            SET suggestion_appearances = suggestion_appearances + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'invitation_received' THEN
            UPDATE public.designer_analytics_daily
            SET invitations_received = invitations_received + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'invitation_declined' THEN
            UPDATE public.designer_analytics_daily
            SET invitations_declined = invitations_declined + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_sent' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_sent = proposals_sent + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_viewed' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_viewed = proposals_viewed + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_shortlisted' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_shortlisted = proposals_shortlisted + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_declined' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_declined = proposals_declined + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_accepted' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_accepted = proposals_accepted + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        ELSE
            -- No-op for untracked events
            NULL;
    END CASE;
END;
$$;

-- 5. Get Studio Insights Function (Upgraded plan only, period 7, 30, 90 days)
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
    v_plan_key TEXT;
    v_has_insights BOOLEAN;
    v_current RECORD;
    v_previous RECORD;
    v_win_rate NUMERIC(5,1) := 0.0;
BEGIN
    -- Owner or admin only
    IF auth.uid() != p_designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized'
            USING ERRCODE = '42501';
    END IF;

    -- Verify designer plan has studio_insights
    SELECT p.plan_key, pl.studio_insights INTO v_plan_key, v_has_insights
    FROM public.profiles p
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE p.id = p_designer_id;

    IF NOT COALESCE(v_has_insights, false) THEN
        RAISE EXCEPTION 'plan_upgrade_required'
            USING ERRCODE = '42501';
    END IF;

    -- Validate period
    IF p_days NOT IN (7, 30, 90) THEN
        p_days := 30;
    END IF;

    -- Current period sums
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

    -- Previous period sums (for comparison text)
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

    RETURN jsonb_build_object(
        'period_days', p_days,
        'current', row_to_json(v_current),
        'previous', row_to_json(v_previous),
        'win_rate', v_win_rate
    );
END;
$$;

-- 6. Claim Studio Slug Function
CREATE OR REPLACE FUNCTION public.claim_studio_slug(
    p_designer_id UUID,
    p_new_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_slug TEXT;
    v_old_slug TEXT;
    v_last_updated TIMESTAMPTZ;
    v_plan_has_url BOOLEAN;
BEGIN
    IF auth.uid() != p_designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    -- Check plan has studio_url
    SELECT pl.studio_url INTO v_plan_has_url
    FROM public.profiles p
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE p.id = p_designer_id;

    IF NOT COALESCE(v_plan_has_url, false) THEN
        RAISE EXCEPTION 'plan_upgrade_required' USING ERRCODE = '42501';
    END IF;

    v_clean_slug := LOWER(TRIM(p_new_slug));

    -- Validate format: 3 to 40 characters, lowercase letters, digits, and hyphens, no leading/trailing hyphen
    IF v_clean_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' THEN
        RAISE EXCEPTION 'invalid_slug_format' USING ERRCODE = '22023';
    END IF;

    -- Check reserved words
    IF EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = v_clean_slug) THEN
        RAISE EXCEPTION 'slug_reserved' USING ERRCODE = '22023';
    END IF;

    -- Check if another active designer already holds this slug
    IF EXISTS (
        SELECT 1 FROM public.designer_profiles 
        WHERE studio_slug = v_clean_slug AND user_id != p_designer_id
    ) THEN
        RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
    END IF;

    -- Check if redirect exists for another designer within 90 days
    IF EXISTS (
        SELECT 1 FROM public.studio_slug_history 
        WHERE slug = v_clean_slug 
          AND designer_id != p_designer_id 
          AND redirect_until > NOW()
    ) THEN
        RAISE EXCEPTION 'slug_reserved_redirect' USING ERRCODE = '23505';
    END IF;

    -- Check 30-day throttle on changes
    SELECT studio_slug, studio_slug_updated_at INTO v_old_slug, v_last_updated
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    IF v_last_updated IS NOT NULL AND v_last_updated > NOW() - INTERVAL '30 days' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'slug_change_too_soon' USING ERRCODE = '42501';
    END IF;

    -- Archive old slug in history with 90-day redirect
    IF v_old_slug IS NOT NULL AND v_old_slug != v_clean_slug THEN
        INSERT INTO public.studio_slug_history (designer_id, slug, claimed_at, released_at, redirect_until)
        VALUES (p_designer_id, v_old_slug, COALESCE(v_last_updated, NOW()), NOW(), NOW() + INTERVAL '90 days');
    END IF;

    -- Update active slug
    UPDATE public.designer_profiles
    SET studio_slug = v_clean_slug, studio_slug_updated_at = NOW()
    WHERE user_id = p_designer_id;

    -- Record new slug in history
    INSERT INTO public.studio_slug_history (designer_id, slug, claimed_at)
    VALUES (p_designer_id, v_clean_slug, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'slug', v_clean_slug
    );
END;
$$;

-- 7. Resolve Studio Slug Function
CREATE OR REPLACE FUNCTION public.resolve_studio_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_slug TEXT := LOWER(TRIM(p_slug));
    v_designer_id UUID;
    v_redirect_designer_id UUID;
    v_redirect_active_slug TEXT;
    v_plan_has_url BOOLEAN;
BEGIN
    -- Direct lookup on active studio_slug
    SELECT dp.user_id, pl.studio_url INTO v_designer_id, v_plan_has_url
    FROM public.designer_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE dp.studio_slug = v_clean_slug;

    IF v_designer_id IS NOT NULL THEN
        IF v_plan_has_url = true THEN
            RETURN jsonb_build_object(
                'status', 'found',
                'designer_id', v_designer_id,
                'slug', v_clean_slug
            );
        ELSE
            -- Downgraded plan: slug stops resolving
            RETURN jsonb_build_object('status', 'plan_expired');
        END IF;
    END IF;

    -- Check redirect history within 90 days
    SELECT designer_id INTO v_redirect_designer_id
    FROM public.studio_slug_history
    WHERE slug = v_clean_slug AND redirect_until > NOW()
    ORDER BY released_at DESC
    LIMIT 1;

    IF v_redirect_designer_id IS NOT NULL THEN
        SELECT studio_slug INTO v_redirect_active_slug
        FROM public.designer_profiles
        WHERE user_id = v_redirect_designer_id;

        IF v_redirect_active_slug IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'redirect',
                'new_slug', v_redirect_active_slug,
                'designer_id', v_redirect_designer_id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('status', 'not_found');
END;
$$;
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT INVITATIONS & DESIGNER SUGGESTIONS
-- 041_project_invitations_and_suggestions.sql
-- Project Invitations, Matching & Suggestions Algorithm, Search for Clients
-- ==============================================================================

-- 1. Project Invitations Table
CREATE TABLE IF NOT EXISTS public.project_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.profiles(id),
    designer_id UUID NOT NULL REFERENCES public.profiles(id),
    message TEXT CHECK (message IS NULL OR char_length(message) <= 500),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'declined', 'proposal_sent', 'expired', 'withdrawn')),
    decline_reason_code TEXT CHECK (decline_reason_code IS NULL OR decline_reason_code IN ('not_available', 'not_a_good_fit', 'budget_too_low', 'other')),
    decline_note TEXT CHECK (decline_note IS NULL OR char_length(decline_note) <= 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    UNIQUE (project_id, designer_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_project ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_designer ON public.project_invitations(designer_id);
CREATE INDEX IF NOT EXISTS idx_invitations_client ON public.project_invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON public.project_invitations(expires_at) WHERE status IN ('sent', 'viewed');

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view invitations for own projects" ON public.project_invitations
    FOR SELECT TO authenticated
    USING (client_id = auth.uid());

CREATE POLICY "Designers can view invitations sent to them" ON public.project_invitations
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

CREATE POLICY "Admins have full access to invitations" ON public.project_invitations
    FOR ALL TO authenticated
    USING (public.is_admin());

-- 2. Suggestion Events Table (For analytics and CTR, auto-purge after 90 days)
CREATE TABLE IF NOT EXISTS public.suggestion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('shown', 'opened_profile', 'invited', 'saved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_events_project ON public.suggestion_events(project_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_events_designer ON public.suggestion_events(designer_id);

ALTER TABLE public.suggestion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can log suggestion events for own projects" ON public.suggestion_events
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = auth.uid())
        OR public.is_admin()
    );

CREATE POLICY "Admins can view suggestion events" ON public.suggestion_events
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 3. App Settings for Invitations & Matching
INSERT INTO public.app_settings (key, value) VALUES
('invitations_per_project_max', '10'::jsonb),
('invitations_per_client_per_day', '20'::jsonb),
('invitation_expiry_days', '14'::jsonb),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 25, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'::jsonb),
('matching_new_designer_boost', '5'::jsonb),
('matching_max_active_engagements', '8'::jsonb),
('matching_require_state_license', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Notification Types Insert
INSERT INTO public.notification_types (type, title_template, body_template, email_template) VALUES
('invitation_received', 'Project Invitation', 'You received an invitation to submit a proposal for {{project_title}}.', 'invitation_received'),
('invitation_declined', 'Invitation Declined', 'A designer declined your project invitation.', 'invitation_declined'),
('invitation_expired', 'Invitation Expired', 'An invitation for {{project_title}} has expired.', 'invitation_expired')
ON CONFLICT (type) DO NOTHING;

-- 5. Invite Designer Function
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

    IF v_project.status NOT IN ('open', 'published') THEN
        RAISE EXCEPTION 'project_not_open' USING ERRCODE = '22023';
    END IF;

    IF v_project.proposal_deadline IS NOT NULL AND v_project.proposal_deadline < CURRENT_DATE THEN
        RAISE EXCEPTION 'project_not_open' USING ERRCODE = '22023';
    END IF;

    -- 2. Verify designer eligibility
    SELECT dp.user_id, dp.is_available, dp.show_in_search, dp.accepts_invitations,
           p.role, p.plan_key, pl.directory_listing, pl.direct_invitations
    INTO v_designer
    FROM public.designer_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE dp.user_id = p_designer_id;

    IF v_designer IS NULL OR v_designer.role != 'designer' THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
    END IF;

    -- Plan check: must have directory_listing and direct_invitations
    IF NOT (v_designer.directory_listing = true AND v_designer.direct_invitations = true) THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
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
    SELECT COALESCE((value #>> '{}')::int, 10) INTO v_max_per_project 
    FROM public.app_settings WHERE key = 'invitations_per_project_max';
    
    SELECT COALESCE((value #>> '{}')::int, 20) INTO v_max_per_client_day 
    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';

    SELECT COALESCE((value #>> '{}')::int, 14) INTO v_expiry_days 
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

    -- 6. Send notification to designer
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

    -- 7. Log suggestion event & analytics
    INSERT INTO public.suggestion_events (project_id, designer_id, event_type)
    VALUES (p_project_id, p_designer_id, 'invited');

    PERFORM public.record_analytics_event(p_designer_id, 'invitation_received');

    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', v_new_inv_id
    );
END;
$$;

-- 6. Withdraw Invitation Function (Client)
CREATE OR REPLACE FUNCTION public.withdraw_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.project_invitations
    SET status = 'withdrawn', responded_at = NOW()
    WHERE id = p_invitation_id
      AND client_id = auth.uid()
      AND status IN ('sent', 'viewed');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation_not_found_or_cannot_withdraw' USING ERRCODE = '22023';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Mark Invitation Viewed Function (Designer)
CREATE OR REPLACE FUNCTION public.mark_invitation_viewed(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.project_invitations
    SET status = 'viewed', viewed_at = NOW()
    WHERE id = p_invitation_id
      AND designer_id = auth.uid()
      AND status = 'sent';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Decline Invitation Function (Designer)
CREATE OR REPLACE FUNCTION public.decline_invitation(
    p_invitation_id UUID,
    p_reason_code TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT pi.id, pi.client_id, pi.project_id, pi.designer_id, p.title AS project_title
    INTO v_inv
    FROM public.project_invitations pi
    JOIN public.projects p ON p.id = pi.project_id
    WHERE pi.id = p_invitation_id AND pi.designer_id = auth.uid() AND pi.status IN ('sent', 'viewed');

    IF v_inv IS NULL THEN
        RAISE EXCEPTION 'invitation_not_found' USING ERRCODE = '22023';
    END IF;

    UPDATE public.project_invitations
    SET status = 'declined',
        decline_reason_code = p_reason_code,
        decline_note = TRIM(p_note),
        responded_at = NOW()
    WHERE id = p_invitation_id;

    -- Notify client
    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',
        jsonb_build_object(
            'invitation_id', p_invitation_id,
            'project_id', v_inv.project_id,
            'project_title', v_inv.project_title,
            'reason_code', p_reason_code
        ),
        '/client/projects/' || v_inv.project_id
    );

    PERFORM public.record_analytics_event(v_inv.designer_id, 'invitation_declined');

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Auto-link proposal submission to invitation status
CREATE OR REPLACE FUNCTION public.handle_proposal_invitation_link()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.project_invitations
    SET status = 'proposal_sent', responded_at = NOW()
    WHERE project_id = NEW.project_id 
      AND designer_id = NEW.designer_id
      AND status IN ('sent', 'viewed');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_link_proposal_invitation ON public.proposals;
CREATE TRIGGER trg_link_proposal_invitation
    AFTER INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_proposal_invitation_link();

-- 10. Expire Invitations Scheduled Job Function
CREATE OR REPLACE FUNCTION public.expire_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    FOR r IN
        SELECT pi.id, pi.client_id, pi.designer_id, pi.project_id, p.title AS project_title
        FROM public.project_invitations pi
        JOIN public.projects p ON p.id = pi.project_id
        WHERE pi.status IN ('sent', 'viewed')
          AND (
              pi.expires_at < NOW() 
              OR p.status IN ('closed', 'cancelled', 'completed')
              OR (p.proposal_deadline IS NOT NULL AND p.proposal_deadline < CURRENT_DATE)
          )
    LOOP
        UPDATE public.project_invitations
        SET status = 'expired', responded_at = NOW()
        WHERE id = r.id;

        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',
            jsonb_build_object(
                'invitation_id', r.id,
                'project_id', r.project_id,
                'project_title', r.project_title
            ),
            '/client/projects/' || r.project_id
        );

        v_count := v_count + 1;
    END LOOP;

    -- Audit log entry
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'job_expire_invitations',
        'system',
        '00000000-0000-0000-0000-000000000000'::uuid,
        jsonb_build_object('expired_count', v_count)
    );

    RETURN jsonb_build_object('success', true, 'exp

-- Alias for scheduled background job
CREATE OR REPLACE FUNCTION public.expire_project_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
BEGIN
    RETURN public.expire_invitations();
END;
;ired_count', v_count);
END;
$$;

-- 11. Suggest Designers Function
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
    v_max_active INT;
    v_require_state_license BOOLEAN;
    v_new_boost INT;
    v_results JSONB := '[]'::jsonb;
    v_cand RECORD;
BEGIN
    -- Project lookup and ownership verify
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

    -- Settings
    SELECT COALESCE(value::jsonb, '{"specialization_match":30,"subcategory_portfolio":10,"state_license":25,"same_city":15,"same_state":10,"verified":10,"rating":10,"completed_projects":5}'::jsonb)
    INTO v_weights FROM public.app_settings WHERE key = 'matching_weights';

    SELECT COALESCE((value #>> '{}')::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';
    SELECT COALESCE((value #>> '{}')::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';
    SELECT COALESCE((value #>> '{}')::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';

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
                p.plan_key,
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
                ), 0) AS subcategory_portfolio_count,
                (SELECT dls.licensed_states FROM public.designer_licensed_states dls WHERE dls.designer_id = dp.user_id) AS licensed_states
            FROM public.designer_profiles dp
            JOIN public.profiles p ON p.id = dp.user_id
            JOIN public.plans pl ON pl.key = p.plan_key
            WHERE p.role = 'designer'
              AND pl.directory_listing = true
              AND pl.direct_invitations = true
              AND dp.show_in_search = true
              AND dp.is_available = true
              AND dp.accepts_invitations = true
              AND dp.bio IS NOT NULL
              AND dp.user_id != v_project.client_id
              AND dp.user_id != ALL(COALESCE(p_exclude_ids, ARRAY[]::UUID[]))
              -- Exclude designers who already proposed
              AND NOT EXISTS (
                  SELECT 1 FROM public.proposals prop 
                  WHERE prop.project_id = p_project_id 
                    AND prop.designer_id = dp.user_id 
                    AND prop.status != 'withdrawn'
              )
              -- Exclude active invitations
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status IN ('sent', 'viewed')
              )
              -- Exclude declined invitations
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status = 'declined'
              )
              -- Filter: discipline matches project disciplines if set
              AND (
                  v_project.disciplines IS NULL 
                  OR array_length(v_project.disciplines, 1) IS NULL
                  OR dp.professional_type = ANY(v_project.disciplines)
              )
        ),
        scored_candidates AS (
            SELECT 
                cp.*,
                (
                    -- Specialization match
                    (CASE WHEN cp.matches_category THEN COALESCE((v_weights->>'specialization_match')::int, 30) ELSE 0 END)
                    -- Portfolio in subcategory (10 each, max 20)
                    + LEAST(cp.subcategory_portfolio_count * COALESCE((v_weights->>'subcategory_portfolio')::int, 10), 20)
                    -- State license
                    + (CASE WHEN cp.has_state_license THEN COALESCE((v_weights->>'state_license')::int, 25) ELSE 0 END)
                    -- Location
                    + (CASE 
                        WHEN cp.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(cp.city) = LOWER(v_project.city) THEN COALESCE((v_weights->>'same_city')::int, 15)
                        WHEN cp.state IS NOT NULL AND v_project.state IS NOT NULL AND cp.state = v_project.state THEN COALESCE((v_weights->>'same_state')::int, 10)
                        ELSE 0 
                      END)
                    -- Verified
                    + (CASE WHEN cp.is_verified THEN COALESCE((v_weights->>'verified')::int, 10) ELSE 0 END)
                    -- Rating (scaled to 10 with 3+ reviews)
                    + (CASE WHEN cp.rating_cnt >= 3 THEN ROUND((cp.rating_avg / 5.0) * COALESCE((v_weights->>'rating')::int, 10)) ELSE 0 END)
                    -- Completed projects (scale to 5)
                    + LEAST(ROUND((cp.completed_cnt::numeric / 10.0) * COALESCE((v_weights->>'completed_projects')::int, 5)), 5)
                    -- New designer boost (<90 days)
                    + (CASE WHEN cp.member_since >= NOW() - INTERVAL '90 days' THEN v_new_boost ELSE 0 END)
                    -- Plan boost: Free 0, Basic 5, Upgraded 15
                    + (CASE cp.plan_key WHEN 'upgraded' THEN 15 WHEN 'basic' THEN 5 ELSE 0 END)
                )::int AS match_score,
                -- Deterministic daily tie-break hash
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
            IF v_cand.has_state_license THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'licensed', 'text', 'Licensed in ' || COALESCE(v_project.state, 'state'));
            END IF;
            IF v_cand.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(v_cand.city) = LOWER(v_project.city) THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in ' || v_cand.city);
            ELSIF v_cand.state IS NOT NULL AND v_project.state IS NOT NULL AND v_cand.state = v_project.state THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in ' || v_cand.state);
            END IF;
            IF v_cand.rating_cnt >= 3 THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'rating', 'text', v_cand.rating_avg || ' rating (' || v_cand.rating_cnt || ' reviews)');
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
                'hourly_rate', CASE WHEN v_cand.show_hourly_rate THEN v_cand.hourly_rate ELSE NULL END,
                'rating_average', v_cand.rating_avg,
                'rating_count', v_cand.rating_cnt,
                'completed_projects_count', v_cand.completed_cnt,
                'is_verified', v_cand.is_verified,
                'plan_key', v_cand.plan_key,
                'match_score', v_cand.match_score,
                'reasons', v_reasons,
                'licensed_states', COALESCE(v_cand.licensed_states, ARRAY[]::TEXT[])
            );

            -- Log suggestion impression & designer analytics
            INSERT INTO public.suggestion_events (project_id, designer_id, event_type)
            VALUES (p_project_id, v_cand.user_id, 'shown');

            PERFORM public.record_analytics_event(v_cand.user_id, 'suggestion_appearance');
        END;
    END LOOP;

    RETURN v_results;
END;
$$;

-- 12. Search Designers for Client Function
CREATE OR REPLACE FUNCTION public.search_designers_for_client(
    p_query TEXT DEFAULT NULL,
    p_discipline TEXT DEFAULT NULL,
    p_specialization TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_licensed_in_state TEXT DEFAULT NULL,
    p_min_years INT DEFAULT NULL,
    p_min_rating NUMERIC DEFAULT NULL,
    p_verified_only BOOLEAN DEFAULT FALSE,
    p_available_only BOOLEAN DEFAULT FALSE,
    p_sort TEXT DEFAULT 'best_match',
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total INT;
    v_rows JSONB := '[]'::jsonb;
    v_label_mode TEXT;
    v_rec RECORD;
BEGIN
    SELECT COALESCE(value #>> '{}', 'label') INTO v_label_mode FROM public.app_settings WHERE key = 'priority_label_mode';

    -- Query from public_designer_profiles (strictly enforces directory_listing = true)
    WITH filtered AS (
        SELECT 
            pdp.*,
            (CASE pdp.plan_key WHEN 'upgraded' THEN 15 WHEN 'basic' THEN 5 ELSE 0 END) AS plan_boost,
            CASE 
                WHEN p_project_id IS NOT NULL THEN (
                    SELECT cr.issuing_state IS NOT NULL
                    FROM public.projects proj
                    LEFT JOIN public.credentials cr ON cr.designer_id = pdp.user_id 
                        AND cr.issuing_state = proj.state 
                        AND cr.status = 'verified' 
                        AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                    WHERE proj.id = p_project_id
                    LIMIT 1
                )
                ELSE false
            END AS licensed_in_project_state
        FROM public.public_designer_profiles pdp
        WHERE (p_query IS NULL OR (
            pdp.full_name ILIKE '%' || p_query || '%' OR
            pdp.studio_name ILIKE '%' || p_query || '%' OR
            pdp.title ILIKE '%' || p_query || '%' OR
            pdp.city ILIKE '%' || p_query || '%'
        ))
        AND (p_discipline IS NULL OR pdp.professional_type::text = p_discipline)
        AND (p_specialization IS NULL OR p_specialization = ANY(pdp.specializations))
        AND (p_state IS NULL OR pdp.state = p_state)
        AND (p_city IS NULL OR pdp.city ILIKE '%' || p_city || '%')
        AND (p_licensed_in_state IS NULL OR p_licensed_in_state = ANY(pdp.licensed_states))
        AND (p_min_years IS NULL OR pdp.years_experience >= p_min_years)
        AND (p_min_rating IS NULL OR pdp.rating_average >= p_min_rating)
        AND (NOT p_verified_only OR pdp.verified = true)
        AND (NOT p_available_only OR pdp.is_available = true)
    )
    SELECT COUNT(*) INTO v_total FROM filtered;

    FOR v_rec IN
        SELECT f.*,
               CASE WHEN f.plan_boost > 0 AND v_label_mode = 'label' THEN true ELSE false END AS is_promoted
        FROM filtered f
        ORDER BY
            CASE WHEN p_sort = 'rating' THEN f.rating_average END DESC NULLS LAST,
            CASE WHEN p_sort = 'experience' THEN f.years_experience END DESC NULLS LAST,
            CASE WHEN p_sort = 'newest' THEN f.member_since END DESC NULLS LAST,
            -- Default best_match: weighted rank + plan boost
            (f.rating_average * 10 + f.years_experience + f.plan_boost) DESC
        LIMIT p_limit OFFSET p_offset
    LOOP
        v_rows := v_rows || jsonb_build_object(
            'designer_id', v_rec.user_id,
            'full_name', v_rec.full_name,
            'avatar_path', v_rec.avatar_path,
            'discipline', v_rec.professional_type,
            'title', v_rec.title,
            'studio_name', v_rec.studio_name,
            'bio', v_rec.bio,
            'specializations', v_rec.specializations,
            'city', v_rec.city,
            'state', v_rec.state,
            'years_experience', v_rec.years_experience,
            'hourly_rate', CASE WHEN v_rec.show_hourly_rate THEN v_rec.hourly_rate ELSE NULL END,
            'rating_average', v_rec.rating_average,
            'rating_count', v_rec.rating_count,
            'is_verified', v_rec.verified,
            'is_available', v_rec.is_available,
            'accepts_invitations', v_rec.accepts_invitations,
            'licensed_states', v_rec.licensed_states,
            'is_promoted', v_rec.is_promoted,
            'plan_key', v_rec.plan_key
        );

        -- Record search appearance in analytics
        PERFORM public.record_analytics_event(v_rec.user_id, 'search_appearance');
    END LOOP;

    RETURN jsonb_build_object(
        'total', v_total,
        'page', (p_offset / p_limit) + 1,
        'limit', p_limit,
        'results', v_rows
    );
END;
$$;

-- 13. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_designer_specializations_gin ON public.designer_profiles USING GIN(specializations);
CREATE INDEX IF NOT EXISTS idx_designer_state ON public.designer_profiles(state);
CREATE INDEX IF NOT EXISTS idx_designer_city ON public.designer_profiles(city);
CREATE INDEX IF NOT EXISTS idx_designer_available_search ON public.designer_profiles(user_id) WHERE show_in_search = true AND is_available = true;
