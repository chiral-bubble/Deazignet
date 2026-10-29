/**
 * DesignerApp Coordinator (Dezignet Designer Experience)
 * Clean, modern light UI meeting all design rules:
 * - White background, light grey #F7F7F8 secondary, 1px #E5E7EB borders, 8px radius, no shadows
 * - No glass, glow, gradients, grain, sparklines, or tiny uppercase labels
 * - Brand blue ONLY on primary buttons, links, active nav, focus rings, progress bars
 * - Inter for UI, Playfair Display only for page titles
 * - Consolidated 5-item sidebar: Dashboard, Client Projects, My Work, Conversations, Payments
 * - Bell icon in top bar with unread count badge & dropdown popover
 * - Bottom user avatar popover menu: Profile Settings, View my public profile, Log out
 * - Mobile bottom tab bar with the same 5 items
 */

import './designer.css';
import {
  getProject,
  withdrawProposal
} from '../../services/projectsService';
import { renderProjectDetails, initProjectDetails } from './ProjectDetails';
import { renderProposalDrawer, initProposalDrawer } from './ProposalDrawer';
import {
  renderDesignerDashboardContainer,
  initDesignerDashboard
} from './dashboard/DesignerDashboard';
import {
  renderConversationsLayout,
  initConversations
} from './conversations/ConversationsLayout';
import {
  renderPaymentsLayout,
  initPayments,
  type PaymentsTabKey
} from './payments/PaymentsLayout';
import {
  renderProfileSettingsLayout,
  initProfileSettings,
  type SettingsTabKey
} from './profile/ProfileSettingsLayout';
import {
  initPublicProfile
} from './profile/PublicProfile';
import {
  renderDevProfileToolbar,
  initDevProfileToolbar
} from './profile/DevProfileToolbar';
import {
  renderNotificationsPage,
  initNotificationsPage
} from './notifications/NotificationsPage';
import {
  renderNotificationDropdown,
  initNotificationDropdown
} from './notifications/NotificationDropdown';
import {
  renderMyWorkLayout,
  initMyWork,
  type MyWorkTab
} from './mywork/MyWorkLayout';
import {
  renderClientProjectsView,
  initClientProjectsView,
  type SearchMode
} from './ClientProjectsView';
import {
  getProfile,
  getActiveLoggedUserId
} from '../../services/designerProfileService';
import { getUnreadMessagesCount } from '../../services/conversationsService';
import {
  getUnreadNotificationsCount,
  subscribeToNotifications,
  getNotifications,
  type NotificationItem
} from '../../services/notificationsService';
import { sharedDataset } from '../../mocks/dataset';

export type DesignerViewTab =
  | 'dashboard'
  | 'projects'
  | 'my-work'
  | 'conversations'
  | 'payments'
  | 'notifications'
  | 'settings'
  | 'details'
  | 'public-profile';

export function renderDesignerApp(): string {
  const unreadMsgCount = getUnreadMessagesCount();
  const unreadNotifInfo = getUnreadNotificationsCount();

  // Attention count for My Work: deliverables due + awaiting review
  const attentionCount = sharedDataset.activeProjects.filter(
    (p) => p.isDeliverableDue || p.status === 'awaiting_deliverable' || p.status === 'in_review'
  ).length;

  return `
    <div class="dez-designer-app" id="dez-designer-root">
      
      <!-- Clean Light Sidebar (Consolidated Strictly 5 Items) -->
      <aside class="dez-sidebar" id="dez-designer-sidebar" aria-label="Designer Studio Navigation">
        <div class="dez-sidebar-header">
          <div class="dez-sidebar-logo">D</div>
          <span class="dez-sidebar-brand">Dezignet</span>
        </div>

        <!-- 5 Sidebar Navigation Items: Dashboard, Client Projects, My Work, Conversations, Payments -->
        <nav class="dez-sidebar-nav">
          <!-- 1. Dashboard -->
          <button type="button" class="dez-nav-item is-active" data-designer-tab="dashboard">
            <div class="dez-nav-label-group">
              <span class="dez-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </span>
              <span>Dashboard</span>
            </div>
          </button>

          <!-- 2. Client Projects -->
          <button type="button" class="dez-nav-item" data-designer-tab="projects">
            <div class="dez-nav-label-group">
              <span class="dez-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </span>
              <span>Client Projects</span>
            </div>
            <span class="dez-nav-badge" id="dez-nav-projects-count">5</span>
          </button>

          <!-- 3. My Work (Active Projects & Proposals) with Small Grey Attention Count -->
          <button type="button" class="dez-nav-item" data-designer-tab="my-work">
            <div class="dez-nav-label-group">
              <span class="dez-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </span>
              <span>My Work</span>
            </div>
            <span class="dez-nav-badge dez-nav-badge-grey" id="dez-nav-mywork-count" style="display: ${attentionCount > 0 ? 'inline-flex' : 'none'}; background: #E5E7EB; color: #4B5563;">
              ${attentionCount}
            </span>
          </button>

          <!-- 4. Conversations -->
          <button type="button" class="dez-nav-item" data-designer-tab="conversations">
            <div class="dez-nav-label-group">
              <span class="dez-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span>
              <span>Conversations</span>
            </div>
            <span class="dez-nav-badge" id="dez-nav-unread-count" style="display: ${unreadMsgCount > 0 ? 'inline-flex' : 'none'};">${unreadMsgCount}</span>
          </button>

          <!-- 5. Payments -->
          <button type="button" class="dez-nav-item" data-designer-tab="payments">
            <div class="dez-nav-label-group">
              <span class="dez-nav-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </span>
              <span>Payments</span>
            </div>
          </button>
        </nav>

        <!-- Bottom User Card with Avatar Dropdown Menu -->
        <div class="dez-sidebar-user" style="position: relative;">
          <div class="dez-user-profile" id="btn-sidebar-user-menu" style="cursor: pointer;" aria-haspopup="true" aria-expanded="false" title="Account Menu">
            <div class="dez-user-avatar" id="dez-sidebar-user-avatar">AS</div>
            <div style="flex: 1; min-width: 0;">
              <div class="dez-user-name" id="dez-sidebar-user-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Alexandre Sterling</div>
              <div class="dez-user-role" id="dez-sidebar-user-role" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Principal Architect</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>

          <!-- Avatar Popover Dropdown -->
          <div class="dez-avatar-menu-popover" id="dez-avatar-menu-popover" style="display: none; position: absolute; bottom: calc(100% + 8px); left: 12px; right: 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 1000; padding: 6px 0;">
            <a href="#settings/profile" class="dez-menu-item" id="menu-link-settings" style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; color: #111827; text-decoration: none;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>Profile Settings</span>
            </a>
            <a href="#/designers/des-1" class="dez-menu-item" id="menu-link-public" style="display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; color: #111827; text-decoration: none;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>View my public profile</span>
            </a>
            <div style="height: 1px; background: #E5E7EB; margin: 4px 0;"></div>
            <button type="button" class="dez-menu-item" id="menu-btn-logout" style="width: 100%; text-align: left; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 14px; font-size: 13px; color: #DC2626;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Layout Viewport -->
      <main class="dez-main-viewport">
        <!-- Top App Bar with Search & Notifications -->
        <header class="dez-topbar">
          <div class="dez-topbar-breadcrumb" id="dez-topbar-breadcrumb">
            <span>Studio</span>
            <span>/</span>
            <span class="current" id="dez-breadcrumb-current">Dashboard</span>
          </div>

          <!-- Topbar Center Search -->
          <div class="dez-topbar-center">
            <div class="dez-topbar-search-wrap">
              <span class="dez-topbar-search-icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </span>
              <input type="text" id="dez-topbar-search" class="dez-topbar-search-input" placeholder="Search projects, proposals, transactions..." aria-label="Search" autocomplete="off" />
              <div class="dez-topbar-search-results" id="dez-topbar-search-results" style="display: none;"></div>
            </div>
          </div>

          <!-- Topbar Actions: Preview Public & Notifications Bell Popover -->
          <div class="dez-topbar-actions" style="position: relative;">
            <button type="button" class="dez-btn-secondary" id="btn-topbar-preview-public" style="height:32px; padding:0 12px; font-size:12.5px;" title="View your public profile as clients and peers see it">
              Public Profile ↗
            </button>

            <!-- Connected Bell Button -->
            <button type="button" class="dez-topbar-icon-btn" id="btn-topbar-notif-bell" title="Notifications" aria-label="View notifications" aria-haspopup="true" aria-expanded="false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span class="dez-topbar-badge" id="dez-topbar-notif-count" style="display: ${unreadNotifInfo.count > 0 ? 'flex' : 'none'};">
                ${unreadNotifInfo.display}
              </span>
            </button>

            <!-- Notification Dropdown Popover Slot -->
            <div id="dez-topbar-notif-dropdown-slot" style="display: none; position: absolute; top: calc(100% + 8px); right: 0; z-index: 1000;"></div>
          </div>
        </header>

        <!-- Dynamic Main Content Area -->
        <div class="dez-content-area" id="dez-main-content">
          <!-- Views rendered dynamically here -->
        </div>

        <!-- Mobile Bottom Navigation Bar (5 Items) -->
        <nav class="dez-mobile-bottom-nav" aria-label="Mobile Navigation">
          <button type="button" class="dez-m-nav-item is-active" data-designer-tab="dashboard">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Dashboard</span>
          </button>
          <button type="button" class="dez-m-nav-item" data-designer-tab="projects">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Projects</span>
          </button>
          <button type="button" class="dez-m-nav-item" data-designer-tab="my-work">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>My Work</span>
          </button>
          <button type="button" class="dez-m-nav-item" data-designer-tab="conversations">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Messages</span>
          </button>
          <button type="button" class="dez-m-nav-item" data-designer-tab="payments">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>Payments</span>
          </button>
        </nav>
      </main>

      <!-- Proposal Drawer Container Slot -->
      <div id="dez-drawer-slot"></div>

      <!-- Floating Dev Profile Toolbar (Mock User & Viewer Role Switchers) -->
      <div id="dez-dev-profile-toolbar-slot">
        ${renderDevProfileToolbar()}
      </div>

      <!-- Toast Feedback System -->
      <div class="dez-toast-container" id="dez-toast-container" aria-live="polite"></div>
    </div>
  `;
}

/**
 * Main Controller for Designer Experience
 */
export function initDesignerApp(onLogout: () => void): void {
  const root = document.getElementById('dez-designer-root');
  if (!root) return;

  const contentArea = root.querySelector('#dez-main-content') as HTMLElement | null;
  const breadcrumbCurrent = root.querySelector('#dez-breadcrumb-current') as HTMLElement | null;
  const drawerSlot = root.querySelector('#dez-drawer-slot') as HTMLElement | null;
  const toastContainer = root.querySelector('#dez-toast-container') as HTMLElement | null;

  // View state
  let currentActiveTab: DesignerViewTab = 'dashboard';
  let myWorkActiveTab: MyWorkTab = 'projects';
  let myWorkSubId: string | undefined = undefined;
  let clientProjectsMode: SearchMode = 'projects';
  let clientProjectsQuery: string = '';
  let selectedProjectId: string | undefined = undefined;
  let selectedConversationId: string | undefined = undefined;
  let selectedPublicDesignerId: string | undefined = undefined;
  let initialSettingsTab: SettingsTabKey = 'profile';
  let initialPaymentsTab: PaymentsTabKey = 'overview';

  let activeDrawerCtrl: { open: () => void; close: () => void } | null = null;

  // Global Toast function
  function showToast(
    title: string,
    message: string,
    type: 'success' | 'info' | 'error' = 'info',
    actionLabel?: string,
    onAction?: () => void
  ) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `dez-toast dez-toast--${type}`;
    toast.style.display = 'flex';
    toast.style.justifyContent = 'space-between';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';

    toast.innerHTML = `
      <div style="flex: 1;">
        <strong style="display: block; font-size: 13.5px; margin-bottom: 2px;">${title}</strong>
        <span style="font-size: 12.5px; opacity: 0.95;">${message}</span>
      </div>
      ${
        actionLabel
          ? `<button type="button" class="btn-toast-action" style="background: rgba(255,255,255,0.25); border: 1px solid rgba(255,255,255,0.4); border-radius: 4px; color: #FFFFFF; font-size: 12px; font-weight: 600; padding: 4px 10px; cursor: pointer;">${actionLabel}</button>`
          : ''
      }
      <button type="button" class="dez-toast-close" style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; opacity: 0.8;">&times;</button>
    `;

    toast.querySelector('.dez-toast-close')?.addEventListener('click', () => toast.remove());
    if (actionLabel && onAction) {
      toast.querySelector('.btn-toast-action')?.addEventListener('click', () => {
        onAction();
        toast.remove();
      });
    }

    toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 5500);
  }

  // Refresh badges
  function refreshSidebarBadges() {
    const unreadMsgs = getUnreadMessagesCount();
    const msgBadge = root?.querySelector('#dez-nav-unread-count') as HTMLElement | null;
    if (msgBadge) {
      msgBadge.textContent = String(unreadMsgs);
      msgBadge.style.display = unreadMsgs > 0 ? 'inline-flex' : 'none';
    }

    const unreadNotifInfo = getUnreadNotificationsCount();
    const notifBadge = root?.querySelector('#dez-topbar-notif-count') as HTMLElement | null;
    if (notifBadge) {
      notifBadge.textContent = unreadNotifInfo.display;
      notifBadge.style.display = unreadNotifInfo.count > 0 ? 'flex' : 'none';
    }

    const attentionCount = sharedDataset.activeProjects.filter(
      (p) => p.isDeliverableDue || p.status === 'awaiting_deliverable' || p.status === 'in_review'
    ).length;
    const myWorkBadge = root?.querySelector('#dez-nav-mywork-count') as HTMLElement | null;
    if (myWorkBadge) {
      myWorkBadge.textContent = String(attentionCount);
      myWorkBadge.style.display = attentionCount > 0 ? 'inline-flex' : 'none';
    }
  }

  // Subscribe to live simulated notifications
  subscribeToNotifications((newNotif: NotificationItem) => {
    refreshSidebarBadges();
    showToast(
      newNotif.title,
      newNotif.detail,
      'info',
      'View',
      () => {
        if (newNotif.destinationUrl) {
          window.location.hash = newNotif.destinationUrl;
        }
      }
    );
  });

  // Topbar Notifications Bell Dropdown
  const btnBell = root.querySelector('#btn-topbar-notif-bell') as HTMLButtonElement;
  const notifDropdownSlot = root.querySelector('#dez-topbar-notif-dropdown-slot') as HTMLElement;
  let isNotifDropdownOpen = false;

  async function toggleNotifDropdown() {
    isNotifDropdownOpen = !isNotifDropdownOpen;
    btnBell?.setAttribute('aria-expanded', String(isNotifDropdownOpen));

    if (!isNotifDropdownOpen) {
      if (notifDropdownSlot) notifDropdownSlot.style.display = 'none';
      return;
    }

    const notifResult = await getNotifications({ tab: 'all', limit: 5 });
    const notifInfo = getUnreadNotificationsCount();
    notifDropdownSlot.innerHTML = renderNotificationDropdown(notifResult.notifications, notifInfo.count);
    notifDropdownSlot.style.display = 'block';

    initNotificationDropdown(notifDropdownSlot, {
      onNavigate: (dest) => {
        closeNotifDropdown();
        window.location.hash = dest;
      },
      onCountChanged: refreshSidebarBadges,
      onClose: closeNotifDropdown
    });
  }

  function closeNotifDropdown() {
    if (isNotifDropdownOpen) {
      isNotifDropdownOpen = false;
      btnBell?.setAttribute('aria-expanded', 'false');
      if (notifDropdownSlot) notifDropdownSlot.style.display = 'none';
    }
  }

  btnBell?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifDropdown();
  });

  // Bottom User Card Avatar Menu Popover
  const btnUserMenu = root.querySelector('#btn-sidebar-user-menu') as HTMLElement;
  const userMenuPopover = root.querySelector('#dez-avatar-menu-popover') as HTMLElement;
  let isUserMenuOpen = false;

  function toggleUserMenu() {
    isUserMenuOpen = !isUserMenuOpen;
    btnUserMenu?.setAttribute('aria-expanded', String(isUserMenuOpen));
    if (userMenuPopover) {
      userMenuPopover.style.display = isUserMenuOpen ? 'block' : 'none';
    }
  }

  function closeUserMenu() {
    if (isUserMenuOpen) {
      isUserMenuOpen = false;
      btnUserMenu?.setAttribute('aria-expanded', 'false');
      if (userMenuPopover) userMenuPopover.style.display = 'none';
    }
  }

  btnUserMenu?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleUserMenu();
  });

  root.querySelector('#menu-link-settings')?.addEventListener('click', () => {
    closeUserMenu();
    window.location.hash = '#settings/profile';
  });

  root.querySelector('#menu-link-public')?.addEventListener('click', () => {
    closeUserMenu();
    window.location.hash = '#/designers/des-1';
  });

  root.querySelector('#menu-btn-logout')?.addEventListener('click', () => {
    closeUserMenu();
    onLogout();
  });

  // Global Outside Click and Escape Handlers
  document.addEventListener('click', (e) => {
    if (isNotifDropdownOpen && !notifDropdownSlot.contains(e.target as Node) && e.target !== btnBell) {
      closeNotifDropdown();
    }
    if (isUserMenuOpen && !userMenuPopover.contains(e.target as Node) && !btnUserMenu.contains(e.target as Node)) {
      closeUserMenu();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeNotifDropdown();
      closeUserMenu();
    }
  });

  // Topbar search input
  const topbarSearch = root.querySelector('#dez-topbar-search') as HTMLInputElement | null;
  topbarSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = topbarSearch.value.trim();
      if (q) {
        window.location.hash = `#/client-projects?type=projects&q=${encodeURIComponent(q)}`;
      }
    }
  });

  // Main View Loader
  async function loadAndRender() {
    if (!contentArea) return;

    // Update active nav styling (both desktop sidebar and mobile bottom nav)
    root?.querySelectorAll('[data-designer-tab]').forEach((btn) => {
      const tab = btn.getAttribute('data-designer-tab');
      btn.classList.toggle('is-active', tab === currentActiveTab);
    });

    refreshSidebarBadges();

    // 1. Dashboard Tab
    if (currentActiveTab === 'dashboard') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Dashboard';

      contentArea.innerHTML = renderDesignerDashboardContainer();

      await initDesignerDashboard(contentArea, {
        onNavigateTab: (targetTab, meta) => {
          if (targetTab === 'projects') {
            if (meta?.selectedProjectId) {
              selectedProjectId = meta.selectedProjectId;
              currentActiveTab = 'details';
            } else {
              currentActiveTab = 'projects';
            }
          } else if (targetTab === 'proposals') {
            window.location.hash = '#my-work/proposals';
            return;
          } else if (targetTab === 'payments') {
            window.location.hash = '#payments';
            return;
          } else if (targetTab === 'conversations') {
            window.location.hash = '#conversations';
            return;
          }
          loadAndRender();
        },
        onShowToast: showToast
      });
    }

    // 2. Client Projects Feed Tab (Supports Projects | Designers switch)
    else if (currentActiveTab === 'projects') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Client Projects';

      contentArea.innerHTML = renderClientProjectsView(clientProjectsMode, clientProjectsQuery);

      await initClientProjectsView(
        contentArea,
        {
          onSelectProject: (pid: string) => {
            selectedProjectId = pid;
            currentActiveTab = 'details';
            loadAndRender();
          },
          onSelectDesigner: (did: string) => {
            selectedPublicDesignerId = did;
            currentActiveTab = 'public-profile';
            loadAndRender();
          },
          onShowToast: showToast
        },
        clientProjectsMode,
        clientProjectsQuery
      );
    }

    // 3. My Work Tab (Active Projects & Proposals)
    else if (currentActiveTab === 'my-work') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'My Work';

      contentArea.innerHTML = renderMyWorkLayout(myWorkActiveTab, myWorkSubId);

      await initMyWork(contentArea, {
        activeTab: myWorkActiveTab,
        subId: myWorkSubId,
        onNavigate: (route: string) => {
          window.location.hash = route;
        },
        onShowToast: showToast
      });
    }

    // 4. Project Details View (From Client Projects)
    else if (currentActiveTab === 'details' && selectedProjectId) {
      const project = await getProject(selectedProjectId);
      if (!project) {
        currentActiveTab = 'projects';
        loadAndRender();
        return;
      }

      if (breadcrumbCurrent) breadcrumbCurrent.textContent = project.title;

      contentArea.innerHTML = renderProjectDetails(project, true);

      // Proposal drawer
      if (drawerSlot) {
        drawerSlot.innerHTML = renderProposalDrawer(project);
        activeDrawerCtrl = initProposalDrawer(
          drawerSlot,
          project,
          () => {
            loadAndRender();
            showToast('Proposal Submitted', `Your proposal for "${project.title}" has been sent.`, 'success');
          },
          () => {
            window.location.hash = '#my-work/proposals';
          },
          () => {
            currentActiveTab = 'projects';
            loadAndRender();
          }
        );
      }

      initProjectDetails(
        contentArea,
        project,
        () => {
          activeDrawerCtrl?.open();
        },
        async (propId) => {
          await withdrawProposal(propId);
          showToast('Proposal Withdrawn', 'Your proposal was retracted.', 'info');
          loadAndRender();
        },
        () => {
          currentActiveTab = 'projects';
          loadAndRender();
        }
      );
    }

    // 5. Conversations Tab
    else if (currentActiveTab === 'conversations') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Conversations';

      contentArea.innerHTML = renderConversationsLayout();
      await initConversations(
        contentArea,
        {
          onUnreadCountChanged: refreshSidebarBadges,
          onShowToast: showToast
        },
        selectedConversationId
      );
    }

    // 6. Payments Tab (4 tabs: Overview, Transactions, Payouts, Plan)
    else if (currentActiveTab === 'payments') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Payments';

      contentArea.innerHTML = renderPaymentsLayout(initialPaymentsTab);
      await initPayments(
        contentArea,
        {
          onShowToast: showToast
        },
        initialPaymentsTab
      );
    }

    // 7. Full Notifications Page
    else if (currentActiveTab === 'notifications') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Notifications';

      contentArea.innerHTML = renderNotificationsPage();
      await initNotificationsPage(contentArea, {
        onShowToast: showToast,
        onNavigate: (route) => {
          window.location.hash = route;
        },
        onCountChanged: refreshSidebarBadges
      });
    }

    // 8. Profile Settings Tab (4 tabs: Profile, Portfolio, Credentials, Account)
    else if (currentActiveTab === 'settings') {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Profile Settings';

      contentArea.innerHTML = renderProfileSettingsLayout(initialSettingsTab);

      await initProfileSettings(
        contentArea,
        {
          onShowToast: showToast,
          onViewPublicProfile: (id) => {
            selectedPublicDesignerId = id;
            currentActiveTab = 'public-profile';
            loadAndRender();
          }
        },
        initialSettingsTab
      );
    }

    // 9. Public Profile
    else if (currentActiveTab === 'public-profile') {
      const targetId = selectedPublicDesignerId || getActiveLoggedUserId();
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Designer Profile';

      await initPublicProfile(contentArea, targetId, {
        onBack: () => {
          window.history.back();
        },
        onEditProfile: () => {
          window.location.hash = '#settings/profile';
        },
        onShowToast: showToast
      });
    }
  }

  // Sidebar / Mobile Navigation Click Listeners
  root.querySelectorAll('[data-designer-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-designer-tab') as DesignerViewTab;
      if (tab) {
        if (tab === 'my-work') {
          window.location.hash = '#my-work';
        } else if (tab === 'projects') {
          window.location.hash = '#client-projects';
        } else if (tab === 'dashboard') {
          window.location.hash = '#dashboard';
        } else if (tab === 'conversations') {
          window.location.hash = '#conversations';
        } else if (tab === 'payments') {
          window.location.hash = '#payments';
        } else {
          currentActiveTab = tab;
          loadAndRender();
        }
      }
    });
  });

  // Update user avatar & name in sidebar
  async function refreshSidebarUserDisplay() {
    try {
      const prof = await getProfile();
      const nameEl = root?.querySelector('#dez-sidebar-user-name');
      const roleEl = root?.querySelector('#dez-sidebar-user-role');
      const avatarEl = root?.querySelector('#dez-sidebar-user-avatar');

      if (nameEl) nameEl.textContent = prof.name;
      if (roleEl) roleEl.textContent = prof.professionalTitle || prof.professionalType;
      if (avatarEl) {
        if (prof.avatarUrl) {
          avatarEl.innerHTML = `<img src="${prof.avatarUrl}" alt="${prof.name}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" />`;
        } else {
          avatarEl.textContent = (prof.name || 'D').slice(0, 2).toUpperCase();
        }
      }
    } catch {
      // ignore
    }
  }

  refreshSidebarUserDisplay();

  // Topbar Preview Public Profile Button
  root.querySelector('#btn-topbar-preview-public')?.addEventListener('click', () => {
    selectedPublicDesignerId = getActiveLoggedUserId();
    currentActiveTab = 'public-profile';
    loadAndRender();
  });

  // Dev Profile Toolbar Initialization
  const devToolbarSlot = root.querySelector('#dez-dev-profile-toolbar-slot') as HTMLElement;
  if (devToolbarSlot) {
    initDevProfileToolbar(devToolbarSlot, () => {
      refreshSidebarUserDisplay();
      refreshSidebarBadges();
      loadAndRender();
    });
  }

  // ==========================================================================
  // HASH ROUTER WITH ALL CONSOLIDATED ROUTES & REDIRECTS
  // ==========================================================================
  function parseHashRoute() {
    const raw = window.location.hash.toLowerCase();

    // 1. Redirect legacy routes:
    // /billing -> /payments
    if (raw === '#billing' || raw.startsWith('#billing/')) {
      window.location.hash = '#payments';
      return;
    }

    // /dashboard/settings -> /settings/profile
    if (raw.startsWith('#dashboard/settings')) {
      window.location.hash = '#settings/profile';
      return;
    }

    // /dashboard/projects -> /client-projects
    if (raw.startsWith('#dashboard/projects')) {
      window.location.hash = '#client-projects';
      return;
    }

    // /proposals -> /my-work/proposals
    if (raw === '#proposals' || raw.startsWith('#proposals/')) {
      const sub = window.location.hash.slice('#proposals'.length);
      window.location.hash = `#my-work/proposals${sub}`;
      return;
    }

    // /profile -> /settings/profile
    if (raw === '#profile' || raw.startsWith('#profile/')) {
      window.location.hash = '#settings/profile';
      return;
    }

    // /my-proposals -> /my-work/proposals
    if (raw === '#my-proposals' || raw.startsWith('#my-proposals/')) {
      const sub = window.location.hash.slice('#my-proposals'.length);
      window.location.hash = `#my-work/proposals${sub}`;
      return;
    }

    // /active-projects -> /my-work/projects
    if (raw === '#active-projects' || raw.startsWith('#active-projects/')) {
      const sub = window.location.hash.slice('#active-projects'.length);
      window.location.hash = `#my-work/projects${sub}`;
      return;
    }

    // /designers -> /client-projects?type=designers
    if (raw === '#designers' || raw === '#/designers') {
      window.location.hash = '#client-projects?type=designers';
      return;
    }

    // 2. Public Designer Profile (/designers/:id)
    if (raw.startsWith('#/designers/') || raw.startsWith('#designers/')) {
      const parts = window.location.hash.split('/');
      const id = parts[parts.length - 1];
      if (id) {
        selectedPublicDesignerId = id;
        currentActiveTab = 'public-profile';
        return;
      }
    }

    // 3. Notifications Page (/notifications)
    if (raw.startsWith('#notifications')) {
      currentActiveTab = 'notifications';
      return;
    }

    // 4. My Work (/my-work)
    if (raw.startsWith('#my-work')) {
      currentActiveTab = 'my-work';
      if (raw.includes('/proposals')) {
        myWorkActiveTab = 'proposals';
        const parts = window.location.hash.split('/proposals/');
        myWorkSubId = parts[1] || undefined;
      } else if (raw.includes('/projects')) {
        myWorkActiveTab = 'projects';
        const parts = window.location.hash.split('/projects/');
        myWorkSubId = parts[1] || undefined;
      } else {
        // Default redirect: /my-work -> /my-work/projects (or proposals if 0 projects)
        if (sharedDataset.activeProjects.length > 0) {
          myWorkActiveTab = 'projects';
        } else {
          myWorkActiveTab = 'proposals';
        }
        myWorkSubId = undefined;
      }
      return;
    }

    // 5. Client Projects (/client-projects)
    if (raw.startsWith('#client-projects') || raw.startsWith('#projects')) {
      currentActiveTab = 'projects';
      if (raw.includes('type=designers')) {
        clientProjectsMode = 'designers';
      } else {
        clientProjectsMode = 'projects';
      }

      // Extract ?q=
      const matchQ = window.location.hash.match(/[?&]q=([^&]+)/);
      clientProjectsQuery = matchQ ? decodeURIComponent(matchQ[1]) : '';
      return;
    }

    // 6. Conversations (/conversations)
    if (raw.startsWith('#conversations')) {
      currentActiveTab = 'conversations';
      const parts = window.location.hash.split('/');
      if (parts.length > 1 && parts[1]) {
        selectedConversationId = parts[1];
      } else {
        selectedConversationId = undefined;
      }
      return;
    }

    // 7. Payments (/payments)
    if (raw.startsWith('#payments')) {
      currentActiveTab = 'payments';
      if (raw.includes('transactions')) initialPaymentsTab = 'transactions';
      else if (raw.includes('payouts')) initialPaymentsTab = 'payouts';
      else if (raw.includes('plan')) initialPaymentsTab = 'plan';
      else initialPaymentsTab = 'overview';
      return;
    }

    // 8. Profile Settings (/settings)
    if (raw.startsWith('#settings')) {
      currentActiveTab = 'settings';
      if (raw.includes('portfolio')) initialSettingsTab = 'portfolio';
      else if (raw.includes('credentials')) initialSettingsTab = 'credentials';
      else if (raw.includes('account') || raw.includes('security') || raw.includes('notifications')) initialSettingsTab = 'account';
      else if (raw.includes('billing')) {
        window.location.hash = '#payments';
        currentActiveTab = 'payments';
      } else initialSettingsTab = 'profile';
      return;
    }

    // Default: Dashboard
    currentActiveTab = 'dashboard';
  }

  parseHashRoute();
  window.addEventListener('hashchange', () => {
    parseHashRoute();
    loadAndRender();
  });

  // Initial load
  loadAndRender();
}
