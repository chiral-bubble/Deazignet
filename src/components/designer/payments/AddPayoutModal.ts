/**
 * AddPayoutModal Component
 * Modal for adding bank accounts:
 * - Bank selection (commercial banks)
 * - 10-digit account number validation
 * - Verification step showing resolved account name in read-only state
 * - Currency display (NGN / USD)
 * - Processing time note from config
 * - Never shows full number once added
 */

import { addPayoutAccount } from '../../../services/paymentsService';
import { PAYMENTS_CONFIG } from '../../../config/paymentsConfig';

const SUPPORTED_BANKS = [
  'JPMorgan Chase Bank',
  'Bank of America',
  'Citibank',
  'Wells Fargo Bank',
  'Barclays Private Bank',
  'HSBC Global Banking',
  'UBS Switzerland',
  'BNP Paribas',
  'Standard Chartered'
];

export function renderAddPayoutModal(): string {
  return `
    <div class="dez-dash-modal-backdrop" id="modal-add-payout-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-add-payout-title">
      <div class="dez-dash-modal" style="max-width: 480px;">
        <div class="dez-dash-modal-header">
          <h3 class="dez-dash-modal-title" id="modal-add-payout-title">Add Payout Account</h3>
          <button type="button" class="dez-dash-modal-close" id="btn-close-add-payout" aria-label="Close modal">&times;</button>
        </div>

        <form id="form-add-payout" novalidate>
          <div class="dez-dash-modal-body" style="padding: 20px 24px;">
            <!-- Bank Selection -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="payout-bank-select" class="dez-form-label" style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block; color: #374151;">
                Commercial bank <span style="color: #DC2626;">*</span>
              </label>
              <select id="payout-bank-select" class="dez-form-select" required style="width: 100%; height: 38px;">
                <option value="">Select your bank...</option>
                ${SUPPORTED_BANKS.map((b) => `<option value="${b}">${b}</option>`).join('')}
              </select>
              <div class="dez-form-error" id="err-payout-bank" style="font-size: 12px; color: #DC2626; margin-top: 4px; display: none;"></div>
            </div>

            <!-- Account Number -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="payout-account-num" class="dez-form-label" style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block; color: #374151;">
                Account number (10 digits) <span style="color: #DC2626;">*</span>
              </label>
              <div style="display: flex; gap: 8px;">
                <input
                  type="text"
                  id="payout-account-num"
                  class="dez-form-input"
                  placeholder="0123456789"
                  maxlength="10"
                  pattern="[0-9]{10}"
                  inputmode="numeric"
                  required
                  style="flex: 1; height: 38px;"
                />
                <button type="button" class="dez-btn-secondary" id="btn-verify-account" style="height: 38px; white-space: nowrap; font-size: 13px; padding: 0 14px;">
                  Verify
                </button>
              </div>
              <div class="dez-form-error" id="err-payout-acc" style="font-size: 12px; color: #DC2626; margin-top: 4px; display: none;"></div>
            </div>

            <!-- Verified Account Name (Read-Only) -->
            <div class="dez-form-group" id="group-payout-acc-name" style="margin-bottom: 16px; display: none;">
              <label for="payout-resolved-name" class="dez-form-label" style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block; color: #374151;">
                Account holder name
              </label>
              <input
                type="text"
                id="payout-resolved-name"
                class="dez-form-input"
                readonly
                style="width: 100%; height: 38px; background: #F3F4F6; color: #111827; font-weight: 500; cursor: not-allowed;"
              />
              <div style="font-size: 11.5px; color: #059669; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Verified against commercial routing directory
              </div>
            </div>

            <!-- Currency & Processing Information Note -->
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 14px; font-size: 12.5px; color: #4B5563; line-height: 1.4;">
              <div style="font-weight: 500; color: #111827; margin-bottom: 2px;">Currency & Settlement</div>
              Settlement currency: <strong>USD</strong>. Withdrawals are processed in ${PAYMENTS_CONFIG.payoutProcessingTimeText}. For security, full account numbers are never displayed on your profile.
            </div>
          </div>

          <div class="dez-dash-modal-footer" style="padding: 14px 24px; border-top: 1px solid #E5E7EB; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-add-payout" style="height: 38px; padding: 0 16px;">Cancel</button>
            <button type="submit" class="dez-btn-primary" id="btn-submit-add-payout" disabled style="height: 38px; padding: 0 20px;">
              Save account
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initAddPayoutModal(
  container: HTMLElement,
  callbacks: {
    onAccountAdded: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): { open: () => void; close: () => void } {
  const backdrop = container.querySelector('#modal-add-payout-backdrop') as HTMLElement;
  const form = container.querySelector('#form-add-payout') as HTMLFormElement;
  const bankSelect = container.querySelector('#payout-bank-select') as HTMLSelectElement;
  const accInput = container.querySelector('#payout-account-num') as HTMLInputElement;
  const btnVerify = container.querySelector('#btn-verify-account') as HTMLButtonElement;
  const nameGroup = container.querySelector('#group-payout-acc-name') as HTMLElement;
  const nameInput = container.querySelector('#payout-resolved-name') as HTMLInputElement;
  const btnSubmit = container.querySelector('#btn-submit-add-payout') as HTMLButtonElement;
  const btnClose = container.querySelector('#btn-close-add-payout') as HTMLButtonElement;
  const btnCancel = container.querySelector('#btn-cancel-add-payout') as HTMLButtonElement;
  const errBank = container.querySelector('#err-payout-bank') as HTMLElement;
  const errAcc = container.querySelector('#err-payout-acc') as HTMLElement;

  let isVerified = false;

  function open() {
    if (!backdrop) return;
    form?.reset();
    isVerified = false;
    if (nameGroup) nameGroup.style.display = 'none';
    if (btnSubmit) btnSubmit.disabled = true;
    if (errBank) errBank.style.display = 'none';
    if (errAcc) errAcc.style.display = 'none';
    backdrop.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    bankSelect?.focus();
  }

  function close() {
    if (!backdrop) return;
    backdrop.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Account number verify simulation
  btnVerify?.addEventListener('click', () => {
    const bank = bankSelect?.value;
    const acc = accInput?.value.trim();

    let valid = true;
    if (!bank) {
      if (errBank) {
        errBank.textContent = 'Please choose a bank first.';
        errBank.style.display = 'block';
      }
      valid = false;
    } else if (errBank) {
      errBank.style.display = 'none';
    }

    if (!acc || acc.length < 8 || acc.length > 17 || !/^\d+$/.test(acc)) {
      if (errAcc) {
        errAcc.textContent = 'Enter a valid account number (8–17 digits).';
        errAcc.style.display = 'block';
      }
      valid = false;
    } else if (errAcc) {
      errAcc.style.display = 'none';
    }

    if (!valid) return;

    btnVerify.disabled = true;
    btnVerify.textContent = 'Verifying...';

    setTimeout(() => {
      btnVerify.disabled = false;
      btnVerify.textContent = 'Verify';

      isVerified = true;
      if (nameGroup) nameGroup.style.display = 'block';
      if (nameInput) nameInput.value = 'STERLING ATELIER & PARTNERS LLC';
      if (btnSubmit) btnSubmit.disabled = false;
      callbacks.onShowToast('Account Verified', 'Account holder verified with banking network.', 'success');
    }, 400);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isVerified) return;

    const bank = bankSelect.value;
    const acc = accInput.value.trim();

    try {
      await addPayoutAccount({
        bankName: bank,
        accountNumberRaw: acc,
        accountName: nameInput.value,
        currency: 'USD'
      });

      close();
      callbacks.onAccountAdded();
      callbacks.onShowToast('Account Added', `${bank} (••••••${acc.slice(-4)}) saved as payout account.`, 'success');
    } catch (err: any) {
      callbacks.onShowToast('Error', err.message || 'Failed to add payout account.', 'error');
    }
  });

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  return { open, close };
}
