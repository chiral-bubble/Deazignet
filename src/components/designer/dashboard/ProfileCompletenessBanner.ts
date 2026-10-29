/**
 * ProfileCompletenessBanner Component
 * Conditional plain light-grey bordered strip shown only when the designer's profile is incomplete.
 * Plain styling: #F7F7F8, 1px #E5E7EB border, 8px radius, blue progress bar.
 */

import type { ProfileCompleteness } from '../../../services/designerDashboardService';

export function renderProfileCompletenessBanner(profile: ProfileCompleteness): string {
  if (profile.isComplete) {
    return ''; // Hidden when complete
  }

  const missingListText = profile.missingItems.join(' • ');

  return `
    <section class="dez-profile-banner" aria-label="Profile completeness alert">
      <div class="dez-profile-banner-content">
        <div class="dez-profile-banner-header">
          <div class="dez-profile-banner-headline">
            <span class="dez-profile-alert-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </span>
            <strong class="dez-profile-banner-msg">Complete your profile to start sending proposals</strong>
          </div>
          <span class="dez-profile-banner-pct">${profile.percentage}% completed</span>
        </div>

        <div class="dez-profile-progress-track" role="progressbar" aria-valuenow="${profile.percentage}" aria-valuemin="0" aria-valuemax="100">
          <div class="dez-profile-progress-fill" style="width: ${profile.percentage}%;"></div>
        </div>

        <div class="dez-profile-banner-footer">
          <div class="dez-profile-missing-list">
            <span class="dez-missing-label">Missing:</span>
            <span>${missingListText}</span>
          </div>

          <button type="button" class="dez-btn-primary dez-btn-sm" data-designer-tab="settings" id="btn-complete-profile">
            Complete profile
          </button>
        </div>
      </div>
    </section>
  `;
}
