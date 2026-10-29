/**
 * NotificationsPage Component
 * Full Notifications view for designers:
 * - Title "Notifications"
 * - Tabs: All, Unread
 * - Type filter: All types, Proposals, Projects, Payments, Messages, System
 * - "Mark all as read" link
 * - Link to "Notification settings" (#settings/account)
 * - Grouped list by date headings (Today, Yesterday, This week, Earlier)
 * - Rows: 1px dividers, no colored backgrounds, small grey icon by type,
 *   dark title, one-line grey detail, relative time, blue unread dot
 * - Hover quick actions: toggle read/unread, delete
 * - Bulk selection mode: checkboxes, "Mark as read", "Delete", "Select all"
 * - "Load more" with skeleton rows
 * - Empty states: "You're all caught up" (Unread) and "No notifications yet" (All)
 * - Undo deleted notification support
 */

import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  undoDeleteNotification,
  bulkUpdateNotifications,
  type NotificationItem
} from '../../../services/notificationsService';
import { type NotificationCategory } from '../../../config/notificationTypes';
import { renderNotificationRow } from './NotificationRow';

export interface NotificationsPageCallbacks {
  onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error', actionLabel?: string, onAction?: () => void) => void;
  onNavigate: (route: string) => void;
  onCountChanged: () => void;
}

export function renderNotificationsPage(): string {
  return `
    <div class="dez-notifications-page-container" id="dez-notifications-root">
      <!-- Page Header -->
      <div class="dez-notif-page-header">
        <div>
          <h1 class="dez-page-title">Notifications</h1>
          <p class="dez-page-subtext">Manage client updates, milestone releases, proposals, and studio activity.</p>
        </div>

        <div class="dez-notif-header-actions">
          <button type="button" class="dez-notif-link-btn" id="btn-page-mark-all">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Mark all as read
          </button>
          <a href="#settings/account" class="dez-notif-settings-link" id="link-notif-settings" title="Notification Preferences">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Notification settings
          </a>
        </div>
      </div>

      <!-- Control Toolbar: Tabs & Category Filter -->
      <div class="dez-notif-control-bar">
        <div class="dez-notif-tabs">
          <button type="button" class="dez-notif-tab is-active" data-notif-tab="all">
            All <span class="dez-notif-tab-count" id="count-tab-all">0</span>
          </button>
          <button type="button" class="dez-notif-tab" data-notif-tab="unread">
            Unread <span class="dez-notif-tab-count" id="count-tab-unread">0</span>
          </button>
        </div>

        <div class="dez-notif-filters-group">
          <!-- Type Filter Dropdown -->
          <div class="dez-notif-select-wrap">
            <label for="select-notif-type" class="dez-sr-only">Filter by type</label>
            <select id="select-notif-type" class="dez-notif-type-select">
              <option value="all">All types</option>
              <option value="proposals">Proposals</option>
              <option value="projects">Projects</option>
              <option value="payments">Payments</option>
              <option value="messages">Messages</option>
              <option value="system">System</option>
            </select>
          </div>

          <!-- Toggle Bulk Selection Button -->
          <button type="button" class="dez-btn-secondary dez-btn-sm" id="btn-toggle-bulk-select">
            Select
          </button>
        </div>
      </div>

      <!-- Bulk Actions Bar (Shown when selection mode is active) -->
      <div class="dez-notif-bulk-bar" id="dez-notif-bulk-bar" style="display: none;">
        <div class="dez-notif-bulk-left">
          <label class="dez-notif-select-all-label">
            <input type="checkbox" id="chk-select-all" />
            <span id="label-selected-count">0 selected</span>
          </label>
        </div>

        <div class="dez-notif-bulk-actions">
          <button type="button" class="dez-btn-secondary dez-btn-sm" id="btn-bulk-mark-read">
            Mark as read
          </button>
          <button type="button" class="dez-btn-secondary dez-btn-sm" id="btn-bulk-delete">
            Delete
          </button>
          <button type="button" class="dez-btn-secondary dez-btn-sm" id="btn-bulk-cancel">
            Done
          </button>
        </div>
      </div>

      <!-- Notifications List Container -->
      <div class="dez-notif-list-container" id="dez-notif-list-container">
        <!-- Rendered dynamically -->
      </div>

      <!-- Load More / Skeleton Slot -->
      <div class="dez-notif-load-more-wrap" id="dez-notif-load-more-wrap" style="display: none;">
        <button type="button" class="dez-btn-secondary" id="btn-load-more-notifs">
          Load more notifications
        </button>
      </div>
    </div>
  `;
}

export async function initNotificationsPage(
  container: HTMLElement,
  callbacks: NotificationsPageCallbacks
): Promise<void> {
  const root = container.querySelector('#dez-notifications-root') as HTMLElement;
  if (!root) return;

  let currentTab: 'all' | 'unread' = 'all';
  let currentCategory: NotificationCategory | 'all' = 'all';
  let isBulkMode = false;
  let selectedIds = new Set<string>();
  let currentNotifications: NotificationItem[] = [];
  let nextCursor: number | undefined = undefined;

  const listContainer = root.querySelector('#dez-notif-list-container') as HTMLElement;
  const bulkBar = root.querySelector('#dez-notif-bulk-bar') as HTMLElement;
  const selectedCountLabel = root.querySelector('#label-selected-count') as HTMLElement;
  const selectAllChk = root.querySelector('#chk-select-all') as HTMLInputElement;
  const toggleBulkBtn = root.querySelector('#btn-toggle-bulk-select') as HTMLButtonElement;
  const typeSelect = root.querySelector('#select-notif-type') as HTMLSelectElement;
  const countTabAll = root.querySelector('#count-tab-all');
  const countTabUnread = root.querySelector('#count-tab-unread');
  const loadMoreWrap = root.querySelector('#dez-notif-load-more-wrap') as HTMLElement;
  const btnLoadMore = root.querySelector('#btn-load-more-notifs') as HTMLButtonElement;

  function renderGroupedList(items: NotificationItem[]): string {
    if (items.length === 0) {
      if (currentTab === 'unread') {
        return `
          <div class="dez-notif-empty-state">
            <div class="dez-notif-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3 class="dez-notif-empty-title">You're all caught up</h3>
            <p class="dez-notif-empty-desc">There are no unread notifications right now.</p>
          </div>
        `;
      }
      return `
        <div class="dez-notif-empty-state">
          <div class="dez-notif-empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
          <h3 class="dez-notif-empty-title">No notifications yet</h3>
          <p class="dez-notif-empty-desc">Updates about your client projects, proposals, and escrow releases will appear here.</p>
        </div>
      `;
    }

    // Group items by dateGroup
    const groups: Record<string, NotificationItem[]> = {
      Today: [],
      Yesterday: [],
      'This week': [],
      Earlier: []
    };

    items.forEach((item) => {
      const g = item.dateGroup || 'Earlier';
      if (!groups[g]) groups[g] = [];
      groups[g].push(item);
    });

    let html = '';
    const groupOrder = ['Today', 'Yesterday', 'This week', 'Earlier'];

    groupOrder.forEach((groupName) => {
      const groupItems = groups[groupName];
      if (groupItems && groupItems.length > 0) {
        html += `
          <section class="dez-notif-date-group" aria-label="${groupName} notifications">
            <h2 class="dez-notif-date-heading">${groupName}</h2>
            <div class="dez-notif-group-items">
              ${groupItems
                .map((n) =>
                  renderNotificationRow(n, {
                    isBulkSelectionActive: isBulkMode,
                    isSelected: selectedIds.has(n.id)
                  })
                )
                .join('')}
            </div>
          </section>
        `;
      }
    });

    return html;
  }

  function renderSkeletons(): string {
    return `
      <div class="dez-notif-skeletons" aria-hidden="true">
        ${[1, 2, 3, 4, 5]
          .map(
            () => `
          <div class="dez-notif-skeleton-row">
            <div class="dez-skeleton dez-skeleton-icon"></div>
            <div class="dez-skeleton-text-col">
              <div class="dez-skeleton dez-skeleton-line" style="width: 45%; height: 14px; margin-bottom: 6px;"></div>
              <div class="dez-skeleton dez-skeleton-line" style="width: 80%; height: 12px;"></div>
            </div>
            <div class="dez-skeleton dez-skeleton-line" style="width: 60px; height: 12px;"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  async function loadData(isAppend = false) {
    if (!isAppend) {
      listContainer.innerHTML = renderSkeletons();
      selectedIds.clear();
      updateBulkUI();
    }

    const res = await getNotifications({
      tab: currentTab,
      typeCategory: currentCategory,
      cursor: isAppend ? nextCursor : 0,
      limit: 15
    });

    if (isAppend) {
      currentNotifications = [...currentNotifications, ...res.notifications];
    } else {
      currentNotifications = res.notifications;
    }
    nextCursor = res.nextCursor;

    if (countTabAll) countTabAll.textContent = String(res.totalCount);
    if (countTabUnread) countTabUnread.textContent = String(res.unreadCount);

    listContainer.innerHTML = renderGroupedList(currentNotifications);

    if (loadMoreWrap) {
      loadMoreWrap.style.display = res.hasMore ? 'block' : 'none';
    }

    bindRowListeners();
    callbacks.onCountChanged();
  }

  function updateBulkUI() {
    if (bulkBar) bulkBar.style.display = isBulkMode ? 'flex' : 'none';
    if (toggleBulkBtn) {
      toggleBulkBtn.textContent = isBulkMode ? 'Done' : 'Select';
      toggleBulkBtn.classList.toggle('is-active', isBulkMode);
    }
    if (selectedCountLabel) {
      selectedCountLabel.textContent = `${selectedIds.size} selected`;
    }
    if (selectAllChk) {
      selectAllChk.checked =
        currentNotifications.length > 0 && selectedIds.size === currentNotifications.length;
    }
  }

  function bindRowListeners() {
    // Row click -> navigate to destination and mark as read
    listContainer.querySelectorAll('.dez-notif-row').forEach((row) => {
      row.addEventListener('click', async (e) => {
        // If clicking checkbox, let checkbox change handler handle it
        if ((e.target as HTMLElement).closest('.dez-notif-checkbox-wrap')) return;

        const id = row.getAttribute('data-notif-id');
        const dest = row.getAttribute('data-destination');

        if (id) {
          await markAsRead(id, true);
          callbacks.onCountChanged();
        }

        if (dest) {
          callbacks.onNavigate(dest);
        }
      });
    });

    // Checkbox clicks in bulk mode
    listContainer.querySelectorAll('.dez-notif-checkbox').forEach((chk) => {
      chk.addEventListener('change', (e) => {
        const id = (e.target as HTMLInputElement).getAttribute('data-select-notif-id');
        if (id) {
          if ((e.target as HTMLInputElement).checked) {
            selectedIds.add(id);
          } else {
            selectedIds.delete(id);
          }
          updateBulkUI();
        }
      });
    });

    // Quick Action: Toggle read/unread
    listContainer.querySelectorAll('[data-action="toggle-read"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const isCurrentlyUnread = btn.getAttribute('data-current-unread') === 'true';

        if (id) {
          await markAsRead(id, isCurrentlyUnread);
          callbacks.onShowToast(
            isCurrentlyUnread ? 'Marked as read' : 'Marked as unread',
            '',
            'info'
          );
          await loadData();
        }
      });
    });

    // Quick Action: Delete with undo toast
    listContainer.querySelectorAll('[data-action="delete"]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          await deleteNotification(id);
          await loadData();

          callbacks.onShowToast(
            'Notification deleted',
            '',
            'info',
            'Undo',
            async () => {
              await undoDeleteNotification(id);
              await loadData();
              callbacks.onShowToast('Notification restored', '', 'success');
            }
          );
        }
      });
    });
  }

  // Tab buttons (All vs Unread)
  root.querySelectorAll('.dez-notif-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.getAttribute('data-notif-tab') as 'all' | 'unread';
      if (tab) {
        currentTab = tab;
        root.querySelectorAll('.dez-notif-tab').forEach((b) => b.classList.remove('is-active'));
        tabBtn.classList.add('is-active');
        loadData();
      }
    });
  });

  // Type filter dropdown
  typeSelect?.addEventListener('change', () => {
    currentCategory = typeSelect.value as NotificationCategory | 'all';
    loadData();
  });

  // Mark all as read button
  root.querySelector('#btn-page-mark-all')?.addEventListener('click', async () => {
    await markAllAsRead();
    callbacks.onShowToast('All notifications marked as read', '', 'success');
    await loadData();
  });

  // Toggle Bulk Mode
  toggleBulkBtn?.addEventListener('click', () => {
    isBulkMode = !isBulkMode;
    selectedIds.clear();
    updateBulkUI();
    listContainer.innerHTML = renderGroupedList(currentNotifications);
    bindRowListeners();
  });

  // Select all checkbox
  selectAllChk?.addEventListener('change', () => {
    if (selectAllChk.checked) {
      currentNotifications.forEach((n) => selectedIds.add(n.id));
    } else {
      selectedIds.clear();
    }
    updateBulkUI();
    listContainer.querySelectorAll('.dez-notif-checkbox').forEach((chk) => {
      (chk as HTMLInputElement).checked = selectAllChk.checked;
    });
  });

  // Bulk: Mark as read
  root.querySelector('#btn-bulk-mark-read')?.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    await bulkUpdateNotifications(Array.from(selectedIds), 'read');
    callbacks.onShowToast(`${selectedIds.size} notifications marked as read`, '', 'success');
    selectedIds.clear();
    await loadData();
  });

  // Bulk: Delete
  root.querySelector('#btn-bulk-delete')?.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const deletedList = Array.from(selectedIds);
    await bulkUpdateNotifications(deletedList, 'delete');
    selectedIds.clear();
    await loadData();

    callbacks.onShowToast(
      `${count} notifications deleted`,
      '',
      'info',
      'Undo',
      async () => {
        for (const id of deletedList) {
          await undoDeleteNotification(id);
        }
        await loadData();
        callbacks.onShowToast('Notifications restored', '', 'success');
      }
    );
  });

  // Bulk: Cancel
  root.querySelector('#btn-bulk-cancel')?.addEventListener('click', () => {
    isBulkMode = false;
    selectedIds.clear();
    updateBulkUI();
    listContainer.innerHTML = renderGroupedList(currentNotifications);
    bindRowListeners();
  });

  // Load more
  btnLoadMore?.addEventListener('click', () => {
    loadData(true);
  });

  // Initial load
  await loadData();
}
