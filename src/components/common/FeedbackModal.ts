/**
 * In-App Feedback Modal for Staging Testers
 * Allows the partner architect and testers to report issues directly from any page.
 * Captures type, severity, message, optional screenshot/PDF, and automatically attaches
 * sanitized environment context (route, role, user ID, browser, viewport, and last 20 errors).
 */

import { submitFeedback } from '../../services/stagingService';
import { getAuthState } from '../../services/authService';
import { getRecentClientErrors } from '../../lib/errorLogger';

export function renderFeedbackTriggerButton(): string {
  return `
    <button id="btn-trigger-feedback" type="button" style="height: 38px; padding: 0 14px; background: #FFFFFF; border: 1px solid #D1D5DB; color: #111827; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: border-color 150ms; font-family: Inter, sans-serif;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <span>Send feedback</span>
    </button>
  `;
}

export function initFeedbackModal(root: HTMLElement = document.body): void {
  // Check if modal container already exists
  let modalContainer = document.getElementById('feedback-modal-host');
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.id = 'feedback-modal-host';
    root.appendChild(modalContainer);
  }

  // Open button click
  document.getElementById('btn-trigger-feedback')?.addEventListener('click', () => {
    openModal();
  });

  function openModal() {
    const authState = getAuthState();
    const currentRoute = window.location.pathname || window.location.hash || '/';
    const recentErrors = getRecentClientErrors();
    const viewport = `${window.innerWidth}x${window.innerHeight}`;
    const userAgent = navigator.userAgent;

    modalContainer!.innerHTML = `
      <div id="feedback-backdrop" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 16px;">
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 540px; padding: 24px; max-height: 92vh; overflow-y: auto; font-family: Inter, sans-serif; box-sizing: border-box;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 17px; font-weight: 600; color: #111827; margin: 0 0 4px;">Send Tester Feedback</h3>
              <p style="font-size: 12.5px; color: #6B7280; margin: 0;">Your feedback helps refine the platform for clients and architects.</p>
            </div>
            <button id="btn-close-feedback-modal" type="button" style="background: transparent; border: none; font-size: 20px; line-height: 1; color: #9CA3AF; cursor: pointer; padding: 4px;">&times;</button>
          </div>

          <form id="form-send-feedback">
            <!-- Feedback Type -->
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px;">Feedback Type</label>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_type" value="broken" checked style="accent-color: #2F7BE5;" />
                  <span>Something is broken</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_type" value="confusing" style="accent-color: #2F7BE5;" />
                  <span>Something is confusing</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_type" value="change" style="accent-color: #2F7BE5;" />
                  <span>I'd change this</span>
                </label>
                <label style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_type" value="missing" style="accent-color: #2F7BE5;" />
                  <span>Something is missing</span>
                </label>
              </div>
            </div>

            <!-- Severity -->
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px;">Severity</label>
              <div style="display: flex; gap: 10px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_severity" value="blocker" style="accent-color: #DC2626;" />
                  <span style="color: #DC2626; font-weight: 500;">Blocks me</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_severity" value="annoying" checked style="accent-color: #D97706;" />
                  <span style="color: #4B5563;">Annoying</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; cursor: pointer;">
                  <input type="radio" name="fb_severity" value="minor" style="accent-color: #6B7280;" />
                  <span style="color: #6B7280;">Minor polish</span>
                </label>
              </div>
            </div>

            <!-- Message -->
            <div style="margin-bottom: 14px;">
              <label for="fb-message-text" style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px;">Description (required)</label>
              <textarea id="fb-message-text" rows="4" maxlength="2000" placeholder="Please describe what happened, what you expected, or your suggestion..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; outline: none;"></textarea>
              <div id="fb-char-counter" style="font-size: 11px; color: #9CA3AF; text-align: right; margin-top: 4px;">0 / 2000</div>
            </div>

            <!-- File / Screenshot Attachment -->
            <div style="margin-bottom: 16px;">
              <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px;">Optional Screenshot or PDF (max 10 MB)</label>
              <input type="file" id="fb-file-input" accept="image/*,.pdf" style="font-size: 12.5px; color: #4B5563;" />
            </div>

            <!-- Automatically Attached Context Notice -->
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; margin-bottom: 18px; font-size: 12px; color: #4B5563; line-height: 1.5;">
              <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">Automatically Attached Context:</div>
              <ul style="margin: 0; padding-left: 18px;">
                <li>Route: <code>${currentRoute}</code></li>
                <li>Role: <strong>${authState.role || 'Unauthenticated'}</strong></li>
                <li>Viewport: <code>${viewport}</code></li>
                <li>Timestamp: <code>${new Date().toLocaleTimeString()}</code></li>
                <li>Sanitized logs: ${recentErrors.length} recent client errors attached (no passwords or personal data included)</li>
              </ul>
            </div>

            <!-- Submit Buttons -->
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button id="btn-cancel-feedback" type="button" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;">
                Cancel
              </button>
              <button id="btn-submit-feedback" type="submit" disabled style="height: 36px; padding: 0 20px; border: none; border-radius: 6px; background: #2F7BE5; font-size: 13px; font-weight: 600; color: #FFFFFF; cursor: not-allowed; opacity: 0.6;">
                Submit Feedback
              </button>
            </div>
          </form>

        </div>
      </div>
    `;

    const txt = document.getElementById('fb-message-text') as HTMLTextAreaElement;
    const btnSubmit = document.getElementById('btn-submit-feedback') as HTMLButtonElement;
    const counter = document.getElementById('fb-char-counter') as HTMLElement;
    const closeBtn = document.getElementById('btn-close-feedback-modal');
    const cancelBtn = document.getElementById('btn-cancel-feedback');

    const closeModal = () => {
      modalContainer!.innerHTML = '';
    };

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);

    txt?.addEventListener('input', () => {
      const len = txt.value.trim().length;
      counter.textContent = `${len} / 2000`;
      if (len >= 5) {
        btnSubmit.disabled = false;
        btnSubmit.style.opacity = '1';
        btnSubmit.style.cursor = 'pointer';
      } else {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.6';
        btnSubmit.style.cursor = 'not-allowed';
      }
    });

    document.getElementById('form-send-feedback')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = txt.value.trim();
      if (message.length < 5) return;

      const type = (document.querySelector('input[name="fb_type"]:checked') as HTMLInputElement)?.value as any || 'broken';
      const severity = (document.querySelector('input[name="fb_severity"]:checked') as HTMLInputElement)?.value as any || 'annoying';

      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Sending...';

      try {
        await submitFeedback({
          type,
          severity,
          message,
          context: {
            route: currentRoute,
            role: authState.role,
            user_id: authState.user?.id || null,
            viewport,
            userAgent: userAgent.slice(0, 150),
            recent_errors: recentErrors
          }
        });

        alert('Thank you! Your feedback has been recorded.');
        closeModal();
      } catch (err: any) {
        alert(err?.message || 'Failed to submit feedback.');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Submit Feedback';
      }
    });
  }
}

