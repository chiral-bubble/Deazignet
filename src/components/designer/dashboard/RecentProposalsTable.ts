/**
 * RecentProposalsTable Component
 * Section 6: Proposals strip below the two main columns.
 * Compact table with Project, Sent date, Your price, Status chip, and "View" link.
 * Strict rule: No "message client" button anywhere.
 */

import type { RecentProposalItem } from '../../../services/designerDashboardService';
import { renderEmptyState } from './EmptyState';

function getStatusChipClass(status: RecentProposalItem['status']): string {
  switch (status) {
    case 'Accepted':
      return 'dez-chip-accepted';
    case 'Shortlisted':
      return 'dez-chip-shortlisted';
    case 'Viewed':
      return 'dez-chip-viewed';
    case 'Declined':
      return 'dez-chip-declined';
    case 'Pending':
    default:
      return 'dez-chip-pending';
  }
}

export function renderRecentProposalsTable(proposals: RecentProposalItem[]): string {
  const displayProposals = proposals.slice(0, 4);

  return `
    <section class="dez-proposals-strip-section" aria-label="Recent design proposals">
      <div class="dez-section-header">
        <div class="dez-section-title-wrap">
          <h2 class="dez-section-title">Recent proposals</h2>
          <span class="dez-section-count">(${proposals.length})</span>
        </div>

        <a href="#my-work/proposals" class="dez-section-viewall" data-designer-tab="proposals" id="btn-view-all-proposals">
          View all proposals &rarr;
        </a>
      </div>

      <div class="dez-proposals-table-card">
        ${
          displayProposals.length > 0
            ? `
              <div class="dez-table-responsive-wrap">
                <table class="dez-proposals-table" role="table">
                  <thead>
                    <tr>
                      <th scope="col" style="width: 45%;">Project</th>
                      <th scope="col" style="width: 15%;">Sent date</th>
                      <th scope="col" style="width: 15%;">Your price</th>
                      <th scope="col" style="width: 15%;">Status</th>
                      <th scope="col" style="width: 10%; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${displayProposals
                      .map((p) => {
                        return `
                          <tr class="dez-proposal-row">
                            <td class="dez-td-title">
                              <span class="dez-p-title-text">${p.projectTitle}</span>
                            </td>
                            <td class="dez-td-date">
                              <span class="dez-p-date-text">${p.sentDate}</span>
                            </td>
                            <td class="dez-td-price">
                              <span class="dez-num-tabular dez-p-price-text">$${p.proposedPrice.toLocaleString()}</span>
                            </td>
                            <td class="dez-td-status">
                              <span class="dez-status-chip ${getStatusChipClass(p.status)}">${p.status}</span>
                            </td>
                            <td class="dez-td-action" style="text-align: right;">
                              <a href="#my-work/proposals/${p.id}" class="dez-link-action btn-view-proposal" data-proposal-id="${p.id}" data-project-id="${p.projectId}">
                                View
                              </a>
                            </td>
                          </tr>
                        `;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>
            `
            : renderEmptyState({
                message: 'No proposals sent yet.',
                subtext: 'Browse client projects and send architectural proposals to start collaborating.',
                actionText: 'Browse Client Projects',
                actionTab: 'projects',
                actionId: 'btn-empty-proposals-browse'
              })
        }
      </div>
    </section>
  `;
}
