/**
 * TransactionsTable Component
 * Displays searchable, filterable, sortable, paginated transactions
 * with CSV export and click-to-open drawer.
 */

import {
  getTransactions,
  exportTransactionsCSV,
  type TransactionFilterOptions
} from '../../../services/paymentsService';
import { type SharedTransaction } from '../../../mocks/dataset';
import { formatMoney } from '../../../utils/formatters';

export function renderTransactionsTable(): string {
  return `
    <div class="dez-transactions-section">
      <!-- Toolbar: Search, Filters, CSV Export -->
      <div class="dez-table-toolbar" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;">
        <div style="display: flex; gap: 10px; align-items: center; flex: 1; min-width: 280px; flex-wrap: wrap;">
          <!-- Search input -->
          <div class="dez-input-search-wrap" style="position: relative; flex: 1; max-width: 320px;">
            <input
              type="text"
              id="tx-search-input"
              class="dez-form-input"
              placeholder="Search by description, project, reference..."
              style="height: 36px; font-size: 13px; padding-left: 32px;"
            />
            <svg style="position: absolute; left: 10px; top: 10px; color: #9CA3AF;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <!-- Type Filter -->
          <select id="tx-filter-type" class="dez-form-select" style="height: 36px; font-size: 13px; width: auto; min-width: 150px;">
            <option value="all">All Types</option>
            <option value="invoice">Invoice / Receipt</option>
            <option value="milestone">Milestone released</option>
            <option value="hourly">Hourly invoice paid</option>
            <option value="platform fee">Platform fee</option>
            <option value="withdrawal">Withdrawal</option>
            <option value="plan charge">Plan charge</option>
            <option value="refund">Refund</option>
            <option value="adjustment">Adjustment</option>
          </select>

          <!-- Status Filter -->
          <select id="tx-filter-status" class="dez-form-select" style="height: 36px; font-size: 13px; width: auto; min-width: 140px;">
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="held">Held</option>
            <option value="failed">Failed</option>
            <option value="disputed">Disputed</option>
          </select>

          <!-- Sort Filter -->
          <select id="tx-sort" class="dez-form-select" style="height: 36px; font-size: 13px; width: auto; min-width: 140px;">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="gross-desc">Highest amount</option>
            <option value="gross-asc">Lowest amount</option>
          </select>
        </div>

        <div style="display: flex; gap: 8px; align-items: center;">
          <button type="button" class="dez-btn-secondary" id="btn-download-yearly-statement" style="height: 36px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Download yearly statement
          </button>
          <button type="button" class="dez-btn-secondary" id="btn-export-tx-csv" style="height: 36px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      <!-- Transactions Table Card -->
      <div class="dez-table-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                <th style="padding: 12px 16px;">Date</th>
                <th style="padding: 12px 16px;">Description</th>
                <th style="padding: 12px 16px;">Project</th>
                <th style="padding: 12px 16px;">Type</th>
                <th style="padding: 12px 16px; text-align: right;">Gross</th>
                <th style="padding: 12px 16px; text-align: right;">Fee</th>
                <th style="padding: 12px 16px; text-align: right;">Net</th>
                <th style="padding: 12px 16px; text-align: right;">Status</th>
                <th style="padding: 12px 16px; text-align: right;">Receipt / invoice</th>
              </tr>
            </thead>
            <tbody id="tx-table-body">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>

        <!-- Pagination Bar -->
        <div class="dez-table-pagination" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-top: 1px solid #E5E7EB; background: #FAFAFA; font-size: 13px; color: #6B7280;">
          <span id="tx-pagination-info">Showing 1 to 6 of 6 transactions</span>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="dez-btn-secondary" id="btn-tx-prev" style="height: 30px; padding: 0 10px; font-size: 12px;" disabled>Previous</button>
            <button type="button" class="dez-btn-secondary" id="btn-tx-next" style="height: 30px; padding: 0 10px; font-size: 12px;" disabled>Next</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initTransactionsTable(
  container: HTMLElement,
  callbacks: {
    onSelectTransaction: (tx: SharedTransaction) => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const tbody = container.querySelector('#tx-table-body') as HTMLElement;
  const searchInput = container.querySelector('#tx-search-input') as HTMLInputElement;
  const typeFilter = container.querySelector('#tx-filter-type') as HTMLSelectElement;
  const statusFilter = container.querySelector('#tx-filter-status') as HTMLSelectElement;
  const sortSelect = container.querySelector('#tx-sort') as HTMLSelectElement;
  const btnExport = container.querySelector('#btn-export-tx-csv') as HTMLButtonElement;
  const paginationInfo = container.querySelector('#tx-pagination-info') as HTMLElement;

  let currentList: SharedTransaction[] = [];

  async function loadData() {
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" style="padding: 32px; text-align: center; color: #6B7280;">Loading transactions...</td></tr>`;

    const filters: TransactionFilterOptions = {
      search: searchInput?.value.trim() || undefined,
      type: typeFilter?.value || 'all',
      status: statusFilter?.value || 'all',
      sortBy: (sortSelect?.value as any) || 'date-desc'
    };

    currentList = await getTransactions(filters);
    renderRows();
  }

  function renderRows() {
    if (!tbody) return;

    if (currentList.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="padding: 48px 16px; text-align: center;">
            <div style="color: #111827; font-weight: 500; font-size: 14px; margin-bottom: 4px;">No transactions found</div>
            <div style="color: #6B7280; font-size: 13px;">Try adjusting your search terms or filters.</div>
          </td>
        </tr>
      `;
      if (paginationInfo) paginationInfo.textContent = '0 transactions found';
      return;
    }

    tbody.innerHTML = currentList
      .map(
        (tx) => `
      <tr class="dez-clickable-row" data-tx-id="${tx.id}" tabindex="0" style="border-bottom: 1px solid #F3F4F6; cursor: pointer; transition: background 150ms ease;">
        <td style="padding: 12px 16px; color: #6B7280; white-space: nowrap;">${tx.date}</td>
        <td style="padding: 12px 16px; font-weight: 500; color: #111827;">
          ${tx.description}
          ${
            tx.status === 'Held'
              ? `<div style="font-size: 11.5px; color: #B45309; font-weight: 400; margin-top: 2px;">• Held while client reviews deliverable</div>`
              : ''
          }
        </td>
        <td style="padding: 12px 16px; color: #4B5563;">${tx.projectName || '—'}</td>
        <td style="padding: 12px 16px; color: #4B5563;">${tx.type}</td>
        <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; color: #111827; font-weight: 500;">
          ${tx.grossAmount < 0 ? '-' : ''}$${formatMoney(Math.abs(tx.grossAmount))}
        </td>
        <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; color: #6B7280;">
          ${tx.feeAmount > 0 ? `-$${formatMoney(tx.feeAmount)}` : '—'}
        </td>
        <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; font-weight: 600; color: ${
          tx.netAmount < 0 ? '#DC2626' : '#111827'
        };">
          ${tx.netAmount < 0 ? '-' : '+'}$${formatMoney(Math.abs(tx.netAmount))}
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <span class="dez-status-pill ${
            tx.status === 'Completed'
              ? 'pill-green'
              : tx.status === 'Held'
              ? 'pill-amber'
              : tx.status === 'Pending'
              ? 'pill-blue'
              : tx.status === 'Disputed'
              ? 'pill-red'
              : 'pill-grey'
          }">
            ${tx.status}
          </span>
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <button type="button" class="dez-btn-secondary dez-btn-sm btn-download-receipt" data-tx-id="${tx.id}" style="height: 28px; padding: 0 8px; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;" title="Download receipt / invoice PDF">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>PDF</span>
          </button>
        </td>
      </tr>
    `
      )
      .join('');

    if (paginationInfo) {
      paginationInfo.textContent = `Showing 1 to ${currentList.length} of ${currentList.length} transactions`;
    }

    // Attach row click handlers
    tbody.querySelectorAll<HTMLTableRowElement>('.dez-clickable-row').forEach((row) => {
      const txId = row.getAttribute('data-tx-id');
      const handler = () => {
        const item = currentList.find((t) => t.id === txId);
        if (item) callbacks.onSelectTransaction(item);
      };

      row.addEventListener('click', handler);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });

    // Attach receipt download button clicks
    tbody.querySelectorAll<HTMLButtonElement>('.btn-download-receipt').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txId = btn.getAttribute('data-tx-id');
        callbacks.onShowToast('Receipt Downloaded', `Invoice & receipt for ${txId} saved as PDF.`, 'success');
      });
    });
  }

  // Filter events with debounced search
  let debounceTimer: any = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadData, 200);
  });

  typeFilter?.addEventListener('change', loadData);
  statusFilter?.addEventListener('change', loadData);
  sortSelect?.addEventListener('change', loadData);

  // Yearly Statement Download
  const btnYearlyStatement = container.querySelector('#btn-download-yearly-statement') as HTMLButtonElement;
  btnYearlyStatement?.addEventListener('click', () => {
    callbacks.onShowToast('Statement Ready', 'Downloaded 2026 Annual Studio Tax & Earnings Statement (PDF).', 'success');
  });

  // CSV Export
  btnExport?.addEventListener('click', () => {
    const csvContent = exportTransactionsCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dezignet-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    callbacks.onShowToast('Export Complete', 'Downloaded transaction statement CSV.', 'success');
  });

  // Initial load
  loadData();
}
