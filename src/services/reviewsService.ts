/**
 * Reviews Service for Dezignet
 * Client review creation (overall 1-5, subratings, would-hire-again),
 * designer replies (within 10-minute window), and public reviews display
 */

import { supabase, USE_MOCKS } from '../lib/supabase';

export interface ReviewItem {
  id: string;
  engagement_id: string;
  client_id: string;
  client_name?: string;
  designer_id: string;
  rating: number;
  communication_rating?: number | null;
  quality_rating?: number | null;
  timeliness_rating?: number | null;
  comment: string;
  would_hire_again: boolean;
  designer_reply?: string | null;
  replied_at?: string | null;
  created_at: string;
  editable_until: string;
}

/**
 * Submits a new review after engagement completion
 */
export async function createReview(params: {
  engagementId: string;
  rating: number;
  comment: string;
  wouldHireAgain?: boolean;
  communicationRating?: number;
  qualityRating?: number;
  timelinessRating?: number;
}): Promise<{ success: boolean; review_id: string }> {
  if (USE_MOCKS.profiles) {
    return { success: true, review_id: 'mock-rev-1' };
  }

  const { data, error } = await (supabase.rpc as any)('create_review', {
    p_engagement_id: params.engagementId,
    p_rating: params.rating,
    p_comment: params.comment,
    p_would_hire_again: params.wouldHireAgain ?? true,
    p_communication_rating: params.communicationRating || null,
    p_quality_rating: params.qualityRating || null,
    p_timeliness_rating: params.timelinessRating || null
  });

  if (error) {
    console.error('Failed to submit review:', error);
    throw new Error(error.message || 'Could not submit review.');
  }

  return data;
}

/**
 * Designer replies to a client review (editable for 10 minutes)
 */
export async function replyToReview(reviewId: string, reply: string): Promise<{ success: boolean }> {
  if (USE_MOCKS.profiles) {
    return { success: true };
  }

  const { data, error } = await (supabase.rpc as any)('reply_to_review', {
    p_review_id: reviewId,
    p_reply: reply
  });

  if (error) {
    throw new Error(error.message || 'Could not post reply.');
  }

  return data || { success: true };
}

/**
 * Retrieves visible public reviews for a designer
 */
export async function getReviews(designerId: string): Promise<ReviewItem[]> {
  if (USE_MOCKS.profiles) {
    return [
      {
        id: 'rev-1',
        engagement_id: 'eng-1',
        client_id: 'c-1',
        client_name: 'Adewale B.',
        designer_id: designerId,
        rating: 5,
        communication_rating: 5,
        quality_rating: 5,
        timeliness_rating: 4,
        comment: 'David was fantastic to work with. He turned our vague ideas into clear, permit-ready drawings that sailed through municipal approvals.',
        would_hire_again: true,
        designer_reply: 'Thank you Adewale! It was a pleasure collaborating with your team on this project.',
        replied_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
        editable_until: new Date().toISOString()
      }
    ];
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      engagement_id,
      client_id,
      designer_id,
      rating,
      communication_rating,
      quality_rating,
      timeliness_rating,
      comment,
      would_hire_again,
      designer_reply,
      replied_at,
      created_at,
      editable_until,
      profiles!client_id(full_name)
    `)
    .eq('designer_id', designerId)
    .eq('status', 'visible')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((r: any) => {
    const rawName = r.profiles?.full_name || 'Client';
    const parts = rawName.split(' ');
    const maskedName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : rawName;

    return {
      id: r.id,
      engagement_id: r.engagement_id,
      client_id: r.client_id,
      client_name: maskedName,
      designer_id: r.designer_id,
      rating: r.rating,
      communication_rating: r.communication_rating,
      quality_rating: r.quality_rating,
      timeliness_rating: r.timeliness_rating,
      comment: r.comment,
      would_hire_again: r.would_hire_again,
      designer_reply: r.designer_reply,
      replied_at: r.replied_at,
      created_at: r.created_at,
      editable_until: r.editable_until
    };
  });
}

