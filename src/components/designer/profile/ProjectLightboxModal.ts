/**
 * ProjectLightboxModal Component
 * Fullscreen / modal lightbox showing high-resolution project photography gallery,
 * project metadata, concept description, and image captions.
 */

import type { PortfolioProject } from '../../../services/designerProfileService';

export function renderProjectLightboxModal(project: PortfolioProject): string {
  const images = project.images || [];

  return `
    <div class="dez-dash-modal-backdrop is-open" id="modal-project-lightbox" style="display: flex;" role="dialog" aria-modal="true" aria-labelledby="lightbox-project-title">
      <div class="dez-lightbox-dialog">
        <!-- Close Button -->
        <button type="button" class="dez-lightbox-close" id="btn-close-lightbox" aria-label="Close project view">&times;</button>

        <div class="dez-lightbox-grid">
          <!-- Gallery Carousel Column -->
          <div class="dez-lightbox-gallery-col">
            <div class="dez-lightbox-active-img-wrap">
              <img id="lightbox-active-img" src="${images[0]?.url || ''}" alt="${project.title}" class="dez-lightbox-active-img" />
              ${
                images.length > 1
                  ? `
                <button type="button" class="dez-lightbox-nav-btn prev" id="btn-lightbox-prev" aria-label="Previous image">&larr;</button>
                <button type="button" class="dez-lightbox-nav-btn next" id="btn-lightbox-next" aria-label="Next image">&rarr;</button>
              `
                  : ''
              }
              <div class="dez-lightbox-caption" id="lightbox-caption-text">
                ${images[0]?.caption || project.title}
              </div>
            </div>

            <!-- Thumbnail Strip -->
            ${
              images.length > 1
                ? `
              <div class="dez-lightbox-thumb-strip" id="lightbox-thumb-strip">
                ${images
                  .map(
                    (img, idx) => `
                  <button type="button" class="dez-lightbox-thumb-btn ${idx === 0 ? 'is-active' : ''}" data-idx="${idx}" aria-label="View photo ${idx + 1}">
                    <img src="${img.url}" alt="Thumbnail ${idx + 1}" />
                  </button>
                `
                  )
                  .join('')}
              </div>
            `
                : ''
            }
          </div>

          <!-- Project Metadata Column -->
          <div class="dez-lightbox-info-col">
            <div class="dez-lightbox-meta-top">
              <span class="dez-port-card-category">${project.category}</span>
              <span class="dez-lightbox-year">${project.year}</span>
            </div>

            <h2 class="dez-lightbox-title" id="lightbox-project-title">${project.title}</h2>
            
            <div class="dez-lightbox-spec-list">
              <div class="dez-spec-row">
                <span class="dez-spec-label">Location:</span>
                <span class="dez-spec-value">${project.location}</span>
              </div>
              <div class="dez-spec-row">
                <span class="dez-spec-label">Role:</span>
                <span class="dez-spec-value">${project.role}</span>
              </div>
              <div class="dez-spec-row">
                <span class="dez-spec-label">Photos:</span>
                <span class="dez-spec-value">${images.length} images</span>
              </div>
            </div>

            <div class="dez-lightbox-divider"></div>

            <div class="dez-lightbox-desc-wrap">
              <h4 class="dez-lightbox-heading">Architectural Overview</h4>
              <p class="dez-lightbox-desc-text">${project.shortDescription}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initProjectLightboxModal(
  container: HTMLElement,
  project: PortfolioProject,
  onClose: () => void
): void {
  const modal = container.querySelector('#modal-project-lightbox') as HTMLElement;
  const btnClose = container.querySelector('#btn-close-lightbox') as HTMLButtonElement;
  const btnPrev = container.querySelector('#btn-lightbox-prev') as HTMLButtonElement;
  const btnNext = container.querySelector('#btn-lightbox-next') as HTMLButtonElement;
  const activeImg = container.querySelector('#lightbox-active-img') as HTMLImageElement;
  const captionEl = container.querySelector('#lightbox-caption-text') as HTMLElement;
  const thumbBtns = container.querySelectorAll<HTMLButtonElement>('.dez-lightbox-thumb-btn');

  let activeIndex = 0;
  const images = project.images || [];

  const updateImage = (index: number) => {
    if (images.length === 0) return;
    activeIndex = (index + images.length) % images.length;
    const current = images[activeIndex];
    if (activeImg && current) activeImg.src = current.url;
    if (captionEl && current) captionEl.textContent = current.caption || project.title;

    thumbBtns.forEach((btn, idx) => {
      btn.classList.toggle('is-active', idx === activeIndex);
    });
  };

  btnPrev?.addEventListener('click', () => updateImage(activeIndex - 1));
  btnNext?.addEventListener('click', () => updateImage(activeIndex + 1));

  thumbBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
      updateImage(idx);
    });
  });

  const close = () => {
    document.body.style.overflow = '';
    onClose();
  };

  btnClose?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.body.style.overflow = 'hidden';
}
