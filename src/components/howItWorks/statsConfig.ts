/**
 * Stats Configuration for "How Dezignet Works" stats strip.
 */

export interface StatItem {
  id: string;
  targetValue: number;
  suffix: string;
  prefix?: string;
  label: string;
  iconSvg: string;
}

export const statsData: StatItem[] = [
  {
    id: 'projects-completed',
    targetValue: 2000,
    suffix: '+',
    label: 'Projects completed',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>`
  },
  {
    id: 'verified-designers',
    targetValue: 500,
    suffix: '+',
    label: 'Verified designers',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <polyline points="16 11 18 13 22 9"></polyline>
    </svg>`
  },
  {
    id: 'secure-payments',
    targetValue: 100,
    suffix: '%',
    label: 'Secure payments',
    iconSvg: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      <polyline points="9 12 11 14 15 10"></polyline>
    </svg>`
  }
];
