/**
 * AttachmentChip Component
 * Renders attachment chips and supports image lightbox view.
 */

import { type ConversationAttachment } from '../../../mocks/dataset';

export function renderAttachmentChip(att: ConversationAttachment): string {
  const isImg = att.type === 'image';
  const sizeFormatted = (att.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB';

  if (isImg) {
    return `
      <div class="dez-attachment-chip dez-attachment-img-wrap" style="display: inline-block; margin-top: 6px;">
        <button
          type="button"
          class="btn-open-lightbox"
          data-img-url="${att.url}"
          data-img-caption="${att.name}"
          style="border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; padding: 0; background: none; cursor: pointer; display: block;"
        >
          <img src="${att.thumbnailUrl || att.url}" alt="${att.name}" style="display: block; width: 140px; height: 100px; object-fit: cover;" />
        </button>
        <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">${att.name} (${sizeFormatted})</div>
      </div>
    `;
  }

  return `
    <div class="dez-attachment-chip" style="margin-top: 6px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; padding: 6px 10px; display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      <div>
        <a href="${att.url}" target="_blank" rel="noopener noreferrer" style="color: #111827; font-weight: 500; text-decoration: none;">
          ${att.name}
        </a>
        <div style="font-size: 11px; color: #6B7280;">${sizeFormatted}</div>
      </div>
    </div>
  `;
}

export function renderLightboxModal(): string {
  return `
    <div class="dez-dash-modal-backdrop" id="modal-img-lightbox" style="display: none; background: rgba(0,0,0,0.85);" role="dialog" aria-modal="true">
      <div style="position: relative; max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center;">
        <button type="button" id="btn-close-lightbox" style="position: absolute; right: -40px; top: -40px; background: none; border: none; color: #FFFFFF; font-size: 32px; cursor: pointer;" aria-label="Close preview">&times;</button>
        <img id="lightbox-full-img" src="" alt="" style="max-width: 100%; max-height: 80vh; object-fit: contain; border-radius: 6px;" />
        <div id="lightbox-caption" style="color: #F3F4F6; font-size: 13px; margin-top: 10px;"></div>
      </div>
    </div>
  `;
}

export function initLightbox(container: HTMLElement): void {
  const modal = container.querySelector('#modal-img-lightbox') as HTMLElement;
  const fullImg = container.querySelector('#lightbox-full-img') as HTMLImageElement;
  const caption = container.querySelector('#lightbox-caption') as HTMLElement;
  const btnClose = container.querySelector('#btn-close-lightbox');

  function open(url: string, title: string) {
    if (!modal || !fullImg) return;
    fullImg.src = url;
    if (caption) caption.textContent = title;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  container.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('.btn-open-lightbox') as HTMLButtonElement | null;
    if (target) {
      const url = target.getAttribute('data-img-url') || '';
      const cap = target.getAttribute('data-img-caption') || '';
      open(url, cap);
    }
  });

  btnClose?.addEventListener('click', close);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
}
