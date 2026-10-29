/**
 * TransactionDrawer Component
 * Slides out from right with full breakdown:
 * - Gross amount
 * - Platform fee & percentage
 * - Net payout amount
 * - Project and milestone reference
 * - Status explanation (e.g. Held notes, Disputed notes)
 * - Reference ID
 * - Timeline of status transitions
 * - Focus trap & keyboard accessibility (Esc to close)
 */

import { type SharedTransaction } from '../../../mocks/dataset';
import { formatMoney } from '../../../utils/formatters';

export function renderTransactionDrawer(): string {
  return `
    <div class="dez-drawer-backdrop" id="tx-drawer-backdrop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="tx-drawer-title">
      <div class="dez-drawer-panel" id="tx-drawer-panel" tabindex="-1">
        <div class="dez-drawer-header">
          <div>
            <span class="dez-drawer-pretitle" id="tx-drawer-type">Transaction Details</span>
            <h3 class="dez-drawer-title" id="tx-drawer-title">Reference</h3>
          </div>
          <button type="button" class="dez-drawer-close" id="btn-close-tx-drawer" aria-label="Close details">&times;</button>
        </div>

        <div class="dez-drawer-body" id="tx-drawer-content">
          <!-- Filled dynamically -->
        </div>

        <div class="dez-drawer-footer">
          <button type="button" class="dez-btn-secondary" id="btn-done-tx-drawer" style="width: 100%;">Close</button>
        </div>
      </div>
    </div>
  `;
}

export function initTransactionDrawer(container: HTMLElement): {
  open: (tx: SharedTransaction) => void;
  close: () => void;
} {
  const backdrop = container.querySelector('#tx-drawer-backdrop') as HTMLElement;
  const panel = container.querySelector('#tx-drawer-panel') as HTMLElement;
  const closeBtn = container.querySelector('#btn-close-tx-drawer') as HTMLButtonElement;
  const doneBtn = container.querySelector('#btn-done-tx-drawer') as HTMLButtonElement;
  const content = container.querySelector('#tx-drawer-content') as HTMLElement;
  const title = container.querySelector('#tx-drawer-title') as HTMLElement;
  const type = container.querySelector('#tx-drawer-type') as HTMLElement;

  let lastActiveElement: HTMLElement | null = null;

  function close() {
    if (!backdrop || !panel) return;
    backdrop.style.display = 'none';
    panel.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastActiveElement) {
      lastActiveElement.focus();
    }
  }

  function open(tx: SharedTransaction) {
    if (!backdrop || !panel || !content) return;
    lastActiveElement = document.activeElement as HTMLElement;

    if (title) title.textContent = tx.referenceId;
    if (type) type.textContent = tx.type;

    content.innerHTML = `
      <!-- Financial Breakdown Card -->
      <div class="dez-drawer-card" style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px; text-transform: none;">Amount breakdown</div>
        
        <div style="display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 6px; color: #4B5563;">
          <span>Gross amount</span>
          <span class="dez-tabular-num" style="font-weight: 500; color: #111827;">$${formatMoney(Math.abs(tx.grossAmount))}</span>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 8px; color: #4B5563;">
          <span>Platform fee (${tx.feePercentage}%)</span>
          <span class="dez-tabular-num" style="font-weight: 500; color: #DC2626;">-$${formatMoney(tx.feeAmount)}</span>
        </div>

        <div style="height: 1px; background: #E5E7EB; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 600; color: #111827;">
          <span>Net ${tx.netAmount < 0 ? 'debited' : 'credited'}</span>
          <span class="dez-tabular-num" style="color: ${tx.netAmount < 0 ? '#DC2626' : '#111827'};">
            ${tx.netAmount < 0 ? '-' : '+'}$${formatMoney(Math.abs(tx.netAmount))}
          </span>
        </div>
      </div>

      <!-- Status & Note -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 12px; color: #6B7280; margin-bottom: 6px;">Status</div>
        <div style="display: flex; align-items: center; gap: 8px;">
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
          <span style="font-size: 13px; color: #4B5563;">${tx.date}</span>
        </div>

        ${
          tx.statusNote
            ? `
          <div style="margin-top: 10px; background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 10px 12px; font-size: 12.5px; color: #92400E; line-height: 1.4;">
            <strong>Note:</strong> ${tx.statusNote}
          </div>
        `
            : ''
        }
      </div>

      <!-- Project & Milestone Details -->
      <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-bottom: 20px;">
        <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">Associated project & milestone</div>
        <div style="font-size: 13.5px; font-weight: 500; color: #111827;">
          ${tx.projectName || 'Dezignet Direct Platform'}
        </div>
        ${
          tx.milestoneTitle
            ? `<div style="font-size: 12.5px; color: #6B7280; margin-top: 2px;">${tx.milestoneTitle}</div>`
            : ''
        }
        ${
          tx.payoutAccountMasked
            ? `<div style="font-size: 12.5px; color: #4B5563; margin-top: 4px;">Destination: ${tx.payoutAccountMasked}</div>`
            : ''
        }
      </div>

      <!-- Timeline of Status Changes -->
      <div style="border-top: 1px solid #E5E7EB; padding-top: 16px;">
        <div style="font-size: 12px; color: #6B7280; margin-bottom: 12px;">Activity timeline</div>
        <ul style="list-style: none; margin: 0; padding: 0 0 0 12px; border-left: 2px solid #E5E7EB; display: flex; flex-direction: column; gap: 14px;">
          ${(tx.timeline || [
            { event: 'Transaction initiated', timestamp: tx.date },
            { event: `Status updated to ${tx.status}`, timestamp: tx.date }
          ])
            .map(
              (item) => `
            <li style="position: relative; font-size: 12.5px;">
              <span style="position: absolute; left: -18px; top: 3px; width: 8px; height: 8px; border-radius: 50%; background: #2F7BE5;"></span>
              <div style="font-weight: 500; color: #111827;">${item.event}</div>
              <div style="font-size: 11.5px; color: #6B7280; margin-top: 1px;">${item.timestamp}</div>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;

    backdrop.style.display = 'flex';
    setTimeout(() => {
      panel.classList.add('is-open');
      panel.focus();
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  closeBtn?.addEventListener('click', close);
  doneBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && backdrop.style.display !== 'none') {
      close();
    }
  });

  return { open, close };
}
