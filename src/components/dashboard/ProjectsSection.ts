/**
 * ProjectsSection Component — Full project management with Grid, List & Board views,
 * segmented glass filter tabs, search, sort, and project detail view.
 */

import { dashIcons } from './dashboardIcons';
import { initialProjects, type ProjectItem } from './dashboardData';
import {
  renderProjectCardGrid,
  renderProjectCardList,
  renderProjectCardBoard
} from './ProjectCard';

export type FilterStatus = 'all' | 'pending' | 'ongoing' | 'completed';
export type ViewMode = 'grid' | 'list' | 'board';
export type SortOption = 'newest' | 'budget-high' | 'budget-low';

export function renderProjectsSection(): string {
  // Counts
  const total = initialProjects.length;
  const pendingCount = initialProjects.filter((p) => p.status === 'pending').length;
  const ongoingCount = initialProjects.filter((p) => p.status === 'ongoing').length;
  const completedCount = initialProjects.filter((p) => p.status === 'completed').length;

  return `
    <div class="projects-section" id="projects-section">
      <!-- Section Header -->
      <div class="projects-header-row">
        <div>
          <h2 class="projects-main-title">Client Projects</h2>
          <p class="projects-main-sub">Manage active architectural commissions, bids, and deliverables.</p>
        </div>
        <button type="button" class="btn-dash-primary" id="btn-post-new-project-head">
          <span class="btn-icon">${dashIcons.plus}</span>
          <span>Post New Project</span>
        </button>
      </div>

      <!-- Controls Row: Filters, Search, Sort & View Switcher -->
      <div class="projects-controls-bar">
        <!-- Segmented Filter Pills with Sliding Glass Background -->
        <div class="segmented-filters" id="segmented-filters" role="tablist">
          <div class="filter-slider-pill" id="filter-slider-pill" aria-hidden="true"></div>
          
          <button type="button" class="filter-btn is-active" data-filter="all" role="tab" aria-selected="true">
            <span>All</span>
            <span class="filter-count">${total}</span>
          </button>
          
          <button type="button" class="filter-btn" data-filter="pending" role="tab" aria-selected="false">
            <span class="filter-dot filter-dot--amber"></span>
            <span>Pending</span>
            <span class="filter-count">${pendingCount}</span>
          </button>
          
          <button type="button" class="filter-btn" data-filter="ongoing" role="tab" aria-selected="false">
            <span class="filter-dot filter-dot--blue"></span>
            <span>Ongoing</span>
            <span class="filter-count">${ongoingCount}</span>
          </button>
          
          <button type="button" class="filter-btn" data-filter="completed" role="tab" aria-selected="false">
            <span class="filter-dot filter-dot--green"></span>
            <span>Completed</span>
            <span class="filter-count">${completedCount}</span>
          </button>
        </div>

        <!-- Search, Sort & View Toggle -->
        <div class="projects-actions-right">
          <!-- Search Field -->
          <div class="projects-search-wrap">
            <span class="search-icon">${dashIcons.search}</span>
            <input 
              type="text" 
              class="projects-search-input" 
              id="projects-search-input" 
              placeholder="Search projects by title or location..."
            />
          </div>

          <!-- Sort Dropdown -->
          <div class="projects-sort-wrap">
            <select class="projects-sort-select" id="projects-sort-select" aria-label="Sort projects">
              <option value="newest">Sort: Newest First</option>
              <option value="budget-high">Budget: High to Low</option>
              <option value="budget-low">Budget: Low to High</option>
            </select>
          </div>

          <!-- View Mode Toggle (Grid / List / Board) -->
          <div class="view-toggle-wrap">
            <button type="button" class="view-toggle-btn is-active" data-view="grid" title="Grid View" aria-label="Grid View">
              ${dashIcons.grid}
            </button>
            <button type="button" class="view-toggle-btn" data-view="list" title="List View" aria-label="List View">
              ${dashIcons.list}
            </button>
            <button type="button" class="view-toggle-btn" data-view="board" title="Board View" aria-label="Board View">
              ${dashIcons.board}
            </button>
          </div>
        </div>
      </div>

      <!-- Projects Container -->
      <div class="projects-view-content" id="projects-view-content">
        <!-- Rendered dynamically -->
      </div>

      <!-- Project Detail Modal -->
      <div class="project-modal-backdrop" id="project-modal-backdrop" aria-hidden="true">
        <div class="project-modal" id="project-modal" role="dialog" aria-modal="true">
          <!-- Injected dynamically on click -->
        </div>
      </div>
    </div>
  `;
}

/**
 * Controller for filtering, sorting, view switching, and project modal.
 */
export function initProjectsSection(onPostProjectClick: () => void): void {
  let currentFilter: FilterStatus = 'all';
  let currentView: ViewMode = 'grid';
  let currentSort: SortOption = 'newest';
  let searchQuery = '';

  const filterSliderPill = document.getElementById('filter-slider-pill');
  const viewContent = document.getElementById('projects-view-content');
  const searchInput = document.getElementById('projects-search-input') as HTMLInputElement | null;
  const sortSelect = document.getElementById('projects-sort-select') as HTMLSelectElement | null;
  const postBtnHead = document.getElementById('btn-post-new-project-head');
  const modalBackdrop = document.getElementById('project-modal-backdrop');
  const modal = document.getElementById('project-modal');

  postBtnHead?.addEventListener('click', onPostProjectClick);

  function getProcessedProjects(): ProjectItem[] {
    let result = [...initialProjects];

    // Filter
    if (currentFilter !== 'all') {
      result = result.filter((p) => p.status === currentFilter);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.location.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Sort
    if (currentSort === 'budget-high') {
      result.sort((a, b) => b.budget - a.budget);
    } else if (currentSort === 'budget-low') {
      result.sort((a, b) => a.budget - b.budget);
    }

    return result;
  }

  function renderView() {
    if (!viewContent) return;
    const projects = getProcessedProjects();

    if (projects.length === 0) {
      viewContent.innerHTML = `
        <div class="dash-empty-state">
          <svg class="empty-state-svg" viewBox="0 0 100 100" fill="none" stroke="currentColor">
            <rect x="20" y="30" width="60" height="45" rx="8" stroke-width="1.8" stroke-dasharray="4 4"/>
            <path d="M50 15 L80 30 L20 30 Z" stroke-width="1.8"/>
            <circle cx="50" cy="52" r="10" stroke-width="1.5"/>
          </svg>
          <h3>No Architectural Projects Found</h3>
          <p>Try adjusting your search filters or create a new project brief.</p>
          <button type="button" class="btn-dash-primary" id="btn-empty-create">
            <span class="btn-icon">${dashIcons.plus}</span>
            <span>Post a Project</span>
          </button>
        </div>
      `;
      document.getElementById('btn-empty-create')?.addEventListener('click', onPostProjectClick);
      return;
    }

    if (currentView === 'grid') {
      viewContent.className = 'projects-view-content projects-view-content--grid';
      viewContent.innerHTML = projects.map((p) => renderProjectCardGrid(p)).join('');
    } else if (currentView === 'list') {
      viewContent.className = 'projects-view-content projects-view-content--list';
      viewContent.innerHTML = `
        <div class="projects-list-wrap">
          ${projects.map((p) => renderProjectCardList(p)).join('')}
        </div>
      `;
    } else if (currentView === 'board') {
      viewContent.className = 'projects-view-content projects-view-content--board';
      const pendingProjects = projects.filter((p) => p.status === 'pending');
      const ongoingProjects = projects.filter((p) => p.status === 'ongoing');
      const completedProjects = projects.filter((p) => p.status === 'completed');

      viewContent.innerHTML = `
        <div class="board-column" data-board-status="pending">
          <div class="board-col-header">
            <span class="board-col-dot board-col-dot--amber"></span>
            <h4>Pending Proposals</h4>
            <span class="board-col-count">${pendingProjects.length}</span>
          </div>
          <div class="board-col-cards">
            ${pendingProjects.map((p) => renderProjectCardBoard(p)).join('')}
          </div>
        </div>

        <div class="board-column" data-board-status="ongoing">
          <div class="board-col-header">
            <span class="board-col-dot board-col-dot--blue"></span>
            <h4>Ongoing Projects</h4>
            <span class="board-col-count">${ongoingProjects.length}</span>
          </div>
          <div class="board-col-cards">
            ${ongoingProjects.map((p) => renderProjectCardBoard(p)).join('')}
          </div>
        </div>

        <div class="board-column" data-board-status="completed">
          <div class="board-col-header">
            <span class="board-col-dot board-col-dot--green"></span>
            <h4>Completed</h4>
            <span class="board-col-count">${completedProjects.length}</span>
          </div>
          <div class="board-col-cards">
            ${completedProjects.map((p) => renderProjectCardBoard(p)).join('')}
          </div>
        </div>
      `;
    }

    // Attach card click handlers for Project Modal
    viewContent.querySelectorAll('[data-project-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-project-id');
        const proj = initialProjects.find((p) => p.id === pid);
        if (proj) openProjectModal(proj);
      });
    });

    // Spotlight cursor tracking on grid cards
    if (currentView === 'grid') {
      viewContent.querySelectorAll<HTMLElement>('.project-card--grid').forEach((card) => {
        const spot = card.querySelector<HTMLElement>('.project-card-spotlight');
        if (!spot) return;

        card.addEventListener('pointermove', (e: PointerEvent) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          spot.style.setProperty('--spot-x', `${x}px`);
          spot.style.setProperty('--spot-y', `${y}px`);
          spot.style.opacity = '1';
        });

        card.addEventListener('pointerleave', () => {
          spot.style.opacity = '0';
        });
      });
    }
  }

  function openProjectModal(p: ProjectItem) {
    if (!modal || !modalBackdrop) return;
    modal.innerHTML = `
      <div class="project-modal-header">
        <div class="project-modal-top-meta">
          <span class="project-status-chip project-status-chip--${p.status}">
            <span class="status-pulse-dot"></span>
            <span>${p.status.toUpperCase()}</span>
          </span>
          <span class="project-category-badge">${p.category}</span>
        </div>
        <button type="button" class="project-modal-close" id="modal-close-btn" aria-label="Close">
          ${dashIcons.close}
        </button>
      </div>

      <div class="project-modal-body">
        <h2 class="project-modal-title">${p.title}</h2>
        <div class="project-modal-facts-strip">
          <div><small>BUDGET</small><strong>$${p.budget.toLocaleString()}</strong></div>
          <div><small>LOCATION</small><strong>${p.location}</strong></div>
          <div><small>TIMELINE</small><strong>${p.duration}</strong></div>
          <div><small>DEADLINE</small><strong>${p.deadline}</strong></div>
        </div>

        <div class="project-modal-section">
          <h4>Architectural Scope</h4>
          <p>${p.description}</p>
        </div>

        <div class="project-modal-section">
          <h4>Milestone Schedule & Escrow Protection</h4>
          <div class="modal-milestones-list">
            <div class="modal-milestone-row">
              <span class="m-icon is-done">${dashIcons.shieldCheck}</span>
              <div><strong>Phase 1: Concept & Floor Plan Drafting</strong><small>$15,000 • Released</small></div>
            </div>
            <div class="modal-milestone-row">
              <span class="m-icon ${p.progress && p.progress > 30 ? 'is-done' : 'is-active'}">${dashIcons.box}</span>
              <div><strong>Phase 2: 3D Visualization & Interior Perspectives</strong><small>$18,000 • Secured in Escrow</small></div>
            </div>
            <div class="modal-milestone-row">
              <span class="m-icon">${dashIcons.contracts}</span>
              <div><strong>Phase 3: Structural Calculations & Permit Drawings</strong><small>$12,000 • Pending Deliverable</small></div>
            </div>
          </div>
        </div>
      </div>

      <div class="project-modal-footer">
        <button type="button" class="btn-dash-ghost" id="modal-close-footer">Close Window</button>
        <button type="button" class="btn-dash-primary" id="modal-message-btn">
          <span>Message Architect</span>
          ${dashIcons.arrowRight}
        </button>
      </div>
    `;

    modalBackdrop.classList.add('is-open');
    modal.classList.add('is-open');

    document.getElementById('modal-close-btn')?.addEventListener('click', closeProjectModal);
    document.getElementById('modal-close-footer')?.addEventListener('click', closeProjectModal);
  }

  function closeProjectModal() {
    modalBackdrop?.classList.remove('is-open');
    modal?.classList.remove('is-open');
  }

  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeProjectModal();
  });

  // Filter Pill Movement
  function updateFilterPill(activeBtn: HTMLElement) {
    if (!filterSliderPill) return;
    const parent = activeBtn.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const left = btnRect.left - parentRect.left;
    filterSliderPill.style.transform = `translateX(${left}px)`;
    filterSliderPill.style.width = `${btnRect.width}px`;
    filterSliderPill.style.opacity = '1';
  }

  // Filter Buttons Click
  document.querySelectorAll<HTMLElement>('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      currentFilter = (btn.getAttribute('data-filter') as FilterStatus) || 'all';
      updateFilterPill(btn);
      renderView();
    });
  });

  // Initial Filter Pill placement
  const initialActiveFilter = document.querySelector('.filter-btn.is-active') as HTMLElement | null;
  if (initialActiveFilter) {
    setTimeout(() => updateFilterPill(initialActiveFilter), 60);
  }

  // View Mode Switcher
  document.querySelectorAll<HTMLElement>('.view-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-toggle-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentView = (btn.getAttribute('data-view') as ViewMode) || 'grid';
      renderView();
    });
  });

  // Search input
  searchInput?.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderView();
  });

  // Sort dropdown
  sortSelect?.addEventListener('change', () => {
    currentSort = (sortSelect.value as SortOption) || 'newest';
    renderView();
  });

  // Initial Render
  renderView();
}
