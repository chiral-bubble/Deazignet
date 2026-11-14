/**
 * ProjectsSection.ts
 * Projects Administration: unpublish, remove, and restore project posts with mandatory written reason.
 */

import {
  adminGetProjectsList,
  adminManageProject,
  type AdminProjectListItem
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { formatUSD } from '../../services/usMarketService';

export async function renderProjectsSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="margin-bottom: 24px;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
          Project Content Moderation
        </h2>
        <p style="font-size: 14px; color: #64748B; margin: 0;">
          Inspect client job postings, enforce safety policies, unpublish drafts, or remove non-compliant listings with recorded justification.
        </p>
      </div>

      <!-- Search Toolbar -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; gap: 12px; align-items: center;">
        <div style="flex: 1;">
          <input id="projects-search-input" type="text" placeholder="Search project title or client name..." style="width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; outline: none;" />
        </div>
        <button id="projects-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh
        </button>
      </div>

      <!-- Projects Table -->
      <div id="projects-table-container" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading projects...</div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#projects-search-input') as HTMLInputElement;
  const refreshBtn = container.querySelector('#projects-refresh-btn') as HTMLButtonElement;
  const tableContainer = container.querySelector('#projects-table-container') as HTMLElement;

  async function loadProjects() {
    tableContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading projects...</div>';
    try {
      const projects: AdminProjectListItem[] = await adminGetProjectsList(searchInput.value.trim());

      if (projects.length === 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">No matching projects found.</div>';
        return;
      }

      tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
              <th style="padding: 12px 16px;">Project Title</th>
              <th style="padding: 12px 16px;">Client</th>
              <th style="padding: 12px 16px;">Budget Range</th>
              <th style="padding: 12px 16px;">Proposals</th>
              <th style="padding: 12px 16px;">Status</th>
              <th style="padding: 12px 16px; text-align: right;">Moderation Actions</th>
            </tr>
          </thead>
          <tbody>
            ${projects.map(p => `
              <tr style="border-bottom: 1px solid #F1F5F9; ${p.isAdminRemoved ? 'background: #FEF2F2;' : ''}">
                <td style="padding: 12px 16px; max-width: 320px;">
                  <div style="font-weight: 600; color: #0F172A;">${p.title}</div>
                  <div style="font-size: 11px; color: #94A3B8;">ID: ${p.id}</div>
                  ${p.adminRemovalReason ? `<div style="font-size: 11px; color: #DC2626; margin-top: 4px;"><strong>Removed:</strong> ${p.adminRemovalReason}</div>` : ''}
                </td>
                <td style="padding: 12px 16px;">
                  <div style="font-weight: 500; color: #0F172A;">${p.clientName}</div>
                </td>
                <td style="padding: 12px 16px;">
                  ${p.budgetMin && p.budgetMax ? `${formatUSD(p.budgetMin)} - ${formatUSD(p.budgetMax)}` : 'Flexible'}
                </td>
                <td style="padding: 12px 16px;">
                  <span style="background: #F1F5F9; color: #334155; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
                    ${p.proposalsCount} proposals
                  </span>
                </td>
                <td style="padding: 12px 16px;">
                  ${p.isAdminRemoved ? `
                    <span style="background: #FEE2E2; color: #DC2626; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
                      Admin Removed
                    </span>
                  ` : `
                    <span style="background: ${p.status === 'open' ? '#DCFCE7; color: #15803D;' : '#F1F5F9; color: #475569;'}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                      ${p.status}
                    </span>
                  `}
                </td>
                <td style="padding: 12px 16px; text-align: right;">
                  <div style="display: inline-flex; gap: 6px;">
                    ${!p.isAdminRemoved && p.status === 'open' ? `
                      <button class="btn-proj-unpublish" data-id="${p.id}" data-title="${p.title}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #D97706; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        Unpublish
                      </button>
                    ` : ''}
                    ${!p.isAdminRemoved ? `
                      <button class="btn-proj-remove" data-id="${p.id}" data-title="${p.title}" style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        Remove
                      </button>
                    ` : `
                      <button class="btn-proj-restore" data-id="${p.id}" data-title="${p.title}" style="background: #DCFCE7; border: 1px solid #86EFAC; color: #15803D; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        Restore
                      </button>
                    `}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      attachProjectActions();
    } catch (err: any) {
      tableContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachProjectActions() {
    // Unpublish
    tableContainer.querySelectorAll('.btn-proj-unpublish').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const title = btn.getAttribute('data-title')!;

        const reason = await showReasonDialog({
          title: `Unpublish Project: ${title}`,
          subtitle: 'Reverts project to draft status so the client can revise scope.',
          promptLabel: 'Reason for unpublishing (e.g. missing essential project parameters)',
          placeholder: 'Provide justification (minimum 5 characters)...'
        });

        if (!reason) return;

        try {
          await adminManageProject(id, 'unpublish', reason);
          await loadProjects();
        } catch (err: any) {
          alert('Failed to unpublish project: ' + err.message);
        }
      });
    });

    // Remove
    tableContainer.querySelectorAll('.btn-proj-remove').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const title = btn.getAttribute('data-title')!;

        const reason = await showReasonDialog({
          title: `Remove Project: ${title}`,
          subtitle: 'Closes and removes project post from marketplace listings.',
          promptLabel: 'Reason for administrative removal (e.g. policy breach, illegal scope)',
          placeholder: 'Enter clear reason (minimum 5 characters)...',
          danger: true
        });

        if (!reason) return;

        try {
          await adminManageProject(id, 'remove', reason);
          await loadProjects();
        } catch (err: any) {
          alert('Failed to remove project: ' + err.message);
        }
      });
    });

    // Restore
    tableContainer.querySelectorAll('.btn-proj-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const title = btn.getAttribute('data-title')!;

        const reason = await showReasonDialog({
          title: `Restore Project: ${title}`,
          subtitle: 'Lifts administrative removal and re-opens the project to proposals.',
          promptLabel: 'Reason for restoring project',
          placeholder: 'Provide justification (minimum 5 characters)...'
        });

        if (!reason) return;

        try {
          await adminManageProject(id, 'restore', reason);
          await loadProjects();
        } catch (err: any) {
          alert('Failed to restore project: ' + err.message);
        }
      });
    });
  }

  searchInput.addEventListener('input', () => loadProjects());
  refreshBtn.addEventListener('click', () => loadProjects());
  loadProjects();
}
