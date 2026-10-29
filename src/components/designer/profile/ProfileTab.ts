/**
 * ProfileTab Component (Tab 1: Profile Settings)
 * Clean two-column form, avatar crop/upload modal, specialization chips, 600-char about counter,
 * availability toggle, and inline validations.
 */

import type { DesignerProfile, ProfessionalType } from '../../../services/designerProfileService';

const AVAILABLE_SPECIALIZATIONS = [
  'Residential',
  'Commercial',
  'Interior Architecture',
  'Landscape',
  'Sustainable',
  'Hospitality',
  'Government',
  'Healthcare',
  'Heritage',
  'Structural'
];

export function renderProfileTab(profile: DesignerProfile): string {
  const selectedSpecs = new Set(profile.specializations || []);
  const aboutLength = (profile.about || '').length;

  return `
    <div class="dez-settings-panel" id="dez-profile-tab-content">
      <div class="dez-panel-header">
        <h2 class="dez-panel-title">Personal & Professional Profile</h2>
        <p class="dez-panel-subtext">Manage your studio identity, public bio, and architectural specializations.</p>
      </div>

      <!-- Avatar Section -->
      <div class="dez-avatar-edit-card">
        <div class="dez-avatar-preview-wrap">
          ${
            profile.avatarUrl
              ? `<img src="${profile.avatarUrl}" alt="${profile.name}" class="dez-avatar-img-lg" id="avatar-preview-img" />`
              : `<div class="dez-avatar-placeholder-lg" id="avatar-preview-placeholder">${(profile.name || 'D').slice(0, 2).toUpperCase()}</div>`
          }
        </div>
        <div class="dez-avatar-edit-meta">
          <div class="dez-avatar-title">Profile photo</div>
          <div class="dez-avatar-specs">JPG, PNG or WebP. Max 5MB. Clear, professional architectural portrait recommended.</div>
          <div class="dez-avatar-actions">
            <button type="button" class="dez-btn-secondary" id="btn-change-avatar" style="height:32px; padding:0 12px; font-size:13px;">
              Change photo
            </button>
            ${
              profile.avatarUrl
                ? `<button type="button" class="dez-text-action-danger" id="btn-remove-avatar">Remove</button>`
                : ''
            }
          </div>
        </div>
      </div>

      <!-- Two-Column Form -->
      <form id="form-profile-tab" novalidate>
        <div class="dez-form-grid-2">
          <!-- Full Name -->
          <div class="dez-form-group">
            <label for="prof-name" class="dez-label">Full name <span class="dez-req">*</span></label>
            <input type="text" id="prof-name" name="name" class="dez-input" value="${profile.name || ''}" placeholder="e.g. Alexandre Sterling" required />
            <div class="dez-field-error" id="err-prof-name"></div>
          </div>

          <!-- Professional Title -->
          <div class="dez-form-group">
            <label for="prof-title" class="dez-label">Professional title <span class="dez-req">*</span></label>
            <input type="text" id="prof-title" name="professionalTitle" class="dez-input" value="${profile.professionalTitle || ''}" placeholder="e.g. Principal Architect & Urbanist" required />
            <div class="dez-field-error" id="err-prof-title"></div>
          </div>

          <!-- Professional Type -->
          <div class="dez-form-group">
            <label for="prof-type" class="dez-label">Primary profession <span class="dez-req">*</span></label>
            <select id="prof-type" name="professionalType" class="dez-select" required>
              <option value="Architect" ${profile.professionalType === 'Architect' ? 'selected' : ''}>Architect</option>
              <option value="Interior Designer" ${profile.professionalType === 'Interior Designer' ? 'selected' : ''}>Interior Designer</option>
              <option value="Landscape Architect" ${profile.professionalType === 'Landscape Architect' ? 'selected' : ''}>Landscape Architect</option>
              <option value="Engineer" ${profile.professionalType === 'Engineer' ? 'selected' : ''}>Engineer</option>
            </select>
          </div>

          <!-- Studio / Company Name -->
          <div class="dez-form-group">
            <label for="prof-company" class="dez-label">Studio or company name <span class="dez-opt">(Optional)</span></label>
            <input type="text" id="prof-company" name="companyName" class="dez-input" value="${profile.companyName || ''}" placeholder="e.g. Sterling Atelier Architecture" />
          </div>

          <!-- City -->
          <div class="dez-form-group">
            <label for="prof-city" class="dez-label">City <span class="dez-req">*</span></label>
            <input type="text" id="prof-city" name="city" class="dez-input" value="${profile.location.city || ''}" placeholder="e.g. Zurich" required />
            <div class="dez-field-error" id="err-prof-city"></div>
          </div>

          <!-- State / Region -->
          <div class="dez-form-group">
            <label for="prof-state" class="dez-label">State or region <span class="dez-req">*</span></label>
            <input type="text" id="prof-state" name="state" class="dez-input" value="${profile.location.state || ''}" placeholder="e.g. Zurich Canton" required />
            <div class="dez-field-error" id="err-prof-state"></div>
          </div>

          <!-- Email (Read-only with change link) -->
          <div class="dez-form-group">
            <div class="dez-label-with-action">
              <label for="prof-email" class="dez-label">Email address</label>
              <button type="button" class="dez-link-action" id="btn-change-email-trigger">Change email</button>
            </div>
            <input type="email" id="prof-email" name="email" class="dez-input is-readonly" value="${profile.email || ''}" readonly title="Contact support or click Change Email to update" />
            <span class="dez-field-hint">Primary address for project notifications and client inquiries.</span>
          </div>

          <!-- Phone (Private) -->
          <div class="dez-form-group">
            <label for="prof-phone" class="dez-label">Phone number <span class="dez-opt">(Optional, kept private)</span></label>
            <input type="tel" id="prof-phone" name="phone" class="dez-input" value="${profile.phone || ''}" placeholder="e.g. +41 44 123 4567" />
            <span class="dez-field-hint">Never shared on your public profile. Used only for urgent escrow alerts.</span>
          </div>

          <!-- Languages -->
          <div class="dez-form-group">
            <label for="prof-languages" class="dez-label">Languages spoken</label>
            <input type="text" id="prof-languages" name="languages" class="dez-input" value="${(profile.languages || []).join(', ')}" placeholder="e.g. English, German, French, Italian" />
            <span class="dez-field-hint">Separate languages with commas.</span>
          </div>

          <!-- Years of Experience -->
          <div class="dez-form-group">
            <label for="prof-experience" class="dez-label">Years of professional experience</label>
            <input type="number" id="prof-experience" name="yearsOfExperience" class="dez-input" min="0" max="60" value="${profile.yearsOfExperience || 0}" />
          </div>
        </div>

        <!-- About (Bio) with 600-char counter -->
        <div class="dez-form-group" style="margin-top: 18px;">
          <div class="dez-label-with-action">
            <label for="prof-about" class="dez-label">About your practice & design ethos <span class="dez-req">*</span></label>
            <span class="dez-char-counter" id="about-char-counter">${aboutLength}/600</span>
          </div>
          <textarea id="prof-about" name="about" class="dez-textarea" rows="4" maxlength="600" placeholder="Summarize your architectural philosophy, signature style, and types of commissions you undertake...">${profile.about || ''}</textarea>
          <span class="dez-field-hint">Shown on your public profile. Minimum 50 characters required for profile completeness.</span>
          <div class="dez-field-error" id="err-prof-about"></div>
        </div>

        <!-- Specializations (Multi-select chips) -->
        <div class="dez-form-group" style="margin-top: 20px;">
          <label class="dez-label">Specializations <span class="dez-opt">(Select all that apply)</span></label>
          <div class="dez-spec-chips-wrap" id="specializations-container">
            ${AVAILABLE_SPECIALIZATIONS.map(
              (spec) => `
              <button type="button" class="dez-chip-select ${selectedSpecs.has(spec) ? 'is-selected' : ''}" data-spec="${spec}">
                ${spec}
              </button>
            `
            ).join('')}
          </div>
          <div class="dez-field-error" id="err-prof-specs"></div>
        </div>

        <!-- Services & Starting Rate -->
        <div class="dez-bordered-box" style="margin-top: 24px;">
          <h3 class="dez-box-title">Commission Availability & Rates</h3>
          
          <div class="dez-form-grid-2" style="margin-top: 14px;">
            <div class="dez-form-group">
              <label for="prof-rate" class="dez-label">Hourly consultation rate ($ USD) <span class="dez-opt">(Optional)</span></label>
              <div class="dez-input-prefix-wrap">
                <span class="dez-input-prefix">$</span>
                <input type="number" id="prof-rate" name="hourlyRate" class="dez-input with-prefix" min="0" step="5" value="${profile.hourlyRate || ''}" placeholder="120" />
              </div>
              <span class="dez-field-hint">Shown as starting rate on your profile card. Milestone projects are billed separately.</span>
            </div>

            <div class="dez-form-group">
              <label class="dez-label">Availability status</label>
              <div class="dez-toggle-field">
                <label class="dez-switch">
                  <input type="checkbox" id="prof-available" ${profile.isAvailableForProjects ? 'checked' : ''} />
                  <span class="dez-slider"></span>
                </label>
                <span class="dez-switch-label" id="prof-available-label">
                  ${profile.isAvailableForProjects ? 'Available for new projects' : 'Currently fully booked'}
                </span>
              </div>
            </div>
          </div>

          <div class="dez-form-group" style="margin-top: 12px;">
            <label for="prof-avail-note" class="dez-label">Availability note <span class="dez-opt">(Optional)</span></label>
            <input type="text" id="prof-avail-note" name="availabilityNote" class="dez-input" value="${profile.availabilityNote || ''}" placeholder="e.g. Taking Q1/Q2 residential commissions" />
          </div>
        </div>

        <!-- Section 6: Search & Privacy Preferences -->
        <div class="dez-settings-card" style="margin-top: 24px;">
          <h2 class="dez-card-title">Search & Privacy Preferences</h2>
          <p class="dez-card-subtext">Manage your visibility in the designer search directory.</p>

          <div class="dez-toggle-row" style="margin-top: 16px;">
            <div>
              <span class="dez-toggle-title">Show my profile in designer search</span>
              <p class="dez-toggle-desc">Allow other designers and clients to discover your profile in directory search. When disabled, your public profile is still accessible via direct link.</p>
            </div>
            <label class="dez-switch">
              <input type="checkbox" id="prof-show-in-search" name="showInDesignerSearch" ${profile.showInDesignerSearch !== false ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>

          <div class="dez-divider-line" style="margin: 16px 0;"></div>

          <div class="dez-toggle-row">
            <div>
              <span class="dez-toggle-title">Hide my hourly rate from other designers</span>
              <p class="dez-toggle-desc">Your hourly consulting rate will only be visible to verified prospective clients, not peer designers browsing the directory.</p>
            </div>
            <label class="dez-switch">
              <input type="checkbox" id="prof-hide-rate-peers" name="hideRateFromPeers" ${profile.hideRateFromPeers ? 'checked' : ''} />
              <span class="dez-slider"></span>
            </label>
          </div>
        </div>
      </form>

      <!-- Avatar Crop & Upload Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-avatar-crop" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-avatar-title">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-avatar-title">Update Profile Photo</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-avatar-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <div class="dez-upload-dropzone" id="avatar-dropzone" tabindex="0">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" style="color:var(--dez-text-muted); margin-bottom:8px;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div class="dez-dropzone-prompt"><strong>Click to select photo</strong> or drag and drop</div>
              <div class="dez-dropzone-subtext">JPG, PNG or WebP up to 5MB</div>
              <input type="file" id="avatar-file-input" accept="image/jpeg,image/png,image/webp" style="display: none;" />
            </div>
            
            <div id="avatar-crop-preview-container" style="display: none; margin-top: 16px; text-align: center;">
              <div style="font-size: 13px; color: var(--dez-text-secondary); margin-bottom: 8px;">Photo Preview:</div>
              <div style="width: 140px; height: 140px; border-radius: 50%; overflow: hidden; margin: 0 auto; border: 2px solid var(--dez-brand);">
                <img id="avatar-crop-img" src="" alt="Cropped preview" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
            </div>

            <div class="dez-field-error" id="err-avatar-upload" style="margin-top: 8px;"></div>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-avatar" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-apply-avatar" style="height:36px;" disabled>Save photo</button>
          </div>
        </div>
      </div>

      <!-- Change Email Modal -->
      <div class="dez-dash-modal-backdrop" id="modal-change-email" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-email-title">
        <div class="dez-dash-modal" style="max-width: 440px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-email-title">Change Email Address</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-email-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size: 13px; color: var(--dez-text-secondary); margin-bottom: 14px;">
              A verification link will be sent to your new email address. Your current email remains active until confirmed.
            </p>
            <div class="dez-form-group">
              <label for="new-email-input" class="dez-label">New email address</label>
              <input type="email" id="new-email-input" class="dez-input" placeholder="e.g. alexandre@sterlingatelier.com" />
              <div class="dez-field-error" id="err-new-email"></div>
            </div>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-email" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-send-email-confirm" style="height:36px;">Send confirmation</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export interface ProfileTabState {
  isDirty: boolean;
  getValues: () => Partial<DesignerProfile>;
  validate: () => boolean;
  reset: () => void;
}

export function initProfileTab(
  container: HTMLElement,
  profile: DesignerProfile,
  onDirtyChange: (dirty: boolean) => void,
  onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void
): ProfileTabState {
  const root = container.querySelector('#dez-profile-tab-content') as HTMLElement;
  if (!root) {
    return {
      isDirty: false,
      getValues: () => ({}),
      validate: () => true,
      reset: () => {}
    };
  }

  // Working state
  let currentAvatar = profile.avatarUrl;
  let selectedSpecializations = new Set(profile.specializations || []);
  let isDirty = false;

  const markDirty = () => {
    if (!isDirty) {
      isDirty = true;
      onDirtyChange(true);
    }
  };

  // Form inputs
  const nameInput = root.querySelector('#prof-name') as HTMLInputElement;
  const titleInput = root.querySelector('#prof-title') as HTMLInputElement;
  const typeSelect = root.querySelector('#prof-type') as HTMLSelectElement;
  const companyInput = root.querySelector('#prof-company') as HTMLInputElement;
  const cityInput = root.querySelector('#prof-city') as HTMLInputElement;
  const stateInput = root.querySelector('#prof-state') as HTMLInputElement;
  const phoneInput = root.querySelector('#prof-phone') as HTMLInputElement;
  const languagesInput = root.querySelector('#prof-languages') as HTMLInputElement;
  const experienceInput = root.querySelector('#prof-experience') as HTMLInputElement;
  const aboutTextarea = root.querySelector('#prof-about') as HTMLTextAreaElement;
  const charCounter = root.querySelector('#about-char-counter') as HTMLElement;
  const rateInput = root.querySelector('#prof-rate') as HTMLInputElement;
  const availableToggle = root.querySelector('#prof-available') as HTMLInputElement;
  const availableLabel = root.querySelector('#prof-available-label') as HTMLElement;
  const noteInput = root.querySelector('#prof-avail-note') as HTMLInputElement;

  // Listeners for dirty tracking
  [
    nameInput,
    titleInput,
    typeSelect,
    companyInput,
    cityInput,
    stateInput,
    phoneInput,
    languagesInput,
    experienceInput,
    rateInput,
    noteInput
  ].forEach((el) => {
    el?.addEventListener('input', markDirty);
    el?.addEventListener('change', markDirty);
  });

  const showInSearchToggle = root.querySelector('#prof-show-in-search') as HTMLInputElement;
  const hideRatePeersToggle = root.querySelector('#prof-hide-rate-peers') as HTMLInputElement;
  showInSearchToggle?.addEventListener('change', markDirty);
  hideRatePeersToggle?.addEventListener('change', markDirty);

  // About counter & validation
  aboutTextarea?.addEventListener('input', () => {
    markDirty();
    const len = aboutTextarea.value.length;
    if (charCounter) charCounter.textContent = `${len}/600`;
  });

  // Availability toggle
  availableToggle?.addEventListener('change', () => {
    markDirty();
    if (availableLabel) {
      availableLabel.textContent = availableToggle.checked
        ? 'Available for new projects'
        : 'Currently fully booked';
    }
  });

  // Specializations chips
  const specChips = root.querySelectorAll<HTMLButtonElement>('.dez-chip-select');
  specChips.forEach((btn) => {
    btn.addEventListener('click', () => {
      const spec = btn.getAttribute('data-spec');
      if (!spec) return;
      markDirty();
      if (selectedSpecializations.has(spec)) {
        selectedSpecializations.delete(spec);
        btn.classList.remove('is-selected');
      } else {
        selectedSpecializations.add(spec);
        btn.classList.add('is-selected');
      }
    });
  });

  // Avatar Modal Handlers
  const avatarModal = root.querySelector('#modal-avatar-crop') as HTMLElement;
  const btnChangeAvatar = root.querySelector('#btn-change-avatar') as HTMLButtonElement;
  const btnRemoveAvatar = root.querySelector('#btn-remove-avatar') as HTMLButtonElement;
  const btnCloseAvatar = root.querySelector('#btn-close-avatar-modal') as HTMLButtonElement;
  const btnCancelAvatar = root.querySelector('#btn-cancel-avatar') as HTMLButtonElement;
  const btnApplyAvatar = root.querySelector('#btn-apply-avatar') as HTMLButtonElement;
  const avatarDropzone = root.querySelector('#avatar-dropzone') as HTMLElement;
  const avatarFileInput = root.querySelector('#avatar-file-input') as HTMLInputElement;
  const avatarPreviewContainer = root.querySelector('#avatar-crop-preview-container') as HTMLElement;
  const avatarCropImg = root.querySelector('#avatar-crop-img') as HTMLImageElement;
  const avatarErr = root.querySelector('#err-avatar-upload') as HTMLElement;

  let pendingAvatarUrl = '';

  const openAvatarModal = () => {
    if (avatarModal) {
      avatarModal.style.display = 'flex';
      avatarModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      pendingAvatarUrl = '';
      if (avatarErr) avatarErr.textContent = '';
      if (avatarPreviewContainer) avatarPreviewContainer.style.display = 'none';
      if (btnApplyAvatar) btnApplyAvatar.disabled = true;
    }
  };

  const closeAvatarModal = () => {
    if (avatarModal) {
      avatarModal.style.display = 'none';
      avatarModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  btnChangeAvatar?.addEventListener('click', openAvatarModal);
  btnCloseAvatar?.addEventListener('click', closeAvatarModal);
  btnCancelAvatar?.addEventListener('click', closeAvatarModal);
  avatarModal?.addEventListener('click', (e) => {
    if (e.target === avatarModal) closeAvatarModal();
  });

  // Dropzone click & drag
  avatarDropzone?.addEventListener('click', () => avatarFileInput?.click());
  avatarDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    avatarDropzone.classList.add('is-drag-over');
  });
  avatarDropzone?.addEventListener('dragleave', () => {
    avatarDropzone.classList.remove('is-drag-over');
  });
  avatarDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    avatarDropzone.classList.remove('is-drag-over');
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleAvatarFile(e.dataTransfer.files[0]);
    }
  });

  avatarFileInput?.addEventListener('change', () => {
    if (avatarFileInput.files && avatarFileInput.files[0]) {
      handleAvatarFile(avatarFileInput.files[0]);
    }
  });

  function handleAvatarFile(file: File) {
    if (avatarErr) avatarErr.textContent = '';
    if (file.size > 5 * 1024 * 1024) {
      if (avatarErr) avatarErr.textContent = 'Image exceeds 5MB size limit. Please choose a smaller file.';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingAvatarUrl = (e.target?.result as string) || '';
      if (avatarCropImg) avatarCropImg.src = pendingAvatarUrl;
      if (avatarPreviewContainer) avatarPreviewContainer.style.display = 'block';
      if (btnApplyAvatar) btnApplyAvatar.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  btnApplyAvatar?.addEventListener('click', () => {
    if (pendingAvatarUrl) {
      currentAvatar = pendingAvatarUrl;
      const previewImg = root.querySelector('#avatar-preview-img') as HTMLImageElement;
      const placeholder = root.querySelector('#avatar-preview-placeholder') as HTMLElement;
      if (previewImg) {
        previewImg.src = currentAvatar;
      } else if (placeholder) {
        placeholder.outerHTML = `<img src="${currentAvatar}" alt="Profile avatar" class="dez-avatar-img-lg" id="avatar-preview-img" />`;
      }
      closeAvatarModal();
      markDirty();
      onShowToast('Avatar Ready', 'New photo ready to save.', 'info');
    }
  });

  btnRemoveAvatar?.addEventListener('click', () => {
    currentAvatar = '';
    const previewWrap = root.querySelector('.dez-avatar-preview-wrap');
    if (previewWrap) {
      previewWrap.innerHTML = `<div class="dez-avatar-placeholder-lg" id="avatar-preview-placeholder">${(nameInput?.value || 'D').slice(0, 2).toUpperCase()}</div>`;
    }
    btnRemoveAvatar.style.display = 'none';
    markDirty();
  });

  // Change Email Modal
  const emailModal = root.querySelector('#modal-change-email') as HTMLElement;
  const btnTriggerEmail = root.querySelector('#btn-change-email-trigger') as HTMLButtonElement;
  const btnCloseEmail = root.querySelector('#btn-close-email-modal') as HTMLButtonElement;
  const btnCancelEmail = root.querySelector('#btn-cancel-email') as HTMLButtonElement;
  const btnSendEmail = root.querySelector('#btn-send-email-confirm') as HTMLButtonElement;
  const newEmailInput = root.querySelector('#new-email-input') as HTMLInputElement;
  const newEmailErr = root.querySelector('#err-new-email') as HTMLElement;

  const openEmailModal = () => {
    if (emailModal) {
      emailModal.style.display = 'flex';
      emailModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (newEmailInput) newEmailInput.value = '';
      if (newEmailErr) newEmailErr.textContent = '';
    }
  };
  const closeEmailModal = () => {
    if (emailModal) {
      emailModal.style.display = 'none';
      emailModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  btnTriggerEmail?.addEventListener('click', openEmailModal);
  btnCloseEmail?.addEventListener('click', closeEmailModal);
  btnCancelEmail?.addEventListener('click', closeEmailModal);
  emailModal?.addEventListener('click', (e) => {
    if (e.target === emailModal) closeEmailModal();
  });

  btnSendEmail?.addEventListener('click', () => {
    const emailVal = newEmailInput?.value.trim() || '';
    if (!emailVal || !emailVal.includes('@')) {
      if (newEmailErr) newEmailErr.textContent = 'Please enter a valid email address.';
      return;
    }
    closeEmailModal();
    onShowToast('Verification Sent', `Confirmation link sent to ${emailVal}.`, 'success');
  });

  // Validation function
  const validate = (): boolean => {
    let valid = true;

    const clearErr = (id: string) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = '';
    };
    const setErr = (id: string, msg: string) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.textContent = msg;
      valid = false;
    };

    ['err-prof-name', 'err-prof-title', 'err-prof-city', 'err-prof-state', 'err-prof-about', 'err-prof-specs'].forEach(clearErr);

    if (!nameInput.value.trim()) setErr('err-prof-name', 'Full name is required.');
    if (!titleInput.value.trim()) setErr('err-prof-title', 'Professional title is required.');
    if (!cityInput.value.trim()) setErr('err-prof-city', 'City is required.');
    if (!stateInput.value.trim()) setErr('err-prof-state', 'State is required.');
    if (aboutTextarea.value.trim().length < 20) {
      setErr('err-prof-about', 'Please write at least 20 characters describing your practice.');
    }
    if (selectedSpecializations.size === 0) {
      setErr('err-prof-specs', 'Select at least one architectural specialization.');
    }

    return valid;
  };

  // Values extractor
  const getValues = (): Partial<DesignerProfile> => {
    const langs = languagesInput.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      avatarUrl: currentAvatar,
      name: nameInput.value.trim(),
      professionalTitle: titleInput.value.trim(),
      professionalType: typeSelect.value as ProfessionalType,
      companyName: companyInput.value.trim(),
      location: {
        city: cityInput.value.trim(),
        state: stateInput.value.trim(),
        country: 'Switzerland'
      },
      phone: phoneInput.value.trim(),
      languages: langs,
      yearsOfExperience: parseInt(experienceInput.value, 10) || 0,
      about: aboutTextarea.value.trim(),
      specializations: Array.from(selectedSpecializations),
      hourlyRate: rateInput.value ? parseFloat(rateInput.value) : undefined,
      isAvailableForProjects: availableToggle.checked,
      availabilityNote: noteInput.value.trim(),
      showInDesignerSearch: showInSearchToggle ? showInSearchToggle.checked : true,
      hideRateFromPeers: hideRatePeersToggle ? hideRatePeersToggle.checked : false
    };
  };

  return {
    isDirty,
    getValues,
    validate,
    reset: () => {
      isDirty = false;
      onDirtyChange(false);
    }
  };
}
