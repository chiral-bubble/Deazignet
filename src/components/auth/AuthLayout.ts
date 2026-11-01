/**
 * AuthLayout — Clean, light, two-column layout for Authentication & Entry flow.
 * Left: Max 440px form card on pure white (#FFFFFF) with Dezignet logo.
 * Right: Calm panel in light grey (#F7F7F8) with architecture photography and value statement (desktop only).
 */

export function renderAuthLayout(contentHtml: string, sideTitle?: string, sideSubtitle?: string): string {
  const displayTitle = sideTitle || 'The premier architecture & design studio network.';
  const displaySubtitle = sideSubtitle || 'Connecting visionary clients with licensed architects, interior designers, landscape architects, and engineers.';

  return `
    <div class="auth-layout" style="min-height: 100vh; display: flex; background: #FFFFFF; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Left: Interactive Form Column -->
      <div class="auth-layout__left" style="flex: 1; max-width: 520px; width: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 40px 32px; box-sizing: border-box; border-right: 1px solid #E5E7EB;">
        <!-- Header / Logo -->
        <header style="margin-bottom: 24px;">
          <a href="/" id="auth-logo" style="display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: #0F172A; font-weight: 700; font-size: 18px;">
            <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#2F7BE5" fill-opacity="0.12"/>
              <path d="M10 26V10h5.5c2 0 3.5.5 4.5 1.5s1.5 2.3 1.5 4-.5 3-1.5 4-2.5 1.5-4.5 1.5H14v5h-4z" fill="#2F7BE5"/>
              <path d="M18 17l8 9" stroke="#2F7BE5" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            Dezignet
          </a>
        </header>

        <!-- Dynamic Form Content -->
        <main class="auth-layout__main" style="flex: 1; display: flex; flex-direction: column; justify-content: center; max-width: 440px; width: 100%; margin: 0 auto;">
          ${contentHtml}
        </main>

        <!-- Footer / Legal link -->
        <footer style="margin-top: 32px; font-size: 12px; color: #64748B; line-height: 1.5;">
          <span>© 2026 Dezignet. All rights reserved. </span>
          <a href="#terms" style="color: #64748B; text-decoration: underline;">Terms</a>
          <span> &bull; </span>
          <a href="#privacy" style="color: #64748B; text-decoration: underline;">Privacy</a>
        </footer>
      </div>

      <!-- Right: Architecture Photography Column (Desktop only, >= 1024px) -->
      <div class="auth-layout__right" style="flex: 1.2; background: #F7F7F8; display: flex; flex-direction: column; justify-content: space-between; padding: 48px; box-sizing: border-box; position: relative; overflow: hidden;">
        <div style="max-width: 480px; z-index: 2;">
          <span style="display: inline-block; font-size: 12px; font-weight: 600; color: #2F7BE5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Verified Professionals & Escrow Protected</span>
          <h2 style="font-family: 'Playfair Display', Georgia, serif; font-size: 32px; font-weight: 600; color: #0F172A; line-height: 1.25; margin: 0 0 12px;">
            ${displayTitle}
          </h2>
          <p style="font-size: 15px; color: #475569; line-height: 1.6; margin: 0;">
            ${displaySubtitle}
          </p>
        </div>

        <!-- Architectural Image Feature -->
        <div style="width: 100%; height: 380px; border-radius: 8px; border: 1px solid #E5E7EB; overflow: hidden; background: #E2E8F0; z-index: 2; margin-top: 32px;">
          <img 
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80" 
            alt="Modern architectural residence" 
            style="width: 100%; height: 100%; object-fit: cover; display: block;"
          />
        </div>

        <div style="display: flex; gap: 32px; font-size: 13px; color: #64748B; z-index: 2; margin-top: 24px;">
          <div><strong style="color: #0F172A;">2,000+</strong> Completed projects</div>
          <div><strong style="color: #0F172A;">100%</strong> Milestone protected</div>
          <div><strong style="color: #0F172A;">Verified</strong> License checks</div>
        </div>
      </div>
    </div>

    <style>
      @media (max-width: 1023px) {
        .auth-layout__right {
          display: none !important;
        }
        .auth-layout__left {
          max-width: 100% !important;
          border-right: none !important;
          padding: 24px 20px !important;
        }
      }
    </style>
  `;
}

