/**
 * FindDesignersPage — Client Find Designers, Suggested Designers & Project Invitations
 * Follows all Dezignet light & flat design guidelines:
 * - Playfair Display title, Inter UI
 * - Flat 1px #E5E7EB borders, 8px radius, no card shadows
 * - Zero emoji, tabular numbers for currency/metrics
 * - State synchronization with URL search parameters
 */

import { supabase } from '../../lib/supabase';
import { renderClientShell, initClientShell } from './ClientLayout';
import {
  searchDesignersForClient,
  suggestDesigners,
  inviteDesigner,
  type SearchDesignersParams
} from '../../services/invitationsService';
import { US_STATES, formatUSD } from '../../services/usMarketService';
import { SERVICES_CATALOG } from '../../services/projectsService';
import { getSavedSearches, saveSearch, deleteSavedSearch } from '../../services/savedSearchesService';


export async function renderFindDesignersPage(container: HTMLElement): Promise<void> {
  container.innerHTML = renderClientShell(
    {
      activeTab: 'find-designers',
      pageTitle: 'Find Designers'
    },
    `
      <div id="find-designers-root" style="max-width: 1200px; margin: 0 auto; padding-bottom: 80px;">
        <!-- Header & Project Selector -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
          <div>
            <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 700; color: #111827; margin: 0 0 6px 0;">
              Find designers
            </h1>
            <p style="font-size: 13.5px; color: #6B7280; margin: 0;">
              Discover top design professionals, explore past architectural work, and send project invitations.
            </p>
          </div>

          <!-- Project Context Dropdown -->
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="select-project-context" style="font-size: 13px; font-weight: 500; color: #374151;">
              For project:
            </label>
            <select id="select-project-context" style="height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; color: #111827; min-width: 220px;">
              <option value="">No project (browse only)</option>
              <!-- Filled with client open projects -->
            </select>
          </div>
        </div>

        <!-- Suggested Designers Section (Shown when a project is selected) -->
        <div id="suggested-designers-section" style="display: none; margin-bottom: 36px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div>
              <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 2px 0;">
                Suggested for this project
              </h2>
              <p style="font-size: 12.5px; color: #6B7280; margin: 0;">
                Matched based on project category, discipline, location, and credentials.
              </p>
            </div>
            <a href="javascript:void(0)" id="link-order-explanation" style="font-size: 12px; color: #2F7BE5; text-decoration: underline;">
              How results are ordered
            </a>
          </div>

          <div id="suggested-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">
            <!-- Rendered dynamically -->
          </div>
        </div>

        <!-- Search Bar, Filters & Sort Controls -->
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;">
          <!-- Search Input -->
          <div style="flex: 1; min-width: 260px; position: relative;">
            <input 
              type="text" 
              id="inp-designer-search" 
              placeholder="Search by name, studio name, discipline, or city..." 
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px 0 36px; font-size: 13.5px; box-sizing: border-box; background: #FFFFFF;"
            />
            <svg style="position: absolute; left: 12px; top: 12px; color: #9CA3AF;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>

          <!-- Filters Toggle Button -->
          <button type="button" id="btn-toggle-filters" style="height: 40px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; font-weight: 500; color: #374151; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            <span>Filters</span>
            <span id="active-filters-count" style="display: none; background: #2F7BE5; color: #FFFFFF; font-size: 11px; padding: 1px 6px; border-radius: 10px;">0</span>
          </button>

          <!-- Save Search Button -->
          <button type="button" id="btn-save-designer-search" style="height: 40px; padding: 0 14px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; font-weight: 500; color: #374151; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;" title="Save current search criteria">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
            <span>Save Search</span>
          </button>

          <!-- Sort Select -->
          <select id="select-sort" style="height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; color: #374151;">
            <option value="best_match">Sort: Best match</option>
            <option value="rating">Sort: Highest rated</option>
            <option value="experience">Sort: Most experienced</option>
            <option value="newest">Sort: Newest members</option>
          </select>
        </div>

        <!-- Active Filter Chips -->
        <div id="active-filter-chips" style="display: none; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <span style="font-size: 12px; color: #6B7280;">Active filters:</span>
          <div id="chips-container" style="display: flex; gap: 6px; flex-wrap: wrap;"></div>
          <button type="button" id="btn-clear-all-filters" style="background: none; border: none; font-size: 12px; color: #2F7BE5; cursor: pointer; text-decoration: underline; padding: 0 4px;">
            Clear all
          </button>
        </div>

        <!-- Filter Side Panel / Drawer -->
        <div id="filter-panel-backdrop" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 150;">
          <div style="position: absolute; top: 0; right: 0; bottom: 0; width: 340px; background: #FFFFFF; border-left: 1px solid #E5E7EB; padding: 24px; box-sizing: border-box; overflow-y: auto; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Filters</h3>
                <button type="button" id="btn-close-filter-panel" style="background: none; border: none; font-size: 20px; color: #6B7280; cursor: pointer;">&times;</button>
              </div>

              <div style="display: flex; flex-direction: column; gap: 18px;">
                <!-- Professional Type / Discipline (8 Types) -->
                <div>
                  <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Professional Type</label>
                  <select id="filter-discipline" style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                    <option value="">All Professional Types</option>
                    <option value="architect">Architect</option>
                    <option value="engineer">Engineer</option>
                    <option value="interior_designer">Interior Designer</option>
                    <option value="landscape_architect">Landscape Architect</option>
                    <option value="bim_specialist">BIM Specialist</option>
                    <option value="visualization_professional">Visualization Professional</option>
                    <option value="drafter_cad">CAD Drafter</option>
                    <option value="other_consultant">Other Consultant</option>
                  </select>
                </div>

                <!-- Services Offered (19 Catalog Services) -->
                <div>
                  <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Services Offered</label>
                  <select id="filter-service" style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                    <option value="">All Services</option>
                    ${SERVICES_CATALOG.map((s) => `<option value="${s}">${s}</option>`).join('')}
                  </select>
                </div>

                <!-- State -->
                <div>
                  <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Location (State)</label>
                  <select id="filter-state" style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                    <option value="">All States</option>
                    ${US_STATES.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
                  </select>
                </div>

                <!-- Min Years Experience -->
                <div>
                  <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Minimum Years Experience</label>
                  <select id="filter-min-years" style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                    <option value="0">Any experience</option>
                    <option value="3">3+ years</option>
                    <option value="5">5+ years</option>
                    <option value="10">10+ years</option>
                  </select>
                </div>

                <!-- Toggles -->
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px;">
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; cursor: pointer;">
                    <input type="checkbox" id="filter-available-only" style="accent-color: #2F7BE5;" />
                    <span>Available for projects now</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; cursor: pointer;">
                    <input type="checkbox" id="filter-verified-only" style="accent-color: #2F7BE5;" />
                    <span>Verified credentials only</span>
                  </label>

                </div>
              </div>
            </div>

            <!-- Saved Searches Panel -->
            <div style="border-top: 1px solid #E5E7EB; margin-top: 20px; padding-top: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 12.5px; font-weight: 600; color: #111827;">Saved Searches (Max 10)</span>
              </div>
              <div id="designer-saved-searches-list" style="display: flex; flex-direction: column; gap: 6px; font-size: 12px; max-height: 140px; overflow-y: auto;">
                <span style="color: #9CA3AF;">Loading saved searches...</span>
              </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 24px;">
              <button type="button" id="btn-reset-filters" style="flex: 1; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #4B5563; cursor: pointer;">Reset</button>
              <button type="button" id="btn-apply-filters" style="flex: 1; height: 38px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">Apply</button>
            </div>
          </div>
        </div>

        <!-- Main Results Grid -->
        <div id="results-count-bar" style="font-size: 13px; color: #6B7280; margin-bottom: 16px;">
          Showing designers
        </div>

        <div id="designers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px;">
          <!-- Rendered dynamically -->
        </div>

        <div id="load-more-container" style="text-align: center; margin-top: 32px; display: none;">
          <button type="button" id="btn-load-more" style="height: 40px; padding: 0 24px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; font-weight: 500; color: #374151; cursor: pointer;">
            Load more designers
          </button>
        </div>

        <!-- Invite Dialog Modal -->
        <div id="modal-invite-designer" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; align-items: center; justify-content: center;">
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; margin: 16px; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <h3 style="font-size: 17px; font-weight: 600; color: #111827; margin: 0;">Invite to Project</h3>
              <button type="button" id="btn-close-invite-modal" style="background: none; border: none; font-size: 20px; color: #6B7280; cursor: pointer;">&times;</button>
            </div>
            
            <p style="font-size: 13px; color: #4B5563; margin: 0 0 16px 0;">
              Inviting <strong id="invite-designer-name"></strong> to submit a proposal.
            </p>

            <form id="form-invite-designer">
              <input type="hidden" id="invite-designer-id" value="" />
              
              <div style="margin-bottom: 14px;">
                <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Select Project *</label>
                <select id="invite-project-select" required style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF;">
                  <!-- Filled dynamically -->
                </select>
              </div>

              <div style="margin-bottom: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <label style="font-size: 12.5px; font-weight: 600; color: #374151;">Message (Optional)</label>
                  <span id="invite-char-count" style="font-size: 11.5px; color: #9CA3AF;">0 / 500</span>
                </div>
                
                <!-- Quick Starters -->
                <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                  <button type="button" class="btn-invite-starter" data-text="We love your architectural portfolio and would appreciate your proposal for our project." style="text-align: left; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; color: #4B5563; cursor: pointer;">
                    "We love your architectural portfolio and would appreciate your proposal..."
                  </button>
                  <button type="button" class="btn-invite-starter" data-text="Our project matches your exact design specialization. Please take a look at the scope." style="text-align: left; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; color: #4B5563; cursor: pointer;">
                    "Our project matches your exact design specialization..."
                  </button>
                </div>

                <textarea id="invite-message-text" maxlength="500" rows="3" placeholder="Add a personal note to the designer..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
              </div>

              <p style="font-size: 12px; color: #6B7280; line-height: 1.45; margin: 0 0 18px 0;">
                The designer will be notified and can send you a proposal. You can message them after you review a proposal.
              </p>

              <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" id="btn-cancel-invite" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #4B5563; cursor: pointer;">Cancel</button>
                <button type="submit" id="btn-submit-invite" style="height: 36px; padding: 0 18px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">Send Invitation</button>
              </div>
            </form>
          </div>
        </div>

        <!-- How Results Are Ordered Modal -->
        <div id="modal-order-dialog" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 200; align-items: center; justify-content: center;">
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 440px; padding: 24px; margin: 16px; box-sizing: border-box;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">How Results Are Ordered</h3>
              <button type="button" id="btn-close-order-dialog" style="background: none; border: none; font-size: 20px; color: #6B7280; cursor: pointer;">&times;</button>
            </div>
            <p style="font-size: 13px; color: #4B5563; line-height: 1.6; margin: 0 0 12px 0;">
              When a project is selected, designers are scored and ranked based on matching criteria:
            </p>
            <ul style="font-size: 13px; color: #4B5563; line-height: 1.6; padding-left: 20px; margin: 0 0 14px 0;">
              <li>Specialization matching the project's category (+30)</li>
              <li>Services overlap with requested project services (+20)</li>
              <li>Portfolio projects in the same subcategory (+10 to +20)</li>
              <li>Designer located in the same city (+15) or state (+10)</li>
              <li>Client review rating and completed projects (+5 to +10)</li>
              <li>Designers on paid studio membership plans receive priority placement.</li>
            </ul>
            <div style="text-align: right;">
              <button type="button" id="btn-dismiss-order-dialog" style="height: 34px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #374151; cursor: pointer;">Close</button>
            </div>
          </div>
        </div>
      </div>
    `
  );

  initClientShell(container);
  initFindDesignersEvents(container);
}

async function initFindDesignersEvents(container: HTMLElement) {
  const root = container.querySelector('#find-designers-root') as HTMLElement;
  if (!root) return;

  let selectedProjectId: string = '';
  let currentPage = 1;

  // 1. Load client's open projects
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: projs } = await supabase
      .from('projects')
      .select('id, title, status')
      .eq('client_id', user.id)
      .in('status', ['open', 'draft'] as any);

    if (projs && projs.length > 0) {
      const select = root.querySelector('#select-project-context') as HTMLSelectElement;
      const inviteSelect = root.querySelector('#invite-project-select') as HTMLSelectElement;

      const optsHtml = projs.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('');
      if (select) select.innerHTML = `<option value="">No project (browse only)</option>${optsHtml}`;
      if (inviteSelect) inviteSelect.innerHTML = optsHtml;
    }
  }

  // 2. Initial Search
  async function performSearch(reset = false) {
    if (reset) currentPage = 1;

    const query = (root.querySelector('#inp-designer-search') as HTMLInputElement)?.value.trim() || '';
    const discipline = (root.querySelector('#filter-discipline') as HTMLSelectElement)?.value || '';
    const state = (root.querySelector('#filter-state') as HTMLSelectElement)?.value || '';
    const minYears = parseInt((root.querySelector('#filter-min-years') as HTMLSelectElement)?.value || '0', 10);
    const availableOnly = (root.querySelector('#filter-available-only') as HTMLInputElement)?.checked || false;
    const verifiedOnly = (root.querySelector('#filter-verified-only') as HTMLInputElement)?.checked || false;
    const sort = (root.querySelector('#select-sort') as HTMLSelectElement)?.value as any || 'best_match';

    const params: SearchDesignersParams = {
      query,
      discipline: discipline || undefined,
      state: state || undefined,
      min_years: minYears > 0 ? minYears : undefined,
      available_only: availableOnly,
      verified_only: verifiedOnly,
      sort,
      limit: 20,
      offset: (currentPage - 1) * 20,
      project_id: selectedProjectId || undefined
    };

    const grid = root.querySelector('#designers-grid');
    const countBar = root.querySelector('#results-count-bar');
    if (!grid) return;

    if (reset) {
      grid.innerHTML = Array(6).fill(0).map(() => `
        <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; height: 180px;"></div>
      `).join('');
    }

    try {
      const data = await searchDesignersForClient(params);
      if (countBar) countBar.textContent = `Showing ${data.total} design professional${data.total === 1 ? '' : 's'}`;

      if (data.results.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 48px; text-align: center; color: #6B7280; border: 1px dashed #E5E7EB; border-radius: 8px;">
            <p style="font-size: 14px; margin: 0 0 6px 0;">No designers found matching your criteria.</p>
            <p style="font-size: 12.5px; margin: 0;">Try adjusting your search terms or clearing your location and discipline filters.</p>
          </div>
        `;
        return;
      }

      const cardsHtml = data.results.map((d: any) => renderDesignerCard(d, selectedProjectId)).join('');
      if (reset) {
        grid.innerHTML = cardsHtml;
      } else {
        grid.insertAdjacentHTML('beforeend', cardsHtml);
      }

      bindCardActions(grid);
    } catch {
      grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: #DC2626;">Error loading designers.</div>`;
    }
  }

  // 3. Load Suggestions when project selected
  async function loadSuggestions(projectId: string) {
    const section = root.querySelector('#suggested-designers-section') as HTMLElement;
    const grid = root.querySelector('#suggested-cards-grid');
    if (!section || !grid) return;

    if (!projectId) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    grid.innerHTML = Array(3).fill(0).map(() => `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; height: 140px;"></div>
    `).join('');

    try {
      const suggestions = await suggestDesigners(projectId, 6);
      if (suggestions.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; font-size: 13px; color: #6B7280;">No direct suggestions found. Browse all verified designers below.</div>`;
        return;
      }

      grid.innerHTML = suggestions.map((s) => `
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; gap: 6px;">
              <div style="font-weight: 600; font-size: 14px; color: #111827;">${escapeHtml(s.full_name)}</div>
              
            </div>
            <div style="font-size: 12px; color: #6B7280; margin-bottom: 8px;">
              ${escapeHtml(s.discipline)} • ${escapeHtml([s.city, s.state].filter(Boolean).join(', '))}
            </div>
            <div style="display: flex; flex-direction: column; gap: 3px; margin-bottom: 12px;">
              ${(s.reasons || []).slice(0, 2).map(r => `
                <div style="font-size: 11.5px; color: #4B5563; display: flex; align-items: center; gap: 4px;">
                  <span>•</span> <span>${escapeHtml(r.text)}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <button type="button" class="btn-open-invite" data-id="${s.designer_id}" data-name="${escapeHtml(s.full_name)}" style="width: 100%; height: 32px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 4px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Invite to project
          </button>
        </div>
      `).join('');

      grid.querySelectorAll('.btn-open-invite').forEach(b => {
        b.addEventListener('click', () => {
          const dId = b.getAttribute('data-id') || '';
          const dName = b.getAttribute('data-name') || '';
          openInviteModal(dId, dName, projectId);
        });
      });
    } catch {
      grid.innerHTML = `<div style="grid-column: 1 / -1; font-size: 12px; color: #9CA3AF;">Could not load suggestions.</div>`;
    }
  }

  // 4. Bind Card Actions
  function bindCardActions(grid: Element) {
    grid.querySelectorAll('.btn-card-invite').forEach(b => {
      b.addEventListener('click', () => {
        const dId = b.getAttribute('data-id') || '';
        const dName = b.getAttribute('data-name') || '';
        openInviteModal(dId, dName, selectedProjectId);
      });
    });
  }

  // 5. Open Invite Modal
  function openInviteModal(designerId: string, designerName: string, preselectedProjectId = '') {
    const modal = root.querySelector('#modal-invite-designer') as HTMLElement;
    const nameEl = root.querySelector('#invite-designer-name');
    const idInput = root.querySelector('#invite-designer-id') as HTMLInputElement;
    const projSelect = root.querySelector('#invite-project-select') as HTMLSelectElement;

    if (!modal) return;
    if (nameEl) nameEl.textContent = designerName;
    if (idInput) idInput.value = designerId;
    if (projSelect && preselectedProjectId) projSelect.value = preselectedProjectId;

    modal.style.display = 'flex';
  }

  // 6. Handle Project Selection change
  root.querySelector('#select-project-context')?.addEventListener('change', (e: any) => {
    selectedProjectId = e.target.value;
    loadSuggestions(selectedProjectId);
    performSearch(true);
  });

  // 7. Search input debounce
  let debounceTimer: any;
  root.querySelector('#inp-designer-search')?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(true), 300);
  });

  root.querySelector('#select-sort')?.addEventListener('change', () => performSearch(true));

  // 8. Filters Drawer Controls
  const filterPanel = root.querySelector('#filter-panel-backdrop') as HTMLElement;
  root.querySelector('#btn-toggle-filters')?.addEventListener('click', () => {
    if (filterPanel) filterPanel.style.display = 'block';
  });
  root.querySelector('#btn-close-filter-panel')?.addEventListener('click', () => {
    if (filterPanel) filterPanel.style.display = 'none';
  });
  root.querySelector('#btn-apply-filters')?.addEventListener('click', () => {
    if (filterPanel) filterPanel.style.display = 'none';
    performSearch(true);
  });
  root.querySelector('#btn-reset-filters')?.addEventListener('click', () => {
    (root.querySelector('#filter-discipline') as HTMLSelectElement).value = '';
    (root.querySelector('#filter-state') as HTMLSelectElement).value = '';
    (root.querySelector('#filter-min-years') as HTMLSelectElement).value = '0';
    (root.querySelector('#filter-available-only') as HTMLInputElement).checked = false;
    if (root.querySelector('#filter-verified-only')) {
      (root.querySelector('#filter-verified-only') as HTMLInputElement).checked = false;
    }
    if (filterPanel) filterPanel.style.display = 'none';
    performSearch(true);
  });

  // 9. Order Dialog Controls
  const orderDialog = root.querySelector('#modal-order-dialog') as HTMLElement;
  root.querySelector('#link-order-explanation')?.addEventListener('click', () => {
    if (orderDialog) orderDialog.style.display = 'flex';
  });
  root.querySelector('#btn-close-order-dialog')?.addEventListener('click', () => {
    if (orderDialog) orderDialog.style.display = 'none';
  });
  root.querySelector('#btn-dismiss-order-dialog')?.addEventListener('click', () => {
    if (orderDialog) orderDialog.style.display = 'none';
  });

  // 10. Invite Form Submit
  const inviteForm = root.querySelector('#form-invite-designer') as HTMLFormElement;
  inviteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dId = (root.querySelector('#invite-designer-id') as HTMLInputElement).value;
    const pId = (root.querySelector('#invite-project-select') as HTMLSelectElement).value;
    const msg = (root.querySelector('#invite-message-text') as HTMLTextAreaElement).value.trim();
    const submitBtn = root.querySelector('#btn-submit-invite') as HTMLButtonElement;

    if (!pId) {
      alert('Please select a project to invite the designer to.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
    }

    try {
      await inviteDesigner(pId, dId, msg);
      (root.querySelector('#modal-invite-designer') as HTMLElement).style.display = 'none';
      alert('Invitation sent! The designer will be notified.');
      performSearch();
    } catch (err: any) {
      alert(err.message || 'Could not send invitation.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Invitation';
      }
    }
  });

  // Starters
  root.querySelectorAll('.btn-invite-starter').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-text') || '';
      const ta = root.querySelector('#invite-message-text') as HTMLTextAreaElement;
      if (ta) {
        ta.value = text;
        const cc = root.querySelector('#invite-char-count');
        if (cc) cc.textContent = `${text.length} / 500`;
      }
    });
  });

  root.querySelector('#btn-close-invite-modal')?.addEventListener('click', () => {
    (root.querySelector('#modal-invite-designer') as HTMLElement).style.display = 'none';
  });
  root.querySelector('#btn-cancel-invite')?.addEventListener('click', () => {
    (root.querySelector('#modal-invite-designer') as HTMLElement).style.display = 'none';
  });

  // Render saved searches in filter panel
  async function renderDesignerSavedSearches() {
    const listEl = root.querySelector('#designer-saved-searches-list');
    if (!listEl) return;
    try {
      const searches = await getSavedSearches('designers');
      if (searches.length === 0) {
        listEl.innerHTML = '<span style="color:#9CA3AF;">No saved searches.</span>';
        return;
      }
      listEl.innerHTML = searches.map((s) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 4px; padding: 4px 8px;">
          <button type="button" class="btn-load-designer-search" data-id="${s.id}" style="background: none; border: none; color: #2563EB; font-weight: 500; font-size: 11.5px; cursor: pointer; text-align: left; padding: 0;">
            ${s.name}
          </button>
          <button type="button" class="btn-del-designer-search" data-id="${s.id}" style="background: none; border: none; color: #EF4444; font-size: 11px; cursor: pointer;">
            ✕
          </button>
        </div>
      `).join('');

      listEl.querySelectorAll('.btn-load-designer-search').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id;
          const found = searches.find((x) => x.id === id);
          if (found && found.params) {
            const searchInput = root.querySelector('#inp-designer-search') as HTMLInputElement | null;
            const filterDiscipline = root.querySelector('#filter-discipline') as HTMLSelectElement | null;
            const filterState = root.querySelector('#filter-state') as HTMLSelectElement | null;
            if (searchInput && found.params.search !== undefined) searchInput.value = found.params.search;
            if (filterDiscipline && found.params.discipline !== undefined) filterDiscipline.value = found.params.discipline;
            if (filterState && found.params.state !== undefined) filterState.value = found.params.state;
            const drawer = root.querySelector('#filter-panel-backdrop') as HTMLElement | null;
            if (drawer) drawer.style.display = 'none';
            performSearch();
          }
        });
      });

      listEl.querySelectorAll('.btn-del-designer-search').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id;
          if (id) {
            await deleteSavedSearch(id);
            renderDesignerSavedSearches();
          }
        });
      });
    } catch {
      listEl.innerHTML = '<span style="color:#EF4444;">Could not load.</span>';
    }
  }

  // Save search button
  root.querySelector('#btn-save-designer-search')?.addEventListener('click', async () => {
    const searchInput = root.querySelector('#inp-designer-search') as HTMLInputElement | null;
    const filterDiscipline = root.querySelector('#filter-discipline') as HTMLSelectElement | null;
    const filterState = root.querySelector('#filter-state') as HTMLSelectElement | null;
    const currentParams = {
      search: searchInput?.value.trim() || '',
      discipline: filterDiscipline?.value || '',
      state: filterState?.value || ''
    };
    const name = window.prompt('Name this search:', currentParams.search || currentParams.discipline || 'Designer Search');
    if (!name?.trim()) return;
    try {
      await saveSearch(name.trim(), 'designers', currentParams);
      alert(`Search "${name.trim()}" saved! You can load it anytime from the Filters panel.`);
      renderDesignerSavedSearches();
    } catch (err: any) {
      alert(`Could not save search: ${err?.message || 'Maximum 10 saved searches reached.'}`);
    }
  });

  root.querySelector('#btn-toggle-filters')?.addEventListener('click', () => {
    renderDesignerSavedSearches();
  });

  // Perform initial search
  performSearch();
}

function renderDesignerCard(d: any, _selectedProjectId: string): string {
  return `
    <div class="dez-designer-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; gap: 14px; align-items: flex-start; margin-bottom: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 8px; background: #F1F5F9; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #475569; flex-shrink: 0;">
            ${d.avatar_path ? `<img src="${d.avatar_path}" alt="" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" />` : d.full_name.slice(0, 2).toUpperCase()}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px; flex-wrap: wrap;">
              <span style="font-weight: 600; font-size: 15px; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(d.full_name)}
              </span>
              
              ${d.is_promoted ? `<span style="font-size: 10px; background: #EFF6FF; color: #1D4ED8; padding: 1px 5px; border-radius: 4px; font-weight: 600;">Promoted</span>` : ''}
            </div>
            <div style="font-size: 12.5px; color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${d.studio_name ? `${escapeHtml(d.studio_name)} • ` : ''}${escapeHtml(d.discipline)}
            </div>
            <div style="font-size: 12px; color: #9CA3AF; margin-top: 2px;">
              ${escapeHtml([d.city, d.state].filter(Boolean).join(', '))}
            </div>
          </div>
        </div>

        <!-- Specialization chips -->
        ${(d.specializations && d.specializations.length > 0) ? `
          <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px;">
            ${d.specializations.slice(0, 3).map((s: string) => `
              <span style="font-size: 11px; background: #F7F7F8; color: #4B5563; padding: 2px 7px; border-radius: 4px; border: 1px solid #E5E7EB;">
                ${escapeHtml(s)}
              </span>
            `).join('')}
          </div>
        ` : ''}

        <!-- Credentials short list -->
        ${(d.credentials && d.credentials.length > 0) ? `
          <div style="font-size: 11.5px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 4px;">
            ${d.credentials.slice(0, 2).map((c: any) => {
              const isVerified = c.status === 'verified';
              let label = 'Self-reported';
              let style = 'background: #F3F4F6; color: #4B5563;';

              if (c.status === 'expired') {
                label = 'Expired';
                style = 'background: #FEF3C7; color: #92400E;';
              } else if (isVerified) {
                const st = c.state || c.issuing_state || 'US';
                const dt = c.verified_at ? new Date(c.verified_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '11/05/2026';
                label = `Verified: ${st}, ${dt}`;
                style = 'background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; font-weight: 500;';
              }

              const parts = [c.title || c.credential_type || 'Credential'];
              if (c.issuing_body) parts.push(c.issuing_body);
              if (c.state || c.issuing_state) parts.push(c.state || c.issuing_state);
              return `
                <div style="display: flex; align-items: center; gap: 6px; color: #4B5563;">
                  <span style="font-size: 10px; padding: 1px 5px; border-radius: 3px; ${style}">${escapeHtml(label)}</span>
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(parts.join(' • '))}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <!-- Experience & Rating metrics -->
        <div style="font-size: 12px; color: #4B5563; line-height: 1.5; margin-bottom: 12px;">
          <div>${d.years_experience} years experience &bull; ${
            d.rating_count >= 3 && d.rating_average
              ? `<span style="color: #D97706; font-weight: 600;">★ ${Number(d.rating_average).toFixed(1)}</span> (${d.rating_count} reviews)`
              : d.rating_count > 0
              ? `(${d.rating_count} review${d.rating_count === 1 ? '' : 's'})`
              : 'New talent'
          }</div>
          ${d.hourly_rate ? `<div>${formatUSD(d.hourly_rate * 100)}/hr</div>` : ''}
        </div>
      </div>

      <div style="display: flex; gap: 8px; border-top: 1px solid #F3F4F6; padding-top: 12px; margin-top: 8px;">
        <a href="#designer-profile?id=${d.designer_id}" style="flex: 1; height: 34px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 12.5px; font-weight: 500; color: #374151; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;">
          View profile
        </a>
        ${(() => {
          const isPlanBlocked = d.plan_key === 'free' || !d.accepts_invitations;
          if (!d.is_available) {
            return `<button type="button" class="btn-card-invite" disabled title="Designer unavailable" style="flex: 1; height: 34px; border: none; border-radius: 6px; background: #E5E7EB; color: #9CA3AF; font-size: 12.5px; font-weight: 600; cursor: not-allowed;">Unavailable</button>`;
          }
          if (isPlanBlocked) {
            return `<button type="button" class="btn-card-invite" disabled title="This designer isn't accepting invitations" style="flex: 1; height: 34px; border: 1px solid #E5E7EB; border-radius: 6px; background: #F8FAFC; color: #94A3B8; font-size: 12px; font-weight: 500; cursor: not-allowed;">Invite</button>`;
          }
          return `<button type="button" class="btn-card-invite" data-id="${d.designer_id}" data-name="${escapeHtml(d.full_name)}" style="flex: 1; height: 34px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 12.5px; font-weight: 600; cursor: pointer;">Invite</button>`;
        })()}
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

