/**
 * Conversations Service for Dezignet (Phase 4)
 * Clean service layer connecting the Designer Conversations interface
 * to Supabase Realtime messaging with fallback to shared mock dataset.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
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

// Global subscribers registry for active real-time channels
const conversationSubscribers = new Map<string, Set<(message: MessageItem) => void>>();
const activeRealtimeChannels = new Map<string, any>();

/**
 * Fetch all conversations for the current user
 */
export async function getConversations(
  filter: ConversationFilterTab = 'all',
  searchQuery?: string
): Promise<SharedConversation[]> {
  if (USE_MOCKS.conversations) {
    await delay(80);
    let list = [...sharedDataset.conversations];

    if (filter === 'unread') {
      list = list.filter((c) => c.unreadCount > 0 && !c.isArchived);
    } else if (filter === 'archived') {
      list = list.filter((c) => c.isArchived);
    } else {
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
    return list;
  }

  // Real Supabase query
  const { data: userAuth } = await supabase.auth.getUser();
  const currentUserId = userAuth.user?.id;
  if (!currentUserId) return [];

  // Query conversations with joins
  const { data: convRows, error } = await supabase
    .from('conversations')
    .select(`
      id,
      project_id,
      proposal_id,
      client_id,
      designer_id,
      status,
      last_message_at,
      last_message_preview,
      created_at,
      projects (
        title,
        budget,
        category,
        payment_type
      ),
      client_summaries:client_id (
        display_name,
        city,
        state_region,
        payment_verified
      ),
      conversation_user_settings (
        muted,
        archived,
        last_read_at
      )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error || !convRows) {
    console.warn('Error fetching conversations from Supabase:', error);
    return [];
  }

  // Get unread counts
  const { data: unreadData } = await supabase.rpc('get_unread_counts');
  const unreadMap = new Map<string, number>();
  if (unreadData && Array.isArray((unreadData as any).conversations)) {
    (unreadData as any).conversations.forEach((item: any) => {
      unreadMap.set(item.conversation_id, item.unread_count);
    });
  }

  const mapped: SharedConversation[] = convRows.map((row: any) => {
    const settings = Array.isArray(row.conversation_user_settings)
      ? row.conversation_user_settings[0]
      : row.conversation_user_settings;
    const isArchived = !!settings?.archived;
    const isMuted = !!settings?.muted;
    const unreadCount = unreadMap.get(row.id) || 0;

    const clientInfo = Array.isArray(row.client_summaries) ? row.client_summaries[0] : row.client_summaries;
    const projectInfo = Array.isArray(row.projects) ? row.projects[0] : row.projects;

    return {
      id: row.id,
      clientId: row.client_id || '',
      clientName: clientInfo?.display_name || 'Client',
      clientLocation: [clientInfo?.city, clientInfo?.state_region].filter(Boolean).join(', ') || 'Nigeria',
      clientAvatarUrl: '',
      projectId: row.project_id || '',
      projectTitle: projectInfo?.title || 'Contract Project',
      proposalId: row.proposal_id || '',
      proposalStatus: row.status === 'active' ? 'accepted' : 'completed',
      lastMessageSnippet: row.last_message_preview || 'No messages yet',
      lastMessageTime: row.last_message_at ? new Date(row.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount,
      isMuted,
      isArchived,
      isClosed: row.status === 'closed',
      hasClientInitiated: true,
      messages: []
    };
  });

  let result = mapped;
  if (filter === 'unread') {
    result = result.filter((c) => c.unreadCount > 0 && !c.isArchived);
  } else if (filter === 'archived') {
    result = result.filter((c) => c.isArchived);
  } else {
    result = result.filter((c) => !c.isArchived);
  }

  if (searchQuery && searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase().trim();
    result = result.filter(
      (c) =>
        c.clientName.toLowerCase().includes(q) ||
        c.projectTitle.toLowerCase().includes(q) ||
        c.lastMessageSnippet.toLowerCase().includes(q)
    );
  }

  return result;
}

/**
 * Fetch full conversation with message history
 */
export async function getConversation(id: string): Promise<SharedConversation | null> {
  if (USE_MOCKS.conversations) {
    await delay(60);
    const conv = sharedDataset.conversations.find((c) => c.id === id);
    return conv ? { ...conv } : null;
  }

  const { data: userAuth } = await supabase.auth.getUser();
  const currentUserId = userAuth.user?.id;

  const { data: convRow, error } = await supabase
    .from('conversations')
    .select(`
      id,
      project_id,
      proposal_id,
      client_id,
      designer_id,
      status,
      created_at,
      projects (
        title,
        budget,
        category,
        payment_type
      ),
      client_summaries:client_id (
        display_name,
        city,
        state_region,
        payment_verified
      ),
      conversation_user_settings (
        muted,
        archived,
        last_read_at
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error || !convRow) return null;

  // Fetch messages with attachments
  const { data: msgRows } = await supabase
    .from('messages')
    .select(`
      id,
      sender_id,
      kind,
      system_type,
      body,
      created_at,
      delivered_at,
      flagged,
      message_attachments (
        id,
        path,
        file_name,
        size_bytes,
        mime_type
      )
    `)
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  const clientInfo = Array.isArray(convRow.client_summaries) ? convRow.client_summaries[0] : convRow.client_summaries;
  const projectInfo = Array.isArray(convRow.projects) ? convRow.projects[0] : convRow.projects;
  const settings = Array.isArray(convRow.conversation_user_settings)
    ? convRow.conversation_user_settings[0]
    : convRow.conversation_user_settings;

  const messages: MessageItem[] = (msgRows || []).map((m: any) => ({
    id: m.id,
    conversationId: id,
    senderId: m.sender_id || '',
    senderName: m.sender_id === currentUserId ? 'You' : (clientInfo?.display_name || 'Client'),
    isSelf: m.sender_id === currentUserId,
    text: m.body,
    timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateString: new Date(m.created_at).toLocaleDateString(),
    status: m.delivered_at ? 'Delivered' : 'Sent',
    isSystemMessage: m.kind === 'system',
    attachments: (m.message_attachments || []).map((att: any) => ({
      id: att.id,
      name: att.file_name,
      sizeBytes: att.size_bytes || 1048576,
      type: att.file_name.endsWith('.pdf') ? 'pdf' : att.file_name.endsWith('.dwg') || att.file_name.endsWith('.ifc') ? 'cad' : 'doc',
      url: att.path
    }))
  }));

  return {
    id: convRow.id,
    clientId: convRow.client_id || '',
    clientName: clientInfo?.display_name || 'Client',
    clientLocation: [clientInfo?.city, clientInfo?.state_region].filter(Boolean).join(', ') || 'Nigeria',
    clientAvatarUrl: '',
    projectId: convRow.project_id || '',
    projectTitle: projectInfo?.title || 'Contract Project',
    proposalId: convRow.proposal_id || '',
    proposalStatus: convRow.status === 'active' ? 'accepted' : 'completed',
    isClosed: convRow.status === 'closed',
    isArchived: !!settings?.archived,
    isMuted: !!settings?.muted,
    lastMessageSnippet: messages[messages.length - 1]?.text || 'No messages yet',
    lastMessageTime: messages[messages.length - 1]?.timestamp || '',
    unreadCount: 0,
    hasClientInitiated: true,
    messages
  };
}

/**
 * Mark conversation as read (updates last_read_at receipt)
 */
export async function markConversationAsRead(id: string): Promise<void> {
  if (USE_MOCKS.conversations) {
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
    return;
  }

  await supabase.rpc('mark_read', { p_conversation_id: id });
}

/**
 * Send a message with optional attachments
 */
export async function sendMessage(
  conversationId: string,
  text: string,
  attachments?: ConversationAttachment[]
): Promise<MessageItem> {
  if (USE_MOCKS.conversations) {
    await delay(100);
    const conv = sharedDataset.conversations.find((c) => c.id === conversationId);
    if (!conv) throw new Error('Conversation not found');
    if (conv.isClosed) throw new Error('Cannot send messages to a closed conversation');
    if (!conv.hasClientInitiated) throw new Error('Designers can only reply after a client starts the conversation');

    const message = sharedDataset.sendMessageInMock(conversationId, text, attachments);
    const subs = conversationSubscribers.get(conversationId);
    if (subs) subs.forEach((cb) => cb(message));
    return message;
  }

  const payloadAttachments = (attachments || []).map((att) => ({
    path: att.url || `/mock-uploads/${att.name}`,
    file_name: att.name,
    size_bytes: 1048576, // 1MB mock size
    mime_type: 'application/octet-stream'
  }));

  const { data: msgId, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: text,
    p_attachments: payloadAttachments as any
  });

  if (error) {
    const hint = (error as any).hint;
    if (hint === 'rate_limited') throw new Error('Message rate limit exceeded (max 20 messages per minute).');
    if (hint === 'waiting_for_client') throw new Error('Designers can only reply after the client has sent a message.');
    if (hint === 'conversation_closed') throw new Error('This conversation is closed and read-only.');
    throw new Error(error.message);
  }

  const { data: userAuth } = await supabase.auth.getUser();

  const newMsg: MessageItem = {
    id: msgId as string,
    conversationId,
    senderId: userAuth.user?.id || '',
    senderName: 'You',
    isSelf: true,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateString: new Date().toLocaleDateString(),
    status: 'Sent',
    isSystemMessage: false,
    attachments: attachments || []
  };

  return newMsg;
}

/**
 * Mute / Unmute conversation
 */
export async function muteConversation(conversationId: string, isMuted: boolean): Promise<boolean> {
  if (USE_MOCKS.conversations) {
    await delay(50);
    const conv = sharedDataset.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.isMuted = isMuted;
      return true;
    }
    return false;
  }

  const { error } = await supabase.rpc('set_conversation_flags', {
    p_conversation_id: conversationId,
    p_muted: isMuted
  });
  return !error;
}

/**
 * Archive / Unarchive conversation
 */
export async function archiveConversation(conversationId: string, isArchived: boolean): Promise<boolean> {
  if (USE_MOCKS.conversations) {
    await delay(50);
    const conv = sharedDataset.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.isArchived = isArchived;
      return true;
    }
    return false;
  }

  const { error } = await supabase.rpc('set_conversation_flags', {
    p_conversation_id: conversationId,
    p_archived: isArchived
  });
  return !error;
}

/**
 * Report conversation for policy violations
 */
export async function reportConversation(payload: ReportConversationPayload): Promise<boolean> {
  if (USE_MOCKS.conversations) {
    await delay(150);
    console.info('[Dezignet Trust & Safety] Conversation reported:', payload);
    return true;
  }

  const { error } = await supabase.rpc('report_conversation', {
    p_conversation_id: payload.conversationId,
    p_reason: payload.reason,
    p_details: payload.details
  });
  return !error;
}

/**
 * Subscribe to realtime incoming messages for a conversation
 */
export function subscribeToConversation(
  conversationId: string,
  callback: (message: MessageItem) => void
): () => void {
  if (USE_MOCKS.conversations) {
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

  // Realtime Supabase Channel
  const channelName = `conversation:${conversationId}`;
  let channel = activeRealtimeChannels.get(channelName);

  if (!channel) {
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload: any) => {
          const row = payload.new;
          const { data: userAuth } = await supabase.auth.getUser();
          const isSelf = row.sender_id === userAuth.user?.id;

          const msg: MessageItem = {
            id: row.id,
            conversationId: row.conversation_id,
            senderId: row.sender_id || '',
            senderName: isSelf ? 'You' : 'Client',
            isSelf,
            text: row.body,
            timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            dateString: new Date(row.created_at).toLocaleDateString(),
            status: row.delivered_at ? 'Delivered' : 'Sent',
            isSystemMessage: row.kind === 'system',
            attachments: []
          };

          callback(msg);
        }
      )
      .subscribe();

    activeRealtimeChannels.set(channelName, channel);
  }

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
      activeRealtimeChannels.delete(channelName);
    }
  };
}

/**
 * Simulate client message (dev only)
 */
export async function simulateIncomingClientMessage(
  conversationId: string,
  customText?: string
): Promise<MessageItem> {
  if (USE_MOCKS.conversations) {
    await delay(120);
    const msg = sharedDataset.simulateClientMessage(conversationId, customText);
    const subs = conversationSubscribers.get(conversationId);
    if (subs) subs.forEach((cb) => cb(msg));
    return msg;
  }

  // Find conversation
  const { data: conv } = await supabase
    .from('conversations')
    .select('client_id')
    .eq('id', conversationId)
    .single();

  const text = customText || 'Reviewing your latest drawings now. Looks great!';

  // In real Supabase dev mode, execute message insert via RPC or mock simulation
  const msg: MessageItem = {
    id: 'sim-' + Date.now(),
    conversationId,
    senderId: conv?.client_id || '',
    senderName: 'Client',
    isSelf: false,
    text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateString: new Date().toLocaleDateString(),
    status: 'Delivered',
    isSystemMessage: false,
    attachments: []
  };

  const subs = conversationSubscribers.get(conversationId);
  if (subs) subs.forEach((cb) => cb(msg));

  return msg;
}

/**
 * Get total unread messages count
 */
export function getUnreadMessagesCount(): number {
  if (USE_MOCKS.conversations) {
    return sharedDataset.conversations.reduce((sum, c) => sum + (c.isArchived ? 0 : c.unreadCount), 0);
  }
  return 0;
}
