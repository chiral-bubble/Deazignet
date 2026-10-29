/**
 * ConversationsLayout Component
 * Coordinates the 2-pane desktop / mobile sliding view for Designer Conversations:
 * - Desktop: Left (340px) conversation list + Right open thread
 * - Mobile: List screen first; clicking conversation slides open thread with back button
 * - URL hash routing: #conversations and #conversations/:id
 * - Synchronizes unread messages count with sidebar badge
 */

import {
  getConversation,
  getUnreadMessagesCount
} from '../../../services/conversationsService';
import { renderConversationList, initConversationList } from './ConversationList';
import {
  renderMessageThread,
  renderMessageThreadPlaceholder,
  initMessageThread
} from './MessageThread';

export function renderConversationsLayout(): string {
  return `
    <div class="dez-conversations-layout" id="dez-conversations-root" style="display: flex; height: calc(100vh - 70px); border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; background: #FFFFFF;">
      <!-- Left Pane: Conversation List -->
      <div id="conv-list-slot" class="dez-conv-list-container" style="height: 100%;">
        ${renderConversationList()}
      </div>

      <!-- Right Pane: Thread View or Empty Placeholder -->
      <div id="conv-thread-slot" class="dez-conv-thread-container" style="flex: 1; height: 100%; display: flex; flex-direction: column;">
        ${renderMessageThreadPlaceholder()}
      </div>
    </div>
  `;
}

export async function initConversations(
  container: HTMLElement,
  callbacks: {
    onUnreadCountChanged?: (count: number) => void;
    onShowToast: (title: string, msg: string, type?: 'success' | 'info' | 'error') => void;
  },
  initialConversationId?: string
): Promise<void> {
  const root = container.querySelector('#dez-conversations-root') as HTMLElement;
  if (!root) return;

  const listSlot = root.querySelector('#conv-list-slot') as HTMLElement;
  const threadSlot = root.querySelector('#conv-thread-slot') as HTMLElement;

  let activeThreadCleanup: (() => void) | null = null;
  let currentActiveId: string | undefined = initialConversationId;

  // Initialize conversation list
  const listCtrl = initConversationList(
    listSlot,
    {
      onSelectConversation: (id) => {
        openThread(id);
      }
    },
    currentActiveId
  );

  async function openThread(convId: string) {
    currentActiveId = convId;
    window.location.hash = `#conversations/${convId}`;

    if (activeThreadCleanup) {
      activeThreadCleanup();
      activeThreadCleanup = null;
    }

    const conv = await getConversation(convId);
    if (!conv) {
      threadSlot.innerHTML = renderMessageThreadPlaceholder();
      return;
    }

    // Render thread
    threadSlot.innerHTML = renderMessageThread(conv);

    // On mobile screens, add class to show thread full width
    root.classList.add('is-mobile-thread-open');

    const threadCtrl = initMessageThread(threadSlot, convId, {
      onBackToList: () => {
        root.classList.remove('is-mobile-thread-open');
        window.location.hash = '#conversations';
        currentActiveId = undefined;
        listCtrl.reload();
      },
      onThreadUpdated: () => {
        listCtrl.reload();
        if (callbacks.onUnreadCountChanged) {
          callbacks.onUnreadCountChanged(getUnreadMessagesCount());
        }
      },
      onShowToast: callbacks.onShowToast
    });

    activeThreadCleanup = threadCtrl.cleanup;
    listCtrl.setActive(convId);

    // Sync unread count
    if (callbacks.onUnreadCountChanged) {
      callbacks.onUnreadCountChanged(getUnreadMessagesCount());
    }
  }

  // If initial ID provided, open it
  if (initialConversationId) {
    await openThread(initialConversationId);
  }
}
