/**
 * SecurityTab Component (Tab 4: Security Settings)
 * Change password with live strength meter, show/hide eye toggles, requirements list that ticks live,
 * active sessions list with sign out, and danger zone delete account dialog.
 */

import type { ActiveSession } from '../../../services/designerProfileService';

export function renderSecurityTab(
  userEmail: string,
  hasActiveProjectsOrEscrow: boolean,
  sessions: ActiveSession[]
): string {
  return `
    <div class="dez-settings-panel" id="dez-security-tab-content">
      <div class="dez-panel-header">
        <h2 class="dez-panel-title">Security & Account Access</h2>
        <p class="dez-panel-subtext">Manage authentication credentials, active sessions, and account protection.</p>
      </div>

      <!-- Change Password Card -->
      <div class="dez-bordered-box" style="margin-bottom: 24px;">
        <h3 class="dez-box-title">Change Password</h3>
        <p class="dez-box-subtext">Ensure your account is protected with a strong, distinct passphrase.</p>

        <form id="form-change-password" novalidate style="margin-top: 18px;">
          <!-- Current Password -->
          <div class="dez-form-group">
            <label for="pass-current" class="dez-label">Current password</label>
            <div class="dez-input-password-wrap">
              <input type="password" id="pass-current" class="dez-input" placeholder="••••••••••••" required />
              <button type="button" class="dez-pass-toggle-btn" data-target="pass-current" aria-label="Toggle password visibility">Show</button>
            </div>
            <div class="dez-field-error" id="err-pass-current"></div>
          </div>

          <!-- New Password -->
          <div class="dez-form-group">
            <label for="pass-new" class="dez-label">New password</label>
            <div class="dez-input-password-wrap">
              <input type="password" id="pass-new" class="dez-input" placeholder="••••••••••••" required />
              <button type="button" class="dez-pass-toggle-btn" data-target="pass-new" aria-label="Toggle password visibility">Show</button>
            </div>
            
            <!-- Live Password Strength Bar -->
            <div class="dez-pass-strength-wrap" style="margin-top: 8px;">
              <div class="dez-pass-strength-bar">
                <div class="dez-pass-strength-fill" id="pass-strength-fill"></div>
              </div>
              <span class="dez-pass-strength-text" id="pass-strength-text">Password strength: Weak</span>
            </div>

            <!-- Live Checklist -->
            <div class="dez-pass-checklist" style="margin-top: 10px;">
              <div class="dez-req-item" id="req-length">
                <span class="dez-req-icon">&bull;</span> At least 8 characters
              </div>
              <div class="dez-req-item" id="req-uppercase">
                <span class="dez-req-icon">&bull;</span> At least 1 uppercase letter (A-Z)
              </div>
              <div class="dez-req-item" id="req-number">
                <span class="dez-req-icon">&bull;</span> At least 1 number (0-9)
              </div>
              <div class="dez-req-item" id="req-special">
                <span class="dez-req-icon">&bull;</span> At least 1 special character (!@#$%^&*)
              </div>
            </div>
            <div class="dez-field-error" id="err-pass-new"></div>
          </div>

          <!-- Confirm Password -->
          <div class="dez-form-group">
            <label for="pass-confirm" class="dez-label">Confirm new password</label>
            <div class="dez-input-password-wrap">
              <input type="password" id="pass-confirm" class="dez-input" placeholder="••••••••••••" required />
              <button type="button" class="dez-pass-toggle-btn" data-target="pass-confirm" aria-label="Toggle password visibility">Show</button>
            </div>
            <div class="dez-field-error" id="err-pass-confirm"></div>
          </div>

          <div style="margin-top: 18px;">
            <button type="button" class="dez-btn-primary" id="btn-update-password" style="height:36px; padding:0 20px;" disabled>
              Update password
            </button>
          </div>
        </form>
      </div>

      <!-- Active Sessions Section -->
      <div class="dez-bordered-box" style="margin-bottom: 24px;">
        <div class="dez-panel-header-with-actions" style="margin-bottom: 12px;">
          <div>
            <h3 class="dez-box-title">Active Logged-In Sessions</h3>
            <p class="dez-box-subtext">Devices currently authorized to access your architectural studio account.</p>
          </div>
          <button type="button" class="dez-btn-secondary" id="btn-signout-sessions" style="height:32px; padding:0 12px; font-size:12.5px;">
            Sign out other devices
          </button>
        </div>

        <div class="dez-sessions-list" id="sessions-list-container">
          ${
            sessions.length === 0
              ? `
            <div class="dez-session-row">
              <div class="dez-session-info">
                <strong>Current Web Session</strong>
                <span class="dez-session-meta">Zurich, Switzerland &bull; Active now</span>
              </div>
              <span class="dez-session-current-badge">This device</span>
            </div>
          `
              : sessions
                  .map(
                    (s) => `
            <div class="dez-session-row">
              <div class="dez-session-info">
                <strong>${s.device} (${s.browser})</strong>
                <span class="dez-session-meta">${s.location} &bull; ${s.lastActive}</span>
              </div>
              ${s.isCurrent ? `<span class="dez-session-current-badge">This device</span>` : ''}
            </div>
          `
                  )
                  .join('')
          }
        </div>
      </div>

      <!-- Danger Zone: Delete Account -->
      <div class="dez-danger-box">
        <h3 class="dez-danger-title">Danger Zone: Delete Account</h3>
        <p class="dez-danger-subtext">
          Permanently remove your studio profile, proposal history, and accreditation files. This cannot be undone.
        </p>

        <div style="margin-top: 16px;">
          <button type="button" class="dez-btn-danger" id="btn-trigger-delete-account" style="height:36px; padding:0 18px;">
            Delete account
          </button>
        </div>
      </div>

      <!-- Delete Account Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-delete-account" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-del-acc-title">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-del-acc-title" style="color:var(--dez-error);">Delete Designer Account</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-del-acc-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            ${
              hasActiveProjectsOrEscrow
                ? `
              <div class="dez-warning-banner" style="margin-bottom: 14px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#B45309; flex-shrink:0;">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div style="font-size:13px; color:#92400E; line-height:1.45;">
                  <strong>Action Blocked:</strong> You currently have active commissions or escrow balances on Dezignet. You must complete or cancel all active projects and withdraw remaining funds before deleting your account.
                </div>
              </div>
            `
                : `
              <p style="font-size:13.5px; color:var(--dez-text-primary); line-height:1.5;">
                To permanently delete your designer account, please type your email address (<strong>${userEmail}</strong>) below to confirm:
              </p>
              <div class="dez-form-group" style="margin-top: 14px;">
                <label for="input-confirm-email" class="dez-label">Confirm your email</label>
                <input type="email" id="input-confirm-email" class="dez-input" placeholder="${userEmail}" />
                <div class="dez-field-error" id="err-del-account"></div>
              </div>
            `
            }
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-del-acc" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-danger" id="btn-confirm-del-acc" style="height:36px; padding:0 20px;" ${hasActiveProjectsOrEscrow ? 'disabled' : ''}>
              Permanently delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initSecurityTab(
  container: HTMLElement,
  userEmail: string,
  hasActiveProjectsOrEscrow: boolean,
  callbacks: {
    onChangePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
    onDeleteAccount: (confirmEmail: string) => Promise<{ success: boolean; error?: string }>;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const root = container.querySelector('#dez-security-tab-content') as HTMLElement;
  if (!root) return;

  // Show/Hide password toggles
  root.querySelectorAll<HTMLButtonElement>('.dez-pass-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      if (!targetId) return;
      const input = root.querySelector(`#${targetId}`) as HTMLInputElement;
      if (!input) return;
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      btn.textContent = isPass ? 'Hide' : 'Show';
    });
  });

  // Password fields & validation
  const currentPassInput = root.querySelector('#pass-current') as HTMLInputElement;
  const newPassInput = root.querySelector('#pass-new') as HTMLInputElement;
  const confirmPassInput = root.querySelector('#pass-confirm') as HTMLInputElement;
  const btnUpdatePass = root.querySelector('#btn-update-password') as HTMLButtonElement;
  const strengthFill = root.querySelector('#pass-strength-fill') as HTMLElement;
  const strengthText = root.querySelector('#pass-strength-text') as HTMLElement;

  const reqLength = root.querySelector('#req-length') as HTMLElement;
  const reqUpper = root.querySelector('#req-uppercase') as HTMLElement;
  const reqNum = root.querySelector('#req-number') as HTMLElement;
  const reqSpec = root.querySelector('#req-special') as HTMLElement;

  function evaluatePassword() {
    const val = newPassInput?.value || '';
    const hasLen = val.length >= 8;
    const hasUp = /[A-Z]/.test(val);
    const hasNum = /[0-9]/.test(val);
    const hasSpec = /[!@#$%^&*(),.?":{}|<>]/.test(val);

    const updateReq = (el: HTMLElement | null, satisfied: boolean) => {
      if (!el) return;
      el.classList.toggle('is-satisfied', satisfied);
      const icon = el.querySelector('.dez-req-icon');
      if (icon) icon.textContent = satisfied ? '✓' : '•';
    };

    updateReq(reqLength, hasLen);
    updateReq(reqUpper, hasUp);
    updateReq(reqNum, hasNum);
    updateReq(reqSpec, hasSpec);

    let score = 0;
    if (hasLen) score++;
    if (hasUp) score++;
    if (hasNum) score++;
    if (hasSpec) score++;

    if (strengthFill && strengthText) {
      if (val.length === 0) {
        strengthFill.style.width = '0%';
        strengthFill.className = 'dez-pass-strength-fill';
        strengthText.textContent = 'Password strength: None';
      } else if (score <= 1) {
        strengthFill.style.width = '25%';
        strengthFill.className = 'dez-pass-strength-fill is-weak';
        strengthText.textContent = 'Password strength: Weak';
      } else if (score === 2) {
        strengthFill.style.width = '50%';
        strengthFill.className = 'dez-pass-strength-fill is-fair';
        strengthText.textContent = 'Password strength: Fair';
      } else if (score === 3) {
        strengthFill.style.width = '75%';
        strengthFill.className = 'dez-pass-strength-fill is-good';
        strengthText.textContent = 'Password strength: Good';
      } else {
        strengthFill.style.width = '100%';
        strengthFill.className = 'dez-pass-strength-fill is-strong';
        strengthText.textContent = 'Password strength: Strong';
      }
    }

    const currentEntered = Boolean(currentPassInput?.value.trim());
    const matchesConfirm = Boolean(confirmPassInput?.value && confirmPassInput.value === val);
    const isAllValid = score === 4 && currentEntered && matchesConfirm;

    if (btnUpdatePass) {
      btnUpdatePass.disabled = !isAllValid;
    }
  }

  [currentPassInput, newPassInput, confirmPassInput].forEach((inp) => {
    inp?.addEventListener('input', evaluatePassword);
  });

  btnUpdatePass?.addEventListener('click', async () => {
    const cur = currentPassInput.value;
    const nxt = newPassInput.value;
    btnUpdatePass.disabled = true;
    btnUpdatePass.textContent = 'Updating...';

    const res = await callbacks.onChangePassword(cur, nxt);
    if (res.success) {
      callbacks.onShowToast('Password Updated', 'Your account credentials have been securely changed.', 'success');
      currentPassInput.value = '';
      newPassInput.value = '';
      confirmPassInput.value = '';
      evaluatePassword();
    } else {
      const errEl = root.querySelector('#err-pass-current');
      if (errEl) errEl.textContent = res.error || 'Failed to update password.';
      btnUpdatePass.disabled = false;
      btnUpdatePass.textContent = 'Update password';
    }
  });

  // Sign out sessions
  root.querySelector('#btn-signout-sessions')?.addEventListener('click', () => {
    callbacks.onShowToast('Sessions Terminated', 'Signed out 1 other device.', 'info');
    const sessionsList = root.querySelector('#sessions-list-container');
    if (sessionsList) {
      sessionsList.innerHTML = `
        <div class="dez-session-row">
          <div class="dez-session-info">
            <strong>Current Web Session (MacBook Pro)</strong>
            <span class="dez-session-meta">Zurich, Switzerland &bull; Active now</span>
          </div>
          <span class="dez-session-current-badge">This device</span>
        </div>
      `;
    }
  });

  // Delete account modal
  const delModal = root.querySelector('#modal-delete-account') as HTMLElement;
  const btnTriggerDel = root.querySelector('#btn-trigger-delete-account') as HTMLButtonElement;
  const btnCloseDel = root.querySelector('#btn-close-del-acc-modal') as HTMLButtonElement;
  const btnCancelDel = root.querySelector('#btn-cancel-del-acc') as HTMLButtonElement;
  const btnConfirmDel = root.querySelector('#btn-confirm-del-acc') as HTMLButtonElement;
  const inputEmailConfirm = root.querySelector('#input-confirm-email') as HTMLInputElement;
  const errDelAcc = root.querySelector('#err-del-account') as HTMLElement;

  const openDelModal = () => {
    if (delModal) {
      delModal.style.display = 'flex';
      delModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (inputEmailConfirm) inputEmailConfirm.value = '';
      if (errDelAcc) errDelAcc.textContent = '';
    }
  };

  const closeDelModal = () => {
    if (delModal) {
      delModal.style.display = 'none';
      delModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  btnTriggerDel?.addEventListener('click', openDelModal);
  btnCloseDel?.addEventListener('click', closeDelModal);
  btnCancelDel?.addEventListener('click', closeDelModal);
  delModal?.addEventListener('click', (e) => {
    if (e.target === delModal) closeDelModal();
  });

  btnConfirmDel?.addEventListener('click', async () => {
    if (hasActiveProjectsOrEscrow) return;
    const typed = inputEmailConfirm?.value.trim() || '';
    if (typed.toLowerCase() !== userEmail.toLowerCase()) {
      if (errDelAcc) errDelAcc.textContent = 'Email address does not match.';
      return;
    }

    btnConfirmDel.disabled = true;
    btnConfirmDel.textContent = 'Deleting account...';

    const res = await callbacks.onDeleteAccount(typed);
    if (res.success) {
      closeDelModal();
      callbacks.onShowToast('Account Deleted', 'Your account has been deleted.', 'info');
      setTimeout(() => {
        window.location.hash = '';
      }, 1000);
    } else {
      if (errDelAcc) errDelAcc.textContent = res.error || 'Unable to delete account.';
      btnConfirmDel.disabled = false;
      btnConfirmDel.textContent = 'Permanently delete account';
    }
  });
}
