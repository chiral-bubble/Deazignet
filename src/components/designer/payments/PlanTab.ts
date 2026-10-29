/**
 * PlanTab Component
 * Displays:
 * - Current plan tier badge and renewal info
 * - Monthly / Yearly toggle (with 20% discount badge)
 * - 3 plan tier cards (Free, Basic, Upgraded) with Upgrade / Downgrade / Cancel confirm dialogs
 * - Payment method form integration
 * - Plan comparison table integration
 * - Plan charges history
 */

import {
  getPlanState,
  updatePlanSubscription
} from '../../../services/paymentsService';
import { PLAN_TIERS_CONFIG, type PlanTierConfig } from '../../../config/paymentsConfig';
import { type SharedPlanState } from '../../../mocks/dataset';
import { renderPlanComparison } from './PlanComparison';
import { renderPaymentMethodCard, initPaymentMethodForm } from './PaymentMethodForm';

export function renderPlanTab(): string {
  return `
    <div class="dez-plan-tab-content" id="dez-plan-tab-root">
      <div style="padding: 40px; text-align: center; color: #6B7280;">Loading subscription plans...</div>
    </div>
  `;
}

export async function initPlanTab(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): Promise<void> {
  const root = container.querySelector('#dez-plan-tab-root') as HTMLElement;
  if (!root) return;

  let planState: SharedPlanState = await getPlanState();
  let billingCycle: 'monthly' | 'yearly' = planState.billingCycle;
  let pendingTierChange: { tier: PlanTierConfig; action: 'upgrade' | 'downgrade' | 'cancel' } | null = null;

  function render() {
    const isYearly = billingCycle === 'yearly';

    root.innerHTML = `
      <!-- Billing Cycle Toggle -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0;">Membership plans</h2>
          <p style="font-size: 13.5px; color: #6B7280; margin: 2px 0 0 0;">
            Currently on the <strong>${planState.currentPlanId.toUpperCase()}</strong> plan. Renews on ${planState.renewsAt}.
          </p>
        </div>

        <div style="display: inline-flex; align-items: center; background: #F3F4F6; padding: 4px; border-radius: 8px; border: 1px solid #E5E7EB;">
          <button
            type="button"
            class="dez-cycle-toggle-btn ${!isYearly ? 'is-active' : ''}"
            id="btn-cycle-monthly"
            style="border: none; background: ${!isYearly ? '#FFFFFF' : 'transparent'}; color: ${
      !isYearly ? '#111827' : '#6B7280'
    }; font-weight: 500; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 150ms ease; box-shadow: ${
      !isYearly ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
    };"
          >
            Monthly billing
          </button>
          <button
            type="button"
            class="dez-cycle-toggle-btn ${isYearly ? 'is-active' : ''}"
            id="btn-cycle-yearly"
            style="border: none; background: ${isYearly ? '#FFFFFF' : 'transparent'}; color: ${
      isYearly ? '#111827' : '#6B7280'
    }; font-weight: 500; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 150ms ease; display: inline-flex; align-items: center; gap: 6px; box-shadow: ${
      isYearly ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
    };"
          >
            <span>Annual billing</span>
            <span style="background: #EBF3FD; color: #2F7BE5; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Save 20%</span>
          </button>
        </div>
      </div>

      <!-- Plan Tiers Grid (3 Equal Cards) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        ${PLAN_TIERS_CONFIG.map((tier) => {
          const isCurrent = planState.currentPlanId === tier.id;
          const price = isYearly ? tier.yearlyPrice : tier.monthlyPrice;
          const billingSuffix = tier.id === 'free' ? 'forever' : isYearly ? '/year' : '/month';

          return `
            <div style="border: ${
              isCurrent ? '2px solid var(--dez-primary-blue, #2F7BE5)' : '1px solid #E5E7EB'
            }; border-radius: 8px; background: #FFFFFF; padding: 24px; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
              ${
                isCurrent
                  ? `<span class="dez-status-pill pill-blue" style="position: absolute; top: 16px; right: 16px; font-size: 11px;">Current Plan</span>`
                  : tier.popular
                  ? `<span class="dez-status-pill pill-amber" style="position: absolute; top: 16px; right: 16px; font-size: 11px;">Most Popular</span>`
                  : ''
              }

              <div>
                <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">${tier.name}</h3>
                <p style="font-size: 13px; color: #6B7280; min-height: 38px; line-height: 1.4; margin: 0 0 16px 0;">${tier.description}</p>
                
                <div style="margin-bottom: 20px;">
                  <span class="dez-tabular-num" style="font-size: 28px; font-weight: 700; color: #111827;">
                    ${tier.id === 'free' ? '$0' : `$${price.toFixed(2)}`}
                  </span>
                  <span style="font-size: 13px; color: #6B7280; margin-left: 4px;">${billingSuffix}</span>
                </div>

                <ul style="list-style: none; margin: 0 0 24px 0; padding: 0; font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 8px;">
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${tier.proposalsPerMonth} proposals per month</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${tier.escrowPlatformFeePercent}% escrow platform fee</span>
                  </li>
                </ul>
              </div>

              <div>
                ${
                  isCurrent
                    ? `<button type="button" class="dez-btn-secondary" disabled style="width: 100%; height: 38px; font-size: 13px;">Current active plan</button>`
                    : tier.id === 'free'
                    ? `<button type="button" class="dez-btn-secondary btn-plan-downgrade" data-tier-id="${tier.id}" style="width: 100%; height: 38px; font-size: 13px;">Downgrade to Free</button>`
                    : tier.id === 'basic' && planState.currentPlanId === 'upgraded'
                    ? `<button type="button" class="dez-btn-secondary btn-plan-downgrade" data-tier-id="${tier.id}" style="width: 100%; height: 38px; font-size: 13px;">Downgrade to Basic</button>`
                    : `<button type="button" class="dez-btn-primary btn-plan-upgrade" data-tier-id="${tier.id}" style="width: 100%; height: 38px; font-size: 13px;">Upgrade to ${tier.name}</button>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Payment Method Form Integration -->
      ${renderPaymentMethodCard(planState)}

      <!-- Feature Comparison Table -->
      ${renderPlanComparison()}

      <!-- Plan Charges History -->
      <div class="dez-dash-panel" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; margin-top: 32px; overflow: hidden;">
        <div style="padding: 18px 20px; border-bottom: 1px solid #E5E7EB;">
          <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Plan charges history</h3>
        </div>
        <div class="dez-table-responsive" style="overflow-x: auto;">
          <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
              <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                <th style="padding: 12px 16px;">Date</th>
                <th style="padding: 12px 16px;">Description</th>
                <th style="padding: 12px 16px;">Card</th>
                <th style="padding: 12px 16px; text-align: right;">Amount</th>
                <th style="padding: 12px 16px; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #F3F4F6;">
                <td style="padding: 12px 16px; color: #6B7280;">Oct 1, 2026</td>
                <td style="padding: 12px 16px; font-weight: 500; color: #111827;">Annual Membership — Upgraded Studio Tier</td>
                <td style="padding: 12px 16px; color: #4B5563;">Visa •••• 4242</td>
                <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; font-weight: 600; color: #111827;">$479.90</td>
                <td style="padding: 12px 16px; text-align: right;"><span class="dez-status-pill pill-green">Paid</span></td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; color: #6B7280;">Oct 1, 2025</td>
                <td style="padding: 12px 16px; font-weight: 500; color: #111827;">Annual Membership — Basic Studio Tier</td>
                <td style="padding: 12px 16px; color: #4B5563;">Visa •••• 4242</td>
                <td class="dez-tabular-num" style="padding: 12px 16px; text-align: right; font-weight: 600; color: #111827;">$287.90</td>
                <td style="padding: 12px 16px; text-align: right;"><span class="dez-status-pill pill-green">Paid</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Plan Change Confirmation Dialog -->
      <div class="dez-dash-modal-backdrop" id="modal-plan-confirm-backdrop" style="display: none;" role="dialog" aria-modal="true">
        <div class="dez-dash-modal" style="max-width: 440px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-plan-confirm-title">Confirm Plan Change</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-plan-confirm">&times;</button>
          </div>
          <div class="dez-dash-modal-body" style="padding: 20px 24px;">
            <p style="font-size: 13.5px; color: #374151; line-height: 1.5; margin: 0 0 12px 0;" id="plan-confirm-description">
            </p>
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; font-size: 12.5px; color: #4B5563;" id="plan-confirm-effective-note">
            </div>
          </div>
          <div class="dez-dash-modal-footer" style="padding: 14px 24px; border-top: 1px solid #E5E7EB; display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-plan-confirm" style="height: 36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-proceed-plan-confirm" style="height: 36px; padding: 0 18px;">
              Confirm change
            </button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    root.querySelector('#btn-cycle-monthly')?.addEventListener('click', () => {
      billingCycle = 'monthly';
      render();
    });

    root.querySelector('#btn-cycle-yearly')?.addEventListener('click', () => {
      billingCycle = 'yearly';
      render();
    });

    initPaymentMethodForm(root, {
      onSaveCard: async (brand, last4) => {
        planState.paymentMethod = {
          brand,
          last4,
          expMonth: 12,
          expYear: 2028,
          isDefault: true
        };
        render();
      },
      onRemoveCard: async () => {
        (planState as any).paymentMethod = null;
        render();
      },
      onShowToast: callbacks.onShowToast
    });

    const confirmModal = root.querySelector('#modal-plan-confirm-backdrop') as HTMLElement;
    const confirmTitle = root.querySelector('#modal-plan-confirm-title') as HTMLElement;
    const confirmDesc = root.querySelector('#plan-confirm-description') as HTMLElement;
    const confirmNote = root.querySelector('#plan-confirm-effective-note') as HTMLElement;
    const btnProceed = root.querySelector('#btn-proceed-plan-confirm') as HTMLButtonElement;
    const btnCloseModal = root.querySelector('#btn-close-plan-confirm');
    const btnCancelModal = root.querySelector('#btn-cancel-plan-confirm');

    function openConfirm(tier: PlanTierConfig, action: 'upgrade' | 'downgrade' | 'cancel') {
      pendingTierChange = { tier, action };
      if (!confirmModal) return;

      if (action === 'upgrade') {
        confirmTitle.textContent = `Upgrade to ${tier.name}?`;
        confirmDesc.textContent = `You are switching to the ${tier.name} tier (${billingCycle}). You will immediately gain ${tier.proposalsPerMonth} monthly proposals and reduced platform escrow fees of ${tier.escrowPlatformFeePercent}%.`;
        confirmNote.innerHTML = `<strong>Effective immediately:</strong> Any unused billing from your current cycle will be prorated.`;
      } else {
        confirmTitle.textContent = `Downgrade to ${tier.name}?`;
        confirmDesc.textContent = `You are changing to the ${tier.name} tier. Your platform fee will adjust to ${tier.escrowPlatformFeePercent}% and monthly proposals will be capped at ${tier.proposalsPerMonth}.`;
        confirmNote.innerHTML = `<strong>Effective at renewal:</strong> Your current benefits remain active until ${planState.renewsAt}.`;
      }

      confirmModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeConfirm() {
      if (confirmModal) {
        confirmModal.style.display = 'none';
        document.body.style.overflow = '';
        pendingTierChange = null;
      }
    }

    btnCloseModal?.addEventListener('click', closeConfirm);
    btnCancelModal?.addEventListener('click', closeConfirm);

    btnProceed?.addEventListener('click', async () => {
      if (pendingTierChange) {
        await updatePlanSubscription(pendingTierChange.tier.id, billingCycle);
        planState = await getPlanState();
        closeConfirm();
        callbacks.onShowToast('Plan Updated', `Successfully updated subscription to ${pendingTierChange.tier.name}.`, 'success');
        render();
      }
    });

    root.querySelectorAll<HTMLButtonElement>('.btn-plan-upgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-tier-id');
        const tier = PLAN_TIERS_CONFIG.find((t) => t.id === id);
        if (tier) openConfirm(tier, 'upgrade');
      });
    });

    root.querySelectorAll<HTMLButtonElement>('.btn-plan-downgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-tier-id');
        const tier = PLAN_TIERS_CONFIG.find((t) => t.id === id);
        if (tier) openConfirm(tier, 'downgrade');
      });
    });
  }

  render();
}
