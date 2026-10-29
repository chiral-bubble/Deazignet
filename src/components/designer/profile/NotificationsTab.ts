/**
 * NotificationsTab Component (Tab 6: Notification Settings)
 * Toggles grouped by Email and In-App, automatically saving with a small "Saved" status text.
 */

import type { DesignerNotificationSettings } from '../../../services/designerProfileService';

export function renderNotificationsTab(settings: DesignerNotificationSettings): string {
  return `
    <div class="dez-settings-panel" id="dez-notifications-tab-content">
      <div class="dez-panel-header-with-actions">
        <div>
          <h2 class="dez-panel-title">Notification Preferences</h2>
          <p class="dez-panel-subtext">Control when and how Dezignet notifies you of project events and communications.</p>
        </div>
        <div class="dez-auto-saved-indicator" id="notif-saved-indicator" style="opacity: 0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--dez-brand);"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Saved</span>
        </div>
      </div>

      <!-- Email Notifications Group -->
      <div class="dez-bordered-box" style="margin-bottom: 24px;">
        <h3 class="dez-box-title">Email Notifications</h3>
        <p class="dez-box-subtext">Sent to your registered email address.</p>

        <div class="dez-toggle-list" style="margin-top: 14px;">
          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">New client messages & inquiries</div>
              <div class="dez-toggle-desc">Immediate alerts when a client replies in Conversations or sends project brief inquiries.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="email" data-key="newMessage" ${settings.email.newMessage ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Proposal viewed, shortlisted, or accepted</div>
              <div class="dez-toggle-desc">Updates as clients review your bids and move your proposals forward.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="email" data-key="proposalViewed" ${settings.email.proposalViewed ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Milestone deliverable approvals</div>
              <div class="dez-toggle-desc">When a client reviews and approves your CAD drawings or architectural renders.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="email" data-key="milestoneApproved" ${settings.email.milestoneApproved ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Escrow payment releases</div>
              <div class="dez-toggle-desc">Confirmed fund disbursements to your available balance.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="email" data-key="paymentReleased" ${settings.email.paymentReleased ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Platform news & architectural feature updates</div>
              <div class="dez-toggle-desc">Curated releases, fee updates, and marketplace improvements.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="email" data-key="platformNews" ${settings.email.platformNews ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- In-App Notifications Group -->
      <div class="dez-bordered-box">
        <h3 class="dez-box-title">In-App Notifications</h3>
        <p class="dez-box-subtext">Shown in the studio topbar notification bell.</p>

        <div class="dez-toggle-list" style="margin-top: 14px;">
          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Direct conversation messages</div>
              <div class="dez-toggle-desc">Real-time badges and notifications in your dashboard.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="inApp" data-key="newMessage" ${settings.inApp.newMessage ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Proposal status updates</div>
              <div class="dez-toggle-desc">Instant indicators when clients view your proposal.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="inApp" data-key="proposalViewed" ${settings.inApp.proposalViewed ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Milestone review requests & approvals</div>
              <div class="dez-toggle-desc">Step-by-step progress on active projects.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="inApp" data-key="milestoneApproved" ${settings.inApp.milestoneApproved ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-toggle-row">
            <div>
              <div class="dez-toggle-title">Escrow releases & earnings ready for withdrawal</div>
              <div class="dez-toggle-desc">Immediate alerts when earnings are credited.</div>
            </div>
            <label class="dez-switch">
              <input type="checkbox" data-channel="inApp" data-key="paymentReleased" ${settings.inApp.paymentReleased ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initNotificationsTab(
  container: HTMLElement,
  currentSettings: DesignerNotificationSettings,
  onAutoSave: (newSettings: Partial<DesignerNotificationSettings>) => Promise<void>
): void {
  const root = container.querySelector('#dez-notifications-tab-content') as HTMLElement;
  if (!root) return;

  const indicator = root.querySelector('#notif-saved-indicator') as HTMLElement;
  let timer: any = null;

  const showSaved = () => {
    if (!indicator) return;
    indicator.style.opacity = '1';
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      indicator.style.opacity = '0';
    }, 2000);
  };

  const workingSettings = JSON.parse(JSON.stringify(currentSettings));

  root.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-channel]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const channel = cb.getAttribute('data-channel') as 'email' | 'inApp';
      const key = cb.getAttribute('data-key');
      if (channel && key) {
        workingSettings[channel][key] = cb.checked;
        await onAutoSave(workingSettings);
        showSaved();
      }
    });
  });
}
