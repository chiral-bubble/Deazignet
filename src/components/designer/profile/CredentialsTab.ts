/**
 * CredentialsTab Component (Tab 3: Credentials Settings)
 * Registration details list, Add registration modal, edit rules (only Pending/Rejected,
 * changing Verified resets to Pending with warning), and plain text status tags.
 */

import type { DesignerCredential } from '../../../services/designerProfileService';

const REG_BODIES = ['AIA', 'PE', 'RIBA', 'NCARB', 'TOPREC', 'NIESV', 'Other'];

export function renderCredentialsTab(credentials: DesignerCredential[]): string {
  return `
    <div class="dez-settings-panel" id="dez-credentials-tab-content">
      <div class="dez-panel-header-with-actions">
        <div>
          <h2 class="dez-panel-title">Professional Credentials & Accreditation</h2>
          <p class="dez-panel-subtext">Add official statutory registrations and certifications from regulatory councils.</p>
        </div>
        <button type="button" class="dez-btn-primary" id="btn-add-credential" style="height:36px; padding:0 18px;">
          + Add registration
        </button>
      </div>

      <!-- Explanatory Helper Notice -->
      <div class="dez-info-banner" style="margin-bottom: 24px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--dez-brand); flex-shrink:0;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <div style="font-size:13px; color:var(--dez-text-primary); line-height: 1.5;">
          Credentials are authenticated against official regulatory council registers before the <strong>Verified Designer</strong> mark is displayed on your public profile.
        </div>
      </div>

      <!-- Credentials List or Empty State -->
      ${
        credentials.length === 0
          ? `
        <div class="dez-empty-portfolio-card">
          <div class="dez-empty-icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <h3 class="dez-empty-title">No credentials added yet</h3>
          <p class="dez-empty-subtext">Submit your AIA, PE, or RIBA professional registration number to earn verified status.</p>
          <button type="button" class="dez-btn-primary" id="btn-empty-add-cred" style="margin-top:14px; height:36px;">
            Add professional registration
          </button>
        </div>
      `
          : `
        <div class="dez-credentials-list">
          ${credentials
            .map((cred) => {
              const isVerified = cred.status === 'verified';
              const isPending = cred.status === 'pending';

              return `
              <div class="dez-cred-card" data-cred-id="${cred.id}">
                <div class="dez-cred-card-left">
                  <div class="dez-cred-badge-wrap">
                    <span class="dez-cred-body-code">${cred.registrationBody}</span>
                  </div>
                  <div>
                    <div class="dez-cred-title-row">
                      <span class="dez-cred-body-name">${getBodyFullName(cred.registrationBody)}</span>
                      <span class="dez-cred-number">Reg: <strong>${cred.registrationNumber}</strong></span>
                    </div>
                    <div class="dez-cred-meta">
                      ${cred.stateOrRegion} &bull; Registered ${cred.year}
                      ${cred.certificateUrl ? ` &bull; <a href="${cred.certificateUrl}" target="_blank" rel="noopener" class="dez-link-action">View certificate</a>` : ''}
                    </div>

                    <!-- Plain Text Status with Small Icon -->
                    <div class="dez-cred-status-row">
                      ${
                        isVerified
                          ? `
                        <span class="dez-status-plain is-verified">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Verified
                        </span>
                      `
                          : isPending
                          ? `
                        <span class="dez-status-plain is-pending">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Pending review
                        </span>
                      `
                          : `
                        <span class="dez-status-plain is-rejected">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          Rejected: ${cred.rejectionReason || 'Council registration details did not match official registry.'}
                        </span>
                      `
                      }
                    </div>
                  </div>
                </div>

                <div class="dez-cred-card-actions">
                  <button type="button" class="dez-btn-secondary" data-action="edit-cred" data-cred-id="${cred.id}" style="height:32px; padding:0 12px; font-size:12.5px;">
                    Edit
                  </button>
                  <button type="button" class="dez-btn-danger-outline" data-action="delete-cred" data-cred-id="${cred.id}" style="height:32px; padding:0 12px; font-size:12.5px;">
                    Delete
                  </button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }

      <!-- Add / Edit Registration Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-cred-form" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-cred-title">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-cred-title">Add Professional Registration</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-cred-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <!-- Warning Banner if editing a Verified Credential -->
            <div id="cred-verified-warning" class="dez-warning-banner" style="display: none; margin-bottom: 14px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#B45309; flex-shrink:0;">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div style="font-size:12.5px; color:#92400E; line-height:1.4;">
                <strong>Warning:</strong> Modifying a verified credential will reset its status to <em>Pending review</em> until re-authenticated.
              </div>
            </div>

            <form id="form-credential" novalidate>
              <div class="dez-form-group">
                <label for="cred-body-select" class="dez-label">Registration body <span class="dez-req">*</span></label>
                <select id="cred-body-select" class="dez-select" required>
                  ${REG_BODIES.map((b) => `<option value="${b}">${b} - ${getBodyFullName(b)}</option>`).join('')}
                </select>
              </div>

              <div class="dez-form-group">
                <label for="cred-number-input" class="dez-label">Registration number <span class="dez-req">*</span></label>
                <input type="text" id="cred-number-input" class="dez-input" placeholder="e.g. F-2491" required />
                <div class="dez-field-error" id="err-cred-number"></div>
              </div>

              <div class="dez-form-grid-2">
                <div class="dez-form-group">
                  <label for="cred-state-input" class="dez-label">State / Region <span class="dez-req">*</span></label>
                  <input type="text" id="cred-state-input" class="dez-input" placeholder="e.g. Zurich Canton" required />
                  <div class="dez-field-error" id="err-cred-state"></div>
                </div>

                <div class="dez-form-group">
                  <label for="cred-year-input" class="dez-label">Registration year <span class="dez-req">*</span></label>
                  <input type="number" id="cred-year-input" class="dez-input" min="1970" max="2026" value="2018" required />
                  <div class="dez-field-error" id="err-cred-year"></div>
                </div>
              </div>

              <div class="dez-form-group">
                <label for="cred-cert-url" class="dez-label">Certificate document link <span class="dez-opt">(Optional)</span></label>
                <input type="url" id="cred-cert-url" class="dez-input" placeholder="https://example.com/certificate.pdf" />
                <span class="dez-field-hint">PDF or scanned certificate link to expedite verification.</span>
              </div>
            </form>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-cred-modal" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-save-cred-modal" style="height:36px; padding:0 20px;">
              Submit for review
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getBodyFullName(code: string): string {
  switch (code) {
    case 'AIA':
      return 'American Institute of Architects (AIA)';
    case 'PE':
      return 'National Council of Examiners for Engineering (NCEES / PE)';
    case 'RIBA':
      return 'Royal Institute of British Architects (RIBA)';
    case 'NCARB':
      return 'National Council of Architectural Registration Boards (NCARB)';
    case 'TOPREC':
      return 'Town Planners Registration Council';
    case 'NIESV':
      return 'Royal Institution of Chartered Surveyors (RICS)';
    default:
      return 'Regulatory Professional Council';
  }
}

export function initCredentialsTab(
  container: HTMLElement,
  credentials: DesignerCredential[],
  callbacks: {
    onAddCredential: (cred: Omit<DesignerCredential, 'id' | 'status'>) => Promise<void>;
    onUpdateCredential: (id: string, updates: Partial<DesignerCredential>) => Promise<void>;
    onDeleteCredential: (id: string) => Promise<void>;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const root = container.querySelector('#dez-credentials-tab-content') as HTMLElement;
  if (!root) return;

  const modal = root.querySelector('#modal-cred-form') as HTMLElement;
  const modalTitle = root.querySelector('#modal-cred-title') as HTMLElement;
  const warningBanner = root.querySelector('#cred-verified-warning') as HTMLElement;
  const btnClose = root.querySelector('#btn-close-cred-modal') as HTMLButtonElement;
  const btnCancel = root.querySelector('#btn-cancel-cred-modal') as HTMLButtonElement;
  const btnSave = root.querySelector('#btn-save-cred-modal') as HTMLButtonElement;

  const bodySelect = root.querySelector('#cred-body-select') as HTMLSelectElement;
  const numberInput = root.querySelector('#cred-number-input') as HTMLInputElement;
  const stateInput = root.querySelector('#cred-state-input') as HTMLInputElement;
  const yearInput = root.querySelector('#cred-year-input') as HTMLInputElement;
  const certInput = root.querySelector('#cred-cert-url') as HTMLInputElement;

  let editingCredId: string | null = null;
  let editingOriginalStatus: string | null = null;

  const openModal = (cred?: DesignerCredential) => {
    if (!modal) return;
    editingCredId = cred ? cred.id : null;
    editingOriginalStatus = cred ? cred.status : null;

    if (modalTitle) {
      modalTitle.textContent = cred ? 'Edit Professional Registration' : 'Add Professional Registration';
    }

    if (warningBanner) {
      warningBanner.style.display = cred && cred.status === 'verified' ? 'flex' : 'none';
    }

    if (cred) {
      if (bodySelect) bodySelect.value = cred.registrationBody;
      if (numberInput) numberInput.value = cred.registrationNumber;
      if (stateInput) stateInput.value = cred.stateOrRegion;
      if (yearInput) yearInput.value = String(cred.year);
      if (certInput) certInput.value = cred.certificateUrl || '';
    } else {
      if (bodySelect) bodySelect.value = 'AIA';
      if (numberInput) numberInput.value = '';
      if (stateInput) stateInput.value = 'Zurich Canton';
      if (yearInput) yearInput.value = '2018';
      if (certInput) certInput.value = '';
    }

    ['err-cred-number', 'err-cred-state', 'err-cred-year'].forEach((id) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = '';
    });

    modal.style.display = 'flex';
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      editingCredId = null;
    }
  };

  root.querySelector('#btn-add-credential')?.addEventListener('click', () => openModal());
  root.querySelector('#btn-empty-add-cred')?.addEventListener('click', () => openModal());

  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Edit action
  root.querySelectorAll('[data-action="edit-cred"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cred-id');
      const cred = credentials.find((c) => c.id === id);
      if (cred) openModal(cred);
    });
  });

  // Delete action
  root.querySelectorAll('[data-action="delete-cred"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-cred-id');
      if (!id) return;
      if (confirm('Delete this professional registration?')) {
        await callbacks.onDeleteCredential(id);
        callbacks.onShowToast('Credential Deleted', 'Registration details removed.', 'info');
      }
    });
  });

  // Save Modal
  btnSave?.addEventListener('click', async () => {
    const regBody = bodySelect.value;
    const regNum = numberInput.value.trim();
    const stateVal = stateInput.value.trim();
    const yearVal = parseInt(yearInput.value, 10);
    const certUrl = certInput.value.trim();

    let valid = true;
    const setErr = (id: string, msg: string) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = msg;
      valid = false;
    };

    if (!regNum) setErr('err-cred-number', 'Registration number is required.');
    if (!stateVal) setErr('err-cred-state', 'State or region is required.');
    if (!yearVal || yearVal < 1970 || yearVal > 2026) setErr('err-cred-year', 'Valid registration year required.');

    if (!valid) return;

    btnSave.disabled = true;
    btnSave.textContent = 'Submitting...';

    try {
      if (editingCredId) {
        await callbacks.onUpdateCredential(editingCredId, {
          registrationBody: regBody,
          registrationNumber: regNum,
          stateOrRegion: stateVal,
          year: yearVal,
          certificateUrl: certUrl || undefined
        });
        const msg = editingOriginalStatus === 'verified'
          ? 'Credential modified and resubmitted for verification.'
          : 'Registration details updated.';
        callbacks.onShowToast('Credential Saved', msg, 'info');
      } else {
        await callbacks.onAddCredential({
          registrationBody: regBody,
          registrationNumber: regNum,
          stateOrRegion: stateVal,
          year: yearVal,
          certificateUrl: certUrl || undefined
        });
        callbacks.onShowToast('Credential Submitted', 'Submitted for council verification.', 'success');
      }
      closeModal();
    } finally {
      btnSave.disabled = false;
      btnSave.textContent = 'Submit for review';
    }
  });
}
