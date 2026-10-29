/**
 * Phase 2 Automated Security, RLS & Business Logic Test Suite
 * Validates all security rules and assertions requested in Section 8.
 *
 * Usage:
 *   npx tsx scripts/test-phase2.ts
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

const anonClient = createClient(supabaseUrl, anonKey);
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
  console.log('🧪 DEZIGNET PHASE 2: PROJECTS & PROPOSALS TEST SUITE');
  console.log('===============================================================\n');

  // Authenticate Designer Complete
  const designerClient = createClient(supabaseUrl, anonKey);
  const { data: authD, error: dErr } = await designerClient.auth.signInWithPassword({
    email: 'designer.complete@dezignet.test',
    password: 'Password123!'
  });
  if (dErr || !authD.user) throw new Error(`Designer login failed: ${dErr?.message}`);
  const designerId = authD.user.id;

  // Authenticate Designer New (Incomplete profile)
  const newDesignerClient = createClient(supabaseUrl, anonKey);
  const { data: authND } = await newDesignerClient.auth.signInWithPassword({
    email: 'designer.new@dezignet.test',
    password: 'Password123!'
  });
  const newDesignerId = authND?.user?.id;

  // Authenticate Client 1
  const client1 = createClient(supabaseUrl, anonKey);
  const { data: authC1, error: c1Err } = await client1.auth.signInWithPassword({
    email: 'client1@dezignet.test',
    password: 'Password123!'
  });
  if (c1Err || !authC1.user) throw new Error(`Client1 login failed: ${c1Err?.message}`);
  const client1Id = authC1.user.id;

  // Authenticate Client 2
  const client2 = createClient(supabaseUrl, anonKey);
  const { data: authC2 } = await client2.auth.signInWithPassword({
    email: 'client2@dezignet.test',
    password: 'Password123!'
  });
  const client2Id = authC2?.user?.id;

  // --------------------------------------------------------------------------
  // TEST 1: Designer cannot read projects table directly, only open_projects view
  // --------------------------------------------------------------------------
  console.log('Test 1: Project Table Direct Access Lockdown & View Isolation');
  const { data: directProjects } = await designerClient.from('projects').select('*');
  assert(
    'Designer cannot select directly from base projects table (returns 0 rows)',
    !directProjects || directProjects.length === 0,
    `Returned ${directProjects?.length} rows`
  );

  const { data: openViewProjects } = await designerClient.from('open_projects').select('*');
  assert(
    'Designer CAN read open projects through open_projects view',
    Boolean(openViewProjects && openViewProjects.length > 0),
    `Count: ${openViewProjects?.length}`
  );

  const hasDraftOrCancelled = openViewProjects?.some(
    (p: any) => p.status === 'draft' || p.status === 'cancelled'
  );
  assert(
    'open_projects view NEVER includes draft or cancelled projects',
    !hasDraftOrCancelled
  );

  // --------------------------------------------------------------------------
  // TEST 2: Views never expose client email, phone, full name or address
  // --------------------------------------------------------------------------
  console.log('\nTest 2: Privacy Enforcement in Views');
  const { data: clientSummary } = await designerClient.from('client_summaries').select('*').limit(1);
  const cs = clientSummary?.[0];
  assert('client_summaries view returns client rows', Boolean(cs));
  assert('client_summaries view NEVER contains "email"', cs ? !('email' in cs) : true);
  assert('client_summaries view NEVER contains "phone"', cs ? !('phone' in cs) : true);
  assert(
    'client_summaries view displays initial instead of full surname (e.g. "Adeleke J.")',
    cs?.display_name ? cs.display_name.includes('.') : false,
    `Display name: ${cs?.display_name}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: Designer cannot read another designer\'s proposal or price
  // --------------------------------------------------------------------------
  console.log('\nTest 3: Cross-Designer Proposal Isolation');
  const { data: otherProposals } = await newDesignerClient
    .from('proposals')
    .select('*')
    .eq('designer_id', designerId);

  assert(
    'Designer New cannot select Designer Complete\'s proposals',
    !otherProposals || otherProposals.length === 0,
    `Returned ${otherProposals?.length} rows`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Submission Rules & Validations
  // --------------------------------------------------------------------------
  console.log('\nTest 4: Submission Rules Enforcement');

  // Find an open project
  const openProj = openViewProjects?.find((p: any) => p.status === 'open' && p.payment_type === 'milestone');
  const closedProj = await adminClient.from('projects').select('id').eq('status', 'closed').limit(1).single();

  // Rule 4a: Submitting to closed project fails
  if (closedProj.data) {
    const { error: closedErr } = await designerClient.rpc('submit_proposal', {
      p_project_id: closedProj.data.id,
      p_cover_letter: 'Test letter',
      p_total_price: 50000,
      p_currency: 'USD',
      p_delivery_days: 30,
      p_hourly_rate: null,
      p_estimated_hours: null,
      p_exclusions: null,
      p_question_for_client: null,
      p_milestone_offers: [
        { project_milestone_id: null, fee_percent: 100, amount: 50000 }
      ],
      p_portfolio_item_ids: []
    });
    assert(
      'Submitting to closed project is rejected with "project_closed"',
      Boolean(closedErr && closedErr.message.includes('project_closed')),
      `Error: ${closedErr?.message}`
    );
  }

  // Rule 4b: Incomplete profile fails
  if (openProj) {
    const { error: incErr } = await newDesignerClient.rpc('submit_proposal', {
      p_project_id: openProj.id,
      p_cover_letter: 'Test from incomplete profile',
      p_total_price: 40000,
      p_currency: 'USD',
      p_delivery_days: 20,
      p_hourly_rate: null,
      p_estimated_hours: null,
      p_exclusions: null,
      p_question_for_client: null,
      p_milestone_offers: [
        { project_milestone_id: null, fee_percent: 100, amount: 40000 }
      ],
      p_portfolio_item_ids: []
    });
    assert(
      'Submitting with incomplete profile fails with "profile_incomplete"',
      Boolean(incErr && incErr.message.includes('profile_incomplete')),
      `Error: ${incErr?.message}`
    );
  }

  // Rule 4c: Percentages not totalling 100 fail
  if (openProj) {
    const { error: pctErr } = await designerClient.rpc('submit_proposal', {
      p_project_id: openProj.id,
      p_cover_letter: 'Invalid percentage test letter',
      p_total_price: 60000,
      p_currency: 'USD',
      p_delivery_days: 20,
      p_hourly_rate: null,
      p_estimated_hours: null,
      p_exclusions: null,
      p_question_for_client: null,
      p_milestone_offers: [
        { project_milestone_id: null, fee_percent: 70, amount: 42000 }
      ],
      p_portfolio_item_ids: []
    });
    assert(
      'Milestone proposal with percentages not totalling 100 fails with "invalid_percentages"',
      Boolean(pctErr && pctErr.message.includes('invalid_percentages')),
      `Error: ${pctErr?.message}`
    );
  }

  // Rule 4d: Direct insert into proposals table blocked by RLS
  const { error: directInsertErr } = await designerClient.from('proposals').insert({
    project_id: openProj?.id,
    designer_id: designerId,
    cover_letter: 'Hacked direct insert',
    total_price: 1000,
    delivery_days: 10,
    project_snapshot: {}
  });
  assert(
    'Direct INSERT into proposals table is denied by RLS',
    Boolean(directInsertErr)
  );

  // --------------------------------------------------------------------------
  // TEST 5: Designer cannot modify own plan or change proposal status directly
  // --------------------------------------------------------------------------
  console.log('\nTest 5: Plan Immutability & Proposal Status Protection');
  const { error: planUpdateErr } = await designerClient
    .from('designer_profiles')
    .update({ plan: 'upgraded' as any })
    .eq('user_id', designerId);

  assert(
    'Designer cannot upgrade own plan directly (blocked by trigger)',
    Boolean(planUpdateErr)
  );

  const { error: statusUpdateErr } = await designerClient
    .from('proposals')
    .update({ status: 'accepted' as any })
    .eq('designer_id', designerId);

  assert(
    'Designer cannot directly update proposal status to "accepted"',
    Boolean(statusUpdateErr)
  );

  // --------------------------------------------------------------------------
  // TEST 6: Proposal Editing Protection (blocked after viewed or non-pending)
  // --------------------------------------------------------------------------
  console.log('\nTest 6: Proposal Editing Lifecycle');
  const { data: viewedProp } = await adminClient
    .from('proposals')
    .select('id')
    .eq('designer_id', designerId)
    .eq('status', 'viewed')
    .limit(1)
    .single();

  if (viewedProp) {
    const { error: editViewedErr } = await designerClient.rpc('update_proposal', {
      p_proposal_id: viewedProp.id,
      p_cover_letter: 'Attempted edit after viewed',
      p_total_price: 99999,
      p_delivery_days: 10,
      p_hourly_rate: null,
      p_estimated_hours: null,
      p_exclusions: null,
      p_question_for_client: null,
      p_milestone_offers: null
    });
    assert(
      'Editing a proposal after viewed_at is set fails with "not_editable"',
      Boolean(editViewedErr && editViewedErr.message.includes('not_editable')),
      `Error: ${editViewedErr?.message}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 7: Client Actions & Cross-Client Isolation
  // --------------------------------------------------------------------------
  console.log('\nTest 7: Client Action Scopes & Cross-Client Isolation');
  // Client 2 attempts to shortlist proposal on Client 1's project
  const { data: c1Prop } = await adminClient
    .from('proposals')
    .select('id, project_id')
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (c1Prop) {
    const { error: crossClientErr } = await client2.rpc('shortlist_proposal', {
      p_proposal_id: c1Prop.id
    });
    assert(
      'Client 2 cannot shortlist a proposal on Client 1\'s project',
      Boolean(crossClientErr)
    );
  }

  // --------------------------------------------------------------------------
  // TEST 8: Saved Items Privacy & Integrity
  // --------------------------------------------------------------------------
  console.log('\nTest 8: Saved Items Privacy & Constraints');
  if (openProj) {
    // Save project
    await designerClient.from('saved_projects').insert({
      user_id: designerId,
      project_id: openProj.id
    });

    const { data: dSaved } = await designerClient.from('saved_projects').select('*');
    assert('Designer can see own saved projects', Boolean(dSaved && dSaved.length > 0));

    const { data: otherSaved } = await newDesignerClient
      .from('saved_projects')
      .select('*')
      .eq('user_id', designerId);
    assert('Designer New cannot read Designer Complete\'s saved projects', !otherSaved || otherSaved.length === 0);
  }

  // Cannot save self as designer
  const { error: saveSelfErr } = await designerClient.from('saved_designers').insert({
    user_id: designerId,
    designer_id: designerId
  });
  assert('User cannot save themselves as a designer', Boolean(saveSelfErr));

  // --------------------------------------------------------------------------
  // TEST 9: Anonymous Requests Lockdown
  // --------------------------------------------------------------------------
  console.log('\nTest 9: Anonymous Lockdown on Phase 2 Tables and Views');
  const { data: anonProjects } = await anonClient.from('projects').select('*');
  assert('Anon cannot select from "projects" table', !anonProjects || anonProjects.length === 0);

  const { data: anonOpenProjects } = await anonClient.from('open_projects').select('*');
  assert('Anon cannot select from "open_projects" view', !anonOpenProjects || anonOpenProjects.length === 0);

  const { data: anonProposals } = await anonClient.from('proposals').select('*');
  assert('Anon cannot select from "proposals" table', !anonProposals || anonProposals.length === 0);

  const { data: anonClientSummaries } = await anonClient.from('client_summaries').select('*');
  assert('Anon cannot select from "client_summaries" view', !anonClientSummaries || anonClientSummaries.length === 0);

  // --------------------------------------------------------------------------
  // TEST 10: Milestone Fee Percentages Validation (100% check)
  // --------------------------------------------------------------------------
  console.log('\nTest 10: Milestone 100% Fee Total Validation on Project Opening');
  const { data: testDraft, error: tdErr } = await adminClient
    .from('projects')
    .insert({
      client_id: client1Id,
      title: 'Invalid 80% Milestone Test Project',
      category: 'Residential',
      budget: 50000,
      payment_type: 'milestone',
      deadline: '2026-12-30',
      status: 'draft'
    })
    .select('id')
    .single();

  if (testDraft) {
    // Insert milestone with only 80%
    await adminClient.from('project_milestones').insert({
      project_id: testDraft.id,
      sort_order: 1,
      name: 'Partial phase',
      fee_percent: 80
    });

    // Attempt to open project
    const { error: openErr } = await adminClient
      .from('projects')
      .update({ status: 'open' })
      .eq('id', testDraft.id);

    assert(
      'Attempting to open a project whose milestones do not total 100% fails',
      Boolean(openErr && openErr.message.includes('100%')),
      `Error: ${openErr?.message}`
    );

    // Clean up test draft
    await adminClient.from('projects').delete().eq('id', testDraft.id);
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n===============================================================');
  console.log(`PHASE 2 TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

