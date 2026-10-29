/**
 * Payments & Financial Configuration for Dezignet
 * Centralized financial config values for escrow fees, withdrawals, and plan tiers.
 */

export interface PaymentsConfig {
  minimumWithdrawalAmount: number;
  platformFeePercentage: {
    free: number;
    basic: number;
    upgraded: number;
  };
  payoutProcessingFee: number;
  payoutProcessingTimeText: string;
  allowEditPendingProposalIfUnviewed: boolean;
  withdrawnProposalRestoresMonthlyLimit: boolean;
  currency: string;
}

export const PAYMENTS_CONFIG: PaymentsConfig = {
  minimumWithdrawalAmount: 50.0,
  platformFeePercentage: {
    free: 10.0,
    basic: 5.0,
    upgraded: 2.5
  },
  payoutProcessingFee: 0.0, // Free ACH / Direct Wire deposit
  payoutProcessingTimeText: '1 to 2 business days to verified commercial bank accounts',
  allowEditPendingProposalIfUnviewed: true,
  withdrawnProposalRestoresMonthlyLimit: true,
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
  yearlyDiscountPercent: number;
  proposalsPerMonth: number;
  escrowPlatformFeePercent: number;
  description: string;
  popular?: boolean;
  badge?: string;
}

export const PLAN_TIERS_CONFIG: PlanTierConfig[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscountPercent: 0,
    proposalsPerMonth: 5,
    escrowPlatformFeePercent: 10.0,
    description: 'Essential platform access to submit proposals and build your studio presence.'
  },
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 29.99,
    yearlyPrice: 287.9, // 20% discount
    yearlyDiscountPercent: 20,
    proposalsPerMonth: 30,
    escrowPlatformFeePercent: 5.0,
    description: 'For growing architectural studios seeking enhanced portfolio visibility and lower escrow fees.',
    popular: true
  },
  {
    id: 'upgraded',
    name: 'Upgraded',
    monthlyPrice: 49.99,
    yearlyPrice: 479.9, // 20% discount
    yearlyDiscountPercent: 20,
    proposalsPerMonth: 100, // Unlimited
    escrowPlatformFeePercent: 2.5,
    description: 'For elite architecture & engineering firms requiring dedicated client matching and lowest platform fees.',
    badge: 'Elite'
  }
];

export const PLAN_FEATURES_TABLE: PlanFeatureRow[] = [
  {
    name: 'Proposals per month',
    free: '5 proposals',
    basic: '30 proposals',
    upgraded: 'Unlimited proposals'
  },
  {
    name: 'Escrow platform fee',
    free: '10.0%',
    basic: '5.0%',
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
    name: 'Direct client project invitations',
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
    name: 'Dedicated account advisor',
    free: false,
    basic: false,
    upgraded: true
  }
];
