/**
 * ApprovalDialog.ts
 * MFA (TOTP) and Re-Authentication Verification Modal
 * Enforces recent authentication (15-min timeout) and two-person verification
 */

import { verifyAdminMfaCode, isReauthRequired } from '../../services/adminConsoleService';

export interface ApprovalDialogOptions {
  title?: string;
  actionDescription: string;
  sensitiveLevel?: 'financial' | 'role' | 'suspension' | 'fees';
}

export function showApprovalDialog(options: ApprovalDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(3px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: Inter, sans-serif;
    `;

    overlay.innerHTML = `
      <div style="background: #FFFFFF; border-radius: 12px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); overflow: hidden; border: 1px solid #E2E8F0;">
        <div style="background: #0F172A; padding: 20px 24px; color: #FFFFFF; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center; color: #38BDF8;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 15px; font-weight: 600;">${options.title || 'MFA Re-Authentication Required'}</h3>
              <p style="margin: 2px 0 0; font-size: 11px; color: #94A3B8;">15-minute security timeout for sensitive actions</p>
            </div>
          </div>
          <button id="auth-modal-close" style="background: none; border: none; color: #94A3B8; font-size: 20px; cursor: pointer;">&times;</button>
        </div>

        <div style="padding: 24px;">
          <div style="background: #FEF3C7; border: 1px solid #FCD34D; border-radius: 6px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #92400E; line-height: 1.4;">
            <strong>Protected Action:</strong> ${options.actionDescription}
          </div>

          <p style="margin: 0 0 16px; font-size: 13px; color: #475569; line-height: 1.5;">
            Enter the 6-digit security code from your authenticator app (TOTP) to verify your identity and confirm this administrative action.
          </p>

          <label style="display: block; font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 8px;">
            TOTP Security Code
          </label>
          <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 12px;">
            <input id="totp-code-input" type="text" maxlength="6" placeholder="000000" autofocus
              style="width: 180px; text-align: center; letter-spacing: 6px; font-size: 24px; font-weight: 600; padding: 8px 12px; border: 2px solid #CBD5E1; border-radius: 8px; outline: none; font-family: monospace;" />
          </div>

          <div id="totp-error" style="display: none; text-align: center; font-size: 12px; color: #DC2626; margin-bottom: 8px;">
            Invalid TOTP code. Enter a 6-digit verification code.
          </div>
          <div style="text-align: center; font-size: 11px; color: #94A3B8;">
            (In development mode, enter any 6 digits like 123456)
          </div>
        </div>

        <div style="padding: 16px 24px; background: #F8FAFC; border-top: 1px solid #F1F5F9; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="auth-btn-cancel" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
            Cancel
          </button>
          <button id="auth-btn-verify" style="background: #2563EB; border: none; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 8px 18px; border-radius: 6px; cursor: pointer;">
            Verify & Proceed
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#totp-code-input') as HTMLInputElement;
    const errorEl = overlay.querySelector('#totp-error') as HTMLElement;
    const btnCancel = overlay.querySelector('#auth-btn-cancel') as HTMLButtonElement;
    const btnVerify = overlay.querySelector('#auth-btn-verify') as HTMLButtonElement;
    const btnClose = overlay.querySelector('#auth-modal-close') as HTMLButtonElement;

    input.focus();

    const close = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    btnCancel.addEventListener('click', () => close(false));
    btnClose.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
    });

    const verify = async () => {
      const code = input.value.trim();
      const valid = await verifyAdminMfaCode(code);
      if (valid) {
        close(true);
      } else {
        errorEl.style.display = 'block';
        input.style.borderColor = '#DC2626';
        input.focus();
      }
    };

    btnVerify.addEventListener('click', verify);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') verify();
    });
  });
}

/**
 * Ensures user is authenticated within 15-minute window before sensitive actions.
 * Prompts MFA modal if expired.
 */
export async function ensureRecentAuth(actionDescription: string): Promise<boolean> {
  if (!isReauthRequired()) {
    return true;
  }
  return await showApprovalDialog({ actionDescription });
}
