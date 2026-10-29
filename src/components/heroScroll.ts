/**
 * HeroScroll — Full-screen, scroll-scrubbed frame-by-frame hero with text chapters.
 *
 * Uses GSAP ScrollTrigger for smooth scroll → frame mapping.
 * Renders frames on a <canvas> with object-fit: cover behavior.
 * Overlays storytelling text chapters that fade in/out at defined scroll ranges.
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createFrameSequence, type FrameSequence } from '../utils/frameSequence';
import { chapters, type ChapterConfig } from '../config/chapters';

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 150;

/** Detect if user prefers reduced motion */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Detect mobile for frame path */
function isMobile(): boolean {
  return window.innerWidth < 768;
}

/** Split text into wrapped <span> words for stagger animation */
function wrapWords(text: string): string {
  return text
    .split(' ')
    .map((word) => `<span class="word">${word}</span>`)
    .join(' ');
}

/** Create SVG arrow icon */
function createScrollArrow(): string {
  return `<svg class="hero__scroll-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 5v14M5 12l7 7 7-7"/>
  </svg>`;
}

/** Build a single chapter DOM element */
function buildChapterEl(chapter: ChapterConfig): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hero__chapter';
  el.id = `hero-chapter-${chapter.id}`;
  el.setAttribute('aria-hidden', 'true');

  let html = `<h2 class="hero__chapter-headline">${wrapWords(chapter.headline)}</h2>`;

  if (chapter.subtext) {
    html += `<p class="hero__chapter-subtext">${chapter.subtext}</p>`;
  }

  if (chapter.cta) {
    html += `<div class="hero__cta-row">`;
    for (const btn of chapter.cta) {
      const cls = btn.variant === 'primary' ? 'btn btn--primary btn--lg' : 'btn btn--outline btn--lg';
      html += `<a href="${btn.href}" class="${cls}" id="hero-cta-${btn.variant}">${btn.label}</a>`;
    }
    html += `</div>`;
  }

  if (chapter.badges) {
    html += `<div class="hero__trust-badges">`;
    for (const badge of chapter.badges) {
      html += `
        <div class="trust-badge">
          <span class="trust-badge__value">${badge.value}</span>
          <span class="trust-badge__label">${badge.label}</span>
        </div>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;
  return el;
}

/** Build the scroll indicator */
function buildScrollIndicator(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'hero__scroll-indicator';
  el.id = 'hero-scroll-indicator';
  el.innerHTML = `<span>Scroll to explore</span>${createScrollArrow()}`;
  return el;
}

/** Build the progress dots */
function buildProgressDots(): HTMLElement {
  const el = document.createElement('nav');
  el.className = 'hero__progress';
  el.id = 'hero-progress';
  el.setAttribute('aria-label', 'Hero scroll progress');
  for (let i = 0; i < chapters.length; i++) {
    const dot = document.createElement('button');
    dot.className = 'hero__progress-dot';
    dot.setAttribute('aria-label', `Jump to section ${i + 1}`);
    dot.dataset.index = String(i);
    el.appendChild(dot);
  }
  return el;
}

/** Build the loading screen */
function buildLoader(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'loader';
  el.id = 'hero-loader';
  el.innerHTML = `
    <div class="loader__logo">Dezignet</div>
    <div class="loader__bar-track">
      <div class="loader__bar-fill" id="loader-bar-fill"></div>
    </div>
    <div class="loader__percentage" id="loader-percentage">0%</div>
  `;
  return el;
}

/** Build the reduced-motion fallback */
function buildReducedMotionHero(): HTMLElement {
  const wrapper = document.createElement('section');
  wrapper.className = 'hero-wrapper';
  wrapper.style.height = 'auto';
  wrapper.setAttribute('aria-label', 'Hero');

  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.style.position = 'relative';
  hero.style.height = 'auto';
  hero.style.minHeight = '100vh';

  // Static poster frame
  const img = document.createElement('img');
  img.src = isMobile() ? '/hero-frames-mobile/frame_0001.webp' : '/hero-frames/frame_0001.webp';
  img.alt = 'Architectural design';
  img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.4;';
  hero.appendChild(img);

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'hero__overlay';
  hero.appendChild(overlay);

  // Stack all chapters visibly
  for (const chapter of chapters) {
    const chEl = buildChapterEl(chapter);
    chEl.style.position = 'relative';
    chEl.style.opacity = '1';
    chEl.style.padding = '4rem 1.5rem';
    // Force word visibility
    chEl.querySelectorAll('.word').forEach((w) => {
      (w as HTMLElement).style.opacity = '1';
      (w as HTMLElement).style.transform = 'none';
      (w as HTMLElement).style.filter = 'none';
    });
    const sub = chEl.querySelector('.hero__chapter-subtext') as HTMLElement;
    if (sub) {
      sub.style.opacity = '1';
      sub.style.transform = 'none';
      sub.style.filter = 'none';
    }
    const ctaRow = chEl.querySelector('.hero__cta-row') as HTMLElement;
    if (ctaRow) {
      ctaRow.style.opacity = '1';
      ctaRow.style.transform = 'none';
    }
    const badges = chEl.querySelector('.hero__trust-badges') as HTMLElement;
    if (badges) {
      badges.style.opacity = '1';
      badges.style.transform = 'none';
    }
    hero.appendChild(chEl);
  }

  wrapper.appendChild(hero);
  return wrapper;
}

export function initHeroScroll(container: HTMLElement): void {
  // ---- Reduced motion fallback ----
  if (prefersReducedMotion()) {
    container.appendChild(buildReducedMotionHero());
    return;
  }

  // ---- Build DOM ----
  const loader = buildLoader();
  document.body.appendChild(loader);

  const wrapper = document.createElement('section');
  wrapper.className = 'hero-wrapper';
  wrapper.id = 'hero-wrapper';
  wrapper.setAttribute('aria-label', 'Hero');

  const hero = document.createElement('div');
  hero.className = 'hero';
  hero.id = 'hero';

  const canvas = document.createElement('canvas');
  canvas.className = 'hero__canvas';
  canvas.id = 'hero-canvas';
  hero.appendChild(canvas);

  const overlay = document.createElement('div');
  overlay.className = 'hero__overlay';
  hero.appendChild(overlay);

  const content = document.createElement('div');
  content.className = 'hero__content';

  // Build chapters
  const chapterEls: HTMLElement[] = [];
  for (const chapter of chapters) {
    const el = buildChapterEl(chapter);
    chapterEls.push(el);
    content.appendChild(el);
  }

  hero.appendChild(content);
  hero.appendChild(buildScrollIndicator());
  wrapper.appendChild(hero);
  container.appendChild(wrapper);

  // Progress dots removed per user request ("remove those 5 dots at the right hand side")
  const progressNav = buildProgressDots();
  const oldProgressNav = document.getElementById('hero-progress');
  if (oldProgressNav) oldProgressNav.remove();

  // ---- Frame Sequence ----
  const basePath = isMobile() ? '/hero-frames-mobile/' : '/hero-frames/';
  const barFill = document.getElementById('loader-bar-fill') as HTMLElement;
  const loaderPct = document.getElementById('loader-percentage') as HTMLElement;

  const seq: FrameSequence = createFrameSequence({
    canvas,
    totalFrames: TOTAL_FRAMES,
    basePath,
    onProgress(p) {
      const pct = Math.round(p * 100);
      barFill.style.width = `${pct}%`;
      loaderPct.textContent = `${pct}%`;
    },
  });

  // ---- Init ----
  seq.resize();

  // Resize handler
  let resizeTimer: number;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      seq.resize();
    }, 100);
  });

  // Load frames, then init scroll
  seq.load().then(() => {
    // Hide loader
    loader.classList.add('hidden');
    setTimeout(() => loader.remove(), 700);

    // Show progress dots
    progressNav.classList.add('visible');

    initScrollAnimation(seq, wrapper, canvas, chapterEls, progressNav);
  });
}

function initScrollAnimation(
  seq: FrameSequence,
  wrapper: HTMLElement,
  _canvas: HTMLElement,
  chapterEls: HTMLElement[],
  progressNav: HTMLElement,
): void {
  const scrollIndicator = document.getElementById('hero-scroll-indicator');
  let currentFrame = 0;
  let targetFrame = 0;
  let currentChapterIndex = -1;
  // Smooth lerp for buttery scrubbing
  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  function animate() {
    // Lerp toward target frame
    currentFrame = lerp(currentFrame, targetFrame, 0.12);
    const frameIndex = Math.round(currentFrame);
    seq.drawFrame(frameIndex);
    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

  // GSAP ScrollTrigger
  ScrollTrigger.create({
    trigger: wrapper,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.5,
    onUpdate(self) {
      const progress = self.progress; // 0–1

      // Map to frame index
      targetFrame = progress * (TOTAL_FRAMES - 1);

      // Update chapters
      let activeIndex = -1;
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        // Chapter is active when progress is within its range
        // Add a small buffer for fade transitions
        const fadeInStart = ch.start;
        const fadeOutEnd = ch.end;

        if (progress >= fadeInStart && progress <= fadeOutEnd) {
          activeIndex = i;
        }
      }

      if (activeIndex !== currentChapterIndex) {
        // Deactivate old
        if (currentChapterIndex >= 0 && chapterEls[currentChapterIndex]) {
          chapterEls[currentChapterIndex].classList.remove('active');
          chapterEls[currentChapterIndex].setAttribute('aria-hidden', 'true');
        }
        // Activate new
        if (activeIndex >= 0 && chapterEls[activeIndex]) {
          chapterEls[activeIndex].classList.add('active');
          chapterEls[activeIndex].setAttribute('aria-hidden', 'false');
        }
        currentChapterIndex = activeIndex;

        // Update progress dots
        const dots = progressNav.querySelectorAll('.hero__progress-dot');
        dots.forEach((dot, i) => {
          dot.classList.toggle('active', i === activeIndex);
        });
      }

      // Scroll indicator visibility (only in first chapter)
      if (scrollIndicator) {
        const indicatorOpacity = progress < 0.08 ? 1 - progress / 0.08 : 0;
        scrollIndicator.style.opacity = String(indicatorOpacity);
      }

      // Deepen vignette as user scrolls
      const overlayEl = document.querySelector('.hero__overlay') as HTMLElement;
      if (overlayEl) {
        const vignetteStrength = 0.3 + progress * 0.25;
        overlayEl.style.background = `
          radial-gradient(ellipse at center, transparent 40%, rgba(11, 20, 38, ${vignetteStrength + 0.2}) 100%),
          linear-gradient(to bottom, rgba(11, 20, 38, ${vignetteStrength}) 0%, transparent 30%, transparent 60%, rgba(11, 20, 38, ${vignetteStrength + 0.25}) 100%)
        `;
      }
    },
  });

  // Progress dot click → scroll to chapter
  progressNav.addEventListener('click', (e) => {
    const dot = (e.target as HTMLElement).closest('.hero__progress-dot') as HTMLElement;
    if (!dot) return;
    const idx = parseInt(dot.dataset.index || '0', 10);
    const chapter = chapters[idx];
    const wrapperHeight = wrapper.offsetHeight - window.innerHeight;
    const scrollTarget = wrapper.offsetTop + wrapperHeight * ((chapter.start + chapter.end) / 2);
    window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  });

  // Start with first chapter active
  if (chapterEls[0]) {
    chapterEls[0].classList.add('active');
    chapterEls[0].setAttribute('aria-hidden', 'false');
    currentChapterIndex = 0;
    const dots = progressNav.querySelectorAll('.hero__progress-dot');
    if (dots[0]) dots[0].classList.add('active');
  }
}
