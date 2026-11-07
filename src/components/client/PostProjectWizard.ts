/**
 * PostProjectWizard — 5-Step Project Creation Wizard
 * Step 1: Basics (Title, Category, Subcategory, Disciplines / Professional Needed, Description)
 * Step 2: Site & Size (Location, Building Status, Site Status, Area, Private Details, Reference Files via FileUploader)
 * Step 3: Budget & Timeline (Design Budget, Construction Cost, Proposal Deadline, Target Completion)
 * Step 4: Payment & Scope (Editable Milestone Schedule with Percentage/Amount sync, Reorder, Expandable details, Split buttons)
 * Step 5: Review & Publish (Full preview, "Preview as designers see it" toggle, Publish)
 *
 * Persists draft and step in URL and sessionStorage across tab switches, token refreshes, and page reloads.
 */

import {
  getCategories,
  getPhaseTemplates,
  createDraftProject,
  autosaveDraft,
  getProjectDraft,
  publishProject,
  DEFAULT_CATEGORIES,
  DEFAULT_PHASE_TEMPLATES,
  type CategoryItem,
  type PhaseTemplateItem,
  type ProjectDraftPayload
} from '../../services/projectsService';
import { FileUploader } from '../common/FileUploader';
import { renderMemberBadge } from '../../utils/badges';
import { renderClientShell, initClientShell } from './ClientLayout';
import { US_STATES } from '../../services/usMarketService';
import { suggestDesigners, inviteDesigner } from '../../services/invitationsService';
import { formatMoney } from '../../utils/formatters';

interface WizardPhaseItem {
  id?: string;
  template_id?: string;
  name: string;
  description: string;
  deliverables: string[];
  billing_trigger: string;
  fee_percent: number;
  amount: number;
  is_included: boolean;
  is_custom?: boolean;
  is_expanded?: boolean;
  sort_order: number;
}

export async function renderPostProjectWizard(container: HTMLElement, initialProjectId?: string): Promise<void> {
  // Parse draft ID and step from URL hash
  const hash = window.location.hash;
  const queryPart = hash.includes('?') ? hash.substring(hash.indexOf('?') + 1) : '';
  const urlParams = new URLSearchParams(queryPart);
  
  let draftId = initialProjectId || urlParams.get('id') || undefined;
  const stepParam = parseInt(urlParams.get('step') || '1', 10);
  const initialStep = !isNaN(stepParam) && stepParam >= 1 && stepParam <= 5 ? stepParam : 1;

  container.innerHTML = renderClientShell(
    {
      activeTab: 'my-projects',
      pageTitle: draftId ? 'Edit Project' : 'Post a Project'
    },
    `
      <div id="wizard-loading" style="padding: 48px; text-align: center; color: #6B7280; font-size: 14px;">
        Loading project editor...
      </div>
    `
  );

  initClientShell(container);

  try {
    const [categoriesResult, templatesResult] = await Promise.all([
      getCategories(),
      getPhaseTemplates()
    ]);

    const categories = categoriesResult.length > 0 ? categoriesResult : DEFAULT_CATEGORIES;
    const templates = templatesResult.length > 0 ? templatesResult : DEFAULT_PHASE_TEMPLATES;

    // If no draft ID exists in URL, create one immediately
    if (!draftId) {
      try {
        draftId = await createDraftProject({
          title: 'Untitled Project',
          category: categories[0]?.name || 'Residential',
          wizard_step: 1
        });
        // Update URL hash without causing a page remount
        const newHash = `#post-project?id=${draftId}&step=1`;
        history.replaceState(null, '', newHash);
      } catch (e) {
        console.warn('Could not create server draft immediately, using local draft ID:', e);
        draftId = 'draft-' + crypto.randomUUID();
        const newHash = `#post-project?id=${draftId}&step=1`;
        history.replaceState(null, '', newHash);
      }
    }

    // Load server draft if available
    let serverDraft: ProjectDraftPayload | null = null;
    if (draftId && !draftId.startsWith('draft-')) {
      serverDraft = await getProjectDraft(draftId);
    }

    // Check sessionStorage backup
    let localDraft: any = null;
    try {
      const stored = sessionStorage.getItem(`dezignet_draft_${draftId}`);
      if (stored) {
        localDraft = JSON.parse(stored);
      }
    } catch {}

    const draftData = localDraft || serverDraft;

    initWizardState(container, categories, templates, draftData, draftId, initialStep);
  } catch (err: any) {
    const mainArea = container.querySelector('main div');
    if (mainArea) {
      mainArea.innerHTML = `
        <div style="background: #FEF2F2; border: 1px solid #F87171; border-radius: 8px; padding: 24px; text-align: center; color: #991B1B;">
          <p style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">Failed to initialize project editor</p>
          <p style="font-size: 13px; margin-bottom: 16px;">${err?.message || 'A network error occurred.'}</p>
          <button id="btn-wizard-retry" style="background: #DC2626; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 6px; cursor: pointer;">Retry</button>
        </div>
      `;
      mainArea.querySelector('#btn-wizard-retry')?.addEventListener('click', () => {
        renderPostProjectWizard(container, draftId);
      });
    }
  }
}

function initWizardState(
  container: HTMLElement,
  categories: CategoryItem[],
  templates: PhaseTemplateItem[],
  existingDraft: ProjectDraftPayload | null,
  currentDraftId: string,
  startStep: number
): void {
  const mainArea = container.querySelector('main div');
  if (!mainArea) return;

  let currentStep = startStep || existingDraft?.wizard_step || 1;
  let hasUnsavedChanges = false;
  let autosaveTimer: any = null;
  let isPreviewMode = false;
  let splitMode: 'percent' | 'amount' = 'percent'; // Step 4 toggle

  // Build standard phases list from templates
  const initialPhases: WizardPhaseItem[] = templates.map((t, idx) => {
    // Pre-Design is unchecked by default; other standard phases checked
    const isPreDesign = t.name.toLowerCase().includes('pre-design');
    const isIncluded = !isPreDesign;
    const defaultPercent = isIncluded ? (t.fee_percent_without_predesign || t.default_fee_percent) : t.default_fee_percent;
    const budget = existingDraft?.design_budget || 0;
    const amount = budget > 0 ? Math.round((budget * defaultPercent) / 100) : 0;

    return {
      id: crypto.randomUUID(),
      template_id: t.id,
      name: t.name,
      description: t.description || '',
      deliverables: [...(t.deliverables || [])],
      billing_trigger: t.billing_trigger || '',
      fee_percent: defaultPercent,
      amount,
      is_included: isIncluded,
      is_custom: false,
      is_expanded: false,
      sort_order: idx + 1
    };
  });

  // Reconcile phases if draft already had customized phases
  if (existingDraft?.phases && existingDraft.phases.length > 0) {
    // Map existing draft phases
    const budget = existingDraft.design_budget || 0;
    existingDraft.phases.forEach((p) => {
      const match = initialPhases.find((ip) => ip.name.toLowerCase() === p.name.toLowerCase());
      if (match) {
        match.fee_percent = p.fee_percent;
        match.amount = budget > 0 ? Math.round((budget * p.fee_percent) / 100) : 0;
        match.is_included = true;
        if (p.description) match.description = p.description;
        if (p.deliverables) match.deliverables = [...p.deliverables];
        if (p.billing_trigger) match.billing_trigger = p.billing_trigger;
      } else {
        // Custom phase
        initialPhases.push({
          id: p.id || crypto.randomUUID(),
          name: p.name,
          description: p.description || '',
          deliverables: [...(p.deliverables || [])],
          billing_trigger: p.billing_trigger || '',
          fee_percent: p.fee_percent,
          amount: budget > 0 ? Math.round((budget * p.fee_percent) / 100) : 0,
          is_included: true,
          is_custom: true,
          is_expanded: false,
          sort_order: initialPhases.length + 1
        });
      }
    });
  }

  const state: ProjectDraftPayload & { phasesList: WizardPhaseItem[] } = {
    id: currentDraftId,
    title: existingDraft?.title || '',
    category: existingDraft?.category || (categories[0]?.name || 'Residential'),
    subcategory: existingDraft?.subcategory || '',
    disciplines: existingDraft?.disciplines || ['architect'],
    description: existingDraft?.description || '',
    city: existingDraft?.city || '',
    state_region: existingDraft?.state_region || '',
    building_status: existingDraft?.building_status || 'new_build',
    site_status: existingDraft?.site_status || 'has_land',
    area_sqft: existingDraft?.area_sqft || undefined,
    area_unit: existingDraft?.area_unit || 'sqft',
    street: existingDraft?.street || '',
    postal_code: existingDraft?.postal_code || '',
    site_notes: existingDraft?.site_notes || '',
    access_instructions: existingDraft?.access_instructions || '',
    design_budget: existingDraft?.design_budget || 0,
    construction_cost_estimate: existingDraft?.construction_cost_estimate || undefined,
    proposal_deadline: existingDraft?.proposal_deadline || '',
    deadline: existingDraft?.deadline || '',
    currency: existingDraft?.currency || 'USD',
    payment_type: existingDraft?.payment_type || 'milestone',
    hourly_rate_max: existingDraft?.hourly_rate_max || undefined,
    included_revisions_requested: existingDraft?.included_revisions_requested || 2,
    wizard_step: currentStep,
    image_file_ids: existingDraft?.image_file_ids || [],
    phasesList: initialPhases
  };

  // Setup tab leave warning
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes in your project draft.';
    }
  });

  function updateUrlStep(step: number) {
    currentStep = step;
    state.wizard_step = step;
    const newHash = `#post-project?id=${currentDraftId}&step=${step}`;
    history.replaceState(null, '', newHash);
  }

  function triggerAutosave() {
    hasUnsavedChanges = true;
    updateSaveIndicator('Saving...');

    // 1. Immediately store in sessionStorage for instant tab switch survival
    try {
      sessionStorage.setItem(`dezignet_draft_${currentDraftId}`, JSON.stringify(state));
    } catch {}

    // 2. Debounce server autosave
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      try {
        if (!currentDraftId.startsWith('draft-')) {
          const payloadToSave: Partial<ProjectDraftPayload> = {
            ...state,
            phases: state.phasesList
              .filter((p) => p.is_included)
              .map((p, idx) => ({
                id: p.id,
                sort_order: idx + 1,
                name: p.name,
                description: p.description,
                deliverables: p.deliverables,
                billing_trigger: p.billing_trigger,
                fee_percent: p.fee_percent
              }))
          };
          await autosaveDraft(currentDraftId, payloadToSave, currentStep);
        }
        hasUnsavedChanges = false;
        updateSaveIndicator('Saved');
      } catch (e) {
        console.warn('Autosave warning:', e);
        updateSaveIndicator('Saved locally');
      }
    }, 1500);
  }

  function updateSaveIndicator(text: string) {
    const el = document.getElementById('wizard-save-status');
    if (el) el.textContent = text;
  }

  // --- Step 1: Basics ---
  function renderStep1Basics(): string {
    const currentCat = categories.find((c) => c.name === state.category) || categories[0];
    const subcats = currentCat?.subcategories || [];

    const availableDisciplines = [
      { key: 'architect', label: 'Architect' },
      { key: 'interior_designer', label: 'Interior Designer' },
      { key: 'landscape_architect', label: 'Landscape Architect' },
      { key: 'engineer', label: 'Structural / MEP Engineer' }
    ];

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px;">Project Basics</h2>
          <p style="font-size: 13px; color: #6B7280; margin: 0;">Give your project a title, choose the sector, and specify the professionals you need.</p>
        </div>

        <!-- Title -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Project Title *</label>
          <input
            type="text"
            id="f-title"
            maxlength="120"
            value="${escapeHtml(state.title || '')}"
            placeholder="e.g. Modern 4-Bedroom Contemporary Villa"
            style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
          />
        </div>

        <!-- Category & Subcategory (Single source of truth) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Primary Category *</label>
            <select id="f-category" style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; box-sizing: border-box;">
              ${categories.map((c) => `<option value="${escapeHtml(c.name)}" ${c.name === state.category ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Subcategory (Optional)</label>
            <select id="f-subcategory" style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; box-sizing: border-box;">
              <option value="">Select subcategory (optional)</option>
              ${subcats.map((s) => `<option value="${escapeHtml(s.name)}" ${s.name === state.subcategory ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Professional Needed (Disciplines Multi-Select Chips) -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Professional Needed *</label>
          <p style="font-size: 12px; color: #6B7280; margin: 0 0 10px;">Select at least one professional discipline required for this project.</p>
          <div id="disciplines-chips-group" style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${availableDisciplines.map((d) => {
              const isSelected = (state.disciplines || []).includes(d.key);
              return `
                <button
                  type="button"
                  class="btn-discipline-chip"
                  data-discipline="${d.key}"
                  style="border: 1px solid ${isSelected ? '#2F7BE5' : '#E5E7EB'}; background: ${isSelected ? '#EFF6FF' : '#FFFFFF'}; color: ${isSelected ? '#1D4ED8' : '#374151'}; font-weight: ${isSelected ? '600' : '500'}; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 150ms ease;"
                >
                  ${isSelected ? '✓ ' : ''}${d.label}
                </button>
              `;
            }).join('')}
          </div>
          <div id="discipline-error" style="display: none; font-size: 12px; color: #DC2626; margin-top: 6px;">Please select at least one professional discipline.</div>
        </div>

        <!-- Description -->
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <label style="font-size: 13px; font-weight: 600; color: #374151;">Project Description *</label>
            <span id="desc-char-count" style="font-size: 12px; color: #6B7280;">${(state.description || '').length} / 50 min</span>
          </div>
          <textarea
            id="f-description"
            rows="6"
            maxlength="2000"
            placeholder="Describe what you want built, who it is for, design aesthetic references, and key site constraints..."
            style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.5; font-family: inherit; box-sizing: border-box;"
          >${escapeHtml(state.description || '')}</textarea>
        </div>

        <!-- Next Action -->
        <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
          <button id="btn-step1-next" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            Continue to Site & Size →
          </button>
        </div>
      </div>
    `;
  }

  function bindStep1Events() {
    const titleInput = document.getElementById('f-title') as HTMLInputElement;
    const catSelect = document.getElementById('f-category') as HTMLSelectElement;
    const subcatSelect = document.getElementById('f-subcategory') as HTMLSelectElement;
    const descText = document.getElementById('f-description') as HTMLTextAreaElement;
    const charCount = document.getElementById('desc-char-count') as HTMLElement;
    const nextBtn = document.getElementById('btn-step1-next') as HTMLButtonElement;

    titleInput?.addEventListener('input', () => {
      state.title = titleInput.value;
      triggerAutosave();
    });

    catSelect?.addEventListener('change', () => {
      state.category = catSelect.value;
      const curCat = categories.find((c) => c.name === state.category);
      const subs = curCat?.subcategories || [];
      subcatSelect.innerHTML = `<option value="">Select subcategory (optional)</option>` + subs.map((s) => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
      state.subcategory = '';
      triggerAutosave();
    });

    subcatSelect?.addEventListener('change', () => {
      state.subcategory = subcatSelect.value;
      triggerAutosave();
    });

    // Disciplines chip toggle
    document.querySelectorAll('.btn-discipline-chip').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const discKey = (btn as HTMLElement).dataset.discipline;
        if (!discKey) return;

        if (!state.disciplines) state.disciplines = [];
        const index = state.disciplines.indexOf(discKey);
        if (index > -1) {
          state.disciplines.splice(index, 1);
        } else {
          state.disciplines.push(discKey);
        }
        triggerAutosave();
        renderWizard();
      });
    });

    descText?.addEventListener('input', () => {
      state.description = descText.value;
      const len = (state.description || '').length;
      charCount.textContent = `${len} / 50 min`;
      charCount.style.color = len >= 50 ? '#059669' : '#6B7280';
      triggerAutosave();
    });

    nextBtn?.addEventListener('click', () => {
      if (!state.title.trim()) {
        alert('Please enter a project title.');
        return;
      }
      if (!state.disciplines || state.disciplines.length === 0) {
        const discErr = document.getElementById('discipline-error');
        if (discErr) discErr.style.display = 'block';
        alert('Please select at least one professional discipline.');
        return;
      }
      if ((state.description || '').trim().length < 50) {
        alert('Description must be at least 50 characters so designers understand the scope.');
        return;
      }
      updateUrlStep(2);
      renderWizard();
    });
  }

  // --- Step 2: Site & Size ---
  function renderStep2Site(): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px;">Site & Dimensions</h2>
          <p style="font-size: 13px; color: #6B7280; margin: 0;">Specify your location, site readiness, and floor area.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">City / Town *</label>
            <input
              type="text"
              id="f-city"
              value="${escapeHtml(state.city || '')}"
              placeholder="e.g. Austin, Denver, Chicago"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">State *</label>
            <select
              id="f-state"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box; background: #FFFFFF;"
            >
              <option value="">Select State...</option>
              ${US_STATES.map((s) => `<option value="${s.code}" ${(state.state_region === s.code || state.state_region === s.name) ? 'selected' : ''}>${s.name} (${s.code})</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">ZIP Code *</label>
            <input
              type="text"
              id="f-zip"
              value="${escapeHtml((state as any).zip_code || '')}"
              placeholder="e.g. 78701"
              pattern="^\\d{5}(-\\d{4})?$"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
        </div>

        <!-- Optional US Zoning / Authority fields -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Permit Jurisdiction (optional)</label>
            <input
              type="text"
              id="f-permit-jurisdiction"
              value="${escapeHtml((state as any).permit_jurisdiction || '')}"
              placeholder="e.g. City of Austin or Travis County"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">HOA or Historic District (optional)</label>
            <select
              id="f-hoa"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box; background: #FFFFFF;"
            >
              <option value="unsure" ${(state as any).hoa_or_historic_district === 'unsure' ? 'selected' : ''}>Unsure</option>
              <option value="yes" ${(state as any).hoa_or_historic_district === 'yes' ? 'selected' : ''}>Yes</option>
              <option value="no" ${(state as any).hoa_or_historic_district === 'no' ? 'selected' : ''}>No</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Building Status *</label>
            <select id="f-building-status" style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; box-sizing: border-box;">
              <option value="new_build" ${state.building_status === 'new_build' ? 'selected' : ''}>New Build (Ground-up)</option>
              <option value="renovation" ${state.building_status === 'renovation' ? 'selected' : ''}>Renovation / Remodel</option>
              <option value="extension" ${state.building_status === 'extension' ? 'selected' : ''}>Extension / Addition</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Land Status *</label>
            <select id="f-site-status" style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; box-sizing: border-box;">
              <option value="has_land" ${state.site_status === 'has_land' ? 'selected' : ''}>Land secured / Property owned</option>
              <option value="no_land_yet" ${state.site_status === 'no_land_yet' ? 'selected' : ''}>Searching for land / Conceptual only</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Estimated Area (optional)</label>
            <input
              type="number"
              id="f-area"
              value="${state.area_sqft || ''}"
              placeholder="e.g. 3500"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
          </div>
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Unit</label>
            <select id="f-area-unit" style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; background: #FFFFFF; box-sizing: border-box;">
              <option value="sqft" ${state.area_unit === 'sqft' ? 'selected' : ''}>Square Feet (sqft)</option>
              <option value="sqm" ${state.area_unit === 'sqm' ? 'selected' : ''}>Square Meters (sqm)</option>
            </select>
          </div>
        </div>

        <!-- Private Site Details Box (Zero shadows, flat 1px border) -->
        <div style="border: 1px solid #E5E7EB; background: #F7F7F8; border-radius: 8px; padding: 20px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="font-size: 14px; font-weight: 600; color: #111827;">Private Site Details</div>
            <span style="font-size: 11px; background: #E5E7EB; color: #4B5563; padding: 2px 8px; border-radius: 4px;">Confidential</span>
          </div>
          <p style="font-size: 12px; color: #6B7280; margin: 0 0 16px;">
            Only shown to the designer you hire, after you sign a contract. Designers browsing never see these fields.
          </p>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; color: #4B5563; margin-bottom: 4px;">Street Address</label>
              <input type="text" id="f-street" value="${escapeHtml(state.street || '')}" placeholder="e.g. 14 Admiralty Way" style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
            </div>
            <div>
              <label style="display: block; font-size: 12px; font-weight: 500; color: #4B5563; margin-bottom: 4px;">Postal Code</label>
              <input type="text" id="f-postal-code" value="${escapeHtml(state.postal_code || '')}" placeholder="101233" style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 12px; font-weight: 500; color: #4B5563; margin-bottom: 4px;">Access / Site Notes</label>
            <input type="text" id="f-access" value="${escapeHtml(state.access_instructions || '')}" placeholder="Gate codes, topography notes, site inspection contact..." style="width: 100%; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;" />
          </div>
        </div>

        <!-- Project Reference Files Uploader -->
        <div>
          <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Reference Documents & Site Photos</label>
          <p style="font-size: 12px; color: #6B7280; margin: 0 0 12px;">Upload existing site surveys, floorplans, CAD drawings, or inspirational photos (JPG, PNG, WebP, PDF).</p>
          <div id="project-uploader-mount"></div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 12px;">
          <button id="btn-step2-back" style="background: transparent; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px; cursor: pointer;">
            ← Back
          </button>
          <button id="btn-step2-next" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            Continue to Budget & Timeline →
          </button>
        </div>
      </div>
    `;
  }

  function bindStep2Events() {
    const cityInput = document.getElementById('f-city') as HTMLInputElement;
    const stateInput = document.getElementById('f-state') as HTMLSelectElement;
    const zipInput = document.getElementById('f-zip') as HTMLInputElement;
    const permitInput = document.getElementById('f-permit-jurisdiction') as HTMLInputElement;
    const hoaSelect = document.getElementById('f-hoa') as HTMLSelectElement;
    const bldStatus = document.getElementById('f-building-status') as HTMLSelectElement;
    const siteStatus = document.getElementById('f-site-status') as HTMLSelectElement;
    const areaInput = document.getElementById('f-area') as HTMLInputElement;
    const unitSelect = document.getElementById('f-area-unit') as HTMLSelectElement;
    const streetInput = document.getElementById('f-street') as HTMLInputElement;
    const postalInput = document.getElementById('f-postal-code') as HTMLInputElement;
    const accessInput = document.getElementById('f-access') as HTMLInputElement;

    cityInput?.addEventListener('input', () => { state.city = cityInput.value; triggerAutosave(); });
    stateInput?.addEventListener('change', () => { state.state_region = stateInput.value; (state as any).state = stateInput.value; triggerAutosave(); });
    zipInput?.addEventListener('input', () => { (state as any).zip_code = zipInput.value; triggerAutosave(); });
    permitInput?.addEventListener('input', () => { (state as any).permit_jurisdiction = permitInput.value; triggerAutosave(); });
    hoaSelect?.addEventListener('change', () => { (state as any).hoa_or_historic_district = hoaSelect.value; triggerAutosave(); });
    bldStatus?.addEventListener('change', () => { state.building_status = bldStatus.value as any; triggerAutosave(); });
    siteStatus?.addEventListener('change', () => { state.site_status = siteStatus.value as any; triggerAutosave(); });
    areaInput?.addEventListener('input', () => { state.area_sqft = parseFloat(areaInput.value) || undefined; triggerAutosave(); });
    unitSelect?.addEventListener('change', () => { state.area_unit = unitSelect.value as any; triggerAutosave(); });
    streetInput?.addEventListener('input', () => { state.street = streetInput.value; triggerAutosave(); });
    postalInput?.addEventListener('input', () => { state.postal_code = postalInput.value; triggerAutosave(); });
    accessInput?.addEventListener('input', () => { state.access_instructions = accessInput.value; triggerAutosave(); });

    // Mount compact FileUploader
    const mountEl = document.getElementById('project-uploader-mount');
    if (mountEl) {
      new FileUploader(mountEl, {
        purpose: 'project_image',
        maxFiles: 8,
        maxSizeBytes: 15728640, // 15 MB
        allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'dwg'],
        onAllCompleted: (records) => {
          state.image_file_ids = records.map((r) => r.id);
          triggerAutosave();
        }
      });
    }

    document.getElementById('btn-step2-back')?.addEventListener('click', () => { updateUrlStep(1); renderWizard(); });
    document.getElementById('btn-step2-next')?.addEventListener('click', () => {
      if (!state.city?.trim() || !state.state_region?.trim()) {
        alert('Please specify your project City and State/Region.');
        return;
      }
      updateUrlStep(3);
      renderWizard();
    });
  }

  // --- Step 3: Budget & Timeline ---
  function renderStep3Budget(): string {
    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px;">Budget & Timeline</h2>
          <p style="font-size: 13px; color: #6B7280; margin: 0;">Define your design fees and expected target dates.</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Design Budget (USD) *</label>
            <input
              type="number"
              id="f-design-budget"
              value="${state.design_budget || ''}"
              placeholder="e.g. 15000"
              min="100"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 14px; font-variant-numeric: tabular-nums; box-sizing: border-box;"
            />
            <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 4px;">What you plan to pay designers for design services. Proposals are compared against this amount.</span>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Estimated Construction Cost (Optional)</label>
            <input
              type="number"
              id="f-construction-cost"
              value="${state.construction_cost_estimate || ''}"
              placeholder="e.g. 250000"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 14px; font-variant-numeric: tabular-nums; box-sizing: border-box;"
            />
            <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 4px;">Shown to designers for building scope context.</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Proposal Submission Deadline *</label>
            <input
              type="date"
              id="f-proposal-deadline"
              value="${state.proposal_deadline || ''}"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
            <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 4px;">Last date to accept proposals.</span>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Desired Project Completion Date</label>
            <input
              type="date"
              id="f-project-deadline"
              value="${state.deadline || ''}"
              style="width: 100%; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 13px; box-sizing: border-box;"
            />
            <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 4px;">Target date to finish all architectural drawings.</span>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 12px;">
          <button id="btn-step3-back" style="background: transparent; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px; cursor: pointer;">
            ← Back
          </button>
          <button id="btn-step3-next" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            Continue to Payment & Scope →
          </button>
        </div>
      </div>
    `;
  }

  function bindStep3Events() {
    const budgetInput = document.getElementById('f-design-budget') as HTMLInputElement;
    const costInput = document.getElementById('f-construction-cost') as HTMLInputElement;
    const propDeadlineInput = document.getElementById('f-proposal-deadline') as HTMLInputElement;
    const projDeadlineInput = document.getElementById('f-project-deadline') as HTMLInputElement;

    budgetInput?.addEventListener('input', () => {
      const b = parseFloat(budgetInput.value) || 0;
      state.design_budget = b;
      // Recompute milestone amounts from percentages
      state.phasesList.forEach((p) => {
        p.amount = b > 0 ? Math.round((b * p.fee_percent) / 100) : 0;
      });
      triggerAutosave();
    });

    costInput?.addEventListener('input', () => {
      state.construction_cost_estimate = parseFloat(costInput.value) || undefined;
      triggerAutosave();
    });

    propDeadlineInput?.addEventListener('change', () => {
      state.proposal_deadline = propDeadlineInput.value;
      triggerAutosave();
    });

    projDeadlineInput?.addEventListener('change', () => {
      state.deadline = projDeadlineInput.value;
      triggerAutosave();
    });

    document.getElementById('btn-step3-back')?.addEventListener('click', () => { updateUrlStep(2); renderWizard(); });
    document.getElementById('btn-step3-next')?.addEventListener('click', () => {
      if (!state.design_budget || state.design_budget <= 0) {
        alert('Please declare a design budget greater than $0.');
        return;
      }
      if (!state.proposal_deadline) {
        alert('Please choose a proposal submission deadline.');
        return;
      }
      updateUrlStep(4);
      renderWizard();
    });
  }

  // --- Step 4: Payment & Scope ---
  function renderStep4Payment(): string {
    const isMilestone = state.payment_type === 'milestone';
    const checkedPhases = state.phasesList.filter((p) => p.is_included);
    const totalPercentage = checkedPhases.reduce((acc, p) => acc + (Number(p.fee_percent) || 0), 0);
    const totalAmount = checkedPhases.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const isSumValid = Math.abs(totalPercentage - 100) < 0.05;
    const hasBudget = Boolean(state.design_budget && state.design_budget > 0);

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px;">Payment Structure & Scope</h2>
          <p style="font-size: 13px; color: #6B7280; margin: 0;">Choose milestone phases with escrow releases, or an hourly billing model.</p>
        </div>

        <!-- Payment Type Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div
            id="type-milestone-card"
            style="border: 1px solid ${isMilestone ? '#2F7BE5' : '#E5E7EB'}; background: ${isMilestone ? '#EFF6FF' : '#FFFFFF'}; border-radius: 8px; padding: 18px; cursor: pointer; transition: all 150ms;"
          >
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 600; font-size: 14px; color: #111827;">Milestone-Based</span>
              <input type="radio" name="payment_type" value="milestone" ${isMilestone ? 'checked' : ''} style="accent-color: #2F7BE5;" />
            </div>
            <p style="font-size: 12px; color: #4B5563; margin: 0;">Phased architectural deliverables. Funds held in escrow until you approve each milestone.</p>
          </div>

          <div
            id="type-hourly-card"
            style="border: 1px solid ${!isMilestone ? '#2F7BE5' : '#E5E7EB'}; background: ${!isMilestone ? '#EFF6FF' : '#FFFFFF'}; border-radius: 8px; padding: 18px; cursor: pointer; transition: all 150ms;"
          >
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
              <span style="font-weight: 600; font-size: 14px; color: #111827;">Hourly Rate Cap</span>
              <input type="radio" name="payment_type" value="hourly" ${!isMilestone ? 'checked' : ''} style="accent-color: #2F7BE5;" />
            </div>
            <p style="font-size: 12px; color: #4B5563; margin: 0;">Weekly timesheet logs tracked against a strictly enforced maximum hourly rate cap.</p>
          </div>
        </div>

        ${isMilestone ? `
          <!-- Milestone Schedule Container -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            
            <!-- Header Controls: Title, Mode Toggle, Split Buttons -->
            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px;">
              <div>
                <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 0 0 2px;">Milestone Schedule</h3>
                <p style="font-size: 12px; color: #6B7280; margin: 0;">
                  ${hasBudget ? `Design budget: ${formatMoney(state.design_budget)}` : `<span style="color: #DC2626;">Enter your design budget in step 3 to see amounts</span>`}
                </p>
              </div>

              <!-- Split Mode Toggle -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="display: inline-flex; background: #F3F4F6; padding: 2px; border-radius: 6px; font-size: 12px;">
                  <button type="button" id="toggle-mode-percent" style="border: none; background: ${splitMode === 'percent' ? '#FFFFFF' : 'transparent'}; color: ${splitMode === 'percent' ? '#111827' : '#6B7280'}; font-weight: 600; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
                    Set by percentage
                  </button>
                  <button type="button" id="toggle-mode-amount" style="border: none; background: ${splitMode === 'amount' ? '#FFFFFF' : 'transparent'}; color: ${splitMode === 'amount' ? '#111827' : '#6B7280'}; font-weight: 600; padding: 4px 10px; border-radius: 4px; cursor: pointer;">
                    Set by amount
                  </button>
                </div>

                <button type="button" id="btn-rec-split" style="background: none; border: 1px solid #E5E7EB; color: #374151; font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 6px; cursor: pointer;">
                  Use recommended split
                </button>
                <button type="button" id="btn-even-split" style="background: none; border: 1px solid #E5E7EB; color: #374151; font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 6px; cursor: pointer;">
                  Split evenly
                </button>
              </div>
            </div>

            <!-- Milestone Phases Table -->
            <div style="border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; margin-bottom: 16px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
                <thead style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB;">
                  <tr>
                    <th style="padding: 10px 12px; width: 36px; text-align: center;"></th>
                    <th style="padding: 10px 12px; width: 36px;">Incl.</th>
                    <th style="padding: 10px 12px;">Phase Name & Deliverables</th>
                    <th style="padding: 10px 12px; width: 110px;">Percentage</th>
                    <th style="padding: 10px 12px; width: 120px;">Amount (USD)</th>
                    <th style="padding: 10px 12px; width: 60px; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${state.phasesList.map((p, idx) => {
                    const isExpanded = p.is_expanded;

                    return `
                      <tr style="border-bottom: 1px solid #E5E7EB; background: ${p.is_included ? '#FFFFFF' : '#F9FAFB'}; opacity: ${p.is_included ? '1' : '0.6'};">
                        <!-- Reorder handles -->
                        <td style="padding: 10px 8px; text-align: center; color: #9CA3AF;">
                          <div style="display: flex; flex-direction: column; gap: 2px; align-items: center;">
                            <button type="button" class="btn-move-phase-up" data-index="${idx}" style="background: none; border: none; padding: 0; color: #9CA3AF; cursor: pointer; font-size: 10px;" ${idx === 0 ? 'disabled' : ''}>▲</button>
                            <span style="font-size: 11px; color: #6B7280; font-variant-numeric: tabular-nums;">${idx + 1}</span>
                            <button type="button" class="btn-move-phase-down" data-index="${idx}" style="background: none; border: none; padding: 0; color: #9CA3AF; cursor: pointer; font-size: 10px;" ${idx === state.phasesList.length - 1 ? 'disabled' : ''}>▼</button>
                          </div>
                        </td>

                        <!-- Include checkbox -->
                        <td style="padding: 10px 12px;">
                          <input type="checkbox" class="phase-include-chk" data-index="${idx}" ${p.is_included ? 'checked' : ''} style="accent-color: #2F7BE5; cursor: pointer;" />
                        </td>

                        <!-- Phase Name & Details Toggle -->
                        <td style="padding: 10px 12px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <input
                              type="text"
                              class="phase-name-input"
                              data-index="${idx}"
                              value="${escapeHtml(p.name)}"
                              ${!p.is_included ? 'disabled' : ''}
                              style="flex: 1; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 13px; font-weight: 500; box-sizing: border-box;"
                            />
                            <button type="button" class="btn-toggle-details" data-index="${idx}" style="background: none; border: none; color: #2F7BE5; font-size: 12px; cursor: pointer; padding: 4px 6px;">
                              ${isExpanded ? 'Hide details ▴' : 'Details ▾'}
                            </button>
                          </div>

                          <!-- Expandable Details Area -->
                          ${isExpanded ? `
                            <div style="margin-top: 10px; padding: 12px; background: #F7F7F8; border-radius: 6px; border: 1px solid #E5E7EB;">
                              <div style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 11px; font-weight: 600; color: #4B5563; margin-bottom: 4px;">Scope Description</label>
                                <textarea class="phase-desc-input" data-index="${idx}" rows="2" style="width: 100%; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 8px; font-size: 12px; font-family: inherit; box-sizing: border-box;">${escapeHtml(p.description || '')}</textarea>
                              </div>

                              <div style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 11px; font-weight: 600; color: #4B5563; margin-bottom: 4px;">Deliverables</label>
                                <div class="deliverables-chips" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
                                  ${(p.deliverables || []).map((d, dIdx) => `
                                    <span style="font-size: 11px; background: #E5E7EB; color: #1F2937; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                                      ${escapeHtml(d)}
                                      <button type="button" class="btn-del-chip" data-phase-index="${idx}" data-del-index="${dIdx}" style="background: none; border: none; padding: 0; color: #6B7280; cursor: pointer;">✕</button>
                                    </span>
                                  `).join('')}
                                </div>
                                <div style="display: flex; gap: 6px;">
                                  <input type="text" class="input-new-deliverable" data-index="${idx}" placeholder="Add deliverable..." style="flex: 1; height: 28px; border: 1px solid #E5E7EB; border-radius: 4px; padding: 0 8px; font-size: 11px;" />
                                  <button type="button" class="btn-add-deliverable" data-index="${idx}" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 11px; font-weight: 600; padding: 0 10px; border-radius: 4px; cursor: pointer;">Add</button>
                                </div>
                              </div>

                              <div>
                                <label style="display: block; font-size: 11px; font-weight: 600; color: #4B5563; margin-bottom: 4px;">Billing Trigger</label>
                                <input type="text" class="phase-trigger-input" data-index="${idx}" value="${escapeHtml(p.billing_trigger || '')}" placeholder="e.g. Due upon client approval of concept drawings" style="width: 100%; height: 28px; border: 1px solid #E5E7EB; border-radius: 4px; padding: 0 8px; font-size: 11px; box-sizing: border-box;" />
                              </div>
                            </div>
                          ` : ''}
                        </td>

                        <!-- Percentage Input -->
                        <td style="padding: 10px 12px;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <input
                              type="number"
                              class="phase-percent-input"
                              data-index="${idx}"
                              step="0.01"
                              min="0"
                              max="100"
                              value="${p.fee_percent}"
                              ${!p.is_included ? 'disabled' : ''}
                              style="width: 76px; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 8px; font-size: 13px; font-variant-numeric: tabular-nums; box-sizing: border-box;"
                            />
                            <span style="font-size: 12px; color: #6B7280;">%</span>
                          </div>
                        </td>

                        <!-- Amount Input -->
                        <td style="padding: 10px 12px;">
                          <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="font-size: 12px; color: #6B7280;">$</span>
                            <input
                              type="number"
                              class="phase-amount-input"
                              data-index="${idx}"
                              value="${p.amount || ''}"
                              ${!p.is_included || !hasBudget ? 'disabled' : ''}
                              placeholder="${hasBudget ? '0' : '—'}"
                              style="width: 90px; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 8px; font-size: 13px; font-variant-numeric: tabular-nums; box-sizing: border-box;"
                            />
                          </div>
                        </td>

                        <!-- Remove custom phase -->
                        <td style="padding: 10px 12px; text-align: right;">
                          ${p.is_custom ? `
                            <button type="button" class="btn-remove-custom-phase" data-index="${idx}" title="Remove custom phase" style="background: none; border: none; color: #DC2626; font-size: 13px; cursor: pointer;">
                              ✕
                            </button>
                          ` : ''}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>

                <!-- Table Footer: Live Totals -->
                <tfoot style="background: #F7F7F8; border-top: 2px solid #E5E7EB; font-weight: 600;">
                  <tr>
                    <td colspan="3" style="padding: 12px 14px; text-align: right; color: #374151;">
                      Total Included (${checkedPhases.length} phases):
                    </td>
                    <td style="padding: 12px 14px; color: ${isSumValid ? '#059669' : '#DC2626'}; font-variant-numeric: tabular-nums; font-size: 14px;">
                      ${totalPercentage.toFixed(2)}%
                    </td>
                    <td style="padding: 12px 14px; color: #111827; font-variant-numeric: tabular-nums; font-size: 14px;">
                      ${hasBudget ? formatMoney(totalAmount) : '—'}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- Validation Feedback -->
            ${!isSumValid ? `
              <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; padding: 10px 14px; font-size: 12.5px; color: #B91C1C; margin-bottom: 16px;">
                Phase percentages must total exactly 100.00% before proceeding (current total: ${totalPercentage.toFixed(2)}%).
                Use the "Use recommended split" or "Split evenly" buttons above to balance automatically.
              </div>
            ` : ''}

            <!-- Add Custom Phase Action -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <button
                type="button"
                id="btn-add-custom-phase"
                style="background: none; border: 1px dashed #2F7BE5; color: #2F7BE5; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 6px; cursor: pointer;"
                ${state.phasesList.length >= 8 ? 'disabled title="Maximum 8 phases allowed"' : ''}
              >
                + Add Custom Phase ${state.phasesList.length >= 8 ? '(Max 8 reached)' : ''}
              </button>

              <span style="font-size: 12px; color: #6B7280;">
                Template phases can be unchecked or renamed; custom phases can be deleted.
              </span>
            </div>

            <!-- Revisions & Payment Terms -->
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #E5E7EB; padding-top: 16px;">
              <div>
                <label style="font-size: 13px; font-weight: 600; color: #374151; display: block;">Included Design Revisions per Phase</label>
                <span style="font-size: 12px; color: #6B7280;">Standard revision rounds included per milestone before change requests.</span>
              </div>
              <input type="number" id="f-revisions" value="${state.included_revisions_requested || 2}" min="1" max="10" style="width: 70px; height: 36px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; font-variant-numeric: tabular-nums;" />
            </div>

            <!-- How Payment Works Explainer Box -->
            <div style="margin-top: 20px; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px;">
              <div style="font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 8px;">How payments work</div>
              <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #4B5563; line-height: 1.6;">
                <li>Funds for each milestone are held securely in escrow before design work commences.</li>
                <li>Funds are released to the designer only after you inspect and approve the completed milestone deliverables.</li>
                <li>Submissions not reviewed within 14 days are approved automatically to ensure fair designer compensation.</li>
                <li>Released payments undergo a 5-day security clearance period.</li>
              </ul>
            </div>
          </div>
        ` : `
          <!-- Hourly Settings -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; background: #FFFFFF;">
            <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">Maximum Hourly Rate Cap (USD/hr) *</label>
            <input
              type="number"
              id="f-hourly-rate"
              value="${state.hourly_rate_max || ''}"
              placeholder="e.g. 75"
              style="width: 200px; height: 40px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 12px; font-size: 14px; font-variant-numeric: tabular-nums;"
            />
            <span style="font-size: 12px; color: #6B7280; display: block; margin-top: 6px;">Designers may quote below or up to this rate cap.</span>
          </div>
        `}

        <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 12px;">
          <button id="btn-step4-back" style="background: transparent; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px; cursor: pointer;">
            ← Back
          </button>
          <button id="btn-step4-next" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
            Continue to Review & Publish →
          </button>
        </div>
      </div>
    `;
  }

  function bindStep4Events() {
    // Mode toggles (Percentage vs Amount)
    document.getElementById('toggle-mode-percent')?.addEventListener('click', () => {
      splitMode = 'percent';
      renderWizard();
    });

    document.getElementById('toggle-mode-amount')?.addEventListener('click', () => {
      splitMode = 'amount';
      renderWizard();
    });

    // Payment type radio / card clicks
    document.getElementById('type-milestone-card')?.addEventListener('click', () => {
      state.payment_type = 'milestone';
      triggerAutosave();
      renderWizard();
    });

    document.getElementById('type-hourly-card')?.addEventListener('click', () => {
      state.payment_type = 'hourly';
      triggerAutosave();
      renderWizard();
    });

    // Include Checkbox
    document.querySelectorAll('.phase-include-chk').forEach((chk) => {
      chk.addEventListener('change', () => {
        const idx = parseInt((chk as HTMLElement).dataset.index || '0', 10);
        state.phasesList[idx].is_included = (chk as HTMLInputElement).checked;
        triggerAutosave();
        renderWizard();
      });
    });

    // Move Up / Down
    document.querySelectorAll('.btn-move-phase-up').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index || '0', 10);
        if (idx > 0) {
          const temp = state.phasesList[idx];
          state.phasesList[idx] = state.phasesList[idx - 1];
          state.phasesList[idx - 1] = temp;
          triggerAutosave();
          renderWizard();
        }
      });
    });

    document.querySelectorAll('.btn-move-phase-down').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index || '0', 10);
        if (idx < state.phasesList.length - 1) {
          const temp = state.phasesList[idx];
          state.phasesList[idx] = state.phasesList[idx + 1];
          state.phasesList[idx + 1] = temp;
          triggerAutosave();
          renderWizard();
        }
      });
    });

    // Toggle Details
    document.querySelectorAll('.btn-toggle-details').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index || '0', 10);
        state.phasesList[idx].is_expanded = !state.phasesList[idx].is_expanded;
        renderWizard();
      });
    });

    // Phase Name input
    document.querySelectorAll('.phase-name-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = parseInt((input as HTMLElement).dataset.index || '0', 10);
        state.phasesList[idx].name = (input as HTMLInputElement).value;
        triggerAutosave();
      });
    });

    // Scope Description input
    document.querySelectorAll('.phase-desc-input').forEach((textarea) => {
      textarea.addEventListener('input', () => {
        const idx = parseInt((textarea as HTMLElement).dataset.index || '0', 10);
        state.phasesList[idx].description = (textarea as HTMLTextAreaElement).value;
        triggerAutosave();
      });
    });

    // Billing Trigger input
    document.querySelectorAll('.phase-trigger-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = parseInt((input as HTMLElement).dataset.index || '0', 10);
        state.phasesList[idx].billing_trigger = (input as HTMLInputElement).value;
        triggerAutosave();
      });
    });

    // Deliverables add / remove chips
    document.querySelectorAll('.btn-add-deliverable').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index || '0', 10);
        const input = document.querySelector(`.input-new-deliverable[data-index="${idx}"]`) as HTMLInputElement;
        const val = input?.value.trim();
        if (val) {
          if (!state.phasesList[idx].deliverables) state.phasesList[idx].deliverables = [];
          state.phasesList[idx].deliverables.push(val);
          input.value = '';
          triggerAutosave();
          renderWizard();
        }
      });
    });

    document.querySelectorAll('.btn-del-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pIdx = parseInt((btn as HTMLElement).dataset.phaseIndex || '0', 10);
        const dIdx = parseInt((btn as HTMLElement).dataset.delIndex || '0', 10);
        state.phasesList[pIdx].deliverables.splice(dIdx, 1);
        triggerAutosave();
        renderWizard();
      });
    });

    // Percentage Input Change
    document.querySelectorAll('.phase-percent-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = parseInt((input as HTMLElement).dataset.index || '0', 10);
        const pct = parseFloat((input as HTMLInputElement).value) || 0;
        state.phasesList[idx].fee_percent = pct;
        if (state.design_budget > 0) {
          state.phasesList[idx].amount = Math.round((state.design_budget * pct) / 100);
        }
        triggerAutosave();
        // Update live totals without full remount
        const chkPhases = state.phasesList.filter((p) => p.is_included);
        const tot = chkPhases.reduce((acc, p) => acc + (Number(p.fee_percent) || 0), 0);
        const tDisp = document.getElementById('total-percent-display');
        if (tDisp) tDisp.textContent = `Total: ${tot.toFixed(2)}%`;
      });
    });

    // Amount Input Change
    document.querySelectorAll('.phase-amount-input').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = parseInt((input as HTMLElement).dataset.index || '0', 10);
        const amt = parseFloat((input as HTMLInputElement).value) || 0;
        state.phasesList[idx].amount = amt;
        if (state.design_budget > 0) {
          state.phasesList[idx].fee_percent = parseFloat(((amt / state.design_budget) * 100).toFixed(2));
        }
        triggerAutosave();
      });
    });

    // Remove Custom Phase
    document.querySelectorAll('.btn-remove-custom-phase').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.index || '0', 10);
        state.phasesList.splice(idx, 1);
        triggerAutosave();
        renderWizard();
      });
    });

    // Add Custom Phase Button
    document.getElementById('btn-add-custom-phase')?.addEventListener('click', () => {
      if (state.phasesList.length >= 8) {
        alert('Maximum of 8 project phases allowed.');
        return;
      }
      state.phasesList.push({
        id: crypto.randomUUID(),
        name: 'Custom Phase ' + (state.phasesList.length + 1),
        description: 'Custom architectural milestone deliverables.',
        deliverables: ['Custom milestone deliverables package'],
        billing_trigger: 'Approval of milestone deliverables',
        fee_percent: 0,
        amount: 0,
        is_included: true,
        is_custom: true,
        is_expanded: true,
        sort_order: state.phasesList.length + 1
      });
      triggerAutosave();
      renderWizard();
    });

    // Recommended Split Button
    document.getElementById('btn-rec-split')?.addEventListener('click', () => {
      const budget = state.design_budget || 0;
      const isPreDesignIncluded = state.phasesList.some((p) => p.is_included && p.name.toLowerCase().includes('pre-design'));

      // Presets based on Pre-Design inclusion
      if (isPreDesignIncluded) {
        // 10, 15, 20, 35, 5, 15
        const presetWeights: Record<string, number> = {
          'pre-design': 10,
          'schematic': 15,
          'design development': 20,
          'construction documents': 35,
          'bidding': 5,
          'construction administration': 15
        };

        state.phasesList.forEach((p) => {
          if (!p.is_included) {
            p.fee_percent = 0;
            p.amount = 0;
            return;
          }
          const lower = p.name.toLowerCase();
          for (const [key, val] of Object.entries(presetWeights)) {
            if (lower.includes(key)) {
              p.fee_percent = val;
              p.amount = budget > 0 ? Math.round((budget * val) / 100) : 0;
              break;
            }
          }
        });
      } else {
        // 20, 25, 35, 5, 15
        const presetWeights: Record<string, number> = {
          'schematic': 20,
          'design development': 25,
          'construction documents': 35,
          'bidding': 5,
          'construction administration': 15
        };

        state.phasesList.forEach((p) => {
          if (!p.is_included) {
            p.fee_percent = 0;
            p.amount = 0;
            return;
          }
          const lower = p.name.toLowerCase();
          for (const [key, val] of Object.entries(presetWeights)) {
            if (lower.includes(key)) {
              p.fee_percent = val;
              p.amount = budget > 0 ? Math.round((budget * val) / 100) : 0;
              break;
            }
          }
        });
      }

      triggerAutosave();
      renderWizard();
    });

    // Split Evenly Button
    document.getElementById('btn-even-split')?.addEventListener('click', () => {
      const budget = state.design_budget || 0;
      const included = state.phasesList.filter((p) => p.is_included);
      if (included.length === 0) return;

      const evenPercent = parseFloat((100 / included.length).toFixed(2));
      let currentSum = 0;

      included.forEach((p, i) => {
        if (i === included.length - 1) {
          // Last absorbs rounding differences to ensure exactly 100.00%
          p.fee_percent = parseFloat((100 - currentSum).toFixed(2));
        } else {
          p.fee_percent = evenPercent;
          currentSum += evenPercent;
        }
        p.amount = budget > 0 ? Math.round((budget * p.fee_percent) / 100) : 0;
      });

      triggerAutosave();
      renderWizard();
    });

    // Hourly rate input
    const hourlyInput = document.getElementById('f-hourly-rate') as HTMLInputElement;
    hourlyInput?.addEventListener('input', () => {
      state.hourly_rate_max = parseFloat(hourlyInput.value) || undefined;
      triggerAutosave();
    });

    // Revisions input
    const revInput = document.getElementById('f-revisions') as HTMLInputElement;
    revInput?.addEventListener('input', () => {
      state.included_revisions_requested = parseInt(revInput.value, 10) || 2;
      triggerAutosave();
    });

    document.getElementById('btn-step4-back')?.addEventListener('click', () => { updateUrlStep(3); renderWizard(); });
    document.getElementById('btn-step4-next')?.addEventListener('click', () => {
      if (state.payment_type === 'milestone') {
        const checked = state.phasesList.filter((p) => p.is_included);
        if (checked.length === 0) {
          alert('Please include at least one milestone phase.');
          return;
        }
        const tot = checked.reduce((acc, p) => acc + (Number(p.fee_percent) || 0), 0);
        if (Math.abs(tot - 100) > 0.05) {
          alert(`Milestone phase percentages must total exactly 100% (currently ${tot.toFixed(2)}%).`);
          return;
        }
      } else {
        if (!state.hourly_rate_max || state.hourly_rate_max <= 0) {
          alert('Please set a maximum hourly rate cap.');
          return;
        }
      }
      updateUrlStep(5);
      renderWizard();
    });
  }

  // --- Step 5: Review & Publish ---
  function renderStep5Review(): string {
    const checkedPhases = state.phasesList.filter((p) => p.is_included);
    const disciplinesList = (state.disciplines || []).map((d) => {
      if (d === 'architect') return 'Architect';
      if (d === 'interior_designer') return 'Interior Designer';
      if (d === 'landscape_architect') return 'Landscape Architect';
      if (d === 'engineer') return 'Structural / MEP Engineer';
      return d;
    }).join(', ');

    return `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div>
            <h2 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 6px;">Review & Publish</h2>
            <p style="font-size: 13px; color: #6B7280; margin: 0;">Review your details before making your project visible to qualified designers.</p>
          </div>

          <button id="btn-toggle-preview" style="background: none; border: 1px solid #2F7BE5; color: #2F7BE5; font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer;">
            ${isPreviewMode ? 'View Full Summary' : 'Preview as Designers See It'}
          </button>
        </div>

        ${isPreviewMode ? `
          <!-- Designer Public Preview Card (Without Private Details) -->
          <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; background: #FFFFFF;">
            <div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
              <span style="font-size: 12px; font-weight: 600; color: #1D4ED8; background: #EFF6FF; padding: 3px 8px; border-radius: 4px;">${escapeHtml(state.category)}</span>
              ${state.subcategory ? `<span style="font-size: 12px; font-weight: 500; color: #4B5563; background: #F3F4F6; padding: 3px 8px; border-radius: 4px;">${escapeHtml(state.subcategory)}</span>` : ''}
              <span style="font-size: 12px; font-weight: 600; color: #059669; background: #ECFDF5; padding: 3px 8px; border-radius: 4px;">Accepting Proposals</span>
            </div>

            <h3 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 8px;">${escapeHtml(state.title || 'Untitled Project')}</h3>
            <p style="font-size: 13px; color: #4B5563; line-height: 1.6; margin: 0 0 16px;">${escapeHtml(state.description || '')}</p>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; padding: 14px; background: #F7F7F8; border-radius: 6px; font-size: 12.5px; margin-bottom: 16px;">
              <div>
                <span style="color: #6B7280; display: block; font-size: 11px;">Design Budget</span>
                <span style="font-weight: 700; color: #111827;">${formatMoney(state.design_budget || 0)}</span>
              </div>
              <div>
                <span style="color: #6B7280; display: block; font-size: 11px;">Location</span>
                <span style="font-weight: 600; color: #111827;">${escapeHtml(state.city || '')}, ${escapeHtml(state.state_region || '')}</span>
              </div>
              <div>
                <span style="color: #6B7280; display: block; font-size: 11px;">Professionals Needed</span>
                <span style="font-weight: 600; color: #111827;">${escapeHtml(disciplinesList || 'Architect')}</span>
              </div>
              <div>
                <span style="color: #6B7280; display: block; font-size: 11px;">Payment Model</span>
                <span style="font-weight: 600; color: #111827;">${state.payment_type === 'milestone' ? 'Milestone Escrow' : 'Hourly Cap'}</span>
              </div>
            </div>

            <p style="font-size: 11.5px; color: #6B7280; margin: 0; font-style: italic;">
              ✓ Note: Your street address, access instructions, and site notes are strictly concealed from public browsing.
            </p>
          </div>
        ` : `
          <!-- Full Read-Only Summary with Edit Links -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Section 1 Summary -->
            <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; background: #FFFFFF;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: #111827;">1. Basics</span>
                <button type="button" class="btn-jump-step" data-step="1" style="background: none; border: none; color: #2F7BE5; font-size: 12px; font-weight: 500; cursor: pointer;">Edit</button>
              </div>
              <p style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111827;">${escapeHtml(state.title)}</p>
              <div style="font-size: 12.5px; color: #4B5563; margin-bottom: 6px;">
                <strong>Category:</strong> ${escapeHtml(state.category)} ${state.subcategory ? `• ${escapeHtml(state.subcategory)}` : ''}
              </div>
              <div style="font-size: 12.5px; color: #4B5563; margin-bottom: 8px;">
                <strong>Professional Needed:</strong> ${escapeHtml(disciplinesList || 'Architect')}
              </div>
              <p style="margin: 0; font-size: 12.5px; color: #6B7280; line-height: 1.5;">${escapeHtml(state.description)}</p>
            </div>

            <!-- Section 2 Summary -->
            <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; background: #FFFFFF;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: #111827;">2. Site & Size</span>
                <button type="button" class="btn-jump-step" data-step="2" style="background: none; border: none; color: #2F7BE5; font-size: 12px; font-weight: 500; cursor: pointer;">Edit</button>
              </div>
              <div style="font-size: 12.5px; color: #4B5563; line-height: 1.6;">
                <div><strong>Location:</strong> ${escapeHtml(state.city || '')}, ${escapeHtml(state.state_region || '')}</div>
                <div><strong>Building & Land:</strong> ${state.building_status} • ${state.site_status}</div>
                ${state.area_sqft ? `<div><strong>Area:</strong> ${state.area_sqft.toLocaleString()} ${state.area_unit}</div>` : ''}
                ${state.street ? `<div><strong>Private Street:</strong> ${escapeHtml(state.street)} (Secured)</div>` : ''}
              </div>
            </div>

            <!-- Section 3 Summary -->
            <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; background: #FFFFFF;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: #111827;">3. Budget & Timeline</span>
                <button type="button" class="btn-jump-step" data-step="3" style="background: none; border: none; color: #2F7BE5; font-size: 12px; font-weight: 500; cursor: pointer;">Edit</button>
              </div>
              <div style="font-size: 12.5px; color: #4B5563; line-height: 1.6;">
                <div><strong>Design Budget:</strong> ${formatMoney(state.design_budget || 0)}</div>
                ${state.construction_cost_estimate ? `<div><strong>Estimated Construction Cost:</strong> ${formatMoney(state.construction_cost_estimate)}</div>` : ''}
                <div><strong>Proposal Submission Deadline:</strong> ${state.proposal_deadline}</div>
                ${state.deadline ? `<div><strong>Target Completion Date:</strong> ${state.deadline}</div>` : ''}
              </div>
            </div>

            <!-- Section 4 Summary -->
            <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; background: #FFFFFF;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px;">
                <span style="font-size: 13px; font-weight: 600; color: #111827;">4. Payment Structure & Scope</span>
                <button type="button" class="btn-jump-step" data-step="4" style="background: none; border: none; color: #2F7BE5; font-size: 12px; font-weight: 500; cursor: pointer;">Edit</button>
              </div>
              ${state.payment_type === 'milestone' ? `
                <div style="font-size: 12.5px; color: #4B5563; margin-bottom: 8px;">
                  <strong>Milestone Phases (${checkedPhases.length}):</strong>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  ${checkedPhases.map((p, idx) => `
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #374151; padding: 4px 8px; background: #F7F7F8; border-radius: 4px;">
                      <span>${idx + 1}. ${escapeHtml(p.name)}</span>
                      <span style="font-variant-numeric: tabular-nums;">${p.fee_percent}% (${formatMoney(p.amount)})</span>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="font-size: 12.5px; color: #4B5563;">
                  <strong>Hourly Rate Cap:</strong> ${formatMoney(state.hourly_rate_max || 0)}/hr
                </div>
              `}
            </div>
          </div>
        `}

        <!-- Confirmation & Actions -->
        <div style="border-top: 1px solid #E5E7EB; padding-top: 20px;">
          <label style="display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #374151; cursor: pointer; margin-bottom: 20px;">
            <input type="checkbox" id="chk-accurate" style="accent-color: #2F7BE5; margin-top: 2px;" />
            <span>I confirm that the details provided are accurate and that I am ready to receive proposals from qualified designers.</span>
          </label>

          <div style="display: flex; justify-content: space-between; gap: 12px;">
            <button id="btn-step5-back" style="background: transparent; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px; cursor: pointer;">
              ← Back
            </button>
            <div style="display: flex; gap: 10px;">
              <button id="btn-save-draft-exit" style="background: transparent; border: 1px solid #E5E7EB; color: #4B5563; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 6px; cursor: pointer;">
                Save as Draft
              </button>
              <button id="btn-publish-project" style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 10px 24px; border-radius: 6px; cursor: pointer;">
                Post Project Now
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindStep5Events() {
    document.getElementById('btn-toggle-preview')?.addEventListener('click', () => {
      isPreviewMode = !isPreviewMode;
      renderWizard();
    });

    document.querySelectorAll('.btn-jump-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = parseInt((btn as HTMLElement).dataset.step || '1', 10);
        updateUrlStep(step);
        renderWizard();
      });
    });

    document.getElementById('btn-step5-back')?.addEventListener('click', () => { updateUrlStep(4); renderWizard(); });

    document.getElementById('btn-save-draft-exit')?.addEventListener('click', async () => {
      triggerAutosave();
      alert('Project saved as draft. You can continue editing anytime from My Projects.');
      window.location.hash = '#my-projects';
    });

    document.getElementById('btn-publish-project')?.addEventListener('click', async () => {
      const confirmChk = document.getElementById('chk-accurate') as HTMLInputElement;
      if (!confirmChk?.checked) {
        alert('Please check the confirmation box before posting your project.');
        return;
      }

      const publishBtn = document.getElementById('btn-publish-project') as HTMLButtonElement;
      if (publishBtn) {
        publishBtn.disabled = true;
        publishBtn.textContent = 'Publishing...';
      }

      try {
        // Save latest state first
        const payloadToSave: Partial<ProjectDraftPayload> = {
          ...state,
          phases: state.phasesList
            .filter((p) => p.is_included)
            .map((p, idx) => ({
              id: p.id,
              sort_order: idx + 1,
              name: p.name,
              description: p.description,
              deliverables: p.deliverables,
              billing_trigger: p.billing_trigger,
              fee_percent: p.fee_percent
            }))
        };
        await autosaveDraft(currentDraftId, payloadToSave, 5);

        // Call publish_project RPC
        await publishProject(currentDraftId);

        // Clear local storage draft
        try {
          sessionStorage.removeItem(`dezignet_draft_${currentDraftId}`);
        } catch {}

        renderPublishSuccess(currentDraftId, state.title);
      } catch (err: any) {
        alert(`Failed to publish project: ${err?.message || 'Server validation failed'}`);
        if (publishBtn) {
          publishBtn.disabled = false;
          publishBtn.textContent = 'Post Project Now';
        }
      }
    });
  }

  function renderPublishSuccess(projectId: string, title: string) {
    if (!mainArea) return;

    mainArea.innerHTML = `
      <div style="max-width: 1080px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; padding-bottom: 60px;">
        <!-- Top Success Banner -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 36px 28px; text-align: center;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #ECFDF5; color: #059669; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px;">Project Successfully Posted!</h2>
          <p style="font-size: 13.5px; color: #4B5563; line-height: 1.5; max-width: 580px; margin: 0 auto 20px;">
            "${escapeHtml(title)}" is now published and open for proposals from architects and design professionals.
          </p>

          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <a href="#my-projects" style="background: #FFFFFF; border: 1px solid #E5E7EB; color: #374151; font-size: 13px; font-weight: 600; padding: 9px 18px; border-radius: 6px; text-decoration: none;">
              My Projects
            </a>
            <a href="#project-details?id=${projectId}" style="background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; padding: 9px 20px; border-radius: 6px; text-decoration: none;">
              View Project Details
            </a>
          </div>
        </div>

        <!-- Matched Designers Section -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 style="font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 4px;">
                Designers who match your project
              </h3>
              <p style="font-size: 13px; color: #6B7280; margin: 0;">
                These professionals match your project typology, scope, and criteria.
              </p>
            </div>
            <a href="#find-designers?project=${encodeURIComponent(projectId)}" style="font-size: 13px; font-weight: 600; color: #2F7BE5; text-decoration: none;">
              See more designers &rarr;
            </a>
          </div>

          <!-- Cards Grid -->
          <div id="wizard-matched-designers-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px;">
            ${Array(6).fill(0).map(() => `
              <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; height: 210px;"></div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Invite Modal Host -->
      <div id="modal-wizard-invite" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 250; align-items: center; justify-content: center;">
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; width: 100%; max-width: 480px; padding: 24px; margin: 16px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0;">Invite to Project</h3>
            <button type="button" id="btn-close-wizard-modal" style="background: none; border: none; font-size: 20px; color: #6B7280; cursor: pointer; line-height: 1;">&times;</button>
          </div>
          
          <p style="font-size: 13px; color: #4B5563; margin: 0 0 16px 0;">
            Invite <strong id="modal-wizard-designer-name"></strong> to review and bid on <strong>${escapeHtml(title)}</strong>.
          </p>

          <form id="form-wizard-invite">
            <input type="hidden" id="modal-wizard-designer-id" value="" />
            
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label style="font-size: 12.5px; font-weight: 600; color: #374151;">Invitation Note (Optional)</label>
                <span id="wizard-invite-char-count" style="font-size: 11.5px; color: #9CA3AF;">0 / 500</span>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
                <button type="button" class="btn-wizard-quick-starter" data-text="We love your architectural portfolio and would appreciate your proposal for our project." style="text-align: left; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; color: #4B5563; cursor: pointer;">
                  "We love your architectural portfolio and would appreciate your proposal..."
                </button>
                <button type="button" class="btn-wizard-quick-starter" data-text="Our project matches your exact design specialization. Please take a look at the scope." style="text-align: left; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 4px; padding: 6px 10px; font-size: 11.5px; color: #4B5563; cursor: pointer;">
                  "Our project matches your exact design specialization..."
                </button>
              </div>

              <textarea id="modal-wizard-invite-note" maxlength="500" rows="3" placeholder="Add an optional personal message to the designer..." style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; box-sizing: border-box;"></textarea>
            </div>

            <p style="font-size: 12px; color: #6B7280; line-height: 1.45; margin: 0 0 18px 0;">
              The designer will receive an email and notification. They will be able to review the project scope and submit a detailed proposal.
            </p>

            <div style="display: flex; justify-content: flex-end; gap: 10px;">
              <button type="button" id="btn-cancel-wizard-modal" style="height: 36px; padding: 0 16px; border: 1px solid #E5E7EB; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #4B5563; cursor: pointer;">Cancel</button>
              <button type="submit" id="btn-submit-wizard-invite" style="height: 36px; padding: 0 18px; border: none; border-radius: 6px; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer;">Send Invitation</button>
            </div>
          </form>
        </div>
      </div>
    `;

    initMatchedDesignersSection(projectId);
  }

  async function initMatchedDesignersSection(projectId: string) {
    const grid = mainArea?.querySelector('#wizard-matched-designers-grid') as HTMLElement;
    const modal = mainArea?.querySelector('#modal-wizard-invite') as HTMLElement;
    const modalNameEl = mainArea?.querySelector('#modal-wizard-designer-name');
    const modalIdInput = mainArea?.querySelector('#modal-wizard-designer-id') as HTMLInputElement;
    const modalNoteArea = mainArea?.querySelector('#modal-wizard-invite-note') as HTMLTextAreaElement;
    const charCountEl = mainArea?.querySelector('#wizard-invite-char-count');
    const closeBtn = mainArea?.querySelector('#btn-close-wizard-modal');
    const cancelBtn = mainArea?.querySelector('#btn-cancel-wizard-modal');
    const inviteForm = mainArea?.querySelector('#form-wizard-invite') as HTMLFormElement;

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

    mainArea?.querySelectorAll<HTMLButtonElement>('.btn-wizard-quick-starter').forEach(b => {
      b.addEventListener('click', () => {
        const text = b.getAttribute('data-text') || '';
        if (modalNoteArea) {
          modalNoteArea.value = text;
          if (charCountEl) charCountEl.textContent = `${text.length} / 500`;
        }
      });
    });

    try {
      const suggestions = await suggestDesigners(projectId, 6);
      if (!grid) return;

      if (!suggestions || suggestions.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 36px; text-align: center; color: #6B7280; border: 1px dashed #E5E7EB; border-radius: 8px;">
            <p style="font-size: 13.5px; margin: 0 0 6px 0;">No direct match suggestions generated yet.</p>
            <a href="#find-designers?project=${encodeURIComponent(projectId)}" style="font-size: 13px; color: #2F7BE5; font-weight: 500; text-decoration: underline;">
              Browse all designers
            </a>
          </div>
        `;
        return;
      }

      grid.innerHTML = suggestions.map((s) => {
        const initials = (s.full_name || 'D').slice(0, 2).toUpperCase();
        const credInfo = s.credentials && s.credentials.length > 0
          ? (s.credentials[0].title || 'Credentials on file')
          : 'Experienced professional';

        return `
          <div class="wizard-designer-card" data-id="${s.designer_id}" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box;">
            <div>
              <!-- Header: Avatar, Name, Verified, Score -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px;">
                <div style="display: flex; gap: 10px; align-items: center;">
                  <div style="width: 38px; height: 38px; border-radius: 6px; background: #F3F4F6; color: #374151; font-weight: 600; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${initials}
                  </div>
                  <div>
                    <div style="font-weight: 600; font-size: 14px; color: #111827; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span>${escapeHtml(s.full_name)}</span>
                      ${(s.has_member_badge || (s as any).plan_key !== 'free') ? renderMemberBadge() : ''}
                    </div>
                    <div style="font-size: 12px; color: #6B7280; margin-top: 1px;">
                      ${escapeHtml(s.discipline || 'Architect')} &bull; ${escapeHtml([s.city, s.state].filter(Boolean).join(', '))}
                    </div>
                  </div>
                </div>

                <span style="font-size: 11px; font-weight: 600; background: #F7F7F8; color: #374151; border: 1px solid #E5E7EB; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">
                  ${s.match_score}% match
                </span>
              </div>

              <!-- Credentials Status -->
              <div style="display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: #4B5563; margin-bottom: 8px; font-weight: 500;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>${escapeHtml(credInfo)}</span>
              </div>

              <!-- Rating & Experience -->
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 10px;">
                ${s.years_experience} yrs exp &bull; ${s.rating_average > 0 ? `★ ${s.rating_average.toFixed(1)} (${s.rating_count})` : 'New talent'} &bull; ${s.completed_projects_count} completed
              </div>

              <!-- Match Reasons -->
              <div style="display: flex; flex-direction: column; gap: 3px; margin-bottom: 14px; background: #F7F7F8; padding: 8px 10px; border-radius: 6px;">
                ${(s.reasons || []).slice(0, 2).map(r => `
                  <div style="font-size: 11.5px; color: #374151; display: flex; align-items: flex-start; gap: 5px; line-height: 1.35;">
                    <span style="color: #047857; font-weight: 700;">&bull;</span>
                    <span>${escapeHtml(r.text)}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Card Invite Button -->
            <button type="button" class="btn-open-card-invite" data-id="${s.designer_id}" data-name="${escapeHtml(s.full_name)}" style="width: 100%; height: 34px; background: #2F7BE5; color: #FFFFFF; border: none; border-radius: 6px; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background 150ms;">
              Invite to project
            </button>
          </div>
        `;
      }).join('');

      // Bind Invite Modal triggers
      grid.querySelectorAll<HTMLButtonElement>('.btn-open-card-invite').forEach(b => {
        b.addEventListener('click', () => {
          const dId = b.getAttribute('data-id') || '';
          const dName = b.getAttribute('data-name') || '';
          if (modalNameEl) modalNameEl.textContent = dName;
          if (modalIdInput) modalIdInput.value = dId;
          if (modal) modal.style.display = 'flex';
        });
      });

      // Submit Invitation
      inviteForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dId = modalIdInput?.value;
        const note = modalNoteArea?.value.trim();
        const submitBtn = mainArea?.querySelector('#btn-submit-wizard-invite') as HTMLButtonElement;

        if (!dId) return;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending...';
        }

        try {
          await inviteDesigner(projectId, dId, note);
          closeModal();

          // Update card button to Invited
          const targetCardBtn = grid.querySelector(`.btn-open-card-invite[data-id="${dId}"]`) as HTMLButtonElement;
          if (targetCardBtn) {
            targetCardBtn.disabled = true;
            targetCardBtn.style.background = '#F3F4F6';
            targetCardBtn.style.color = '#047857';
            targetCardBtn.style.border = '1px solid #E5E7EB';
            targetCardBtn.style.cursor = 'default';
            targetCardBtn.textContent = '✓ Invitation Sent';
          }
        } catch (err: any) {
          alert('Could not send invitation: ' + (err?.message || 'Server error'));
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Invitation';
          }
        }
      });
    } catch {
      if (grid) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: #6B7280; font-size: 13px;">Could not load matched designers.</div>`;
      }
    }
  }

  function renderWizard(): void {
    if (!mainArea) return;

    const steps = [
      { num: 1, title: 'Basics' },
      { num: 2, title: 'Site & Size' },
      { num: 3, title: 'Budget & Timeline' },
      { num: 4, title: 'Payment & Scope' },
      { num: 5, title: 'Review & Publish' }
    ];

    mainArea.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto;">
        
        <!-- Top Wizard Header with Steps & Autosave status -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 12.5px; font-weight: 600; color: #111827;">Step ${currentStep} of 5: ${steps[currentStep - 1].title}</span>
            <span id="wizard-save-status" style="font-size: 11.5px; color: #6B7280;">Saved</span>
          </div>

          <!-- Progress Bar -->
          <div style="display: flex; gap: 6px;">
            ${steps.map((s) => `
              <div style="flex: 1; height: 4px; background: ${s.num <= currentStep ? '#2F7BE5' : '#E5E7EB'}; border-radius: 2px; transition: background 150ms ease;"></div>
            `).join('')}
          </div>
        </div>

        <!-- Active Step Body -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 28px 24px;">
          ${
            currentStep === 1 ? renderStep1Basics() :
            currentStep === 2 ? renderStep2Site() :
            currentStep === 3 ? renderStep3Budget() :
            currentStep === 4 ? renderStep4Payment() :
            renderStep5Review()
          }
        </div>
      </div>
    `;

    // Bind active step events
    if (currentStep === 1) bindStep1Events();
    else if (currentStep === 2) bindStep2Events();
    else if (currentStep === 3) bindStep3Events();
    else if (currentStep === 4) bindStep4Events();
    else if (currentStep === 5) bindStep5Events();
  }

  // Initial render
  renderWizard();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
