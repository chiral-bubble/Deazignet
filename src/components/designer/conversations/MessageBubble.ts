/**
 * MessageBubble Component
 * Renders individual messages:
 * - Own messages right-aligned (#EBF3FD tint) with status checks (Sent, Delivered, Read)
 * - Client messages left-aligned (#F3F4F6 light grey)
 * - Auto-linking URLs and multi-line formatting
 * - Attachments chips
 */

import { type MessageItem } from '../../../mocks/dataset';
import { renderAttachmentChip } from './AttachmentChip';

export function renderMessageBubble(msg: MessageItem): string {
  const isSelf = msg.isSelf;
  const formattedText = formatMessageText(msg.text);

  return `
    <div class="dez-message-row ${isSelf ? 'is-self' : 'is-client'}" style="display: flex; flex-direction: column; align-items: ${
    isSelf ? 'flex-end' : 'flex-start'
  }; margin-bottom: 12px;">
      <!-- Sender & Timestamp row on hover or subtle -->
      <div style="font-size: 11px; color: #9CA3AF; margin-bottom: 3px; padding: 0 4px;">
        ${!isSelf ? `${msg.senderName} • ` : ''}${msg.timestamp}
      </div>

      <!-- Bubble Container -->
      <div
        class="dez-message-bubble"
        style="max-width: 75%; border-radius: 8px; padding: 10px 14px; font-size: 13.5px; line-height: 1.5; word-break: break-word; background: ${
          isSelf ? '#EBF3FD' : '#F3F4F6'
        }; color: #111827; border: 1px solid ${isSelf ? '#BFDBFE' : '#E5E7EB'};"
      >
        <div class="dez-message-text">${formattedText}</div>

        ${
          msg.attachments && msg.attachments.length > 0
            ? `
          <div class="dez-message-attachments" style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
            ${msg.attachments.map((att) => renderAttachmentChip(att)).join('')}
          </div>
        `
            : ''
        }
      </div>

      <!-- Delivery / Read Status indicator on own messages -->
      ${
        isSelf
          ? `
        <div style="font-size: 11px; color: #6B7280; margin-top: 2px; padding-right: 4px; display: flex; align-items: center; gap: 4px;">
          <span>${msg.status}</span>
          ${
            msg.status === 'Read'
              ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2F7BE5" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/><polyline points="20 12 9 23 4 18"/></svg>`
              : msg.status === 'Delivered'
              ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`
              : ''
          }
        </div>
      `
          : ''
      }
    </div>
  `;
}

function formatMessageText(text: string): string {
  if (!text) return '';

  // Escape HTML tags
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Auto-link URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const linked = escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--dez-primary-blue, #2F7BE5); text-decoration: underline;">${url}</a>`;
  });

  return linked.replace(/\n/g, '<br />');
}
