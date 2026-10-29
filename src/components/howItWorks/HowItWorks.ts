/**
 * HowItWorks Section Component
 *
 * Implements the revamped "How Dezignet Works" section with:
 * - Blueprint grid background with radial mask & drifting gradient orbs
 * - Architectural corner line-drawing accents
 * - Header reveal (pulsing pill eyebrow, word-by-word heading, subtext)
 * - Scroll-drawn dashed-to-gradient timeline with traveling dot & activating circles
 * - Glassmorphic cards with watermark numbers, 3D tilt, spotlight glow
 * - Looping interactive mini-UI illustrations
 * - Count-up animated stats strip
 */

import { stepsData } from './stepsConfig';
import { renderStepCard, initCardInteractions } from './StepCard';
import { renderStats, initStatsAnimation } from './Stats';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './howItWorks.css';

gsap.registerPlugin(ScrollTrigger);

export function renderHowItWorks(): string {
  // Render stats markup
  const statsHtml = renderStats();

  return `
    <section class="section section--how-it-works" id="how-it-works">
      <!-- 1. Background Atmosphere -->
      <div class="hiw-bg-atmosphere" aria-hidden="true">
        <!-- Blueprint Grid Pattern -->
        <div class="hiw-blueprint-grid"></div>

        <!-- Drifting Blurred Brand Orbs -->
        <div class="hiw-orb hiw-orb--1"></div>
        <div class="hiw-orb hiw-orb--2"></div>

        <!-- Architectural Blueprint Line Drawings in Corners -->
        <!-- Top Left: Architectural floor plan dimension & wall corner -->
        <svg class="hiw-accent-corner hiw-accent-corner--tl" viewBox="0 0 200 200" fill="none" stroke="currentColor">
          <!-- Room walls -->
          <path d="M 0 30 L 140 30 L 140 170 L 0 170" stroke-width="1.8" />
          <path d="M 0 36 L 134 36 L 134 164 L 0 164" stroke-width="1" />
          <!-- Interior partition -->
          <line x1="80" y1="36" x2="80" y2="100" stroke-width="1.5" />
          <!-- Door swing arc -->
          <path d="M 80 100 A 30 30 0 0 0 110 130" stroke-width="1" stroke-dasharray="3 3" />
          <line x1="80" y1="100" x2="110" y2="100" stroke-width="1.2" />
          <!-- Dimension line with ticks -->
          <line x1="20" y1="16" x2="140" y2="16" stroke-width="1" />
          <line x1="20" y1="10" x2="20" y2="22" stroke-width="1.2" />
          <line x1="140" y1="10" x2="140" y2="22" stroke-width="1.2" />
          <text x="70" y="12" font-family="'Inter', sans-serif" font-size="8" fill="currentColor" text-anchor="middle">5.40 m</text>
          <!-- Grid tick crosshairs -->
          <line x1="160" y1="40" x2="180" y2="40" stroke-width="1" />
          <line x1="170" y1="30" x2="170" y2="50" stroke-width="1" />
        </svg>

        <!-- Bottom Right: Drafting compass arc & elevation guide -->
        <svg class="hiw-accent-corner hiw-accent-corner--br" viewBox="0 0 200 200" fill="none" stroke="currentColor">
          <!-- Concentric compass arcs -->
          <circle cx="200" cy="200" r="150" stroke-width="1" stroke-dasharray="4 4" />
          <circle cx="200" cy="200" r="110" stroke-width="1.2" />
          <circle cx="200" cy="200" r="70" stroke-width="1" stroke-dasharray="2 4" />
          <!-- Radial angle rays -->
          <line x1="200" y1="200" x2="60" y2="120" stroke-width="1" />
          <line x1="200" y1="200" x2="110" y2="70" stroke-width="1" />
          <!-- Protractor angle notation -->
          <text x="130" y="160" font-family="'Inter', sans-serif" font-size="8" fill="currentColor">32° 15'</text>
          <!-- Grid crosshair -->
          <line x1="20" y1="180" x2="50" y2="180" stroke-width="1" />
          <line x1="35" y1="165" x2="35" y2="195" stroke-width="1" />
        </svg>
      </div>

      <div class="container hiw-container">
        <!-- 2. Header Reveal Area -->
        <div class="section__header hiw-header">
          <!-- Eyebrow Pill Badge -->
          <div class="hiw-eyebrow-pill" id="hiw-eyebrow">
            <span class="hiw-eyebrow-pulse" aria-hidden="true"></span>
            <span class="hiw-eyebrow-text">SIMPLE PROCESS</span>
          </div>

          <!-- Staggered Word Heading -->
          <h2 class="section__title hiw-title" id="hiw-title">
            <span class="hiw-word">How</span>
            <span class="hiw-word hiw-word--gradient">Dezignet</span>
            <span class="hiw-word">Works</span>
          </h2>

          <!-- Subtext -->
          <p class="section__description hiw-description" id="hiw-description">
            From vision to reality in three simple steps. Our platform makes it effortless to find, hire, and collaborate with design professionals.
          </p>
        </div>

        <!-- 3. Scroll-Drawn Timeline (Desktop & Mobile) -->
        <div class="hiw-timeline-wrapper" id="hiw-timeline-wrap">
          <!-- Desktop Horizontal Timeline Track -->
          <div class="hiw-desktop-timeline" aria-hidden="true">
            <div class="hiw-timeline-svg-container">
              <svg class="hiw-timeline-svg" preserveAspectRatio="none" viewBox="0 0 1000 60">
                <defs>
                  <linearGradient id="hiwTimelineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#2F7BE5" />
                    <stop offset="50%" stop-color="#3b82f6" />
                    <stop offset="100%" stop-color="#60a5fa" />
                  </linearGradient>
                  <filter id="hiwDotGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <!-- Base dashed line between Step 1 (16.6%) and Step 3 (83.3%) -->
                <line class="hiw-track-base" x1="166" y1="30" x2="834" y2="30" />
                <!-- Active drawn line -->
                <line class="hiw-track-active" id="hiw-track-active-line" x1="166" y1="30" x2="834" y2="30" />
              </svg>

              <!-- Traveling Glowing Dot -->
              <div class="hiw-traveler-dot" id="hiw-traveler-dot"></div>
            </div>

            <!-- 3 Step Number Circles aligned with 3 Columns -->
            <div class="hiw-step-circles-row">
              <div class="hiw-circle-col">
                <div class="hiw-step-circle" id="hiw-circle-1" data-circle-step="1">
                  <span class="hiw-step-circle-num">1</span>
                  <div class="hiw-circle-pulse-ring"></div>
                </div>
              </div>
              <div class="hiw-circle-col">
                <div class="hiw-step-circle" id="hiw-circle-2" data-circle-step="2">
                  <span class="hiw-step-circle-num">2</span>
                  <div class="hiw-circle-pulse-ring"></div>
                </div>
              </div>
              <div class="hiw-circle-col">
                <div class="hiw-step-circle" id="hiw-circle-3" data-circle-step="3">
                  <span class="hiw-step-circle-num">3</span>
                  <div class="hiw-circle-pulse-ring"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. Premium Cards Grid & Mobile Vertical Timeline -->
          <div class="hiw-cards-grid" id="hiw-cards-grid">
            ${stepsData.map((step, idx) => `
              <div class="hiw-card-col" data-col-step="${step.stepIndex}">
                <!-- Mobile Step Circle above card -->
                <div class="hiw-mobile-circle-wrap" aria-hidden="true">
                  <div class="hiw-step-circle hiw-step-circle--mobile" id="hiw-m-circle-${step.stepIndex}">
                    <span class="hiw-step-circle-num">${step.stepIndex}</span>
                    <div class="hiw-circle-pulse-ring"></div>
                  </div>
                </div>

                ${renderStepCard(step)}

                <!-- Mobile vertical connector line between stacked cards -->
                ${idx < stepsData.length - 1 ? `
                  <div class="hiw-mobile-connector" id="hiw-m-conn-${step.stepIndex}" aria-hidden="true">
                    <div class="hiw-m-connector-base"></div>
                    <div class="hiw-m-connector-active" id="hiw-m-conn-active-${step.stepIndex}"></div>
                    <div class="hiw-m-traveler-dot" id="hiw-m-dot-${step.stepIndex}"></div>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 6. Stats Strip Below Cards -->
        ${statsHtml}
      </div>
    </section>
  `;
}

/**
 * Initializes all animations and interactive behaviors for How It Works.
 */
export function initHowItWorks(): void {
  const section = document.getElementById('how-it-works');
  if (!section) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Setup Card Interactions (Spotlight & 3D Tilt)
  const cardElements = section.querySelectorAll<HTMLElement>('.step-card-premium');
  cardElements.forEach((card) => initCardInteractions(card));

  // 2. Setup Stats Count-Up
  initStatsAnimation();

  // If reduced motion is requested, show everything immediately in final state
  if (prefersReduced) {
    applyReducedMotionState(section);
    return;
  }

  // 3. Header Reveal Animation (Triggered once when section is ~25% visible)
  initHeaderReveal(section);

  // 4. Scroll-Drawn Timeline & Step Activation & Card Entrances
  initTimelineAndCards(section);
}

/**
 * Header Reveal: Pill badge first, word-by-word heading with blur, subtext fade in.
 */
function initHeaderReveal(section: HTMLElement): void {
  const eyebrow = section.querySelector('#hiw-eyebrow');
  const words = section.querySelectorAll('.hiw-word');
  const description = section.querySelector('#hiw-description');

  // Initial state
  gsap.set(eyebrow, { opacity: 0, y: 15 });
  gsap.set(words, { opacity: 0, y: 20, filter: 'blur(8px)' });
  gsap.set(description, { opacity: 0, y: 15 });

  ScrollTrigger.create({
    trigger: section,
    start: 'top 75%', // ~25% visible
    once: true,
    onEnter: () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Eyebrow pill
      tl.to(eyebrow, {
        opacity: 1,
        y: 0,
        duration: 0.5
      });

      // Heading word-by-word stagger (~80ms)
      tl.to(
        words,
        {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.6,
          stagger: 0.08
        },
        '-=0.2'
      );

      // Subtext
      tl.to(
        description,
        {
          opacity: 1,
          y: 0,
          duration: 0.6
        },
        '-=0.2'
      );
    }
  });
}

/**
 * Scroll-drawn timeline connecting step circles and staggering card entrances.
 */
function initTimelineAndCards(section: HTMLElement): void {
  const cards = section.querySelectorAll<HTMLElement>('.step-card-premium');
  const circles = [
    section.querySelector('#hiw-circle-1') as HTMLElement | null,
    section.querySelector('#hiw-circle-2') as HTMLElement | null,
    section.querySelector('#hiw-circle-3') as HTMLElement | null
  ];
  const activeLine = section.querySelector('#hiw-track-active-line') as SVGLineElement | null;
  const travelerDot = section.querySelector('#hiw-traveler-dot') as HTMLElement | null;
  const timelineWrap = section.querySelector('#hiw-timeline-wrap') as HTMLElement | null;

  if (!timelineWrap || cards.length === 0) return;

  // Initial card state (fade up 40px)
  gsap.set(cards, { opacity: 0, y: 40 });

  // Calculate coordinates for horizontal desktop timeline
  // The line starts at circle 1 center (approx 16.66% of container) and ends at circle 3 (83.33%)
  const totalLineLength = 668; // 834 - 166 in SVG viewBox coords
  if (activeLine) {
    activeLine.style.strokeDasharray = `${totalLineLength}`;
    activeLine.style.strokeDashoffset = `${totalLineLength}`;
  }

  // Trigger for timeline drawing and circle activation
  ScrollTrigger.create({
    trigger: timelineWrap,
    start: 'top 75%',
    end: 'bottom 80%',
    scrub: 0.6,
    onUpdate: (self) => {
      const progress = self.progress;

      // Update active SVG line stroke-dashoffset
      if (activeLine) {
        const offset = totalLineLength * (1 - progress);
        activeLine.style.strokeDashoffset = `${offset}`;
      }

      // Update traveler dot position along desktop track
      if (travelerDot && circles[0] && circles[2]) {
        // Calculate percentage from circle 1 center to circle 3 center
        const startPercent = 16.66;
        const endPercent = 83.33;
        const currentPercent = startPercent + (endPercent - startPercent) * progress;
        travelerDot.style.left = `${currentPercent}%`;
        travelerDot.style.opacity = progress > 0.02 && progress < 0.99 ? '1' : '0';
      }

      // Activate circle 1
      if (circles[0]) {
        if (progress >= 0.05) {
          circles[0].classList.add('is-active');
        } else {
          circles[0].classList.remove('is-active');
        }
      }

      // Activate circle 2
      if (circles[1]) {
        if (progress >= 0.48) {
          circles[1].classList.add('is-active');
        } else {
          circles[1].classList.remove('is-active');
        }
      }

      // Activate circle 3
      if (circles[2]) {
        if (progress >= 0.90) {
          circles[2].classList.add('is-active');
        } else {
          circles[2].classList.remove('is-active');
        }
      }
    }
  });

  // Staggered Entrance of Cards as the timeline reaches each card
  cards.forEach((card, index) => {
    ScrollTrigger.create({
      trigger: card,
      start: 'top 82%',
      once: true,
      onEnter: () => {
        gsap.to(card, {
          opacity: 1,
          y: 0,
          duration: 0.75,
          delay: index * 0.15, // 150ms delay between cards
          ease: 'power3.out',
          onComplete: () => {
            // Trigger loop animation on mini-UI
            card.classList.add('mini-ui-playing');
          }
        });
      }
    });
  });

  // Mobile Vertical Timeline Scrubbing (between stacked cards)
  const mobileConnectors = [
    {
      conn: section.querySelector('#hiw-m-conn-1') as HTMLElement | null,
      active: section.querySelector('#hiw-m-conn-active-1') as HTMLElement | null,
      dot: section.querySelector('#hiw-m-dot-1') as HTMLElement | null,
      circleNext: section.querySelector('#hiw-m-circle-2') as HTMLElement | null
    },
    {
      conn: section.querySelector('#hiw-m-conn-2') as HTMLElement | null,
      active: section.querySelector('#hiw-m-conn-active-2') as HTMLElement | null,
      dot: section.querySelector('#hiw-m-dot-2') as HTMLElement | null,
      circleNext: section.querySelector('#hiw-m-circle-3') as HTMLElement | null
    }
  ];

  // Mobile circle 1 activates when visible
  const mCircle1 = section.querySelector('#hiw-m-circle-1') as HTMLElement | null;
  if (mCircle1) {
    ScrollTrigger.create({
      trigger: mCircle1,
      start: 'top 80%',
      onEnter: () => mCircle1.classList.add('is-active'),
      onLeaveBack: () => mCircle1.classList.remove('is-active')
    });
  }

  mobileConnectors.forEach(({ conn, active, dot, circleNext }) => {
    if (!conn || !active) return;
    ScrollTrigger.create({
      trigger: conn,
      start: 'top 80%',
      end: 'bottom 70%',
      scrub: 0.4,
      onUpdate: (self) => {
        const p = self.progress;
        active.style.height = `${p * 100}%`;
        if (dot) {
          dot.style.top = `${p * 100}%`;
          dot.style.opacity = p > 0.05 && p < 0.95 ? '1' : '0';
        }
        if (circleNext) {
          if (p >= 0.85) {
            circleNext.classList.add('is-active');
          } else {
            circleNext.classList.remove('is-active');
          }
        }
      }
    });
  });
}

/**
 * Handle reduced motion accessibility preference
 */
function applyReducedMotionState(section: HTMLElement): void {
  const eyebrow = section.querySelector('#hiw-eyebrow');
  const words = section.querySelectorAll('.hiw-word');
  const description = section.querySelector('#hiw-description');
  const cards = section.querySelectorAll<HTMLElement>('.step-card-premium');
  const circles = section.querySelectorAll('.hiw-step-circle');
  const activeLine = section.querySelector('#hiw-track-active-line') as SVGLineElement | null;
  const travelerDot = section.querySelector('#hiw-traveler-dot') as HTMLElement | null;

  if (eyebrow) gsap.set(eyebrow, { opacity: 1, y: 0 });
  if (words) gsap.set(words, { opacity: 1, y: 0, filter: 'none' });
  if (description) gsap.set(description, { opacity: 1, y: 0 });
  cards.forEach((card) => {
    gsap.set(card, { opacity: 1, y: 0 });
    card.classList.add('mini-ui-playing');
  });
  circles.forEach((circle) => circle.classList.add('is-active'));
  if (activeLine) activeLine.style.strokeDashoffset = '0';
  if (travelerDot) travelerDot.style.display = 'none';
  section.querySelectorAll<HTMLElement>('.hiw-m-connector-active').forEach((el) => {
    el.style.height = '100%';
  });
  section.querySelectorAll<HTMLElement>('.hiw-m-traveler-dot').forEach((el) => {
    el.style.display = 'none';
  });
}
