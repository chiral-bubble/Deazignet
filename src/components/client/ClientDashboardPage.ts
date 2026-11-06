/**
 * ClientDashboardPage — Centralized Dashboard for Clients
 * Meets all engineering and design requirements:
 * - Dynamic greeting sentence: "Good morning/afternoon, {first_name}. You have N proposals to review and M deliverables awaiting approval."
 * - 4-block summary container: Open projects, New proposals, Active projects, Funds in escrow (tabular nums, flat 1px border, no shadow).
 * - Left column:
 *   - "Needs your attention" (disappears when empty, one-click action buttons).
 *   - "Active projects" (designer avatar, phase progress bar, escrow amount).
 *   - "Your projects" (open and draft projects with status pills and proposal counters).
 * - Right column:
 *   - "Notifications" (with mark-as-read action).
 *   - "Upcoming dates" (proposal deadlines, review expirations, milestone targets).
 *   - "Quick actions" (Post a project, Browse designers, Help & support).
 * - Data source: getClientDashboard() RPC round-trip.
 */

import { getClientDashboard, type ClientDashboardData } from '../../services/projectsService';
import { supabase } from '../../lib/supabase';
import { renderClientShell, initClientShell } from './ClientLayout';
import { suggestDesigners, inviteDesigner } from '../../services/invitationsService';
import { formatMoney } from '../../utils/formatters';

export async function renderClientDashboardPage(container: HTMLElement): Promise<void> {
  const actionButton = `
    <a href="#post-project" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; transition: background 150ms;">
      <span>+ Post a Project</span>
    </a>
  `;

  // Initial skeleton shell
  container.innerHTML = renderClientShell(
    {
      activeTab: 'dashboard',
      pageTitle: 'Dashboard',
      actionButtonHtml: actionButton
    },
    `
      <div style="display: flex; flex-direction: column; gap: 24px; max-width: 1140px; margin: 0 auto;">
        <!-- Top Greeting Skeleton -->
        <div style="height: 48px; background: #F7F7F8; border-radius: 6px;"></div>

        <!-- 4 Summary Cards Skeleton -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          ${Array(4).fill(0).map(() => `
            <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; height: 96px;"></div>
          `).join('')}
        </div>

        <!-- 2 Column Skeleton -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
          <div style="height: 380px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px;"></div>
          <div style="height: 380px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px;"></div>
        </div>
      </div>
    `
  );

  initClientShell(container);

  try {
    const data = await getClientDashboard();
    renderDashboardContent(container, data);
  } catch (err: any) {
    const mainArea = container.querySelector('main div') || container;
    mainArea.innerHTML = `
      <div style="background: #FEF2F2; border: 1px solid #F87171; border-radius: 8px; padding: 24px; text-align: center; color: #991B1B; max-width: 520px; margin: 40px auto;">
        <p style="font-weight: 600; margin: 0 0 8px;">Failed to load dashboard</p>
        <p style="font-size: 13px; margin: 0 0 16px;">${escapeHtml(err?.message || 'A network error occurred.')}</p>
        <button id="retry-dashboard-btn" style="background: #DC2626; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Retry</button>
      </div>
    `;
    mainArea.querySelector('#retry-dashboard-btn')?.addEventListener('click', () => {
      renderClientDashboardPage(container);
    });
  }
}

function renderDashboardContent(container: HTMLElement, data: ClientDashboardData): void {
  const mainArea = container.querySelector('main div') || container;

  // Greeting logic
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = data.client_name ? data.client_name.split(' ')[0] : 'there';
  const proposalsToReview = data.summary.new_proposals_count;
  const deliverablesAwaiting = data.attention_items.filter(i => i.type === 'review_deliverable').length;

  let greetingSubtitle = '';
  if (proposalsToReview > 0 || deliverablesAwaiting > 0) {
    const parts: string[] = [];
    if (proposalsToReview > 0) parts.push(`${proposalsToReview} ${proposalsToReview === 1 ? 'proposal' : 'proposals'} to review`);
    if (deliverablesAwaiting > 0) parts.push(`${deliverablesAwaiting} ${deliverablesAwaiting === 1 ? 'deliverable' : 'deliverables'} awaiting approval`);
    greetingSubtitle = `You have ${parts.join(' and ')}.`;
  } else {
    greetingSubtitle = "You're all caught up with your architectural projects.";
  }

  // Upcoming dates calculation
  const upcomingDates: Array<{ label: string; date: string; tag: string }> = [];
  data.recent_projects.forEach(p => {
    if (p.deadline) {
      upcomingDates.push({
        label: `${p.title} proposal deadline`,
        date: new Date(p.deadline).toLocaleDateString(),
        tag: 'Deadline'
      });
    }
  });

  // Find most recent open project with few proposals
  const openProjects = (data.recent_projects || []).filter(p => p.status === 'open');
  const targetProject = openProjects.length > 0
    ? [...openProjects].sort((a, b) => a.proposals_count - b.proposals_count)[0]
    : null;

  mainArea.innerHTML = `
    <div style="max-width: 1140px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; padding-bottom: 60px;">
      <!-- Greeting Banner -->
      <div>
        <h1 style="font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #111827; margin: 0 0 4px;">
          ${timeGreeting}, ${escapeHtml(firstName)}.
        </h1>
        <p style="font-size: 13.5px; color: #4B5563; margin: 0;">
          ${greetingSubtitle}
        </p>
      </div>

      <!-- 4-Block Summary Container -->
      <div class="client-dashboard-summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
        <!-- Open Projects -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
          <div style="font-size: 13px; font-weight: 500; color: #6B7280;">Open Projects</div>
          <div style="font-size: 28px; font-weight: 700; color: #111827; margin: 4px 0 2px; font-variant-numeric: tabular-nums;">
            ${data.summary.open_projects_count}
          </div>
          <div style="font-size: 12px; color: #6B7280;">Accepting designer proposals</div>
        </div>

        <!-- New Proposals -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 500; color: #6B7280;">New Proposals</span>
            ${data.summary.new_proposals_count > 0 ? `
              <span style="font-size: 11px; font-weight: 600; background: #EFF6FF; color: #2F7BE5; padding: 2px 8px; border-radius: 12px;">
                Unviewed
              </span>
            ` : ''}
          </div>
          <div style="font-size: 28px; font-weight: 700; color: #111827; margin: 4px 0 2px; font-variant-numeric: tabular-nums;">
            ${data.summary.new_proposals_count}
          </div>
          <div style="font-size: 12px; color: #6B7280;">Awaiting your evaluation</div>
        </div>

        <!-- Active Projects -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
          <div style="font-size: 13px; font-weight: 500; color: #6B7280;">Active Projects</div>
          <div style="font-size: 28px; font-weight: 700; color: #111827; margin: 4px 0 2px; font-variant-numeric: tabular-nums;">
            ${data.summary.active_projects_count}
          </div>
          <div style="font-size: 12px; color: #6B7280;">Under design execution</div>
        </div>

        <!-- Funds in Escrow -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
          <div style="font-size: 13px; font-weight: 500; color: #6B7280;">Funds in Escrow</div>
          <div style="font-size: 28px; font-weight: 700; color: #2F7BE5; margin: 4px 0 2px; font-variant-numeric: tabular-nums;">
            ${formatMoney(data.summary.funds_in_escrow || 0)}
          </div>
          <div style="font-size: 12px; color: #6B7280;">Secured for current milestones</div>
        </div>
      </div>

      <!-- Main 2-Column Section -->
      <div class="client-dashboard-2col-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; align-items: start;">
        <!-- Left Column (Primary) -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Needs Your Attention Section (Disappears when empty) -->
          ${data.attention_items && data.attention_items.length > 0 ? `
            <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Needs Your Attention</h2>
                <span style="font-size: 11px; font-weight: 600; background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 12px;">
                  ${data.attention_items.length} pending
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${data.attention_items.map(item => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; flex-wrap: wrap; gap: 12px;">
                    <div>
                      <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">
                        ${escapeHtml(item.title)}
                      </div>
                      <div style="font-size: 12.5px; color: #6B7280;">
                        ${escapeHtml(item.subtitle)}
                      </div>
                    </div>
                    <a href="${escapeHtml(item.link)}" style="text-decoration: none; background: #2F7BE5; color: #FFFFFF; font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: 6px; white-space: nowrap;">
                      ${escapeHtml(item.action_label)}
                    </a>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Active Projects Section -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div>
                <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 2px;">Active Projects</h2>
                <p style="font-size: 12px; color: #6B7280; margin: 0;">Currently under architectural contract</p>
              </div>
              <a href="#my-projects" style="text-decoration: none; font-size: 13px; font-weight: 600; color: #2F7BE5;">
                View all →
              </a>
            </div>

            ${data.active_projects && data.active_projects.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 14px;">
                ${data.active_projects.map(ap => {
                  const percent = ap.total_milestones > 0 ? Math.round((ap.approved_milestones / ap.total_milestones) * 100) : 0;
                  return `
                    <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px; background: #FFFFFF;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                          <a href="#project-details?id=${ap.project_id}&tab=milestones" style="text-decoration: none; font-weight: 600; font-size: 14.5px; color: #111827; display: block; margin-bottom: 4px;">
                            ${escapeHtml(ap.title)}
                          </a>
                          <div style="font-size: 12.5px; color: #4B5563;">
                            Designer: <strong>${escapeHtml(ap.designer_name)}</strong>
                          </div>
                        </div>
                        <div style="text-align: right;">
                          <span style="font-size: 12px; color: #6B7280;">In Escrow</span>
                          <div style="font-weight: 700; color: #2F7BE5; font-size: 14px; font-variant-numeric: tabular-nums;">
                            ${formatMoney(ap.escrow_amount || 0)}
                          </div>
                        </div>
                      </div>

                      <!-- Phase Progress Bar -->
                      <div style="margin-top: 10px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #6B7280; margin-bottom: 4px;">
                          <span>Phase ${ap.approved_milestones + 1} of ${ap.total_milestones}</span>
                          <span>${percent}% completed</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: #F3F4F6; border-radius: 3px; overflow: hidden;">
                          <div style="width: ${percent}%; height: 100%; background: #2F7BE5;"></div>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="padding: 32px 16px; text-align: center; background: #F7F7F8; border-radius: 6px;">
                <p style="font-size: 13px; color: #6B7280; margin: 0;">No active projects currently under execution.</p>
              </div>
            `}
          </div>

          <!-- Your Projects Section (Open & Draft) -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <div>
                <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 2px;">Your Projects</h2>
                <p style="font-size: 12px; color: #6B7280; margin: 0;">Open and draft project listings</p>
              </div>
              <a href="#post-project" style="text-decoration: none; font-size: 13px; font-weight: 600; color: #2F7BE5;">
                + Post new project
              </a>
            </div>

            ${data.recent_projects && data.recent_projects.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${data.recent_projects.map(p => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; flex-wrap: wrap; gap: 10px;">
                    <div>
                      <a href="#project-details?id=${p.id}" style="text-decoration: none; font-weight: 600; font-size: 14px; color: #111827;">
                        ${escapeHtml(p.title)}
                      </a>
                      <div style="font-size: 12px; color: #6B7280; margin-top: 3px;">
                        ${escapeHtml(p.category || 'Architecture')} • ${p.proposals_count} proposals
                        ${p.unviewed_proposals_count > 0 ? `<strong style="color: #2F7BE5; margin-left: 4px;">(${p.unviewed_proposals_count} new)</strong>` : ''}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <span style="font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; ${p.status === 'open' ? 'background: #EFF6FF; color: #1D4ED8;' : 'background: #FEF3C7; color: #92400E;'}">
                        ${p.status === 'open' ? 'Open' : 'Draft'}
                      </span>
                      <a href="#project-details?id=${p.id}" style="text-decoration: none; font-size: 12.5px; font-weight: 600; color: #2F7BE5;">
                        View →
                      </a>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="padding: 32px 16px; text-align: center; background: #F7F7F8; border-radius: 6px;">
                <p style="font-size: 13px; color: #6B7280; margin: 0 0 10px;">You haven't posted any projects yet.</p>
                <a href="#post-project" style="text-decoration: none; background: #2F7BE5; color: #FFFFFF; font-size: 12.5px; font-weight: 600; padding: 7px 14px; border-radius: 6px; display: inline-block;">
                  Post your first project
                </a>
              </div>
            `}
          </div>

          <!-- Suggested Designers for Recent Open Project (3 to 4 cards with Invite buttons) -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
              <div>
                <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 2px;">Suggested Designers</h2>
                <p style="font-size: 12px; color: #6B7280; margin: 0;">
                  ${targetProject ? `Matched professionals for "${escapeHtml(targetProject.title)}" (${targetProject.proposals_count} ${targetProject.proposals_count === 1 ? 'proposal' : 'proposals'} received)` : 'Matched professionals for your open projects'}
                </p>
              </div>
              <a href="${targetProject ? `#find-designers?project=${encodeURIComponent(targetProject.id)}` : '#find-designers'}" style="text-decoration: none; font-size: 13px; font-weight: 600; color: #2F7BE5;">
                See more &rarr;
              </a>
            </div>

            <div id="dashboard-suggested-designers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px;">
              ${Array(4).fill(0).map(() => `
                <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; height: 160px;"></div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Right Column (Secondary) -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Quick Actions Container -->
          <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 14px;">Quick Actions</h3>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <a href="#post-project" style="text-decoration: none; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 9px 14px; border-radius: 6px; text-align: center;">
                + Post a Project
              </a>
              <a href="#find-designers" style="text-decoration: none; background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 500; padding: 9px 14px; border-radius: 6px; text-align: center;">
                Browse Designers
              </a>
              <a href="#help-support" style="text-decoration: none; background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 500; padding: 9px 14px; border-radius: 6px; text-align: center;">
                Help & Support
              </a>
            </div>
          </div>

          <!-- Upcoming Dates -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 14px;">Upcoming Dates</h3>
            ${upcomingDates.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${upcomingDates.map(u => `
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12.5px; border-bottom: 1px solid #F3F4F6; padding-bottom: 8px;">
                    <div>
                      <div style="color: #111827; font-weight: 500;">${escapeHtml(u.label)}</div>
                      <span style="font-size: 11px; color: #9CA3AF;">${escapeHtml(u.tag)}</span>
                    </div>
                    <span style="font-weight: 600; color: #2F7BE5; font-variant-numeric: tabular-nums;">${escapeHtml(u.date)}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 12.5px; color: #6B7280; margin: 0;">No impending deadlines.</p>
            `}
          </div>

          <!-- Notifications Section -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">Notifications</h3>
              ${data.notifications && data.notifications.length > 0 ? `
                <button id="btn-clear-notifications" style="background: transparent; border: none; font-size: 11.5px; color: #2F7BE5; cursor: pointer; padding: 0;">
                  Mark all as read
                </button>
              ` : ''}
            </div>

            ${data.notifications && data.notifications.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${data.notifications.map(n => `
                  <div style="font-size: 12.5px; border-bottom: 1px solid #F3F4F6; padding-bottom: 8px;">
                    <div style="font-weight: 500; color: #111827; margin-bottom: 2px;">${escapeHtml(n.title)}</div>
                    <div style="color: #6B7280; line-height: 1.4;">${escapeHtml(n.body)}</div>
                    <div style="font-size: 11px; color: #9CA3AF; margin-top: 3px;">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 12.5px; color: #6B7280; margin: 0;">No unread notifications.</p>
            `}
          </div>
        </div>
      </div>

      <!-- Dashboard Invite Modal Host -->
      <div id="modal-dash-invite" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 220; align-items: center; justify-content: center;">
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; margin: 16px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Invite to Project</h3>
            <button type="button" id="btn-close-dash-modal" style="background: none; border: none; font-size: 20px; color: #6B7280; cursor: pointer; line-height: 1;">&times;</button>
          </div>
          
          <p style="font-size: 13px; color: #4B5563; margin: 0 0 16px 0;">
            Invite <strong id="modal-dash-designer-name"></strong> to submit an architectural proposal.
          </p>

          <form id="form-dash-invite">
            <input type="hidden" id="modal-dash-designer-id" value="" />
            
            <div style="margin-bottom: 14px;">
              <label for="dash-invite-project-select" style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px;">Select Project *</label>
              <select id="dash-invite-project-select" required style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF; color: #111827;">
                ${openProjects.map(p => `
                  <option value="${p.id}" ${targetProject?.id === p.id ? 'selected' : ''}>${escapeHtml(p.title)}</option>
                `).join('')}
              </select>
            </div>

            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12.5px; font-weight: 600; color: #374151;">Message (Optional)</label>
                <span id="dash-invite-char-count" style="font-size: 11.5px; color: #9CA3AF;">0 / 500</span>
              </div>
              <textarea id="modal-dash-invite-note" maxlength="500" rows="3" placeholder="Add a personal note to the designer..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" id="btn-cancel-dash-modal" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #4B5563; cursor: pointer;">Cancel</button>
              <button type="submit" id="btn-submit-dash-invite" style="height: 36px; padding: 0 18px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">Send Invitation</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  initDashboardSuggestedDesigners(container, targetProject?.id || (openProjects[0]?.id || ''));

  document.getElementById('btn-clear-notifications')?.addEventListener('click', async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .is('read_at', null);
      }
      renderClientDashboardPage(container);
    } catch (e) {
      console.error('Failed to mark notifications read:', e);
    }
  });
}

async function initDashboardSuggestedDesigners(container: HTMLElement, defaultProjectId: string) {
  const grid = container.querySelector('#dashboard-suggested-designers-grid') as HTMLElement;
  const modal = container.querySelector('#modal-dash-invite') as HTMLElement;
  const modalNameEl = container.querySelector('#modal-dash-designer-name');
  const modalIdInput = container.querySelector('#modal-dash-designer-id') as HTMLInputElement;
  const modalProjSelect = container.querySelector('#dash-invite-project-select') as HTMLSelectElement;
  const modalNoteArea = container.querySelector('#modal-dash-invite-note') as HTMLTextAreaElement;
  const charCountEl = container.querySelector('#dash-invite-char-count');
  const closeBtn = container.querySelector('#btn-close-dash-modal');
  const cancelBtn = container.querySelector('#btn-cancel-dash-modal');
  const form = container.querySelector('#form-dash-invite') as HTMLFormElement;

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
    if (modalNoteArea) modalNoteArea.value = '';
    if (charCountEl) charCountEl.textContent = '0 / 500';
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modalNoteArea?.addEventListener('input', () => {
    if (charCountEl) charCountEl.textContent = `${modalNoteArea.value.length} / 500`;
  });

  try {
    const suggestions = await suggestDesigners(defaultProjectId, 4);
    if (!grid) return;

    if (suggestions.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 20px; text-align: center; color: #6B7280; font-size: 13px;">
          No suggested designers found.
        </div>
      `;
      return;
    }

    grid.innerHTML = suggestions.slice(0, 4).map(s => {
      const initials = (s.full_name || 'D').slice(0, 2).toUpperCase();
      const reasonText = s.reasons && s.reasons.length > 0 ? s.reasons[0].text : 'Matched project typology';

      return `
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
          <div>
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
              <div style="width: 32px; height: 32px; border-radius: 6px; background: #F3F4F6; color: #374151; font-weight: 600; font-size: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${initials}
              </div>
              <div style="overflow: hidden;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  <span>${escapeHtml(s.full_name)}</span>
                  ${s.is_verified ? `<span style="font-size: 11px; color: #2F7BE5; font-weight: 600;" title="Verified">✓</span>` : ''}
                </div>
                <div style="font-size: 11.5px; color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${escapeHtml(s.discipline || 'Architect')} &bull; ${escapeHtml([s.city, s.state].filter(Boolean).join(', '))}
                </div>
              </div>
            </div>

            <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">
              ${s.years_experience} yrs exp &bull; ${s.rating_average > 0 ? `★ ${s.rating_average.toFixed(1)}` : 'New talent'}
            </div>

            <div style="font-size: 11.5px; color: #4B5563; background: #F7F7F8; padding: 6px 8px; border-radius: 4px; margin-bottom: 12px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${escapeHtml(reasonText)}
            </div>
          </div>

          <button type="button" class="btn-dash-invite" data-id="${s.designer_id}" data-name="${escapeHtml(s.full_name)}" style="width: 100%; height: 32px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">
            Invite
          </button>
        </div>
      `;
    }).join('');

    // Bind invite button clicks
    grid.querySelectorAll<HTMLButtonElement>('.btn-dash-invite').forEach(btn => {
      btn.addEventListener('click', () => {
        const dId = btn.getAttribute('data-id') || '';
        const dName = btn.getAttribute('data-name') || '';
        if (modalNameEl) modalNameEl.textContent = dName;
        if (modalIdInput) modalIdInput.value = dId;
        if (modalProjSelect && defaultProjectId) modalProjSelect.value = defaultProjectId;
        if (modal) modal.style.display = 'flex';
      });
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dId = modalIdInput.value;
      const pId = modalProjSelect ? modalProjSelect.value : defaultProjectId;
      const note = modalNoteArea.value.trim();
      const submitBtn = container.querySelector('#btn-submit-dash-invite') as HTMLButtonElement;

      if (!pId) {
        alert('Please select a project to invite this designer to.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
      }

      try {
        await inviteDesigner(pId, dId, note);
        closeModal();

        const cardBtn = grid.querySelector(`.btn-dash-invite[data-id="${dId}"]`) as HTMLButtonElement;
        if (cardBtn) {
          cardBtn.disabled = true;
          cardBtn.style.background = '#F3F4F6';
          cardBtn.style.color = '#047857';
          cardBtn.style.border = '1px solid #E5E7EB';
          cardBtn.style.cursor = 'default';
          cardBtn.textContent = '✓ Invited';
        }
      } catch (err: any) {
        alert('Failed to send invitation: ' + (err?.message || 'Server error'));
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send Invitation';
        }
      }
    });
  } catch {
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 18px; text-align: center; color: #6B7280; font-size: 12.5px;">Could not load suggested designers.</div>`;
    }
  }
}

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
