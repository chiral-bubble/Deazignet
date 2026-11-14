/**
 * SupportSection.ts
 * Support Tickets Inbox: status filter, assignee management, internal administrative notes, and notifications.
 */

import {
  adminGetSupportTickets,
  adminUpdateSupportTicket,
  type SupportTicketItem
} from '../../services/adminConsoleService';

export async function renderSupportSection(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div style="padding: 24px 0;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 600; color: #0F172A; margin: 0 0 6px;">
            Support Helpdesk & Tickets
          </h2>
          <p style="font-size: 14px; color: #64748B; margin: 0;">
            Respond to user support inquiries, track ticket lifecycles, assign agents, and attach confidential internal notes.
          </p>
        </div>
        <button id="support-refresh-btn" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #475569; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
          Refresh Inbox
        </button>
      </div>

      <!-- Status Filter Tabs -->
      <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; gap: 8px;">
        <button class="support-filter-btn" data-status="open" style="background: #F1F5F9; border: 1px solid #CBD5E1; color: #0F172A; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          Open Tickets
        </button>
        <button class="support-filter-btn" data-status="in_progress" style="background: none; border: 1px solid transparent; color: #64748B; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          In Progress
        </button>
        <button class="support-filter-btn" data-status="resolved" style="background: none; border: 1px solid transparent; color: #64748B; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          Resolved
        </button>
        <button class="support-filter-btn" data-status="all" style="background: none; border: 1px solid transparent; color: #64748B; font-size: 13px; font-weight: 500; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
          All Tickets
        </button>
      </div>

      <!-- Tickets List Container -->
      <div id="support-tickets-container" style="display: flex; flex-direction: column; gap: 16px;">
        <div style="text-align: center; padding: 48px; color: #64748B;">Loading tickets...</div>
      </div>
    </div>
  `;

  let currentStatus = 'open';
  const refreshBtn = container.querySelector('#support-refresh-btn') as HTMLButtonElement;
  const filterBtns = container.querySelectorAll('.support-filter-btn');
  const ticketsContainer = container.querySelector('#support-tickets-container') as HTMLElement;

  async function loadTickets() {
    ticketsContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #64748B;">Loading tickets...</div>';
    try {
      const tickets: SupportTicketItem[] = await adminGetSupportTickets(currentStatus);

      if (tickets.length === 0) {
        ticketsContainer.innerHTML = `
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; text-align: center; padding: 48px; color: #64748B;">
            No support tickets in this view.
          </div>
        `;
        return;
      }

      ticketsContainer.innerHTML = tickets.map(t => `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #0F172A;">${t.subject}</h3>
                <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: ${t.status === 'open' ? '#FEE2E2; color: #DC2626;' : t.status === 'in_progress' ? '#FEF3C7; color: #D97706;' : '#DCFCE7; color: #15803D;'}">
                  ${t.status.replace('_', ' ')}
                </span>
              </div>
              <div style="font-size: 12px; color: #64748B;">
                From: <strong>${t.userName}</strong> (${t.userRole}) &bull; ${t.userEmail} &bull; ${new Date(t.createdAt).toLocaleString()}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <select class="tkt-status-select" data-id="${t.id}" style="padding: 5px 8px; font-size: 12px; border: 1px solid #CBD5E1; border-radius: 4px; background: #FFFFFF;">
                <option value="open" ${t.status === 'open' ? 'selected' : ''}>Open</option>
                <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="resolved" ${t.status === 'resolved' ? 'selected' : ''}>Resolved</option>
                <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>Closed</option>
              </select>
            </div>
          </div>

          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; margin-bottom: 14px; font-size: 13px; color: #334155; line-height: 1.5;">
            ${t.details}
          </div>

          <!-- Internal Admin Notes -->
          <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
            <div style="font-size: 11px; font-weight: 700; color: #B45309; text-transform: uppercase; margin-bottom: 4px;">Internal Staff Notes (Confidential)</div>
            <div style="font-size: 12px; color: #78350F; line-height: 1.4;">
              ${t.internalNotes ? t.internalNotes : '<em>No internal notes attached yet.</em>'}
            </div>
          </div>

          <!-- Actions Footer -->
          <div style="border-top: 1px solid #F1F5F9; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 12px; color: #64748B;">
              Assignee: <strong>${t.assigneeEmail || 'Unassigned'}</strong>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-assign-tkt" data-id="${t.id}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                Assign Agent
              </button>
              <button class="btn-note-tkt" data-id="${t.id}" data-notes="${t.internalNotes || ''}" style="background: #FFFFFF; border: 1px solid #CBD5E1; color: #2563EB; font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
                Add Internal Note
              </button>
            </div>
          </div>
        </div>
      `).join('');

      attachTicketEvents();
    } catch (err: any) {
      ticketsContainer.innerHTML = `<div style="text-align: center; padding: 48px; color: #DC2626;">Error: ${err.message}</div>`;
    }
  }

  function attachTicketEvents() {
    // Status change
    ticketsContainer.querySelectorAll('.tkt-status-select').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.getAttribute('data-id')!;
        const newStatus = (sel as HTMLSelectElement).value as any;
        await adminUpdateSupportTicket(id, { status: newStatus });
        await loadTickets();
      });
    });

    // Assign
    ticketsContainer.querySelectorAll('.btn-assign-tkt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const email = window.prompt('Enter support agent email to assign ticket:', 'support@dezignet.com');
        if (email === null) return;
        await adminUpdateSupportTicket(id, { assigneeEmail: email.trim() });
        await loadTickets();
      });
    });

    // Internal Note
    ticketsContainer.querySelectorAll('.btn-note-tkt').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')!;
        const currentNotes = btn.getAttribute('data-notes') || '';
        const notes = window.prompt('Enter internal administrative note:', currentNotes);
        if (notes === null) return;
        await adminUpdateSupportTicket(id, { internalNotes: notes.trim() });
        await loadTickets();
      });
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        (b as HTMLElement).style.background = 'none';
        (b as HTMLElement).style.color = '#64748B';
        (b as HTMLElement).style.borderColor = 'transparent';
      });
      (btn as HTMLElement).style.background = '#F1F5F9';
      (btn as HTMLElement).style.color = '#0F172A';
      (btn as HTMLElement).style.borderColor = '#CBD5E1';

      currentStatus = btn.getAttribute('data-status')!;
      loadTickets();
    });
  });

  refreshBtn.addEventListener('click', loadTickets);
  loadTickets();
}
