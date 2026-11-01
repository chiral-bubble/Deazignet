/**
 * SignUpForm — Step 2 of Registration
 * Collects Full Name, Email, Password (with live strength meter),
 * Individual/Company selection for clients, and Terms checkbox.
 */

export function renderSignUpForm(role: 'client' | 'designer', _initialRoleChosenFromStep1: boolean = true): string {
  const isClient = role === 'client';
  const roleName = isClient ? 'client' : 'designer';

  return `
    <div id="signup-details-step" style="width: 100%;">
      <!-- Role switch banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 12px; margin-bottom: 20px; font-size: 13px;">
        <span style="color: #475569;">
          Signing up as a <strong>${roleName}</strong>.
        </span>
        <button type="button" id="btn-change-role" style="background: none; border: none; color: #2F7BE5; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: underline; padding: 0;">
          Change
        </button>
      </div>

      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 26px; font-weight: 600; color: #0F172A; margin: 0 0 8px; line-height: 1.2;">
        Create your account
      </h1>
      <p style="font-size: 13px; color: #64748B; margin: 0 0 24px; line-height: 1.4;">
        One account gives you secure access to project milestones, messaging, and payments.
      </p>

      <form id="signup-form" novalidate style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Honeypot anti-bot field -->
        <div style="display: none;" aria-hidden="true">
          <input type="text" name="dezignet_hp_check" id="dezignet-hp-check" tabindex="-1" autocomplete="off" />
        </div>

        <!-- Full Name -->
        <div>
          <label for="signup-name" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
            Full name
          </label>
          <input 
            type="text" 
            id="signup-name" 
            name="fullName" 
            required 
            placeholder="e.g. Alex Mitchell" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
        </div>

        <!-- Email -->
        <div>
          <label for="signup-email" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
            Email address
          </label>
          <input 
            type="email" 
            id="signup-email" 
            name="email" 
            required 
            placeholder="you@example.com" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
          <span style="font-size: 11px; color: #94A3B8; margin-top: 4px; display: block;">One email equals one role. To hold both roles, use separate emails.</span>
        </div>

        <!-- Password with show/hide and strength meter -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label for="signup-password" style="font-size: 13px; font-weight: 500; color: #1E293B;">
              Password
            </label>
            <button type="button" id="btn-toggle-signup-pwd" style="background: none; border: none; font-size: 12px; color: #64748B; cursor: pointer; padding: 0;">
              Show
            </button>
          </div>
          <input 
            type="password" 
            id="signup-password" 
            name="password" 
            required 
            placeholder="At least 8 characters" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />

          <!-- Live Strength Meter -->
          <div style="margin-top: 8px;">
            <div style="height: 4px; width: 100%; background: #E2E8F0; border-radius: 2px; overflow: hidden; display: flex;">
              <div id="pwd-strength-bar" style="width: 0%; height: 100%; transition: width 150ms ease, background 150ms ease;"></div>
            </div>
            <div id="pwd-strength-text" style="font-size: 11px; color: #64748B; margin-top: 4px;">Strength: Empty</div>
          </div>

          <!-- Password Requirement Checklist -->
          <ul style="margin: 8px 0 0; padding-left: 18px; font-size: 11px; color: #64748B; line-height: 1.5;">
            <li id="req-len">At least 8 characters</li>
            <li id="req-mix">Mix of uppercase, lowercase, and numbers or symbols</li>
          </ul>
        </div>

        <!-- Client specific: Individual vs Company -->
        ${isClient ? `
          <div style="padding-top: 4px;">
            <label style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 8px;">
              I am posting as:
            </label>
            <div style="display: flex; gap: 16px; margin-bottom: 12px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer;">
                <input type="radio" name="accountType" value="individual" checked /> An individual
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; cursor: pointer;">
                <input type="radio" name="accountType" value="company" id="radio-company" /> A company / studio
              </label>
            </div>
            <div id="company-name-group" style="display: none;">
              <label for="signup-company" style="display: block; font-size: 12px; font-weight: 500; color: #475569; margin-bottom: 4px;">
                Company name
              </label>
              <input 
                type="text" 
                id="signup-company" 
                name="companyName" 
                placeholder="e.g. Apex Habitat Ltd" 
                style="width: 100%; box-sizing: border-box; padding: 9px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 13px; color: #0F172A; background: #FFFFFF; outline: none;"
              />
            </div>
          </div>
        ` : ''}

        <!-- Terms of Service & Privacy Checkbox -->
        <div style="margin-top: 4px;">
          <label style="display: flex; align-items: flex-start; gap: 10px; font-size: 12px; color: #475569; cursor: pointer; line-height: 1.5;">
            <input type="checkbox" id="signup-terms" required style="margin-top: 2px;" />
            <span>
              I agree to the <a href="#terms" target="_blank" style="color: #2F7BE5; text-decoration: underline;">Terms of Service</a> and <a href="#privacy" target="_blank" style="color: #2F7BE5; text-decoration: underline;">Privacy Policy</a>.
            </span>
          </label>
        </div>

        <!-- Error Feedback Banner -->
        <div id="signup-error-banner" aria-live="polite" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; padding: 10px 12px; border-radius: 6px; font-size: 13px;"></div>

        <!-- Actions -->
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
          <button 
            type="submit" 
            id="btn-signup-submit"
            style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer; transition: background 150ms ease;"
          >
            Create account
          </button>

          <button 
            type="button" 
            id="btn-signup-back"
            style="width: 100%; background: none; border: 1px solid #E5E7EB; color: #475569; font-size: 13px; font-weight: 500; padding: 9px 16px; border-radius: 6px; cursor: pointer;"
          >
            Back to role selection
          </button>
        </div>
      </form>
    </div>
  `;
}

