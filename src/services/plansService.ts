/**
 * Membership Plans & Platform Service Fee Service
 * Single source of truth for Plan tiers, limits, and platform fee calculations
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import { sharedDataset } from '../mocks/dataset';
import { setDesignerPlan } from './designerProfileService';
import { getPaymentsSettings, PROGRESSIVE_FEE_TEXT } from '../config/paymentsConfig';

export interface Plan {
  id: string;
  key: 'free' | 'basic' | 'gold' | 'upgraded';
  name: string;
  monthly_price_cents: number;
  yearly_price_cents: number;
  monthly_proposal_limit: number | null; // null = unlimited
  portfolio_project_limit: number | null; // null = unlimited
  images_per_portfolio_project: number;
  directory_listing: boolean;
  public_profile: boolean;
  portfolio_enabled: boolean;
  direct_invitations: boolean;
  verification_eligible: boolean;
  search_priority: boolean;
  analytics_level: 'basic' | 'profile_views' | 'full';
  profile_page_level: 'listing' | 'portfolio' | 'enhanced';
  studio_url: boolean;
  sort_order: number;
  member_badge?: boolean;
  studio_insights?: boolean;
}

export interface ComplimentaryPlanGrant {
  id: string;
  user_id: string;
  plan_key: 'free' | 'basic' | 'gold';
  reason?: string;
  created_at: string;
  expires_at?: string | null;
}

export interface PlanFeeTier {
  id: string;
  plan_key: 'free' | 'basic' | 'gold';
  from_amount_cents: number;
  rate_percent: number;
  sort_order: number;
}

export interface PlatformFeeResult {
  plan_key: string;
  amount_cents: number;
  cumulative_before_cents?: number;
  cumulative_after_cents?: number;
  fee_cents: number;
  net_cents: number;
  fee_dollars: number;
  net_dollars: number;
  rate_percent: number; // effective rate percent
  breakdown: Array<{
    from_amount_cents: number;
    rate_percent: number;
    taxable_amount_cents: number;
    fee_cents: number;
  }>;
  fee_schedule_snapshot?: FeeScheduleSnapshot;
}

export interface FeeScheduleSnapshot {
  version: string;
  fee_tier_mode: string;
  fee_basis: string;
  plan_fee_discount_enabled: boolean;
  fee_deducted_from_payout: boolean;
  processing_fee_bearer: string;
  reimbursables_excluded_from_commission: boolean;
  third_party_consultant_passthrough_excluded: boolean;
  subscription_affects_commission: boolean;
  tiers: Array<{ from_amount_cents: number; rate_percent: number }>;
}

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan-1',
    key: 'free',
    name: 'Free',
    monthly_price_cents: 0,
    yearly_price_cents: 0,
    monthly_proposal_limit: 3,
    portfolio_project_limit: 3,
    images_per_portfolio_project: 10,
    directory_listing: true,
    public_profile: true,
    portfolio_enabled: true,
    direct_invitations: false,
    verification_eligible: true,
    search_priority: false,
    analytics_level: 'basic',
    profile_page_level: 'listing',
    studio_url: false,
    sort_order: 1
  },
  {
    id: 'plan-2',
    key: 'basic',
    name: 'Basic',
    monthly_price_cents: 1900,
    yearly_price_cents: 19000,
    monthly_proposal_limit: 15,
    portfolio_project_limit: 12,
    images_per_portfolio_project: 10,
    directory_listing: true,
    public_profile: true,
    portfolio_enabled: true,
    direct_invitations: true,
    verification_eligible: true,
    search_priority: false,
    analytics_level: 'profile_views',
    profile_page_level: 'portfolio',
    studio_url: false,
    sort_order: 2
  },
  {
    id: 'plan-3',
    key: 'gold',
    name: 'Gold',
    monthly_price_cents: 4900,
    yearly_price_cents: 49000,
    monthly_proposal_limit: null,
    portfolio_project_limit: null,
    images_per_portfolio_project: 10,
    directory_listing: true,
    public_profile: true,
    portfolio_enabled: true,
    direct_invitations: true,
    verification_eligible: true,
    search_priority: true,
    analytics_level: 'full',
    profile_page_level: 'enhanced',
    studio_url: true,
    sort_order: 3
  }
];

export const PROGRESSIVE_TIER_CONFIG = [
  { from_amount_cents: 0, rate_percent: 10.0, sort_order: 1 },
  { from_amount_cents: 250000, rate_percent: 7.5, sort_order: 2 },
  { from_amount_cents: 500000, rate_percent: 5.0, sort_order: 3 },
  { from_amount_cents: 1000000, rate_percent: 3.5, sort_order: 4 },
  { from_amount_cents: 2000000, rate_percent: 2.5, sort_order: 5 }
];

export const DEFAULT_PLAN_FEE_TIERS: PlanFeeTier[] = [
  ...PROGRESSIVE_TIER_CONFIG.map((t, i) => ({
    id: `tier-free-${i + 1}`,
    plan_key: 'free' as const,
    ...t
  })),
  ...PROGRESSIVE_TIER_CONFIG.map((t, i) => ({
    id: `tier-basic-${i + 1}`,
    plan_key: 'basic' as const,
    ...t
  })),
  ...PROGRESSIVE_TIER_CONFIG.map((t, i) => ({
    id: `tier-gold-${i + 1}`,
    plan_key: 'gold' as const,
    ...t
  }))
];

// In-memory working copies for mock/demo mode
let mockPlansStore: Plan[] = JSON.parse(JSON.stringify(DEFAULT_PLANS));
let mockFeeTiersStore: PlanFeeTier[] = JSON.parse(JSON.stringify(DEFAULT_PLAN_FEE_TIERS));
let mockComplimentaryGrants: ComplimentaryPlanGrant[] = [];

/**
 * Computes the effective plan for a user (highest of paid subscription and active complimentary grant)
 */
export function getEffectivePlan(
  paidPlan: string = 'free',
  activeGrant?: { plan_key: string; expires_at?: string | null } | null
): 'free' | 'basic' | 'gold' {
  const normalizedPaid = paidPlan === 'upgraded' ? 'gold' : paidPlan;
  const rankMap: Record<string, number> = {
    gold: 3,
    basic: 2,
    free: 1
  };

  const paidRank = rankMap[normalizedPaid] || 1;
  let grantRank = 0;
  let grantKey: 'free' | 'basic' | 'gold' = 'free';

  if (activeGrant) {
    const isExpired = activeGrant.expires_at ? new Date(activeGrant.expires_at).getTime() < Date.now() : false;
    if (!isExpired) {
      const normalizedGrant = activeGrant.plan_key === 'upgraded' ? 'gold' : activeGrant.plan_key;
      grantRank = rankMap[normalizedGrant] || 0;
      grantKey = (normalizedGrant as 'free' | 'basic' | 'gold') || 'free';
    }
  }

  if (grantRank > paidRank) {
    return grantKey;
  }

  const safePaid: 'free' | 'basic' | 'gold' =
    normalizedPaid === 'gold' ? 'gold' :
    normalizedPaid === 'basic' ? 'basic' : 'free';

  return safePaid;
}

/**
 * Fetch snapshot of current active fee schedule
 */
export function getCurrentFeeScheduleSnapshot(): FeeScheduleSnapshot {
  const settings = getPaymentsSettings();
  return {
    version: '2026.11-progressive',
    fee_tier_mode: settings.fee_tier_mode,
    fee_basis: settings.fee_basis,
    plan_fee_discount_enabled: settings.plan_fee_discount_enabled,
    fee_deducted_from_payout: settings.fee_deducted_from_payout,
    processing_fee_bearer: settings.processing_fee_bearer,
    reimbursables_excluded_from_commission: settings.reimbursables_excluded_from_commission,
    third_party_consultant_passthrough_excluded: settings.third_party_consultant_passthrough_excluded,
    subscription_affects_commission: settings.subscription_affects_commission,
    tiers: PROGRESSIVE_TIER_CONFIG.map(t => ({
      from_amount_cents: t.from_amount_cents,
      rate_percent: t.rate_percent
    }))
  };
}

/**
 * Fetch all available membership plans
 */
export async function getPlans(): Promise<Plan[]> {
  if (USE_MOCKS.projects) {
    return JSON.parse(JSON.stringify(mockPlansStore));
  }

  try {
    const { data, error } = await (supabase.from as any)('plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return JSON.parse(JSON.stringify(mockPlansStore));
    }

    return (data as any[]).map(p => ({
      ...p,
      key: p.key === 'upgraded' ? 'gold' : p.key
    })) as Plan[];
  } catch {
    return JSON.parse(JSON.stringify(mockPlansStore));
  }
}

/**
 * Fetch all available fee tiers
 */
export async function getPlanFeeTiers(): Promise<PlanFeeTier[]> {
  if (USE_MOCKS.projects) {
    return JSON.parse(JSON.stringify(mockFeeTiersStore));
  }

  try {
    const { data, error } = await (supabase.from as any)('plan_fee_tiers')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return JSON.parse(JSON.stringify(mockFeeTiersStore));
    }

    return (data as any[]).map(t => ({
      ...t,
      plan_key: t.plan_key === 'upgraded' ? 'gold' : t.plan_key
    })) as PlanFeeTier[];
  } catch {
    return JSON.parse(JSON.stringify(mockFeeTiersStore));
  }
}

/**
 * Update in-memory mock plan (used in Admin Plan editor)
 */
export function updateMockPlan(key: string, updates: Partial<Plan>): Plan {
  const normalizedKey = key === 'upgraded' ? 'gold' : key;
  const plan = mockPlansStore.find(p => p.key === normalizedKey);
  if (!plan) throw new Error(`Plan with key ${key} not found.`);
  Object.assign(plan, updates);
  return { ...plan };
}

/**
 * Update in-memory mock fee tiers for a plan
 */
export function updateMockFeeTiers(
  planKey: 'free' | 'basic' | 'gold' | 'upgraded',
  tiers: Array<{ from_amount_cents: number; rate_percent: number; sort_order?: number }>
): PlanFeeTier[] {
  const normalizedKey = (planKey === 'upgraded' ? 'gold' : planKey) as 'free' | 'basic' | 'gold';
  // Remove existing tiers for this plan
  mockFeeTiersStore = mockFeeTiersStore.filter(t => t.plan_key !== normalizedKey);

  // Add new tiers
  const newTiers: PlanFeeTier[] = tiers.map((t, idx) => ({
    id: `tier-${normalizedKey}-${Date.now()}-${idx}`,
    plan_key: normalizedKey,
    from_amount_cents: t.from_amount_cents,
    rate_percent: t.rate_percent,
    sort_order: t.sort_order ?? idx + 1
  }));

  mockFeeTiersStore.push(...newTiers);
  return newTiers;
}

/**
 * Computes human-readable exact tiered schedule description
 */
export function getTieredScheduleDescription(
  _planKey?: string,
  _customTiers?: PlanFeeTier[]
): string {
  return PROGRESSIVE_FEE_TEXT;
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
  const normalizedPlanKey = planKey === 'upgraded' ? 'gold' : planKey;
  try {
    const { data, error } = await (supabase.rpc as any)('calculate_platform_fee', {
      p_plan_key: normalizedPlanKey,
      p_amount_cents: amountCents,
      p_cumulative_before_cents: cumulativeBeforeCents
    });

    if (error || !data) {
      return calculatePlatformFeeFallback(normalizedPlanKey, amountCents, cumulativeBeforeCents);
    }

    return (data as unknown) as PlatformFeeResult;
  } catch {
    return calculatePlatformFeeFallback(normalizedPlanKey, amountCents, cumulativeBeforeCents);
  }
}

/**
 * Client-side fallback for platform service fee calculation
 * Strictly adheres to progressive scale (marginal tiers + cumulative_project basis by default)
 */
export function calculatePlatformFeeFallback(
  planKey: string,
  amountCents: number,
  cumulativeBeforeCents: number = 0,
  customTiers?: PlanFeeTier[],
  modeOverride?: 'marginal' | 'whole_amount',
  basisOverride?: 'cumulative_project' | 'per_milestone'
): PlatformFeeResult {
  const normalizedPlanKey = planKey === 'upgraded' ? 'gold' : planKey;
  const settings = getPaymentsSettings();
  const mode = modeOverride || settings.fee_tier_mode;
  const basis = basisOverride || settings.fee_basis;

  if (amountCents <= 0) {
    return {
      plan_key: normalizedPlanKey,
      amount_cents: 0,
      cumulative_before_cents: cumulativeBeforeCents,
      cumulative_after_cents: cumulativeBeforeCents,
      fee_cents: 0,
      net_cents: 0,
      fee_dollars: 0.00,
      net_dollars: 0.00,
      rate_percent: 0.0,
      breakdown: [],
      fee_schedule_snapshot: getCurrentFeeScheduleSnapshot()
    };
  }

  // Retrieve tiers for plan
  let rawTiers = (customTiers || mockFeeTiersStore).filter(t => t.plan_key === normalizedPlanKey);
  if (rawTiers.length === 0) {
    rawTiers = DEFAULT_PLAN_FEE_TIERS.filter(t => t.plan_key === 'free');
  }
  const tiers = [...rawTiers].sort((a, b) => a.from_amount_cents - b.from_amount_cents);

  if (mode === 'marginal') {
    const cumBefore = basis === 'cumulative_project' ? Math.max(0, cumulativeBeforeCents) : 0;
    const cumAfter = cumBefore + amountCents;

    let totalFeeCents = 0;
    const breakdown: PlatformFeeResult['breakdown'] = [];

    for (let i = 0; i < tiers.length; i++) {
      const tierStart = tiers[i].from_amount_cents;
      const tierEnd = i + 1 < tiers.length ? tiers[i + 1].from_amount_cents : Infinity;

      const sliceStart = Math.max(cumBefore, tierStart);
      const sliceEnd = Math.min(cumAfter, tierEnd);
      const sliceAmount = Math.max(0, sliceEnd - sliceStart);

      if (sliceAmount > 0) {
        const sliceFee = Math.round((sliceAmount * tiers[i].rate_percent) / 100);
        totalFeeCents += sliceFee;
        breakdown.push({
          from_amount_cents: tierStart,
          rate_percent: tiers[i].rate_percent,
          taxable_amount_cents: sliceAmount,
          fee_cents: sliceFee
        });
      }
    }

    const netCents = amountCents - totalFeeCents;
    const effectiveRate = Number(((totalFeeCents / amountCents) * 100).toFixed(2));

    return {
      plan_key: normalizedPlanKey,
      amount_cents: amountCents,
      cumulative_before_cents: cumBefore,
      cumulative_after_cents: cumAfter,
      fee_cents: totalFeeCents,
      net_cents: netCents,
      fee_dollars: Number((totalFeeCents / 100).toFixed(2)),
      net_dollars: Number((netCents / 100).toFixed(2)),
      rate_percent: effectiveRate,
      breakdown,
      fee_schedule_snapshot: getCurrentFeeScheduleSnapshot()
    };
  } else {
    // whole_amount mode fallback
    const targetAmount = basis === 'cumulative_project'
      ? Math.max(0, cumulativeBeforeCents) + amountCents
      : amountCents;

    const descTiers = [...tiers].sort((a, b) => b.from_amount_cents - a.from_amount_cents);
    const match = descTiers.find(t => targetAmount > t.from_amount_cents);
    const chosenRate = match ? match.rate_percent : descTiers[descTiers.length - 1].rate_percent;

    const feeCents = Math.round((amountCents * chosenRate) / 100);
    const netCents = amountCents - feeCents;

    return {
      plan_key: normalizedPlanKey,
      amount_cents: amountCents,
      cumulative_before_cents: cumulativeBeforeCents,
      cumulative_after_cents: cumulativeBeforeCents + amountCents,
      fee_cents: feeCents,
      net_cents: netCents,
      fee_dollars: Number((feeCents / 100).toFixed(2)),
      net_dollars: Number((netCents / 100).toFixed(2)),
      rate_percent: chosenRate,
      breakdown: [
        {
          from_amount_cents: 0,
          rate_percent: chosenRate,
          taxable_amount_cents: amountCents,
          fee_cents: feeCents
        }
      ],
      fee_schedule_snapshot: getCurrentFeeScheduleSnapshot()
    };
  }
}

/**
 * Refund calculation helper
 */
export function calculateRefundAdjustment(
  originalPaymentCents: number,
  originalFeeCents: number,
  refundAmountCents: number
): { refundedFeeCents: number; netRefundDeductionCents: number } {
  if (originalPaymentCents <= 0 || refundAmountCents <= 0) {
    return { refundedFeeCents: 0, netRefundDeductionCents: 0 };
  }
  const ratio = Math.min(1, refundAmountCents / originalPaymentCents);
  const refundedFeeCents = Math.round(originalFeeCents * ratio);
  return {
    refundedFeeCents,
    netRefundDeductionCents: refundAmountCents - refundedFeeCents
  };
}

/**
 * Grant a complimentary plan to a user
 */
export async function grantComplimentaryPlan(
  userId: string,
  planKey: 'free' | 'basic' | 'gold',
  reason?: string,
  expiresAt?: string | null
): Promise<ComplimentaryPlanGrant> {
  const grant: ComplimentaryPlanGrant = {
    id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    user_id: userId,
    plan_key: planKey,
    reason: reason || 'Admin grant',
    created_at: new Date().toISOString(),
    expires_at: expiresAt || null
  };

  mockComplimentaryGrants.push(grant);

  if (!USE_MOCKS.profiles) {
    try {
      await (supabase.from as any)('complimentary_plan_grants').insert({
        user_id: userId,
        plan_key: planKey,
        reason: grant.reason,
        expires_at: grant.expires_at
      });
    } catch (e) {
      console.warn('DB complimentary grant insert failed, saved in mock store:', e);
    }
  }

  return grant;
}

/**
 * Dev-only function to switch a designer's plan (blocked in production)
 */
export async function devSwitchDesignerPlan(
  designerId: string,
  newPlanKey: 'free' | 'basic' | 'gold' | 'upgraded'
): Promise<boolean> {
  const normalizedKey = (newPlanKey === 'gold' ? 'upgraded' : newPlanKey) as 'free' | 'basic' | 'upgraded';
  setDesignerPlan(designerId, normalizedKey);
  if (sharedDataset && sharedDataset.planState) {
    sharedDataset.planState.currentPlanId = normalizedKey;
  }

  if (!USE_MOCKS.profiles) {
    try {
      const { data: res1, error: err1 } = await (supabase.rpc as any)('switch_designer_plan_dev', {
        p_designer_id: designerId,
        p_new_plan_key: normalizedKey
      });

      if (!err1 && res1) return true;

      const { data: res2, error: err2 } = await (supabase.rpc as any)('dev_switch_designer_plan', {
        p_designer_id: designerId,
        p_new_plan_key: normalizedKey
      });

      if (!err2 && res2) return true;
    } catch (err) {
      console.warn('RPC plan switch failed, updated local state:', err);
    }
  }

  return true;
}
