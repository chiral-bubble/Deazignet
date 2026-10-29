/**
 * OfferBreakdown Component
 * Detailed view of the designer's submitted offer:
 * - Cover letter
 * - Price vs client budget comparison
 * - Delivery timeline
 * - Milestone phases table OR Hourly rate breakdown
 * - Portfolio attachments
 * - Q&A with client
 */

import { type SharedProposal } from '../../../mocks/dataset';
import { formatMoney } from '../../../utils/formatters';

export function renderOfferBreakdown(proposal: SharedProposal): string {
  const isHourly = proposal.paymentType === 'Hourly';

  return `
    <div class="dez-offer-breakdown-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Your submitted offer</h3>

      <!-- Price & Delivery Metric Strip -->
      <div style="background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
        <div>
          <div style="font-size: 12px; color: #6B7280;">Proposed fee</div>
          <div class="dez-tabular-num" style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 2px;">
            ${isHourly ? `$${proposal.proposedPrice}/hr` : `$${formatMoney(proposal.proposedPrice)}`}
          </div>
          <div style="font-size: 11.5px; color: #6B7280; margin-top: 1px;">
            Client budget: $${formatMoney(proposal.clientBudget)}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; color: #6B7280;">Delivery timeframe</div>
          <div style="font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px;">
            ${proposal.deliveryTime}
          </div>
        </div>

        <div>
          <div style="font-size: 12px; color: #6B7280;">Payment structure</div>
          <div style="font-size: 15px; font-weight: 600; color: #111827; margin-top: 2px;">
            ${proposal.paymentType}
          </div>
        </div>
      </div>

      <!-- Cover Letter -->
      <div style="margin-bottom: 24px;">
        <h4 style="font-size: 13.5px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Cover letter</h4>
        <div style="font-size: 13.5px; color: #374151; line-height: 1.6; white-space: pre-wrap; background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px;">
          ${proposal.coverLetter}
        </div>
      </div>

      <!-- Milestone Phases or Hourly Breakdown -->
      ${
        !isHourly
          ? `
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 13.5px; font-weight: 600; color: #111827; margin: 0 0 10px 0;">Project phases & milestone deliverables</h4>
          
          <div class="dez-table-responsive" style="border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden;">
            <table class="dez-data-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
              <thead>
                <tr style="background: #F7F7F8; border-bottom: 1px solid #E5E7EB; color: #4B5563; font-weight: 500;">
                  <th style="padding: 10px 14px;">Phase</th>
                  <th style="padding: 10px 14px;">Deliverables</th>
                  <th style="padding: 10px 14px; text-align: right;">Fee %</th>
                  <th style="padding: 10px 14px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${(proposal.phases || [])
                  .map(
                    (ph, idx) => `
                  <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px 14px; font-weight: 500; color: #111827; white-space: nowrap;">
                      Phase ${idx + 1}: ${ph.title}
                    </td>
                    <td style="padding: 10px 14px; color: #4B5563; font-size: 12.5px;">
                      ${ph.deliverablesSummary}
                    </td>
                    <td style="padding: 10px 14px; text-align: right; color: #6B7280;">
                      ${ph.feePercentage}%
                    </td>
                    <td class="dez-tabular-num" style="padding: 10px 14px; text-align: right; font-weight: 600; color: #111827;">
                      $${formatMoney(ph.amount)}
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `
          : `
        <div style="margin-bottom: 24px; background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 6px; padding: 16px;">
          <h4 style="font-size: 13.5px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Hourly agreement estimation</h4>
          <div style="display: flex; gap: 24px; font-size: 13px; color: #4B5563;">
            <div>Hourly rate: <strong>$${proposal.hourlyRate}/hr</strong></div>
            <div>Estimated scope: <strong>${proposal.estimatedHours} hours</strong></div>
            <div>Estimated total: <strong>$${formatMoney((proposal.hourlyRate || 0) * (proposal.estimatedHours || 0))}</strong></div>
          </div>
        </div>
      `
      }

      <!-- Questions & Answers -->
      ${
        proposal.clientQuestionsAndAnswers && proposal.clientQuestionsAndAnswers.length > 0
          ? `
        <div style="margin-bottom: 24px;">
          <h4 style="font-size: 13.5px; font-weight: 600; color: #111827; margin: 0 0 10px 0;">Client questions & responses</h4>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${proposal.clientQuestionsAndAnswers
              .map(
                (qa) => `
              <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 12px 14px; background: #FAFAFA;">
                <div style="font-weight: 500; font-size: 13px; color: #111827; margin-bottom: 4px;">Q: ${qa.question}</div>
                <div style="font-size: 13px; color: #4B5563; line-height: 1.4;">A: ${qa.answer || 'No answer recorded.'}</div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <!-- Attached Portfolio Items -->
      <div>
        <h4 style="font-size: 13.5px; font-weight: 600; color: #111827; margin: 0 0 8px 0;">Attached portfolio proof</h4>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          ${(proposal.attachedPortfolioIds || ['port-1'])
            .map(
              (id) => `
            <div style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 6px 12px; background: #F7F7F8; font-size: 12.5px; color: #374151; display: inline-flex; align-items: center; gap: 6px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Portfolio reference #${id}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
}
