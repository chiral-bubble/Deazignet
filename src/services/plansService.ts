/**
 * Membership Plans & Platform Service Fee Service
 * Single source of truth for Plan tiers, limits, and platform fee calculations
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import { sharedDataset } from '../mocks/dataset';
import { setDesignerPlan } from './designerProfileService';
import { formatMoney } from '../utils/formatters';

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
  member_badge: boolean;
  studio_insights: boolean;
  studio_url: boolean;
  sort_order: number;
}

export interface PlanFeeTier {
  id: string;
  plan_key: 'free' | 'basic' | 'upgraded';
  from_amount_cents: number;
  rate_percent: number;
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

export const DEFAULT_PLANS: Plan[] = [
  {
    id: 'plan-1',
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
    member_badge: false,
    studio_insights: false,
    studio_url: false,
    sort_order: 1
  },
  {
    id: 'plan-2',
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
    member_badge: true,
    studio_insights: false,
    studio_url: false,
    sort_order: 2
  },
  {
    id: 'plan-3',
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
    member_badge: true,
    studio_insights: true,
    studio_url: true,
    sort_order: 3
  }
];

export const DEFAULT_PLAN_FEE_TIERS: PlanFeeTier[] = [
  { id: 'tier-1', plan_key: 'free', from_amount_cents: 0, rate_percent: 10.0, sort_order: 1 },
  { id: 'tier-2', plan_key: 'free', from_amount_cents: 500000, rate_percent: 5.0, sort_order: 2 },
  { id: 'tier-3', plan_key: 'basic', from_amount_cents: 0, rate_percent: 5.0, sort_order: 1 },
  { id: 'tier-4', plan_key: 'basic', from_amount_cents: 2000000, rate_percent: 2.5, sort_order: 2 },
  { id: 'tier-5', plan_key: 'upgraded', from_amount_cents: 0, rate_percent: 4.0, sort_order: 1 },
  { id: 'tier-6', plan_key: 'upgraded', from_amount_cents: 2000000, rate_percent: 2.0, sort_order: 2 }
];

// In-memory working copies for mock/demo mode
let mockPlansStore: Plan[] = JSON.parse(JSON.stringify(DEFAULT_PLANS));
let mockFeeTiersStore: PlanFeeTier[] = JSON.parse(JSON.stringify(DEFAULT_PLAN_FEE_TIERS));

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

    return data as Plan[];
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

    return data as PlanFeeTier[];
  } catch {
    return JSON.parse(JSON.stringify(mockFeeTiersStore));
  }
}

/**
 * Update in-memory mock plan (used in Admin Plan editor)
 */
export function updateMockPlan(key: string, updates: Partial<Plan>): Plan {
  const plan = mockPlansStore.find(p => p.key === key);
  if (!plan) throw new Error(`Plan with key ${key} not found.`);
  Object.assign(plan, updates);
  return { ...plan };
}

/**
 * Update in-memory mock fee tiers for a plan
 */
export function updateMockFeeTiers(
  planKey: 'free' | 'basic' | 'upgraded',
  tiers: Array<{ from_amount_cents: number; rate_percent: number; sort_order?: number }>
): PlanFeeTier[] {
  // Remove existing tiers for this plan
  mockFeeTiersStore = mockFeeTiersStore.filter(t => t.plan_key !== planKey);

  // Add new tiers
  const newTiers: PlanFeeTier[] = tiers.map((t, idx) => ({
    id: `tier-${planKey}-${Date.now()}-${idx}`,
    plan_key: planKey,
    from_amount_cents: t.from_amount_cents,
    rate_percent: t.rate_percent,
    sort_order: t.sort_order ?? idx + 1
  }));

  mockFeeTiersStore.push(...newTiers);
  return newTiers;
}

/**
 * Computes human-readable exact tiered schedule description
 * E.g. '10% of each milestone, or 5% of milestones over $5,000'
 */
export function getTieredScheduleDescription(
  planKey: string,
  customTiers?: PlanFeeTier[]
): string {
  const tiers = (customTiers || mockFeeTiersStore)
    .filter(t => t.plan_key === planKey)
    .sort((a, b) => a.from_amount_cents - b.from_amount_cents);

  if (tiers.length === 0) {
    if (planKey === 'free') return '10% of each milestone, or 5% of milestones over $5,000';
    if (planKey === 'basic') return '5% of each milestone, or 2.5% of milestones over $20,000';
    return '4% of each milestone, or 2.0% of milestones over $20,000';
  }

  if (tiers.length === 1) {
    return `${tiers[0].rate_percent}% of each milestone`;
  }

  const parts = [`${tiers[0].rate_percent}% of each milestone`];
  for (let i = 1; i < tiers.length; i++) {
    const dollars = formatMoney(Math.round(tiers[i].from_amount_cents / 100));
    parts.push(`or ${tiers[i].rate_percent}% of milestones over ${dollars}`);
  }
  return parts.join(', ');
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
 * Strictly matches database whole_amount logic with support for custom tiers
 */
export function calculatePlatformFeeFallback(
  planKey: string,
  amountCents: number,
  customTiers?: PlanFeeTier[]
): PlatformFeeResult {
  const tiers = (customTiers || mockFeeTiersStore)
    .filter(t => t.plan_key === planKey)
    .sort((a, b) => b.from_amount_cents - a.from_amount_cents);

  let chosenRate = 10.0;

  if (tiers.length > 0) {
    // In whole_amount mode: strictly greater than from_amount_cents
    const match = tiers.find(t => amountCents > t.from_amount_cents);
    if (match) {
      chosenRate = match.rate_percent;
    } else {
      // Fallback to lowest threshold tier
      chosenRate = tiers[tiers.length - 1].rate_percent;
    }
  } else {
    // Standard defaults
    if (planKey === 'free') {
      chosenRate = amountCents > 500000 ? 5.0 : 10.0;
    } else if (planKey === 'basic') {
      chosenRate = amountCents > 2000000 ? 2.5 : 5.0;
    } else if (planKey === 'upgraded') {
      chosenRate = amountCents > 2000000 ? 2.0 : 4.0;
    }
  }

  const feeCents = Math.round((amountCents * chosenRate) / 100);
  const netCents = amountCents - feeCents;

  return {
    plan_key: planKey,
    amount_cents: amountCents,
    fee_cents: feeCents,
    net_cents: netCents,
    fee_dollars: Math.round(feeCents) / 100,
    net_dollars: Math.round(netCents) / 100,
    rate_percent: chosenRate,
    breakdown: [
      {
        from_amount_cents: 0,
        rate_percent: chosenRate,
        taxable_amount_cents: amountCents,
        fee_cents: feeCents
      }
    ]
  };
}

/**
 * Dev-only function to switch a designer's plan (blocked in production)
 * Supports switch_designer_plan_dev and dev_switch_designer_plan RPCs with mock fallback
 */
export async function devSwitchDesignerPlan(
  designerId: string,
  newPlanKey: 'free' | 'basic' | 'upgraded'
): Promise<boolean> {
  // Synchronously update mock in-memory state
  setDesignerPlan(designerId, newPlanKey);
  if (sharedDataset && sharedDataset.planState) {
    sharedDataset.planState.currentPlanId = newPlanKey;
  }

  if (!USE_MOCKS.profiles) {
    try {
      // Attempt switch_designer_plan_dev RPC
      const { data: res1, error: err1 } = await (supabase.rpc as any)('switch_designer_plan_dev', {
        p_designer_id: designerId,
        p_new_plan_key: newPlanKey
      });

      if (!err1 && res1) return true;

      // Fallback attempt: dev_switch_designer_plan RPC
      const { data: res2, error: err2 } = await (supabase.rpc as any)('dev_switch_designer_plan', {
        p_designer_id: designerId,
        p_new_plan_key: newPlanKey
      });

      if (!err2 && res2) return true;
    } catch (err) {
      console.warn('RPC plan switch failed, updated local state:', err);
    }
  }

  return true;
}
