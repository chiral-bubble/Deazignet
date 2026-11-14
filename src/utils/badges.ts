/**
 * Badges and Trust Signals Utility for Dezignet
 * Provides plain "Promoted" marker for boosted search placement (Gold plan).
 * Note: Paid member badges ("Pro member") have been removed per product brief.
 */

/**
 * Renders plain "Promoted" marker for Gold plan priority search placement
 */
export function renderPromotedMarker(): string {
  return `<span class="dez-promoted-marker" style="display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; color: #4B5563; background: #F3F4F6; border: 1px solid #E5E7EB; padding: 2px 6px; border-radius: 4px; white-space: nowrap; line-height: 1.4;">Promoted</span>`;
}

/**
 * Legacy stub: Paid member badges removed per product brief.
 * Returns empty string.
 */
export function renderMemberBadge(_label?: string): string {
  return '';
}

export const PRO_MEMBER_TOOLTIP = '';
