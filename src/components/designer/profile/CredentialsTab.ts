/**
 * CredentialsTab Component (US Professional Licensing & Insurance)
 * License types: Architect, Professional Engineer, Landscape Architect, Interior Designer, Other
 * Issuing State: 50 states + DC
 * Masked license number (last 3 chars)
 * Issue year, Expiration date, Certificate upload
 * Status: Pending, Verified, Rejected, Expired
 * Professional Liability Insurance section
 */

import {
  US_STATES,
  US_LICENSE_TYPES,
  maskLicenseNumber,
  formatLicensedStatesLabel,
  formatDate
} from '../../../services/usMarketService';
import { supabase } from '../../../lib/supabase';

export interface UsCredential {
  id: string;
  license_type: 'architect' | 'professional_engineer' | 'landscape_architect' | 'interior_designer' | 'other';
  issuing_state: string;
  license_number: string;
  issue_year?: number | null;
  expiration_date?: string | null;
  certificate_file?: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  rejection_reason?: string | null;
}

export interface DesignerInsurance {
  id: string;
  provider: string;
  expiration_date: string;
  certificate_file?: string | null;
  status: 'pending' | 'verified' | 'rejected';
  rejection_reason?: string | null;
}

export function renderCredentialsTab(credentials: UsCredential[], insurance?: DesignerInsurance | null): string {
  const verifiedUnexpiredStates = credentials
    .filter(c => c.status === 'verified' && (!c.expiration_date || new Date(c.expiration_date) >= new Date()))
    .map(c => c.issuing_state);

  const licensedSummary = formatLicensedStatesLabel(verifiedUnexpiredStates);

  return `
    <div class="dez-settings-panel" id="dez-credentials-tab-content">
      <div class="dez-panel-header-with-actions" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div>
          <h2 class="dez-panel-title" style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">State Licensure & Credentials</h2>
          <p class="dez-panel-subtext" style="font-size: 13px; color: #6B7280; margin: 0;">Add your state board professional licenses to display your licensed states on project proposals.</p>
        </div>
        <button type="button" class="dez-btn-primary" id="btn-add-credential" style="height: 36px; padding: 0 16px; font-size: 13px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; cursor: pointer;">
          + Add state license
        </button>
      </div>

      <!-- Licensed States Summary Banner -->
      ${licensedSummary ? `
        <div style="background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="font-size: 13.5px; font-weight: 600; color: #1E40AF;">${licensedSummary}</span>
          </div>
          <span style="font-size: 11.5px; background: #DBEAFE; color: #1E40AF; padding: 2px 8px; border-radius: 4px; font-weight: 500;">
            Publicly Displayed
          </span>
        </div>
      ` : ''}

      <!-- Credentials List -->
      <div class="dez-credentials-list" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
        ${credentials.length === 0 ? `
          <div style="border: 1px dashed #E5E7EB; border-radius: 8px; padding: 32px; text-align: center;">
            <p style="font-size: 13.5px; color: #6B7280; margin: 0 0 14px 0;">No state licenses added yet. Add a state license to receive the Verified badge on paid plans.</p>
            <button type="button" class="dez-btn-secondary" id="btn-empty-add-cred" style="height: 36px; padding: 0 14px; font-size: 13px;">
              Add state license
            </button>
          </div>
        ` : credentials.map(cred => {
          const typeLabel = US_LICENSE_TYPES.find(t => t.value === cred.license_type)?.label || cred.license_type;
          const maskedNum = maskLicenseNumber(cred.license_number);
          const isVerified = cred.status === 'verified';
          const isPending = cred.status === 'pending';
          const isExpired = cred.status === 'expired';

          return `
            <div class="dez-cred-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                  <span style="font-weight: 600; font-size: 14px; color: #111827;">${typeLabel} — ${cred.issuing_state}</span>
                  <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; ${
                    isVerified ? 'background: #ECFDF5; color: #047857;' :
                    isPending ? 'background: #EFF6FF; color: #1D4ED8;' :
                    isExpired ? 'background: #FEF3C7; color: #92400E;' :
                    'background: #FEF2F2; color: #991B1B;'
                  }">
                    ${isVerified ? 'Verified' : isPending ? 'Pending Review' : isExpired ? 'Expired' : 'Rejected'}
                  </span>
                </div>
                <div style="font-size: 13px; color: #4B5563;">
                  License Number: <span style="font-family: monospace; font-weight: 600;">${maskedNum}</span>
                  ${cred.issue_year ? ` • Issued ${cred.issue_year}` : ''}
                  ${cred.expiration_date ? ` • Expires ${formatDate(cred.expiration_date)}` : ''}
                </div>
                ${cred.rejection_reason ? `
                  <div style="font-size: 12px; color: #991B1B; margin-top: 4px;">Reason: ${cred.rejection_reason}</div>
                ` : ''}
              </div>
              <button type="button" class="dez-btn-secondary btn-edit-cred" data-id="${cred.id}" style="height: 32px; font-size: 12px; padding: 0 12px;">
                Edit
              </button>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Professional Liability Insurance Section -->
      <div style="border-top: 1px solid #E5E7EB; padding-top: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
          <div>
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">Professional Liability Insurance (Optional)</h3>
            <p style="font-size: 13px; color: #6B7280; margin: 0;">Verified unexpired insurance shows as "Insured" on your profile and proposal card.</p>
          </div>
          <button type="button" class="dez-btn-secondary" id="btn-edit-insurance" style="height: 34px; font-size: 12.5px; padding: 0 14px;">
            ${insurance ? 'Update Insurance' : '+ Add Insurance'}
          </button>
        </div>

        ${insurance ? `
          <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 600; font-size: 13.5px; color: #111827;">${insurance.provider}</div>
              <div style="font-size: 12.5px; color: #6B7280;">Expires: ${formatDate(insurance.expiration_date)}</div>
            </div>
            <span style="font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; ${
              insurance.status === 'verified' ? 'background: #ECFDF5; color: #047857;' :
              insurance.status === 'pending' ? 'background: #EFF6FF; color: #1D4ED8;' :
              'background: #FEF2F2; color: #991B1B;'
            }">
              ${insurance.status === 'verified' ? 'Insured (Verified)' : insurance.status === 'pending' ? 'Pending Review' : 'Rejected'}
            </span>
          </div>
        ` : `
          <p style="font-size: 13px; color: #9CA3AF; margin: 0;">No insurance record uploaded.</p>
        `}
      </div>

      <!-- Add/Edit Credential Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-cred-backdrop" style="display: none;" role="dialog" aria-modal="true">
        <div class="dez-dash-modal" style="max-width: 480px; background: #FFFFFF; border-radius: 8px; border: 1px solid #E5E7EB; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;" id="modal-cred-title">Add State License</h3>
            <button type="button" id="btn-close-cred-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6B7280;">&times;</button>
          </div>
          <form id="form-cred">
            <input type="hidden" id="inp-cred-id" value="" />
            
            <div style="margin-bottom: 14px;">
              <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">License Type *</label>
              <select id="inp-cred-type" required style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                ${US_LICENSE_TYPES.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Issuing State *</label>
                <select id="inp-cred-state" required style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                  <option value="">Select state...</option>
                  ${US_STATES.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">License Number *</label>
                <input type="text" id="inp-cred-number" required placeholder="e.g. ARC-98213" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Issue Year</label>
                <input type="number" id="inp-cred-year" min="1950" max="2100" placeholder="e.g. 2018" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
              </div>
              <div>
                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Expiration Date</label>
                <input type="date" id="inp-cred-exp" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
              </div>
            </div>

            <div id="cred-edit-warning" style="display: none; background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 6px; padding: 10px 12px; font-size: 12px; color: #92400E; margin-bottom: 16px;">
              Editing a verified license will reset its status to pending review until verified by an administrator.
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" class="dez-btn-secondary" id="btn-cancel-cred" style="height: 36px; padding: 0 14px; font-size: 13px;">Cancel</button>
              <button type="submit" class="dez-btn-primary" id="btn-save-cred" style="height: 36px; padding: 0 18px; font-size: 13px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; cursor: pointer;">Save license</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function initCredentialsTab(
  container: HTMLElement,
  callbacks: {
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
    onReload: () => void;
  }
) {
  const modal = container.querySelector('#modal-cred-backdrop') as HTMLElement;
  const form = container.querySelector('#form-cred') as HTMLFormElement;
  const editWarning = container.querySelector('#cred-edit-warning') as HTMLElement;
  const modalTitle = container.querySelector('#modal-cred-title');

  container.querySelector('#btn-add-credential')?.addEventListener('click', () => {
    form.reset();
    (container.querySelector('#inp-cred-id') as HTMLInputElement).value = '';
    if (modalTitle) modalTitle.textContent = 'Add State License';
    if (editWarning) editWarning.style.display = 'none';
    if (modal) modal.style.display = 'flex';
  });

  container.querySelector('#btn-empty-add-cred')?.addEventListener('click', () => {
    form.reset();
    (container.querySelector('#inp-cred-id') as HTMLInputElement).value = '';
    if (modalTitle) modalTitle.textContent = 'Add State License';
    if (editWarning) editWarning.style.display = 'none';
    if (modal) modal.style.display = 'flex';
  });

  container.querySelector('#btn-close-cred-modal')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });
  container.querySelector('#btn-cancel-cred')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const credId = (container.querySelector('#inp-cred-id') as HTMLInputElement).value;
    const type = (container.querySelector('#inp-cred-type') as HTMLSelectElement).value;
    const state = (container.querySelector('#inp-cred-state') as HTMLSelectElement).value;
    const number = (container.querySelector('#inp-cred-number') as HTMLInputElement).value.trim();
    const year = parseInt((container.querySelector('#inp-cred-year') as HTMLInputElement).value, 10) || null;
    const exp = (container.querySelector('#inp-cred-exp') as HTMLInputElement).value || null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (credId) {
        // Update
        const { error } = await (supabase.from as any)('credentials')
          .update({
            license_type: type,
            issuing_state: state,
            license_number: number,
            issue_year: year,
            expiration_date: exp
          })
          .eq('id', credId)
          .eq('designer_id', user.id);

        if (error) throw error;
        callbacks.onShowToast('License updated', 'Saved changes. If modified, review will reset to pending.', 'success');
      } else {
        // Insert
        const { error } = await (supabase.from as any)('credentials')
          .insert({
            designer_id: user.id,
            license_type: type,
            issuing_state: state,
            license_number: number,
            issue_year: year,
            expiration_date: exp
          });

        if (error) throw error;
        callbacks.onShowToast('License added', 'Submitted for admin verification.', 'success');
      }

      if (modal) modal.style.display = 'none';
      callbacks.onReload();
    } catch (err: any) {
      callbacks.onShowToast('Save failed', err.message || 'Could not save credential.', 'error');
    }
  });
}
