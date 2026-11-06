/**
 * Onboarding — Role-Specific Two-Step Onboarding Flow
 * Designer: Practice details & specializations from categories -> Profile completeness checklist.
 * Client: Account details & location -> Action choice (Post a project / Find designers).
 * Sets onboarding_completed_at on profile upon completion or skip.
 */

import { getCategories, type CategoryItem } from '../../services/projectsService';
import { saveOnboardingStep, completeOnboarding } from '../../services/authService';
import { US_STATES } from '../../services/usMarketService';

export interface OnboardingState {
  role: 'client' | 'designer';
  step: 1 | 2;
  data: any;
}

export function renderOnboardingContainer(): string {
  return `
    <div id="onboarding-page-wrapper" style="min-height: 100vh; background: #FFFFFF; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column;">
      <!-- Minimal Header -->
      <header style="border-bottom: 1px solid #E5E7EB; padding: 18px 32px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; color: #0F172A;">
          <img src="/logo.png" alt="Dezignet" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain;" />
          Dezignet
        </div>
        <div id="onboarding-step-indicator" style="font-size: 13px; font-weight: 500; color: #64748B;">
          Step 1 of 2
        </div>
      </header>

      <!-- Main Step View -->
      <main style="flex: 1; max-width: 600px; width: 100%; margin: 0 auto; padding: 48px 24px; box-sizing: border-box;">
        <div id="onboarding-step-content"></div>
      </main>
    </div>
  `;
}

export async function initOnboarding(role: 'client' | 'designer', onComplete: (nextUrl: string) => void): Promise<void> {
  const container = document.getElementById('onboarding-step-content');
  const indicator = document.getElementById('onboarding-step-indicator');
  if (!container) return;

  let currentStep: 1 | 2 = 1;
  let categories: CategoryItem[] = [];
  try {
    categories = await getCategories();
  } catch (err) {
    console.error('Failed to load categories for onboarding:', err);
  }

  const formData: any = {
    role,
    specializations: []
  };

  function renderStep() {
    if (indicator) {
      indicator.textContent = `Step ${currentStep} of 2`;
    }

    if (role === 'designer') {
      if (currentStep === 1) {
        renderDesignerStep1();
      } else {
        renderDesignerStep2();
      }
    } else {
      if (currentStep === 1) {
        renderClientStep1();
      } else {
        renderClientStep2();
      }
    }
  }

  // --- DESIGNER STEP 1: Practice details ---
  function renderDesignerStep1() {
    container!.innerHTML = `
      <div>
        <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">
          Tell us about your practice
        </h1>
        <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
          Help clients find your studio by defining your core professional disciplines and expertise.
        </p>

        <form id="onboarding-form-d1" style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label for="ob-prof-type" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
              Professional discipline
            </label>
            <select id="ob-prof-type" required style="width: 100%; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF;">
              <option value="architect">Architect</option>
              <option value="interior_designer">Interior Designer</option>
              <option value="landscape_architect">Landscape Architect</option>
              <option value="engineer">Structural / MEP Engineer</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
              Primary specializations (Select all that apply)
            </label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px;">
              ${categories.map((c) => `
                <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; padding: 8px 10px; border: 1px solid #E5E7EB; border-radius: 6px; cursor: pointer; background: #FFFFFF;">
                  <input type="checkbox" name="ob-spec" value="${c.name}" />
                  <span>${c.name}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
            <div>
              <label for="ob-city" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
                City
              </label>
              <input type="text" id="ob-city" required placeholder="e.g. Austin" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
            </div>
            <div>
              <label for="ob-state" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
                State
              </label>
              <select id="ob-state" required style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF;">
                <option value="">Select state...</option>
                ${US_STATES.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="ob-zip" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
                ZIP code
              </label>
              <input type="text" id="ob-zip" required placeholder="e.g. 78701" pattern="^\\d{5}(-\\d{4})?$" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
            </div>
          </div>

          <div>
            <label for="ob-experience" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
              Years of experience
            </label>
            <input type="number" id="ob-experience" min="0" max="60" value="5" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
          </div>

          <button type="submit" id="btn-ob-d1-next" style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer; margin-top: 10px;">
            Continue
          </button>
        </form>
      </div>
    `;

    document.getElementById('onboarding-form-d1')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profType = (document.getElementById('ob-prof-type') as HTMLSelectElement).value;
      const city = (document.getElementById('ob-city') as HTMLInputElement).value.trim();
      const state = (document.getElementById('ob-state') as HTMLSelectElement).value.trim();
      const zip = (document.getElementById('ob-zip') as HTMLInputElement).value.trim();
      const exp = parseInt((document.getElementById('ob-experience') as HTMLInputElement).value, 10) || 0;

      const checkedSpecs: string[] = [];
      document.querySelectorAll('input[name="ob-spec"]:checked').forEach((el: any) => {
        checkedSpecs.push(el.value);
      });

      formData.professional_type = profType;
      formData.specializations = checkedSpecs;
      formData.city = city;
      formData.state = state;
      formData.zip_code = zip;
      formData.location = `${city}, ${state} ${zip}`;
      formData.years_experience = exp;

      await saveOnboardingStep('designer', 1, formData);
      currentStep = 2;
      renderStep();
    });
  }

  // --- DESIGNER STEP 2: Profile Readiness Checklist ---
  function renderDesignerStep2() {
    container!.innerHTML = `
      <div>
        <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">
          Make your profile ready
        </h1>
        <p style="font-size: 14px; color: #64748B; margin: 0 0 24px; line-height: 1.5;">
          To send proposals and win projects on Dezignet, clients look for a verified track record. Before sending your first proposal, you'll need:
        </p>

        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
          <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px;">
            <li style="display: flex; align-items: flex-start; gap: 12px; font-size: 13px; color: #334155;">
              <span style="width: 20px; height: 20px; border-radius: 50%; background: #E0F2FE; color: #0284C7; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;">1</span>
              <div>
                <strong>A professional profile photo and bio</strong>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748B;">Let clients know your background and design philosophy.</p>
              </div>
            </li>
            <li style="display: flex; align-items: flex-start; gap: 12px; font-size: 13px; color: #334155;">
              <span style="width: 20px; height: 20px; border-radius: 50%; background: #E0F2FE; color: #0284C7; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;">2</span>
              <div>
                <strong>At least three portfolio projects</strong>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748B;">Showcase real renders, drawings, and finished architecture works.</p>
              </div>
            </li>
            <li style="display: flex; align-items: flex-start; gap: 12px; font-size: 13px; color: #334155;">
              <span style="width: 20px; height: 20px; border-radius: 50%; background: #E0F2FE; color: #0284C7; display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;">3</span>
              <div>
                <strong>Credentials and accreditation (optional)</strong>
                <p style="margin: 2px 0 0; font-size: 12px; color: #64748B;">Add licenses, certifications or registrations you hold. Optional. Verified credentials can earn the Verified badge on paid plans.</p>
              </div>
            </li>
          </ul>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button 
            type="button" 
            id="btn-ob-complete-profile"
            style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer;"
          >
            Complete my profile now
          </button>

          <button 
            type="button" 
            id="btn-ob-browse-first"
            style="width: 100%; background: none; border: 1px solid #E5E7EB; color: #475569; font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: 6px; cursor: pointer;"
          >
            Browse client projects first
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-ob-complete-profile')?.addEventListener('click', async () => {
      await completeOnboarding('designer', formData);
      onComplete('#settings?tab=profile');
    });

    document.getElementById('btn-ob-browse-first')?.addEventListener('click', async () => {
      await completeOnboarding('designer', formData);
      onComplete('#client-projects');
    });
  }

  // --- CLIENT STEP 1: Tell us about you ---
  function renderClientStep1() {
    container!.innerHTML = `
      <div>
        <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">
          Tell us about you
        </h1>
        <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
          Complete your profile so designers know where you are located.
        </p>

        <form id="onboarding-form-c1" style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 8px;">
              Account type
            </label>
            <div style="display: flex; gap: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer;">
                <input type="radio" name="ob-client-type" value="individual" checked /> Individual
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer;">
                <input type="radio" name="ob-client-type" value="company" id="ob-radio-company" /> Company
              </label>
            </div>
          </div>

          <div id="ob-company-group" style="display: none;">
            <label for="ob-company-name" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
              Company name
            </label>
            <input type="text" id="ob-company-name" placeholder="e.g. Sterling Holdings Ltd" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;">
            <div>
              <label for="ob-client-city" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
                City
              </label>
              <input type="text" id="ob-client-city" required placeholder="e.g. Denver" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
            </div>
            <div>
              <label for="ob-client-state" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
                State
              </label>
              <select id="ob-client-state" required style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF;">
                <option value="">Select state...</option>
                ${US_STATES.map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="ob-client-zip" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
                ZIP code
              </label>
              <input type="text" id="ob-client-zip" required placeholder="e.g. 80202" pattern="^\\d{5}(-\\d{4})?$" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
            </div>
          </div>

          <div>
            <label for="ob-client-phone" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
              Phone number (Optional)
            </label>
            <input type="tel" id="ob-client-phone" placeholder="e.g. (303) 555-0144" style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A;" />
            <span style="font-size: 11px; color: #64748B; margin-top: 4px; display: block;">Private: Your phone number is strictly encrypted and never shown to designers.</span>
          </div>

          <button type="submit" id="btn-ob-c1-next" style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer; margin-top: 10px;">
            Continue
          </button>
        </form>
      </div>
    `;

    const radioComp = document.getElementById('ob-radio-company');
    const compGroup = document.getElementById('ob-company-group');
    document.querySelectorAll('input[name="ob-client-type"]').forEach((r: any) => {
      r.addEventListener('change', () => {
        if (compGroup) compGroup.style.display = radioComp && (radioComp as HTMLInputElement).checked ? 'block' : 'none';
      });
    });

    document.getElementById('onboarding-form-c1')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const isCompany = radioComp && (radioComp as HTMLInputElement).checked;
      const companyName = (document.getElementById('ob-company-name') as HTMLInputElement)?.value.trim();
      const city = (document.getElementById('ob-client-city') as HTMLInputElement).value.trim();
      const state = (document.getElementById('ob-client-state') as HTMLSelectElement).value.trim();
      const zip = (document.getElementById('ob-client-zip') as HTMLInputElement).value.trim();
      const phone = (document.getElementById('ob-client-phone') as HTMLInputElement).value.trim();

      formData.account_type = isCompany ? 'company' : 'individual';
      formData.company_name = isCompany ? companyName : null;
      formData.city = city;
      formData.state = state;
      formData.zip_code = zip;
      formData.location = `${city}, ${state} ${zip}`;
      formData.phone = phone || null;

      await saveOnboardingStep('client', 1, formData);
      currentStep = 2;
      renderStep();
    });
  }

  // --- CLIENT STEP 2: What would you like to do? ---
  function renderClientStep2() {
    container!.innerHTML = `
      <div>
        <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">
          What would you like to do?
        </h1>
        <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
          You're all set! Choose how you would like to begin your architectural journey.
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
          <!-- Choice A: Post a project -->
          <button 
            type="button" 
            id="btn-ob-post-project"
            style="display: flex; align-items: flex-start; gap: 16px; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; text-align: left; cursor: pointer; transition: all 150ms ease;"
          >
            <div style="width: 40px; height: 40px; border-radius: 8px; background: #EFF6FF; color: #2F7BE5; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
              📐
            </div>
            <div>
              <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Post a project</h3>
              <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.4;">
                Describe your project, set your budget, and receive custom proposals from verified designers.
              </p>
            </div>
          </button>

          <!-- Choice B: Find designers -->
          <button 
            type="button" 
            id="btn-ob-find-designers"
            style="display: flex; align-items: flex-start; gap: 16px; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px; background: #FFFFFF; text-align: left; cursor: pointer; transition: all 150ms ease;"
          >
            <div style="width: 40px; height: 40px; border-radius: 8px; background: #F8FAFC; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0;">
              🔍
            </div>
            <div>
              <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 4px;">Find designers</h3>
              <p style="font-size: 13px; color: #64748B; margin: 0; line-height: 1.4;">
                Browse portfolios of experienced architects, interior designers, and engineers.
              </p>
            </div>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-ob-post-project')?.addEventListener('click', async () => {
      await completeOnboarding('client', formData);
      onComplete('#post-project');
    });

    document.getElementById('btn-ob-find-designers')?.addEventListener('click', async () => {
      await completeOnboarding('client', formData);
      onComplete('#find-designers');
    });
  }

  renderStep();
}

