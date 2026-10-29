/**
 * ContextPanel Component
 * Collapsible side panel for Conversation view (drawer on mobile):
 * - Client profile summary (strictly NO email or phone)
 * - Project snapshot (budget, deadline, status)
 * - Proposal offer status & price
 * - Shared files list in this conversation
 */

import { type SharedConversation, type ConversationAttachment } from '../../../mocks/dataset';

export function renderContextPanel(conv: SharedConversation): string {
  // Collect all attachments from messages
  const sharedFiles: ConversationAttachment[] = [];
  conv.messages.forEach((m) => {
    if (m.attachments) {
      sharedFiles.push(...m.attachments);
    }
  });

  return `
    <aside class="dez-conv-context-panel" id="conv-context-panel" style="width: 320px; border-left: 1px solid #E5E7EB; background: #FFFFFF; overflow-y: auto; padding: 20px; flex-shrink: 0;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="font-size: 15px; font-weight: 600; color: #111827; margin: 0;">Commission Context</h3>
        <button type="button" class="dez-btn-secondary" id="btn-close-context-panel" style="display: none; height: 28px; width: 28px; padding: 0; align-items: center; justify-content: center;">
          &times;
        </button>
      </div>

      <!-- Client Profile Summary -->
      <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 18px; margin-bottom: 18px;">
        <div style="font-size: 11.5px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Client Profile</div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
          <img
            src="${conv.clientAvatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'}"
            alt="${conv.clientName}"
            style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;"
          />
          <div>
            <div style="font-weight: 600; font-size: 13.5px; color: #111827;">${conv.clientName}</div>
            <div style="font-size: 12px; color: #6B7280;">${conv.clientLocation}</div>
          </div>
        </div>

        <div style="font-size: 12px; color: #4B5563; margin-top: 6px;">
          ${conv.clientCompany ? `<div>Company: <strong>${conv.clientCompany}</strong></div>` : ''}
          <div style="color: #059669; font-weight: 500; display: flex; align-items: center; gap: 4px; margin-top: 4px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Payment method verified
          </div>
        </div>
      </div>

      <!-- Project Snapshot -->
      <div style="border-bottom: 1px solid #E5E7EB; padding-bottom: 18px; margin-bottom: 18px;">
        <div style="font-size: 11.5px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">Project Scope</div>
        <div style="font-size: 13.5px; font-weight: 600; color: #111827; margin-bottom: 4px;">${conv.projectTitle}</div>
        
        <div style="font-size: 12.5px; color: #4B5563; display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <div>Proposal Status: <strong style="color: #111827;">${conv.proposalStatus}</strong></div>
        </div>
      </div>

      <!-- Shared Files in Thread -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 11.5px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.04em;">Shared Files (${sharedFiles.length})</span>
        </div>

        ${
          sharedFiles.length === 0
            ? `<div style="font-size: 12.5px; color: #9CA3AF;">No files shared in this thread yet.</div>`
            : `
          <ul style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px;">
            ${sharedFiles
              .map(
                (f) => `
              <li style="border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 10px; background: #F7F7F8; display: flex; align-items: center; gap: 8px;">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <div style="min-width: 0; flex: 1;">
                  <a href="${f.url}" target="_blank" rel="noopener noreferrer" style="display: block; font-size: 12.5px; font-weight: 500; color: #111827; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${f.name}
                  </a>
                  <span style="font-size: 11px; color: #6B7280;">${(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </li>
            `
              )
              .join('')}
          </ul>
        `
        }
      </div>
    </aside>
  `;
}

export function initContextPanel(container: HTMLElement, onClose: () => void): void {
  const btnClose = container.querySelector('#btn-close-context-panel');
  btnClose?.addEventListener('click', onClose);
}
