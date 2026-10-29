/**
 * Notification Types Configuration for Dezignet
 * Single source of truth config map for all notification types.
 * Adding a notification type only requires a single config entry here.
 */

export type NotificationCategory = 'proposals' | 'projects' | 'payments' | 'messages' | 'system';

export type NotificationTypeKey =
  | 'proposal_viewed'
  | 'proposal_shortlisted'
  | 'proposal_accepted'
  | 'proposal_declined'
  | 'milestone_funded'
  | 'deliverable_approved'
  | 'revision_requested'
  | 'payment_released'
  | 'withdrawal_paid'
  | 'withdrawal_failed'
  | 'message_received'
  | 'credential_verified'
  | 'credential_rejected'
  | 'plan_renewal'
  | 'system_announcement';

export interface NotificationPayload {
  proposalId?: string;
  projectId?: string;
  transactionId?: string;
  conversationId?: string;
  amount?: number;
  clientName?: string;
  projectTitle?: string;
  milestoneTitle?: string;
  url?: string;
  [key: string]: any;
}

export interface NotificationConfigItem {
  type: NotificationTypeKey;
  label: string;
  category: NotificationCategory;
  iconSvg: string;
  getDestination: (payload?: NotificationPayload) => string;
}

export const NOTIFICATION_TYPES: Record<NotificationTypeKey, NotificationConfigItem> = {
  // 1. Proposals
  proposal_viewed: {
    type: 'proposal_viewed',
    label: 'Proposal Viewed',
    category: 'proposals',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    getDestination: (payload) => payload?.proposalId ? `#my-work/proposals/${payload.proposalId}` : '#my-work/proposals'
  },
  proposal_shortlisted: {
    type: 'proposal_shortlisted',
    label: 'Proposal Shortlisted',
    category: 'proposals',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    getDestination: (payload) => payload?.proposalId ? `#my-work/proposals/${payload.proposalId}` : '#my-work/proposals'
  },
  proposal_accepted: {
    type: 'proposal_accepted',
    label: 'Proposal Accepted',
    category: 'proposals',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    getDestination: (payload) => payload?.proposalId ? `#my-work/proposals/${payload.proposalId}` : '#my-work/proposals'
  },
  proposal_declined: {
    type: 'proposal_declined',
    label: 'Proposal Declined',
    category: 'proposals',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    getDestination: (payload) => payload?.proposalId ? `#my-work/proposals/${payload.proposalId}` : '#my-work/proposals'
  },

  // 2. Projects
  milestone_funded: {
    type: 'milestone_funded',
    label: 'Milestone Funded',
    category: 'projects',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
    getDestination: (payload) => payload?.projectId ? `#my-work/projects/${payload.projectId}` : '#my-work/projects'
  },
  deliverable_approved: {
    type: 'deliverable_approved',
    label: 'Deliverable Approved',
    category: 'projects',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
    getDestination: (payload) => payload?.projectId ? `#my-work/projects/${payload.projectId}` : '#my-work/projects'
  },
  revision_requested: {
    type: 'revision_requested',
    label: 'Revision Requested',
    category: 'projects',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
    getDestination: (payload) => payload?.projectId ? `#my-work/projects/${payload.projectId}` : '#my-work/projects'
  },

  // 3. Payments
  payment_released: {
    type: 'payment_released',
    label: 'Payment Released',
    category: 'payments',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    getDestination: (payload) => payload?.transactionId ? `#payments/transactions?id=${payload.transactionId}` : '#payments/transactions'
  },
  withdrawal_paid: {
    type: 'withdrawal_paid',
    label: 'Withdrawal Paid',
    category: 'payments',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
    getDestination: () => '#payments/payouts'
  },
  withdrawal_failed: {
    type: 'withdrawal_failed',
    label: 'Withdrawal Failed',
    category: 'payments',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    getDestination: () => '#payments/payouts'
  },

  // 4. Messages
  message_received: {
    type: 'message_received',
    label: 'New Message',
    category: 'messages',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    getDestination: (payload) => payload?.conversationId ? `#conversations/${payload.conversationId}` : '#conversations'
  },

  // 5. System
  credential_verified: {
    type: 'credential_verified',
    label: 'Credential Verified',
    category: 'system',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    getDestination: () => '#settings/credentials'
  },
  credential_rejected: {
    type: 'credential_rejected',
    label: 'Credential Action Needed',
    category: 'system',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    getDestination: () => '#settings/credentials'
  },
  plan_renewal: {
    type: 'plan_renewal',
    label: 'Plan Renewal',
    category: 'system',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>`,
    getDestination: () => '#payments/plan'
  },
  system_announcement: {
    type: 'system_announcement',
    label: 'System Notice',
    category: 'system',
    iconSvg: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    getDestination: () => '#settings/account'
  }
};
