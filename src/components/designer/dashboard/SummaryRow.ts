/**
 * SummaryRow Component
 * ONE container with four equal blocks separated by thin vertical dividers (not four separate cards).
 * Each block: grey label, large number (Inter semibold, 32px), and one line of grey supporting text.
 * No charts, no trend arrows.
 */

import type { DesignerSummary } from '../../../services/designerDashboardService';

export function renderSummaryRow(summary: DesignerSummary): string {
  const inEscrowFormatted = `$${summary.inEscrowAmount.toLocaleString()}`;
  const totalEarnedFormatted = `$${summary.totalEarnedAmount.toLocaleString()}`;

  return `
    <section class="dez-summary-row" aria-label="Studio Performance Summary">
      <!-- Block 1: Active Projects -->
      <div class="dez-summary-block">
        <span class="dez-summary-label">Active projects</span>
        <div class="dez-summary-value">${summary.activeProjectsCount}</div>
        <div class="dez-summary-support">
          ${summary.milestonesDueThisWeek} ${summary.milestonesDueThisWeek === 1 ? 'milestone' : 'milestones'} due this week
        </div>
      </div>

      <!-- Block 2: Proposals Pending -->
      <div class="dez-summary-block">
        <span class="dez-summary-label">Proposals pending</span>
        <div class="dez-summary-value">${summary.proposalsPendingCount}</div>
        <div class="dez-summary-support">
          ${summary.proposalsViewedCount} viewed by clients
        </div>
      </div>

      <!-- Block 3: In Escrow -->
      <div class="dez-summary-block">
        <span class="dez-summary-label">In escrow</span>
        <div class="dez-summary-value">${inEscrowFormatted}</div>
        <div class="dez-summary-support">Held for active milestones</div>
      </div>

      <!-- Block 4: Total Earned -->
      <div class="dez-summary-block">
        <span class="dez-summary-label">Total earned</span>
        <div class="dez-summary-value">${totalEarnedFormatted}</div>
        <div class="dez-summary-support">All-time released payments</div>
      </div>
    </section>
  `;
}
