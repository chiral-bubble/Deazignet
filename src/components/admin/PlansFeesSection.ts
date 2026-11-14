/**
 * PlansFeesSection.ts
 * Membership Plans & Fee Schedules: edit plan pricing, proposal/portfolio limits,
 * create new fee schedule versions with recorded reasons, and an interactive progressive fee calculator tester.
 */

import {
  adminGetFeeScheduleVersions,
  adminCreateFeeScheduleVersion,
  testCalculateProgressiveFee
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { ensureRecentAuth } from './ApprovalDialog';
import { formatUSD } from '../../services/usMarketService';

export async function renderPlansFeesSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Plans, Pricing & Platform Fee Schedules
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Manage designer subscription plans, create progressive marginal fee schedule versions, and test calculations.
          </p>
        </div>
        <button id="btn-create-fee-version" style="background: #2563EB; border: none; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
          + New Fee Schedule Version
        </button>
      </div>

      <!-- Plan Tiers Overview Cards -->
      <div style="margin-bottom: 32px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 16px;">Designer Membership Plans</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          <!-- Free -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14px; font-weight: 700; color: #0F172A;">Free</span>
              <span style="font-size: 18px; font-weight: 700; color: #0F172A;">$0<span style="font-size: 12px; color: #64748B; font-weight: 400;">/mo</span></span>
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.8;">
              <li><strong>3</strong> proposals per month</li>
              <li><strong>3</strong> portfolio projects</li>
              <li>10 images per project</li>
              <li>Standard marketplace listings</li>
            </ul>
          </div>

          <!-- Basic -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14px; font-weight: 700; color: #2563EB;">Basic</span>
              <span style="font-size: 18px; font-weight: 700; color: #0F172A;">$19<span style="font-size: 12px; color: #64748B; font-weight: 400;">/mo</span></span>
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.8;">
              <li><strong>15</strong> proposals per month</li>
              <li><strong>12</strong> portfolio projects</li>
              <li>10 images per project</li>
              <li>Direct client invitations</li>
            </ul>
          </div>

          <!-- Gold -->
          <div style="background: #FFFFFF; border: 2px solid #F59E0B; border-radius: 8px; padding: 20px; position: relative;">
            <div style="position: absolute; top: -10px; right: 16px; background: #F59E0B; color: #FFFFFF; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">
              Popular
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 14px; font-weight: 700; color: #B45309;">Gold</span>
              <span style="font-size: 18px; font-weight: 700; color: #0F172A;">$49<span style="font-size: 12px; color: #64748B; font-weight: 400;">/mo</span></span>
            </div>
            <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 1.8;">
              <li><strong>Unlimited</strong> proposals</li>
              <li><strong>Unlimited</strong> portfolio showcase</li>
              <li>Direct invitations & client suggestions</li>
              <li>Gold member search badge & priority</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Interactive Fee Calculator Tester -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">Progressive Fee Calculator Tester</h3>
        <p style="font-size: 13px; color: #64748B; margin: 0 0 20px;">
          Simulate platform progressive marginal fee calculations across contracts ($5k @ 10%, next $5k @ 5%, remainder @ 2.5%).
        </p>

        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 20px;">
          <div style="position: relative; width: 220px;">
            <span style="position: absolute; left: 12px; top: 10px; color: #64748B; font-weight: 600;">$</span>
            <input id="test-fee-amount" type="number" value="10000" step="500" min="0" style="width: 100%; box-sizing: border-box; padding: 8px 12px 8px 24px; font-size: 14px; font-weight: 600; border: 1px solid #CBD5E1; border-radius: 6px; outline: none;" />
          </div>
          <button id="btn-calc-preset-2k" class="calc-preset-btn" data-amt="2000" style="background: #F1F5F9; border: 1px solid #CBD5E1; font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer;">$2,000</button>
          <button id="btn-calc-preset-5k" class="calc-preset-btn" data-amt="5000" style="background: #F1F5F9; border: 1px solid #CBD5E1; font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer;">$5,000</button>
          <button id="btn-calc-preset-10k" class="calc-preset-btn" data-amt="10000" style="background: #F1F5F9; border: 1px solid #CBD5E1; font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer;">$10,000</button>
          <button id="btn-calc-preset-20k" class="calc-preset-btn" data-amt="20000" style="background: #F1F5F9; border: 1px solid #CBD5E1; font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer;">$20,000</button>
          <button id="btn-calc-preset-50k" class="calc-preset-btn" data-amt="50000" style="background: #F1F5F9; border: 1px solid #CBD5E1; font-size: 12px; padding: 6px 10px; border-radius: 6px; cursor: pointer;">$50,000</button>
        </div>

        <div id="calc-result-box" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 16px;"></div>
      </div>

      <!-- Fee Schedule Versions Table -->
      <div>
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 16px;">Fee Schedule Versions & History</h3>
        <div id="fee-versions-container" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;"></div>
      </div>
    </div>
  `;

  const amountInput = container.querySelector('#test-fee-amount') as HTMLInputElement;
  const resultBox = container.querySelector('#calc-result-box') as HTMLElement;
  const versionsContainer = container.querySelector('#fee-versions-container') as HTMLElement;
  const btnCreateVersion = container.querySelector('#btn-create-fee-version') as HTMLButtonElement;

  function runCalculator() {
    const val = parseFloat(amountInput.value) || 0;
    const calc = testCalculateProgressiveFee(val);

    resultBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px;">
        <div>
          <span style="font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Total Platform Fee</span>
          <div style="font-size: 24px; font-weight: 700; color: #0F172A;">${formatUSD(calc.totalFee)}</div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 12px; color: #64748B; text-transform: uppercase; font-weight: 600;">Effective Rate</span>
          <div style="font-size: 20px; font-weight: 700; color: #2563EB;">${calc.effectiveRatePercent}%</div>
        </div>
      </div>

      <div style="font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 8px;">Marginal Bracket Breakdown:</div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${calc.tierBreakdown.map(b => `
          <div style="display: flex; justify-content: space-between; font-size: 12px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 4px; padding: 8px 12px;">
            <span style="color: #475569;">${b.label}: ${formatUSD(b.taxableAmount)}</span>
            <strong style="color: #0F172A;">${formatUSD(b.fee)}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  container.querySelectorAll('.calc-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      amountInput.value = btn.getAttribute('data-amt')!;
      runCalculator();
    });
  });

  amountInput.addEventListener('input', runCalculator);
  runCalculator();

  async function loadFeeVersions() {
    const versions = await adminGetFeeScheduleVersions();
    versionsContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
            <th style="padding: 12px 16px;">Version</th>
            <th style="padding: 12px 16px;">Effective From</th>
            <th style="padding: 12px 16px;">Brackets & Mode</th>
            <th style="padding: 12px 16px;">Justification Reason</th>
          </tr>
        </thead>
        <tbody>
          ${versions.map(v => `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 12px 16px;">
                <strong style="color: #0F172A;">${v.version}</strong>
              </td>
              <td style="padding: 12px 16px; color: #64748B;">
                ${new Date(v.effectiveFrom).toLocaleDateString()}
              </td>
              <td style="padding: 12px 16px;">
                <span style="background: #DCFCE7; color: #15803D; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">Marginal (${v.basis})</span>
                <div style="font-size: 11px; color: #64748B; margin-top: 4px;">${v.tiers.map(t => `${t.label}`).join(' &rarr; ')}</div>
              </td>
              <td style="padding: 12px 16px; color: #334155; max-width: 320px;">
                ${v.reason}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  btnCreateVersion.addEventListener('click', async () => {
    // MFA Re-auth check for fee structure adjustments
    const authed = await ensureRecentAuth('Create new platform fee schedule version');
    if (!authed) return;

    const verName = window.prompt('Enter new fee schedule version name (e.g. v1.1.0):', 'v1.1.0');
    if (!verName) return;

    const reason = await showReasonDialog({
      title: `Publish Fee Schedule ${verName}`,
      subtitle: 'Changes will apply to future contracts awarded on the platform.',
      promptLabel: 'Executive Justification Reason (min 5 chars)',
      placeholder: 'Explain market economics, promotional campaign, or strategic fee revision...'
    });

    if (!reason) return;

    try {
      await adminCreateFeeScheduleVersion({
        version: verName,
        tiers: [
          { up_to_cents: 500000, rate: 0.10, label: 'First $5,000 (10%)' },
          { up_to_cents: 1000000, rate: 0.05, label: '$5,000 to $10,000 (5%)' },
          { up_to_cents: null, rate: 0.025, label: 'Over $10,000 (2.5%)' }
        ],
        marginalMode: true,
        basis: 'cumulative_project',
        reason
      });

      alert(`Fee schedule version ${verName} successfully created and recorded to immutable log.`);
      await loadFeeVersions();
    } catch (err: any) {
      alert('Failed to publish fee schedule: ' + err.message);
    }
  });

  loadFeeVersions();
}
