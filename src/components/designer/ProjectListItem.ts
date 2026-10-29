/**
 * ProjectListItem Component (Designer View)
 * Clean list row and grid card representation for client projects.
 */

import type { Project } from '../../services/projectsService';

export function renderProjectListItem(project: Project, viewMode: 'list' | 'grid' = 'list'): string {
  const isMilestone = project.paymentType === 'Milestone';
  const paymentBadge = isMilestone ? 'Milestone' : 'Hourly';
  
  // Format budget
  const budgetFormatted = isMilestone
    ? `$${project.budget.toLocaleString()}`
    : `$${project.hourlyRate || 0}/hr (Est. $${project.budget.toLocaleString()})`;

  // Status or proposal badge
  let statusChipHtml = '';
  if (project.hasApplied) {
    statusChipHtml = `<span class="dez-proposal-sent-chip">Proposal sent</span>`;
  } else if (project.status === 'Closed') {
    statusChipHtml = `<span class="dez-closed-chip">Closed</span>`;
  }

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
          <div class="dez-row-chips">
            <span class="dez-plain-chip">${project.category}</span>
            <span class="dez-plain-chip">${project.subcategory}</span>
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
