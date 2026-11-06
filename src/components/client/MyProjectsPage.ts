/**
 * MyProjectsPage — Client project management dashboard
 * Displays summary metric blocks, filterable/sortable projects table,
 * action menu (View, Edit, Close, Duplicate, Cancel, Delete), and empty state.
 */

import {
  getMyProjects,
  getCategories,
  closeProject,
  cancelProject,
  duplicateProject,
  deleteProject
} from '../../services/projectsService';
import { renderClientShell, initClientShell } from './ClientLayout';
import { formatMoney } from '../../utils/formatters';

export async function renderMyProjectsPage(container: HTMLElement): Promise<void> {
  const actionButton = `
    <a href="#post-project" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; transition: background 150ms;">
      <span>+ Post a Project</span>
    </a>
  `;

  // Render initial skeleton shell
  container.innerHTML = renderClientShell(
    {
      activeTab: 'my-projects',
      pageTitle: 'My Projects',
      actionButtonHtml: actionButton
    },
    `
      <div id="projects-content-loading" style="display: flex; flex-direction: column; gap: 24px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          ${Array(4).fill(0).map(() => `
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; height: 90px; animate-pulse;"></div>
          `).join('')}
        </div>
        <div style="height: 300px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px;"></div>
      </div>
    `
  );

  initClientShell(container);

  try {
    const { projects } = await getMyProjects();
    const categories = await getCategories();

    renderProjectsList(container, projects, categories);
  } catch (err: any) {
    const mainArea = container.querySelector('main div');
    if (mainArea) {
      mainArea.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #F87171; border-radius: 8px; padding: 24px; text-align: center; color: #991B1B;">
          <p style="font-weight: 600; margin-bottom: 8px;">Failed to load your projects</p>
          <p style="font-size: 13px; margin-bottom: 16px;">${err?.message || 'A network error occurred.'}</p>
          <button id="retry-projects-btn" style="background: #DC2626; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Retry</button>
        </div>
      `;
      mainArea.querySelector('#retry-projects-btn')?.addEventListener('click', () => {
        renderMyProjectsPage(container);
      });
    }
  }
}

function renderProjectsList(container: HTMLElement, projects: any[], categories: any[]): void {
  const mainArea = container.querySelector('main div');
  if (!mainArea) return;

  // Calculate summary counts
  const openCount = projects.filter(p => p.status === 'open').length;
  const inProgressCount = projects.filter(p => p.status === 'in_progress').length;
  const completedCount = projects.filter(p => p.status === 'completed').length;
  const draftCount = projects.filter(p => p.status === 'draft').length;

  const summaryHtml = `
    <div class="client-dashboard-summary-grid" style="margin-bottom: 24px;">
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px 16px;">
        <div style="font-size: 13px; font-weight: 500; color: #4B5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Open Projects</div>
        <div class="dez-summary-val" style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px; font-variant-numeric: tabular-nums;">${openCount}</div>
      </div>
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px 16px;">
        <div style="font-size: 13px; font-weight: 500; color: #4B5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Active in Progress</div>
        <div class="dez-summary-val" style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px; font-variant-numeric: tabular-nums;">${inProgressCount}</div>
      </div>
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px 16px;">
        <div style="font-size: 13px; font-weight: 500; color: #4B5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Drafts</div>
        <div class="dez-summary-val" style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px; font-variant-numeric: tabular-nums;">${draftCount}</div>
      </div>
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px 16px;">
        <div style="font-size: 13px; font-weight: 500; color: #4B5563; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Completed</div>
        <div class="dez-summary-val" style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px; font-variant-numeric: tabular-nums;">${completedCount}</div>
      </div>
    </div>
  `;

  const filtersHtml = `
    <div class="client-filter-bar" style="margin-bottom: 20px;">
      <div class="client-filter-controls">
        <input
          type="text"
          id="project-search-input"
          class="client-search-input"
          placeholder="Search projects by title..."
          style="flex: 1; min-width: 180px; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; outline: none;"
        />
        <div class="client-filter-selects">
          <select id="status-filter" class="client-filter-select" style="height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF; color: #374151;">
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="draft">Draft</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select id="category-filter" class="client-filter-select" style="height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF; color: #374151;">
            <option value="all">All Categories</option>
            ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <select id="sort-select" style="height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; color: #374151;">
        <option value="newest">Newest first</option>
        <option value="budget_desc">Design Budget (High to Low)</option>
        <option value="budget_asc">Design Budget (Low to High)</option>
        <option value="proposals">Most Proposals</option>
      </select>
    </div>
  `;

  mainArea.innerHTML = `
    ${summaryHtml}
    ${filtersHtml}
    <div id="projects-table-container"></div>
  `;

  const tableContainer = mainArea.querySelector('#projects-table-container') as HTMLElement;

  function renderRows(filteredList: any[]) {
    if (filteredList.length === 0) {
      tableContainer.innerHTML = `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 60px 24px; text-align: center; background: #FFFFFF;">
          <div style="font-size: 32px; margin-bottom: 12px;">📁</div>
          <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px;">No projects found</h3>
          <p style="font-size: 13px; color: #6B7280; max-width: 400px; margin: 0 auto 20px;">
            ${projects.length === 0 ? "You haven't posted any projects yet. Create your first project to connect with top designers." : "No projects match your current filter criteria."}
          </p>
          <a href="#post-project" style="text-decoration: none; display: inline-block; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 6px; transition: background 150ms;">
            Post a Project
          </a>
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <!-- Desktop Table (screens > 768px) with horizontal scroll wrapper -->
      <div class="client-projects-desktop-table client-table-scroll-wrap">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 600;">
              <th style="padding: 12px 16px;">Project Title</th>
              <th style="padding: 12px 16px;">Status</th>
              <th style="padding: 12px 16px;">Design Budget</th>
              <th style="padding: 12px 16px;">Proposals</th>
              <th style="padding: 12px 16px;">Updated</th>
              <th style="padding: 12px 16px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredList.map((p) => {
              const statusBadge = getStatusBadge(p.status);
              const budgetFormatted = p.design_budget ? formatMoney(Number(p.design_budget)) : (p.hourly_rate_max ? `${formatMoney(p.hourly_rate_max)}/hr` : '—');
              const proposalCount = p.proposal_count || 0;
              const dateFormatted = new Date(p.updated_at || p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              
              const catName = p.category || p.category_name || 'Residential';
              const subcatName = p.subcategory || '';
              const disciplinesText = Array.isArray(p.disciplines) && p.disciplines.length > 0
                ? p.disciplines.map((d: string) => d.replace(/_/g, ' ')).join(', ')
                : 'Architect';

              return `
                <tr style="border-bottom: 1px solid #E5E7EB; transition: background 150ms;" onmouseover="this.style.background='#F9FAFB'" onmouseout="this.style.background='transparent'">
                  <td style="padding: 14px 16px;">
                    <a href="#project-details?id=${p.id}" style="text-decoration: none; font-weight: 600; color: #111827; display: block; margin-bottom: 4px;">${escapeHtml(p.title || 'Untitled Draft')}</a>
                    
                    <!-- Category & Subcategory Chips -->
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 4px;">
                      <span style="font-size: 11px; font-weight: 500; background: #EFF6FF; color: #1D4ED8; padding: 2px 6px; border-radius: 4px;">${escapeHtml(catName)}</span>
                      ${subcatName ? `<span style="font-size: 11px; background: #F3F4F6; color: #4B5563; padding: 2px 6px; border-radius: 4px;">${escapeHtml(subcatName)}</span>` : ''}
                    </div>

                    <!-- Discipline in plain text -->
                    <div style="font-size: 11.5px; color: #6B7280; text-transform: capitalize;">
                      ${escapeHtml(disciplinesText)}
                    </div>
                  </td>
                  <td style="padding: 14px 16px;">${statusBadge}</td>
                  <td style="padding: 14px 16px; font-variant-numeric: tabular-nums; font-weight: 500; color: #111827;">${budgetFormatted}</td>
                  <td style="padding: 14px 16px;">
                    <span style="font-weight: 600; color: ${proposalCount > 0 ? '#2F7BE5' : '#6B7280'};">${proposalCount}</span>
                  </td>
                  <td style="padding: 14px 16px; color: #6B7280; font-size: 12px;">${dateFormatted}</td>
                  <td style="padding: 14px 16px; text-align: right; position: relative;">
                    <button class="kebab-btn" data-project-id="${p.id}" style="background: transparent; border: 1px solid #E5E7EB; border-radius: 4px; padding: 4px 8px; cursor: pointer; color: #4B5563; font-size: 14px;">⋮</button>
                    <div class="kebab-menu" id="menu-${p.id}" style="display: none; position: absolute; right: 16px; top: 40px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; z-index: 20; min-width: 140px; text-align: left; padding: 4px 0;">
                      <a href="#project-details?id=${p.id}" style="display: block; padding: 8px 14px; font-size: 12px; color: #374151; text-decoration: none;">View details</a>
                      ${(p.status === 'draft' || (p.status === 'open' && proposalCount === 0)) ? `
                        <a href="#post-project?id=${p.id}" style="display: block; padding: 8px 14px; font-size: 12px; color: #374151; text-decoration: none;">Edit project</a>
                      ` : ''}
                      <button class="menu-action" data-action="duplicate" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #374151; cursor: pointer;">Duplicate</button>
                      ${p.status === 'open' ? `
                        <button class="menu-action" data-action="close" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #374151; cursor: pointer;">Close to proposals</button>
                      ` : ''}
                      ${['draft', 'open'].includes(p.status) ? `
                        <button class="menu-action" data-action="cancel" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #EF4444; cursor: pointer;">Cancel project</button>
                      ` : ''}
                      ${p.status === 'draft' ? `
                        <button class="menu-action" data-action="delete" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #EF4444; cursor: pointer;">Delete draft</button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Mobile Stacked Cards (screens <= 768px down to 360px) -->
      <div class="client-projects-mobile-cards">
        ${filteredList.map((p) => {
          const statusBadge = getStatusBadge(p.status);
          const budgetFormatted = p.design_budget ? formatMoney(Number(p.design_budget)) : (p.hourly_rate_max ? `${formatMoney(p.hourly_rate_max)}/hr` : '—');
          const proposalCount = p.proposal_count || 0;
          const dateFormatted = new Date(p.updated_at || p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          
          const catName = p.category || p.category_name || 'Residential';
          const subcatName = p.subcategory || '';
          const disciplinesText = Array.isArray(p.disciplines) && p.disciplines.length > 0
            ? p.disciplines.map((d: string) => d.replace(/_/g, ' ')).join(', ')
            : 'Architect';

          return `
            <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: 100%; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div style="min-width: 0; flex: 1;">
                  <a href="#project-details?id=${p.id}" style="text-decoration: none; font-weight: 600; font-size: 15px; color: #111827; display: block; overflow-wrap: anywhere; word-break: break-word; line-height: 1.35; margin-bottom: 6px;">
                    ${escapeHtml(p.title || 'Untitled Draft')}
                  </a>
                  <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                    <span style="font-size: 11px; font-weight: 500; background: #EFF6FF; color: #1D4ED8; padding: 2px 6px; border-radius: 4px;">${escapeHtml(catName)}</span>
                    ${subcatName ? `<span style="font-size: 11px; background: #F3F4F6; color: #4B5563; padding: 2px 6px; border-radius: 4px;">${escapeHtml(subcatName)}</span>` : ''}
                    <span style="font-size: 11px; color: #6B7280; text-transform: capitalize;">${escapeHtml(disciplinesText)}</span>
                  </div>
                </div>
                <div style="flex-shrink: 0;">${statusBadge}</div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px 12px; background: #F7F7F8; border-radius: 6px; font-size: 12px;">
                <div>
                  <div style="color: #6B7280; font-size: 11px;">Design Budget</div>
                  <div style="font-weight: 600; color: #111827; font-size: 13.5px; font-variant-numeric: tabular-nums; margin-top: 2px;">${budgetFormatted}</div>
                </div>
                <div>
                  <div style="color: #6B7280; font-size: 11px;">Proposals</div>
                  <div style="font-weight: 600; color: ${proposalCount > 0 ? '#2F7BE5' : '#111827'}; font-size: 13.5px; margin-top: 2px;">${proposalCount} received</div>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F3F4F6; padding-top: 10px;">
                <div style="font-size: 12px; color: #6B7280;">Updated ${dateFormatted}</div>
                <div style="display: flex; gap: 8px; align-items: center; position: relative;">
                  <a href="#project-details?id=${p.id}" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; height: 44px; min-height: 44px; padding: 0 16px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; border-radius: 6px; transition: background 150ms;">
                    View Details
                  </a>
                  <button class="kebab-btn" data-project-id="${p.id}" data-menu-target="m-menu-${p.id}" aria-label="Project actions" style="min-width: 44px; min-height: 44px; height: 44px; width: 44px; display: inline-flex; align-items: center; justify-content: center; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; cursor: pointer; color: #4B5563; font-size: 18px;">⋮</button>
                  <div class="kebab-menu" id="m-menu-${p.id}" style="display: none; position: absolute; right: 0; bottom: calc(100% + 4px); background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; z-index: 25; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 4px 0;">
                    <a href="#project-details?id=${p.id}" style="display: block; padding: 8px 14px; font-size: 12px; color: #374151; text-decoration: none;">View details</a>
                    ${(p.status === 'draft' || (p.status === 'open' && proposalCount === 0)) ? `
                      <a href="#post-project?id=${p.id}" style="display: block; padding: 8px 14px; font-size: 12px; color: #374151; text-decoration: none;">Edit project</a>
                    ` : ''}
                    <button class="menu-action" data-action="duplicate" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #374151; cursor: pointer;">Duplicate</button>
                    ${p.status === 'open' ? `
                      <button class="menu-action" data-action="close" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #374151; cursor: pointer;">Close to proposals</button>
                    ` : ''}
                    ${['draft', 'open'].includes(p.status) ? `
                      <button class="menu-action" data-action="cancel" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #EF4444; cursor: pointer;">Cancel project</button>
                    ` : ''}
                    ${p.status === 'draft' ? `
                      <button class="menu-action" data-action="delete" data-id="${p.id}" style="width: 100%; border: none; background: transparent; padding: 8px 14px; font-size: 12px; text-align: left; color: #EF4444; cursor: pointer;">Delete draft</button>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Attach kebab handlers for both desktop and mobile
    tableContainer.querySelectorAll('.kebab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pId = (btn as HTMLElement).dataset.projectId;
        const targetId = (btn as HTMLElement).dataset.menuTarget || `menu-${pId}`;
        const menu = tableContainer.querySelector(`#${targetId}`) as HTMLElement;
        if (!menu) return;
        const isShown = menu.style.display === 'block';

        // Hide all open menus
        tableContainer.querySelectorAll('.kebab-menu').forEach(m => (m as HTMLElement).style.display = 'none');

        if (!isShown) {
          menu.style.display = 'block';
        }
      });
    });

    // Close menus on body click
    document.addEventListener('click', () => {
      tableContainer.querySelectorAll('.kebab-menu').forEach(m => (m as HTMLElement).style.display = 'none');
    });

    // Attach actions
    tableContainer.querySelectorAll('.menu-action').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset.action;
        const pId = (btn as HTMLElement).dataset.id;
        if (!pId) return;

        try {
          if (action === 'duplicate') {
            const newId = await duplicateProject(pId);
            window.location.hash = `#post-project?id=${newId}`;
          } else if (action === 'close') {
            if (confirm('Are you sure you want to close this project to new proposals?')) {
              await closeProject(pId);
              renderMyProjectsPage(container);
            }
          } else if (action === 'cancel') {
            const reason = prompt('Reason for cancelling this project:');
            if (reason) {
              await cancelProject(pId, reason);
              renderMyProjectsPage(container);
            }
          } else if (action === 'delete') {
            if (confirm('Permanently delete this draft? This cannot be undone.')) {
              await deleteProject(pId);
              renderMyProjectsPage(container);
            }
          }
        } catch (err: any) {
          alert(err?.message || 'Action failed.');
        }
      });
    });
  }

  // Initial render
  renderRows(projects);

  // Filter & Search bindings
  const searchInput = mainArea.querySelector('#project-search-input') as HTMLInputElement;
  const statusFilter = mainArea.querySelector('#status-filter') as HTMLSelectElement;
  const categoryFilter = mainArea.querySelector('#category-filter') as HTMLSelectElement;
  const sortSelect = mainArea.querySelector('#sort-select') as HTMLSelectElement;

  function applyFilters() {
    const q = (searchInput?.value || '').toLowerCase().trim();
    const st = statusFilter?.value || 'all';
    const cat = categoryFilter?.value || 'all';
    const sort = sortSelect?.value || 'newest';

    let filtered = projects.filter((p) => {
      const matchQ = !q || (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      const matchSt = st === 'all' || p.status === st;
      const matchCat = cat === 'all' || p.category_id === cat;
      return matchQ && matchSt && matchCat;
    });

    if (sort === 'newest') {
      filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'budget_desc') {
      filtered.sort((a, b) => (Number(b.design_budget) || 0) - (Number(a.design_budget) || 0));
    } else if (sort === 'budget_asc') {
      filtered.sort((a, b) => (Number(a.design_budget) || 0) - (Number(b.design_budget) || 0));
    } else if (sort === 'proposals') {
      filtered.sort((a, b) => (b.proposal_count || 0) - (a.proposal_count || 0));
    }

    renderRows(filtered);
  }

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  categoryFilter?.addEventListener('change', applyFilters);
  sortSelect?.addEventListener('change', applyFilters);
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'open':
      return `<span style="background: #EFF6FF; color: #1D4ED8; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Open</span>`;
    case 'in_progress':
      return `<span style="background: #ECFDF5; color: #047857; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">In Progress</span>`;
    case 'completed':
      return `<span style="background: #F3F4F6; color: #374151; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Completed</span>`;
    case 'draft':
      return `<span style="background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Draft</span>`;
    case 'closed':
      return `<span style="background: #F3F4F6; color: #6B7280; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Closed</span>`;
    case 'cancelled':
      return `<span style="background: #FEE2E2; color: #B91C1C; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Cancelled</span>`;
    default:
      return `<span style="background: #F3F4F6; color: #6B7280; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${status}</span>`;
  }
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
