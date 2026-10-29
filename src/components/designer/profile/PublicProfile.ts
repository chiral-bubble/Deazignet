/**
 * PublicProfile Component
 * Public designer profile page (/designers/:id) viewed by clients and peer designers.
 * Enforces role-based action buttons (Client with proposal vs without, Peer designer, Self).
 * Two-column desktop layout (max-width 1100px) with sticky right details panel,
 * and sticky bottom bar on mobile.
 */

import {
  getPublicProfile,
  getViewerRole,
  hasClientReceivedProposal,
  type DesignerProfile,
  type ViewerRole,
  getActiveLoggedUserId,
  isDesignerSaved,
  toggleSaveDesigner
} from '../../../services/designerProfileService';
import { renderProjectLightboxModal, initProjectLightboxModal } from './ProjectLightboxModal';

export function renderPublicProfile(
  designer: DesignerProfile,
  viewerRole: ViewerRole,
  hasReceivedProposal: boolean,
  isSelf: boolean
): string {
  const isVerified = (designer.credentials || []).some((c) => c.status === 'verified');
  const initial = (designer.name || 'D').slice(0, 2).toUpperCase();
  const sortedPortfolio = [...(designer.portfolio || [])].sort((a, b) => a.order - b.order);
  const reviews = designer.reviews || [];

  return `
    <div class="dez-public-profile-container" id="dez-public-profile-root">
      
      <!-- Back / Breadcrumb Navigation -->
      <div class="dez-pub-breadcrumb">
        <button type="button" class="dez-link-action" id="btn-pub-back">
          &larr; Back to Studio
        </button>
        <span class="dez-pub-sep">/</span>
        <span>Architect Directory</span>
        <span class="dez-pub-sep">/</span>
        <span class="dez-pub-curr">${designer.name}</span>
      </div>

      <!-- Public Profile Header Card (Hero) -->
      <header class="dez-pub-header-card">
        <div class="dez-pub-header-top">
          <!-- Avatar + Availability Indicator -->
          <div class="dez-pub-avatar-wrap">
            ${
              designer.avatarUrl
                ? `<img src="${designer.avatarUrl}" alt="${designer.name}" class="dez-pub-avatar-img" />`
                : `<div class="dez-pub-avatar-placeholder">${initial}</div>`
            }
            ${
              designer.isAvailableForProjects
                ? `<span class="dez-pub-avail-badge" title="Available for new commissions">Available</span>`
                : `<span class="dez-pub-booked-badge" title="Currently fully booked">Booked</span>`
            }
          </div>

          <!-- Identity Details -->
          <div class="dez-pub-identity">
            <div class="dez-pub-name-row">
              <h1 class="dez-pub-name">${designer.name}</h1>
              ${
                isVerified
                  ? `
                <div class="dez-pub-verified-pill" title="Regulatory council authenticated accreditation">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Verified designer</span>
                </div>
              `
                  : ''
              }
            </div>

            <p class="dez-pub-title">
              ${designer.professionalTitle}
              ${designer.companyName ? ` &bull; <span class="dez-pub-company">${designer.companyName}</span>` : ''}
            </p>

            <div class="dez-pub-location-row">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--dez-text-muted);"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${designer.location.city}, ${designer.location.state}, ${designer.location.country}</span>
            </div>
          </div>

          <!-- Desktop Role-Based Action Buttons -->
          <div class="dez-pub-actions-desktop" id="pub-actions-slot">
            ${renderRoleActions(viewerRole, hasReceivedProposal, isSelf)}
          </div>
        </div>

        <!-- Plain Key Numbers Metric Row (4 equal metrics) -->
        <div class="dez-pub-metrics-strip">
          <div class="dez-pub-metric-item">
            <span class="dez-pub-metric-val">${designer.stats.projectsCompleted}</span>
            <span class="dez-pub-metric-lbl">Projects completed</span>
          </div>
          <div class="dez-pub-metric-item">
            <span class="dez-pub-metric-val">
              ${
                designer.stats.averageRating > 0
                  ? `${designer.stats.averageRating.toFixed(2)} ★`
                  : '&mdash;'
              }
            </span>
            <span class="dez-pub-metric-lbl">Average rating (${designer.stats.reviewCount})</span>
          </div>
          <div class="dez-pub-metric-item">
            <span class="dez-pub-metric-val">${designer.yearsOfExperience} yrs</span>
            <span class="dez-pub-metric-lbl">Experience</span>
          </div>
          <div class="dez-pub-metric-item">
            <span class="dez-pub-metric-val">${designer.stats.responseTime}</span>
            <span class="dez-pub-metric-lbl">Response time</span>
          </div>
        </div>
      </header>

      <!-- Main Two-Column Body -->
      <div class="dez-pub-body-grid">
        <!-- LEFT COLUMN: About, Portfolio, Services, Reviews -->
        <div class="dez-pub-left-col">
          <!-- About Section -->
          <section class="dez-pub-section-card">
            <h2 class="dez-pub-sec-title">About the Practice</h2>
            <p class="dez-pub-about-text">
              ${designer.about || 'Specialized architectural design practice focusing on residential and commercial commissions internationally.'}
            </p>
          </section>

          <!-- Portfolio Section -->
          <section class="dez-pub-section-card">
            <div class="dez-pub-sec-header">
              <h2 class="dez-pub-sec-title">Portfolio & Built Commissions</h2>
              <span class="dez-pub-sec-count">${sortedPortfolio.length} projects</span>
            </div>

            ${
              sortedPortfolio.length === 0
                ? `<div class="dez-empty-subtext" style="padding: 24px 0;">No portfolio projects uploaded yet.</div>`
                : `
              <div class="dez-pub-portfolio-grid">
                ${sortedPortfolio
                  .map((proj) => {
                    const cover = proj.images.find((im) => im.isCover) || proj.images[0];
                    const imgUrl = cover?.url || '';

                    return `
                    <div class="dez-pub-port-card" data-project-id="${proj.id}" role="button" tabindex="0" aria-label="View project ${proj.title}">
                      <div class="dez-pub-port-cover">
                        ${imgUrl ? `<img src="${imgUrl}" alt="${proj.title}" class="dez-pub-port-img" />` : ''}
                        <span class="dez-port-card-category">${proj.category}</span>
                        <div class="dez-pub-port-img-count">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                          ${proj.images.length}
                        </div>
                      </div>
                      <div class="dez-pub-port-body">
                        <div class="dez-pub-port-title-row">
                          <h3 class="dez-pub-port-title">${proj.title}</h3>
                          <span class="dez-pub-port-year">${proj.year}</span>
                        </div>
                        <p class="dez-pub-port-loc">${proj.location} &bull; ${proj.role}</p>
                        <p class="dez-pub-port-desc">${proj.shortDescription}</p>
                      </div>
                    </div>
                  `;
                  })
                  .join('')}
              </div>
            `
            }
          </section>

          <!-- Services & Specializations -->
          <section class="dez-pub-section-card">
            <h2 class="dez-pub-sec-title">Services & Specializations</h2>
            <div class="dez-pub-chips-wrap" style="margin-top: 14px;">
              ${(designer.specializations || [])
                .map((s) => `<span class="dez-pub-chip">${s}</span>`)
                .join('')}
            </div>
            ${
              designer.availabilityNote
                ? `
              <div class="dez-avail-note-box" style="margin-top: 16px;">
                <strong>Availability Note:</strong> ${designer.availabilityNote}
              </div>
            `
                : ''
            }
          </section>

          <!-- Client Reviews -->
          <section class="dez-pub-section-card">
            <div class="dez-pub-sec-header">
              <h2 class="dez-pub-sec-title">Client Reviews & Testimonials</h2>
              <span class="dez-pub-sec-count">${reviews.length} reviews</span>
            </div>

            ${
              reviews.length === 0
                ? `
              <div class="dez-empty-reviews-box">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--dez-text-muted); margin-bottom:8px;">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                <div class="dez-empty-title" style="font-size:14px;">No reviews yet</div>
                <div class="dez-empty-subtext">Verified client reviews appear here upon milestone completion and escrow release.</div>
              </div>
            `
                : `
              <div class="dez-pub-reviews-list">
                ${reviews
                  .map(
                    (rev) => `
                  <article class="dez-pub-rev-item">
                    <div class="dez-pub-rev-top">
                      <div>
                        <strong class="dez-pub-rev-client">${rev.clientName}</strong>
                        ${rev.clientCompany ? `<span class="dez-pub-rev-company">(${rev.clientCompany})</span>` : ''}
                      </div>
                      <span class="dez-pub-rev-date">${rev.date}</span>
                    </div>

                    <div class="dez-pub-rev-stars">
                      ${Array.from({ length: 5 })
                        .map(
                          (_, i) => `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="${i < rev.rating ? '#EAB308' : 'none'}" stroke="#EAB308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      `
                        )
                        .join('')}
                    </div>

                    <p class="dez-pub-rev-text">${rev.reviewText}</p>
                    <div class="dez-pub-rev-project">Commission: <strong>${rev.projectName}</strong></div>
                  </article>
                `
                  )
                  .join('')}
              </div>
            `
            }
          </section>
        </div>

        <!-- RIGHT COLUMN (Sticky on Desktop): Studio Overview & Credentials -->
        <aside class="dez-pub-right-col">
          <div class="dez-pub-sticky-panel">
            <h3 class="dez-pub-side-title">Studio Overview</h3>

            <div class="dez-pub-detail-list">
              <div class="dez-pub-detail-row">
                <span class="dez-detail-label">Profession</span>
                <span class="dez-detail-value">${designer.professionalType}</span>
              </div>

              <div class="dez-pub-detail-row">
                <span class="dez-detail-label">Location</span>
                <span class="dez-detail-value">${designer.location.city}, ${designer.location.state}</span>
              </div>

              <div class="dez-pub-detail-row">
                <span class="dez-detail-label">Languages</span>
                <span class="dez-detail-value">${(designer.languages || ['English']).join(', ')}</span>
              </div>

              <div class="dez-pub-detail-row">
                <span class="dez-detail-label">Experience</span>
                <span class="dez-detail-value">${designer.yearsOfExperience} years</span>
              </div>

              <div class="dez-pub-detail-row">
                <span class="dez-detail-label">Member since</span>
                <span class="dez-detail-value">${designer.memberSince}</span>
              </div>

              ${
                designer.hourlyRate && !(viewerRole === 'designer' && designer.hideRateFromPeers)
                  ? `
                <div class="dez-pub-detail-row">
                  <span class="dez-detail-label">Hourly rate</span>
                  <span class="dez-detail-value"><strong>$${designer.hourlyRate}/hr</strong></span>
                </div>
              `
                  : ''
              }
            </div>

            <!-- Credentials Section (Partially Masked Reg Numbers) -->
            <div class="dez-pub-side-divider"></div>
            <h4 class="dez-pub-side-subtitle">Council Accreditation</h4>

            <div class="dez-pub-creds-side-list">
              ${
                (designer.credentials || []).length === 0
                  ? `<div class="dez-empty-subtext" style="font-size:12.5px;">Accreditation pending council verification.</div>`
                  : (designer.credentials || [])
                      .map((c) => {
                        const mask = c.registrationNumber.slice(0, 2) + '••••' + c.registrationNumber.slice(-2);
                        return `
                    <div class="dez-pub-cred-item">
                      <div class="dez-pub-cred-header">
                        <strong class="dez-pub-cred-body">${c.registrationBody}</strong>
                        ${
                          c.status === 'verified'
                            ? `<span class="dez-status-plain is-verified" style="font-size:12px;">Verified</span>`
                            : `<span class="dez-status-plain is-pending" style="font-size:12px;">Pending</span>`
                        }
                      </div>
                      <div class="dez-pub-cred-num">Reg No: <strong>${mask}</strong></div>
                      <div class="dez-pub-cred-meta">${c.stateOrRegion} &bull; Est. ${c.year}</div>
                    </div>
                  `;
                      })
                      .join('')
              }
            </div>
          </div>
        </aside>
      </div>

      <!-- Mobile Sticky Bottom Action Bar -->
      <div class="dez-pub-mobile-sticky-bar">
        ${renderRoleActions(viewerRole, hasReceivedProposal, isSelf, true)}
      </div>

      <!-- Lightbox Slot -->
      <div id="pub-lightbox-slot"></div>

      <!-- Invite to Project Modal (Mock interaction) -->
      <div class="dez-dash-modal-backdrop" id="modal-invite-designer" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-invite-title">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-invite-title">Invite ${designer.name} to Project</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-invite-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size:13.5px; color:var(--dez-text-primary); margin-bottom:14px; line-height:1.5;">
              Select an active project to invite <strong>${designer.name}</strong> to submit an architectural proposal:
            </p>
            <div class="dez-form-group">
              <label for="invite-project-select" class="dez-label">Your Client Projects</label>
              <select id="invite-project-select" class="dez-select">
                <option value="proj-1">Lakefront Contemporary Villa, Lucerne</option>
                <option value="proj-2">Alpine High-Rise Commercial Atrium</option>
                <option value="proj-3">Ibadan Heritage Compound Renovation</option>
              </select>
            </div>
            <div class="dez-form-group">
              <label for="invite-custom-note" class="dez-label">Invitation Message <span class="dez-opt">(Optional)</span></label>
              <textarea id="invite-custom-note" class="dez-textarea" rows="3" placeholder="Hello Alexandre, we admired your Lake Zurich Waterfront Pavilion and would like you to bid on our upcoming villa..."></textarea>
            </div>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-invite" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-send-invitation" style="height:36px; padding:0 20px;">
              Send invitation
            </button>
          </div>
        </div>
      </div>

      <!-- Message Modal (Mock interaction for Client who received proposal) -->
      <div class="dez-dash-modal-backdrop" id="modal-message-designer" style="display: none;" role="dialog" aria-modal="true" aria-labelledby="modal-msg-title">
        <div class="dez-dash-modal" style="max-width: 480px;">
          <div class="dez-dash-modal-header">
            <h3 class="dez-dash-modal-title" id="modal-msg-title">Message ${designer.name}</h3>
            <button type="button" class="dez-dash-modal-close" id="btn-close-msg-modal" aria-label="Close modal">&times;</button>
          </div>
          <div class="dez-dash-modal-body">
            <p style="font-size:13px; color:var(--dez-text-muted); margin-bottom:12px;">
              Re: Received Architectural Proposal &bull; Escrow Protected
            </p>
            <div class="dez-form-group">
              <label for="quick-msg-input" class="dez-label">Message</label>
              <textarea id="quick-msg-input" class="dez-textarea" rows="4" placeholder="Write a message to discuss project milestones, architectural drawings, or delivery timelines..."></textarea>
            </div>
          </div>
          <div class="dez-dash-modal-footer">
            <button type="button" class="dez-btn-secondary" id="btn-cancel-msg" style="height:36px;">Cancel</button>
            <button type="button" class="dez-btn-primary" id="btn-send-quick-msg" style="height:36px; padding:0 20px;">
              Send message
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRoleActions(
  viewerRole: ViewerRole,
  hasReceivedProposal: boolean,
  isSelf: boolean,
  isMobile = false
): string {
  // Rule 1: The designer viewing their own profile -> "Edit profile" button
  if (isSelf) {
    return `
      <button type="button" class="dez-btn-primary" id="${isMobile ? 'btn-m-edit-profile' : 'btn-pub-edit-profile'}" style="height:36px; padding:0 18px; ${isMobile ? 'width:100%;' : ''}">
        Edit profile
      </button>
    `;
  }

  // Rule 2: Peer Designer viewing another designer -> NO message or invite buttons, only "Save designer" and "Back to results"
  if (viewerRole === 'designer') {
    return `
      <div style="display: flex; gap: 8px; align-items: center; ${isMobile ? 'width: 100%;' : ''}">
        <button type="button" class="dez-btn-secondary" id="${isMobile ? 'btn-m-save-designer' : 'btn-pub-save-designer'}" style="height:36px; padding:0 14px; font-size:13px; display:inline-flex; align-items: center; gap: 6px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          <span class="save-label">Save designer</span>
        </button>
        <button type="button" class="dez-btn-secondary" id="${isMobile ? 'btn-m-back-results' : 'btn-pub-back-results'}" style="height:36px; padding:0 14px; font-size:13px;">
          Back to results
        </button>
      </div>
    `;
  }

  // Rule 3: Client viewing
  return `
    <div class="dez-pub-client-actions ${isMobile ? 'is-mobile' : ''}">
      <button type="button" class="dez-btn-primary" id="${isMobile ? 'btn-m-invite' : 'btn-pub-invite'}" style="height:36px; padding:0 18px; ${isMobile ? 'flex:1;' : ''}">
        Invite to project
      </button>

      ${
        hasReceivedProposal
          ? `
        <button type="button" class="dez-btn-secondary" id="${isMobile ? 'btn-m-message' : 'btn-pub-message'}" style="height:36px; padding:0 16px; ${isMobile ? 'flex:1;' : ''}">
          Message
        </button>
      `
          : `
        <div class="dez-pub-message-disabled-hint" title="You can message a designer after reviewing their proposal.">
          <span class="dez-hint-text">You can message a designer after reviewing their proposal.</span>
        </div>
      `
      }
    </div>
  `;
}

export async function initPublicProfile(
  container: HTMLElement,
  designerId: string,
  callbacks: {
    onBack: () => void;
    onEditProfile: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): Promise<void> {
  const root = container.querySelector('#dez-public-profile-root') as HTMLElement;
  if (!root) return;

  const designer = await getPublicProfile(designerId);
  if (!designer) {
    container.innerHTML = `
      <div style="padding:48px; text-align:center;">
        <h2>Designer Profile Not Found</h2>
        <p style="color:var(--dez-text-muted); margin-top:8px;">The requested designer profile does not exist.</p>
        <button type="button" class="dez-btn-primary" id="btn-missing-back" style="margin-top:16px;">&larr; Back to Studio</button>
      </div>
    `;
    container.querySelector('#btn-missing-back')?.addEventListener('click', callbacks.onBack);
    return;
  }

  const viewerRole = getViewerRole();
  const hasReceivedProp = hasClientReceivedProposal(designer.id);
  const isSelf = viewerRole === 'self' || designer.id === getActiveLoggedUserId();

  // Re-render with resolved designer
  container.innerHTML = renderPublicProfile(designer, viewerRole, hasReceivedProp, isSelf);

  const newRoot = container.querySelector('#dez-public-profile-root') as HTMLElement;
  if (!newRoot) return;

  // Back button
  newRoot.querySelector('#btn-pub-back')?.addEventListener('click', callbacks.onBack);

  // Peer Designer View Actions
  const btnSavePeer = newRoot.querySelector('#btn-pub-save-designer') as HTMLButtonElement;
  const btnMSavePeer = newRoot.querySelector('#btn-m-save-designer') as HTMLButtonElement;
  [btnSavePeer, btnMSavePeer].forEach((btn) => {
    if (!btn) return;
    const isSaved = isDesignerSaved(designer.id);
    const labelSpan = btn.querySelector('.save-label');
    if (labelSpan) labelSpan.textContent = isSaved ? 'Saved designer' : 'Save designer';
    if (isSaved) btn.classList.add('is-active');

    btn.addEventListener('click', () => {
      const nowSaved = toggleSaveDesigner(designer.id);
      if (labelSpan) labelSpan.textContent = nowSaved ? 'Saved designer' : 'Save designer';
      btn.classList.toggle('is-active', nowSaved);
      callbacks.onShowToast(
        nowSaved ? 'Designer Saved' : 'Removed from Saved',
        nowSaved ? `${designer.name} added to your saved talent.` : `${designer.name} removed from saved.`,
        'info'
      );
    });
  });

  const btnBackResults = newRoot.querySelector('#btn-pub-back-results') as HTMLButtonElement;
  const btnMBackResults = newRoot.querySelector('#btn-m-back-results') as HTMLButtonElement;
  [btnBackResults, btnMBackResults].forEach((btn) => {
    btn?.addEventListener('click', () => {
      window.location.hash = '#client-projects?type=designers';
    });
  });

  // Edit profile button (Self view)
  const editBtn = newRoot.querySelector('#btn-pub-edit-profile') as HTMLButtonElement;
  const mEditBtn = newRoot.querySelector('#btn-m-edit-profile') as HTMLButtonElement;
  [editBtn, mEditBtn].forEach((b) => {
    b?.addEventListener('click', callbacks.onEditProfile);
  });

  // Invite modal
  const inviteModal = newRoot.querySelector('#modal-invite-designer') as HTMLElement;
  const btnCloseInvite = newRoot.querySelector('#btn-close-invite-modal') as HTMLButtonElement;
  const btnCancelInvite = newRoot.querySelector('#btn-cancel-invite') as HTMLButtonElement;
  const btnSendInvite = newRoot.querySelector('#btn-send-invitation') as HTMLButtonElement;
  const inviteSelect = newRoot.querySelector('#invite-project-select') as HTMLSelectElement;

  const openInvite = () => {
    if (inviteModal) {
      inviteModal.style.display = 'flex';
      inviteModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };
  const closeInvite = () => {
    if (inviteModal) {
      inviteModal.style.display = 'none';
      inviteModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  newRoot.querySelector('#btn-pub-invite')?.addEventListener('click', openInvite);
  newRoot.querySelector('#btn-m-invite')?.addEventListener('click', openInvite);
  btnCloseInvite?.addEventListener('click', closeInvite);
  btnCancelInvite?.addEventListener('click', closeInvite);
  inviteModal?.addEventListener('click', (e) => {
    if (e.target === inviteModal) closeInvite();
  });

  btnSendInvite?.addEventListener('click', () => {
    const projName = inviteSelect.options[inviteSelect.selectedIndex]?.text || 'Project';
    closeInvite();
    callbacks.onShowToast('Invitation Sent', `Invited ${designer.name} to bid on "${projName}".`, 'success');
  });

  // Message modal
  const msgModal = newRoot.querySelector('#modal-message-designer') as HTMLElement;
  const btnCloseMsg = newRoot.querySelector('#btn-close-msg-modal') as HTMLButtonElement;
  const btnCancelMsg = newRoot.querySelector('#btn-cancel-msg') as HTMLButtonElement;
  const btnSendMsg = newRoot.querySelector('#btn-send-quick-msg') as HTMLButtonElement;
  const msgInput = newRoot.querySelector('#quick-msg-input') as HTMLTextAreaElement;

  const openMsg = () => {
    if (msgModal) {
      msgModal.style.display = 'flex';
      msgModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (msgInput) msgInput.value = '';
    }
  };
  const closeMsg = () => {
    if (msgModal) {
      msgModal.style.display = 'none';
      msgModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  newRoot.querySelector('#btn-pub-message')?.addEventListener('click', openMsg);
  newRoot.querySelector('#btn-m-message')?.addEventListener('click', openMsg);
  btnCloseMsg?.addEventListener('click', closeMsg);
  btnCancelMsg?.addEventListener('click', closeMsg);
  msgModal?.addEventListener('click', (e) => {
    if (e.target === msgModal) closeMsg();
  });

  btnSendMsg?.addEventListener('click', () => {
    const txt = msgInput?.value.trim() || '';
    if (!txt) return;
    closeMsg();
    callbacks.onShowToast('Message Sent', `Your message was delivered to ${designer.name}.`, 'success');
  });

  // Portfolio items click -> Lightbox Modal
  const lightboxSlot = newRoot.querySelector('#pub-lightbox-slot') as HTMLElement;
  newRoot.querySelectorAll<HTMLElement>('.dez-pub-port-card').forEach((card) => {
    card.addEventListener('click', () => {
      const pid = card.getAttribute('data-project-id');
      const project = designer.portfolio.find((p) => p.id === pid);
      if (!project || !lightboxSlot) return;

      lightboxSlot.innerHTML = renderProjectLightboxModal(project);
      initProjectLightboxModal(lightboxSlot, project, () => {
        lightboxSlot.innerHTML = '';
      });
    });
  });
}
