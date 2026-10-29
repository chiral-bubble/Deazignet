/**
 * ProjectRow Component
 * Renders an active commission row (Milestone or Hourly).
 * White background, 1px #E5E7EB border, 8px radius, no shadow.
 */

import type { ActiveProject } from '../../../services/designerDashboardService';

export function renderProjectRow(project: ActiveProject): string {
  const isMilestone = project.paymentType === 'Milestone';

  // Milestone details
  const completedCount = project.completedMilestonesCount || 0;
  const totalCount = project.totalMilestonesCount || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const escrowFormatted = project.escrowCurrentMilestone ? `$${project.escrowCurrentMilestone.toLocaleString()}` : '$0';

  // Status text AA contrast color class
  let statusTextClass = 'dez-status-awaiting';
  if (project.status === 'in_review') {
    statusTextClass = 'dez-status-review';
  } else if (project.status === 'approved_released') {
    statusTextClass = 'dez-status-approved';
  }

  return `
    <article class="dez-active-proj-card" data-project-id="${project.id}">
      <!-- Header row: Title, client, chip -->
      <div class="dez-proj-card-top">
        <div class="dez-proj-meta-left">
          <div class="dez-proj-title-row">
            <h3 class="dez-proj-title">${project.title}</h3>
            <span class="dez-payment-chip">${project.paymentType}</span>
          </div>
          <p class="dez-proj-client-line">
            <span>${project.clientName}</span>
            <span class="dez-dot-sep">•</span>
            <span>${project.clientCompany}</span>
            <span class="dez-dot-sep">•</span>
            <span>${project.clientLocation}</span>
          </p>
        </div>

        <!-- Right Side Quick Links / Actions -->
        <div class="dez-proj-actions-right">
          ${
            isMilestone && project.isDeliverableDue
              ? `<button type="button" class="dez-btn-primary dez-btn-sm btn-upload-deliverable" data-project-id="${project.id}" data-project-title="${project.title}">
                  Upload deliverable
                </button>`
              : isMilestone && project.awaitingReview
              ? `<button type="button" class="dez-btn-outline dez-btn-sm btn-request-review" data-project-id="${project.id}" data-project-title="${project.title}">
                  Request review
                </button>`
              : isMilestone
              ? `<button type="button" class="dez-btn-outline dez-btn-sm btn-upload-deliverable" data-project-id="${project.id}" data-project-title="${project.title}">
                  Upload deliverable
                </button>`
              : ''
          }

          ${
            !isMilestone
              ? `<button type="button" class="dez-btn-outline dez-btn-sm btn-log-hours" data-project-id="${project.id}" data-project-title="${project.title}">
                  Log hours
                </button>`
              : ''
          }

          <a href="#my-work/projects/${project.id}" class="dez-link-action dez-view-proj-link" data-view-project-id="${project.id}">
            View project &rarr;
          </a>
        </div>
      </div>

      <!-- Specific Commission Details -->
      ${
        isMilestone
          ? `
            <div class="dez-proj-milestone-panel">
              <div class="dez-milestone-subrow">
                <div class="dez-milestone-phase-info">
                  <span class="dez-milestone-label">Current Milestone:</span>
                  <strong class="dez-milestone-name">${project.currentMilestoneName || 'Active Phase'}</strong>
                </div>
                <div class="dez-milestone-status-tag ${statusTextClass}">
                  ${project.statusLabel}
                </div>
              </div>

              <!-- Thin blue progress bar -->
              <div class="dez-milestone-progress-wrap">
                <div class="dez-milestone-progress-bar" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100">
                  <div class="dez-milestone-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <span class="dez-milestone-count-text">${completedCount} of ${totalCount} milestones completed (${progressPercent}%)</span>
              </div>

              <!-- Key facts row -->
              <div class="dez-milestone-facts-strip">
                <div class="dez-mfact-item">
                  <span class="dez-mfact-label">Next deadline</span>
                  <strong class="dez-mfact-val">${project.nextDeadline} <span class="dez-mfact-rel">(${project.relativeDeadline})</span></strong>
                </div>
                <div class="dez-mfact-item">
                  <span class="dez-mfact-label">In escrow</span>
                  <strong class="dez-mfact-val dez-num-tabular">${escrowFormatted}</strong>
                </div>
              </div>
            </div>
          `
          : `
            <div class="dez-proj-hourly-panel">
              <div class="dez-hourly-facts-strip">
                <div class="dez-mfact-item">
                  <span class="dez-mfact-label">Hours logged this week</span>
                  <strong class="dez-mfact-val dez-num-tabular">${project.hoursThisWeek || 0} hrs</strong>
                </div>
                <div class="dez-mfact-item">
                  <span class="dez-mfact-label">Hourly rate</span>
                  <strong class="dez-mfact-val dez-num-tabular">$${project.hourlyRate} / hr</strong>
                </div>
                <div class="dez-mfact-item">
                  <span class="dez-mfact-label">Amount to invoice</span>
                  <strong class="dez-mfact-val dez-num-tabular">$${(project.unbilledAmount || 0).toLocaleString()}</strong>
                </div>
                <div class="dez-mfact-item">
                  <span class="dez-mfact-label">All-time logged</span>
                  <strong class="dez-mfact-val dez-num-tabular">${project.totalHoursLogged || 0} hrs</strong>
                </div>
              </div>
            </div>
          `
      }
    </article>
  `;
}
