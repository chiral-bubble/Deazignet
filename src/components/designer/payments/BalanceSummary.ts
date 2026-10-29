/**
 * BalanceSummary Component
 * Displays the 4-block bordered financial container, Withdraw CTA,
 * Coming up milestones, and recent 5 transactions list.
 */

import { type PaymentsOverviewData } from '../../../services/paymentsService';
import { formatMoney } from '../../../utils/formatters';

export function renderBalanceSummary(data: PaymentsOverviewData): string {
  const { balances, upcomingMilestones, recentTransactions, hasPayoutAccount, minWithdrawal } = data;
  const canWithdraw = balances.availableToWithdraw >= minWithdrawal && hasPayoutAccount;

  return `
    <div class="dez-payments-overview-section">
      <!-- 4 Equal Metric Blocks in One Bordered Container -->
      <div class="dez-balances-card-container">
        <div class="dez-balances-grid">
          <!-- Available to withdraw -->
          <div class="dez-balance-block">
            <div class="dez-balance-header">
              <span class="dez-balance-indicator dez-indicator-green" aria-hidden="true"></span>
              <span class="dez-balance-label">Available to withdraw</span>
            </div>
            <div class="dez-balance-value dez-tabular-num">$${formatMoney(balances.availableToWithdraw)}</div>
            <p class="dez-balance-hint">Cleared earnings available for immediate bank transfer</p>
          </div>

          <!-- Pending release -->
          <div class="dez-balance-block">
            <div class="dez-balance-header">
              <span class="dez-balance-indicator dez-indicator-blue" aria-hidden="true"></span>
              <span class="dez-balance-label">Pending release</span>
            </div>
            <div class="dez-balance-value dez-tabular-num">$${formatMoney(balances.pendingRelease)}</div>
            <p class="dez-balance-hint">Waiting on client approval of submitted deliverables</p>
          </div>

          <!-- In escrow -->
          <div class="dez-balance-block">
            <div class="dez-balance-header">
              <span class="dez-balance-indicator dez-indicator-amber" aria-hidden="true"></span>
              <span class="dez-balance-label">In escrow</span>
            </div>
            <div class="dez-balance-value dez-tabular-num">$${formatMoney(balances.inEscrow)}</div>
            <p class="dez-balance-hint">Client-funded milestone deposits not yet completed</p>
          </div>

          <!-- Total earned -->
          <div class="dez-balance-block">
            <div class="dez-balance-header">
              <span class="dez-balance-indicator dez-indicator-neutral" aria-hidden="true"></span>
              <span class="dez-balance-label">Total earned</span>
            </div>
            <div class="dez-balance-value dez-tabular-num">$${formatMoney(balances.totalEarned)}</div>
            <p class="dez-balance-hint">Lifetime gross earnings across all accepted commissions</p>
          </div>
        </div>

        <div class="dez-balances-action-bar">
          <div class="dez-balances-status-note">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
            ${
              !hasPayoutAccount
                ? `<span class="dez-balance-warn-text">No payout account linked yet. <button type="button" class="dez-inline-link-btn" id="btn-jump-add-payout">Add payout bank account</button> to enable transfers.</span>`
                : balances.availableToWithdraw < minWithdrawal
                ? `<span class="dez-balance-muted-text">Minimum withdrawal amount is $${minWithdrawal.toFixed(2)}.</span>`
                : `<span class="dez-balance-success-text">Funds are ready for settlement &bull; Direct deposits & ACH transfer in 1–2 business days</span>`
            }
          </div>

          <div class="dez-balances-buttons">
            <button
              type="button"
              class="dez-btn-primary"
              id="btn-trigger-withdraw"
              ${!canWithdraw ? 'disabled aria-disabled="true"' : ''}
              style="height: 40px; padding: 0 22px; width: auto; font-weight: 500;"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Withdraw funds
            </button>
          </div>
        </div>
      </div>

      <!-- Two Columns: Coming Up + Recent Transactions -->
      <div class="dez-payments-overview-columns">
        <!-- Coming Up Column -->
        <div class="dez-overview-card">
          <div class="dez-overview-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <h2 class="dez-overview-card-title">Coming up</h2>
            </div>
            <span style="font-size: 12.5px; color: #6B7280; font-weight: 500;">Milestone projections</span>
          </div>

          ${
            upcomingMilestones.length === 0
              ? `
              <div class="dez-empty-compact" style="padding: 36px 0; text-align: center; color: #6B7280; font-size: 13.5px;">
                No milestone payments awaiting release right now.
              </div>
            `
              : `
              <ul class="dez-upcoming-milestones-list" style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;">
                ${upcomingMilestones
                  .map(
                    (m) => `
                  <li class="dez-upcoming-milestone-item">
                    <div style="min-width: 0;">
                      <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${m.milestoneTitle}
                      </div>
                      <div style="font-size: 12.5px; color: #6B7280; display: flex; align-items: center; gap: 6px;">
                        <span>${m.projectName}</span>
                        <span>&bull;</span>
                        <span style="color: #4B5563;">Est. release ${m.estReleaseDate}</span>
                      </div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0;">
                      <div class="dez-tabular-num" style="font-size: 15px; font-weight: 700; color: #111827;">+$${formatMoney(m.amount)}</div>
                      <span class="dez-status-pill pill-amber" style="font-size: 11px; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 3px;">
                        ${m.statusText}
                      </span>
                    </div>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            `
          }
        </div>

        <!-- Recent Transactions Column -->
        <div class="dez-overview-card">
          <div class="dez-overview-card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <h2 class="dez-overview-card-title">Recent transactions</h2>
            </div>
            <button type="button" class="dez-inline-link-btn" id="btn-view-all-transactions" style="font-size: 13px; color: #2F7BE5; background: none; border: none; cursor: pointer; font-weight: 500;">
              View all &rarr;
            </button>
          </div>

          ${
            recentTransactions.length === 0
              ? `
              <div class="dez-empty-compact" style="padding: 36px 0; text-align: center; color: #6B7280; font-size: 13.5px;">
                No transactions recorded yet.
              </div>
            `
              : `
              <ul class="dez-recent-tx-list" style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px;">
                ${recentTransactions
                  .map((tx) => {
                    const isWithdraw = tx.type === 'Withdrawal';
                    const isCharge = tx.type === 'Plan charge';
                    const isIncoming = !isWithdraw && !isCharge;

                    return `
                  <li class="dez-recent-tx-row" data-open-tx-id="${tx.id}">
                    <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
                      <div class="dez-tx-icon-bubble ${isIncoming ? 'dez-tx-icon-incoming' : isWithdraw ? 'dez-tx-icon-outgoing' : 'dez-tx-icon-charge'}">
                        ${
                          isIncoming
                            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`
                            : isWithdraw
                            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`
                            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
                        }
                      </div>
                      <div style="min-width: 0;">
                        <div style="font-size: 13.5px; font-weight: 500; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                          ${tx.description}
                        </div>
                        <div style="font-size: 12px; color: #6B7280; margin-top: 1px;">
                          ${tx.date} &bull; <span style="color: #4B5563;">${tx.type}</span>
                        </div>
                      </div>
                    </div>
                    <div style="text-align: right; flex-shrink: 0; padding-left: 12px;">
                      <div class="dez-tabular-num" style="font-size: 14px; font-weight: 600; color: ${tx.netAmount < 0 ? '#DC2626' : '#111827'};">
                        ${tx.netAmount < 0 ? '-' : '+'}$${formatMoney(Math.abs(tx.netAmount))}
                      </div>
                      <span class="dez-status-pill ${
                        tx.status === 'Completed'
                          ? 'pill-green'
                          : tx.status === 'Held'
                          ? 'pill-amber'
                          : tx.status === 'Pending'
                          ? 'pill-blue'
                          : 'pill-grey'
                      }" style="font-size: 11px; padding: 2px 7px; border-radius: 4px; display: inline-block; margin-top: 2px;">
                        ${tx.status}
                      </span>
                    </div>
                  </li>
                `;
                  })
                  .join('')}
              </ul>
            `
          }
        </div>
      </div>
    </div>
  `;
}

export function initBalanceSummary(
  container: HTMLElement,
  callbacks: {
    onOpenWithdraw: () => void;
    onJumpPayouts: () => void;
    onJumpTransactions: () => void;
    onSelectTransaction?: (txId: string) => void;
  }
): void {
  const btnWithdraw = container.querySelector('#btn-trigger-withdraw');
  btnWithdraw?.addEventListener('click', () => {
    callbacks.onOpenWithdraw();
  });

  const btnAddPayout = container.querySelector('#btn-jump-add-payout');
  btnAddPayout?.addEventListener('click', () => {
    callbacks.onJumpPayouts();
  });

  const btnViewAll = container.querySelector('#btn-view-all-transactions');
  btnViewAll?.addEventListener('click', () => {
    callbacks.onJumpTransactions();
  });

  // Recent transaction row click opens breakdown drawer
  container.querySelectorAll('[data-open-tx-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const txId = row.getAttribute('data-open-tx-id');
      if (txId && callbacks.onSelectTransaction) {
        callbacks.onSelectTransaction(txId);
      }
    });
  });
}
