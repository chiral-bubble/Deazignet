/**
 * VerifyEmail — Verification Waiting Screen
 * Displays user email, resend cooldown (60s), different email link,
 * and reactive listener that detects when email is confirmed in another tab.
 */

export function renderVerifyEmail(emailAddress: string = ''): string {
  const displayEmail = emailAddress || 'your email';

  return `
    <div id="verify-email-view" style="width: 100%; text-align: center;">
      <div style="width: 56px; height: 56px; border-radius: 50%; background: #EFF6FF; color: #2F7BE5; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 24px;">
        ✉️
      </div>

      <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0F172A; margin: 0 0 10px; line-height: 1.2;">
        Check your email
      </h1>
      <p style="font-size: 14px; color: #475569; margin: 0 auto 24px; line-height: 1.6; max-width: 360px;">
        We've sent a verification link to <strong id="verify-email-display" style="color: #0F172A;">${displayEmail}</strong>. Click the link inside to activate your account.
      </p>

      <!-- Feedback banner -->
      <div id="verify-feedback" aria-live="polite" style="display: none; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 20px;"></div>

      <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto;">
        <button 
          type="button" 
          id="btn-verify-resend" 
          style="width: 100%; background: #2F7BE5; color: #FFFFFF; border: none; font-size: 14px; font-weight: 500; padding: 10px 16px; border-radius: 6px; cursor: pointer; transition: background 150ms ease;"
        >
          Resend email
        </button>

        <a 
          href="#signup" 
          style="font-size: 13px; color: #64748B; text-decoration: underline; padding: 6px;"
        >
          Use a different email address
        </a>
      </div>

      <div style="margin-top: 36px; padding: 16px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; font-size: 12px; color: #64748B; line-height: 1.5; text-align: left;">
        <strong style="color: #334155;">Didn't receive the email?</strong><br/>
        Check your spam folder or wait 60 seconds before requesting a new link. Once clicked, this page will automatically advance.
      </div>
    </div>
  `;
}

