/**
 * Plans Configuration for Dezignet
 * Configurable subscription tiers and plan comparison features.
 */

export interface PlanFeature {
  name: string;
  free: string | boolean;
  basic: string | boolean;
  gold: string | boolean;
  upgraded?: string | boolean; // compatibility alias
}

export interface PlanTier {
  id: 'free' | 'basic' | 'gold';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number; // Yearly price with discount
  yearlyDiscountPercent: number; // E.g. 17%
  description: string;
  badge?: string;
  popular?: boolean;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscountPercent: 0,
    description: 'Submit up to 3 proposals per month, public directory listing, and up to 3 portfolio projects.'
  },
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 19.00,
    yearlyPrice: 190.00,
    yearlyDiscountPercent: 17,
    description: '15 proposals per month, portfolio page with up to 12 projects, direct client invitations, and profile views analytics.',
    popular: true
  },
  {
    id: 'gold',
    name: 'Gold',
    monthlyPrice: 49.00,
    yearlyPrice: 490.00,
    yearlyDiscountPercent: 17,
    description: 'Unlimited proposals and projects, priority search placement, direct invitations, case-study sections, studio web address, and full analytics.'
  }
];

export const PLAN_FEATURES_COMPARISON: PlanFeature[] = [
  {
    name: 'Proposal submissions per month',
    free: '3',
    basic: '15',
    gold: 'Unlimited*',
    upgraded: 'Unlimited*'
  },
  {
    name: 'Public professional profile',
    free: 'Directory listing',
    basic: 'Basic portfolio page',
    gold: 'Enhanced portfolio page',
    upgraded: 'Enhanced portfolio page'
  },
  {
    name: 'Portfolio projects',
    free: '3',
    basic: '12',
    gold: 'Unlimited*',
    upgraded: 'Unlimited*'
  },
  {
    name: 'Direct client project invitations',
    free: false,
    basic: true,
    gold: true,
    upgraded: true
  },
  {
    name: 'Search placement',
    free: 'Standard',
    basic: 'Standard',
    gold: 'Priority among relevant results',
    upgraded: 'Priority among relevant results'
  },
  {
    name: 'Analytics',
    free: 'Basic',
    basic: 'Profile views',
    gold: 'Views, leads and proposal analytics',
    upgraded: 'Views, leads and proposal analytics'
  },
  {
    name: 'Verification eligibility',
    free: 'Yes',
    basic: 'Yes',
    gold: 'Yes',
    upgraded: 'Yes'
  }
];

export const PLATFORM_COMMISSION_LINE =
  'The platform commission is the same progressive scale on every plan.';
