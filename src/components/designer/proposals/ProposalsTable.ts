/**
 * ProposalsTable Component
 * Responsive proposals list:
 * - Desktop table with Project, Client, Date sent, Your price, Client budget, Status chip, View link.
 * - Mobile stacked cards layout.
 * - Row hints under title ("Client viewed 2 days ago", "Shortlisted", "Project no longer open").
 * - Empty states per tab with "Browse Client Projects" CTA.
 */

import { type SharedProposal } from '../../../mocks/dataset';
import { type ProposalStatusTab } from '../../../services/proposalsService';
import { formatMoney } from '../../../utils/formatters';

export function renderProposalsTable(
  proposals: SharedProposal[],
  currentTab: ProposalStatusTab
): string {
  if (proposals.length === 0) {
    return renderEmptyState(currentTab);
  }

  return `
    <div class="dez-proposals-table-wrapper">
      <!-- Desktop Table (hidden on small screens via CSS) -->
      <div class="dez-table-card dez-proposals-desktop-view" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                <th style="padding: 12px 16px;">Project</th>
                <th style="padding: 12px 16px;">Client</th>
                <th style="padding: 12px 16px;">Date sent</th>
                <th style="padding: 12px 16px; text-align: right;">Your price</th>
                <th style="padding: 12px 16px; text-align: right;">Client budget</th>
                <th style="padding: 12px 16px; text-align: center;">Status</th>
                <th style="padding: 12px 16px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${proposals.map((p) => renderTableRow(p)).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile Stacked Rows (visible on small screens via CSS) -->
      <div class="dez-proposals-mobile-view" style="display: flex; flex-direction: column; gap: 12px;">
        ${proposals.map((p) => renderMobileCard(p)).join('')}
      </div>
    </div>
  `;
}

function renderTableRow(p: SharedProposal): string {
  const isHourly = p.paymentType === 'Hourly';

  return `
    <tr class="dez-clickable-row" data-prop-id="${p.id}" tabindex="0" style="border-bottom: 1px solid #F3F4F6; cursor: pointer; transition: background 150ms ease;">
      <td style="padding: 14px 16px; max-width: 300px;">
        <div style="font-weight: 600; color: #111827; line-height: 1.4;">${p.projectTitle}</div>
        ${
          p.statusHint
            ? `<div style="font-size: 11.5px; color: #6B7280; margin-top: 3px;">• ${p.statusHint}</div>`
            : ''
        }
      </td>
      <td style="padding: 14px 16px; color: #4B5563;">
        <div style="font-weight: 500; color: #111827;">${p.clientName}</div>
        <div style="font-size: 12px; color: #6B7280;">${p.clientLocation}</div>
      </td>
      <td style="padding: 14px 16px; color: #6B7280; white-space: nowrap;">
        ${p.sentDate}
      </td>
      <td class="dez-tabular-num" style="padding: 14px 16px; text-align: right; font-weight: 600; color: #111827;">
        ${isHourly ? `$${p.proposedPrice}/hr` : `$${formatMoney(p.proposedPrice)}`}
      </td>
      <td class="dez-tabular-num" style="padding: 14px 16px; text-align: right; color: #6B7280;">
        $${formatMoney(p.clientBudget)}
      </td>
      <td style="padding: 14px 16px; text-align: center;">
        ${renderStatusChip(p.status)}
      </td>
      <td style="padding: 14px 16px; text-align: right;">
        <a href="#proposals/${p.id}" class="dez-inline-link-btn" style="color: var(--dez-primary-blue, #2F7BE5); font-weight: 500; font-size: 13px; text-decoration: none;">
          View &rarr;
        </a>
      </td>
    </tr>
  `;
}

function renderMobileCard(p: SharedProposal): string {
  const isHourly = p.paymentType === 'Hourly';

  return `
    <div class="dez-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 14.5px; color: #111827; line-height: 1.4;">${p.projectTitle}</div>
        ${renderStatusChip(p.status)}
      </div>

      ${
        p.statusHint
          ? `<div style="font-size: 12px; color: #6B7280; margin-bottom: 12px;">• ${p.statusHint}</div>`
          : ''
      }

      <div style="font-size: 13px; color: #4B5563; margin-bottom: 12px;">
        <span>${p.clientName}</span> • <span style="color: #6B7280;">${p.clientLocation}</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F3F4F6; padding-top: 10px; font-size: 13px;">
        <div>
          <span style="color: #6B7280;">Offer:</span>
          <strong class="dez-tabular-num" style="color: #111827;">${isHourly ? `$${p.proposedPrice}/hr` : `$${formatMoney(p.proposedPrice)}`}</strong>
        </div>
        <a href="#proposals/${p.id}" class="dez-btn-secondary" style="height: 30px; font-size: 12px; padding: 0 12px; text-decoration: none; display: inline-flex; align-items: center;">
          View details
        </a>
      </div>
    </div>
  `;
}

function renderStatusChip(status: string): string {
  switch (status.toLowerCase()) {
    case 'accepted':
      return `<span class="dez-status-pill pill-green">Accepted</span>`;
    case 'shortlisted':
      return `<span class="dez-status-pill pill-blue">Shortlisted</span>`;
    case 'viewed':
      return `<span class="dez-status-pill pill-amber">Viewed</span>`;
    case 'pending':
      return `<span class="dez-status-pill pill-grey">Pending</span>`;
    case 'declined':
      return `<span class="dez-status-pill pill-red">Declined</span>`;
    case 'withdrawn':
      return `<span class="dez-status-pill pill-grey">Withdrawn</span>`;
    default:
      return `<span class="dez-status-pill pill-grey">${status}</span>`;
  }
}

function renderEmptyState(tab: ProposalStatusTab): string {
  let title = "You haven't sent any proposals yet.";
  let desc = 'Browse open client projects to find your next commission and send your first proposal.';

  if (tab !== 'All') {
    title = `No ${tab.toLowerCase()} proposals.`;
    desc = `You currently have no proposals marked as ${tab.toLowerCase()}.`;
  }

  return `
    <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px 24px; text-align: center;">
      <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">${title}</h3>
      <p style="font-size: 13.5px; color: #6B7280; max-width: 420px; margin: 0 auto 20px auto; line-height: 1.5;">${desc}</p>
      <a href="#client-projects" class="dez-btn-primary" style="height: 38px; padding: 0 20px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
        Browse Client Projects
      </a>
    </div>
  `;
}

export function initProposalsTable(
  container: HTMLElement,
  onSelectProposal: (proposalId: string) => void
): void {
  container.querySelectorAll<HTMLTableRowElement>('.dez-clickable-row').forEach((row) => {
    const id = row.getAttribute('data-prop-id');
    const handler = (e: Event) => {
      // If clicking a link inside, allow standard link navigation
      if ((e.target as HTMLElement).tagName === 'A') return;
      if (id) onSelectProposal(id);
    };

    row.addEventListener('click', handler);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (id) onSelectProposal(id);
      }
    });
  });
}
