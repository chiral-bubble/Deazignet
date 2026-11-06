/**
 * LegalPage — Terms of Service and Privacy Policy pages.
 * Placeholder: to be reviewed by legal counsel before launch.
 * US market compliance placeholders:
 * - Governing law and venue (State to be set)
 * - Dispute resolution protocol
 * - Electronic signature consent
 * - Independent contractor relationship
 * - Licensure disclaimers & responsibility
 * - Privacy rights for US residents (access & deletion)
 * - Cookies & tracking
 * - Email communication consent
 * - Accessibility statement
 */

export function renderLegalPage(type: 'terms' | 'privacy'): string {
  const isTerms = type === 'terms';
  const pageTitle = isTerms ? 'Terms of Service' : 'Privacy Policy';
  const lastUpdated = 'November 4, 2026';
  const version = '2026.2-US';

  return `
    <div class="legal-page" style="min-height: 100vh; background: #FFFFFF; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1E293B;">
      <!-- Header -->
      <header style="border-bottom: 1px solid #E5E7EB; padding: 20px 32px; background: #FFFFFF; position: sticky; top: 0; z-index: 10;">
        <div style="max-width: 860px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
          <a href="/" style="display: inline-flex; align-items: center; gap: 10px; text-decoration: none; color: #0F172A; font-weight: 700; font-size: 18px;">
            <img src="/logo.png" alt="Dezignet" style="width: 28px; height: 28px; border-radius: 6px; object-fit: contain;" />
            Dezignet
          </a>

          <div style="display: flex; gap: 16px; font-size: 13px;">
            <a href="#terms" style="color: ${isTerms ? '#2F7BE5' : '#64748B'}; font-weight: ${isTerms ? '600' : '400'}; text-decoration: none;">Terms of Service</a>
            <a href="#privacy" style="color: ${!isTerms ? '#2F7BE5' : '#64748B'}; font-weight: ${!isTerms ? '600' : '400'}; text-decoration: none;">Privacy Policy</a>
            <a href="/" style="color: #64748B; text-decoration: none;">Home</a>
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main style="max-width: 860px; margin: 0 auto; padding: 48px 24px 96px; line-height: 1.7;">
        <!-- Legal Counsel Review Banner -->
        <div style="background: #FEF3C7; border: 1px solid #F59E0B; color: #92400E; padding: 14px 18px; border-radius: 6px; font-size: 13px; margin-bottom: 32px; display: flex; align-items: center; justify-content: space-between;">
          <span><strong>Placeholder: to be reviewed by legal counsel before launch.</strong> This document contains placeholder legal clauses for development and staging.</span>
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

      <!-- Footer -->
      <footer style="border-top: 1px solid #E5E7EB; background: #F8FAFC; padding: 32px 24px; text-align: center; font-size: 13px; color: #64748B;">
        <div style="max-width: 860px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <span>© 2026 Dezignet Technologies Inc. All rights reserved.</span>
          <div>
            <a href="mailto:legal@dezignet.com" style="color: #2F7BE5; text-decoration: none;">legal@dezignet.com</a>
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
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">1. User Eligibility (18+ Requirement)</h2>
        <p style="margin: 0; color: #334155;">
          The Dezignet platform ("Platform") is intended solely for users who are eighteen (18) years of age or older. By registering or using the Platform, you represent and warrant that you meet this requirement.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">2. Independent Contractor Relationship</h2>
        <p style="margin: 0; color: #334155;">
          Design professionals offering services on Dezignet operate as independent contractors and not as employees, agents, or joint venturers of Dezignet. Dezignet is a technology communications and workflow marketplace platform and is not a party to architectural or engineering service agreements formed between clients and designers.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">3. Compliance with professional regulations</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          <strong>[Placeholder text marked for legal review]:</strong> Design professionals offering architectural, engineering, landscape, or interior design services through Dezignet are solely and independently responsible for complying with all applicable licensing, credentialing, registration, and statutory regulatory requirements that apply to their services in the jurisdictions where their work is performed or delivered.
        </p>
        <p style="margin: 0; color: #334155;">
          Dezignet provides credentials and accreditation displays as voluntary trust signals. Dezignet makes no representation, guarantee, or legal warranty regarding professional licensure for specific local permitting, municipal filing, or life-safety requirements. Clients are advised to independently confirm any statutory jurisdiction or sealed drawing requirements needed for their specific building project.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">4. Electronic Signature Consent</h2>
        <p style="margin: 0; color: #334155;">
          By executing agreements, proposals, amendments, or contract signatures on the Platform, you consent to conduct business electronically under the Electronic Signatures in Global and National Commerce Act (E-SIGN) and the Uniform Electronic Transactions Act (UETA). Electronic signatures have the same legal force and effect as manual handwritten signatures.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">5. Milestone Funding, 14-Day Auto-Approval, and Security Period</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          All project milestones operate under scheduled releases:
        </p>
        <ul style="margin: 0; padding-left: 24px; color: #334155;">
          <li>Milestones are funded prior to commencement of design phase deliverables.</li>
          <li>Upon deliverable submission, clients have fourteen (14) calendar days to review or request revisions. Deliverables are automatically approved if no action is taken within 14 days.</li>
          <li>Released milestone payouts are subject to a five (5) calendar day security hold period prior to availability for direct deposit withdrawal.</li>
        </ul>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">6. Dispute Resolution & Arbitration</h2>
        <p style="margin: 0; color: #334155;">
          Any controversy, claim, or dispute arising out of or relating to these Terms or the Platform shall be resolved through binding confidential arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules, rather than in court.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">7. Governing Law & Venue (Placeholder)</h2>
        <p style="margin: 0; color: #334155;">
          These Terms and any project engagement shall be governed by and construed in accordance with the laws of the State of [State to be set], without regard to conflict of law principles. Project contracts default to the State of {project state}.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">8. Accessibility Statement</h2>
        <p style="margin: 0; color: #334155;">
          Dezignet is committed to providing a digital platform that is accessible to all users, adhering to Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. If you encounter any accessibility barriers, please contact our team at accessibility@dezignet.com.
        </p>
      </div>
    </section>
  `;
}

function renderPrivacyContent(): string {
  return `
    <section style="display: flex; flex-direction: column; gap: 32px;">
      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">1. Information We Collect</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          We collect account registration data (name, email, password hashes), professional credentials (license type, issuing state, license number), project specifications, and uploaded CAD/BIM/PDF documentation.
        </p>
        <p style="margin: 0; color: #334155;">
          <strong>Private Data Protection:</strong> Personal telephone numbers and physical project street addresses are encrypted at rest and never shared in public directory listings.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">2. Privacy Rights for US Residents (Access & Deletion)</h2>
        <p style="margin: 0 0 10px; color: #334155;">
          Under the California Consumer Privacy Act (CCPA/CPRA) and comprehensive US state privacy laws, residents have the right to:
        </p>
        <ul style="margin: 0 0 10px; padding-left: 24px; color: #334155;">
          <li>Know and access the specific categories and pieces of personal information collected.</li>
          <li>Request deletion of their personal information (via in-app Account Settings &gt; Danger Zone or by emailing privacy@dezignet.com).</li>
          <li>Correct inaccurate personal information.</li>
          <li>Opt out of the sale or sharing of personal data (Dezignet does not sell personal information).</li>
        </ul>
        <p style="margin: 0; color: #334155;">
          We process verified deletion requests within forty-five (45) calendar days, subject to regulatory tax and contract retention exemptions.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">3. Cookies & Tracking Technologies</h2>
        <p style="margin: 0; color: #334155;">
          We use strictly necessary cookies to maintain authenticated session tokens and remember interface preferences. We do not use third-party behavioral advertising tracking cookies.
        </p>
      </div>

      <div>
        <h2 style="font-size: 18px; font-weight: 600; color: #0F172A; margin: 0 0 10px;">4. Email Communication Consent</h2>
        <p style="margin: 0; color: #334155;">
          By creating an account, you consent to receive transactional and operational email communications regarding milestone escrow funding, deliverable submissions, proposal notifications, and account security. You can manage notification preferences in your Account Settings.
        </p>
      </div>
    </section>
  `;
}
