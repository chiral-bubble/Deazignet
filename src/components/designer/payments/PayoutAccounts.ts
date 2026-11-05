/**
 * PayoutAccounts Component (US Market Spec)
 * Placeholder implementation:
 * - "Payout setup is handled securely by our payment provider and will be available soon."
 * - "Tax information is required before your first payout."
 * - Never collects or stores bank or routing numbers in the app.
 */

import { getWithdrawals } from '../../../services/paymentsService';
import { formatMoney, formatDate } from '../../../utils/formatters';
import { supabase } from '../../../lib/supabase';

export function renderPayoutAccounts(): string {
  return `
    <div class="dez-payouts-section">
      <!-- Payout Setup Status Banner -->
      <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
        <div style="display: flex; gap: 16px; align-items: flex-start;">
          <div style="width: 40px; height: 40px; border-radius: 8px; background: #F7F7F8; border: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #2F7BE5;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          </div>
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">Direct Deposit & Payout Setup</h2>
            <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; margin: 0 0 12px 0;">
              Payout setup is handled securely by our payment provider and will be available soon.
            </p>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6B7280; padding: 10px 14px; background: #F7F7F8; border-radius: 6px; border: 1px solid #E5E7EB;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Tax information is required before your first payout.</span>
              <span id="tax-info-status-badge" style="margin-left: auto; font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 4px; background: #E5E7EB; color: #4B5563;">
                Status: Not provided
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Withdrawal History Table -->
      <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div style="padding: 18px 20px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Payout history</h2>
            <p style="font-size: 13px; color: #6B7280; margin: 2px 0 0 0;">Record of processed and pending earnings transfers.</p>
          </div>
        </div>

        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                <th style="padding: 12px 16px;">Date</th>
                <th style="padding: 12px 16px;">Reference</th>
                <th style="padding: 12px 16px;">Destination</th>
                <th style="padding: 12px 16px; text-align: right;">Amount</th>
                <th style="padding: 12px 16px; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody id="withdrawals-table-body">
              <tr>
                <td colspan="5" style="padding: 32px; text-align: center; color: #9CA3AF;">
                  No payout transactions recorded yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function initPayoutAccounts(
  container: HTMLElement,
  _callbacks: {
    onOpenAddModal?: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
) {
  // Fetch user tax_info_status
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    (supabase.from as any)('profiles')
      .select('tax_info_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        const badge = container.querySelector('#tax-info-status-badge');
        if (badge && data) {
          const isProvided = data.tax_info_status === 'provided';
          badge.textContent = isProvided ? 'Status: Provided' : 'Status: Not provided';
          (badge as HTMLElement).style.background = isProvided ? '#ECFDF5' : '#E5E7EB';
          (badge as HTMLElement).style.color = isProvided ? '#047857' : '#4B5563';
        }
      });
  });

  // Populate withdrawals table
  getWithdrawals().then((withdrawals) => {
    const tbody = container.querySelector('#withdrawals-table-body');
    if (!tbody) return;

    if (!withdrawals || withdrawals.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: 32px; text-align: center; color: #9CA3AF;">
            No payout transactions recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = withdrawals.map((w: any) => `
      <tr style="border-bottom: 1px solid #F3F4F6;">
        <td style="padding: 12px 16px; color: #374151;">${formatDate(w.date)}</td>
        <td style="padding: 12px 16px; font-family: monospace; font-size: 12px; color: #6B7280;">${w.reference}</td>
        <td style="padding: 12px 16px; color: #111827;">${w.destinationAccount || w.destination || 'Bank Account'}</td>
        <td style="padding: 12px 16px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: #111827;">${formatMoney(w.amount)}</td>
        <td style="padding: 12px 16px; text-align: right;">
          <span style="font-size: 11.5px; font-weight: 500; padding: 2px 8px; border-radius: 4px; ${
            String(w.status).toLowerCase() === 'paid' ? 'background: #ECFDF5; color: #047857;' :
            String(w.status).toLowerCase() === 'processing' ? 'background: #EFF6FF; color: #1D4ED8;' :
            'background: #FEF2F2; color: #991B1B;'
          }">
            ${w.status}
          </span>
        </td>
      </tr>
    `).join('');
  });
}
