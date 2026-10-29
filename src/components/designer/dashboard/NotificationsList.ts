/**
 * NotificationsList Component
 * Section C of Right Column:
 * - Plain list on white background with 1px dividers.
 * - Small grey icon by type (payment, proposal, milestone, system, message).
 * - Small blue dot on the left for unread rows (never color the whole row).
 * - "Mark all as read" link in header.
 * - If client sent a message, includes a "Reply" link.
 */

import type { DesignerNotification } from '../../../services/designerDashboardService';
import { renderEmptyState } from './EmptyState';

function getNotificationIcon(type: DesignerNotification['type']): string {
  switch (type) {
    case 'payment':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`;
    case 'proposal':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>`;
    case 'milestone':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    case 'message':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    case 'system':
    default:
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }
}

export function renderNotificationsList(notifications: DesignerNotification[]): string {
  const displayList = notifications.slice(0, 5);
  const hasUnread = notifications.some((n) => n.isUnread);

  return `
    <section class="dez-notifs-section" aria-label="Studio notifications">
      <div class="dez-section-header">
        <div class="dez-section-title-wrap">
          <h2 class="dez-section-title">Notifications</h2>
          ${hasUnread ? `<span class="dez-notif-unread-count">${notifications.filter((n) => n.isUnread).length} unread</span>` : ''}
        </div>

        <div class="dez-notifs-header-actions">
          ${
            hasUnread
              ? `<button type="button" class="dez-btn-link dez-mark-all-read" id="btn-mark-all-read">Mark all as read</button>`
              : ''
          }
        </div>
      </div>

      <div class="dez-notifs-card">
        ${
          displayList.length > 0
            ? `
              <ul class="dez-notifs-list" role="list">
                ${displayList
                  .map((item) => {
                    return `
                      <li class="dez-notif-row ${item.isUnread ? 'is-unread' : 'is-read'}">
                        <div class="dez-notif-dot-slot" aria-hidden="true">
                          ${item.isUnread ? `<span class="dez-notif-blue-dot"></span>` : ''}
                        </div>

                        <div class="dez-notif-icon-slot" aria-hidden="true">
                          ${getNotificationIcon(item.type)}
                        </div>

                        <div class="dez-notif-body">
                          <div class="dez-notif-line-1">
                            <strong class="dez-notif-title">${item.title}</strong>
                            <span class="dez-notif-time">${item.relativeTime}</span>
                          </div>
                          <p class="dez-notif-detail">${item.detail}</p>
                          ${
                            item.type === 'message' && item.actionLinkText
                              ? `<div class="dez-notif-reply-wrap">
                                  <a href="#conversations" class="dez-notif-reply-link" data-designer-tab="conversations">
                                    ${item.actionLinkText} &rarr;
                                  </a>
                                </div>`
                              : ''
                          }
                        </div>
                      </li>
                    `;
                  })
                  .join('')}
              </ul>
              ${
                notifications.length > 5
                  ? `<div class="dez-card-footer-strip">
                      <button type="button" class="dez-btn-link" id="btn-view-all-notifs">View all notifications (${notifications.length})</button>
                    </div>`
                  : ''
              }
            `
            : renderEmptyState({
                message: "You're all caught up.",
                subtext: 'No new notifications or client messages.'
              })
        }
      </div>
    </section>
  `;
}
