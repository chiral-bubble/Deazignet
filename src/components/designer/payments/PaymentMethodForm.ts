/**
 * PaymentMethodForm Component
 * Card management form with clear integration placeholder for hosted Stripe / Paystack fields:
 * - Shows "Payments are not connected yet" notice in dev
 * - Never stores raw card numbers (only brand, mock token, last4, exp)
 * - Add, replace, or remove card
 */

import { type SharedPlanState } from '../../../mocks/dataset';

export function renderPaymentMethodCard(planState: SharedPlanState): string {
  const card = planState.paymentMethod;

  return `
    <div class="dez-payment-method-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
        <div>
          <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Payment method for your plan</h3>
          <p style="font-size: 13px; color: #6B7280; margin: 2px 0 0 0;">Used for monthly or annual membership dues and proposal slot renewals.</p>
        </div>
        <div style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; border-radius: 4px; padding: 3px 8px; font-size: 11.5px; font-weight: 500;">
          Payments are not connected yet (Dev preview)
        </div>
      </div>

      ${
        card
          ? `
        <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 16px; background: #F7F7F8; display: flex; justify-content: space-between; align-items: center; max-width: 480px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 26px; background: #FFFFFF; border: 1px solid #D1D5DB; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #1E3A8A;">
              ${card.brand.toUpperCase()}
            </div>
            <div>
              <div style="font-size: 13.5px; font-weight: 500; color: #111827;">${card.brand} ending in ${card.last4}</div>
              <div style="font-size: 12px; color: #6B7280;">Expires ${card.expMonth}/${card.expYear}</div>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button type="button" class="dez-btn-secondary" id="btn-replace-card" style="height: 32px; font-size: 12px; padding: 0 10px;">
              Replace
            </button>
            <button type="button" class="dez-btn-secondary" id="btn-remove-card" style="height: 32px; font-size: 12px; padding: 0 10px; color: #DC2626;">
              Remove
            </button>
          </div>
        </div>
      `
          : `
        <div style="border: 1px dashed #E5E7EB; border-radius: 6px; padding: 20px; text-align: center; max-width: 480px;">
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 12px 0;">No billing card attached to this account.</p>
          <button type="button" class="dez-btn-secondary" id="btn-add-card" style="height: 34px; font-size: 13px; padding: 0 14px;">
            + Add payment method
          </button>
        </div>
      `
      }

      <!-- Modal for Adding / Replacing Card with Hosted Field Placeholder -->
      <div class="dez-dash-modal-backdrop" id="modal-card-backdrop" style="display: none;" role="dialog" aria-modal="true">
        <div class="dez-dash-modal" style="max-width: 440px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-card-title">Add Payment Method</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-card-modal">&times;</button>
          </div>
          <form id="form-card-placeholder">
            <div class="dez-dash-modal-body" style="padding: 20px 24px;">
              <div style="background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; margin-bottom: 16px; font-size: 12px; color: #4B5563;">
                <strong>Security Guarantee:</strong> Card details are tokenized and processed securely. Dezignet servers never receive or store raw card numbers.
              </div>

              <!-- HOSTED FIELD PLACEHOLDER START -->
              <!-- 
                DEVELOPER NOTE / INTEGRATION POINT:
                Mount payment gateway element here (e.g. Stripe Elements or Paystack Inline):
                elements.create('card').mount('#stripe-card-element')
              -->
              <div class="dez-form-group" style="margin-bottom: 14px;">
                <label class="dez-form-label" style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 6px;">
                  Card details (Hosted gateway container)
                </label>
                <div id="stripe-card-element-container" style="border: 1px solid #D1D5DB; border-radius: 6px; padding: 10px 12px; background: #FFFFFF; font-size: 13px; color: #374151;">
                  <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="color: #6B7280;">•••• •••• •••• 4242</span>
                    <span style="margin-left: auto; color: #9CA3AF;">12 / 28</span>
                    <span style="color: #9CA3AF;">CVC</span>
                  </div>
                </div>
                <div style="font-size: 11.5px; color: #6B7280; margin-top: 4px;">Mock token generated in development mode.</div>
              </div>
              <!-- HOSTED FIELD PLACEHOLDER END -->

              <div class="dez-form-group" style="margin-bottom: 14px;">
                <label for="card-holder-name" class="dez-form-label" style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 6px;">
                  Name on card
                </label>
                <input
                  type="text"
                  id="card-holder-name"
                  class="dez-form-input"
                  value="Alexandre Sterling"
                  required
                  style="width: 100%; height: 38px; font-size: 13px;"
                />
              </div>
            </div>

            <div class="dez-dash-modal-footer" style="padding: 14px 24px; border-top: 1px solid #E5E7EB; display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="dez-btn-secondary" id="btn-cancel-card" style="height: 36px;">Cancel</button>
              <button type="submit" class="dez-btn-primary" id="btn-save-card" style="height: 36px; padding: 0 18px;">
                Save card
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function initPaymentMethodForm(
  container: HTMLElement,
  callbacks: {
    onSaveCard: (brand: 'Visa' | 'Mastercard', last4: string) => Promise<void>;
    onRemoveCard: () => Promise<void>;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const modal = container.querySelector('#modal-card-backdrop') as HTMLElement;
  const btnAdd = container.querySelector('#btn-add-card');
  const btnReplace = container.querySelector('#btn-replace-card');
  const btnRemove = container.querySelector('#btn-remove-card');
  const btnClose = container.querySelector('#btn-close-card-modal');
  const btnCancel = container.querySelector('#btn-cancel-card');
  const form = container.querySelector('#form-card-placeholder') as HTMLFormElement;

  function open() {
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function close() {
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  btnAdd?.addEventListener('click', open);
  btnReplace?.addEventListener('click', open);
  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);

  btnRemove?.addEventListener('click', async () => {
    await callbacks.onRemoveCard();
    callbacks.onShowToast('Payment Method Removed', 'Card unlinked from billing profile.', 'info');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await callbacks.onSaveCard('Visa', '4242');
    close();
    callbacks.onShowToast('Card Saved', 'Payment method saved via mock gateway token.', 'success');
  });
}
