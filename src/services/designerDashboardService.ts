/**
 * Designer Dashboard Mock Service Layer for Dezignet
 * Clean service abstraction with functions that can be swapped for real API calls later.
 * 
 * Provides:
 * - getDesignerSummary()
 * - getActiveProjects(filter?)
 * - getNotifications()
 * - getPayments()
 * - getUpcomingDeadlines()
 * - getRecentProposals()
 * - getProfileCompleteness()
 * - markAllNotificationsAsRead()
 * - uploadDeliverable(projectId, deliverableTitle)
 * - requestMilestoneReview(projectId)
 * - logHourlyTime(projectId, hours)
 * - withdrawFunds(amount)
 * - switchMockState(state)
 * - getMockState()
 */

export type MockStateKey = 'full' | 'incomplete' | 'empty';

export interface DesignerSummary {
  activeProjectsCount: number;
  milestonesDueThisWeek: number;
  proposalsPendingCount: number;
  proposalsViewedCount: number;
  inEscrowAmount: number;
  totalEarnedAmount: number;
}

export interface ActiveProject {
  id: string;
  title: string;
  clientName: string;
  clientCompany: string;
  clientLocation: string;
  paymentType: 'Milestone' | 'Hourly';
  status: 'awaiting_deliverable' | 'in_review' | 'approved_released' | 'active_hourly';
  statusLabel: string;
  category: string;
  
  // Milestone specific
  currentMilestoneName?: string;
  completedMilestonesCount?: number;
  totalMilestonesCount?: number;
  nextDeadline?: string;
  relativeDeadline?: string;
  escrowCurrentMilestone?: number;
  isDeliverableDue?: boolean;
  hasUploadedDeliverable?: boolean;
  awaitingReview?: boolean;

  // Hourly specific
  hoursThisWeek?: number;
  hourlyRate?: number;
  unbilledAmount?: number;
  totalHoursLogged?: number;
}

export interface UpcomingDeadline {
  id: string;
  title: string;
  projectTitle: string;
  projectId: string;
  dueDate: string;
  relativeDate: string;
  isOverdue: boolean;
}

export interface DesignerNotification {
  id: string;
  type: 'payment' | 'proposal' | 'milestone' | 'system' | 'message';
  title: string;
  detail: string;
  relativeTime: string;
  isUnread: boolean;
  actionLinkText?: string;
  senderName?: string;
}

export interface DesignerPaymentsSummary {
  availableToWithdraw: number;
  pendingRelease: number;
  totalEarned: number;
  currency: 'USD';
}

export interface RecentProposalItem {
  id: string;
  projectId: string;
  projectTitle: string;
  sentDate: string;
  proposedPrice: number;
  status: 'Pending' | 'Viewed' | 'Shortlisted' | 'Accepted' | 'Declined';
}

export interface ProfileCompleteness {
  isComplete: boolean;
  percentage: number;
  missingItems: string[];
}

// -------------------------------------------------------------
// Realistic Mock Data Sets (Prestigious International Commissions)
// -------------------------------------------------------------

const FULL_NOTIFICATIONS: DesignerNotification[] = [
  {
    id: 'notif-1',
    type: 'payment',
    title: 'Escrow payment released ($15,000)',
    detail: 'Milestone 1 for Modern Cantilevered Residence has been cleared to your available balance.',
    relativeTime: '2 hours ago',
    isUnread: true
  },
  {
    id: 'notif-2',
    type: 'message',
    title: 'New message from Dr. Tariq Al-Mansoor',
    detail: '"Alexandre, could we review the terrace cantilever extension in tomorrow\'s design review?"',
    relativeTime: '4 hours ago',
    isUnread: true,
    actionLinkText: 'Reply',
    senderName: 'Dr. Tariq Al-Mansoor'
  },
  {
    id: 'notif-3',
    type: 'proposal',
    title: 'Proposal shortlisted by Horizon Ventures',
    detail: 'Your architectural proposal for the London Workspace has been moved to final selection.',
    relativeTime: '1 day ago',
    isUnread: true
  },
  {
    id: 'notif-4',
    type: 'milestone',
    title: 'Deliverable approved by Apex Capital Partners',
    detail: 'Modern Cantilevered Residence schematic drawings approved with zero revisions.',
    relativeTime: '2 days ago',
    isUnread: false
  },
  {
    id: 'notif-5',
    type: 'system',
    title: 'Annual Professional Accreditation Verified',
    detail: 'Your studio credential record has been verified with active standing.',
    relativeTime: '3 days ago',
    isUnread: false
  },
  {
    id: 'notif-6',
    type: 'proposal',
    title: 'Client viewed your proposal',
    detail: 'Sophia Montgomery viewed your proposal for Workspace Architecture.',
    relativeTime: '5 days ago',
    isUnread: false
  }
];

// Current State Controller (persistent in localStorage for session consistency)
const MOCK_STATE_STORAGE_KEY = 'dez_designer_dashboard_mock_state';

let currentMockState: MockStateKey = ((): MockStateKey => {
  const saved = localStorage.getItem(MOCK_STATE_STORAGE_KEY);
  if (saved === 'full' || saved === 'incomplete' || saved === 'empty') {
    return saved;
  }
  return 'full';
})();

import { sharedDataset } from '../mocks/dataset';
import { supabase, USE_MOCKS } from '../lib/supabase';

// Working mutable copy of notifications for interactive "mark all as read"
let notificationsState = [...FULL_NOTIFICATIONS];

export function getMockState(): MockStateKey {
  return currentMockState;
}

export function setMockState(state: MockStateKey): void {
  currentMockState = state;
  localStorage.setItem(MOCK_STATE_STORAGE_KEY, state);
  resetStateForMockKey(state);
}

function resetStateForMockKey(state: MockStateKey): void {
  if (state === 'full') {
    notificationsState = [...FULL_NOTIFICATIONS];
    sharedDataset.setMockState('full');
  } else if (state === 'incomplete') {
    notificationsState = FULL_NOTIFICATIONS.slice(0, 3);
    sharedDataset.setMockState('incomplete');
  } else {
    notificationsState = [];
    sharedDataset.setMockState('empty');
  }
}

// -------------------------------------------------------------
// Clean Service Functions
// -------------------------------------------------------------

/**
 * Retrieve high-level summary KPIs for the designer dashboard.
 */
export async function getDesignerSummary(): Promise<DesignerSummary> {
  if (!USE_MOCKS.active_work) {
    try {
      const { data, error } = await supabase.rpc('get_designer_dashboard');
      if (!error && data) {
        const d = data as any;
        return {
          activeProjectsCount: d.activeProjectsCount || 0,
          milestonesDueThisWeek: d.milestonesDueThisWeek || 0,
          proposalsPendingCount: d.proposalsPendingCount || 0,
          proposalsViewedCount: d.proposalsViewedCount || 0,
          inEscrowAmount: Number(d.inEscrowAmount) || 0,
          totalEarnedAmount: Number(d.totalEarnedAmount) || 0
        };
      }
    } catch (err) {
      console.warn('Fallback to mock summary:', err);
    }
  }

  // Simulate network latency ~80ms
  await new Promise((resolve) => setTimeout(resolve, 80));

  if (currentMockState === 'empty') {
    return {
      activeProjectsCount: 0,
      milestonesDueThisWeek: 0,
      proposalsPendingCount: 0,
      proposalsViewedCount: 0,
      inEscrowAmount: 0,
      totalEarnedAmount: 0
    };
  }

  if (currentMockState === 'incomplete') {
    return {
      activeProjectsCount: 1,
      milestonesDueThisWeek: 1,
      proposalsPendingCount: 1,
      proposalsViewedCount: 1,
      inEscrowAmount: sharedDataset.balances.inEscrow,
      totalEarnedAmount: sharedDataset.balances.totalEarned
    };
  }

  const activeProjectsCount = sharedDataset.activeProjects.length;
  const milestonesDueThisWeek = sharedDataset.activeProjects.filter((p) =>
    p.milestones.some((m) => m.status === 'in_review' || m.status === 'funded')
  ).length;
  const proposalsPendingCount = sharedDataset.proposals.filter((p) =>
    p.status === 'pending' || p.status === 'shortlisted' || p.status === 'viewed'
  ).length;
  const proposalsViewedCount = sharedDataset.proposals.filter((p) => p.status === 'viewed').length;

  return {
    activeProjectsCount,
    milestonesDueThisWeek,
    proposalsPendingCount,
    proposalsViewedCount,
    inEscrowAmount: sharedDataset.balances.inEscrow,
    totalEarnedAmount: sharedDataset.balances.totalEarned
  };
}

/**
 * Retrieve active projects list with optional payment type filter.
 */
export async function getActiveProjects(filter: 'all' | 'milestone' | 'hourly' = 'all'): Promise<ActiveProject[]> {
  if (!USE_MOCKS.active_work) {
    try {
      const { data, error } = await supabase.rpc('get_designer_dashboard');
      if (!error && data && Array.isArray((data as any).activeProjects)) {
        let list = (data as any).activeProjects.map((p: any) => ({
          id: p.id,
          title: p.title,
          clientName: 'Client',
          clientCompany: 'Dezignet Client',
          clientLocation: 'Nigeria',
          paymentType: (p.paymentType === 'hourly' ? 'Hourly' : 'Milestone') as any,
          status: 'awaiting_deliverable' as any,
          statusLabel: p.status === 'active' ? 'Active' : p.status,
          category: p.category || 'Architecture',
          currentMilestoneName: p.currentMilestoneName || undefined,
          completedMilestonesCount: p.completedMilestonesCount || 0,
          totalMilestonesCount: p.totalMilestonesCount || 0,
          escrowCurrentMilestone: Number(p.inEscrowAmount) || 0,
          totalBudget: Number(p.totalBudget) || 0,
          inEscrowAmount: Number(p.inEscrowAmount) || 0
        }));
        if (filter === 'milestone') list = list.filter((x: any) => x.paymentType === 'Milestone');
        if (filter === 'hourly') list = list.filter((x: any) => x.paymentType === 'Hourly');
        return list;
      }
    } catch (err) {
      console.warn('Fallback to mock active projects:', err);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 80));

  if (currentMockState === 'empty') {
    return [];
  }

  let projects: ActiveProject[] = sharedDataset.activeProjects.map((p) => {
    const isDeliverableDue = p.isDeliverableDue ?? p.milestones.some((m) => m.status === 'in_review' || m.status === 'funded');
    const awaitingReview = p.awaitingReview ?? p.milestones.some((m) => m.status === 'in_review');
    const currentMs = p.milestones.find((m) => m.status === 'in_review' || m.status === 'funded');

    return {
      id: p.id,
      title: p.title,
      clientName: p.clientName,
      clientCompany: p.clientCompany || '',
      clientLocation: p.clientLocation,
      paymentType: p.paymentType,
      status: p.status,
      statusLabel: p.statusLabel,
      category: p.category,
      currentMilestoneName: p.currentMilestoneName || currentMs?.title,
      completedMilestonesCount: p.completedMilestonesCount || 1,
      totalMilestonesCount: p.totalMilestonesCount || p.milestones.length || 3,
      nextDeadline: p.nextDeadline,
      relativeDeadline: p.relativeDeadline,
      escrowCurrentMilestone: p.escrowCurrentMilestone || currentMs?.amount || 15000,
      isDeliverableDue,
      hasUploadedDeliverable: p.hasUploadedDeliverable || false,
      awaitingReview,
      hoursThisWeek: p.hoursThisWeek,
      hourlyRate: p.hourlyRate,
      unbilledAmount: p.unbilledAmount,
      totalHoursLogged: p.totalHoursLogged
    };
  });

  if (currentMockState === 'incomplete') {
    projects = [projects[0]];
  }

  if (filter === 'milestone') {
    return projects.filter((p) => p.paymentType === 'Milestone');
  }
  if (filter === 'hourly') {
    return projects.filter((p) => p.paymentType === 'Hourly');
  }
  return projects;
}

/**
 * Retrieve notifications list.
 */
export async function getNotifications(): Promise<DesignerNotification[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));

  if (currentMockState === 'empty') {
    return [];
  }
  return [...notificationsState];
}

/**
 * Retrieve payments breakdown.
 */
export async function getPayments(): Promise<DesignerPaymentsSummary> {
  if (!USE_MOCKS.active_work) {
    try {
      const { data, error } = await supabase.rpc('get_designer_dashboard');
      if (!error && data) {
        const d = data as any;
        return {
          availableToWithdraw: Number(d.availableToWithdraw) || 0,
          pendingRelease: Number(d.pendingRelease) || 0,
          totalEarned: Number(d.totalEarnedAmount) || 0,
          currency: 'USD'
        };
      }
    } catch (err) {
      console.warn('Fallback to mock payments:', err);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 80));
  return {
    availableToWithdraw: sharedDataset.balances.availableToWithdraw,
    pendingRelease: sharedDataset.balances.pendingRelease,
    totalEarned: sharedDataset.balances.totalEarned,
    currency: 'USD'
  };
}

/**
 * Retrieve upcoming deadlines sorted by date.
 */
export async function getUpcomingDeadlines(): Promise<UpcomingDeadline[]> {
  if (!USE_MOCKS.active_work) {
    try {
      const { data, error } = await supabase.rpc('get_designer_dashboard');
      if (!error && data && Array.isArray((data as any).upcomingDeadlines)) {
        return (data as any).upcomingDeadlines.map((dl: any) => ({
          id: dl.id,
          title: dl.title,
          projectTitle: dl.projectTitle,
          projectId: dl.projectId,
          dueDate: dl.dueDate,
          relativeDate: dl.isOverdue ? 'Overdue' : 'Upcoming',
          isOverdue: !!dl.isOverdue
        }));
      }
    } catch (err) {
      console.warn('Fallback to mock deadlines:', err);
    }
  }

  await new Promise((resolve) => setTimeout(resolve, 80));

  if (currentMockState === 'empty') {
    return [];
  }

  const deadlines: UpcomingDeadline[] = [];
  sharedDataset.activeProjects.forEach((proj) => {
    if (proj.paymentType === 'Milestone') {
      proj.milestones.forEach((m) => {
        if (m.status === 'in_review' || m.status === 'funded') {
          deadlines.push({
            id: `dl-${m.id}`,
            title: m.title,
            projectTitle: proj.title,
            projectId: proj.id,
            dueDate: m.dueDate,
            relativeDate: m.status === 'in_review' ? 'In client review' : 'Due in 3 days',
            isOverdue: false
          });
        }
      });
    } else if (proj.paymentType === 'Hourly') {
      deadlines.push({
        id: `dl-hourly-${proj.id}`,
        title: 'Weekly Time Log & Activity Submission',
        projectTitle: proj.title,
        projectId: proj.id,
        dueDate: 'Sunday 23:59',
        relativeDate: 'This Sunday',
        isOverdue: false
      });
    }
  });

  if (currentMockState === 'incomplete') {
    return deadlines.slice(0, 1);
  }

  return deadlines;
}

/**
 * Retrieve recent proposals sent by the designer.
 */
export async function getRecentProposals(): Promise<RecentProposalItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 80));

  if (currentMockState === 'empty') {
    return [];
  }

  const slice = currentMockState === 'incomplete' ? sharedDataset.proposals.slice(0, 1) : sharedDataset.proposals.slice(0, 4);

  return slice.map((p) => {
    let statusLabel: 'Pending' | 'Viewed' | 'Shortlisted' | 'Accepted' | 'Declined' = 'Pending';
    if (p.status === 'accepted') statusLabel = 'Accepted';
    else if (p.status === 'viewed') statusLabel = 'Viewed';
    else if (p.status === 'shortlisted') statusLabel = 'Shortlisted';
    else if (p.status === 'declined') statusLabel = 'Declined';
    else statusLabel = 'Pending';

    return {
      id: p.id,
      projectId: p.projectId,
      projectTitle: p.projectTitle,
      sentDate: p.sentDate,
      proposedPrice: p.proposedPrice,
      status: statusLabel
    };
  });
}

/**
 * Check profile completeness status.
 */
export async function getProfileCompleteness(): Promise<ProfileCompleteness> {
  await new Promise((resolve) => setTimeout(resolve, 60));

  if (currentMockState === 'full') {
    return {
      isComplete: true,
      percentage: 100,
      missingItems: []
    };
  }

  if (currentMockState === 'incomplete') {
    return {
      isComplete: false,
      percentage: 65,
      missingItems: [
        'Professional bio (min. 150 words)',
        '2 verified project portfolio case studies',
        'Direct bank payout wiring details'
      ]
    };
  }

  // empty state: brand new designer
  return {
    isComplete: false,
    percentage: 30,
    missingItems: [
      'Registration license number (AIA, RIBA, or SIA)',
      'Primary studio specialization',
      'Curated portfolio attachments',
      'Professional biography'
    ]
  };
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  notificationsState = notificationsState.map((n) => ({ ...n, isUnread: false }));
}

/**
 * Interactive upload deliverable action for active milestone project.
 */
export async function uploadDeliverable(projectId: string, deliverableName: string): Promise<boolean> {
  const project = sharedDataset.activeProjects.find((p) => p.id === projectId || p.projectId === projectId);
  if (project) {
    project.hasUploadedDeliverable = true;
    project.isDeliverableDue = false;
    project.awaitingReview = true;
    project.status = 'in_review';
    project.statusLabel = 'In client review';

    const currentMs = project.milestones.find((m) => m.status === 'funded');
    if (currentMs) {
      currentMs.status = 'in_review';
      currentMs.submittedDeliverableUrl = 'https://dezignet.studio/files/uploaded-deliverable.pdf';
      currentMs.submittedAt = 'Just now';
    }

    notificationsState.unshift({
      id: `notif-${Date.now()}`,
      type: 'milestone',
      title: 'Deliverable submitted for review',
      detail: `"${deliverableName}" submitted for ${project.title}. Client has been notified.`,
      relativeTime: 'Just now',
      isUnread: true
    });
    return true;
  }
  return false;
}

/**
 * Interactive request review action.
 */
export async function requestMilestoneReview(projectId: string): Promise<boolean> {
  const project = sharedDataset.activeProjects.find((p) => p.id === projectId || p.projectId === projectId);
  if (project) {
    notificationsState.unshift({
      id: `notif-${Date.now()}`,
      type: 'system',
      title: 'Review reminder sent',
      detail: `Review reminder sent to ${project.clientName} for ${project.title}.`,
      relativeTime: 'Just now',
      isUnread: true
    });
    return true;
  }
  return false;
}

/**
 * Interactive log hours action.
 */
export async function logHourlyTime(projectId: string, additionalHours: number): Promise<boolean> {
  const project = sharedDataset.activeProjects.find((p) => p.id === projectId || p.projectId === projectId);
  if (project && project.paymentType === 'Hourly') {
    project.hoursThisWeek = (project.hoursThisWeek || 0) + additionalHours;
    project.totalHoursLogged = (project.totalHoursLogged || 0) + additionalHours;
    project.unbilledAmount = (project.hoursThisWeek || 0) * (project.hourlyRate || 140);

    notificationsState.unshift({
      id: `notif-${Date.now()}`,
      type: 'system',
      title: 'Hours logged successfully',
      detail: `${additionalHours} hours added to ${project.title} (${project.hoursThisWeek} hrs this week).`,
      relativeTime: 'Just now',
      isUnread: true
    });
    return true;
  }
  return false;
}

/**
 * Interactive withdraw available balance action.
 */
export async function withdrawFunds(amount: number): Promise<{ success: boolean; message: string }> {
  if (amount <= 0 || amount > sharedDataset.balances.availableToWithdraw) {
    return { success: false, message: 'Invalid withdrawal amount.' };
  }

  const defaultAccount = sharedDataset.payoutAccounts.find((a) => a.isDefault) || sharedDataset.payoutAccounts[0];
  if (defaultAccount) {
    const res = sharedDataset.executeWithdrawal(amount, defaultAccount.id);
    if (!res.success) return { success: false, message: res.error || 'Withdrawal failed.' };
  } else {
    sharedDataset.balances.availableToWithdraw -= amount;
  }

  notificationsState.unshift({
    id: `notif-${Date.now()}`,
    type: 'payment',
    title: `Withdrawal initiated ($${amount.toLocaleString()})`,
    detail: 'Transfer dispatched to linked verified business bank account.',
    relativeTime: 'Just now',
    isUnread: true
  });

  return {
    success: true,
    message: `$${amount.toLocaleString()} has been dispatched to your linked bank account.`
  };
}
