/**
 * LoginForm — Interactive Clean Login View
 * Email and password fields, show/hide toggle, forgot password link,
 * unverified email banner with 60s cooldown resend button.
 */

export function renderLoginForm(nextParam: string = ''): string {
  const signupHref = nextParam ? `#signup?next=${encodeURIComponent(nextParam)}` : '#signup';
  const forgotHref = nextParam ? `#forgot-password?next=${encodeURIComponent(nextParam)}` : '#forgot-password';

  return `
    <div id="login-view-inner" style="width: 100%;">
      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0F172A; margin: 0 0 8px; line-height: 1.2;">
        Welcome back
      </h1>
      <p style="font-size: 14px; color: #64748B; margin: 0 0 28px; line-height: 1.5;">
        Log in to manage your projects, review proposals, and continue messaging.
      </p>

      <!-- Unverified Email Alert Banner (Dynamic) -->
      <div id="unverified-email-banner" aria-live="polite" style="display: none; background: #FFFBEB; border: 1px solid #FCD34D; color: #92400E; padding: 12px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 20px;">
        <div style="font-weight: 600; margin-bottom: 4px;">Email verification required</div>
        <p style="margin: 0 0 10px; line-height: 1.4;">
          Please verify your email address to access your studio account. Check your inbox or request a new link.
        </p>
        <button type="button" id="btn-resend-verification" style="background: #D97706; color: #FFFFFF; border: none; font-size: 12px; font-weight: 500; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
          Resend verification email
        </button>
        <span id="resend-cooldown-text" style="font-size: 12px; color: #B45309; margin-left: 8px;"></span>
      </div>

      <!-- General Error Banner -->
      <div id="login-error-banner" aria-live="polite" style="display: none; background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; padding: 10px 12px; border-radius: 6px; font-size: 13px; margin-bottom: 20px;"></div>

      <form id="login-form" novalidate style="display: flex; flex-direction: column; gap: 18px;">
        <div>
          <label for="login-email" style="display: block; font-size: 13px; font-weight: 500; color: #1E293B; margin-bottom: 6px;">
            Email address
          </label>
          <input 
            type="email" 
            id="login-email" 
            name="email" 
            required 
            placeholder="you@example.com" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label for="login-password" style="font-size: 13px; font-weight: 500; color: #1E293B;">
              Password
            </label>
            <button type="button" id="btn-toggle-login-pwd" style="background: none; border: none; font-size: 12px; color: #64748B; cursor: pointer; padding: 0;">
              Show
            </button>
          </div>
          <input 
            type="password" 
            id="login-password" 
            name="password" 
            required 
            placeholder="••••••••" 
            style="width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 14px; color: #0F172A; background: #FFFFFF; outline: none; transition: border-color 150ms ease;"
          />
        </div>

        <div style="display: flex; justify-content: flex-end; align-items: center; font-size: 13px;">
          <a href="${forgotHref}" style="color: #2F7BE5; text-decoration: none; font-weight: 500;">
            Forgot password?
          </a>
        </div>

        <button 
          type="submit" 
          id="btn-login-submit"
          style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 11px 16px; border-radius: 6px; cursor: pointer; transition: background 150ms ease;"
        >
          Log in
        </button>

        <div style="text-align: center; margin-top: 16px; font-size: 13px; color: #64748B;">
          Don't have an account? <a href="${signupHref}" style="color: #2F7BE5; text-decoration: none; font-weight: 500;">Sign up</a>
        </div>
      </form>
    </div>
  `;
}

