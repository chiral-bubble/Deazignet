/**
 * Automated Background Job: Project Invitations Expiration Runner
 *
 * Executes `expire_project_invitations()` (or `expire_invitations()`) to:
 * 1. Identify active project invitations ('sent' or 'viewed') whose:
 *    - `expires_at` is in the past, OR
 *    - project status has transitioned to ('closed', 'cancelled', 'completed'), OR
 *    - project proposal deadline has passed.
 * 2. Mark the invitation status as 'expired' with responded_at = NOW().
 * 3. Emit `invitation_expired` notifications to the project client.
 *
 * Usage:
 *   npx tsx scripts/run-invitation-expiry-job.ts
 *   npx tsx scripts/run-invitation-expiry-job.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function runInvitationExpiryJob(options: { dryRun?: boolean } = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes('--dry-run');

  console.log('===============================================================');
  console.log(`⏰ RUNNING INVITATION EXPIRY BACKGROUND JOB ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('===============================================================\n');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
    return { success: false, expiredCount: 0 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let expiredCount = 0;

  // 1. Attempt RPC first if not dry run
  if (!isDryRun) {
    console.log('📡 Attempting RPC expire_project_invitations()...');
    const { data: rpc1Data, error: rpc1Error } = await adminClient.rpc('expire_project_invitations');

    if (!rpc1Error) {
      console.log('✅ Stored procedure expire_project_invitations() succeeded:', rpc1Data);
      return { success: true, viaRpc: 'expire_project_invitations', data: rpc1Data };
    }

    console.log('📡 Attempting RPC expire_invitations()...');
    const { data: rpc2Data, error: rpc2Error } = await adminClient.rpc('expire_invitations');

    if (!rpc2Error) {
      console.log('✅ Stored procedure expire_invitations() succeeded:', rpc2Data);
      return { success: true, viaRpc: 'expire_invitations', data: rpc2Data };
    }

    console.warn(`⚠️ Both RPC procedures failed or not found (${rpc1Error.message}; ${rpc2Error.message}). Executing direct database query fallback...`);
  }

  // 2. Direct Query Fallback
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.split('T')[0];

  console.log(`🔍 Scanning active project invitations (sent / viewed)...`);

  const { data: invitations, error: invErr } = await adminClient
    .from('project_invitations')
    .select(`
      id,
      client_id,
      designer_id,
      project_id,
      status,
      expires_at,
      projects!inner (
        id,
        title,
        status,
        proposal_deadline
      )
    `)
    .in('status', ['sent', 'viewed']);

  if (invErr) {
    console.error('Error fetching project invitations:', invErr.message);
  } else if (invitations && invitations.length > 0) {
    for (const inv of invitations) {
      const proj = Array.isArray(inv.projects) ? inv.projects[0] : inv.projects;
      const isPastExpiresAt = inv.expires_at && new Date(inv.expires_at) < new Date();
      const isProjectClosed = proj && ['closed', 'cancelled', 'completed'].includes(proj.status);
      const isPastDeadline = proj?.proposal_deadline && proj.proposal_deadline < todayStr;

      if (isPastExpiresAt || isProjectClosed || isPastDeadline) {
        const reason = isPastExpiresAt
          ? 'invitation expired_at reached'
          : isProjectClosed
          ? `project status is ${proj.status}`
          : 'project proposal deadline passed';

        console.log(`  - Expiring invitation ${inv.id} for project "${proj?.title || inv.project_id}" (Reason: ${reason})`);

        if (!isDryRun) {
          await adminClient
            .from('project_invitations')
            .update({
              status: 'expired',
              responded_at: nowIso
            })
            .eq('id', inv.id);

          await adminClient.from('notifications').insert({
            user_id: inv.client_id,
            type: 'invitation_expired',
            data: {
              invitation_id: inv.id,
              project_id: inv.project_id,
              project_title: proj?.title || 'Project'
            },
            link: `/client/projects/${inv.project_id}`
          });
        }
        expiredCount++;
      }
    }
  } else {
    console.log('  No pending or viewed invitations found to evaluate.');
  }

  console.log('\n===============================================================');
  console.log('🏁 INVITATION EXPIRY JOB SUMMARY:');
  console.log(`  - Invitations Expired: ${expiredCount}`);
  console.log('===============================================================\n');

  return { success: true, expiredCount };
}

if (process.argv[1]?.includes('run-invitation-expiry-job')) {
  runInvitationExpiryJob().catch((err) => {
    console.error('Invitation expiry job failed:', err);
    process.exit(1);
  });
}
