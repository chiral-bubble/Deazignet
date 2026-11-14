/**
 * ReasonDialog.ts
 * Modal dialog for mandatory written justification reasons (min 5 characters)
 * Required for: private content reads, user suspensions, project removal, credential rejection, role changes.
 */

export interface ReasonDialogOptions {
  title: string;
  subtitle?: string;
  promptLabel?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  minChars?: number;
}

export function showReasonDialog(options: ReasonDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const minChars = options.minChars ?? 5;
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(2px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: Inter, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #FFFFFF; border-radius: 10px; max-width: 480px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #E2E8F0;">
        <div style="padding: 20px 24px; border-bottom: 1px solid #F1F5F9; display: flex; align-items: center; justify-content: space-between;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0F172A;">
            ${options.title}
          </h3>
          <button id="reason-modal-close" style="background: none; border: none; color: #94A3B8; font-size: 18px; cursor: pointer; padding: 4px;">&times;</button>
        </div>

        <div style="padding: 24px;">
          ${options.subtitle ? `<p style="margin: 0 0 16px; font-size: 13px; color: #64748B; line-height: 1.5;">${options.subtitle}</p>` : ''}
          
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #475569; display: flex; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" style="flex-shrink: 0; margin-top: 1px;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Audit Requirement: Every administrative action and private access requires an auditable justification written to the immutable log.</span>
          </div>

          <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 6px;">
            ${options.promptLabel || 'Written Reason & Justification (Required)'}
          </label>
          <textarea id="reason-input" rows="3" placeholder="${options.placeholder || 'Enter clear justification (minimum ' + minChars + ' characters)...'}" style="width: 100%; box-sizing: border-box; border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; color: #0F172A; resize: vertical; outline: none;"></textarea>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
            <span id="reason-error" style="font-size: 11px; color: #EF4444; display: none;">Minimum ${minChars} characters required.</span>
            <span id="char-counter" style="font-size: 11px; color: #94A3B8; margin-left: auto;">0 / ${minChars} min</span>
          </div>
        </div>

        <div style="padding: 16px 24px; background: #F8FAFC; border-top: 1px solid #F1F5F9; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="reason-btn-cancel" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
            Cancel
          </button>
          <button id="reason-btn-confirm" style="background: ${options.danger ? '#DC2626' : '#2563EB'}; border: none; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
            ${options.confirmLabel || 'Confirm & Record'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const textarea = overlay.querySelector('#reason-input') as HTMLTextAreaElement;
    const charCounter = overlay.querySelector('#char-counter') as HTMLElement;
    const errorMsg = overlay.querySelector('#reason-error') as HTMLElement;
    const btnCancel = overlay.querySelector('#reason-btn-cancel') as HTMLButtonElement;
    const btnConfirm = overlay.querySelector('#reason-btn-confirm') as HTMLButtonElement;
    const btnClose = overlay.querySelector('#reason-modal-close') as HTMLButtonElement;

    textarea.focus();

    const updateCount = () => {
      const len = textarea.value.trim().length;
      charCounter.textContent = `${len} / ${minChars} min`;
      if (len >= minChars) {
        charCounter.style.color = '#10B981';
        errorMsg.style.display = 'none';
        textarea.style.borderColor = '#CBD5E1';
      } else {
        charCounter.style.color = '#94A3B8';
      }
    };

    textarea.addEventListener('input', updateCount);

    const close = (val: string | null) => {
      overlay.remove();
      resolve(val);
    };

    btnCancel.addEventListener('click', () => close(null));
    btnClose.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });

    btnConfirm.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (text.length < minChars) {
        errorMsg.style.display = 'block';
        textarea.style.borderColor = '#EF4444';
        textarea.focus();
        return;
      }
      close(text);
    });
  });
}
