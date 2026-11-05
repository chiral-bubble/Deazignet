/**
 * Payments & Financial Configuration for Dezignet
 * Centralized financial config values for platform fees, plans, and feature matrices
 */

export interface PaymentsConfig {
  minimumWithdrawalAmount: number;
  payoutProcessingFee: number;
  payoutProcessingTimeText: string;
  currency: string;
}

export const PAYMENTS_CONFIG: PaymentsConfig = {
  minimumWithdrawalAmount: 50.0,
  payoutProcessingFee: 0.0,
  payoutProcessingTimeText: 'Processed securely by our payment provider',
  currency: 'USD'
};

export interface PlanFeatureRow {
  name: string;
  free: string | boolean;
  basic: string | boolean;
  upgraded: string | boolean;
}

export interface PlanTierConfig {
  id: 'free' | 'basic' | 'upgraded';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  proposalsPerMonth: number | null; // null = unlimited
  platformFeeText: string;
  description: string;
  badge?: string;
}

export const PLAN_TIERS_CONFIG: PlanTierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    proposalsPerMonth: 5,
    platformFeeText: '10% (5% on milestones over $5,000)',
    description: 'Bid on projects: 5 proposals per month. Not listed in the client directory.'
  },
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 29.99,
    yearlyPrice: 299.00,
    proposalsPerMonth: 10,
    platformFeeText: '5% (2.5% on milestones over $20,000)',
    description: '10 proposals per month, client directory listing, verified badge, and 2 portfolio images per project.'
  },
  {
    id: 'upgraded',
    name: 'Upgraded',
    monthlyPrice: 49.99,
    yearlyPrice: 499.00,
    proposalsPerMonth: null,
    platformFeeText: '4% (2% on milestones over $20,000)',
    description: 'Unlimited proposals, priority directory placement, 12 portfolio images, direct invitations, and studio insights.',
    badge: 'Elite'
  }
];

export const PLAN_FEATURES_TABLE: PlanFeatureRow[] = [
  {
    name: 'Proposals per month',
    free: '5 proposals',
    basic: '10 proposals',
    upgraded: 'Unlimited'
  },
  {
    name: 'Platform service fee',
    free: '10% (5% on milestones over $5,000)',
    basic: '5% (2.5% on milestones over $20,000)',
    upgraded: '4% (2% on milestones over $20,000)'
  },
  {
    name: 'Client directory listing & priority placement',
    free: false,
    basic: true,
    upgraded: 'Priority Promoted'
  },
  {
    name: 'Verified badge',
    free: false,
    basic: true,
    upgraded: true
  },
  {
    name: 'Portfolio images per project',
    free: 'None',
    basic: '2 images',
    upgraded: '12 high-resolution'
  },
  {
    name: 'Direct client project invitations',
    free: false,
    basic: true,
    upgraded: true
  },
  {
    name: 'Studio insights and studio web address',
    free: false,
    basic: false,
    upgraded: 'Included*'
  }
];
