/**
 * FloatingRail Navigation Component
 * Slim 72px floating icon rail, tooltips, expand on hover, gliding active pill,
 * bottom avatar menu, and mobile bottom tab bar.
 */

import { dashIcons } from './dashboardIcons';

export type NavTabId = 
  | 'dashboard'
  | 'projects'
  | 'conversations'
  | 'contracts'
  | 'paymentHistory'
  | 'billing'
  | 'settings';

export interface NavItemConfig {
  id: NavTabId;
  label: string;
  icon: string;
  badge?: string;
}

export const navItems: NavItemConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: dashIcons.dashboard },
  { id: 'projects', label: 'Client Projects', icon: dashIcons.projects },
  { id: 'conversations', label: 'Conversations', icon: dashIcons.conversations, badge: '3' },
  { id: 'contracts', label: 'Contracts', icon: dashIcons.contracts },
  { id: 'paymentHistory', label: 'Payment History', icon: dashIcons.paymentHistory },
  { id: 'billing', label: 'Billing', icon: dashIcons.billing },
  { id: 'settings', label: 'Profile Settings', icon: dashIcons.settings }
];

export function renderFloatingRail(activeTab: NavTabId = 'dashboard'): string {
  const itemsHtml = navItems.map((item) => {
    const isActive = item.id === activeTab;
    return `
      <button 
        type="button" 
        class="rail-item ${isActive ? 'is-active' : ''}" 
        data-nav-id="${item.id}"
        aria-label="${item.label}"
      >
        <span class="rail-item__icon">${item.icon}</span>
        <span class="rail-item__label">${item.label}</span>
        ${item.badge ? `<span class="rail-item__badge">${item.badge}</span>` : ''}
        <span class="rail-tooltip" role="tooltip">${item.label}</span>
      </button>
    `;
  }).join('');

  // Mobile key items (4 items + More)
  const mobileKeyItems = navItems.slice(0, 4).map((item) => {
    const isActive = item.id === activeTab;
    return `
      <button 
        type="button" 
        class="mobile-tab-btn ${isActive ? 'is-active' : ''}" 
        data-nav-id="${item.id}"
      >
        <span class="mobile-tab-btn__icon">${item.icon}</span>
        <span class="mobile-tab-btn__label">${item.id === 'conversations' ? 'Messages' : item.label.split(' ')[0]}</span>
      </button>
    `;
  }).join('');

  return `
    <!-- Desktop Floating Icon Rail -->
    <aside class="floating-rail" id="floating-rail" aria-label="Sidebar Navigation">
      <!-- Rail Top Logo Mark -->
      <div class="rail-top">
        <a href="#dashboard" class="rail-logo-btn" title="Dezignet Studio">
          <svg class="rail-logo-svg" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#2F7BE5" fill-opacity="0.18"/>
            <path d="M10 26V10h5.5c2 0 3.5.5 4.5 1.5s1.5 2.3 1.5 4-.5 3-1.5 4-2.5 1.5-4.5 1.5H14v5h-4z" fill="#2F7BE5"/>
            <path d="M18 17l8 9" stroke="#2F7BE5" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </a>
        <div class="rail-brand-name">Dezignet</div>
      </div>

      <!-- Navigation Links -->
      <nav class="rail-nav">
        <!-- Active Gliding Pill Background -->
        <div class="rail-active-pill" id="rail-active-pill" aria-hidden="true"></div>
        ${itemsHtml}
      </nav>

      <!-- Bottom User Avatar with Status & Menu -->
      <div class="rail-bottom">
        <div class="rail-user-wrap" id="rail-user-wrap">
          <button type="button" class="rail-avatar-btn" id="rail-avatar-btn" aria-haspopup="true" aria-expanded="false" title="Account Menu">
            <div class="rail-avatar">
              <span>AS</span>
              <span class="rail-online-dot"></span>
            </div>
            <div class="rail-user-info">
              <span class="rail-user-name">Alex Sterling</span>
              <span class="rail-user-role">Principal Architect</span>
            </div>
          </button>

          <!-- User Popup Menu with Log Out -->
          <div class="rail-user-menu" id="rail-user-menu" role="menu">
            <div class="rail-user-menu-header">
              <strong>Alexandre Sterling</strong>
              <small>Sterling & Atelier Studio</small>
            </div>
            <div class="rail-user-menu-divider"></div>
            <button type="button" class="rail-menu-item" data-nav-id="settings" role="menuitem">
              ${dashIcons.settings}
              <span>Profile Settings</span>
            </button>
            <button type="button" class="rail-menu-item" data-nav-id="billing" role="menuitem">
              ${dashIcons.billing}
              <span>Billing & Plan</span>
            </button>
            <div class="rail-user-menu-divider"></div>
            <button type="button" class="rail-menu-item rail-menu-item--logout" id="dash-logout-btn" role="menuitem">
              ${dashIcons.logOut}
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile Bottom Tab Bar -->
    <nav class="mobile-bottom-bar" id="mobile-bottom-bar" aria-label="Mobile Navigation">
      ${mobileKeyItems}
      <button type="button" class="mobile-tab-btn" id="mobile-more-btn">
        <span class="mobile-tab-btn__icon">${dashIcons.settings}</span>
        <span class="mobile-tab-btn__label">More</span>
      </button>
    </nav>

    <!-- Mobile More Drawer/Sheet -->
    <div class="mobile-sheet-backdrop" id="mobile-sheet-backdrop"></div>
    <div class="mobile-sheet" id="mobile-sheet">
      <div class="mobile-sheet-header">
        <h3>Studio Navigation</h3>
        <button type="button" class="mobile-sheet-close" id="mobile-sheet-close" aria-label="Close">
          ${dashIcons.close}
        </button>
      </div>
      <div class="mobile-sheet-links">
        <button type="button" class="mobile-sheet-link" data-nav-id="paymentHistory">
          ${dashIcons.paymentHistory}
          <span>Payment History</span>
        </button>
        <button type="button" class="mobile-sheet-link" data-nav-id="billing">
          ${dashIcons.billing}
          <span>Billing & Escrow</span>
        </button>
        <button type="button" class="mobile-sheet-link" data-nav-id="settings">
          ${dashIcons.settings}
          <span>Profile Settings</span>
        </button>
        <div class="mobile-sheet-divider"></div>
        <button type="button" class="mobile-sheet-link mobile-sheet-link--logout" id="mobile-logout-btn">
          ${dashIcons.logOut}
          <span>Log Out to Landing</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Initializes rail interactions: active tab switching, gliding pill animation,
 * avatar menu, and mobile drawer.
 */
export function initFloatingRail(onTabChange: (tabId: NavTabId) => void, onLogout: () => void): void {
  const rail = document.getElementById('floating-rail');
  const activePill = document.getElementById('rail-active-pill');
  const avatarBtn = document.getElementById('rail-avatar-btn');
  const userMenu = document.getElementById('rail-user-menu');
  const logoutBtn = document.getElementById('dash-logout-btn');
  const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
  const mobileMoreBtn = document.getElementById('mobile-more-btn');
  const mobileSheet = document.getElementById('mobile-sheet');
  const mobileSheetBackdrop = document.getElementById('mobile-sheet-backdrop');
  const mobileSheetClose = document.getElementById('mobile-sheet-close');

  function updatePillPosition(activeBtn: HTMLElement) {
    if (!activePill || !rail) return;
    const navRect = rail.querySelector('.rail-nav')?.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    if (navRect) {
      const topOffset = btnRect.top - navRect.top;
      activePill.style.transform = `translateY(${topOffset}px)`;
      activePill.style.height = `${btnRect.height}px`;
      activePill.style.opacity = '1';
    }
  }

  // Initial pill position
  const currentActive = rail?.querySelector('.rail-item.is-active') as HTMLElement | null;
  if (currentActive) {
    setTimeout(() => updatePillPosition(currentActive), 50);
  }

  // Nav item click listener
  document.querySelectorAll<HTMLElement>('[data-nav-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-nav-id') as NavTabId;
      if (!tabId) return;

      // Update active classes on rail items
      document.querySelectorAll('.rail-item').forEach((el) => {
        el.classList.toggle('is-active', el.getAttribute('data-nav-id') === tabId);
      });

      // Update active classes on mobile tabs
      document.querySelectorAll('.mobile-tab-btn').forEach((el) => {
        el.classList.toggle('is-active', el.getAttribute('data-nav-id') === tabId);
      });

      const matchingRailBtn = rail?.querySelector(`.rail-item[data-nav-id="${tabId}"]`) as HTMLElement | null;
      if (matchingRailBtn) updatePillPosition(matchingRailBtn);

      // Close menus/sheet
      userMenu?.classList.remove('open');
      mobileSheet?.classList.remove('open');
      mobileSheetBackdrop?.classList.remove('open');

      onTabChange(tabId);
    });
  });

  // Avatar Menu Toggle
  avatarBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu?.classList.toggle('open');
    const isOpen = userMenu?.classList.contains('open');
    avatarBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!userMenu?.contains(e.target as Node) && e.target !== avatarBtn) {
      userMenu?.classList.remove('open');
      avatarBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // Logout Handlers
  logoutBtn?.addEventListener('click', () => onLogout());
  mobileLogoutBtn?.addEventListener('click', () => onLogout());

  // Mobile Sheet open/close
  mobileMoreBtn?.addEventListener('click', () => {
    mobileSheet?.classList.add('open');
    mobileSheetBackdrop?.classList.add('open');
  });

  mobileSheetClose?.addEventListener('click', () => {
    mobileSheet?.classList.remove('open');
    mobileSheetBackdrop?.classList.remove('open');
  });

  mobileSheetBackdrop?.addEventListener('click', () => {
    mobileSheet?.classList.remove('open');
    mobileSheetBackdrop?.classList.remove('open');
  });
}
