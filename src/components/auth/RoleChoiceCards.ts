/**
 * RoleChoiceCards — Step 1 of Sign Up
 * Large selectable cards for choosing between Client and Designer.
 * Selected card receives 2px solid #2F7BE5 border with a checkmark.
 */

export function renderRoleChoiceCards(selectedRole: 'client' | 'designer' | null = null): string {
  return `
    <div id="role-choice-step" style="width: 100%;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0F172A; margin: 0 0 8px; line-height: 1.2;">
        How will you use Dezignet?
      </h1>
      <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
        Choose the account type that matches your goals. Each account is tailored for its specific role.
      </p>

      <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
        <!-- Card 1: Client -->
        <div 
          id="role-card-client" 
          tabindex="0"
          role="radio"
          aria-checked="${selectedRole === 'client' ? 'true' : 'false'}"
          style="border: 2px solid ${selectedRole === 'client' ? '#2F7BE5' : '#E5E7EB'}; background: ${selectedRole === 'client' ? '#F0F7FF' : '#FFFFFF'}; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 150ms ease; position: relative;"
        >
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0;">I'm a client</h3>
            <div class="role-check-indicator" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${selectedRole === 'client' ? '#2F7BE5' : '#CBD5E1'}; background: ${selectedRole === 'client' ? '#2F7BE5' : 'transparent'}; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 11px;">
              ${selectedRole === 'client' ? '✓' : ''}
            </div>
          </div>
          <p style="font-size: 13px; color: #475569; margin: 0 0 12px; line-height: 1.4;">
            I want to hire a design professional for my project.
          </p>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #64748B; line-height: 1.6;">
            <li>Post your project for free</li>
            <li>Compare proposals from verified designers</li>
            <li>Pay safely with milestone-based escrow</li>
          </ul>
        </div>

        <!-- Card 2: Designer -->
        <div 
          id="role-card-designer" 
          tabindex="0"
          role="radio"
          aria-checked="${selectedRole === 'designer' ? 'true' : 'false'}"
          style="border: 2px solid ${selectedRole === 'designer' ? '#2F7BE5' : '#E5E7EB'}; background: ${selectedRole === 'designer' ? '#F0F7FF' : '#FFFFFF'}; border-radius: 8px; padding: 20px; cursor: pointer; transition: all 150ms ease; position: relative;"
        >
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0;">I'm a designer</h3>
            <div class="role-check-indicator" style="width: 20px; height: 20px; border-radius: 50%; border: 2px solid ${selectedRole === 'designer' ? '#2F7BE5' : '#CBD5E1'}; background: ${selectedRole === 'designer' ? '#2F7BE5' : 'transparent'}; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-size: 11px;">
              ${selectedRole === 'designer' ? '✓' : ''}
            </div>
          </div>
          <p style="font-size: 13px; color: #475569; margin: 0 0 12px; line-height: 1.4;">
            I'm an architect, interior designer, landscape architect or engineer looking for projects.
          </p>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #64748B; line-height: 1.6;">
            <li>Browse projects from clients worldwide</li>
            <li>Send custom proposals and milestone plans</li>
            <li>Get paid securely as you deliver</li>
          </ul>
        </div>
      </div>

      <button 
        id="btn-role-continue" 
        ${!selectedRole ? 'disabled' : ''}
        style="width: 100%; background: ${selectedRole ? '#2F7BE5' : '#94A3B8'}; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: ${selectedRole ? 'pointer' : 'not-allowed'}; transition: background 150ms ease;"
      >
        Continue
      </button>

      <div style="text-align: center; margin-top: 20px; font-size: 13px; color: #64748B;">
        Already have an account? <a href="#login" style="color: #2F7BE5; text-decoration: none; font-weight: 500;">Log in</a>
      </div>
    </div>
  `;
}

