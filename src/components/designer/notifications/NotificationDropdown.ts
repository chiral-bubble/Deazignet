/**
 * NotificationDropdown Component
 * Dropdown panel attached to top bar bell:
 * - Shows 5 latest notifications
 * - Unread count badge
 * - "Mark all as read" link
 * - "View all notifications" link to #notifications
 * - Closes on outside click or Escape key
 * - No pulsing animation
 */

import {
  markAllAsRead,
  markAsRead,
  type NotificationItem
} from '../../../services/notificationsService';
import { renderNotificationRow } from './NotificationRow';

export function renderNotificationDropdown(notifications: NotificationItem[], unreadCount: number): string {
  return `
    <div class="dez-notif-dropdown" id="dez-notif-dropdown" role="menu" aria-label="Notifications preview">
      <!-- Dropdown Header -->
      <div class="dez-notif-dropdown-header">
        <div class="dez-notif-dropdown-title-group">
          <strong class="dez-notif-dropdown-title">Notifications</strong>
          ${
            unreadCount > 0
              ? `<span class="dez-notif-dropdown-badge">${unreadCount > 9 ? '9+' : unreadCount}</span>`
              : ''
          }
        </div>
        ${
          unreadCount > 0
            ? `<button type="button" class="dez-notif-mark-all-btn" id="btn-dropdown-mark-all">Mark all as read</button>`
            : ''
        }
      </div>

      <!-- Dropdown List -->
      <div class="dez-notif-dropdown-list">
        ${
          notifications.length === 0
            ? `
            <div class="dez-notif-dropdown-empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <p>No notifications yet</p>
            </div>
          `
            : notifications
                .slice(0, 5)
                .map((n) => renderNotificationRow(n, { compact: true }))
                .join('')
        }
      </div>

      <!-- Dropdown Footer -->
      <div class="dez-notif-dropdown-footer">
        <a href="#notifications" class="dez-notif-view-all-link" id="link-dropdown-view-all">
          View all notifications &rarr;
        </a>
      </div>
    </div>
  `;
}

export function initNotificationDropdown(
  dropdownEl: HTMLElement,
  callbacks: {
    onNavigate: (destination: string) => void;
    onCountChanged: () => void;
    onClose: () => void;
  }
): void {
  // Mark all as read button
  const btnMarkAll = dropdownEl.querySelector('#btn-dropdown-mark-all');
  btnMarkAll?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await markAllAsRead();
    callbacks.onCountChanged();
    callbacks.onClose();
  });

  // Clicking a row
  dropdownEl.querySelectorAll('.dez-notif-row').forEach((row) => {
    row.addEventListener('click', async () => {
      const id = row.getAttribute('data-notif-id');
      const dest = row.getAttribute('data-destination') || '#notifications';
      if (id) {
        await markAsRead(id, true);
        callbacks.onCountChanged();
      }
      callbacks.onClose();
      callbacks.onNavigate(dest);
    });
  });

  // View all notifications link
  const linkViewAll = dropdownEl.querySelector('#link-dropdown-view-all');
  linkViewAll?.addEventListener('click', () => {
    callbacks.onClose();
  });
}
