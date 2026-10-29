/**
 * PlanComparison Component
 * Clean comparison matrix table driven by config with editable placeholder rows.
 */

import { PLAN_FEATURES_TABLE, type PlanFeatureRow } from '../../../config/paymentsConfig';

export function renderPlanComparison(): string {
  return `
    <div class="dez-plan-comparison-section" style="margin-top: 32px;">
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Plan feature comparison</h3>
        <p style="font-size: 13px; color: #6B7280; margin: 2px 0 0 0;">Compare proposal allocations, escrow platform fees, and portfolio visibility benefits.</p>
      </div>

      <div class="dez-table-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #111827; font-weight: 600;">
                <th style="padding: 14px 16px; width: 40%;">Feature</th>
                <th style="padding: 14px 16px; text-align: center; width: 20%;">Free</th>
                <th style="padding: 14px 16px; text-align: center; width: 20%;">Basic</th>
                <th style="padding: 14px 16px; text-align: center; width: 20%;">Upgraded</th>
              </tr>
            </thead>
            <tbody>
              ${PLAN_FEATURES_TABLE.map((row: PlanFeatureRow, idx: number) => `
                <tr style="border-bottom: 1px solid #F3F4F6; background: ${idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'};">
                  <td style="padding: 12px 16px; font-weight: 500; color: #374151;">${row.name}</td>
                  <td style="padding: 12px 16px; text-align: center; color: #4B5563;">
                    ${renderFeatureValue(row.free)}
                  </td>
                  <td style="padding: 12px 16px; text-align: center; color: #4B5563;">
                    ${renderFeatureValue(row.basic)}
                  </td>
                  <td style="padding: 12px 16px; text-align: center; color: #111827; font-weight: 500;">
                    ${renderFeatureValue(row.upgraded)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderFeatureValue(val: string | boolean): string {
  if (typeof val === 'boolean') {
    return val
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5" style="display: inline-block; vertical-align: middle;"><polyline points="20 6 9 17 4 12"/></svg>`
      : `<span style="color: #9CA3AF; font-size: 15px;">—</span>`;
  }
  return `<span>${val}</span>`;
}
