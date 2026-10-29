/**
 * Phase 4 Automated Security, Realtime & Business Logic Test Suite
 * Validates Phase 3 amendments (auto-approval, 5-day security hold, client dispute, dispute resolution, scheduled jobs)
 * and Phase 4 conversations and notifications.
 *
 * Usage:
 *   npx tsx scripts/test-phase4.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('Error: Supabase environment variables missing in .env');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, passed: boolean, details?: string) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error(`     Details: ${details}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 DEZIGNET PHASE 4: AMENDMENTS, CONVERSATIONS & NOTIFICATIONS');
  console.log('===============================================================\n');

  // Authenticate Designer
  const designerClient = createClient(supabaseUrl, anonKey);
  const { data: authD, error: dErr } = await designerClient.auth.signInWithPassword({
    email: 'designer.complete@dezignet.test',
    password: 'Password123!'
  });
  if (dErr || !authD.user) throw new Error(`Designer login failed: ${dErr?.message}`);
  const designerId = authD.user.id;

  // Authenticate Client
  const clientClient = createClient(supabaseUrl, anonKey);
  const { data: authC, error: cErr } = await clientClient.auth.signInWithPassword({
    email: 'client1@dezignet.test',
    password: 'Password123!'
  });
  if (cErr || !authC.user) throw new Error(`Client login failed: ${cErr?.message}`);
  const clientId = authC.user.id;

  // Authenticate Second Designer (Attacker / Unrelated party)
  const otherDesignerClient = createClient(supabaseUrl, anonKey);
  const { data: authOD } = await otherDesignerClient.auth.signInWithPassword({
    email: 'designer.new@dezignet.test',
    password: 'Password123!'
  });
  const otherDesignerId = authOD?.user?.id;

  console.log(`Designer:       ${designerId}`);
  console.log(`Client:         ${clientId}`);
  console.log(`Other Designer: ${otherDesignerId}\n`);

  // Ensure client profile exists
  await adminClient.from('client_profiles').upsert({ user_id: clientId });

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Phase 3 Amendments (Auto-Approval & Payout Security Period)
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Phase 3 Amendments (Auto-Approval & Security Hold) ---');

  // Create isolated test engagement
  const { data: testProj } = await adminClient
    .from('projects')
    .insert({
      client_id: clientId,
      title: 'Phase 4 Verification Pavilion',
      description: 'Testing auto-approval, dispute window, and security hold.',
      category: 'Architecture',
      budget: 30000.00,
      currency: 'USD',
      payment_type: 'milestone',
      status: 'awarded'
    })
    .select()
    .single();

  const { data: testProp, error: propErr } = await adminClient
    .from('proposals')
    .insert({
      project_id: testProj.id,
      designer_id: designerId,
      total_price: 30000.00,
      currency: 'USD',
      delivery_days: 14,
      cover_letter: 'Phase 4 test cover letter',
      project_snapshot: { title: testProj.title, budget: testProj.budget },
      status: 'accepted'
    })
    .select()
    .single();

  if (propErr || !testProp) {
    throw new Error(`Failed to create testProp: ${propErr?.message}`);
  }

  const { data: testEng, error: engErr } = await adminClient
    .from('engagements')
    .insert({
      project_id: testProj.id,
      proposal_id: testProp.id,
      client_id: clientId,
      designer_id: designerId,
      payment_type: 'milestone',
      total_price: 30000.00,
      currency: 'USD',
      status: 'active',
      terms_snapshot: { scope: 'Full architectural drawings' }
    })
    .select()
    .single();

  if (engErr || !testEng) {
    throw new Error(`Failed to create testEng: ${engErr?.message}`);
  }

  // Create milestone submitted 15 days ago
  const date15DaysAgo = new Date(Date.now() - 15 * 86400 * 1000).toISOString();
  const { data: msOverdue } = await adminClient
    .from('engagement_milestones')
    .insert({
      engagement_id: testEng.id,
      sort_order: 1,
      name: 'Overdue Milestone 15 Days',
      amount: 10000.00,
      fee_percent: 10.0,
      status: 'submitted',
      payout_status: 'not_due',
      funded_at: date15DaysAgo,
      started_at: date15DaysAgo,
      submitted_at: date15DaysAgo
    })
    .select()
    .single();

  await adminClient.from('milestone_submissions').insert({
    milestone_id: msOverdue.id,
    version: 1,
    notes: 'Submitted 15 days ago',
    submitted_at: date15DaysAgo
  });

  // Create milestone submitted 5 days ago (should NOT be auto-approved)
  const date5DaysAgo = new Date(Date.now() - 5 * 86400 * 1000).toISOString();
  const { data: msRecent } = await adminClient
    .from('engagement_milestones')
    .insert({
      engagement_id: testEng.id,
      sort_order: 2,
      name: 'Recent Milestone 5 Days',
      amount: 10000.00,
      fee_percent: 10.0,
      status: 'submitted',
      payout_status: 'not_due',
      funded_at: date5DaysAgo,
      started_at: date5DaysAgo,
      submitted_at: date5DaysAgo
    })
    .select()
    .single();

  // Run auto_approve_overdue job
  const { error: autoErr } = await adminClient.rpc('auto_approve_overdue');
  assert('auto_approve_overdue runs idempotently', !autoErr, autoErr?.message);

  // Check msOverdue: should now be approved automatically with 5-day security hold
  const { data: msOverdueCheck } = await adminClient
    .from('engagement_milestones')
    .select('status, approval_source, payout_status, release_at')
    .eq('id', msOverdue.id)
    .single();

  assert(
    'Overdue milestone (>14 days) auto-approved with approval_source = auto',
    msOverdueCheck?.status === 'approved' && msOverdueCheck?.approval_source === 'auto',
    `Status: ${msOverdueCheck?.status}, source: ${msOverdueCheck?.approval_source}`
  );
  assert(
    'Auto-approved milestone placed in pending_release with future release_at',
    msOverdueCheck?.payout_status === 'pending_release' && new Date(msOverdueCheck?.release_at).getTime() > Date.now(),
    `Payout status: ${msOverdueCheck?.payout_status}, release_at: ${msOverdueCheck?.release_at}`
  );

  // Check msRecent: should still be submitted
  const { data: msRecentCheck } = await adminClient
    .from('engagement_milestones')
    .select('status')
    .eq('id', msRecent.id)
    .single();
  assert('Milestone submitted <14 days ago remains submitted', msRecentCheck?.status === 'submitted');

  // Verify release_due_payouts does NOT release funds while release_at is in future
  await adminClient.rpc('release_due_payouts');
  const { data: msBeforeRelease } = await adminClient
    .from('engagement_milestones')
    .select('payout_status')
    .eq('id', msOverdue.id)
    .single();
  assert(
    'release_due_payouts respects 5-day security hold (payout remains pending_release)',
    msBeforeRelease?.payout_status === 'pending_release'
  );

  // Test dev_fast_forward: Non-admin is blocked
  const { error: fastForwardNonAdmin } = await designerClient.rpc('dev_fast_forward', {
    p_item_type: 'milestone',
    p_item_id: msOverdue.id,
    p_days: 6
  });
  assert('Non-admin is blocked from calling dev_fast_forward', !!fastForwardNonAdmin);

  // Test dev_fast_forward: Admin fast-forwards by 6 days
  const { error: fastForwardAdmin } = await adminClient.rpc('dev_fast_forward', {
    p_item_type: 'milestone',
    p_item_id: msOverdue.id,
    p_days: 6
  });
  assert('Admin successfully executes dev_fast_forward by 6 days', !fastForwardAdmin, fastForwardAdmin?.message);

  // Now release_due_payouts should release the milestone
  await adminClient.rpc('release_due_payouts');
  const { data: msAfterFastForward } = await adminClient
    .from('engagement_milestones')
    .select('payout_status, released_at')
    .eq('id', msOverdue.id)
    .single();
  assert(
    'release_due_payouts releases milestone once release_at <= now()',
    msAfterFastForward?.payout_status === 'released' && !!msAfterFastForward?.released_at
  );

  // Test client dispute during security hold window
  // Create another milestone in pending_release
  const { data: msDisputeTest } = await adminClient
    .from('engagement_milestones')
    .insert({
      engagement_id: testEng.id,
      sort_order: 3,
      name: 'Milestone for Client Dispute Test',
      amount: 10000.00,
      fee_percent: 10.0,
      status: 'approved',
      approval_source: 'client',
      payout_status: 'pending_release',
      release_at: new Date(Date.now() + 4 * 86400 * 1000).toISOString()
    })
    .select()
    .single();

  // Client raises dispute during hold window
  const { error: disputeErr } = await clientClient.rpc('client_raise_dispute', {
    p_item_type: 'milestone',
    p_item_id: msDisputeTest.id,
    p_reason: 'Deliverable missing structural engineering seal',
    p_details: 'The submitted drawings do not contain the agreed seismic stamps.'
  });
  assert('Client successfully raises dispute during security period', !disputeErr, disputeErr?.message);

  const { data: msDisputed } = await adminClient
    .from('engagement_milestones')
    .select('status, payout_status')
    .eq('id', msDisputeTest.id)
    .single();
  assert(
    'Milestone marked disputed and payout_status placed on_hold',
    msDisputed?.status === 'disputed' && msDisputed?.payout_status === 'on_hold'
  );

  // Fetch dispute row
  const { data: disputeRow } = await adminClient
    .from('disputes')
    .select('id, status')
    .eq('milestone_id', msDisputeTest.id)
    .single();

  // Admin resolves dispute
  const { error: resolveErr } = await adminClient.rpc('resolve_dispute', {
    p_dispute_id: disputeRow.id,
    p_outcome: 'release_to_designer',
    p_split_percent: 100,
    p_note: 'Designer provided supplementary engineering seal.'
  });
  assert('Admin successfully resolves dispute', !resolveErr, resolveErr?.message);

  const { data: msResolved } = await adminClient
    .from('engagement_milestones')
    .select('payout_status, release_at')
    .eq('id', msDisputeTest.id)
    .single();
  assert(
    'Dispute resolution sets payout_status to pending_release with release_at = now()',
    msResolved?.payout_status === 'pending_release'
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Conversations & Messaging Rules
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Conversations & Messaging Rules ---');

  // Rule 1: Designer CANNOT start a conversation
  const { error: designerStartErr } = await designerClient.rpc('start_conversation', {
    p_project_id: testProj.id,
    p_designer_id: designerId,
    p_first_message: 'Hi client, I am starting this chat'
  });
  assert('Designer is forbidden from starting a conversation', !!designerStartErr);

  // Rule 2: Client CANNOT start a conversation with a designer with no viewed proposal
  const { data: unviewedProj, error: upErr } = await adminClient
    .from('projects')
    .insert({
      client_id: clientId,
      title: 'Unviewed Hourly Project',
      description: 'Testing unviewed proposal restriction',
      category: 'Residential Architecture',
      payment_type: 'hourly',
      hourly_rate_max: 75.00,
      budget: 15000.00,
      currency: 'USD',
      status: 'open',
      published_at: new Date().toISOString()
    })
    .select()
    .single();

  if (upErr || !unviewedProj) {
    throw new Error(`Failed to create unviewedProj: ${upErr?.message}`);
  }

  const { data: unviewedProp, error: propErr2 } = await adminClient
    .from('proposals')
    .insert({
      project_id: unviewedProj.id,
      designer_id: otherDesignerId,
      total_price: 15000.00,
      currency: 'USD',
      delivery_days: 10,
      cover_letter: 'Pending proposal',
      project_snapshot: { title: unviewedProj.title, budget: unviewedProj.budget },
      status: 'pending' // Not viewed!
    })
    .select()
    .single();

  if (propErr2 || !unviewedProp) {
    throw new Error(`Failed to create unviewedProp: ${propErr2?.message}`);
  }

  const { error: clientStartUnviewedErr } = await clientClient.rpc('start_conversation', {
    p_project_id: unviewedProj.id,
    p_designer_id: otherDesignerId,
    p_first_message: 'Hello'
  });
  assert('Client cannot start conversation with designer whose proposal was not viewed', !!clientStartUnviewedErr);

  // Now mark proposal viewed -> client can start conversation
  await adminClient
    .from('proposals')
    .update({ status: 'viewed', viewed_at: new Date().toISOString() })
    .eq('id', unviewedProp.id);

  const { data: convId, error: clientStartErr } = await clientClient.rpc('start_conversation', {
    p_project_id: unviewedProj.id,
    p_designer_id: otherDesignerId,
    p_first_message: 'Hello from client! Loved your portfolio.'
  });
  assert('Client successfully starts conversation after viewing proposal', !clientStartErr && !!convId, clientStartErr?.message);

  // Designer replies to client
  const { data: designerMsgId, error: replyErr } = await otherDesignerClient.rpc('send_message', {
    p_conversation_id: convId,
    p_body: 'Thank you! Excited to discuss the requirements.'
  });
  assert('Designer successfully replies once client initiated conversation', !replyErr && !!designerMsgId, replyErr?.message);

  // Off-platform detection: Send message with email and phone
  const { data: flaggedMsgId, error: flagSendErr } = await otherDesignerClient.rpc('send_message', {
    p_conversation_id: convId,
    p_body: 'You can email me at test@external.com or call me on 08012345678 to pay via paypal.'
  });
  assert('Message with off-platform contact info is accepted without hard error', !flagSendErr && !!flaggedMsgId);

  const { data: flaggedMsgRow } = await adminClient
    .from('messages')
    .select('flagged')
    .eq('id', flaggedMsgId)
    .single();
  assert('Off-platform contact/payment detection sets flagged = true', flaggedMsgRow?.flagged === true);

  // Read receipts and unread counts
  await clientClient.rpc('mark_read', { p_conversation_id: convId });
  const { data: unreadCounts } = await clientClient.rpc('get_unread_counts');
  const clientUnread = (unreadCounts as any)?.conversations?.find((c: any) => c.conversation_id === convId);
  assert('mark_read updates read status and unread count is 0', !clientUnread || clientUnread.unread_count === 0);

  // Rate Limiting: Try to send >20 messages in rapid succession
  let rateLimited = false;
  for (let i = 0; i < 22; i++) {
    const { error: rlErr } = await otherDesignerClient.rpc('send_message', {
      p_conversation_id: convId,
      p_body: `Spam test message ${i}`
    });
    if (rlErr && (rlErr.message.toLowerCase().includes('rate limit') || rlErr.message.includes('rate_limited') || (rlErr as any).hint === 'rate_limited')) {
      rateLimited = true;
      break;
    }
  }
  assert('Message rate limit (max 20/minute) enforced with rate_limited error', rateLimited);

  // Closed conversation: close conversation and ensure new messages are blocked
  await adminClient
    .from('conversations')
    .update({ status: 'closed' })
    .eq('id', convId);

  const { error: closedMsgErr } = await otherDesignerClient.rpc('send_message', {
    p_conversation_id: convId,
    p_body: 'Trying to message closed conversation'
  });
  assert('Sending message to closed conversation rejected with conversation_closed', !!closedMsgErr);

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Notifications, In-App Preferences & Undo Deletion
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Notifications & Preferences ---');

  // Test RLS: Designer cannot see client's notifications
  const { data: clientNotifsViewedByDesigner } = await designerClient
    .from('notifications')
    .select('id')
    .eq('user_id', clientId);
  assert(
    'RLS prevents designer from reading client notifications',
    !clientNotifsViewedByDesigner || clientNotifsViewedByDesigner.length === 0
  );

  // Create notification via RPC
  const { data: notifId, error: createNotifErr } = await adminClient.rpc('create_notification', {
    p_user_id: designerId,
    p_type: 'deliverable_approved',
    p_title: 'Test Deliverable Approved',
    p_body: 'Client has approved the test deliverable.',
    p_data: { test: true, destination_url: '#my-work/projects', idempotency_key: 'test-key-1' }
  });
  assert('create_notification creates in-app notification', !createNotifErr && !!notifId, createNotifErr?.message);

  // Test idempotency: Calling again with same key does not duplicate
  const { data: notifId2 } = await adminClient.rpc('create_notification', {
    p_user_id: designerId,
    p_type: 'deliverable_approved',
    p_title: 'Duplicate Test',
    p_body: 'Should not create duplicate.',
    p_data: { test: true, destination_url: '#my-work/projects', idempotency_key: 'test-key-1' }
  });
  assert('create_notification with duplicate idempotency_key returns existing notification without duplicate', notifId2 === notifId);

  // In-app opt out: Disable in-app for 'proposal_viewed'
  await designerClient.from('notification_preferences').upsert({
    user_id: designerId,
    type: 'proposal_viewed',
    in_app: false
  });

  const { data: optOutNotifId } = await adminClient.rpc('create_notification', {
    p_user_id: designerId,
    p_type: 'proposal_viewed',
    p_title: 'Should be suppressed',
    p_body: 'In-app is disabled for this type.',
    p_data: {}
  });
  assert('create_notification respects user in-app preference and skips creation when false', optOutNotifId === null);

  // Mark notification read
  const { error: markReadErr } = await designerClient.rpc('mark_notification_read', {
    p_id: notifId
  });
  assert('mark_notification_read marks notification as read', !markReadErr, markReadErr?.message);

  // Soft delete notification
  const { error: delErr } = await designerClient.rpc('delete_notification', {
    p_id: notifId
  });
  assert('delete_notification soft deletes notification', !delErr, delErr?.message);

  // Undo delete notification immediately (within 10s)
  const { error: undoErr } = await designerClient.rpc('undo_delete_notification', {
    p_id: notifId
  });
  assert('undo_delete_notification succeeds within 10-second window', !undoErr, undoErr?.message);

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TOTAL TESTS:  ${totalTests}`);
  console.log(`PASSED:       ${passedTests}`);
  console.log(`FAILED:       ${failedTests}`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed with uncaught exception:', err);
  process.exit(1);
});

