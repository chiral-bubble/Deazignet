/**
 * ProjectListItem Component (Designer View)
 * Clean list row and grid card representation for client projects.
 */

import type { Project } from '../../services/projectsService';
import { formatMoney } from '../../utils/formatters';

export function renderProjectListItem(project: Project, viewMode: 'list' | 'grid' = 'list'): string {
  const isMilestone = project.paymentType === 'Milestone' || project.paymentType === 'Fixed Fee';
  const paymentBadge = project.paymentType;
  
  // Format budget range
  const budgetMin = project.budgetMin || project.budget_min;
  const budgetFormatted = budgetMin
    ? `$${Number(budgetMin).toLocaleString()} to ${formatMoney(project.budget)}`
    : isMilestone
      ? formatMoney(project.budget)
      : `${formatMoney(project.hourlyRate || 0)}/hr (Est. ${formatMoney(project.budget)})`;

  // Status or proposal badge
  let statusChipHtml = '';
  if (project.hasApplied) {
    statusChipHtml = `<span class="dez-proposal-sent-chip">Proposal sent</span>`;
  } else if (project.status === 'Closed') {
    statusChipHtml = `<span class="dez-closed-chip">Closed</span>`;
  }

  // Licensure requirement chip
  const licReq = project.licensureRequirement || project.licensure_requirement;
  let licChipHtml = '';
  if (licReq === 'licensed_professional_required') {
    licChipHtml = `<span class="dez-plain-chip" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-weight: 600;">Licensed Pro Required</span>`;
  } else if (licReq === 'stamping_required') {
    licChipHtml = `<span class="dez-plain-chip" style="background: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; font-weight: 600;">Stamp Required</span>`;
  }

  // Requested services chips
  const requestedServices = project.requestedServices || project.requested_services || [];
  const servicesChipsHtml = requestedServices.slice(0, 3).map((s) => `
    <span class="dez-plain-chip" style="background: #EFF6FF; color: #1D4ED8; font-size: 11px;">${s}</span>
  `).join('') + (requestedServices.length > 3 ? `<span class="dez-plain-chip" style="font-size: 11px;">+${requestedServices.length - 3} more</span>` : '');

  // Bookmark icon
  const bookmarkIcon = project.isSaved
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

  return `
    <article 
      class="dez-project-row ${viewMode === 'grid' ? 'is-grid-card' : ''}" 
      data-project-id="${project.id}"
      tabindex="0"
      role="button"
      aria-label="View details for ${project.title}"
    >
      <div class="dez-row-top">
        <div class="dez-row-title-area">
          <h3 class="dez-project-title">${project.title}</h3>
          <div class="dez-row-chips" style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
            <span class="dez-plain-chip">${project.category}</span>
            ${project.subcategory ? `<span class="dez-plain-chip">${project.subcategory}</span>` : ''}
            ${licChipHtml}
            ${servicesChipsHtml}
            ${statusChipHtml}
          </div>
        </div>
        <button 
          type="button" 
          class="dez-btn-bookmark ${project.isSaved ? 'is-saved' : ''}" 
          data-save-id="${project.id}" 
          title="${project.isSaved ? 'Remove from saved' : 'Save project'}"
          aria-label="${project.isSaved ? 'Remove from saved' : 'Save project'}"
        >
          ${bookmarkIcon}
        </button>
      </div>

      <p class="dez-project-desc">${project.description}</p>

      <div class="dez-facts-row">
        <div class="dez-fact-item">
          <span class="dez-fact-label">Budget:</span>
          <span class="dez-fact-value is-budget">${budgetFormatted}</span>
        </div>
        <div class="dez-fact-item">
          <span class="dez-fact-label">Payment:</span>
          <span class="dez-fact-value">${paymentBadge}</span>
        </div>
        <div class="dez-fact-item">
          <span class="dez-fact-label">Timeline:</span>
          <span class="dez-fact-value">${project.timeline}</span>
        </div>
        <div class="dez-fact-item">
          <span class="dez-fact-label">Deadline:</span>
          <span class="dez-fact-value">${project.deadline}</span>
        </div>
        <div class="dez-fact-item">
          <span class="dez-fact-label">Location:</span>
          <span class="dez-fact-value">${project.location.split(',')[0]}</span>
        </div>
        <div class="dez-fact-item">
          <span class="dez-fact-label">Area:</span>
          <span class="dez-fact-value">${project.area.toLocaleString()} sq ft</span>
        </div>

        <div class="dez-facts-meta-right">
          <span>Posted ${project.postedDate}</span>
          <span>•</span>
          <span>${project.proposalsCount} proposals</span>
        </div>
      </div>
    </article>
  `;
}
