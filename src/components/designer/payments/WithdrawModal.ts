/**
 * WithdrawModal Component
 * Interactive withdrawal modal:
 * - Amount input with "Withdraw all" shortcut
 * - Strict inline validation (min threshold, available balance)
 * - Destination account selection
 * - Fee breakdown ($0 ACH/direct deposit) & arrival estimate from config
 * - Confirmation step
 * - Real-time updates to global dataset balances & transactions
 */

import { requestWithdrawal, getPayoutAccounts } from '../../../services/paymentsService';
import { sharedDataset, type SharedPayoutAccount } from '../../../mocks/dataset';
import { PAYMENTS_CONFIG } from '../../../config/paymentsConfig';
import { formatMoney } from '../../../utils/formatters';

export function renderWithdrawModal(): string {
  return `
    <div class="dez-dash-modal-backdrop" id="modal-withdraw-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-withdraw-title">
      <div class="dez-dash-modal" style="max-width: 480px;">
        <div class="dez-dash-modal-header">
          <h3 class="dez-dash-modal-title" id="modal-withdraw-title">Withdraw Funds</h3>
          <button type="button" class="dez-dash-modal-close" id="btn-close-withdraw" aria-label="Close modal">&times;</button>
        </div>

        <form id="form-withdraw" novalidate>
          <div class="dez-dash-modal-body" style="padding: 20px 24px;">
            <!-- Available balance banner -->
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 12px; color: #6B7280;">Available balance</div>
                <div class="dez-tabular-num" id="withdraw-available-display" style="font-size: 18px; font-weight: 600; color: #111827; margin-top: 2px;">
                  $${formatMoney(sharedDataset.balances.availableToWithdraw)}
                </div>
              </div>
              <button type="button" class="dez-btn-secondary" id="btn-withdraw-all-shortcut" style="height: 32px; font-size: 12px; padding: 0 12px;">
                Withdraw all
              </button>
            </div>

            <!-- Amount Input -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="withdraw-amount-input" class="dez-form-label" style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block; color: #374151;">
                Amount to withdraw (USD) <span style="color: #DC2626;">*</span>
              </label>
              <div style="position: relative;">
                <span style="position: absolute; left: 12px; top: 10px; font-size: 14px; color: #6B7280; font-weight: 500;">$</span>
                <input
                  type="number"
                  id="withdraw-amount-input"
                  class="dez-form-input"
                  placeholder="0.00"
                  step="0.01"
                  min="${PAYMENTS_CONFIG.minimumWithdrawalAmount}"
                  required
                  style="padding-left: 28px; height: 38px; font-size: 14px;"
                />
              </div>
              <div class="dez-form-error" id="err-withdraw-amount" style="font-size: 12px; color: #DC2626; margin-top: 4px; display: none;"></div>
            </div>

            <!-- Destination Account Select -->
            <div class="dez-form-group" style="margin-bottom: 20px;">
              <label for="withdraw-destination-select" class="dez-form-label" style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block; color: #374151;">
                Destination bank account <span style="color: #DC2626;">*</span>
              </label>
              <select id="withdraw-destination-select" class="dez-form-select" required style="width: 100%; height: 38px; font-size: 13px;">
                <!-- Populated dynamically -->
              </select>
              <div class="dez-form-error" id="err-withdraw-destination" style="font-size: 12px; color: #DC2626; margin-top: 4px; display: none;"></div>
            </div>

            <!-- Transfer Estimates & Fee breakdown -->
            <div style="border-top: 1px solid #E5E7EB; padding-top: 14px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #6B7280;">
                <span>Transfer fee</span>
                <span style="color: #111827; font-weight: 500;">Free ($0.00)</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #6B7280;">
                <span>Estimated arrival</span>
                <span style="color: #111827; font-weight: 500;">1–2 business days</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 600; color: #111827; margin-top: 10px; padding-top: 8px; border-top: 1px dashed #E5E7EB;">
                <span>Total amount debited</span>
                <span class="dez-tabular-num" id="withdraw-total-debited">$0.00</span>
              </div>
            </div>
          </div>

          <div class="dez-dash-modal-footer" style="padding: 14px 24px; border-top: 1px solid #E5E7EB; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-withdraw" style="height: 38px; padding: 0 16px;">Cancel</button>
            <button type="submit" class="dez-btn-primary" id="btn-confirm-withdraw" style="height: 38px; padding: 0 20px;">
              Confirm withdrawal
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initWithdrawModal(
  container: HTMLElement,
  callbacks: {
    onWithdrawalCompleted: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): { open: () => void; close: () => void } {
  const backdrop = container.querySelector('#modal-withdraw-backdrop') as HTMLElement;
  const form = container.querySelector('#form-withdraw') as HTMLFormElement;
  const amountInput = container.querySelector('#withdraw-amount-input') as HTMLInputElement;
  const destSelect = container.querySelector('#withdraw-destination-select') as HTMLSelectElement;
  const btnWithdrawAll = container.querySelector('#btn-withdraw-all-shortcut') as HTMLButtonElement;
  const availDisplay = container.querySelector('#withdraw-available-display') as HTMLElement;
  const totalDebited = container.querySelector('#withdraw-total-debited') as HTMLElement;
  const btnClose = container.querySelector('#btn-close-withdraw') as HTMLButtonElement;
  const btnCancel = container.querySelector('#btn-cancel-withdraw') as HTMLButtonElement;
  const btnSubmit = container.querySelector('#btn-confirm-withdraw') as HTMLButtonElement;
  const errAmount = container.querySelector('#err-withdraw-amount') as HTMLElement;
  const errDest = container.querySelector('#err-withdraw-destination') as HTMLElement;

  let accounts: SharedPayoutAccount[] = [];

  async function open() {
    if (!backdrop) return;
    form?.reset();
    if (errAmount) errAmount.style.display = 'none';
    if (errDest) errDest.style.display = 'none';

    // Populate balances
    if (availDisplay) {
      availDisplay.textContent = `$${formatMoney(sharedDataset.balances.availableToWithdraw)}`;
    }
    if (totalDebited) totalDebited.textContent = '$0.00';

    // Fetch accounts
    accounts = await getPayoutAccounts();
    if (destSelect) {
      if (accounts.length === 0) {
        destSelect.innerHTML = `<option value="">No verified accounts — add one first</option>`;
        if (btnSubmit) btnSubmit.disabled = true;
      } else {
        destSelect.innerHTML = accounts
          .map(
            (acc) => `
          <option value="${acc.id}" ${acc.isDefault ? 'selected' : ''}>
            ${acc.bankName} (${acc.accountNumberMasked}) ${acc.isDefault ? '• Default' : ''}
          </option>
        `
          )
          .join('');
        if (btnSubmit) btnSubmit.disabled = false;
      }
    }

    backdrop.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    amountInput?.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Update total debited live
  amountInput?.addEventListener('input', () => {
    const val = parseFloat(amountInput.value) || 0;
    if (totalDebited) {
      totalDebited.textContent = `$${formatMoney(val)}`;
    }
    if (errAmount) errAmount.style.display = 'none';
  });

  // Shortcut: Withdraw All
  btnWithdrawAll?.addEventListener('click', () => {
    const max = sharedDataset.balances.availableToWithdraw;
    if (amountInput) {
      amountInput.value = max.toFixed(2);
      if (totalDebited) totalDebited.textContent = `$${formatMoney(max)}`;
      if (errAmount) errAmount.style.display = 'none';
    }
  });

  // Submit & Validation
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amt = parseFloat(amountInput?.value || '0');
    const destId = destSelect?.value;
    const avail = sharedDataset.balances.availableToWithdraw;
    const min = PAYMENTS_CONFIG.minimumWithdrawalAmount;

    let valid = true;

    if (isNaN(amt) || amt < min) {
      if (errAmount) {
        errAmount.textContent = `Minimum withdrawal amount is $${min.toFixed(2)}.`;
        errAmount.style.display = 'block';
      }
      valid = false;
    } else if (amt > avail) {
      if (errAmount) {
        errAmount.textContent = `Amount cannot exceed your available balance of $${formatMoney(avail)}.`;
        errAmount.style.display = 'block';
      }
      valid = false;
    } else if (errAmount) {
      errAmount.style.display = 'none';
    }

    if (!destId) {
      if (errDest) {
        errDest.textContent = 'Please choose a payout account.';
        errDest.style.display = 'block';
      }
      valid = false;
    } else if (errDest) {
      errDest.style.display = 'none';
    }

    if (!valid) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Processing...';

    try {
      await requestWithdrawal(amt, destId);
      close();
      callbacks.onWithdrawalCompleted();
      callbacks.onShowToast(
        'Withdrawal Requested',
        `$${formatMoney(amt)} submitted to bank clearing. Balances updated.`,
        'success'
      );
    } catch (err: any) {
      callbacks.onShowToast('Withdrawal Error', err.message || 'Failed to process withdrawal.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Confirm withdrawal';
    }
  });

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  return { open, close };
}
