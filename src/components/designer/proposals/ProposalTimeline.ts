/**
 * ProposalTimeline Component
 * Vertical plain status timeline:
 * Sent, Viewed, Shortlisted, Accepted or Declined (each with date or "Not yet").
 */

import { type SharedProposal } from '../../../mocks/dataset';

export function renderProposalTimeline(proposal: SharedProposal): string {
  const stages = [
    { key: 'Sent', label: 'Proposal sent' },
    { key: 'Viewed', label: 'Viewed by client' },
    { key: 'Shortlisted', label: 'Shortlisted' },
    {
      key: proposal.status === 'declined' ? 'Declined' : proposal.status === 'withdrawn' ? 'Withdrawn' : 'Accepted',
      label:
        proposal.status === 'declined'
          ? 'Declined by client'
          : proposal.status === 'withdrawn'
          ? 'Withdrawn by designer'
          : 'Accepted commission'
    }
  ];

  return `
    <div class="dez-proposal-timeline-card" style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0 0 16px 0;">Proposal progress</h3>

      <div style="position: relative; padding-left: 28px;">
        <!-- Vertical connector line -->
        <div style="position: absolute; left: 9px; top: 8px; bottom: 8px; width: 2px; background: #E5E7EB;"></div>

        <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 20px;">
          ${stages
            .map((stage) => {
              const timelineItem = proposal.timeline.find((t) =>
                t.stage.toLowerCase().includes(stage.key.toLowerCase())
              );
              const isCompleted = Boolean(timelineItem && timelineItem.completed);
              const dateText = timelineItem?.date || 'Not yet';

              return `
              <li style="position: relative; display: flex; justify-content: space-between; align-items: baseline; gap: 12px;">
                <!-- Dot marker -->
                <div style="position: absolute; left: -28px; top: 2px; width: 20px; height: 20px; border-radius: 50%; background: ${
                  isCompleted ? '#2F7BE5' : '#FFFFFF'
                }; border: 2px solid ${isCompleted ? '#2F7BE5' : '#D1D5DB'}; display: flex; align-items: center; justify-content: center;">
                  ${
                    isCompleted
                      ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
                      : ''
                  }
                </div>

                <div>
                  <div style="font-size: 13.5px; font-weight: ${isCompleted ? '600' : '400'}; color: ${
                isCompleted ? '#111827' : '#6B7280'
              };">
                    ${stage.label}
                  </div>
                </div>

                <div style="font-size: 12.5px; color: ${isCompleted ? '#4B5563' : '#9CA3AF'}; white-space: nowrap;">
                  ${dateText}
                </div>
              </li>
            `;
            })
            .join('')}
        </ul>
      </div>
    </div>
  `;
}
