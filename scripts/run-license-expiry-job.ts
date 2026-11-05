/**
 * Automated Background Job: License & Credential Expiration Runner
 *
 * Executes `check_credential_expirations()` in Supabase to:
 * 1. Mark verified credentials with expiration_date < CURRENT_DATE as 'expired'.
 * 2. Send 'credential_expired' notifications to affected designers.
 * 3. Detect credentials expiring in 30 days and emit 'credential_expiring' notifications.
 *
 * Usage:
 *   npx tsx scripts/run-license-expiry-job.ts
 *   npx tsx scripts/run-license-expiry-job.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function runLicenseExpiryJob(options: { dryRun?: boolean } = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes('--dry-run');

  console.log('===============================================================');
  console.log(`⏰ RUNNING LICENSE EXPIRY BACKGROUND JOB ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('===============================================================\n');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.');
    return { success: false, expiredCount: 0, expiringCount: 0 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let expiredCount = 0;
  let expiringCount = 0;

  // Attempt RPC first if not dry run
  if (!isDryRun) {
    console.log('📡 Executing check_credential_expirations() RPC...');
    const { error: rpcError } = await adminClient.rpc('check_credential_expirations');

    if (!rpcError) {
      console.log('✅ Stored procedure check_credential_expirations() executed successfully.');
      return { success: true, viaRpc: true };
    }

    console.warn(`⚠️ RPC invocation failed or not found (${rpcError.message}). Executing fallback runner...`);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const target30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Process Expired Credentials
  console.log(`🔍 Checking credentials expired before ${todayStr}...`);
  const { data: expiredList, error: expErr } = await adminClient
    .from('credentials')
    .select('id, designer_id, issuing_state, license_type, expiration_date')
    .eq('status', 'verified')
    .lt('expiration_date', todayStr);

  if (expErr) {
    console.error('Error fetching expired credentials:', expErr.message);
  } else if (expiredList && expiredList.length > 0) {
    console.log(`Found ${expiredList.length} expired credential(s).`);
    for (const cred of expiredList) {
      console.log(`  - Marking expired: Credential ${cred.id} (${cred.license_type || 'License'} in ${cred.issuing_state || 'N/A'}) for Designer ${cred.designer_id}`);
      if (!isDryRun) {
        await adminClient
          .from('credentials')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', cred.id);

        await adminClient.from('notifications').insert({
          user_id: cred.designer_id,
          type: 'credential_expired',
          data: {
            credential_id: cred.id,
            license_type: cred.license_type,
            state: cred.issuing_state,
            message: `Your ${cred.license_type || 'architectural'} license in ${cred.issuing_state || 'your state'} has expired.`
          },
          link: '/designer/profile#credentials'
        });
      }
      expiredCount++;
    }
  } else {
    console.log('  No expired credentials found.');
  }

  // 2. Process Credentials Expiring in 30 Days
  console.log(`\n🔍 Checking credentials expiring around 30 days from now (${target30Days})...`);
  const { data: expiringList, error: expiringErr } = await adminClient
    .from('credentials')
    .select('id, designer_id, issuing_state, license_type, expiration_date')
    .eq('status', 'verified')
    .eq('expiration_date', target30Days);

  if (expiringErr) {
    console.error('Error fetching expiring credentials:', expiringErr.message);
  } else if (expiringList && expiringList.length > 0) {
    console.log(`Found ${expiringList.length} credential(s) expiring in 30 days.`);
    for (const cred of expiringList) {
      console.log(`  - Sending 30-day warning: Credential ${cred.id} for Designer ${cred.designer_id}`);
      if (!isDryRun) {
        await adminClient.from('notifications').insert({
          user_id: cred.designer_id,
          type: 'credential_expiring',
          data: {
            credential_id: cred.id,
            license_type: cred.license_type,
            state: cred.issuing_state,
            expiration_date: cred.expiration_date,
            message: `Your ${cred.license_type || 'architectural'} license in ${cred.issuing_state || 'your state'} expires in 30 days.`
          },
          link: '/designer/profile#credentials'
        });
      }
      expiringCount++;
    }
  } else {
    console.log('  No credentials expiring on exactly 30 days.');
  }

  console.log('\n===============================================================');
  console.log('🏁 LICENSE EXPIRY JOB SUMMARY:');
  console.log(`  - Credentials Marked Expired:      ${expiredCount}`);
  console.log(`  - 30-Day Warning Notifications:   ${expiringCount}`);
  console.log('===============================================================\n');

  return { success: true, expiredCount, expiringCount };
}

if (process.argv[1]?.includes('run-license-expiry-job')) {
  runLicenseExpiryJob().catch((err) => {
    console.error('License expiry job failed:', err);
    process.exit(1);
  });
}
