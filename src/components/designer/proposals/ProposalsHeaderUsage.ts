/**
 * ProposalsHeaderUsage Component
 * Displays proposal usage summary:
 * "{n} of {limit} proposals used this month" with thin blue progress bar and Upgrade link.
 */

import { type ProposalUsageInfo } from '../../../services/proposalsService';

export function renderProposalsHeaderUsage(usage: ProposalUsageInfo): string {
  const percentage = usage.isUnlimited ? 0 : Math.min(100, Math.round((usage.used / usage.limit) * 100));

  return `
    <div class="dez-proposals-usage-panel" style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
      <div style="flex: 1; min-width: 260px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 13.5px; font-weight: 500; color: #111827;">
            ${usage.isUnlimited ? `${usage.used} proposals submitted this month (Unlimited on ${usage.planName})` : `${usage.used} of ${usage.limit} proposals used this month`}
          </span>
          <span style="font-size: 12px; color: #6B7280;">
            ${usage.planName} tier
          </span>
        </div>

        ${
          !usage.isUnlimited
            ? `
          <div style="width: 100%; height: 6px; background: #E5E7EB; border-radius: 9999px; overflow: hidden;">
            <div style="width: ${percentage}%; height: 100%; background: var(--dez-primary-blue, #2F7BE5); border-radius: 9999px; transition: width 300ms ease;"></div>
          </div>
        `
            : ''
        }
      </div>

      <div style="flex-shrink: 0;">
        <a href="#payments/plan" class="dez-inline-link-btn" style="color: var(--dez-primary-blue, #2F7BE5); font-weight: 500; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
          Upgrade plan for more slots &rarr;
        </a>
      </div>
    </div>
  `;
}
