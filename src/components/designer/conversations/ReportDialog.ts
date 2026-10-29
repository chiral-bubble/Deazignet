/**
 * ReportDialog Component
 * Modal for reporting an issue with a conversation to Dezignet Trust & Safety.
 */

import { reportConversation } from '../../../services/conversationsService';

export function renderReportDialog(): string {
  return `
    <div class="dez-dash-modal-backdrop" id="modal-report-conv-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-report-conv-title">
      <div class="dez-dash-modal" style="max-width: 440px;">
        <div class="dez-dash-modal-header">
          <h3 class="dez-dash-modal-title" id="modal-report-conv-title">Report Conversation</h3>
          <button type="button" class="dez-dash-modal-close" id="btn-close-report-conv">&times;</button>
        </div>

        <form id="form-report-conv">
          <div class="dez-dash-modal-body" style="padding: 20px 24px;">
            <p style="font-size: 13px; color: #4B5563; line-height: 1.5; margin: 0 0 16px 0;">
              Reports are reviewed confidentially by Dezignet Trust & Safety within 24 hours.
            </p>

            <div class="dez-form-group" style="margin-bottom: 14px;">
              <label for="report-conv-reason" class="dez-form-label" style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 6px;">
                Reason for report <span style="color: #DC2626;">*</span>
              </label>
              <select id="report-conv-reason" class="dez-form-select" required style="width: 100%; height: 38px; font-size: 13px;">
                <option value="off_platform">Soliciting off-platform payment or contact</option>
                <option value="harassment">Inappropriate or harassing conduct</option>
                <option value="spam">Spam or deceptive proposal</option>
                <option value="other">Other issue</option>
              </select>
            </div>

            <div class="dez-form-group" style="margin-bottom: 12px;">
              <label for="report-conv-details" class="dez-form-label" style="font-size: 13px; font-weight: 500; display: block; margin-bottom: 6px;">
                Additional details
              </label>
              <textarea
                id="report-conv-details"
                class="dez-form-input"
                rows="3"
                placeholder="Describe what occurred..."
                style="width: 100%; font-size: 13px; padding: 10px;"
              ></textarea>
            </div>
          </div>

          <div class="dez-dash-modal-footer" style="padding: 14px 24px; border-top: 1px solid #E5E7EB; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-report-conv" style="height: 36px;">Cancel</button>
            <button type="submit" class="dez-btn-danger" id="btn-submit-report-conv" style="height: 36px; padding: 0 18px;">
              Submit report
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initReportDialog(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): { open: (convId: string) => void; close: () => void } {
  const modal = container.querySelector('#modal-report-conv-backdrop') as HTMLElement;
  const form = container.querySelector('#form-report-conv') as HTMLFormElement;
  const reasonSelect = container.querySelector('#report-conv-reason') as HTMLSelectElement;
  const detailsInput = container.querySelector('#report-conv-details') as HTMLTextAreaElement;
  const btnClose = container.querySelector('#btn-close-report-conv');
  const btnCancel = container.querySelector('#btn-cancel-report-conv');
  const btnSubmit = container.querySelector('#btn-submit-report-conv') as HTMLButtonElement;

  let activeConvId: string | null = null;

  function open(convId: string) {
    activeConvId = convId;
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
      activeConvId = null;
    }
  }

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeConvId) return;

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting...';

    try {
      await reportConversation({
        conversationId: activeConvId,
        reason: (reasonSelect.value as any) || 'other',
        details: detailsInput.value
      });

      close();
      callbacks.onShowToast('Report Submitted', 'Our Trust & Safety team has received your report.', 'info');
    } catch (err: any) {
      callbacks.onShowToast('Error', err.message || 'Failed to submit report.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Submit report';
    }
  });

  return { open, close };
}
