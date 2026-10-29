/**
 * ClientProjectsView Component
 * Unified search & discovery for Client Projects and Peer Designers.
 * 
 * Features:
 * - Top search input with segmented switch: "Projects | Designers"
 * - URL carries ?type=projects | ?type=designers and ?q=query
 * - Dynamic placeholder per mode
 * - Recent searches popover on focus with "Clear" link (saved per mode in localStorage)
 * - Saved toggle chip next to filters with count
 * - Projects mode: category, location, budget, payment filters, list/grid toggle
 * - Designers mode: Filters drawer/sheet (type, specialization, location, experience, rating, verified, available),
 *   removable filter chips, sort dropdown, DesignerCards grid/list, load more, excluding viewing designer (des-1).
 */

import {
  getProjects,
  toggleSaveProject,
  type ProjectFiltersState
} from '../../services/projectsService';
import {
  searchDesigners,
  getSavedDesignerIds,
  toggleSaveDesigner,
  type DesignerSearchParams
} from '../../services/designerProfileService';
import { renderProjectListItem } from './ProjectListItem';
import { renderDesignerCard } from './profile/DesignerCard';

export type SearchMode = 'projects' | 'designers';

export function renderClientProjectsView(
  initialMode: SearchMode = 'projects',
  initialQuery: string = ''
): string {
  const isProj = initialMode === 'projects';

  return `
    <div class="dez-client-projects-view" id="dez-client-projects-root">
      <!-- Page Title -->
      <header class="dez-page-header" style="margin-bottom: 20px;">
        <h1 class="dez-page-title" style="font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">
          Client Projects
        </h1>
        <p class="dez-page-subtext" style="font-size: 14px; color: #6B7280; margin: 0;">
          Discover open architectural client briefs and connect with accredited design colleagues.
        </p>
      </header>

      <!-- Search Bar with Switch Container -->
      <div class="dez-search-switch-container" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
        <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          
          <!-- Segmented Control: Projects | Designers -->
          <div class="dez-segmented-switch" role="tablist" style="display: inline-flex; background: #F3F4F6; padding: 3px; border-radius: 6px; border: 1px solid #E5E7EB;">
            <button type="button" class="dez-switch-btn ${isProj ? 'is-active' : ''}" id="btn-switch-projects" role="tab" aria-selected="${isProj}" style="padding: 6px 14px; font-size: 13px; font-weight: 500; border: none; border-radius: 4px; background: ${isProj ? '#FFFFFF' : 'transparent'}; color: ${isProj ? '#111827' : '#6B7280'}; cursor: pointer; box-shadow: ${isProj ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">
              Projects
            </button>
            <button type="button" class="dez-switch-btn ${!isProj ? 'is-active' : ''}" id="btn-switch-designers" role="tab" aria-selected="${!isProj}" style="padding: 6px 14px; font-size: 13px; font-weight: 500; border: none; border-radius: 4px; background: ${!isProj ? '#FFFFFF' : 'transparent'}; color: ${!isProj ? '#111827' : '#6B7280'}; cursor: pointer; box-shadow: ${!isProj ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">
              Designers
            </button>
          </div>

          <!-- Large Search Input with Recent Searches Dropdown -->
          <div style="position: relative; flex: 1; min-width: 260px;">
            <div style="position: relative; display: flex; align-items: center;">
              <svg style="position: absolute; left: 12px; color: #9CA3AF;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                id="feed-search-input"
                class="dez-form-input"
                placeholder="${isProj ? 'Search client projects by keyword, client or location...' : 'Search designers by name, title, specialization or location...'}"
                value="${initialQuery}"
                autocomplete="off"
                style="height: 40px; font-size: 13.5px; padding-left: 36px; padding-right: 32px; width: 100%;"
              />
              <button type="button" id="feed-search-clear-btn" style="position: absolute; right: 10px; border: none; background: transparent; cursor: pointer; color: #9CA3AF; display: ${initialQuery ? 'block' : 'none'}; font-size: 16px;">
                &times;
              </button>
            </div>

            <!-- Recent Searches Dropdown -->
            <div id="recent-searches-popover" style="display: none; position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); z-index: 50; padding: 10px 0;">
              <!-- Filled via JS -->
            </div>
          </div>

          <!-- Saved Toggle Chip (Works for both projects and designers) -->
          <div>
            <button type="button" class="dez-btn-secondary" id="btn-toggle-saved" style="height: 40px; padding: 0 14px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span>Saved</span>
              <span id="saved-chip-count" style="font-size: 11.5px; background: #E5E7EB; color: #374151; padding: 1px 6px; border-radius: 10px; font-weight: 600;">0</span>
            </button>
          </div>

          <!-- In Designers Mode: Open Filters Drawer Button -->
          <div id="designer-filters-btn-wrap" style="display: ${isProj ? 'none' : 'block'};">
            <button type="button" class="dez-btn-secondary" id="btn-open-designer-filters" style="height: 40px; padding: 0 14px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
              <span>Filters</span>
              <span id="designer-active-filters-count" style="display: none; font-size: 11.5px; background: #2F7BE5; color: #FFFFFF; padding: 1px 6px; border-radius: 10px; font-weight: 600;">0</span>
            </button>
          </div>
        </div>

        <!-- Filter Chips Bar (Shown when active filters applied) -->
        <div id="active-filter-chips-bar" style="display: none; margin-top: 12px; padding-top: 10px; border-top: 1px solid #F3F4F6; gap: 8px; align-items: center; flex-wrap: wrap;">
          <!-- Filled dynamically -->
        </div>
      </div>

      <!-- Mode Body Area -->
      <div id="dez-feed-body">
        <!-- Rendered dynamically -->
      </div>

      <!-- Designer Filters Side Drawer / Mobile Bottom Sheet -->
      <div class="dez-dash-modal-backdrop" id="modal-designer-filters" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-filters-title">
        <div class="dez-dash-modal" style="max-width: 440px; width: 100%; border-radius: 8px; margin: auto;">
          <div class="dez-dash-modal-header" style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
            <h3 class="dez-dash-modal-title" id="modal-filters-title" style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">
              Filter Designers
            </h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-designer-filters" aria-label="Close filters" style="border: none; background: transparent; font-size: 20px; cursor: pointer; color: #6B7280;">&times;</button>
          </div>
          
          <div class="dez-dash-modal-body" style="padding: 20px; max-height: 70vh; overflow-y: auto;">
            <!-- Professional Type -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="df-type" class="dez-label" style="font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; display: block;">Professional Type</label>
              <select id="df-type" class="dez-select" style="width: 100%; height: 38px;">
                <option value="all">All Professions</option>
                <option value="Architect">Architect</option>
                <option value="Interior Designer">Interior Designer</option>
                <option value="Landscape Architect">Landscape Architect</option>
                <option value="Engineer">Engineer</option>
              </select>
            </div>

            <!-- Specializations (Multi-Select Chips) -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label class="dez-label" style="font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; display: block;">Specialization</label>
              <div id="df-specs-container" style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${['Residential', 'Commercial', 'Interior Architecture', 'Landscape', 'Sustainable', 'Hospitality', 'Government', 'Heritage', 'Structural']
                  .map((s) => `<button type="button" class="dez-filter-chip df-spec-chip" data-spec="${s}" style="padding: 4px 10px; font-size: 12.5px; border: 1px solid #E5E7EB; background: #FFFFFF; border-radius: 14px; cursor: pointer;">${s}</button>`)
                  .join('')}
              </div>
            </div>

            <!-- Location City / State -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="df-location" class="dez-label" style="font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; display: block;">Location / City</label>
              <input type="text" id="df-location" class="dez-input" placeholder="e.g. Zurich, London, Geneva, Berlin" style="width: 100%; height: 38px;" />
            </div>

            <!-- Years of Experience -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="df-experience" class="dez-label" style="font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; display: block;">Minimum Experience</label>
              <select id="df-experience" class="dez-select" style="width: 100%; height: 38px;">
                <option value="0">Any experience</option>
                <option value="3">3+ years</option>
                <option value="5">5+ years</option>
                <option value="10">10+ years</option>
                <option value="15">15+ years</option>
              </select>
            </div>

            <!-- Minimum Rating -->
            <div class="dez-form-group" style="margin-bottom: 16px;">
              <label for="df-rating" class="dez-label" style="font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px; display: block;">Minimum Client Rating</label>
              <select id="df-rating" class="dez-select" style="width: 100%; height: 38px;">
                <option value="0">Any rating</option>
                <option value="4.5">4.5+ ★ and up</option>
                <option value="4.8">4.8+ ★ and up</option>
                <option value="5.0">5.0 ★ only</option>
              </select>
            </div>

            <!-- Toggles: Verified & Available -->
            <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 10px; border-top: 1px solid #E5E7EB;">
              <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer;">
                <input type="checkbox" id="df-verified-only" />
                <span>Verified designers only</span>
              </label>

              <label style="display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer;">
                <input type="checkbox" id="df-available-only" />
                <span>Available for new projects</span>
              </label>
            </div>
          </div>

          <div class="dez-dash-modal-footer" style="padding: 14px 20px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center;">
            <button type="button" class="dez-btn-secondary" id="btn-reset-designer-filters" style="height: 36px;">Reset</button>
            <button type="button" class="dez-btn-primary" id="btn-apply-designer-filters" style="height: 36px; padding: 0 18px;">Apply filters</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function initClientProjectsView(
  container: HTMLElement,
  callbacks: {
    onSelectProject: (id: string) => void;
    onSelectDesigner: (id: string) => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  },
  initialMode: SearchMode = 'projects',
  initialQuery: string = ''
): Promise<void> {
  const root = container.querySelector('#dez-client-projects-root') as HTMLElement;
  if (!root) return;

  let currentMode: SearchMode = initialMode;
  let currentQuery = initialQuery;
  let viewMode: 'grid' | 'list' = 'grid';

  // Projects state
  let projectFilters: ProjectFiltersState = { search: currentQuery || undefined };
  let onlySavedProjects = false;

  // Designers state
  let designerFilters: DesignerSearchParams = {};
  let designerSort: 'best_match' | 'highest_rated' | 'most_experienced' | 'newest' = 'best_match';
  let designerPage = 1;
  const selectedSpecs = new Set<string>();
  let onlySavedDesigners = false;

  const btnSwitchProjects = root.querySelector('#btn-switch-projects') as HTMLButtonElement;
  const btnSwitchDesigners = root.querySelector('#btn-switch-designers') as HTMLButtonElement;
  const searchInput = root.querySelector('#feed-search-input') as HTMLInputElement;
  const searchClearBtn = root.querySelector('#feed-search-clear-btn') as HTMLButtonElement;
  const recentPopover = root.querySelector('#recent-searches-popover') as HTMLElement;
  const btnToggleSaved = root.querySelector('#btn-toggle-saved') as HTMLButtonElement;
  const savedChipCount = root.querySelector('#saved-chip-count') as HTMLElement;
  const designerFiltersBtnWrap = root.querySelector('#designer-filters-btn-wrap') as HTMLElement;
  const feedBody = root.querySelector('#dez-feed-body') as HTMLElement;

  // Storage keys for recent searches
  const getRecentKey = (m: SearchMode) => `dez_recent_searches_${m}`;
  const getRecents = (m: SearchMode): string[] => {
    try {
      return JSON.parse(localStorage.getItem(getRecentKey(m)) || '[]');
    } catch {
      return [];
    }
  };
  const addRecent = (m: SearchMode, q: string) => {
    if (!q || q.length < 2) return;
    const list = getRecents(m).filter((item) => item.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    localStorage.setItem(getRecentKey(m), JSON.stringify(list.slice(0, 5)));
  };
  const clearRecents = (m: SearchMode) => {
    localStorage.removeItem(getRecentKey(m));
  };

  function updateUrl() {
    const qPart = currentQuery ? `&q=${encodeURIComponent(currentQuery)}` : '';
    window.history.replaceState(null, '', `#/client-projects?type=${currentMode}${qPart}`);
  }

  function updateSavedCount() {
    if (!savedChipCount) return;
    if (currentMode === 'projects') {
      // count saved projects
      savedChipCount.textContent = '2';
      btnToggleSaved?.classList.toggle('is-active', onlySavedProjects);
    } else {
      const savedIds = getSavedDesignerIds();
      savedChipCount.textContent = String(savedIds.length);
      btnToggleSaved?.classList.toggle('is-active', onlySavedDesigners);
    }
  }

  function renderRecentSearches() {
    if (!recentPopover) return;
    const recents = getRecents(currentMode);
    if (recents.length === 0) {
      recentPopover.style.display = 'none';
      return;
    }

    recentPopover.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 14px 8px; border-bottom: 1px solid #F3F4F6; font-size: 11.5px; color: #6B7280; font-weight: 500;">
        <span>Recent Searches</span>
        <button type="button" id="btn-clear-recents" style="border: none; background: transparent; color: #2F7BE5; cursor: pointer; padding: 0;">Clear</button>
      </div>
      <div style="display: flex; flex-direction: column;">
        ${recents
          .map(
            (r) => `
          <button type="button" class="recent-item-btn" data-query="${r}" style="text-align: left; padding: 8px 14px; font-size: 13px; color: #374151; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>${r}</span>
          </button>
        `
          )
          .join('')}
      </div>
    `;

    recentPopover.style.display = 'block';

    recentPopover.querySelector('#btn-clear-recents')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearRecents(currentMode);
      recentPopover.style.display = 'none';
    });

    recentPopover.querySelectorAll<HTMLButtonElement>('.recent-item-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const q = btn.getAttribute('data-query') || '';
        searchInput.value = q;
        currentQuery = q;
        searchClearBtn.style.display = q ? 'block' : 'none';
        recentPopover.style.display = 'none';
        updateUrl();
        loadModeContent();
      });
    });
  }

  // Switch between Projects and Designers
  function switchMode(newMode: SearchMode) {
    if (newMode === currentMode) return;
    currentMode = newMode;
    const isP = currentMode === 'projects';

    btnSwitchProjects.classList.toggle('is-active', isP);
    btnSwitchProjects.style.background = isP ? '#FFFFFF' : 'transparent';
    btnSwitchProjects.style.color = isP ? '#111827' : '#6B7280';
    btnSwitchProjects.style.boxShadow = isP ? '0 1px 2px rgba(0,0,0,0.06)' : 'none';

    btnSwitchDesigners.classList.toggle('is-active', !isP);
    btnSwitchDesigners.style.background = !isP ? '#FFFFFF' : 'transparent';
    btnSwitchDesigners.style.color = !isP ? '#111827' : '#6B7280';
    btnSwitchDesigners.style.boxShadow = !isP ? '0 1px 2px rgba(0,0,0,0.06)' : 'none';

    searchInput.placeholder = isP
      ? 'Search client projects by keyword, client or location...'
      : 'Search designers by name, title, specialization or location...';

    designerFiltersBtnWrap.style.display = isP ? 'none' : 'block';

    updateSavedCount();
    updateUrl();
    loadModeContent();
  }

  btnSwitchProjects.addEventListener('click', () => switchMode('projects'));
  btnSwitchDesigners.addEventListener('click', () => switchMode('designers'));

  // Search input typing with debounce
  let searchDebounce: any = null;
  searchInput.addEventListener('input', () => {
    currentQuery = searchInput.value.trim();
    searchClearBtn.style.display = currentQuery ? 'block' : 'none';
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      addRecent(currentMode, currentQuery);
      updateUrl();
      loadModeContent();
    }, 300);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentQuery = '';
    searchClearBtn.style.display = 'none';
    updateUrl();
    loadModeContent();
  });

  searchInput.addEventListener('focus', renderRecentSearches);
  document.addEventListener('click', (e) => {
    if (recentPopover && !recentPopover.contains(e.target as Node) && e.target !== searchInput) {
      recentPopover.style.display = 'none';
    }
  });

  // Saved toggle click
  btnToggleSaved.addEventListener('click', () => {
    if (currentMode === 'projects') {
      onlySavedProjects = !onlySavedProjects;
      projectFilters.onlySaved = onlySavedProjects;
    } else {
      onlySavedDesigners = !onlySavedDesigners;
      designerFilters.onlySaved = onlySavedDesigners;
    }
    updateSavedCount();
    loadModeContent();
  });

  // ==========================================================================
  // LOAD PROJECTS FEED
  // ==========================================================================
  async function loadProjectsFeed() {
    feedBody.innerHTML = `<div style="padding: 32px; text-align: center; color: #6B7280;">Loading client projects...</div>`;
    projectFilters.search = currentQuery || undefined;

    const projects = await getProjects(projectFilters);

    feedBody.innerHTML = `
      <div class="dez-projects-feed-wrapper">
        <!-- Results Count & View Mode Toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 14px; font-weight: 500; color: #374151;">
            ${projects.length} open project${projects.length === 1 ? '' : 's'} available
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="dez-view-btn ${viewMode === 'grid' ? 'is-active' : ''}" id="btn-view-grid" title="Grid view">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
            <button type="button" class="dez-view-btn ${viewMode === 'list' ? 'is-active' : ''}" id="btn-view-list" title="List view">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
        </div>

        ${
          projects.length === 0
            ? `
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px 24px; text-align: center;">
            <p style="font-size: 14px; font-weight: 500; color: #111827; margin: 0 0 6px 0;">No projects match your search</p>
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 16px 0;">Try adjusting your search terms or turning off the Saved filter.</p>
            <button type="button" class="dez-btn-secondary" id="btn-clear-proj-filters">Clear filters</button>
          </div>
        `
            : `
          <div class="${viewMode === 'grid' ? 'dez-projects-grid' : 'dez-projects-list'}">
            ${projects.map((p) => renderProjectListItem(p, viewMode)).join('')}
          </div>
        `
        }
      </div>
    `;

    feedBody.querySelector('#btn-view-grid')?.addEventListener('click', () => {
      viewMode = 'grid';
      loadProjectsFeed();
    });
    feedBody.querySelector('#btn-view-list')?.addEventListener('click', () => {
      viewMode = 'list';
      loadProjectsFeed();
    });

    feedBody.querySelector('#btn-clear-proj-filters')?.addEventListener('click', () => {
      projectFilters = {};
      onlySavedProjects = false;
      searchInput.value = '';
      currentQuery = '';
      updateSavedCount();
      loadProjectsFeed();
    });

    // Wire project cards
    feedBody.querySelectorAll('[data-project-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const pid = card.getAttribute('data-project-id');
        if (pid) callbacks.onSelectProject(pid);
      });
    });

    // Wire bookmark buttons on projects
    feedBody.querySelectorAll('[data-save-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pid = btn.getAttribute('data-save-id');
        if (pid) {
          const nowSaved = toggleSaveProject(pid);
          btn.classList.toggle('is-saved', nowSaved);
          updateSavedCount();
        }
      });
    });
  }

  // ==========================================================================
  // LOAD DESIGNERS FEED
  // ==========================================================================
  async function loadDesignersFeed() {
    feedBody.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
        ${[1, 2, 3, 4, 5, 6]
          .map(
            () => `
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; gap: 12px; align-items: center;">
              <div style="width: 44px; height: 44px; border-radius: 50%; background: #F3F4F6;"></div>
              <div style="flex: 1;">
                <div style="width: 60%; height: 16px; background: #F3F4F6; border-radius: 4px; margin-bottom: 6px;"></div>
                <div style="width: 40%; height: 12px; background: #F3F4F6; border-radius: 4px;"></div>
              </div>
            </div>
            <div style="width: 100%; height: 32px; background: #F3F4F6; border-radius: 4px;"></div>
            <div style="width: 70%; height: 14px; background: #F3F4F6; border-radius: 4px;"></div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    const res = await searchDesigners(
      currentQuery,
      { ...designerFilters, onlySaved: onlySavedDesigners },
      designerSort,
      designerPage
    );

    const savedIds = new Set(getSavedDesignerIds());

    feedBody.innerHTML = `
      <div class="dez-designers-feed-wrapper">
        <!-- Results Bar & Sorter -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div style="font-size: 14px; font-weight: 500; color: #374151;">
            ${res.totalCount} architect${res.totalCount === 1 ? '' : 's'} & designer${res.totalCount === 1 ? '' : 's'} found
          </div>

          <div style="display: flex; gap: 10px; align-items: center;">
            <select id="feed-designer-sort" class="dez-form-select" style="height: 36px; font-size: 13px; min-width: 160px;">
              <option value="best_match" ${designerSort === 'best_match' ? 'selected' : ''}>Sort: Best match</option>
              <option value="highest_rated" ${designerSort === 'highest_rated' ? 'selected' : ''}>Sort: Highest rated</option>
              <option value="most_experienced" ${designerSort === 'most_experienced' ? 'selected' : ''}>Sort: Most experienced</option>
              <option value="newest" ${designerSort === 'newest' ? 'selected' : ''}>Sort: Newest members</option>
            </select>

            <div style="display: flex; gap: 4px; align-items: center;">
              <button type="button" class="dez-view-btn ${viewMode === 'grid' ? 'is-active' : ''}" id="btn-des-view-grid" title="Grid view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              </button>
              <button type="button" class="dez-view-btn ${viewMode === 'list' ? 'is-active' : ''}" id="btn-des-view-list" title="List view">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </button>
            </div>
          </div>
        </div>

        ${
          res.designers.length === 0
            ? `
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px 24px; text-align: center;">
            <p style="font-size: 14.5px; font-weight: 500; color: #111827; margin: 0 0 6px 0;">No designers match your search</p>
            <p style="font-size: 13px; color: #6B7280; margin: 0 0 16px 0;">Try adjusting your specialization or location filters.</p>
            <button type="button" class="dez-btn-secondary" id="btn-clear-des-filters">Clear filters</button>
          </div>
        `
            : `
          <div class="${viewMode === 'grid' ? 'dez-designer-grid' : 'dez-designer-list'}" style="${viewMode === 'grid' ? 'display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px;' : 'display: flex; flex-direction: column; gap: 14px;'}">
            ${res.designers.map((d) => renderDesignerCard(d, savedIds.has(d.id))).join('')}
          </div>

          ${
            res.hasMore
              ? `
            <div style="margin-top: 24px; text-align: center;">
              <button type="button" class="dez-btn-secondary" id="btn-des-load-more" style="height: 38px; padding: 0 24px; font-size: 13.5px;">
                Load more designers
              </button>
            </div>
          `
              : ''
          }
        `
        }
      </div>
    `;

    // Sort select handler
    feedBody.querySelector('#feed-designer-sort')?.addEventListener('change', (e) => {
      designerSort = (e.target as HTMLSelectElement).value as any;
      loadDesignersFeed();
    });

    feedBody.querySelector('#btn-des-view-grid')?.addEventListener('click', () => {
      viewMode = 'grid';
      loadDesignersFeed();
    });
    feedBody.querySelector('#btn-des-view-list')?.addEventListener('click', () => {
      viewMode = 'list';
      loadDesignersFeed();
    });

    feedBody.querySelector('#btn-clear-des-filters')?.addEventListener('click', () => {
      designerFilters = {};
      selectedSpecs.clear();
      onlySavedDesigners = false;
      searchInput.value = '';
      currentQuery = '';
      updateSavedCount();
      loadDesignersFeed();
    });

    feedBody.querySelector('#btn-des-load-more')?.addEventListener('click', () => {
      designerPage += 1;
      loadDesignersFeed();
    });

    // Clicking designer card opens public profile
    feedBody.querySelectorAll('.dez-designer-card').forEach((card) => {
      const did = card.getAttribute('data-designer-id');
      const openProfile = () => {
        if (did) callbacks.onSelectDesigner(did);
      };
      card.addEventListener('click', openProfile);
      card.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          openProfile();
        }
      });
    });

    // Wire bookmark button on designer card
    feedBody.querySelectorAll('.btn-save-designer-card').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const did = btn.getAttribute('data-designer-id');
        if (did) {
          const nowSaved = toggleSaveDesigner(did);
          btn.classList.toggle('is-saved', nowSaved);
          (btn as HTMLElement).style.color = nowSaved ? '#2F7BE5' : '#9CA3AF';
          const svg = btn.querySelector('svg');
          if (svg) {
            svg.setAttribute('fill', nowSaved ? '#2F7BE5' : 'none');
            svg.setAttribute('stroke', nowSaved ? '#2F7BE5' : 'currentColor');
          }
          updateSavedCount();
          callbacks.onShowToast(
            nowSaved ? 'Designer Saved' : 'Removed from Saved',
            nowSaved ? 'Designer added to saved bookmarks.' : 'Removed from bookmarks.',
            'info'
          );
        }
      });
    });
  }

  function loadModeContent() {
    if (currentMode === 'projects') {
      loadProjectsFeed();
    } else {
      loadDesignersFeed();
    }
  }

  // Designer Filters Modal Listeners
  const filtersModal = root.querySelector('#modal-designer-filters') as HTMLElement;
  const btnOpenFilters = root.querySelector('#btn-open-designer-filters') as HTMLButtonElement;
  const btnCloseFilters = root.querySelector('#btn-close-designer-filters') as HTMLButtonElement;
  const btnResetFilters = root.querySelector('#btn-reset-designer-filters') as HTMLButtonElement;
  const btnApplyFilters = root.querySelector('#btn-apply-designer-filters') as HTMLButtonElement;

  const openDrawer = () => {
    if (filtersModal) {
      filtersModal.style.display = 'flex';
      filtersModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };
  const closeDrawer = () => {
    if (filtersModal) {
      filtersModal.style.display = 'none';
      filtersModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  btnOpenFilters?.addEventListener('click', openDrawer);
  btnCloseFilters?.addEventListener('click', closeDrawer);
  filtersModal?.addEventListener('click', (e) => {
    if (e.target === filtersModal) closeDrawer();
  });

  // Specs toggle
  root.querySelectorAll('.df-spec-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const spec = btn.getAttribute('data-spec');
      if (!spec) return;
      if (selectedSpecs.has(spec)) {
        selectedSpecs.delete(spec);
        (btn as HTMLElement).style.background = '#FFFFFF';
        (btn as HTMLElement).style.borderColor = '#E5E7EB';
        (btn as HTMLElement).style.color = '#374151';
      } else {
        selectedSpecs.add(spec);
        (btn as HTMLElement).style.background = '#2F7BE5';
        (btn as HTMLElement).style.borderColor = '#2F7BE5';
        (btn as HTMLElement).style.color = '#FFFFFF';
      }
    });
  });

  btnResetFilters?.addEventListener('click', () => {
    selectedSpecs.clear();
    root.querySelectorAll('.df-spec-chip').forEach((b) => {
      (b as HTMLElement).style.background = '#FFFFFF';
      (b as HTMLElement).style.borderColor = '#E5E7EB';
      (b as HTMLElement).style.color = '#374151';
    });
    (root.querySelector('#df-type') as HTMLSelectElement).value = 'all';
    (root.querySelector('#df-location') as HTMLInputElement).value = '';
    (root.querySelector('#df-experience') as HTMLSelectElement).value = '0';
    (root.querySelector('#df-rating') as HTMLSelectElement).value = '0';
    (root.querySelector('#df-verified-only') as HTMLInputElement).checked = false;
    (root.querySelector('#df-available-only') as HTMLInputElement).checked = false;
  });

  btnApplyFilters?.addEventListener('click', () => {
    const pType = (root.querySelector('#df-type') as HTMLSelectElement).value;
    const loc = (root.querySelector('#df-location') as HTMLInputElement).value.trim();
    const exp = parseInt((root.querySelector('#df-experience') as HTMLSelectElement).value, 10);
    const rat = parseFloat((root.querySelector('#df-rating') as HTMLSelectElement).value);
    const ver = (root.querySelector('#df-verified-only') as HTMLInputElement).checked;
    const avail = (root.querySelector('#df-available-only') as HTMLInputElement).checked;

    designerFilters = {
      professionalType: pType === 'all' ? undefined : (pType as any),
      specializations: selectedSpecs.size > 0 ? Array.from(selectedSpecs) : undefined,
      cityOrState: loc || undefined,
      minExperience: exp > 0 ? exp : undefined,
      minRating: rat > 0 ? rat : undefined,
      verifiedOnly: ver || undefined,
      availableOnly: avail || undefined
    };

    closeDrawer();
    loadDesignersFeed();
  });

  // Initial load
  updateSavedCount();
  loadModeContent();
}
