/**
 * ProfileSettingsLayout Component
 * Coordinates the 5 settings tabs: Profile, Portfolio, Credentials, Security, Notifications.
 * Features:
 * - Vertical tab list on desktop, horizontal scrollable tab bar on mobile
 * - Profile completeness banner (hidden at 100%)
 * - Single clear notice linking to Payments ("Manage plan and payouts in Payments")
 * - Sticky save bar (only visible when dirty)
 * - Leave-page / tab-switch confirmation when dirty
 */

import {
  getProfile,
  updateProfile,
  uploadPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  reorderPortfolio,
  addCredential,
  updateCredential,
  deleteCredential,
  calculateProfileCompleteness,
  type DesignerProfile
} from '../../../services/designerProfileService';

import { renderProfileCompleteness, initProfileCompleteness } from './ProfileCompleteness';
import { renderSaveBar, initSaveBar } from './SaveBar';
import { renderProfileTab, initProfileTab, type ProfileTabState } from './ProfileTab';
import { renderPortfolioTab, initPortfolioTab } from './PortfolioTab';
import { renderCredentialsTab, initCredentialsTab } from './CredentialsTab';
import { renderAccountTab, initAccountTab } from './AccountTab';

export type SettingsTabKey =
  | 'profile'
  | 'portfolio'
  | 'credentials'
  | 'account';

export function renderProfileSettingsLayout(initialTab: SettingsTabKey = 'profile'): string {
  return `
    <div class="dez-settings-container" id="dez-settings-root">
      <!-- Page Title & Header -->
      <div class="dez-settings-header">
        <h1 class="dez-page-title" style="font-size: 28px; margin-bottom: 4px;">Profile Settings</h1>
        <p class="dez-page-subtext">Manage your studio public presence, verified registrations, and account security.</p>
        
        <!-- Clean Link to Payments -->
        <div class="dez-settings-payments-link" style="margin-top: 14px; padding: 12px 16px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; font-size: 13.5px; color: #4B5563; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <span>Manage your subscription plan, earnings and payout account in <strong>Payments</strong>.</span>
          <a href="#payments" class="dez-btn-secondary" style="font-size: 13px; height: 32px; padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: #111827; border: 1px solid #E5E7EB; background: #FFFFFF; border-radius: 6px; font-weight: 500;">
            Manage plan and payouts in Payments &rarr;
          </a>
        </div>
      </div>

      <!-- Completeness Banner Slot -->
      <div id="dez-settings-completeness-slot"></div>

      <!-- Main Layout: Vertical Tabs (Left) + Content (Right) -->
      <div class="dez-settings-body-grid">
        <!-- Navigation Tabs (Vertical on Desktop, Horizontal Scroll on Mobile) -->
        <aside class="dez-settings-nav-col">
          <nav class="dez-settings-tabs-nav" role="tablist" aria-label="Profile settings navigation">
            <button type="button" class="dez-settings-tab-btn ${initialTab === 'profile' ? 'is-active' : ''}" data-tab="profile" role="tab" aria-selected="${initialTab === 'profile'}">
              <span class="dez-tab-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </span>
              <span>Profile</span>
            </button>

            <button type="button" class="dez-settings-tab-btn ${initialTab === 'portfolio' ? 'is-active' : ''}" data-tab="portfolio" role="tab" aria-selected="${initialTab === 'portfolio'}">
              <span class="dez-tab-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </span>
              <span>Portfolio</span>
            </button>

            <button type="button" class="dez-settings-tab-btn ${initialTab === 'credentials' ? 'is-active' : ''}" data-tab="credentials" role="tab" aria-selected="${initialTab === 'credentials'}">
              <span class="dez-tab-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>
              <span>Credentials</span>
            </button>

            <button type="button" class="dez-settings-tab-btn ${initialTab === 'account' ? 'is-active' : ''}" data-tab="account" role="tab" aria-selected="${initialTab === 'account'}">
              <span class="dez-tab-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <span>Account</span>
            </button>
          </nav>
        </aside>

        <!-- Dynamic Tab Content Slot (Max-width 1000px) -->
        <main class="dez-settings-content-col" id="dez-settings-tab-pane" role="tabpanel">
          <!-- Rendered dynamically -->
        </main>
      </div>

      <!-- Sticky Save Bar -->
      ${renderSaveBar()}

      <!-- Unsaved Changes Leave Warning Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-leave-dirty-confirm" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-leave-title">
        <div class="dez-dash-modal" style="max-width: 440px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-leave-title">Discard Unsaved Changes?</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-leave-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size:13.5px; color:var(--dez-text-primary); line-height:1.5;">
              You have unsaved changes on this tab. Leaving without saving will discard your edits.
            </p>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-leave" style="height:36px;">Stay on tab</button>
            <button type="button" class="dez-btn-danger" id="btn-confirm-discard-leave" style="height:36px; padding:0 18px;">
              Discard changes
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initProfileSettings(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
    onViewPublicProfile?: (designerId: string) => void;
  },
  initialTab: SettingsTabKey = 'profile'
): Promise<void> {
  const root = container.querySelector('#dez-settings-root') as HTMLElement;
  if (!root) return;

  let currentTab: SettingsTabKey = initialTab;
  let activeProfile: DesignerProfile = await getProfile();
  let isTabDirty = false;
  let tabState: ProfileTabState | null = null;
  let pendingNavTab: SettingsTabKey | null = null;

  const completenessSlot = root.querySelector('#dez-settings-completeness-slot') as HTMLElement;
  const tabPane = root.querySelector('#dez-settings-tab-pane') as HTMLElement;
  const leaveModal = root.querySelector('#modal-leave-dirty-confirm') as HTMLElement;
  const btnCloseLeave = root.querySelector('#btn-close-leave-modal') as HTMLButtonElement;
  const btnCancelLeave = root.querySelector('#btn-cancel-leave') as HTMLButtonElement;
  const btnConfirmDiscard = root.querySelector('#btn-confirm-discard-leave') as HTMLButtonElement;

  // SaveBar initialization
  const saveBarCtrl = initSaveBar(
    root,
    async () => {
      // On Save
      if (currentTab === 'profile' && tabState) {
        if (!tabState.validate()) {
          callbacks.onShowToast('Validation Error', 'Please correct the highlighted fields.', 'error');
          return;
        }

        saveBarCtrl.setSaving(true);
        try {
          const values = tabState.getValues();
          activeProfile = await updateProfile(values);
          tabState.reset();
          isTabDirty = false;
          saveBarCtrl.hide();
          renderCompleteness();
          callbacks.onShowToast('Profile Saved', 'Your studio profile has been updated.', 'success');
        } catch (err: any) {
          callbacks.onShowToast('Save Error', err.message || 'Failed to save changes.', 'error');
        } finally {
          saveBarCtrl.setSaving(false);
        }
      }
    },
    () => {
      // On Discard
      isTabDirty = false;
      saveBarCtrl.hide();
      loadTabContent(currentTab);
      callbacks.onShowToast('Changes Discarded', 'Reverted unsaved edits.', 'info');
    }
  );

  // Render completeness banner
  function renderCompleteness() {
    if (!completenessSlot) return;
    const completeness = calculateProfileCompleteness(activeProfile);
    completenessSlot.innerHTML = renderProfileCompleteness(completeness);
    initProfileCompleteness(completenessSlot, (targetTab) => {
      handleTabSwitch(targetTab as SettingsTabKey);
    });
  }

  // Load Tab Content
  async function loadTabContent(tab: SettingsTabKey) {
    if (!tabPane) return;
    currentTab = tab;
    isTabDirty = false;
    saveBarCtrl.hide();

    // Update active tab buttons
    root.querySelectorAll<HTMLButtonElement>('.dez-settings-tab-btn').forEach((btn) => {
      const bTab = btn.getAttribute('data-tab');
      const isActive = bTab === tab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    if (tab === 'profile') {
      tabPane.innerHTML = renderProfileTab(activeProfile);
      tabState = initProfileTab(
        tabPane,
        activeProfile,
        (dirty) => {
          isTabDirty = dirty;
          if (dirty) saveBarCtrl.show();
          else saveBarCtrl.hide();
        },
        callbacks.onShowToast
      );
    } else if (tab === 'portfolio') {
      tabPane.innerHTML = renderPortfolioTab(activeProfile.portfolio || []);
      initPortfolioTab(tabPane, activeProfile.portfolio || [], {
        onAddProject: async (newProj) => {
          await uploadPortfolioItem(newProj);
          activeProfile = await getProfile();
          renderCompleteness();
          loadTabContent('portfolio');
        },
        onEditProject: async (id, updates) => {
          await updatePortfolioItem(id, updates);
          activeProfile = await getProfile();
          loadTabContent('portfolio');
        },
        onDeleteProject: async (id) => {
          await deletePortfolioItem(id);
          activeProfile = await getProfile();
          renderCompleteness();
          loadTabContent('portfolio');
        },
        onReorder: async (ids) => {
          await reorderPortfolio(ids);
          activeProfile = await getProfile();
          loadTabContent('portfolio');
        },
        onShowToast: callbacks.onShowToast
      });
    } else if (tab === 'credentials') {
      tabPane.innerHTML = renderCredentialsTab(activeProfile.credentials || []);
      initCredentialsTab(tabPane, activeProfile.credentials || [], {
        onAddCredential: async (cred) => {
          await addCredential(cred);
          activeProfile = await getProfile();
          renderCompleteness();
          loadTabContent('credentials');
        },
        onUpdateCredential: async (id, updates) => {
          await updateCredential(id, updates);
          activeProfile = await getProfile();
          loadTabContent('credentials');
        },
        onDeleteCredential: async (id) => {
          await deleteCredential(id);
          activeProfile = await getProfile();
          renderCompleteness();
          loadTabContent('credentials');
        },
        onShowToast: callbacks.onShowToast
      });
    } else if (tab === 'account') {
      tabPane.innerHTML = renderAccountTab(activeProfile);
      initAccountTab(tabPane, activeProfile, {
        onShowToast: callbacks.onShowToast,
        onAccountDeleted: () => {
          window.location.hash = '#auth';
        }
      });
    }
  }

  // Handle Tab Switch with Dirty Check
  function handleTabSwitch(targetTab: SettingsTabKey) {
    if (targetTab === currentTab) return;
    if (isTabDirty) {
      pendingNavTab = targetTab;
      if (leaveModal) {
        leaveModal.style.display = 'flex';
        leaveModal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      }
      return;
    }
    loadTabContent(targetTab);
  }

  const closeLeaveModal = () => {
    if (leaveModal) {
      leaveModal.style.display = 'none';
      leaveModal.classList.remove('is-open');
      document.body.style.overflow = '';
      pendingNavTab = null;
    }
  };

  btnCloseLeave?.addEventListener('click', closeLeaveModal);
  btnCancelLeave?.addEventListener('click', closeLeaveModal);
  btnConfirmDiscard?.addEventListener('click', () => {
    isTabDirty = false;
    saveBarCtrl.hide();
    const target = pendingNavTab || 'profile';
    closeLeaveModal();
    loadTabContent(target);
  });

  // Attach Tab Click Listeners
  root.querySelectorAll<HTMLButtonElement>('.dez-settings-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') as SettingsTabKey;
      if (tab) handleTabSwitch(tab);
    });
  });

  // Warn on window reload / navigate if dirty
  window.addEventListener('beforeunload', (e) => {
    if (isTabDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved profile changes.';
    }
  });

  // Initial load
  renderCompleteness();
  await loadTabContent(initialTab);
}
