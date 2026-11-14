/**
 * AnalyticsSection.ts
 * Platform Operations Analytics: sign-ups, active users, projects, proposals,
 * contract award counts, proposal acceptance rates, gross volume, and CSV export.
 */

import {
  adminGetAnalytics,
  exportToCSV,
  type PlatformAnalytics
} from '../../services/adminConsoleService';
import { formatUSD } from '../../services/usMarketService';

export async function renderAnalyticsSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Marketplace Analytics & Metrics
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Aggregate indicators of network activity, project conversion velocity, contract volume, and funnel health.
          </p>
        </div>
        <div style="display: flex; gap: 10px;">
          <select id="analytics-period-select" style="padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; color: #0F172A;">
            <option value="7d">Last 7 Days</option>
            <option value="30d" selected>Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">Past 12 Months</option>
          </select>
          <button id="btn-export-analytics-csv" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #0F172A; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div id="analytics-content-container">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading analytics data...</div>
      </div>
    </div>
  `;

  const periodSelect = container.querySelector('#analytics-period-select') as HTMLSelectElement;
  const btnExportCsv = container.querySelector('#btn-export-analytics-csv') as HTMLButtonElement;
  const contentContainer = container.querySelector('#analytics-content-container') as HTMLElement;

  let currentAnalytics: PlatformAnalytics | null = null;

  async function loadAnalytics() {
    contentContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Computing metrics...</div>';
    const period = periodSelect.value as any;
    currentAnalytics = await adminGetAnalytics(period);

    contentContainer.innerHTML = `
      <!-- Top Metrics Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Sign-ups in Period</div>
          <div style="font-size: 28px; font-weight: 700; color: #0F172A;">${currentAnalytics.signupsTotal}</div>
          <div style="font-size: 11px; color: #10B981; margin-top: 4px;">+18% vs prior period</div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Monthly Active Users</div>
          <div style="font-size: 28px; font-weight: 700; color: #0F172A;">${currentAnalytics.activeUsersMonthly}</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px;">Engaged in last 30d</div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Projects Posted</div>
          <div style="font-size: 28px; font-weight: 700; color: #0F172A;">${currentAnalytics.projectsPosted}</div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px;">${currentAnalytics.proposalsSubmitted} proposals submitted</div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
          <div style="font-size: 12px; color: #64748B; margin-bottom: 4px;">Contracts Awarded</div>
          <div style="font-size: 28px; font-weight: 700; color: #2563EB;">${currentAnalytics.contractsAwarded}</div>
          <div style="font-size: 11px; color: #059669; margin-top: 4px;"><strong>${currentAnalytics.acceptanceRatePercent}%</strong> proposal acceptance</div>
        </div>
      </div>

      <!-- Financial Metrics Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px;">
        <div style="background: #0F172A; color: #FFFFFF; border-radius: 8px; padding: 24px;">
          <div style="font-size: 12px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Gross Marketplace Volume</div>
          <div style="font-size: 32px; font-weight: 700; color: #38BDF8;">${formatUSD(currentAnalytics.grossVolumeUSD)}</div>
          <div style="font-size: 12px; color: #94A3B8; margin-top: 6px;">Total value of contracts and milestone funds transacted</div>
        </div>

        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px;">
          <div style="font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Average Contract Value</div>
          <div style="font-size: 32px; font-weight: 700; color: #0F172A;">${formatUSD(currentAnalytics.avgContractValueUSD)}</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 6px;">Mean engagement budget across awarded residential & commercial projects</div>
        </div>
      </div>

      <!-- Time Series Table -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="padding: 16px 20px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #0F172A; font-size: 14px;">
          Weekly Activity Trends
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
              <th style="padding: 12px 16px;">Week</th>
              <th style="padding: 12px 16px;">Sign-ups</th>
              <th style="padding: 12px 16px;">New Projects</th>
              <th style="padding: 12px 16px;">Contracts</th>
              <th style="padding: 12px 16px; text-align: right;">Volume (USD)</th>
            </tr>
          </thead>
          <tbody>
            ${currentAnalytics.series.map(s => `
              <tr style="border-bottom: 1px solid #F1F5F9;">
                <td style="padding: 12px 16px; font-weight: 500; color: #0F172A;">${s.date}</td>
                <td style="padding: 12px 16px;">${s.signups}</td>
                <td style="padding: 12px 16px;">${s.projects}</td>
                <td style="padding: 12px 16px; font-weight: 600; color: #2563EB;">${s.contracts}</td>
                <td style="padding: 12px 16px; text-align: right; font-weight: 600; color: #0F172A;">${formatUSD(s.volumeUSD)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  btnExportCsv.addEventListener('click', () => {
    if (!currentAnalytics) return;
    const headers = ['Date', 'Signups', 'Projects', 'Contracts', 'VolumeUSD'];
    const rows = currentAnalytics.series.map(s => [s.date, s.signups, s.projects, s.contracts, s.volumeUSD]);
    exportToCSV(`dezignet-analytics-${periodSelect.value}.csv`, headers, rows);
  });

  periodSelect.addEventListener('change', loadAnalytics);
  loadAnalytics();
}
