/**
 * ModerationSection.ts
 * Unified Reports & Moderation Queue: dismiss, warn, hide content, and suspend reported accounts.
 * Includes mandatory written reason prompt when inspecting private target content.
 */

import {
  adminGetReports,
  adminResolveReport,
  adminToggleUserSuspension,
  logPrivateContentRead,
  type UnifiedReportItem
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { ensureRecentAuth } from './ApprovalDialog';

export async function renderModerationSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="margin-bottom: 24px;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
          Unified Reports & Safety Moderation
        </h2>
        <p style="font-size: 14px; color: #64748B; margin: 0;">
          Review flagged messages, reviews, projects, and user profiles. Inspect reported materials and take corrective actions.
        </p>
      </div>

      <!-- Filters Toolbar -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
        <div>
          <select id="mod-status-filter" style="padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; color: #0F172A;">
            <option value="all">All Statuses</option>
            <option value="pending" selected>Pending Review</option>
            <option value="investigating">Under Investigation</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
        <div>
          <select id="mod-type-filter" style="padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; color: #0F172A;">
            <option value="all">All Target Types</option>
            <option value="message">Messages</option>
            <option value="review">Reviews</option>
            <option value="project">Projects</option>
            <option value="profile">Profiles</option>
            <option value="proposal">Proposals</option>
          </select>
        </div>
        <button id="mod-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh Queue
        </button>
      </div>

      <!-- Reports List Container -->
      <div id="mod-reports-container" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading reports queue...</div>
      </div>
    </div>
  `;

  const statusFilter = container.querySelector('#mod-status-filter') as HTMLSelectElement;
  const typeFilter = container.querySelector('#mod-type-filter') as HTMLSelectElement;
  const refreshBtn = container.querySelector('#mod-refresh-btn') as HTMLButtonElement;
  const reportsContainer = container.querySelector('#mod-reports-container') as HTMLElement;

  async function loadReports() {
    reportsContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading reports...</div>';
    try {
      const reports: UnifiedReportItem[] = await adminGetReports({
        status: statusFilter.value,
        targetType: typeFilter.value
      });

      if (reports.length === 0) {
        reportsContainer.innerHTML = '<div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center; padding: 48px; color: #64748B;">No reports match the selected filters.</div>';
        return;
      }

      reportsContainer.innerHTML = reports.map(r => `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="background: #F1F5F9; color: #334155; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px;">
                ${r.targetType}
              </span>
              <span style="font-size: 12px; color: #64748B;">Reported by: <strong>${r.reporterEmail || 'Anonymous'}</strong></span>
              <span style="font-size: 12px; color: #94A3B8;">&bull; ${new Date(r.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span style="background: ${r.status === 'pending' ? '#FEE2E2; color: #DC2626;' : r.status === 'investigating' ? '#FEF3C7; color: #D97706;' : '#DCFCE7; color: #15803D;'}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                ${r.status}
              </span>
            </div>
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 14px; font-weight: 600; color: #0F172A; margin-bottom: 4px;">Reason: ${r.reason}</div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; font-size: 13px; color: #334155; line-height: 1.5; font-style: italic;">
              "${r.targetPreview || 'No content preview recorded'}"
            </div>
          </div>

          ${r.resolution ? `
            <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; font-size: 12px; color: #166534;">
              <strong>Resolution:</strong> ${r.resolution} (${new Date(r.resolvedAt || '').toLocaleString()})
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F1F5F9; padding-top: 14px;">
            <button class="btn-inspect-private" data-id="${r.id}" data-type="${r.targetType}" data-target-id="${r.targetId}" style="background: none; border: 1px solid #CBD5E1; color: #2563EB; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Inspect Full Private Thread (Requires Reason)
            </button>

            ${r.status !== 'resolved' && r.status !== 'dismissed' ? `
              <div style="display: flex; gap: 8px;">
                <button class="btn-action-dismiss" data-id="${r.id}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #64748B; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                  Dismiss
                </button>
                <button class="btn-action-warn" data-id="${r.id}" style="background: #FEF3C7; border: 1px solid #FCD34D; color: #B45309; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                  Issue Warning
                </button>
                <button class="btn-action-hide" data-id="${r.id}" style="background: #FEE2E2; border: 1px solid #FCA5A5; color: #DC2626; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                  Hide Content
                </button>
                <button class="btn-action-suspend" data-id="${r.id}" data-target-id="${r.targetId}" style="background: #DC2626; border: none; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                  Suspend User
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `).join('');

      attachModerationEvents();
    } catch (err: any) {
      reportsContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachModerationEvents() {
    // Inspect private content with mandatory reason
    reportsContainer.querySelectorAll('.btn-inspect-private').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-type')!;
        const targetId = btn.getAttribute('data-target-id')!;

        const reason = await showReasonDialog({
          title: `Access Private Content (${type.toUpperCase()} #${targetId})`,
          subtitle: 'Administrative access to private correspondence requires a written audit justification.',
          promptLabel: 'Specific Reason for Accessing Private Content (min 5 chars)',
          placeholder: 'Explain investigation purpose (e.g. verifying off-platform solicitation claim)...'
        });

        if (!reason) return;

        try {
          await logPrivateContentRead(type, targetId, reason);
          alert(`Private access logged to audit trail with reason:\n"${reason}"\n\nFull thread inspection authorized for moderator.`);
        } catch (err: any) {
          alert('Access denied: ' + err.message);
        }
      });
    });

    // Dismiss
    reportsContainer.querySelectorAll('.btn-action-dismiss').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const notes = window.prompt('Enter optional note for dismissing report:', 'Report reviewed and found unsubstantiated');
        if (notes === null) return;
        await adminResolveReport(id, 'dismiss', notes);
        await loadReports();
      });
    });

    // Warn
    reportsContainer.querySelectorAll('.btn-action-warn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const notes = window.prompt('Enter warning note sent to user:', 'Formal warning issued regarding platform communication guidelines');
        if (notes === null) return;
        await adminResolveReport(id, 'warn', notes);
        await loadReports();
      });
    });

    // Hide Content
    reportsContainer.querySelectorAll('.btn-action-hide').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const notes = window.prompt('Enter reason for hiding reported content:', 'Content removed for violating terms');
        if (notes === null) return;
        await adminResolveReport(id, 'hide_content', notes);
        await loadReports();
      });
    });

    // Suspend
    reportsContainer.querySelectorAll('.btn-action-suspend').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const targetId = btn.getAttribute('data-target-id')!;

        const authed = await ensureRecentAuth('Suspend user from moderation report queue');
        if (!authed) return;

        const reason = await showReasonDialog({
          title: 'Suspend Reported User Account',
          subtitle: 'Enforces full platform account suspension.',
          promptLabel: 'Suspension Justification (Recorded in audit trail)',
          placeholder: 'State explicit violation of marketplace policies...',
          danger: true
        });

        if (!reason) return;

        await adminResolveReport(id, 'suspend', reason);
        await adminToggleUserSuspension(targetId, true, reason);
        await loadReports();
      });
    });
  }

  statusFilter.addEventListener('change', () => loadReports());
  typeFilter.addEventListener('change', () => loadReports());
  refreshBtn.addEventListener('click', () => loadReports());
  loadReports();
}
