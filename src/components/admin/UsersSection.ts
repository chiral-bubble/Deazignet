/**
 * UsersSection.ts
 * Users Management: search, filters, profile view, complimentary grants, notes, suspend/unsuspend with mandatory written reason.
 */

import {
  adminGetUsersList,
  adminToggleUserSuspension,
  adminGrantComplimentaryPlan,
  adminUpdateUserNotes,
  type AdminUserListItem
} from '../../services/adminConsoleService';
import { showReasonDialog } from './ReasonDialog';
import { ensureRecentAuth } from './ApprovalDialog';

export async function renderUsersSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            User Management & Safety
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Inspect user profiles, manage account standing, grant complimentary plans, and enforce safety suspensions.
          </p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
        <div style="flex: 1; min-width: 240px;">
          <input id="users-search-input" type="text" placeholder="Search by name, email, or user ID..." style="width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; outline: none;" />
        </div>
        <div>
          <select id="users-role-filter" style="padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; color: #0F172A;">
            <option value="all">All Roles</option>
            <option value="designer">Designers</option>
            <option value="client">Clients</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
        <div>
          <select id="users-status-filter" style="padding: 8px 12px; font-size: 13px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; color: #0F172A;">
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="suspended">Suspended Accounts</option>
          </select>
        </div>
        <button id="users-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh
        </button>
      </div>

      <!-- Users Table -->
      <div id="users-table-container" style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading users directory...</div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#users-search-input') as HTMLInputElement;
  const roleFilter = container.querySelector('#users-role-filter') as HTMLSelectElement;
  const statusFilter = container.querySelector('#users-status-filter') as HTMLSelectElement;
  const refreshBtn = container.querySelector('#users-refresh-btn') as HTMLButtonElement;
  const tableContainer = container.querySelector('#users-table-container') as HTMLElement;

  async function loadUsers() {
    tableContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading users...</div>';
    try {
      const users: AdminUserListItem[] = await adminGetUsersList({
        search: searchInput.value.trim(),
        role: roleFilter.value,
        status: statusFilter.value
      });

      if (users.length === 0) {
        tableContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">No matching user accounts found.</div>';
        return;
      }

      tableContainer.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
              <th style="padding: 12px 16px;">User</th>
              <th style="padding: 12px 16px;">Role</th>
              <th style="padding: 12px 16px;">Membership Plan</th>
              <th style="padding: 12px 16px;">Status</th>
              <th style="padding: 12px 16px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr style="border-bottom: 1px solid #F1F5F9; ${u.isSuspended ? 'background: #FEF2F2;' : ''}">
                <td style="padding: 12px 16px;">
                  <div style="font-weight: 600; color: #0F172A;">${u.fullName}</div>
                  <div style="font-size: 12px; color: #64748B;">${u.email}</div>
                  ${u.adminNotes ? `<div style="font-size: 11px; color: #0284C7; margin-top: 4px;">Note: ${u.adminNotes}</div>` : ''}
                </td>
                <td style="padding: 12px 16px;">
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: ${u.role === 'designer' ? '#E0F2FE; color: #0369A1;' : u.role === 'admin' ? '#FEE2E2; color: #991B1B;' : '#F1F5F9; color: #475569;'}">
                    ${u.role}
                  </span>
                </td>
                <td style="padding: 12px 16px;">
                  ${u.role === 'designer' ? `
                    <span style="font-weight: 500; text-transform: capitalize; color: #0F172A;">${u.complimentaryPlanId ? u.complimentaryPlanId + ' (Comp)' : (u.planId || 'free')}</span>
                    ${u.complimentaryExpiresAt ? `<div style="font-size: 11px; color: #059669;">Expires ${new Date(u.complimentaryExpiresAt).toLocaleDateString()}</div>` : ''}
                  ` : '<span style="color: #94A3B8;">—</span>'}
                </td>
                <td style="padding: 12px 16px;">
                  ${u.isSuspended ? `
                    <span style="background: #FEE2E2; color: #DC2626; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
                      Suspended
                    </span>
                    <div style="font-size: 11px; color: #B91C1C; margin-top: 2px;">${u.suspensionReason || 'Safety suspension'}</div>
                  ` : `
                    <span style="background: #DCFCE7; color: #15803D; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">
                      Active
                    </span>
                  `}
                </td>
                <td style="padding: 12px 16px; text-align: right;">
                  <div style="display: inline-flex; gap: 6px;">
                    ${u.role === 'designer' ? `
                      <button class="btn-grant-plan" data-id="${u.id}" data-name="${u.fullName}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #2563EB; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        Grant Plan
                      </button>
                    ` : ''}
                    <button class="btn-notes" data-id="${u.id}" data-name="${u.fullName}" data-note="${u.adminNotes || ''}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                      Notes
                    </button>
                    ${u.role !== 'admin' ? `
                      <button class="btn-toggle-suspend" data-id="${u.id}" data-name="${u.fullName}" data-suspended="${u.isSuspended}" style="background: ${u.isSuspended ? '#FFFFFF' : '#FEF2F2'}; border: 1px solid ${u.isSuspended ? '#CBD5E1' : '#FCA5A5'}; color: ${u.isSuspended ? '#15803D' : '#DC2626'}; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
                        ${u.isSuspended ? 'Unsuspend' : 'Suspend'}
                      </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      attachUserRowEvents();
    } catch (err: any) {
      tableContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachUserRowEvents() {
    // Toggle suspend button
    tableContainer.querySelectorAll('.btn-toggle-suspend').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id')!;
        const userName = btn.getAttribute('data-name')!;
        const isSuspended = btn.getAttribute('data-suspended') === 'true';

        // Sensitive action: check MFA re-auth gate
        const authed = await ensureRecentAuth(isSuspended ? `Unsuspend user account: ${userName}` : `Suspend user account: ${userName}`);
        if (!authed) return;

        // Written reason prompt
        const reason = await showReasonDialog({
          title: isSuspended ? `Unsuspend Account: ${userName}` : `Suspend Account: ${userName}`,
          subtitle: isSuspended ? 'Account access will be restored immediately.' : 'User will be barred from posting projects, submitting proposals, or transacting on the marketplace.',
          promptLabel: 'Required Justification Reason (min 5 characters)',
          placeholder: isSuspended ? 'Explain reason for lifting suspension...' : 'Detail violation of terms, safety risk, or policy breach...',
          danger: !isSuspended
        });

        if (!reason) return;

        try {
          await adminToggleUserSuspension(userId, !isSuspended, reason);
          await loadUsers();
        } catch (err: any) {
          alert('Failed to update suspension: ' + err.message);
        }
      });
    });

    // Grant Complimentary Plan
    tableContainer.querySelectorAll('.btn-grant-plan').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id')!;
        const userName = btn.getAttribute('data-name')!;

        const planChoice = window.prompt(`Select complimentary plan for ${userName} (enter "basic" or "gold"):`, 'gold');
        if (!planChoice || !['basic', 'gold'].includes(planChoice.toLowerCase().trim())) {
          return;
        }

        const reason = await showReasonDialog({
          title: `Grant Complimentary ${planChoice.toUpperCase()} Plan: ${userName}`,
          subtitle: 'Provides premium membership benefits, higher proposal limits, and direct invitations.',
          promptLabel: 'Administrative Reason (e.g., VIP partnership, tester promotion, beta compensation)',
          placeholder: 'Provide clear justification for complimentary membership award...'
        });

        if (!reason) return;

        try {
          await adminGrantComplimentaryPlan(userId, planChoice.toLowerCase().trim() as 'basic' | 'gold', 3, reason);
          alert(`Granted 3 months of complimentary ${planChoice.toUpperCase()} to ${userName}.`);
          await loadUsers();
        } catch (err: any) {
          alert('Failed to grant plan: ' + err.message);
        }
      });
    });

    // Edit Notes
    tableContainer.querySelectorAll('.btn-notes').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id')!;
        const userName = btn.getAttribute('data-name')!;
        const currentNote = btn.getAttribute('data-note') || '';

        const newNote = window.prompt(`Enter internal administrative note for ${userName}:`, currentNote);
        if (newNote === null) return;

        try {
          await adminUpdateUserNotes(userId, newNote.trim());
          await loadUsers();
        } catch (err: any) {
          alert('Failed to save note: ' + err.message);
        }
      });
    });
  }

  searchInput.addEventListener('input', () => loadUsers());
  roleFilter.addEventListener('change', () => loadUsers());
  statusFilter.addEventListener('change', () => loadUsers());
  refreshBtn.addEventListener('click', () => loadUsers());

  loadUsers();
}
