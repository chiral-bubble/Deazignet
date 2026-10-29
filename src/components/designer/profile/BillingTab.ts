/**
 * BillingTab Component (Tab 5: Billing & Plans)
 * Subscription plans (Free, Basic, Upgraded) with Monthly/Yearly discount toggle,
 * plan features comparison table driven by plansConfig.ts,
 * payout accounts with masked numbers, and mock invoice history.
 */

import { PLAN_TIERS, PLAN_FEATURES_COMPARISON } from '../../../config/plansConfig';
import type { PayoutAccount, InvoiceItem } from '../../../services/designerProfileService';

export function renderBillingTab(
  currentPlanId: 'free' | 'basic' | 'upgraded',
  billingCycle: 'monthly' | 'yearly',
  payoutAccounts: PayoutAccount[],
  invoices: InvoiceItem[]
): string {
  const isYearly = billingCycle === 'yearly';

  return `
    <div class="dez-settings-panel" id="dez-billing-tab-content">
      <div class="dez-panel-header">
        <h2 class="dez-panel-title">Studio Subscription & Escrow Payouts</h2>
        <p class="dez-panel-subtext">Manage your studio tier, bank wire destinations, and fee structures.</p>
      </div>

      <!-- Plan Tiers Card with Monthly/Yearly Switch -->
      <div class="dez-bordered-box" style="margin-bottom: 28px;">
        <div class="dez-billing-header-row">
          <div>
            <h3 class="dez-box-title">Subscription Tier</h3>
            <p class="dez-box-subtext">Choose the right tier for your studio size and proposal volume.</p>
          </div>

          <!-- Billing Cycle Toggle -->
          <div class="dez-cycle-toggle-wrap">
            <span class="dez-cycle-label ${!isYearly ? 'is-active' : ''}">Monthly</span>
            <label class="dez-switch">
              <input type="checkbox" id="toggle-billing-cycle" ${isYearly ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
            <span class="dez-cycle-label ${isYearly ? 'is-active' : ''}">
              Annual <span class="dez-discount-chip">Save 20%</span>
            </span>
          </div>
        </div>

        <!-- 3 Tier Cards Grid -->
        <div class="dez-plan-cards-grid" id="plan-cards-container">
          ${PLAN_TIERS.map((tier) => {
            const isCurrent = tier.id === currentPlanId;
            const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
            const period = isYearly ? '/year' : '/month';

            return `
            <div class="dez-plan-card ${isCurrent ? 'is-current-plan' : ''} ${tier.popular ? 'is-popular' : ''}">
              <div class="dez-plan-card-header">
                <div class="dez-plan-name-row">
                  <h4 class="dez-plan-name">${tier.name}</h4>
                  ${isCurrent ? `<span class="dez-current-plan-badge">Current plan</span>` : ''}
                </div>
                <div class="dez-plan-price-row">
                  <span class="dez-plan-currency">$</span>
                  <span class="dez-plan-amount">${price === 0 ? '0' : price.toFixed(2)}</span>
                  <span class="dez-plan-period">${price === 0 ? 'Forever free' : period}</span>
                </div>
                <p class="dez-plan-desc">${tier.description}</p>
              </div>

              <div class="dez-plan-card-footer">
                ${
                  isCurrent
                    ? `<button type="button" class="dez-btn-secondary" disabled style="width:100%; height:36px;">Current Plan</button>`
                    : `<button type="button" class="dez-btn-primary" data-action="select-plan" data-plan-id="${tier.id}" style="width:100%; height:36px;">
                        ${tier.id === 'free' ? 'Downgrade' : 'Upgrade to ' + tier.name}
                      </button>`
                }
              </div>
            </div>
          `;
          }).join('')}
        </div>

        <!-- Plan Features Comparison Table (driven by plansConfig.ts) -->
        <div style="margin-top: 32px;">
          <h4 style="font-size:15px; font-weight:600; color:var(--dez-text-primary); margin-bottom:12px;">Plan Features Comparison</h4>
          <div class="dez-table-wrap">
            <table class="dez-comparison-table">
              <thead>
                <tr>
                  <th style="width: 40%;">Feature</th>
                  <th style="width: 20%; text-align: center;">Free ($0)</th>
                  <th style="width: 20%; text-align: center;">Basic ($29.99)</th>
                  <th style="width: 20%; text-align: center;">Upgraded ($49.99)</th>
                </tr>
              </thead>
              <tbody>
                ${PLAN_FEATURES_COMPARISON.map(
                  (feat) => `
                  <tr>
                    <td class="dez-feat-name">${feat.name}</td>
                    <td class="dez-feat-val">${renderFeatureValue(feat.free)}</td>
                    <td class="dez-feat-val">${renderFeatureValue(feat.basic)}</td>
                    <td class="dez-feat-val">${renderFeatureValue(feat.upgraded)}</td>
                  </tr>
                `
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Payout Accounts Section -->
      <div class="dez-bordered-box" style="margin-bottom: 28px;">
        <div class="dez-panel-header-with-actions" style="margin-bottom: 14px;">
          <div>
            <h3 class="dez-box-title">Payout Bank Accounts</h3>
            <p class="dez-box-subtext">Direct escrow earnings withdrawals to verified commercial banking accounts.</p>
          </div>
          <button type="button" class="dez-btn-secondary" id="btn-add-payout-modal-trigger" style="height:32px; padding:0 12px; font-size:12.5px;">
            + Add payout account
          </button>
        </div>

        <div class="dez-payout-accounts-list">
          ${
            payoutAccounts.length === 0
              ? `
            <div class="dez-empty-subtext" style="padding:16px 0;">No bank account linked. Add an account to withdraw project milestone funds.</div>
          `
              : payoutAccounts
                  .map(
                    (acc) => `
            <div class="dez-payout-row">
              <div class="dez-payout-info">
                <div class="dez-payout-bank">${acc.bankName}</div>
                <div class="dez-payout-details">Account Number: <strong>${acc.accountNumberMasked}</strong> &bull; ${acc.accountName}</div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${acc.isPrimary ? `<span class="dez-primary-badge">Primary payout</span>` : ''}
              </div>
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>

      <!-- Invoices List -->
      <div class="dez-bordered-box">
        <h3 class="dez-box-title" style="margin-bottom: 14px;">Invoices & Payment Receipts</h3>
        <div class="dez-table-wrap">
          <table class="dez-invoices-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${
                invoices.length === 0
                  ? `
                <tr><td colspan="5" style="text-align:center; padding:20px; color:var(--dez-text-muted);">No billing invoices generated yet.</td></tr>
              `
                  : invoices
                      .map(
                        (inv) => `
                <tr>
                  <td>${inv.date}</td>
                  <td>${inv.description}</td>
                  <td class="dez-tabular-num">$${inv.amount.toFixed(2)}</td>
                  <td><span class="dez-status-plain is-verified">${inv.status}</span></td>
                  <td style="text-align: right;">
                    <button type="button" class="dez-link-action" data-action="download-inv" data-inv-id="${inv.id}">
                      Download PDF
                    </button>
                  </td>
                </tr>
              `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Payments Not Connected Dev Dialog -->
      <div class="dez-dash-modal-backdrop" id="modal-payment-not-connected" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-pnc-title">
        <div class="dez-dash-modal" style="max-width: 440px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-pnc-title">Payments Not Connected</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-pnc-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size:13.5px; color:var(--dez-text-primary); line-height:1.5;">
              Online payment gateways (Stripe / Paystack) are not connected in this development build.
            </p>
            <p style="font-size:13px; color:var(--dez-text-muted); margin-top:8px; line-height:1.5;">
              Plan selection, escrow billing, and automated recurring upgrades will be connected upon backend database integration.
            </p>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-primary" id="btn-ok-pnc-modal" style="height:36px; padding:0 20px;">
              Understood
            </button>
          </div>
        </div>
      </div>

      <!-- Add Payout Account Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-add-payout" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-payout-title">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-payout-title">Add Payout Bank Account</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-payout-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size:13px; color:var(--dez-text-secondary); margin-bottom:14px;">
              Account numbers are stored securely with end-to-end encryption and masked across the studio interface.
            </p>

            <form id="form-add-payout" novalidate>
              <div class="dez-form-group">
                <label for="payout-bank-select" class="dez-label">Commercial Bank <span class="dez-req">*</span></label>
                <select id="payout-bank-select" class="dez-select" required>
                  <option value="JPMorgan Chase Bank">JPMorgan Chase Bank</option>
                  <option value="Citibank Private Bank">Citibank Private Bank</option>
                  <option value="Zenith Bank">Zenith Bank</option>
                  <option value="Barclays Bank">Barclays Bank</option>
                  <option value="United Bank for Africa (UBA)">United Bank for Africa (UBA)</option>
                  <option value="Stanbic IBTC Bank">Stanbic IBTC Bank</option>
                </select>
              </div>

              <div class="dez-form-group">
                <label for="payout-acc-number" class="dez-label">Account Number (10 digits) <span class="dez-req">*</span></label>
                <input type="text" id="payout-acc-number" class="dez-input" maxlength="10" placeholder="0123456789" required />
                <div class="dez-field-error" id="err-payout-num"></div>
              </div>

              <div class="dez-form-group">
                <label for="payout-acc-name" class="dez-label">Account Name <span class="dez-req">*</span></label>
                <input type="text" id="payout-acc-name" class="dez-input" placeholder="e.g. Sterling Atelier Architecture Ltd" required />
                <div class="dez-field-error" id="err-payout-name"></div>
              </div>
            </form>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-payout-modal" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-save-payout-modal" style="height:36px; padding:0 20px;">
              Add account
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFeatureValue(val: string | boolean): string {
  if (typeof val === 'boolean') {
    return val
      ? `<span style="color:var(--dez-brand); font-weight:bold;">&check;</span>`
      : `<span style="color:var(--dez-text-muted);">&mdash;</span>`;
  }
  return `<span>${val}</span>`;
}

export function initBillingTab(
  container: HTMLElement,
  callbacks: {
    onCycleToggle: (yearly: boolean) => void;
    onAddPayoutAccount: (acc: { bankName: string; accountNumberMasked: string; accountName: string }) => Promise<void>;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const root = container.querySelector('#dez-billing-tab-content') as HTMLElement;
  if (!root) return;

  // Cycle toggle
  root.querySelector('#toggle-billing-cycle')?.addEventListener('change', (e) => {
    const isYearly = (e.target as HTMLInputElement).checked;
    callbacks.onCycleToggle(isYearly);
  });

  // Upgrade/Downgrade click -> opens dev dialog
  const pncModal = root.querySelector('#modal-payment-not-connected') as HTMLElement;
  const btnClosePnc = root.querySelector('#btn-close-pnc-modal') as HTMLButtonElement;
  const btnOkPnc = root.querySelector('#btn-ok-pnc-modal') as HTMLButtonElement;

  const openPnc = () => {
    if (pncModal) {
      pncModal.style.display = 'flex';
      pncModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };
  const closePnc = () => {
    if (pncModal) {
      pncModal.style.display = 'none';
      pncModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  root.querySelectorAll('[data-action="select-plan"]').forEach((btn) => {
    btn.addEventListener('click', openPnc);
  });
  btnClosePnc?.addEventListener('click', closePnc);
  btnOkPnc?.addEventListener('click', closePnc);
  pncModal?.addEventListener('click', (e) => {
    if (e.target === pncModal) closePnc();
  });

  // Download PDF invoice
  root.querySelectorAll('[data-action="download-inv"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      callbacks.onShowToast('Invoice Downloaded', 'PDF receipt downloaded for your records.', 'info');
    });
  });

  // Payout Account Modal
  const payoutModal = root.querySelector('#modal-add-payout') as HTMLElement;
  const btnOpenPayout = root.querySelector('#btn-add-payout-modal-trigger') as HTMLButtonElement;
  const btnClosePayout = root.querySelector('#btn-close-payout-modal') as HTMLButtonElement;
  const btnCancelPayout = root.querySelector('#btn-cancel-payout-modal') as HTMLButtonElement;
  const btnSavePayout = root.querySelector('#btn-save-payout-modal') as HTMLButtonElement;

  const bankSelect = root.querySelector('#payout-bank-select') as HTMLSelectElement;
  const numInput = root.querySelector('#payout-acc-number') as HTMLInputElement;
  const nameInput = root.querySelector('#payout-acc-name') as HTMLInputElement;

  const openPayoutModal = () => {
    if (payoutModal) {
      payoutModal.style.display = 'flex';
      payoutModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (numInput) numInput.value = '';
      if (nameInput) nameInput.value = '';
      ['err-payout-num', 'err-payout-name'].forEach((id) => {
        const el = root.querySelector(`#${id}`);
        if (el) el.textContent = '';
      });
    }
  };

  const closePayoutModal = () => {
    if (payoutModal) {
      payoutModal.style.display = 'none';
      payoutModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  btnOpenPayout?.addEventListener('click', openPayoutModal);
  btnClosePayout?.addEventListener('click', closePayoutModal);
  btnCancelPayout?.addEventListener('click', closePayoutModal);
  payoutModal?.addEventListener('click', (e) => {
    if (e.target === payoutModal) closePayoutModal();
  });

  btnSavePayout?.addEventListener('click', async () => {
    const bank = bankSelect?.value;
    const num = numInput?.value.trim() || '';
    const name = nameInput?.value.trim() || '';

    let valid = true;
    if (num.length !== 10 || !/^\d+$/.test(num)) {
      const err = root.querySelector('#err-payout-num');
      if (err) err.textContent = 'Account number must be 10 numeric digits.';
      valid = false;
    }
    if (!name) {
      const err = root.querySelector('#err-payout-name');
      if (err) err.textContent = 'Account name is required.';
      valid = false;
    }

    if (!valid) return;

    btnSavePayout.disabled = true;
    btnSavePayout.textContent = 'Saving account...';

    try {
      await callbacks.onAddPayoutAccount({
        bankName: bank,
        accountNumberMasked: num,
        accountName: name
      });
      callbacks.onShowToast('Payout Account Added', 'New bank account linked for escrow transfers.', 'success');
      closePayoutModal();
    } finally {
      btnSavePayout.disabled = false;
      btnSavePayout.textContent = 'Add account';
    }
  });
}
