/**
 * Membership Plans & Platform Service Fee Service
 * Single source of truth for Plan tiers, limits, and platform fee calculations
 */

import { supabase } from '../lib/supabase';

export interface Plan {
  id: string;
  key: 'free' | 'basic' | 'upgraded';
  name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  monthly_proposal_limit: number | null; // null = unlimited
  images_per_portfolio_project: number;
  directory_listing: boolean;
  public_profile: boolean;
  portfolio_enabled: boolean;
  direct_invitations: boolean;
  verified_badge: boolean;
  studio_insights: boolean;
  studio_url: boolean;
  sort_order: number;
}

export interface PlatformFeeResult {
  plan_key: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  fee_dollars: number;
  net_dollars: number;
  rate_percent: number;
  breakdown: Array<{
    from_amount_cents: number;
    rate_percent: number;
    taxable_amount_cents: number;
    fee_cents: number;
  }>;
}

/**
 * Fetch all available membership plans
 */
export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await (supabase.from as any)('plans')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error || !data || data.length === 0) {
    // Return standard fallback if database is loading
    return [
      {
        id: '1',
        key: 'free',
        name: 'Free',
        monthly_price_cents: 0,
        yearly_price_cents: 0,
        monthly_proposal_limit: 5,
        images_per_portfolio_project: 0,
        directory_listing: false,
        public_profile: false,
        portfolio_enabled: false,
        direct_invitations: false,
        verified_badge: false,
        studio_insights: false,
        studio_url: false,
        sort_order: 1
      },
      {
        id: '2',
        key: 'basic',
        name: 'Basic',
        monthly_price_cents: 2999,
        yearly_price_cents: 29900,
        monthly_proposal_limit: 10,
        images_per_portfolio_project: 2,
        directory_listing: true,
        public_profile: true,
        portfolio_enabled: true,
        direct_invitations: true,
        verified_badge: true,
        studio_insights: false,
        studio_url: false,
        sort_order: 2
      },
      {
        id: '3',
        key: 'upgraded',
        name: 'Upgraded',
        monthly_price_cents: 4999,
        yearly_price_cents: 49900,
        monthly_proposal_limit: null,
        images_per_portfolio_project: 12,
        directory_listing: true,
        public_profile: true,
        portfolio_enabled: true,
        direct_invitations: true,
        verified_badge: true,
        studio_insights: true,
        studio_url: true,
        sort_order: 3
      }
    ];
  }

  return data as Plan[];
}

/**
 * Computes annual savings percent dynamically from monthly and yearly prices
 */
export function computeAnnualSavings(monthlyCents: number, yearlyCents: number): number {
  if (monthlyCents <= 0 || yearlyCents <= 0) return 0;
  const fullYearlyFromMonthly = monthlyCents * 12;
  const savings = Math.round(((fullYearlyFromMonthly - yearlyCents) / fullYearlyFromMonthly) * 100);
  return Math.max(0, savings);
}

/**
 * Calculate platform fee via PostgreSQL security definer RPC
 */
export async function calculatePlatformFee(
  planKey: string,
  amountCents: number,
  cumulativeBeforeCents: number = 0
): Promise<PlatformFeeResult> {
  try {
    const { data, error } = await (supabase.rpc as any)('calculate_platform_fee', {
      p_plan_key: planKey,
      p_amount_cents: amountCents,
      p_cumulative_before_cents: cumulativeBeforeCents
    });

    if (error || !data) {
      return calculatePlatformFeeFallback(planKey, amountCents);
    }

    return (data as unknown) as PlatformFeeResult;
  } catch {
    return calculatePlatformFeeFallback(planKey, amountCents);
  }
}

/**
 * Client-side fallback for platform service fee calculation
 * Strictly matches database whole_amount logic
 */
export function calculatePlatformFeeFallback(planKey: string, amountCents: number): PlatformFeeResult {
  let rate = 10.0;
  if (planKey === 'free') {
    // strictly greater than $5,000 (500,000 cents) drops to 5%
    rate = amountCents > 500000 ? 5.0 : 10.0;
  } else if (planKey === 'basic') {
    // strictly greater than $20,000 drops to 2.5%
    rate = amountCents > 2000000 ? 2.5 : 5.0;
  } else if (planKey === 'upgraded') {
    // strictly greater than $20,000 drops to 2.0%
    rate = amountCents > 2000000 ? 2.0 : 4.0;
  }

  const feeCents = Math.round((amountCents * rate) / 100);
  const netCents = amountCents - feeCents;

  return {
    plan_key: planKey,
    amount_cents: amountCents,
    fee_cents: feeCents,
    net_cents: netCents,
    fee_dollars: Math.round(feeCents) / 100,
    net_dollars: Math.round(netCents) / 100,
    rate_percent: rate,
    breakdown: [
      {
        from_amount_cents: 0,
        rate_percent: rate,
        taxable_amount_cents: amountCents,
        fee_cents: feeCents
      }
    ]
  };
}

/**
 * Dev-only function to switch a designer's plan (blocked in production)
 */
export async function devSwitchDesignerPlan(designerId: string, newPlanKey: string): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)('dev_switch_designer_plan', {
    p_designer_id: designerId,
    p_new_plan_key: newPlanKey
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as any)?.success === true;
}

