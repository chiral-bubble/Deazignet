/**
 * QuickActions Component
 * Section E of Right Column:
 * Shown only when relevant:
 * - "Upload deliverable" (primary, only if one is due)
 * - "Request review" (only if deliverable is uploaded and awaiting review)
 * - "Browse client projects" (outlined)
 * - "Contact support" (text link)
 * No invented actions.
 */

import type { ActiveProject } from '../../../services/designerDashboardService';

export function renderQuickActions(activeProjects: ActiveProject[]): string {
  // Check conditions
  const projectWithDeliverableDue = activeProjects.find((p) => p.paymentType === 'Milestone' && p.isDeliverableDue);
  const projectAwaitingReview = activeProjects.find((p) => p.paymentType === 'Milestone' && p.awaitingReview);

  return `
    <section class="dez-quick-actions-section" aria-label="Quick actions">
      <div class="dez-section-header">
        <h2 class="dez-section-title">Quick actions</h2>
      </div>

      <div class="dez-quick-actions-card">
        ${
          projectWithDeliverableDue
            ? `
              <button type="button" class="dez-btn-primary dez-btn-full btn-quick-upload-deliverable" data-project-id="${projectWithDeliverableDue.id}" data-project-title="${projectWithDeliverableDue.title}">
                Upload deliverable
              </button>
            `
            : ''
        }

        ${
          projectAwaitingReview
            ? `
              <button type="button" class="dez-btn-outline dez-btn-full btn-quick-request-review" data-project-id="${projectAwaitingReview.id}" data-project-title="${projectAwaitingReview.title}">
                Request review
              </button>
            `
            : ''
        }

        <button type="button" class="dez-btn-outline dez-btn-full" data-designer-tab="projects" id="btn-quick-browse-projects">
          Browse client projects
        </button>

        <div class="dez-support-link-wrap">
          <a href="mailto:support@dezignet.com" class="dez-link-muted" id="link-contact-support">
            Contact support
          </a>
        </div>
      </div>
    </section>
  `;
}
