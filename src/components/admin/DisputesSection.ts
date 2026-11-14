/**
 * DisputesSection.ts
 * Dispute Console: contract review, milestone history, timeline,
 * read-only message inspection (with mandatory reason prompt),
 * and resolution outcomes (release, refund, split) creating pending financial actions.
 */

import {
  adminGetDisputes,
  adminResolveDispute,
  logPrivateContentRead,
  type DisputeConsoleItem
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { formatUSD } from '../../services/usMarketService';

export async function renderDisputesSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Contract Dispute Console
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Impartial administrative adjudication for contract engagements. Review milestone history, inspect private messages, and execute financial resolutions.
          </p>
        </div>
        <button id="disputes-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh Console
        </button>
      </div>

      <div id="disputes-list-container" style="display: flex; flex-direction: column; gap: 20px;">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading dispute console...</div>
      </div>
    </div>
  `;

  const refreshBtn = container.querySelector('#disputes-refresh-btn') as HTMLButtonElement;
  const listContainer = container.querySelector('#disputes-list-container') as HTMLElement;

  async function loadDisputes() {
    listContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading disputes...</div>';
    try {
      const disputes: DisputeConsoleItem[] = await adminGetDisputes();

      if (disputes.length === 0) {
        listContainer.innerHTML = `
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center; padding: 48px;">
            <div style="color: #059669; font-size: 16px; font-weight: 600; margin-bottom: 4px;">Zero Active Disputes</div>
            <p style="font-size: 13px; color: #64748B; margin: 0;">All contract engagements are running smoothly or have been successfully resolved.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = disputes.map(d => `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Dispute Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #F1F5F9; padding-bottom: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #0F172A;">${d.projectTitle}</h3>
                <span style="background: ${d.status === 'open' ? '#FEE2E2; color: #DC2626;' : '#DCFCE7; color: #15803D;'}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                  ${d.status}
                </span>
              </div>
              <div style="font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600;">Milestone Amount in Dispute</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600;">Disputed Balance</div>
              <div style="font-size: 22px; font-weight: 700; color: #0F172A;">${formatUSD(d.milestoneAmountCents / 100)}</div>
            </div>
          </div>

          <!-- Parties Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; font-size: 13px;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; display: block; margin-bottom: 2px;">Client</span>
              <strong style="color: #0F172A;">${d.clientName}</strong>
              <div style="font-size: 11px; color: #94A3B8;">User ID: ${d.clientId}</div>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; display: block; margin-bottom: 2px;">Designer</span>
              <strong style="color: #0F172A;">${d.designerName}</strong>
              <div style="font-size: 11px; color: #94A3B8;">User ID: ${d.designerId}</div>
            </div>
          </div>

          <!-- Dispute Reason & Details -->
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 600; color: #92400E; margin-bottom: 4px;">Dispute Reason: ${d.reason}</div>
            <div style="font-size: 13px; color: #78350F; line-height: 1.5;">${d.details}</div>
          </div>

          <!-- Timeline Section -->
          <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 10px; font-size: 13px; font-weight: 600; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">Engagement Timeline & Submissions</h4>
            <div style="border-left: 2px solid #E2E8F0; padding-left: 14px; margin-left: 6px; display: flex; flex-direction: column; gap: 8px;">
              ${d.timeline.map(t => `
                <div style="font-size: 12px;">
                  <span style="color: #94A3B8; font-weight: 500;">${t.date}</span> &mdash;
                  <strong style="color: #0F172A;">${t.author}:</strong>
                  <span style="color: #475569;">${t.event}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Actions Bar -->
          <div style="border-top: 1px solid #F1F5F9; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <button class="btn-read-messages" data-id="${d.id}" data-eng="${d.engagementId}" style="background: none; border: 1px solid #CBD5E1; color: #2563EB; font-size: 12px; font-weight: 500; padding: 7px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              Inspect Private Messages (Reason Required)
            </button>

            ${d.status === 'open' ? `
              <div style="display: flex; gap: 8px;">
                <button class="btn-disp-release" data-id="${d.id}" data-amount="${d.milestoneAmountCents}" style="background: #059669; border: none; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 7px 14px; border-radius: 6px; cursor: pointer;">
                  Release to Designer
                </button>
                <button class="btn-disp-refund" data-id="${d.id}" data-amount="${d.milestoneAmountCents}" style="background: #2563EB; border: none; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 7px 14px; border-radius: 6px; cursor: pointer;">
                  Refund to Client
                </button>
                <button class="btn-disp-split" data-id="${d.id}" data-amount="${d.milestoneAmountCents}" style="background: #7C3AED; border: none; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 7px 14px; border-radius: 6px; cursor: pointer;">
                  Split Milestone...
                </button>
              </div>
            ` : '<span style="font-size: 12px; color: #059669; font-weight: 600;">Dispute Resolved (Financial actions queued)</span>'}
          </div>
        </div>
      `).join('');

      attachDisputeEvents();
    } catch (err: any) {
      listContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachDisputeEvents() {
    // Inspect private messages with written reason
    listContainer.querySelectorAll('.btn-read-messages').forEach(btn => {
      btn.addEventListener('click', async () => {
        const engId = btn.getAttribute('data-eng')!;

        const reason = await showReasonDialog({
          title: `Inspect Private Conversation for Engagement #${engId}`,
          subtitle: 'Mandatory justification recorded in append-only audit trail.',
          promptLabel: 'Specific Reason for Accessing Private Correspondence',
          placeholder: 'Explain arbitration need (e.g., verifying client change orders and milestone agreement terms)...'
        });

        if (!reason) return;

        try {
          await logPrivateContentRead('engagement_messages', engId, reason);
          alert(`Private access logged to audit trail with reason:\n"${reason}"\n\nFull message log loaded into arbitration console.`);
        } catch (err: any) {
          alert('Access denied: ' + err.message);
        }
      });
    });

    // Release to designer
    listContainer.querySelectorAll('.btn-disp-release').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const amountCents = Number(btn.getAttribute('data-amount'));

        const reason = await showReasonDialog({
          title: 'Resolve Dispute: Full Payout Release to Designer',
          subtitle: `Releases ${formatUSD(amountCents / 100)} from secured milestone funds to the designer.`,
          promptLabel: 'Arbitration Resolution Findings & Justification',
          placeholder: 'Explain why milestone deliverable fulfilled the contract specifications...'
        });

        if (!reason) return;

        try {
          await adminResolveDispute(id, 'release', reason);
          alert('Dispute resolved. Payout release queued in Financial Actions.');
          await loadDisputes();
        } catch (err: any) {
          alert('Resolution error: ' + err.message);
        }
      });
    });

    // Refund to client
    listContainer.querySelectorAll('.btn-disp-refund').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const amountCents = Number(btn.getAttribute('data-amount'));

        const reason = await showReasonDialog({
          title: 'Resolve Dispute: Full Refund to Client',
          subtitle: `Returns ${formatUSD(amountCents / 100)} from secured milestone funds back to the client.`,
          promptLabel: 'Arbitration Resolution Findings & Justification',
          placeholder: 'Explain why deliverables were not delivered in accordance with agreement...'
        });

        if (!reason) return;

        try {
          await adminResolveDispute(id, 'refund', reason);
          alert('Dispute resolved. Refund queued in Financial Actions.');
          await loadDisputes();
        } catch (err: any) {
          alert('Resolution error: ' + err.message);
        }
      });
    });

    // Split milestone
    listContainer.querySelectorAll('.btn-disp-split').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const amountCents = Number(btn.getAttribute('data-amount'));

        const percentInput = window.prompt('Enter designer share percentage (0-100, remaining will be refunded to client):', '50');
        if (!percentInput) return;
        const percent = parseInt(percentInput, 10);
        if (isNaN(percent) || percent < 0 || percent > 100) {
          alert('Invalid percentage');
          return;
        }

        const designerAmt = formatUSD((amountCents * (percent / 100)) / 100);
        const clientAmt = formatUSD((amountCents * ((100 - percent) / 100)) / 100);

        const reason = await showReasonDialog({
          title: `Resolve Dispute: ${percent}% / ${100 - percent}% Milestone Split`,
          subtitle: `Designer receives ${designerAmt}; Client refunded ${clientAmt}.`,
          promptLabel: 'Arbitration Compromise Justification',
          placeholder: 'Detail agreed partial completion and mutual settlement terms...'
        });

        if (!reason) return;

        try {
          await adminResolveDispute(id, 'split', reason, percent);
          alert('Dispute resolved. Split payout and refund queued in Financial Actions.');
          await loadDisputes();
        } catch (err: any) {
          alert('Resolution error: ' + err.message);
        }
      });
    });
  }

  refreshBtn.addEventListener('click', () => loadDisputes());
  loadDisputes();
}
