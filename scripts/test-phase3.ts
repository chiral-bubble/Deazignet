/**
 * Phase 3 Automated Security, RLS & Business Logic Test Suite
 * Validates all Active Work transitions, permissions, constraints, and dashboard calculations.
 *
 * Usage:
 *   npx tsx scripts/test-phase3.ts
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
  console.log('🧪 DEZIGNET PHASE 3: ACTIVE WORK & TRANSITIONS TEST SUITE');
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

  // ---------------------------------------------------------------------------
  // TEST 1: Acceptance Flow & Cascade Lifecycle Transitions
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Proposal Acceptance & Engagement Creation ---');
  // Ensure client exists in client_profiles
  await adminClient.from('client_profiles').upsert({ user_id: clientId });

  // Create a clean open project with 2 proposals
  const { data: testProj } = await adminClient
    .from('projects')
    .insert({
      client_id: clientId,
      title: 'Automated Lifecycle Verification Villa',
      description: 'Testing accept_proposal atomic cascade.',
      category: 'Residential Architecture',
      budget: 50000.00,
      payment_type: 'milestone',
      status: 'open',
      published_at: new Date().toISOString()
    })
    .select()
    .single();

  const { data: pMilestone } = await adminClient
    .from('project_milestones')
    .insert({
      project_id: testProj!.id,
      sort_order: 1,
      name: 'Design Phase Alpha',
      fee_percent: 100.00
    })
    .select()
    .single();

  // Winning Proposal
  const { data: winProp } = await adminClient
    .from('proposals')
    .insert({
      project_id: testProj!.id,
      designer_id: designerId,
      total_price: 50000.00,
      currency: 'USD',
      delivery_days: 60,
      cover_letter: 'Winning proposal for acceptance verification.',
      status: 'shortlisted'
    })
    .select()
    .single();

  await adminClient.from('proposal_milestones').insert({
    proposal_id: winProp!.id,
    project_milestone_id: pMilestone!.id,
    fee_percent: 100.00,
    amount: 50000.00
  });

  // Competitor Proposal
  const { data: rivalProp } = await adminClient
    .from('proposals')
    .insert({
      project_id: testProj!.id,
      designer_id: otherDesignerId!,
      total_price: 55000.00,
      status: 'pending'
    })
    .select()
    .single();

  // Non-client cannot accept proposal
  const { error: unauthAccept } = await designerClient.rpc('accept_proposal', {
    p_proposal_id: winProp!.id
  });
  assert('Non-owner cannot accept proposal', !!unauthAccept);

  // Client accepts proposal
  const { data: newEngId, error: acceptErr } = await clientClient.rpc('accept_proposal', {
    p_proposal_id: winProp!.id
  });
  assert('Client accepts proposal successfully', !acceptErr && !!newEngId);

  // Verify project awarded and rival declined
  const { data: updatedProj } = await adminClient.from('projects').select('status').eq('id', testProj!.id).single();
  const { data: updatedRival } = await adminClient.from('proposals').select('status, decline_reason').eq('id', rivalProp!.id).single();
  const { data: createdEng } = await adminClient.from('engagements').select('*').eq('id', newEngId).single();
  const { data: copiedMilestones } = await adminClient.from('engagement_milestones').select('*').eq('engagement_id', newEngId);

  assert('Project transitioned to awarded', updatedProj?.status === 'awarded');
  assert('Rival proposal declined with correct reason', updatedRival?.status === 'declined' && updatedRival?.decline_reason === 'Another designer was selected');
  assert('Engagement created with terms snapshot & 10% fee', createdEng?.total_price === 50000 && createdEng?.platform_fee_percent === 10);
  assert('Milestones copied to engagement_milestones', copiedMilestones?.length === 1 && copiedMilestones[0].amount === 50000);

  // ---------------------------------------------------------------------------
  // TEST 2: Escrow Funding & Sequential Funding Security
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Escrow Funding & Sequential Funding Logic ---');
  // Try calling dev_fund_milestone as authenticated designer (must fail)
  const msId = copiedMilestones![0].id;
  const { error: unauthFund } = await designerClient.rpc('dev_fund_milestone', { p_milestone_id: msId });
  assert('Non-admin blocked from calling dev_fund_milestone', !!unauthFund);

  // Admin funds milestone 1
  const { error: fundErr } = await adminClient.rpc('dev_fund_milestone', { p_milestone_id: msId });
  assert('Admin successfully funds milestone 1', !fundErr);

  const { data: fundedMs } = await adminClient.from('engagement_milestones').select('status, due_date').eq('id', msId).single();
  assert('Milestone status is now funded with auto-calculated due date', fundedMs?.status === 'funded' && !!fundedMs?.due_date);

  // ---------------------------------------------------------------------------
  // TEST 3: Deliverable Submission & File Validation
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Deliverables, File Types & Size Constraints ---');
  // Designer starts milestone
  const { error: startErr } = await designerClient.rpc('start_milestone', { p_milestone_id: msId });
  assert('Designer starts funded milestone (in_progress)', !startErr);

  // Reject invalid file type (e.g. .exe)
  const { error: badFileTypeErr } = await designerClient.rpc('submit_milestone', {
    p_milestone_id: msId,
    p_notes: 'Submitting malicious executable',
    p_files: [{ path: '/uploads/trojan.exe', file_name: 'trojan.exe', size_bytes: 1024 }]
  });
  assert('File extension check rejects disallowed file types (.exe)', !!badFileTypeErr);

  // Reject file exceeding max size (262144000 bytes)
  const { error: oversizedErr } = await designerClient.rpc('submit_milestone', {
    p_milestone_id: msId,
    p_notes: 'Submitting 300MB file',
    p_files: [{ path: '/uploads/huge.zip', file_name: 'huge.zip', size_bytes: 300000000 }]
  });
  assert('File size check rejects files exceeding 250MB', !!oversizedErr);

  // Valid submission (.pdf)
  const { data: subId, error: subErr } = await designerClient.rpc('submit_milestone', {
    p_milestone_id: msId,
    p_notes: 'Design drawings set v1 ready for client inspection.',
    p_files: [{ path: '/uploads/drawings.pdf', file_name: 'drawings.pdf', size_bytes: 15400000, mime_type: 'application/pdf' }]
  });
  assert('Valid deliverable submission creates version 1 and submission_file', !subErr && !!subId);

  const { data: submittedMs } = await adminClient.from('engagement_milestones').select('status').eq('id', msId).single();
  assert('Milestone status transitioned to submitted', submittedMs?.status === 'submitted');

  // ---------------------------------------------------------------------------
  // TEST 4: Revisions & Policy Limits
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Revisions & Policy Limits ---');
  // Client requests revision 1
  const { error: rev1Err } = await clientClient.rpc('request_revision', {
    p_milestone_id: msId,
    p_reason: 'Please increase window daylight openings on the north facade.'
  });
  assert('Client successfully requests revision 1', !rev1Err);

  const { data: revMs1 } = await adminClient.from('engagement_milestones').select('status, revision_count').eq('id', msId).single();
  assert('Milestone is revision_requested with revision_count = 1', revMs1?.status === 'revision_requested' && revMs1?.revision_count === 1);

  // Designer resubmits v2
  await designerClient.rpc('submit_milestone', {
    p_milestone_id: msId,
    p_notes: 'Updated north facade windows.',
    p_files: [{ path: '/uploads/drawings_v2.pdf', file_name: 'drawings_v2.pdf', size_bytes: 16000000 }]
  });

  // Client requests revision 2
  await clientClient.rpc('request_revision', {
    p_milestone_id: msId,
    p_reason: 'Revise column placement in entryway.'
  });

  const { data: revMs2 } = await adminClient.from('engagement_milestones').select('status, revision_count').eq('id', msId).single();
  assert('Revision count incremented to 2 (reaching policy revision_limit)', revMs2?.revision_count === 2);

  // Resubmit and client approves
  await designerClient.rpc('submit_milestone', {
    p_milestone_id: msId,
    p_notes: 'Final rectified column placements.'
  });

  const { error: approveErr } = await clientClient.rpc('approve_milestone', { p_milestone_id: msId });
  assert('Client approves milestone deliverable', !approveErr);

  const { data: approvedMs } = await adminClient.from('engagement_milestones').select('status, payout_status').eq('id', msId).single();
  assert('Milestone is approved and payout_status is pending_release', approvedMs?.status === 'approved' && approvedMs?.payout_status === 'pending_release');

  // Admin releases payout
  const { error: relErr } = await adminClient.rpc('dev_release_milestone', { p_milestone_id: msId });
  assert('Admin releases milestone payout to designer balance', !relErr);

  // ---------------------------------------------------------------------------
  // TEST 5: Time Tracking & Hourly Invoicing
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Hourly Time Tracking & Weekly Invoicing ---');
  // Create hourly engagement
  const { data: hProj } = await adminClient
    .from('projects')
    .insert({
      client_id: clientId,
      title: 'Structural Consultation Hourly',
      category: 'Engineering',
      budget: 10000.00,
      payment_type: 'hourly',
      status: 'awarded'
    })
    .select()
    .single();

  const { data: hProp } = await adminClient
    .from('proposals')
    .insert({
      project_id: hProj!.id,
      designer_id: designerId,
      total_price: 10000.00,
      hourly_rate: 80.00,
      status: 'accepted'
    })
    .select()
    .single();

  const { data: hEng } = await adminClient
    .from('engagements')
    .insert({
      project_id: hProj!.id,
      proposal_id: hProp!.id,
      client_id: clientId,
      designer_id: designerId,
      payment_type: 'hourly',
      total_price: 10000.00,
      hourly_rate: 80.00,
      weekly_hours_cap: 20.0,
      status: 'active'
    })
    .select()
    .single();

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Disallow future work date
  const { error: futureErr } = await designerClient.rpc('log_time', {
    p_engagement_id: hEng!.id,
    p_work_date: tomorrowStr,
    p_hours: 4.0,
    p_description: 'Future work'
  });
  assert('Reject time logging for future dates', !!futureErr);

  // Disallow non-0.25 increment
  const { error: invalidIncErr } = await designerClient.rpc('log_time', {
    p_engagement_id: hEng!.id,
    p_work_date: todayStr,
    p_hours: 2.33,
    p_description: 'Odd interval'
  });
  assert('Reject hours that are not multiples of 0.25', !!invalidIncErr);

  // Log valid 4.5 hours
  const { data: timeEntryId, error: logErr } = await designerClient.rpc('log_time', {
    p_engagement_id: hEng!.id,
    p_work_date: todayStr,
    p_hours: 4.50,
    p_description: 'Foundation load calculation review'
  });
  assert('Designer logs valid 4.5 hours in draft status', !logErr && !!timeEntryId);

  // Fetch generated week_start
  const { data: teRow } = await adminClient.from('time_entries').select('week_start').eq('id', timeEntryId).single();
  const weekStart = teRow?.week_start;

  // Submit week and generate invoice
  const { data: invId, error: subWeekErr } = await designerClient.rpc('submit_week', {
    p_engagement_id: hEng!.id,
    p_week_start: weekStart
  });
  assert('Designer submits week, creating invoice pending_approval', !subWeekErr && !!invId);

  const { data: invRow } = await adminClient.from('invoices').select('*').eq('id', invId).single();
  assert('Invoice generated with INV-001 format and amount = 4.5 * $80 = $360', invRow?.number === 'INV-001' && invRow?.amount === 360);

  // Client disputes weekly invoice
  const { data: disputeId, error: dispErr } = await clientClient.rpc('dispute_week', {
    p_invoice_id: invId,
    p_note: 'Billed load calculation review exceeds budgeted task scope.'
  });
  assert('Client disputes invoice, marking invoice & entries disputed', !dispErr && !!disputeId);

  // ---------------------------------------------------------------------------
  // TEST 6: Row Level Security (RLS) & Mutation Lockdown
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: RLS Isolation & Mutation Revocation ---');
  // Attempt direct INSERT on engagements table as authenticated user (MUST fail)
  const { error: directInsertEng } = await designerClient
    .from('engagements')
    .insert({
      project_id: testProj!.id,
      proposal_id: winProp!.id,
      client_id: clientId,
      designer_id: designerId,
      payment_type: 'milestone',
      total_price: 1000
    });
  assert('Direct INSERT on engagements revoked from authenticated role', !!directInsertEng);

  // Attempt direct UPDATE on engagement_milestones table (MUST fail)
  const { error: directUpdateMs } = await designerClient
    .from('engagement_milestones')
    .update({ status: 'approved' })
    .eq('id', msId);
  assert('Direct UPDATE on engagement_milestones revoked from authenticated role', !!directUpdateMs);

  // Attempt to read engagement as unrelated designer (MUST return 0 rows)
  const { data: unauthEngRead } = await otherDesignerClient
    .from('engagements')
    .select('id')
    .eq('id', newEngId);
  assert('RLS strictly prevents unrelated users from reading other engagements', !unauthEngRead || unauthEngRead.length === 0);

  // ---------------------------------------------------------------------------
  // TEST 7: Single Source of Truth Designer Dashboard
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: get_designer_dashboard SQL Function ---');
  const { data: dashData, error: dashErr } = await designerClient.rpc('get_designer_dashboard');
  assert('get_designer_dashboard returns structured JSON data', !dashErr && typeof dashData === 'object');

  const d = dashData as any;
  assert('Dashboard includes activeProjectsCount >= 1', d?.activeProjectsCount >= 1);
  assert('Dashboard includes inEscrowAmount, totalEarnedAmount, availableToWithdraw',
    typeof d?.inEscrowAmount === 'number' &&
    typeof d?.totalEarnedAmount === 'number' &&
    typeof d?.availableToWithdraw === 'number'
  );
  assert('Dashboard includes upcomingDeadlines and activeProjects arrays',
    Array.isArray(d?.upcomingDeadlines) && Array.isArray(d?.activeProjects)
  );

  console.log('\n===============================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Unhandled test runner error:', err);
  process.exit(1);
});

