/**
 * PayoutAccounts Component
 * Manages bank accounts and displays withdrawal history:
 * - Bank accounts list (masked number, verification status, default badge)
 * - Set as default action
 * - Remove account with confirmation
 * - Add payout account trigger
 * - Withdrawal history table (Date, Amount, Account, Status, Reference)
 */

import {
  getPayoutAccounts,
  setDefaultPayoutAccount,
  removePayoutAccount,
  getWithdrawals
} from '../../../services/paymentsService';
import { type SharedPayoutAccount, type SharedWithdrawal } from '../../../mocks/dataset';
import { formatMoney } from '../../../utils/formatters';

export function renderPayoutAccounts(): string {
  return `
    <div class="dez-payouts-section">
      <!-- Top: Linked Accounts Header & List -->
      <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Linked payout accounts</h2>
            <p style="font-size: 13px; color: #6B7280; margin: 2px 0 0 0;">Commercial accounts configured for direct earnings transfers.</p>
          </div>
          <button type="button" class="dez-btn-secondary" id="btn-open-add-payout-modal" style="height: 36px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add payout account
          </button>
        </div>

        <div id="payout-accounts-list-container">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Bottom: Withdrawal History Table -->
      <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div style="padding: 18px 20px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Withdrawal history</h2>
            <p style="font-size: 13px; color: #6B7280; margin: 2px 0 0 0;">Record of all processed and pending wire settlements.</p>
          </div>
        </div>

        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                <th style="padding: 12px 16px;">Date</th>
                <th style="padding: 12px 16px;">Reference</th>
                <th style="padding: 12px 16px;">Destination</th>
                <th style="padding: 12px 16px; text-align: right;">Amount</th>
                <th style="padding: 12px 16px; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody id="withdrawals-table-body">
              <!-- Rendered dynamically -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Remove Account Confirm Dialog -->
      <div class="dez-dash-modal-backdrop" id="modal-remove-payout-backdrop" style="display: none;" role="dialog" aria-modal="true">
        <div class="dez-dash-modal" style="max-width: 420px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title">Remove Payout Account?</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-remove-payout">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size: 13.5px; color: #374151; line-height: 1.5;" id="remove-payout-confirm-text">
              Are you sure you want to remove this account? Pending withdrawals already in progress will not be affected.
            </p>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-remove-payout" style="height: 36px;">Cancel</button>
            <button type="button" class="dez-btn-danger" id="btn-confirm-remove-payout" style="height: 36px; padding: 0 16px;">Remove</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initPayoutAccounts(
  container: HTMLElement,
  callbacks: {
    onOpenAddModal: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): { reload: () => void } {
  const accountsContainer = container.querySelector('#payout-accounts-list-container') as HTMLElement;
  const withdrawalsBody = container.querySelector('#withdrawals-table-body') as HTMLElement;
  const btnAdd = container.querySelector('#btn-open-add-payout-modal');
  const removeModal = container.querySelector('#modal-remove-payout-backdrop') as HTMLElement;
  const btnCloseRemove = container.querySelector('#btn-close-remove-payout');
  const btnCancelRemove = container.querySelector('#btn-cancel-remove-payout');
  const btnConfirmRemove = container.querySelector('#btn-confirm-remove-payout') as HTMLButtonElement;

  let pendingRemoveId: string | null = null;

  async function loadData() {
    const [accounts, withdrawals] = await Promise.all([getPayoutAccounts(), getWithdrawals()]);
    renderAccounts(accounts);
    renderWithdrawals(withdrawals);
  }

  function renderAccounts(accounts: SharedPayoutAccount[]) {
    if (!accountsContainer) return;

    if (accounts.length === 0) {
      accountsContainer.innerHTML = `
        <div style="border: 1px dashed #E5E7EB; border-radius: 8px; padding: 32px; text-align: center;">
          <div style="font-weight: 500; font-size: 14px; color: #111827; margin-bottom: 4px;">No payout accounts connected</div>
          <div style="font-size: 13px; color: #6B7280; margin-bottom: 16px;">Add your commercial bank account to receive milestone and hourly payouts.</div>
          <button type="button" class="dez-btn-primary" id="btn-empty-add-payout" style="height: 36px; font-size: 13px; padding: 0 16px;">
            + Add your first account
          </button>
        </div>
      `;
      accountsContainer.querySelector('#btn-empty-add-payout')?.addEventListener('click', callbacks.onOpenAddModal);
      return;
    }

    accountsContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
        ${accounts
          .map(
            (acc) => `
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; background: #FAFAFA; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #111827;">${acc.bankName}</div>
                <div style="font-size: 13px; color: #4B5563; margin-top: 2px;">${acc.accountName}</div>
              </div>
              ${
                acc.isDefault
                  ? `<span class="dez-status-pill pill-blue" style="font-size: 11px;">Default</span>`
                  : `<span class="dez-status-pill pill-green" style="font-size: 11px;">${acc.verificationStatus}</span>`
              }
            </div>

            <div style="font-size: 13px; color: #6B7280; margin-top: 12px; font-family: monospace;">
              Account: <strong style="color: #111827;">${acc.accountNumberMasked}</strong> (${acc.currency})
            </div>

            <div style="display: flex; gap: 12px; margin-top: 16px; border-top: 1px solid #E5E7EB; padding-top: 12px; font-size: 12.5px;">
              ${
                !acc.isDefault
                  ? `<button type="button" class="dez-inline-link-btn btn-set-default" data-acc-id="${acc.id}" style="color: var(--dez-primary-blue, #2F7BE5); background: none; border: none; cursor: pointer; padding: 0;">Set as default</button>`
                  : `<span style="color: #6B7280;">Default destination</span>`
              }
              <button type="button" class="dez-inline-link-btn btn-remove-account" data-acc-id="${acc.id}" style="color: #DC2626; background: none; border: none; cursor: pointer; padding: 0; margin-left: auto;">
                Remove
              </button>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    // Attach listeners
    accountsContainer.querySelectorAll<HTMLButtonElement>('.btn-set-default').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-acc-id');
        if (id) {
          await setDefaultPayoutAccount(id);
          callbacks.onShowToast('Default Account Updated', 'Payout destination updated.', 'info');
          loadData();
        }
      });
    });

    accountsContainer.querySelectorAll<HTMLButtonElement>('.btn-remove-account').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-acc-id');
        if (id) {
          pendingRemoveId = id;
          if (removeModal) {
            removeModal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
          }
        }
      });
    });
  }

  function renderWithdrawals(withdrawals: SharedWithdrawal[]) {
    if (!withdrawalsBody) return;

    if (withdrawals.length === 0) {
      withdrawalsBody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 32px; text-align: center; color: #6B7280;">
            No withdrawals made yet.
          </td>
        </tr>
      `;
      return;
    }

    withdrawalsBody.innerHTML = withdrawals
      .map(
        (w) => `
      <tr style="border-bottom: 1px solid #F3F4F6;">
        <td style="padding: 12px 16px; color: #6B7280;">${w.date}</td>
        <td style="padding: 12px 16px; font-family: monospace; font-size: 12px; color: #4B5563;">${w.reference}</td>
        <td style="padding: 12px 16px; color: #111827; font-weight: 500;">
          ${w.bankName} <span style="color: #6B7280; font-weight: 400;">(${w.destinationAccount})</span>
        </td>
        <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; font-weight: 600; color: #111827;">
          $${formatMoney(w.amount)}
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <span class="dez-status-pill ${
            w.status === 'Paid' ? 'pill-green' : w.status === 'Processing' ? 'pill-blue' : 'pill-red'
          }">
            ${w.status}
          </span>
          ${w.failureReason ? `<div style="font-size: 11px; color: #DC2626; margin-top: 2px;">${w.failureReason}</div>` : ''}
        </td>
      </tr>
    `
      )
      .join('');
  }

  // Remove Modal handlers
  function closeRemoveModal() {
    if (removeModal) {
      removeModal.style.display = 'none';
      document.body.style.overflow = '';
      pendingRemoveId = null;
    }
  }

  btnCloseRemove?.addEventListener('click', closeRemoveModal);
  btnCancelRemove?.addEventListener('click', closeRemoveModal);
  btnConfirmRemove?.addEventListener('click', async () => {
    if (pendingRemoveId) {
      await removePayoutAccount(pendingRemoveId);
      closeRemoveModal();
      callbacks.onShowToast('Account Removed', 'Payout account removed from profile.', 'info');
      loadData();
    }
  });

  btnAdd?.addEventListener('click', callbacks.onOpenAddModal);

  // Initial load
  loadData();

  return { reload: loadData };
}
