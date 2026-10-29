/**
 * PaymentsPanel Component
 * Section D of Right Column:
 * - Three plain rows in ONE bordered panel with dividers (no colored cards).
 * - "Available to withdraw", "Pending release", "Total earned".
 * - Dark text, tabular numbers, grey explanation under label.
 * - Outlined "Withdraw" button (disabled if $0) and "View payment history" link.
 */

import type { DesignerPaymentsSummary } from '../../../services/designerDashboardService';

export function renderPaymentsPanel(payments: DesignerPaymentsSummary): string {
  const isWithdrawDisabled = payments.availableToWithdraw <= 0;

  return `
    <section class="dez-payments-section" aria-label="Payments and balance summary">
      <div class="dez-section-header">
        <h2 class="dez-section-title">Payments</h2>
      </div>

      <div class="dez-payments-card">
        <!-- Row 1: Available to withdraw -->
        <div class="dez-payment-row">
          <div class="dez-payment-meta">
            <span class="dez-payment-label">Available to withdraw</span>
            <p class="dez-payment-desc">Ready to transfer to linked bank account</p>
          </div>
          <div class="dez-payment-amount dez-num-tabular">
            $${payments.availableToWithdraw.toLocaleString()}
          </div>
        </div>

        <div class="dez-divider-line"></div>

        <!-- Row 2: Pending release -->
        <div class="dez-payment-row">
          <div class="dez-payment-meta">
            <span class="dez-payment-label">Pending release</span>
            <p class="dez-payment-desc">Waiting on client milestone approval</p>
          </div>
          <div class="dez-payment-amount dez-num-tabular">
            $${payments.pendingRelease.toLocaleString()}
          </div>
        </div>

        <div class="dez-divider-line"></div>

        <!-- Row 3: Total earned -->
        <div class="dez-payment-row">
          <div class="dez-payment-meta">
            <span class="dez-payment-label">Total earned</span>
            <p class="dez-payment-desc">All-time earnings released to date</p>
          </div>
          <div class="dez-payment-amount dez-num-tabular">
            $${payments.totalEarned.toLocaleString()}
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="dez-payments-card-footer">
          <button type="button" class="dez-btn-outline dez-btn-full" id="btn-open-withdraw" ${
            isWithdrawDisabled ? 'disabled title="Available balance is zero"' : ''
          }>
            Withdraw funds
          </button>
          
          <a href="#payments" class="dez-link-action dez-payment-history-link" data-designer-tab="payments">
            View payment history &rarr;
          </a>
        </div>
      </div>
    </section>
  `;
}
