/**
 * Interactive Modals for Designer Dashboard
 * - Upload Deliverable Modal
 * - Log Hours Modal
 * - Withdraw Funds Modal
 *
 * Conforming strictly to:
 * - Hidden by default with fixed overlay (rgba dark ~40%)
 * - Centered white dialog (max-width 520px, 12px radius, 1px border)
 * - Header with title and close button
 * - Form fields with 1px border, 8px radius, blue focus ring, and inline error line
 * - Footer with Cancel (secondary) and Primary action aligned right
 */

export function renderDashboardModals(): string {
  return `
    <!-- 1. Deliverable Upload Modal -->
    <div class="dez-dash-modal-backdrop" id="modal-deliverable-backdrop" aria-hidden="true" style="display: none;">
      <div class="dez-dash-modal" id="modal-deliverable" role="dialog" aria-modal="true" aria-labelledby="modal-deliv-title">
        <div class="dez-dash-modal-header">
          <h3 id="modal-deliv-title">Upload Milestone Deliverable</h3>
          <button type="button" class="dez-modal-close-btn" id="btn-close-deliverable-modal" aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form class="dez-modal-form" id="form-upload-deliverable" onsubmit="return false;" novalidate>
          <input type="hidden" id="deliv-project-id" value="" />
          <p class="dez-modal-sub" id="deliv-project-display-title"></p>

          <div class="dez-modal-field">
            <label for="deliv-title-input">Deliverable package title</label>
            <input type="text" id="deliv-title-input" class="dez-input" placeholder="e.g. Schematic Drawing Set & Elevations Rev. 2" required />
            <span class="dez-field-error" id="deliv-title-error" style="display: none;"></span>
          </div>

          <div class="dez-modal-field">
            <label>Attachments (PDF / DWG / IFC / ZIP)</label>
            <div class="dez-dropzone" id="deliv-dropzone" tabindex="0" role="button" aria-label="Dropzone for architectural file package">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p>Drag architectural files here, or <span class="dez-link-action">browse files</span></p>
              <small>Max package size 250 MB</small>
            </div>
            <div class="dez-uploaded-file-tag" id="deliv-selected-file" style="display: none;">
              <span id="deliv-file-name">Elevation_Set_Draft.pdf (14.2 MB)</span>
            </div>
          </div>

          <div class="dez-modal-field">
            <label for="deliv-notes-input">Client submission notes (optional)</label>
            <textarea id="deliv-notes-input" class="dez-textarea" rows="3" placeholder="Summary of alterations, key dimensions, and structural notes for client review..."></textarea>
          </div>

          <div class="dez-modal-actions">
            <button type="button" class="dez-btn-outline" id="btn-cancel-deliverable">Cancel</button>
            <button type="submit" class="dez-btn-primary" id="btn-submit-deliverable">Submit Deliverable for Review</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 2. Log Hours Modal -->
    <div class="dez-dash-modal-backdrop" id="modal-hours-backdrop" aria-hidden="true" style="display: none;">
      <div class="dez-dash-modal" id="modal-hours" role="dialog" aria-modal="true" aria-labelledby="modal-hours-title">
        <div class="dez-dash-modal-header">
          <h3 id="modal-hours-title">Log Billable Time</h3>
          <button type="button" class="dez-modal-close-btn" id="btn-close-hours-modal" aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form class="dez-modal-form" id="form-log-hours" onsubmit="return false;" novalidate>
          <input type="hidden" id="hours-project-id" value="" />
          <p class="dez-modal-sub" id="hours-project-display-title"></p>

          <div class="dez-modal-field">
            <label for="input-hours-count">Hours to log</label>
            <input type="number" id="input-hours-count" class="dez-input" step="0.5" min="0.5" max="40" placeholder="e.g. 4.5" required />
            <span class="dez-field-error" id="hours-count-error" style="display: none;"></span>
          </div>

          <div class="dez-modal-field">
            <label for="input-hours-task">Scope & Activity description</label>
            <textarea id="input-hours-task" class="dez-textarea" rows="3" placeholder="e.g. Municipal building code coordination and daylight analysis with acoustic consultant..." required></textarea>
            <span class="dez-field-error" id="hours-task-error" style="display: none;"></span>
          </div>

          <div class="dez-modal-actions">
            <button type="button" class="dez-btn-outline" id="btn-cancel-hours">Cancel</button>
            <button type="submit" class="dez-btn-primary" id="btn-submit-hours">Save Hours</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 3. Withdraw Funds Modal -->
    <div class="dez-dash-modal-backdrop" id="modal-withdraw-backdrop" aria-hidden="true" style="display: none;">
      <div class="dez-dash-modal" id="modal-withdraw" role="dialog" aria-modal="true" aria-labelledby="modal-withdraw-title">
        <div class="dez-dash-modal-header">
          <h3 id="modal-withdraw-title">Withdraw Released Earnings</h3>
          <button type="button" class="dez-modal-close-btn" id="btn-close-withdraw-modal" aria-label="Close dialog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form class="dez-modal-form" id="form-withdraw-funds" onsubmit="return false;" novalidate>
          <div class="dez-withdraw-balance-box">
            <span class="dez-withdraw-avail-label">Available for immediate withdrawal:</span>
            <strong class="dez-withdraw-avail-val" id="withdraw-available-val">$0</strong>
          </div>

          <div class="dez-modal-field">
            <label for="input-withdraw-amount">Amount (USD)</label>
            <input type="number" id="input-withdraw-amount" class="dez-input" min="1" step="50" placeholder="1000" required />
            <span class="dez-field-error" id="withdraw-amount-error" style="display: none;"></span>
          </div>

          <div class="dez-modal-field">
            <label>Transfer destination</label>
            <div class="dez-payout-account-row">
              <span class="dez-payout-bank-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </span>
              <div>
                <strong style="display:block; font-size:13.5px; color:#111827;">Business Checking Account</strong>
                <span style="font-size:12px; color:#6B7280;">JPMorgan Chase •••• 4912 (Verified Direct Wire)</span>
              </div>
            </div>
          </div>

          <div class="dez-modal-actions">
            <button type="button" class="dez-btn-outline" id="btn-cancel-withdraw">Cancel</button>
            <button type="submit" class="dez-btn-primary" id="btn-submit-withdraw">Confirm Withdrawal</button>
          </div>
        </form>
      </div>
    </div>
  `;
}
