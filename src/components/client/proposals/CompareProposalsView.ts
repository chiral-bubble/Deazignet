/**
 * Compare Proposals View for Client
 * Side-by-side comparison matrix of 2 to 3 proposals.
 * Highlights variances with a plain "Differs" text marker (never decorative color blocks).
 * Responsive with sticky first column and clean actions.
 */

import {
  compareProposals,
  shortlistProposal,
  declineProposal,
  type DetailedProposal
} from '../../../services/clientProposalsService';
import { renderClientShell, initClientShell } from '../ClientLayout';
import { formatMoney } from '../../../utils/formatters';
import { renderMemberBadge } from '../../../utils/badges';

export async function renderCompareProposalsView(container: HTMLElement, projectId: string, proposalIds: string[]): Promise<void> {
  container.innerHTML = renderClientShell(
    {
      activeTab: 'my-projects',
      pageTitle: 'Compare Proposals'
    },
    `
    <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 60px;">
      <!-- Breadcrumb Navigation -->
      <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; margin-bottom: 16px;">
        <a href="#project-details?id=${projectId}" style="color: #64748B; text-decoration: none;">&larr; Back to project</a>
        <span>/</span>
        <span style="color: #0F172A; font-weight: 500;">Compare Proposals</span>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px;">
        <div>
          <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Compare Proposals
          </h1>
          <p style="font-size: 13.5px; color: #64748B; margin: 0;">
            Review key commercial and scope differences across selected proposals side-by-side.
          </p>
        </div>
      </div>

      <div id="compare-matrix-mount">
        <div style="padding: 60px; text-align: center; color: #64748B; font-size: 13.5px;">Loading comparison matrix...</div>
      </div>
    </div>
    `
  );

  initClientShell(container);

  const mount = document.getElementById('compare-matrix-mount');
  if (!mount) return;

  try {
    const proposals = await compareProposals(projectId, proposalIds);
    if (proposals.length < 2) {
      mount.innerHTML = `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; padding: 40px; text-align: center;">
          <p style="font-size: 14px; color: #1E293B; margin-bottom: 8px;">Please select at least 2 proposals to compare.</p>
          <a href="#project-details?id=${projectId}&tab=proposals" style="color: #2F7BE5; font-size: 13px; text-decoration: none; font-weight: 500;">Return to proposals list</a>
        </div>
      `;
      return;
    }

    renderMatrix(mount, projectId, proposals);
  } catch (err: any) {
    mount.innerHTML = `
      <div style="border: 1px solid #FCA5A5; border-radius: 8px; background: #FEF2F2; padding: 24px; text-align: center;">
        <p style="font-size: 13.5px; color: #991B1B; margin: 0 0 10px;">Failed to load comparison: ${err?.message || 'Error'}</p>
        <a href="#project-details?id=${projectId}&tab=proposals" style="color: #DC2626; font-size: 13px; font-weight: 600;">Back to proposals</a>
      </div>
    `;
  }
}

function renderMatrix(mount: HTMLElement, projectId: string, proposals: DetailedProposal[]): void {
  // Check which attributes differ across proposals
  const pricesDiffer = new Set(proposals.map((p) => p.total_price)).size > 1;
  const deliveryDiffers = new Set(proposals.map((p) => p.delivery_days)).size > 1;
  const revisionsDiffer = new Set(proposals.map((p) => p.included_revisions_per_phase)).size > 1;
  const reimbursablesDiffer = new Set(proposals.map((p) => `${p.reimbursable_expenses_type}_${p.reimbursable_cap}`)).size > 1;
  const addRateDiffers = new Set(proposals.map((p) => p.additional_services_rate)).size > 1;

  mount.innerHTML = `
    <div class="compare-matrix-table-wrap client-table-scroll-wrap" style="border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; overflow-x: auto; width: 100%;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; min-width: 760px;">
        <!-- Header: Designer Columns -->
        <thead>
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC;">
            <th style="padding: 16px; width: 220px; font-weight: 600; color: #475569; position: sticky; left: 0; background: #F8FAFC; z-index: 2;">
              Comparison Attribute
            </th>
            ${proposals.map((p) => `
              <th style="padding: 16px; width: ${Math.floor(100 / (proposals.length + 1))}%; vertical-align: top;">
                <div style="display: flex; gap: 10px; align-items: flex-start;">
                  <div style="width: 36px; height: 36px; border-radius: 6px; background: #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; color: #475569; flex-shrink: 0;">
                    ${p.designer.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-size: 14px; font-weight: 600; color: #0F172A;">
                      <a href="#designer-profile?id=${p.designer.id}" style="color: inherit; text-decoration: none;">${escapeHtml(p.designer.full_name)}</a>
                    </div>
                    <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
                      ${escapeHtml(p.designer.title || '')} • ${escapeHtml(p.designer.studio_name || '')}
                    </div>
                    <div style="font-size: 11.5px; color: #94A3B8; margin-top: 3px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                      <span>${escapeHtml([p.designer.city, p.designer.state_region].filter(Boolean).join(', '))}</span>
                      <span>•</span>
                      <span>${p.designer.years_experience} yrs exp</span>
                      ${(p.designer as any).plan_key !== 'free' ? renderMemberBadge() : ''}
                    </div>
                  </div>
                </div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          <!-- Total Price Row -->
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #FFFFFF;">
              Total Price
              ${pricesDiffer ? `<span style="font-size: 11px; color: #B45309; margin-left: 6px; font-weight: 500;">(Differs)</span>` : ''}
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; font-variant-numeric: tabular-nums;">
                <div style="font-size: 15px; font-weight: 600; color: #0F172A;">${formatMoney(p.total_price)}</div>
                <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
                  ${p.price_diff_percent < 0 ? `${Math.abs(p.price_diff_percent)}% below budget` : p.price_diff_percent > 0 ? `${p.price_diff_percent}% above budget` : 'Matches budget'}
                </div>
              </td>
            `).join('')}
          </tr>

          <!-- Delivery Timeline Row -->
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #F8FAFC;">
              Delivery Timeline
              ${deliveryDiffers ? `<span style="font-size: 11px; color: #B45309; margin-left: 6px; font-weight: 500;">(Differs)</span>` : ''}
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; font-variant-numeric: tabular-nums; font-weight: 500; color: #1E293B;">
                ${p.delivery_days} calendar days
              </td>
            `).join('')}
          </tr>

          <!-- Included Revisions Row -->
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #FFFFFF;">
              Included Revisions
              ${revisionsDiffer ? `<span style="font-size: 11px; color: #B45309; margin-left: 6px; font-weight: 500;">(Differs)</span>` : ''}
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; color: #1E293B;">
                ${p.included_revisions_per_phase} revisions per phase
              </td>
            `).join('')}
          </tr>

          <!-- Reimbursable Expenses Row -->
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #F8FAFC;">
              Reimbursables
              ${reimbursablesDiffer ? `<span style="font-size: 11px; color: #B45309; margin-left: 6px; font-weight: 500;">(Differs)</span>` : ''}
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; color: #1E293B;">
                ${formatReimbursable(p.reimbursable_expenses_type, p.reimbursable_cap)}
              </td>
            `).join('')}
          </tr>

          <!-- Additional Services Rate Row -->
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #FFFFFF;">
              Additional Services
              ${addRateDiffers ? `<span style="font-size: 11px; color: #B45309; margin-left: 6px; font-weight: 500;">(Differs)</span>` : ''}
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; font-variant-numeric: tabular-nums; color: #1E293B;">
                ${p.additional_services_rate ? `${formatMoney(p.additional_services_rate)}/hr` : 'Standard rates'}
              </td>
            `).join('')}
          </tr>

          <!-- Milestone Breakdown Row -->
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #F8FAFC; vertical-align: top;">
              Milestone Breakdown
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; vertical-align: top;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${p.milestones.map((m) => `
                    <div style="font-size: 12px; display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 4px;">
                      <span style="color: #475569;">${escapeHtml(m.name)} (${m.fee_percent}%)</span>
                      <span style="font-weight: 500; font-variant-numeric: tabular-nums; color: #0F172A;">${formatMoney(m.amount)}</span>
                    </div>
                  `).join('')}
                </div>
              </td>
            `).join('')}
          </tr>

          <!-- Scope Assumptions Row -->
          <tr style="border-bottom: 1px solid #E5E7EB;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #FFFFFF; vertical-align: top;">
              Scope Assumptions
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; vertical-align: top; font-size: 12.5px; color: #475569; line-height: 1.5;">
                ${(p.assumptions || []).length > 0 ? `
                  <ul style="margin: 0; padding-left: 18px;">
                    ${p.assumptions.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
                  </ul>
                ` : 'None specified'}
              </td>
            `).join('')}
          </tr>

          <!-- Exclusions Row -->
          <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC;">
            <td style="padding: 14px 16px; font-weight: 500; color: #334155; position: sticky; left: 0; background: #F8FAFC; vertical-align: top;">
              Exclusions
            </td>
            ${proposals.map((p) => `
              <td style="padding: 14px 16px; vertical-align: top; font-size: 12.5px; color: #475569; line-height: 1.5;">
                ${p.exclusions ? escapeHtml(p.exclusions) : 'None specified'}
              </td>
            `).join('')}
          </tr>

          <!-- Action Buttons Row -->
          <tr>
            <td style="padding: 16px; font-weight: 600; color: #475569; position: sticky; left: 0; background: #FFFFFF;">
              Actions
            </td>
            ${proposals.map((p) => `
              <td style="padding: 16px;">
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <a href="#proposal-detail?id=${p.id}" style="height: 32px; padding: 0 14px; background: #2F7BE5; color: #FFFFFF; border-radius: 6px; font-size: 12.5px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center;">
                    View proposal
                  </a>
                  ${p.status === 'pending' || p.status === 'viewed' ? `
                    <button type="button" class="btn-compare-shortlist" data-id="${p.id}" style="height: 32px; padding: 0 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; color: #2F7BE5; cursor: pointer;">
                      Shortlist
                    </button>
                    <button type="button" class="btn-compare-decline" data-id="${p.id}" style="height: 32px; padding: 0 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; color: #DC2626; cursor: pointer;">
                      Decline
                    </button>
                  ` : ''}
                </div>
              </td>
            `).join('')}
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Attach button actions
  document.querySelectorAll('.btn-compare-shortlist').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      try {
        await shortlistProposal(id);
        alert('Proposal shortlisted.');
      } catch (err: any) {
        alert(`Failed: ${err?.message}`);
      }
    });
  });

  document.querySelectorAll('.btn-compare-decline').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      if (confirm('Are you sure you want to decline this proposal?')) {
        try {
          await declineProposal(id, 'chose_another_designer');
          alert('Proposal declined.');
          window.location.hash = `#project-details?id=${projectId}&tab=proposals`;
        } catch (err: any) {
          alert(`Failed: ${err?.message}`);
        }
      }
    });
  });
}

function formatReimbursable(type: string, cap: number | null): string {
  switch (type) {
    case 'none':
      return 'Not charged (all inclusive)';
    case 'at_cost':
      return 'Charged at cost with receipts';
    case 'capped':
      return `Charged at cost (capped at ${formatMoney(cap || 0)})`;
    default:
      return 'Standard terms';
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
