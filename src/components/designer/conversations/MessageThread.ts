/**
 * MessageThread Component
 * Right pane conversation thread:
 * - Date separators
 * - Message bubbles & system message separators
 * - Auto-scroll with smart "New messages" jump button when user scrolled up
 * - Real-time subscription to incoming messages
 */

import {
  getConversation,
  markConversationAsRead,
  subscribeToConversation
} from '../../../services/conversationsService';
import { type SharedConversation, type MessageItem } from '../../../mocks/dataset';
import { renderThreadHeader, initThreadHeader } from './ThreadHeader';
import { renderMessageBubble } from './MessageBubble';
import { renderSystemMessage } from './SystemMessage';
import { renderComposer, initComposer } from './Composer';
import { renderContextPanel, initContextPanel } from './ContextPanel';
import { renderReportDialog, initReportDialog } from './ReportDialog';
import { renderLightboxModal, initLightbox } from './AttachmentChip';

export function renderMessageThreadPlaceholder(): string {
  return `
    <div class="dez-conv-thread-empty" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; background: #FAFAFA; text-align: center;">
      <div style="width: 54px; height: 54px; border-radius: 50%; background: #F3F4F6; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: #9CA3AF;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <h3 style="font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0;">Select a conversation</h3>
      <p style="font-size: 13px; color: #6B7280; max-width: 320px; margin: 0;">Choose a thread from the left pane to view messages and client commission briefs.</p>
    </div>
  `;
}

export function renderMessageThread(conv: SharedConversation): string {
  return `
    <div class="dez-conv-thread-view" id="conv-thread-container" style="flex: 1; display: flex; flex-direction: row; height: 100%; overflow: hidden; position: relative;">
      <!-- Main Chat Column (Header, Messages Scroll, Composer) -->
      <div style="flex: 1; display: flex; flex-direction: column; height: 100%; min-width: 0; background: #FFFFFF;">
        <!-- Thread Header -->
        ${renderThreadHeader(conv)}

        <!-- Messages Scroll Area -->
        <div id="thread-messages-scroll" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; position: relative;">
          ${renderGroupedMessages(conv.messages)}
        </div>

        <!-- Jump to New Messages Floating Button -->
        <button
          type="button"
          id="btn-scroll-bottom"
          class="dez-btn-secondary"
          style="display: none; position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%); z-index: 20; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); font-size: 12px; height: 30px; padding: 0 12px; border-radius: 9999px;"
        >
          &darr; New messages
        </button>

        <!-- Composer -->
        ${renderComposer(conv.isClosed, conv.hasClientInitiated)}
      </div>

      <!-- Collapsible Context Side Panel -->
      <div id="thread-context-panel-container">
        ${renderContextPanel(conv)}
      </div>

      <!-- Modals -->
      ${renderReportDialog()}
      ${renderLightboxModal()}
    </div>
  `;
}

function renderGroupedMessages(messages: MessageItem[]): string {
  // Group by dateString
  const groups: Record<string, MessageItem[]> = {};
  messages.forEach((m) => {
    const d = m.dateString || 'Today';
    if (!groups[d]) groups[d] = [];
    groups[d].push(m);
  });

  return Object.keys(groups)
    .map((dateStr) => {
      const items = groups[dateStr];
      return `
        <!-- Date Separator -->
        <div class="dez-date-separator" style="display: flex; align-items: center; justify-content: center; margin: 16px 0 12px 0;">
          <span style="font-size: 11.5px; font-weight: 500; color: #9CA3AF; background: #F3F4F6; padding: 2px 10px; border-radius: 9999px;">
            ${dateStr}
          </span>
        </div>

        <!-- Messages for this day -->
        ${items
          .map((m) => {
            if (m.isSystemMessage) {
              return renderSystemMessage(m.text, m.timestamp);
            }
            return renderMessageBubble(m);
          })
          .join('')}
      `;
    })
    .join('');
}

export function initMessageThread(
  container: HTMLElement,
  conversationId: string,
  callbacks: {
    onBackToList: () => void;
    onThreadUpdated: () => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  }
): { cleanup: () => void } {
  const scrollContainer = container.querySelector('#thread-messages-scroll') as HTMLElement;
  const btnScrollBottom = container.querySelector('#btn-scroll-bottom') as HTMLButtonElement;
  const contextContainer = container.querySelector('#thread-context-panel-container') as HTMLElement;

  let isUserScrolledUp = false;

  // Mark as read immediately upon opening
  markConversationAsRead(conversationId);

  // Scroll to bottom helper
  function scrollToBottom(smooth = false) {
    if (!scrollContainer) return;
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
    if (btnScrollBottom) btnScrollBottom.style.display = 'none';
    isUserScrolledUp = false;
  }

  // Scroll monitoring
  scrollContainer?.addEventListener('scroll', () => {
    const distanceToBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
    isUserScrolledUp = distanceToBottom > 80;
    if (btnScrollBottom) {
      btnScrollBottom.style.display = isUserScrolledUp ? 'block' : 'none';
    }
  });

  btnScrollBottom?.addEventListener('click', () => scrollToBottom(true));

  // Initialize lightbox
  initLightbox(container);

  // Initialize report dialog
  const reportModal = initReportDialog(container, {
    onShowToast: callbacks.onShowToast
  });

  // Re-fetch conversation to init components
  getConversation(conversationId).then((conv) => {
    if (!conv) return;

    // Init thread header
    initThreadHeader(container, conv, {
      onBackToList: callbacks.onBackToList,
      onToggleSidePanel: () => {
        if (!contextContainer) return;
        const panel = contextContainer.querySelector('#conv-context-panel') as HTMLElement;
        if (panel) {
          panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
      },
      onOpenReport: () => reportModal.open(conversationId),
      onRefreshThread: callbacks.onThreadUpdated,
      onShowToast: callbacks.onShowToast
    });

    // Init context panel
    initContextPanel(container, () => {
      const panel = contextContainer?.querySelector('#conv-context-panel') as HTMLElement;
      if (panel) panel.style.display = 'none';
    });

    // Init composer
    initComposer(container, conversationId, {
      onMessageSent: () => {
        reloadMessages();
        callbacks.onThreadUpdated();
      },
      onShowToast: callbacks.onShowToast
    });

    scrollToBottom(false);
  });

  async function reloadMessages() {
    const updated = await getConversation(conversationId);
    if (!updated || !scrollContainer) return;

    scrollContainer.innerHTML = renderGroupedMessages(updated.messages);
    if (!isUserScrolledUp) {
      scrollToBottom(true);
    } else if (btnScrollBottom) {
      btnScrollBottom.style.display = 'block';
    }
  }

  // Real-time subscription
  const unsubscribe = subscribeToConversation(conversationId, (_newMsg) => {
    reloadMessages();
    callbacks.onThreadUpdated();
  });

  return {
    cleanup: () => {
      unsubscribe();
    }
  };
}
