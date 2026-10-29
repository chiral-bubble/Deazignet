/**
 * DesignerDashboard Orchestrator Component
 * Stitches together:
 * - DashboardHeader (Playfair 28px title, dynamic greeting)
 * - DevStateSwitcher (Moved out of header into fixed bottom-right corner)
 * - ProfileCompletenessBanner (conditional, only if profile incomplete)
 * - SummaryRow (1 container with 4 blocks divided by vertical lines)
 * - Two-column main layout (Left ~2/3, Right ~1/3):
 *   - Left: ActiveProjectList (with All/Milestone/Hourly filter), DeadlinesList
 *   - Right: NotificationsList, PaymentsPanel, QuickActions
 * - Proposals strip: RecentProposalsTable (compact table with latest 4 proposals, no message client button)
 * - DashboardModals (Hidden by default, fixed overlays, escape/overlay close, focus trap, body scroll lock)
 * - Bug Fixes:
 *   - Withdraw modal reads true available balance ($28,500), validates >0 and <= balance with inline error, and updates summary
 *   - Quick actions "Upload deliverable" only shown when deliverable is due, opens modal for earliest due project
 *   - Log hours modal pre-selects project, updates hours logged and amount to invoice
 */

import {
  getDesignerSummary,
  getActiveProjects,
  getNotifications,
  getPayments,
  getUpcomingDeadlines,
  getRecentProposals,
  getProfileCompleteness,
  markAllNotificationsAsRead,
  uploadDeliverable,
  requestMilestoneReview,
  logHourlyTime,
  withdrawFunds,
  setMockState,
  type MockStateKey,
  type DesignerSummary,
  type UpcomingDeadline,
  type RecentProposalItem
} from '../../../services/designerDashboardService';

import {
  renderDashboardHeader,
  renderDevStateSwitcher,
  initDevStateSwitcher
} from './DashboardHeader';
import { renderProfileCompletenessBanner } from './ProfileCompletenessBanner';
import { renderSummaryRow } from './SummaryRow';
import { renderActiveProjectList } from './ActiveProjectList';
import { renderDeadlinesList } from './DeadlinesList';
import { renderNotificationsList } from './NotificationsList';
import { renderPaymentsPanel } from './PaymentsPanel';
import { renderQuickActions } from './QuickActions';
import { renderRecentProposalsTable } from './RecentProposalsTable';
import { renderDashboardModals } from './DashboardModals';
import {
  renderSummarySkeleton,
  renderProjectsSkeleton,
  renderListSkeleton,
  renderTableSkeleton
} from './Skeletons';

export interface DesignerDashboardCallbacks {
  onNavigateTab: (tab: string, meta?: any) => void;
  onShowToast: (title: string, message: string, type?: 'success' | 'info' | 'error') => void;
}

export function renderDesignerDashboardContainer(): string {
  return `
    <div class="dez-designer-dashboard" id="dez-dashboard-view">
      <!-- Header slot -->
      <div id="dez-dash-header-slot"></div>

      <!-- Completeness banner slot -->
      <div id="dez-dash-banner-slot"></div>

      <!-- Summary metrics slot -->
      <div id="dez-dash-summary-slot"></div>

      <!-- Main Two-Column Viewport (2/3 and 1/3) -->
      <div class="dez-dash-columns-grid">
        <!-- LEFT COLUMN (~2/3) -->
        <div class="dez-dash-col-left">
          <div id="dez-dash-active-projects-slot"></div>
          <div id="dez-dash-deadlines-slot"></div>
        </div>

        <!-- RIGHT COLUMN (~1/3) -->
        <div class="dez-dash-col-right">
          <div id="dez-dash-notifications-slot"></div>
          <div id="dez-dash-payments-slot"></div>
          <div id="dez-dash-quick-actions-slot"></div>
        </div>
      </div>

      <!-- Proposals Strip (Full Width Below Columns) -->
      <div id="dez-dash-proposals-slot"></div>

      <!-- Interactive Modals Slot -->
      ${renderDashboardModals()}

      <!-- Floating Dev State Switcher (Bottom-Right Corner) -->
      <div id="dez-dash-dev-switcher-slot">
        ${renderDevStateSwitcher()}
      </div>
    </div>
  `;
}

export async function initDesignerDashboard(
  container: HTMLElement,
  callbacks: DesignerDashboardCallbacks
): Promise<void> {
  const root = container.querySelector('#dez-dashboard-view') as HTMLElement | null;
  if (!root) return;

  // Active filter for projects
  let projectFilter: 'all' | 'milestone' | 'hourly' = 'all';

  // Section Slots
  const headerSlot = root.querySelector('#dez-dash-header-slot') as HTMLElement;
  const bannerSlot = root.querySelector('#dez-dash-banner-slot') as HTMLElement;
  const summarySlot = root.querySelector('#dez-dash-summary-slot') as HTMLElement;
  const activeProjectsSlot = root.querySelector('#dez-dash-active-projects-slot') as HTMLElement;
  const deadlinesSlot = root.querySelector('#dez-dash-deadlines-slot') as HTMLElement;
  const notificationsSlot = root.querySelector('#dez-dash-notifications-slot') as HTMLElement;
  const paymentsSlot = root.querySelector('#dez-dash-payments-slot') as HTMLElement;
  const quickActionsSlot = root.querySelector('#dez-dash-quick-actions-slot') as HTMLElement;
  const proposalsSlot = root.querySelector('#dez-dash-proposals-slot') as HTMLElement;
  const devSwitcherSlot = root.querySelector('#dez-dash-dev-switcher-slot') as HTMLElement;

  // Global tracking
  let lastActiveElement: HTMLElement | null = null;

  // Render Header & Dev Switcher
  function renderHeaderAndDevSwitcher() {
    if (headerSlot) {
      headerSlot.innerHTML = renderDashboardHeader('Alexandre');
    }
    if (devSwitcherSlot) {
      devSwitcherSlot.innerHTML = renderDevStateSwitcher();
      initDevStateSwitcher(devSwitcherSlot, async (newState: MockStateKey) => {
        setMockState(newState);
        callbacks.onShowToast('Mock State Updated', `Switched state to "${newState}".`, 'info');
        await loadAllDashboardData();
      });
    }
  }

  // Display initial loading skeletons
  function showAllSkeletons() {
    if (bannerSlot) bannerSlot.innerHTML = '';
    if (summarySlot) summarySlot.innerHTML = renderSummarySkeleton();
    if (activeProjectsSlot) activeProjectsSlot.innerHTML = renderProjectsSkeleton();
    if (deadlinesSlot) deadlinesSlot.innerHTML = renderListSkeleton(3);
    if (notificationsSlot) notificationsSlot.innerHTML = renderListSkeleton(4);
    if (paymentsSlot) paymentsSlot.innerHTML = renderListSkeleton(3);
    if (quickActionsSlot) quickActionsSlot.innerHTML = '';
    if (proposalsSlot) proposalsSlot.innerHTML = renderTableSkeleton(3);
  }

  // Inline section error with retry
  function renderSectionError(sectionTitle: string, onRetry: () => void): string {
    const errorId = `err-${Math.random().toString(36).substring(2, 9)}`;
    setTimeout(() => {
      const btn = root?.querySelector(`#${errorId}`) as HTMLButtonElement | null;
      btn?.addEventListener('click', onRetry);
    }, 10);

    return `
      <div class="dez-section-error-card">
        <p>Failed to load ${sectionTitle}.</p>
        <button type="button" class="dez-btn-link" id="${errorId}">Retry</button>
      </div>
    `;
  }

  // Master Loader
  async function loadAllDashboardData() {
    renderHeaderAndDevSwitcher();
    showAllSkeletons();

    // 1. Profile Completeness Banner
    try {
      const profile = await getProfileCompleteness();
      if (bannerSlot) {
        bannerSlot.innerHTML = renderProfileCompletenessBanner(profile);
        const completeBtn = bannerSlot.querySelector('#btn-complete-profile');
        completeBtn?.addEventListener('click', () => {
          callbacks.onNavigateTab('settings');
        });
      }
    } catch {
      if (bannerSlot) bannerSlot.innerHTML = '';
    }

    // 2. Summary Row
    await loadSummarySection();

    // 3. Active Projects & Quick Actions
    await loadActiveProjectsSection();

    // 4. Deadlines
    try {
      const deadlines: UpcomingDeadline[] = await getUpcomingDeadlines();
      if (deadlinesSlot) {
        deadlinesSlot.innerHTML = renderDeadlinesList(deadlines);
      }
    } catch {
      if (deadlinesSlot) {
        deadlinesSlot.innerHTML = renderSectionError('deadlines', () => loadAllDashboardData());
      }
    }

    // 5. Notifications
    await loadNotificationsSection();

    // 6. Payments
    await loadPaymentsSection();

    // 7. Recent Proposals
    try {
      const proposals: RecentProposalItem[] = await getRecentProposals();
      if (proposalsSlot) {
        proposalsSlot.innerHTML = renderRecentProposalsTable(proposals);
        attachProposalsEvents();
      }
    } catch {
      if (proposalsSlot) {
        proposalsSlot.innerHTML = renderSectionError('proposals', () => loadAllDashboardData());
      }
    }
  }

  // Load Summary
  async function loadSummarySection() {
    try {
      const summary: DesignerSummary = await getDesignerSummary();
      if (summarySlot) {
        summarySlot.innerHTML = renderSummaryRow(summary);
      }
    } catch {
      if (summarySlot) {
        summarySlot.innerHTML = renderSectionError('summary metrics', () => loadSummarySection());
      }
    }
  }

  // Load Active Projects & Quick Actions
  async function loadActiveProjectsSection() {
    try {
      const projects = await getActiveProjects(projectFilter);
      if (activeProjectsSlot) {
        activeProjectsSlot.innerHTML = renderActiveProjectList(projects, projectFilter);
        attachProjectListEvents();
      }

      // Update Quick Actions
      if (quickActionsSlot) {
        quickActionsSlot.innerHTML = renderQuickActions(projects);
        attachQuickActionsEvents(projects);
      }
    } catch {
      if (activeProjectsSlot) {
        activeProjectsSlot.innerHTML = renderSectionError('active projects', () => loadActiveProjectsSection());
      }
    }
  }

  // Load Payments
  async function loadPaymentsSection() {
    try {
      const payments = await getPayments();
      if (paymentsSlot) {
        paymentsSlot.innerHTML = renderPaymentsPanel(payments);
        attachPaymentsEvents();
      }
    } catch {
      if (paymentsSlot) {
        paymentsSlot.innerHTML = renderSectionError('payments', () => loadPaymentsSection());
      }
    }
  }

  // Load Notifications
  async function loadNotificationsSection() {
    try {
      const notifications = await getNotifications();
      if (notificationsSlot) {
        notificationsSlot.innerHTML = renderNotificationsList(notifications);
        attachNotificationsEvents();
      }
    } catch {
      if (notificationsSlot) {
        notificationsSlot.innerHTML = renderSectionError('notifications', () => loadNotificationsSection());
      }
    }
  }

  // Event Attachments: Projects List
  function attachProjectListEvents() {
    // Filter tabs
    const filterTabs = activeProjectsSlot.querySelectorAll<HTMLButtonElement>('[data-filter-type]');
    filterTabs.forEach((tabBtn) => {
      tabBtn.addEventListener('click', async () => {
        const type = tabBtn.getAttribute('data-filter-type') as 'all' | 'milestone' | 'hourly';
        if (type && type !== projectFilter) {
          projectFilter = type;
          await loadActiveProjectsSection();
        }
      });
    });

    // Empty state action
    const emptyBrowseBtn = activeProjectsSlot.querySelector('#btn-empty-browse-projects');
    emptyBrowseBtn?.addEventListener('click', () => {
      callbacks.onNavigateTab('projects');
    });

    // View project links
    const viewLinks = activeProjectsSlot.querySelectorAll<HTMLAnchorElement>('[data-view-project-id]');
    viewLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const pid = link.getAttribute('data-view-project-id');
        window.location.hash = `#my-work/projects/${pid}`;
      });
    });

    // Upload deliverable buttons
    const uploadBtns = activeProjectsSlot.querySelectorAll<HTMLButtonElement>('.btn-upload-deliverable');
    uploadBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        lastActiveElement = btn;
        const pid = btn.getAttribute('data-project-id') || '';
        const ptitle = btn.getAttribute('data-project-title') || '';
        openDeliverableModal(pid, ptitle);
      });
    });

    // Request review buttons
    const reviewBtns = activeProjectsSlot.querySelectorAll<HTMLButtonElement>('.btn-request-review');
    reviewBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = btn.getAttribute('data-project-id') || '';
        const success = await requestMilestoneReview(pid);
        if (success) {
          callbacks.onShowToast('Review Requested', 'Client has been notified to review your deliverable.', 'success');
          await loadActiveProjectsSection();
          await loadNotificationsSection();
        }
      });
    });

    // Log hours buttons
    const logHoursBtns = activeProjectsSlot.querySelectorAll<HTMLButtonElement>('.btn-log-hours');
    logHoursBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        lastActiveElement = btn;
        const pid = btn.getAttribute('data-project-id') || '';
        const ptitle = btn.getAttribute('data-project-title') || '';
        openLogHoursModal(pid, ptitle);
      });
    });
  }

  // Event Attachments: Quick Actions
  function attachQuickActionsEvents(projects: any[]) {
    const quickUploadBtn = quickActionsSlot.querySelector<HTMLButtonElement>('.btn-quick-upload-deliverable');
    quickUploadBtn?.addEventListener('click', () => {
      lastActiveElement = quickUploadBtn;
      // Find earliest project with deliverable due
      const dueProject = projects.find((p) => p.paymentType === 'Milestone' && p.isDeliverableDue) || projects[0];
      if (dueProject) {
        openDeliverableModal(dueProject.id, dueProject.title);
      }
    });

    const quickReviewBtn = quickActionsSlot.querySelector<HTMLButtonElement>('.btn-quick-request-review');
    quickReviewBtn?.addEventListener('click', async () => {
      const pid = quickReviewBtn.getAttribute('data-project-id') || '';
      const success = await requestMilestoneReview(pid);
      if (success) {
        callbacks.onShowToast('Review Requested', 'Client has been notified to review your deliverable.', 'success');
        await loadActiveProjectsSection();
        await loadNotificationsSection();
      }
    });

    const quickBrowseBtn = quickActionsSlot.querySelector('#btn-quick-browse-projects');
    quickBrowseBtn?.addEventListener('click', () => {
      callbacks.onNavigateTab('projects');
    });
  }

  // Event Attachments: Notifications
  function attachNotificationsEvents() {
    const markReadBtn = notificationsSlot.querySelector('#btn-mark-all-read');
    markReadBtn?.addEventListener('click', async () => {
      await markAllNotificationsAsRead();
      callbacks.onShowToast('Notifications Cleared', 'All notifications marked as read.', 'info');
      await loadNotificationsSection();
    });

    const viewAllBtn = notificationsSlot.querySelector('#btn-view-all-notifs');
    viewAllBtn?.addEventListener('click', () => {
      callbacks.onShowToast('Notifications', 'Showing all latest notifications in real-time.', 'info');
    });

    const replyLinks = notificationsSlot.querySelectorAll<HTMLAnchorElement>('[data-designer-tab="conversations"]');
    replyLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        callbacks.onNavigateTab('conversations');
      });
    });
  }

  // Event Attachments: Payments
  function attachPaymentsEvents() {
    const withdrawBtn = paymentsSlot.querySelector<HTMLButtonElement>('#btn-open-withdraw');
    withdrawBtn?.addEventListener('click', async () => {
      lastActiveElement = withdrawBtn;
      // Always get fresh payments data
      const currentPayments = await getPayments();
      openWithdrawModal(currentPayments.availableToWithdraw);
    });

    const historyLink = paymentsSlot.querySelector<HTMLAnchorElement>('.dez-payment-history-link');
    historyLink?.addEventListener('click', (e) => {
      e.preventDefault();
      callbacks.onNavigateTab('billing');
    });
  }

  // Event Attachments: Proposals
  function attachProposalsEvents() {
    const viewAllLink = proposalsSlot.querySelector('#btn-view-all-proposals');
    viewAllLink?.addEventListener('click', (e) => {
      e.preventDefault();
      callbacks.onNavigateTab('proposals');
    });

    const emptyBrowseBtn = proposalsSlot.querySelector('#btn-empty-proposals-browse');
    emptyBrowseBtn?.addEventListener('click', () => {
      callbacks.onNavigateTab('projects');
    });

    const viewBtns = proposalsSlot.querySelectorAll<HTMLAnchorElement>('.btn-view-proposal');
    viewBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const propId = btn.getAttribute('data-proposal-id');
        callbacks.onNavigateTab('proposals', { selectedProposalId: propId });
      });
    });
  }

  // -----------------------------------------------------------
  // Modal Controllers with Scroll Lock & Focus Trap
  // -----------------------------------------------------------

  function lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    document.body.style.overflow = '';
  }

  // 1. Deliverable Modal
  const delivBackdrop = root.querySelector('#modal-deliverable-backdrop') as HTMLElement;
  const delivForm = root.querySelector('#form-upload-deliverable') as HTMLFormElement;
  const delivProjectIdInput = root.querySelector('#deliv-project-id') as HTMLInputElement;
  const delivProjectTitleElem = root.querySelector('#deliv-project-display-title') as HTMLElement;
  const delivTitleInput = root.querySelector('#deliv-title-input') as HTMLInputElement;
  const delivTitleError = root.querySelector('#deliv-title-error') as HTMLElement;
  const delivDropzone = root.querySelector('#deliv-dropzone') as HTMLElement;
  const delivFileTag = root.querySelector('#deliv-selected-file') as HTMLElement;
  const btnCloseDeliv = root.querySelector('#btn-close-deliverable-modal');
  const btnCancelDeliv = root.querySelector('#btn-cancel-deliverable');

  function openDeliverableModal(projectId: string, projectTitle: string) {
    if (!delivBackdrop) return;
    delivProjectIdInput.value = projectId;
    delivProjectTitleElem.textContent = projectTitle;
    delivTitleInput.value = '';
    if (delivTitleError) delivTitleError.style.display = 'none';
    delivFileTag.style.display = 'none';
    delivBackdrop.style.display = 'flex';
    delivBackdrop.classList.add('is-open');
    delivBackdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    setTimeout(() => delivTitleInput.focus(), 50);
  }

  function closeDeliverableModal() {
    if (!delivBackdrop) return;
    delivBackdrop.style.display = 'none';
    delivBackdrop.classList.remove('is-open');
    delivBackdrop.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    lastActiveElement?.focus();
  }

  btnCloseDeliv?.addEventListener('click', closeDeliverableModal);
  btnCancelDeliv?.addEventListener('click', closeDeliverableModal);

  // Overlay click to close
  delivBackdrop?.addEventListener('click', (e) => {
    if (e.target === delivBackdrop) {
      closeDeliverableModal();
    }
  });

  delivDropzone?.addEventListener('click', () => {
    delivFileTag.style.display = 'inline-block';
  });

  delivForm?.addEventListener('submit', async () => {
    const pid = delivProjectIdInput.value;
    const title = delivTitleInput.value.trim();
    if (!title) {
      if (delivTitleError) {
        delivTitleError.textContent = 'Please enter a deliverable title.';
        delivTitleError.style.display = 'block';
      }
      delivTitleInput.focus();
      return;
    }

    const success = await uploadDeliverable(pid, title);
    if (success) {
      closeDeliverableModal();
      callbacks.onShowToast('Deliverable Uploaded', `"${title}" has been submitted for client approval.`, 'success');
      await loadActiveProjectsSection();
      await loadNotificationsSection();
    }
  });

  // 2. Log Hours Modal
  const hoursBackdrop = root.querySelector('#modal-hours-backdrop') as HTMLElement;
  const hoursForm = root.querySelector('#form-log-hours') as HTMLFormElement;
  const hoursProjectIdInput = root.querySelector('#hours-project-id') as HTMLInputElement;
  const hoursProjectTitleElem = root.querySelector('#hours-project-display-title') as HTMLElement;
  const hoursCountInput = root.querySelector('#input-hours-count') as HTMLInputElement;
  const hoursCountError = root.querySelector('#hours-count-error') as HTMLElement;
  const hoursTaskInput = root.querySelector('#input-hours-task') as HTMLTextAreaElement;
  const hoursTaskError = root.querySelector('#hours-task-error') as HTMLElement;
  const btnCloseHours = root.querySelector('#btn-close-hours-modal');
  const btnCancelHours = root.querySelector('#btn-cancel-hours');

  function openLogHoursModal(projectId: string, projectTitle: string) {
    if (!hoursBackdrop) return;
    hoursProjectIdInput.value = projectId;
    hoursProjectTitleElem.textContent = projectTitle;
    hoursCountInput.value = '4';
    hoursTaskInput.value = '';
    if (hoursCountError) hoursCountError.style.display = 'none';
    if (hoursTaskError) hoursTaskError.style.display = 'none';
    hoursBackdrop.style.display = 'flex';
    hoursBackdrop.classList.add('is-open');
    hoursBackdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    setTimeout(() => hoursCountInput.focus(), 50);
  }

  function closeLogHoursModal() {
    if (!hoursBackdrop) return;
    hoursBackdrop.style.display = 'none';
    hoursBackdrop.classList.remove('is-open');
    hoursBackdrop.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    lastActiveElement?.focus();
  }

  btnCloseHours?.addEventListener('click', closeLogHoursModal);
  btnCancelHours?.addEventListener('click', closeLogHoursModal);

  // Overlay click to close
  hoursBackdrop?.addEventListener('click', (e) => {
    if (e.target === hoursBackdrop) {
      closeLogHoursModal();
    }
  });

  hoursForm?.addEventListener('submit', async () => {
    const pid = hoursProjectIdInput.value;
    const hours = parseFloat(hoursCountInput.value) || 0;
    const task = hoursTaskInput.value.trim();

    if (hours <= 0) {
      if (hoursCountError) {
        hoursCountError.textContent = 'Please enter a valid billable hour amount (> 0).';
        hoursCountError.style.display = 'block';
      }
      hoursCountInput.focus();
      return;
    }

    if (!task) {
      if (hoursTaskError) {
        hoursTaskError.textContent = 'Please provide a brief description of the work performed.';
        hoursTaskError.style.display = 'block';
      }
      hoursTaskInput.focus();
      return;
    }

    const success = await logHourlyTime(pid, hours);
    if (success) {
      closeLogHoursModal();
      callbacks.onShowToast('Hours Logged', `${hours} billable hours recorded. Project amounts updated.`, 'success');
      await loadActiveProjectsSection();
      await loadNotificationsSection();
    }
  });

  // 3. Withdraw Funds Modal
  const withdrawBackdrop = root.querySelector('#modal-withdraw-backdrop') as HTMLElement;
  const withdrawForm = root.querySelector('#form-withdraw-funds') as HTMLFormElement;
  const withdrawAvailElem = root.querySelector('#withdraw-available-val') as HTMLElement;
  const withdrawAmountInput = root.querySelector('#input-withdraw-amount') as HTMLInputElement;
  const withdrawErrorElem = root.querySelector('#withdraw-amount-error') as HTMLElement;
  const btnCloseWithdraw = root.querySelector('#btn-close-withdraw-modal');
  const btnCancelWithdraw = root.querySelector('#btn-cancel-withdraw');
  let currentWithdrawMax = 0;

  function openWithdrawModal(available: number) {
    if (!withdrawBackdrop) return;
    currentWithdrawMax = available;
    withdrawAvailElem.textContent = `$${available.toLocaleString()}`;
    withdrawAmountInput.value = available > 0 ? available.toString() : '0';
    withdrawAmountInput.max = available.toString();
    if (withdrawErrorElem) withdrawErrorElem.style.display = 'none';

    withdrawBackdrop.style.display = 'flex';
    withdrawBackdrop.classList.add('is-open');
    withdrawBackdrop.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    setTimeout(() => withdrawAmountInput.focus(), 50);
  }

  function closeWithdrawModal() {
    if (!withdrawBackdrop) return;
    withdrawBackdrop.style.display = 'none';
    withdrawBackdrop.classList.remove('is-open');
    withdrawBackdrop.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    lastActiveElement?.focus();
  }

  btnCloseWithdraw?.addEventListener('click', closeWithdrawModal);
  btnCancelWithdraw?.addEventListener('click', closeWithdrawModal);

  // Overlay click to close
  withdrawBackdrop?.addEventListener('click', (e) => {
    if (e.target === withdrawBackdrop) {
      closeWithdrawModal();
    }
  });

  withdrawForm?.addEventListener('submit', async () => {
    const amount = parseFloat(withdrawAmountInput.value) || 0;

    if (amount <= 0) {
      if (withdrawErrorElem) {
        withdrawErrorElem.textContent = 'Please enter an amount greater than $0.';
        withdrawErrorElem.style.display = 'block';
      }
      withdrawAmountInput.focus();
      return;
    }

    if (amount > currentWithdrawMax) {
      if (withdrawErrorElem) {
        withdrawErrorElem.textContent = `Amount cannot exceed your available balance of $${currentWithdrawMax.toLocaleString()}.`;
        withdrawErrorElem.style.display = 'block';
      }
      withdrawAmountInput.focus();
      return;
    }

    const res = await withdrawFunds(amount);
    if (res.success) {
      closeWithdrawModal();
      callbacks.onShowToast('Transfer Dispatched', res.message, 'success');
      await loadPaymentsSection();
      await loadSummarySection();
      await loadNotificationsSection();
    } else {
      if (withdrawErrorElem) {
        withdrawErrorElem.textContent = res.message;
        withdrawErrorElem.style.display = 'block';
      }
    }
  });

  // Global Escape Key to Close Open Modals
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDeliverableModal();
      closeLogHoursModal();
      closeWithdrawModal();
    }
  });

  // Initial load
  await loadAllDashboardData();
}
