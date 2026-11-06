/**
 * Admin Area Component (/admin)
 * Clean, flat interface for administrative operations:
 * - Feedback Review (filtering, detail view, notes, CSV export)
 * - Designer Credentials Verification (AIA / NCARB / State Board license review & certificate preview)
 * - Reference Data Editor (Categories, Subcategories, Phase Templates with 100% split validation)
 * - Security Audit Log
 */

import {
  adminGetFeedback,
  adminUpdateFeedbackStatus,
  adminGetPendingCredentials,
  adminReviewCredential,
  adminGetAuditLog,
  adminGetPlans,
  adminUpdatePlan,
  adminGetFeeTiers,
  adminUpdateFeeTiers,
  adminGetMatchingSettings,
  adminUpdateMatchingSettings,
  adminTestSuggestions,
  type AdminMatchingSettings,
  type AdminSuggestedDesigner
} from '../../services/adminService';
import type {
  AdminFeedbackItem,
  AdminPendingCredential,
  AdminAuditLogItem
} from '../../services/adminService';
import { getCategories, getProjects, type CategoryItem, type Project } from '../../services/projectsService';
import { getTieredScheduleDescription, type Plan, type PlanFeeTier } from '../../services/plansService';
import { formatMoney } from '../../utils/formatters';

export function renderAdminPage(container: HTMLElement): void {
  container.innerHTML = `
    <div style="min-height: 100vh; background: #F7F7F8; font-family: Inter, sans-serif; color: #0F172A;">
      <!-- Admin Header -->
      <header style="background: #FFFFFF; border-bottom: 1px solid #E5E7EB; padding: 16px 32px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <a href="/" style="display: flex; align-items: center; gap: 8px; font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #0F172A; text-decoration: none;">
            <img src="/logo.png" alt="Dezignet" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain;" />
            Dezignet
          </a>
          <span style="background: #F1F5F9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
            Administration
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <a href="/dashboard" style="font-size: 13px; color: #64748B; text-decoration: none;">Back to app</a>
          <button id="admin-sign-out" style="background: none; border: 1px solid #E5E7EB; color: #0F172A; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
            Sign out
          </button>
        </div>
      </header>

      <!-- Main Admin Content Area -->
      <div style="max-width: 1200px; margin: 0 auto; padding: 32px 24px;">
        <div style="margin-bottom: 24px;">
          <h1 style="font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Platform administration
          </h1>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Review tester reports, verify professional credentials, manage system categories, and inspect audit logs.
          </p>
        </div>

        <!-- Navigation Tabs -->
        <nav style="display: flex; gap: 4px; border-bottom: 1px solid #E5E7EB; margin-bottom: 24px; overflow-x: auto;">
          <button class="admin-tab-btn" data-tab="feedback" style="background: none; border: none; border-bottom: 2px solid #2F7BE5; color: #2F7BE5; font-size: 14px; font-weight: 600; padding: 10px 16px; cursor: pointer; white-space: nowrap;">
            Tester feedback
          </button>
          <button class="admin-tab-btn" data-tab="credentials" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer; white-space: nowrap;">
            Pending credentials
          </button>
          <button class="admin-tab-btn" data-tab="plans-fees" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer; white-space: nowrap;">
            Plans & fee tiers
          </button>
          <button class="admin-tab-btn" data-tab="matching" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer; white-space: nowrap;">
            Matching & suggestion tester
          </button>
          <button class="admin-tab-btn" data-tab="reference-data" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer; white-space: nowrap;">
            Categories & templates
          </button>
          <button class="admin-tab-btn" data-tab="audit-log" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer; white-space: nowrap;">
            Security audit log
          </button>
        </nav>

        <!-- Tab Content Panes -->
        <div id="admin-tab-content">
          <div style="text-align: center; padding: 48px; color: #64748B;">Loading administration data...</div>
        </div>
      </div>

      <!-- Detail / Action Modal Container -->
      <div id="admin-modal-container" style="display: none;"></div>
    </div>
  `;

  initAdminPage(container);
}

function initAdminPage(container: HTMLElement): void {
  let activeTab: 'feedback' | 'credentials' | 'plans-fees' | 'matching' | 'reference-data' | 'audit-log' = 'feedback';

  const tabButtons = container.querySelectorAll<HTMLButtonElement>('.admin-tab-btn');
  const tabContent = container.querySelector<HTMLDivElement>('#admin-tab-content')!;
  const modalContainer = container.querySelector<HTMLDivElement>('#admin-modal-container')!;

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.style.borderBottomColor = 'transparent';
        b.style.color = '#64748B';
        b.style.fontWeight = '500';
      });
      btn.style.borderBottomColor = '#2F7BE5';
      btn.style.color = '#2F7BE5';
      btn.style.fontWeight = '600';

      activeTab = btn.getAttribute('data-tab') as any;
      loadTabContent();
    });
  });

  async function loadTabContent() {
    tabContent.innerHTML = `<div style="text-align: center; padding: 48px; color: #64748B; font-size: 14px;">Loading...</div>`;

    try {
      if (activeTab === 'feedback') {
        await loadFeedbackTab(tabContent, modalContainer);
      } else if (activeTab === 'credentials') {
        await loadCredentialsTab(tabContent, modalContainer);
      } else if (activeTab === 'plans-fees') {
        await loadPlansAndFeesTab(tabContent);
      } else if (activeTab === 'matching') {
        await loadMatchingTab(tabContent);
      } else if (activeTab === 'reference-data') {
        await loadReferenceDataTab(tabContent);
      } else if (activeTab === 'audit-log') {
        await loadAuditLogTab(tabContent);
      }
    } catch (err: any) {
      tabContent.innerHTML = `
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 32px; text-align: center;">
          <p style="font-size: 14px; color: #DC2626; margin: 0 0 16px;">Failed to load data: ${escapeHtml(err.message || 'Unknown error')}</p>
          <button id="admin-tab-retry" style="background: #2F7BE5; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Retry
          </button>
        </div>
      `;
      container.querySelector('#admin-tab-retry')?.addEventListener('click', loadTabContent);
    }
  }

  loadTabContent();
}

/**
 * 1. Feedback Review Tab
 */
async function loadFeedbackTab(container: HTMLElement, modalContainer: HTMLElement): Promise<void> {
  const items: AdminFeedbackItem[] = await adminGetFeedback();

  container.innerHTML = `
    <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
      <div style="padding: 16px 20px; border-bottom: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <label style="font-size: 13px; color: #64748B;">Filter by status:</label>
          <select id="fb-status-filter" style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 6px 10px; font-size: 13px; background: #FFFFFF; color: #0F172A;">
            <option value="all">All statuses (${items.length})</option>
            <option value="new">New</option>
            <option value="seen">Seen</option>
            <option value="planned">Planned</option>
            <option value="fixed">Fixed</option>
            <option value="wont_fix">Won't fix</option>
          </select>
        </div>
        <button id="fb-export-csv" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #0F172A; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          Export CSV
        </button>
      </div>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: #F8FAFC; border-bottom: 1px solid #E5E7EB; color: #64748B;">
              <th style="padding: 12px 16px; font-weight: 500;">Type</th>
              <th style="padding: 12px 16px; font-weight: 500;">Severity</th>
              <th style="padding: 12px 16px; font-weight: 500;">Message</th>
              <th style="padding: 12px 16px; font-weight: 500;">Author</th>
              <th style="padding: 12px 16px; font-weight: 500;">Route</th>
              <th style="padding: 12px 16px; font-weight: 500;">Status</th>
              <th style="padding: 12px 16px; font-weight: 500;">Date</th>
              <th style="padding: 12px 16px; font-weight: 500; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody id="fb-table-body">
            ${renderFeedbackRows(items)}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Status Filter Listener
  const filterSelect = container.querySelector<HTMLSelectElement>('#fb-status-filter')!;
  filterSelect.addEventListener('change', () => {
    const val = filterSelect.value;
    const filtered = val === 'all' ? items : items.filter(it => it.status === val);
    const tbody = container.querySelector('#fb-table-body')!;
    tbody.innerHTML = renderFeedbackRows(filtered);
    bindFeedbackRowActions(tbody, items, modalContainer);
  });

  // Export CSV
  container.querySelector('#fb-export-csv')?.addEventListener('click', () => {
    exportFeedbackCsv(items);
  });

  const tbody = container.querySelector('#fb-table-body')!;
  bindFeedbackRowActions(tbody, items, modalContainer);
}

function renderFeedbackRows(items: AdminFeedbackItem[]): string {
  if (items.length === 0) {
    return `
      <tr>
        <td colspan="8" style="padding: 32px; text-align: center; color: #64748B;">
          No feedback reports found.
        </td>
      </tr>
    `;
  }

  return items.map(item => `
    <tr style="border-bottom: 1px solid #E5E7EB; color: #0F172A;">
      <td style="padding: 12px 16px;">
        <span style="background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 11px; text-transform: capitalize;">
          ${escapeHtml(item.type)}
        </span>
      </td>
      <td style="padding: 12px 16px;">
        <span style="color: ${item.severity === 'blocker' ? '#DC2626' : item.severity === 'annoying' ? '#D97706' : '#475569'}; font-weight: 500; font-size: 12px; text-transform: capitalize;">
          ${escapeHtml(item.severity)}
        </span>
      </td>
      <td style="padding: 12px 16px; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
        ${escapeHtml(item.message)}
      </td>
      <td style="padding: 12px 16px; color: #64748B; font-size: 12px;">
        ${escapeHtml(item.author_name || item.author_email || 'Anonymous')}
      </td>
      <td style="padding: 12px 16px; color: #64748B; font-family: monospace; font-size: 11px;">
        ${escapeHtml(item.context?.route || '/')}
      </td>
      <td style="padding: 12px 16px;">
        <span style="background: ${item.status === 'new' ? '#EFF6FF' : item.status === 'fixed' ? '#F0FDF4' : '#F1F5F9'}; color: ${item.status === 'new' ? '#2F7BE5' : item.status === 'fixed' ? '#16A34A' : '#475569'}; padding: 2px 6px; border-radius: 4px; font-size: 11px; text-transform: capitalize; font-weight: 500;">
          ${escapeHtml(item.status)}
        </span>
      </td>
      <td style="padding: 12px 16px; color: #64748B; font-size: 12px;">
        ${new Date(item.created_at).toLocaleDateString()}
      </td>
      <td style="padding: 12px 16px; text-align: right;">
        <button class="fb-view-btn" data-id="${item.id}" style="background: none; border: 1px solid #E5E7EB; color: #2F7BE5; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
          Inspect
        </button>
      </td>
    </tr>
  `).join('');
}

function bindFeedbackRowActions(tbody: Element, allItems: AdminFeedbackItem[], modalContainer: HTMLElement): void {
  tbody.querySelectorAll<HTMLButtonElement>('.fb-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = allItems.find(i => i.id === id);
      if (item) {
        showFeedbackDetailModal(item, modalContainer, () => {
          // Refresh list on update
          loadFeedbackTab(tbody.closest('.admin-tab-content') || (tbody.parentElement as any), modalContainer);
        });
      }
    });
  });
}

function showFeedbackDetailModal(item: AdminFeedbackItem, container: HTMLElement, onUpdate: () => void): void {
  container.style.display = 'block';
  container.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div style="background: #FFFFFF; border-radius: 8px; max-width: 680px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px; box-sizing: border-box; font-family: Inter, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #E5E7EB; padding-bottom: 12px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Feedback inspection</h2>
            <div style="font-size: 12px; color: #64748B;">Reported by ${escapeHtml(item.author_name || item.author_email || 'Anonymous')} on ${new Date(item.created_at).toLocaleString()}</div>
          </div>
          <button id="fb-modal-close" style="background: none; border: none; font-size: 20px; color: #64748B; cursor: pointer;">&times;</button>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">User message:</label>
          <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; font-size: 14px; color: #0F172A; white-space: pre-wrap; line-height: 1.5;">
            ${escapeHtml(item.message)}
          </div>
        </div>

        ${item.screenshot_path ? `
          <div style="margin-bottom: 16px;">
            <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Attachment:</label>
            <a href="${item.screenshot_path}" target="_blank" rel="noopener noreferrer" style="color: #2F7BE5; font-size: 13px; text-decoration: underline;">
              View uploaded attachment
            </a>
          </div>
        ` : ''}

        <div style="margin-bottom: 16px;">
          <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Diagnostic context:</label>
          <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 11px; color: #334155; max-height: 140px; overflow-y: auto;">
            <pre style="margin: 0;">${escapeHtml(JSON.stringify(item.context, null, 2))}</pre>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Update status & notes:</label>
          <div style="display: grid; grid-template-columns: 140px 1fr; gap: 10px; margin-bottom: 8px;">
            <select id="fb-modal-status" style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px; font-size: 13px; background: #FFFFFF;">
              <option value="new" ${item.status === 'new' ? 'selected' : ''}>New</option>
              <option value="seen" ${item.status === 'seen' ? 'selected' : ''}>Seen</option>
              <option value="planned" ${item.status === 'planned' ? 'selected' : ''}>Planned</option>
              <option value="fixed" ${item.status === 'fixed' ? 'selected' : ''}>Fixed</option>
              <option value="wont_fix" ${item.status === 'wont_fix' ? 'selected' : ''}>Won't fix</option>
            </select>
            <input type="text" id="fb-modal-notes" placeholder="Internal administrator note..." value="${escapeHtml(item.admin_notes || '')}" style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; font-size: 13px;" />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="fb-modal-cancel" style="background: none; border: 1px solid #E5E7EB; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer;">
            Close
          </button>
          <button id="fb-modal-save" style="background: #2F7BE5; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Save changes
          </button>
        </div>
      </div>
    </div>
  `;

  const close = () => { container.style.display = 'none'; container.innerHTML = ''; };
  container.querySelector('#fb-modal-close')?.addEventListener('click', close);
  container.querySelector('#fb-modal-cancel')?.addEventListener('click', close);

  container.querySelector('#fb-modal-save')?.addEventListener('click', async () => {
    const newStatus = (container.querySelector('#fb-modal-status') as HTMLSelectElement).value;
    const notes = (container.querySelector('#fb-modal-notes') as HTMLInputElement).value;
    try {
      await adminUpdateFeedbackStatus(item.id, newStatus, notes);
      item.status = newStatus as any;
      item.admin_notes = notes;
      close();
      onUpdate();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  });
}

function exportFeedbackCsv(items: AdminFeedbackItem[]): void {
  const headers = ['ID', 'Type', 'Severity', 'Status', 'Author', 'Message', 'Route', 'Created At', 'Admin Notes'];
  const rows = items.map(it => [
    it.id,
    it.type,
    it.severity,
    it.status,
    it.author_name || it.author_email || 'Anonymous',
    `"${(it.message || '').replace(/"/g, '""')}"`,
    it.context?.route || '/',
    it.created_at,
    `"${(it.admin_notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `dezignet-feedback-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * 2. Pending Credentials Tab
 */
async function loadCredentialsTab(container: HTMLElement, modalContainer: HTMLElement): Promise<void> {
  const list: AdminPendingCredential[] = await adminGetPendingCredentials();

  if (list.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px; text-align: center;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">No pending credentials</h3>
        <p style="font-size: 14px; color: #64748B; margin: 0;">All professional license submissions (AIA / NCARB / State Boards) have been reviewed.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E5E7EB; color: #64748B;">
            <th style="padding: 12px 16px; font-weight: 500;">Designer</th>
            <th style="padding: 12px 16px; font-weight: 500;">Professional body</th>
            <th style="padding: 12px 16px; font-weight: 500;">License number</th>
            <th style="padding: 12px 16px; font-weight: 500;">State / Region</th>
            <th style="padding: 12px 16px; font-weight: 500;">Year</th>
            <th style="padding: 12px 16px; font-weight: 500;">Submitted</th>
            <th style="padding: 12px 16px; font-weight: 500; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(c => `
            <tr style="border-bottom: 1px solid #E5E7EB; color: #0F172A;">
              <td style="padding: 12px 16px;">
                <div style="font-weight: 500;">${escapeHtml(c.designer_name)}</div>
                <div style="font-size: 12px; color: #64748B;">${escapeHtml(c.designer_email)}</div>
              </td>
              <td style="padding: 12px 16px; font-weight: 500;">${escapeHtml(c.body_name)}</td>
              <td style="padding: 12px 16px; font-family: monospace;">${escapeHtml(c.license_number)}</td>
              <td style="padding: 12px 16px;">${escapeHtml(c.state_region || 'N/A')}</td>
              <td style="padding: 12px 16px;">${c.verification_year}</td>
              <td style="padding: 12px 16px; color: #64748B; font-size: 12px;">${new Date(c.submitted_at).toLocaleDateString()}</td>
              <td style="padding: 12px 16px; text-align: right;">
                <button class="cred-review-btn" data-id="${c.id}" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                  Review
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll<HTMLButtonElement>('.cred-review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const cred = list.find(c => c.id === id);
      if (cred) {
        showCredentialReviewModal(cred, modalContainer, () => loadCredentialsTab(container, modalContainer));
      }
    });
  });
}

function showCredentialReviewModal(cred: AdminPendingCredential, container: HTMLElement, onDone: () => void): void {
  container.style.display = 'block';
  container.innerHTML = `
    <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px;">
      <div style="background: #FFFFFF; border-radius: 8px; max-width: 580px; width: 100%; padding: 24px; box-sizing: border-box; font-family: Inter, sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #E5E7EB; padding-bottom: 12px;">
          <div>
            <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Verify professional credential</h2>
            <div style="font-size: 13px; color: #64748B;">${escapeHtml(cred.designer_name)} (${escapeHtml(cred.designer_email)})</div>
          </div>
          <button id="cred-modal-close" style="background: none; border: none; font-size: 20px; color: #64748B; cursor: pointer;">&times;</button>
        </div>

        <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px; margin-bottom: 16px; font-size: 13px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div><strong style="color: #475569;">Governing body:</strong><br />${escapeHtml(cred.body_name)}</div>
          <div><strong style="color: #475569;">License / Reg no:</strong><br /><code>${escapeHtml(cred.license_number)}</code></div>
          <div><strong style="color: #475569;">State / Region:</strong><br />${escapeHtml(cred.state_region || 'N/A')}</div>
          <div><strong style="color: #475569;">Verification year:</strong><br />${cred.verification_year}</div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">Certificate document:</label>
          ${cred.certificate_path ? `
            <a href="${cred.certificate_path}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 8px 12px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; color: #2F7BE5; font-size: 13px; text-decoration: none;">
              Open license certificate document &rarr;
            </a>
          ` : '<span style="font-size: 13px; color: #64748B;">No document attached</span>'}
        </div>

        <div id="cred-reject-box" style="display: none; margin-bottom: 16px;">
          <label style="font-size: 12px; font-weight: 600; color: #DC2626; display: block; margin-bottom: 4px;">Rejection reason (sent to designer):</label>
          <input type="text" id="cred-reject-reason" placeholder="e.g. License expired or registration number not verifiable with NCARB or state licensing board" style="width: 100%; box-sizing: border-box; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; font-size: 13px;" />
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="cred-action-reject" style="background: none; border: 1px solid #DC2626; color: #DC2626; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Reject
          </button>
          <button id="cred-action-approve" style="background: #16A34A; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Approve & verify
          </button>
        </div>
      </div>
    </div>
  `;

  const close = () => { container.style.display = 'none'; container.innerHTML = ''; };
  container.querySelector('#cred-modal-close')?.addEventListener('click', close);

  let isRejectMode = false;
  const rejectBtn = container.querySelector<HTMLButtonElement>('#cred-action-reject')!;
  const rejectBox = container.querySelector<HTMLDivElement>('#cred-reject-box')!;

  rejectBtn.addEventListener('click', async () => {
    if (!isRejectMode) {
      isRejectMode = true;
      rejectBox.style.display = 'block';
      rejectBtn.textContent = 'Confirm rejection';
      return;
    }

    const reason = (container.querySelector('#cred-reject-reason') as HTMLInputElement).value.trim();
    if (!reason) {
      alert('Please enter a rejection reason.');
      return;
    }

    try {
      await adminReviewCredential(cred.id, 'rejected', reason);
      close();
      onDone();
    } catch (err: any) {
      alert('Failed to reject credential: ' + err.message);
    }
  });

  container.querySelector('#cred-action-approve')?.addEventListener('click', async () => {
    if (confirm(`Approve professional license for ${cred.designer_name}?`)) {
      try {
        await adminReviewCredential(cred.id, 'approved');
        close();
        onDone();
      } catch (err: any) {
        alert('Failed to approve credential: ' + err.message);
      }
    }
  });
}

/**
 * 3. Membership Plans & Fee Tiers Tab
 */
async function loadPlansAndFeesTab(container: HTMLElement): Promise<void> {
  const plans: Plan[] = await adminGetPlans();
  const feeTiers: PlanFeeTier[] = await adminGetFeeTiers();
  const settings: AdminMatchingSettings = await adminGetMatchingSettings();

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px; font-family: Inter, sans-serif;">
      <!-- Header Banner -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px;">
        <h2 style="font-size: 17px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">Membership Plans & Platform Fee Tiers</h2>
        <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.5;">
          Configure designer membership tiers, prices in cents, proposal limits (5, 10, or unlimited null), feature entitlement flags, and platform commission brackets. Changes are audited in real time.
        </p>
      </div>

      <!-- Part A: Subscription Plans & Feature Flags Editor -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Membership Plans Editor</h3>
          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Prices are saved in integer cents (e.g., $29.99 = 2999 cents). Proposal limits can be 5, 10, or null for unlimited.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
          ${plans.map(p => `
            <div class="plan-card-box" data-plan-key="${p.key}" style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #E2E8F0; padding-bottom: 12px;">
                  <div>
                    <h4 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 2px;">${escapeHtml(p.name)} Plan</h4>
                    <span style="font-size: 11px; font-family: monospace; color: #64748B;">key: ${p.key}</span>
                  </div>
                  <span style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #334155; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                    Sort ${p.sort_order}
                  </span>
                </div>

                <!-- Price inputs in cents -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
                  <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #475569; margin-bottom: 4px;">Monthly Price (cents)</label>
                    <input type="number" class="input-monthly-cents" value="${p.monthly_price_cents}" min="0" style="width: 100%; box-sizing: border-box; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 10px; font-size: 13px; background: #FFFFFF;" />
                    <span class="preview-monthly-dollars" style="font-size: 11px; color: #64748B; margin-top: 2px; display: block;">
                      = $${(p.monthly_price_cents / 100).toFixed(2)}/mo
                    </span>
                  </div>
                  <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #475569; margin-bottom: 4px;">Yearly Price (cents)</label>
                    <input type="number" class="input-yearly-cents" value="${p.yearly_price_cents}" min="0" style="width: 100%; box-sizing: border-box; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 10px; font-size: 13px; background: #FFFFFF;" />
                    <span class="preview-yearly-dollars" style="font-size: 11px; color: #64748B; margin-top: 2px; display: block;">
                      = $${(p.yearly_price_cents / 100).toFixed(2)}/yr
                    </span>
                  </div>
                </div>

                <!-- Proposal Limit & Portfolio Images -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                  <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #475569; margin-bottom: 4px;">Proposal Limit / mo</label>
                    <select class="select-proposal-limit" style="width: 100%; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 8px; font-size: 13px; background: #FFFFFF;">
                      <option value="5" ${p.monthly_proposal_limit === 5 ? 'selected' : ''}>5 proposals (Free)</option>
                      <option value="10" ${p.monthly_proposal_limit === 10 ? 'selected' : ''}>10 proposals (Basic)</option>
                      <option value="null" ${p.monthly_proposal_limit === null ? 'selected' : ''}>Unlimited (null)</option>
                      <option value="custom" ${p.monthly_proposal_limit !== 5 && p.monthly_proposal_limit !== 10 && p.monthly_proposal_limit !== null ? 'selected' : ''}>Custom limit...</option>
                    </select>
                    <input type="number" class="input-custom-limit" value="${p.monthly_proposal_limit ?? ''}" placeholder="Custom count" style="width: 100%; box-sizing: border-box; border: 1px solid #CBD5E1; border-radius: 6px; padding: 4px 8px; font-size: 12px; margin-top: 4px; display: ${p.monthly_proposal_limit !== 5 && p.monthly_proposal_limit !== 10 && p.monthly_proposal_limit !== null ? 'block' : 'none'}; background: #FFFFFF;" />
                  </div>
                  <div>
                    <label style="display: block; font-size: 12px; font-weight: 500; color: #475569; margin-bottom: 4px;">Portfolio Images</label>
                    <input type="number" class="input-portfolio-images" value="${p.images_per_portfolio_project}" min="0" style="width: 100%; box-sizing: border-box; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 10px; font-size: 13px; background: #FFFFFF;" />
                    <span style="font-size: 11px; color: #64748B; margin-top: 2px; display: block;">Per project cap</span>
                  </div>
                </div>

                <!-- Feature Flags Checklist -->
                <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px 14px; margin-bottom: 16px;">
                  <div style="font-size: 11px; font-weight: 600; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Feature Entitlements</div>
                  <div style="display: flex; flex-direction: column; gap: 7px; font-size: 12.5px; color: #334155;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-directory_listing" ${p.directory_listing ? 'checked' : ''} />
                      <span>directory_listing (Talent directory)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-public_profile" ${p.public_profile ? 'checked' : ''} />
                      <span>public_profile (Public viewable profile)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-portfolio_enabled" ${p.portfolio_enabled ? 'checked' : ''} />
                      <span>portfolio_enabled (Showcases & photos)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-direct_invitations" ${p.direct_invitations ? 'checked' : ''} />
                      <span>direct_invitations (Direct client invites)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-verified_badge" ${p.verified_badge ? 'checked' : ''} />
                      <span>verified_badge (Verified AIA badge)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-studio_insights" ${p.studio_insights ? 'checked' : ''} />
                      <span>studio_insights (Analytics dashboard)</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                      <input type="checkbox" class="cb-studio_url" ${p.studio_url ? 'checked' : ''} />
                      <span>studio_url (Custom studio slug URL)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <div class="plan-feedback-msg" style="font-size: 12px; margin-bottom: 8px; display: none;"></div>
                <button type="button" class="btn-save-plan" data-plan-key="${p.key}" style="width: 100%; height: 36px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
                  Save ${escapeHtml(p.name)} Plan
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Part B: Platform Fee Calculation Mode & Basis -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <div style="margin-bottom: 16px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Platform Commission Mode & Basis</h3>
          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Determines how the database RPC and UI calculates platform commission fees across milestones.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
          <div>
            <label style="display: block; font-size: 12.5px; font-weight: 500; color: #475569; margin-bottom: 6px;">Tier Calculation Mode</label>
            <select id="fee-calc-mode" style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; font-size: 13px; background: #FFFFFF; color: #0F172A;">
              <option value="whole_amount" ${settings.fee_tier_mode === 'whole_amount' ? 'selected' : ''}>whole_amount (rate applies to entire milestone amount)</option>
              <option value="marginal" ${settings.fee_tier_mode === 'marginal' ? 'selected' : ''}>marginal (progressive bracket slices per threshold)</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 12.5px; font-weight: 500; color: #475569; margin-bottom: 6px;">Fee Basis</label>
            <select id="fee-calc-basis" style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; font-size: 13px; background: #FFFFFF; color: #0F172A;">
              <option value="per_milestone" ${settings.fee_basis === 'per_milestone' ? 'selected' : ''}>per_milestone (evaluated separately on each milestone)</option>
              <option value="cumulative" ${settings.fee_basis === 'cumulative' ? 'selected' : ''}>cumulative (evaluated against project cumulative total)</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
          <span id="fee-mode-save-msg" style="font-size: 12px; color: #16A34A; display: none;"></span>
          <button type="button" id="btn-save-fee-calc-settings" style="height: 34px; padding: 0 16px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Save calculation settings
          </button>
        </div>
      </div>

      <!-- Part C: Fee Tiers Editor per Plan -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Tiered Commission Fee Schedules</h3>
          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Schedule rules: base tier must start at 0 cents ($0), thresholds must be strictly ascending, and commission rates must be between 0.0% and 100.0%.
          </p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 24px;">
          ${plans.map(p => {
            const pTiers = feeTiers
              .filter(t => t.plan_key === p.key)
              .sort((a, b) => a.from_amount_cents - b.from_amount_cents);
            const scheduleDesc = getTieredScheduleDescription(p.key, pTiers);

            return `
              <div class="tier-editor-box" data-plan-key="${p.key}" style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; background: #F8FAFC;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <h4 style="font-size: 15px; font-weight: 600; color: #0F172A; margin: 0;">${escapeHtml(p.name)} Plan Commission Tiers</h4>
                    <div class="tier-schedule-text" style="font-size: 12.5px; color: #2F7BE5; font-weight: 500; margin-top: 2px;">
                      Schedule: "${escapeHtml(scheduleDesc)}"
                    </div>
                  </div>
                  <button type="button" class="btn-add-tier-row" data-plan-key="${p.key}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #0F172A; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                    + Add tier threshold
                  </button>
                </div>

                <div class="tier-error-banner" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; border-radius: 6px; padding: 8px 12px; font-size: 12px; margin-bottom: 12px;"></div>

                <div style="overflow-x: auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; margin-bottom: 14px;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                    <thead>
                      <tr style="background: #F1F5F9; border-bottom: 1px solid #E5E7EB; color: #64748B;">
                        <th style="padding: 10px 14px; width: 40px; font-weight: 500;">#</th>
                        <th style="padding: 10px 14px; font-weight: 500;">Threshold Amount ($ USD)</th>
                        <th style="padding: 10px 14px; font-weight: 500;">Threshold Amount (Cents)</th>
                        <th style="padding: 10px 14px; width: 160px; font-weight: 500;">Commission Rate (%)</th>
                        <th style="padding: 10px 14px; width: 90px; text-align: right; font-weight: 500;">Action</th>
                      </tr>
                    </thead>
                    <tbody class="tier-rows-tbody" data-plan-key="${p.key}">
                      ${pTiers.map((t, idx) => `
                        <tr class="tier-row" style="border-bottom: 1px solid #E5E7EB;">
                          <td style="padding: 8px 14px; color: #64748B;">${idx + 1}</td>
                          <td style="padding: 8px 14px;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                              <span style="color: #64748B;">$</span>
                              <input type="number" class="tier-input-dollars" value="${t.from_amount_cents / 100}" ${idx === 0 ? 'readonly disabled' : ''} min="0" step="500" style="width: 110px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; background: ${idx === 0 ? '#F1F5F9' : '#FFFFFF'};" />
                            </div>
                          </td>
                          <td style="padding: 8px 14px;">
                            <input type="number" class="tier-input-cents" value="${t.from_amount_cents}" ${idx === 0 ? 'readonly disabled' : ''} min="0" step="50000" style="width: 130px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; background: ${idx === 0 ? '#F1F5F9' : '#FFFFFF'};" />
                            <span style="font-size: 11px; color: #64748B; margin-left: 4px;">¢</span>
                          </td>
                          <td style="padding: 8px 14px;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                              <input type="number" class="tier-input-rate" value="${t.rate_percent}" min="0" max="100" step="0.25" style="width: 80px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; background: #FFFFFF;" />
                              <span style="color: #64748B;">%</span>
                            </div>
                          </td>
                          <td style="padding: 8px 14px; text-align: right;">
                            ${idx === 0 ? '<span style="color: #94A3B8; font-size: 11.5px;">Base tier</span>' : `
                              <button type="button" class="btn-delete-tier" style="background: none; border: 1px solid #E5E7EB; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
                                Remove
                              </button>
                            `}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

                <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
                  <span class="tier-save-feedback" style="font-size: 12px; color: #16A34A; display: none;"></span>
                  <button type="button" class="btn-save-plan-tiers" data-plan-key="${p.key}" style="height: 34px; padding: 0 16px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
                    Save ${escapeHtml(p.name)} Fee Tiers
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Bind Plans Editor Handlers
  container.querySelectorAll<HTMLDivElement>('.plan-card-box').forEach(card => {
    const planKey = card.getAttribute('data-plan-key')!;
    const monthlyInput = card.querySelector<HTMLInputElement>('.input-monthly-cents')!;
    const yearlyInput = card.querySelector<HTMLInputElement>('.input-yearly-cents')!;
    const monthlyPreview = card.querySelector<HTMLSpanElement>('.preview-monthly-dollars')!;
    const yearlyPreview = card.querySelector<HTMLSpanElement>('.preview-yearly-dollars')!;
    const limitSelect = card.querySelector<HTMLSelectElement>('.select-proposal-limit')!;
    const customLimitInput = card.querySelector<HTMLInputElement>('.input-custom-limit')!;
    const imagesInput = card.querySelector<HTMLInputElement>('.input-portfolio-images')!;
    const saveBtn = card.querySelector<HTMLButtonElement>('.btn-save-plan')!;
    const feedback = card.querySelector<HTMLDivElement>('.plan-feedback-msg')!;

    // Live preview updates
    monthlyInput.addEventListener('input', () => {
      const val = parseInt(monthlyInput.value, 10) || 0;
      monthlyPreview.textContent = `= $${(val / 100).toFixed(2)}/mo`;
    });

    yearlyInput.addEventListener('input', () => {
      const val = parseInt(yearlyInput.value, 10) || 0;
      yearlyPreview.textContent = `= $${(val / 100).toFixed(2)}/yr`;
    });

    limitSelect.addEventListener('change', () => {
      customLimitInput.style.display = limitSelect.value === 'custom' ? 'block' : 'none';
    });

    saveBtn.addEventListener('click', async () => {
      saveBtn.disabled = true;
      feedback.style.display = 'none';

      let limitVal: number | null = null;
      if (limitSelect.value === '5') limitVal = 5;
      else if (limitSelect.value === '10') limitVal = 10;
      else if (limitSelect.value === 'null') limitVal = null;
      else {
        const parsed = parseInt(customLimitInput.value, 10);
        limitVal = isNaN(parsed) ? null : parsed;
      }

      const updates: Partial<Plan> = {
        monthly_price_cents: parseInt(monthlyInput.value, 10) || 0,
        yearly_price_cents: parseInt(yearlyInput.value, 10) || 0,
        monthly_proposal_limit: limitVal,
        images_per_portfolio_project: parseInt(imagesInput.value, 10) || 0,
        directory_listing: card.querySelector<HTMLInputElement>('.cb-directory_listing')?.checked ?? false,
        public_profile: card.querySelector<HTMLInputElement>('.cb-public_profile')?.checked ?? false,
        portfolio_enabled: card.querySelector<HTMLInputElement>('.cb-portfolio_enabled')?.checked ?? false,
        direct_invitations: card.querySelector<HTMLInputElement>('.cb-direct_invitations')?.checked ?? false,
        verified_badge: card.querySelector<HTMLInputElement>('.cb-verified_badge')?.checked ?? false,
        studio_insights: card.querySelector<HTMLInputElement>('.cb-studio_insights')?.checked ?? false,
        studio_url: card.querySelector<HTMLInputElement>('.cb-studio_url')?.checked ?? false
      };

      try {
        await adminUpdatePlan(planKey, updates);
        feedback.style.color = '#16A34A';
        feedback.textContent = `Saved and recorded to audit log at ${new Date().toLocaleTimeString()}`;
        feedback.style.display = 'block';
      } catch (err: any) {
        feedback.style.color = '#DC2626';
        feedback.textContent = `Error: ${err.message}`;
        feedback.style.display = 'block';
      } finally {
        saveBtn.disabled = false;
      }
    });
  });

  // Bind Fee Calculation Settings Handler
  const btnSaveCalc = container.querySelector<HTMLButtonElement>('#btn-save-fee-calc-settings')!;
  const modeFeedback = container.querySelector<HTMLSpanElement>('#fee-mode-save-msg')!;
  btnSaveCalc?.addEventListener('click', async () => {
    const tierMode = (container.querySelector('#fee-calc-mode') as HTMLSelectElement).value as any;
    const feeBasis = (container.querySelector('#fee-calc-basis') as HTMLSelectElement).value as any;

    try {
      btnSaveCalc.disabled = true;
      await adminUpdateMatchingSettings({
        fee_tier_mode: tierMode,
        fee_basis: feeBasis
      });
      modeFeedback.textContent = `Saved and recorded to audit log at ${new Date().toLocaleTimeString()}`;
      modeFeedback.style.display = 'inline';
    } catch (err: any) {
      alert('Failed to save calculation mode: ' + err.message);
    } finally {
      btnSaveCalc.disabled = false;
    }
  });

  // Bind Fee Tiers Editor Handlers
  container.querySelectorAll<HTMLDivElement>('.tier-editor-box').forEach(box => {
    const planKey = box.getAttribute('data-plan-key') as 'free' | 'basic' | 'upgraded';
    const tbody = box.querySelector<HTMLTableSectionElement>('.tier-rows-tbody')!;
    const btnAdd = box.querySelector<HTMLButtonElement>('.btn-add-tier-row')!;
    const btnSave = box.querySelector<HTMLButtonElement>('.btn-save-plan-tiers')!;
    const errorBanner = box.querySelector<HTMLDivElement>('.tier-error-banner')!;
    const feedback = box.querySelector<HTMLSpanElement>('.tier-save-feedback')!;
    const scheduleDisplay = box.querySelector<HTMLDivElement>('.tier-schedule-text')!;

    // Helper to bind a single row's inputs & delete button
    function bindRow(row: HTMLTableRowElement) {
      const dolInput = row.querySelector<HTMLInputElement>('.tier-input-dollars');
      const centInput = row.querySelector<HTMLInputElement>('.tier-input-cents');
      const delBtn = row.querySelector<HTMLButtonElement>('.btn-delete-tier');

      dolInput?.addEventListener('input', () => {
        if (!centInput) return;
        const d = parseFloat(dolInput.value) || 0;
        centInput.value = String(Math.round(d * 100));
      });

      centInput?.addEventListener('input', () => {
        if (!dolInput) return;
        const c = parseInt(centInput.value, 10) || 0;
        dolInput.value = String(c / 100);
      });

      delBtn?.addEventListener('click', () => {
        row.remove();
        reindexRows();
      });
    }

    function reindexRows() {
      tbody.querySelectorAll<HTMLTableRowElement>('.tier-row').forEach((r, idx) => {
        const cell = r.querySelector('td');
        if (cell) cell.textContent = String(idx + 1);
      });
    }

    tbody.querySelectorAll<HTMLTableRowElement>('.tier-row').forEach(bindRow);

    // Add new tier threshold button
    btnAdd.addEventListener('click', () => {
      const rows = tbody.querySelectorAll<HTMLTableRowElement>('.tier-row');
      const lastRow = rows[rows.length - 1];
      const lastCents = lastRow ? parseInt((lastRow.querySelector('.tier-input-cents') as HTMLInputElement).value, 10) || 0 : 0;
      const lastRate = lastRow ? parseFloat((lastRow.querySelector('.tier-input-rate') as HTMLInputElement).value) || 5.0 : 5.0;

      const newCents = lastCents + 500000; // default +$5,000 threshold
      const newRate = Math.max(0.5, lastRate - 1.0); // default lower rate

      const tr = document.createElement('tr');
      tr.className = 'tier-row';
      tr.style.borderBottom = '1px solid #E5E7EB';
      tr.innerHTML = `
        <td style="padding: 8px 14px; color: #64748B;">${rows.length + 1}</td>
        <td style="padding: 8px 14px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="color: #64748B;">$</span>
            <input type="number" class="tier-input-dollars" value="${newCents / 100}" min="0" step="500" style="width: 110px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; background: #FFFFFF;" />
          </div>
        </td>
        <td style="padding: 8px 14px;">
          <input type="number" class="tier-input-cents" value="${newCents}" min="0" step="50000" style="width: 130px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; background: #FFFFFF;" />
          <span style="font-size: 11px; color: #64748B; margin-left: 4px;">¢</span>
        </td>
        <td style="padding: 8px 14px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" class="tier-input-rate" value="${newRate}" min="0" max="100" step="0.25" style="width: 80px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; background: #FFFFFF;" />
            <span style="color: #64748B;">%</span>
          </div>
        </td>
        <td style="padding: 8px 14px; text-align: right;">
          <button type="button" class="btn-delete-tier" style="background: none; border: 1px solid #E5E7EB; color: #DC2626; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
            Remove
          </button>
        </td>
      `;

      tbody.appendChild(tr);
      bindRow(tr);
    });

    // Save Fee Tiers Button
    btnSave.addEventListener('click', async () => {
      errorBanner.style.display = 'none';
      feedback.style.display = 'none';

      const rows = tbody.querySelectorAll<HTMLTableRowElement>('.tier-row');
      const parsedTiers: Array<{ from_amount_cents: number; rate_percent: number; sort_order: number }> = [];

      rows.forEach((r, idx) => {
        const cents = parseInt((r.querySelector('.tier-input-cents') as HTMLInputElement).value, 10) || 0;
        const rate = parseFloat((r.querySelector('.tier-input-rate') as HTMLInputElement).value) || 0;
        parsedTiers.push({
          from_amount_cents: cents,
          rate_percent: rate,
          sort_order: idx + 1
        });
      });

      // Validation check
      if (parsedTiers.length === 0 || parsedTiers[0].from_amount_cents !== 0) {
        errorBanner.textContent = 'Validation error: Base tier must start at 0 cents ($0 threshold).';
        errorBanner.style.display = 'block';
        return;
      }

      for (let i = 0; i < parsedTiers.length; i++) {
        const t = parsedTiers[i];
        if (t.rate_percent < 0 || t.rate_percent > 100) {
          errorBanner.textContent = `Validation error: Rate must be between 0% and 100% (found ${t.rate_percent}% on tier #${i + 1}).`;
          errorBanner.style.display = 'block';
          return;
        }
        if (i > 0 && t.from_amount_cents <= parsedTiers[i - 1].from_amount_cents) {
          errorBanner.textContent = `Validation error: Thresholds must be strictly ascending (tier #${i + 1} at $${t.from_amount_cents / 100} is not greater than tier #${i} at $${parsedTiers[i - 1].from_amount_cents / 100}).`;
          errorBanner.style.display = 'block';
          return;
        }
      }

      try {
        btnSave.disabled = true;
        const saved = await adminUpdateFeeTiers(planKey, parsedTiers);
        const newDesc = getTieredScheduleDescription(planKey, saved);
        scheduleDisplay.textContent = `Schedule: "${newDesc}"`;

        feedback.textContent = `Saved and recorded in audit log at ${new Date().toLocaleTimeString()}`;
        feedback.style.display = 'inline';
      } catch (err: any) {
        errorBanner.textContent = err.message || 'Failed to save fee tiers.';
        errorBanner.style.display = 'block';
      } finally {
        btnSave.disabled = false;
      }
    });
  });
}

/**
 * 4. Matching Engine Settings & Suggestion Tester Tab
 */
async function loadMatchingTab(container: HTMLElement): Promise<void> {
  const settings: AdminMatchingSettings = await adminGetMatchingSettings();
  const openProjects: Project[] = await getProjects();

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 24px; font-family: Inter, sans-serif;">
      <!-- Banner -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px;">
        <h2 style="font-size: 17px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">Matching Engine & Suggestion Tester</h2>
        <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.5;">
          Configure matching algorithm scoring weights, plan priority boosts, state licensure gates, and run live simulation tests against open projects to preview the top 20 candidate rankings.
        </p>
      </div>

      <!-- Section 1: Matching Settings Editor -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <div style="margin-bottom: 20px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Matching Engine Weights & Boosts</h3>
          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Adjust relative score weighting criteria (0-100 pts) and plan promotion priority.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 20px;">
          <!-- Scoring Weights Card -->
          <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px;">
            <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Scoring Weights (matching_weights)</div>
            
            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Specialization match:</label>
                <input type="number" id="mw-specialization" value="${settings.matching_weights.specialization_match}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Subcategory portfolio (ea):</label>
                <input type="number" id="mw-portfolio" value="${settings.matching_weights.subcategory_portfolio}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">State license match:</label>
                <input type="number" id="mw-license" value="${settings.matching_weights.state_license}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Same city bonus:</label>
                <input type="number" id="mw-city" value="${settings.matching_weights.same_city}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Same state bonus:</label>
                <input type="number" id="mw-state" value="${settings.matching_weights.same_state}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Verified credential badge:</label>
                <input type="number" id="mw-verified" value="${settings.matching_weights.verified}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Rating & client reviews:</label>
                <input type="number" id="mw-rating" value="${settings.matching_weights.rating}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label style="color: #334155;">Completed projects:</label>
                <input type="number" id="mw-completed" value="${settings.matching_weights.completed_projects}" min="0" max="100" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
              </div>
            </div>
          </div>

          <!-- Plan Boosts & Engine Rules Card -->
          <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Plan Boosts (matching_plan_boost)</div>
              
              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="color: #334155;">Free plan boost:</label>
                  <input type="number" id="mb-free" value="${settings.matching_plan_boost.free}" min="0" max="50" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="color: #334155;">Basic plan boost:</label>
                  <input type="number" id="mb-basic" value="${settings.matching_plan_boost.basic}" min="0" max="50" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label style="color: #334155;">Upgraded plan boost:</label>
                  <input type="number" id="mb-upgraded" value="${settings.matching_plan_boost.upgraded}" min="0" max="50" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #E2E8F0; padding-top: 8px;">
                  <label style="color: #334155;">New designer boost (<90d):</label>
                  <input type="number" id="mb-new-designer" value="${settings.matching_new_designer_boost}" min="0" max="50" style="width: 70px; border: 1px solid #CBD5E1; border-radius: 4px; padding: 4px 8px; font-size: 13px; text-align: right;" />
                </div>
              </div>

              <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Engine Filters & Display Mode</div>
              <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                  <input type="checkbox" id="mb-require-state-license" ${settings.matching_require_state_license ? 'checked' : ''} />
                  <span>Require verified state license (hard exclusion filter)</span>
                </label>
                <div>
                  <label style="display: block; font-size: 12px; color: #475569; margin-bottom: 4px;">Priority Label Mode</label>
                  <select id="mb-priority-label-mode" style="width: 100%; border: 1px solid #CBD5E1; border-radius: 6px; padding: 6px 10px; font-size: 13px; background: #FFFFFF;">
                    <option value="label" ${settings.priority_label_mode === 'label' ? 'selected' : ''}>label (display "Promoted" priority label to client)</option>
                    <option value="hidden" ${settings.priority_label_mode === 'hidden' ? 'selected' : ''}>hidden (algorithm boost without visual badge)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px;">
          <span id="matching-save-msg" style="font-size: 12px; color: #16A34A; display: none;"></span>
          <button type="button" id="btn-save-matching-settings" style="height: 36px; padding: 0 20px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Save Matching Settings
          </button>
        </div>
      </div>

      <!-- Section 2: Read-Only Suggestion Tester -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <div style="margin-bottom: 18px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Suggestion Tester (Read-Only Preview)</h3>
          <p style="font-size: 13px; color: #64748B; margin: 0;">
            Select an open architectural project from the platform to simulate the matching engine and preview the top 20 suggested designers with scores, breakdown reasons, and plan boosts.
          </p>
        </div>

        <!-- Project Selector Dropdown -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 280px;">
            <select id="admin-tester-project-select" style="width: 100%; border: 1px solid #CBD5E1; border-radius: 6px; padding: 8px 12px; font-size: 13px; background: #FFFFFF; color: #0F172A;">
              <option value="">-- Select an open project to test suggestions --</option>
              ${openProjects.map(proj => `
                <option value="${proj.id}">
                  ${escapeHtml(proj.title)} (${escapeHtml(proj.category || 'General')} - ${escapeHtml(proj.location || proj.city || 'US')}) - Budget ${formatMoney(proj.budget || 0)}
                </option>
              `).join('')}
            </select>
          </div>
          <button type="button" id="btn-run-tester-preview" style="height: 38px; padding: 0 18px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer;">
            Test Suggestions
          </button>
        </div>

        <!-- Suggestion Results Table Container -->
        <div id="admin-tester-results-container">
          <div style="border: 1px dashed #E2E8F0; border-radius: 6px; padding: 40px; text-align: center; color: #64748B; font-size: 13.5px;">
            Choose an open project above and click "Test Suggestions" to preview candidate rankings.
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind Matching Settings Save
  const btnSaveSettings = container.querySelector<HTMLButtonElement>('#btn-save-matching-settings')!;
  const saveMsg = container.querySelector<HTMLSpanElement>('#matching-save-msg')!;

  btnSaveSettings?.addEventListener('click', async () => {
    try {
      btnSaveSettings.disabled = true;
      saveMsg.style.display = 'none';

      const updatedSettings: Partial<AdminMatchingSettings> = {
        matching_weights: {
          specialization_match: parseInt((container.querySelector('#mw-specialization') as HTMLInputElement).value, 10) || 0,
          subcategory_portfolio: parseInt((container.querySelector('#mw-portfolio') as HTMLInputElement).value, 10) || 0,
          state_license: parseInt((container.querySelector('#mw-license') as HTMLInputElement).value, 10) || 0,
          same_city: parseInt((container.querySelector('#mw-city') as HTMLInputElement).value, 10) || 0,
          same_state: parseInt((container.querySelector('#mw-state') as HTMLInputElement).value, 10) || 0,
          verified: parseInt((container.querySelector('#mw-verified') as HTMLInputElement).value, 10) || 0,
          rating: parseInt((container.querySelector('#mw-rating') as HTMLInputElement).value, 10) || 0,
          completed_projects: parseInt((container.querySelector('#mw-completed') as HTMLInputElement).value, 10) || 0
        },
        matching_plan_boost: {
          free: parseInt((container.querySelector('#mb-free') as HTMLInputElement).value, 10) || 0,
          basic: parseInt((container.querySelector('#mb-basic') as HTMLInputElement).value, 10) || 0,
          upgraded: parseInt((container.querySelector('#mb-upgraded') as HTMLInputElement).value, 10) || 0
        },
        matching_new_designer_boost: parseInt((container.querySelector('#mb-new-designer') as HTMLInputElement).value, 10) || 0,
        matching_require_state_license: (container.querySelector('#mb-require-state-license') as HTMLInputElement).checked,
        priority_label_mode: (container.querySelector('#mb-priority-label-mode') as HTMLSelectElement).value as any
      };

      await adminUpdateMatchingSettings(updatedSettings);
      saveMsg.textContent = `Settings saved and audited at ${new Date().toLocaleTimeString()}`;
      saveMsg.style.display = 'inline';
    } catch (err: any) {
      alert('Failed to save matching settings: ' + err.message);
    } finally {
      btnSaveSettings.disabled = false;
    }
  });

  // Bind Suggestion Tester Preview
  const btnRunTester = container.querySelector<HTMLButtonElement>('#btn-run-tester-preview')!;
  const projectSelect = container.querySelector<HTMLSelectElement>('#admin-tester-project-select')!;
  const resultsContainer = container.querySelector<HTMLDivElement>('#admin-tester-results-container')!;

  btnRunTester?.addEventListener('click', async () => {
    const selectedProjectId = projectSelect.value;
    if (!selectedProjectId) {
      alert('Please select an open project from the dropdown first.');
      return;
    }

    resultsContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #64748B; font-size: 13.5px;">
        Running matching algorithm against candidate pool...
      </div>
    `;

    try {
      const topDesigners: AdminSuggestedDesigner[] = await adminTestSuggestions(selectedProjectId);
      const chosenProject = openProjects.find(p => p.id === selectedProjectId);

      if (topDesigners.length === 0) {
        resultsContainer.innerHTML = `
          <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 6px; padding: 32px; text-align: center;">
            <p style="font-size: 14px; font-weight: 500; color: #0F172A; margin: 0 0 4px;">No matching designers found</p>
            <p style="font-size: 12.5px; color: #64748B; margin: 0;">Try relaxing the state license requirement if enabled, or adjusting candidate pool filters.</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; background: #FFFFFF;">
          <div style="padding: 14px 18px; background: #F8FAFC; border-bottom: 1px solid #E5E7EB; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <span style="font-size: 13.5px; font-weight: 600; color: #0F172A;">Top ${topDesigners.length} Suggested Designers</span>
              <span style="font-size: 12px; color: #64748B; margin-left: 8px;">for "${escapeHtml(chosenProject?.title || 'Selected Project')}" (${escapeHtml(chosenProject?.category || 'General')})</span>
            </div>
            <span style="font-size: 11.5px; color: #475569; background: #FFFFFF; border: 1px solid #CBD5E1; padding: 2px 8px; border-radius: 4px;">
              Sorted by Match Score & Deterministic Rank
            </span>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12.5px; text-align: left;">
              <thead>
                <tr style="background: #F1F5F9; border-bottom: 1px solid #E5E7EB; color: #64748B;">
                  <th style="padding: 10px 14px; width: 40px; font-weight: 500;">Rank</th>
                  <th style="padding: 10px 14px; min-width: 200px; font-weight: 500;">Designer</th>
                  <th style="padding: 10px 14px; width: 140px; font-weight: 500;">Membership Plan</th>
                  <th style="padding: 10px 14px; width: 100px; font-weight: 500; text-align: right;">Total Score</th>
                  <th style="padding: 10px 14px; min-width: 320px; font-weight: 500;">Breakdown Reasons</th>
                  <th style="padding: 10px 14px; width: 140px; font-weight: 500;">Rating & Stats</th>
                </tr>
              </thead>
              <tbody>
                ${topDesigners.map((cand, idx) => `
                  <tr style="border-bottom: 1px solid #E5E7EB; color: #0F172A;">
                    <td style="padding: 12px 14px; font-weight: 600; color: #64748B;">
                      #${idx + 1}
                    </td>
                    <td style="padding: 12px 14px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${cand.avatar_path || '/assets/demo/avatar-sample.jpg'}" alt="" style="width: 34px; height: 34px; border-radius: 6px; object-fit: cover; border: 1px solid #E5E7EB;" />
                        <div>
                          <div style="font-weight: 600; color: #0F172A; font-size: 13px;">
                            ${escapeHtml(cand.full_name)}
                            ${cand.is_verified ? '<span style="color: #2F7BE5; font-size: 11px; margin-left: 4px; font-weight: 600;">[Verified]</span>' : ''}
                          </div>
                          <div style="font-size: 11.5px; color: #64748B;">
                            ${escapeHtml(cand.title || cand.discipline)} ${cand.studio_name ? '• ' + escapeHtml(cand.studio_name) : ''}
                          </div>
                          <div style="font-size: 11px; color: #94A3B8;">
                            ${escapeHtml(cand.city || '')}${cand.city && cand.state ? ', ' : ''}${escapeHtml(cand.state || '')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style="padding: 12px 14px;">
                      <span style="display: inline-block; background: ${cand.plan_key === 'upgraded' ? '#EFF6FF' : cand.plan_key === 'basic' ? '#F0FDF4' : '#F1F5F9'}; color: ${cand.plan_key === 'upgraded' ? '#2F7BE5' : cand.plan_key === 'basic' ? '#16A34A' : '#475569'}; border: 1px solid ${cand.plan_key === 'upgraded' ? '#BFDBFE' : cand.plan_key === 'basic' ? '#BBF7D0' : '#E2E8F0'}; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;">
                        ${cand.plan_key}
                      </span>
                      <div style="font-size: 11px; color: #64748B; margin-top: 3px;">
                        +${cand.plan_boost} plan boost
                      </div>
                    </td>
                    <td style="padding: 12px 14px; text-align: right;">
                      <span style="font-size: 16px; font-weight: 700; color: #0F172A;">
                        ${cand.match_score}
                      </span>
                      <span style="font-size: 11px; color: #64748B; display: block;">points</span>
                    </td>
                    <td style="padding: 12px 14px;">
                      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${cand.reasons.map(r => `
                          <span style="background: #F1F5F9; border: 1px solid #E2E8F0; color: #334155; font-size: 11px; padding: 2px 6px; border-radius: 4px;">
                            ${escapeHtml(r.text)}
                          </span>
                        `).join('')}
                      </div>
                    </td>
                    <td style="padding: 12px 14px; color: #475569; font-size: 12px;">
                      <div>${cand.rating_average > 0 ? `${cand.rating_average} rating (${cand.rating_count} reviews)` : 'New talent'}</div>
                      <div style="font-size: 11px; color: #64748B; margin-top: 2px;">${cand.completed_projects_count} completed • ${cand.years_experience} yrs exp</div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err: any) {
      resultsContainer.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #FCA5A5; color: #DC2626; border-radius: 6px; padding: 16px; font-size: 13px;">
          Failed to generate suggestion preview: ${escapeHtml(err.message || 'Unknown error')}
        </div>
      `;
    }
  });
}

/**
 * 5. Reference Data Tab (Categories, Subcategories, Phase Templates)
 */
async function loadReferenceDataTab(container: HTMLElement): Promise<void> {
  const categories: CategoryItem[] = await getCategories();

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">System categories & subcategories</h3>
        <p style="font-size: 13px; color: #64748B; margin: 0 0 20px;">
          Active project taxonomy editable by administrators. Standard seeds include Residential, Commercial, Institutional, Healthcare, and Industrial.
        </p>

        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${categories.map((cat: CategoryItem) => `
            <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px 18px; background: #F8FAFC;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 600; font-size: 14px; color: #0F172A;">${escapeHtml(cat.name)}</span>
                <span style="font-size: 12px; color: #64748B;">${cat.subcategories.length} subcategories</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${cat.subcategories.map((sub: { id?: string; name: string }) => `
                  <span style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #334155; font-size: 12px; padding: 3px 8px; border-radius: 4px;">
                    ${escapeHtml(sub.name)}
                  </span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Milestone phase schedule templates</h3>
        <p style="font-size: 13px; color: #64748B; margin: 0 0 16px;">
          Standard phase splits enforced by the system. Both 5-phase (standard) and 6-phase (with Site Feasibility) splits must total exactly 100%.
        </p>
        <div style="background: #F8FAFC; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; font-size: 13px; color: #334155; line-height: 1.6;">
          <div style="margin-bottom: 8px;"><strong>Standard 5-phase default (100%):</strong> Schematic Design (20%), Design Development (25%), Construction Documents (30%), Bidding & Permitting (15%), Construction Administration (10%).</div>
          <div><strong>Standard 6-phase with Pre-Design (100%):</strong> Pre-Design / Feasibility (10%), Schematic Design (15%), Design Development (25%), Construction Documents (25%), Bidding & Permitting (15%), Construction Administration (10%).</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 4. Audit Log Tab
 */
async function loadAuditLogTab(container: HTMLElement): Promise<void> {
  const logs: AdminAuditLogItem[] = await adminGetAuditLog();

  if (logs.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px; text-align: center;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">No audit logs yet</h3>
        <p style="font-size: 14px; color: #64748B; margin: 0;">Administrative actions will be permanently recorded here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
        <thead>
          <tr style="background: #F8FAFC; border-bottom: 1px solid #E5E7EB; color: #64748B;">
            <th style="padding: 12px 16px; font-weight: 500;">Timestamp</th>
            <th style="padding: 12px 16px; font-weight: 500;">Admin</th>
            <th style="padding: 12px 16px; font-weight: 500;">Action</th>
            <th style="padding: 12px 16px; font-weight: 500;">Target type</th>
            <th style="padding: 12px 16px; font-weight: 500;">Target ID</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr style="border-bottom: 1px solid #E5E7EB; color: #0F172A;">
              <td style="padding: 12px 16px; color: #64748B; font-size: 12px;">${new Date(log.created_at).toLocaleString()}</td>
              <td style="padding: 12px 16px; font-family: monospace; font-size: 11px;">${escapeHtml(log.admin_email || log.admin_id.slice(0, 8))}</td>
              <td style="padding: 12px 16px; font-weight: 500;">${escapeHtml(log.action)}</td>
              <td style="padding: 12px 16px;"><span style="background: #F1F5F9; color: #475569; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${escapeHtml(log.target_type)}</span></td>
              <td style="padding: 12px 16px; font-family: monospace; font-size: 11px; color: #64748B;">${escapeHtml(log.target_id || 'N/A')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
