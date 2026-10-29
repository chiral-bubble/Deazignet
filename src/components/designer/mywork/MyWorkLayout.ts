/**
 * MyWorkLayout Component
 * Hosts the "My Work" workspace with two primary tabs:
 * 1. "Active projects (n)" (sub-routes: /my-work/projects, /my-work/projects/:id)
 * 2. "Proposals (n)" (sub-routes: /my-work/proposals, /my-work/proposals/:id)
 *
 * Rules:
 * - Page title "My Work" in Playfair Display
 * - Counts beside tabs in grey
 * - No second page title rendered inside the tabs
 * - Proposals tab has ONE "Status" dropdown filter next to search (with counts in options)
 * - Active Projects workspace (/my-work/projects/:id) has exactly 3 tabs:
 *   Overview, Milestones (or Time for hourly), and "Files & activity"
 */

import { sharedDataset, type SharedActiveProject } from '../../../mocks/dataset';
import { formatMoney } from '../../../utils/formatters';
import { renderProposalDetailSkeleton, initProposalDetail } from '../proposals/ProposalDetail';
import { renderProposalsHeaderUsage } from '../proposals/ProposalsHeaderUsage';
import { getProposalUsage, withdrawProposal } from '../../../services/proposalsService';

export type MyWorkTab = 'projects' | 'proposals';

export function renderMyWorkLayout(
  activeTab: MyWorkTab = 'projects',
  _subId?: string
): string {
  const activeCount = sharedDataset.activeProjects.length;
  const propCount = sharedDataset.proposals.length;

  return `
    <div class="dez-mywork-page-container" id="dez-mywork-root">
      <!-- Top Header: Title and Tabs -->
      <header class="dez-mywork-header" style="margin-bottom: 24px;">
        <h1 class="dez-page-title" style="font-family: 'Playfair Display', Georgia, serif; font-size: 30px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">
          My Work
        </h1>

        <!-- Primary Tab Bar -->
        <div class="dez-tabs-bar" role="tablist" style="display: flex; gap: 28px; border-bottom: 1px solid #E5E7EB;">
          <button type="button" class="dez-tab-btn ${activeTab === 'projects' ? 'is-active' : ''}" data-mywork-tab="projects" role="tab" aria-selected="${activeTab === 'projects'}" style="padding-bottom: 12px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent; cursor: pointer; color: ${activeTab === 'projects' ? '#2F7BE5' : '#4B5563'}; border-bottom: 2px solid ${activeTab === 'projects' ? '#2F7BE5' : 'transparent'};">
            <span>Active projects</span>
            <span style="font-size: 12px; color: #6B7280; font-weight: 400;">(${activeCount})</span>
          </button>

          <button type="button" class="dez-tab-btn ${activeTab === 'proposals' ? 'is-active' : ''}" data-mywork-tab="proposals" role="tab" aria-selected="${activeTab === 'proposals'}" style="padding-bottom: 12px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; border: none; background: transparent; cursor: pointer; color: ${activeTab === 'proposals' ? '#2F7BE5' : '#4B5563'}; border-bottom: 2px solid ${activeTab === 'proposals' ? '#2F7BE5' : 'transparent'};">
            <span>Proposals</span>
            <span style="font-size: 12px; color: #6B7280; font-weight: 400;">(${propCount})</span>
          </button>
        </div>
      </header>

      <!-- Dynamic Tab Sub-View Slot -->
      <main id="dez-mywork-content" role="region" aria-label="My Work workspace">
        <!-- Rendered via initMyWork -->
      </main>
    </div>
  `;
}

export async function initMyWork(
  container: HTMLElement,
  options: {
    activeTab: MyWorkTab;
    subId?: string;
    onNavigate: (route: string) => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): Promise<void> {
  const root = container.querySelector('#dez-mywork-root') as HTMLElement;
  if (!root) return;

  const contentArea = root.querySelector('#dez-mywork-content') as HTMLElement;
  if (!contentArea) return;

  // Listen to primary tab clicks
  root.querySelectorAll<HTMLButtonElement>('.dez-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-mywork-tab') as MyWorkTab;
      if (targetTab === 'projects') {
        options.onNavigate('#my-work/projects');
      } else {
        options.onNavigate('#my-work/proposals');
      }
    });
  });

  if (options.activeTab === 'projects') {
    if (options.subId) {
      renderActiveProjectWorkspace(contentArea, options.subId, options);
    } else {
      renderActiveProjectsList(contentArea, options);
    }
  } else if (options.activeTab === 'proposals') {
    if (options.subId) {
      renderProposalDetailView(contentArea, options.subId, options);
    } else {
      renderProposalsList(contentArea, options);
    }
  }
}

// ============================================================================
// 1. ACTIVE PROJECTS LIST
// ============================================================================
function renderActiveProjectsList(
  container: HTMLElement,
  options: { onNavigate: (route: string) => void; onShowToast: any }
) {
  const projects = sharedDataset.activeProjects;

  if (projects.length === 0) {
    container.innerHTML = `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px 24px; text-align: center;">
        <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">No active projects</h3>
        <p style="font-size: 13.5px; color: #6B7280; margin: 0 0 20px 0;">You do not currently have any commissioned projects in progress.</p>
        <button type="button" class="dez-btn-primary" id="btn-browse-from-empty" style="height: 36px; padding: 0 16px; font-size: 13px;">
          Browse Client Projects
        </button>
      </div>
    `;
    container.querySelector('#btn-browse-from-empty')?.addEventListener('click', () => {
      options.onNavigate('#client-projects');
    });
    return;
  }

  container.innerHTML = `
    <div class="dez-active-projects-container" style="display: flex; flex-direction: column; gap: 16px;">
      ${projects
        .map((p) => {
          const isMilestone = p.paymentType === 'Milestone';
          const completedCount = p.completedMilestonesCount || 0;
          const totalCount = p.milestones?.length || p.totalMilestonesCount || 1;
          const pct = Math.round((completedCount / totalCount) * 100);

          return `
            <div class="dez-active-project-card" data-project-id="${p.id}" tabindex="0" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px; cursor: pointer; transition: border-color 150ms ease, box-shadow 150ms ease;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
                <div>
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                    <span style="font-size: 11.5px; font-weight: 600; text-transform: uppercase; color: #2F7BE5; letter-spacing: 0.03em;">
                      ${p.paymentType} contract
                    </span>
                    <span style="font-size: 12px; color: #9CA3AF;">•</span>
                    <span style="font-size: 13px; color: #4B5563;">Client: <strong>${p.clientName}</strong></span>
                  </div>
                  <h3 style="font-size: 17px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">
                    ${p.title}
                  </h3>
                  <div style="font-size: 13px; color: #6B7280; display: flex; gap: 16px; flex-wrap: wrap;">
                    <span>📍 ${p.clientLocation}</span>
                    <span>📂 ${p.category}</span>
                    <span>💰 Total Value: <strong>$${formatMoney(p.totalBudget)}</strong></span>
                    ${p.inEscrowAmount ? `<span>🔒 Escrow: <strong style="color: #059669;">$${formatMoney(p.inEscrowAmount)}</strong></span>` : ''}
                  </div>
                </div>

                <div style="text-align: right; min-width: 160px;">
                  <span class="dez-status-pill ${p.status === 'in_review' ? 'pill-amber' : p.status === 'awaiting_deliverable' ? 'pill-blue' : 'pill-green'}">
                    ${p.statusLabel || 'In Progress'}
                  </span>
                  ${p.relativeDeadline ? `<div style="font-size: 12px; color: #B45309; font-weight: 500; margin-top: 8px;">⏳ ${p.relativeDeadline}</div>` : ''}
                </div>
              </div>

              <!-- Progress Bar -->
              ${
                isMilestone
                  ? `
                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #F3F4F6;">
                  <div style="display: flex; justify-content: space-between; font-size: 12.5px; color: #4B5563; margin-bottom: 6px;">
                    <span>Current milestone: <strong>${p.currentMilestoneName || 'Phase 1'}</strong></span>
                    <span>${completedCount} of ${totalCount} phases released (${pct}%)</span>
                  </div>
                  <div style="width: 100%; height: 6px; background: #E5E7EB; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: #2F7BE5; border-radius: 3px;"></div>
                  </div>
                </div>
              `
                  : `
                <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid #F3F4F6; display: flex; gap: 24px; font-size: 13px; color: #4B5563;">
                  <div>Rate: <strong>$${p.hourlyRate || 0}/hr</strong></div>
                  <div>Logged this week: <strong>${p.hoursThisWeek || 0} hrs</strong></div>
                  <div>Unbilled earnings: <strong style="color: #059669;">$${formatMoney(p.unbilledAmount || 0)}</strong></div>
                </div>
              `
              }

              <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
                <span style="font-size: 13px; font-weight: 500; color: #2F7BE5; display: inline-flex; align-items: center; gap: 4px;">
                  Open project workspace &rarr;
                </span>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;

  // Click card to open workspace
  container.querySelectorAll('.dez-active-project-card').forEach((card) => {
    const pid = card.getAttribute('data-project-id');
    const openWorkspace = () => {
      if (pid) options.onNavigate(`#my-work/projects/${pid}`);
    };
    card.addEventListener('click', openWorkspace);
    card.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        openWorkspace();
      }
    });
  });
}

// ============================================================================
// 2. ACTIVE PROJECT WORKSPACE (/my-work/projects/:id)
// Exactly 3 tabs: Overview, Milestones (or Time), "Files & activity"
// ============================================================================
function renderActiveProjectWorkspace(
  container: HTMLElement,
  projectId: string,
  options: { onNavigate: (route: string) => void; onShowToast: any }
) {
  const project = sharedDataset.activeProjects.find((p) => p.id === projectId || p.projectId === projectId);

  if (!project) {
    container.innerHTML = `
      <div style="padding: 32px; text-align: center;">
        <p style="color: #6B7280;">Project workspace not found.</p>
        <button type="button" class="dez-btn-secondary" id="btn-back-to-projects">Back to Active projects</button>
      </div>
    `;
    container.querySelector('#btn-back-to-projects')?.addEventListener('click', () => {
      options.onNavigate('#my-work/projects');
    });
    return;
  }

  const currentProj: SharedActiveProject = project;
  const isMilestone = currentProj.paymentType === 'Milestone';
  let currentWorkspaceTab: 'overview' | 'milestones' | 'files' = 'overview';

  function renderInner() {
    container.innerHTML = `
      <div class="dez-workspace-wrapper">
        <!-- Breadcrumb & Back Link -->
        <div style="margin-bottom: 16px;">
          <button type="button" class="dez-link-action" id="btn-back-projects-list" style="font-size: 13px; color: #4B5563; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; cursor: pointer; padding: 0;">
            &larr; Back to Active projects
          </button>
        </div>

        <!-- Project Title Banner -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px 24px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">
              ${currentProj.paymentType} Commission • Client: <strong>${currentProj.clientName}</strong> (${currentProj.clientLocation})
            </div>
            <h2 style="font-size: 22px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">
              ${currentProj.title}
            </h2>
            <div style="font-size: 13px; color: #4B5563;">
              Category: <strong>${currentProj.category}</strong> • Total Budget: <strong>$${formatMoney(currentProj.totalBudget)}</strong>
            </div>
          </div>
        </div>

        <!-- Exactly 3 Workspace Tabs: Overview, Milestones/Time, Files & activity -->
        <div class="dez-tabs-bar" style="display: flex; gap: 24px; border-bottom: 1px solid #E5E7EB; margin-bottom: 20px;">
          <button type="button" class="dez-tab-btn ${currentWorkspaceTab === 'overview' ? 'is-active' : ''}" data-ws-tab="overview" style="padding-bottom: 10px; font-size: 13.5px; font-weight: 500; border: none; background: transparent; cursor: pointer; color: ${currentWorkspaceTab === 'overview' ? '#2F7BE5' : '#4B5563'}; border-bottom: 2px solid ${currentWorkspaceTab === 'overview' ? '#2F7BE5' : 'transparent'};">
            Overview
          </button>
          <button type="button" class="dez-tab-btn ${currentWorkspaceTab === 'milestones' ? 'is-active' : ''}" data-ws-tab="milestones" style="padding-bottom: 10px; font-size: 13.5px; font-weight: 500; border: none; background: transparent; cursor: pointer; color: ${currentWorkspaceTab === 'milestones' ? '#2F7BE5' : '#4B5563'}; border-bottom: 2px solid ${currentWorkspaceTab === 'milestones' ? '#2F7BE5' : 'transparent'};">
            ${isMilestone ? 'Milestones' : 'Time Tracker'}
          </button>
          <button type="button" class="dez-tab-btn ${currentWorkspaceTab === 'files' ? 'is-active' : ''}" data-ws-tab="files" style="padding-bottom: 10px; font-size: 13.5px; font-weight: 500; border: none; background: transparent; cursor: pointer; color: ${currentWorkspaceTab === 'files' ? '#2F7BE5' : '#4B5563'}; border-bottom: 2px solid ${currentWorkspaceTab === 'files' ? '#2F7BE5' : 'transparent'};">
            Files & activity
          </button>
        </div>

        <!-- Tab Body -->
        <div id="dez-ws-tab-body">
          ${renderWorkspaceTabContent(currentProj, currentWorkspaceTab)}
        </div>
      </div>
    `;

    container.querySelector('#btn-back-projects-list')?.addEventListener('click', () => {
      options.onNavigate('#my-work/projects');
    });

    container.querySelectorAll<HTMLButtonElement>('[data-ws-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentWorkspaceTab = btn.getAttribute('data-ws-tab') as any;
        renderInner();
      });
    });

    // Wire action buttons
    container.querySelector('#btn-ws-upload-deliverable')?.addEventListener('click', () => {
      options.onShowToast('Deliverable Upload', 'Select CAD files, PDF sets, or renderings to submit to client review.', 'info');
    });

    container.querySelector('#btn-ws-log-time')?.addEventListener('click', () => {
      options.onShowToast('Time Tracker', 'Logged 3.5 hours for structural drafting session.', 'success');
    });
  }

  renderInner();
}

function renderWorkspaceTabContent(
  project: SharedActiveProject,
  tab: 'overview' | 'milestones' | 'files'
): string {
  if (tab === 'overview') {
    return `
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
        <!-- Left: Contract Summary & Current Phase -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Contract Details</h3>
            <p style="font-size: 13.5px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">
              This architectural commission is active under Dezignet Verified Studio Terms. All milestone payments and escrow deposits are secured.
            </p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 13px;">
              <div><span style="color: #6B7280;">Contract Type:</span> <strong>${project.paymentType}</strong></div>
              <div><span style="color: #6B7280;">Total Commission:</span> <strong>$${formatMoney(project.totalBudget)}</strong></div>
              <div><span style="color: #6B7280;">Funds in Escrow:</span> <strong style="color: #059669;">$${formatMoney(project.inEscrowAmount)}</strong></div>
              <div><span style="color: #6B7280;">Current Deadline:</span> <strong>${project.relativeDeadline || 'In 14 days'}</strong></div>
            </div>
          </div>

          <!-- Current Deliverable Card -->
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Active Deliverable Requirement</h3>
              <span class="dez-status-pill ${project.status === 'in_review' ? 'pill-amber' : 'pill-blue'}">${project.statusLabel}</span>
            </div>
            <p style="font-size: 13px; color: #4B5563; margin: 0 0 16px 0;">
              ${project.currentMilestoneName || 'Detailed Architectural & Working Drawings'}
            </p>
            <div style="display: flex; gap: 12px; align-items: center;">
              <button type="button" class="dez-btn-primary" id="btn-ws-upload-deliverable" style="height: 36px; padding: 0 16px; font-size: 13px;">
                Submit Deliverable for Approval
              </button>
            </div>
          </div>
        </div>

        <!-- Right: Client Card -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 14px 0;">Client Information</h3>
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
              <div style="width: 42px; height: 42px; border-radius: 50%; background: #E5E7EB; display: flex; align-items: center; justify-content: center; font-weight: 600; color: #374151;">
                ${project.clientName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style="font-weight: 600; font-size: 14px; color: #111827;">${project.clientName}</div>
                <div style="font-size: 12.5px; color: #6B7280;">${project.clientCompany || 'Private Commission'}</div>
              </div>
            </div>
            <div style="font-size: 12.5px; color: #4B5563; display: flex; flex-direction: column; gap: 6px;">
              <div>📍 ${project.clientLocation}</div>
              <div>⚡ Payment Verified & Protected</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (tab === 'milestones') {
    if (project.paymentType === 'Hourly') {
      return `
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">Weekly Timesheet</h3>
              <p style="font-size: 13px; color: #6B7280; margin: 0;">Hourly rate: $${project.hourlyRate || 0}/hr</p>
            </div>
            <button type="button" class="dez-btn-primary" id="btn-ws-log-time" style="height: 36px; padding: 0 16px; font-size: 13px;">
              + Log Billable Time
            </button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="padding: 14px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px;">
              <div style="font-size: 12px; color: #6B7280;">Logged this week</div>
              <div style="font-size: 20px; font-weight: 600; color: #111827; margin-top: 4px;">${project.hoursThisWeek || 0} hrs</div>
            </div>
            <div style="padding: 14px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px;">
              <div style="font-size: 12px; color: #6B7280;">Unbilled Amount</div>
              <div style="font-size: 20px; font-weight: 600; color: #059669; margin-top: 4px;">$${formatMoney(project.unbilledAmount || 0)}</div>
            </div>
            <div style="padding: 14px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px;">
              <div style="font-size: 12px; color: #6B7280;">Total Hours To Date</div>
              <div style="font-size: 20px; font-weight: 600; color: #111827; margin-top: 4px;">${project.totalHoursLogged || 0} hrs</div>
            </div>
          </div>
        </div>
      `;
    }

    const phases = project.milestones || [];
    return `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Phased Milestone Disbursement</h3>
        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${phases
            .map(
              (m, idx) => `
            <div style="padding: 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: ${m.status === 'approved_released' ? '#F9FAFB' : '#FFFFFF'};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                <div>
                  <div style="font-size: 12px; color: #6B7280; margin-bottom: 2px;">Phase ${idx + 1} (${m.feePercentage}%)</div>
                  <h4 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 4px 0;">${m.title}</h4>
                  <p style="font-size: 13px; color: #4B5563; margin: 0 0 8px 0;">${m.deliverablesSummary}</p>
                  <div style="font-size: 12px; color: #6B7280;">Due: <strong>${m.dueDate}</strong></div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px;">$${formatMoney(m.amount)}</div>
                  <span class="dez-status-pill ${m.status === 'approved_released' ? 'pill-green' : m.status === 'in_review' ? 'pill-amber' : 'pill-blue'}">
                    ${m.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // Files & Activity Tab (files list on top, activity log below)
  return `
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <!-- Files List on Top -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Project Deliverable Files</h3>
          <button type="button" class="dez-btn-secondary" style="height: 32px; font-size: 12.5px; padding: 0 12px;">+ Upload New File</button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span><strong>zurich-phase2-working-dwgs.pdf</strong> (18.4 MB)</span>
            </div>
            <span style="color: #6B7280; font-size: 12px;">Submitted yesterday • In Review</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              <span><strong>zurich-schematic-pack.pdf</strong> (24.1 MB)</span>
            </div>
            <span style="color: #059669; font-size: 12px; font-weight: 500;">Approved & Released</span>
          </div>
        </div>
      </div>

      <!-- Activity Log Below -->
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
        <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 14px 0;">Project Activity Log</h3>
        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #2F7BE5; margin-top: 5px;"></div>
            <div>
              <div style="color: #111827; font-weight: 500;">Phase 2 Deliverable uploaded for client review</div>
              <div style="font-size: 12px; color: #6B7280;">Yesterday at 16:45 by Alexandre Sterling</div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #059669; margin-top: 5px;"></div>
            <div>
              <div style="color: #111827; font-weight: 500;">Phase 1 approved and $15,000 released from escrow</div>
              <div style="font-size: 12px; color: #6B7280;">14 days ago by Dr. Tariq Al-Mansoor</div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; align-items: flex-start;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: #9CA3AF; margin-top: 5px;"></div>
            <div>
              <div style="color: #111827; font-weight: 500;">Proposal accepted and project contract created</div>
              <div style="font-size: 12px; color: #6B7280;">35 days ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 3. PROPOSALS LIST
// Requirement: Replace row of status tabs with ONE "Status" dropdown filter next to the search box (with counts in options).
// Options: All, Pending, Viewed, Shortlisted, Accepted, Declined, Withdrawn.
// ============================================================================
function renderProposalsList(
  container: HTMLElement,
  options: { onNavigate: (route: string) => void; onShowToast: any }
) {
  const allProposals = sharedDataset.proposals;

  // Calculate status counts
  const counts = {
    all: allProposals.length,
    pending: allProposals.filter((p) => p.status === 'pending').length,
    viewed: allProposals.filter((p) => p.status === 'viewed').length,
    shortlisted: allProposals.filter((p) => p.status === 'shortlisted').length,
    accepted: allProposals.filter((p) => p.status === 'accepted').length,
    declined: allProposals.filter((p) => p.status === 'declined').length,
    withdrawn: allProposals.filter((p) => p.status === 'withdrawn').length
  };

  container.innerHTML = `
    <div class="dez-mywork-proposals-wrap">
      <!-- Usage Bar Slot -->
      <div id="dez-prop-usage-slot" style="margin-bottom: 20px;"></div>

      <!-- Single Toolbar: Search Input + Single Status Dropdown Filter -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
        <div style="display: flex; gap: 12px; align-items: center; flex: 1; max-width: 600px; flex-wrap: wrap;">
          <!-- Search Box -->
          <div style="position: relative; flex: 1; min-width: 220px;">
            <input
              type="text"
              id="mywork-prop-search"
              class="dez-form-input"
              placeholder="Search proposals by title, client..."
              style="height: 38px; font-size: 13.5px; padding-left: 32px;"
            />
            <svg style="position: absolute; left: 10px; top: 11px; color: #9CA3AF;" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <!-- ONE Status Dropdown Filter with Counts in Options -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label for="mywork-prop-status-select" style="font-size: 13px; color: #4B5563; font-weight: 500; white-space: nowrap;">Status:</label>
            <select id="mywork-prop-status-select" class="dez-form-select" style="height: 38px; font-size: 13px; min-width: 180px;">
              <option value="all">All (${counts.all})</option>
              <option value="pending">Pending (${counts.pending})</option>
              <option value="viewed">Viewed (${counts.viewed})</option>
              <option value="shortlisted">Shortlisted (${counts.shortlisted})</option>
              <option value="accepted">Accepted (${counts.accepted})</option>
              <option value="declined">Declined (${counts.declined})</option>
              <option value="withdrawn">Withdrawn (${counts.withdrawn})</option>
            </select>
          </div>
        </div>

        <div>
          <a href="#client-projects" class="dez-btn-secondary" style="height: 38px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; text-decoration: none;">
            + Find More Projects
          </a>
        </div>
      </div>

      <!-- Proposals Table / Cards Container -->
      <div id="mywork-prop-table-container">
        <!-- Rendered via updateProposalsTable -->
      </div>
    </div>
  `;

  // Render usage banner
  const usageSlot = container.querySelector('#dez-prop-usage-slot') as HTMLElement;
  if (usageSlot) {
    getProposalUsage().then((usage) => {
      usageSlot.innerHTML = renderProposalsHeaderUsage(usage);
    });
  }

  const searchInput = container.querySelector('#mywork-prop-search') as HTMLInputElement;
  const statusSelect = container.querySelector('#mywork-prop-status-select') as HTMLSelectElement;
  const tableContainer = container.querySelector('#mywork-prop-table-container') as HTMLElement;

  function updateProposalsTable() {
    if (!tableContainer) return;

    const query = searchInput?.value.trim().toLowerCase() || '';
    const selectedStatus = statusSelect?.value || 'all';

    let list = [...allProposals];

    if (selectedStatus !== 'all') {
      list = list.filter((p) => p.status.toLowerCase() === selectedStatus);
    }

    if (query) {
      list = list.filter(
        (p) =>
          p.projectTitle.toLowerCase().includes(query) ||
          p.clientName.toLowerCase().includes(query) ||
          p.clientLocation.toLowerCase().includes(query)
      );
    }

    if (list.length === 0) {
      tableContainer.innerHTML = `
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px 20px; text-align: center;">
          <div style="font-weight: 500; font-size: 14.5px; color: #111827; margin-bottom: 4px;">No proposals found</div>
          <div style="font-size: 13px; color: #6B7280;">Try adjusting your status filter or search query.</div>
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
          <thead>
            <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
              <th style="padding: 12px 16px;">Project / Client</th>
              <th style="padding: 12px 16px;">Type</th>
              <th style="padding: 12px 16px;">Sent Date</th>
              <th style="padding: 12px 16px; text-align: right;">Proposed Price</th>
              <th style="padding: 12px 16px; text-align: right;">Status</th>
              <th style="padding: 12px 16px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map((p) => {
                const statusPillClass =
                  p.status === 'accepted'
                    ? 'pill-green'
                    : p.status === 'shortlisted'
                    ? 'pill-blue'
                    : p.status === 'viewed'
                    ? 'pill-grey'
                    : p.status === 'declined'
                    ? 'pill-red'
                    : 'pill-amber';

                return `
                  <tr class="dez-prop-row" data-prop-id="${p.id}" tabindex="0" style="border-bottom: 1px solid #F3F4F6; cursor: pointer; transition: background 150ms ease;">
                    <td style="padding: 14px 16px;">
                      <div style="font-weight: 600; color: #111827; margin-bottom: 2px;">${p.projectTitle}</div>
                      <div style="font-size: 12px; color: #6B7280;">Client: ${p.clientName} &bull; 📍 ${p.clientLocation}</div>
                    </td>
                    <td style="padding: 14px 16px; color: #4B5563;">${p.paymentType}</td>
                    <td style="padding: 14px 16px; color: #6B7280; white-space: nowrap;">${p.sentDate}</td>
                    <td class="dez-tabular-num" style="padding: 14px 16px; text-align: right; font-weight: 600; color: #111827;">
                      $${formatMoney(p.proposedPrice)}
                    </td>
                    <td style="padding: 14px 16px; text-align: right;">
                      <span class="dez-status-pill ${statusPillClass}" style="text-transform: capitalize;">
                        ${p.status}
                      </span>
                    </td>
                    <td style="padding: 14px 16px; text-align: right;" onclick="event.stopPropagation();">
                      <div style="display: flex; justify-content: flex-end; gap: 8px;">
                        <button type="button" class="dez-btn-secondary dez-btn-sm btn-view-proposal" data-prop-id="${p.id}" style="height: 28px; padding: 0 10px; font-size: 12px;">
                          View
                        </button>
                        ${
                          p.status === 'pending' || p.status === 'viewed'
                            ? `
                          <button type="button" class="dez-btn-secondary dez-btn-danger dez-btn-sm btn-withdraw-prop" data-prop-id="${p.id}" style="height: 28px; padding: 0 8px; font-size: 12px;">
                            Withdraw
                          </button>
                        `
                            : ''
                        }
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    // Row clicks go to detail
    tableContainer.querySelectorAll('.dez-prop-row').forEach((row) => {
      const propId = row.getAttribute('data-prop-id');
      const goToDetail = () => {
        if (propId) options.onNavigate(`#my-work/proposals/${propId}`);
      };
      row.addEventListener('click', goToDetail);
      row.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          goToDetail();
        }
      });
    });

    // View button clicks
    tableContainer.querySelectorAll('.btn-view-proposal').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const propId = btn.getAttribute('data-prop-id');
        if (propId) options.onNavigate(`#my-work/proposals/${propId}`);
      });
    });

    // Withdraw button clicks
    tableContainer.querySelectorAll('.btn-withdraw-prop').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const propId = btn.getAttribute('data-prop-id');
        if (propId && confirm('Are you sure you want to withdraw this proposal?')) {
          await withdrawProposal(propId);
          options.onShowToast('Proposal Withdrawn', 'Your proposal was retracted.', 'info');
          updateProposalsTable();
        }
      });
    });
  }

  searchInput?.addEventListener('input', updateProposalsTable);
  statusSelect?.addEventListener('change', updateProposalsTable);

  updateProposalsTable();
}

// ============================================================================
// 4. PROPOSAL DETAIL VIEW (/my-work/proposals/:id)
// ============================================================================
function renderProposalDetailView(
  container: HTMLElement,
  proposalId: string,
  options: { onNavigate: (route: string) => void; onShowToast: any }
) {
  const proposal = sharedDataset.proposals.find((p) => p.id === proposalId);

  if (!proposal) {
    container.innerHTML = `
      <div style="padding: 32px; text-align: center;">
        <p style="color: #6B7280;">Proposal not found.</p>
        <button type="button" class="dez-btn-secondary" id="btn-back-to-proposals">Back to Proposals</button>
      </div>
    `;
    container.querySelector('#btn-back-to-proposals')?.addEventListener('click', () => {
      options.onNavigate('#my-work/proposals');
    });
    return;
  }

  // Render container with back link and ProposalDetail skeleton
  container.innerHTML = `
    <div class="dez-proposal-detail-shell">
      <div style="margin-bottom: 16px;">
        <button type="button" class="dez-link-action" id="btn-back-prop-list" style="font-size: 13px; color: #4B5563; display: inline-flex; align-items: center; gap: 6px; border: none; background: transparent; cursor: pointer; padding: 0;">
          &larr; Back to Proposals
        </button>
      </div>
      <div id="dez-prop-detail-mount">
        ${renderProposalDetailSkeleton()}
      </div>
    </div>
  `;

  container.querySelector('#btn-back-prop-list')?.addEventListener('click', () => {
    options.onNavigate('#my-work/proposals');
  });

  const mount = container.querySelector('#dez-prop-detail-mount') as HTMLElement;
  if (mount) {
    initProposalDetail(
      mount,
      proposalId,
      {
        onBackToList: () => options.onNavigate('#my-work/proposals'),
        onShowToast: options.onShowToast
      }
    );
  }
}
