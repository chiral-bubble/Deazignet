/**
 * OverviewSection.ts
 * Admin Console Overview Dashboard: system counts, queue backlogs, and oldest-item ages.
 */

import { getOverviewMetrics, type OverviewMetrics } from '../../services/adminConsoleService';

export async function renderOverviewSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="margin-bottom: 24px;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
          Operations Overview
        </h2>
        <p style="font-size: 14px; color: #64748B; margin: 0;">
          Real-time summary of administrative queues, active disputes, pending reviews, and queue response times.
        </p>
      </div>

      <div id="overview-metrics-loading" style="text-align: center; padding: 48px; color: #64748B;">
        Loading metrics and queues...
      </div>
      <div id="overview-metrics-content" style="display: none;"></div>
    </div>
  `;

  const contentEl = container.querySelector('#overview-metrics-content') as HTMLElement;
  const loadingEl = container.querySelector('#overview-metrics-loading') as HTMLElement;

  try {
    const metrics: OverviewMetrics = await getOverviewMetrics();

    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';

    contentEl.innerHTML = `
      <!-- Actionable Queue Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 28px;">
        <!-- Reports Queue -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 500; color: #64748B;">Pending Reports</span>
            <span style="background: ${metrics.pendingReports > 0 ? '#FEE2E2' : '#F1F5F9'}; color: ${metrics.pendingReports > 0 ? '#DC2626' : '#475569'}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
              ${metrics.pendingReports > 0 ? 'Action Needed' : 'Clear'}
            </span>
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #0F172A; line-height: 1; margin-bottom: 8px;">
            ${metrics.pendingReports}
          </div>
          <div style="font-size: 12px; color: #94A3B8;">
            Oldest item: <strong style="color: #475569;">${metrics.oldestReportAgeHrs}h</strong> old
          </div>
        </div>

        <!-- Credentials Queue -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 500; color: #64748B;">Pending Credentials</span>
            <span style="background: #FEF3C7; color: #D97706; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
              Verification
            </span>
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #0F172A; line-height: 1; margin-bottom: 8px;">
            ${metrics.pendingCredentials}
          </div>
          <div style="font-size: 12px; color: #94A3B8;">
            Oldest item: <strong style="color: #475569;">${metrics.oldestCredentialAgeHrs}h</strong> old
          </div>
        </div>

        <!-- Open Disputes -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 500; color: #64748B;">Contract Disputes</span>
            <span style="background: #EDE9FE; color: #7C3AED; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
              Contract Review
            </span>
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #0F172A; line-height: 1; margin-bottom: 8px;">
            ${metrics.pendingDisputes}
          </div>
          <div style="font-size: 12px; color: #94A3B8;">
            Oldest item: <strong style="color: #475569;">${metrics.oldestDisputeAgeHrs}h</strong> old
          </div>
        </div>

        <!-- Financial Actions Queue -->
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 13px; font-weight: 500; color: #64748B;">Financial Approvals</span>
            <span style="background: #E0F2FE; color: #0284C7; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
              Refunds / Releases
            </span>
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #0F172A; line-height: 1; margin-bottom: 8px;">
            ${metrics.pendingFinancialActions}
          </div>
          <div style="font-size: 12px; color: #94A3B8;">
            Oldest item: <strong style="color: #475569;">${metrics.oldestFinancialAgeHrs}h</strong> old
          </div>
        </div>
      </div>

      <!-- Secondary Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Open Support Tickets</div>
          <div style="font-size: 22px; font-weight: 600; color: #0F172A;">${metrics.openSupportTickets}</div>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Suspended Accounts</div>
          <div style="font-size: 22px; font-weight: 600; color: #DC2626;">${metrics.suspendedUsers}</div>
        </div>
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Active Promotions</div>
          <div style="font-size: 22px; font-weight: 600; color: #059669;">${metrics.activePromotions}</div>
        </div>
      </div>

      <!-- Quick Operational Safety Principles -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
        <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #0F172A;">Administrative Compliance Guidelines</h3>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.7;">
          <li><strong>Two-Person Rule:</strong> Financial refunds or release disbursements over $1,000 require approval by two separate administrators.</li>
          <li><strong>Privacy Transparency:</strong> Accessing private user correspondence or confidential project files requires entering a mandatory written justification reason recorded in the immutable audit log.</li>
          <li><strong>MFA Session Guard:</strong> Sensitive actions (suspensions, payout approvals, fee changes, role assignments) are gated by a 15-minute re-authentication window.</li>
          <li><strong>Append-Only Trail:</strong> All operations are permanently recorded into the tamper-proof security log protected by database triggers.</li>
        </ul>
      </div>
    `;
  } catch (err: any) {
    loadingEl.innerHTML = `<span style="color: #DC2626;">Failed to load overview: ${err.message}</span>`;
  }
}
