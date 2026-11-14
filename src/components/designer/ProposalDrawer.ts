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
import {
  calculatePlatformFeeFallback,
  getTieredScheduleDescription
} from '../../services/plansService';
import { sharedDataset } from '../../mocks/dataset';
import { getCurrentDesignerPlan } from '../../services/designerProfileService';
import { formatUSD } from '../../services/usMarketService';

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
  // Extract prefilled deliverables from project milestones or deliverables_checklist
  const defaultDeliverables: string[] = [];
  if (project.deliverablesChecklist && project.deliverablesChecklist.length > 0) {
    defaultDeliverables.push(...project.deliverablesChecklist);
  } else if (project.deliverables_checklist && project.deliverables_checklist.length > 0) {
    defaultDeliverables.push(...project.deliverables_checklist);
  } else if (project.milestones && project.milestones.length > 0) {
    project.milestones.forEach((m) => {
      if (m.deliverables) defaultDeliverables.push(...m.deliverables);
    });
  }

  const formData: {
    coverLetter: string;
    projectUnderstanding: string;
    deliverables: string[];
    schedule: Array<{ milestoneId: string; phaseName: string; deliveryDays: number; targetDate: string }>;
    proposedTotal: number;
    milestonePercentages: Record<string, number>;
    hourlyRate: number;
    estimatedHours: number;
    deliveryTime: string;
    portfolioItems: string[];
    attachments: Array<{ name: string; url: string; size?: number; type?: string }>;
    clientQuestion: string;
    canOfferRegulatedServices: 'licensed_in_project_state' | 'will_partner_with_licensed_professional' | 'not_required_for_this_service' | 'cannot_offer_regulated_services' | '';
    serviceAreaStates: string[];
  } = {
    coverLetter: draft?.coverLetter || '',
    projectUnderstanding: (draft as any)?.projectUnderstanding || (draft as any)?.project_understanding || '',
    deliverables: (draft as any)?.deliverables || (defaultDeliverables.length > 0 ? defaultDeliverables : ['Full permit-ready drawing set', '3D volumetric renderings']),
    schedule: (draft as any)?.schedule || (project.milestones || []).map((m, idx) => ({
      milestoneId: m.id,
      phaseName: m.name,
      deliveryDays: (idx + 1) * 14,
      targetDate: new Date(Date.now() + (idx + 1) * 14 * 86400000).toISOString().split('T')[0]
    })),
    proposedTotal: draft?.proposedTotal || project.budget,
    milestonePercentages: draft?.milestonePercentages || {},
    hourlyRate: draft?.hourlyRate || project.hourlyRate || 85,
    estimatedHours: draft?.estimatedHours || project.estimatedHours || 120,
    deliveryTime: draft?.deliveryTime || project.timeline,
    portfolioItems: draft?.portfolioItems || [mockDesignerPortfolio[0].url],
    attachments: (draft as any)?.attachments || [],
    clientQuestion: draft?.clientQuestion || '',
    canOfferRegulatedServices: (draft as any)?.canOfferRegulatedServices || (draft as any)?.can_offer_regulated_services || 'licensed_in_project_state',
    serviceAreaStates: (draft as any)?.serviceAreaStates || (draft as any)?.service_area_states || ['TX', 'CO', 'CA']
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
      projectUnderstanding: formData.projectUnderstanding,
      deliverables: formData.deliverables,
      schedule: formData.schedule,
      proposedTotal: formData.proposedTotal,
      milestonePercentages: formData.milestonePercentages,
      hourlyRate: formData.hourlyRate,
      estimatedHours: formData.estimatedHours,
      deliveryTime: formData.deliveryTime,
      portfolioItems: formData.portfolioItems,
      attachments: formData.attachments,
      clientQuestion: formData.clientQuestion,
      canOfferRegulatedServices: formData.canOfferRegulatedServices,
      serviceAreaStates: formData.serviceAreaStates
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

    const currentPlan = (sharedDataset?.planState?.currentPlanId as 'free' | 'basic' | 'gold' | 'upgraded') || getCurrentDesignerPlan();
    const scheduleDescription = getTieredScheduleDescription(currentPlan);

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
              Client budget: <strong>${formatUSD(project.budget)}</strong>
            </span>
          </div>
        </div>

        <div class="dez-form-group">
          <label class="dez-form-label">Milestone Fee Allocation</label>
          <span class="dez-form-sublabel">Specify the percentage for each phase. Percentages must add up to exactly 100%.</span>

          <div style="font-size:12px; color:#475569; background:#F7F7F8; border:1px solid #E5E7EB; border-radius:6px; padding:8px 12px; margin: 8px 0 12px; line-height: 1.45;">
            <strong>Platform fee schedule (${currentPlan.toUpperCase()} Plan):</strong> ${scheduleDescription}
          </div>
          
          <table class="dez-milestone-table">
            <thead>
              <tr>
                <th>Phase</th>
                <th style="width:75px; text-align:right">Fee %</th>
                <th style="width:105px; text-align:right">Gross ($)</th>
                <th style="width:115px; text-align:right">Net Payout ($)</th>
              </tr>
            </thead>
            <tbody>
              ${project.milestones
                .map((m) => {
                  const pct = formData.milestonePercentages[m.id] ?? m.defaultFeePercentage;
                  const amt = Math.round((formData.proposedTotal * pct) / 100);
                  const mFee = calculatePlatformFeeFallback(currentPlan, Math.round(amt * 100));
                  const netAmt = Math.round(mFee.net_cents / 100);
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
                      ${formatUSD(amt)}
                    </td>
                    <td style="text-align:right; font-variant-numeric:tabular-nums; font-weight:500; color:#16A34A;">
                      ${formatUSD(netAmt)}
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
            Calculated total estimated cost: <strong id="dez-hourly-calc-total">${formatUSD(hourlyTotal)}</strong>
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

      <!-- Project Understanding (up to 1,000 chars) -->
      <div class="dez-form-group">
        <label class="dez-form-label" for="dez-project-understanding">Project Understanding & Initial Observations</label>
        <span class="dez-form-sublabel">Outline your technical interpretation of the site constraints, zoning, and client program requirements.</span>
        <textarea 
          id="dez-project-understanding" 
          class="dez-textarea" 
          maxlength="1000" 
          placeholder="Demonstrate your comprehension of the project brief, key design challenges, and site context..."
          style="min-height:90px;"
        >${formData.projectUnderstanding}</textarea>
        <div style="display:flex; justify-content:flex-end;">
          <span class="dez-char-counter" id="dez-understanding-count">${formData.projectUnderstanding.length} / 1,000</span>
        </div>
      </div>

      <!-- Deliverables List -->
      <div class="dez-form-group">
        <label class="dez-form-label">Proposed Deliverables</label>
        <span class="dez-form-sublabel">Specific drawings and documentation packages included in this proposal.</span>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" id="dez-new-deliverable-input" class="dez-input-search" placeholder="Add a deliverable (e.g. Permit set, Lighting schedules)..." style="flex:1;" />
          <button type="button" id="dez-add-deliverable-btn" class="dez-btn-secondary" style="height:36px; padding:0 14px; font-size:12.5px;">Add</button>
        </div>
        <div id="dez-deliverables-pills" style="display:flex; flex-wrap:wrap; gap:6px;">
          ${formData.deliverables.map((deliv, idx) => `
            <span class="dez-plain-chip" style="background:#F1F5F9; color:#1E293B; display:inline-flex; align-items:center; gap:6px; padding:4px 10px;">
              <span>• ${deliv}</span>
              <button type="button" class="dez-remove-deliv-btn" data-deliv-idx="${idx}" style="background:none; border:none; color:#EF4444; cursor:pointer; font-size:11px;">✕</button>
            </span>
          `).join('')}
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
      if (calcTotal) calcTotal.textContent = formatUSD(formData.proposedTotal);
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

      <!-- Licensure Disclosure Section -->
      <div class="dez-form-group" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-top: 14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <label class="dez-form-label" style="margin:0; font-weight:600; color:#0F172A;">
            Professional Licensure & Regulatory Disclosure
            ${(project.licensureRequirement === 'licensed_professional_required' || project.licensureRequirement === 'stamping_required') ? '<span style="color:#2563EB; font-size:11.5px; font-weight:500;">(Requested by Client)</span>' : ''}
          </label>
        </div>
        <span class="dez-form-sublabel" style="margin-bottom:10px;">
          Indicate how your studio provides architectural / engineering services for this jurisdiction. This disclosure provides transparency and never blocks submission.
        </span>

        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:#1E293B; cursor:pointer;">
            <input type="radio" name="licensure_option" value="licensed_in_project_state" ${formData.canOfferRegulatedServices === 'licensed_in_project_state' ? 'checked' : ''} style="accent-color:#2F7BE5; margin-top:2px;" />
            <span><strong>Licensed in Project State:</strong> I / my practice hold active licensure or registration in the jurisdiction of this project.</span>
          </label>
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:#1E293B; cursor:pointer;">
            <input type="radio" name="licensure_option" value="will_partner_with_licensed_professional" ${formData.canOfferRegulatedServices === 'will_partner_with_licensed_professional' ? 'checked' : ''} style="accent-color:#2F7BE5; margin-top:2px;" />
            <span><strong>Partnering with Licensed Professional:</strong> I will coordinate with a locally registered Architect / Engineer of Record for statutory stamps.</span>
          </label>
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:#1E293B; cursor:pointer;">
            <input type="radio" name="licensure_option" value="not_required_for_this_service" ${formData.canOfferRegulatedServices === 'not_required_for_this_service' ? 'checked' : ''} style="accent-color:#2F7BE5; margin-top:2px;" />
            <span><strong>Licensure Not Required:</strong> The specific design scope (e.g. concept, interior, 3D visualization) does not require a municipal stamp.</span>
          </label>
          <label style="display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:#1E293B; cursor:pointer;">
            <input type="radio" name="licensure_option" value="cannot_offer_regulated_services" ${formData.canOfferRegulatedServices === 'cannot_offer_regulated_services' ? 'checked' : ''} style="accent-color:#2F7BE5; margin-top:2px;" />
            <span><strong>Non-Regulated Services Only:</strong> I do not offer regulated / stamped architectural or engineering services.</span>
          </label>
        </div>

        <div>
          <label style="display:block; font-size:12px; font-weight:600; color:#475569; margin-bottom:4px;">Licensed / Service Area States</label>
          <input 
            type="text" 
            id="dez-service-states-input" 
            class="dez-input-search" 
            placeholder="e.g. TX, CO, CA" 
            value="${formData.serviceAreaStates.join(', ')}"
            style="width:100%; max-width:320px; font-size:12.5px;"
          />
          <span style="font-size:11px; color:#64748B; display:block; margin-top:2px;">Enter 2-letter state codes where you provide services or hold active licenses.</span>
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

    // Licensure options
    body.querySelectorAll('input[name="licensure_option"]').forEach((r) => {
      r.addEventListener('change', () => {
        formData.canOfferRegulatedServices = (r as HTMLInputElement).value as any;
        autosave();
      });
    });

    // Service Area States input
    const statesInput = body.querySelector('#dez-service-states-input') as HTMLInputElement | null;
    statesInput?.addEventListener('input', () => {
      formData.serviceAreaStates = statesInput.value
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      autosave();
    });
  }

  // -----------------------------------------------------------
  // STEP 3: Review and submit
  // -----------------------------------------------------------
  function renderStep3() {
    if (!body) return;

    const currentPlan = (sharedDataset?.planState?.currentPlanId as 'free' | 'basic' | 'gold' | 'upgraded') || getCurrentDesignerPlan();
    const amountCents = Math.round(formData.proposedTotal * 100);
    const feeCalc = calculatePlatformFeeFallback(currentPlan, amountCents);
    const scheduleDescription = getTieredScheduleDescription(currentPlan);

    body.innerHTML = `
      <div class="dez-review-box">
        <div class="dez-review-section-header">
          <span>1. Offer & Proposed Terms</span>
          <span class="dez-edit-step-link" id="dez-edit-step-1">Edit</span>
        </div>
        <div style="font-size:13px; color:var(--dez-text-secondary); display:flex; flex-direction:column; gap:4px;">
          <div>Proposed Total Price: <strong style="color:var(--dez-text-primary);">${formatUSD(formData.proposedTotal)}</strong></div>
          <div>Engagement Mode: <strong>${project.paymentType}</strong></div>
          <div>Estimated Delivery: <strong>${formData.deliveryTime}</strong></div>
          ${formData.projectUnderstanding ? `<div style="margin-top:6px; font-size:12.5px; color:#475569;"><strong>Understanding:</strong> ${formData.projectUnderstanding}</div>` : ''}
          ${formData.deliverables.length > 0 ? `<div style="margin-top:6px; font-size:12.5px; color:#475569;"><strong>Deliverables:</strong> ${formData.deliverables.join(' • ')}</div>` : ''}
        </div>
      </div>

      <!-- Licensure Disclosure Review Box -->
      <div class="dez-review-box">
        <div class="dez-review-section-header">
          <span>Licensure Disclosure</span>
          <span class="dez-edit-step-link" id="dez-edit-step-2-lic">Edit</span>
        </div>
        <div style="font-size:13px; color:#334155;">
          <div><strong>Status:</strong> ${
            formData.canOfferRegulatedServices === 'licensed_in_project_state' ? 'Licensed in Project State' :
            formData.canOfferRegulatedServices === 'will_partner_with_licensed_professional' ? 'Partnering with Licensed Professional' :
            formData.canOfferRegulatedServices === 'not_required_for_this_service' ? 'Licensure Not Required for this Scope' :
            formData.canOfferRegulatedServices === 'cannot_offer_regulated_services' ? 'Non-Regulated Services Only' : 'Not Specified'
          }</div>
          ${formData.serviceAreaStates.length > 0 ? `<div style="margin-top:4px; font-size:12px; color:#64748B;">Service Area States: ${formData.serviceAreaStates.join(', ')}</div>` : ''}
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

      <!-- Financial Net Calculation & Exact Tiered Schedule Preview -->
      <div class="dez-fee-notice-banner" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px;">Platform Fee Schedule (${currentPlan.toUpperCase()} Plan)</span>
          <span style="font-size: 12px; font-weight: 600; color: #2F7BE5; background: #F1F5F9; padding: 2px 8px; border-radius: 4px;">Effective Rate: ${feeCalc.rate_percent}%</span>
        </div>
        <div style="font-size: 12.5px; color: #334155; margin-bottom: 12px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 12px; line-height: 1.45;">
          <strong style="color: #0F172A;">Tiered fee schedule:</strong> ${scheduleDescription}
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size: 13px;">
          <span style="color: #475569;">Client Total Funded Deposit:</span>
          <strong style="color: #0F172A;">${formatUSD(formData.proposedTotal)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size: 13px; color: #64748B;">
          <span>Platform service fee (${feeCalc.rate_percent}%):</span>
          <span style="color: #DC2626; font-weight: 500;">-${formatUSD(feeCalc.fee_cents / 100)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px solid #E5E7EB; font-weight:600; font-size: 14px; color: #0F172A;">
          <span>Your Net Payout:</span>
          <span style="color: #16A34A;">${formatUSD(feeCalc.net_cents / 100)}</span>
        </div>
      </div>

      <p style="font-size:12.5px; color:var(--dez-text-muted); line-height:1.45;">
        The client will review your proposal. If they are interested, they will message you through Dezignet Messenger to begin milestone discussions.
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
    body.querySelector('#dez-edit-step-2-lic')?.addEventListener('click', () => {
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
      projectUnderstanding: formData.projectUnderstanding,
      project_understanding: formData.projectUnderstanding,
      deliverables: formData.deliverables,
      schedule: formData.schedule,
      attachments: formData.attachments,
      canOfferRegulatedServices: formData.canOfferRegulatedServices || undefined,
      can_offer_regulated_services: formData.canOfferRegulatedServices || undefined,
      serviceAreaStates: formData.serviceAreaStates,
      service_area_states: formData.serviceAreaStates,
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
        if (res.error === 'daily_cap_reached') {
          errorMsg.textContent = 'You have reached your daily proposal submission cap of 25 under our fair use policy. Please resume submitting proposals tomorrow.';
        } else if (res.error === 'limit_reached') {
          errorMsg.textContent = 'You have reached your monthly proposal submissions limit. Please upgrade your plan to submit more proposals.';
        } else {
          errorMsg.textContent = res.message || res.error || 'Failed to submit proposal. Please retry.';
        }
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
