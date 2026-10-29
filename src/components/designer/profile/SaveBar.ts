/**
 * SaveBar Component
 * Sticky save bar at the bottom that appears ONLY when there are unsaved changes.
 * Contains "Unsaved changes", Discard, and Save changes buttons.
 */

export function renderSaveBar(): string {
  return `
    <div class="dez-sticky-savebar" id="dez-profile-savebar" aria-live="polite" role="region" aria-label="Unsaved profile changes">
      <div class="dez-savebar-inner">
        <div class="dez-savebar-left">
          <span class="dez-savebar-dot" aria-hidden="true"></span>
          <span class="dez-savebar-text">You have unsaved changes</span>
        </div>
        <div class="dez-savebar-actions">
          <button type="button" class="dez-btn-secondary" id="btn-savebar-discard" style="height: 36px; padding: 0 16px;">
            Discard
          </button>
          <button type="button" class="dez-btn-primary" id="btn-savebar-save" style="height: 36px; padding: 0 20px;">
            Save changes
          </button>
        </div>
      </div>
    </div>
  `;
}

export function initSaveBar(
  container: HTMLElement,
  onSave: () => void,
  onDiscard: () => void
): {
  show: () => void;
  hide: () => void;
  setSaving: (saving: boolean) => void;
} {
  const bar = container.querySelector('#dez-profile-savebar') as HTMLElement | null;
  const saveBtn = container.querySelector('#btn-savebar-save') as HTMLButtonElement | null;
  const discardBtn = container.querySelector('#btn-savebar-discard') as HTMLButtonElement | null;

  saveBtn?.addEventListener('click', onSave);
  discardBtn?.addEventListener('click', onDiscard);

  return {
    show: () => {
      if (bar) bar.classList.add('is-visible');
    },
    hide: () => {
      if (bar) bar.classList.remove('is-visible');
    },
    setSaving: (saving: boolean) => {
      if (saveBtn) {
        saveBtn.disabled = saving;
        saveBtn.textContent = saving ? 'Saving...' : 'Save changes';
      }
      if (discardBtn) {
        discardBtn.disabled = saving;
      }
    }
  };
}
