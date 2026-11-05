/**
 * ClientProjectDetailsPage — Comprehensive Client View of a Project
 * Tabs:
 * - Overview: Commercial budget, construction estimate, site readiness, disciplines, private details.
 * - Proposals: Search, filter, sort, compare (2-3), proposal detail, shortlist, decline, accept, message.
 * - Milestones / Time: Vertical phase list, deliverable review panel, auto-approval countdown,
 *   approve dialog with 5-day security hold, request changes with revision counter, report a problem,
 *   simulated milestone funding, completion banner & leave a review modal.
 * - Files & Activity: Reference drawings, site attachments, updates, engagement timeline.
 * - Contract: Bilateral architectural agreement viewer with digital signing and verification.
 * 
 * Strict Design: Light, flat, #FFFFFF background, #F7F7F8 secondary, 1px #E5E7EB borders, 8px radius,
 * NO shadows, NO decorative badges, brand blue #2F7BE5 on primary actions, tabular nums for money.
 */

import { getMyProject, closeProject, addProjectUpdate, extendDeadline, type ClientProjectDetail } from '../../services/projectsService';
import { renderProjectProposalsTab, initProjectProposalsTab } from './proposals/ProjectProposalsTab';
import { renderContractTab, initContractTab } from '../common/contract/ContractView';
import {
  getEngagement,
  approveMilestone,
  requestRevision,
  raiseDispute,
  devFundMilestone,
  getMilestoneVersions,
  type EngagementDetail
} from '../../services/activeWorkService';
import { createReview, type ReviewItem } from '../../services/reviewsService';
import { supabase, USE_MOCKS } from '../../lib/supabase';
import { renderClientShell, initClientShell } from './ClientLayout';

export async function renderClientProjectDetailsPage(
  container: HTMLElement,
  projectId: string,
  initialTab?: string
): Promise<void> {
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const activeTabName = initialTab || urlParams.get('tab') || 'overview';

  container.innerHTML = renderClientShell(
    {
      activeTab: 'my-projects',
      pageTitle: 'Project Details'
    },
    `
      <div id="project-details-loading" style="padding: 60px; text-align: center; color: #6B7280; font-size: 14px;">
        Loading project details...
      </div>
    `
  );

  initClientShell(container);

  try {
    const detail = await getMyProject(projectId);
    if (!detail) {
      throw new Error('Project not found or you do not have permission to view it.');
    }

    // Check for associated engagement
    let engagement: EngagementDetail | null = null;
    let existingReview: ReviewItem | null = null;
    try {
      const { data: engData } = await supabase
        .from('engagements')
        .select('id')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (engData?.id) {
        engagement = await getEngagement(engData.id);

        // Fetch review if engagement is completed or active
        const { data: revData } = await supabase
          .from('reviews')
          .select('*')
          .eq('engagement_id', engData.id)
          .maybeSingle();

        if (revData) {
          existingReview = revData as ReviewItem;
        }
      }
    } catch (e) {
      console.warn('Could not load engagement/review for project:', e);
    }

    renderProjectView(container, detail, engagement, existingReview, activeTabName);
  } catch (err: any) {
    const mainArea = container.querySelector('main div') || container;
    mainArea.innerHTML = `
      <div style="background: #FEF2F2; border: 1px solid #F87171; border-radius: 8px; padding: 24px; text-align: center; color: #991B1B; max-width: 600px; margin: 40px auto;">
        <p style="font-weight: 600; font-size: 15px; margin: 0 0 8px;">Failed to load project details</p>
        <p style="font-size: 13px; margin: 0 0 16px;">${escapeHtml(err?.message || 'A network error occurred.')}</p>
        <a href="#my-projects" style="text-decoration: none; background: #DC2626; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; display: inline-block;">Back to My Projects</a>
      </div>
    `;
  }
}

function renderProjectView(
  container: HTMLElement,
  detail: ClientProjectDetail,
  engagement: EngagementDetail | null,
  existingReview: ReviewItem | null,
  initialTab: string
): void {
  const project = detail.project;
  let activeTab: string = initialTab;
  let showPrivateDetails = false;

  // Financial calculations if engagement exists
  const isHired = !!engagement && engagement.status !== 'pending_signature';
  const contractValue = engagement ? Number(engagement.totalPrice) : Number(project.design_budget || 0);
  
  const milestones = engagement?.milestones || [];
  const inEscrow = milestones
    .filter(m => (m.status === 'funded' || m.status === 'in_progress' || m.status === 'submitted') && m.payoutStatus !== 'released')
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const released = milestones
    .filter(m => m.status === 'approved' || m.payoutStatus === 'released')
    .reduce((sum, m) => sum + Number(m.amount), 0);
  const remaining = Math.max(0, contractValue - inEscrow - released);

  function switchTab(newTab: string) {
    activeTab = newTab;
    const currentHash = window.location.hash.split('?')[0];
    window.history.replaceState(null, '', `${currentHash}?id=${project.id}&tab=${activeTab}`);
    render();
  }

  function render() {
    const mainArea = container.querySelector('main div') || container;
    const statusBadge = getStatusBadge(project.status);

    mainArea.innerHTML = `
      <div style="max-width: 1140px; margin: 0 auto; padding-bottom: 60px;">
        <!-- Header Banner -->
        <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <a href="#my-projects" style="text-decoration: none; color: #6B7280; font-size: 13px;">← My Projects</a>
                <span style="color: #D1D5DB;">/</span>
                <span style="font-size: 12px; color: #4B5563;">${escapeHtml(project.category_name || 'Project')}</span>
                ${statusBadge}
              </div>
              <h1 style="font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #111827; margin: 0 0 6px;">
                ${escapeHtml(project.title)}
              </h1>
              <div style="font-size: 13px; color: #6B7280;">
                Posted on ${new Date(project.created_at).toLocaleDateString()} in ${escapeHtml(project.city || '')}, ${escapeHtml(project.state || '')}
              </div>
            </div>

            <!-- Action Buttons for Draft or Open Project -->
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              ${project.status === 'open' ? `
                <button id="btn-open-update-modal" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
                  Post Update
                </button>
                <button id="btn-open-deadline-modal" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
                  Extend Deadline
                </button>
                <button id="btn-close-project" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #DC2626; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 6px; cursor: pointer;">
                  Close to Proposals
                </button>
              ` : ''}
              ${project.status === 'draft' ? `
                <a href="#post-project?id=${project.id}" style="text-decoration: none; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px;">
                  Edit Draft
                </a>
              ` : ''}
            </div>
          </div>

          <!-- Financial Summary Header Row for Hired / Active Projects -->
          ${engagement ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 20px; padding: 14px 18px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px;">
              <div>
                <span style="font-size: 12px; color: #6B7280; display: block;">Contract Value</span>
                <span style="font-size: 18px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums;">
                  $${contractValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span style="font-size: 12px; color: #6B7280; display: block;">In Escrow</span>
                <span style="font-size: 18px; font-weight: 700; color: #2F7BE5; font-variant-numeric: tabular-nums;">
                  $${inEscrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span style="font-size: 12px; color: #6B7280; display: block;">Released to Designer</span>
                <span style="font-size: 18px; font-weight: 700; color: #059669; font-variant-numeric: tabular-nums;">
                  $${released.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span style="font-size: 12px; color: #6B7280; display: block;">Remaining Unfunded</span>
                <span style="font-size: 18px; font-weight: 700; color: #4B5563; font-variant-numeric: tabular-nums;">
                  $${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 24px; border-bottom: 1px solid #E5E7EB; margin-bottom: 24px; overflow-x: auto;">
          <button class="nav-tab-btn" data-tab="overview" style="${getTabStyle(activeTab === 'overview')}">
            Overview
          </button>
          ${!isHired ? `
            <button class="nav-tab-btn" data-tab="proposals" style="${getTabStyle(activeTab === 'proposals' || activeTab === 'invitations')}">
              Proposals
            </button>
          ` : ''}
          ${engagement ? `
            <button class="nav-tab-btn" data-tab="milestones" style="${getTabStyle(activeTab === 'milestones')}">
              Milestones / Time (${milestones.length})
            </button>
          ` : ''}
          <button class="nav-tab-btn" data-tab="files" style="${getTabStyle(activeTab === 'files')}">
            Files & Activity
          </button>
          <button class="nav-tab-btn" data-tab="contract" style="${getTabStyle(activeTab === 'contract')}">
            Contract ${engagement?.status === 'pending_signature' ? `<span style="font-size: 11px; background: #FEF3C7; color: #92400E; padding: 1px 6px; border-radius: 10px; margin-left: 4px;">Sign</span>` : ''}
          </button>
        </div>

        <!-- Tab Body Host -->
        <div id="project-tab-body">
          ${renderTabBody()}
        </div>

        <!-- Shared Modals Container -->
        <div id="project-modals-host"></div>
      </div>
    `;

    bindTabEvents();
  }

  function renderTabBody(): string {
    if (activeTab === 'overview') {
      return renderOverviewTab();
    } else if (activeTab === 'proposals' || activeTab === 'invitations') {
      return renderProjectProposalsTab(project.id, Number(project.design_budget || 0));
    } else if (activeTab === 'milestones') {
      return renderMilestonesTab();
    } else if (activeTab === 'files') {
      return renderFilesAndActivityTab();
    } else if (activeTab === 'contract') {
      if (!engagement) {
        return `
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 48px 24px; text-align: center; background: #FFFFFF;">
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px;">No Contract Generated Yet</h3>
            <p style="font-size: 13px; color: #6B7280; max-width: 460px; margin: 0 auto 16px;">
              When you accept a designer's proposal, a formal bilateral architectural agreement is automatically generated and made available here for digital signing.
            </p>
            <button class="nav-tab-btn" data-tab="proposals" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
              Review Received Proposals
            </button>
          </div>
        `;
      }
      return renderContractTab(engagement.id);
    }
    return '';
  }

  function renderOverviewTab(): string {
    const budgetFormatted = project.design_budget
      ? `$${Number(project.design_budget).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : (project.hourly_rate_max ? `$${project.hourly_rate_max}/hr max` : 'Not specified');
    const costFormatted = project.construction_cost_estimate
      ? `$${Number(project.construction_cost_estimate).toLocaleString()}`
      : 'Not provided';
    const priv = detail.privateDetails;

    return `
      <div class="client-project-2col-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Description -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px;">Project Scope & Description</h3>
            <p style="font-size: 13px; line-height: 1.6; color: #374151; margin: 0; white-space: pre-wrap;">${escapeHtml(project.description || 'No description provided.')}</p>
          </div>

          <!-- Milestones Scope -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px;">Payment Structure & Scope Phases</h3>
            ${project.payment_type === 'milestone' ? `
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${(detail.phases || []).map((m: any, idx: number) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #F7F7F8; border-radius: 6px; font-size: 13px;">
                    <div>
                      <span style="font-weight: 600; color: #111827; margin-right: 6px;">Phase ${idx + 1}:</span>
                      <span style="color: #374151;">${escapeHtml(m.name)}</span>
                    </div>
                    <span style="font-weight: 600; color: #2F7BE5; font-variant-numeric: tabular-nums;">${m.fee_percent}%</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 13px; color: #374151;">Hourly billing engagement capped at maximum $${project.hourly_rate_max}/hour.</p>
            `}
          </div>

          <!-- Private Site Details (Owner & Hired Designer Only) -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">Private Site Details (Owner Only)</h3>
              <button id="toggle-private-btn" style="background: transparent; border: none; color: #2F7BE5; font-size: 12px; font-weight: 600; cursor: pointer;">
                ${showPrivateDetails ? 'Hide Details' : 'Show Details'}
              </button>
            </div>
            <p style="font-size: 12px; color: #6B7280; margin: 0 0 12px;">
              These details are strictly private and never exposed to browsing designers. Only you and your contracted designer (after bilateral signing) can view this.
            </p>
            ${showPrivateDetails ? `
              <div style="background: #F7F7F8; border-radius: 6px; padding: 14px; font-size: 13px; display: flex; flex-direction: column; gap: 8px;">
                <div><strong style="color: #4B5563;">Street Address:</strong> ${escapeHtml(priv?.street || 'Not provided')}</div>
                <div><strong style="color: #4B5563;">Postal Code:</strong> ${escapeHtml(priv?.postal_code || 'Not provided')}</div>
                <div><strong style="color: #4B5563;">Site Access Instructions:</strong> ${escapeHtml(priv?.access_instructions || 'None provided')}</div>
                <div><strong style="color: #4B5563;">General Site Notes:</strong> ${escapeHtml(priv?.site_notes || 'None provided')}</div>
              </div>
            ` : `
              <div style="font-size: 13px; color: #9CA3AF; font-style: italic;">
                Click "Show Details" to review private street address and site access notes.
              </div>
            `}
          </div>
        </div>

        <!-- Right Column: Summary Card -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 16px;">Project Overview</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6B7280;">Design Budget:</span>
                <span style="font-weight: 600; color: #111827; font-variant-numeric: tabular-nums;">${budgetFormatted}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6B7280;">Est. Construction:</span>
                <span style="font-weight: 600; color: #111827; font-variant-numeric: tabular-nums;">${costFormatted}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6B7280;">Professional Needed:</span>
                <span style="font-weight: 600; color: #111827; text-transform: capitalize;">
                  ${Array.isArray(project.disciplines) && project.disciplines.length > 0 ? project.disciplines.map((d: string) => d.replace(/_/g, ' ')).join(', ') : 'Architect'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6B7280;">Building Status:</span>
                <span style="font-weight: 500; color: #111827; text-transform: capitalize;">${(project.building_status || '').replace('_', ' ')}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6B7280;">Land Status:</span>
                <span style="font-weight: 500; color: #111827;">${project.site_status === 'has_land' ? 'Secured' : 'No Land Yet'}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #6B7280;">Proposal Deadline:</span>
                <span style="font-weight: 600; color: #2F7BE5;">${project.proposal_deadline ? new Date(project.proposal_deadline).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderMilestonesTab(): string {
    if (!engagement) return '';
    const completedCount = milestones.filter(m => m.status === 'approved' || m.payoutStatus === 'released').length;
    const isCompleted = engagement.status === 'completed' || (milestones.length > 0 && completedCount === milestones.length);

    // Primary action area: deliverable review panel for any submitted milestone
    const submittedMilestone = milestones.find(m => m.status === 'submitted');

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Celebratory Completion Banner + Review Section -->
        ${isCompleted ? `
          <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <div>
              <h3 style="margin: 0 0 6px; font-size: 16px; font-weight: 600; color: #166534;">Project Completed</h3>
              <p style="margin: 0; font-size: 13px; color: #15803D;">
                All milestones have been successfully completed and approved.
              </p>
            </div>
            <div>
              ${existingReview ? `
                <div style="display: inline-flex; align-items: center; gap: 8px; background: #FFFFFF; border: 1px solid #BBF7D0; padding: 6px 14px; border-radius: 6px; font-size: 13px; color: #166534; font-weight: 500;">
                  ★ Reviewed (${existingReview.rating}/5)
                </div>
              ` : `
                <button id="btn-leave-review" style="background: #059669; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 6px; cursor: pointer;">
                  Leave a Review
                </button>
              `}
            </div>
          </div>
        ` : ''}

        <!-- Existing Client Review Display -->
        ${existingReview ? `
          <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
              <div style="font-weight: 600; font-size: 14px; color: #111827;">Your Review</div>
              <div style="color: #D97706; font-size: 14px; font-weight: 600;">
                ${'★'.repeat(existingReview.rating)}${'☆'.repeat(5 - existingReview.rating)}
                <span style="color: #4B5563; font-size: 12.5px; margin-left: 6px;">(${existingReview.rating}.0)</span>
              </div>
            </div>
            <p style="font-size: 13px; line-height: 1.5; color: #374151; margin: 0 0 12px; white-space: pre-wrap;">${escapeHtml(existingReview.comment)}</p>
            <div style="display: flex; gap: 16px; font-size: 12px; color: #6B7280; border-top: 1px solid #F3F4F6; padding-top: 10px;">
              <span>Communication: <strong>${existingReview.communication_rating || '—'}/5</strong></span>
              <span>Quality: <strong>${existingReview.quality_rating || '—'}/5</strong></span>
              <span>Timeliness: <strong>${existingReview.timeliness_rating || '—'}/5</strong></span>
              <span>Would Hire Again: <strong>${existingReview.would_hire_again ? 'Yes' : 'No'}</strong></span>
            </div>

            ${existingReview.designer_reply ? `
              <div style="margin-top: 14px; padding: 12px 16px; background: #F7F7F8; border-left: 3px solid #2F7BE5; border-radius: 0 6px 6px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #111827; margin-bottom: 4px;">Designer Reply:</div>
                <div style="font-size: 13px; color: #4B5563; line-height: 1.5;">${escapeHtml(existingReview.designer_reply)}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Deliverable Review Panel (Primary Action Area) -->
        ${submittedMilestone ? `
          <div style="background: #FFFFFF; border: 2px solid #2F7BE5; border-radius: 8px; padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; flex-wrap: wrap; gap: 12px;">
              <div>
                <span style="font-size: 11px; font-weight: 600; background: #EFF6FF; color: #2F7BE5; padding: 2px 8px; border-radius: 4px; display: inline-block; margin-bottom: 6px;">
                  Action Required
                </span>
                <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #111827;">
                  Deliverable Review: ${escapeHtml(submittedMilestone.name)}
                </h3>
                <p style="margin: 0; font-size: 12.5px; color: #6B7280;">
                  Submitted by designer on ${submittedMilestone.submittedAt ? new Date(submittedMilestone.submittedAt).toLocaleDateString() : 'recently'}.
                  Auto-approves in ${calculateAutoApproveDays(submittedMilestone.submittedAt)} days if no action is taken.
                </p>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                <button id="btn-approve-milestone" data-id="${submittedMilestone.id}" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 6px; cursor: pointer;">
                  Approve Deliverables
                </button>
                <button id="btn-request-revisions" data-id="${submittedMilestone.id}" data-rev-count="${submittedMilestone.revisionCount || 0}" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 6px; cursor: pointer;">
                  Request Changes
                </button>
                <button id="btn-dispute-milestone" data-id="${submittedMilestone.id}" style="background: transparent; border: none; color: #DC2626; font-size: 13px; font-weight: 500; cursor: pointer; padding: 8px;">
                  Report a Problem
                </button>
              </div>
            </div>

            <!-- Deliverables & Submissions Details Container -->
            <div id="submission-details-${submittedMilestone.id}" style="background: #F7F7F8; border-radius: 6px; padding: 16px; font-size: 13px; color: #374151;">
              <div style="font-weight: 600; margin-bottom: 6px;">Submitted Deliverables:</div>
              <ul style="margin: 0 0 12px; padding-left: 20px;">
                ${submittedMilestone.deliverables.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
              </ul>
              <div id="submission-files-mount" style="font-size: 12.5px; color: #6B7280;">
                Loading files & version history...
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Vertical List of All Phases -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <div>
              <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111827;">Milestone Schedule</h3>
              <p style="margin: 0; font-size: 12px; color: #6B7280;">Progress: ${completedCount} of ${milestones.length} phases completed</p>
            </div>
            <!-- Progress Bar -->
            <div style="width: 140px; height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden;">
              <div style="width: ${milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0}%; height: 100%; background: #2F7BE5; transition: width 150ms;"></div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${milestones.map((m, idx) => {
              const pill = getMilestoneStatusPill(m.status);
              const canFund = m.status === 'awaiting_funding' && (idx === 0 || milestones[idx - 1].status === 'approved');

              return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: ${m.status === 'submitted' ? '#EFF6FF' : '#F7F7F8'}; border: 1px solid ${m.status === 'submitted' ? '#BFDBFE' : '#E5E7EB'}; border-radius: 6px; flex-wrap: wrap; gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: ${m.status === 'approved' ? '#059669' : '#FFFFFF'}; color: ${m.status === 'approved' ? '#FFFFFF' : '#374151'}; border: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">
                      ${m.status === 'approved' ? '✓' : idx + 1}
                    </div>
                    <div>
                      <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 2px;">
                        ${escapeHtml(m.name)}
                      </div>
                      <div style="font-size: 12px; color: #6B7280;">
                        ${m.deliverables?.length ? `${m.deliverables.length} deliverables • ` : ''}
                        Fee: <strong>${m.feePercent}%</strong> ($${m.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 12px;">
                    ${pill}
                    ${canFund ? `
                      <button class="btn-fund-milestone" data-id="${m.id}" data-amount="${m.amount}" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 12.5px; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer;">
                        Fund Milestone
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderFilesAndActivityTab(): string {
    return `
      <div class="client-project-2col-grid" style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
        <!-- Left: Reference Files & Uploads -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 14px;">Project Reference Documents & Photos</h3>
            ${detail.images && detail.images.length > 0 ? `
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;">
                ${detail.images.map((img: any) => `
                  <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; font-size: 12.5px; background: #F7F7F8; text-align: center;">
                    <div style="font-weight: 500; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px;">
                      ${escapeHtml(img.file_name || 'Document')}
                    </div>
                    <span style="font-size: 11px; color: #6B7280;">Reference file</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 13px; color: #6B7280; margin: 0;">No reference files attached to this project.</p>
            `}
          </div>

          <!-- Project Updates Thread -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0;">Project Clarifications & Announcements</h3>
              ${project.status === 'open' ? `
                <button id="btn-post-update-files-tab" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
                  + Post Update
                </button>
              ` : ''}
            </div>
            ${detail.updates && detail.updates.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${detail.updates.map((u: any) => `
                  <div style="border-left: 3px solid #2F7BE5; padding: 10px 14px; background: #F7F7F8; border-radius: 0 6px 6px 0;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #6B7280; margin-bottom: 4px;">
                      <span style="font-weight: 600; color: #111827;">${escapeHtml(u.author_name || 'Project Owner')}</span>
                      <span>${new Date(u.created_at).toLocaleString()}</span>
                    </div>
                    <div style="font-size: 13px; color: #374151; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(u.body)}</div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="font-size: 13px; color: #6B7280; margin: 0;">No announcements posted.</p>
            `}
          </div>
        </div>

        <!-- Right: Activity Summary -->
        <div>
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 12px;">Timeline & Activity</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 12.5px; color: #4B5563;">
              <div>• Project posted on ${new Date(project.created_at).toLocaleDateString()}</div>
              ${engagement?.startedAt ? `<div>• Contract activated on ${new Date(engagement.startedAt).toLocaleDateString()}</div>` : ''}
              ${engagement?.completedAt ? `<div>• Engagement completed on ${new Date(engagement.completedAt).toLocaleDateString()}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindTabEvents() {
    // Navigation tab switching
    container.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = (btn as HTMLElement).dataset.tab;
        if (t) switchTab(t);
      });
    });

    // Overview private details toggle
    document.getElementById('toggle-private-btn')?.addEventListener('click', () => {
      showPrivateDetails = !showPrivateDetails;
      render();
    });

    // Updates modal triggers
    document.getElementById('btn-open-update-modal')?.addEventListener('click', () => showUpdateModal());
    document.getElementById('btn-post-update-files-tab')?.addEventListener('click', () => showUpdateModal());
    document.getElementById('btn-open-deadline-modal')?.addEventListener('click', () => showDeadlineModal());

    // Close project to proposals
    document.getElementById('btn-close-project')?.addEventListener('click', async () => {
      if (confirm('Close this project to new proposals? Designers will no longer be able to submit new proposals.')) {
        try {
          await closeProject(project.id);
          renderClientProjectDetailsPage(container, project.id, 'overview');
        } catch (err: any) {
          alert(err?.message || 'Failed to close project.');
        }
      }
    });

    // Mount sub-tabs logic
    if (activeTab === 'proposals' || activeTab === 'invitations') {
      initProjectProposalsTab(
        project.id,
        Number(project.design_budget || 0),
        () => switchTab('contract')
      );
    } else if (activeTab === 'contract' && engagement) {
      initContractTab(engagement.id);
    } else if (activeTab === 'milestones') {
      bindMilestonesTabEvents();
    }
  }

  function bindMilestonesTabEvents() {
    // Load submitted files if a milestone is submitted
    const submittedMilestone = milestones.find(m => m.status === 'submitted');
    if (submittedMilestone) {
      getMilestoneVersions(submittedMilestone.id).then(subs => {
        const mount = document.getElementById('submission-files-mount');
        if (!mount) return;
        if (!subs || subs.length === 0) {
          mount.innerHTML = `<p style="margin: 0; color: #6B7280;">No attached deliverable files found.</p>`;
          return;
        }

        const latest: any = subs[0];
        mount.innerHTML = `
          <div style="margin-top: 10px;">
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Version ${latest.version || 1} Notes:</div>
            <p style="margin: 0 0 10px; color: #374151; white-space: pre-wrap;">${escapeHtml(latest.notes || 'No submission note provided.')}</p>
            <div style="font-weight: 600; color: #111827; margin-bottom: 6px;">Attached Drawing Files:</div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${(((latest as any).submission_files || []) as any[]).map((f: any) => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 4px; padding: 8px 12px;">
                  <span style="font-weight: 500; color: #111827;">${escapeHtml(f.file_name || 'Design Package')}</span>
                  <a href="${escapeHtml(f.path || '#')}" target="_blank" style="color: #2F7BE5; text-decoration: none; font-weight: 600;">Download file</a>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).catch(() => {
        const mount = document.getElementById('submission-files-mount');
        if (mount) mount.innerHTML = `<span style="color: #6B7280;">Deliverable files uploaded by designer.</span>`;
      });

      // Approve Milestone dialog
      document.getElementById('btn-approve-milestone')?.addEventListener('click', () => {
        showApproveDialog(submittedMilestone.id, submittedMilestone.name, submittedMilestone.amount);
      });

      // Request Revisions dialog
      document.getElementById('btn-request-revisions')?.addEventListener('click', (e) => {
        const btn = e.currentTarget as HTMLElement;
        const revCount = Number(btn.dataset.revCount || 0);
        showRequestRevisionDialog(submittedMilestone.id, revCount);
      });

      // Report a Problem / Dispute dialog
      document.getElementById('btn-dispute-milestone')?.addEventListener('click', () => {
        showDisputeDialog(submittedMilestone.id, submittedMilestone.name);
      });
    }

    // Fund milestone handlers
    container.querySelectorAll('.btn-fund-milestone').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const mId = target.dataset.id;
        const amount = target.dataset.amount || '0';
        if (!mId) return;

        // In production, payments are on hold
        if (import.meta.env.PROD && !USE_MOCKS.active_work) {
          alert('Milestone Escrow Funding: Available soon.\nIn production, funds will be placed securely in escrow before design commencement.');
          return;
        }

        if (confirm(`Fund this milestone with $${Number(amount).toLocaleString()}? Funds will be placed in secure escrow.`)) {
          try {
            await devFundMilestone(mId);
            renderClientProjectDetailsPage(container, project.id, 'milestones');
          } catch (err: any) {
            alert(err?.message || 'Failed to fund milestone.');
          }
        }
      });
    });

    // Leave a Review dialog
    document.getElementById('btn-leave-review')?.addEventListener('click', () => {
      showLeaveReviewModal();
    });
  }

  function showApproveDialog(milestoneId: string, milestoneName: string, amount: number) {
    const host = document.getElementById('project-modals-host');
    if (!host) return;

    host.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 100;">
        <div style="background: #FFFFFF; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 10px;">Approve Deliverables</h3>
          <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 14px; margin-bottom: 16px; font-size: 13px; line-height: 1.5; color: #374151;">
            <strong>${escapeHtml(milestoneName)}</strong> • $${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p style="font-size: 13px; color: #6B7280; line-height: 1.5; margin: 0 0 16px;">
            By approving, you confirm these deliverables satisfy the agreed scope. A standard 5-day security hold applies before escrow funds are released to the designer.
          </p>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel-approve" style="background: #FFFFFF; border: 1px solid #E5E7EB; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer; color: #4B5563;">Cancel</button>
            <button id="modal-confirm-approve" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 6px; cursor: pointer;">Confirm Approval</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-cancel-approve')?.addEventListener('click', () => { host.innerHTML = ''; });
    document.getElementById('modal-confirm-approve')?.addEventListener('click', async () => {
      try {
        await approveMilestone(milestoneId);
        host.innerHTML = '';
        renderClientProjectDetailsPage(container, project.id, 'milestones');
      } catch (err: any) {
        alert(err?.message || 'Failed to approve milestone.');
      }
    });
  }

  function showRequestRevisionDialog(milestoneId: string, currentRevisionCount: number) {
    const host = document.getElementById('project-modals-host');
    if (!host) return;

    host.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 100;">
        <div style="background: #FFFFFF; border-radius: 8px; width: 100%; max-width: 520px; padding: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px;">Request Changes on Deliverable</h3>
          <div style="font-size: 12px; color: #2F7BE5; background: #EFF6FF; padding: 8px 12px; border-radius: 6px; margin-bottom: 14px;">
            Revision ${currentRevisionCount + 1} of 2 included under your agreement. Additional revisions will be billed at the agreed additional services rate.
          </div>
          <p style="font-size: 12.5px; color: #6B7280; margin: 0 0 10px;">
            Specify the required adjustments in detail (minimum 20 characters):
          </p>
          <textarea id="modal-revision-notes" rows="4" placeholder="Describe adjustments needed on the floor plans, elevations, or specifications..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; margin-bottom: 8px; outline: none;"></textarea>
          <div id="revision-chars-count" style="font-size: 11px; color: #9CA3AF; text-align: right; margin-bottom: 16px;">0 / 20 min</div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel-revision" style="background: #FFFFFF; border: 1px solid #E5E7EB; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer; color: #4B5563;">Cancel</button>
            <button id="modal-confirm-revision" disabled style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 6px; cursor: not-allowed; opacity: 0.6;">Submit Request</button>
          </div>
        </div>
      </div>
    `;

    const txt = document.getElementById('modal-revision-notes') as HTMLTextAreaElement;
    const btn = document.getElementById('modal-confirm-revision') as HTMLButtonElement;
    const count = document.getElementById('revision-chars-count') as HTMLElement;

    txt?.addEventListener('input', () => {
      const len = txt.value.trim().length;
      count.textContent = `${len} / 20 min`;
      if (len >= 20) {
        btn.disabled = false;
        btn.style.cursor = 'pointer';
        btn.style.opacity = '1';
      } else {
        btn.disabled = true;
        btn.style.cursor = 'not-allowed';
        btn.style.opacity = '0.6';
      }
    });

    document.getElementById('modal-cancel-revision')?.addEventListener('click', () => { host.innerHTML = ''; });
    btn?.addEventListener('click', async () => {
      try {
        await requestRevision(milestoneId, txt.value.trim());
        host.innerHTML = '';
        renderClientProjectDetailsPage(container, project.id, 'milestones');
      } catch (err: any) {
        alert(err?.message || 'Failed to submit revision request.');
      }
    });
  }

  function showDisputeDialog(milestoneId: string, _milestoneName: string) {
    const host = document.getElementById('project-modals-host');
    if (!host) return;

    host.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 100;">
        <div style="background: #FFFFFF; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #DC2626; margin: 0 0 6px;">Report a Problem</h3>
          <p style="font-size: 12.5px; color: #6B7280; margin: 0 0 14px;">
            During the 5-day hold period, you may raise a dispute if deliverables materially deviate from contract terms. Escrow funds will remain on hold until resolution.
          </p>
          <input type="text" id="modal-dispute-reason" placeholder="Reason (e.g. Unresolved revision requests)" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box; margin-bottom: 12px;" />
          <textarea id="modal-dispute-details" rows="3" placeholder="Provide full context for mediation..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; margin-bottom: 16px; outline: none;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel-dispute" style="background: #FFFFFF; border: 1px solid #E5E7EB; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer; color: #4B5563;">Cancel</button>
            <button id="modal-confirm-dispute" style="background: #DC2626; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 6px; cursor: pointer;">Submit Dispute</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-cancel-dispute')?.addEventListener('click', () => { host.innerHTML = ''; });
    document.getElementById('modal-confirm-dispute')?.addEventListener('click', async () => {
      const reason = (document.getElementById('modal-dispute-reason') as HTMLInputElement)?.value?.trim();
      const details = (document.getElementById('modal-dispute-details') as HTMLTextAreaElement)?.value?.trim();
      if (!reason || !details) {
        alert('Please provide both a dispute reason and details.');
        return;
      }
      try {
        await raiseDispute(engagement!.id, milestoneId, reason, details);
        host.innerHTML = '';
        alert('Dispute submitted. A support specialist will review this submission.');
        renderClientProjectDetailsPage(container, project.id, 'milestones');
      } catch (err: any) {
        alert(err?.message || 'Failed to submit dispute.');
      }
    });
  }

  function showLeaveReviewModal() {
    if (!engagement) return;
    const host = document.getElementById('project-modals-host');
    if (!host) return;

    let selectedRating = 5;

    const ratingDescriptions = ['1 - Poor', '2 - Fair', '3 - Good', '4 - Very good', '5 - Excellent'];

    host.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 100;">
        <div style="background: #FFFFFF; border-radius: 8px; width: 100%; max-width: 520px; padding: 24px; max-height: 90vh; overflow-y: auto;">
          <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 6px;">Leave a Review</h3>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 20px;">Share your experience working with your designer.</p>

          <!-- Overall Rating -->
          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px;">Overall Rating</label>
            <div id="star-rating-box" style="display: flex; gap: 8px; align-items: center;">
              ${[1, 2, 3, 4, 5].map(star => `
                <button type="button" class="star-btn" data-val="${star}" style="background: transparent; border: none; font-size: 24px; color: #D97706; cursor: pointer; padding: 0;">★</button>
              `).join('')}
              <span id="star-desc-text" style="font-size: 13px; color: #4B5563; margin-left: 10px;">5 - Excellent</span>
            </div>
          </div>

          <!-- Sub-ratings -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; font-size: 12.5px;">
            <div>
              <label style="display: block; color: #4B5563; margin-bottom: 4px;">Communication</label>
              <select id="sel-rating-comm" style="width: 100%; height: 34px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 8px;">
                <option value="5" selected>5 - Excellent</option>
                <option value="4">4 - Very Good</option>
                <option value="3">3 - Good</option>
                <option value="2">2 - Fair</option>
                <option value="1">1 - Poor</option>
              </select>
            </div>
            <div>
              <label style="display: block; color: #4B5563; margin-bottom: 4px;">Quality of Work</label>
              <select id="sel-rating-quality" style="width: 100%; height: 34px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 8px;">
                <option value="5" selected>5 - Excellent</option>
                <option value="4">4 - Very Good</option>
                <option value="3">3 - Good</option>
                <option value="2">2 - Fair</option>
                <option value="1">1 - Poor</option>
              </select>
            </div>
            <div>
              <label style="display: block; color: #4B5563; margin-bottom: 4px;">Schedule Adherence</label>
              <select id="sel-rating-timeliness" style="width: 100%; height: 34px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 8px;">
                <option value="5" selected>5 - Excellent</option>
                <option value="4">4 - Very Good</option>
                <option value="3">3 - Good</option>
                <option value="2">2 - Fair</option>
                <option value="1">1 - Poor</option>
              </select>
            </div>
            <div>
              <label style="display: block; color: #4B5563; margin-bottom: 4px;">Would hire again?</label>
              <select id="sel-hire-again" style="width: 100%; height: 34px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 8px;">
                <option value="true" selected>Yes, definitely</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <!-- Review Comment -->
          <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 6px;">Your Written Feedback</label>
            <textarea id="modal-review-comment" rows="4" placeholder="Describe the architectural design quality, responsiveness, and experience..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; outline: none; margin-bottom: 4px;"></textarea>
            <div id="review-char-count" style="font-size: 11px; color: #9CA3AF; text-align: right;">0 / 30 min (max 2000)</div>
          </div>

          <!-- Confirmation Checkbox -->
          <label style="display: flex; align-items: flex-start; gap: 8px; font-size: 12px; color: #4B5563; margin-bottom: 20px; cursor: pointer;">
            <input type="checkbox" id="chk-review-confirm" style="margin-top: 2px;" />
            <span>I confirm this review is based on genuine work completed under this contract.</span>
          </label>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel-review" style="background: #FFFFFF; border: 1px solid #E5E7EB; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; cursor: pointer; color: #4B5563;">Cancel</button>
            <button id="modal-submit-review" disabled style="background: #059669; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 6px; cursor: not-allowed; opacity: 0.6;">Submit Review</button>
          </div>
        </div>
      </div>
    `;

    const starBtns = host.querySelectorAll('.star-btn');
    const starDesc = document.getElementById('star-desc-text') as HTMLElement;
    const txtComment = document.getElementById('modal-review-comment') as HTMLTextAreaElement;
    const chkConfirm = document.getElementById('chk-review-confirm') as HTMLInputElement;
    const btnSubmit = document.getElementById('modal-submit-review') as HTMLButtonElement;
    const charCount = document.getElementById('review-char-count') as HTMLElement;

    function updateStars(val: number) {
      selectedRating = val;
      starBtns.forEach((b) => {
        const bVal = Number((b as HTMLElement).dataset.val);
        b.textContent = bVal <= val ? '★' : '☆';
      });
      if (starDesc) starDesc.textContent = ratingDescriptions[val - 1] || `${val} stars`;
      validateForm();
    }

    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        updateStars(Number((btn as HTMLElement).dataset.val));
      });
    });

    function validateForm() {
      const len = txtComment?.value.trim().length || 0;
      if (charCount) charCount.textContent = `${len} / 30 min (max 2000)`;
      const isValid = len >= 30 && len <= 2000 && chkConfirm?.checked;
      btnSubmit.disabled = !isValid;
      btnSubmit.style.cursor = isValid ? 'pointer' : 'not-allowed';
      btnSubmit.style.opacity = isValid ? '1' : '0.6';
    }

    txtComment?.addEventListener('input', validateForm);
    chkConfirm?.addEventListener('change', validateForm);

    document.getElementById('modal-cancel-review')?.addEventListener('click', () => { host.innerHTML = ''; });
    btnSubmit?.addEventListener('click', async () => {
      try {
        const commRating = Number((document.getElementById('sel-rating-comm') as HTMLSelectElement).value);
        const qualRating = Number((document.getElementById('sel-rating-quality') as HTMLSelectElement).value);
        const timeRating = Number((document.getElementById('sel-rating-timeliness') as HTMLSelectElement).value);
        const hireAgain = (document.getElementById('sel-hire-again') as HTMLSelectElement).value === 'true';

        await createReview({
          engagementId: engagement!.id,
          rating: selectedRating,
          comment: txtComment.value.trim(),
          wouldHireAgain: hireAgain,
          communicationRating: commRating,
          qualityRating: qualRating,
          timelinessRating: timeRating
        });

        host.innerHTML = '';
        alert('Thank you! Your review has been submitted.');
        renderClientProjectDetailsPage(container, project.id, 'milestones');
      } catch (err: any) {
        alert(err?.message || 'Failed to submit review.');
      }
    });
  }

  function showUpdateModal() {
    const host = document.getElementById('project-modals-host');
    if (!host) return;

    host.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 100;">
        <div style="background: #FFFFFF; border-radius: 8px; width: 100%; max-width: 520px; padding: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px;">Post a Project Update</h3>
          <p style="font-size: 12px; color: #6B7280; margin: 0 0 16px;">This update will be broadcast to all designers who have submitted a proposal or saved your project.</p>
          <textarea id="modal-update-content" rows="4" placeholder="e.g. Added soil test survey reports to reference files; setback requirement is 3 meters." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box; margin-bottom: 16px; outline: none;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel-btn" style="background: #FFFFFF; border: 1px solid #E5E7EB; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer; color: #4B5563;">Cancel</button>
            <button id="modal-submit-update-btn" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Post Update</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-cancel-btn')?.addEventListener('click', () => { host.innerHTML = ''; });
    document.getElementById('modal-submit-update-btn')?.addEventListener('click', async () => {
      const content = (document.getElementById('modal-update-content') as HTMLTextAreaElement)?.value?.trim();
      if (!content) {
        alert('Please write an update message.');
        return;
      }
      try {
        await addProjectUpdate(project.id, content);
        host.innerHTML = '';
        renderClientProjectDetailsPage(container, project.id, 'files');
      } catch (err: any) {
        alert(err?.message || 'Failed to post update.');
      }
    });
  }

  function showDeadlineModal() {
    const host = document.getElementById('project-modals-host');
    if (!host) return;

    const minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    host.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center; z-index: 100;">
        <div style="background: #FFFFFF; border-radius: 8px; width: 100%; max-width: 440px; padding: 24px;">
          <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px;">Extend Proposal Deadline</h3>
          <p style="font-size: 12px; color: #6B7280; margin: 0 0 16px;">Give designers additional days to prepare their detailed architectural proposals.</p>
          <input type="date" id="modal-new-deadline" min="${minDate}" value="${minDate}" style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box; margin-bottom: 16px;" />
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="modal-cancel-deadline" style="background: #FFFFFF; border: 1px solid #E5E7EB; font-size: 13px; font-weight: 500; padding: 8px 14px; border-radius: 6px; cursor: pointer; color: #4B5563;">Cancel</button>
            <button id="modal-submit-deadline" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Extend Deadline</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-cancel-deadline')?.addEventListener('click', () => { host.innerHTML = ''; });
    document.getElementById('modal-submit-deadline')?.addEventListener('click', async () => {
      const newDeadline = (document.getElementById('modal-new-deadline') as HTMLInputElement)?.value;
      if (!newDeadline) return;
      try {
        await extendDeadline(project.id, newDeadline);
        host.innerHTML = '';
        renderClientProjectDetailsPage(container, project.id, 'overview');
      } catch (err: any) {
        alert(err?.message || 'Failed to extend deadline.');
      }
    });
  }

  render();
}

function calculateAutoApproveDays(submittedAt: string | null): number {
  if (!submittedAt) return 5;
  const submitted = new Date(submittedAt).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((submitted + (5 * 24 * 60 * 60 * 1000) - now) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}

function getTabStyle(isActive: boolean): string {
  if (isActive) {
    return 'background: transparent; border: none; border-bottom: 2px solid #2F7BE5; color: #2F7BE5; font-size: 14px; font-weight: 600; padding: 12px 0; cursor: pointer; transition: color 150ms; display: flex; align-items: center; white-space: nowrap;';
  }
  return 'background: transparent; border: none; border-bottom: 2px solid transparent; color: #6B7280; font-size: 14px; font-weight: 500; padding: 12px 0; cursor: pointer; transition: color 150ms; display: flex; align-items: center; white-space: nowrap;';
}

function getStatusBadge(status: string): string {
  switch (status) {
    case 'open':
      return `<span style="background: #EFF6FF; color: #1D4ED8; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Open</span>`;
    case 'in_progress':
    case 'awarded':
      return `<span style="background: #ECFDF5; color: #047857; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Active</span>`;
    case 'completed':
      return `<span style="background: #F3F4F6; color: #374151; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Completed</span>`;
    case 'draft':
      return `<span style="background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Draft</span>`;
    case 'closed':
      return `<span style="background: #F3F4F6; color: #6B7280; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Closed</span>`;
    default:
      return `<span style="background: #F3F4F6; color: #6B7280; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${escapeHtml(status)}</span>`;
  }
}

function getMilestoneStatusPill(status: string): string {
  switch (status) {
    case 'not_started':
      return `<span style="background: #F3F4F6; color: #6B7280; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Not funded</span>`;
    case 'funded':
      return `<span style="background: #EFF6FF; color: #2F7BE5; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Funded</span>`;
    case 'in_progress':
      return `<span style="background: #FEF3C7; color: #92400E; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">In progress</span>`;
    case 'submitted':
      return `<span style="background: #DBEAFE; color: #1D4ED8; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Submitted for review</span>`;
    case 'in_revision':
      return `<span style="background: #FEE2E2; color: #B91C1C; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">In revision</span>`;
    case 'approved':
      return `<span style="background: #ECFDF5; color: #047857; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">Approved</span>`;
    default:
      return `<span style="background: #F3F4F6; color: #6B7280; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;">${escapeHtml(status)}</span>`;
  }
}

function escapeHtml(str: string): string {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
