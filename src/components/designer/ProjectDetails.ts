/**
 * ProjectDetails Component (Designer View)
 * Two-column architectural project brief view with milestone plan and proposal actions.
 */

import { toggleSaveProject, type Project } from '../../services/projectsService';

export function renderProjectDetails(project: Project, profileComplete: boolean = true): string {
  const isMilestone = project.paymentType === 'Milestone';
  const budgetFormatted = isMilestone
    ? `$${project.budget.toLocaleString()}`
    : `$${project.hourlyRate || 0}/hr (Est. $${project.budget.toLocaleString()})`;

  // Reference images markup
  const refImagesHtml = project.referenceImages && project.referenceImages.length > 0
    ? `
      <section class="dez-details-section">
        <h3 class="dez-section-heading">Client Reference Images</h3>
        <div class="dez-reference-grid">
          ${project.referenceImages
            .map(
              (img) => `
            <div class="dez-reference-card" data-lightbox-src="${img.url}" data-lightbox-caption="${img.caption}">
              <img src="${img.url}" alt="${img.caption}" loading="lazy" />
              <div class="dez-ref-caption">${img.caption}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </section>
    `
    : '';

  // Milestone plan markup
  let milestonesHtml = '';
  if (isMilestone && project.milestones && project.milestones.length > 0) {
    const totalPercentage = project.milestones.reduce((acc, m) => acc + m.defaultFeePercentage, 0);
    milestonesHtml = `
      <section class="dez-details-section">
        <h3 class="dez-section-heading">Architectural Milestone Plan</h3>
        <p style="font-size:13px; color:var(--dez-text-muted); margin-bottom:14px;">
          The client has defined the following phased disbursement schedule. You may review and adapt fee percentages during proposal submission.
        </p>
        <div class="dez-milestone-list">
          ${project.milestones
            .map(
              (m) => `
            <div class="dez-milestone-item" id="milestone-${m.id}">
              <div class="dez-milestone-header" data-toggle-milestone="${m.id}">
                <div class="dez-milestone-title-group">
                  <span class="dez-milestone-name">${m.name}</span>
                  <span class="dez-milestone-fee-badge">${m.defaultFeePercentage}% Fee</span>
                </div>
                <span class="dez-milestone-chevron">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                </span>
              </div>
              <div class="dez-milestone-body">
                <p>${m.description}</p>
                <div class="dez-milestone-deliverables">
                  <strong>Expected Deliverables:</strong>
                  <ul>
                    ${m.deliverables.map((d) => `<li>${d}</li>`).join('')}
                  </ul>
                </div>
                <div class="dez-milestone-trigger">
                  <strong>Billing Trigger:</strong> ${m.billingTrigger}
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        <div class="dez-milestones-total-line">
          <span>Total Phased Allocation</span>
          <span>${totalPercentage}%</span>
        </div>
      </section>
    `;
  } else if (!isMilestone) {
    milestonesHtml = `
      <section class="dez-details-section">
        <h3 class="dez-section-heading">Hourly Engagement Terms</h3>
        <div style="font-size:13.5px; color:var(--dez-text-secondary); line-height:1.6;">
          <p>This project is commissioned on a time-tracked hourly basis. Time is logged against architectural milestones with weekly timesheet approvals.</p>
          <div style="margin-top:10px; display:flex; gap:24px;">
            <div><span style="color:var(--dez-text-muted)">Estimated Hours:</span> <strong>${project.estimatedHours || 0} hrs</strong></div>
            <div><span style="color:var(--dez-text-muted)">Client Target Rate:</span> <strong>$${project.hourlyRate || 0}/hr</strong></div>
          </div>
        </div>
      </section>
    `;
  }

  // Sidebar Button States
  let actionButtonHtml = '';
  if (project.hasApplied) {
    actionButtonHtml = `
      <div class="dez-applied-banner">
        <div class="dez-applied-status">Proposal Sent</div>
        <div class="dez-applied-links">
          <button type="button" class="dez-link-action" id="dez-view-my-proposal-btn" data-proposal-id="${project.appliedProposalId || ''}">View proposal</button>
          <span>•</span>
          <button type="button" class="dez-link-withdraw" id="dez-withdraw-proposal-btn" data-proposal-id="${project.appliedProposalId || ''}">Withdraw</button>
        </div>
      </div>
    `;
  } else if (project.status === 'Closed') {
    actionButtonHtml = `
      <button type="button" class="dez-btn-primary" disabled>
        Not Accepting Proposals
      </button>
    `;
  } else if (!profileComplete) {
    actionButtonHtml = `
      <button type="button" class="dez-btn-primary" disabled>
        Send Proposal
      </button>
      <div class="dez-incomplete-profile-banner">
        Complete your profile to send proposals. <a href="#settings/profile" style="color:var(--dez-brand-blue); text-decoration:underline;">Profile Settings</a>
      </div>
    `;
  } else {
    actionButtonHtml = `
      <button type="button" class="dez-btn-primary" id="dez-open-proposal-btn">
        Send Proposal
      </button>
    `;
  }

  return `
    <div class="dez-details-container">
      <!-- Back Link -->
      <a href="#client-projects" class="dez-back-link" id="dez-back-to-projects">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        <span>Client Projects</span>
      </a>

      <!-- 2-Column Layout -->
      <div class="dez-details-columns">
        
        <!-- Left Column: Main Content (Divided by 1px rules) -->
        <div class="dez-details-main">
          
          <!-- Header Area -->
          <div class="dez-details-section">
            <div class="dez-details-header-row">
              <div>
                <h1 class="dez-details-title">${project.title}</h1>
                <div class="dez-details-meta">
                  <span class="dez-plain-chip">${project.category}</span>
                  <span class="dez-plain-chip">${project.subcategory}</span>
                  <span>•</span>
                  <span>Posted ${project.postedDate}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Key Facts 2-Column Definition Grid -->
          <div class="dez-details-section">
            <h3 class="dez-section-heading">Project Specifications</h3>
            <div class="dez-key-facts-grid">
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Category</span>
                <span class="dez-key-fact-val">${project.category}</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Budget</span>
                <span class="dez-key-fact-val is-budget">${budgetFormatted}</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Subcategory</span>
                <span class="dez-key-fact-val">${project.subcategory}</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Payment type</span>
                <span class="dez-key-fact-val">${project.paymentType}</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Timeline</span>
                <span class="dez-key-fact-val">${project.timeline}</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Deadline</span>
                <span class="dez-key-fact-val">${project.deadline}</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Area</span>
                <span class="dez-key-fact-val">${project.area.toLocaleString()} sq ft</span>
              </div>
              <div class="dez-key-fact-row">
                <span class="dez-key-fact-label">Location</span>
                <span class="dez-key-fact-val">${project.location}</span>
              </div>
            </div>
          </div>

          <!-- Project Description -->
          <div class="dez-details-section">
            <h3 class="dez-section-heading">Architectural Scope & Brief</h3>
            <p class="dez-description-text">${project.description}</p>
          </div>

          <!-- Reference Images -->
          ${refImagesHtml}

          <!-- Milestones Plan -->
          ${milestonesHtml}

        </div>

        <!-- Right Column: Sticky Sidebar Panel -->
        <aside class="dez-details-sidebar">
          <div class="dez-sidebar-panel">
            ${actionButtonHtml}

            <div class="dez-sidebar-summary-box">
              <div class="dez-summary-row">
                <span class="dez-summary-label">Project Budget:</span>
                <span class="dez-summary-val is-budget">${budgetFormatted}</span>
              </div>
              <div class="dez-summary-row">
                <span class="dez-summary-label">Proposal Deadline:</span>
                <span class="dez-summary-val">${project.deadline}</span>
              </div>
            </div>

            <div class="dez-proposals-submitted-text">
              ${project.proposalsCount} proposal${project.proposalsCount === 1 ? '' : 's'} submitted
            </div>
          </div>

          <!-- About the Client (No email, phone or message button) -->
          <div class="dez-client-panel">
            <h4 class="dez-client-heading">About the Client</h4>
            <div class="dez-client-meta-list">
              <div class="dez-client-meta-item">
                <strong>${project.client.name}</strong>
              </div>
              ${project.client.company ? `<div class="dez-client-meta-item" style="color:var(--dez-text-muted);">${project.client.company}</div>` : ''}
              <div class="dez-client-meta-item">
                <span>Location:</span> <span>${project.client.location}</span>
              </div>
              <div class="dez-client-meta-item">
                <span>Member since:</span> <span>${project.client.memberSince}</span>
              </div>
              <div class="dez-client-meta-item">
                <span>Projects posted:</span> <span>${project.client.projectsPosted}</span>
              </div>
              ${
                project.client.paymentVerified
                  ? `
                <div class="dez-client-verified-chip">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Payment method verified</span>
                </div>
              `
                  : ''
              }
            </div>

            <!-- Bookmark Link -->
            <button 
              type="button" 
              class="dez-save-project-link" 
              id="dez-detail-bookmark-btn" 
              data-project-id="${project.id}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${project.isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              <span>${project.isSaved ? 'Project saved' : 'Save project'}</span>
            </button>
          </div>
        </aside>

      </div>

      <!-- Mobile Sticky Bottom Bar -->
      <div class="dez-mobile-sticky-bar">
        ${
          project.hasApplied
            ? `<button type="button" class="dez-btn-primary" disabled>Proposal Sent</button>`
            : project.status === 'Closed'
            ? `<button type="button" class="dez-btn-primary" disabled>Closed</button>`
            : `<button type="button" class="dez-btn-primary" id="dez-mobile-open-proposal-btn">Send Proposal ($${project.budget.toLocaleString()})</button>`
        }
      </div>

      <!-- Reference Image Lightbox -->
      <div class="dez-lightbox-backdrop" id="dez-lightbox-backdrop" aria-hidden="true">
        <div class="dez-lightbox-content">
          <button type="button" class="dez-lightbox-close" id="dez-lightbox-close" aria-label="Close lightbox">✕</button>
          <img src="" alt="" id="dez-lightbox-img" />
          <div class="dez-lightbox-caption" id="dez-lightbox-caption"></div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initializes milestone accordion, image lightbox, bookmark, and proposal actions
 */
export function initProjectDetails(
  container: HTMLElement,
  project: Project,
  onOpenProposalDrawer: () => void,
  onWithdrawProposal: (proposalId: string) => void,
  onBackToFeed: () => void
): void {
  // Back button
  container.querySelector('#dez-back-to-projects')?.addEventListener('click', (e) => {
    e.preventDefault();
    onBackToFeed();
  });

  // Open proposal drawer buttons
  container.querySelector('#dez-open-proposal-btn')?.addEventListener('click', onOpenProposalDrawer);
  container.querySelector('#dez-mobile-open-proposal-btn')?.addEventListener('click', onOpenProposalDrawer);

  // Withdraw proposal button
  container.querySelector('#dez-withdraw-proposal-btn')?.addEventListener('click', () => {
    if (project.appliedProposalId) {
      if (confirm('Are you sure you want to withdraw this proposal?')) {
        onWithdrawProposal(project.appliedProposalId);
      }
    }
  });

  // Bookmark toggle
  const bookmarkBtn = container.querySelector('#dez-detail-bookmark-btn') as HTMLButtonElement | null;
  bookmarkBtn?.addEventListener('click', () => {
    const isSaved = toggleSaveProject(project.id);
    project.isSaved = isSaved;
    bookmarkBtn.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      <span>${isSaved ? 'Project saved' : 'Save project'}</span>
    `;
  });

  // Milestone accordion toggle
  container.querySelectorAll('[data-toggle-milestone]').forEach((header) => {
    header.addEventListener('click', () => {
      const parent = header.closest('.dez-milestone-item');
      parent?.classList.toggle('is-expanded');
    });
  });

  // Reference images lightbox
  const lightboxBackdrop = container.querySelector('#dez-lightbox-backdrop') as HTMLElement | null;
  const lightboxImg = container.querySelector('#dez-lightbox-img') as HTMLImageElement | null;
  const lightboxCaption = container.querySelector('#dez-lightbox-caption') as HTMLElement | null;
  const lightboxClose = container.querySelector('#dez-lightbox-close');

  container.querySelectorAll('[data-lightbox-src]').forEach((card) => {
    card.addEventListener('click', () => {
      const src = card.getAttribute('data-lightbox-src');
      const caption = card.getAttribute('data-lightbox-caption') || '';
      if (lightboxBackdrop && lightboxImg && lightboxCaption && src) {
        lightboxImg.src = src;
        lightboxImg.alt = caption;
        lightboxCaption.textContent = caption;
        lightboxBackdrop.classList.add('is-open');
      }
    });
  });

  const closeLightbox = () => {
    lightboxBackdrop?.classList.remove('is-open');
  };
  lightboxClose?.addEventListener('click', closeLightbox);
  lightboxBackdrop?.addEventListener('click', (e) => {
    if (e.target === lightboxBackdrop) closeLightbox();
  });
}
