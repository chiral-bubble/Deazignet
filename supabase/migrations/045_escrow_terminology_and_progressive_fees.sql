-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - ESCROW TERMINOLOGY & PROGRESSIVE FEES
-- 045_escrow_terminology_and_progressive_fees.sql
-- 1. payments_terminology_approved setting flag (default false)
-- 2. Progressive Platform Fee Schedule (10% to $2.5k, 7.5% to $5k, 5% to $10k, 3.5% to $20k, 2.5% above)
-- 3. Marginal calculation on cumulative project basis: f(cum_after) - f(cum_before)
-- 4. Transaction & invoice fee schedule version snapshotting
-- ==============================================================================

-- 1. App settings for terminology & progressive platform fee parameters
INSERT INTO public.app_settings (key, value) VALUES
('payments_terminology_approved', 'false'),
('fee_tier_mode', 'marginal'),
('fee_basis', 'cumulative_project'),
('plan_fee_discount_enabled', 'false'),
('fee_deducted_from_payout', 'true'),
('processing_fee_bearer', 'undecided'),
('reimbursables_excluded_from_commission', 'true'),
('third_party_consultant_passthrough_excluded', 'true'),
('subscription_affects_commission', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 2. Progressive Platform Fee Tiers Table Update
-- Tiers (same for every plan: free, basic, upgraded):
-- 0 to $2,500 (250,000 cents): 10%
-- $2,500 to $5,000 (500,000 cents): 7.5%
-- $5,000 to $10,000 (1,000,000 cents): 5%
-- $10,000 to $20,000 (2,000,000 cents): 3.5%
-- $20,000 and above: 2.5%
DELETE FROM public.plan_fee_tiers;
INSERT INTO public.plan_fee_tiers (plan_key, from_amount_cents, rate_percent, sort_order) VALUES
('free', 0, 10.00, 1),
('free', 250000, 7.50, 2),
('free', 500000, 5.00, 3),
('free', 1000000, 3.50, 4),
('free', 2000000, 2.50, 5),
('basic', 0, 10.00, 1),
('basic', 250000, 7.50, 2),
('basic', 500000, 5.00, 3),
('basic', 1000000, 3.50, 4),
('basic', 2000000, 2.50, 5),
('upgraded', 0, 10.00, 1),
('upgraded', 250000, 7.50, 2),
('upgraded', 500000, 5.00, 3),
('upgraded', 1000000, 3.50, 4),
('upgraded', 2000000, 2.50, 5);

-- 3. Calculate Platform Fee Function
-- Single source of truth for platform service fee calculation
-- Charged on actual payments: fee on a payment is f(cumulative_after) - f(cumulative_before)
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
    v_cum_before BIGINT := 0;
    v_cum_after BIGINT := 0;
    v_fee_cents BIGINT := 0;
    v_net_cents BIGINT := 0;
    v_effective_rate NUMERIC(5,2) := 0.00;
    v_breakdown JSONB := '[]'::jsonb;
    v_snapshot JSONB;
BEGIN
    IF p_amount_cents <= 0 THEN
        RETURN jsonb_build_object(
            'plan_key', p_plan_key,
            'amount_cents', 0,
            'cumulative_before_cents', p_cumulative_before_cents,
            'cumulative_after_cents', p_cumulative_before_cents,
            'fee_cents', 0,
            'net_cents', 0,
            'fee_dollars', 0.00,
            'net_dollars', 0.00,
            'rate_percent', 0.0,
            'breakdown', '[]'::jsonb,
            'fee_schedule_snapshot', jsonb_build_object(
                'version', '2026.11-progressive',
                'fee_tier_mode', 'marginal',
                'fee_basis', 'cumulative_project'
            )
        );
    END IF;

    -- Fetch mode and basis
    SELECT COALESCE(value, 'marginal') INTO v_mode FROM public.app_settings WHERE key = 'fee_tier_mode';
    SELECT COALESCE(value, 'cumulative_project') INTO v_basis FROM public.app_settings WHERE key = 'fee_basis';

    IF v_basis = 'cumulative_project' OR v_basis = 'cumulative' THEN
        v_cum_before := GREATEST(0, p_cumulative_before_cents);
    ELSE
        v_cum_before := 0;
    END IF;
    v_cum_after := v_cum_before + p_amount_cents;

    IF v_mode = 'marginal' THEN
        DECLARE
            t RECORD;
            v_tier_start BIGINT;
            v_tier_end BIGINT;
            v_slice_start BIGINT;
            v_slice_end BIGINT;
            v_slice_amount BIGINT;
            v_slice_fee BIGINT;
            v_total_fee BIGINT := 0;
        BEGIN
            FOR t IN
                SELECT from_amount_cents, rate_percent,
                       LEAD(from_amount_cents) OVER (ORDER BY from_amount_cents ASC) AS next_from
                FROM public.plan_fee_tiers
                WHERE plan_key = p_plan_key
                ORDER BY from_amount_cents ASC
            LOOP
                v_tier_start := t.from_amount_cents;
                v_tier_end := COALESCE(t.next_from, 9223372036854775807);

                -- Overlap of [v_cum_before, v_cum_after] with [v_tier_start, v_tier_end]
                v_slice_start := GREATEST(v_cum_before, v_tier_start);
                v_slice_end := LEAST(v_cum_after, v_tier_end);
                v_slice_amount := GREATEST(0, v_slice_end - v_slice_start);

                IF v_slice_amount > 0 THEN
                    v_slice_fee := ROUND((v_slice_amount::NUMERIC * t.rate_percent) / 100.0);
                    v_total_fee := v_total_fee + v_slice_fee;
                    v_breakdown := v_breakdown || jsonb_build_object(
                        'from_amount_cents', t.from_amount_cents,
                        'rate_percent', t.rate_percent,
                        'taxable_amount_cents', v_slice_amount,
                        'fee_cents', v_slice_fee
                    );
                END IF;
            END LOOP;

            v_fee_cents := v_total_fee;
        END;
    ELSE
        -- whole_amount mode fallback
        DECLARE
            v_chosen_rate NUMERIC(5,2);
        BEGIN
            SELECT rate_percent INTO v_chosen_rate
            FROM public.plan_fee_tiers
            WHERE plan_key = p_plan_key AND from_amount_cents < v_cum_after
            ORDER BY from_amount_cents DESC
            LIMIT 1;

            IF v_chosen_rate IS NULL THEN
                SELECT rate_percent INTO v_chosen_rate
                FROM public.plan_fee_tiers
                WHERE plan_key = p_plan_key
                ORDER BY from_amount_cents ASC
                LIMIT 1;
            END IF;

            v_fee_cents := ROUND((p_amount_cents::NUMERIC * v_chosen_rate) / 100.0);
            v_breakdown := jsonb_build_array(
                jsonb_build_object(
                    'from_amount_cents', 0,
                    'rate_percent', v_chosen_rate,
                    'taxable_amount_cents', p_amount_cents,
                    'fee_cents', v_fee_cents
                )
            );
        END;
    END IF;

    v_net_cents := p_amount_cents - v_fee_cents;
    v_effective_rate := ROUND(((v_fee_cents::NUMERIC / p_amount_cents::NUMERIC) * 100.0), 2);

    v_snapshot := jsonb_build_object(
        'version', '2026.11-progressive',
        'fee_tier_mode', v_mode,
        'fee_basis', v_basis,
        'fee_deducted_from_payout', true,
        'processing_fee_bearer', 'undecided',
        'reimbursables_excluded_from_commission', true,
        'third_party_consultant_passthrough_excluded', true,
        'subscription_affects_commission', false
    );

    RETURN jsonb_build_object(
        'plan_key', p_plan_key,
        'amount_cents', p_amount_cents,
        'cumulative_before_cents', v_cum_before,
        'cumulative_after_cents', v_cum_after,
        'fee_cents', v_fee_cents,
        'net_cents', v_net_cents,
        'fee_dollars', ROUND((v_fee_cents::NUMERIC / 100.0), 2),
        'net_dollars', ROUND((v_net_cents::NUMERIC / 100.0), 2),
        'rate_percent', v_effective_rate,
        'breakdown', v_breakdown,
        'fee_schedule_snapshot', v_snapshot
    );
END;
$$;

-- 4. Ensure fee schedule snapshot & version on contracts, engagements, and invoices
ALTER TABLE public.contracts
    ADD COLUMN IF NOT EXISTS fee_schedule_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS fee_schedule_version TEXT DEFAULT '2026.11-progressive';

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'engagements'
    ) THEN
        ALTER TABLE public.engagements
            ADD COLUMN IF NOT EXISTS fee_schedule_snapshot JSONB,
            ADD COLUMN IF NOT EXISTS fee_schedule_version TEXT DEFAULT '2026.11-progressive';
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invoices'
    ) THEN
        ALTER TABLE public.invoices
            ADD COLUMN IF NOT EXISTS fee_schedule_snapshot JSONB,
            ADD COLUMN IF NOT EXISTS fee_schedule_version TEXT DEFAULT '2026.11-progressive';
    END IF;
END $$;
