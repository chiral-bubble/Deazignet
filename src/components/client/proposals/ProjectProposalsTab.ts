/**
 * Proposals Tab for Client Project Details Page
 * Lists submitted proposals with filters (Status, Search), sorting,
 * unviewed markers, price vs budget delta, and multi-select for side-by-side comparison (2-3).
 * Design: Light, flat, 1px #E5E7EB borders, 8px radius, no box shadows, AA contrast.
 */

import { formatMoney } from '../../../utils/formatters';
import {
  getProjectProposals,
  shortlistProposal,
  declineProposal,
  type ProposalListItem
} from '../../../services/clientProposalsService';
import type { DeclineReasonCode } from '../../../types/database.types';
import {
  suggestDesigners,
  inviteDesigner,
  withdrawInvitation,
  getProjectInvitations,
  type ProjectInvitation
} from '../../../services/invitationsService';

export function renderProjectProposalsTab(projectId?: string, _designBudget?: number): string {
  const pId = projectId || '';

  return `
    <div id="proposals-tab-container" style="max-width: 1120px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px;">
      
      <!-- 1. Invitations Section -->
      <section id="project-invitations-section" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px 0;">
              Project Invitations
            </h2>
            <p style="font-size: 12.5px; color: #6B7280; margin: 0;">
              Designers you have invited to submit a proposal for this project.
            </p>
          </div>
          <span id="invitations-count-badge" style="font-size: 11.5px; font-weight: 600; background: #F7F7F8; color: #4B5563; padding: 3px 8px; border: 1px solid #E5E7EB; border-radius: 12px;">
            0 invitations
          </span>
        </div>

        <div id="project-invitations-mount">
          <div style="padding: 24px; text-align: center; color: #6B7280; font-size: 13px;">
            Loading project invitations...
          </div>
        </div>
      </section>

      <!-- 2. Suggested Designers Section -->
      <section id="project-suggested-section" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 22px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px 0;">
              Suggested Designers
            </h2>
            <p style="font-size: 12.5px; color: #6B7280; margin: 0;">
              Matched based on project category, discipline, location, and verified professional licensing.
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 12px;">
            <button type="button" id="btn-refresh-suggested" style="height: 32px; padding: 0 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; font-weight: 500; color: #374151; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
              <span>&#x21bb;</span> Refresh suggestions
            </button>
            <a href="#find-designers?project=${encodeURIComponent(pId)}" style="font-size: 13px; font-weight: 600; color: #2F7BE5; text-decoration: none;">
              See more in directory &rarr;
            </a>
          </div>
        </div>

        <!-- Suggested Grid -->
        <div id="project-suggested-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 14px;">
          ${Array(3).fill(0).map(() => `
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; height: 160px;"></div>
          `).join('')}
        </div>
      </section>

      <!-- 3. Submitted Proposals Section -->
      <section id="project-proposals-section">
        <div style="margin-bottom: 12px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px 0;">
            Submitted Proposals
          </h2>
          <p style="font-size: 12.5px; color: #6B7280; margin: 0;">
            Compare candidate bids, delivery timelines, and milestone schedules.
          </p>
        </div>

        <!-- Controls Toolbar -->
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 16px; padding: 14px 18px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px;">
          <div style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center; flex: 1;">
            <!-- Search input -->
            <div style="position: relative; min-width: 240px;">
              <input
                type="text"
                id="input-proposals-search"
                placeholder="Search by designer or studio..."
                style="width: 100%; height: 36px; padding: 0 12px 0 32px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; color: #1E293B; background: #FFFFFF;"
              />
              <svg style="position: absolute; left: 10px; top: 10px; color: #94A3B8;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>

            <!-- Status filter -->
            <select id="select-proposals-status" style="height: 36px; padding: 0 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; color: #1E293B; background: #FFFFFF; cursor: pointer;">
              <option value="all">All statuses</option>
              <option value="new">New (Unviewed)</option>
              <option value="viewed">Viewed</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="declined">Declined</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          <!-- Sort dropdown -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="select-proposals-sort" style="font-size: 12.5px; color: #64748B;">Sort by:</label>
            <select id="select-proposals-sort" style="height: 36px; padding: 0 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; color: #1E293B; background: #FFFFFF; cursor: pointer;">
              <option value="newest">Newest first</option>
              <option value="lowest_price">Lowest price</option>
              <option value="fastest_delivery">Fastest delivery</option>
            </select>
          </div>
        </div>

        <!-- Proposals Table / Card Container -->
        <div id="proposals-list-mount">
          <div style="padding: 40px; text-align: center; color: #64748B; font-size: 13px;">Loading proposals...</div>
        </div>
      </section>

      <!-- Sticky Compare Bar -->
      <div id="sticky-compare-bar" style="display: none; position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #0F172A; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; z-index: 100; align-items: center; gap: 16px;">
        <span id="compare-selection-count" style="font-size: 13.5px; font-weight: 500;">2 proposals selected</span>
        <button type="button" id="btn-trigger-compare" style="height: 34px; padding: 0 18px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
          Compare proposals
        </button>
        <button type="button" id="btn-clear-compare" style="background: none; border: none; color: #94A3B8; font-size: 12.5px; cursor: pointer; text-decoration: underline;">
          Clear
        </button>
      </div>

      <!-- Invite Modal for Suggested Designers -->
      <div id="modal-tab-invite" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 220; align-items: center; justify-content: center;">
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; margin: 16px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Invite to Project</h3>
            <button type="button" id="btn-close-tab-invite-modal" style="background: none; border: none; font-size: 20px; color: #6B7280; cursor: pointer; line-height: 1;">&times;</button>
          </div>
          
          <p style="font-size: 13px; color: #4B5563; margin: 0 0 16px 0;">
            Invite <strong id="modal-tab-invite-designer-name"></strong> to submit a proposal for this project.
          </p>

          <form id="form-tab-invite">
            <input type="hidden" id="modal-tab-invite-designer-id" value="" />
            
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12.5px; font-weight: 600; color: #374151;">Message (Optional)</label>
                <span id="tab-invite-char-count" style="font-size: 11.5px; color: #9CA3AF;">0 / 500</span>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                <button type="button" class="btn-tab-quick-starter" data-text="We love your architectural portfolio and would appreciate your proposal for our project." style="text-align: left; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; color: #4B5563; cursor: pointer;">
                  "We love your architectural portfolio and would appreciate your proposal..."
                </button>
                <button type="button" class="btn-tab-quick-starter" data-text="Our project matches your exact design specialization. Please take a look at the scope." style="text-align: left; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; color: #4B5563; cursor: pointer;">
                  "Our project matches your exact design specialization..."
                </button>
              </div>

              <textarea id="modal-tab-invite-note" maxlength="500" rows="3" placeholder="Add an optional personal note..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" id="btn-cancel-tab-invite-modal" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #4B5563; cursor: pointer;">Cancel</button>
              <button type="submit" id="btn-submit-tab-invite" style="height: 36px; padding: 0 18px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">Send Invitation</button>
            </div>
          </form>
        </div>
      </div>

      <!-- Decline Dialog Modal -->
      <div id="modal-decline-proposal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; align-items: center; justify-content: center;">
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 440px; padding: 24px; margin: 16px;">
          <h3 style="margin: 0 0 8px; font-size: 17px; font-weight: 600; color: #0F172A;">Decline Proposal</h3>
          <p style="margin: 0 0 18px; font-size: 13px; color: #64748B; line-height: 1.5;">
            Please select a reason for declining this proposal. The designer will receive a respectful notification.
          </p>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-size: 12.5px; font-weight: 500; color: #334155; margin-bottom: 6px;">Reason</label>
            <select id="select-decline-reason" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; color: #1E293B;">
              <option value="price_too_high">Price is higher than budget</option>
              <option value="timeline_too_long">Delivery timeline is too long</option>
              <option value="not_enough_experience">Looking for more specific typology experience</option>
              <option value="chose_another_designer">Selected another designer</option>
              <option value="project_changed">Project scope or requirements changed</option>
              <option value="other">Other reason</option>
            </select>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 12.5px; font-weight: 500; color: #334155; margin-bottom: 6px;">Optional note for designer</label>
            <textarea id="textarea-decline-note" rows="3" placeholder="Thank you for your proposal..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" id="btn-cancel-decline" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #475569; cursor: pointer;">
              Cancel
            </button>
            <button type="button" id="btn-confirm-decline" style="height: 36px; padding: 0 18px; border: none; border-radius: 6px; background: #DC2626; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">
              Decline proposal
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
}

export function initProjectProposalsTab(
  projectId: string,
  _designBudget?: number,
  _onAcceptSuccess?: (engagementId: string) => void
): void {
  const mount = document.getElementById('proposals-list-mount');
  const searchInput = document.getElementById('input-proposals-search') as HTMLInputElement;
  const statusSelect = document.getElementById('select-proposals-status') as HTMLSelectElement;
  const sortSelect = document.getElementById('select-proposals-sort') as HTMLSelectElement;
  const stickyBar = document.getElementById('sticky-compare-bar');
  const selectionCountEl = document.getElementById('compare-selection-count');
  const triggerCompareBtn = document.getElementById('btn-trigger-compare');
  const clearCompareBtn = document.getElementById('btn-clear-compare');

  const declineModal = document.getElementById('modal-decline-proposal');
  const declineReasonSelect = document.getElementById('select-decline-reason') as HTMLSelectElement;
  const declineNoteArea = document.getElementById('textarea-decline-note') as HTMLTextAreaElement;
  const cancelDeclineBtn = document.getElementById('btn-cancel-decline');
  const confirmDeclineBtn = document.getElementById('btn-confirm-decline');

  // Invitations & Suggested DOM references
  const invitationsMount = document.getElementById('project-invitations-mount');
  const invitationsBadge = document.getElementById('invitations-count-badge');
  const suggestedGrid = document.getElementById('project-suggested-grid');
  const refreshSuggestedBtn = document.getElementById('btn-refresh-suggested');

  const tabInviteModal = document.getElementById('modal-tab-invite');
  const tabInviteNameEl = document.getElementById('modal-tab-invite-designer-name');
  const tabInviteIdInput = document.getElementById('modal-tab-invite-designer-id') as HTMLInputElement;
  const tabInviteNoteArea = document.getElementById('modal-tab-invite-note') as HTMLTextAreaElement;
  const tabInviteCharCount = document.getElementById('tab-invite-char-count');
  const closeTabInviteBtn = document.getElementById('btn-close-tab-invite-modal');
  const cancelTabInviteBtn = document.getElementById('btn-cancel-tab-invite-modal');
  const formTabInvite = document.getElementById('form-tab-invite') as HTMLFormElement;

  let selectedProposalIds: string[] = [];
  let pendingDeclineProposalId: string | null = null;
  let invitedDesignerIds = new Set<string>();

  // --------------------------------------------------------------------------
  // 1. Load & Render Invitations
  // --------------------------------------------------------------------------
  async function loadInvitations() {
    if (!invitationsMount) return;

    try {
      const invitations = await getProjectInvitations(projectId);
      invitedDesignerIds = new Set(
        invitations
          .filter(i => i.status !== 'withdrawn')
          .map(i => i.designer_id)
      );

      if (invitationsBadge) {
        invitationsBadge.textContent = `${invitations.length} ${invitations.length === 1 ? 'invitation' : 'invitations'}`;
      }

      if (invitations.length === 0) {
        invitationsMount.innerHTML = `
          <div style="padding: 24px 16px; text-align: center; color: #6B7280; font-size: 13px; background: #F7F7F8; border-radius: 6px;">
            <p style="margin: 0 0 6px 0; font-weight: 500; color: #374151;">No invitations sent yet</p>
            <p style="margin: 0;">Invite matching designers below to encourage them to submit an architectural proposal.</p>
          </div>
        `;
        return;
      }

      invitationsMount.innerHTML = `
        <div style="border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; background: #FFFFFF;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC; color: #64748B; font-size: 12px; font-weight: 500;">
                <th style="padding: 10px 14px;">Designer</th>
                <th style="padding: 10px 14px;">Status</th>
                <th style="padding: 10px 14px;">Sent Date</th>
                <th style="padding: 10px 14px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${invitations.map((inv) => renderInvitationRow(inv)).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Attach Withdraw event listeners
      invitationsMount.querySelectorAll<HTMLButtonElement>('.btn-withdraw-inv').forEach(btn => {
        btn.addEventListener('click', async () => {
          const invId = btn.getAttribute('data-id');
          if (!invId) return;

          if (!confirm('Are you sure you want to withdraw this invitation?')) return;

          btn.disabled = true;
          btn.textContent = 'Withdrawing...';

          try {
            await withdrawInvitation(invId);
            await loadInvitations();
            await loadSuggestions();
            await loadAndRender();
          } catch (err: any) {
            alert('Failed to withdraw invitation: ' + (err?.message || 'Server error'));
            btn.disabled = false;
            btn.textContent = 'Withdraw';
          }
        });
      });
    } catch {
      invitationsMount.innerHTML = `
        <div style="padding: 18px; text-align: center; color: #6B7280; font-size: 12.5px;">
          Could not load project invitations.
        </div>
      `;
    }
  }

  function renderInvitationRow(inv: ProjectInvitation): string {
    const designerName = inv.designer?.full_name || 'Design Professional';
    const initials = designerName.slice(0, 2).toUpperCase();

    let statusHtml = '';
    let canWithdraw = false;

    switch (inv.status) {
      case 'sent':
        statusHtml = `<span style="font-size: 11.5px; background: #F3F4F6; color: #374151; padding: 2px 8px; border: 1px solid #E5E7EB; border-radius: 4px; font-weight: 500;">Sent</span>`;
        canWithdraw = true;
        break;
      case 'viewed':
        statusHtml = `<span style="font-size: 11.5px; background: #EFF6FF; color: #1D4ED8; padding: 2px 8px; border: 1px solid #BFDBFE; border-radius: 4px; font-weight: 500;">Viewed</span>`;
        canWithdraw = true;
        break;
      case 'proposal_sent':
        statusHtml = `<span style="font-size: 11.5px; background: #ECFDF5; color: #047857; padding: 2px 8px; border: 1px solid #A7F3D0; border-radius: 4px; font-weight: 500;">Proposal submitted</span>`;
        break;
      case 'declined': {
        const reasonText = inv.decline_reason_code === 'not_available'
          ? 'Not available'
          : inv.decline_reason_code === 'budget_too_low'
          ? 'Budget too low'
          : inv.decline_reason_code === 'not_a_good_fit'
          ? 'Not a good fit'
          : 'Declined';
        statusHtml = `
          <div>
            <span style="font-size: 11.5px; background: #FEF2F2; color: #991B1B; padding: 2px 8px; border: 1px solid #FECACA; border-radius: 4px; font-weight: 500;">Declined</span>
            <div style="font-size: 11.5px; color: #6B7280; margin-top: 3px;">
              Reason: <strong>${escapeHtml(reasonText)}</strong>
              ${inv.decline_note ? `<span style="display: block; font-style: italic; color: #4B5563; margin-top: 2px;">"${escapeHtml(inv.decline_note)}"</span>` : ''}
            </div>
          </div>
        `;
        break;
      }
      case 'expired':
        statusHtml = `<span style="font-size: 11.5px; background: #F3F4F6; color: #6B7280; padding: 2px 8px; border: 1px solid #E5E7EB; border-radius: 4px; font-weight: 500;">Expired</span>`;
        break;
      case 'withdrawn':
        statusHtml = `<span style="font-size: 11.5px; background: #F3F4F6; color: #6B7280; padding: 2px 8px; border: 1px solid #E5E7EB; border-radius: 4px; font-weight: 500;">Withdrawn</span>`;
        break;
      default:
        statusHtml = `<span style="font-size: 11.5px; background: #F3F4F6; color: #4B5563; padding: 2px 8px; border-radius: 4px;">${escapeHtml(inv.status)}</span>`;
    }

    const sentDateFormatted = new Date(inv.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 12px 14px; vertical-align: top;">
          <div style="display: flex; gap: 10px; align-items: center;">
            <div style="width: 32px; height: 32px; border-radius: 4px; background: #F3F4F6; color: #374151; font-weight: 600; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${initials}
            </div>
            <div>
              <a href="#designer-profile?id=${inv.designer_id}" style="font-weight: 600; color: #111827; text-decoration: none;">
                ${escapeHtml(designerName)}
              </a>
              ${inv.message ? `<div style="font-size: 11.5px; color: #6B7280; margin-top: 2px; max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">"${escapeHtml(inv.message)}"</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 12px 14px; vertical-align: top;">
          ${statusHtml}
        </td>
        <td style="padding: 12px 14px; vertical-align: top; color: #6B7280; font-size: 12.5px;">
          ${sentDateFormatted}
        </td>
        <td style="padding: 12px 14px; vertical-align: top; text-align: right;">
          ${canWithdraw ? `
            <button type="button" class="btn-withdraw-inv" data-id="${inv.id}" style="height: 28px; padding: 0 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12px; font-weight: 500; color: #DC2626; cursor: pointer;">
              Withdraw
            </button>
          ` : (inv.status === 'proposal_sent' ? `
            <span style="font-size: 12px; color: #2F7BE5; font-weight: 500;">Proposal received</span>
          ` : `
            <span style="font-size: 12px; color: #9CA3AF;">&mdash;</span>
          `)}
        </td>
      </tr>
    `;
  }

  // --------------------------------------------------------------------------
  // 2. Load & Render Suggested Designers
  // --------------------------------------------------------------------------
  async function loadSuggestions() {
    if (!suggestedGrid) return;

    suggestedGrid.innerHTML = Array(3).fill(0).map(() => `
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; height: 160px;"></div>
    `).join('');

    try {
      const suggestions = await suggestDesigners(projectId, 6);
      if (suggestions.length === 0) {
        suggestedGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #6B7280; font-size: 13px;">
            No direct suggestions available. Browse the designer directory to discover more verified professionals.
          </div>
        `;
        return;
      }

      suggestedGrid.innerHTML = suggestions.map((s) => {
        const initials = (s.full_name || 'D').slice(0, 2).toUpperCase();
        const isInvited = invitedDesignerIds.has(s.designer_id);
        const credInfo = s.is_verified
          ? 'Verified credentials on file'
          : (s.credentials && s.credentials.length > 0 ? (s.credentials[0].title || 'Credentials on file') : 'Experienced professional');

        return `
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 8px;">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <div style="width: 34px; height: 34px; border-radius: 6px; background: #F3F4F6; color: #374151; font-weight: 600; font-size: 12.5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${initials}
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 13.5px; color: #111827; display: flex; align-items: center; gap: 4px;">
                      <span>${escapeHtml(s.full_name)}</span>
                      ${s.is_verified ? `<span style="font-size: 11px; color: #2F7BE5; font-weight: 600;">✓</span>` : ''}
                    </div>
                    <div style="font-size: 11.5px; color: #6B7280;">
                      ${escapeHtml(s.discipline || 'Architect')} &bull; ${escapeHtml([s.city, s.state].filter(Boolean).join(', '))}
                    </div>
                  </div>
                </div>

                <span style="font-size: 11px; font-weight: 600; background: #F7F7F8; color: #374151; border: 1px solid #E5E7EB; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">
                  ${s.match_score}%
                </span>
              </div>

              <!-- Credentials & Rating -->
              <div style="display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: ${s.is_verified ? '#047857' : '#4B5563'}; margin-bottom: 6px; font-weight: 500;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${escapeHtml(credInfo)}</span>
              </div>

              <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 10px;">
                ${s.years_experience} yrs exp &bull; ${s.rating_average > 0 ? `★ ${s.rating_average.toFixed(1)} (${s.rating_count})` : 'New talent'}
              </div>

              <!-- Match Reason -->
              <div style="font-size: 11.5px; color: #4B5563; background: #F7F7F8; padding: 6px 8px; border-radius: 4px; margin-bottom: 12px; line-height: 1.35;">
                ${s.reasons && s.reasons.length > 0 ? escapeHtml(s.reasons[0].text) : 'Matches project typology and location criteria'}
              </div>
            </div>

            <!-- Action -->
            ${isInvited ? `
              <button type="button" disabled style="width: 100%; height: 32px; background: #F3F4F6; color: #047857; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: default;">
                ✓ Invited
              </button>
            ` : `
              <button type="button" class="btn-open-suggested-invite" data-id="${s.designer_id}" data-name="${escapeHtml(s.full_name)}" style="width: 100%; height: 32px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
                Invite to project
              </button>
            `}
          </div>
        `;
      }).join('');

      // Bind Invite modal triggers on suggested cards
      suggestedGrid.querySelectorAll<HTMLButtonElement>('.btn-open-suggested-invite').forEach(b => {
        b.addEventListener('click', () => {
          const dId = b.getAttribute('data-id') || '';
          const dName = b.getAttribute('data-name') || '';
          if (tabInviteNameEl) tabInviteNameEl.textContent = dName;
          if (tabInviteIdInput) tabInviteIdInput.value = dId;
          if (tabInviteModal) tabInviteModal.style.display = 'flex';
        });
      });
    } catch {
      suggestedGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 18px; text-align: center; color: #6B7280; font-size: 12.5px;">
          Could not load suggested designers.
        </div>
      `;
    }
  }

  // Refresh suggested button
  refreshSuggestedBtn?.addEventListener('click', () => {
    loadSuggestions();
  });

  // --------------------------------------------------------------------------
  // Tab Invite Modal Handlers
  // --------------------------------------------------------------------------
  const closeTabModal = () => {
    if (tabInviteModal) tabInviteModal.style.display = 'none';
    if (tabInviteNoteArea) tabInviteNoteArea.value = '';
    if (tabInviteCharCount) tabInviteCharCount.textContent = '0 / 500';
  };

  closeTabInviteBtn?.addEventListener('click', closeTabModal);
  cancelTabInviteBtn?.addEventListener('click', closeTabModal);
  tabInviteModal?.addEventListener('click', (e) => {
    if (e.target === tabInviteModal) closeTabModal();
  });

  tabInviteNoteArea?.addEventListener('input', () => {
    if (tabInviteCharCount) tabInviteCharCount.textContent = `${tabInviteNoteArea.value.length} / 500`;
  });

  document.querySelectorAll<HTMLButtonElement>('.btn-tab-quick-starter').forEach(b => {
    b.addEventListener('click', () => {
      const text = b.getAttribute('data-text') || '';
      if (tabInviteNoteArea) {
        tabInviteNoteArea.value = text;
        if (tabInviteCharCount) tabInviteCharCount.textContent = `${text.length} / 500`;
      }
    });
  });

  formTabInvite?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dId = tabInviteIdInput?.value;
    const note = tabInviteNoteArea?.value.trim();
    const submitBtn = document.getElementById('btn-submit-tab-invite') as HTMLButtonElement;

    if (!dId) return;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      await inviteDesigner(projectId, dId, note);
      closeTabModal();
      await loadInvitations();
      await loadSuggestions();
      await loadAndRender();
    } catch (err: any) {
      alert('Failed to send invitation: ' + (err?.message || 'Server error'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Invitation';
      }
    }
  });

  // --------------------------------------------------------------------------
  // 3. Load & Render Proposals
  // --------------------------------------------------------------------------
  async function loadAndRender() {
    if (!mount) return;
    mount.innerHTML = `<div style="padding: 40px; text-align: center; color: #64748B; font-size: 13px;">Loading proposals...</div>`;

    try {
      const proposals = await getProjectProposals(
        projectId,
        {
          status: statusSelect?.value || 'all',
          search: searchInput?.value || ''
        },
        sortSelect?.value || 'newest'
      );

      if (proposals.length === 0) {
        mount.innerHTML = `
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; padding: 48px 24px; text-align: center;">
            <p style="font-size: 14px; font-weight: 500; color: #1E293B; margin: 0 0 6px;">No proposals found</p>
            <p style="font-size: 13px; color: #64748B; margin: 0;">Proposals will appear here as designers send them.</p>
          </div>
        `;
        return;
      }

      mount.innerHTML = `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC; color: #64748B; font-size: 12px; font-weight: 500;">
                <th style="padding: 12px 14px; width: 36px;"></th>
                <th style="padding: 12px 16px;">Designer</th>
                <th style="padding: 12px 16px;">Price & Budget</th>
                <th style="padding: 12px 16px;">Delivery</th>
                <th style="padding: 12px 16px;">Status</th>
                <th style="padding: 12px 16px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${proposals.map((p) => renderProposalRow(p)).join('')}
            </tbody>
          </table>
        </div>
      `;

      attachRowEventListeners();
    } catch (err: any) {
      mount.innerHTML = `
        <div style="border: 1px solid #FCA5A5; border-radius: 8px; background: #FEF2F2; padding: 24px; text-align: center;">
          <p style="font-size: 13.5px; color: #991B1B; margin: 0 0 10px;">Failed to load proposals: ${err?.message || 'Network error'}</p>
          <button type="button" id="btn-retry-proposals" style="height: 32px; padding: 0 16px; background: #FFFFFF; border: 1px solid #DC2626; color: #DC2626; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">
            Retry
          </button>
        </div>
      `;
      document.getElementById('btn-retry-proposals')?.addEventListener('click', loadAndRender);
    }
  }

  function renderProposalRow(p: ProposalListItem): string {
    const isSelected = selectedProposalIds.includes(p.id);
    const diffText = p.price_diff_percent < 0
      ? `${Math.abs(p.price_diff_percent)}% below budget`
      : p.price_diff_percent > 0
      ? `${p.price_diff_percent}% above budget`
      : `Matches budget`;

    const statusBadge = getStatusBadge(p.status);
    const isInvited = invitedDesignerIds.has(p.designer.id) || (p as any).is_invited;

    return `
      <tr style="border-bottom: 1px solid #E5E7EB; background: ${isSelected ? '#EFF6FF' : '#FFFFFF'}; transition: background 150ms ease;">
        <td style="padding: 14px 14px; vertical-align: top;">
          <input
            type="checkbox"
            class="chk-select-proposal"
            data-id="${p.id}"
            ${isSelected ? 'checked' : ''}
            ${p.status === 'declined' || p.status === 'withdrawn' ? 'disabled' : ''}
            style="accent-color: #2F7BE5; cursor: pointer;"
          />
        </td>
        <td style="padding: 14px 16px; vertical-align: top;">
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <div style="width: 38px; height: 38px; border-radius: 6px; background: #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 13px; color: #475569; flex-shrink: 0;">
              ${p.designer.full_name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <a href="#designer-profile?id=${p.designer.id}" style="font-weight: 600; color: #0F172A; text-decoration: none;">
                  ${escapeHtml(p.designer.full_name)}
                </a>
                ${isInvited ? `<span style="font-size: 11px; font-weight: 500; background: #F3F4F6; color: #4B5563; padding: 2px 7px; border: 1px solid #E5E7EB; border-radius: 4px;" title="Invited to this project">Invited</span>` : ''}
                ${p.designer.verified ? `<span style="font-size: 11px; color: #2F7BE5; font-weight: 600;" title="Verified Professional">✓ Verified</span>` : ''}
                ${p.is_unviewed ? `<span style="font-size: 11px; background: #EFF6FF; color: #2F7BE5; padding: 1px 6px; border-radius: 4px; font-weight: 600;">New</span>` : ''}
              </div>
              <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
                ${p.designer.title ? `${escapeHtml(p.designer.title)} • ` : ''}${escapeHtml(p.designer.studio_name || '')}
              </div>
              <div style="font-size: 12px; color: #94A3B8; margin-top: 4px;">
                ${escapeHtml(p.designer.city || '')} • ${p.designer.years_experience} yrs exp • ${p.designer.rating_average > 0 ? `★ ${p.designer.rating_average} (${p.designer.rating_count})` : 'New talent'}
              </div>
              <div style="font-size: 12.5px; color: #334155; margin-top: 8px; line-height: 1.4;">
                ${escapeHtml(p.cover_letter_preview)}...
              </div>
            </div>
          </div>
        </td>
        <td style="padding: 14px 16px; vertical-align: top; font-variant-numeric: tabular-nums;">
          <div style="font-size: 14px; font-weight: 600; color: #0F172A;">
            ${formatMoney(p.total_price)}
          </div>
          <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
            ${diffText}
          </div>
        </td>
        <td style="padding: 14px 16px; vertical-align: top; font-variant-numeric: tabular-nums;">
          <div style="font-size: 13px; font-weight: 500; color: #1E293B;">
            ${p.delivery_days} days
          </div>
          <div style="font-size: 11.5px; color: #64748B; margin-top: 2px;">
            ${p.included_revisions_per_phase} revisions/phase
          </div>
        </td>
        <td style="padding: 14px 16px; vertical-align: top;">
          ${statusBadge}
          <div style="font-size: 11px; color: #94A3B8; margin-top: 4px;">
            Sent ${new Date(p.sent_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </div>
        </td>
        <td style="padding: 14px 16px; vertical-align: top; text-align: right;">
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <a href="#proposal-detail?id=${p.id}" style="height: 30px; padding: 0 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12px; font-weight: 500; color: #1E293B; text-decoration: none; display: inline-flex; align-items: center;">
              View
            </a>
            ${p.status === 'pending' || p.status === 'viewed' ? `
              <button type="button" class="btn-shortlist-prop" data-id="${p.id}" style="height: 30px; padding: 0 10px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12px; color: #2F7BE5; cursor: pointer;">
                Shortlist
              </button>
              <button type="button" class="btn-open-decline" data-id="${p.id}" style="height: 30px; padding: 0 10px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12px; color: #DC2626; cursor: pointer;">
                Decline
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }

  function getStatusBadge(status: string): string {
    switch (status) {
      case 'accepted':
        return `<span style="font-size: 11.5px; background: #DCFCE7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Accepted</span>`;
      case 'declined':
        return `<span style="font-size: 11.5px; background: #FEE2E2; color: #991B1B; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Declined</span>`;
      case 'withdrawn':
        return `<span style="font-size: 11.5px; background: #F1F5F9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Withdrawn</span>`;
      case 'shortlisted':
        return `<span style="font-size: 11.5px; background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Shortlisted</span>`;
      default:
        return `<span style="font-size: 11.5px; background: #EFF6FF; color: #1E40AF; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Under Review</span>`;
    }
  }

  function updateStickyCompareBar() {
    if (!stickyBar || !selectionCountEl) return;
    const count = selectedProposalIds.length;
    if (count >= 2) {
      stickyBar.style.display = 'flex';
      selectionCountEl.textContent = `${count} proposals selected`;
    } else {
      stickyBar.style.display = 'none';
    }
  }

  function attachRowEventListeners() {
    // Checkbox toggles for comparison
    document.querySelectorAll('.chk-select-proposal').forEach((el) => {
      el.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const id = target.getAttribute('data-id');
        if (!id) return;

        if (target.checked) {
          if (selectedProposalIds.length >= 3) {
            target.checked = false;
            alert('You can compare a maximum of 3 proposals at a time.');
            return;
          }
          selectedProposalIds.push(id);
        } else {
          selectedProposalIds = selectedProposalIds.filter((item) => item !== id);
        }
        updateStickyCompareBar();
      });
    });

    // Shortlist button
    document.querySelectorAll('.btn-shortlist-prop').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id) return;
        try {
          await shortlistProposal(id);
          loadAndRender();
        } catch (err: any) {
          alert(`Failed to shortlist: ${err?.message}`);
        }
      });
    });

    // Open decline modal
    document.querySelectorAll('.btn-open-decline').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (!id || !declineModal) return;
        pendingDeclineProposalId = id;
        declineModal.style.display = 'flex';
      });
    });
  }

  // Filter & Search events
  searchInput?.addEventListener('input', debounce(loadAndRender, 300));
  statusSelect?.addEventListener('change', loadAndRender);
  sortSelect?.addEventListener('change', loadAndRender);

  // Trigger compare navigation
  triggerCompareBtn?.addEventListener('click', () => {
    if (selectedProposalIds.length < 2) return;
    window.location.hash = `#compare-proposals?project_id=${projectId}&ids=${selectedProposalIds.join(',')}`;
  });

  // Clear compare selection
  clearCompareBtn?.addEventListener('click', () => {
    selectedProposalIds = [];
    document.querySelectorAll('.chk-select-proposal').forEach((el) => {
      (el as HTMLInputElement).checked = false;
    });
    updateStickyCompareBar();
  });

  // Decline Modal Handlers
  cancelDeclineBtn?.addEventListener('click', () => {
    if (declineModal) declineModal.style.display = 'none';
    pendingDeclineProposalId = null;
  });

  confirmDeclineBtn?.addEventListener('click', async () => {
    if (!pendingDeclineProposalId) return;
    const reasonCode = (declineReasonSelect?.value || 'other') as DeclineReasonCode;
    const note = declineNoteArea?.value.trim() || undefined;

    try {
      await declineProposal(pendingDeclineProposalId, reasonCode, note);
      if (declineModal) declineModal.style.display = 'none';
      pendingDeclineProposalId = null;
      loadAndRender();
    } catch (err: any) {
      alert(`Failed to decline proposal: ${err?.message}`);
    }
  });

  // Initial fetches
  loadInvitations().then(() => {
    loadAndRender();
  });
  loadSuggestions();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(fn: (...args: any[]) => void, waitMs: number) {
  let timeout: any;
  return (...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), waitMs);
  };
}
