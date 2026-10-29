/**
 * ActiveProjectList Component
 * Section A of Left Column:
 * - Title "Active projects" with text filters on the right (All, Milestone, Hourly)
 * - List of project rows
 * - Empty state with "Browse Client Projects" button
 */

import type { ActiveProject } from '../../../services/designerDashboardService';
import { renderProjectRow } from './ProjectRow';
import { renderEmptyState } from './EmptyState';

export function renderActiveProjectList(
  projects: ActiveProject[],
  currentFilter: 'all' | 'milestone' | 'hourly' = 'all'
): string {
  return `
    <section class="dez-active-projects-section" aria-label="Active architectural projects">
      <div class="dez-section-header">
        <div class="dez-section-title-wrap">
          <h2 class="dez-section-title">Active projects</h2>
          <span class="dez-section-count">(${projects.length})</span>
        </div>

        <!-- Filter tabs: All, Milestone, Hourly -->
        <div class="dez-filter-text-tabs" role="tablist" aria-label="Filter projects by billing type">
          <button type="button" class="dez-tab-link ${currentFilter === 'all' ? 'is-active' : ''}" data-filter-type="all" role="tab" aria-selected="${currentFilter === 'all'}">
            All
          </button>
          <span class="dez-filter-pipe">/</span>
          <button type="button" class="dez-tab-link ${currentFilter === 'milestone' ? 'is-active' : ''}" data-filter-type="milestone" role="tab" aria-selected="${currentFilter === 'milestone'}">
            Milestone
          </button>
          <span class="dez-filter-pipe">/</span>
          <button type="button" class="dez-tab-link ${currentFilter === 'hourly' ? 'is-active' : ''}" data-filter-type="hourly" role="tab" aria-selected="${currentFilter === 'hourly'}">
            Hourly
          </button>
        </div>
      </div>

      <!-- Project Rows or Empty State -->
      <div class="dez-active-projects-list" id="dez-active-projects-container">
        ${
          projects.length > 0
            ? projects.map((p) => renderProjectRow(p)).join('')
            : renderEmptyState({
                message: 'No active projects yet.',
                subtext: 'Browse client projects to send your first proposal.',
                actionText: 'Browse Client Projects',
                actionTab: 'projects',
                actionId: 'btn-empty-browse-projects'
              })
        }
      </div>
    </section>
  `;
}
