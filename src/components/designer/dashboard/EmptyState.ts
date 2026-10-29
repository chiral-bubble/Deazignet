/**
 * Clean Empty State Component
 * Simple, unadorned, AA contrast, no decorative illustrations or glow.
 */

export interface EmptyStateOptions {
  message: string;
  subtext?: string;
  actionText?: string;
  actionTab?: string;
  actionId?: string;
}

export function renderEmptyState(options: EmptyStateOptions): string {
  const { message, subtext, actionText, actionTab, actionId } = options;

  return `
    <div class="dez-empty-state-block">
      <p class="dez-empty-state-msg">${message}</p>
      ${subtext ? `<p class="dez-empty-state-sub">${subtext}</p>` : ''}
      ${
        actionText
          ? `<button type="button" class="dez-btn-primary dez-empty-state-action" ${
              actionTab ? `data-designer-tab="${actionTab}"` : ''
            } ${actionId ? `id="${actionId}"` : ''}>
              ${actionText}
            </button>`
          : ''
      }
    </div>
  `;
}
