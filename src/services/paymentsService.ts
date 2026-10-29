/**
 * Payments Service for Dezignet
 * Clean service functions querying the single shared dataset for:
 * - Balances & overview
 * - Filtered & paginated transactions with full breakdown
 * - Payout accounts & withdrawals
 * - Plan tiers & payment methods
 * - Invoices & tax statements
 */

import {
  sharedDataset,
  type SharedTransaction,
  type SharedPayoutAccount,
  type SharedWithdrawal,
  type SharedPlanState,
  type MilestonePhase
} from '../mocks/dataset';
import { PAYMENTS_CONFIG } from '../config/paymentsConfig';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface UpcomingMilestoneItem {
  id: string;
  projectName: string;
  milestoneTitle: string;
  amount: number;
  estReleaseDate: string;
  statusText: string;
}

export interface PaymentsOverviewData {
  balances: {
    availableToWithdraw: number;
    pendingRelease: number;
    inEscrow: number;
    totalEarned: number;
  };
  upcomingMilestones: UpcomingMilestoneItem[];
  recentTransactions: SharedTransaction[];
  hasPayoutAccount: boolean;
  minWithdrawal: number;
}

export interface TransactionFilterOptions {
  type?: string;
  status?: string;
  search?: string;
  sortBy?: 'date-desc' | 'date-asc' | 'gross-desc' | 'gross-asc';
}

export interface InvoiceItem {
  id: string;
  date: string;
  number: string;
  description: string;
  amount: number;
  status: 'Paid' | 'Processing';
  pdfDownloadUrl?: string;
}

export interface PlanChargesHistoryItem {
  id: string;
  date: string;
  description: string;
  cardBrand: string;
  cardLast4: string;
  amount: number;
  status: 'Paid';
}

export async function getPaymentsOverview(): Promise<PaymentsOverviewData> {
  await delay(80);

  // Extract next milestone payments from active projects
  const upcoming: UpcomingMilestoneItem[] = [];
  sharedDataset.activeProjects.forEach((proj) => {
    proj.milestones.forEach((m: MilestonePhase) => {
      if (m.status === 'in_review' || m.status === 'funded') {
        upcoming.push({
          id: m.id,
          projectName: proj.title,
          milestoneTitle: m.title,
          amount: m.amount,
          estReleaseDate: m.dueDate,
          statusText: m.status === 'in_review' ? 'In client review' : 'Funded in escrow'
        });
      }
    });
  });

  return {
    balances: { ...sharedDataset.balances },
    upcomingMilestones: upcoming.slice(0, 3),
    recentTransactions: sharedDataset.transactions.slice(0, 5),
    hasPayoutAccount: sharedDataset.payoutAccounts.length > 0,
    minWithdrawal: PAYMENTS_CONFIG.minimumWithdrawalAmount
  };
}

export async function getTransactions(
  filters?: TransactionFilterOptions
): Promise<SharedTransaction[]> {
  await delay(80);

  let list = [...sharedDataset.transactions];

  if (filters?.type && filters.type !== 'all') {
    if (filters.type === 'invoice') {
      list = list.filter((t) =>
        t.type.toLowerCase().includes('milestone') ||
        t.type.toLowerCase().includes('hourly') ||
        t.type.toLowerCase().includes('charge')
      );
    } else {
      list = list.filter((t) => t.type.toLowerCase().includes(filters.type!.toLowerCase()));
    }
  }

  if (filters?.status && filters.status !== 'all') {
    list = list.filter((t) => t.status.toLowerCase() === filters.status!.toLowerCase());
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.referenceId.toLowerCase().includes(q) ||
        (t.projectName && t.projectName.toLowerCase().includes(q))
    );
  }

  if (filters?.sortBy === 'gross-desc') {
    list.sort((a, b) => Math.abs(b.grossAmount) - Math.abs(a.grossAmount));
  } else if (filters?.sortBy === 'gross-asc') {
    list.sort((a, b) => Math.abs(a.grossAmount) - Math.abs(b.grossAmount));
  }

  return list;
}

export async function getTransactionDetail(id: string): Promise<SharedTransaction | null> {
  await delay(50);
  const tx = sharedDataset.transactions.find((t) => t.id === id);
  return tx ? { ...tx } : null;
}

export async function getPayoutAccounts(): Promise<SharedPayoutAccount[]> {
  await delay(60);
  return JSON.parse(JSON.stringify(sharedDataset.payoutAccounts));
}

export async function addPayoutAccount(data: {
  bankName: string;
  accountNumber?: string;
  accountNumberRaw?: string;
  accountName: string;
  currency?: string;
}): Promise<SharedPayoutAccount> {
  await delay(120);

  const raw = data.accountNumberRaw || data.accountNumber || '';
  if (!/^\d{8,17}$/.test(raw.trim().replace(/[-\s]/g, ''))) {
    throw new Error('Bank account number must be between 8 and 17 digits.');
  }

  const cleanNum = raw.trim().replace(/[-\s]/g, '');
  const masked = `••••••${cleanNum.slice(-4)}`;
  const newAccount: SharedPayoutAccount = {
    id: `payout-${Date.now()}`,
    bankName: data.bankName,
    accountNumberMasked: masked,
    accountName: data.accountName.trim() || 'Alexandre Sterling Studio',
    verificationStatus: 'Verified',
    isDefault: sharedDataset.payoutAccounts.length === 0,
    currency: 'USD'
  };

  sharedDataset.payoutAccounts.push(newAccount);
  return newAccount;
}

export async function setDefaultPayoutAccount(id: string): Promise<void> {
  await delay(50);
  sharedDataset.payoutAccounts.forEach((acc) => {
    acc.isDefault = acc.id === id;
  });
}

export async function removePayoutAccount(id: string): Promise<void> {
  await delay(60);
  sharedDataset.payoutAccounts = sharedDataset.payoutAccounts.filter((a) => a.id !== id);
}

export async function getWithdrawals(): Promise<SharedWithdrawal[]> {
  await delay(60);
  return JSON.parse(JSON.stringify(sharedDataset.withdrawals));
}

export async function requestWithdrawal(
  amount: number,
  payoutAccountId: string
): Promise<{ success: boolean; error?: string }> {
  await delay(150);
  return sharedDataset.executeWithdrawal(amount, payoutAccountId);
}

export async function getPlanState(): Promise<SharedPlanState> {
  await delay(60);
  return JSON.parse(JSON.stringify(sharedDataset.planState));
}

export async function updatePlanSubscription(
  tierId: 'free' | 'basic' | 'upgraded',
  cycle: 'monthly' | 'yearly'
): Promise<void> {
  await delay(100);
  sharedDataset.planState.currentPlanId = tierId;
  sharedDataset.planState.billingCycle = cycle;
}

export async function updatePlanPaymentCard(data: {
  brand: 'Visa' | 'Mastercard';
  last4: string;
  expMonth: number;
  expYear: number;
}): Promise<void> {
  await delay(100);
  sharedDataset.planState.paymentMethod = {
    ...data,
    isDefault: true
  };
}

export function exportTransactionsCSV(): string {
  const headers = ['Date', 'Reference', 'Description', 'Type', 'Gross ($)', 'Fee ($)', 'Net ($)', 'Status'];
  const rows = sharedDataset.transactions.map((t) => [
    t.date,
    t.referenceId,
    `"${t.description.replace(/"/g, '""')}"`,
    t.type,
    t.grossAmount.toFixed(2),
    t.feeAmount.toFixed(2),
    t.netAmount.toFixed(2),
    t.status
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export async function getInvoices(): Promise<InvoiceItem[]> {
  await delay(60);
  return [
    {
      id: 'inv-1',
      date: 'Oct 1, 2026',
      number: 'INV-DEZ-2026-0091',
      description: 'Annual Membership — Upgraded Studio Tier (12 months)',
      amount: 479.90,
      status: 'Paid'
    },
    {
      id: 'inv-2',
      date: 'Sep 15, 2026',
      number: 'INV-DEZ-2026-0042',
      description: 'Milestone 1 Escrow Release Platform Fee (Cantilevered Residence)',
      amount: 375.00,
      status: 'Paid'
    },
    {
      id: 'inv-3',
      date: 'Oct 1, 2025',
      number: 'INV-DEZ-2025-0012',
      description: 'Annual Membership — Basic Studio Tier (12 months)',
      amount: 287.90,
      status: 'Paid'
    }
  ];
}
