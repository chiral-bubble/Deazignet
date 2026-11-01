/**
 * LegalPage — Readable, clean Terms of Service and Privacy Policy pages.
 * Clearly marked placeholder with full coverage of Dezignet rules:
 * - Milestone-based escrow
 * - 14-day auto-approval of submitted deliverables
 * - 5-day payout security hold period
 * - Dispute resolution protocol
 * - Data collection, retention (7 years for contract deliverables), and privacy rights.
 */

export function renderLegalPage(type: 'terms' | 'privacy'): string {
  const isTerms = type === 'terms';
  const pageTitle = isTerms ? 'Terms of Service' : 'Privacy Policy';
  const lastUpdated = 'October 29, 2026';
  const version = '2026.1';

  return `
    <div class="legal-page" style="min-height: 100vh; background: #FFFFFF; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B;">
      <!-- Header -->
      <header style="border-bottom: 1px solid #E5E7EB; padding: 20px 32px; background: #FFFFFF; position: sticky; top: 0; z-index: 10;">
        <div style="max-width: 860px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
          <a href="/" style="display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: #0F172A; font-weight: 700; font-size: 18px;">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="8" fill="#2F7BE5" fill-opacity="0.12"/>
              <path d="M10 26V10h5.5c2 0 3.5.5 4.5 1.5s1.5 2.3 1.5 4-.5 3-1.5 4-2.5 1.5-4.5 1.5H14v5h-4z" fill="#2F7BE5"/>
              <path d="M18 17l8 9" stroke="#2F7BE5" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            Dezignet
          </a>

          <div style="display: flex; gap: 16px; font-size: 13px;">
            <a href="/terms" style="color: ${isTerms ? '#2F7BE5' : '#64748B'}; font-weight: ${isTerms ? '600' : '400'}; text-decoration: none;">Terms of Service</a>
            <a href="/privacy" style="color: ${!isTerms ? '#2F7BE5' : '#64748B'}; font-weight: ${!isTerms ? '600' : '400'}; text-decoration: none;">Privacy Policy</a>
            <a href="/" style="color: #64748B; text-decoration: none;">Home</a>
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main style="max-width: 860px; margin: 0 auto; padding: 48px 24px 96px; line-height: 1.7;">
        <!-- Draft Review Watermark Banner -->
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; color: #92400E; padding: 14px 18px; border-radius: 6px; font-size: 13px; margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between;">
          <span><strong>Draft — For Review Only.</strong> This legal agreement is placeholder copy for testing and will be reviewed and replaced by legal counsel before commercial launch.</span>
          <span style="font-size: 11px; background: #FDE68A; padding: 2px 8px; border-radius: 4px; font-weight: 600;">STAGING</span>
        </div>

        <h1 style="font-family: 'Playfair Display', Georgia, serif; font-size: 34px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">
          ${pageTitle}
        </h1>
        <p style="font-size: 14px; color: #64748B; margin: 0 0 36px;">
          Effective Date: ${lastUpdated} &bull; Version ${version}
        </p>

        ${isTerms ? renderTermsContent() : renderPrivacyContent()}
      </main>

      <!-- Minimal Footer -->
      <footer style="border-top: 1px solid #E5E7EB; background: #F8FAFC; padding: 32px 24px; text-align: center; font-size: 13px; color: #64748B;">
        <div style="max-width: 860px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 12px;">
          <span>© 2026 Dezignet Technologies Ltd. All rights reserved.</span>
          <div>
            <a href="mailto:legal@dezignet.studio" style="color: #2F7BE5; text-decoration: none;">legal@dezignet.studio</a>
          </div>
        </div>
      </footer>
    </div>
  `;
}

function renderTermsContent(): string {
  return `
    <section style="display: flex; flex-direction: column; gap: 32px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">1. Acceptance of Terms</h2>
        <p style="margin: 0; color: #334155;">
          By creating an account, posting a project, submitting a proposal, or accessing the Dezignet platform ("Platform"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use or access the Platform.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">2. User Accounts and Role Whitelisting</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          Users must register as either a "Client" or a "Designer". An individual email address is strictly limited to one role. Users seeking both roles must maintain separate accounts.
        </p>
        <p style="margin: 0; color: #334155;">
          You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">3. Payments, Escrow & Milestone Funding</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          All financial engagements on Dezignet operate under milestone-based escrow:
        </p>
        <ul style="margin: 0; padding-left: 24px; color: #334155;">
          <li>Clients fund milestones prior to the commencement of design work.</li>
          <li>Funds remain safely in escrow until deliverables are submitted and approved.</li>
          <li>Designers submit deliverables (PDFs, CAD, BIM, 3D packages) directly through the platform storage vault.</li>
        </ul>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">4. 14-Day Auto-Approval Rule</h3>
        <p style="margin: 0 0 8px; font-size: 14px; color: #334155;">
          Upon submission of a milestone deliverable or hourly invoice by the designer, the client is granted a <strong>14 calendar day review window</strong>.
        </p>
        <p style="margin: 0; font-size: 14px; color: #334155;">
          If the client does not approve, request a revision, or raise a dispute within 14 days, the deliverable is <strong>automatically approved</strong> by the system.
        </p>
      </div>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 20px;">
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 0 0 8px;">5. 5-Day Payout Security Period & Disputes</h3>
        <p style="margin: 0 0 8px; font-size: 14px; color: #334155;">
          Following any milestone approval (manual client sign-off or automatic approval), funds are placed into a <strong>5 calendar day security hold</strong> (payout status: pending_release).
        </p>
        <p style="margin: 0; font-size: 14px; color: #334155;">
          During this 5-day security window, the client may raise a formal dispute if non-conforming issues are identified. If no dispute is raised, funds are released to the designer immediately upon expiration of the 5-day hold.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">6. Immutability of Submitted Deliverables</h2>
        <p style="margin: 0; color: #334155;">
          To ensure contract integrity, auditability, and legal compliance, once deliverables are submitted on a funded milestone, they become permanently immutable. Deliverable files cannot be altered, replaced, or deleted.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">7. Prohibited Conduct</h2>
        <p style="margin: 0; color: #334155;">
          Users must not circumvent platform escrow, upload malicious or scriptable file formats (.exe, .html, .js, .svg), transmit offensive communications, or engage in unverified credential representations.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">8. Contact Us</h2>
        <p style="margin: 0; color: #334155;">
          For questions regarding these Terms, contact our legal department at <a href="mailto:legal@dezignet.studio" style="color: #2F7BE5; text-decoration: underline;">legal@dezignet.studio</a>.
        </p>
      </div>
    </section>
  `;
}

function renderPrivacyContent(): string {
  return `
    <section style="display: flex; flex-direction: column; gap: 32px;">
      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">1. Information We Collect</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          We collect personal and professional information to deliver design marketplace services:
        </p>
        <ul style="margin: 0; padding-left: 24px; color: #334155;">
          <li><strong>Account Data:</strong> Full name, email address, user role, hashed password, terms acceptance date.</li>
          <li><strong>Professional Practice:</strong> Licensing registration, educational credentials, design portfolio images.</li>
          <li><strong>Private Project Details:</strong> Physical street addresses, postal codes, and site access notes (strictly protected by Row Level Security).</li>
        </ul>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">2. Site Privacy & Access Control</h2>
        <p style="margin: 0; color: #334155;">
          Physical site details (street and postal code) are confidential. They are never revealed to browsing designers or the public. Only the project owner, platform administrators, and the specific designer hired on a signed engagement can access private site notes.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">3. Data Retention</h2>
        <p style="margin: 0; color: #334155;">
          In accordance with statutory architectural and contractual requirements, project milestone records and contractual deliverables are retained for <strong>7 years</strong> following project completion. Soft-deleted files are purged after 7 days.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">4. Your Rights</h2>
        <p style="margin: 0; color: #334155;">
          You have the right to access, rectify, or request deletion of your personal profile data, subject to legal retention obligations for active financial and escrow contracts.
        </p>
      </div>

      <div>
        <h2 style="font-size: 20px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">5. Contact Privacy Office</h2>
        <p style="margin: 0; color: #334155;">
          For inquiries or data subject requests, please contact <a href="mailto:privacy@dezignet.studio" style="color: #2F7BE5; text-decoration: underline;">privacy@dezignet.studio</a>.
        </p>
      </div>
    </section>
  `;
}

