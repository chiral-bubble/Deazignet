/**
 * DashboardHeader Component
 * Clean Header:
 * - "Dashboard" title (Playfair Display 28px)
 * - Greeting line below in grey
 * 
 * DevStateSwitcher:
 * - Moved out of the page into a small dev-only control in the bottom-right corner
 * - Styled as a simple segmented control (Full data / Incomplete / New designer)
 */

import { getMockState, type MockStateKey } from '../../../services/designerDashboardService';

export function renderDashboardHeader(designerName = 'Alexandre'): string {
  const hour = new Date().getHours();
  let timeOfDay = 'afternoon';
  if (hour < 12) timeOfDay = 'morning';
  else if (hour >= 18) timeOfDay = 'evening';

  return `
    <header class="dez-dash-header-wrap">
      <div class="dez-dash-header-left">
        <h1 class="dez-dash-title">Dashboard</h1>
        <p class="dez-dash-greeting">Good ${timeOfDay}, ${designerName}. Here is what needs your attention today.</p>
      </div>
    </header>
  `;
}

export function renderDevStateSwitcher(): string {
  // Hidden in production builds
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) {
    return '';
  }

  const currentState = getMockState();

  return `
    <!-- Dev-only Mock State Switcher (fixed bottom-right corner) -->
    <div class="dez-dev-floating-switcher" role="region" aria-label="Developer mock state controller">
      <div class="dez-dev-pill-label">DEV MOCK STATE</div>
      <div class="dez-dev-segmented-control" role="group" aria-label="Mock state selection">
        <button type="button" class="dez-dev-seg-btn ${currentState === 'full' ? 'is-active' : ''}" data-set-state="full" title="Load full commission, proposals, and payout data">
          Full data
        </button>
        <button type="button" class="dez-dev-seg-btn ${currentState === 'incomplete' ? 'is-active' : ''}" data-set-state="incomplete" title="Simulate incomplete profile with banner">
          Incomplete
        </button>
        <button type="button" class="dez-dev-seg-btn ${currentState === 'empty' ? 'is-active' : ''}" data-set-state="empty" title="Simulate new designer with zeroed metrics">
          New designer
        </button>
      </div>
    </div>
  `;
}

export function initDevStateSwitcher(container: HTMLElement, onStateChange: (newState: MockStateKey) => void): void {
  const buttons = container.querySelectorAll<HTMLButtonElement>('[data-set-state]');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const state = btn.getAttribute('data-set-state') as MockStateKey;
      if (state) {
        onStateChange(state);
      }
    });
  });
}
