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
  plan_key: string;
  match_score: number;
  reasons: Array<{ type: string; text: string }>;
  licensed_states: string[];
}

export interface SearchDesignersParams {
  query?: string;
  discipline?: string;
  specialization?: string;
  state?: string;
  city?: string;
  licensed_in_state?: string;
  min_years?: number;
  min_rating?: number;
  verified_only?: boolean;
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
    p_licensed_in_state: params.licensed_in_state || null,
    p_min_years: params.min_years || null,
    p_min_rating: params.min_rating || null,
    p_verified_only: params.verified_only || false,
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

/**
 * Get intelligent designer suggestions for a project
 */
export async function suggestDesigners(
  projectId: string,
  limit: number = 6,
  excludeIds: string[] = []
): Promise<SuggestedDesigner[]> {
  const { data, error } = await (supabase.rpc as any)('suggest_designers', {
    p_project_id: projectId,
    p_limit: limit,
    p_exclude_ids: excludeIds
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as any) || []) as SuggestedDesigner[];
}

/**
 * Invite a designer to submit a proposal on an open project
 */
export async function inviteDesigner(
  projectId: string,
  designerId: string,
  message?: string
): Promise<{ success: boolean; invitation_id: string }> {
  const { data, error } = await (supabase.rpc as any)('invite_designer', {
    p_project_id: projectId,
    p_designer_id: designerId,
    p_message: message || null
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown) as { success: boolean; invitation_id: string };
}

/**
 * Withdraw an active invitation (Client only)
 */
export async function withdrawInvitation(invitationId: string): Promise<boolean> {
  const { data, error } = await (supabase.rpc as any)('withdraw_invitation', {
    p_invitation_id: invitationId
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as any)?.success === true;
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
  const { data, error } = await (supabase.from as any)('project_invitations')
    .select(`
      *,
      designer:profiles!project_invitations_designer_id_fkey(id, full_name, avatar_path)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    return [];
  }

  return ((data as any) || []) as ProjectInvitation[];
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

