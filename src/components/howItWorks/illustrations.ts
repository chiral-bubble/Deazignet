/**
 * Mini-UI Illustrations for Step Cards.
 * Pure HTML, CSS, and SVG components with gentle looped animations.
 */

export function renderStep1Illustration(): string {
  return `
    <div class="mini-ui mini-ui--step1" aria-hidden="true">
      <div class="mini-ui__window">
        <div class="mini-ui__browser-bar">
          <span class="mini-ui__dot mini-ui__dot--red"></span>
          <span class="mini-ui__dot mini-ui__dot--yellow"></span>
          <span class="mini-ui__dot mini-ui__dot--green"></span>
          <span class="mini-ui__browser-title">dezignet.com/new-project</span>
        </div>

        <div class="mini-ui__form-body">
          <div class="mini-ui__input-group">
            <span class="mini-ui__label">PROJECT TITLE</span>
            <div class="mini-ui__input-field">
              <span class="mini-ui__typing-text" data-text="Modern 3-Bedroom Duplex"></span>
              <span class="mini-ui__cursor"></span>
            </div>
          </div>

          <div class="mini-ui__meta-row">
            <div class="mini-ui__chip-container">
              <span class="mini-ui__chip-label">EST. BUDGET</span>
              <div class="mini-ui__chip mini-ui__chip--budget">
                <span class="mini-ui__chip-dot"></span>
                <span>$45,000</span>
              </div>
            </div>

            <div class="mini-ui__button-wrapper">
              <button class="mini-ui__btn-action" tabindex="-1">
                <span>Post Project</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderStep2Illustration(): string {
  return `
    <div class="mini-ui mini-ui--step2" aria-hidden="true">
      <div class="mini-ui__proposals-header">
        <div class="mini-ui__badge-pill">
          <span class="mini-ui__bell-icon">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </span>
          <span class="mini-ui__badge-text">3 new proposals</span>
        </div>
      </div>

      <div class="mini-ui__proposals-stack">
        <!-- Proposal 1 -->
        <div class="mini-ui__proposal-card mini-ui__proposal-card--1">
          <div class="mini-ui__avatar mini-ui__avatar--1">EV</div>
          <div class="mini-ui__prop-info">
            <div class="mini-ui__prop-name">Elena Vance <span class="mini-ui__prop-role">Lead Architect</span></div>
            <div class="mini-ui__prop-rating">
              <span class="mini-ui__star">★</span>
              <span>5.0</span>
              <span class="mini-ui__reviews">(48 reviews)</span>
            </div>
          </div>
          <div class="mini-ui__prop-bid">$4,200</div>
        </div>

        <!-- Proposal 2 -->
        <div class="mini-ui__proposal-card mini-ui__proposal-card--2">
          <div class="mini-ui__avatar mini-ui__avatar--2">AK</div>
          <div class="mini-ui__prop-info">
            <div class="mini-ui__prop-name">Studio ArchiKraft <span class="mini-ui__prop-role">Design Studio</span></div>
            <div class="mini-ui__prop-rating">
              <span class="mini-ui__star">★</span>
              <span>4.9</span>
              <span class="mini-ui__reviews">(36 reviews)</span>
            </div>
          </div>
          <div class="mini-ui__prop-bid">$3,800</div>
        </div>

        <!-- Proposal 3 -->
        <div class="mini-ui__proposal-card mini-ui__proposal-card--3">
          <div class="mini-ui__avatar mini-ui__avatar--3">MK</div>
          <div class="mini-ui__prop-info">
            <div class="mini-ui__prop-name">Marcus Kim <span class="mini-ui__prop-role">Structural Eng.</span></div>
            <div class="mini-ui__prop-rating">
              <span class="mini-ui__star">★</span>
              <span>5.0</span>
              <span class="mini-ui__reviews">(52 reviews)</span>
            </div>
          </div>
          <div class="mini-ui__prop-bid">$4,500</div>
        </div>
      </div>
    </div>
  `;
}

export function renderStep3Illustration(): string {
  return `
    <div class="mini-ui mini-ui--step3" aria-hidden="true">
      <div class="mini-ui__milestones-box">
        <div class="mini-ui__milestone-header">
          <span class="mini-ui__m-title">PROJECT MILESTONES</span>
          <span class="mini-ui__m-status">Phase 3 of 3 Active</span>
        </div>

        <div class="mini-ui__milestone-track">
          <!-- Segment 1: Concept -->
          <div class="mini-ui__m-step mini-ui__m-step--complete">
            <div class="mini-ui__m-circle mini-ui__m-circle--complete">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span class="mini-ui__m-name">Concept</span>
          </div>

          <div class="mini-ui__m-connector mini-ui__m-connector--1"></div>

          <!-- Segment 2: 3D Render -->
          <div class="mini-ui__m-step mini-ui__m-step--complete">
            <div class="mini-ui__m-circle mini-ui__m-circle--complete">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <span class="mini-ui__m-name">3D Model</span>
          </div>

          <div class="mini-ui__m-connector mini-ui__m-connector--2"></div>

          <!-- Segment 3: Blueprints -->
          <div class="mini-ui__m-step mini-ui__m-step--active">
            <div class="mini-ui__m-circle mini-ui__m-circle--active">
              <span class="mini-ui__m-pulse"></span>
            </div>
            <span class="mini-ui__m-name">Blueprints</span>
          </div>
        </div>

        <div class="mini-ui__milestone-bar-wrap">
          <div class="mini-ui__milestone-bar-fill"></div>
        </div>

        <div class="mini-ui__escrow-badge">
          <div class="mini-ui__shield-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              <polyline points="9 12 11 14 15 10"></polyline>
            </svg>
          </div>
          <div class="mini-ui__escrow-text">
            <strong>Payment Secured</strong> — Funds protected in Escrow
          </div>
        </div>
      </div>
    </div>
  `;
}
