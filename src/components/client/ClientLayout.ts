/**
 * ClientLayout — Unified Shell & Sidebar for Dezignet Client App
 * Features:
 * - Brand logo & Client indicator
 * - Sidebar navigation (Dashboard, My Projects, Find Designers, Conversations with unread badge, Payments)
 * - User info & Account menu (Settings, Help, Logout)
 * - Header with notification bell and context actions
 */

import { getAuthState, logOut } from '../../services/authService';
import { getUnreadMessagesCount } from '../../services/conversationsService';

export interface ClientLayoutOptions {
  activeTab: 'dashboard' | 'my-projects' | 'find-designers' | 'conversations' | 'payments' | 'settings' | 'help' | 'notifications';
  pageTitle: string;
  actionButtonHtml?: string;
}

export function renderClientShell(options: ClientLayoutOptions, contentHtml: string): string {
  const authState = getAuthState();
  const userName = authState.user?.fullName || authState.user?.email?.split('@')[0] || 'Client';
  const userEmail = authState.user?.email || '';

  return `
    <div class="client-shell">
      <!-- Sidebar (Desktop) -->
      <aside class="client-sidebar">
        <div>
          <!-- Brand Logo -->
          <div style="height: 64px; display: flex; align-items: center; padding: 0 24px; border-bottom: 1px solid #E5E7EB;">
            <a href="#client-dashboard" style="text-decoration: none; display: flex; align-items: center; gap: 8px;">
              <img src="/logo.png" alt="Dezignet" style="width: 30px; height: 30px; border-radius: 6px; object-fit: contain;" />
              <span style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827;">Dezignet</span>
              <span style="font-size: 11px; color: #6B7280; font-weight: 500; margin-left: 2px;">Client</span>
            </a>
          </div>

          <!-- Main Nav -->
          <nav style="padding: 16px 12px; display: flex; flex-direction: column; gap: 4px;">
            <a href="#client-dashboard" class="nav-item ${options.activeTab === 'dashboard' ? 'active' : ''}" style="${getNavItemStyle(options.activeTab === 'dashboard')}">
              <span>Dashboard</span>
            </a>
            <a href="#my-projects" class="nav-item ${options.activeTab === 'my-projects' ? 'active' : ''}" style="${getNavItemStyle(options.activeTab === 'my-projects')}">
              <span>My Projects</span>
            </a>
            <a href="#find-designers" class="nav-item ${options.activeTab === 'find-designers' ? 'active' : ''}" style="${getNavItemStyle(options.activeTab === 'find-designers')}">
              <span>Find Designers</span>
            </a>
            <a href="#conversations" class="nav-item ${options.activeTab === 'conversations' ? 'active' : ''}" style="${getNavItemStyle(options.activeTab === 'conversations')}">
              <span>Conversations</span>
              <span id="sidebar-unread-badge" style="display: none; background: #2F7BE5; color: #FFFFFF; font-size: 11px; font-weight: 600; padding: 1px 7px; border-radius: 10px;"></span>
            </a>
            <a href="#payments" class="nav-item ${options.activeTab === 'payments' ? 'active' : ''}" style="${getNavItemStyle(options.activeTab === 'payments')}">
              <span>Payments</span>
            </a>
          </nav>
        </div>

        <!-- Sidebar Footer / Account Menu -->
        <div style="border-top: 1px solid #E5E7EB; padding: 16px 12px;">
          <div style="display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: #E5E7EB; color: #374151; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px;">
              ${userName.charAt(0).toUpperCase()}
            </div>
            <div style="overflow: hidden; flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userName}</div>
              <div style="font-size: 12px; color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${userEmail}</div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <a href="#settings" style="text-decoration: none; padding: 8px 12px; font-size: 13px; color: ${options.activeTab === 'settings' ? '#2F7BE5' : '#4B5563'}; font-weight: ${options.activeTab === 'settings' ? '600' : '400'}; border-radius: 6px; display: block; transition: background 150ms;">Account Settings</a>
            <a href="#help" style="text-decoration: none; padding: 8px 12px; font-size: 13px; color: ${options.activeTab === 'help' ? '#2F7BE5' : '#4B5563'}; font-weight: ${options.activeTab === 'help' ? '600' : '400'}; border-radius: 6px; display: block; transition: background 150ms;">Help & Support</a>
            <button id="sidebar-logout-btn" style="background: transparent; border: none; text-align: left; padding: 8px 12px; font-size: 13px; color: #DC2626; border-radius: 6px; cursor: pointer; transition: background 150ms;">Log out</button>
          </div>
        </div>
      </aside>

      <!-- Main Area -->
      <div class="client-main-area">
        <!-- Header -->
        <header class="client-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <a href="#client-dashboard" style="text-decoration: none; display: none; align-items: center; gap: 6px;" class="mobile-logo-brand">
              <img src="/logo.png" alt="Dezignet" style="width: 24px; height: 24px; border-radius: 4px; object-fit: contain;" />
              <span style="font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #111827;">Dezignet</span>
            </a>
            <h1 style="font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #111827; margin: 0;">${options.pageTitle}</h1>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <a href="#notifications" style="text-decoration: none; color: #4B5563; padding: 8px; border-radius: 6px; border: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: center;" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </a>
            ${options.actionButtonHtml || ''}
          </div>
        </header>

        <!-- Body Content -->
        <main class="client-content-body">
          <div style="max-width: 1120px; margin: 0 auto;">
            ${contentHtml}
          </div>
        </main>

        <!-- Mobile Bottom Navigation Bar (5 Items) -->
        <nav class="client-mobile-bottom-nav" aria-label="Mobile Navigation">
          <a href="#client-dashboard" class="client-mobile-nav-item ${options.activeTab === 'dashboard' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span>Dashboard</span>
          </a>
          <a href="#my-projects" class="client-mobile-nav-item ${options.activeTab === 'my-projects' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Projects</span>
          </a>
          <a href="#find-designers" class="client-mobile-nav-item ${options.activeTab === 'find-designers' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Designers</span>
          </a>
          <a href="#conversations" class="client-mobile-nav-item ${options.activeTab === 'conversations' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Messages</span>
          </a>
          <a href="#payments" class="client-mobile-nav-item ${options.activeTab === 'payments' ? 'active' : ''}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>Payments</span>
          </a>
        </nav>
      </div>
    </div>
  `;
}

function getNavItemStyle(isActive: boolean): string {
  if (isActive) {
    return 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; background: #2F7BE5; color: #FFFFFF; transition: background 150ms;';
  }
  return 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 6px; font-size: 14px; font-weight: 500; text-decoration: none; color: #4B5563; transition: background 150ms;';
}

export function initClientShell(container: HTMLElement): void {
  // Bind logout button
  const logoutBtn = container.querySelector('#sidebar-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logOut();
      window.location.hash = '#login';
    });
  }

  // Poll or fetch unread count for sidebar badge
  updateSidebarUnreadCount(container);
}

async function updateSidebarUnreadCount(container: HTMLElement): Promise<void> {
  const badge = container.querySelector('#sidebar-unread-badge') as HTMLElement;
  if (!badge) return;

  try {
    const unreadCount = getUnreadMessagesCount();
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch {
    badge.style.display = 'none';
  }
}

export function renderClientComingSoonPage(
  container: HTMLElement,
  title: string,
  tab: ClientLayoutOptions['activeTab'],
  description = 'This feature is currently under active development and will be available soon.'
): void {
  container.innerHTML = renderClientShell(
    {
      activeTab: tab,
      pageTitle: title
    },
    `
      <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 64px 24px; text-align: center; background: #FFFFFF; max-width: 560px; margin: 40px auto;">
        <div style="font-size: 40px; margin-bottom: 16px;">🚧</div>
        <h2 style="font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 8px;">${title}</h2>
        <p style="font-size: 14px; color: #6B7280; line-height: 1.6; margin: 0 0 24px;">${description}</p>
        <a href="#my-projects" style="text-decoration: none; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; display: inline-block;">
          Back to My Projects
        </a>
      </div>
    `
  );

  initClientShell(container);
}
