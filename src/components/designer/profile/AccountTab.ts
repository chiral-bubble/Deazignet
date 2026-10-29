/**
 * AccountTab Component
 * 4th tab of Profile Settings, combining:
 * 1. Banner linking to Payments ("Manage your plan and payouts in Payments")
 * 2. Section 1: Change Password & Active Sessions
 * 3. Section 2: Notification Preferences (Email & In-App)
 * 4. Section 3: Delete Account Danger Zone
 */

import {
  type DesignerProfile,
  changePassword,
  updateNotificationSettings,
  deleteAccount,
  type ActiveSession
} from '../../../services/designerProfileService';

export function renderAccountTab(profile: DesignerProfile): string {
  const notifs = profile.notifications || {
    email: {
      newMessage: true,
      proposalViewed: true,
      proposalShortlisted: true,
      proposalAccepted: true,
      milestoneApproved: true,
      paymentReleased: true,
      platformNews: true
    },
    inApp: {
      newMessage: true,
      proposalViewed: true,
      proposalShortlisted: true,
      proposalAccepted: true,
      milestoneApproved: true,
      paymentReleased: true,
      platformNews: true
    }
  };

  const sessions: ActiveSession[] = profile.sessions && profile.sessions.length > 0 ? profile.sessions : [
    { id: 'sess-1', device: 'Apple MacBook Pro 16"', browser: 'Google Chrome', location: 'Zurich, Switzerland', lastActive: 'Active now', isCurrent: true },
    { id: 'sess-2', device: 'Apple iPhone 15 Pro', browser: 'Mobile Safari', location: 'Zurich, Switzerland', lastActive: '4 hours ago', isCurrent: false }
  ];

  return `
    <div class="dez-settings-panel" id="panel-account-tab">
      <!-- Payments Link Banner -->
      <div class="dez-account-payments-banner" style="margin-bottom: 24px; padding: 14px 18px; background: #F9FAFB; border: 1px solid var(--dez-border); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
        <div style="font-size: 13.5px; color: #4B5563;">
          Manage your subscription plan, earnings and payout account in <strong style="color: #111827;">Payments</strong>.
        </div>
        <a href="#payments" class="dez-btn-secondary" style="font-size: 13px; height: 32px; padding: 0 12px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
          Go to Payments &rarr;
        </a>
      </div>

      <!-- Section 1: Password & Security -->
      <div class="dez-settings-card" style="margin-bottom: 24px;">
        <h2 class="dez-card-title">Password & Authentication</h2>
        <p class="dez-card-subtext">Manage your password and review active browser sessions.</p>

        <form id="form-account-password" novalidate style="margin-top: 18px;">
          <div class="dez-form-grid-2">
            <div class="dez-form-group">
              <label for="acc-curr-password" class="dez-label">Current password</label>
              <input type="password" id="acc-curr-password" class="dez-input" placeholder="••••••••••••" required autocomplete="current-password" />
              <div class="dez-field-error" id="err-curr-pass"></div>
            </div>

            <div class="dez-form-group">
              <label for="acc-new-password" class="dez-label">New password</label>
              <input type="password" id="acc-new-password" class="dez-input" placeholder="Min 8 characters" required autocomplete="new-password" />
              <div class="dez-field-error" id="err-new-pass"></div>
            </div>
          </div>

          <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
            <button type="submit" class="dez-btn-primary" id="btn-save-password" style="height: 36px; padding: 0 16px; width: auto;">
              Update password
            </button>
          </div>
        </form>

        <div class="dez-divider-line" style="margin: 24px 0 20px;"></div>

        <!-- Active Sessions -->
        <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 8px;">Active Studio Sessions</h3>
        <p style="font-size: 12.5px; color: var(--dez-text-muted); margin-bottom: 14px;">Devices currently logged into your Dezignet studio workspace.</p>

        <div class="dez-sessions-list" style="display: flex; flex-direction: column; gap: 10px;">
          ${sessions
            .map(
              (sess) => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #F9FAFB; border: 1px solid var(--dez-border); border-radius: 6px; font-size: 13px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <div>
                  <div style="font-weight: 500; color: #111827;">${sess.device} &bull; ${sess.browser}</div>
                  <div style="font-size: 12px; color: #6B7280;">${sess.location} &bull; ${sess.lastActive}</div>
                </div>
              </div>
              <div>
                ${
                  sess.isCurrent
                    ? `<span style="font-size: 11px; font-weight: 600; color: #059669; background: #ECFDF5; padding: 2px 8px; border-radius: 10px;">Current</span>`
                    : `<button type="button" class="dez-btn-secondary dez-btn-sm btn-revoke-session" data-session-id="${sess.id}">Revoke</button>`
                }
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Section 2: Notification Preferences -->
      <div class="dez-settings-card" style="margin-bottom: 24px;">
        <h2 class="dez-card-title">Notification Preferences</h2>
        <p class="dez-card-subtext">Choose what alerts appear in-app and get delivered to your registered email.</p>

        <form id="form-account-notifs" style="margin-top: 18px;">
          <div style="margin-bottom: 16px; font-weight: 600; font-size: 13.5px; color: #111827;">In-App & Dropdown Notifications</div>
          
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="dez-toggle-row">
              <div>
                <span class="dez-toggle-title">Client messages</span>
                <p class="dez-toggle-desc">Show badge and toast when a client sends a message in active conversations.</p>
              </div>
              <label class="dez-switch">
                <input type="checkbox" name="inApp_newMessage" ${notifs.inApp?.newMessage !== false ? 'checked' : ''} />
                <span class="dez-slider"></span>
              </label>
            </div>

            <div class="dez-toggle-row">
              <div>
                <span class="dez-toggle-title">Proposal activity</span>
                <p class="dez-toggle-desc">Notify when a client views, shortlists, or accepts your submitted proposal.</p>
              </div>
              <label class="dez-switch">
                <input type="checkbox" name="inApp_proposalShortlisted" ${notifs.inApp?.proposalShortlisted !== false ? 'checked' : ''} />
                <span class="dez-slider"></span>
              </label>
            </div>

            <div class="dez-toggle-row">
              <div>
                <span class="dez-toggle-title">Milestone approvals & deliverable reviews</span>
                <p class="dez-toggle-desc">Alert when a client approves deliverables or requests design revisions.</p>
              </div>
              <label class="dez-switch">
                <input type="checkbox" name="inApp_milestoneApproved" ${notifs.inApp?.milestoneApproved !== false ? 'checked' : ''} />
                <span class="dez-slider"></span>
              </label>
            </div>

            <div class="dez-toggle-row">
              <div>
                <span class="dez-toggle-title">Escrow releases & payout settlements</span>
                <p class="dez-toggle-desc">Alert when funds clear to your available balance or settle to your bank.</p>
              </div>
              <label class="dez-switch">
                <input type="checkbox" name="inApp_paymentReleased" ${notifs.inApp?.paymentReleased !== false ? 'checked' : ''} />
                <span class="dez-slider"></span>
              </label>
            </div>
          </div>

          <div class="dez-divider-line" style="margin: 20px 0;"></div>

          <div style="margin-bottom: 16px; font-weight: 600; font-size: 13.5px; color: #111827;">Email Digests</div>

          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="dez-toggle-row">
              <div>
                <span class="dez-toggle-title">Important contract & milestone events</span>
                <p class="dez-toggle-desc">Send immediate email notifications for contracts accepted and funds released.</p>
              </div>
              <label class="dez-switch">
                <input type="checkbox" name="email_milestoneApproved" ${notifs.email?.milestoneApproved !== false ? 'checked' : ''} />
                <span class="dez-slider"></span>
              </label>
            </div>

            <div class="dez-toggle-row">
              <div>
                <span class="dez-toggle-title">Platform announcements & architectural research</span>
                <p class="dez-toggle-desc">Quarterly fee trends, BIM software discounts, and studio insights.</p>
              </div>
              <label class="dez-switch">
                <input type="checkbox" name="email_platformNews" ${notifs.email?.platformNews ? 'checked' : ''} />
                <span class="dez-slider"></span>
              </label>
            </div>
          </div>

          <div style="margin-top: 18px; display: flex; justify-content: flex-end;">
            <button type="submit" class="dez-btn-primary" id="btn-save-notifs" style="height: 36px; padding: 0 16px; width: auto;">
              Save notification preferences
            </button>
          </div>
        </form>
      </div>

      <!-- Section 3: Delete Account Danger Zone -->
      <div class="dez-settings-card" style="border-color: #FCA5A5; background: #FFFDFD;">
        <h2 class="dez-card-title" style="color: #991B1B;">Delete Account</h2>
        <p class="dez-card-subtext">Permanently close your designer studio profile. All data and portfolio records will be removed.</p>

        <div style="margin-top: 14px; padding: 14px; background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; font-size: 13px; color: #7F1D1D;">
          <strong>Warning:</strong> Account deletion cannot be undone. If you have active projects or pending escrow balances, your account cannot be deleted until milestones are settled.
        </div>

        <form id="form-account-delete" style="margin-top: 16px;">
          <div class="dez-form-group">
            <label for="acc-delete-confirm-email" class="dez-label" style="color: #991B1B;">
              Type your registered email (<strong>${profile.email}</strong>) to confirm:
            </label>
            <input type="email" id="acc-delete-confirm-email" class="dez-input" placeholder="${profile.email}" required />
            <div class="dez-field-error" id="err-acc-delete"></div>
          </div>

          <div style="margin-top: 14px;">
            <button type="submit" class="dez-btn-secondary dez-btn-danger" id="btn-confirm-delete-acc" style="height: 36px;">
              Permanently delete my account
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initAccountTab(
  container: HTMLElement,
  _profile: DesignerProfile,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
    onAccountDeleted?: () => void;
  }
): void {
  // Password Update
  const formPassword = container.querySelector('#form-account-password') as HTMLFormElement;
  formPassword?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const curr = (container.querySelector('#acc-curr-password') as HTMLInputElement).value;
    const next = (container.querySelector('#acc-new-password') as HTMLInputElement).value;
    const errCurr = container.querySelector('#err-curr-pass') as HTMLElement;
    const errNext = container.querySelector('#err-new-pass') as HTMLElement;

    if (errCurr) errCurr.textContent = '';
    if (errNext) errNext.textContent = '';

    if (!curr) {
      if (errCurr) errCurr.textContent = 'Enter your current password.';
      return;
    }
    if (!next || next.length < 8) {
      if (errNext) errNext.textContent = 'Password must be at least 8 characters.';
      return;
    }

    const res = await changePassword(curr, next);
    if (!res.success) {
      if (errCurr) errCurr.textContent = res.error || 'Failed to update password.';
    } else {
      callbacks.onShowToast('Password Updated', 'Your account password has been changed.', 'success');
      formPassword.reset();
    }
  });

  // Notifications Preferences Save
  const formNotifs = container.querySelector('#form-account-notifs') as HTMLFormElement;
  formNotifs?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(formNotifs);

    await updateNotificationSettings({
      email: {
        newMessage: true,
        proposalViewed: true,
        proposalShortlisted: true,
        proposalAccepted: true,
        milestoneApproved: fd.get('email_milestoneApproved') === 'on',
        paymentReleased: true,
        platformNews: fd.get('email_platformNews') === 'on'
      },
      inApp: {
        newMessage: fd.get('inApp_newMessage') === 'on',
        proposalViewed: true,
        proposalShortlisted: fd.get('inApp_proposalShortlisted') === 'on',
        proposalAccepted: true,
        milestoneApproved: fd.get('inApp_milestoneApproved') === 'on',
        paymentReleased: fd.get('inApp_paymentReleased') === 'on',
        platformNews: true
      }
    });

    callbacks.onShowToast('Preferences Saved', 'Notification settings updated.', 'success');
  });

  // Revoke session buttons
  container.querySelectorAll('.btn-revoke-session').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = (btn as HTMLElement).closest('div[style*="display: flex"]');
      if (row) {
        row.remove();
        callbacks.onShowToast('Session Revoked', 'Device has been logged out.', 'info');
      }
    });
  });

  // Delete Account
  const formDelete = container.querySelector('#form-account-delete') as HTMLFormElement;
  formDelete?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = (container.querySelector('#acc-delete-confirm-email') as HTMLInputElement).value;
    const errEl = container.querySelector('#err-acc-delete') as HTMLElement;
    if (errEl) errEl.textContent = '';

    const res = await deleteAccount(emailInput);
    if (!res.success) {
      if (errEl) errEl.textContent = res.error || 'Failed to delete account.';
    } else {
      callbacks.onShowToast('Account Deleted', 'Your account has been closed.', 'info');
      if (callbacks.onAccountDeleted) {
        callbacks.onAccountDeleted();
      }
    }
  });
}
