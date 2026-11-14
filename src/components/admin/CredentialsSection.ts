/**
 * CredentialsSection.ts
 * Credentials Verification Queue: approve/reject with jurisdiction, verification date, and reason.
 */

import {
  adminGetPendingCredentials,
  type AdminPendingCredential
} from '../../services/adminService';
import {
  adminReviewCredentialAdvanced
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { US_STATES } from '../../services/usMarketService';

export async function renderCredentialsSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Professional Credentials Verification Queue
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Review architectural and engineering licenses, verify state board jurisdictions, and issue verified badges.
          </p>
        </div>
        <button id="cred-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh Queue
        </button>
      </div>

      <div id="cred-queue-container" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading verification queue...</div>
      </div>
    </div>
  `;

  const refreshBtn = container.querySelector('#cred-refresh-btn') as HTMLButtonElement;
  const queueContainer = container.querySelector('#cred-queue-container') as HTMLElement;

  async function loadCredentials() {
    queueContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading pending credentials...</div>';
    try {
      const credentials: AdminPendingCredential[] = await adminGetPendingCredentials();

      if (credentials.length === 0) {
        queueContainer.innerHTML = `
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center; padding: 48px;">
            <div style="color: #059669; font-size: 16px; font-weight: 600; margin-bottom: 4px;">Verification Queue Clear</div>
            <p style="font-size: 13px; color: #64748B; margin: 0;">All submitted professional credentials have been reviewed.</p>
          </div>
        `;
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];

      queueContainer.innerHTML = credentials.map(c => `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0F172A;">${c.designer_name}</h3>
                <span style="background: #FEF3C7; color: #D97706; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">Pending Review</span>
              </div>
              <div style="font-size: 12px; color: #64748B; margin-top: 2px;">${c.designer_email} &bull; Submitted: ${new Date(c.submitted_at).toLocaleDateString()}</div>
            </div>
            ${c.certificate_path ? `
              <a href="${c.certificate_path}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: #2563EB; text-decoration: none; background: #EFF6FF; border: 1px solid #BFDBFE; padding: 6px 12px; border-radius: 6px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                View Document
              </a>
            ` : '<span style="font-size: 12px; color: #94A3B8;">No document attached</span>'}
          </div>

          <!-- Credential Details Grid -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; font-size: 13px;">
            <div>
              <span style="color: #64748B; font-size: 11px; display: block;">Licensing Body / Board</span>
              <strong style="color: #0F172A;">${c.body_name}</strong>
            </div>
            <div>
              <span style="color: #64748B; font-size: 11px; display: block;">License / Registration #</span>
              <strong style="color: #0F172A;">${c.license_number}</strong>
            </div>
            <div>
              <span style="color: #64748B; font-size: 11px; display: block;">Submitted State / Region</span>
              <strong style="color: #0F172A;">${c.state_region || 'N/A'}</strong>
            </div>
            <div>
              <span style="color: #64748B; font-size: 11px; display: block;">Registration Year</span>
              <strong style="color: #0F172A;">${c.verification_year || 'Current'}</strong>
            </div>
          </div>

          <!-- Verification Inputs & Decision Bar -->
          <div style="border-top: 1px solid #F1F5F9; padding-top: 14px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <div>
                <label style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Confirmed Jurisdiction State</label>
                <select id="state-${c.id}" style="padding: 6px 10px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 4px; background: #FFFFFF;">
                  ${US_STATES.map(s => `<option value="${s.code}" ${s.code === c.state_region ? 'selected' : ''}>${s.name} (${s.code})</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="font-size: 11px; font-weight: 600; color: #475569; display: block; margin-bottom: 2px;">Verification Date</label>
                <input id="date-${c.id}" type="date" value="${todayStr}" style="padding: 5px 8px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 4px;" />
              </div>
            </div>

            <div style="display: flex; gap: 8px;">
              <button class="btn-cred-reject" data-id="${c.id}" data-name="${c.designer_name}" style="background: #FFFFFF; border: 1px solid #FCA5A5; color: #DC2626; font-size: 13px; font-weight: 500; padding: 7px 14px; border-radius: 6px; cursor: pointer;">
                Reject with Reason
              </button>
              <button class="btn-cred-approve" data-id="${c.id}" data-name="${c.designer_name}" style="background: #059669; border: none; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 7px 16px; border-radius: 6px; cursor: pointer;">
                Approve & Verify Badge
              </button>
            </div>
          </div>
        </div>
      `).join('');

      attachCredentialEvents();
    } catch (err: any) {
      queueContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachCredentialEvents() {
    // Approve
    queueContainer.querySelectorAll('.btn-cred-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const name = btn.getAttribute('data-name')!;
        const stateSelect = queueContainer.querySelector(`#state-${id}`) as HTMLSelectElement;
        const dateInput = queueContainer.querySelector(`#date-${id}`) as HTMLInputElement;

        const jurisdiction = stateSelect.value;
        const vDate = dateInput.value;

        const confirmed = window.confirm(`Confirm approval of professional license for ${name} in jurisdiction ${jurisdiction}? This will grant the Verified Professional badge.`);
        if (!confirmed) return;

        try {
          await adminReviewCredentialAdvanced({
            credentialId: id,
            decision: 'approved',
            jurisdictionState: jurisdiction,
            verificationDate: vDate
          });
          alert(`License verified for ${name}. Verified badge awarded.`);
          await loadCredentials();
        } catch (err: any) {
          alert('Approval error: ' + err.message);
        }
      });
    });

    // Reject with reason
    queueContainer.querySelectorAll('.btn-cred-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const name = btn.getAttribute('data-name')!;

        const reason = await showReasonDialog({
          title: `Reject Credential Submission: ${name}`,
          subtitle: 'The designer will receive this message detailing what needs revision.',
          promptLabel: 'Mandatory Rejection Reason (minimum 5 characters)',
          placeholder: 'Explain why credential was rejected (e.g., license expired, name mismatch, illegible document)...',
          danger: true
        });

        if (!reason) return;

        try {
          await adminReviewCredentialAdvanced({
            credentialId: id,
            decision: 'rejected',
            reason
          });
          alert(`Credential rejected. Feedback sent to ${name}.`);
          await loadCredentials();
        } catch (err: any) {
          alert('Rejection error: ' + err.message);
        }
      });
    });
  }

  refreshBtn.addEventListener('click', () => loadCredentials());
  loadCredentials();
}
