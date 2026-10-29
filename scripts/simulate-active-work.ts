/**
 * Active Work Simulation CLI for Dezignet
 * Allows executing client or designer state actions on active projects and milestones.
 *
 * Usage:
 *   npx tsx scripts/simulate-active-work.ts fund <milestone_id>
 *   npx tsx scripts/simulate-active-work.ts approve <milestone_id>
 *   npx tsx scripts/simulate-active-work.ts release <milestone_id>
 *   npx tsx scripts/simulate-active-work.ts revision <milestone_id> "<reason>"
 *   npx tsx scripts/simulate-active-work.ts approve-invoice <invoice_id>
 *   npx tsx scripts/simulate-active-work.ts dispute-invoice <invoice_id> "<note>"
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: Supabase environment variables missing in .env');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  const targetId = args[1];
  const extraParam = args[2] || '';

  if (!action || !targetId) {
    console.log('Usage: npx tsx scripts/simulate-active-work.ts <action> <target_id> [extraParam]');
    console.log('Actions:');
    console.log('  fund <milestone_id>');
    console.log('  release <milestone_id>');
    console.log('  approve <milestone_id>');
    console.log('  revision <milestone_id> "<reason>"');
    console.log('  approve-invoice <invoice_id>');
    console.log('  dispute-invoice <invoice_id> "<note>"');
    process.exit(0);
  }

  console.log(`Executing active work action: ${action} on ${targetId}...`);

  switch (action) {
    case 'fund': {
      const { error } = await adminClient.rpc('dev_fund_milestone', { p_milestone_id: targetId });
      if (error) throw new Error(error.message);
      console.log(`✅ Milestone ${targetId} funded successfully.`);
      break;
    }
    case 'release': {
      const { error } = await adminClient.rpc('dev_release_milestone', { p_milestone_id: targetId });
      if (error) throw new Error(error.message);
      console.log(`✅ Payment for milestone ${targetId} released successfully.`);
      break;
    }
    case 'approve': {
      const { error } = await adminClient.rpc('approve_milestone', { p_milestone_id: targetId });
      if (error) throw new Error(error.message);
      console.log(`✅ Milestone ${targetId} approved.`);
      break;
    }
    case 'revision': {
      const reason = extraParam || 'Please adjust dimensions and render quality.';
      const { error } = await adminClient.rpc('request_revision', {
        p_milestone_id: targetId,
        p_reason: reason
      });
      if (error) throw new Error(error.message);
      console.log(`✅ Revision requested for milestone ${targetId}: "${reason}"`);
      break;
    }
    case 'approve-invoice': {
      const { error } = await adminClient.rpc('approve_week', { p_invoice_id: targetId });
      if (error) throw new Error(error.message);
      console.log(`✅ Invoice ${targetId} approved.`);
      break;
    }
    case 'dispute-invoice': {
      const note = extraParam || 'Hours billed do not match agreed deliverables.';
      const { data, error } = await adminClient.rpc('dispute_week', {
        p_invoice_id: targetId,
        p_note: note
      });
      if (error) throw new Error(error.message);
      console.log(`✅ Invoice ${targetId} disputed. Dispute ID: ${data}`);
      break;
    }
    default:
      console.error(`Unknown action: ${action}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Action failed:', err.message);
  process.exit(1);
});

