/**
 * ProfileCompleteness Component
 * Slim bordered strip at top of Profile Settings with a blue progress bar
 * and a checklist of missing items that link to the relevant tab.
 * Hidden at 100%.
 */

import type { ProfileCompletenessResult } from '../../../services/designerProfileService';

export function renderProfileCompleteness(completeness: ProfileCompletenessResult): string {
  if (completeness.score >= 100) {
    return ''; // Hidden at 100% as per requirements
  }

  const missingItems = completeness.checklist.filter((item) => !item.completed);

  return `
    <div class="dez-completeness-strip" role="region" aria-label="Profile completeness">
      <div class="dez-completeness-content">
        <div class="dez-completeness-meta">
          <div class="dez-completeness-label-row">
            <span class="dez-completeness-title">Profile completeness: <strong>${completeness.score}%</strong></span>
            <span class="dez-completeness-hint">Complete your profile to qualify for the Verified Designer accreditation</span>
          </div>
          <div class="dez-completeness-bar-track">
            <div class="dez-completeness-bar-fill" style="width: ${completeness.score}%;"></div>
          </div>
        </div>

        ${
          missingItems.length > 0
            ? `
          <div class="dez-completeness-missing-list">
            <span class="dez-missing-label">Missing:</span>
            ${missingItems
              .map(
                (item) => `
              <button type="button" class="dez-missing-link-btn" data-jump-tab="${item.tab}">
                + ${item.label}
              </button>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

export function initProfileCompleteness(
  container: HTMLElement,
  onJumpTab: (tab: string) => void
): void {
  const jumpButtons = container.querySelectorAll<HTMLButtonElement>('[data-jump-tab]');
  jumpButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-jump-tab');
      if (targetTab) {
        onJumpTab(targetTab);
      }
    });
  });
}
