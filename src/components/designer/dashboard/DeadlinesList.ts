/**
 * DeadlinesList Component
 * Section B of Left Column:
 * - Title "Upcoming deadlines" with "View all" link
 * - Plain list sorted by date: milestone/task, project, due date (relative)
 * - Overdue items in dark red text (#B91C1C)
 */

import type { UpcomingDeadline } from '../../../services/designerDashboardService';
import { renderEmptyState } from './EmptyState';

export function renderDeadlinesList(deadlines: UpcomingDeadline[]): string {
  const displayList = deadlines.slice(0, 5);

  return `
    <section class="dez-deadlines-section" aria-label="Upcoming deadlines">
      <div class="dez-section-header">
        <h2 class="dez-section-title">Upcoming deadlines</h2>
        ${deadlines.length > 5 ? `<a href="#deadlines" class="dez-section-viewall" id="btn-view-all-deadlines">View all</a>` : ''}
      </div>

      <div class="dez-deadlines-card">
        ${
          displayList.length > 0
            ? `
              <ul class="dez-deadlines-list" role="list">
                ${displayList
                  .map((item) => {
                    return `
                      <li class="dez-deadline-item ${item.isOverdue ? 'is-overdue' : ''}">
                        <div class="dez-deadline-content">
                          <strong class="dez-deadline-title">${item.title}</strong>
                          <span class="dez-deadline-project">${item.projectTitle}</span>
                        </div>
                        <div class="dez-deadline-due ${item.isOverdue ? 'dez-due-overdue' : 'dez-due-normal'}">
                          <span class="dez-due-date">${item.dueDate}</span>
                          <span class="dez-due-rel">(${item.relativeDate})</span>
                        </div>
                      </li>
                    `;
                  })
                  .join('')}
              </ul>
            `
            : renderEmptyState({
                message: 'No upcoming deadlines.',
                subtext: 'All milestone deliverables and scheduled dates are up to date.'
              })
        }
      </div>
    </section>
  `;
}
