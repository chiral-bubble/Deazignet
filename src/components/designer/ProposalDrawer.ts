/**
 * ProposalDrawer Component (Designer View)
 * 3-step structured proposal drawer with draft autosaving, live fee calculation,
 * portfolio attachment, and validation.
 */

import {
  saveProposalDraft,
  getProposalDraft,
  submitProposal,
  type Project,
  type ProposalSubmission
} from '../../services/projectsService';

const PLATFORM_FEE_PERCENT = 10;

// Available portfolio items for quick selection
const mockDesignerPortfolio = [
  { id: 'port-1', title: 'Pacific Palisades Minimalist Villa', url: '/hero-frames/frame_0010.webp' },
  { id: 'port-2', title: 'Tribeca Loft Penthouse Interior', url: '/hero-frames/frame_0050.webp' },
  { id: 'port-3', title: 'Shoreditch Tech Co-working Space', url: '/hero-frames/frame_0090.webp' },
  { id: 'port-4', title: 'Malibu Coastal Glass Pavilion', url: '/hero-frames/frame_0130.webp' }
];

export function renderProposalDrawer(_project: Project): string {
  return `
    <div class="dez-drawer-backdrop" id="dez-proposal-backdrop" aria-hidden="true" style="display: none;"></div>
    <div 
      class="dez-proposal-drawer" 
      id="dez-proposal-drawer" 
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="dez-drawer-title"
    >
      <!-- Header -->
      <header class="dez-drawer-header">
        <h2 class="dez-drawer-title" id="dez-drawer-title">Submit Proposal</h2>
        <button type="button" class="dez-btn-close-drawer" id="dez-drawer-close-btn" aria-label="Close drawer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </header>

      <!-- 3-Step Progress Indicator -->
      <div class="dez-progress-bar-row" id="dez-drawer-steps-bar">
        <div class="dez-step-indicator is-active" data-step="1">
          <div class="dez-step-track"></div>
          <span class="dez-step-text">1. Your offer</span>
        </div>
        <div class="dez-step-indicator" data-step="2">
          <div class="dez-step-track"></div>
          <span class="dez-step-text">2. Supporting material</span>
        </div>
        <div class="dez-step-indicator" data-step="3">
          <div class="dez-step-track"></div>
          <span class="dez-step-text">3. Review & submit</span>
        </div>
      </div>

      <!-- Drawer Body (Dynamically populated by current step) -->
      <div class="dez-drawer-body" id="dez-drawer-body">
        <!-- Injected by step controller -->
      </div>

      <!-- Drawer Footer Controls -->
      <footer class="dez-drawer-footer" id="dez-drawer-footer">
        <button type="button" class="dez-btn-secondary" id="dez-drawer-back-btn" style="visibility:hidden">
          Back
        </button>
        <button type="button" class="dez-btn-primary" id="dez-drawer-next-btn" style="width:auto; min-width:140px;">
          Continue
        </button>
      </footer>
    </div>
  `;
}

/**
 * Controller for Proposal Drawer: steps, draft autosave, validation, and submission
 */
export function initProposalDrawer(
  container: HTMLElement,
  project: Project,
  onProposalSubmittedSuccessfully: () => void,
  onNavigateToMyProposals: () => void,
  onBackToFeed: () => void
): { open: () => void; close: () => void } {
  let currentStep = 1;
  let isDirty = false;

  // Restore draft or initialize default values
  const draft = getProposalDraft(project.id);
  const formData: {
    coverLetter: string;
    proposedTotal: number;
    milestonePercentages: Record<string, number>;
    hourlyRate: number;
    estimatedHours: number;
    deliveryTime: string;
    portfolioItems: string[];
    clientQuestion: string;
  } = {
    coverLetter: draft?.coverLetter || '',
    proposedTotal: draft?.proposedTotal || project.budget,
    milestonePercentages: draft?.milestonePercentages || {},
    hourlyRate: draft?.hourlyRate || project.hourlyRate || 85,
    estimatedHours: draft?.estimatedHours || project.estimatedHours || 120,
    deliveryTime: draft?.deliveryTime || project.timeline,
    portfolioItems: draft?.portfolioItems || [mockDesignerPortfolio[0].url],
    clientQuestion: draft?.clientQuestion || ''
  };

  // Pre-fill milestone default percentages if empty
  if (project.paymentType === 'Milestone' && project.milestones) {
    project.milestones.forEach((m) => {
      if (formData.milestonePercentages[m.id] === undefined) {
        formData.milestonePercentages[m.id] = m.defaultFeePercentage;
      }
    });
  }

  const backdrop = container.querySelector('#dez-proposal-backdrop') as HTMLElement | null;
  const drawer = container.querySelector('#dez-proposal-drawer') as HTMLElement | null;
  const body = container.querySelector('#dez-drawer-body') as HTMLElement | null;
  const backBtn = container.querySelector('#dez-drawer-back-btn') as HTMLButtonElement | null;
  const nextBtn = container.querySelector('#dez-drawer-next-btn') as HTMLButtonElement | null;
  const closeBtn = container.querySelector('#dez-drawer-close-btn');

  function autosave() {
    isDirty = true;
    saveProposalDraft(project.id, {
      coverLetter: formData.coverLetter,
      proposedTotal: formData.proposedTotal,
      milestonePercentages: formData.milestonePercentages,
      hourlyRate: formData.hourlyRate,
      estimatedHours: formData.estimatedHours,
      deliveryTime: formData.deliveryTime,
      portfolioItems: formData.portfolioItems,
      clientQuestion: formData.clientQuestion
    });
  }

  function updateStepsBar() {
    container.querySelectorAll('.dez-step-indicator').forEach((ind) => {
      const stepNum = parseInt(ind.getAttribute('data-step') || '1', 10);
      ind.classList.toggle('is-active', stepNum === currentStep);
      ind.classList.toggle('is-completed', stepNum < currentStep);
    });
  }

  function renderCurrentStep() {
    if (!body || !backBtn || !nextBtn) return;
    updateStepsBar();

    // Footer button visibility
    backBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    nextBtn.textContent = currentStep === 3 ? 'Submit Proposal' : 'Continue';

    if (currentStep === 1) {
      renderStep1();
    } else if (currentStep === 2) {
      renderStep2();
    } else if (currentStep === 3) {
      renderStep3();
    }
  }

  // -----------------------------------------------------------
  // STEP 1: Your offer
  // -----------------------------------------------------------
  function renderStep1() {
    if (!body) return;

    let offerSectionHtml = '';
    if (project.paymentType === 'Milestone' && project.milestones) {
      // Calculate current percentage sum
      const currentSum = Object.values(formData.milestonePercentages).reduce((a, b) => a + b, 0);
      const isSumValid = currentSum === 100;

      offerSectionHtml = `
        <div class="dez-form-group">
          <label class="dez-form-label">Proposed Total Project Fee ($ USD)</label>
          <div style="display:flex; align-items:center; gap:12px;">
            <input 
              type="number" 
              class="dez-input-search" 
              id="dez-offer-total-price" 
              value="${formData.proposedTotal}" 
              min="1000"
              style="width:200px"
            />
            <span style="font-size:13px; color:var(--dez-text-muted)">
              Client budget: <strong>$${project.budget.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        <div class="dez-form-group">
          <label class="dez-form-label">Milestone Fee Allocation</label>
          <span class="dez-form-sublabel">Specify the percentage for each phase. Percentages must add up to exactly 100%.</span>
          
          <table class="dez-milestone-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th style="width:80px; text-align:right">Fee %</th>
                <th style="width:110px; text-align:right">Amount ($)</th>
              </tr>
            </thead>
            <tbody>
              ${project.milestones
                .map((m) => {
                  const pct = formData.milestonePercentages[m.id] ?? m.defaultFeePercentage;
                  const amt = Math.round((formData.proposedTotal * pct) / 100);
                  return `
                  <tr>
                    <td><strong>${m.name}</strong></td>
                    <td style="text-align:right">
                      <input 
                        type="number" 
                        class="dez-input-pct" 
                        data-phase-id="${m.id}" 
                        value="${pct}" 
                        min="0" 
                        max="100" 
                      /> %
                    </td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; font-weight:500;">
                      $${amt.toLocaleString()}
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>

          <div class="dez-fee-sum-row ${isSumValid ? '' : 'is-error'}" id="dez-fee-sum-row">
            <span>Total Allocation:</span>
            <strong id="dez-fee-sum-display">${currentSum}% ${isSumValid ? '✓' : '(Must equal 100%)'}</strong>
          </div>
        </div>
      `;
    } else {
      // Hourly terms
      const hourlyTotal = formData.hourlyRate * formData.estimatedHours;
      offerSectionHtml = `
        <div class="dez-form-group">
          <label class="dez-form-label">Your Hourly Rate ($/hr)</label>
          <input 
            type="number" 
            class="dez-input-search" 
            id="dez-offer-hourly-rate" 
            value="${formData.hourlyRate}" 
            style="width:180px"
          />
        </div>

        <div class="dez-form-group">
          <label class="dez-form-label">Estimated Hours</label>
          <input 
            type="number" 
            class="dez-input-search" 
            id="dez-offer-hours" 
            value="${formData.estimatedHours}" 
            style="width:180px"
          />
          <span style="font-size:13px; color:var(--dez-text-muted); margin-top:4px;">
            Calculated total estimated cost: <strong id="dez-hourly-calc-total">$${hourlyTotal.toLocaleString()}</strong>
          </span>
        </div>
      `;
    }

    body.innerHTML = `
      <!-- Cover Letter -->
      <div class="dez-form-group">
        <label class="dez-form-label" for="dez-cover-letter">Cover Letter & Approach</label>
        <span class="dez-form-sublabel">Introduce your architectural studio, design methodology, and qualifications for this brief.</span>
        <textarea 
          id="dez-cover-letter" 
          class="dez-textarea" 
          maxlength="1500" 
          placeholder="Describe your design philosophy, past relevant projects, and initial thoughts on this site..."
        >${formData.coverLetter}</textarea>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="dez-helper-prompts">
            <span data-prompt="I have led similar high-end residential commissions and can deliver permit-ready CAD/BIM drawings.">
              + Mention similar projects you've done
            </span>
            <span data-prompt="Our approach prioritizes sustainable natural ventilation, solar orientation, and cost efficiency.">
              + Add methodology summary
            </span>
            <span data-prompt="We are available to start immediately upon milestone agreement sign-off.">
              + Confirm availability
            </span>
          </div>
          <span class="dez-char-counter" id="dez-char-count">${formData.coverLetter.length} / 1,500</span>
        </div>
      </div>

      <!-- Fee & Delivery -->
      ${offerSectionHtml}

      <div class="dez-form-group">
        <label class="dez-form-label" for="dez-delivery-time">Estimated Delivery Timeline</label>
        <input 
          type="text" 
          id="dez-delivery-time" 
          class="dez-input-search" 
          value="${formData.deliveryTime}" 
          placeholder="e.g. 14 Weeks"
          style="width:240px"
        />
      </div>

      <div id="dez-step-error-msg" style="color:var(--dez-status-red-text); font-size:13px; display:none;"></div>
    `;

    // Cover letter input & counter
    const letterInput = body.querySelector('#dez-cover-letter') as HTMLTextAreaElement | null;
    const charCounter = body.querySelector('#dez-char-count');
    letterInput?.addEventListener('input', () => {
      formData.coverLetter = letterInput.value;
      if (charCounter) charCounter.textContent = `${letterInput.value.length} / 1,500`;
      autosave();
    });

    // Helper prompt inserters
    body.querySelectorAll('[data-prompt]').forEach((promptBtn) => {
      promptBtn.addEventListener('click', () => {
        const text = promptBtn.getAttribute('data-prompt');
        if (letterInput && text) {
          letterInput.value = (letterInput.value ? letterInput.value + '\n\n' : '') + text;
          formData.coverLetter = letterInput.value;
          if (charCounter) charCounter.textContent = `${letterInput.value.length} / 1,500`;
          autosave();
        }
      });
    });

    // Proposed total price input
    const totalPriceInput = body.querySelector('#dez-offer-total-price') as HTMLInputElement | null;
    totalPriceInput?.addEventListener('input', () => {
      formData.proposedTotal = parseInt(totalPriceInput.value || '0', 10);
      autosave();
      renderCurrentStep(); // recalculate amounts
    });

    // Milestone percentages inputs
    body.querySelectorAll('.dez-input-pct').forEach((input) => {
      input.addEventListener('input', () => {
        const phaseId = input.getAttribute('data-phase-id');
        const val = parseInt((input as HTMLInputElement).value || '0', 10);
        if (phaseId) {
          formData.milestonePercentages[phaseId] = val;
          autosave();

          // update sum row live
          const sum = Object.values(formData.milestonePercentages).reduce((a, b) => a + b, 0);
          const sumRow = body.querySelector('#dez-fee-sum-row');
          const sumDisp = body.querySelector('#dez-fee-sum-display');
          if (sumRow && sumDisp) {
            const valid = sum === 100;
            sumRow.className = `dez-fee-sum-row ${valid ? '' : 'is-error'}`;
            sumDisp.textContent = `${sum}% ${valid ? '✓' : '(Must equal 100%)'}`;
          }
        }
      });
    });

    // Hourly inputs
    const hourlyRateInput = body.querySelector('#dez-offer-hourly-rate') as HTMLInputElement | null;
    const hoursInput = body.querySelector('#dez-offer-hours') as HTMLInputElement | null;
    const updateHourly = () => {
      formData.hourlyRate = parseInt(hourlyRateInput?.value || '0', 10);
      formData.estimatedHours = parseInt(hoursInput?.value || '0', 10);
      formData.proposedTotal = formData.hourlyRate * formData.estimatedHours;
      const calcTotal = body.querySelector('#dez-hourly-calc-total');
      if (calcTotal) calcTotal.textContent = `$${formData.proposedTotal.toLocaleString()}`;
      autosave();
    };
    hourlyRateInput?.addEventListener('input', updateHourly);
    hoursInput?.addEventListener('input', updateHourly);

    // Delivery time input
    const deliveryInput = body.querySelector('#dez-delivery-time') as HTMLInputElement | null;
    deliveryInput?.addEventListener('input', () => {
      formData.deliveryTime = deliveryInput.value;
      autosave();
    });
  }

  // -----------------------------------------------------------
  // STEP 2: Supporting material
  // -----------------------------------------------------------
  function renderStep2() {
    if (!body) return;

    body.innerHTML = `
      <div class="dez-form-group">
        <label class="dez-form-label">Attach Portfolio Samples (1 to 5 items)</label>
        <span class="dez-form-sublabel">Select verified architectural designs to showcase your relevant experience to this client.</span>

        <!-- Dropzone / Quick Select -->
        <div class="dez-upload-dropzone" id="dez-portfolio-dropzone">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--dez-text-muted); margin-bottom:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style="font-size:13px; font-weight:500;">Click or drag to attach portfolio designs</div>
          <span style="font-size:11.5px; color:var(--dez-text-muted);">Supports PNG, JPG, WebP up to 15MB</span>
        </div>

        <!-- Selected Thumbnails List -->
        <div class="dez-portfolio-thumbs" id="dez-portfolio-thumbs-list">
          ${formData.portfolioItems
            .map(
              (url, idx) => `
            <div class="dez-thumb-item">
              <img src="${url}" alt="Portfolio item ${idx + 1}" />
              <button type="button" class="dez-btn-remove-thumb" data-remove-thumb="${idx}" aria-label="Remove item">✕</button>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="dez-form-group" style="margin-top:12px;">
        <label class="dez-form-label" for="dez-client-question">Optional Question for the Client</label>
        <span class="dez-form-sublabel">Ask any clarifying questions regarding soil conditions, permits, or aesthetic references.</span>
        <textarea 
          id="dez-client-question" 
          class="dez-textarea" 
          style="min-height:80px" 
          placeholder="e.g. Does the site already have a certified land survey and soil bore log?"
        >${formData.clientQuestion}</textarea>
      </div>

      <div id="dez-step-error-msg" style="color:var(--dez-status-red-text); font-size:13px; display:none;"></div>
    `;

    // Dropzone attach demo
    body.querySelector('#dez-portfolio-dropzone')?.addEventListener('click', () => {
      if (formData.portfolioItems.length >= 5) {
        alert('You can attach a maximum of 5 portfolio samples.');
        return;
      }
      // Add next available mock portfolio item
      const nextItem = mockDesignerPortfolio.find((m) => !formData.portfolioItems.includes(m.url)) || mockDesignerPortfolio[0];
      formData.portfolioItems.push(nextItem.url);
      autosave();
      renderStep2();
    });

    // Remove thumb buttons
    body.querySelectorAll('[data-remove-thumb]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-remove-thumb') || '0', 10);
        formData.portfolioItems.splice(idx, 1);
        autosave();
        renderStep2();
      });
    });

    // Client question input
    const qInput = body.querySelector('#dez-client-question') as HTMLTextAreaElement | null;
    qInput?.addEventListener('input', () => {
      formData.clientQuestion = qInput.value;
      autosave();
    });
  }

  // -----------------------------------------------------------
  // STEP 3: Review and submit
  // -----------------------------------------------------------
  function renderStep3() {
    if (!body) return;

    const platformFee = Math.round((formData.proposedTotal * PLATFORM_FEE_PERCENT) / 100);
    const netReceivable = formData.proposedTotal - platformFee;

    body.innerHTML = `
      <div class="dez-review-box">
        <div class="dez-review-section-header">
          <span>1. Offer & Proposed Terms</span>
          <span class="dez-edit-step-link" id="dez-edit-step-1">Edit</span>
        </div>
        <div style="font-size:13px; color:var(--dez-text-secondary); display:flex; flex-direction:column; gap:4px;">
          <div>Proposed Total Price: <strong style="color:var(--dez-text-primary);">$${formData.proposedTotal.toLocaleString()}</strong></div>
          <div>Engagement Mode: <strong>${project.paymentType}</strong></div>
          <div>Estimated Delivery: <strong>${formData.deliveryTime}</strong></div>
        </div>
      </div>

      <div class="dez-review-box">
        <div class="dez-review-section-header">
          <span>2. Cover Letter Preview</span>
          <span class="dez-edit-step-link" id="dez-edit-step-1-letter">Edit</span>
        </div>
        <p style="font-size:13px; color:var(--dez-text-secondary); line-height:1.5; white-space:pre-line;">
          ${formData.coverLetter || 'No cover letter provided.'}
        </p>
      </div>

      <div class="dez-review-box">
        <div class="dez-review-section-header">
          <span>3. Supporting Material (${formData.portfolioItems.length} attachments)</span>
          <span class="dez-edit-step-link" id="dez-edit-step-2">Edit</span>
        </div>
        <div class="dez-portfolio-thumbs" style="grid-template-columns: repeat(4, 1fr);">
          ${formData.portfolioItems.map((url) => `<div class="dez-thumb-item"><img src="${url}" /></div>`).join('')}
        </div>
        ${
          formData.clientQuestion
            ? `<div style="font-size:12.5px; color:var(--dez-text-muted); margin-top:8px;"><strong>Question for client:</strong> ${formData.clientQuestion}</div>`
            : ''
        }
      </div>

      <!-- Financial Net Calculation & Trust Notice -->
      <div class="dez-fee-notice-banner">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span>Client Total Escrow Deposit:</span>
          <strong>$${formData.proposedTotal.toLocaleString()}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; color:var(--dez-text-muted);">
          <span>Dezignet Studio Platform Fee (${PLATFORM_FEE_PERCENT}%):</span>
          <span>-$${platformFee.toLocaleString()}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:6px; border-top:1px dashed var(--dez-border); font-weight:600; color:var(--dez-text-primary);">
          <span>Your Net Payout:</span>
          <span style="color:var(--dez-brand-blue);">$${netReceivable.toLocaleString()}</span>
        </div>
      </div>

      <p style="font-size:12.5px; color:var(--dez-text-muted); line-height:1.45;">
        The client will review your proposal. If they are interested, they will message you through Dezignet Escrow Messenger to begin milestone discussions.
      </p>

      <div id="dez-step-error-msg" style="color:var(--dez-status-red-text); font-size:13px; display:none;"></div>
    `;

    body.querySelector('#dez-edit-step-1')?.addEventListener('click', () => {
      currentStep = 1;
      renderCurrentStep();
    });
    body.querySelector('#dez-edit-step-1-letter')?.addEventListener('click', () => {
      currentStep = 1;
      renderCurrentStep();
    });
    body.querySelector('#dez-edit-step-2')?.addEventListener('click', () => {
      currentStep = 2;
      renderCurrentStep();
    });
  }

  // -----------------------------------------------------------
  // STEP VALIDATION
  // -----------------------------------------------------------
  function validateCurrentStep(): boolean {
    const errorMsg = body?.querySelector('#dez-step-error-msg') as HTMLElement | null;
    const showError = (text: string) => {
      if (errorMsg) {
        errorMsg.textContent = text;
        errorMsg.style.display = 'block';
      }
    };

    if (errorMsg) errorMsg.style.display = 'none';

    if (currentStep === 1) {
      if (!formData.coverLetter.trim() || formData.coverLetter.trim().length < 20) {
        showError('Please provide a cover letter of at least 20 characters introducing your studio.');
        return false;
      }
      if (formData.proposedTotal <= 0) {
        showError('Please enter a valid proposed total fee.');
        return false;
      }
      if (project.paymentType === 'Milestone' && project.milestones) {
        const sum = Object.values(formData.milestonePercentages).reduce((a, b) => a + b, 0);
        if (sum !== 100) {
          showError(`Milestone allocation percentages must equal 100%. Currently at ${sum}%.`);
          return false;
        }
      }
    } else if (currentStep === 2) {
      if (formData.portfolioItems.length === 0) {
        showError('Please attach at least 1 relevant portfolio design to your proposal.');
        return false;
      }
    }

    return true;
  }

  // -----------------------------------------------------------
  // SUBMISSION LOGIC
  // -----------------------------------------------------------
  async function handleSubmit() {
    if (!nextBtn) return;
    nextBtn.disabled = true;
    nextBtn.textContent = 'Submitting Proposal...';

    // Build milestone offers array if milestone project
    const milestoneOffers = project.milestones?.map((m) => {
      const pct = formData.milestonePercentages[m.id] ?? m.defaultFeePercentage;
      return {
        phaseId: m.id,
        phaseName: m.name,
        feePercentage: pct,
        amount: Math.round((formData.proposedTotal * pct) / 100)
      };
    });

    const payload: ProposalSubmission = {
      projectId: project.id,
      coverLetter: formData.coverLetter,
      proposedTotal: formData.proposedTotal,
      paymentType: project.paymentType,
      milestoneOffers,
      hourlyRate: formData.hourlyRate,
      estimatedHours: formData.estimatedHours,
      deliveryTime: formData.deliveryTime,
      portfolioItems: formData.portfolioItems,
      clientQuestion: formData.clientQuestion
    };

    const res = await submitProposal(project.id, payload);

    if (res.success) {
      isDirty = false;
      showSuccessScreen();
      onProposalSubmittedSuccessfully();
    } else {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Retry Submission';
      const errorMsg = body?.querySelector('#dez-step-error-msg') as HTMLElement | null;
      if (errorMsg) {
        errorMsg.textContent = res.error || 'Failed to submit proposal. Please retry.';
        errorMsg.style.display = 'block';
      }
    }
  }

  function showSuccessScreen() {
    if (!body || !backBtn || !nextBtn) return;
    backBtn.style.display = 'none';
    nextBtn.style.display = 'none';

    body.innerHTML = `
      <div class="dez-success-screen">
        <div class="dez-success-check-icon">✓</div>
        <h3>Proposal Sent</h3>
        <p>Your proposal for <strong>${project.title}</strong> has been secured in the client's review queue.</p>
        
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; max-width:280px; margin-top:12px;">
          <button type="button" class="dez-btn-primary" id="dez-success-view-proposals">
            View My Proposals
          </button>
          <button type="button" class="dez-btn-secondary" id="dez-success-back-projects">
            Back to Projects
          </button>
        </div>
      </div>
    `;

    body.querySelector('#dez-success-view-proposals')?.addEventListener('click', () => {
      close();
      onNavigateToMyProposals();
    });

    body.querySelector('#dez-success-back-projects')?.addEventListener('click', () => {
      close();
      onBackToFeed();
    });
  }

  // Navigation handlers
  nextBtn?.addEventListener('click', () => {
    if (currentStep < 3) {
      if (validateCurrentStep()) {
        currentStep++;
        renderCurrentStep();
      }
    } else if (currentStep === 3) {
      handleSubmit();
    }
  });

  backBtn?.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      renderCurrentStep();
    }
  });

  // Open / Close drawer
  function open() {
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.style.display = 'block';
    }
    drawer?.classList.add('is-open');
    currentStep = 1;
    renderCurrentStep();
  }

  function close() {
    if (isDirty) {
      if (!confirm('You have unsaved proposal details. Are you sure you want to close? Your draft will be saved.')) {
        return;
      }
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.style.display = 'none';
    }
    drawer?.classList.remove('is-open');
  }

  closeBtn?.addEventListener('click', close);
  backdrop?.addEventListener('click', close);

  // Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer?.classList.contains('is-open')) {
      close();
    }
  });

  return { open, close };
}
