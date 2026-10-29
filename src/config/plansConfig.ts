/**
 * Plans Configuration for Dezignet
 * Configurable subscription tiers and plan comparison features.
 */

export interface PlanFeature {
  name: string;
  free: string | boolean;
  basic: string | boolean;
  upgraded: string | boolean;
}

export interface PlanTier {
  id: 'free' | 'basic' | 'upgraded';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number; // Yearly price with discount
  yearlyDiscountPercent: number; // E.g. 20%
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
    description: 'Essential platform access to submit proposals and build your studio presence.'
  },
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 29.99,
    yearlyPrice: 287.90, // ~20% discount ($23.99/mo)
    yearlyDiscountPercent: 20,
    description: 'For growing architectural studios seeking enhanced portfolio visibility and lower escrow fees.',
    popular: true
  },
  {
    id: 'upgraded',
    name: 'Upgraded',
    monthlyPrice: 49.99,
    yearlyPrice: 479.90, // ~20% discount ($39.99/mo)
    yearlyDiscountPercent: 20,
    description: 'For elite architecture & engineering firms requiring dedicated client matching and zero escrow fees.',
    badge: 'Elite'
  }
];

export const PLAN_FEATURES_COMPARISON: PlanFeature[] = [
  {
    name: 'Portfolio project limit',
    free: 'Up to 3 projects',
    basic: 'Up to 20 projects',
    upgraded: 'Unlimited'
  },
  {
    name: 'Proposals per month',
    free: '5 proposals',
    basic: '30 proposals',
    upgraded: 'Unlimited proposals'
  },
  {
    name: 'Escrow platform fee',
    free: '10%',
    basic: '5%',
    upgraded: '2.5%'
  },
  {
    name: 'Verified accreditation badge',
    free: true,
    basic: true,
    upgraded: true
  },
  {
    name: 'High-res image gallery (up to 12 per project)',
    free: false,
    basic: true,
    upgraded: true
  },
  {
    name: 'Priority client directory placement',
    free: false,
    basic: true,
    upgraded: true
  },
  {
    name: 'Custom studio domain & analytics',
    free: false,
    basic: false,
    upgraded: true
  },
  {
    name: 'Direct client project invitations',
    free: false,
    basic: true,
    upgraded: true
  },
  {
    name: 'Dedicated account advisor',
    free: false,
    basic: false,
    upgraded: true
  }
];
