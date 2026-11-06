/**
 * PlanTab Component (US Market Spec)
 * - Computed annual savings (~17%)
 * - Plan cards driven from spec data
 * - "Estimate your fee" box comparing plans via calculatePlatformFee
 * - Downgrade & Cancel dialogs with exact loss notices
 * - US Date formatting
 */

import { getPlanState, updatePlanSubscription, updatePlanPaymentCard } from '../../../services/paymentsService';
import { PLAN_TIERS_CONFIG, type PlanTierConfig } from '../../../config/paymentsConfig';
import { type SharedPlanState } from '../../../mocks/dataset';
import { renderPlanComparison } from './PlanComparison';
import { renderPaymentMethodCard, initPaymentMethodForm } from './PaymentMethodForm';
import { calculatePlatformFeeFallback, computeAnnualSavings } from '../../../services/plansService';
import { formatUSD } from '../../../services/usMarketService';

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

  // Compute annual savings
  const annualSavingsPercent = computeAnnualSavings(2999, 29900); // 17%

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
            }; font-weight: 500; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 150ms ease;"
          >
            Monthly billing
          </button>
          <button
            type="button"
            class="dez-cycle-toggle-btn ${isYearly ? 'is-active' : ''}"
            id="btn-cycle-yearly"
            style="border: none; background: ${isYearly ? '#FFFFFF' : 'transparent'}; color: ${
              isYearly ? '#111827' : '#6B7280'
            }; font-weight: 500; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 150ms ease; display: inline-flex; align-items: center; gap: 6px;"
          >
            <span>Annual billing</span>
            <span style="background: #EBF3FD; color: #2F7BE5; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">Save ${annualSavingsPercent}%</span>
          </button>
        </div>
      </div>

      <!-- Plan Tiers Grid (3 Cards) -->
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
                  : tier.badge
                  ? `<span class="dez-status-pill pill-amber" style="position: absolute; top: 16px; right: 16px; font-size: 11px;">${tier.badge}</span>`
                  : ''
              }

              <div>
                <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">${tier.name}</h3>
                <p style="font-size: 13px; color: #6B7280; min-height: 38px; line-height: 1.4; margin: 0 0 16px 0;">${tier.description}</p>
                
                <div style="margin-bottom: 20px;">
                  <span class="dez-tabular-num" style="font-size: 28px; font-weight: 700; color: #111827;">
                    ${tier.id === 'free' ? '$0' : formatUSD(price)}
                  </span>
                  <span style="font-size: 13px; color: #6B7280; margin-left: 4px;">${billingSuffix}</span>
                </div>

                <ul style="list-style: none; margin: 0 0 24px 0; padding: 0; font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 8px;">
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${tier.proposalsPerMonth === null ? 'Unlimited proposals' : `${tier.proposalsPerMonth} proposals per month`}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Platform service fee: ${tier.platformFeeText}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${tier.id === 'free' ? '#9CA3AF' : '#2F7BE5'}" stroke-width="2.5">
                      ${tier.id === 'free' ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' : '<polyline points="20 6 9 17 4 12"/>'}
                    </svg>
                    <span>${tier.id === 'free' ? 'Not listed in client directory' : tier.id === 'upgraded' ? 'Priority client directory placement' : 'Client directory listing'}</span>
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

      <!-- Estimate Your Fee Box -->
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-top: 28px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">Estimate your fee</h3>
        <p style="font-size: 13px; color: #6B7280; margin: 0 0 16px 0;">
          Enter a milestone amount to compare platform service fees and net payout under each plan.
        </p>
        <div style="display: flex; gap: 10px; align-items: center; max-width: 320px; margin-bottom: 16px;">
          <span style="font-weight: 600; color: #374151;">$</span>
          <input 
            type="number" 
            id="inp-milestone-estimator" 
            value="5000" 
            min="100" 
            step="100" 
            style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 14px; font-variant-numeric: tabular-nums; background: #FFFFFF;" 
          />
        </div>
        <div id="fee-estimator-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Payment Method Form Integration -->
      ${renderPaymentMethodCard(planState)}

      <!-- Feature Comparison Table -->
      ${renderPlanComparison()}

      <!-- Downgrade Confirm Dialog -->
      <div class="dez-dash-modal-backdrop" id="modal-plan-confirm-backdrop" style="display: none;" role="dialog" aria-modal="true">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-plan-confirm-title">Plan Change</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-plan-modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size: 13.5px; color: #374151; line-height: 1.5;" id="modal-plan-confirm-body"></p>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-plan-change">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-confirm-plan-change">Confirm</button>
          </div>
        </div>
      </div>
    `;

    bindEvents();
    updateFeeEstimator(5000);
  }

  function updateFeeEstimator(amountDollars: number) {
    const container = root.querySelector('#fee-estimator-cards');
    if (!container) return;

    const amountCents = Math.round(amountDollars * 100);
    const plans = ['free', 'basic', 'upgraded'];
    
    container.innerHTML = plans.map(pKey => {
      const res = calculatePlatformFeeFallback(pKey, amountCents);
      const isCurrent = planState.currentPlanId === pKey;
      return `
        <div style="background: #FFFFFF; border: ${isCurrent ? '1.5px solid #2F7BE5' : '1px solid #E5E7EB'}; border-radius: 6px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 600; font-size: 14px; color: #111827; text-transform: capitalize;">${pKey}</span>
            <span style="font-size: 11.5px; color: #6B7280; font-weight: 500;">${res.rate_percent}% fee</span>
          </div>
          <div style="margin-bottom: 6px; font-size: 13px; color: #4B5563;">
            Platform fee: <strong style="color: #111827;">${formatUSD(res.fee_cents / 100)}</strong>
          </div>
          <div style="font-size: 14px; color: #047857; font-weight: 600;">
            Net payout: ${formatUSD(res.net_cents / 100)}
          </div>
        </div>
      `;
    }).join('');
  }

  function bindEvents() {
    // Estimator input
    const estInput = root.querySelector('#inp-milestone-estimator') as HTMLInputElement;
    estInput?.addEventListener('input', () => {
      const val = parseFloat(estInput.value) || 0;
      updateFeeEstimator(val);
    });

    // Cycle toggles
    root.querySelector('#btn-cycle-monthly')?.addEventListener('click', () => {
      billingCycle = 'monthly';
      render();
    });
    root.querySelector('#btn-cycle-yearly')?.addEventListener('click', () => {
      billingCycle = 'yearly';
      render();
    });

    // Downgrade / Upgrade buttons
    root.querySelectorAll('.btn-plan-downgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.getAttribute('data-tier-id') as 'free' | 'basic';
        const tier = PLAN_TIERS_CONFIG.find((t) => t.id === tierId);
        if (!tier) return;

        pendingTierChange = { tier, action: 'downgrade' };
        openConfirmModal(
          `Downgrade to ${tier.name}`,
          tier.id === 'free'
            ? `Are you sure you want to downgrade to the Free plan? At the end of your billing period (${planState.renewsAt}):
               <br/><br/>
               • Your studio profile and portfolio will be removed from client directory search.<br/>
               • Portfolio images will be hidden (preserved for when you upgrade).<br/>
               • Monthly proposal limit will decrease to 5 proposals.<br/>
               • Active engagements and existing submitted proposals will continue normally.`
            : `Are you sure you want to switch to the Basic plan? You will retain directory listing and 2 portfolio images per project, but lose studio insights and priority placement.`
        );
      });
    });

    root.querySelectorAll('.btn-plan-upgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.getAttribute('data-tier-id') as 'basic' | 'upgraded';
        const tier = PLAN_TIERS_CONFIG.find((t) => t.id === tierId);
        if (!tier) return;

        pendingTierChange = { tier, action: 'upgrade' };
        openConfirmModal(
          `Upgrade to ${tier.name}`,
          `Plan changes are processed securely. In development, click Confirm to apply the plan change immediately.`
        );
      });
    });

    // Modal controls
    const modalBackdrop = root.querySelector('#modal-plan-confirm-backdrop') as HTMLElement;
    root.querySelector('#btn-close-plan-modal')?.addEventListener('click', () => {
      modalBackdrop.style.display = 'none';
      pendingTierChange = null;
    });
    root.querySelector('#btn-cancel-plan-change')?.addEventListener('click', () => {
      modalBackdrop.style.display = 'none';
      pendingTierChange = null;
    });

    root.querySelector('#btn-confirm-plan-change')?.addEventListener('click', async () => {
      if (!pendingTierChange) return;
      const { tier, action } = pendingTierChange;
      modalBackdrop.style.display = 'none';

      try {
        await updatePlanSubscription(tier.id, billingCycle);
        planState = await getPlanState();
        callbacks.onShowToast(
          action === 'upgrade' ? 'Plan upgraded' : 'Plan updated',
          `Your membership plan has been set to ${tier.name}.`,
          'success'
        );
        render();
      } catch (err: any) {
        callbacks.onShowToast('Action unavailable', err.message || 'Plan changes are currently available soon.', 'info');
      }
    });

    initPaymentMethodForm(root, {
      onSaveCard: async (brand: 'Visa' | 'Mastercard', last4: string) => {
        await updatePlanPaymentCard({ brand, last4, expMonth: 12, expYear: 2028 });
        planState = await getPlanState();
        render();
      },
      onRemoveCard: async () => {
        planState = await getPlanState();
        render();
      },
      onShowToast: callbacks.onShowToast
    });
  }

  function openConfirmModal(title: string, bodyHtml: string) {
    const modal = root.querySelector('#modal-plan-confirm-backdrop') as HTMLElement;
    const titleEl = root.querySelector('#modal-plan-confirm-title');
    const bodyEl = root.querySelector('#modal-plan-confirm-body');
    if (modal && titleEl && bodyEl) {
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      modal.style.display = 'flex';
    }
  }

  render();
}
