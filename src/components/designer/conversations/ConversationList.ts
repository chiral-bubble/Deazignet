/**
 * ConversationList Component
 * Left pane (340px desktop / primary screen on mobile):
 * - Search by client or project title
 * - Filter tabs: All, Unread, Archived
 * - Rows with avatar, name, project title in grey, snippet, time, unread badge, and mute icon
 * - Empty state with helpful explanation
 */

import {
  getConversations,
  type ConversationFilterTab
} from '../../../services/conversationsService';
import { type SharedConversation } from '../../../mocks/dataset';

export function renderConversationList(): string {
  return `
    <div class="dez-conv-sidebar-pane" style="width: 340px; border-right: 1px solid #E5E7EB; background: #FFFFFF; display: flex; flex-direction: column; height: 100%; flex-shrink: 0;">
      <!-- Search & Filters Header -->
      <div style="padding: 16px 16px 12px 16px; border-bottom: 1px solid #E5E7EB;">
        <h2 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 12px 0;">Conversations</h2>

        <!-- Search Input -->
        <div style="position: relative; margin-bottom: 12px;">
          <input
            type="text"
            id="conv-search-input"
            class="dez-form-input"
            placeholder="Search by client or project..."
            style="height: 36px; font-size: 13px; padding-left: 32px;"
          />
          <svg style="position: absolute; left: 10px; top: 10px; color: #9CA3AF;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        <!-- Filter Tabs: All, Unread, Archived -->
        <div class="dez-conv-filter-tabs" style="display: flex; gap: 4px; background: #F3F4F6; padding: 3px; border-radius: 6px;">
          <button type="button" class="btn-conv-tab is-active" data-tab="all" style="flex: 1; border: none; background: #FFFFFF; font-size: 12.5px; font-weight: 500; color: #111827; padding: 5px 0; border-radius: 4px; cursor: pointer;">
            All
          </button>
          <button type="button" class="btn-conv-tab" data-tab="unread" style="flex: 1; border: none; background: transparent; font-size: 12.5px; font-weight: 500; color: #6B7280; padding: 5px 0; border-radius: 4px; cursor: pointer;">
            Unread
          </button>
          <button type="button" class="btn-conv-tab" data-tab="archived" style="flex: 1; border: none; background: transparent; font-size: 12.5px; font-weight: 500; color: #6B7280; padding: 5px 0; border-radius: 4px; cursor: pointer;">
            Archived
          </button>
        </div>
      </div>

      <!-- List Scroll Container -->
      <div id="conv-list-items-container" style="flex: 1; overflow-y: auto;">
        <div style="padding: 24px; text-align: center; color: #6B7280; font-size: 13px;">Loading conversations...</div>
      </div>
    </div>
  `;
}

export function initConversationList(
  container: HTMLElement,
  callbacks: {
    onSelectConversation: (id: string) => void;
    onUnreadCountChanged?: (count: number) => void;
  },
  activeConversationId?: string
): { reload: () => Promise<void>; setActive: (id: string) => void } {
  const itemsContainer = container.querySelector('#conv-list-items-container') as HTMLElement;
  const searchInput = container.querySelector('#conv-search-input') as HTMLInputElement;
  const tabButtons = container.querySelectorAll<HTMLButtonElement>('.btn-conv-tab');

  let currentTab: ConversationFilterTab = 'all';
  let activeId: string | undefined = activeConversationId;
  let conversations: SharedConversation[] = [];

  async function load() {
    if (!itemsContainer) return;
    const query = searchInput?.value.trim() || undefined;
    conversations = await getConversations(currentTab, query);

    renderItems();
  }

  function renderItems() {
    if (!itemsContainer) return;

    if (conversations.length === 0) {
      itemsContainer.innerHTML = `
        <div style="padding: 36px 20px; text-align: center;">
          <div style="font-size: 14px; font-weight: 500; color: #111827; margin-bottom: 6px;">No conversations yet</div>
          <div style="font-size: 12.5px; color: #6B7280; line-height: 1.5;">
            Clients can message you after they review your proposal. Conversations will appear here automatically.
          </div>
        </div>
      `;
      return;
    }

    itemsContainer.innerHTML = conversations
      .map((c) => {
        const isSelected = c.id === activeId;
        const hasUnread = c.unreadCount > 0;

        return `
          <div
            class="dez-conv-row ${isSelected ? 'is-selected' : ''}"
            data-conv-id="${c.id}"
            tabindex="0"
            style="padding: 12px 16px; border-bottom: 1px solid #F3F4F6; cursor: pointer; display: flex; gap: 12px; align-items: flex-start; background: ${
              isSelected ? '#F7F7F8' : hasUnread ? '#FFFFFF' : '#FFFFFF'
            }; transition: background 150ms ease;"
          >
            <!-- Avatar -->
            <img
              src="${c.clientAvatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'}"
              alt="${c.clientName}"
              style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0;"
            />

            <!-- Info -->
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px;">
                <span style="font-size: 13.5px; font-weight: ${hasUnread ? '700' : '600'}; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${c.clientName}
                </span>
                <span style="font-size: 11px; color: #9CA3AF; white-space: nowrap; margin-left: 6px;">
                  ${c.lastMessageTime}
                </span>
              </div>

              <!-- Project Title in Grey -->
              <div style="font-size: 12px; color: #6B7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px;">
                ${c.projectTitle}
              </div>

              <!-- Last Message Snippet -->
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
                <span style="font-size: 12.5px; color: ${
                  hasUnread ? '#111827' : '#6B7280'
                }; font-weight: ${hasUnread ? '500' : '400'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;">
                  ${c.lastMessageSnippet || 'No messages yet'}
                </span>

                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                  ${
                    c.isMuted
                      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>`
                      : ''
                  }
                  ${
                    hasUnread
                      ? `<span style="background: var(--dez-primary-blue, #2F7BE5); color: #FFFFFF; font-size: 11px; font-weight: 600; min-width: 18px; height: 18px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; padding: 0 4px;">${c.unreadCount}</span>`
                      : ''
                  }
                </div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    // Attach click events
    itemsContainer.querySelectorAll<HTMLElement>('.dez-conv-row').forEach((row) => {
      const id = row.getAttribute('data-conv-id');
      const clickHandler = () => {
        if (!id) return;
        activeId = id;
        renderItems();
        callbacks.onSelectConversation(id);
      };

      row.addEventListener('click', clickHandler);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') clickHandler();
      });
    });
  }

  // Search input with debounce
  let searchTimer: any = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(load, 150);
  });

  // Filter tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab') as ConversationFilterTab;
      if (!tab) return;
      currentTab = tab;

      tabButtons.forEach((b) => {
        const isActive = b.getAttribute('data-tab') === tab;
        b.classList.toggle('is-active', isActive);
        b.style.background = isActive ? '#FFFFFF' : 'transparent';
        b.style.color = isActive ? '#111827' : '#6B7280';
      });

      load();
    });
  });

  load();

  return {
    reload: load,
    setActive: (id: string) => {
      activeId = id;
      renderItems();
    }
  };
}
