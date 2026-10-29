/**
 * MyProposals Component (Designer View)
 * Track sent proposals, status tabs, and withdraw pending submissions.
 */

import { withdrawProposal, type SubmittedProposal } from '../../services/projectsService';

export function renderMyProposals(
  proposals: SubmittedProposal[],
  activeTab: string = 'All'
): string {
  const tabs = ['All', 'Pending', 'Viewed', 'Shortlisted', 'Accepted', 'Declined'];

  const filtered = activeTab === 'All'
    ? proposals
    : proposals.filter((p) => p.status.toLowerCase() === activeTab.toLowerCase());

  const rowsHtml = filtered.length > 0
    ? filtered
        .map(
          (p) => `
        <tr data-proposal-row="${p.id}">
          <td>
            <strong>${p.projectTitle}</strong>
            <div style="font-size:12px; color:var(--dez-text-muted)">${p.projectLocation} • Client: ${p.clientName}</div>
          </td>
          <td>${p.dateSent}</td>
          <td style="font-weight:600; font-variant-numeric:tabular-nums;">$${p.proposedPrice.toLocaleString()}</td>
          <td>
            <span class="dez-status-pill dez-status-pill--${p.status.toLowerCase()}">
              ${p.status}
            </span>
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <button 
                type="button" 
                class="dez-link-action" 
                data-view-project-id="${p.projectId}"
              >
                View
              </button>
              ${
                p.status === 'Pending' || p.status === 'Viewed'
                  ? `
                <span>•</span>
                <button 
                  type="button" 
                  class="dez-link-withdraw" 
                  data-withdraw-id="${p.id}"
                >
                  Withdraw
                </button>
              `
                  : ''
              }
            </div>
          </td>
        </tr>
      `
        )
        .join('')
    : `
      <tr>
        <td colspan="5" style="text-align:center; padding:32px; color:var(--dez-text-muted);">
          No proposals found in "${activeTab}" status.
        </td>
      </tr>
    `;

  return `
    <div class="dez-my-proposals-view">
      <header class="dez-page-header">
        <h1 class="dez-page-title">My Proposals</h1>
        <p class="dez-page-subtext">Track your submitted bids, client review status, and active commission terms</p>
      </header>

      <!-- Status Tabs -->
      <div class="dez-proposals-tabs" role="tablist">
        ${tabs
          .map(
            (t) => `
          <button 
            type="button" 
            class="dez-tab-btn ${activeTab === t ? 'is-active' : ''}" 
            data-status-tab="${t}"
            role="tab"
            aria-selected="${activeTab === t}"
          >
            ${t}
          </button>
        `
          )
          .join('')}
      </div>

      <!-- Proposals Table -->
      <div style="overflow-x:auto;">
        <table class="dez-proposals-table">
          <thead>
            <tr>
              <th style="width:40%">Project</th>
              <th>Date Sent</th>
              <th>Your Price</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="dez-my-proposals-tbody">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Initializes tab switching and proposal withdrawal on My Proposals view
 */
export function initMyProposals(
  container: HTMLElement,
  onNavigateToProject: (projectId: string) => void,
  onRefreshProposals: () => void
): void {
  // View project link
  container.querySelectorAll('[data-view-project-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-view-project-id');
      if (pid) onNavigateToProject(pid);
    });
  });

  // Withdraw proposal link
  container.querySelectorAll('[data-withdraw-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const propId = btn.getAttribute('data-withdraw-id');
      if (propId && confirm('Are you sure you want to withdraw this proposal?')) {
        await withdrawProposal(propId);
        onRefreshProposals();
      }
    });
  });
}
