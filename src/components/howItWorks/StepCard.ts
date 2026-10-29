/**
 * StepCard Component — Renders premium card markup and handles 3D tilt & spotlight.
 */

import type { StepConfig } from './stepsConfig';
import {
  renderStep1Illustration,
  renderStep2Illustration,
  renderStep3Illustration
} from './illustrations';

export function renderStepCard(step: StepConfig): string {
  let illustrationHtml = '';
  if (step.stepIndex === 1) {
    illustrationHtml = renderStep1Illustration();
  } else if (step.stepIndex === 2) {
    illustrationHtml = renderStep2Illustration();
  } else {
    illustrationHtml = renderStep3Illustration();
  }

  return `
    <div class="step-card-premium" id="step-card-${step.stepIndex}" data-step="${step.stepIndex}">
      <!-- Background watermark number -->
      <div class="step-card__watermark" aria-hidden="true">${step.number}</div>

      <!-- Mouse-following spotlight glow -->
      <div class="step-card__spotlight" aria-hidden="true"></div>

      <!-- Card Inner Container for 3D tilt perspective -->
      <div class="step-card__inner">
        <!-- Top Illustration Area -->
        <div class="step-card__illustration-wrap">
          ${illustrationHtml}
        </div>

        <!-- Text Content Area -->
        <div class="step-card__content">
          <div class="step-card__badge-row">
            <span class="step-card__badge">STEP ${step.number}</span>
          </div>
          <h3 class="step-card__title">${step.title}</h3>
          <p class="step-card__description">${step.description}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attaches cursor spotlight and subtle 3D tilt to cards on desktop.
 */
export function initCardInteractions(cardElement: HTMLElement): void {
  // Check if reduced motion or touch device
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  const spotlight = cardElement.querySelector('.step-card__spotlight') as HTMLElement | null;
  const inner = cardElement.querySelector('.step-card__inner') as HTMLElement | null;

  if (!spotlight || !inner) return;

  function handlePointerMove(e: PointerEvent): void {
    const rect = cardElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update spotlight position
    spotlight!.style.setProperty('--mouse-x', `${x}px`);
    spotlight!.style.setProperty('--mouse-y', `${y}px`);
    spotlight!.style.opacity = '1';

    // Desktop 3D tilt (max ~6deg)
    if (!prefersReduced && !isTouch && window.innerWidth >= 768) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5; // tilt max 5-6 deg
      const rotateY = ((x - centerX) / centerX) * 5;

      inner!.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    }
  }

  function handlePointerLeave(): void {
    spotlight!.style.opacity = '0';
    if (!prefersReduced && inner) {
      inner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
      inner.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }
  }

  function handlePointerEnter(): void {
    if (inner) {
      inner.style.transition = 'transform 0.1s ease-out';
    }
  }

  cardElement.addEventListener('pointermove', handlePointerMove);
  cardElement.addEventListener('pointerleave', handlePointerLeave);
  cardElement.addEventListener('pointerenter', handlePointerEnter);
}
