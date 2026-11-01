/**
 * ForgotPassword — Password Reset Request Page
 * Neutral confirmation message in all cases to prevent email enumeration.
 */

export function renderForgotPassword(): string {
  return `
    <div id="forgot-password-view" style="width: 100%;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0F172A; margin: 0 0 8px; line-height: 1.2;">
        Reset your password
      </h1>
      <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
        Enter your registered email address and we'll send you instructions to reset your password.
      </p>

      <div id="forgot-success-banner" aria-live="polite" style="display: none; background: #F0FDF4; border: 1px solid #86EFAC; color: #166534; padding: 14px 16px; border-radius: 6px; font-size: 13px; line-height: 1.5; margin-bottom: 24px;">
        <div style="font-weight: 600; margin-bottom: 4px;">Check your email</div>
        If an account exists for that email, we have sent instructions to reset your password. Please check your inbox and spam folder.
      </div>

      <form id="forgot-password-form" novalidate style="display: flex; flex-direction: column; gap: 18px;">
        <div>
          <label for="forgot-email" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
            Email address
          </label>
          <input 
            type="email" 
            id="forgot-email" 
            name="email" 
            required 
            placeholder="you@example.com" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
        </div>

        <button 
          type="submit" 
          id="btn-forgot-submit"
          style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer; transition: background 150ms ease;"
        >
          Send reset instructions
        </button>

        <div style="text-align: center; margin-top: 12px; font-size: 13px; color: #64748B;">
          Remembered your password? <a href="#login" style="color: #2F7BE5; text-decoration: none; font-weight: 500;">Back to login</a>
        </div>
      </form>
    </div>
  `;
}

