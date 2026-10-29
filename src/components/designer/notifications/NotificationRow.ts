/**
 * NotificationRow Component
 * Renders a single notification item:
 * - White background, 1px divider, no coloured backgrounds
 * - Small grey icon by type
 * - Title in dark text (slightly bolder for unread)
 * - One-line grey detail
 * - Relative time on the right
 * - Small blue dot for unread
 * - Hover/focus quick actions: mark as read/unread toggle, delete
 * - Checkbox for bulk selection
 * - Click navigates to destination and marks as read
 */

import { NOTIFICATION_TYPES } from '../../../config/notificationTypes';
import { type NotificationItem } from '../../../services/notificationsService';

export function renderNotificationRow(
  notification: NotificationItem,
  options: {
    isBulkSelectionActive?: boolean;
    isSelected?: boolean;
    compact?: boolean; // For bell dropdown
  } = {}
): string {
  const { isBulkSelectionActive = false, isSelected = false, compact = false } = options;
  const config = NOTIFICATION_TYPES[notification.type] || {
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`
  };

  return `
    <div
      class="dez-notif-row ${notification.isUnread ? 'is-unread' : ''} ${compact ? 'is-compact' : ''}"
      data-notif-id="${notification.id}"
      data-destination="${notification.destinationUrl}"
      role="article"
      tabindex="0"
    >
      ${
        isBulkSelectionActive && !compact
          ? `
        <div class="dez-notif-checkbox-wrap" onclick="event.stopPropagation();">
          <input
            type="checkbox"
            class="dez-notif-checkbox"
            data-select-notif-id="${notification.id}"
            ${isSelected ? 'checked' : ''}
            aria-label="Select notification"
          />
        </div>
      `
          : ''
      }

      <!-- Icon -->
      <div class="dez-notif-icon-col" aria-hidden="true">
        <span class="dez-notif-type-icon">
          ${config.iconSvg}
        </span>
      </div>

      <!-- Main Content -->
      <div class="dez-notif-content-col">
        <div class="dez-notif-title-row">
          <span class="dez-notif-title ${notification.isUnread ? 'is-bold' : ''}">
            ${notification.title}
          </span>
          ${notification.isUnread ? `<span class="dez-notif-unread-dot" aria-label="Unread"></span>` : ''}
        </div>
        <p class="dez-notif-detail">${notification.detail}</p>
      </div>

      <!-- Right Meta & Actions -->
      <div class="dez-notif-meta-col">
        <span class="dez-notif-time">${notification.timestamp}</span>

        <!-- Hover Quick Actions (Hidden in compact view) -->
        ${
          !compact
            ? `
          <div class="dez-notif-quick-actions" onclick="event.stopPropagation();">
            <button
              type="button"
              class="dez-notif-action-btn"
              data-action="toggle-read"
              data-id="${notification.id}"
              data-current-unread="${notification.isUnread}"
              title="${notification.isUnread ? 'Mark as read' : 'Mark as unread'}"
              aria-label="${notification.isUnread ? 'Mark as read' : 'Mark as unread'}"
            >
              ${
                notification.isUnread
                  ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
                  : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`
              }
            </button>
            <button
              type="button"
              class="dez-notif-action-btn dez-action-delete"
              data-action="delete"
              data-id="${notification.id}"
              title="Delete notification"
              aria-label="Delete notification"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}
