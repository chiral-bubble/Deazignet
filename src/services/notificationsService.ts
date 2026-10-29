/**
 * Notifications Service for Dezignet
 * Centralized service for notifications fetching, marking read/unread, deletion with undo,
 * subscription to live events, and preference filtering.
 */

import {
  NOTIFICATION_TYPES,
  type NotificationTypeKey,
  type NotificationCategory,
  type NotificationPayload
} from '../config/notificationTypes';
import { getProfile } from './designerProfileService';
import { supabase, USE_MOCKS } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  type: NotificationTypeKey;
  title: string;
  detail: string;
  timestamp: string; // ISO or relative
  dateGroup: 'Today' | 'Yesterday' | 'This week' | 'Earlier';
  isUnread: boolean;
  payload?: NotificationPayload;
  destinationUrl: string;
  deletedAt?: number;
}

// Initial mock dataset for notifications covering all categories and date ranges
let notificationsStore: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'message_received',
    title: 'New message from Dr. Julian Sterling',
    detail: '"The cantilevers over the terrace are looking stunning. Could we verify the wind load calcs?"',
    timestamp: '15 minutes ago',
    dateGroup: 'Today',
    isUnread: true,
    payload: { conversationId: 'conv-1', clientName: 'Dr. Julian Sterling' },
    destinationUrl: '#conversations/conv-1'
  },
  {
    id: 'notif-2',
    type: 'proposal_shortlisted',
    title: 'Proposal shortlisted by Vance Kinetic Capital',
    detail: 'Your architectural proposal for Fintech Headquarters Workspace Architecture was moved to final selection.',
    timestamp: '2 hours ago',
    dateGroup: 'Today',
    isUnread: true,
    payload: { proposalId: 'prop-2', projectTitle: 'Fintech Headquarters Workspace Architecture' },
    destinationUrl: '#my-work/proposals/prop-2'
  },
  {
    id: 'notif-3',
    type: 'payment_released',
    title: 'Milestone payment released: $12,500.00',
    detail: 'Funds for Phase 2: Detailed Architectural Drawings have cleared and are available to withdraw.',
    timestamp: 'Yesterday at 3:45 PM',
    dateGroup: 'Yesterday',
    isUnread: true,
    payload: { transactionId: 'tx-1', amount: 12500 },
    destinationUrl: '#payments/transactions?id=tx-1'
  },
  {
    id: 'notif-4',
    type: 'deliverable_approved',
    title: 'Deliverable approved: Alpine Hotel Hydrothermal Spa',
    detail: 'Alpine Heritage Group approved Phase 1 schematics with zero revisions.',
    timestamp: 'Yesterday at 11:15 AM',
    dateGroup: 'Yesterday',
    isUnread: false,
    payload: { projectId: 'proj-lake-zurich-spa' },
    destinationUrl: '#my-work/projects/proj-lake-zurich-spa'
  },
  {
    id: 'notif-5',
    type: 'proposal_viewed',
    title: 'Proposal viewed by Ambassador David Lindqvist',
    detail: 'Client reviewed your proposal and portfolio for Geneva Diplomatic Executive Lounge.',
    timestamp: '3 days ago',
    dateGroup: 'This week',
    isUnread: false,
    payload: { proposalId: 'prop-3' },
    destinationUrl: '#my-work/proposals/prop-3'
  },
  {
    id: 'notif-6',
    type: 'milestone_funded',
    title: 'Milestone deposit funded into escrow: $18,500.00',
    detail: 'Katherine Sterling funded Phase 2 for Modern Cantilevered Residence.',
    timestamp: '4 days ago',
    dateGroup: 'This week',
    isUnread: false,
    payload: { projectId: 'proj-palisades-residence', amount: 18500 },
    destinationUrl: '#my-work/projects/proj-palisades-residence'
  },
  {
    id: 'notif-7',
    type: 'credential_verified',
    title: 'AIA license credentials verified',
    detail: 'Your American Institute of Architects registration (F-2491) was officially validated.',
    timestamp: '6 days ago',
    dateGroup: 'This week',
    isUnread: false,
    payload: {},
    destinationUrl: '#settings/credentials'
  },
  {
    id: 'notif-8',
    type: 'withdrawal_paid',
    title: 'Direct wire withdrawal completed: $10,000.00',
    detail: 'Settled to JPMorgan Chase Bank (••••4821).',
    timestamp: '2 weeks ago',
    dateGroup: 'Earlier',
    isUnread: false,
    payload: { transactionId: 'tx-4', amount: 10000 },
    destinationUrl: '#payments/payouts'
  },
  {
    id: 'notif-9',
    type: 'system_announcement',
    title: 'Dezignet 2026 Winter Architectural Index is live',
    detail: 'See updated studio market averages for residential and commercial BIM rates.',
    timestamp: '3 weeks ago',
    dateGroup: 'Earlier',
    isUnread: false,
    payload: {},
    destinationUrl: '#settings/account'
  }
];

// Recently deleted notifications stack for undo
const recentlyDeletedStack: { item: NotificationItem; index: number }[] = [];

// Subscriptions for real-time updates
const listeners: ((notification: NotificationItem) => void)[] = [];

/**
 * Filter notifications against designer in-app preferences
 */
async function filterByInAppPreferences(list: NotificationItem[]): Promise<NotificationItem[]> {
  try {
    const prof = await getProfile();
    const prefs = prof.notifications?.inApp || {
      newMessage: true,
      proposalViewed: true,
      proposalShortlisted: true,
      proposalAccepted: true,
      milestoneApproved: true,
      paymentReleased: true,
      platformNews: true
    };

    return list.filter((n) => {
      if (n.type === 'message_received' && !prefs.newMessage) return false;
      if (n.type === 'proposal_viewed' && !prefs.proposalViewed) return false;
      if (n.type === 'proposal_shortlisted' && !prefs.proposalShortlisted) return false;
      if (n.type === 'proposal_accepted' && !prefs.proposalAccepted) return false;
      if (n.type === 'deliverable_approved' && !prefs.milestoneApproved) return false;
      if (n.type === 'payment_released' && !prefs.paymentReleased) return false;
      if (n.type === 'system_announcement' && !prefs.platformNews) return false;
      return true;
    });
  } catch {
    return list;
  }
}

export interface GetNotificationsResult {
  notifications: NotificationItem[];
  totalCount: number;
  unreadCount: number;
  hasMore: boolean;
  nextCursor?: number;
}

/**
 * Retrieve notifications with filters, cursor pagination, and tab states.
 */
export async function getNotifications(
  options: {
    tab?: 'all' | 'unread';
    typeCategory?: NotificationCategory | 'all';
    cursor?: number;
    limit?: number;
  } = {}
): Promise<GetNotificationsResult> {
  const { tab = 'all', typeCategory = 'all', cursor = 0, limit = 20 } = options;

  if (!USE_MOCKS.notifications) {
    const { data: userAuth } = await supabase.auth.getUser();
    const currentUserId = userAuth.user?.id;
    if (!currentUserId) {
      return { notifications: [], totalCount: 0, unreadCount: 0, hasMore: false };
    }

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (tab === 'unread') {
      query = query.is('read_at', null);
    }

    const { data: rows, count } = await query.range(cursor, cursor + limit - 1);

    const items: NotificationItem[] = (rows || []).map((row: any) => {
      const cfg = NOTIFICATION_TYPES[row.type as NotificationTypeKey];
      const payload = row.data || {};
      const destination = cfg ? cfg.getDestination(payload) : '#notifications';

      const createdDate = new Date(row.created_at);
      const now = new Date();
      const diffHours = (now.getTime() - createdDate.getTime()) / 3600000;
      let dateGroup: 'Today' | 'Yesterday' | 'This week' | 'Earlier' = 'Earlier';
      if (diffHours < 24) dateGroup = 'Today';
      else if (diffHours < 48) dateGroup = 'Yesterday';
      else if (diffHours < 168) dateGroup = 'This week';

      return {
        id: row.id,
        type: row.type as NotificationTypeKey,
        title: row.title,
        detail: row.body,
        timestamp: createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateGroup,
        isUnread: row.read_at === null,
        payload,
        destinationUrl: destination
      };
    });

    let filtered = items;
    if (typeCategory && typeCategory !== 'all') {
      filtered = filtered.filter((n) => {
        const cfg = NOTIFICATION_TYPES[n.type];
        return cfg && cfg.category === typeCategory;
      });
    }

    const totalCount = count || filtered.length;
    const unreadCount = filtered.filter((n) => n.isUnread).length;

    return {
      notifications: filtered,
      totalCount,
      unreadCount,
      hasMore: cursor + limit < totalCount,
      nextCursor: cursor + limit < totalCount ? cursor + limit : undefined
    };
  }

  await new Promise((r) => setTimeout(r, 60)); // Small simulated API latency

  // Only non-deleted notifications
  let active = notificationsStore.filter((n) => !n.deletedAt);

  // Apply in-app preferences
  active = await filterByInAppPreferences(active);

  const unreadTotal = active.filter((n) => n.isUnread).length;

  if (tab === 'unread') {
    active = active.filter((n) => n.isUnread);
  }

  if (typeCategory && typeCategory !== 'all') {
    active = active.filter((n) => {
      const cfg = NOTIFICATION_TYPES[n.type];
      return cfg && cfg.category === typeCategory;
    });
  }

  const paginated = active.slice(cursor, cursor + limit);
  const hasMore = cursor + limit < active.length;

  return {
    notifications: paginated,
    totalCount: active.length,
    unreadCount: unreadTotal,
    hasMore,
    nextCursor: hasMore ? cursor + limit : undefined
  };
}

/**
 * Get total unread count (formatted as "9+" if > 9)
 */
export function getUnreadNotificationsCount(): { count: number; display: string } {
  const active = notificationsStore.filter((n) => !n.deletedAt && n.isUnread);
  const count = active.length;
  return {
    count,
    display: count > 9 ? '9+' : String(count)
  };
}

/**
 * Mark a specific notification as read or unread
 */
export async function markAsRead(id: string, isRead = true): Promise<void> {
  if (!USE_MOCKS.notifications) {
    await supabase.rpc('mark_notification_read', { p_id: id, p_read: isRead });
    return;
  }
  const item = notificationsStore.find((n) => n.id === id);
  if (item) {
    item.isUnread = !isRead;
  }
}

/**
 * Mark all active notifications as read
 */
export async function markAllAsRead(): Promise<void> {
  if (!USE_MOCKS.notifications) {
    await supabase.rpc('mark_all_notifications_read');
    return;
  }
  notificationsStore.forEach((n) => {
    if (!n.deletedAt) n.isUnread = false;
  });
}

/**
 * Delete a notification with undo support
 */
export async function deleteNotification(id: string): Promise<boolean> {
  if (!USE_MOCKS.notifications) {
    const { error } = await supabase.rpc('delete_notification', { p_id: id });
    return !error;
  }
  const idx = notificationsStore.findIndex((n) => n.id === id);
  if (idx !== -1) {
    const item = notificationsStore[idx];
    item.deletedAt = Date.now();
    recentlyDeletedStack.push({ item, index: idx });
    return true;
  }
  return false;
}

/**
 * Undo recent deletion
 */
export async function undoDeleteNotification(id?: string): Promise<NotificationItem | null> {
  if (!USE_MOCKS.notifications && id) {
    const { error } = await supabase.rpc('undo_delete_notification', { p_id: id });
    if (!error) {
      return { id } as any;
    }
    return null;
  }
  const entry = id
    ? recentlyDeletedStack.find((e) => e.item.id === id)
    : recentlyDeletedStack.pop();

  if (entry) {
    entry.item.deletedAt = undefined;
    return entry.item;
  }
  return null;
}

/**
 * Bulk actions: mark selected IDs as read/unread or delete
 */
export async function bulkUpdateNotifications(
  ids: string[],
  action: 'read' | 'unread' | 'delete'
): Promise<void> {
  for (const id of ids) {
    if (action === 'read') await markAsRead(id, true);
    else if (action === 'unread') await markAsRead(id, false);
    else if (action === 'delete') await deleteNotification(id);
  }
}

/**
 * Subscribe to new notification pushes (simulated in dev)
 */
export function subscribeToNotifications(cb: (n: NotificationItem) => void): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

/**
 * Dev Tool: Simulate receiving any of the 15 notification types
 */
export function simulateNotification(typeKey: NotificationTypeKey): NotificationItem {
  const cfg = NOTIFICATION_TYPES[typeKey];
  if (!cfg) throw new Error(`Unknown type ${typeKey}`);

  const templates: Record<NotificationTypeKey, { title: string; detail: string; payload: NotificationPayload }> = {
    proposal_viewed: {
      title: 'Proposal viewed by Vance Kinetic Capital',
      detail: 'Client opened your proposal for Fintech Headquarters Workspace Architecture.',
      payload: { proposalId: 'prop-2', projectTitle: 'Fintech Headquarters Workspace Architecture' }
    },
    proposal_shortlisted: {
      title: 'Proposal shortlisted by Vance Kinetic Capital',
      detail: 'Your architectural proposal has been shortlisted for final review.',
      payload: { proposalId: 'prop-2', projectTitle: 'Fintech Headquarters Workspace Architecture' }
    },
    proposal_accepted: {
      title: 'Proposal accepted: Dr. Julian Sterling',
      detail: 'Your commission contract for Modern Cantilevered Residence is approved and ready for deposit.',
      payload: { proposalId: 'prop-1', projectTitle: 'Modern Cantilevered Residence, Zurich' }
    },
    proposal_declined: {
      title: 'Proposal declined by Pacific Maritime Partners',
      detail: 'The client opted for an alternate studio proposal.',
      payload: { proposalId: 'prop-4' }
    },
    milestone_funded: {
      title: 'Milestone funded: $15,000.00',
      detail: 'Alpine Heritage Group placed Milestone 2 funds into escrow.',
      payload: { projectId: 'proj-lake-zurich-spa', amount: 15000 }
    },
    deliverable_approved: {
      title: 'Deliverable approved: Alpine Heritage Group',
      detail: 'Schematic drawings approved without changes.',
      payload: { projectId: 'proj-lake-zurich-spa' }
    },
    revision_requested: {
      title: 'Revision requested: Katherine Sterling',
      detail: 'Client requested modifications to cantilever soffit details.',
      payload: { projectId: 'proj-palisades-residence' }
    },
    payment_released: {
      title: 'Payment released: $14,625.00 cleared',
      detail: 'Funds for Milestone 1 are now available for bank withdrawal.',
      payload: { transactionId: 'tx-3', amount: 14625 }
    },
    withdrawal_paid: {
      title: 'Direct wire withdrawal settled: $10,000.00',
      detail: 'Fedwire transfer completed to JPMorgan Chase Bank (••••4821).',
      payload: { transactionId: 'tx-4', amount: 10000 }
    },
    withdrawal_failed: {
      title: 'Withdrawal failed: Bank information mismatch',
      detail: 'Please review your routing numbers in Payments Payouts.',
      payload: {}
    },
    message_received: {
      title: 'New message from Sophia Montgomery',
      detail: '"Could you share the acoustic test certification for the 3rd floor timber partitions?"',
      payload: { conversationId: 'conv-3', clientName: 'Sophia Montgomery' }
    },
    credential_verified: {
      title: 'AIA license credentials verified',
      detail: 'Your American Institute of Architects registration status is active and verified.',
      payload: {}
    },
    credential_rejected: {
      title: 'Credential verification requires attention',
      detail: 'Certificate scan could not be verified automatically. Please upload a clear PDF.',
      payload: {}
    },
    plan_renewal: {
      title: 'Dezignet Upgraded subscription renewed',
      detail: 'Annual billing of $479.90 was processed on Visa ••••4242.',
      payload: {}
    },
    system_announcement: {
      title: 'Platform Update: High-resolution CAD 3D previewer launched',
      detail: 'Clients can now view interactive 3D model deliverables directly in Dezignet.',
      payload: {}
    }
  };

  const tpl = templates[typeKey];
  const newNotif: NotificationItem = {
    id: `notif-${Date.now()}`,
    type: typeKey,
    title: tpl.title,
    detail: tpl.detail,
    timestamp: 'Just now',
    dateGroup: 'Today',
    isUnread: true,
    payload: tpl.payload,
    destinationUrl: cfg.getDestination(tpl.payload)
  };

  notificationsStore.unshift(newNotif);

  // Notify listeners
  listeners.forEach((fn) => {
    try {
      fn(newNotif);
    } catch {
      // ignore
    }
  });

  return newNotif;
}
