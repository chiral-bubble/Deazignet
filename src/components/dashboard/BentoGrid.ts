/**
 * BentoGrid Component — Asymmetric editorial bento layout for dashboard home
 */

import { dashIcons } from './dashboardIcons';
import { attentionItems, recentActivities } from './dashboardData';

export function renderBentoGrid(): string {
  // Determine time-aware greeting
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';

  // Attention items markup
  const attentionHtml = attentionItems.map((item) => `
    <div class="bento-attention-item ${item.urgent ? 'is-urgent' : ''}" data-attention-id="${item.id}">
      <div class="bento-att-dot"></div>
      <div class="bento-att-body">
        <h4 class="bento-att-title">${item.title}</h4>
        <span class="bento-att-proj">${item.project}</span>
      </div>
      <button type="button" class="bento-att-action-btn" title="${item.actionText}">
        <span>${item.actionText}</span>
        ${dashIcons.arrowRight}
      </button>
    </div>
  `).join('');

  // Activity feed markup
  const activityHtml = recentActivities.map((act) => {
    let iconSvg = dashIcons.box;
    if (act.iconType === 'shieldCheck') iconSvg = dashIcons.shieldCheck;
    else if (act.iconType === 'fileText') iconSvg = dashIcons.contracts;
    else if (act.iconType === 'checkCircle') iconSvg = dashIcons.checkCircle;

    return `
      <div class="bento-activity-item" data-act-id="${act.id}">
        <div class="bento-act-icon-wrap">
          ${iconSvg}
        </div>
        <div class="bento-act-content">
          <div class="bento-act-header">
            <span class="bento-act-title">${act.title}</span>
            <span class="bento-act-time">${act.timestamp}</span>
          </div>
          <p class="bento-act-desc">${act.description}</p>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="bento-container" id="bento-container">
      
      <!-- 1. Hero Tile (Large Greeting & Quick Action) -->
      <section class="bento-tile bento-tile--hero" id="bento-hero">
        <div class="bento-hero-glow" aria-hidden="true"></div>
        <div class="bento-hero-content">
          <div class="bento-hero-eyebrow">
            <span class="bento-status-indicator"></span>
            <span>STUDIO WORKSPACE</span>
          </div>
          <h1 class="bento-hero-title">${greeting}, Alexandre</h1>
          <p class="bento-hero-sub">
            You have <strong>2 projects in progress</strong>, and <strong>3 new proposals</strong> waiting for review.
          </p>
          <div class="bento-hero-actions">
            <button type="button" class="btn-dash-primary" id="btn-post-project">
              <span class="btn-shine"></span>
              <span class="btn-icon">${dashIcons.plus}</span>
              <span>Post New Project</span>
            </button>
            <button type="button" class="btn-dash-ghost" id="btn-browse-designers">
              <span>Explore Portfolio Catalog</span>
              <span class="btn-arrow">${dashIcons.arrowRight}</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 2. Stat Tiles (4 Asymmetric Metrics with Spotlight & Sparklines) -->
      <div class="bento-tile bento-tile--stat" data-stat="active">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <div class="bento-stat-inner">
          <div class="bento-stat-header">
            <span class="bento-stat-label">ACTIVE PROJECTS</span>
            <span class="bento-stat-badge bento-stat-badge--blue">On Schedule</span>
          </div>
          <div class="bento-stat-number" data-target="2">0</div>
          <!-- Sparkline SVG -->
          <svg class="bento-sparkline" viewBox="0 0 100 24" fill="none">
            <path d="M0 18 Q 20 8, 40 14 T 70 6 T 100 4" stroke="#2F7BE5" stroke-width="2" stroke-linecap="round"/>
            <path d="M0 18 Q 20 8, 40 14 T 70 6 T 100 4 L 100 24 L 0 24 Z" fill="url(#sparkGradBlue)" opacity="0.15"/>
            <defs>
              <linearGradient id="sparkGradBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#2F7BE5"/>
                <stop offset="100%" stop-color="#2F7BE5" stop-opacity="0"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <div class="bento-tile bento-tile--stat" data-stat="proposals">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <div class="bento-stat-inner">
          <div class="bento-stat-header">
            <span class="bento-stat-label">PENDING PROPOSALS</span>
            <span class="bento-stat-badge bento-stat-badge--amber">Review Needed</span>
          </div>
          <div class="bento-stat-number" data-target="3">0</div>
          <!-- Ring Chart SVG -->
          <svg class="bento-sparkline" viewBox="0 0 100 24" fill="none">
            <path d="M0 20 C 30 18, 50 10, 75 12 S 95 6, 100 2" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <div class="bento-tile bento-tile--stat" data-stat="completed">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <div class="bento-stat-inner">
          <div class="bento-stat-header">
            <span class="bento-stat-label">COMPLETED PROJECTS</span>
            <span class="bento-stat-badge bento-stat-badge--green">Delivered</span>
          </div>
          <div class="bento-stat-number" data-target="14">0</div>
          <svg class="bento-sparkline" viewBox="0 0 100 24" fill="none">
            <path d="M0 22 Q 25 18, 50 12 T 80 8 T 100 3" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <div class="bento-tile bento-tile--stat" data-stat="invested">
        <div class="bento-spotlight" aria-hidden="true"></div>
        <div class="bento-stat-inner">
          <div class="bento-stat-header">
            <span class="bento-stat-label">TOTAL INVESTED</span>
            <span class="bento-stat-badge bento-stat-badge--escrow">100% Escrow</span>
          </div>
          <div class="bento-stat-number bento-stat-number--money" data-target="128450">$0</div>
          <svg class="bento-sparkline" viewBox="0 0 100 24" fill="none">
            <path d="M0 20 Q 30 16, 60 9 T 100 2" stroke="#2F7BE5" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
      </div>

      <!-- 3. "Needs your attention" Tile -->
      <section class="bento-tile bento-tile--attention" id="bento-attention">
        <div class="bento-tile-header">
          <div class="bento-tile-title-row">
            <span class="bento-tile-dot bento-tile-dot--amber"></span>
            <h3 class="bento-tile-title">Needs Attention</h3>
          </div>
          <span class="bento-count-badge">${attentionItems.length} Pending</span>
        </div>
        <div class="bento-attention-list">
          ${attentionHtml}
        </div>
      </section>

      <!-- 4. "Recent Activity" Tile -->
      <section class="bento-tile bento-tile--activity" id="bento-activity">
        <div class="bento-tile-header">
          <div class="bento-tile-title-row">
            <span class="bento-tile-dot bento-tile-dot--blue"></span>
            <h3 class="bento-tile-title">Recent Activity</h3>
          </div>
          <button type="button" class="bento-link-btn" id="bento-view-all-activity">View all</button>
        </div>
        <div class="bento-activity-timeline">
          ${activityHtml}
        </div>
      </section>

    </div>
  `;
}

/**
 * Initializes count-up animations, cursor spotlight tracking, and button triggers for the Bento Grid.
 */
export function initBentoGrid(
  onPostProjectClick: () => void,
  onNavigateProjects: () => void
): void {
  // Post project & browse click handlers
  document.getElementById('btn-post-project')?.addEventListener('click', onPostProjectClick);
  document.getElementById('btn-browse-designers')?.addEventListener('click', onNavigateProjects);
  document.getElementById('bento-view-all-activity')?.addEventListener('click', onNavigateProjects);

  // Spotlight mouse tracking on Stat tiles
  const statTiles = document.querySelectorAll<HTMLElement>('.bento-tile--stat');
  statTiles.forEach((tile) => {
    const spotlight = tile.querySelector('.bento-spotlight') as HTMLElement | null;
    if (!spotlight) return;

    tile.addEventListener('pointermove', (e: PointerEvent) => {
      const rect = tile.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      spotlight.style.setProperty('--spot-x', `${x}px`);
      spotlight.style.setProperty('--spot-y', `${y}px`);
      spotlight.style.opacity = '1';
    });

    tile.addEventListener('pointerleave', () => {
      spotlight.style.opacity = '0';
    });
  });

  // Numbers Count-Up Animation
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const numElements = document.querySelectorAll<HTMLElement>('.bento-stat-number');

  numElements.forEach((el) => {
    const target = parseInt(el.getAttribute('data-target') || '0', 10);
    const isMoney = el.classList.contains('bento-stat-number--money');

    if (prefersReduced) {
      el.textContent = isMoney ? `$${target.toLocaleString()}` : `${target}`;
      return;
    }

    const duration = 1200;
    const start = performance.now();

    function updateCount(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(target * ease);

      el.textContent = isMoney ? `$${current.toLocaleString()}` : `${current}`;

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      } else {
        el.textContent = isMoney ? `$${target.toLocaleString()}` : `${target}`;
      }
    }

    requestAnimationFrame(updateCount);
  });
}
