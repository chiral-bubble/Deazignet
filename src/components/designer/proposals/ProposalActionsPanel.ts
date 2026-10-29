/**
 * ProposalActionsPanel Component
 * Sticky right panel for Proposal Detail:
 * - Status summary & platform fee preview
 * - Status-based actions (Pending, Viewed, Shortlisted, Accepted, Declined, Withdrawn)
 * - Reply link if client has messaged (strict rule: no other message button)
 * - About the client card (no email/phone)
 * - Dev tool button to accept proposal and verify entire chain
 */

import { type SharedProposal } from '../../../mocks/dataset';
import { PAYMENTS_CONFIG } from '../../../config/paymentsConfig';
import { formatMoney } from '../../../utils/formatters';

export function renderProposalActionsPanel(
  proposal: SharedProposal,
  clientInfo: {
    name: string;
    location: string;
    memberSince: string;
    projectsPosted: number;
    paymentMethodVerified: boolean;
  }
): string {
  const isHourly = proposal.paymentType === 'Hourly';
  const feePercent = PAYMENTS_CONFIG.platformFeePercentage.upgraded; // current tier
  const gross = isHourly ? proposal.proposedPrice * (proposal.estimatedHours || 1) : proposal.proposedPrice;
  const feeAmount = (gross * feePercent) / 100;
  const netEarnings = gross - feeAmount;

  const canEdit =
    proposal.status === 'pending' &&
    PAYMENTS_CONFIG.allowEditPendingProposalIfUnviewed &&
    proposal.timeline.find((t) => t.stage.toLowerCase() === 'viewed')?.completed !== true;

  return `
    <div class="dez-proposal-actions-panel" style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Sticky Action Card -->
      <div class="dez-sticky-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; position: sticky; top: 20px;">
        <!-- Status Banner / Headline -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">Proposal Status</div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="dez-status-pill ${
              proposal.status === 'accepted'
                ? 'pill-green'
                : proposal.status === 'shortlisted'
                ? 'pill-blue'
                : proposal.status === 'viewed'
                ? 'pill-amber'
                : proposal.status === 'declined'
                ? 'pill-red'
                : 'pill-grey'
            }" style="font-size: 13px; padding: 3px 10px;">
              ${proposal.status.toUpperCase()}
            </span>

            ${
              proposal.editCount > 0
                ? `<span style="font-size: 11.5px; color: #6B7280;">Edited ${proposal.editCount} time${proposal.editCount > 1 ? 's' : ''}</span>`
                : ''
            }
          </div>
        </div>

        <!-- Net Earnings Breakdown Preview -->
        <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px; margin-bottom: 18px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #4B5563;">
            <span>Gross proposed</span>
            <span class="dez-tabular-num" style="font-weight: 500; color: #111827;">$${formatMoney(gross)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; color: #4B5563;">
            <span>Studio escrow fee (${feePercent}%)</span>
            <span class="dez-tabular-num" style="color: #6B7280;">-$${formatMoney(feeAmount)}</span>
          </div>
          <div style="height: 1px; background: #E5E7EB; margin: 8px 0;"></div>
          <div style="display: flex; justify-content: space-between; font-weight: 600; color: #111827;">
            <span>Net take-home</span>
            <span class="dez-tabular-num" style="color: #059669;">+$${formatMoney(netEarnings)}</span>
          </div>
        </div>

        <!-- Client Message Banner (if client initiated) -->
        ${
          proposal.hasClientMessaged
            ? `
          <div style="background: #EBF3FD; border: 1px solid #BFDBFE; border-radius: 6px; padding: 12px 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <div style="font-size: 12.5px; color: #1E3A8A; font-weight: 500;">
              You have a message from the client
            </div>
            <a href="#conversations/${proposal.conversationId || 'conv-1'}" class="dez-btn-primary" style="height: 30px; font-size: 12px; padding: 0 12px; text-decoration: none; display: inline-flex; align-items: center;">
              Reply &rarr;
            </a>
          </div>
        `
            : ''
        }

        <!-- Status-Specific Action Buttons -->
        <div class="dez-proposal-action-buttons" style="display: flex; flex-direction: column; gap: 10px;">
          ${
            proposal.status === 'accepted'
              ? `
            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 14px; margin-bottom: 8px;">
              <div style="font-weight: 600; font-size: 13.5px; color: #065F46; margin-bottom: 4px;">Your proposal was accepted</div>
              <div style="font-size: 12px; color: #047857; line-height: 1.4;">
                Next steps: Client funds the initial milestone into escrow. Once funded, you may upload deliverables in Active Projects.
              </div>
            </div>
            <a href="#my-work/projects" class="dez-btn-primary" style="width: 100%; height: 38px; display: inline-flex; align-items: center; justify-content: center; text-decoration: none; font-size: 13.5px;">
              Open project workspace &rarr;
            </a>
          `
              : proposal.status === 'pending'
              ? `
            <button
              type="button"
              class="dez-btn-secondary"
              id="btn-edit-proposal"
              ${!canEdit ? 'disabled' : ''}
              style="width: 100%; height: 38px; font-size: 13.5px;"
            >
              Edit proposal
            </button>
            ${
              !canEdit
                ? `<div style="font-size: 11.5px; color: #6B7280; text-align: center;">Proposals cannot be edited once reviewed by the client.</div>`
                : ''
            }
            <button type="button" class="dez-btn-secondary" id="btn-open-withdraw-dialog" style="width: 100%; height: 38px; font-size: 13.5px; color: #DC2626;">
              Withdraw proposal
            </button>
          `
              : proposal.status === 'viewed' || proposal.status === 'shortlisted'
              ? `
            <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
              The client is currently reviewing shortlists for this commission.
            </div>
            <button type="button" class="dez-btn-secondary" id="btn-open-withdraw-dialog" style="width: 100%; height: 38px; font-size: 13.5px; color: #DC2626;">
              Withdraw proposal
            </button>
          `
              : proposal.status === 'declined'
              ? `
            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 12px; margin-bottom: 8px; font-size: 12.5px; color: #991B1B;">
              <strong>Client feedback:</strong> ${proposal.declinedReason || 'Client selected another studio for this scope.'}
            </div>
            <button type="button" class="dez-btn-secondary" id="btn-use-as-template" style="width: 100%; height: 38px; font-size: 13px;">
              Use as a template for new proposal
            </button>
          `
              : `
            <!-- Withdrawn State -->
            <div style="background: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; margin-bottom: 8px; font-size: 12.5px; color: #4B5563;">
              Proposal was withdrawn by studio.
              ${proposal.withdrawnReason ? `<div style="margin-top: 4px;">Reason: ${proposal.withdrawnReason}</div>` : ''}
            </div>
            <button type="button" class="dez-btn-secondary" id="btn-use-as-template" style="width: 100%; height: 38px; font-size: 13px;">
              Use as a template
            </button>
          `
          }

          <!-- Dev Test Tool: Accept in mock -->
          ${
            proposal.status !== 'accepted'
              ? `
            <div style="margin-top: 14px; border-top: 1px dashed #E5E7EB; padding-top: 12px;">
              <button type="button" class="dez-btn-secondary" id="btn-dev-accept-proposal" style="width: 100%; height: 32px; font-size: 12px; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;">
                ⚡ Dev: Accept proposal (test full chain)
              </button>
            </div>
          `
              : ''
          }
        </div>
      </div>

      <!-- About The Client Card (Strict rule: No email or phone!) -->
      <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
        <h4 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">About the client</h4>
        
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #374151;">
          <div>
            <span style="color: #6B7280; font-size: 12px; display: block;">Client name</span>
            <strong>${clientInfo.name}</strong>
          </div>

          <div>
            <span style="color: #6B7280; font-size: 12px; display: block;">Location</span>
            <span>${clientInfo.location}</span>
          </div>

          <div>
            <span style="color: #6B7280; font-size: 12px; display: block;">Member since</span>
            <span>${clientInfo.memberSince}</span>
          </div>

          <div>
            <span style="color: #6B7280; font-size: 12px; display: block;">Projects posted</span>
            <span>${clientInfo.projectsPosted} projects</span>
          </div>

          <div style="display: flex; align-items: center; gap: 6px; color: #059669; font-weight: 500; font-size: 12.5px; margin-top: 4px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Payment method verified
          </div>
        </div>
      </div>
    </div>
  `;
}
