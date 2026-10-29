/**
 * PortfolioTab Component (Tab 2: Portfolio Settings)
 * Grid of portfolio cards with drag-to-reorder, Add project button,
 * Edit drawer, and Delete confirmation dialog.
 */

import type { PortfolioProject } from '../../../services/designerProfileService';
import { renderPortfolioProjectDrawer, initPortfolioProjectDrawer } from './PortfolioProjectDrawer';

export function renderPortfolioTab(portfolio: PortfolioProject[]): string {
  const sorted = [...portfolio].sort((a, b) => a.order - b.order);

  return `
    <div class="dez-settings-panel" id="dez-portfolio-tab-content">
      <div class="dez-panel-header-with-actions">
        <div>
          <h2 class="dez-panel-title">Portfolio Projects</h2>
          <p class="dez-panel-subtext">Add built projects and 3D architectural renders. A minimum of 3 projects is required for verified status.</p>
        </div>
        <button type="button" class="dez-btn-primary" id="btn-add-portfolio-project" style="height:36px; padding:0 18px;">
          + Add project
        </button>
      </div>

      <!-- Completeness Warning if < 3 projects -->
      ${
        sorted.length < 3
          ? `
        <div class="dez-info-banner" style="margin-bottom: 20px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--dez-brand); flex-shrink:0;">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style="font-size:13px; color:var(--dez-text-primary);">
            You have uploaded <strong>${sorted.length} of 3</strong> minimum required projects. Add ${3 - sorted.length} more to satisfy profile completeness.
          </div>
        </div>
      `
          : ''
      }

      <!-- Portfolio Grid or Empty State -->
      ${
        sorted.length === 0
          ? `
        <div class="dez-empty-portfolio-card">
          <div class="dez-empty-icon-wrap">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <h3 class="dez-empty-title">Add your first project so clients can see your work</h3>
          <p class="dez-empty-subtext">Architectural clients prioritize verified portfolios with photography and concept descriptions.</p>
          <button type="button" class="dez-btn-primary" id="btn-empty-add-project" style="margin-top: 14px; height:36px;">
            Add your first project
          </button>
        </div>
      `
          : `
        <div class="dez-portfolio-grid" id="portfolio-cards-grid">
          ${sorted
            .map((proj, idx) => {
              const coverImg = proj.images.find((im) => im.isCover) || proj.images[0];
              const imgUrl = coverImg?.url || '';

              return `
              <div class="dez-port-card" draggable="true" data-project-id="${proj.id}" data-project-index="${idx}">
                <div class="dez-port-card-cover-wrap">
                  ${
                    imgUrl
                      ? `<img src="${imgUrl}" alt="${proj.title}" class="dez-port-card-img" />`
                      : `<div class="dez-port-card-no-img">No image</div>`
                  }
                  <span class="dez-port-card-category">${proj.category}</span>
                  <div class="dez-port-drag-handle" title="Drag to reorder" aria-label="Drag to reorder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                      <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                    </svg>
                  </div>
                </div>

                <div class="dez-port-card-info">
                  <div class="dez-port-card-header">
                    <h4 class="dez-port-card-title">${proj.title}</h4>
                    <span class="dez-port-card-year">${proj.year}</span>
                  </div>
                  <div class="dez-port-card-meta">${proj.location} &bull; ${proj.role}</div>
                  <p class="dez-port-card-summary">${proj.shortDescription}</p>

                  <div class="dez-port-card-actions">
                    <div class="dez-port-reorder-group" aria-label="Reorder project">
                      <button type="button" class="dez-reorder-btn" data-action="move-up" data-project-id="${proj.id}" ${idx === 0 ? 'disabled' : ''} title="Move earlier">&uarr;</button>
                      <button type="button" class="dez-reorder-btn" data-action="move-down" data-project-id="${proj.id}" ${idx === sorted.length - 1 ? 'disabled' : ''} title="Move later">&darr;</button>
                    </div>

                    <div style="display:flex; gap:6px;">
                      <button type="button" class="dez-btn-secondary" data-action="edit-project" data-project-id="${proj.id}" style="height:30px; padding:0 10px; font-size:12.5px;">
                        Edit
                      </button>
                      <button type="button" class="dez-btn-danger-outline" data-action="delete-project" data-project-id="${proj.id}" style="height:30px; padding:0 10px; font-size:12.5px;" title="Delete project">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }

      <!-- Drawer Slot -->
      <div id="portfolio-drawer-slot"></div>

      <!-- Delete Confirmation Dialog -->
      <div class="dez-dash-modal-backdrop" id="modal-delete-project-confirm" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-del-title">
        <div class="dez-dash-modal" style="max-width: 440px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-del-title">Delete Portfolio Project?</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-del-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size:13.5px; color:var(--dez-text-primary); line-height:1.5;">
              Are you sure you want to delete <strong id="delete-target-title">this project</strong>?
            </p>
            <p style="font-size:13px; color:var(--dez-text-muted); margin-top:6px;">
              This will remove all uploaded photography and descriptions from your public portfolio. This action cannot be undone.
            </p>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-del" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-danger" id="btn-confirm-delete" style="height:36px; padding:0 18px;">
              Delete project
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initPortfolioTab(
  container: HTMLElement,
  portfolio: PortfolioProject[],
  callbacks: {
    onAddProject: (item: Omit<PortfolioProject, 'id' | 'order'>) => Promise<void>;
    onEditProject: (id: string, updates: Partial<PortfolioProject>) => Promise<void>;
    onDeleteProject: (id: string) => Promise<void>;
    onReorder: (ids: string[]) => Promise<void>;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): void {
  const root = container.querySelector('#dez-portfolio-tab-content') as HTMLElement;
  if (!root) return;

  const drawerSlot = root.querySelector('#portfolio-drawer-slot') as HTMLElement;
  const deleteModal = root.querySelector('#modal-delete-project-confirm') as HTMLElement;
  const deleteTitleEl = root.querySelector('#delete-target-title') as HTMLElement;
  const btnCloseDel = root.querySelector('#btn-close-del-modal') as HTMLButtonElement;
  const btnCancelDel = root.querySelector('#btn-cancel-del') as HTMLButtonElement;
  const btnConfirmDel = root.querySelector('#btn-confirm-delete') as HTMLButtonElement;

  let targetDeleteId: string | null = null;

  // Open Add Drawer
  const openAddDrawer = () => {
    if (!drawerSlot) return;
    drawerSlot.innerHTML = renderPortfolioProjectDrawer(null);
    const ctrl = initPortfolioProjectDrawer(
      drawerSlot,
      null,
      async (newData) => {
        await callbacks.onAddProject(newData);
        callbacks.onShowToast('Project Added', `"${newData.title}" was added to your portfolio.`, 'success');
      },
      () => {
        drawerSlot.innerHTML = '';
      }
    );
    ctrl.open();
  };

  root.querySelector('#btn-add-portfolio-project')?.addEventListener('click', openAddDrawer);
  root.querySelector('#btn-empty-add-project')?.addEventListener('click', openAddDrawer);

  // Edit Project Buttons
  root.querySelectorAll('[data-action="edit-project"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-project-id');
      const project = portfolio.find((p) => p.id === id);
      if (!project || !drawerSlot) return;

      drawerSlot.innerHTML = renderPortfolioProjectDrawer(project);
      const ctrl = initPortfolioProjectDrawer(
        drawerSlot,
        project,
        async (updatedData) => {
          await callbacks.onEditProject(project.id, updatedData);
          callbacks.onShowToast('Project Updated', `"${updatedData.title}" changes saved.`, 'success');
        },
        () => {
          drawerSlot.innerHTML = '';
        }
      );
      ctrl.open();
    });
  });

  // Delete Project Buttons & Modal
  root.querySelectorAll('[data-action="delete-project"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-project-id');
      const project = portfolio.find((p) => p.id === id);
      if (!project || !deleteModal) return;

      targetDeleteId = id;
      if (deleteTitleEl) deleteTitleEl.textContent = `"${project.title}"`;
      deleteModal.style.display = 'flex';
      deleteModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });

  const closeDeleteModal = () => {
    if (deleteModal) {
      deleteModal.style.display = 'none';
      deleteModal.classList.remove('is-open');
      document.body.style.overflow = '';
      targetDeleteId = null;
    }
  };

  btnCloseDel?.addEventListener('click', closeDeleteModal);
  btnCancelDel?.addEventListener('click', closeDeleteModal);
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  btnConfirmDel?.addEventListener('click', async () => {
    if (!targetDeleteId) return;
    btnConfirmDel.disabled = true;
    btnConfirmDel.textContent = 'Deleting...';
    try {
      await callbacks.onDeleteProject(targetDeleteId);
      callbacks.onShowToast('Project Deleted', 'Portfolio project was removed.', 'info');
      closeDeleteModal();
    } finally {
      btnConfirmDel.disabled = false;
      btnConfirmDel.textContent = 'Delete project';
    }
  });

  // Reorder buttons (Move Up / Down for accessibility)
  root.querySelectorAll('[data-action="move-up"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-project-id');
      const idx = portfolio.findIndex((p) => p.id === id);
      if (idx > 0) {
        const ids = portfolio.map((p) => p.id);
        const temp = ids[idx];
        ids[idx] = ids[idx - 1];
        ids[idx - 1] = temp;
        await callbacks.onReorder(ids);
      }
    });
  });

  root.querySelectorAll('[data-action="move-down"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-project-id');
      const idx = portfolio.findIndex((p) => p.id === id);
      if (idx !== -1 && idx < portfolio.length - 1) {
        const ids = portfolio.map((p) => p.id);
        const temp = ids[idx];
        ids[idx] = ids[idx + 1];
        ids[idx + 1] = temp;
        await callbacks.onReorder(ids);
      }
    });
  });

  // Drag and drop reordering
  const cards = root.querySelectorAll<HTMLElement>('.dez-port-card');
  let draggedEl: HTMLElement | null = null;

  cards.forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      draggedEl = card;
      card.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-project-id') || '');
      }
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      draggedEl = null;
      root.querySelectorAll('.dez-port-card').forEach((c) => c.classList.remove('is-drag-target'));
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedEl && draggedEl !== card) {
        card.classList.add('is-drag-target');
      }
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('is-drag-target');
    });

    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('is-drag-target');
      if (!draggedEl || draggedEl === card) return;

      const draggedId = draggedEl.getAttribute('data-project-id');
      const targetId = card.getAttribute('data-project-id');
      if (!draggedId || !targetId) return;

      const ids = portfolio.map((p) => p.id);
      const fromIdx = ids.indexOf(draggedId);
      const toIdx = ids.indexOf(targetId);

      if (fromIdx !== -1 && toIdx !== -1) {
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, draggedId);
        await callbacks.onReorder(ids);
        callbacks.onShowToast('Portfolio Reordered', 'Project order updated.', 'info');
      }
    });
  });
}
