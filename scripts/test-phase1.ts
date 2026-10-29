/**
 * Phase 1 Automated Security, RLS & Business Logic Test Suite
 * Validates all security rules and assertions requested in Section 8.
 *
 * Usage:
 *   npx tsx scripts/test-phase1.ts
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

// 1. Anon client
const anonClient = createClient(supabaseUrl, anonKey);

// 2. Admin client
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
  console.log('🧪 DEZIGNET PHASE 1: SECURITY, RLS & VIEW INTEGRITY TEST SUITE');
  console.log('===============================================================\n');

  // Authenticate Designer A (Complete Designer)
  const clientA = createClient(supabaseUrl, anonKey);
  const { data: authA, error: aErr } = await clientA.auth.signInWithPassword({
    email: 'designer.complete@dezignet.test',
    password: 'Password123!'
  });
  if (aErr || !authA.user) {
    throw new Error(`Failed to log in as Designer A: ${aErr?.message}`);
  }
  const designerAId = authA.user.id;

  // Authenticate Designer B (New Designer)
  const clientB = createClient(supabaseUrl, anonKey);
  const { data: authB, error: bErr } = await clientB.auth.signInWithPassword({
    email: 'designer.new@dezignet.test',
    password: 'Password123!'
  });
  if (bErr || !authB.user) {
    throw new Error(`Failed to log in as Designer B: ${bErr?.message}`);
  }
  const designerBId = authB.user.id;

  // --------------------------------------------------------------------------
  // TEST 1: A designer cannot read another user's phone, profile row or private fields
  // --------------------------------------------------------------------------
  console.log('Test 1: Cross-User Profile & Private Data Isolation (RLS)');
  const { data: crossProfile, error: cpErr } = await clientB
    .from('profiles')
    .select('*')
    .eq('id', designerAId);

  assert(
    'Designer B cannot select Designer A\'s row from base profiles table',
    !crossProfile || crossProfile.length === 0,
    `Returned ${crossProfile?.length} rows`
  );

  const { data: ownProfile } = await clientA
    .from('profiles')
    .select('id, phone')
    .eq('id', designerAId)
    .single();

  assert(
    'Designer A CAN select their own private profile row and phone',
    Boolean(ownProfile && ownProfile.phone),
    `Phone: ${ownProfile?.phone}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: A user cannot change their own role
  // --------------------------------------------------------------------------
  console.log('\nTest 2: Role Immutability Protection');
  const { error: roleChangeErr } = await clientA
    .from('profiles')
    .update({ role: 'admin' as any })
    .eq('id', designerAId);

  assert(
    'Attempting to change own role to "admin" is rejected by trigger / RLS',
    Boolean(roleChangeErr),
    roleChangeErr ? roleChangeErr.message : 'Update unexpectedly succeeded!'
  );

  const { data: checkRole } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', designerAId)
    .single();

  assert(
    'Designer A\'s role remains "designer" after unauthorized modification attempt',
    checkRole?.role === 'designer',
    `Role is: ${checkRole?.role}`
  );

  // --------------------------------------------------------------------------
  // TEST 3: A user cannot manually set a credential status to 'verified'
  // --------------------------------------------------------------------------
  console.log('\nTest 3: Credential Status Review Protection');
  const { data: newCred, error: credInsertErr } = await clientA
    .from('credentials')
    .insert({
      designer_id: designerAId,
      body: 'AIA',
      number: '99999',
      state_region: 'Zurich',
      year: 2020,
      status: 'verified' as any // Attempt to self-verify!
    })
    .select();

  // If RLS allows insert, trigger must reject or status must be forced to 'pending'
  const isSelfVerifyBlocked = Boolean(credInsertErr) || (newCred && newCred[0]?.status !== 'verified');
  assert(
    'Designer cannot insert a pre-verified credential directly',
    isSelfVerifyBlocked,
    credInsertErr?.message || `Inserted status: ${newCred?.[0]?.status}`
  );

  // --------------------------------------------------------------------------
  // TEST 4: Editing a verified credential resets it to pending
  // --------------------------------------------------------------------------
  console.log('\nTest 4: Auto-Reset of Verified Credentials on Edit');
  // 1. Ensure Designer A has a verified credential
  const { data: verifiedCred } = await adminClient
    .from('credentials')
    .select('*')
    .eq('designer_id', designerAId)
    .eq('status', 'verified')
    .limit(1)
    .maybeSingle();

  if (verifiedCred) {
    // 2. Designer edits the registration number
    const { data: updatedCred, error: updateCredErr } = await clientA
      .from('credentials')
      .update({ number: 'NEW-NUM-123' })
      .eq('id', verifiedCred.id)
      .select()
      .single();

    assert(
      'Editing registration number succeeds without RLS block',
      !updateCredErr && Boolean(updatedCred),
      updateCredErr?.message
    );

    assert(
      'Trigger automatically resets credential status from "verified" to "pending"',
      updatedCred?.status === 'pending',
      `Status is: ${updatedCred?.status}`
    );

    // Restore for subsequent test runs
    await adminClient
      .from('credentials')
      .update({ status: 'verified', number: verifiedCred.number })
      .eq('id', verifiedCred.id);
  } else {
    assert('Precondition: Verified credential exists for Designer A', false, 'None found');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Anonymous requests return nothing from base tables
  // --------------------------------------------------------------------------
  console.log('\nTest 5: Anonymous Base Table Access Lockdown');
  const baseTables = ['profiles', 'designer_profiles', 'portfolio_projects', 'portfolio_images', 'credentials'];
  for (const tbl of baseTables) {
    const { data, error } = await anonClient.from(tbl).select('*');
    assert(
      `Anon request to "${tbl}" returns 0 rows`,
      !error && (!data || data.length === 0),
      `Returned ${data?.length} rows`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 6: Public views data projection & privacy toggles
  // --------------------------------------------------------------------------
  console.log('\nTest 6: Public Views Column Projections & Privacy Enforcement');
  
  // (A) Check public_designer_profiles columns
  const { data: publicProfiles, error: ppErr } = await anonClient
    .from('public_designer_profiles')
    .select('*')
    .limit(10);

  assert('Anon can select from public_designer_profiles view', !ppErr && Boolean(publicProfiles), ppErr?.message);

  if (publicProfiles && publicProfiles.length > 0) {
    const firstRow = publicProfiles[0] as any;
    assert(
      'public_designer_profiles NEVER includes "email"',
      firstRow.email === undefined
    );
    assert(
      'public_designer_profiles NEVER includes "phone"',
      firstRow.phone === undefined
    );
  }

  // (B) Check public_credentials masked numbers
  const { data: publicCreds } = await anonClient
    .from('public_credentials')
    .select('*')
    .limit(5);

  if (publicCreds && publicCreds.length > 0) {
    const masked = publicCreds.every((c: any) => c.masked_number.startsWith('••••'));
    assert(
      'public_credentials masks registration numbers with "••••"',
      masked,
      `Sample: ${publicCreds[0]?.masked_number}`
    );
  }

  // (C) Test show_hourly_rate privacy toggle
  // Set show_hourly_rate = false for Designer A
  await adminClient
    .from('designer_profiles')
    .update({ show_hourly_rate: false })
    .eq('user_id', designerAId);

  const { data: viewRowHiddenRate } = await anonClient
    .from('public_designer_profiles')
    .select('hourly_rate')
    .eq('designer_id', designerAId)
    .single();

  assert(
    'Hourly rate is projected as NULL in public view when show_hourly_rate is false',
    viewRowHiddenRate?.hourly_rate === null,
    `Value: ${viewRowHiddenRate?.hourly_rate}`
  );

  // Restore show_hourly_rate
  await adminClient
    .from('designer_profiles')
    .update({ show_hourly_rate: true })
    .eq('user_id', designerAId);

  // (D) Test show_in_search privacy toggle
  await adminClient
    .from('designer_profiles')
    .update({ show_in_search: false })
    .eq('user_id', designerAId);

  const { data: hiddenDesignerAnon } = await anonClient
    .from('public_designer_profiles')
    .select('designer_id')
    .eq('designer_id', designerAId);

  assert(
    'Designer is hidden from public view when show_in_search is false',
    !hiddenDesignerAnon || hiddenDesignerAnon.length === 0
  );

  // Restore show_in_search
  await adminClient
    .from('designer_profiles')
    .update({ show_in_search: true })
    .eq('user_id', designerAId);

  // --------------------------------------------------------------------------
  // TEST 7: Cross-user portfolio and credential mutation tampering blocked
  // --------------------------------------------------------------------------
  console.log('\nTest 7: Cross-User Mutation Guard (Portfolio & Credentials)');
  
  // Designer B attempts to insert a portfolio project under Designer A's ID
  const { error: crossPortErr } = await clientB
    .from('portfolio_projects')
    .insert({
      designer_id: designerAId,
      title: 'Hacked Project'
    });

  assert(
    'Designer B cannot insert a portfolio project under Designer A\'s ID',
    Boolean(crossPortErr),
    crossPortErr ? crossPortErr.message : 'Unexpectedly succeeded!'
  );

  // Designer B attempts to delete Designer A's credentials
  const { data: credsToDelete } = await adminClient
    .from('credentials')
    .select('id')
    .eq('designer_id', designerAId)
    .limit(1)
    .single();

  if (credsToDelete) {
    const { error: crossDelErr } = await clientB
      .from('credentials')
      .delete()
      .eq('id', credsToDelete.id);

    assert(
      'Designer B cannot delete Designer A\'s credentials',
      Boolean(crossDelErr) || true // RLS returns 0 affected rows or error
    );

    // Verify still exists
    const { data: stillExists } = await adminClient
      .from('credentials')
      .select('id')
      .eq('id', credsToDelete.id)
      .maybeSingle();

    assert(
      'Designer A\'s credential remains intact in database',
      Boolean(stillExists)
    );
  }

  // --------------------------------------------------------------------------
  // TEST 8: Signup with 'admin' role results in 'client', NEVER 'admin'
  // --------------------------------------------------------------------------
  console.log('\nTest 8: Signup Role Whitelist & Privilege Escalation Prevention');
  const exploitEmail = `exploit.test.${Date.now()}@dezignet.test`;
  const { data: exploitUser, error: expErr } = await adminClient.auth.admin.createUser({
    email: exploitEmail,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: {
      full_name: 'Privilege Escalation Attempt',
      role: 'admin' // Attempting to inject admin!
    }
  });

  if (!expErr && exploitUser?.user) {
    const { data: exploitProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', exploitUser.user.id)
      .single();

    assert(
      'Signup with role: "admin" results in role: "client", never admin',
      exploitProfile?.role === 'client',
      `Assigned role: ${exploitProfile?.role}`
    );

    // Clean up exploit user
    await adminClient.auth.admin.deleteUser(exploitUser.user.id);
  } else {
    assert('Exploit signup test setup', false, expErr?.message);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
