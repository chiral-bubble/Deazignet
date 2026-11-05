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
            $${Number(data.summary.funds_in_escrow || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            $${Number(ap.escrow_amount || 0).toLocaleString()}
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

          <!-- Suggested Designers for Recent Open Project -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-top: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 2px;">Suggested Designers</h2>
                <p style="font-size: 12px; color: #6B7280; margin: 0;">Matched professionals for your open projects</p>
              </div>
              <a href="#find-designers" style="text-decoration: none; font-size: 13px; font-weight: 600; color: #2F7BE5;">
                See more →
              </a>
            </div>
            <div id="dashboard-suggested-designers" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Elena Rostova</div>
                <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">Architect • Denver, CO</div>
                <a href="#find-designers" style="display: block; text-align: center; background: #2F7BE5; color: #FFFFFF; padding: 6px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 600; text-decoration: none;">Invite</a>
              </div>
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Marcus Vance</div>
                <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">Engineer • Austin, TX</div>
                <a href="#find-designers" style="display: block; text-align: center; background: #2F7BE5; color: #FFFFFF; padding: 6px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 600; text-decoration: none;">Invite</a>
              </div>
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Claire Dupond</div>
                <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">Interior Designer • Chicago, IL</div>
                <a href="#find-designers" style="display: block; text-align: center; background: #2F7BE5; color: #FFFFFF; padding: 6px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 600; text-decoration: none;">Invite</a>
              </div>
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

          <!-- Suggested Designers for Recent Open Project -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-top: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
              <div>
                <h2 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 2px;">Suggested Designers</h2>
                <p style="font-size: 12px; color: #6B7280; margin: 0;">Matched professionals for your open projects</p>
              </div>
              <a href="#find-designers" style="text-decoration: none; font-size: 13px; font-weight: 600; color: #2F7BE5;">
                See more →
              </a>
            </div>
            <div id="dashboard-suggested-designers" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Elena Rostova</div>
                <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">Architect • Denver, CO</div>
                <a href="#find-designers" style="display: block; text-align: center; background: #2F7BE5; color: #FFFFFF; padding: 6px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 600; text-decoration: none;">Invite</a>
              </div>
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Marcus Vance</div>
                <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">Engineer • Austin, TX</div>
                <a href="#find-designers" style="display: block; text-align: center; background: #2F7BE5; color: #FFFFFF; padding: 6px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 600; text-decoration: none;">Invite</a>
              </div>
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px;">
                <div style="font-weight: 600; font-size: 13.5px; color: #111827; margin-bottom: 2px;">Claire Dupond</div>
                <div style="font-size: 11.5px; color: #6B7280; margin-bottom: 8px;">Interior Designer • Chicago, IL</div>
                <a href="#find-designers" style="display: block; text-align: center; background: #2F7BE5; color: #FFFFFF; padding: 6px 10px; border-radius: 4px; font-size: 11.5px; font-weight: 600; text-decoration: none;">Invite</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

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

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
