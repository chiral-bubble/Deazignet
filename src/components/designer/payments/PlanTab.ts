/**
 * PlanTab Component (US Market Spec)
 * - Data-driven plan cards (Free $0, Basic $19/mo, Gold $49/mo)
 * - annual_billing_enabled setting check: hides toggle/savings/yearly prices when false
 * - Progressive commission notice
 * - Downgrade & Upgrade dialogs with exact loss notices
 * - US Date formatting
 */

import { getPlanState, updatePlanSubscription, updatePlanPaymentCard } from '../../../services/paymentsService';
import { PLAN_TIERS_CONFIG, type PlanTierConfig, getPaymentsSettings, PLATFORM_COMMISSION_NOTE } from '../../../config/paymentsConfig';
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
  const settings = getPaymentsSettings();
  const annualBillingEnabled = settings.annual_billing_enabled;

  let billingCycle: 'monthly' | 'yearly' = annualBillingEnabled ? planState.billingCycle : 'monthly';
  let pendingTierChange: { tier: PlanTierConfig; action: 'upgrade' | 'downgrade' | 'cancel' } | null = null;

  // Compute annual savings
  const annualSavingsPercent = computeAnnualSavings(1900, 19000); // ~17%

  function render() {
    const isYearly = annualBillingEnabled && billingCycle === 'yearly';

    root.innerHTML = `
      <!-- Billing Header & Optional Toggle -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0;">Membership plans</h2>
          <p style="font-size: 13.5px; color: #6B7280; margin: 2px 0 0 0;">
            Currently on the <strong>${planState.currentPlanId.toUpperCase()}</strong> plan. Renews on ${planState.renewsAt}.
          </p>
        </div>

        ${
          annualBillingEnabled
            ? `
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
        `
            : ''
        }
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

                <ul style="list-style: none; margin: 0 0 24px 0; padding: 0; font-size: 13px; color: #374151; display: flex; flex-direction: column; gap: 10px;">
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${tier.proposalsPerMonth === null ? 'Unlimited proposal submissions*' : `${tier.proposalsPerMonth} proposals per month`}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${tier.portfolioProjectsLimit === null ? 'Unlimited portfolio projects*' : `Up to ${tier.portfolioProjectsLimit} portfolio projects`}</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${
                      tier.id === 'free'
                        ? 'Directory listing profile'
                        : tier.id === 'basic'
                        ? 'Basic portfolio page & direct invitations'
                        : 'Enhanced portfolio page & priority placement'
                    }</span>
                  </li>
                  <li style="display: flex; align-items: center; gap: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${tier.id === 'free' ? '#9CA3AF' : '#2F7BE5'}" stroke-width="2.5">
                      ${tier.id === 'free' ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' : '<polyline points="20 6 9 17 4 12"/>'}
                    </svg>
                    <span>${tier.id === 'free' ? 'Direct invitations unavailable' : 'Direct client project invitations'}</span>
                  </li>
                </ul>
              </div>

              <div style="margin-top: 24px;">
                ${
                  isCurrent
                    ? `<button type="button" class="dez-btn-secondary" disabled style="width: 100%; height: 38px; font-size: 13px;">Current active plan</button>`
                    : tier.id === 'free'
                    ? `<button type="button" class="dez-btn-secondary btn-plan-downgrade" data-tier-id="${tier.id}" style="width: 100%; height: 38px; font-size: 13px;">Downgrade to Free</button>`
                    : tier.id === 'basic' && planState.currentPlanId === 'gold'
                    ? `<button type="button" class="dez-btn-secondary btn-plan-downgrade" data-tier-id="${tier.id}" style="width: 100%; height: 38px; font-size: 13px;">Downgrade to Basic</button>`
                    : `<button type="button" class="dez-btn-primary btn-plan-upgrade" data-tier-id="${tier.id}" style="width: 100%; height: 38px; font-size: 13px;">Upgrade to ${tier.name}</button>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Commission Notice Strip -->
      <div style="margin-top: 20px; padding: 12px 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 13px; color: #475569; display: flex; align-items: center; gap: 8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>${PLATFORM_COMMISSION_NOTE}</span>
      </div>

      <!-- Estimate Your Fee Box -->
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-top: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">Estimate your fee</h3>
        <p style="font-size: 13px; color: #6B7280; margin: 0 0 16px 0;">
          Enter a milestone amount to calculate platform service fee and net designer payout.
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
    const res = calculatePlatformFeeFallback('free', amountCents);

    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1.5px solid #2F7BE5; border-radius: 6px; padding: 18px; max-width: 440px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 600; font-size: 14.5px; color: #111827;">Progressive Platform Commission</span>
          <span style="font-size: 12.5px; color: #2F7BE5; font-weight: 600;">Effective rate: ${res.rate_percent}%</span>
        </div>
        <div style="margin-bottom: 6px; font-size: 13.5px; color: #4B5563;">
          Platform service fee: <strong style="color: #111827;">${formatUSD(res.fee_dollars)}</strong>
        </div>
        <div style="font-size: 14.5px; color: #047857; font-weight: 600;">
          Net designer payout: ${formatUSD(res.net_dollars)}
        </div>
        <div style="font-size: 11.5px; color: #6B7280; margin-top: 10px; border-top: 1px solid #F3F4F6; padding-top: 8px;">
          The platform commission is the same progressive scale on every plan.
        </div>
      </div>
    `;
  }

  function bindEvents() {
    const estInput = root.querySelector('#inp-milestone-estimator') as HTMLInputElement;
    estInput?.addEventListener('input', () => {
      const val = parseFloat(estInput.value) || 0;
      updateFeeEstimator(val);
    });

    if (annualBillingEnabled) {
      root.querySelector('#btn-cycle-monthly')?.addEventListener('click', () => {
        billingCycle = 'monthly';
        render();
      });
      root.querySelector('#btn-cycle-yearly')?.addEventListener('click', () => {
        billingCycle = 'yearly';
        render();
      });
    }

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
               • Monthly proposal limit will decrease to 3 submissions.<br/>
               • Direct client project invitations will be disabled.<br/>
               • Portfolio display will show your first 3 projects (remaining projects are kept safely but hidden publicly).<br/>
               • Active projects and contracts will continue normally.`
            : `Are you sure you want to switch to the Basic plan? You will retain direct client invitations, but portfolio will show up to 12 projects and you will lose Gold priority search placement.`
        );
      });
    });

    root.querySelectorAll('.btn-plan-upgrade').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tierId = btn.getAttribute('data-tier-id') as 'basic' | 'gold';
        const tier = PLAN_TIERS_CONFIG.find((t) => t.id === tierId);
        if (!tier) return;

        pendingTierChange = { tier, action: 'upgrade' };
        openConfirmModal(
          `Upgrade to ${tier.name}`,
          `Confirm upgrade to ${tier.name} ($${tier.monthlyPrice}/month). Your new proposal limit and entitlements will apply immediately.`
        );
      });
    });

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
