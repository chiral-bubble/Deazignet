/**
 * Conversations Service for Dezignet
 * Clean service layer connecting the Designer Conversations interface
 * to the shared single mock dataset.
 */

import {
  sharedDataset,
  type SharedConversation,
  type MessageItem,
  type ConversationAttachment
} from '../mocks/dataset';

function delay(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ConversationFilterTab = 'all' | 'unread' | 'archived';

export interface ReportConversationPayload {
  conversationId: string;
  reason: 'spam' | 'harassment' | 'off_platform' | 'inappropriate' | 'other';
  details: string;
}

// Global subscribers registry for real-time emulation
const conversationSubscribers = new Map<string, Set<(message: MessageItem) => void>>();

export async function getConversations(
  filter: ConversationFilterTab = 'all',
  searchQuery?: string
): Promise<SharedConversation[]> {
  await delay(80);

  let list = [...sharedDataset.conversations];

  if (filter === 'unread') {
    list = list.filter((c) => c.unreadCount > 0 && !c.isArchived);
  } else if (filter === 'archived') {
    list = list.filter((c) => c.isArchived);
  } else {
    // 'all' excludes archived unless searched
    list = list.filter((c) => !c.isArchived);
  }

  if (searchQuery && searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.projectTitle.toLowerCase().includes(q) ||
        c.lastMessageSnippet.toLowerCase().includes(q)
    );
  }

  // Sort by latest message
  return list;
}

export async function getConversation(id: string): Promise<SharedConversation | null> {
  await delay(60);
  const conv = sharedDataset.conversations.find((c) => c.id === id);
  return conv ? { ...conv } : null;
}

export async function markConversationAsRead(id: string): Promise<void> {
  await delay(30);
  const conv = sharedDataset.conversations.find((c) => c.id === id);
  if (conv) {
    conv.unreadCount = 0;
    conv.messages.forEach((m) => {
      if (!m.isSelf && m.status !== 'Read') {
        m.status = 'Read';
      }
    });
  }
}

export async function sendMessage(
  conversationId: string,
  text: string,
  attachments?: ConversationAttachment[]
): Promise<MessageItem> {
  await delay(100);

  const conv = sharedDataset.conversations.find((c) => c.id === conversationId);
  if (!conv) {
    throw new Error('Conversation not found');
  }

  if (conv.isClosed) {
    throw new Error('Cannot send messages to a closed conversation');
  }

  if (!conv.hasClientInitiated) {
    throw new Error('Designers can only reply after a client starts the conversation');
  }

  const message = sharedDataset.sendMessageInMock(conversationId, text, attachments);

  // Notify active subscribers
  const subs = conversationSubscribers.get(conversationId);
  if (subs) {
    subs.forEach((cb) => cb(message));
  }

  return message;
}

export async function muteConversation(conversationId: string, isMuted: boolean): Promise<boolean> {
  await delay(50);
  const conv = sharedDataset.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.isMuted = isMuted;
    return true;
  }
  return false;
}

export async function archiveConversation(conversationId: string, isArchived: boolean): Promise<boolean> {
  await delay(50);
  const conv = sharedDataset.conversations.find((c) => c.id === conversationId);
  if (conv) {
    conv.isArchived = isArchived;
    return true;
  }
  return false;
}

export async function reportConversation(payload: ReportConversationPayload): Promise<boolean> {
  await delay(150);
  // Log mock report
  console.info('[Dezignet Trust & Safety] Conversation reported:', payload);
  return true;
}

export function subscribeToConversation(
  conversationId: string,
  callback: (message: MessageItem) => void
): () => void {
  if (!conversationSubscribers.has(conversationId)) {
    conversationSubscribers.set(conversationId, new Set());
  }
  const subs = conversationSubscribers.get(conversationId)!;
  subs.add(callback);

  return () => {
    subs.delete(callback);
    if (subs.size === 0) {
      conversationSubscribers.delete(conversationId);
    }
  };
}

export async function simulateIncomingClientMessage(
  conversationId: string,
  customText?: string
): Promise<MessageItem> {
  await delay(120);
  const msg = sharedDataset.simulateClientMessage(conversationId, customText);

  // Notify active subscribers
  const subs = conversationSubscribers.get(conversationId);
  if (subs) {
    subs.forEach((cb) => cb(msg));
  }

  return msg;
}

export function getUnreadMessagesCount(): number {
  return sharedDataset.conversations.reduce((sum, c) => sum + (c.isArchived ? 0 : c.unreadCount), 0);
}
