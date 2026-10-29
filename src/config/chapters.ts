/**
 * Chapter configuration for the hero scroll experience.
 * Each chapter defines a scroll range (0–1), headline, subtext,
 * and optional extras (CTA buttons, trust badges).
 * Edit these to change the story text and timing.
 */

export interface ChapterConfig {
  id: string;
  /** Start of visible range (0–1 across the hero scroll) */
  start: number;
  /** End of visible range */
  end: number;
  headline: string;
  subtext?: string;
  /** Show CTA buttons */
  cta?: { label: string; href: string; variant: 'primary' | 'outline' }[];
  /** Show trust badges */
  badges?: { value: string; label: string }[];
  /** Show scroll-down indicator */
  showScrollIndicator?: boolean;
}

export const chapters: ChapterConfig[] = [
  {
    id: 'intro',
    start: 0,
    end: 0.15,
    headline: 'Connect with Top Design Professionals',
    showScrollIndicator: true,
  },
  {
    id: 'vision',
    start: 0.15,
    end: 0.35,
    headline: 'Every great structure starts with the right mind.',
    subtext:
      'Find licensed architects, interior designers, landscape architects and engineers ready for your next project.',
  },
  {
    id: 'post',
    start: 0.35,
    end: 0.55,
    headline: 'Post your project.',
    subtext:
      'Describe your vision, set your budget, and let qualified designers come to you.',
  },
  {
    id: 'select',
    start: 0.55,
    end: 0.75,
    headline: 'Review. Select. Build.',
    subtext:
      'Compare detailed proposals and pick the perfect match.',
  },
  {
    id: 'cta',
    start: 0.75,
    end: 1.0,
    headline: 'Your dream design, delivered.',
    cta: [
      { label: 'Hire a Designer', href: '#', variant: 'primary' },
      { label: 'Become a Designer', href: '#', variant: 'outline' },
    ],
    badges: [
      { value: '2,000+', label: 'Projects completed' },
      { value: '✓', label: 'Verified designers' },
      { value: '🔒', label: 'Secure payments guaranteed' },
    ],
  },
];
