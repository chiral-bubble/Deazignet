/**
 * Client Payments Page
 * Honest, clear status page for Client Milestone Funding & Escrow:
 * - Plain bordered notice: "Payments are being set up. You will be able to fund milestones and see your payment history here."
 * - "How payments will work" (4 plain lines with escrow terms from settings)
 * - "Milestones awaiting funding" table from real engagements with disabled "Available soon" button.
 * - In development mode: "Dev: fund milestone" button calling dev_fund_milestone RPC.
 * - ZERO mentions of internal Phase roadmaps or emoji icons.
 */

import { getClientAwaitingMilestones, devFundMilestone, type ClientAwaitingMilestone } from '../../services/projectsService';
import { renderClientShell, initClientShell } from './ClientLayout';
import { formatMoney } from '../../utils/formatters';

export async function renderClientPaymentsPage(container: HTMLElement): Promise<void> {
  container.innerHTML = renderClientShell(
    {
      activeTab: 'payments',
      pageTitle: 'Payments'
    },
    `
      <div id="payments-loading" style="padding: 40px; text-align: center; color: #6B7280; font-size: 13px;">
        Loading payment details...
      </div>
    `
  );

  initClientShell(container);

  const mainArea = container.querySelector('main div');
  if (!mainArea) return;

  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  let milestones: ClientAwaitingMilestone[] = [];

  try {
    milestones = await getClientAwaitingMilestones();
  } catch (e) {
    console.warn('Could not load awaiting milestones:', e);
  }

  function render(): void {
    mainArea!.innerHTML = `
      <div style="max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px;">
        <!-- Header -->
        <div>
          <h1 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 6px;">
            Payments
          </h1>
          <p style="font-size: 13.5px; color: #6B7280; margin: 0;">
            Track milestone escrow deposits, approvals, and transaction history.
          </p>
        </div>

        <!-- Plain Bordered Notice (Light, flat, no glass, no shadows) -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px;">
          <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 6px;">
            Payments are being set up
          </div>
          <p style="font-size: 13px; color: #4B5563; line-height: 1.5; margin: 0;">
            Payments are being set up. You will be able to fund milestones and see your payment history here.
          </p>
        </div>

        <!-- How Payments Will Work -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px;">
          <h2 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 14px;">
            How payments will work
          </h2>
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; color: #374151; line-height: 1.5;">
            <div style="display: flex; gap: 10px; align-items: baseline;">
              <span style="font-weight: 600; color: #2F7BE5; font-size: 12px;">1.</span>
              <span>You fund each milestone before design work on it starts.</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: baseline;">
              <span style="font-weight: 600; color: #2F7BE5; font-size: 12px;">2.</span>
              <span>Funds are held in secure escrow while the designer completes deliverables.</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: baseline;">
              <span style="font-weight: 600; color: #2F7BE5; font-size: 12px;">3.</span>
              <span>Funds are released after you approve the work, following a 5-day security clearance period.</span>
            </div>
            <div style="display: flex; gap: 10px; align-items: baseline;">
              <span style="font-weight: 600; color: #2F7BE5; font-size: 12px;">4.</span>
              <span>Deliverables you don't review within 14 days are approved automatically to ensure prompt designer compensation.</span>
            </div>
          </div>
        </div>

        <!-- Milestones Awaiting Funding -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px;">
            <h2 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">
              Milestones awaiting funding
            </h2>
            <span style="font-size: 12px; color: #6B7280;">
              ${milestones.length} awaiting deposit
            </span>
          </div>

          ${milestones.length > 0 ? `
            <div class="client-table-scroll-wrap">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; min-width: 580px;">
                <thead style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB;">
                  <tr>
                    <th style="padding: 10px 14px; font-weight: 600; color: #4B5563;">Project</th>
                    <th style="padding: 10px 14px; font-weight: 600; color: #4B5563;">Milestone</th>
                    <th style="padding: 10px 14px; font-weight: 600; color: #4B5563;">Amount</th>
                    <th style="padding: 10px 14px; font-weight: 600; color: #4B5563;">Status</th>
                    <th style="padding: 10px 14px; text-align: right; font-weight: 600; color: #4B5563;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${milestones.map((m) => `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                      <td style="padding: 12px 14px; font-weight: 500; color: #111827;">${escapeHtml(m.projectTitle)}</td>
                      <td style="padding: 12px 14px; color: #4B5563;">${escapeHtml(m.milestoneTitle)}</td>
                      <td style="padding: 12px 14px; font-variant-numeric: tabular-nums; font-weight: 600; color: #111827;">${formatMoney(m.amount)}</td>
                      <td style="padding: 12px 14px;">
                        <span style="font-size: 11.5px; padding: 2px 8px; border-radius: 4px; background: #FEF3C7; color: #92400E; font-weight: 500;">
                          Pending Escrow
                        </span>
                      </td>
                      <td style="padding: 12px 14px; text-align: right;">
                        <div style="display: inline-flex; gap: 6px; align-items: center;">
                          <button
                            type="button"
                            disabled
                            style="background: #F3F4F6; color: #9CA3AF; border: 1px solid #E5E7EB; font-size: 12px; font-weight: 500; padding: 5px 12px; border-radius: 4px; cursor: not-allowed;"
                          >
                            Available soon
                          </button>
                          ${isDev ? `
                            <button
                              type="button"
                              class="btn-dev-fund"
                              data-id="${m.id}"
                              title="Development testing helper"
                              style="background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; font-size: 11px; font-weight: 600; padding: 5px 8px; border-radius: 4px; cursor: pointer;"
                            >
                              Dev: fund milestone
                            </button>
                          ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding: 32px 16px; text-align: center; border: 1px dashed #E5E7EB; border-radius: 6px;">
              <p style="font-size: 13.5px; font-weight: 500; color: #111827; margin: 0 0 4px;">No milestones awaiting funding</p>
              <p style="font-size: 12.5px; color: #6B7280; margin: 0;">When a proposal is accepted into an active project engagement, upcoming milestones will appear here for escrow deposit.</p>
            </div>
          `}
        </div>
      </div>
    `;

    // Bind dev fund buttons if in development
    if (isDev) {
      document.querySelectorAll('.btn-dev-fund').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const mId = (btn as HTMLElement).dataset.id;
          if (!mId) return;

          try {
            await devFundMilestone(mId);
            alert('Milestone funded via dev bypass.');
            renderClientPaymentsPage(container);
          } catch (err: any) {
            alert(`Dev fund failed: ${err.message}`);
          }
        });
      });
    }
  }

  render();
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

