/**
 * ResetPassword — Set New Password Page
 * Handles new password confirmation, password strength meter,
 * expired/used link state, and success redirect to login.
 */

export function renderResetPassword(): string {
  return `
    <div id="reset-password-view" style="width: 100%;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0F172A; margin: 0 0 8px; line-height: 1.2;">
        Set new password
      </h1>
      <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
        Choose a strong, unique password to secure your Dezignet account.
      </p>

      <!-- Expired link banner -->
      <div id="reset-expired-banner" aria-live="polite" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; padding: 14px 16px; border-radius: 6px; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
        <div style="font-weight: 600; margin-bottom: 4px;">Link expired or already used</div>
        This password reset link has expired or is no longer valid.
        <div style="margin-top: 10px;">
          <a href="#forgot-password" style="display: inline-block; background: #DC2626; color: #FFFFFF; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 4px; text-decoration: none;">
            Request new reset link
          </a>
        </div>
      </div>

      <!-- Success banner -->
      <div id="reset-success-banner" aria-live="polite" style="display: none; background: #F0FDF4; border: 1px solid #86EFAC; color: #166534; padding: 14px 16px; border-radius: 6px; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
        <div style="font-weight: 600; margin-bottom: 4px;">Password updated successfully</div>
        Your password has been changed. You can now log in with your new credentials.
        <div style="margin-top: 12px;">
          <a href="#login" style="display: inline-block; background: #2F7BE5; color: #FFFFFF; font-size: 13px; font-weight: 500; padding: 8px 16px; border-radius: 6px; text-decoration: none;">
            Log in now
          </a>
        </div>
      </div>

      <!-- General error banner -->
      <div id="reset-error-banner" aria-live="polite" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; padding: 10px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 20px;"></div>

      <form id="reset-password-form" novalidate style="display: flex; flex-direction: column; gap: 18px;">
        <!-- New Password -->
        <div>
          <label for="new-password" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
            New password
          </label>
          <input 
            type="password" 
            id="new-password" 
            name="newPassword" 
            required 
            placeholder="At least 8 characters" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
        </div>

        <!-- Confirm Password -->
        <div>
          <label for="confirm-password" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
            Confirm new password
          </label>
          <input 
            type="password" 
            id="confirm-password" 
            name="confirmPassword" 
            required 
            placeholder="Re-enter new password" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
        </div>

        <button 
          type="submit" 
          id="btn-reset-submit"
          style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer; transition: background 150ms ease;"
        >
          Update password
        </button>
      </form>
    </div>
  `;
}

