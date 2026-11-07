/**
 * Proposal Detail Page for Client
 * Full proposal review with auto-mark viewed on mount,
 * milestone breakdown, assumptions, exclusions, reimbursable expenses,
 * designer clarifying question + client answer box (10-minute edit window),
 * and sticky actions: Accept dialog, Decline dialog, and Message designer modal.
 */

import { formatMoney } from '../../../utils/formatters';
import { renderMemberBadge } from '../../../utils/badges';
import {
  getProposal,
  markProposalViewed,
  answerProposalQuestion,
  shortlistProposal,
  declineProposal,
  acceptProposal,
  startConversationFromProposal,
  type DetailedProposal
} from '../../../services/clientProposalsService';
import { renderClientShell, initClientShell } from '../ClientLayout';

export async function renderProposalDetailPage(container: HTMLElement, proposalId: string): Promise<void> {
  container.innerHTML = renderClientShell(
    {
      activeTab: 'my-projects',
      pageTitle: 'Proposal Details'
    },
    `
    <div style="max-width: 1140px; margin: 0 auto; padding-bottom: 80px;">
      <div id="proposal-detail-mount">
        <div style="padding: 60px; text-align: center; color: #64748B; font-size: 13.5px;">Loading proposal details...</div>
      </div>
    </div>

    <!-- Accept Proposal Modal -->
    <div id="modal-accept-proposal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center;">
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; margin: 16px;">
        <h3 style="margin: 0 0 10px; font-size: 18px; font-weight: 600; color: #0F172A;">Accept Proposal & Award Project</h3>
        <div id="accept-summary-box" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.5; color: #334155;">
          <!-- Dynamically populated -->
        </div>

        <p style="font-size: 13px; color: #64748B; line-height: 1.5; margin: 0 0 16px;">
          Accepting declines all other proposals and awards the project to this designer. A contract will be prepared for you both to sign.
        </p>

        <label style="display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: #1E293B; margin-bottom: 24px; cursor: pointer;">
          <input type="checkbox" id="chk-confirm-accept" style="margin-top: 2px; accent-color: #2F7BE5;" />
          <span>I understand that accepting awards the project and prepares a formal architectural agreement for digital signature.</span>
        </label>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" id="btn-cancel-accept" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #475569; cursor: pointer;">
            Cancel
          </button>
          <button type="button" id="btn-confirm-accept" disabled style="height: 36px; padding: 0 20px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: not-allowed; opacity: 0.6;">
            Accept proposal
          </button>
        </div>
      </div>
    </div>

    <!-- Message Designer Modal -->
    <div id="modal-message-designer" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center;">
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 500px; padding: 24px; margin: 16px;">
        <h3 style="margin: 0 0 6px; font-size: 17px; font-weight: 600; color: #0F172A;">Message Designer</h3>
        <p style="margin: 0 0 16px; font-size: 13px; color: #64748B;">Send an opening message to discuss proposal details.</p>

        <div style="margin-bottom: 14px;">
          <label style="display: block; font-size: 12px; font-weight: 500; color: #64748B; margin-bottom: 6px;">Suggested openers</label>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <button type="button" class="btn-opener" style="text-align: left; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; font-size: 12.5px; color: #334155; cursor: pointer;">
              "Could we review the milestone deliverables schedule?"
            </button>
            <button type="button" class="btn-opener" style="text-align: left; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; font-size: 12.5px; color: #334155; cursor: pointer;">
              "Are you available for a brief introductory call?"
            </button>
            <button type="button" class="btn-opener" style="text-align: left; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; font-size: 12.5px; color: #334155; cursor: pointer;">
              "Can you clarify the assumptions regarding site boundary surveys?"
            </button>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label for="textarea-msg-body" style="display: block; font-size: 12.5px; font-weight: 500; color: #334155; margin-bottom: 6px;">Message</label>
          <textarea id="textarea-msg-body" rows="4" placeholder="Type your message here..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" id="btn-cancel-msg" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #475569; cursor: pointer;">
            Cancel
          </button>
          <button type="button" id="btn-send-msg" style="height: 36px; padding: 0 18px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">
            Send message
          </button>
        </div>
      </div>
    </div>
    `
  );

  initClientShell(container);

  const mount = document.getElementById('proposal-detail-mount');
  if (!mount) return;

  try {
    const proposal = await getProposal(proposalId);

    // Auto mark viewed once on open
    if (proposal.is_unviewed) {
      markProposalViewed(proposalId);
    }

    renderContent(mount, proposal);
    attachEventListeners(proposal);
  } catch (err: any) {
    mount.innerHTML = `
      <div style="border: 1px solid #FCA5A5; border-radius: 8px; background: #FEF2F2; padding: 24px; text-align: center;">
        <p style="font-size: 13.5px; color: #991B1B; margin: 0 0 10px;">Failed to load proposal: ${err?.message || 'Error'}</p>
        <a href="#projects" style="color: #DC2626; font-size: 13px; font-weight: 600;">Back to My Projects</a>
      </div>
    `;
  }
}

function renderContent(mount: HTMLElement, p: DetailedProposal): void {
  const diffText = p.price_diff_percent < 0
    ? `${Math.abs(p.price_diff_percent)}% below budget`
    : p.price_diff_percent > 0
    ? `${p.price_diff_percent}% above budget`
    : 'Matches your design budget';

  mount.innerHTML = `
    <!-- Top Breadcrumb -->
    <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #64748B; margin-bottom: 20px;">
      <a href="#project-details?id=${p.project_id}&tab=proposals" style="color: #64748B; text-decoration: none;">&larr; Back to proposals</a>
      <span>/</span>
      <span style="color: #0F172A; font-weight: 500;">Proposal by ${escapeHtml(p.designer.full_name)}</span>
    </div>

    <!-- Two Column Grid -->
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 32px; align-items: start;">
      
      <!-- LEFT COLUMN: Proposal Content -->
      <div style="display: flex; flex-direction: column; gap: 24px;">
        
        <!-- Designer Profile Header Card -->
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <div style="display: flex; gap: 16px; align-items: flex-start;">
            <div style="width: 52px; height: 52px; border-radius: 8px; background: #E2E8F0; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; color: #475569; flex-shrink: 0;">
              ${p.designer.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0;">
                  ${(p.designer as any).plan_key === 'free'
                    ? `<span>${escapeHtml(p.designer.full_name)}</span>`
                    : `<a href="#designer-profile?id=${p.designer.id}" style="color: inherit; text-decoration: none;">${escapeHtml(p.designer.full_name)}</a>`
                  }
                </h2>
                ${(p.designer as any).plan_key !== 'free' ? renderMemberBadge() : ''}
              </div>
              <div style="font-size: 13px; color: #64748B; margin-top: 4px;">
                ${p.designer.title ? `${escapeHtml(p.designer.title)} • ` : ''}${escapeHtml(p.designer.studio_name || '')}
              </div>
              <div style="font-size: 12.5px; color: #94A3B8; margin-top: 4px;">
                ${escapeHtml([p.designer.city, p.designer.state_region].filter(Boolean).join(', '))} • ${p.designer.years_experience} years experience • ${p.designer.rating_average > 0 ? `★ ${p.designer.rating_average} (${p.designer.rating_count} reviews)` : 'Member'}
              </div>

              ${(p.designer as any).plan_key === 'free' ? `
                <div style="font-size: 12px; color: #64748B; margin-top: 6px; font-style: italic;">
                  Basic account: portfolio not available
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Cover Letter Card -->
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0 0 12px;">Cover Letter</h3>
          <div style="font-size: 13.5px; line-height: 1.7; color: #334155; white-space: pre-line;">
            ${escapeHtml(p.cover_letter)}
          </div>
        </div>

        <!-- Milestone Schedule Table Card -->
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0 0 14px;">Milestone Schedule & Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC; color: #64748B; font-size: 12px;">
                <th style="padding: 10px 12px;">Phase</th>
                <th style="padding: 10px 12px;">Deliverables</th>
                <th style="padding: 10px 12px;">Billing Trigger</th>
                <th style="padding: 10px 12px; width: 60px;">Share</th>
                <th style="padding: 10px 12px; width: 90px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${p.milestones.map((m) => `
                <tr style="border-bottom: 1px solid #E5E7EB;">
                  <td style="padding: 12px; font-weight: 500; color: #0F172A; vertical-align: top;">${escapeHtml(m.name)}</td>
                  <td style="padding: 12px; color: #475569; vertical-align: top;">
                    ${(m.deliverables || []).map((d) => `<div style="margin-bottom: 2px;">• ${escapeHtml(d)}</div>`).join('')}
                  </td>
                  <td style="padding: 12px; color: #64748B; font-size: 12px; vertical-align: top;">${escapeHtml(m.billing_trigger || 'Completion sign-off')}</td>
                  <td style="padding: 12px; color: #475569; font-variant-numeric: tabular-nums; vertical-align: top;">${m.fee_percent}%</td>
                  <td style="padding: 12px; font-weight: 600; color: #0F172A; font-variant-numeric: tabular-nums; text-align: right; vertical-align: top;">${formatMoney(m.amount)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: #F8FAFC; font-weight: 600; color: #0F172A;">
                <td style="padding: 12px;" colspan="3">Total Project Fee</td>
                <td style="padding: 12px;">100%</td>
                <td style="padding: 12px; text-align: right; font-size: 14px;">${formatMoney(p.total_price)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Scope Assumptions & Exclusions Card -->
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0 0 14px;">Scope Assumptions & Exclusions</h3>
          
          <div style="margin-bottom: 18px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Assumptions</label>
            ${(p.assumptions || []).length > 0 ? `
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${p.assumptions.map((a) => `
                  <span style="font-size: 12.5px; background: #F1F5F9; color: #334155; padding: 4px 10px; border-radius: 6px; border: 1px solid #E2E8F0;">
                    ${escapeHtml(a)}
                  </span>
                `).join('')}
              </div>
            ` : '<p style="font-size: 13px; color: #94A3B8; margin: 0;">No specific assumptions specified.</p>'}
          </div>

          <div>
            <label style="display: block; font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px;">Not Included (Exclusions)</label>
            <p style="font-size: 13px; color: #475569; margin: 0; line-height: 1.5;">
              ${p.exclusions ? escapeHtml(p.exclusions) : 'None specified.'}
            </p>
          </div>
        </div>

        <!-- Commercial Terms Card -->
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0 0 14px;">Commercial Terms</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
            <div style="padding: 12px; background: #F8FAFC; border-radius: 6px; border: 1px solid #E2E8F0;">
              <div style="font-size: 11.5px; color: #64748B; margin-bottom: 4px;">Reimbursable Expenses</div>
              <div style="font-weight: 500; color: #0F172A;">
                ${formatReimbursable(p.reimbursable_expenses_type, p.reimbursable_cap)}
              </div>
            </div>
            <div style="padding: 12px; background: #F8FAFC; border-radius: 6px; border: 1px solid #E2E8F0;">
              <div style="font-size: 11.5px; color: #64748B; margin-bottom: 4px;">Additional Services Hourly Rate</div>
              <div style="font-weight: 500; color: #0F172A; font-variant-numeric: tabular-nums;">
                ${p.additional_services_rate ? `${formatMoney(p.additional_services_rate)}/hour` : 'Standard rates apply'}
              </div>
            </div>
          </div>
        </div>

        <!-- Designer Question & Answer Card -->
        ${p.question_for_client ? `
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
            <h3 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">Question from Designer</h3>
            <p style="font-size: 13.5px; color: #1E293B; background: #F8FAFC; padding: 12px; border-radius: 6px; border: 1px solid #E2E8F0; margin: 0 0 14px; line-height: 1.5;">
              "${escapeHtml(p.question_for_client)}"
            </p>

            ${p.client_answer ? `
              <div>
                <label style="display: block; font-size: 12px; font-weight: 600; color: #166534; margin-bottom: 4px;">Your Answer:</label>
                <div style="font-size: 13px; color: #1E293B; background: #F0FDF4; border: 1px solid #BBF7D0; padding: 10px 12px; border-radius: 6px; line-height: 1.5;">
                  ${escapeHtml(p.client_answer)}
                </div>
              </div>
            ` : `
              <div>
                <label for="textarea-answer-question" style="display: block; font-size: 12.5px; font-weight: 500; color: #334155; margin-bottom: 6px;">Your Answer (editable for 10 minutes once submitted)</label>
                <textarea id="textarea-answer-question" rows="3" placeholder="Provide answer to clarify scope..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
                <button type="button" id="btn-submit-answer" style="margin-top: 10px; height: 32px; padding: 0 16px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">
                  Send answer
                </button>
              </div>
            `}
          </div>
        ` : ''}

        <!-- Proposal Status Timeline -->
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <h3 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0 0 14px;">Status History</h3>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${(p.timeline || []).filter(Boolean).map((t) => `
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">
                <span style="font-weight: 500; color: #334155;">${escapeHtml(t.event)}</span>
                <span style="color: #94A3B8; font-variant-numeric: tabular-nums;">${new Date(t.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

      <!-- RIGHT COLUMN: Sticky Offer Summary & Actions -->
      <div style="position: sticky; top: 24px; display: flex; flex-direction: column; gap: 16px;">
        
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px; background: #FFFFFF;">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #64748B; margin-bottom: 2px;">Total Design Fee</div>
            <div style="font-size: 26px; font-weight: 700; color: #0F172A; font-variant-numeric: tabular-nums;">
              ${formatMoney(p.total_price)}
            </div>
            <div style="font-size: 12px; color: #64748B; margin-top: 4px;">
              ${diffText}
            </div>
          </div>

          <div style="border-top: 1px solid #E5E7EB; padding-top: 14px; margin-bottom: 18px; display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Delivery timeline:</span>
              <span style="font-weight: 500; color: #0F172A;">${p.delivery_days} days</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Revisions:</span>
              <span style="font-weight: 500; color: #0F172A;">${p.included_revisions_per_phase} per phase</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Milestones:</span>
              <span style="font-weight: 500; color: #0F172A;">${p.milestones.length} phases</span>
            </div>
          </div>

          <!-- Actions Stack -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${p.status === 'accepted' ? `
              <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 12px; text-align: center; color: #166534; font-size: 13px; font-weight: 500;">
                ✓ Proposal Accepted
              </div>
              <a href="#project-details?id=${p.project_id}&tab=contract" style="height: 38px; display: flex; align-items: center; justify-content: center; background: #2F7BE5; color: #FFFFFF; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
                View Contract Agreement &rarr;
              </a>
            ` : p.status === 'declined' || p.status === 'withdrawn' ? `
              <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; text-align: center; color: #64748B; font-size: 13px;">
                Proposal is ${p.status}.
              </div>
            ` : `
              <button type="button" id="btn-open-accept-modal" style="width: 100%; height: 40px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13.5px; font-weight: 600; cursor: pointer;">
                Accept proposal
              </button>

              <button type="button" id="btn-open-message-modal" style="width: 100%; height: 38px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; font-weight: 500; color: #1E293B; cursor: pointer;">
                Message designer
              </button>

              <div style="display: flex; gap: 8px;">
                <button type="button" id="btn-side-shortlist" style="flex: 1; height: 34px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; color: #475569; cursor: pointer;">
                  Shortlist
                </button>
                <button type="button" id="btn-side-decline" style="flex: 1; height: 34px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; color: #DC2626; cursor: pointer;">
                  Decline
                </button>
              </div>
            `}
          </div>
        </div>

      </div>

    </div>
  `;
}

function attachEventListeners(p: DetailedProposal): void {
  // Modal references
  const acceptModal = document.getElementById('modal-accept-proposal');
  const acceptSummaryBox = document.getElementById('accept-summary-box');
  const chkConfirmAccept = document.getElementById('chk-confirm-accept') as HTMLInputElement;
  const btnCancelAccept = document.getElementById('btn-cancel-accept');
  const btnConfirmAccept = document.getElementById('btn-confirm-accept') as HTMLButtonElement;

  const msgModal = document.getElementById('modal-message-designer');
  const textareaMsg = document.getElementById('textarea-msg-body') as HTMLTextAreaElement;
  const btnCancelMsg = document.getElementById('btn-cancel-msg');
  const btnSendMsg = document.getElementById('btn-send-msg');

  // Submit Answer to Question
  document.getElementById('btn-submit-answer')?.addEventListener('click', async () => {
    const answerInput = document.getElementById('textarea-answer-question') as HTMLTextAreaElement;
    const answer = answerInput?.value.trim();
    if (!answer) {
      alert('Please enter an answer.');
      return;
    }

    try {
      await answerProposalQuestion(p.id, answer);
      alert('Answer submitted successfully.');
      window.location.reload();
    } catch (err: any) {
      alert(`Failed to submit answer: ${err?.message}`);
    }
  });

  // Open Accept Modal
  document.getElementById('btn-open-accept-modal')?.addEventListener('click', () => {
    if (!acceptModal || !acceptSummaryBox) return;
    acceptSummaryBox.innerHTML = `
      <div><strong>Designer:</strong> ${escapeHtml(p.designer.full_name)} (${escapeHtml(p.designer.studio_name || '')})</div>
      <div><strong>Total Fee:</strong> ${formatMoney(p.total_price)} (${p.milestones.length} milestone phases)</div>
      <div><strong>Delivery:</strong> ${p.delivery_days} calendar days</div>
    `;
    acceptModal.style.display = 'flex';
  });

  chkConfirmAccept?.addEventListener('change', () => {
    if (btnConfirmAccept) {
      btnConfirmAccept.disabled = !chkConfirmAccept.checked;
      btnConfirmAccept.style.opacity = chkConfirmAccept.checked ? '1' : '0.6';
      btnConfirmAccept.style.cursor = chkConfirmAccept.checked ? 'pointer' : 'not-allowed';
    }
  });

  btnCancelAccept?.addEventListener('click', () => {
    if (acceptModal) acceptModal.style.display = 'none';
  });

  btnConfirmAccept?.addEventListener('click', async () => {
    try {
      btnConfirmAccept.disabled = true;
      btnConfirmAccept.textContent = 'Preparing agreement...';
      await acceptProposal(p.id);
      if (acceptModal) acceptModal.style.display = 'none';
      // Navigate to project's contract tab
      window.location.hash = `#project-details?id=${p.project_id}&tab=contract`;
    } catch (err: any) {
      alert(`Failed to accept proposal: ${err?.message}`);
      btnConfirmAccept.disabled = false;
      btnConfirmAccept.textContent = 'Accept proposal';
    }
  });

  // Open Message Modal
  document.getElementById('btn-open-message-modal')?.addEventListener('click', () => {
    if (msgModal) msgModal.style.display = 'flex';
  });

  document.querySelectorAll('.btn-opener').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const text = (e.currentTarget as HTMLElement).textContent?.trim().replace(/^"|"$/g, '');
      if (textareaMsg && text) {
        textareaMsg.value = text;
      }
    });
  });

  btnCancelMsg?.addEventListener('click', () => {
    if (msgModal) msgModal.style.display = 'none';
  });

  btnSendMsg?.addEventListener('click', async () => {
    const text = textareaMsg?.value.trim();
    if (!text) {
      alert('Please enter a message.');
      return;
    }

    try {
      await startConversationFromProposal(p.project_id, p.designer_id, text);
      if (msgModal) msgModal.style.display = 'none';
      window.location.hash = '#conversations';
    } catch (err: any) {
      alert(`Could not start conversation: ${err?.message}`);
    }
  });

  // Shortlist
  document.getElementById('btn-side-shortlist')?.addEventListener('click', async () => {
    try {
      await shortlistProposal(p.id);
      alert('Proposal added to shortlist.');
      window.location.reload();
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    }
  });

  // Decline
  document.getElementById('btn-side-decline')?.addEventListener('click', async () => {
    if (confirm('Decline this proposal?')) {
      try {
        await declineProposal(p.id, 'other');
        window.location.hash = `#project-details?id=${p.project_id}&tab=proposals`;
      } catch (err: any) {
        alert(`Error: ${err?.message}`);
      }
    }
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
