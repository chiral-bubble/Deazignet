/**
 * InvoicesTable Component
 * Displays invoices, receipts, mock PDF download,
 * yearly earnings statement download, and note on upcoming tax documents.
 */

import { getInvoices } from '../../../services/paymentsService';
import { formatMoney } from '../../../utils/formatters';

export function renderInvoicesTable(): string {
  return `
    <div class="dez-invoices-section">
      <!-- Top Bar: Title & Yearly Earnings Statement Download -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Invoices & receipts</h2>
          <p style="font-size: 13px; color: #6B7280; margin: 2px 0 0 0;">Download itemized receipts for plan charges and commissions.</p>
        </div>
        <button type="button" class="dez-btn-secondary" id="btn-download-annual-statement" style="height: 36px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download 2026 earnings statement (PDF)
        </button>
      </div>

      <!-- Invoices Table -->
      <div class="dez-table-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                <th style="padding: 12px 16px;">Date</th>
                <th style="padding: 12px 16px;">Number</th>
                <th style="padding: 12px 16px;">Description</th>
                <th style="padding: 12px 16px; text-align: right;">Amount</th>
                <th style="padding: 12px 16px; text-align: right;">Status</th>
                <th style="padding: 12px 16px; text-align: right;">Receipt</th>
              </tr>
            </thead>
            <tbody id="invoices-table-body">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tax Documents Notice -->
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px 20px; display: flex; align-items: flex-start; gap: 12px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" style="margin-top: 2px; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <div style="font-size: 13px; color: #4B5563; line-height: 1.5;">
          <strong style="color: #111827;">Tax documentation notice:</strong> Official annual tax forms (such as W-8BEN / local withholding certificates) will be made available here at the close of the financial year.
        </div>
      </div>
    </div>
  `;
}

export function initInvoicesTable(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const tbody = container.querySelector('#invoices-table-body') as HTMLElement;
  const btnAnnual = container.querySelector('#btn-download-annual-statement');

  async function load() {
    const list = await getInvoices();
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 32px; text-align: center; color: #6B7280;">No invoices available.</td></tr>`;
      return;
    }

    tbody.innerHTML = list
      .map(
        (inv) => `
      <tr style="border-bottom: 1px solid #F3F4F6;">
        <td style="padding: 12px 16px; color: #6B7280;">${inv.date}</td>
        <td style="padding: 12px 16px; font-family: monospace; font-size: 12px; color: #111827; font-weight: 500;">${inv.number}</td>
        <td style="padding: 12px 16px; color: #374151;">${inv.description}</td>
        <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; font-weight: 600; color: #111827;">
          $${formatMoney(inv.amount)}
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <span class="dez-status-pill pill-green">${inv.status}</span>
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <button type="button" class="dez-inline-link-btn btn-download-invoice" data-inv-number="${inv.number}" style="color: var(--dez-primary-blue, #2F7BE5); background: none; border: none; cursor: pointer; font-size: 12.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            PDF
          </button>
        </td>
      </tr>
    `
      )
      .join('');

    // Attach PDF mock downloads
    tbody.querySelectorAll<HTMLButtonElement>('.btn-download-invoice').forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-inv-number');
        mockDownloadPDF(`dezignet-invoice-${num}.pdf`, `DEZIGNET OFFICIAL RECEIPT\nInvoice #: ${num}\nStatus: Paid`);
        callbacks.onShowToast('Receipt Downloaded', `Saved receipt ${num} as PDF.`, 'success');
      });
    });
  }

  btnAnnual?.addEventListener('click', () => {
    mockDownloadPDF(
      'dezignet-2026-annual-earnings-statement.pdf',
      'DEZIGNET STUDIO FINANCIAL REPORT\nYear: 2026\nGross Revenue: $148,200.00\nNet Disbursed: $138,450.00'
    );
    callbacks.onShowToast('Statement Downloaded', '2026 Annual Earnings Statement generated.', 'success');
  });

  function mockDownloadPDF(filename: string, content: string) {
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  load();
}
