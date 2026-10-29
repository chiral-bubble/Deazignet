/**
 * ProposalStatusTabs Component
 * Status filter tabs with live proposal counts:
 * All, Pending, Viewed, Shortlisted, Accepted, Declined, Withdrawn.
 */

import { type ProposalStatusTab } from '../../../services/proposalsService';

export const PROPOSAL_TABS: ProposalStatusTab[] = [
  'All',
  'Pending',
  'Viewed',
  'Shortlisted',
  'Accepted',
  'Declined',
  'Withdrawn'
];

export function renderProposalStatusTabs(
  activeTab: ProposalStatusTab,
  counts: Record<ProposalStatusTab, number>
): string {
  return `
    <div class="dez-proposal-tabs-bar" style="border-bottom: 1px solid #E5E7EB; margin-bottom: 20px; display: flex; gap: 8px; overflow-x: auto;">
      ${PROPOSAL_TABS.map((tab) => {
        const count = counts[tab] || 0;
        const isActive = activeTab === tab;
        return `
          <button
            type="button"
            class="dez-tab-btn ${isActive ? 'is-active' : ''}"
            data-prop-tab="${tab}"
            style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 14px; font-size: 13.5px; white-space: nowrap;"
          >
            <span>${tab}</span>
            <span style="font-size: 11px; padding: 1px 6px; border-radius: 9999px; background: ${
              isActive ? 'var(--dez-primary-blue, #2F7BE5)' : '#F3F4F6'
            }; color: ${isActive ? '#FFFFFF' : '#4B5563'}; font-weight: 500;">
              ${count}
            </span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

export function initProposalStatusTabs(
  container: HTMLElement,
  onTabChange: (tab: ProposalStatusTab) => void
): void {
  container.querySelectorAll<HTMLButtonElement>('[data-prop-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-prop-tab') as ProposalStatusTab;
      if (tab) onTabChange(tab);
    });
  });
}
