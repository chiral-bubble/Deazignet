/**
 * Reviews Service for Dezignet
 * Two-way double-blind reviews system for completed engagements.
 *
 * Rules:
 * 1. Reviews exist ONLY for completed engagements where at least one payment-approved milestone or week exists.
 * 2. Double-blind 14-day window: neither review is visible until BOTH are submitted OR the window closes.
 *    If an open dispute exists on the engagement, reveal waits until resolved.
 * 3. Once revealed, review cannot be edited. Before reveal, author may edit.
 *    The reviewed party may post one reply after reveal (editable for 10 minutes).
 * 4. Dimensional ratings for both roles (Client reviews designer & Designer reviews client).
 * 5. Rating aggregation: average shown ONLY when visible revealed count >= min_reviews_for_average (3). Count always shows.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';

export interface ClientReviewDimensions {
  communication?: number;
  quality_of_work?: number;
  timeliness?: number;
  professionalism?: number;
}

export interface DesignerReviewDimensions {
  clarity_of_brief?: number;
  responsiveness?: number;
  timely_approvals_payments?: number;
  professionalism?: number;
}

export type ReviewDimensions = ClientReviewDimensions | DesignerReviewDimensions | Record<string, number>;

export interface ReviewItem {
  id: string;
  engagement_id: string;
  reviewer_role: 'client' | 'designer';
  reviewer_id: string;
  reviewee_id: string;
  reviewer_name?: string;
  rating: number;
  ratings?: ReviewDimensions | null;
  // Backward-compatible individual ratings
  communication_rating?: number | null;
  quality_rating?: number | null;
  timeliness_rating?: number | null;
  comment: string;
  would_work_again: boolean;
  would_hire_again?: boolean;
  reply?: string | null;
  designer_reply?: string | null;
  replied_at?: string | null;
  reply_editable_until?: string | null;
  status: 'pending' | 'visible' | 'hidden';
  revealed_at?: string | null;
  created_at: string;
  edited_at?: string | null;
  updated_at?: string;
  editable_until?: string;
  flagged_content?: boolean;
  flag_reasons?: string[];
  // Legacy compatibility fields
  client_id?: string;
  client_name?: string;
  designer_id?: string;
}

export interface EngagementReviewStatus {
  canReview: boolean;
  cannotReviewReason?: string;
  userReview: ReviewItem | null;
  counterpartSubmitted: boolean;
  isRevealed: boolean;
  daysRemaining: number;
  hasOpenDispute: boolean;
  role?: 'client' | 'designer';
  completedAt?: string;
}

export interface SubmitReviewParams {
  engagementId: string;
  rating: number;
  ratings?: ReviewDimensions;
  wouldWorkAgain?: boolean;
  comment: string;
  // Legacy aliases
  wouldHireAgain?: boolean;
  communicationRating?: number;
  qualityRating?: number;
  timelinessRating?: number;
}

export interface UpdateReviewParams {
  rating: number;
  ratings?: ReviewDimensions;
  wouldWorkAgain?: boolean;
  comment: string;
}

export const REVIEW_SETTINGS = {
  REVIEW_WINDOW_DAYS: 14,
  MIN_REVIEWS_FOR_AVERAGE: 3,
  REVIEW_REMINDER_DAYS: [3, 10],
  COMMENT_MIN_CHARS: 10,
  COMMENT_MAX_CHARS: 1500,
  REPLY_MAX_CHARS: 800,
  REPLY_EDIT_WINDOW_MINUTES: 10
} as const;

export const CLIENT_REVIEW_DIMENSIONS = [
  { key: 'communication', label: 'Communication', desc: 'Clear, proactive, and prompt updates' },
  { key: 'quality_of_work', label: 'Quality of Work', desc: 'Precision, creativity, and technical rigor' },
  { key: 'timeliness', label: 'Timeliness', desc: 'Adherence to agreed milestone deadlines' },
  { key: 'professionalism', label: 'Professionalism', desc: 'Conduct, problem-solving, and collaboration' }
] as const;

export const DESIGNER_REVIEW_DIMENSIONS = [
  { key: 'clarity_of_brief', label: 'Clarity of Brief', desc: 'Clear scope, requirements, and expectations' },
  { key: 'responsiveness', label: 'Responsiveness', desc: 'Timely answers to RFIs and questions' },
  { key: 'timely_approvals_payments', label: 'Timely Approvals & Payments', desc: 'Prompt milestone sign-offs and releases' },
  { key: 'professionalism', label: 'Professionalism', desc: 'Fairness, respect, and constructive collaboration' }
] as const;

/**
 * Mask full name to "First Name + Last Initial" format for public display
 * e.g., "Sarah Jenkins" -> "Sarah J.", "David" -> "David"
 */
export function maskDisplayName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== 'string') return 'Member';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

/**
 * Flags direct contact info (emails, phone numbers) and external links in review text
 */
export function detectReviewContactFlags(comment: string): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!comment) return { flagged: false, reasons };

  const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10,12}\b/;
  const linkRegex = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9.-]+\.(com|org|net|io|co|dev|design|app)\b/i;

  if (emailRegex.test(comment)) reasons.push('contains_email');
  if (phoneRegex.test(comment)) reasons.push('contains_phone');
  if (linkRegex.test(comment)) reasons.push('contains_link');

  return {
    flagged: reasons.length > 0,
    reasons
  };
}

/**
 * Calculates user rating stats strictly adhering to Dezignet rules:
 * - Computed ONLY from visible, revealed reviews.
 * - Average is ONLY computed when visible count >= minReviews (default 3); otherwise null.
 * - Count is always displayed.
 */
export function calculateRatingStats(
  reviews: Array<{ rating: number; status?: string; revealed_at?: string | null; would_work_again?: boolean; would_hire_again?: boolean }>,
  minReviews: number = REVIEW_SETTINGS.MIN_REVIEWS_FOR_AVERAGE
): {
  ratingCount: number;
  averageRating: number | null;
  wouldWorkAgainPercent: number;
} {
  const visible = reviews.filter(
    (r) => r.status === 'visible' && r.revealed_at !== null && r.revealed_at !== undefined
  );
  const count = visible.length;
  if (count === 0) {
    return { ratingCount: 0, averageRating: null, wouldWorkAgainPercent: 100 };
  }

  const sum = visible.reduce((acc, r) => acc + r.rating, 0);
  const averageRating = count >= minReviews ? Math.round((sum / count) * 10) / 10 : null;

  const positiveCount = visible.filter((r) =>
    r.would_work_again !== undefined ? r.would_work_again : (r.would_hire_again ?? true)
  ).length;
  const wouldWorkAgainPercent = Math.round((positiveCount / count) * 100);

  return {
    ratingCount: count,
    averageRating,
    wouldWorkAgainPercent
  };
}

// ------------------------------------------------------------------------------
// IN-MEMORY MOCK STORE FOR UNIT TESTS & LOCAL PLAYGROUND
// ------------------------------------------------------------------------------
interface MockEngagement {
  id: string;
  client_id: string;
  designer_id: string;
  status: 'active' | 'completed' | 'cancelled' | 'disputed';
  completed_at: string;
  has_approved_payment: boolean;
  all_milestones_approved: boolean;
}

interface MockDispute {
  id: string;
  engagement_id: string;
  status: 'open' | 'resolved';
}

interface MockReport {
  id: string;
  review_id: string;
  reporter_id: string;
  reason: string;
  details?: string;
  status: string;
  created_at: string;
}

let mockReviews: ReviewItem[] = [
  {
    id: 'mock-rev-1',
    engagement_id: 'eng-1',
    reviewer_role: 'client',
    reviewer_id: 'c-1',
    reviewee_id: 'd-1',
    reviewer_name: 'Adewale B.',
    client_id: 'c-1',
    designer_id: 'd-1',
    rating: 5,
    ratings: { communication: 5, quality_of_work: 5, timeliness: 4, professionalism: 5 },
    communication_rating: 5,
    quality_rating: 5,
    timeliness_rating: 4,
    comment: 'David was fantastic to work with. He turned our ideas into clear, permit-ready drawings that sailed through municipal approvals.',
    would_work_again: true,
    would_hire_again: true,
    reply: 'Thank you Adewale! It was a pleasure collaborating with your team on this project.',
    designer_reply: 'Thank you Adewale! It was a pleasure collaborating with your team on this project.',
    replied_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    reply_editable_until: new Date(Date.now() - 86400000 * 5 + 600000).toISOString(),
    status: 'visible',
    revealed_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    editable_until: new Date(Date.now() + 86400000 * 8).toISOString()
  }
];

let mockEngagements: Record<string, MockEngagement> = {
  'eng-1': {
    id: 'eng-1',
    client_id: 'c-1',
    designer_id: 'd-1',
    status: 'completed',
    completed_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    has_approved_payment: true,
    all_milestones_approved: true
  }
};

let mockDisputes: Record<string, MockDispute[]> = {};
let mockReports: MockReport[] = [];

export function _resetMockReviewsStore() {
  mockReviews = [];
  mockEngagements = {};
  mockDisputes = {};
  mockReports = [];
}

export function _seedMockEngagement(eng: MockEngagement) {
  mockEngagements[eng.id] = eng;
}

export function _seedMockDispute(dispute: MockDispute) {
  if (!mockDisputes[dispute.engagement_id]) {
    mockDisputes[dispute.engagement_id] = [];
  }
  mockDisputes[dispute.engagement_id].push(dispute);
}

export function _getMockReviews() {
  return [...mockReviews];
}

export function _getMockReports() {
  return [...mockReports];
}

// ------------------------------------------------------------------------------
// SERVICE API METHODS
// ------------------------------------------------------------------------------

/**
 * Submits a review for a completed engagement.
 * Double-blind rule: If counterpart review exists and no dispute, reveals both immediately.
 */
export async function submitReview(params: SubmitReviewParams): Promise<{
  success: boolean;
  review_id: string;
  status: 'pending' | 'visible';
  revealed: boolean;
  flagged?: boolean;
  flag_reasons?: string[];
}> {
  const wouldWorkAgain = params.wouldWorkAgain ?? params.wouldHireAgain ?? true;
  const ratings = params.ratings || {
    ...(params.communicationRating ? { communication: params.communicationRating } : {}),
    ...(params.qualityRating ? { quality_of_work: params.qualityRating } : {}),
    ...(params.timelinessRating ? { timeliness: params.timelinessRating } : {})
  };

  if (USE_MOCKS.profiles) {
    const eng = mockEngagements[params.engagementId];
    if (!eng) {
      throw new Error('Engagement not found.');
    }
    if (eng.status !== 'completed') {
      throw new Error('Reviews exist only for completed engagements.');
    }
    if (!eng.has_approved_payment || !eng.all_milestones_approved) {
      throw new Error('All milestones must be approved before submitting a review.');
    }

    const completedTime = new Date(eng.completed_at).getTime();
    const windowMs = REVIEW_SETTINGS.REVIEW_WINDOW_DAYS * 86400000;
    if (Date.now() > completedTime + windowMs) {
      throw new Error(`The ${REVIEW_SETTINGS.REVIEW_WINDOW_DAYS}-day review window for this engagement has closed.`);
    }

    if (params.rating < 1 || params.rating > 5) {
      throw new Error('Rating must be between 1 and 5.');
    }
    const trimmedComment = (params.comment || '').trim();
    if (trimmedComment.length < REVIEW_SETTINGS.COMMENT_MIN_CHARS || trimmedComment.length > REVIEW_SETTINGS.COMMENT_MAX_CHARS) {
      throw new Error(`Comment must be between ${REVIEW_SETTINGS.COMMENT_MIN_CHARS} and ${REVIEW_SETTINGS.COMMENT_MAX_CHARS} characters.`);
    }

    const { flagged, reasons } = detectReviewContactFlags(trimmedComment);

    // Determine current user role for mock
    const existingForEng = mockReviews.filter((r) => r.engagement_id === params.engagementId);
    let role: 'client' | 'designer' = 'client';
    if (existingForEng.length > 0 && existingForEng[0].reviewer_role === 'client') {
      role = 'designer';
    }

    const alreadySubmitted = existingForEng.some((r) => r.reviewer_role === role);
    if (alreadySubmitted) {
      throw new Error('You have already submitted a review for this engagement.');
    }

    const counterpart = existingForEng.find((r) => r.reviewer_role !== role);
    const hasOpenDispute = (mockDisputes[params.engagementId] || []).some((d) => d.status === 'open');

    let initialStatus: 'pending' | 'visible' = 'pending';
    let revealedAt: string | null = null;

    if (counterpart && !hasOpenDispute) {
      initialStatus = 'visible';
      revealedAt = new Date().toISOString();
      counterpart.status = 'visible';
      counterpart.revealed_at = revealedAt;
    }

    const revId = `mock-rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRev: ReviewItem = {
      id: revId,
      engagement_id: params.engagementId,
      reviewer_role: role,
      reviewer_id: role === 'client' ? eng.client_id : eng.designer_id,
      reviewee_id: role === 'client' ? eng.designer_id : eng.client_id,
      client_id: eng.client_id,
      designer_id: eng.designer_id,
      rating: params.rating,
      ratings,
      comment: trimmedComment,
      would_work_again: wouldWorkAgain,
      would_hire_again: wouldWorkAgain,
      status: initialStatus,
      revealed_at: revealedAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      flagged_content: flagged,
      flag_reasons: reasons
    };

    mockReviews.push(newRev);

    return {
      success: true,
      review_id: revId,
      status: initialStatus,
      revealed: initialStatus === 'visible',
      flagged,
      flag_reasons: reasons
    };
  }

  const { data, error } = await (supabase.rpc as any)('submit_review', {
    p_engagement_id: params.engagementId,
    p_rating: params.rating,
    p_ratings: ratings,
    p_would_work_again: wouldWorkAgain,
    p_comment: params.comment
  });

  if (error) {
    console.error('Failed to submit review:', error);
    throw new Error(error.message || 'Could not submit review.');
  }

  return data;
}

/**
 * Backward compatible alias for createReview
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
  return submitReview({
    engagementId: params.engagementId,
    rating: params.rating,
    comment: params.comment,
    wouldWorkAgain: params.wouldHireAgain,
    communicationRating: params.communicationRating,
    qualityRating: params.qualityRating,
    timelinessRating: params.timelinessRating
  });
}

/**
 * Author edits review before reveal. Once revealed, review cannot be edited.
 */
export async function updateReview(
  reviewId: string,
  params: UpdateReviewParams
): Promise<{ success: boolean; review_id: string; edited_at: string; flagged?: boolean; flag_reasons?: string[] }> {
  if (USE_MOCKS.profiles) {
    const rev = mockReviews.find((r) => r.id === reviewId);
    if (!rev) {
      throw new Error('Review not found.');
    }
    if (rev.revealed_at !== null || rev.status !== 'pending') {
      throw new Error('Once revealed, reviews cannot be edited.');
    }
    if (params.rating < 1 || params.rating > 5) {
      throw new Error('Rating must be between 1 and 5.');
    }
    const trimmed = (params.comment || '').trim();
    if (trimmed.length < REVIEW_SETTINGS.COMMENT_MIN_CHARS || trimmed.length > REVIEW_SETTINGS.COMMENT_MAX_CHARS) {
      throw new Error(`Comment must be between ${REVIEW_SETTINGS.COMMENT_MIN_CHARS} and ${REVIEW_SETTINGS.COMMENT_MAX_CHARS} characters.`);
    }

    const { flagged, reasons } = detectReviewContactFlags(trimmed);
    const nowIso = new Date().toISOString();

    rev.rating = params.rating;
    if (params.ratings) rev.ratings = params.ratings;
    if (params.wouldWorkAgain !== undefined) {
      rev.would_work_again = params.wouldWorkAgain;
      rev.would_hire_again = params.wouldWorkAgain;
    }
    rev.comment = trimmed;
    rev.flagged_content = flagged;
    rev.flag_reasons = reasons;
    rev.edited_at = nowIso;
    rev.updated_at = nowIso;

    return {
      success: true,
      review_id: reviewId,
      edited_at: nowIso,
      flagged,
      flag_reasons: reasons
    };
  }

  const { data, error } = await (supabase.rpc as any)('update_review', {
    p_review_id: reviewId,
    p_rating: params.rating,
    p_ratings: params.ratings || null,
    p_would_work_again: params.wouldWorkAgain ?? true,
    p_comment: params.comment
  });

  if (error) {
    throw new Error(error.message || 'Could not update review.');
  }

  return data;
}

/**
 * Reviewed party posts one reply after reveal (editable for 10 minutes)
 */
export async function replyToReview(
  reviewId: string,
  reply: string
): Promise<{ success: boolean; review_id?: string; replied_at?: string }> {
  if (USE_MOCKS.profiles) {
    const rev = mockReviews.find((r) => r.id === reviewId);
    if (!rev) {
      throw new Error('Review not found.');
    }
    if (rev.revealed_at === null || rev.status !== 'visible') {
      throw new Error('You cannot reply to an unrevealed review.');
    }

    const trimmed = (reply || '').trim();
    if (!trimmed || trimmed.length > REVIEW_SETTINGS.REPLY_MAX_CHARS) {
      throw new Error(`Reply must be between 1 and ${REVIEW_SETTINGS.REPLY_MAX_CHARS} characters.`);
    }

    const now = Date.now();
    if (rev.replied_at && rev.reply_editable_until) {
      if (now > new Date(rev.reply_editable_until).getTime()) {
        throw new Error('The 10-minute editing window for your reply has expired.');
      }
    }

    const nowIso = new Date(now).toISOString();
    rev.reply = trimmed;
    rev.designer_reply = trimmed;
    rev.replied_at = rev.replied_at || nowIso;
    rev.reply_editable_until = rev.reply_editable_until || new Date(now + REVIEW_SETTINGS.REPLY_EDIT_WINDOW_MINUTES * 60000).toISOString();
    rev.updated_at = nowIso;

    return { success: true, review_id: reviewId, replied_at: rev.replied_at };
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
 * Submits a moderation report for a review
 */
export async function reportReview(
  reviewId: string,
  reason: 'inappropriate_content' | 'harassment' | 'conflict_of_interest' | 'false_information' | 'private_contact_info' | 'other' | string,
  details?: string
): Promise<{ success: boolean; report_id: string }> {
  if (USE_MOCKS.profiles) {
    const rev = mockReviews.find((r) => r.id === reviewId);
    if (!rev) {
      throw new Error('Review not found.');
    }
    const reportId = `rep-${Date.now()}`;
    mockReports.push({
      id: reportId,
      review_id: reviewId,
      reporter_id: 'current-user',
      reason,
      details,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    return { success: true, report_id: reportId };
  }

  const { data, error } = await (supabase.rpc as any)('report_review', {
    p_review_id: reviewId,
    p_reason: reason,
    p_details: details || null
  });

  if (error) {
    throw new Error(error.message || 'Could not report review.');
  }

  return data;
}

/**
 * Admin action to hide a review with audit logging
 */
export async function hideReview(reviewId: string, reason: string): Promise<{ success: boolean; review_id: string; status: string }> {
  if (USE_MOCKS.profiles) {
    const rev = mockReviews.find((r) => r.id === reviewId);
    if (!rev) {
      throw new Error('Review not found.');
    }
    rev.status = 'hidden';
    return { success: true, review_id: reviewId, status: 'hidden' };
  }

  const { data, error } = await (supabase.rpc as any)('hide_review', {
    p_review_id: reviewId,
    p_reason: reason
  });

  if (error) {
    throw new Error(error.message || 'Could not hide review.');
  }

  return data;
}

/**
 * Admin action to restore a hidden review
 */
export async function restoreReview(reviewId: string): Promise<{ success: boolean; review_id: string; status: string }> {
  if (USE_MOCKS.profiles) {
    const rev = mockReviews.find((r) => r.id === reviewId);
    if (!rev) {
      throw new Error('Review not found.');
    }
    rev.status = rev.revealed_at ? 'visible' : 'pending';
    return { success: true, review_id: reviewId, status: rev.status };
  }

  const { data, error } = await (supabase.rpc as any)('restore_review', {
    p_review_id: reviewId
  });

  if (error) {
    throw new Error(error.message || 'Could not restore review.');
  }

  return data;
}

/**
 * Maintenance job: Reveals pending review pairs when both exist OR when 14-day window closes,
 * strictly withholding if an open dispute exists.
 */
export async function revealPendingReviews(): Promise<{ success: boolean; revealed_count: number }> {
  if (USE_MOCKS.profiles) {
    let count = 0;
    const now = Date.now();
    const windowMs = REVIEW_SETTINGS.REVIEW_WINDOW_DAYS * 86400000;

    // Group pending reviews by engagement
    const pendingByEng: Record<string, ReviewItem[]> = {};
    for (const r of mockReviews) {
      if (r.status === 'pending') {
        if (!pendingByEng[r.engagement_id]) pendingByEng[r.engagement_id] = [];
        pendingByEng[r.engagement_id].push(r);
      }
    }

    for (const [engId, revs] of Object.entries(pendingByEng)) {
      const eng = mockEngagements[engId];
      if (!eng || eng.status !== 'completed') continue;

      const hasOpenDispute = (mockDisputes[engId] || []).some((d) => d.status === 'open');
      if (hasOpenDispute) continue; // Dispute blocks reveal

      const bothSubmitted = revs.length >= 2;
      const windowExpired = now >= new Date(eng.completed_at).getTime() + windowMs;

      if (bothSubmitted || windowExpired) {
        const revealedAt = new Date().toISOString();
        for (const r of revs) {
          r.status = 'visible';
          r.revealed_at = revealedAt;
          count++;
        }
      }
    }

    return { success: true, revealed_count: count };
  }

  const { data, error } = await (supabase.rpc as any)('reveal_pending_reviews');
  if (error) {
    throw new Error(error.message || 'Could not execute reveal_pending_reviews.');
  }

  return data || { success: true, revealed_count: 0 };
}

/**
 * Retrieves visible, revealed reviews for a user (designer or client) with masked display names
 */
export async function getReviews(userId: string, role: 'designer' | 'client' = 'designer'): Promise<ReviewItem[]> {
  if (USE_MOCKS.profiles) {
    return mockReviews
      .filter((r) => {
        const matchesTarget = role === 'designer' ? r.designer_id === userId || r.reviewee_id === userId : r.client_id === userId || r.reviewee_id === userId;
        return matchesTarget && r.status === 'visible' && r.revealed_at !== null;
      })
      .map((r) => ({
        ...r,
        reviewer_name: maskDisplayName(r.reviewer_name || (r.reviewer_role === 'client' ? 'Client' : 'Designer')),
        client_name: maskDisplayName(r.reviewer_name || (r.reviewer_role === 'client' ? 'Client' : 'Designer'))
      }));
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      engagement_id,
      reviewer_role,
      reviewer_id,
      reviewee_id,
      client_id,
      designer_id,
      rating,
      ratings,
      communication_rating,
      quality_rating,
      timeliness_rating,
      comment,
      would_work_again,
      would_hire_again,
      reply,
      designer_reply,
      replied_at,
      reply_editable_until,
      status,
      revealed_at,
      created_at,
      edited_at,
      profiles!reviewer_id(full_name)
    `)
    .eq('reviewee_id', userId)
    .eq('status', 'visible')
    .not('revealed_at', 'is', null)
    .order('created_at', { ascending: false });

  if (error || !data) {
    console.warn('Error fetching reviews:', error);
    return [];
  }

  return data.map((r: any) => {
    const rawName = r.profiles?.full_name || (r.reviewer_role === 'client' ? 'Client' : 'Designer');
    const masked = maskDisplayName(rawName);

    return {
      id: r.id,
      engagement_id: r.engagement_id,
      reviewer_role: r.reviewer_role,
      reviewer_id: r.reviewer_id,
      reviewee_id: r.reviewee_id,
      client_id: r.client_id,
      designer_id: r.designer_id,
      reviewer_name: masked,
      client_name: masked,
      rating: r.rating,
      ratings: r.ratings,
      communication_rating: r.communication_rating,
      quality_rating: r.quality_rating,
      timeliness_rating: r.timeliness_rating,
      comment: r.comment,
      would_work_again: r.would_work_again ?? r.would_hire_again ?? true,
      would_hire_again: r.would_work_again ?? r.would_hire_again ?? true,
      reply: r.reply || r.designer_reply,
      designer_reply: r.reply || r.designer_reply,
      replied_at: r.replied_at,
      reply_editable_until: r.reply_editable_until,
      status: r.status,
      revealed_at: r.revealed_at,
      created_at: r.created_at,
      edited_at: r.edited_at
    };
  });
}

/**
 * Checks review status for an engagement:
 * - Can current user review?
 * - Have they reviewed already? (and can they edit?)
 * - Has the counterpart submitted?
 * - Are reviews revealed?
 * - Days remaining in the 14-day window
 */
export async function getEngagementReviewStatus(
  engagementId: string,
  userId?: string
): Promise<EngagementReviewStatus> {
  if (USE_MOCKS.profiles) {
    const eng = mockEngagements[engagementId];
    if (!eng) {
      return {
        canReview: false,
        cannotReviewReason: 'Engagement not found.',
        userReview: null,
        counterpartSubmitted: false,
        isRevealed: false,
        daysRemaining: 0,
        hasOpenDispute: false
      };
    }

    const currentUserId = userId || eng.client_id;
    const role: 'client' | 'designer' = currentUserId === eng.client_id ? 'client' : 'designer';
    const hasOpenDispute = (mockDisputes[engagementId] || []).some((d) => d.status === 'open');

    const engRevs = mockReviews.filter((r) => r.engagement_id === engagementId);
    const userRev = engRevs.find((r) => r.reviewer_role === role) || null;
    const counterpartRev = engRevs.find((r) => r.reviewer_role !== role) || null;

    const completedMs = new Date(eng.completed_at).getTime();
    const windowMs = REVIEW_SETTINGS.REVIEW_WINDOW_DAYS * 86400000;
    const msRemaining = Math.max(0, completedMs + windowMs - Date.now());
    const daysRemaining = Math.ceil(msRemaining / 86400000);
    const windowExpired = msRemaining <= 0;

    let canReview = true;
    let cannotReviewReason = '';

    if (eng.status !== 'completed') {
      canReview = false;
      cannotReviewReason = 'Engagement must be completed to leave a review.';
    } else if (!eng.has_approved_payment || !eng.all_milestones_approved) {
      canReview = false;
      cannotReviewReason = 'All milestones must be approved before reviewing.';
    } else if (windowExpired && !userRev) {
      canReview = false;
      cannotReviewReason = 'The 14-day review window has closed.';
    }

    const isRevealed = userRev?.status === 'visible' || counterpartRev?.status === 'visible';

    return {
      canReview,
      cannotReviewReason: cannotReviewReason || undefined,
      userReview: userRev,
      counterpartSubmitted: Boolean(counterpartRev),
      isRevealed,
      daysRemaining,
      hasOpenDispute,
      role,
      completedAt: eng.completed_at || undefined
    };
  }

  // Live Supabase query
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = userId || user?.id;

    const { data: eng, error: engErr } = await supabase
      .from('engagements')
      .select('id, client_id, designer_id, status, completed_at, cancelled_at')
      .eq('id', engagementId)
      .single();

    if (engErr || !eng) {
      return {
        canReview: false,
        cannotReviewReason: 'Engagement not found.',
        userReview: null,
        counterpartSubmitted: false,
        isRevealed: false,
        daysRemaining: 0,
        hasOpenDispute: false
      };
    }

    const role: 'client' | 'designer' = currentUserId === eng.client_id ? 'client' : 'designer';

    const { data: revs } = await supabase
      .from('reviews')
      .select('*')
      .eq('engagement_id', engagementId);

    const userRev = (revs || []).find((r: any) => r.reviewer_id === currentUserId || r.reviewer_role === role) || null;
    const counterpartRev = (revs || []).find((r: any) => r.reviewer_id !== currentUserId && r.reviewer_role !== role) || null;

    const { data: disputes } = await supabase
      .from('disputes')
      .select('id')
      .eq('engagement_id', engagementId)
      .eq('status', 'open');

    const hasOpenDispute = Boolean(disputes && disputes.length > 0);

    const completedMs = eng.completed_at ? new Date(eng.completed_at).getTime() : Date.now();
    const windowMs = REVIEW_SETTINGS.REVIEW_WINDOW_DAYS * 86400000;
    const msRemaining = Math.max(0, completedMs + windowMs - Date.now());
    const daysRemaining = Math.ceil(msRemaining / 86400000);
    const windowExpired = msRemaining <= 0;

    let canReview = true;
    let cannotReviewReason = '';

    if (eng.status !== 'completed' || eng.cancelled_at) {
      canReview = false;
      cannotReviewReason = 'Reviews exist only for completed engagements.';
    } else if (windowExpired && !userRev) {
      canReview = false;
      cannotReviewReason = 'The 14-day review window has closed.';
    }

    const isRevealed = Boolean(userRev?.revealed_at || counterpartRev?.revealed_at);

    return {
      canReview,
      cannotReviewReason: cannotReviewReason || undefined,
      userReview: userRev as ReviewItem | null,
      counterpartSubmitted: Boolean(counterpartRev),
      isRevealed,
      daysRemaining,
      hasOpenDispute,
      role,
      completedAt: eng.completed_at || undefined
    };
  } catch (err: any) {
    return {
      canReview: false,
      cannotReviewReason: err.message,
      userReview: null,
      counterpartSubmitted: false,
      isRevealed: false,
      daysRemaining: 0,
      hasOpenDispute: false
    };
  }
}
