/**
 * SystemMessage Component
 * Plain centered grey lines for platform state transitions:
 * "Proposal accepted", "Milestone 1 funded", "Deliverable submitted", "Client requested changes".
 */

export function renderSystemMessage(text: string, timestamp?: string): string {
  return `
    <div class="dez-conv-system-message" style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 16px 0;">
      <div style="flex: 1; height: 1px; background: #E5E7EB;"></div>
      <div style="font-size: 12px; color: #6B7280; background: #F7F7F8; border: 1px solid #E5E7EB; border-radius: 9999px; padding: 4px 14px; text-align: center;">
        ${text} ${timestamp ? `<span style="color: #9CA3AF; margin-left: 4px;">• ${timestamp}</span>` : ''}
      </div>
      <div style="flex: 1; height: 1px; background: #E5E7EB;"></div>
    </div>
  `;
}
