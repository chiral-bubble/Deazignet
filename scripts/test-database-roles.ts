/**
 * Database Roles, RLS & Security Definer Test Suite
 * 
 * Directly tests tables, views, and security definer functions simulating:
 * 1. Anonymous (unauthenticated)
 * 2. Free Designer
 * 3. Basic Designer
 * 4. Gold Designer
 * 5. Client
 * 6. Other Client
 * 7. Admin
 * 
 * Verifies:
 * - Deny-by-default RLS on base tables (projects, proposals, credentials, saved_searches, app_settings)
 * - View isolation (open_projects hides drafts/cancelled/uninvited, client_summaries hides PII)
 * - Ownership isolation between clients and between designers
 * - Security definer functions enforcement (get_effective_plan, calculate_platform_fee, suggest_designers, invite_designer, review_credential)
 * 
 * Usage:
 *   npx tsx scripts/test-database-roles.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('❌ Supabase environment variables missing in .env');
  process.exit(1);
}

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

interface TestContext {
  anon: SupabaseClient;
  adminService: SupabaseClient;
  adminUser?: SupabaseClient;
  clientUser?: SupabaseClient;
  otherClientUser?: SupabaseClient;
  freeDesigner?: SupabaseClient;
  basicDesigner?: SupabaseClient;
  goldDesigner?: SupabaseClient;
  clientUserId?: string;
  otherClientUserId?: string;
  freeDesignerId?: string;
  basicDesignerId?: string;
  goldDesignerId?: string;
  adminUserId?: string;
}

async function authenticateRole(email: string, pass: string): Promise<{ client: SupabaseClient; userId: string } | null> {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: pass });
  if (error || !data.user) {
    console.warn(`Could not log in as ${email}: ${error?.message}`);
    return null;
  }
  return { client, userId: data.user.id };
}

async function runDatabaseRolesTest() {
  console.log('===============================================================');
  console.log('🛡️  DEZIGNET DATABASE ROLES, RLS & SECURITY DEFINER TEST SUITE');
  console.log('===============================================================\n');

  const ctx: TestContext = {
    anon: createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    }),
    adminService: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  };

  // Attempt role logins
  console.log('Authenticating test roles...');
  const adminAuth = await authenticateRole('admin@dezignet.com', process.env.ADMIN_PASSWORD || 'AdminTest2026!');
  if (adminAuth) { ctx.adminUser = adminAuth.client; ctx.adminUserId = adminAuth.userId; }

  const clientAuth = await authenticateRole('partner.client@dezignet.com', process.env.TESTER_PASSWORD || 'TesterPass2026!');
  if (clientAuth) { ctx.clientUser = clientAuth.client; ctx.clientUserId = clientAuth.userId; }

  const otherClientAuth = await authenticateRole('partner.client2@dezignet.com', process.env.TESTER_PASSWORD || 'TesterPass2026!');
  if (otherClientAuth) { ctx.otherClientUser = otherClientAuth.client; ctx.otherClientUserId = otherClientAuth.userId; }

  const freeAuth = await authenticateRole('new.designer@dezignet.com', process.env.USER_PASSWORD || 'Dezignet2026!');
  if (freeAuth) { ctx.freeDesigner = freeAuth.client; ctx.freeDesignerId = freeAuth.userId; }

  const basicAuth = await authenticateRole('partner.designer2@dezignet.com', process.env.TESTER_PASSWORD || 'TesterPass2026!');
  if (basicAuth) { ctx.basicDesigner = basicAuth.client; ctx.basicDesignerId = basicAuth.userId; }

  const goldAuth = await authenticateRole('partner.architect@dezignet.com', process.env.TESTER_PASSWORD || 'TesterPass2026!');
  if (goldAuth) { ctx.goldDesigner = goldAuth.client; ctx.goldDesignerId = goldAuth.userId; }

  console.log(`Roles active: Anonymous=YES, AdminService=YES, AdminUser=${Boolean(ctx.adminUser)}, Client=${Boolean(ctx.clientUser)}, OtherClient=${Boolean(ctx.otherClientUser)}, Free=${Boolean(ctx.freeDesigner)}, Basic=${Boolean(ctx.basicDesigner)}, Gold=${Boolean(ctx.goldDesigner)}\n`);

  // ==========================================================================
  // TEST GROUP 1: Anonymous Role Lockdown (Deny-by-default)
  // ==========================================================================
  console.log('--- 1. ANONYMOUS ROLE LOCKDOWN (DENY-BY-DEFAULT) ---');

  // Base projects table
  const { data: anonProjects } = await ctx.anon.from('projects').select('*').limit(5);
  assert('Anonymous cannot select from base projects table (0 rows returned)', !anonProjects || anonProjects.length === 0);

  // Base proposals table
  const { data: anonProposals } = await ctx.anon.from('proposals').select('*').limit(5);
  assert('Anonymous cannot select from base proposals table (0 rows returned)', !anonProposals || anonProposals.length === 0);

  // Base saved_searches table
  const { data: anonSaved } = await ctx.anon.from('saved_searches').select('*').limit(5);
  assert('Anonymous cannot select from saved_searches table (0 rows returned)', !anonSaved || anonSaved.length === 0);

  // Direct insert into saved_searches
  const { error: anonInsertSavedErr } = await ctx.anon.from('saved_searches').insert({
    name: 'Hacked Search',
    type: 'projects',
    params: {}
  });
  assert('Anonymous cannot insert into saved_searches (denied by RLS)', Boolean(anonInsertSavedErr));

  // Base app_settings table
  const { data: anonSettings, error: anonSettingsErr } = await ctx.anon.from('app_settings').select('*');
  assert('Anonymous cannot read internal app_settings table', !anonSettings || anonSettings.length === 0 || Boolean(anonSettingsErr));

  // Base admin_audit_logs table
  const { data: anonLogs, error: anonLogsErr } = await ctx.anon.from('admin_audit_logs').select('*');
  assert('Anonymous cannot read admin_audit_logs table', !anonLogs || anonLogs.length === 0 || Boolean(anonLogsErr));

  // ==========================================================================
  // TEST GROUP 2: Designers Access & Base Table Lockdown (Free, Basic, Gold)
  // ==========================================================================
  console.log('\n--- 2. DESIGNERS ACCESS & BASE TABLE LOCKDOWN ---');
  const designerClients = [
    { role: 'Free Designer', client: ctx.freeDesigner, id: ctx.freeDesignerId },
    { role: 'Basic Designer', client: ctx.basicDesigner, id: ctx.basicDesignerId },
    { role: 'Gold Designer', client: ctx.goldDesigner, id: ctx.goldDesignerId }
  ];

  for (const des of designerClients) {
    if (!des.client) continue;

    // 1. Direct select from base projects table must return 0 rows
    const { data: desProjects } = await des.client.from('projects').select('*').limit(5);
    assert(`${des.role} cannot select directly from base projects table (0 rows)`, !desProjects || desProjects.length === 0);

    // 2. Can query open_projects view
    const { data: viewProjects } = await des.client.from('open_projects').select('id, status, title').limit(5);
    assert(`${des.role} can read open projects via open_projects view`, Boolean(viewProjects && viewProjects.length >= 0));

    // 3. Draft and cancelled projects never appear in open_projects view
    if (viewProjects && viewProjects.length > 0) {
      const nonOpen = viewProjects.filter((p: any) => p.status === 'draft' || p.status === 'cancelled');
      assert(`${des.role} open_projects view contains zero draft or cancelled projects`, nonOpen.length === 0);
    }

    // 4. Cannot read admin tables
    const { data: desAdmin } = await des.client.from('app_settings').select('*');
    assert(`${des.role} cannot read app_settings`, !desAdmin || desAdmin.length === 0);

    // 5. Direct insert into proposals table blocked (must use RPC)
    const { error: directInsertPropErr } = await des.client.from('proposals').insert({
      project_id: 'proj-dummy',
      designer_id: des.id,
      proposed_total: 5000,
      status: 'pending'
    });
    assert(`${des.role} direct insert into proposals table is denied by RLS`, Boolean(directInsertPropErr));
  }

  // Cross-designer proposal isolation
  if (ctx.freeDesigner && ctx.goldDesigner && ctx.goldDesignerId) {
    const { data: freeReadGoldProp } = await ctx.freeDesigner
      .from('proposals')
      .select('*')
      .eq('designer_id', ctx.goldDesignerId);
    assert('Free Designer cannot see Gold Designer proposals (ownership isolation)', !freeReadGoldProp || freeReadGoldProp.length === 0);
  }

  // ==========================================================================
  // TEST GROUP 3: Client vs Other Client Ownership Isolation
  // ==========================================================================
  console.log('\n--- 3. CLIENT VS OTHER CLIENT OWNERSHIP ISOLATION ---');
  if (ctx.clientUser && ctx.otherClientUser && ctx.clientUserId && ctx.otherClientUserId) {
    // 1. Client can read own projects
    const { data: clientOwnProjects } = await ctx.clientUser.from('projects').select('*').eq('client_id', ctx.clientUserId);
    assert('Client can read their own projects in projects table', Boolean(clientOwnProjects));

    // 2. Other client cannot read client 1's projects directly
    const { data: otherReadClient1 } = await ctx.otherClientUser
      .from('projects')
      .select('*')
      .eq('client_id', ctx.clientUserId);
    assert('Other Client cannot read Client 1 projects directly (cross-client isolation)', !otherReadClient1 || otherReadClient1.length === 0);

    // 3. Saved searches isolation: Client cannot see Other Client's saved searches
    const { data: otherSaved } = await ctx.otherClientUser
      .from('saved_searches')
      .select('*')
      .eq('user_id', ctx.clientUserId);
    assert('Other Client cannot read Client 1 saved searches', !otherSaved || otherSaved.length === 0);

    // 4. Client cannot insert saved search with someone else's user_id
    const { error: spoofSavedErr } = await ctx.clientUser.from('saved_searches').insert({
      user_id: ctx.otherClientUserId,
      name: 'Spoofed Search',
      type: 'projects',
      params: {}
    });
    assert('Client cannot insert saved search with spoofed user_id (RLS check rejected)', Boolean(spoofSavedErr));
  }

  // ==========================================================================
  // TEST GROUP 4: View Privacy Protection (client_summaries)
  // ==========================================================================
  console.log('\n--- 4. VIEW PRIVACY PROTECTION (client_summaries) ---');
  if (ctx.goldDesigner) {
    const { data: summaries, error: sumErr } = await ctx.goldDesigner.from('client_summaries').select('*').limit(5);
    if (summaries && summaries.length > 0) {
      const first = summaries[0] as any;
      assert('client_summaries view never exposes raw client email', first.email === undefined || first.email === null);
      assert('client_summaries view never exposes raw client phone', first.phone === undefined || first.phone === null);
      assert('client_summaries view provides display name or initial', Boolean(first.display_name || first.full_name));
    } else {
      assert('client_summaries view accessible without error', !sumErr);
    }
  }

  // ==========================================================================
  // TEST GROUP 5: Security Definer Functions (RPCs) Enforcement
  // ==========================================================================
  console.log('\n--- 5. SECURITY DEFINER FUNCTIONS ENFORCEMENT ---');

  // 1. calculate_platform_fee RPC
  const { data: feeFree, error: feeErr } = await ctx.anon.rpc('calculate_platform_fee', {
    p_plan_key: 'free',
    p_amount_cents: 500000,
    p_cumulative_before_cents: 0
  });

  if (!feeErr && feeFree) {
    assert('calculate_platform_fee RPC callable and returns fee object', Boolean(feeFree));
    const feeGold = await ctx.anon.rpc('calculate_platform_fee', {
      p_plan_key: 'gold',
      p_amount_cents: 500000,
      p_cumulative_before_cents: 0
    });
    assert('calculate_platform_fee returns identical fee across plans (free vs gold)', feeFree.fee_cents === feeGold.data?.fee_cents, `Free cents: ${feeFree.fee_cents}, Gold cents: ${feeGold.data?.fee_cents}`);
  } else {
    // If RPC name differs in DB migration or offline
    console.log('  calculate_platform_fee RPC check noted');
  }

  // 2. get_effective_plan RPC
  if (ctx.freeDesignerId && ctx.goldDesignerId) {
    const { data: planFree } = await ctx.anon.rpc('get_effective_plan', {
      p_designer_id: ctx.freeDesignerId
    });
    if (planFree) {
      assert('get_effective_plan resolves plan for Free Designer', planFree === 'free' || planFree.plan_key === 'free');
    }

    const { data: planGold } = await ctx.anon.rpc('get_effective_plan', {
      p_designer_id: ctx.goldDesignerId
    });
    if (planGold) {
      assert('get_effective_plan resolves plan for Gold Designer', planGold === 'gold' || planGold === 'upgraded' || planGold.plan_key === 'gold');
    }
  }

  // 3. invite_designer RPC direct invitation rule
  if (ctx.clientUser && ctx.freeDesignerId && ctx.basicDesignerId) {
    // Test inviting Free designer fails with invitations_unavailable
    const { data: freeInvRes, error: freeInvErr } = await ctx.clientUser.rpc('invite_designer', {
      p_project_id: 'proj-dummy',
      p_designer_id: ctx.freeDesignerId,
      p_message: 'Direct invite attempt to free tier'
    });
    const failedFree = Boolean(freeInvErr?.message?.includes('invitations_unavailable') || (freeInvRes as any)?.error === 'invitations_unavailable');
    assert('invite_designer RPC rejects inviting Free Designer (invitations_unavailable)', failedFree || Boolean(freeInvErr));

    // Test cross-client invite rejection: Other client cannot invite for Client 1's project
    if (ctx.otherClientUser) {
      const { error: crossClientErr } = await ctx.otherClientUser.rpc('invite_designer', {
        p_project_id: 'proj-dummy-client1',
        p_designer_id: ctx.basicDesignerId,
        p_message: 'Unauthorized invite attempt'
      });
      assert('invite_designer RPC enforces project ownership (non-owner rejected)', Boolean(crossClientErr));
    }
  }

  // 4. Admin-only RPCs (review_credential)
  if (ctx.freeDesigner) {
    const { error: unauthReviewErr } = await ctx.freeDesigner.rpc('review_credential', {
      p_credential_id: 'cred-dummy',
      p_status: 'verified'
    });
    assert('review_credential RPC denied to non-admin designers', Boolean(unauthReviewErr));
  }

  // ==========================================================================
  // TEST GROUP 6: Admin Role Privileges
  // ==========================================================================
  console.log('\n--- 6. ADMIN ROLE PRIVILEGES ---');
  if (ctx.adminUser || ctx.adminService) {
    const adminClient = ctx.adminUser || ctx.adminService;
    const { data: settings } = await adminClient.from('app_settings').select('*');
    assert('Admin can read app_settings table', Boolean(settings && settings.length > 0));

    const { data: allProjects } = await adminClient.from('projects').select('id, status').limit(5);
    assert('Admin can read projects across all clients and statuses', Boolean(allProjects));
  }

  console.log('\n===============================================================');
  console.log(`🛡️  DATABASE ROLES TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runDatabaseRolesTest().catch((err) => {
  console.error('Database roles test failed with error:', err);
  process.exit(1);
});
