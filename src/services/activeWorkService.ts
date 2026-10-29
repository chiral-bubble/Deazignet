/**
 * Active Work Service Layer for Dezignet (Phase 3)
 * Handles client-designer engagements, milestone execution, deliverables, time tracking,
 * invoices, disputes, and support tickets via Supabase RPC functions with mock fallback.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import { sharedDataset } from '../mocks/dataset';
import type {
  EngagementStatus,
  MilestoneStatus,
  PayoutStatus,
  TicketType
} from '../types/database.types';

export interface EngagementDetail {
  id: string;
  projectId: string;
  proposalId: string;
  clientId: string;
  designerId: string;
  paymentType: 'milestone' | 'hourly';
  totalPrice: number;
  currency: string;
  platformFeePercent: number;
  hourlyRate: number | null;
  weeklyHoursCap: number | null;
  status: EngagementStatus;
  termsSnapshot: any;
  startedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  milestones?: EngagementMilestoneItem[];
}

export interface EngagementMilestoneItem {
  id: string;
  engagementId: string;
  sortOrder: number;
  name: string;
  description: string | null;
  deliverables: string[];
  billingTrigger: string | null;
  feePercent: number;
  amount: number;
  dueDate: string | null;
  status: MilestoneStatus;
  payoutStatus: PayoutStatus;
  fundedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  releasedAt: string | null;
  revisionCount: number;
}

export interface DeliverableFilePayload {
  path: string;
  file_name: string;
  size_bytes: number;
  mime_type?: string;
}

/**
 * Accept a proposal and initialize the engagement.
 */
export async function acceptProposal(proposalId: string): Promise<string> {
  if (USE_MOCKS.active_work) {
    const prop = sharedDataset.proposals.find((p) => p.id === proposalId);
    if (prop) prop.status = 'accepted';
    return 'mock-engagement-' + proposalId;
  }

  const { data, error } = await supabase.rpc('accept_proposal', {
    p_proposal_id: proposalId
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Dev-only helper: fund a milestone (admin only in non-production).
 */
export async function devFundMilestone(milestoneId: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('dev_fund_milestone', {
    p_milestone_id: milestoneId
  });

  if (error) throw new Error(error.message);
}

/**
 * Dev-only helper: release approved milestone funds (admin only in non-production).
 */
export async function devReleaseMilestone(milestoneId: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('dev_release_milestone', {
    p_milestone_id: milestoneId
  });

  if (error) throw new Error(error.message);
}

/**
 * Designer starts working on a funded milestone.
 */
export async function startMilestone(milestoneId: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('start_milestone', {
    p_milestone_id: milestoneId
  });

  if (error) throw new Error(error.message);
}

/**
 * Designer submits deliverables for milestone review.
 */
export async function submitMilestone(
  milestoneId: string,
  notes: string,
  files: DeliverableFilePayload[] = []
): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-sub-' + Date.now();
  }

  const { data, error } = await supabase.rpc('submit_milestone', {
    p_milestone_id: milestoneId,
    p_notes: notes,
    p_files: files as any
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Add a comment / message to a milestone discussion thread.
 */
export async function addMilestoneComment(
  milestoneId: string,
  submissionId: string | null,
  body: string
): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-comment-' + Date.now();
  }

  const { data, error } = await supabase.rpc('add_milestone_comment', {
    p_milestone_id: milestoneId,
    p_submission_id: submissionId,
    p_body: body
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Client approves milestone deliverables.
 */
export async function approveMilestone(milestoneId: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('approve_milestone', {
    p_milestone_id: milestoneId
  });

  if (error) throw new Error(error.message);
}

/**
 * Client requests revisions on milestone deliverables.
 */
export async function requestRevision(milestoneId: string, reason: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('request_revision', {
    p_milestone_id: milestoneId,
    p_reason: reason
  });

  if (error) throw new Error(error.message);
}

/**
 * Log hourly work session (designer only).
 */
export async function logTime(
  engagementId: string,
  workDate: string,
  hours: number,
  description: string
): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-entry-' + Date.now();
  }

  const { data, error } = await supabase.rpc('log_time', {
    p_engagement_id: engagementId,
    p_work_date: workDate,
    p_hours: hours,
    p_description: description
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Submit all draft hours for a weekly invoice.
 */
export async function submitWeek(engagementId: string, weekStart: string): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-inv-' + Date.now();
  }

  const { data, error } = await supabase.rpc('submit_week', {
    p_engagement_id: engagementId,
    p_week_start: weekStart
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Client approves weekly invoice.
 */
export async function approveWeek(invoiceId: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('approve_week', {
    p_invoice_id: invoiceId
  });

  if (error) throw new Error(error.message);
}

/**
 * Client disputes weekly invoice.
 */
export async function disputeWeek(invoiceId: string, note: string): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-dispute-' + Date.now();
  }

  const { data, error } = await supabase.rpc('dispute_week', {
    p_invoice_id: invoiceId,
    p_note: note
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Mark engagement completed once all conditions are met.
 */
export async function completeEngagement(engagementId: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('complete_engagement', {
    p_engagement_id: engagementId
  });

  if (error) throw new Error(error.message);
}

/**
 * Raise a formal dispute for milestone or engagement.
 */
export async function raiseDispute(
  engagementId: string,
  milestoneId: string | null,
  reason: string,
  details: string
): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-dispute-' + Date.now();
  }

  const { data, error } = await supabase.rpc('raise_dispute', {
    p_engagement_id: engagementId,
    p_milestone_id: milestoneId,
    p_reason: reason,
    p_details: details
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Cancel an engagement (prior to funded milestones).
 */
export async function cancelEngagement(engagementId: string, reason: string): Promise<void> {
  if (USE_MOCKS.active_work) {
    return;
  }

  const { error } = await supabase.rpc('cancel_engagement', {
    p_engagement_id: engagementId,
    p_reason: reason
  });

  if (error) throw new Error(error.message);
}

/**
 * Create a support ticket (Help or Problem).
 */
export async function createSupportTicket(
  engagementId: string | null,
  type: TicketType,
  subject: string,
  details: string
): Promise<string> {
  if (USE_MOCKS.active_work) {
    return 'mock-ticket-' + Date.now();
  }

  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_engagement_id: engagementId,
    p_type: type,
    p_subject: subject,
    p_details: details
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Fetch full engagement details including milestones.
 */
export async function getEngagement(engagementId: string): Promise<EngagementDetail | null> {
  if (USE_MOCKS.active_work) {
    return null;
  }

  const { data: eng, error: engErr } = await supabase
    .from('engagements')
    .select('*')
    .eq('id', engagementId)
    .maybeSingle();

  if (engErr || !eng) return null;

  const { data: msList } = await supabase
    .from('engagement_milestones')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('sort_order', { ascending: true });

  return {
    id: eng.id,
    projectId: eng.project_id,
    proposalId: eng.proposal_id,
    clientId: eng.client_id,
    designerId: eng.designer_id,
    paymentType: eng.payment_type as any,
    totalPrice: Number(eng.total_price),
    currency: eng.currency,
    platformFeePercent: Number(eng.platform_fee_percent),
    hourlyRate: eng.hourly_rate ? Number(eng.hourly_rate) : null,
    weeklyHoursCap: eng.weekly_hours_cap ? Number(eng.weekly_hours_cap) : null,
    status: eng.status,
    termsSnapshot: eng.terms_snapshot,
    startedAt: eng.started_at,
    completedAt: eng.completed_at,
    cancelledAt: eng.cancelled_at,
    milestones: (msList || []).map((m) => ({
      id: m.id,
      engagementId: m.engagement_id,
      sortOrder: m.sort_order,
      name: m.name,
      description: m.description,
      deliverables: m.deliverables || [],
      billingTrigger: m.billing_trigger,
      feePercent: Number(m.fee_percent),
      amount: Number(m.amount),
      dueDate: m.due_date,
      status: m.status,
      payoutStatus: m.payout_status,
      fundedAt: m.funded_at,
      startedAt: m.started_at,
      submittedAt: m.submitted_at,
      approvedAt: m.approved_at,
      releasedAt: m.released_at,
      revisionCount: m.revision_count
    }))
  };
}

/**
 * Fetch engagement events timeline / activity log.
 */
export async function getActivity(engagementId: string) {
  if (USE_MOCKS.active_work) {
    return [];
  }

  const { data, error } = await supabase
    .from('engagement_events')
    .select('*')
    .eq('engagement_id', engagementId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Fetch submissions and attached files for a milestone.
 */
export async function getMilestoneVersions(milestoneId: string) {
  if (USE_MOCKS.active_work) {
    return [];
  }

  const { data: subs, error } = await supabase
    .from('milestone_submissions')
    .select('*, submission_files(*)')
    .eq('milestone_id', milestoneId)
    .order('version', { ascending: false });

  if (error) throw new Error(error.message);
  return subs || [];
}
