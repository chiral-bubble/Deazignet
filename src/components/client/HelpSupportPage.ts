/**
 * Help & Support Page Component
 * - Short FAQ accordion with placeholder answers (clearly marked for editing)
 * - Contact support form (topic, message, optional project) creating a support_tickets row via createSupportTicket
 * - Visual confirmation with ticket ID
 */

import { createSupportTicket } from '../../services/projectsService';
import { renderClientShell, initClientShell } from './ClientLayout';

export async function renderHelpSupportPage(container: HTMLElement): Promise<void> {
  container.innerHTML = renderClientShell(
    {
      activeTab: 'help',
      pageTitle: 'Help & Support'
    },
    `
      <div id="help-loading" style="padding: 40px; text-align: center; color: #6B7280; font-size: 13px;">
        Loading help resources...
      </div>
    `
  );

  initClientShell(container);

  const mainArea = container.querySelector('main div');
  if (!mainArea) return;

  const faqs = [
    {
      q: 'How does escrow protection work on Dezignet?',
      a: 'Funds for each architectural milestone are deposited into escrow before work begins. Your funds are held securely and only released to the designer after you review and approve the submitted deliverables.'
    },
    {
      q: 'What happens if I need changes to submitted drawings?',
      a: 'Each project phase includes agreed revision rounds. You can request specific adjustments directly in the milestone review panel before approving payment release.'
    },
    {
      q: 'How are my private site notes and street address protected?',
      a: 'Your street address and confidential site notes are encrypted and restricted. They are never shown to designers browsing the platform, and are only revealed to your selected professional after an engagement contract is signed.'
    },
    {
      q: 'Can I cancel an open project?',
      a: 'Yes. As long as no contract has been signed with a designer, you can cancel or close an open project at any time from your project dashboard.'
    }
  ];

  function render(submittedTicketId?: string): void {
    mainArea!.innerHTML = `
      <div style="max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; padding-bottom: 60px;">
        <!-- Header -->
        <div>
          <h1 style="font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 6px;">
            Help & Support
          </h1>
          <p style="font-size: 13.5px; color: #6B7280; margin: 0;">
            Find answers to frequently asked questions or submit a ticket to our support team.
          </p>
        </div>

        <!-- FAQ Accordion -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px;">
            Frequently Asked Questions
          </h2>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${faqs.map((faq, idx) => `
              <div style="border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden;">
                <button
                  type="button"
                  class="btn-faq-toggle"
                  data-index="${idx}"
                  style="width: 100%; text-align: left; background: #F7F7F8; border: none; padding: 12px 16px; font-size: 13.5px; font-weight: 600; color: #1F2937; cursor: pointer; display: flex; justify-content: space-between; align-items: center;"
                >
                  <span>${escapeHtml(faq.q)}</span>
                  <span class="faq-icon" data-index="${idx}" style="font-size: 12px; color: #6B7280;">▾</span>
                </button>
                <div
                  class="faq-body"
                  data-index="${idx}"
                  style="display: none; padding: 14px 16px; font-size: 13px; color: #4B5563; line-height: 1.6; background: #FFFFFF; border-top: 1px solid #E5E7EB;"
                >
                  ${escapeHtml(faq.a)}
                  <span style="display: block; font-size: 11px; color: #9CA3AF; margin-top: 6px; font-style: italic;">(Placeholder text — editable by administrators)</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Contact Support Form / Confirmation -->
        <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px;">
          <h2 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px;">
            Contact Support
          </h2>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 20px;">
            Have an inquiry about an active engagement, milestone dispute, or account matter? We respond within 24 hours.
          </p>

          ${submittedTicketId ? `
            <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 16px 20px;">
              <div style="font-size: 14px; font-weight: 600; color: #047857; margin-bottom: 4px;">
                Support Ticket Submitted
              </div>
              <p style="font-size: 13px; color: #065F46; margin: 0 0 8px;">
                Your ticket has been logged with ID <code>${submittedTicketId}</code>. Our team has received your message and will follow up via your registered email address.
              </p>
              <button
                type="button"
                id="btn-new-ticket"
                style="background: none; border: 1px solid #059669; color: #059669; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 4px; cursor: pointer;"
              >
                Submit another inquiry
              </button>
            </div>
          ` : `
            <form id="support-ticket-form" style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 4px;">Inquiry Topic *</label>
                <select id="f-ticket-topic" required style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; background: #FFFFFF; box-sizing: border-box;">
                  <option value="General Question">General Question</option>
                  <option value="Project Creation & Publishing">Project Creation & Publishing</option>
                  <option value="Proposal Review & Designer Matching">Proposal Review & Designer Matching</option>
                  <option value="Milestone & Escrow Assistance">Milestone & Escrow Assistance</option>
                  <option value="Account & Security">Account & Security</option>
                </select>
              </div>

              <div>
                <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 4px;">Project Reference (Optional)</label>
                <input
                  type="text"
                  id="f-ticket-project"
                  placeholder="e.g. Project title or ID"
                  style="width: 100%; height: 38px; border: 1px solid #E5E7EB; border-radius: 6px; padding: 0 10px; font-size: 13px; box-sizing: border-box;"
                />
              </div>

              <div>
                <label style="display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 4px;">Message *</label>
                <textarea
                  id="f-ticket-message"
                  required
                  rows="4"
                  placeholder="Provide details about your question or issue..."
                  style="width: 100%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 10px; font-size: 13px; font-family: inherit; line-height: 1.5; box-sizing: border-box;"
                ></textarea>
              </div>

              <div id="ticket-feedback" style="display: none; font-size: 12.5px; padding: 8px 12px; border-radius: 4px;"></div>

              <div style="display: flex; justify-content: flex-end;">
                <button
                  type="submit"
                  id="btn-submit-ticket"
                  style="background: #2F7BE5; color: #FFFFFF; border: none; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; cursor: pointer;"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          `}
        </div>
      </div>
    `;

    // FAQ Accordion toggles
    document.querySelectorAll('.btn-faq-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = (btn as HTMLElement).dataset.index;
        const body = document.querySelector(`.faq-body[data-index="${idx}"]`) as HTMLElement;
        const icon = document.querySelector(`.faq-icon[data-index="${idx}"]`) as HTMLElement;
        if (body) {
          const isOpen = body.style.display === 'block';
          body.style.display = isOpen ? 'none' : 'block';
          if (icon) icon.textContent = isOpen ? '▾' : '▴';
        }
      });
    });

    // Form submit
    const form = document.getElementById('support-ticket-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const topic = (document.getElementById('f-ticket-topic') as HTMLSelectElement)?.value;
      const proj = (document.getElementById('f-ticket-project') as HTMLInputElement)?.value.trim();
      const message = (document.getElementById('f-ticket-message') as HTMLTextAreaElement)?.value.trim();
      const fbk = document.getElementById('ticket-feedback');
      const submitBtn = document.getElementById('btn-submit-ticket') as HTMLButtonElement;

      if (!message) {
        if (fbk) {
          fbk.style.display = 'block';
          fbk.style.background = '#FEF2F2';
          fbk.style.color = '#B91C1C';
          fbk.textContent = 'Please enter a message.';
        }
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
      }

      try {
        const ticketId = await createSupportTicket({
          topic,
          message,
          projectId: proj || undefined,
          type: 'help'
        });

        render(ticketId);
      } catch (err: any) {
        if (fbk) {
          fbk.style.display = 'block';
          fbk.style.background = '#FEF2F2';
          fbk.style.color = '#B91C1C';
          fbk.textContent = `Error: ${err?.message || 'Failed to submit ticket'}`;
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Ticket';
        }
      }
    });

    document.getElementById('btn-new-ticket')?.addEventListener('click', () => {
      render();
    });
  }

  render();
}

function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

