/**
 * ProposalsLayout Component
 * Coordinates the My Proposals list page and proposal detail view:
 * - List view with usage bar, status tabs with live counts, search, sorting & filters
 * - Detail view with breadcrumbs, two-column breakdown, snapshot, and sticky actions
 * - Withdraw dialog integration
 */

import {
  getMyProposalsList,
  getProposalUsage,
  type ProposalStatusTab,
  type ProposalFilterOptions
} from '../../../services/proposalsService';
import { renderProposalsHeaderUsage } from './ProposalsHeaderUsage';
import { renderProposalStatusTabs, initProposalStatusTabs } from './ProposalStatusTabs';
import { renderProposalsTable, initProposalsTable } from './ProposalsTable';
import { renderProposalDetailSkeleton, initProposalDetail } from './ProposalDetail';

export function renderProposalsLayout(): string {
  return `
    <div class="dez-proposals-page-container" id="dez-proposals-root">
      <!-- Page Header -->
      <div class="dez-proposals-header" style="margin-bottom: 20px;">
        <h1 class="dez-page-title" style="font-size: 28px; margin-bottom: 4px;">My Proposals</h1>
        <p class="dez-page-subtext">Track offers, client reviews, shortlists, and accepted architecture commissions.</p>
      </div>

      <!-- Monthly Usage Progress Bar Slot -->
      <div id="dez-proposals-usage-slot"></div>

      <!-- Filters & Toolbar -->
      <div class="dez-proposals-toolbar" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <!-- Status Tabs Bar Slot -->
        <div id="dez-proposals-tabs-slot" style="flex: 1; min-width: 300px;"></div>

        <!-- Search & Filter Controls -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <!-- Search -->
          <div style="position: relative; width: 220px;">
            <input
              type="text"
              id="prop-search-input"
              class="dez-form-input"
              placeholder="Search proposals..."
              style="height: 36px; font-size: 13px; padding-left: 30px;"
            />
            <svg style="position: absolute; left: 9px; top: 10px; color: #9CA3AF;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <!-- Payment Type Filter -->
          <select id="prop-filter-type" class="dez-form-select" style="height: 36px; font-size: 13px; width: auto;">
            <option value="all">All payment types</option>
            <option value="Milestone">Milestone only</option>
            <option value="Hourly">Hourly only</option>
          </select>

          <!-- Sort Filter -->
          <select id="prop-sort-select" class="dez-form-select" style="height: 36px; font-size: 13px; width: auto;">
            <option value="newest">Newest first</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      <!-- Content Area (Table or Detail View) -->
      <main id="dez-proposals-content" role="region" aria-label="Proposals feed">
        <div style="padding: 32px; text-align: center; color: #6B7280;">Loading proposals...</div>
      </main>
    </div>
  `;
}

export async function initProposals(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
    onSelectProposal?: (id: string) => void;
  },
  selectedProposalId?: string
): Promise<void> {
  const root = container.querySelector('#dez-proposals-root') as HTMLElement;
  if (!root) return;

  const usageSlot = root.querySelector('#dez-proposals-usage-slot') as HTMLElement;
  const tabsSlot = root.querySelector('#dez-proposals-tabs-slot') as HTMLElement;
  const contentArea = root.querySelector('#dez-proposals-content') as HTMLElement;
  const searchInput = root.querySelector('#prop-search-input') as HTMLInputElement;
  const typeFilter = root.querySelector('#prop-filter-type') as HTMLSelectElement;
  const sortSelect = root.querySelector('#prop-sort-select') as HTMLSelectElement;

  let activeTab: ProposalStatusTab = 'All';

  // If a specific proposal is requested in the URL, load detail view directly
  if (selectedProposalId) {
    showDetail(selectedProposalId);
    return;
  }

  async function loadUsage() {
    if (!usageSlot) return;
    const usage = await getProposalUsage();
    usageSlot.innerHTML = renderProposalsHeaderUsage(usage);
  }

  async function loadList() {
    if (!contentArea) return;

    const filters: ProposalFilterOptions = {
      tab: activeTab,
      search: searchInput?.value.trim() || undefined,
      paymentType: (typeFilter?.value as any) || 'all',
      sortBy: (sortSelect?.value as any) || 'newest'
    };

    const { proposals, tabCounts } = await getMyProposalsList(filters);

    // Render tabs
    if (tabsSlot) {
      tabsSlot.innerHTML = renderProposalStatusTabs(activeTab, tabCounts);
      initProposalStatusTabs(tabsSlot, (tab) => {
        activeTab = tab;
        loadList();
      });
    }

    // Render table
    contentArea.innerHTML = renderProposalsTable(proposals, activeTab);
    initProposalsTable(contentArea, (propId) => {
      showDetail(propId);
    });
  }

  function showDetail(proposalId: string) {
    if (!contentArea) return;
    window.location.hash = `#proposals/${proposalId}`;

    // Hide list controls
    if (usageSlot) usageSlot.style.display = 'none';
    const toolbar = root.querySelector('.dez-proposals-toolbar') as HTMLElement;
    if (toolbar) toolbar.style.display = 'none';
    const header = root.querySelector('.dez-proposals-header') as HTMLElement;
    if (header) header.style.display = 'none';

    contentArea.innerHTML = renderProposalDetailSkeleton();
    initProposalDetail(contentArea, proposalId, {
      onBackToList: () => {
        window.location.hash = '#proposals';
        if (usageSlot) usageSlot.style.display = 'block';
        if (toolbar) toolbar.style.display = 'flex';
        if (header) header.style.display = 'block';
        loadList();
        loadUsage();
      },
      onShowToast: callbacks.onShowToast
    });
  }

  // Filter change handlers
  let searchTimer: any = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadList, 200);
  });
  typeFilter?.addEventListener('change', loadList);
  sortSelect?.addEventListener('change', loadList);

  // Initial load
  await loadUsage();
  await loadList();
}
