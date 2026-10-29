/**
 * DashboardPage Main Orchestrator
 * Connects FloatingRail, BentoGrid, ProjectsSection, OtherTabs, CommandPalette,
 * ThemeToggle, Notifications, and Toasts.
 */

import './dashboardTokens.css';
import './dashboard.css';
import { dashIcons } from './dashboardIcons';
import { renderFloatingRail, initFloatingRail, type NavTabId } from './FloatingRail';
import { renderBentoGrid, initBentoGrid } from './BentoGrid';
import { renderProjectsSection, initProjectsSection } from './ProjectsSection';
import {
  renderConversationsTab,
  renderContractsTab,
  renderPaymentHistoryTab,
  renderBillingTab,
  renderSettingsTab
} from './OtherTabs';
import { renderCommandPalette, initCommandPalette } from './CommandPalette';
import { initialProjects } from './dashboardData';

export function renderDashboardPage(): string {
  const floatingRailHtml = renderFloatingRail('dashboard');
  const bentoGridHtml = renderBentoGrid();
  const projectsHtml = renderProjectsSection();
  const commandPaletteHtml = renderCommandPalette();

  return `
    <div class="dash-root-wrapper" id="dash-root" data-theme="dark">
      <!-- Background Atmosphere: subtle film grain & faint blueprint grid -->
      <div class="dash-bg-atmosphere" aria-hidden="true">
        <div class="dash-grid-layer"></div>
        <div class="dash-header-glow"></div>
      </div>

      <!-- Left Floating Navigation Rail -->
      ${floatingRailHtml}

      <!-- Main Dashboard Viewport -->
      <div class="dash-viewport">
        
        <!-- Top App Bar -->
        <header class="dash-topbar">
          <!-- Command Palette Trigger Button -->
          <button type="button" class="dash-cmd-trigger" id="dash-cmd-trigger" title="Open Command Palette (Cmd+K)">
            <span class="cmd-icon">${dashIcons.search}</span>
            <span class="cmd-label">Search projects, contracts, actions...</span>
            <kbd class="cmd-shortcut">⌘K</kbd>
          </button>

          <!-- Right Controls: Theme Toggle, Notifications, Post Project -->
          <div class="dash-topbar-actions">
            <!-- Theme Toggle Button -->
            <button type="button" class="dash-icon-btn" id="dash-theme-toggle" title="Toggle Dark/Light Mode" aria-label="Toggle Theme">
              <span class="theme-icon-slot" id="theme-icon-slot">${dashIcons.sun}</span>
            </button>

            <!-- Notifications Bell & Dropdown -->
            <div class="dash-notif-wrap" id="dash-notif-wrap">
              <button type="button" class="dash-icon-btn" id="dash-notif-btn" title="Notifications" aria-haspopup="true" aria-expanded="false">
                ${dashIcons.bell}
                <span class="notif-unread-dot"></span>
              </button>

              <!-- Notifications Glass Dropdown -->
              <div class="dash-notif-dropdown" id="dash-notif-dropdown" role="menu">
                <div class="notif-dropdown-header">
                  <strong>Studio Notifications</strong>
                  <span class="notif-badge">2 Unread</span>
                </div>
                <div class="notif-list">
                  <div class="notif-item is-unread">
                    <span class="notif-type-dot notif-type-dot--blue"></span>
                    <div>
                      <p><strong>Elena Vance</strong> submitted updated 3D elevations for Pacific Palisades Residence.</p>
                      <small>15 minutes ago</small>
                    </div>
                  </div>
                  <div class="notif-item is-unread">
                    <span class="notif-type-dot notif-type-dot--amber"></span>
                    <div>
                      <p><strong>Milestone 2 Escrow</strong> is ready for your structural verification.</p>
                      <small>2 hours ago</small>
                    </div>
                  </div>
                  <div class="notif-item">
                    <span class="notif-type-dot notif-type-dot--green"></span>
                    <div>
                      <p><strong>Boutique Hotel Lobby</strong> agreement was executed by both parties.</p>
                      <small>Yesterday</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- "+ Post Project" Header CTA -->
            <button type="button" class="btn-dash-primary" id="btn-topbar-post">
              <span class="btn-icon">${dashIcons.plus}</span>
              <span>Post Project</span>
            </button>
          </div>
        </header>

        <!-- Dynamic Main Content Area -->
        <main class="dash-main-scroll" id="dash-main-scroll">
          <div class="dash-view-pane is-active" id="pane-dashboard">
            ${bentoGridHtml}
          </div>

          <div class="dash-view-pane" id="pane-projects">
            ${projectsHtml}
          </div>

          <div class="dash-view-pane" id="pane-conversations">
            ${renderConversationsTab()}
          </div>

          <div class="dash-view-pane" id="pane-contracts">
            ${renderContractsTab()}
          </div>

          <div class="dash-view-pane" id="pane-paymentHistory">
            ${renderPaymentHistoryTab()}
          </div>

          <div class="dash-view-pane" id="pane-billing">
            ${renderBillingTab()}
          </div>

          <div class="dash-view-pane" id="pane-settings">
            ${renderSettingsTab()}
          </div>
        </main>
      </div>

      <!-- Command Palette Modal -->
      ${commandPaletteHtml}

      <!-- Post New Project Modal -->
      <div class="dash-modal-backdrop" id="new-project-modal-backdrop" aria-hidden="true">
        <div class="dash-modal" id="new-project-modal" role="dialog" aria-modal="true" aria-label="Post New Project">
          <div class="dash-modal-header">
            <h3>Post New Architecture Project</h3>
            <button type="button" class="dash-modal-close" id="new-proj-close" aria-label="Close">
              ${dashIcons.close}
            </button>
          </div>
          <form class="dash-modal-form" id="new-project-form" onsubmit="return false;">
            <div class="modal-field">
              <label>PROJECT TITLE</label>
              <input type="text" id="modal-proj-title" placeholder="e.g. Modern 4-Bedroom Villa, Zurich" required />
            </div>
            <div class="modal-form-row">
              <div class="modal-field">
                <label>CATEGORY</label>
                <select id="modal-proj-cat">
                  <option value="Residential">Residential Architecture</option>
                  <option value="Commercial">Commercial / Office</option>
                  <option value="Hospitality">Hospitality & Hotel</option>
                  <option value="Civic">Civic & Cultural</option>
                </select>
              </div>
              <div class="modal-field">
                <label>ESTIMATED BUDGET ($ USD)</label>
                <input type="number" id="modal-proj-budget" placeholder="50000" required />
              </div>
            </div>
            <div class="modal-form-row">
              <div class="modal-field">
                <label>LOCATION</label>
                <input type="text" id="modal-proj-loc" placeholder="e.g. Pacific Palisades, Los Angeles" required />
              </div>
              <div class="modal-field">
                <label>EXPECTED DURATION</label>
                <input type="text" id="modal-proj-dur" placeholder="e.g. 16 Weeks" required />
              </div>
            </div>
            <div class="modal-field">
              <label>ARCHITECTURAL BRIEF & SPECIFICATIONS</label>
              <textarea id="modal-proj-desc" rows="3" placeholder="Describe spatial requirements, zoning, site topography, and material preferences..." required></textarea>
            </div>
            <div class="dash-modal-footer">
              <button type="button" class="btn-dash-ghost" id="new-proj-cancel">Cancel</button>
              <button type="submit" class="btn-dash-primary" id="new-proj-submit">Publish Project Brief</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Toast Container -->
      <div class="dash-toasts-container" id="dash-toasts" aria-live="polite"></div>
    </div>
  `;
}

/**
 * Toast Notification Helper
 */
export function showToast(title: string, message: string, type: 'info' | 'success' | 'alert' = 'success'): void {
  const container = document.getElementById('dash-toasts');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `dash-toast dash-toast--${type}`;
  toast.innerHTML = `
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-dismissing');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

/**
 * Initializes the entire dashboard interactions, tab navigation, theme persistence,
 * notifications, and command palette.
 */
export function initDashboardPage(onLogoutRequested: () => void): void {
  const root = document.getElementById('dash-root');
  const themeToggleBtn = document.getElementById('dash-theme-toggle');
  const themeIconSlot = document.getElementById('theme-icon-slot');
  const notifBtn = document.getElementById('dash-notif-btn');
  const notifDropdown = document.getElementById('dash-notif-dropdown');
  const topbarPostBtn = document.getElementById('btn-topbar-post');
  const newProjBackdrop = document.getElementById('new-project-modal-backdrop');
  const newProjModal = document.getElementById('new-project-modal');
  const newProjClose = document.getElementById('new-proj-close');
  const newProjCancel = document.getElementById('new-proj-cancel');
  const newProjForm = document.getElementById('new-project-form') as HTMLFormElement | null;
  const cmdTrigger = document.getElementById('dash-cmd-trigger');

  // 1. Theme Management (dark/light persist in localStorage)
  const savedTheme = localStorage.getItem('dezignet-theme') || 'dark';
  setTheme(savedTheme);

  function setTheme(theme: string) {
    if (!root) return;
    root.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dezignet-theme', theme);

    if (themeIconSlot) {
      themeIconSlot.innerHTML = theme === 'dark' ? dashIcons.sun : dashIcons.moon;
    }
  }

  themeToggleBtn?.addEventListener('click', () => {
    const current = root?.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
    showToast('Theme Updated', `Switched to ${next === 'dark' ? 'Deep Obsidian Dark' : 'Warm Paper Light'} theme.`);
  });

  // Settings theme choice buttons
  document.getElementById('theme-btn-dark')?.addEventListener('click', () => {
    setTheme('dark');
    showToast('Theme Updated', 'Dark mode active.');
  });
  document.getElementById('theme-btn-light')?.addEventListener('click', () => {
    setTheme('light');
    showToast('Theme Updated', 'Light mode active.');
  });

  // 2. Tab Navigation
  function switchTab(tabId: NavTabId) {
    document.querySelectorAll('.dash-view-pane').forEach((pane) => {
      pane.classList.remove('is-active');
    });
    const targetPane = document.getElementById(`pane-${tabId}`);
    if (targetPane) {
      targetPane.classList.add('is-active');
      window.scrollTo({ top: 0, behavior: 'instant' });
      const mainScroll = document.getElementById('dash-main-scroll');
      if (mainScroll) mainScroll.scrollTop = 0;
    }
  }

  // 3. New Project Modal
  function openNewProjectModal() {
    newProjBackdrop?.classList.add('is-open');
    newProjModal?.classList.add('is-open');
  }

  function closeNewProjectModal() {
    newProjBackdrop?.classList.remove('is-open');
    newProjModal?.classList.remove('is-open');
  }

  topbarPostBtn?.addEventListener('click', openNewProjectModal);
  newProjClose?.addEventListener('click', closeNewProjectModal);
  newProjCancel?.addEventListener('click', closeNewProjectModal);
  newProjBackdrop?.addEventListener('click', (e) => {
    if (e.target === newProjBackdrop) closeNewProjectModal();
  });

  newProjForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleInput = document.getElementById('modal-proj-title') as HTMLInputElement | null;
    const catInput = document.getElementById('modal-proj-cat') as HTMLSelectElement | null;
    const budgetInput = document.getElementById('modal-proj-budget') as HTMLInputElement | null;
    const locInput = document.getElementById('modal-proj-loc') as HTMLInputElement | null;
    const durInput = document.getElementById('modal-proj-dur') as HTMLInputElement | null;
    const descInput = document.getElementById('modal-proj-desc') as HTMLTextAreaElement | null;

    if (!titleInput?.value) return;

    // Add new project to mock database
    const newProj = {
      id: `proj-${Date.now()}`,
      title: titleInput.value,
      category: (catInput?.value as any) || 'Residential',
      status: 'pending' as const,
      description: descInput?.value || '',
      budget: parseInt(budgetInput?.value || '0', 10),
      duration: durInput?.value || '12 Weeks',
      deadline: 'Pending Bids',
      location: locInput?.value || 'Los Angeles, USA',
      coverImage: '/hero-frames/frame_0080.webp',
      proposalsCount: 0
    };

    initialProjects.unshift(newProj);
    closeNewProjectModal();
    newProjForm.reset();
    showToast('Project Published', `"${newProj.title}" is now open for design proposals!`, 'success');

    // Switch to projects tab and re-init
    switchTab('projects');
    initProjectsSection(openNewProjectModal);
  });

  // 4. Command Palette
  const cmdPalette = initCommandPalette(
    (tabId) => switchTab(tabId),
    openNewProjectModal
  );

  cmdTrigger?.addEventListener('click', () => cmdPalette.open());

  // 5. Notifications Dropdown Toggle
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
    const isOpen = notifDropdown?.classList.contains('open');
    notifBtn.setAttribute('aria-expanded', String(isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!notifDropdown?.contains(e.target as Node) && e.target !== notifBtn) {
      notifDropdown?.classList.remove('open');
      notifBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // 6. Initialize Navigation Rail
  initFloatingRail(
    (tabId) => switchTab(tabId),
    () => onLogoutRequested()
  );

  // 7. Initialize Bento Home & Projects Views
  initBentoGrid(openNewProjectModal, () => switchTab('projects'));
  initProjectsSection(openNewProjectModal);
}
