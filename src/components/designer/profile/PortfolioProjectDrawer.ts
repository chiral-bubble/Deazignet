/**
 * PortfolioProjectDrawer Component
 * Drawer to Add or Edit a portfolio project.
 * Supports 1 to 12 images, drag-and-drop, set cover image, remove, progress bar,
 * and inline validations.
 */

import type { PortfolioProject, PortfolioImage } from '../../../services/designerProfileService';

const PROJECT_CATEGORIES = [
  'Residential',
  'Commercial',
  'Interior Architecture',
  'Landscape',
  'Sustainable',
  'Hospitality',
  'Government',
  'Healthcare',
  'Industrial'
];

export function renderPortfolioProjectDrawer(project?: PortfolioProject | null): string {
  const isEdit = Boolean(project);
  const currentImages = project?.images || [];

  return `
    <div class="dez-drawer-backdrop" id="drawer-portfolio-project" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="drawer-port-title">
      <div class="dez-drawer-panel" style="max-width: 620px;">
        <div class="dez-drawer-header">
          <div>
            <h3 class="dez-drawer-title" id="drawer-port-title">${isEdit ? 'Edit Portfolio Project' : 'Add New Portfolio Project'}</h3>
            <p class="dez-drawer-subtext">Showcase architectural commissions, drawings, and built photography.</p>
          </div>
          <button type="button" class="dez-drawer-close" id="btn-close-port-drawer" aria-label="Close drawer">&times;</button>
        </div>

        <div class="dez-drawer-body">
          <form id="form-portfolio-project" novalidate>
            <!-- Title -->
            <div class="dez-form-group">
              <label for="port-title" class="dez-label">Project title <span class="dez-req">*</span></label>
              <input type="text" id="port-title" class="dez-input" value="${project?.title || ''}" placeholder="e.g. Lake Zurich Waterfront Pavilion" required />
              <div class="dez-field-error" id="err-port-title"></div>
            </div>

            <!-- Category & Year -->
            <div class="dez-form-grid-2">
              <div class="dez-form-group">
                <label for="port-category" class="dez-label">Category <span class="dez-req">*</span></label>
                <select id="port-category" class="dez-select" required>
                  ${PROJECT_CATEGORIES.map(
                    (cat) => `<option value="${cat}" ${project?.category === cat ? 'selected' : ''}>${cat}</option>`
                  ).join('')}
                </select>
              </div>

              <div class="dez-form-group">
                <label for="port-year" class="dez-label">Year completed <span class="dez-req">*</span></label>
                <input type="number" id="port-year" class="dez-input" min="1990" max="2030" value="${project?.year || new Date().getFullYear()}" required />
                <div class="dez-field-error" id="err-port-year"></div>
              </div>
            </div>

            <!-- Location & Role -->
            <div class="dez-form-grid-2">
              <div class="dez-form-group">
                <label for="port-location" class="dez-label">Location (City, Country) <span class="dez-req">*</span></label>
                <input type="text" id="port-location" class="dez-input" value="${project?.location || ''}" placeholder="e.g. Zurich, Switzerland" required />
                <div class="dez-field-error" id="err-port-location"></div>
              </div>

              <div class="dez-form-group">
                <label for="port-role" class="dez-label">Your architectural role <span class="dez-req">*</span></label>
                <input type="text" id="port-role" class="dez-input" value="${project?.role || ''}" placeholder="e.g. Lead Architect, Interior Director" required />
                <div class="dez-field-error" id="err-port-role"></div>
              </div>
            </div>

            <!-- Description -->
            <div class="dez-form-group">
              <label for="port-desc" class="dez-label">Short project summary <span class="dez-req">*</span></label>
              <textarea id="port-desc" class="dez-textarea" rows="3" maxlength="400" placeholder="Describe the architectural concept, materials, client brief, and unique spatial features...">${project?.shortDescription || ''}</textarea>
              <div class="dez-field-error" id="err-port-desc"></div>
            </div>

            <!-- Project Images Section (1 to 12) -->
            <div class="dez-form-group" style="margin-top: 20px;">
              <div class="dez-label-with-action">
                <label class="dez-label">Project photography & drawings <span class="dez-req">*</span></label>
                <span class="dez-field-hint" id="image-count-indicator">${currentImages.length}/12 images</span>
              </div>
              <p class="dez-sub-hint">Upload high-resolution photography. JPG, PNG or WebP up to 5MB each. Minimum 1 image required.</p>

              <!-- Dropzone -->
              <div class="dez-upload-dropzone" id="port-image-dropzone" tabindex="0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" style="color:var(--dez-text-muted); margin-bottom:6px;">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <div class="dez-dropzone-prompt"><strong>Click to add images</strong> or drag and drop</div>
                <div class="dez-dropzone-subtext">Up to 12 files (max 5MB each)</div>
                <input type="file" id="port-file-input" multiple accept="image/jpeg,image/png,image/webp" style="display: none;" />
              </div>

              <!-- Uploading progress simulation -->
              <div id="port-upload-progress-wrap" style="display: none; margin-top: 10px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; color:var(--dez-text-secondary);">
                  <span id="upload-progress-filename">Uploading image...</span>
                  <span id="upload-progress-pct">0%</span>
                </div>
                <div class="dez-completeness-bar-track">
                  <div class="dez-completeness-bar-fill" id="upload-progress-bar" style="width: 0%;"></div>
                </div>
              </div>

              <div class="dez-field-error" id="err-port-images"></div>

              <!-- Image Thumbnails Grid -->
              <div class="dez-port-thumbs-grid" id="port-thumbs-container">
                <!-- Dynamically rendered thumbnails -->
              </div>
            </div>
          </form>
        </div>

        <div class="dez-drawer-footer">
          <button type="button" class="dez-btn-secondary" id="btn-cancel-port-drawer" style="height:36px;">Cancel</button>
          <button type="button" class="dez-btn-primary" id="btn-save-port-project" style="height:36px; padding:0 22px;">
            ${isEdit ? 'Save project changes' : 'Add project'}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initPortfolioProjectDrawer(
  container: HTMLElement,
  project: PortfolioProject | null,
  onSave: (data: Omit<PortfolioProject, 'id' | 'order'> & { id?: string }) => Promise<void>,
  onClose: () => void
): {
  open: () => void;
  close: () => void;
} {
  const drawer = container.querySelector('#drawer-portfolio-project') as HTMLElement;
  const btnClose = container.querySelector('#btn-close-port-drawer') as HTMLButtonElement;
  const btnCancel = container.querySelector('#btn-cancel-port-drawer') as HTMLButtonElement;
  const btnSave = container.querySelector('#btn-save-port-project') as HTMLButtonElement;
  const dropzone = container.querySelector('#port-image-dropzone') as HTMLElement;
  const fileInput = container.querySelector('#port-file-input') as HTMLInputElement;
  const thumbsContainer = container.querySelector('#port-thumbs-container') as HTMLElement;
  const countIndicator = container.querySelector('#image-count-indicator') as HTMLElement;
  const progressWrap = container.querySelector('#port-upload-progress-wrap') as HTMLElement;
  const progressBar = container.querySelector('#upload-progress-bar') as HTMLElement;
  const progressPct = container.querySelector('#upload-progress-pct') as HTMLElement;
  const progressFilename = container.querySelector('#upload-progress-filename') as HTMLElement;
  const errImages = container.querySelector('#err-port-images') as HTMLElement;

  let workingImages: PortfolioImage[] = project?.images ? JSON.parse(JSON.stringify(project.images)) : [];

  const updateThumbs = () => {
    if (countIndicator) {
      countIndicator.textContent = `${workingImages.length}/12 images`;
    }
    if (!thumbsContainer) return;

    if (workingImages.length === 0) {
      thumbsContainer.innerHTML = '';
      return;
    }

    thumbsContainer.innerHTML = workingImages
      .map(
        (img, idx) => `
        <div class="dez-port-thumb-card ${img.isCover ? 'is-cover' : ''}" data-img-idx="${idx}">
          <img src="${img.url}" alt="Project image ${idx + 1}" class="dez-port-thumb-img" />
          <div class="dez-port-thumb-overlay">
            ${
              img.isCover
                ? `<span class="dez-cover-badge">Cover</span>`
                : `<button type="button" class="dez-thumb-btn-cover" data-action="set-cover" data-img-idx="${idx}">Set cover</button>`
            }
            <button type="button" class="dez-thumb-btn-remove" data-action="remove-img" data-img-idx="${idx}" title="Remove image" aria-label="Remove image">&times;</button>
          </div>
        </div>
      `
      )
      .join('');

    // Attach actions
    thumbsContainer.querySelectorAll('[data-action="set-cover"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-img-idx') || '0', 10);
        workingImages.forEach((im, i) => {
          im.isCover = i === idx;
        });
        updateThumbs();
      });
    });

    thumbsContainer.querySelectorAll('[data-action="remove-img"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-img-idx') || '0', 10);
        const wasCover = workingImages[idx]?.isCover;
        workingImages.splice(idx, 1);
        if (wasCover && workingImages.length > 0) {
          workingImages[0].isCover = true;
        }
        updateThumbs();
      });
    });
  };

  updateThumbs();

  // Drag and drop & file select
  dropzone?.addEventListener('click', () => fileInput?.click());
  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('is-drag-over');
  });
  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('is-drag-over');
  });
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-drag-over');
    if (e.dataTransfer?.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files) {
      handleFiles(Array.from(fileInput.files));
    }
  });

  function handleFiles(files: File[]) {
    if (errImages) errImages.textContent = '';
    const validFiles = files.filter((f) => {
      if (f.size > 5 * 1024 * 1024) {
        if (errImages) errImages.textContent = `File "${f.name}" exceeds the 5MB size limit.`;
        return false;
      }
      return true;
    });

    if (workingImages.length + validFiles.length > 12) {
      if (errImages) errImages.textContent = 'Maximum 12 images allowed per portfolio project.';
      return;
    }

    if (validFiles.length === 0) return;

    // Simulate progress bar for first image
    if (progressWrap && progressBar && progressPct && progressFilename) {
      progressWrap.style.display = 'block';
      progressFilename.textContent = `Uploading ${validFiles[0].name}...`;
      progressBar.style.width = '30%';
      progressPct.textContent = '30%';

      setTimeout(() => {
        progressBar.style.width = '70%';
        progressPct.textContent = '70%';
      }, 100);

      setTimeout(() => {
        progressBar.style.width = '100%';
        progressPct.textContent = '100%';

        // Process files
        validFiles.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const url = (e.target?.result as string) || '';
            const isCover = workingImages.length === 0;
            workingImages.push({
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              url,
              isCover
            });
            updateThumbs();
          };
          reader.readAsDataURL(file);
        });

        setTimeout(() => {
          progressWrap.style.display = 'none';
          progressBar.style.width = '0%';
        }, 200);
      }, 250);
    }
  }

  // Open & Close logic
  const open = () => {
    if (drawer) {
      drawer.style.display = 'flex';
      drawer.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      drawer.querySelector('input')?.focus();
    }
  };

  const close = () => {
    if (drawer) {
      drawer.style.display = 'none';
      drawer.classList.remove('is-open');
      document.body.style.overflow = '';
      onClose();
    }
  };

  btnClose?.addEventListener('click', close);
  btnCancel?.addEventListener('click', close);
  drawer?.addEventListener('click', (e) => {
    if (e.target === drawer) close();
  });

  // Save button logic
  btnSave?.addEventListener('click', async () => {
    const title = (drawer.querySelector('#port-title') as HTMLInputElement)?.value.trim();
    const category = (drawer.querySelector('#port-category') as HTMLSelectElement)?.value;
    const year = parseInt((drawer.querySelector('#port-year') as HTMLInputElement)?.value || '2024', 10);
    const location = (drawer.querySelector('#port-location') as HTMLInputElement)?.value.trim();
    const role = (drawer.querySelector('#port-role') as HTMLInputElement)?.value.trim();
    const shortDescription = (drawer.querySelector('#port-desc') as HTMLTextAreaElement)?.value.trim();

    let valid = true;
    const setErr = (id: string, msg: string) => {
      const el = drawer.querySelector(`#${id}`);
      if (el) el.textContent = msg;
      valid = false;
    };
    const clearErr = (id: string) => {
      const el = drawer.querySelector(`#${id}`);
      if (el) el.textContent = '';
    };

    ['err-port-title', 'err-port-year', 'err-port-location', 'err-port-role', 'err-port-desc', 'err-port-images'].forEach(clearErr);

    if (!title) setErr('err-port-title', 'Project title is required.');
    if (!year || year < 1990) setErr('err-port-year', 'Valid completion year required.');
    if (!location) setErr('err-port-location', 'Location is required.');
    if (!role) setErr('err-port-role', 'Your role is required.');
    if (!shortDescription) setErr('err-port-desc', 'Project summary description is required.');
    if (workingImages.length === 0) setErr('err-port-images', 'Please upload at least 1 image.');

    if (!valid) return;

    btnSave.disabled = true;
    btnSave.textContent = 'Saving...';

    // Ensure one cover exists
    if (!workingImages.some((img) => img.isCover) && workingImages.length > 0) {
      workingImages[0].isCover = true;
    }

    try {
      await onSave({
        id: project?.id,
        title,
        category,
        year,
        location,
        role,
        shortDescription,
        images: workingImages
      });
      close();
    } catch {
      btnSave.disabled = false;
      btnSave.textContent = project ? 'Save project changes' : 'Add project';
    }
  });

  return { open, close };
}
