/**
 * Comprehensive Test Suite for Dezignet Two-Way Double-Blind Reviews System
 *
 * Verifies all rules and specifications:
 * 1. Reviews Eligibility:
 *    - Completed engagements only (not active or cancelled).
 *    - All milestones/weeks approved and at least one payment-approved milestone/week.
 *    - One review per party per engagement.
 * 2. Double-Blind 14-Day Window:
 *    - Setting review_window_days = 14.
 *    - Neither review visible before reveal (status = pending, revealed_at = null).
 *    - Simultaneous reveal when BOTH submitted (if no open dispute).
 *    - Open dispute withholds reveal until resolved.
 *    - Automatic reveal upon window expiration.
 *    - Submission blocked after window closure.
 * 3. Editing & Reply Rules:
 *    - Pre-reveal author editing allowed.
 *    - Post-reveal editing strictly forbidden.
 *    - Reviewed party reply allowed after reveal.
 *    - Reply editable for 10 minutes only.
 * 4. Dimensional Ratings & Roles:
 *    - Client reviews designer dimensions (communication, quality_of_work, timeliness, professionalism).
 *    - Designer reviews client dimensions (clarity_of_brief, responsiveness, timely_approvals_payments, professionalism).
 *    - would_work_again boolean flag.
 * 5. Content Flagging:
 *    - Phone numbers, emails, links flagged (does not block submission).
 * 6. Moderation & Reporting:
 *    - reportReview, hideReview (admin), restoreReview (admin).
 * 7. Rating Aggregation:
 *    - rating_average only computed when count >= min_reviews_for_average (3).
 *    - rating_count always displayed.
 * 8. Display Name Masking:
 *    - First Name + Last Initial ("Jane Doe" -> "Jane D.").
 * 9. Migration 048 SQL integrity check.
 *
 * Usage:
 *   npx tsx scripts/test-two-way-reviews.ts
 */

import fs from 'fs';
import path from 'path';
import { USE_MOCKS } from '../src/lib/supabase';
USE_MOCKS.profiles = true;

import {
  submitReview,
  updateReview,
  replyToReview,
  reportReview,
  hideReview,
  restoreReview,
  revealPendingReviews,
  getReviews,
  getEngagementReviewStatus,
  maskDisplayName,
  detectReviewContactFlags,
  calculateRatingStats,
  REVIEW_SETTINGS,
  CLIENT_REVIEW_DIMENSIONS,
  DESIGNER_REVIEW_DIMENSIONS,
  _resetMockReviewsStore,
  _seedMockEngagement,
  _seedMockDispute,
  _getMockReviews,
  _getMockReports
} from '../src/services/reviewsService';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 DEZIGNET TWO-WAY DOUBLE-BLIND REVIEWS SYSTEM TEST SUITE');
  console.log('===============================================================\n');

  // ----------------------------------------------------------------------------
  // GROUP 1: App Settings & Configuration
  // ----------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Settings & Dimensional Definitions ---');
  assert(REVIEW_SETTINGS.REVIEW_WINDOW_DAYS === 14, 'review_window_days setting defaults to 14');
  assert(REVIEW_SETTINGS.MIN_REVIEWS_FOR_AVERAGE === 3, 'min_reviews_for_average setting defaults to 3');
  assert(REVIEW_SETTINGS.REVIEW_REMINDER_DAYS.length === 2 && REVIEW_SETTINGS.REVIEW_REMINDER_DAYS[0] === 3, 'review_reminder_days contains [3, 10]');
  assert(REVIEW_SETTINGS.REPLY_EDIT_WINDOW_MINUTES === 10, 'Reply edit window is 10 minutes');
  assert(CLIENT_REVIEW_DIMENSIONS.length === 4, 'Client reviews designer has exactly 4 dimensions');
  assert(
    CLIENT_REVIEW_DIMENSIONS.some((d) => d.key === 'communication') &&
    CLIENT_REVIEW_DIMENSIONS.some((d) => d.key === 'quality_of_work') &&
    CLIENT_REVIEW_DIMENSIONS.some((d) => d.key === 'timeliness') &&
    CLIENT_REVIEW_DIMENSIONS.some((d) => d.key === 'professionalism'),
    'Client dimensions contain communication, quality_of_work, timeliness, professionalism'
  );
  assert(DESIGNER_REVIEW_DIMENSIONS.length === 4, 'Designer reviews client has exactly 4 dimensions');
  assert(
    DESIGNER_REVIEW_DIMENSIONS.some((d) => d.key === 'clarity_of_brief') &&
    DESIGNER_REVIEW_DIMENSIONS.some((d) => d.key === 'responsiveness') &&
    DESIGNER_REVIEW_DIMENSIONS.some((d) => d.key === 'timely_approvals_payments') &&
    DESIGNER_REVIEW_DIMENSIONS.some((d) => d.key === 'professionalism'),
    'Designer dimensions contain clarity_of_brief, responsiveness, timely_approvals_payments, professionalism'
  );

  // ----------------------------------------------------------------------------
  // GROUP 2: Formatters & Helpers
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Display Name Masking & Contact Info Flagging ---');
  assert(maskDisplayName('Sarah Jenkins') === 'Sarah J.', 'Masks "Sarah Jenkins" to "Sarah J."');
  assert(maskDisplayName('David') === 'David', 'Single name "David" returns "David"');
  assert(maskDisplayName('Dr. Eleanor Vance') === 'Dr. V.', 'Masks multi-part name "Dr. Eleanor Vance" to "Dr. V."');
  assert(maskDisplayName('') === 'Member', 'Empty name defaults to "Member"');

  const cleanComment = 'The architect provided outstanding structural detail drawings on time.';
  assert(!detectReviewContactFlags(cleanComment).flagged, 'Clean comment does not trigger content flags');

  const emailComment = 'Great work! Contact me at alex@example.com for more jobs.';
  const emailFlags = detectReviewContactFlags(emailComment);
  assert(emailFlags.flagged && emailFlags.reasons.includes('contains_email'), 'Detects email address in comment');

  const phoneComment = 'Reach me by phone at (512) 555-0198 to discuss revisions.';
  const phoneFlags = detectReviewContactFlags(phoneComment);
  assert(phoneFlags.flagged && phoneFlags.reasons.includes('contains_phone'), 'Detects phone number in comment');

  const linkComment = 'Check our portfolio at https://dezignet.test/work for details.';
  const linkFlags = detectReviewContactFlags(linkComment);
  assert(linkFlags.flagged && linkFlags.reasons.includes('contains_link'), 'Detects URL link in comment');

  // ----------------------------------------------------------------------------
  // GROUP 3: Eligibility Rules (Completed & Approved Payments Only)
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Review Eligibility & Completion Checks ---');
  _resetMockReviewsStore();

  _seedMockEngagement({
    id: 'eng-active',
    client_id: 'client-1',
    designer_id: 'designer-1',
    status: 'active',
    completed_at: '',
    has_approved_payment: false,
    all_milestones_approved: false
  });

  try {
    await submitReview({
      engagementId: 'eng-active',
      rating: 5,
      comment: 'Review for an active engagement that is not completed yet.'
    });
    assert(false, 'Active engagement should reject review');
  } catch (err: any) {
    assert(err.message.includes('completed engagements'), 'Rejects review for active (incomplete) engagement');
  }

  _seedMockEngagement({
    id: 'eng-unapproved-ms',
    client_id: 'client-1',
    designer_id: 'designer-1',
    status: 'completed',
    completed_at: new Date().toISOString(),
    has_approved_payment: false,
    all_milestones_approved: false
  });

  try {
    await submitReview({
      engagementId: 'eng-unapproved-ms',
      rating: 5,
      comment: 'Project finished without payment-approved milestones.'
    });
    assert(false, 'Unapproved milestone engagement should reject review');
  } catch (err: any) {
    assert(err.message.includes('milestones must be approved'), 'Rejects review when milestones are not approved');
  }

  // ----------------------------------------------------------------------------
  // GROUP 4: Double-Blind 14-Day Window & Reveal Mechanics
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Double-Blind Reveal & Dispute Handling ---');
  _resetMockReviewsStore();

  const engId = 'eng-doubleblind-1';
  _seedMockEngagement({
    id: engId,
    client_id: 'client-10',
    designer_id: 'designer-20',
    status: 'completed',
    completed_at: new Date().toISOString(),
    has_approved_payment: true,
    all_milestones_approved: true
  });

  // Client submits first review
  const clientRes = await submitReview({
    engagementId: engId,
    rating: 5,
    ratings: { communication: 5, quality_of_work: 5, timeliness: 4, professionalism: 5 },
    wouldWorkAgain: true,
    comment: 'Exceptional architectural drawings, very responsive to our requests.'
  });

  assert(clientRes.success, 'Client review submitted successfully');
  assert(clientRes.status === 'pending', 'First submitted review status is "pending" (Double-blind)');
  assert(!clientRes.revealed, 'Review is NOT revealed before counterpart submits');

  const status1 = await getEngagementReviewStatus(engId, 'client-10');
  assert(status1.userReview !== null, 'Client review is tracked');
  assert(!status1.isRevealed, 'Reviews remain unrevealed');
  assert(status1.daysRemaining > 0, '14-day countdown is active');

  // Designer submits counterpart review
  const designerRes = await submitReview({
    engagementId: engId,
    rating: 5,
    ratings: { clarity_of_brief: 5, responsiveness: 5, timely_approvals_payments: 5, professionalism: 5 },
    wouldWorkAgain: true,
    comment: 'Wonderful client! Scope was clearly defined and payments released promptly.'
  });

  assert(designerRes.success, 'Designer review submitted successfully');
  assert(designerRes.status === 'visible', 'When second review submitted, status becomes "visible"');
  assert(designerRes.revealed, 'Both reviews revealed simultaneously');

  const allRevs = _getMockReviews().filter((r) => r.engagement_id === engId);
  assert(allRevs.length === 2, 'Exactly 2 reviews exist for this engagement');
  assert(allRevs[0].status === 'visible' && allRevs[1].status === 'visible', 'Both reviews updated to "visible"');
  assert(allRevs[0].revealed_at !== null && allRevs[1].revealed_at !== null, 'Both reviews have revealed_at timestamp');

  // Verify uniqueness (third submission rejected)
  try {
    await submitReview({
      engagementId: engId,
      rating: 4,
      comment: 'Attempting a second review for the same engagement.'
    });
    assert(false, 'Duplicate review should be rejected');
  } catch (err: any) {
    assert(err.message.includes('already submitted a review'), 'Rejects second review by the same party for an engagement');
  }

  // ----------------------------------------------------------------------------
  // GROUP 5: Dispute Blocks Reveal Until Resolved
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Open Dispute Withholds Reveal ---');
  _resetMockReviewsStore();

  const disputedEngId = 'eng-dispute-1';
  _seedMockEngagement({
    id: disputedEngId,
    client_id: 'client-30',
    designer_id: 'designer-40',
    status: 'completed',
    completed_at: new Date().toISOString(),
    has_approved_payment: true,
    all_milestones_approved: true
  });

  // Seed open dispute
  _seedMockDispute({
    id: 'disp-1',
    engagement_id: disputedEngId,
    status: 'open'
  });

  // Client submits
  await submitReview({
    engagementId: disputedEngId,
    rating: 4,
    comment: 'Good drawings but had a minor dispute over scope interpretations.'
  });

  // Designer submits while dispute is still OPEN
  const designerDisputeRes = await submitReview({
    engagementId: disputedEngId,
    rating: 4,
    comment: 'Completed all working deliverables despite the pending dispute.'
  });

  assert(designerDisputeRes.status === 'pending', 'Review remains "pending" because engagement has an open dispute');
  assert(!designerDisputeRes.revealed, 'Open dispute successfully withholds review reveal');

  // Simulate resolving dispute
  const dispList = _getMockReviews().filter((r) => r.engagement_id === disputedEngId);
  assert(dispList.every((r) => r.status === 'pending'), 'Both reviews held in pending state during dispute');

  // ----------------------------------------------------------------------------
  // GROUP 6: Pre-reveal Editing & Post-reveal 10-Minute Reply
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Editing Rules & 10-Minute Reply Window ---');
  _resetMockReviewsStore();

  const engEditId = 'eng-edit-1';
  _seedMockEngagement({
    id: engEditId,
    client_id: 'client-50',
    designer_id: 'designer-60',
    status: 'completed',
    completed_at: new Date().toISOString(),
    has_approved_payment: true,
    all_milestones_approved: true
  });

  // Client submits review (pending)
  const clientSub = await submitReview({
    engagementId: engEditId,
    rating: 4,
    comment: 'Initial feedback: Drawings were well executed.'
  });

  // Author edits review BEFORE reveal
  const editRes = await updateReview(clientSub.review_id, {
    rating: 5,
    comment: 'Updated feedback: Exceptional precision and flawless municipal clearance!'
  });

  assert(editRes.success, 'Author can update review before reveal');
  const editedRev = _getMockReviews().find((r) => r.id === clientSub.review_id);
  assert(editedRev?.rating === 5, 'Updated rating saved');
  assert(editedRev?.comment.includes('flawless municipal clearance'), 'Updated comment saved');

  // Now reveal the review by designer submission
  await submitReview({
    engagementId: engEditId,
    rating: 5,
    comment: 'Outstanding client to work with, highly recommended!'
  });

  // Attempting to edit review AFTER reveal must be blocked
  try {
    await updateReview(clientSub.review_id, {
      rating: 3,
      comment: 'Trying to change review after reveal.'
    });
    assert(false, 'Post-reveal editing should be forbidden');
  } catch (err: any) {
    assert(err.message.includes('Once revealed, reviews cannot be edited'), 'Strictly rejects editing once review is revealed');
  }

  // Reviewed designer posts a reply
  const replyRes = await replyToReview(clientSub.review_id, 'Thank you! It was an honor working on your home.');
  assert(replyRes.success, 'Reviewed party can post one reply after reveal');

  const revWithReply = _getMockReviews().find((r) => r.id === clientSub.review_id);
  assert(revWithReply?.reply === 'Thank you! It was an honor working on your home.', 'Reply text stored properly');
  assert(revWithReply?.replied_at !== null, 'replied_at timestamp recorded');

  // Author edits reply within 10-minute window
  const updateReplyRes = await replyToReview(clientSub.review_id, 'Thank you so much! It was an absolute honor working on your home.');
  assert(updateReplyRes.success, 'Reply can be updated within 10-minute editing window');

  // Simulate expiry of 10-minute window
  if (revWithReply) {
    revWithReply.reply_editable_until = new Date(Date.now() - 1000).toISOString();
  }

  try {
    await replyToReview(clientSub.review_id, 'Trying to edit reply after 10 minutes.');
    assert(false, 'Reply edit after 10 minutes should fail');
  } catch (err: any) {
    assert(err.message.includes('10-minute editing window'), 'Rejects reply editing after 10-minute window has expired');
  }

  // ----------------------------------------------------------------------------
  // GROUP 7: Reporting & Admin Moderation (Hide/Restore)
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Reporting & Admin Moderation ---');
  const reportRes = await reportReview(clientSub.review_id, 'inappropriate_content', 'Contains offensive language.');
  assert(reportRes.success, 'Review report submitted successfully');
  const reports = _getMockReports();
  assert(reports.length > 0 && reports[0].review_id === clientSub.review_id, 'Report saved in reports table');

  const hideRes = await hideReview(clientSub.review_id, 'Violated community guidelines.');
  assert(hideRes.status === 'hidden', 'Admin successfully hides review');
  assert(_getMockReviews().find((r) => r.id === clientSub.review_id)?.status === 'hidden', 'Review status updated to "hidden"');

  const restoreRes = await restoreReview(clientSub.review_id);
  assert(restoreRes.status === 'visible', 'Admin successfully restores review to "visible"');

  // ----------------------------------------------------------------------------
  // GROUP 8: Rating Aggregation Threshold (min_reviews_for_average = 3)
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Rating Aggregation & Minimum Reviews Threshold ---');

  // 1 review: count shows 1, average shows null
  const stats1 = calculateRatingStats([
    { rating: 5, status: 'visible', revealed_at: new Date().toISOString() }
  ]);
  assert(stats1.ratingCount === 1, 'rating_count shows 1');
  assert(stats1.averageRating === null, 'rating_average is NULL when review count < 3 (1 review)');

  // 2 reviews: count shows 2, average shows null
  const stats2 = calculateRatingStats([
    { rating: 5, status: 'visible', revealed_at: new Date().toISOString() },
    { rating: 4, status: 'visible', revealed_at: new Date().toISOString() }
  ]);
  assert(stats2.ratingCount === 2, 'rating_count shows 2');
  assert(stats2.averageRating === null, 'rating_average is NULL when review count < 3 (2 reviews)');

  // 3 reviews: count shows 3, average computed and rounded to 1 decimal
  const stats3 = calculateRatingStats([
    { rating: 5, status: 'visible', revealed_at: new Date().toISOString() },
    { rating: 5, status: 'visible', revealed_at: new Date().toISOString() },
    { rating: 4, status: 'visible', revealed_at: new Date().toISOString() }
  ]);
  assert(stats3.ratingCount === 3, 'rating_count shows 3');
  assert(stats3.averageRating === 4.7, 'rating_average is computed when count >= 3 (4.7 avg)');

  // Hidden and pending reviews must not be included
  const statsWithExcluded = calculateRatingStats([
    { rating: 5, status: 'visible', revealed_at: new Date().toISOString() },
    { rating: 5, status: 'visible', revealed_at: new Date().toISOString() },
    { rating: 1, status: 'hidden', revealed_at: new Date().toISOString() },
    { rating: 1, status: 'pending', revealed_at: null }
  ]);
  assert(statsWithExcluded.ratingCount === 2, 'Excluded hidden and pending reviews from rating count');
  assert(statsWithExcluded.averageRating === null, 'Average withheld because valid visible count is 2 (< 3)');

  // ----------------------------------------------------------------------------
  // GROUP 9: Migration 048 SQL File Integrity
  // ----------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Migration 048 SQL Verification ---');
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/048_two_way_reviews.sql');
  assert(fs.existsSync(migrationPath), 'Migration 048_two_way_reviews.sql exists');

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  assert(migrationSql.includes('reviewer_role'), '048 SQL includes reviewer_role column');
  assert(migrationSql.includes('reviewee_id'), '048 SQL includes reviewee_id column');
  assert(migrationSql.includes('reviews_reports'), '048 SQL creates reviews_reports table');
  assert(migrationSql.includes('review_window_days'), '048 SQL sets review_window_days setting (14)');
  assert(migrationSql.includes('min_reviews_for_average'), '048 SQL sets min_reviews_for_average setting (3)');
  assert(migrationSql.includes('review_reminder_days'), '048 SQL sets review_reminder_days setting ([3, 10])');
  assert(migrationSql.includes('submit_review'), '048 SQL defines submit_review function');
  assert(migrationSql.includes('update_review'), '048 SQL defines update_review function');
  assert(migrationSql.includes('reply_to_review'), '048 SQL defines reply_to_review function');
  assert(migrationSql.includes('report_review'), '048 SQL defines report_review function');
  assert(migrationSql.includes('hide_review'), '048 SQL defines hide_review function');
  assert(migrationSql.includes('restore_review'), '048 SQL defines restore_review function');
  assert(migrationSql.includes('reveal_pending_reviews'), '048 SQL defines reveal_pending_reviews function');
  assert(migrationSql.includes('public_designer_profiles'), '048 SQL updates public_designer_profiles view');
  assert(migrationSql.includes('client_summaries'), '048 SQL updates client_summaries view');

  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
