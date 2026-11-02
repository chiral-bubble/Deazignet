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
  adminGetAuditLog
} from '../../services/adminService';
import type {
  AdminFeedbackItem,
  AdminPendingCredential,
  AdminAuditLogItem
} from '../../services/adminService';
import { getCategories, type CategoryItem } from '../../services/projectsService';

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
        <nav style="display: flex; gap: 4px; border-bottom: 1px solid #E5E7EB; margin-bottom: 24px;">
          <button class="admin-tab-btn" data-tab="feedback" style="background: none; border: none; border-bottom: 2px solid #2F7BE5; color: #2F7BE5; font-size: 14px; font-weight: 600; padding: 10px 16px; cursor: pointer;">
            Tester feedback
          </button>
          <button class="admin-tab-btn" data-tab="credentials" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer;">
            Pending credentials
          </button>
          <button class="admin-tab-btn" data-tab="reference-data" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer;">
            Categories & templates
          </button>
          <button class="admin-tab-btn" data-tab="audit-log" style="background: none; border: none; border-bottom: 2px solid transparent; color: #64748B; font-size: 14px; font-weight: 500; padding: 10px 16px; cursor: pointer;">
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
  let activeTab: 'feedback' | 'credentials' | 'reference-data' | 'audit-log' = 'feedback';

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
 * 3. Reference Data Tab (Categories, Subcategories, Phase Templates)
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
