/**
 * Stats Component — Slim row of 3 stats with count-up animation.
 */

import { statsData, type StatItem } from './statsConfig';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function renderStats(): string {
  const itemsHtml = statsData
    .map((item: StatItem, idx: number) => {
      const dividerHtml =
        idx < statsData.length - 1
          ? '<div class="stats-strip__divider" aria-hidden="true"></div>'
          : '';

      return `
        <div class="stats-item" id="stat-${item.id}">
          <div class="stats-item__icon-wrap">
            ${item.iconSvg}
          </div>
          <div class="stats-item__content">
            <div class="stats-item__number">
              <span class="stats-item__val" data-target="${item.targetValue}">0</span><span class="stats-item__suffix">${item.suffix}</span>
            </div>
            <div class="stats-item__label">${item.label}</div>
          </div>
        </div>
        ${dividerHtml}
      `;
    })
    .join('');

  return `
    <div class="stats-strip" id="how-it-works-stats">
      <div class="stats-strip__inner">
        ${itemsHtml}
      </div>
    </div>
  `;
}

/**
 * Initializes count-up animation for stats using GSAP ScrollTrigger.
 */
export function initStatsAnimation(): void {
  const statsContainer = document.getElementById('how-it-works-stats');
  if (!statsContainer) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const statValElements = statsContainer.querySelectorAll<HTMLElement>('.stats-item__val');

  if (prefersReduced) {
    statValElements.forEach((el) => {
      const target = parseInt(el.getAttribute('data-target') || '0', 10);
      el.textContent = target.toLocaleString();
    });
    return;
  }

  ScrollTrigger.create({
    trigger: statsContainer,
    start: 'top 85%',
    once: true,
    onEnter: () => {
      statValElements.forEach((el) => {
        const target = parseInt(el.getAttribute('data-target') || '0', 10);
        const obj = { val: 0 };

        gsap.to(obj, {
          val: target,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = Math.floor(obj.val).toLocaleString();
          },
          onComplete: () => {
            el.textContent = target.toLocaleString();
          }
        });
      });
    }
  });
}
