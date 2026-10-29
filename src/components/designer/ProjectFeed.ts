/**
 * ProjectFeed Component (Designer View)
 * Clean project browser with filter bar, list/grid views, skeletons, and empty state.
 */

import { toggleSaveProject, type Project, type ProjectFiltersState } from '../../services/projectsService';
import { renderProjectFilters } from './ProjectFilters';
import { renderProjectListItem } from './ProjectListItem';

export function renderProjectFeed(
  projects: Project[],
  filters: ProjectFiltersState,
  viewMode: 'list' | 'grid' = 'list',
  isLoading: boolean = false
): string {
  const filterBarHtml = renderProjectFilters(filters);

  // Content area
  let contentHtml = '';
  if (isLoading) {
    // 3 skeleton rows
    contentHtml = `
      <div class="dez-projects-list">
        ${[1, 2, 3].map(() => `
          <div class="dez-skeleton-row">
            <div class="dez-skeleton-block" style="width: 40%; height: 20px;"></div>
            <div class="dez-skeleton-block" style="width: 25%; height: 16px;"></div>
            <div class="dez-skeleton-block" style="width: 90%; height: 36px;"></div>
            <div class="dez-skeleton-block" style="width: 70%; height: 16px; margin-top: 10px;"></div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (projects.length === 0) {
    contentHtml = `
      <div class="dez-empty-state">
        <p class="dez-empty-text">No open architectural projects match your selected filters.</p>
        <button type="button" class="dez-btn-secondary" id="dez-empty-clear-btn">Clear filters</button>
      </div>
    `;
  } else if (viewMode === 'grid') {
    contentHtml = `
      <div class="dez-projects-grid">
        ${projects.map((p) => renderProjectListItem(p, 'grid')).join('')}
      </div>
    `;
  } else {
    contentHtml = `
      <div class="dez-projects-list">
        ${projects.map((p) => renderProjectListItem(p, 'list')).join('')}
      </div>
    `;
  }

  return `
    <div class="dez-feed-view" id="dez-feed-view">
      <!-- Page Title & Subtext -->
      <header class="dez-page-header">
        <h1 class="dez-page-title">Client Projects</h1>
        <p class="dez-page-subtext">Open projects looking for designers</p>
      </header>

      <!-- Filter Bar -->
      ${filterBarHtml}

      <!-- Results Count Bar & Sorter -->
      <div class="dez-results-bar">
        <div class="dez-result-count" id="dez-result-count">
          ${projects.length} open project${projects.length === 1 ? '' : 's'}
        </div>

        <div class="dez-results-actions">
          <select class="dez-sort-select" id="dez-sort-select" aria-label="Sort projects">
            <option value="newest" ${filters.sortBy === 'newest' ? 'selected' : ''}>Sort: Newest</option>
            <option value="budget-high" ${filters.sortBy === 'budget-high' ? 'selected' : ''}>Budget: High to low</option>
            <option value="budget-low" ${filters.sortBy === 'budget-low' ? 'selected' : ''}>Budget: Low to high</option>
            <option value="deadline-soon" ${filters.sortBy === 'deadline-soon' ? 'selected' : ''}>Deadline: Soonest</option>
          </select>

          <div class="dez-view-toggle">
            <button 
              type="button" 
              class="dez-view-btn ${viewMode === 'list' ? 'is-active' : ''}" 
              data-set-view="list"
              title="List view"
              aria-label="List view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
            <button 
              type="button" 
              class="dez-view-btn ${viewMode === 'grid' ? 'is-active' : ''}" 
              data-set-view="grid"
              title="Grid view"
              aria-label="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Feed Content -->
      <div id="dez-feed-content">
        ${contentHtml}
      </div>
    </div>
  `;
}

/**
 * Attaches filter, sort, bookmark, and project click events
 */
export function initProjectFeed(
  container: HTMLElement,
  currentFilters: ProjectFiltersState,
  onFiltersChange: (newFilters: ProjectFiltersState) => void,
  onSelectProject: (projectId: string) => void,
  viewMode: 'list' | 'grid',
  onViewModeChange: (mode: 'list' | 'grid') => void
): void {
  // Search input debounced
  const searchInput = container.querySelector('#dez-filter-search') as HTMLInputElement | null;
  let searchTimer: number | undefined;
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      onFiltersChange({ ...currentFilters, search: searchInput.value.trim() });
    }, 250);
  });

  // Category select
  const catSelect = container.querySelector('#dez-filter-category') as HTMLSelectElement | null;
  catSelect?.addEventListener('change', () => {
    onFiltersChange({ ...currentFilters, category: catSelect.value });
  });

  // Location select
  const locSelect = container.querySelector('#dez-filter-location') as HTMLSelectElement | null;
  locSelect?.addEventListener('change', () => {
    onFiltersChange({ ...currentFilters, location: locSelect.value });
  });

  // Payment type select
  const paySelect = container.querySelector('#dez-filter-payment') as HTMLSelectElement | null;
  paySelect?.addEventListener('change', () => {
    onFiltersChange({ ...currentFilters, paymentType: paySelect.value as any });
  });

  // Budget select
  const budgetSelect = container.querySelector('#dez-filter-budget') as HTMLSelectElement | null;
  budgetSelect?.addEventListener('change', () => {
    const val = budgetSelect.value;
    if (val === 'under-50') {
      onFiltersChange({ ...currentFilters, minBudget: undefined, maxBudget: 50000 });
    } else if (val === '50-100') {
      onFiltersChange({ ...currentFilters, minBudget: 50000, maxBudget: 100000 });
    } else if (val === 'above-100') {
      onFiltersChange({ ...currentFilters, minBudget: 100000, maxBudget: undefined });
    } else {
      onFiltersChange({ ...currentFilters, minBudget: undefined, maxBudget: undefined });
    }
  });

  // Saved toggle
  const savedBtn = container.querySelector('#dez-filter-saved-toggle');
  savedBtn?.addEventListener('click', () => {
    onFiltersChange({ ...currentFilters, onlySaved: !currentFilters.onlySaved });
  });

  // Sort select
  const sortSelect = container.querySelector('#dez-sort-select') as HTMLSelectElement | null;
  sortSelect?.addEventListener('change', () => {
    onFiltersChange({ ...currentFilters, sortBy: sortSelect.value as any });
  });

  // View toggle
  container.querySelectorAll('[data-set-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-set-view') as 'list' | 'grid';
      if (mode && mode !== viewMode) {
        onViewModeChange(mode);
      }
    });
  });

  // Remove individual filter chip
  container.querySelectorAll('[data-remove-filter]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.getAttribute('data-remove-filter') as keyof ProjectFiltersState;
      const updated = { ...currentFilters };
      if (key === 'minBudget' || key === 'maxBudget') {
        updated.minBudget = undefined;
        updated.maxBudget = undefined;
      } else if (key === 'onlySaved') {
        updated.onlySaved = false;
      } else {
        delete updated[key];
      }
      onFiltersChange(updated);
    });
  });

  // Clear all button
  const clearBtn = container.querySelector('#dez-clear-filters-btn');
  clearBtn?.addEventListener('click', () => {
    onFiltersChange({});
  });

  const emptyClearBtn = container.querySelector('#dez-empty-clear-btn');
  emptyClearBtn?.addEventListener('click', () => {
    onFiltersChange({});
  });

  // Bookmark toggle
  container.querySelectorAll('[data-save-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = btn.getAttribute('data-save-id');
      if (pid) {
        const isNowSaved = toggleSaveProject(pid);
        btn.classList.toggle('is-saved', isNowSaved);
        btn.innerHTML = isNowSaved
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;
      }
    });
  });

  // Clicking a project card
  container.querySelectorAll('[data-project-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-project-id');
      if (pid) {
        onSelectProject(pid);
      }
    });
    // Keyboard accessibility
    card.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        const pid = card.getAttribute('data-project-id');
        if (pid) onSelectProject(pid);
      }
    });
  });
}
