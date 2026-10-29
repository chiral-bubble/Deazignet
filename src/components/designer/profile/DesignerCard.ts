/**
 * DesignerCard Component
 * Reusable card for search results, directory browsing, and client project recommendations.
 * Displays: avatar, name, title, location, specialization chips, rating, starting rate,
 * and verified accreditation mark. Links to public profile.
 */

import type { DesignerProfile } from '../../../services/designerProfileService';

export function renderDesignerCard(designer: DesignerProfile, isSaved: boolean = false): string {
  const isVerified = (designer.credentials || []).some((c) => c.status === 'verified');
  const initial = (designer.name || 'D').slice(0, 2).toUpperCase();
  const showRate = designer.hourlyRate && !designer.hideRateFromPeers;

  return `
    <article class="dez-designer-card" data-designer-id="${designer.id}" tabindex="0">
      <div class="dez-dcard-header">
        <div class="dez-dcard-avatar-wrap">
          ${
            designer.avatarUrl
              ? `<img src="${designer.avatarUrl}" alt="${designer.name}" class="dez-dcard-avatar" />`
              : `<div class="dez-dcard-avatar-placeholder">${initial}</div>`
          }
          ${
            designer.isAvailableForProjects
              ? `<span class="dez-avail-dot" title="Available for new commissions" aria-label="Available"></span>`
              : ''
          }
        </div>

        <div class="dez-dcard-identity" style="flex: 1;">
          <div class="dez-dcard-name-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <h3 class="dez-dcard-name" style="margin: 0;">
                <a href="#/designers/${designer.id}" class="dez-dcard-name-link" data-designer-id="${designer.id}">
                  ${designer.name}
                </a>
              </h3>
              ${
                isVerified
                  ? `
                <span class="dez-verified-badge" title="Council Authenticated Accreditation" aria-label="Verified Designer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Verified</span>
                </span>
              `
                  : ''
              }
            </div>

            <!-- Save Bookmark Icon Button -->
            <button type="button" class="dez-bookmark-btn btn-save-designer-card ${isSaved ? 'is-saved' : ''}" data-designer-id="${designer.id}" title="${isSaved ? 'Remove from saved' : 'Save designer'}" aria-label="Save designer" onclick="event.stopPropagation();" style="border: none; background: transparent; cursor: pointer; color: ${isSaved ? '#2F7BE5' : '#9CA3AF'}; padding: 2px;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isSaved ? '#2F7BE5' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
          </div>
          <p class="dez-dcard-title">${designer.professionalTitle}</p>
          <p class="dez-dcard-location">📍 ${designer.location.city}, ${designer.location.state}</p>
        </div>
      </div>

      <!-- About Excerpt -->
      <p class="dez-dcard-bio">
        ${designer.about ? designer.about.slice(0, 130) + '...' : 'Specialized architectural design and spatial planning commissions.'}
      </p>

      <!-- Specializations Chips -->
      <div class="dez-dcard-specs">
        ${(designer.specializations || [])
          .slice(0, 3)
          .map((s) => `<span class="dez-dcard-spec-chip">${s}</span>`)
          .join('')}
        ${
          (designer.specializations || []).length > 3
            ? `<span class="dez-dcard-spec-more">+${designer.specializations.length - 3}</span>`
            : ''
        }
      </div>

      <!-- Footer: Rating & Rate -->
      <div class="dez-dcard-footer">
        <div class="dez-dcard-rating">
          ${
            designer.stats.averageRating > 0
              ? `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <strong>${designer.stats.averageRating.toFixed(2)}</strong>
            <span class="dez-dcard-rev-count">(${designer.stats.reviewCount})</span>
          `
              : `<span class="dez-dcard-new-badge">New on Dezignet</span>`
          }
        </div>

        <div class="dez-dcard-rate">
          ${
            showRate
              ? `<span class="dez-rate-prefix">From</span> <strong>$${designer.hourlyRate}</strong><span class="dez-rate-suffix">/hr</span>`
              : `<span class="dez-rate-prefix" style="color: #6B7280; font-size: 12px;">Available for commissions</span>`
          }
        </div>
      </div>
    </article>
  `;
}
