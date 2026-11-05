/**
 * Studio Insights & Studio Slug Service
 * Manages daily aggregate analytics, conversion funnel, and custom studio web addresses
 */

import { supabase } from '../lib/supabase';

export interface StudioInsightsPeriod {
  profile_views: number;
  search_appearances: number;
  suggestion_appearances: number;
  invitations_received: number;
  invitations_declined: number;
  proposals_sent: number;
  proposals_viewed: number;
  proposals_shortlisted: number;
  proposals_declined: number;
  proposals_accepted: number;
}

export interface StudioInsightsResult {
  period_days: number;
  current: StudioInsightsPeriod;
  previous: StudioInsightsPeriod;
  win_rate: number;
}

/**
 * Fetch designer analytics aggregate for selected period (7, 30, 90 days)
 */
export async function getStudioInsights(designerId: string, days: number = 30): Promise<StudioInsightsResult> {
  const { data, error } = await (supabase.rpc as any)('get_studio_insights', {
    p_designer_id: designerId,
    p_days: days
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown) as StudioInsightsResult;
}

/**
 * Record an analytics impression / event
 */
export async function recordAnalyticsEvent(designerId: string, eventType: string): Promise<void> {
  try {
    await (supabase.rpc as any)('record_analytics_event', {
      p_designer_id: designerId,
      p_event_type: eventType
    });
  } catch {
    // Non-blocking fire-and-forget
  }
}

/**
 * Claim or update a designer's studio slug (/studio/{slug})
 */
export async function claimStudioSlug(designerId: string, newSlug: string): Promise<{ success: boolean; slug: string }> {
  const { data, error } = await (supabase.rpc as any)('claim_studio_slug', {
    p_designer_id: designerId,
    p_new_slug: newSlug
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown) as { success: boolean; slug: string };
}

/**
 * Resolve studio slug to designer profile
 */
export async function resolveStudioSlug(slug: string): Promise<{
  status: 'found' | 'redirect' | 'plan_expired' | 'not_found';
  designer_id?: string;
  slug?: string;
  new_slug?: string;
}> {
  const { data, error } = await (supabase.rpc as any)('resolve_studio_slug', {
    p_slug: slug
  });

  if (error || !data) {
    return { status: 'not_found' };
  }

  return (data as unknown) as {
    status: 'found' | 'redirect' | 'plan_expired' | 'not_found';
    designer_id?: string;
    slug?: string;
    new_slug?: string;
  };
}

