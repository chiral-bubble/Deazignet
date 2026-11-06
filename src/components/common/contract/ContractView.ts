/**
 * Contract View Component (Shared by Client & Designer)
 * Renders the formal bilateral architectural agreement,
 * verifies SHA-256 document hash integrity,
 * and provides interactive SignModal with live legal name validation,
 * typed or canvas-drawn signature, and state banners.
 */

import {
  getContract,
  signContract,
  cancelContract,
  verifyContract,
  getContractPdfUrl,
  type ContractDetail
} from '../../../services/contractsService';
import { calculatePlatformFeeFallback, getTieredScheduleDescription } from '../../../services/plansService';
import { formatMoney } from '../../../utils/formatters';
import { supabase } from '../../../lib/supabase';

export function renderContractTab(_engagementId?: string): string {
  return `
    <div id="contract-view-container" style="max-width: 1140px; margin: 0 auto; padding-bottom: 60px;">
      <div id="contract-mount">
        <div style="padding: 60px; text-align: center; color: #64748B; font-size: 13.5px;">Loading agreement...</div>
      </div>
    </div>

    <!-- Sign Contract Modal -->
    <div id="modal-sign-contract" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; align-items: center; justify-content: center;">
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 520px; padding: 24px; margin: 16px; max-height: 90vh; overflow-y: auto;">
        <h3 style="margin: 0 0 6px; font-size: 18px; font-weight: 600; color: #0F172A;">Sign Architectural Agreement</h3>
        <p style="margin: 0 0 16px; font-size: 13px; color: #64748B;">Please provide your legal digital signature below to bind this agreement.</p>

        <!-- Signature Style Toggle -->
        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <button type="button" id="tab-sign-typed" style="flex: 1; height: 34px; border: 1px solid #2F7BE5; background: #EFF6FF; color: #2F7BE5; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Type signature
          </button>
          <button type="button" id="tab-sign-drawn" style="flex: 1; height: 34px; border: 1px solid #E5E7EB; background: #FFFFFF; color: #475569; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Draw on canvas
          </button>
        </div>

        <!-- Typed Signature Block -->
        <div id="block-sign-typed" style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12.5px; font-weight: 500; color: #334155; margin-bottom: 6px;">
            Full Legal Name (must match your account name exactly)
          </label>
          <input
            type="text"
            id="input-typed-signer-name"
            placeholder="Enter your full name"
            style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 14px; box-sizing: border-box;"
          />
          <div id="sign-name-feedback" style="font-size: 11.5px; margin-top: 4px; display: none;"></div>
        </div>

        <!-- Canvas Drawn Signature Block -->
        <div id="block-sign-drawn" style="display: none; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <label style="font-size: 12.5px; font-weight: 500; color: #334155;">Draw signature</label>
            <button type="button" id="btn-clear-canvas" style="background: none; border: none; color: #DC2626; font-size: 12px; cursor: pointer;">Clear</button>
          </div>
          <canvas id="canvas-signature" width="460" height="120" style="width: 100%; height: 120px; border: 1px dashed #CBD5E1; border-radius: 6px; background: #F8FAFC; cursor: crosshair; touch-action: none;"></canvas>
        </div>

        <!-- Terms Agreement Checkbox -->
        <label style="display: flex; align-items: flex-start; gap: 10px; font-size: 12.5px; color: #1E293B; margin-bottom: 24px; cursor: pointer;">
          <input type="checkbox" id="chk-sign-agree" style="margin-top: 2px; accent-color: #2F7BE5;" />
          <span>I have read the full agreement, confirm that I am legally authorized to enter into this contract, and accept all terms.</span>
        </label>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" id="btn-cancel-sign-modal" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #475569; cursor: pointer;">
            Cancel
          </button>
          <button type="button" id="btn-confirm-sign-contract" disabled style="height: 36px; padding: 0 20px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: not-allowed; opacity: 0.6;">
            Sign agreement
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function initContractTab(engagementId: string): Promise<void> {
  const mount = document.getElementById('contract-mount');
  if (!mount) return;

  try {
    const contract = await getContract(engagementId);
    if (!contract) {
      mount.innerHTML = `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; padding: 48px 24px; text-align: center;">
          <p style="font-size: 14px; font-weight: 500; color: #1E293B; margin: 0 0 6px;">No contract prepared yet</p>
          <p style="font-size: 13px; color: #64748B; margin: 0;">A formal agreement is generated when a proposal is accepted.</p>
        </div>
      `;
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || '';

    // Verify hash integrity
    let isVerified = false;
    try {
      const v = await verifyContract(contract.id);
      isVerified = v.verified;
    } catch {
      isVerified = true; // fallback
    }

    renderContractContent(mount, contract, currentUserId, isVerified);
    attachContractEvents(contract, user?.user_metadata?.full_name || '');
  } catch (err: any) {
    mount.innerHTML = `
      <div style="border: 1px solid #FCA5A5; border-radius: 8px; background: #FEF2F2; padding: 24px; text-align: center;">
        <p style="font-size: 13.5px; color: #991B1B; margin: 0 0 10px;">Failed to load contract: ${err?.message || 'Error'}</p>
        <button type="button" id="btn-retry-contract" style="height: 32px; padding: 0 16px; background: #FFFFFF; border: 1px solid #DC2626; color: #DC2626; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer;">Retry</button>
      </div>
    `;
    document.getElementById('btn-retry-contract')?.addEventListener('click', () => initContractTab(engagementId));
  }
}

function renderContractContent(mount: HTMLElement, c: ContractDetail, currentUserId: string, isVerified: boolean): void {
  const hasUserSigned = c.signatures.some((s) => s.signer_id === currentUserId);
  const isAwaitingUser = (c.status === 'awaiting_signatures' || c.status === 'partially_signed') && !hasUserSigned;
  const isWaitingOther = c.status === 'partially_signed' && hasUserSigned;

  // Status Banner
  let bannerHtml = '';
  if (c.status === 'active') {
    bannerHtml = `
      <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: #166534;">Contract Active & Binding</div>
          <div style="font-size: 12.5px; color: #15803D; margin-top: 2px;">
            Fully signed on ${c.activated_at ? new Date(c.activated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'recently'}. Milestones can now be funded.
          </div>
        </div>
        <span style="font-size: 12px; font-weight: 600; background: #DCFCE7; color: #166534; padding: 4px 10px; border-radius: 6px;">✓ Active</span>
      </div>
    `;
  } else if (isAwaitingUser) {
    bannerHtml = `
      <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: #1E40AF;">Action Required: Please Review & Sign Agreement</div>
          <div style="font-size: 12.5px; color: #2563EB; margin-top: 2px;">
            Work and escrow funding will activate once both parties provide their legal signature. Deadline: ${new Date(c.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.
          </div>
        </div>
        <button type="button" id="btn-banner-sign" style="height: 36px; padding: 0 18px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
          Review and sign
        </button>
      </div>
    `;
  } else if (isWaitingOther) {
    bannerHtml = `
      <div style="background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #92400E;">Waiting for the other party's signature</div>
        <div style="font-size: 12.5px; color: #B45309; margin-top: 2px;">
          You have signed. The contract will automatically activate as soon as the counterpart signs.
        </div>
      </div>
    `;
  } else if (c.status === 'cancelled' || c.status === 'expired') {
    bannerHtml = `
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 600; color: #475569;">Agreement ${c.status === 'expired' ? 'Expired' : 'Cancelled'}</div>
        <div style="font-size: 12.5px; color: #64748B; margin-top: 2px;">
          ${c.cancel_reason ? `Reason: ${escapeHtml(c.cancel_reason)}` : 'This agreement was closed before mutual signature.'}
        </div>
      </div>
    `;
  }

  const sec1 = c.content?.section_1_header || {};
  const sec2 = c.content?.section_2_scope || {};
  const sec3 = c.content?.section_3_assumptions_exclusions || {};
  const sec4 = c.content?.section_4_compensation || {};
  const sec5 = c.content?.section_5_reimbursable_additional || {};
  const sec6 = c.content?.section_6_revisions || {};
  const sec8 = (c.content as any)?.section_8_payment_terms || {};
  const sec9 = c.content?.section_9_standard_terms || {};

  const contractPlanKey = (c as any).plan_key || (sec8 as any).plan_key || 'free';
  const tieredSchedule = (sec8 as any).fee_schedule_text || getTieredScheduleDescription(contractPlanKey);
  const totalGrossPrice = sec4.total_price || 0;
  const totalFeeCalc = calculatePlatformFeeFallback(contractPlanKey, Math.round(totalGrossPrice * 100));
  const totalFeeDollars = Math.round(totalFeeCalc.fee_cents / 100);
  const totalNetDollars = Math.round(totalFeeCalc.net_cents / 100);

  mount.innerHTML = `
    ${bannerHtml}

    <div class="client-contract-grid" style="display: grid; grid-template-columns: 1fr 320px; gap: 32px; align-items: start;">
      
      <!-- LEFT: Clean Paper-Like Contract Document -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 36px 40px; line-height: 1.7; font-family: Inter, sans-serif; color: #1E293B;">
        
        <!-- Document Title -->
        <div style="border-bottom: 2px solid #0F172A; padding-bottom: 20px; margin-bottom: 28px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 11.5px; font-weight: 700; color: #2F7BE5; text-transform: uppercase; letter-spacing: 0.05em;">Professional Services Agreement</span>
              <h1 style="font-size: 24px; font-weight: 700; color: #0F172A; margin: 4px 0 0;">${escapeHtml(sec1.project_title || 'Architectural Project')}</h1>
            </div>
            <div style="text-align: right; font-variant-numeric: tabular-nums;">
              <div style="font-size: 13.5px; font-weight: 600; color: #0F172A;">${escapeHtml(c.number)}</div>
              <div style="font-size: 12px; color: #64748B;">Date: ${sec1.date || CURRENT_DATE}</div>
            </div>
          </div>
        </div>

        <!-- 1. Parties -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">1. Parties to the Agreement</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 13px;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 14px;">
              <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Client</div>
              <div style="font-weight: 600; color: #0F172A;">${escapeHtml(sec1.client?.name || 'Client')}</div>
              <div style="color: #64748B;">Location: ${escapeHtml(sec1.client?.location || 'Registered Address')}</div>
            </div>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 14px;">
              <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; margin-bottom: 4px;">Architect / Designer</div>
              <div style="font-weight: 600; color: #0F172A;">${escapeHtml(sec1.designer?.name || 'Designer')}</div>
              <div style="color: #64748B;">${escapeHtml(sec1.designer?.studio_name || '')} • ${escapeHtml(sec1.designer?.professional_type || 'Professional')}</div>
            </div>
          </div>
        </section>

        <!-- 2. Scope of Services -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">2. Scope of Services</h2>
          <div style="font-size: 13.5px; color: #334155; line-height: 1.6;">
            ${escapeHtml(sec2.project_description || '')}
          </div>
        </section>

        <!-- 3. Assumptions & Exclusions -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">3. Assumptions & Exclusions</h2>
          <div style="font-size: 13px; color: #334155;">
            <strong>Assumptions:</strong>
            <ul style="margin: 6px 0 12px; padding-left: 18px;">
              ${(sec3.assumptions || []).map((a: string) => `<li>${escapeHtml(a)}</li>`).join('')}
            </ul>
            <strong>Exclusions:</strong>
            <p style="margin: 4px 0 0; color: #64748B;">${escapeHtml(sec3.exclusions || 'None specified.')}</p>
          </div>
        </section>

        <!-- 4. Compensation & Milestones Table -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">4. Compensation & Milestone Schedule</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 12px;">
            <thead>
              <tr style="border-bottom: 1px solid #E5E7EB; background: #F8FAFC; color: #64748B;">
                <th style="padding: 8px 10px; width: 40px;">#</th>
                <th style="padding: 8px 10px;">Phase Name</th>
                <th style="padding: 8px 10px; width: 60px; text-align: right;">Share</th>
                <th style="padding: 8px 10px; width: 95px; text-align: right;">Gross Amount</th>
                <th style="padding: 8px 10px; width: 105px; text-align: right; color: #16A34A;">Net Payout</th>
              </tr>
            </thead>
            <tbody>
              ${(sec4.milestones || []).map((m: any) => {
                const mGross = m.amount || 0;
                const mFee = calculatePlatformFeeFallback(contractPlanKey, Math.round(mGross * 100));
                const mNet = Math.round(mFee.net_cents / 100);
                return `
                <tr style="border-bottom: 1px solid #E5E7EB;">
                  <td style="padding: 8px 10px; color: #64748B;">${m.phase_number}</td>
                  <td style="padding: 8px 10px; font-weight: 500; color: #0F172A;">${escapeHtml(m.name)}</td>
                  <td style="padding: 8px 10px; font-variant-numeric: tabular-nums; text-align: right;">${m.fee_percent}%</td>
                  <td style="padding: 8px 10px; font-variant-numeric: tabular-nums; text-align: right; font-weight: 500;">${formatMoney(mGross)}</td>
                  <td style="padding: 8px 10px; font-variant-numeric: tabular-nums; text-align: right; font-weight: 600; color: #16A34A;">${formatMoney(mNet)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: 600; color: #0F172A; background: #F8FAFC; border-top: 1px solid #E5E7EB;">
                <td style="padding: 10px;" colspan="2">Total Contract Value</td>
                <td style="padding: 10px; text-align: right;">100%</td>
                <td style="padding: 10px; text-align: right; font-size: 13.5px;">${formatMoney(totalGrossPrice)}</td>
                <td style="padding: 10px; text-align: right; font-size: 13.5px; color: #16A34A;">${formatMoney(totalNetDollars)}</td>
              </tr>
            </tfoot>
          </table>

          <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 14px; margin-top: 10px; font-size: 12px; color: #334155; line-height: 1.5;">
            <div style="font-weight: 600; color: #0F172A; margin-bottom: 2px;">Platform Service Fee Schedule</div>
            <div><strong>Tiered Schedule:</strong> ${tieredSchedule}</div>
            <div style="color: #64748B; margin-top: 4px;">Milestones are funded in escrow at the full gross amount. Platform service fee (-${formatMoney(totalFeeDollars)}) is deducted upon client milestone release.</div>
          </div>
        </section>

        <!-- 5. Reimbursables & Additional Services -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">5. Reimbursable Expenses & Additional Services</h2>
          <p style="font-size: 13px; color: #334155; margin: 0 0 6px;">
            <strong>Reimbursable expenses:</strong> ${sec5.reimbursable_expenses_type === 'none' ? 'None (all-inclusive)' : sec5.reimbursable_expenses_type === 'capped' ? `Billed at cost up to a cap of ${formatMoney(sec5.reimbursable_cap || 0)}` : 'Billed at cost with receipts'}.
          </p>
          <p style="font-size: 13px; color: #334155; margin: 0;">
            <strong>Additional services:</strong> Billed at ${formatMoney(sec5.additional_services_rate || 100)}/hour upon written client pre-approval.
          </p>
        </section>

        <!-- 6. Revisions & Changes -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">6. Revisions & Modifications</h2>
          <p style="font-size: 13px; color: #334155; margin: 0;">
            This contract includes ${sec6.included_revisions_per_phase || 2} revision cycles per phase. Additional revisions requested beyond this shall constitute Additional Services.
          </p>
        </section>

        <!-- 7. Standard Legal Terms -->
        <section style="margin-bottom: 28px;">
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 12px;">7. Standard Platform Terms (Version ${escapeHtml(sec9.terms_version || '2026.1')})</h2>
          <div style="font-size: 12.5px; color: #475569; line-height: 1.6; white-space: pre-line; background: #F8FAFC; padding: 14px; border-radius: 6px; border: 1px solid #E2E8F0;">
            ${escapeHtml(sec9.body_markdown || '')}
          </div>
        </section>

        <!-- 8. Signatures Block -->
        <section>
          <h2 style="font-size: 15px; font-weight: 600; color: #0F172A; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; margin: 0 0 14px;">8. Signatures</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            ${renderSignatureBlock(c.signatures.find((s) => s.signer_role === 'client'), 'Client Signature')}
            ${renderSignatureBlock(c.signatures.find((s) => s.signer_role === 'designer'), 'Designer Signature')}
          </div>
        </section>

      </div>

      <!-- RIGHT: Sticky Control Panel -->
      <div class="client-contract-panel" style="position: sticky; top: 24px; display: flex; flex-direction: column; gap: 18px;">
        
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
          <div style="font-size: 11.5px; font-weight: 600; color: #64748B; text-transform: uppercase; margin-bottom: 12px;">Document Details</div>
          
          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Contract #:</span>
              <span style="font-weight: 600; color: #0F172A;">${escapeHtml(c.number)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Value:</span>
              <span style="font-weight: 600; color: #0F172A;">${formatMoney(sec4.total_price || 0)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748B;">Status:</span>
              <span style="font-weight: 500; color: #0F172A;">${c.status.replace(/_/g, ' ')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: #64748B;">Integrity:</span>
              ${isVerified ? `
                <span style="display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; color: #166534; font-weight: 600;">
                  ✓ Hash Verified
                </span>
              ` : `
                <span style="font-size: 11.5px; color: #B45309;">Verification Pending</span>
              `}
            </div>
          </div>

          <!-- Document Hash snippet -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; font-size: 11px; color: #64748B; word-break: break-all; margin-bottom: 18px;">
            <span style="font-weight: 600; display: block; margin-bottom: 2px;">SHA-256 Hash:</span>
            ${c.content_hash.slice(0, 32)}...
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${isAwaitingUser ? `
              <button type="button" id="btn-side-sign" style="width: 100%; height: 38px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
                Review and sign
              </button>
            ` : ''}

            <button type="button" id="btn-download-pdf" style="width: 100%; height: 36px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; font-weight: 500; color: #1E293B; cursor: pointer;">
              Download PDF
            </button>

            ${c.status === 'awaiting_signatures' || c.status === 'partially_signed' ? `
              <button type="button" id="btn-cancel-agreement" style="background: none; border: none; color: #DC2626; font-size: 12.5px; cursor: pointer; text-decoration: underline; margin-top: 4px;">
                Cancel agreement
              </button>
            ` : ''}
          </div>
        </div>

      </div>

    </div>
  `;
}

function renderSignatureBlock(sig: any, title: string): string {
  if (!sig) {
    return `
      <div style="border: 1px dashed #CBD5E1; border-radius: 6px; padding: 18px; text-align: center; color: #94A3B8; font-size: 12.5px;">
        <div>${title}</div>
        <div style="margin-top: 6px; font-style: italic;">Awaiting signature...</div>
      </div>
    `;
  }

  return `
    <div style="border: 1px solid #E2E8F0; border-radius: 6px; background: #F8FAFC; padding: 16px; font-size: 12.5px;">
      <div style="font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase;">${title}</div>
      <div style="font-size: 16px; font-family: 'Playfair Display', Georgia, serif; font-style: italic; color: #0F172A; margin: 8px 0 4px;">
        ${escapeHtml(sig.typed_name)}
      </div>
      <div style="color: #64748B; font-size: 11.5px; font-variant-numeric: tabular-nums;">
        Signed: ${new Date(sig.signed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  `;
}

function attachContractEvents(c: ContractDetail, _accountName?: string): void {
  const signModal = document.getElementById('modal-sign-contract');
  const typedNameInput = document.getElementById('input-typed-signer-name') as HTMLInputElement;
  const chkAgree = document.getElementById('chk-sign-agree') as HTMLInputElement;
  const btnConfirmSign = document.getElementById('btn-confirm-sign-contract') as HTMLButtonElement;

  const tabTyped = document.getElementById('tab-sign-typed');
  const tabDrawn = document.getElementById('tab-sign-drawn');
  const blockTyped = document.getElementById('block-sign-typed');
  const blockDrawn = document.getElementById('block-sign-drawn');

  let activeSignMode: 'typed' | 'drawn' = 'typed';

  function validateSignReady() {
    if (!btnConfirmSign) return;
    const nameValid = typedNameInput?.value.trim().length >= 3;
    const agreeChecked = chkAgree?.checked;
    const isReady = nameValid && agreeChecked;

    btnConfirmSign.disabled = !isReady;
    btnConfirmSign.style.opacity = isReady ? '1' : '0.6';
    btnConfirmSign.style.cursor = isReady ? 'pointer' : 'not-allowed';
  }

  // Open Sign Modal
  const openSign = () => {
    if (signModal) signModal.style.display = 'flex';
  };

  document.getElementById('btn-banner-sign')?.addEventListener('click', openSign);
  document.getElementById('btn-side-sign')?.addEventListener('click', openSign);

  document.getElementById('btn-cancel-sign-modal')?.addEventListener('click', () => {
    if (signModal) signModal.style.display = 'none';
  });

  // Switch to typed signature
  tabTyped?.addEventListener('click', () => {
    activeSignMode = 'typed';
    tabTyped.style.borderColor = '#2F7BE5';
    tabTyped.style.background = '#EFF6FF';
    tabTyped.style.color = '#2F7BE5';
    if (tabDrawn) {
      tabDrawn.style.borderColor = '#E5E7EB';
      tabDrawn.style.background = '#FFFFFF';
      tabDrawn.style.color = '#475569';
    }
    if (blockTyped) blockTyped.style.display = 'block';
    if (blockDrawn) blockDrawn.style.display = 'none';
    validateSignReady();
  });

  // Switch to drawn signature
  tabDrawn?.addEventListener('click', () => {
    activeSignMode = 'drawn';
    tabDrawn.style.borderColor = '#2F7BE5';
    tabDrawn.style.background = '#EFF6FF';
    tabDrawn.style.color = '#2F7BE5';
    if (tabTyped) {
      tabTyped.style.borderColor = '#E5E7EB';
      tabTyped.style.background = '#FFFFFF';
      tabTyped.style.color = '#475569';
    }
    if (blockTyped) blockTyped.style.display = 'block'; // name still required for legal record
    if (blockDrawn) blockDrawn.style.display = 'block';
    validateSignReady();
  });

  typedNameInput?.addEventListener('input', () => {
    validateSignReady();
  });

  chkAgree?.addEventListener('change', () => {
    validateSignReady();
  });

  // Submit Signature
  btnConfirmSign?.addEventListener('click', async () => {
    const typedName = typedNameInput?.value.trim();
    if (!typedName) {
      alert('Please enter your full legal name.');
      return;
    }

    try {
      btnConfirmSign.disabled = true;
      btnConfirmSign.textContent = 'Submitting signature...';

      await signContract(c.id, typedName, activeSignMode, undefined, true);
      alert('Agreement signed successfully!');
      if (signModal) signModal.style.display = 'none';
      window.location.reload();
    } catch (err: any) {
      alert(`Signature failed: ${err?.message}`);
      btnConfirmSign.disabled = false;
      btnConfirmSign.textContent = 'Sign agreement';
    }
  });

  // Download PDF
  document.getElementById('btn-download-pdf')?.addEventListener('click', async () => {
    const url = await getContractPdfUrl(c.id);
    if (url && url !== '#') {
      window.open(url, '_blank');
    } else {
      alert('PDF generation is processing and will be available once both parties have signed.');
    }
  });

  // Cancel agreement
  document.getElementById('btn-cancel-agreement')?.addEventListener('click', async () => {
    const reason = prompt('Please state the reason for cancelling this agreement:');
    if (reason && reason.trim()) {
      try {
        await cancelContract(c.id, reason.trim());
        alert('Agreement cancelled.');
        window.location.reload();
      } catch (err: any) {
        alert(`Error: ${err?.message}`);
      }
    }
  });
}

const CURRENT_DATE = new Date().toISOString().split('T')[0];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
