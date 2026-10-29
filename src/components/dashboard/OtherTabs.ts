/**
 * OtherTabs Component — Conversations, Contracts, Payment History, Billing, and Settings views.
 */

import { dashIcons } from './dashboardIcons';
import { contractsData, paymentHistoryData } from './dashboardData';

export function renderConversationsTab(): string {
  return `
    <div class="dash-tab-content dash-conversations" id="tab-conversations">
      <div class="conv-layout">
        <!-- Conversations List Sidebar -->
        <aside class="conv-sidebar">
          <div class="conv-sidebar-header">
            <h3>Direct Messages</h3>
            <span class="conv-unread-pill">3 New</span>
          </div>
          <div class="conv-search">
            <span class="conv-search-icon">${dashIcons.search}</span>
            <input type="text" placeholder="Search clients or architects..." />
          </div>
          <div class="conv-thread-list">
            <div class="conv-thread-item is-active">
              <div class="conv-avatar" style="background:#2F7BE5">EV</div>
              <div class="conv-thread-info">
                <div class="conv-thread-top">
                  <strong>Elena Vance</strong>
                  <small>14m ago</small>
                </div>
                <p>I just uploaded the updated hillside residence ceiling sections for your review.</p>
              </div>
              <span class="conv-active-dot"></span>
            </div>

            <div class="conv-thread-item is-unread">
              <div class="conv-avatar" style="background:#f59e0b">TA</div>
              <div class="conv-thread-info">
                <div class="conv-thread-top">
                  <strong>Tariq Al-Mansoor</strong>
                  <small>2h ago</small>
                </div>
                <p>Can we confirm the travertine stone delivery window for the hotel lobby?</p>
              </div>
              <span class="conv-active-dot"></span>
            </div>

            <div class="conv-thread-item">
              <div class="conv-avatar" style="background:#10b981">MK</div>
              <div class="conv-thread-info">
                <div class="conv-thread-top">
                  <strong>Marcus Kim</strong>
                  <small>Yesterday</small>
                </div>
                <p>Structural calculation report is signed and stamped.</p>
              </div>
            </div>
          </div>
        </aside>

        <!-- Active Chat Area -->
        <main class="conv-chat-main">
          <header class="conv-chat-header">
            <div class="conv-chat-header-user">
              <div class="conv-avatar" style="background:#2F7BE5">EV</div>
              <div>
                <h4>Elena Vance <span class="conv-role-tag">Lead Architect</span></h4>
                <small>Active now • Pacific Palisades Residence</small>
              </div>
            </div>
            <div class="conv-chat-actions">
              <button type="button" class="btn-dash-ghost btn-dash-sm">View Project</button>
              <button type="button" class="btn-dash-primary btn-dash-sm">Release Milestone</button>
            </div>
          </header>

          <div class="conv-messages-area">
            <div class="chat-bubble chat-bubble--incoming">
              <p>Hello Alexandre! The revised 3D elevations and structural framing calculations for Phase 2 are ready.</p>
              <span class="bubble-time">10:42 AM</span>
            </div>
            <div class="chat-bubble chat-bubble--outgoing">
              <p>Thanks Elena! The cantilevered canopy looks exceptional. Are the structural drainage channels concealed within the soffit?</p>
              <span class="bubble-time">11:05 AM</span>
            </div>
            <div class="chat-bubble chat-bubble--incoming">
              <p>Yes, exactly. I attached the detail drawings below for your sign-off.</p>
              <div class="chat-attachment-card">
                <span class="att-icon">${dashIcons.contracts}</span>
                <div>
                  <strong>Palisades_Residence_Soffit_Drainage_v3.dwg</strong>
                  <small>24.8 MB • Architectural CAD Drawing</small>
                </div>
              </div>
              <span class="bubble-time">11:15 AM</span>
            </div>
          </div>

          <footer class="conv-input-bar">
            <input type="text" placeholder="Type a message or paste architectural specifications..." id="conv-chat-input" />
            <button type="button" class="btn-send-message" id="btn-send-msg">
              ${dashIcons.arrowRight}
            </button>
          </footer>
        </main>
      </div>
    </div>
  `;
}

export function renderContractsTab(): string {
  const contractsHtml = contractsData.map((c) => `
    <div class="contract-card">
      <div class="contract-card-header">
        <span class="contract-number">${c.contractNumber}</span>
        <span class="contract-badge contract-badge--${c.escrowStatus.toLowerCase()}">${c.escrowStatus} in Escrow</span>
      </div>
      <h3 class="contract-title">${c.projectTitle}</h3>
      <div class="contract-client"><small>CLIENT</small> <strong>${c.client}</strong></div>
      <div class="contract-milestone-step">
        <span class="contract-step-dot"></span>
        <span>${c.currentMilestone}</span>
      </div>
      <div class="contract-footer">
        <div class="contract-value"><small>TOTAL VALUE</small> <strong>$${c.totalValue.toLocaleString()}</strong></div>
        <button type="button" class="btn-dash-ghost btn-dash-sm">Download Agreement PDF</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="dash-tab-content dash-contracts" id="tab-contracts">
      <div class="contracts-header-row">
        <div>
          <h2>Architectural Contracts & Agreements</h2>
          <p>Binding service contracts, escrow funding bonds, and copyright clauses.</p>
        </div>
        <button type="button" class="btn-dash-primary">
          ${dashIcons.plus}
          <span>Draft New Contract</span>
        </button>
      </div>

      <div class="contracts-grid">
        ${contractsHtml}
      </div>
    </div>
  `;
}

export function renderPaymentHistoryTab(): string {
  const rowsHtml = paymentHistoryData.map((p) => `
    <tr class="ledger-row">
      <td class="ledger-cell-id"><strong>${p.invoiceId}</strong></td>
      <td class="ledger-cell-proj">${p.projectTitle}</td>
      <td class="ledger-cell-milestone">${p.milestone}</td>
      <td class="ledger-cell-date">${p.date}</td>
      <td class="ledger-cell-amount">$${p.amount.toLocaleString()}</td>
      <td class="ledger-cell-status">
        <span class="ledger-status-chip ledger-status-chip--${p.status === 'Released' ? 'released' : 'escrow'}">
          ${p.status}
        </span>
      </td>
      <td class="ledger-cell-action">
        <button type="button" class="ledger-btn-receipt" title="Download Invoice">Receipt</button>
      </td>
    </tr>
  `).join('');

  return `
    <div class="dash-tab-content dash-payments" id="tab-paymentHistory">
      <div class="payments-header-row">
        <div>
          <h2>Financial Ledger & Escrow Releases</h2>
          <p>Transparent real-time auditing of milestone disbursements and deposits.</p>
        </div>
        <div class="escrow-balance-card">
          <small>CURRENT ESCROW PROTECTION</small>
          <strong>$37,500.00</strong>
        </div>
      </div>

      <div class="ledger-table-wrap">
        <table class="ledger-table">
          <thead>
            <tr>
              <th>INVOICE ID</th>
              <th>PROJECT</th>
              <th>MILESTONE</th>
              <th>DATE</th>
              <th>AMOUNT</th>
              <th>ESCROW STATUS</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

export function renderBillingTab(): string {
  return `
    <div class="dash-tab-content dash-billing" id="tab-billing">
      <div class="billing-header">
        <h2>Billing, Payouts & Escrow</h2>
        <p>Manage payment methods, verified bank payout accounts, and tax invoices.</p>
      </div>

      <div class="billing-grid">
        <!-- Payment Card -->
        <div class="billing-card">
          <h3>Active Payout Account</h3>
          <p class="billing-card-desc">Milestone disbursements are automatically routed here upon client release.</p>
          <div class="virtual-bank-card">
            <div class="bank-card-top">
              <span class="bank-chip"></span>
              <span class="bank-brand">STERLING ATELIER LLC</span>
            </div>
            <div class="bank-account-num">•••• •••• •••• 9412</div>
            <div class="bank-card-bottom">
              <div><small>BANK</small><strong>First National Commercial</strong></div>
              <div><small>ROUTING</small><strong>021000089</strong></div>
            </div>
          </div>
          <button type="button" class="btn-dash-ghost btn-dash-full">Update Bank Details</button>
        </div>

        <!-- Escrow Protection Guarantee -->
        <div class="billing-card">
          <div class="escrow-shield-banner">
            <span class="escrow-banner-icon">${dashIcons.shieldCheck}</span>
            <div>
              <h4>Dezignet Escrow Vault</h4>
              <p>Funds are secured in segregated tier-1 escrow accounts until both client and architect sign off on deliverables.</p>
            </div>
          </div>
          <div class="escrow-stats-box">
            <div class="escrow-stat-row">
              <span>Total Disbursed:</span>
              <strong>$90,950.00</strong>
            </div>
            <div class="escrow-stat-row">
              <span>Currently in Escrow:</span>
              <strong style="color:#2F7BE5">$37,500.00</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderSettingsTab(): string {
  return `
    <div class="dash-tab-content dash-settings" id="tab-settings">
      <div class="settings-header">
        <h2>Studio & Profile Settings</h2>
        <p>Architectural credentials, notification rules, and workspace preferences.</p>
      </div>

      <div class="settings-sections">
        <!-- Appearance Theme Toggle -->
        <div class="settings-card">
          <h3>Interface Appearance</h3>
          <p class="settings-desc">Choose between Deep Obsidian Dark theme or Warm Paper Light theme.</p>
          <div class="theme-picker-row">
            <button type="button" class="theme-choice-btn" data-theme-choice="dark" id="theme-btn-dark">
              <span class="theme-icon">${dashIcons.moon}</span>
              <div>
                <strong>Dark Theme (Default)</strong>
                <small>Deep ink background (#0B0E14) & raised surfaces</small>
              </div>
            </button>
            <button type="button" class="theme-choice-btn" data-theme-choice="light" id="theme-btn-light">
              <span class="theme-icon">${dashIcons.sun}</span>
              <div>
                <strong>Light Theme</strong>
                <small>Warm paper background (#F6F4EF) & ink typography</small>
              </div>
            </button>
          </div>
        </div>

        <!-- Studio Credentials -->
        <div class="settings-card">
          <h3>Architectural License & Verification</h3>
          <p class="settings-desc">Your credentials allow participation in government and institutional commissions.</p>
          <div class="settings-form-grid">
            <div class="settings-field">
              <label>FULL PROFESSIONAL NAME</label>
              <input type="text" value="Alexandre Sterling" />
            </div>
            <div class="settings-field">
              <label>STUDIO / FIRM NAME</label>
              <input type="text" value="Sterling & Atelier Studio" />
            </div>
            <div class="settings-field">
              <label>ACCREDITATION / LICENSE NO.</label>
              <input type="text" value="AIA-2024-8841-A" />
            </div>
            <div class="settings-field">
              <label>SPECIALTY PRACTICE</label>
              <input type="text" value="Contemporary & Sustainable Residential" />
            </div>
          </div>
          <button type="button" class="btn-dash-primary" style="margin-top:1.5rem">Save Credentials</button>
        </div>
      </div>
    </div>
  `;
}
