/**
 * DevProfileToolbar Component
 * Floating development-only toolbar enabling testing of:
 * 1. Logged-in Mock User: Complete (Alexandre), Incomplete (Julian), New Designer (Sarah)
 * 2. Public Profile Viewer Role: Client (proposal received), Client (no proposal), Peer Designer, Self
 * 3. Quick toggle between Private Profile Settings and Public Designer Profile
 * 4. Collapsible toggle to keep the UI completely uncluttered
 */

import {
  getMockProfileState,
  setMockProfileState,
  getViewerRole,
  setViewerRole,
  hasClientReceivedProposal,
  setClientReceivedProposal,
  type MockProfileStateKey,
  getActiveLoggedUserId
} from '../../../services/designerProfileService';
import { simulateNotification } from '../../../services/notificationsService';

export function renderDevProfileToolbar(): string {
  // Hidden in production
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) {
    return '';
  }

  const profileState = getMockProfileState();
  const viewerRole = getViewerRole();
  const activeId = getActiveLoggedUserId();
  const hasProposal = hasClientReceivedProposal(activeId);

  return `
    <aside class="dez-dev-profile-toolbar is-collapsed" id="dez-dev-profile-toolbar" aria-label="Development testing controls">
      <!-- Minimized Trigger Button -->
      <button type="button" class="dez-dev-toggle-trigger" id="btn-toggle-dev-toolbar" title="Toggle dev testing controls">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        <span>Dev Tools</span>
      </button>

      <!-- Expandable Controls Panel -->
      <div class="dez-dev-expanded-content" id="dez-dev-expanded-content">
        <div class="dez-dev-toolbar-badge">DEV CONTROLS</div>

        <!-- Control Group 1: Logged-in Designer State -->
        <div class="dez-dev-group">
          <span class="dez-dev-group-label">User:</span>
          <div class="dez-dev-seg-group">
            <button type="button" class="dez-dev-seg-btn ${profileState === 'complete' ? 'is-active' : ''}" data-set-user="complete" title="Alexandre Sterling (100% complete, verified AIA)">
              Complete (Alexandre)
            </button>
            <button type="button" class="dez-dev-seg-btn ${profileState === 'incomplete' ? 'is-active' : ''}" data-set-user="incomplete" title="Julian Thorne (60% complete, pending credential)">
              Incomplete (Julian)
            </button>
            <button type="button" class="dez-dev-seg-btn ${profileState === 'empty' ? 'is-active' : ''}" data-set-user="empty" title="Sarah Jenkins (0% complete, no portfolio)">
              New Designer (Sarah)
            </button>
          </div>
        </div>

        <!-- Control Group 2: Public Profile Viewer Role -->
        <div class="dez-dev-group">
          <span class="dez-dev-group-label">Role:</span>
          <div class="dez-dev-seg-group">
            <button type="button" class="dez-dev-seg-btn ${viewerRole === 'client' && hasProposal ? 'is-active' : ''}" data-set-role="client-has-proposal" title="Client who HAS received proposal">
              Client (+Proposal)
            </button>
            <button type="button" class="dez-dev-seg-btn ${viewerRole === 'client' && !hasProposal ? 'is-active' : ''}" data-set-role="client-no-proposal" title="Client who has NOT received proposal">
              Client (No Prop)
            </button>
            <button type="button" class="dez-dev-seg-btn ${viewerRole === 'designer' ? 'is-active' : ''}" data-set-role="peer-designer" title="Peer designer viewing colleague">
              Colleague
            </button>
            <button type="button" class="dez-dev-seg-btn ${viewerRole === 'self' ? 'is-active' : ''}" data-set-role="self" title="Designer viewing own profile">
              Own Profile
            </button>
          </div>
        </div>

        <!-- Control Group 3: Simulate Notification for Each Type -->
        <div class="dez-dev-group" style="border-left: 1px solid #E5E7EB; padding-left: 12px;">
          <span class="dez-dev-group-label">Simulate Notification:</span>
          <div style="display: flex; gap: 6px; align-items: center;">
            <select id="dev-sim-notif-type" class="dez-select" style="height: 28px; font-size: 11px; padding: 0 6px;">
              <option value="proposal_viewed">Proposal Viewed</option>
              <option value="proposal_shortlisted">Proposal Shortlisted</option>
              <option value="proposal_accepted">Proposal Accepted</option>
              <option value="proposal_declined">Proposal Declined</option>
              <option value="milestone_funded">Milestone Funded</option>
              <option value="deliverable_approved">Deliverable Approved</option>
              <option value="revision_requested">Revision Requested</option>
              <option value="payment_released">Payment Released</option>
              <option value="withdrawal_paid">Withdrawal Paid</option>
              <option value="withdrawal_failed">Withdrawal Failed</option>
              <option value="message_received">Message Received</option>
              <option value="credential_verified">Credential Verified</option>
              <option value="credential_rejected">Credential Rejected</option>
              <option value="plan_renewal">Plan Renewal</option>
              <option value="system_announcement">System Announcement</option>
            </select>
            <button type="button" class="dez-btn-secondary" id="btn-dev-fire-notif" style="height: 28px; font-size: 11px; padding: 0 10px;">
              Fire Alert
            </button>
          </div>
        </div>

        <!-- Close/Minimize button -->
        <button type="button" class="dez-dev-close-btn" id="btn-minimize-dev-toolbar" aria-label="Minimize dev toolbar">&times;</button>
      </div>
    </aside>
  `;
}

export function initDevProfileToolbar(
  container: HTMLElement,
  onStateChanged: () => void
): void {
  const root = container.querySelector('#dez-dev-profile-toolbar') as HTMLElement;
  if (!root) return;

  const toggleBtn = root.querySelector('#btn-toggle-dev-toolbar');
  const minimizeBtn = root.querySelector('#btn-minimize-dev-toolbar');

  toggleBtn?.addEventListener('click', () => {
    root.classList.toggle('is-collapsed');
  });

  minimizeBtn?.addEventListener('click', () => {
    root.classList.add('is-collapsed');
  });

  // Set user buttons
  root.querySelectorAll<HTMLButtonElement>('[data-set-user]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const state = btn.getAttribute('data-set-user') as MockProfileStateKey;
      if (state) {
        setMockProfileState(state);
        onStateChanged();
      }
    });
  });

  // Set viewer role buttons
  root.querySelectorAll<HTMLButtonElement>('[data-set-role]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const roleSetting = btn.getAttribute('data-set-role');
      const activeId = getActiveLoggedUserId();

      if (roleSetting === 'client-has-proposal') {
        setViewerRole('client');
        setClientReceivedProposal(activeId, true);
      } else if (roleSetting === 'client-no-proposal') {
        setViewerRole('client');
        setClientReceivedProposal(activeId, false);
      } else if (roleSetting === 'peer-designer') {
        setViewerRole('designer');
      } else if (roleSetting === 'self') {
        setViewerRole('self');
      }
      onStateChanged();
    });
  });

  // Fire Alert Simulator
  const btnFire = root.querySelector('#btn-dev-fire-notif') as HTMLButtonElement;
  const selectType = root.querySelector('#dev-sim-notif-type') as HTMLSelectElement;
  btnFire?.addEventListener('click', () => {
    const type = selectType?.value as any;
    if (type) {
      simulateNotification(type);
      onStateChanged();
    }
  });
}
