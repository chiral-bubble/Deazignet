/**
 * FinancialSection.ts
 * Financial Actions & Refunds Queue: approval workflows and enforcement of the two-person rule for items > $1,000.
 */

import {
  adminGetFinancialActions,
  adminApproveFinancialAction,
  adminRejectFinancialAction,
  adminExecuteFinancialAction,
  type FinancialActionItem
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { ensureRecentAuth } from './ApprovalDialog';
import { formatUSD } from '../../services/usMarketService';

export async function renderFinancialSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Refunds & Financial Actions Queue
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Review pending disbursements, contract refunds, and fee adjustments. Transactions exceeding $1,000 require verification by two administrators.
          </p>
        </div>
        <button id="fin-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh Queue
        </button>
      </div>

      <!-- Two-Person Rule Banner -->
      <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
        <div style="width: 32px; height: 32px; border-radius: 50%; background: #DBEAFE; color: #1D4ED8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
        </div>
        <div style="font-size: 13px; color: #1E40AF; line-height: 1.5;">
          <strong>Two-Person Dual Control Rule:</strong> Financial actions exceeding <strong>$1,000.00</strong> require independent approval by two distinct administrative team members before disbursement execution is permitted.
        </div>
      </div>

      <!-- Filter Tabs -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 10px;">
        <button class="fin-filter-btn" data-status="all" style="background: none; border: 1px solid transparent; font-size: 13px; font-weight: 600; color: #2563EB; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          All Actions
        </button>
        <button class="fin-filter-btn" data-status="pending" style="background: #F1F5F9; border: 1px solid #CBD5E1; font-size: 13px; font-weight: 500; color: #0F172A; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          Pending Approval
        </button>
        <button class="fin-filter-btn" data-status="approved" style="background: none; border: 1px solid transparent; font-size: 13px; font-weight: 500; color: #64748B; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          Approved (Ready to Execute)
        </button>
        <button class="fin-filter-btn" data-status="executed" style="background: none; border: 1px solid transparent; font-size: 13px; font-weight: 500; color: #64748B; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          Executed
        </button>
      </div>

      <!-- Financial Table -->
      <div id="fin-table-container" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading financial queue...</div>
      </div>
    </div>
  `;

  let currentStatusFilter = 'pending';
  const refreshBtn = container.querySelector('#fin-refresh-btn') as HTMLButtonElement;
  const tableContainer = container.querySelector('#fin-table-container') as HTMLElement;
  const filterBtns = container.querySelectorAll('.fin-filter-btn');

  async function loadFinancialActions() {
    tableContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading financial queue...</div>';
    try {
      const actions: FinancialActionItem[] = await adminGetFinancialActions(currentStatusFilter);

      if (actions.length === 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">No financial records found in this queue.</div>';
        return;
      }

      tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
              <th style="padding: 12px 16px;">Action & Engagement</th>
              <th style="padding: 12px 16px;">Amount</th>
              <th style="padding: 12px 16px;">Two-Person Rule</th>
              <th style="padding: 12px 16px;">Approval Status</th>
              <th style="padding: 12px 16px; text-align: right;">Workflow Actions</th>
            </tr>
          </thead>
          <tbody>
            ${actions.map(a => `
              <tr style="border-bottom: 1px solid #F1F5F9;">
                <td style="padding: 12px 16px; max-width: 300px;">
                  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                    <span style="font-weight: 600; text-transform: uppercase; font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${a.type === 'refund' ? '#FEE2E2; color: #DC2626;' : '#DCFCE7; color: #15803D;'}">
                      ${a.type.replace('_', ' ')}
                    </span>
                    <span style="font-size: 11px; color: #94A3B8;">${new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style="font-weight: 500; color: #0F172A;">${a.projectTitle || 'Contract Engagement'}</div>
                  ${a.notes ? `<div style="font-size: 11px; color: #64748B; margin-top: 4px; font-style: italic;">${a.notes}</div>` : ''}
                </td>
                <td style="padding: 12px 16px;">
                  <div style="font-size: 16px; font-weight: 700; color: #0F172A;">
                    ${formatUSD(a.amountCents / 100)}
                  </div>
                </td>
                <td style="padding: 12px 16px;">
                  ${a.requiresTwoPersonApproval ? `
                    <span style="background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      Required (> $1,000)
                    </span>
                  ` : `
                    <span style="color: #64748B; font-size: 12px;">Single Admin</span>
                  `}
                </td>
                <td style="padding: 12px 16px;">
                  <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: ${a.status === 'executed' ? '#DCFCE7; color: #15803D;' : a.status === 'approved' ? '#E0F2FE; color: #0284C7;' : a.status === 'rejected' ? '#FEE2E2; color: #DC2626;' : '#FEF3C7; color: #D97706;'}">
                    ${a.status}
                  </span>
                  <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
                    ${a.approvedByEmail ? `1st: <strong>${a.approvedByEmail}</strong>` : 'No approvals yet'}
                    ${a.secondApprovedByEmail ? `<br>2nd: <strong>${a.secondApprovedByEmail}</strong>` : (a.requiresTwoPersonApproval && a.status === 'pending' && a.approvedByEmail ? '<br><span style="color: #D97706;">Awaiting 2nd admin</span>' : '')}
                  </div>
                </td>
                <td style="padding: 12px 16px; text-align: right;">
                  <div style="display: inline-flex; gap: 6px;">
                    ${a.status === 'pending' ? `
                      <button class="btn-fin-approve" data-id="${a.id}" data-amount="${a.amountCents}" style="background: #059669; border: none; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                        Approve
                      </button>
                      <button class="btn-fin-reject" data-id="${a.id}" style="background: #FFFFFF; border: 1px solid #FCA5A5; color: #DC2626; font-size: 12px; font-weight: 500; padding: 6px 10px; border-radius: 6px; cursor: pointer;">
                        Reject
                      </button>
                    ` : ''}
                    ${a.status === 'approved' ? `
                      <button class="btn-fin-execute" data-id="${a.id}" data-amount="${a.amountCents}" style="background: #2563EB; border: none; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 6px; cursor: pointer;">
                        Execute Payout
                      </button>
                    ` : ''}
                    ${a.status === 'executed' ? `
                      <span style="font-size: 12px; color: #059669; font-weight: 600;">Disbursed ${new Date(a.executedAt || '').toLocaleDateString()}</span>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      attachFinancialEvents();
    } catch (err: any) {
      tableContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachFinancialEvents() {
    // Approve Action
    tableContainer.querySelectorAll('.btn-fin-approve').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const amountCents = Number(btn.getAttribute('data-amount'));

        // MFA Re-Authentication Gate
        const authed = await ensureRecentAuth(`Approve financial transaction: ${formatUSD(amountCents / 100)}`);
        if (!authed) return;

        const notes = window.prompt(`Enter approval note for ${formatUSD(amountCents / 100)}:`, 'Approved in accordance with contract review');
        if (notes === null) return;

        try {
          const res = await adminApproveFinancialAction(id, notes);
          if (res.requiresSecondApproval) {
            alert(`First approval recorded successfully.\n\nBecause this amount exceeds the $1,000 threshold, this transaction remains pending until a second administrator approves it.`);
          } else {
            alert('Transaction fully approved and ready for execution.');
          }
          await loadFinancialActions();
        } catch (err: any) {
          alert('Approval failed: ' + err.message);
        }
      });
    });

    // Reject Action
    tableContainer.querySelectorAll('.btn-fin-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;

        const reason = await showReasonDialog({
          title: 'Reject Financial Action',
          subtitle: 'Rejects the requested disbursement or refund.',
          promptLabel: 'Mandatory Justification for Rejection (min 5 characters)',
          placeholder: 'Explain why payout or refund was denied...',
          danger: true
        });

        if (!reason) return;

        try {
          await adminRejectFinancialAction(id, reason);
          alert('Financial action rejected.');
          await loadFinancialActions();
        } catch (err: any) {
          alert('Rejection failed: ' + err.message);
        }
      });
    });

    // Execute Action
    tableContainer.querySelectorAll('.btn-fin-execute').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const amountCents = Number(btn.getAttribute('data-amount'));

        const authed = await ensureRecentAuth(`Execute financial payout of ${formatUSD(amountCents / 100)}`);
        if (!authed) return;

        const confirmed = window.confirm(`Confirm immediate disbursement execution for ${formatUSD(amountCents / 100)}?`);
        if (!confirmed) return;

        try {
          await adminExecuteFinancialAction(id);
          alert('Disbursement executed successfully.');
          await loadFinancialActions();
        } catch (err: any) {
          alert('Execution failed: ' + err.message);
        }
      });
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        (b as HTMLElement).style.background = 'none';
        (b as HTMLElement).style.color = '#64748B';
        (b as HTMLElement).style.borderColor = 'transparent';
      });
      (btn as HTMLElement).style.background = '#F1F5F9';
      (btn as HTMLElement).style.color = '#0F172A';
      (btn as HTMLElement).style.borderColor = '#CBD5E1';

      currentStatusFilter = btn.getAttribute('data-status')!;
      loadFinancialActions();
    });
  });

  refreshBtn.addEventListener('click', () => loadFinancialActions());
  loadFinancialActions();
}
