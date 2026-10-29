/**
 * PaymentsLayout Component
 * Coordinates the 5 Payments tabs:
 * - Overview (4-metric balance container, coming up, recent 5)
 * - Transactions (table, search, filters, sort, CSV export, drawer)
 * - Payouts (accounts, set default, remove, withdrawal history, add modal)
 * - Plan (tier cards, monthly/yearly toggle, feature comparison, card form)
 * - Invoices (receipts, yearly statement download, tax note)
 * 
 * Financial figures are strictly synchronized with sharedDataset.
 */

import { getPaymentsOverview, type PaymentsOverviewData } from '../../../services/paymentsService';
import { type SharedTransaction } from '../../../mocks/dataset';
import { renderBalanceSummary, initBalanceSummary } from './BalanceSummary';
import { renderTransactionsTable, initTransactionsTable } from './TransactionsTable';
import { renderTransactionDrawer, initTransactionDrawer } from './TransactionDrawer';
import { renderPayoutAccounts, initPayoutAccounts } from './PayoutAccounts';
import { renderAddPayoutModal, initAddPayoutModal } from './AddPayoutModal';
import { renderWithdrawModal, initWithdrawModal } from './WithdrawModal';
import { renderPlanTab, initPlanTab } from './PlanTab';

export type PaymentsTabKey = 'overview' | 'transactions' | 'payouts' | 'plan';

export function renderPaymentsLayout(initialTab: PaymentsTabKey = 'overview'): string {
  return `
    <div class="dez-payments-page-container" id="dez-payments-root">
      <!-- Page Header -->
      <div class="dez-payments-header" style="margin-bottom: 24px;">
        <h1 class="dez-page-title" style="font-size: 28px; margin-bottom: 4px;">Payments</h1>
        <p class="dez-page-subtext">Manage escrow releases, milestone payments, payout bank accounts, and studio membership.</p>
      </div>

      <!-- Navigation Tabs Bar -->
      <div class="dez-tabs-bar" style="border-bottom: 1px solid #E5E7EB; margin-bottom: 24px; display: flex; gap: 24px; overflow-x: auto;">
        <button type="button" class="dez-tab-btn ${initialTab === 'overview' ? 'is-active' : ''}" data-pay-tab="overview">
          Overview
        </button>
        <button type="button" class="dez-tab-btn ${initialTab === 'transactions' ? 'is-active' : ''}" data-pay-tab="transactions">
          Transactions
        </button>
        <button type="button" class="dez-tab-btn ${initialTab === 'payouts' ? 'is-active' : ''}" data-pay-tab="payouts">
          Payouts
        </button>
        <button type="button" class="dez-tab-btn ${initialTab === 'plan' ? 'is-active' : ''}" data-pay-tab="plan">
          Plan
        </button>
      </div>

      <!-- Tab Content Area -->
      <main id="dez-payments-tab-content" role="tabpanel" style="min-height: 400px;">
        <!-- Filled dynamically -->
      </main>

      <!-- Drawers & Modals -->
      ${renderTransactionDrawer()}
      ${renderAddPayoutModal()}
      ${renderWithdrawModal()}
    </div>
  `;
}

export async function initPayments(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  },
  initialTab: PaymentsTabKey = 'overview'
): Promise<void> {
  const root = container.querySelector('#dez-payments-root') as HTMLElement;
  if (!root) return;

  let currentTab: PaymentsTabKey = initialTab;
  const tabContent = root.querySelector('#dez-payments-tab-content') as HTMLElement;

  // Initialize Modals & Drawers
  const txDrawer = initTransactionDrawer(root);
  const addPayoutModal = initAddPayoutModal(root, {
    onAccountAdded: () => {
      if (currentTab === 'payouts' || currentTab === 'overview') {
        loadTab(currentTab);
      }
    },
    onShowToast: callbacks.onShowToast
  });

  const withdrawModal = initWithdrawModal(root, {
    onWithdrawalCompleted: () => {
      // Reload active tab and overview balances live
      loadTab(currentTab);
    },
    onShowToast: callbacks.onShowToast
  });

  async function loadTab(tab: PaymentsTabKey) {
    if (!tabContent) return;
    currentTab = tab;

    // Update active tab buttons
    root.querySelectorAll<HTMLButtonElement>('.dez-tab-btn').forEach((btn) => {
      const bTab = btn.getAttribute('data-pay-tab');
      btn.classList.toggle('is-active', bTab === tab);
    });

    if (tab === 'overview') {
      tabContent.innerHTML = `<div style="padding: 32px; text-align: center; color: #6B7280;">Loading balances...</div>`;
      try {
        const data: PaymentsOverviewData = await getPaymentsOverview();
        tabContent.innerHTML = renderBalanceSummary(data);
        initBalanceSummary(tabContent, {
          onOpenWithdraw: () => withdrawModal.open(),
          onJumpPayouts: () => loadTab('payouts'),
          onJumpTransactions: () => loadTab('transactions'),
          onSelectTransaction: (txId: string) => {
            const tx = data.recentTransactions.find((t) => t.id === txId);
            if (tx) txDrawer.open(tx);
          }
        });
      } catch (err: any) {
        tabContent.innerHTML = `
          <div style="border: 1px solid #FCA5A5; background: #FEF2F2; padding: 24px; border-radius: 8px; text-align: center;">
            <p style="color: #991B1B; font-weight: 500; margin: 0 0 8px 0;">Failed to load financial overview.</p>
            <button type="button" class="dez-btn-secondary" id="btn-retry-overview">Retry</button>
          </div>
        `;
        tabContent.querySelector('#btn-retry-overview')?.addEventListener('click', () => loadTab('overview'));
      }
    } else if (tab === 'transactions') {
      tabContent.innerHTML = renderTransactionsTable();
      initTransactionsTable(tabContent, {
        onSelectTransaction: (tx: SharedTransaction) => txDrawer.open(tx),
        onShowToast: callbacks.onShowToast
      });
    } else if (tab === 'payouts') {
      tabContent.innerHTML = renderPayoutAccounts();
      initPayoutAccounts(tabContent, {
        onOpenAddModal: () => addPayoutModal.open(),
        onShowToast: callbacks.onShowToast
      });
    } else if (tab === 'plan') {
      tabContent.innerHTML = renderPlanTab();
      await initPlanTab(tabContent, {
        onShowToast: callbacks.onShowToast
      });
    }
  }

  // Attach Tab Click Listeners
  root.querySelectorAll<HTMLButtonElement>('.dez-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-pay-tab') as PaymentsTabKey;
      if (tab) loadTab(tab);
    });
  });

  // Initial load
  await loadTab(initialTab);
}
