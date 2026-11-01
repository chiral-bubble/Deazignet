/**
 * Client Proposals Service for Dezignet
 * Handles:
 * - Proposal listings on project page with filters and sorting
 * - Full proposal detail retrieval & auto-mark viewed
 * - Multi-proposal side-by-side comparison (2-3 proposals)
 * - Answering designer questions (within 10-minute window)
 * - Shortlisting, declining with structured reason codes
 * - Accepting proposal (creating pending_signature engagement and contract)
 * - Messaging designer from proposal via conversation engine
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import type { DeclineReasonCode, ProposalStatus, ReimbursableExpensesType } from '../types/database.types';

export interface ProposalListItem {
  id: string;
  project_id: string;
  designer_id: string;
  status: ProposalStatus;
  total_price: number;
  currency: string;
  delivery_days: number;
  included_revisions_per_phase: number;
  sent_at: string;
  viewed_at: string | null;
  is_unviewed: boolean;
  cover_letter_preview: string;
  price_diff_percent: number;
  designer: {
    id: string;
    full_name: string;
    avatar_path: string | null;
    city: string | null;
    state_region: string | null;
    title: string | null;
    studio_name: string | null;
    professional_type: string;
    years_experience: number;
    rating_average: number;
    rating_count: number;
    verified: boolean;
  };
}

export interface ProposalMilestoneItem {
  id: string;
  name: string;
  description: string;
  deliverables: string[];
  billing_trigger: string;
  fee_percent: number;
  amount: number;
}

export interface DetailedProposal extends ProposalListItem {
  cover_letter: string;
  hourly_rate: number | null;
  estimated_hours: number | null;
  assumptions: string[];
  exclusions: string | null;
  reimbursable_expenses_type: ReimbursableExpensesType;
  reimbursable_cap: number | null;
  additional_services_rate: number | null;
  question_for_client: string | null;
  client_answer: string | null;
  question_answered_at: string | null;
  decided_at: string | null;
  decline_reason_code: DeclineReasonCode | null;
  decline_note: string | null;
  withdraw_reason: string | null;
  milestones: ProposalMilestoneItem[];
  portfolio_items: Array<{
    id: string;
    title: string;
    cover_image_path: string | null;
    category: string | null;
    description: string | null;
  }>;
  timeline: Array<{
    event: string;
    timestamp: string;
  }>;
}

/**
 * Fetches all proposals submitted for a specific project
 */
export async function getProjectProposals(
  projectId: string,
  filters: { status?: string; search?: string } = {},
  sort: string = 'newest'
): Promise<ProposalListItem[]> {
  if (USE_MOCKS.proposals) {
    return getMockProjectProposals(projectId, filters, sort);
  }

  const { data, error } = await (supabase.rpc as any)('get_project_proposals', {
    p_project_id: projectId,
    p_status: filters.status || 'all',
    p_search: filters.search || null,
    p_sort: sort
  });

  if (error) {
    console.error('Failed to load project proposals:', error);
    throw new Error(error.message || 'Could not fetch proposals.');
  }

  return (data as ProposalListItem[]) || [];
}

/**
 * Fetches full detail of a single proposal without marking viewed
 */
export async function getProposal(proposalId: string): Promise<DetailedProposal> {
  if (USE_MOCKS.proposals) {
    return getMockDetailedProposal(proposalId);
  }

  const { data, error } = await (supabase.rpc as any)('get_proposal', {
    p_proposal_id: proposalId
  });

  if (error || !data) {
    console.error('Failed to load proposal details:', error);
    throw new Error(error?.message || 'Proposal not found.');
  }

  return data as DetailedProposal;
}

/**
 * Marks a proposal as viewed (called once on opening the detail view)
 */
export async function markProposalViewed(proposalId: string): Promise<void> {
  if (USE_MOCKS.proposals) return;

  try {
    await (supabase.rpc as any)('mark_proposal_viewed', {
      p_proposal_id: proposalId
    });
  } catch (err) {
    console.warn('Could not mark proposal viewed:', err);
  }
}

/**
 * Compares 2 to 3 proposals side-by-side
 */
export async function compareProposals(projectId: string, proposalIds: string[]): Promise<DetailedProposal[]> {
  if (proposalIds.length < 2 || proposalIds.length > 3) {
    throw new Error('Comparison requires 2 or 3 proposals.');
  }

  if (USE_MOCKS.proposals) {
    return Promise.all(proposalIds.map((id) => getMockDetailedProposal(id)));
  }

  const { data, error } = await (supabase.rpc as any)('compare_proposals', {
    p_project_id: projectId,
    p_proposal_ids: proposalIds
  });

  if (error) {
    console.error('Failed to compare proposals:', error);
    throw new Error(error.message || 'Could not load proposal comparison.');
  }

  return (data as DetailedProposal[]) || [];
}

/**
 * Submits an answer to the designer's clarifying question
 */
export async function answerProposalQuestion(
  proposalId: string,
  answer: string
): Promise<{ success: boolean; answered_at: string }> {
  if (USE_MOCKS.proposals) {
    return { success: true, answered_at: new Date().toISOString() };
  }

  const { data, error } = await (supabase.rpc as any)('answer_proposal_question', {
    p_proposal_id: proposalId,
    p_answer: answer
  });

  if (error) {
    throw new Error(error.message || 'Failed to submit answer.');
  }

  return data;
}

/**
 * Shortlists a proposal
 */
export async function shortlistProposal(proposalId: string): Promise<{ success: boolean }> {
  if (USE_MOCKS.proposals) {
    return { success: true };
  }

  const { error } = await (supabase.rpc as any)('shortlist_proposal', {
    p_proposal_id: proposalId
  });

  if (error) {
    throw new Error(error.message || 'Failed to shortlist proposal.');
  }

  return { success: true };
}

/**
 * Declines a proposal with a structured reason code
 */
export async function declineProposal(
  proposalId: string,
  reasonCode: DeclineReasonCode = 'other',
  note?: string
): Promise<{ success: boolean }> {
  if (USE_MOCKS.proposals) {
    return { success: true };
  }

  const { data, error } = await (supabase.rpc as any)('decline_proposal', {
    p_proposal_id: proposalId,
    p_reason_code: reasonCode,
    p_note: note || null
  });

  if (error) {
    throw new Error(error.message || 'Failed to decline proposal.');
  }

  return data || { success: true };
}

/**
 * Accepts a proposal, awarding the project and preparing a bilateral contract
 */
export async function acceptProposal(
  proposalId: string
): Promise<{ success: boolean; engagement_id: string; contract_id: string; project_id: string }> {
  if (USE_MOCKS.proposals) {
    return {
      success: true,
      engagement_id: 'mock-eng-1',
      contract_id: 'mock-ctr-1',
      project_id: 'mock-proj-1'
    };
  }

  const { data, error } = await (supabase.rpc as any)('accept_proposal', {
    p_proposal_id: proposalId
  });

  if (error) {
    throw new Error(error.message || 'Failed to accept proposal.');
  }

  return data;
}

/**
 * Opens or initiates a conversation with the designer
 */
export async function startConversationFromProposal(
  projectId: string,
  designerId: string,
  initialMessage?: string
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('start_conversation', {
    p_project_id: projectId,
    p_recipient_id: designerId,
    p_initial_message: initialMessage || 'Hello, I reviewed your proposal and would like to connect.'
  });

  if (error) {
    console.error('Failed to start conversation:', error);
    throw new Error(error.message || 'Could not start conversation.');
  }

  return (data?.conversation_id || data?.id || data) as string;
}

// ------------------------------------------------------------------------------
// Mock fallbacks for dev resilience
// ------------------------------------------------------------------------------

function getMockProjectProposals(projectId: string, _filters: any, _sort: string): ProposalListItem[] {
  return [
    {
      id: 'mock-prop-1',
      project_id: projectId,
      designer_id: 'mock-des-1',
      status: 'pending',
      total_price: 18500,
      currency: 'USD',
      delivery_days: 45,
      included_revisions_per_phase: 2,
      sent_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      viewed_at: null,
      is_unviewed: true,
      cover_letter_preview: 'I have extensive experience delivering luxury residential bungalow drawings in this region with sustainable passive design...',
      price_diff_percent: -7.5,
      designer: {
        id: 'mock-des-1',
        full_name: 'David Adeleke Studio',
        avatar_path: null,
        city: 'Austin',
        state_region: 'TX',
        title: 'Principal Architect',
        studio_name: 'Atelier Adeleke',
        professional_type: 'architect',
        years_experience: 12,
        rating_average: 4.9,
        rating_count: 24,
        verified: true
      }
    },
    {
      id: 'mock-prop-2',
      project_id: projectId,
      designer_id: 'mock-des-2',
      status: 'viewed',
      total_price: 21000,
      currency: 'USD',
      delivery_days: 60,
      included_revisions_per_phase: 3,
      sent_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      viewed_at: new Date(Date.now() - 86400000).toISOString(),
      is_unviewed: false,
      cover_letter_preview: 'Our multi-disciplinary team provides complete structural coordination and turnkey construction documentation...',
      price_diff_percent: 5.0,
      designer: {
        id: 'mock-des-2',
        full_name: 'Elena Rostova',
        avatar_path: null,
        city: 'Nairobi',
        state_region: 'Nairobi',
        title: 'Senior Interior Architect',
        studio_name: 'Form & Space Studio',
        professional_type: 'interior_designer',
        years_experience: 8,
        rating_average: 4.8,
        rating_count: 16,
        verified: true
      }
    }
  ];
}

function getMockDetailedProposal(proposalId: string): DetailedProposal {
  return {
    id: proposalId,
    project_id: 'mock-proj-1',
    designer_id: 'mock-des-1',
    status: 'pending',
    total_price: 18500,
    currency: 'USD',
    delivery_days: 45,
    included_revisions_per_phase: 2,
    sent_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    viewed_at: null,
    is_unviewed: true,
    cover_letter_preview: 'I have extensive experience delivering luxury residential bungalow drawings...',
    price_diff_percent: -7.5,
    cover_letter: 'Dear Client,\n\nI reviewed your brief for the detached bungalow and would be thrilled to assist. We specialize in contemporary tropical architecture that maximizes natural ventilation while delivering clear, permit-ready construction sets.\n\nAll structural and MEP coordination will be handled seamlessly within the proposed milestone timeline.',
    hourly_rate: 120,
    estimated_hours: 155,
    assumptions: [
      'Client provides the site survey and topographic boundary survey',
      'Client provides existing drawings if applicable',
      'Geotechnical borehole tests to be provided prior to structural sign-off'
    ],
    exclusions: 'Government statutory filing fees and physical printed blueprint courier costs.',
    reimbursable_expenses_type: 'capped',
    reimbursable_cap: 500,
    additional_services_rate: 120,
    question_for_client: 'Do you already have local setback requirements confirmed by the municipal development board?',
    client_answer: null,
    question_answered_at: null,
    decided_at: null,
    decline_reason_code: null,
    decline_note: null,
    withdraw_reason: null,
    milestones: [
      {
        id: 'm-1',
        name: 'Schematic Design',
        description: 'Concept layouts and building massing models',
        deliverables: ['Concept floor plans', '3D exterior massing'],
        billing_trigger: 'Client sign-off on schematic direction',
        fee_percent: 20,
        amount: 3700
      },
      {
        id: 'm-2',
        name: 'Design Development',
        description: 'Coordinated dimensioned architectural set',
        deliverables: ['Coordinated elevations', 'Cross-sections'],
        billing_trigger: 'Approval of coordinated package',
        fee_percent: 25,
        amount: 4625
      },
      {
        id: 'm-3',
        name: 'Construction Documents',
        description: 'Permit and construction drawings',
        deliverables: ['Full CAD drawing set', 'Schedules & specs'],
        billing_trigger: 'Delivery of permit package',
        fee_percent: 35,
        amount: 6475
      },
      {
        id: 'm-4',
        name: 'Bidding & Permitting',
        description: 'Permit submission support',
        deliverables: ['Plan check responses', 'Contractor RFIs'],
        billing_trigger: 'Permit issuance',
        fee_percent: 5,
        amount: 925
      },
      {
        id: 'm-5',
        name: 'Construction Administration',
        description: 'Site visits and RFI reviews',
        deliverables: ['Site inspection reports'],
        billing_trigger: 'Substantial completion certificate',
        fee_percent: 15,
        amount: 2775
      }
    ],
    portfolio_items: [],
    timeline: [
      { event: 'Sent', timestamp: new Date(Date.now() - 3600000 * 4).toISOString() }
    ],
    designer: {
      id: 'mock-des-1',
      full_name: 'David Adeleke',
      avatar_path: null,
      city: 'Austin',
      state_region: 'TX',
      title: 'Principal Architect',
      studio_name: 'Atelier Adeleke',
      professional_type: 'architect',
      years_experience: 12,
      rating_average: 4.9,
      rating_count: 24,
      verified: true
    }
  };
}
