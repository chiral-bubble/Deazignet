/**
 * WithdrawDialog Component
 * Modal for withdrawing a proposal with optional reason select.
 */

import { withdrawProposal } from '../../../services/proposalsService';

export function renderWithdrawDialog(): string {
  return `
    <div class="dez-dash-modal-backdrop" id="modal-withdraw-prop-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-withdraw-prop-title">
      <div class="dez-dash-modal" style="max-width: 440px;">
        <div class="dez-dash-modal-header">
          <h3 class="dez-dash-modal-title" id="modal-withdraw-prop-title">Withdraw Proposal?</h3>
          <button type="button" class="dez-dash-modal-close" id="btn-close-withdraw-prop">&times;</button>
        </div>

        <form id="form-withdraw-prop">
          <div class="dez-dash-modal-body" style="padding: 20px 24px;">
            <p style="font-size: 13.5px; color: #374151; line-height: 1.5; margin: 0 0 16px 0;">
              Withdrawing will archive your offer and notify the client that you are no longer available for this commission.
            </p>

            <div class="dez-form-group" style="margin-bottom: 12px;">
              <label for="withdraw-prop-reason-select" class="dez-form-label" style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 6px;">
                Reason for withdrawal (Optional)
              </label>
              <select id="withdraw-prop-reason-select" class="dez-form-select" style="width: 100%; height: 38px; font-size: 13px;">
                <option value="">Select a reason...</option>
                <option value="Capacity constraints / studio schedule conflict">Capacity constraints / schedule conflict</option>
                <option value="Budget or payment terms misaligned">Budget or payment terms misaligned</option>
                <option value="Project scope or deliverables changed">Project scope changed</option>
                <option value="Submitted by mistake">Submitted by mistake</option>
                <option value="Other commitments">Other commitments</option>
              </select>
            </div>

            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #6B7280;">
              Your proposal slot for this month will be restored automatically upon withdrawal.
            </div>
          </div>

          <div class="dez-dash-modal-footer" style="padding: 14px 24px; border-top: 1px solid #E5E7EB; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-withdraw-prop" style="height: 36px;">Cancel</button>
            <button type="submit" class="dez-btn-danger" id="btn-confirm-withdraw-prop" style="height: 36px; padding: 0 18px;">
              Withdraw proposal
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initWithdrawDialog(
  container: HTMLElement,
  callbacks: {
    onSuccess: (proposalId: string) => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): { open: (proposalId: string) => void; close: () => void } {
  const modal = container.querySelector('#modal-withdraw-prop-backdrop') as HTMLElement;
  const form = container.querySelector('#form-withdraw-prop') as HTMLFormElement;
  const reasonSelect = container.querySelector('#withdraw-prop-reason-select') as HTMLSelectElement;
  const btnClose = container.querySelector('#btn-close-withdraw-prop');
  const btnCancel = container.querySelector('#btn-cancel-withdraw-prop');
  const btnSubmit = container.querySelector('#btn-confirm-withdraw-prop') as HTMLButtonElement;

  let currentPropId: string | null = null;

  function open(propId: string) {
    currentPropId = propId;
    if (form) form.reset();
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      reasonSelect?.focus();
    }
  }

  function close() {
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
      currentPropId = null;
    }
  }

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentPropId) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Withdrawing...';

    try {
      const reason = reasonSelect.value || 'Withdrawn by designer';
      await withdrawProposal(currentPropId, reason);
      const withdrawnId = currentPropId;
      close();
      callbacks.onSuccess(withdrawnId);
      callbacks.onShowToast('Proposal Withdrawn', 'Your proposal was withdrawn and proposal slot restored.', 'info');
    } catch (err: any) {
      callbacks.onShowToast('Error', err.message || 'Failed to withdraw proposal.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Withdraw proposal';
    }
  });

  return { open, close };
}
