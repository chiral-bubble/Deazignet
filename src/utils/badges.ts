/**
 * Badges and Trust Signals Utility for Dezignet
 * Standardizes the neutral outlined Pro member badge across all surfaces.
 * 
 * Note: Dezignet does not verify credentials; the Pro member badge represents
 * an active paid membership subscription. All credentials are self-reported.
 */

export const PRO_MEMBER_TOOLTIP =
  'Pro member: this designer has a paid Dezignet membership. Credentials are self-reported and not verified by Dezignet.';

/**
 * Returns neutral outlined badge markup for paid studio members.
 * Strictly adheres to design rules: neutral borders, no green, no verification claim, no checkmark.
 */
export function renderMemberBadge(label: string = 'Pro member'): string {
  return `<span class="dez-member-badge" title="${PRO_MEMBER_TOOLTIP}" style="display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; color: #374151; background: #F9FAFB; border: 1px solid #D1D5DB; padding: 2px 8px; border-radius: 4px; white-space: nowrap; line-height: 1.4; cursor: help;">${escapeHtml(label)}</span>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
