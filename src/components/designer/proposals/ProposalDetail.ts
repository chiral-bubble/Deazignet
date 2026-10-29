/**
 * ProposalDetail Component
 * Full-page detail view of a submitted proposal with breadcrumb back to the list:
 * Two columns:
 * Left: Header, vertical status timeline, offer breakdown, project snapshot (with "Project updated" note if modified)
 * Right: Sticky action panel, reply link, dev test button, client profile summary
 */

import {
  getProposalDetail,
  acceptProposalDev
} from '../../../services/proposalsService';
import { type SharedProposal } from '../../../mocks/dataset';
import { renderProposalTimeline } from './ProposalTimeline';
import { renderOfferBreakdown } from './OfferBreakdown';
import { renderProposalActionsPanel } from './ProposalActionsPanel';
import { renderWithdrawDialog, initWithdrawDialog } from './WithdrawDialog';

export function renderProposalDetailSkeleton(): string {
  return `
    <div class="dez-proposal-detail-page" id="dez-prop-detail-root">
      <div style="padding: 40px; text-align: center; color: #6B7280;">Loading proposal details...</div>
    </div>
  `;
}

export async function initProposalDetail(
  container: HTMLElement,
  proposalId: string,
  callbacks: {
    onBackToList: () => void;
    onOpenEditDrawer?: (proposal: SharedProposal) => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): Promise<void> {
  const root = container.querySelector('#dez-prop-detail-root') as HTMLElement;
  if (!root) return;

  const data = await getProposalDetail(proposalId);
  if (!data) {
    root.innerHTML = `
      <div style="padding: 48px; text-align: center;">
        <h2 style="font-size: 18px; color: #111827; margin-bottom: 8px;">Proposal not found</h2>
        <p style="color: #6B7280; font-size: 13.5px; margin-bottom: 16px;">The requested proposal does not exist or was removed.</p>
        <button type="button" class="dez-btn-secondary" id="btn-back-not-found">Back to My Proposals</button>
      </div>
    `;
    root.querySelector('#btn-back-not-found')?.addEventListener('click', callbacks.onBackToList);
    return;
  }

  const { proposal, projectSnapshot, clientInfo } = data;

  root.innerHTML = `
    <!-- Breadcrumb back link -->
    <div style="margin-bottom: 20px;">
      <button type="button" class="dez-inline-link-btn" id="btn-back-to-proposals-list" style="background: none; border: none; font-size: 13px; color: #6B7280; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 0;">
        &larr; Back to My Proposals
      </button>
    </div>

    <!-- Page Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <h1 class="dez-page-title" style="font-size: 26px; margin: 0; line-height: 1.3;">
            ${proposal.projectTitle}
          </h1>
        </div>
        <div style="font-size: 13px; color: #6B7280;">
          Proposal ID: <code style="font-family: monospace; color: #374151;">${proposal.id}</code> • Sent on ${proposal.sentDate}
        </div>
      </div>
    </div>

    <!-- Two-Column Layout -->
    <div class="dez-proposal-detail-grid" style="display: grid; grid-template-columns: 1fr 340px; gap: 32px; align-items: start;">
      <!-- Left Column: Timeline, Offer Breakdown, Project Snapshot -->
      <div class="dez-proposal-detail-main">
        <!-- Vertical Status Timeline -->
        ${renderProposalTimeline(proposal)}

        <!-- Offer Breakdown -->
        ${renderOfferBreakdown(proposal)}

        <!-- Project Snapshot as of Application Date -->
        <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Original project snapshot</h3>
            ${
              projectSnapshot.wasUpdatedSinceApplication
                ? `<span class="dez-status-pill pill-amber" style="font-size: 11px;">Project updated by client since application</span>`
                : `<span style="font-size: 12px; color: #6B7280;">Application baseline</span>`
            }
          </div>

          <p style="font-size: 13.5px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">
            ${projectSnapshot.fullDescription || projectSnapshot.shortDescription}
          </p>

          <!-- Facts Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; border-top: 1px solid #E5E7EB; padding-top: 14px; font-size: 12.5px;">
            <div>
              <span style="color: #6B7280; display: block;">Location</span>
              <strong style="color: #111827;">${projectSnapshot.location}</strong>
            </div>
            <div>
              <span style="color: #6B7280; display: block;">Deadline</span>
              <strong style="color: #111827;">${projectSnapshot.deadline}</strong>
            </div>
            <div>
              <span style="color: #6B7280; display: block;">Project scale</span>
              <strong style="color: #111827;">${projectSnapshot.facts.projectScale}</strong>
            </div>
            <div>
              <span style="color: #6B7280; display: block;">Regulatory zone</span>
              <strong style="color: #111827;">${projectSnapshot.facts.regulatoryZone}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Sticky Action & Client Profile Panel -->
      <div class="dez-proposal-detail-aside">
        ${renderProposalActionsPanel(proposal, clientInfo)}
      </div>
    </div>

    <!-- Withdraw Dialog -->
    ${renderWithdrawDialog()}
  `;

  // Attach handlers
  root.querySelector('#btn-back-to-proposals-list')?.addEventListener('click', callbacks.onBackToList);

  const withdrawDialog = initWithdrawDialog(root, {
    onSuccess: () => {
      // Re-init with updated status
      initProposalDetail(container, proposalId, callbacks);
    },
    onShowToast: callbacks.onShowToast
  });

  root.querySelector('#btn-open-withdraw-dialog')?.addEventListener('click', () => {
    withdrawDialog.open(proposalId);
  });

  // Edit proposal handler
  root.querySelector('#btn-edit-proposal')?.addEventListener('click', () => {
    if (callbacks.onOpenEditDrawer) {
      callbacks.onOpenEditDrawer(proposal);
    } else {
      callbacks.onShowToast('Edit Proposal', 'Opened proposal editor.', 'info');
    }
  });

  // Dev Test Button: Accept proposal
  root.querySelector('#btn-dev-accept-proposal')?.addEventListener('click', async () => {
    await acceptProposalDev(proposalId);
    callbacks.onShowToast(
      'Proposal Accepted (Dev Test)',
      'Created active project, added milestone escrow to Payments, and generated notifications.',
      'success'
    );
    // Reload view
    initProposalDetail(container, proposalId, callbacks);
  });
}
