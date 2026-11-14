/**
 * RolesAuditSection.ts
 * Super Admin Role Management & Immutable Security Audit Trail
 * Allows super_admin to grant/revoke roles and review the append-only security audit log with CSV export.
 */

import {
  adminGetAdminRolesList,
  adminManageRole,
  adminGetAuditLogEntries,
  exportToCSV,
  getEffectiveAdminRole,
  setSimulatedAdminRole,
  type AdminRoleAssignment,
  type AdminRole
} from '../../services/adminConsoleService';
import { ensureRecentAuth } from './ApprovalDialog';

export async function renderRolesAuditSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Administrative Access & Security Audit Log
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Manage administrative roles with capability-based security and inspect the immutable, append-only system audit trail.
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="font-size: 12px; color: #64748B;">Role Simulation:</div>
          <select id="role-simulation-select" style="padding: 6px 10px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 6px; background: #FFFFFF; font-weight: 600;">
            <option value="super_admin">super_admin (Full)</option>
            <option value="moderator">moderator (Safety/Content)</option>
            <option value="support">support (Tickets/Users)</option>
            <option value="finance">finance (Payouts/Fees)</option>
            <option value="verifier">verifier (Credentials)</option>
          </select>
        </div>
      </div>

      <!-- Part 1: Team Roles Management (Super Admin Only) -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #0F172A;">
              Administrative Staff Roles & Capabilities
            </h3>
            <p style="margin: 0; font-size: 13px; color: #64748B;">
              Only <strong>super_admin</strong> accounts can grant or revoke administrative roles. Changes are audited.
            </p>
          </div>
          <button id="btn-grant-role" style="background: #2563EB; border: none; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
            + Assign Team Role
          </button>
        </div>

        <div id="roles-table-container">
          <div style="text-align: center; padding: 24px; color: #64748B;">Loading team roles...</div>
        </div>
      </div>

      <!-- Part 2: Immutable Security Audit Trail -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="padding: 20px; border-bottom: 1px solid #E2E8F0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0F172A;">Immutable Security Audit Trail</h3>
              <span style="background: #DCFCE7; color: #15803D; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                Append-Only
              </span>
            </div>
            <p style="margin: 0; font-size: 13px; color: #64748B;">
              Trigger-enforced ledger. Updates and deletions are strictly prevented at the database engine level.
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-export-audit-csv" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #0F172A; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Export Audit Trail (CSV)
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div style="padding: 12px 20px; background: #F8FAFC; border-bottom: 1px solid #E2E8F0; display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
          <input id="audit-search-input" type="text" placeholder="Search by reason, administrator email, or target ID..." style="flex: 1; min-width: 240px; padding: 6px 10px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 4px;" />
          <select id="audit-action-filter" style="padding: 6px 10px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 4px; background: #FFFFFF;">
            <option value="all">All Actions</option>
            <option value="read_private_content">read_private_content</option>
            <option value="suspend_user">suspend_user</option>
            <option value="resolve_dispute">resolve_dispute</option>
            <option value="approve_financial_action_first">approve_financial_action_first</option>
            <option value="approve_financial_action_second">approve_financial_action_second</option>
            <option value="execute_financial_action">execute_financial_action</option>
            <option value="grant_admin_role">grant_admin_role</option>
          </select>
        </div>

        <!-- Audit Table -->
        <div id="audit-log-table-container">
          <div style="text-align: center; padding: 48px; color: #64748B;">Loading security audit log...</div>
        </div>
      </div>
    </div>
  `;

  const simSelect = container.querySelector('#role-simulation-select') as HTMLSelectElement;
  simSelect.value = getEffectiveAdminRole();
  simSelect.addEventListener('change', () => {
    setSimulatedAdminRole(simSelect.value as AdminRole);
    alert(`Active administrator role switched to "${simSelect.value}". Permissions updated.`);
    loadRoles();
  });

  const rolesContainer = container.querySelector('#roles-table-container') as HTMLElement;
  const auditContainer = container.querySelector('#audit-log-table-container') as HTMLElement;
  const btnGrantRole = container.querySelector('#btn-grant-role') as HTMLButtonElement;
  const btnExportAudit = container.querySelector('#btn-export-audit-csv') as HTMLButtonElement;
  const auditSearchInput = container.querySelector('#audit-search-input') as HTMLInputElement;
  const auditActionFilter = container.querySelector('#audit-action-filter') as HTMLSelectElement;

  async function loadRoles() {
    const roles: AdminRoleAssignment[] = await adminGetAdminRolesList();
    const isSuper = getEffectiveAdminRole() === 'super_admin';

    rolesContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
            <th style="padding: 10px 14px;">Administrator</th>
            <th style="padding: 10px 14px;">Assigned Role</th>
            <th style="padding: 10px 14px;">Capabilities</th>
            <th style="padding: 10px 14px;">Granted Date</th>
            <th style="padding: 10px 14px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${roles.map(r => `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 10px 14px;">
                <strong style="color: #0F172A;">${r.fullName}</strong>
                <div style="font-size: 11px; color: #64748B;">${r.email}</div>
              </td>
              <td style="padding: 10px 14px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: ${r.role === 'super_admin' ? '#FEE2E2; color: #991B1B;' : '#E0F2FE; color: #0369A1;'}">
                  ${r.role}
                </span>
              </td>
              <td style="padding: 10px 14px; font-size: 11px; color: #475569;">
                ${r.role === 'super_admin' ? 'All capabilities (Unrestricted)' : r.role === 'finance' ? 'Finances, Payouts, Fees, Analytics' : r.role === 'moderator' ? 'Content, Projects, Users, Safety' : r.role === 'support' ? 'Tickets, Users, Notes' : 'Credential Verification'}
              </td>
              <td style="padding: 10px 14px; font-size: 12px; color: #64748B;">
                ${new Date(r.grantedAt).toLocaleDateString()}
              </td>
              <td style="padding: 10px 14px; text-align: right;">
                ${isSuper && r.role !== 'super_admin' ? `
                  <button class="btn-revoke-role" data-id="${r.userId}" data-email="${r.email}" data-role="${r.role}" style="background: #FFFFFF; border: 1px solid #FCA5A5; color: #DC2626; font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 4px; cursor: pointer;">
                    Revoke
                  </button>
                ` : '<span style="font-size: 11px; color: #94A3B8;">Permanent</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    rolesContainer.querySelectorAll('.btn-revoke-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id')!;
        const email = btn.getAttribute('data-email')!;
        const role = btn.getAttribute('data-role')! as AdminRole;

        const authed = await ensureRecentAuth(`Revoke administrative role ${role} from ${email}`);
        if (!authed) return;

        if (confirm(`Revoke role "${role}" from ${email}?`)) {
          await adminManageRole({
            userId,
            email,
            fullName: '',
            role,
            action: 'revoke'
          });
          await loadRoles();
          await loadAuditLog();
        }
      });
    });
  }

  btnGrantRole.addEventListener('click', async () => {
    const isSuper = getEffectiveAdminRole() === 'super_admin';
    if (!isSuper) {
      alert('Unauthorized: Only super_admin accounts can assign admin roles.');
      return;
    }

    const email = window.prompt('Enter user email to assign admin role:');
    if (!email) return;

    const role = window.prompt('Select role (super_admin, moderator, support, finance, verifier):', 'moderator') as AdminRole;
    if (!role || !['super_admin', 'moderator', 'support', 'finance', 'verifier'].includes(role)) {
      alert('Invalid role specified.');
      return;
    }

    const authed = await ensureRecentAuth(`Grant ${role} role to ${email}`);
    if (!authed) return;

    await adminManageRole({
      userId: 'usr-' + Date.now(),
      email: email.trim(),
      fullName: email.split('@')[0],
      role,
      action: 'grant'
    });

    alert(`Role ${role} granted to ${email}.`);
    await loadRoles();
    await loadAuditLog();
  });

  async function loadAuditLog() {
    const entries = await adminGetAuditLogEntries({
      action: auditActionFilter.value,
      search: auditSearchInput.value.trim()
    });

    if (entries.length === 0) {
      auditContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">No audit trail entries found.</div>';
      return;
    }

    auditContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E2E8F0; color: #475569; font-weight: 600;">
            <th style="padding: 10px 14px;">Timestamp</th>
            <th style="padding: 10px 14px;">Administrator</th>
            <th style="padding: 10px 14px;">Action</th>
            <th style="padding: 10px 14px;">Target Entity</th>
            <th style="padding: 10px 14px;">Mandatory Written Reason & Justification</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map(e => `
            <tr style="border-bottom: 1px solid #F1F5F9;">
              <td style="padding: 10px 14px; color: #64748B; white-space: nowrap;">
                ${new Date(e.createdAt).toLocaleString()}
              </td>
              <td style="padding: 10px 14px; font-weight: 500; color: #0F172A;">
                ${e.adminEmail}
              </td>
              <td style="padding: 10px 14px;">
                <span style="font-family: monospace; font-size: 11px; background: #F1F5F9; color: #334155; padding: 2px 6px; border-radius: 4px;">
                  ${e.action}
                </span>
              </td>
              <td style="padding: 10px 14px; font-family: monospace; font-size: 11px; color: #64748B;">
                ${e.targetType}:${e.targetId}
              </td>
              <td style="padding: 10px 14px; color: #0F172A; max-width: 360px;">
                ${e.reason ? `<em>${e.reason}</em>` : '<span style="color: #94A3B8;">—</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  btnExportAudit.addEventListener('click', async () => {
    const entries = await adminGetAuditLogEntries({
      action: auditActionFilter.value,
      search: auditSearchInput.value.trim()
    });

    const headers = ['Timestamp', 'AdminEmail', 'Action', 'TargetType', 'TargetId', 'Reason'];
    const rows = entries.map(e => [e.createdAt, e.adminEmail, e.action, e.targetType, e.targetId, e.reason || '']);
    exportToCSV('dezignet-security-audit-trail.csv', headers, rows);
  });

  auditSearchInput.addEventListener('input', loadAuditLog);
  auditActionFilter.addEventListener('change', loadAuditLog);

  await loadRoles();
  await loadAuditLog();
}
