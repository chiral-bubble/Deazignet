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

export const PROGRESSIVE_FEE_TEXT =
  'Progressive fee: 10% on the first $2,500, 7.5% to $5,000, 5% to $10,000, 3.5% to $20,000, 2.5% above';

export const PLATFORM_COMMISSION_NOTE =
  'The platform commission is the same progressive scale on every plan.';

export const UNLIMITED_FAIR_USE_NOTE =
  '* Unlimited proposals and portfolio projects are subject to fair use guidelines.';

export interface PaymentsSettings {
  payments_terminology_approved: boolean;
  fee_tier_mode: 'marginal' | 'whole_amount';
  fee_basis: 'cumulative_project' | 'per_milestone' | 'cumulative';
  plan_fee_discount_enabled: boolean;
  fee_deducted_from_payout: boolean;
  processing_fee_bearer: 'undecided' | 'platform' | 'designer' | 'client';
  reimbursables_excluded_from_commission: boolean;
  third_party_consultant_passthrough_excluded: boolean;
  subscription_affects_commission: boolean;
  annual_billing_enabled: boolean;
  images_per_portfolio_project: number;
  unlimited_daily_proposal_cap: number;
}

export const DEFAULT_PAYMENTS_SETTINGS: PaymentsSettings = {
  payments_terminology_approved: false,
  fee_tier_mode: 'marginal',
  fee_basis: 'cumulative_project',
  plan_fee_discount_enabled: false,
  fee_deducted_from_payout: true,
  processing_fee_bearer: 'undecided',
  reimbursables_excluded_from_commission: true,
  third_party_consultant_passthrough_excluded: true,
  subscription_affects_commission: false,
  annual_billing_enabled: false,
  images_per_portfolio_project: 10,
  unlimited_daily_proposal_cap: 25
};

// In-memory global settings instance
let currentPaymentsSettings: PaymentsSettings = { ...DEFAULT_PAYMENTS_SETTINGS };

export function getPaymentsSettings(): PaymentsSettings {
  return { ...currentPaymentsSettings };
}

export function updatePaymentsSettings(updates: Partial<PaymentsSettings>): PaymentsSettings {
  currentPaymentsSettings = { ...currentPaymentsSettings, ...updates };
  return { ...currentPaymentsSettings };
}

export function isPaymentsTerminologyApproved(): boolean {
  return currentPaymentsSettings.payments_terminology_approved;
}

export function setPaymentsTerminologyApproved(approved: boolean): void {
  currentPaymentsSettings.payments_terminology_approved = approved;
}

export interface PlanFeatureRow {
  name: string;
  free: string | boolean;
  basic: string | boolean;
  gold: string | boolean;
  upgraded?: string | boolean; // compatibility alias
}

export interface PlanTierConfig {
  id: 'free' | 'basic' | 'gold' | 'upgraded';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  proposalsPerMonth: number | null; // null = unlimited
  portfolioProjectsLimit: number | null; // null = unlimited
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
    proposalsPerMonth: 3,
    portfolioProjectsLimit: 3,
    platformFeeText: PROGRESSIVE_FEE_TEXT,
    description: 'Submit up to 3 proposals per month, public directory listing, and up to 3 portfolio projects.'
  },
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 19.00,
    yearlyPrice: 190.00,
    proposalsPerMonth: 15,
    portfolioProjectsLimit: 12,
    platformFeeText: PROGRESSIVE_FEE_TEXT,
    description: '15 proposals per month, portfolio page with up to 12 projects, direct client invitations, and profile views analytics.'
  },
  {
    id: 'gold',
    name: 'Gold',
    monthlyPrice: 49.00,
    yearlyPrice: 490.00,
    proposalsPerMonth: null,
    portfolioProjectsLimit: null,
    platformFeeText: PROGRESSIVE_FEE_TEXT,
    description: 'Unlimited proposals and projects, priority search placement, direct invitations, case-study sections, studio web address, and full analytics.'
  }
];

export const PLAN_FEATURES_TABLE: PlanFeatureRow[] = [
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
