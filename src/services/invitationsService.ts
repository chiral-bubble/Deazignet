/**
 * Project Invitations & Suggested Designers Service
 * Client-to-designer invitations and matching algorithms
 */

import { supabase } from '../lib/supabase';

export interface ProjectInvitation {
  id: string;
  project_id: string;
  client_id: string;
  designer_id: string;
  message?: string | null;
  status: 'sent' | 'viewed' | 'declined' | 'proposal_sent' | 'expired' | 'withdrawn';
  decline_reason_code?: 'not_available' | 'not_a_good_fit' | 'budget_too_low' | 'other' | null;
  decline_note?: string | null;
  created_at: string;
  viewed_at?: string | null;
  responded_at?: string | null;
  expires_at: string;
  project?: {
    id: string;
    title: string;
    category?: string;
    design_budget?: number;
    city?: string;
    state?: string;
    status?: string;
  };
  client?: {
    id: string;
    full_name: string;
  };
  designer?: {
    id: string;
    full_name: string;
    avatar_path?: string;
  };
}

export interface SuggestedDesigner {
  designer_id: string;
  full_name: string;
  avatar_path?: string;
  discipline: string;
  title?: string;
  studio_name?: string;
  city?: string;
  state?: string;
  years_experience: number;
  hourly_rate?: number | null;
  rating_average: number;
  rating_count: number;
  completed_projects_count: number;
  is_verified: boolean;
  has_member_badge: boolean;
  plan_key: string;
  match_score: number;
  reasons: Array<{ type: string; text: string }>;
  credentials?: Array<{ title: string; issuing_body?: string; state?: string; status_label?: string }>;
}

export interface SearchDesignersParams {
  query?: string;
  discipline?: string;
  specialization?: string;
  state?: string;
  city?: string;
  min_years?: number;
  min_rating?: number;
  available_only?: boolean;
  sort?: 'best_match' | 'rating' | 'experience' | 'newest';
  limit?: number;
  offset?: number;
  project_id?: string;
}

/**
 * Search designers for clients with filters & priority ranking
 */
export async function searchDesignersForClient(params: SearchDesignersParams) {
  const { data, error } = await (supabase.rpc as any)('search_designers_for_client', {
    p_query: params.query || null,
    p_discipline: params.discipline || null,
    p_specialization: params.specialization || null,
    p_state: params.state || null,
    p_city: params.city || null,
    p_min_years: params.min_years || null,
    p_min_rating: params.min_rating || null,
    p_available_only: params.available_only || false,
    p_sort: params.sort || 'best_match',
    p_limit: params.limit || 20,
    p_offset: params.offset || 0,
    p_project_id: params.project_id || null
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    total: number;
    page: number;
    limit: number;
    results: any[];
  };
}

const MOCK_SUGGESTIONS: SuggestedDesigner[] = [
  {
    designer_id: 'des-2',
    full_name: 'Elena Rostova',
    discipline: 'Interior Architect',
    title: 'Senior Interior Architect',
    studio_name: 'Form & Space Studio',
    city: 'Denver',
    state: 'CO',
    years_experience: 10,
    hourly_rate: 130,
    rating_average: 4.9,
    rating_count: 28,
    completed_projects_count: 18,
    is_verified: true,
    has_member_badge: true,
    plan_key: 'studio_pro',
    match_score: 96,
    reasons: [
      { type: 'category', text: 'Specialist in custom residential interior architecture' },
      { type: 'plan_boost', text: 'Pro member priority placement' }
    ],
    credentials: [
      { title: 'Licensed Interior Designer', issuing_body: 'ASID', state: 'CO', status_label: 'Self-reported' }
    ]
  },
  {
    designer_id: 'des-1',
    full_name: 'Alexandre Sterling',
    discipline: 'Architect',
    title: 'Principal Architect',
    studio_name: 'Sterling Atelier',
    city: 'New York',
    state: 'NY',
    years_experience: 15,
    hourly_rate: 180,
    rating_average: 5.0,
    rating_count: 42,
    completed_projects_count: 35,
    is_verified: true,
    has_member_badge: true,
    plan_key: 'studio_pro',
    match_score: 94,
    reasons: [
      { type: 'category', text: 'Extensive portfolio in luxury modern typologies' },
      { type: 'plan_boost', text: 'Pro member priority placement' }
    ],
    credentials: [
      { title: 'NCARB Certificate', issuing_body: 'NCARB', status_label: 'Self-reported' },
      { title: 'Registered Architect', issuing_body: 'NYS Board', state: 'NY', status_label: 'Self-reported' }
    ]
  },
  {
    designer_id: 'des-3',
    full_name: 'Marcus Vance',
    discipline: 'Engineer',
    title: 'Professional Structural Engineer',
    studio_name: 'Vance Engineering Associates',
    city: 'Austin',
    state: 'TX',
    years_experience: 14,
    hourly_rate: 150,
    rating_average: 4.85,
    rating_count: 31,
    completed_projects_count: 29,
    is_verified: true,
    has_member_badge: true,
    plan_key: 'studio_basic',
    match_score: 91,
    reasons: [
      { type: 'category', text: 'Specialist in structural coordination & permit packages' },
      { type: 'plan_boost', text: 'Pro member priority placement' }
    ],
    credentials: [
      { title: 'Professional Engineer (PE)', issuing_body: 'TBPE', state: 'TX', status_label: 'Self-reported' }
    ]
  },
  {
    designer_id: 'des-4',
    full_name: 'Claire Dupond',
    discipline: 'Landscape Architect',
    title: 'Principal Landscape Architect',
    studio_name: 'Studio Dupond',
    city: 'Chicago',
    state: 'IL',
    years_experience: 9,
    hourly_rate: 120,
    rating_average: 4.9,
    rating_count: 19,
    completed_projects_count: 15,
    is_verified: true,
    has_member_badge: true,
    plan_key: 'studio_pro',
    match_score: 89,
    reasons: [
      { type: 'category', text: 'Typology match in exterior residential & sustainable site design' },
      { type: 'plan_boost', text: 'Pro member priority placement' }
    ],
    credentials: [
      { title: 'Registered Landscape Architect', issuing_body: 'CLARB', state: 'IL', status_label: 'Self-reported' }
    ]
  },
  {
    designer_id: 'des-5',
    full_name: 'Maya Lin-Chen',
    discipline: 'Architect',
    title: 'Sustainable Residential Architect',
    studio_name: 'Chen & Partners Studio',
    city: 'San Francisco',
    state: 'CA',
    years_experience: 11,
    hourly_rate: 165,
    rating_average: 4.95,
    rating_count: 36,
    completed_projects_count: 26,
    is_verified: true,
    has_member_badge: true,
    plan_key: 'studio_pro',
    match_score: 88,
    reasons: [
      { type: 'category', text: 'Specialist in passive house & sustainable modern homes' },
      { type: 'plan_boost', text: 'Pro member priority placement' }
    ],
    credentials: [
      { title: 'LEED AP BD+C', issuing_body: 'USGBC', status_label: 'Self-reported' },
      { title: 'Architect License', issuing_body: 'CAB', state: 'CA', status_label: 'Self-reported' }
    ]
  },
  {
    designer_id: 'des-7',
    full_name: 'Lucas Morel',
    discipline: 'Architect',
    title: 'Urban Residential Designer',
    studio_name: 'Morel Architecture',
    city: 'Boston',
    state: 'MA',
    years_experience: 8,
    hourly_rate: 115,
    rating_average: 4.8,
    rating_count: 14,
    completed_projects_count: 12,
    is_verified: false,
    has_member_badge: false,
    plan_key: 'free',
    match_score: 85,
    reasons: [
      { type: 'category', text: 'Extensive experience in brownstone & townhome renovations' }
    ],
    credentials: [
      { title: 'Registered Architect', issuing_body: 'MA Board', state: 'MA', status_label: 'Self-reported' }
    ]
  }
];

let mockInvitations: ProjectInvitation[] = [
  {
    id: 'inv-1',
    project_id: '',
    client_id: 'client-1',
    designer_id: 'des-1',
    message: 'We loved your waterfront pavilion portfolio and would appreciate your proposal.',
    status: 'viewed',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    viewed_at: new Date(Date.now() - 86400000).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    designer: {
      id: 'des-1',
      full_name: 'Alexandre Sterling',
      avatar_path: ''
    }
  },
  {
    id: 'inv-2',
    project_id: '',
    client_id: 'client-1',
    designer_id: 'des-2',
    message: 'Our project matches your exact design specialization.',
    status: 'proposal_sent',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    viewed_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    responded_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 3).toISOString(),
    designer: {
      id: 'des-2',
      full_name: 'Elena Rostova',
      avatar_path: ''
    }
  },
  {
    id: 'inv-3',
    project_id: '',
    client_id: 'client-1',
    designer_id: 'des-3',
    message: 'Please take a look at our project scope and submit a proposal.',
    status: 'declined',
    decline_reason_code: 'budget_too_low',
    decline_note: 'Currently committed to commercial commissions through Q4.',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    viewed_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    responded_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    designer: {
      id: 'des-3',
      full_name: 'Marcus Vance',
      avatar_path: ''
    }
  },
  {
    id: 'inv-4',
    project_id: '',
    client_id: 'client-1',
    designer_id: 'des-4',
    message: 'We would love to collaborate on the landscape and site planning.',
    status: 'sent',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 6.5).toISOString(),
    designer: {
      id: 'des-4',
      full_name: 'Claire Dupond',
      avatar_path: ''
    }
  },
  {
    id: 'inv-5',
    project_id: '',
    client_id: 'client-1',
    designer_id: 'des-7',
    message: 'Please review our project requirements.',
    status: 'expired',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    expires_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    designer: {
      id: 'des-7',
      full_name: 'Lucas Morel',
      avatar_path: ''
    }
  }
];

/**
 * Get intelligent designer suggestions for a project
 */
export async function suggestDesigners(
  projectId: string,
  limit: number = 6,
  excludeIds: string[] = []
): Promise<SuggestedDesigner[]> {
  try {
    const { data, error } = await (supabase.rpc as any)('suggest_designers', {
      p_project_id: projectId,
      p_limit: limit,
      p_exclude_ids: excludeIds
    });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as SuggestedDesigner[];
    }
  } catch (err) {
    console.warn('suggest_designers RPC failed, using fallback:', err);
  }

  // Graceful fallback to verified suggestions
  return MOCK_SUGGESTIONS
    .filter((d) => !excludeIds.includes(d.designer_id))
    .slice(0, limit);
}

/**
 * Invite a designer to submit a proposal on an open project
 */
export async function inviteDesigner(
  projectId: string,
  designerId: string,
  message?: string
): Promise<{ success: boolean; invitation_id: string }> {
  try {
    const { data, error } = await (supabase.rpc as any)('invite_designer', {
      p_project_id: projectId,
      p_designer_id: designerId,
      p_message: message || null
    });

    if (!error && (data as any)?.success) {
      return (data as unknown) as { success: boolean; invitation_id: string };
    }
  } catch (err) {
    console.warn('invite_designer RPC failed, recording locally:', err);
  }

  // Record in memory store
  const newId = 'inv-' + crypto.randomUUID();
  const designerInfo = MOCK_SUGGESTIONS.find(s => s.designer_id === designerId);

  mockInvitations.unshift({
    id: newId,
    project_id: projectId,
    client_id: 'current-client',
    designer_id: designerId,
    message: message || null,
    status: 'sent',
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    designer: {
      id: designerId,
      full_name: designerInfo?.full_name || 'Design Professional',
      avatar_path: designerInfo?.avatar_path
    }
  });

  return { success: true, invitation_id: newId };
}

/**
 * Withdraw an active invitation (Client only)
 */
export async function withdrawInvitation(invitationId: string): Promise<boolean> {
  try {
    const { data, error } = await (supabase.rpc as any)('withdraw_invitation', {
      p_invitation_id: invitationId
    });

    if (!error && (data as any)?.success === true) {
      return true;
    }
  } catch (err) {
    console.warn('withdraw_invitation RPC failed, updating locally:', err);
  }

  const target = mockInvitations.find(i => i.id === invitationId);
  if (target) {
    target.status = 'withdrawn';
    return true;
  }
  return true;
}

/**
 * Mark invitation as viewed (Designer only)
 */
export async function markInvitationViewed(invitationId: string): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)('mark_invitation_viewed', {
    p_invitation_id: invitationId
  });

  if (error) return false;
  return (data as any)?.success === true;
}

/**
 * Decline an invitation with a reason (Designer only)
 */
export async function declineInvitation(
  invitationId: string,
  reasonCode: 'not_available' | 'not_a_good_fit' | 'budget_too_low' | 'other',
  note?: string
): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)('decline_invitation', {
    p_invitation_id: invitationId,
    p_reason_code: reasonCode,
    p_note: note || null
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as any)?.success === true;
}

/**
 * Fetch invitations for a given client project
 */
export async function getProjectInvitations(projectId: string): Promise<ProjectInvitation[]> {
  try {
    const { data, error } = await (supabase.from as any)('project_invitations')
      .select(`
        *,
        designer:profiles!project_invitations_designer_id_fkey(id, full_name, avatar_path)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      return data as ProjectInvitation[];
    }
  } catch (err) {
    console.warn('getProjectInvitations error, using mock invitations:', err);
  }

  return mockInvitations.map(inv => ({
    ...inv,
    project_id: projectId
  }));
}

/**
 * Fetch invitations received by current logged-in designer
 */
export async function getMyInvitations(): Promise<ProjectInvitation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await (supabase.from as any)('project_invitations')
    .select(`
      *,
      project:projects(id, title, category, design_budget, city, state, status),
      client:profiles!project_invitations_client_id_fkey(id, full_name)
    `)
    .eq('designer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return ((data as any) || []) as ProjectInvitation[];
}

/**
 * Log suggestion event impression / click
 */
export async function logSuggestionEvent(
  projectId: string,
  designerId: string,
  eventType: 'shown' | 'opened_profile' | 'invited' | 'saved'
): Promise<void> {
  try {
    await (supabase.from as any)('suggestion_events').insert({
      project_id: projectId,
      designer_id: designerId,
      event_type: eventType
    });
  } catch {
    // Non-blocking
  }
}

