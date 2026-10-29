/**
 * Client Action Simulator (Dev Only)
 * Allows developers to simulate client actions on proposals until the client UI is built.
 *
 * Usage:
 *   npx tsx scripts/simulate-client-action.ts view <proposalId>
 *   npx tsx scripts/simulate-client-action.ts shortlist <proposalId>
 *   npx tsx scripts/simulate-client-action.ts decline <proposalId> "Decline reason"
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const action = process.argv[2];
const proposalId = process.argv[3];
const reason = process.argv[4];

if (!action || !proposalId) {
  console.log(`
Usage:
  npx tsx scripts/simulate-client-action.ts view <proposalId>
  npx tsx scripts/simulate-client-action.ts shortlist <proposalId>
  npx tsx scripts/simulate-client-action.ts decline <proposalId> [reason]
  `);
  process.exit(0);
}

async function run() {
  const { data: prop } = await client.from('proposals').select('*, projects(client_id)').eq('id', proposalId).single();
  if (!prop) {
    console.error(`Proposal ${proposalId} not found.`);
    process.exit(1);
  }

  const clientId = prop.projects?.client_id;
  console.log(`Executing '${action}' on proposal ${proposalId} on behalf of client ${clientId}...`);

  if (action === 'view') {
    const { error } = await client
      .from('proposals')
      .update({
        viewed_at: new Date().toISOString(),
        status: prop.status === 'pending' ? 'viewed' : prop.status
      })
      .eq('id', proposalId);

    if (error) console.error('Error:', error);
    else {
      await client.from('proposal_events').insert({
        proposal_id: proposalId,
        event_type: 'viewed',
        actor_id: clientId,
        note: 'Client viewed proposal (simulated)'
      });
      console.log('✓ Successfully marked proposal as viewed!');
    }
  } else if (action === 'shortlist') {
    const { error } = await client
      .from('proposals')
      .update({
        status: 'shortlisted',
        decided_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    if (error) console.error('Error:', error);
    else {
      await client.from('proposal_events').insert({
        proposal_id: proposalId,
        event_type: 'shortlisted',
        actor_id: clientId,
        note: 'Proposal shortlisted by client (simulated)'
      });
      console.log('✓ Successfully shortlisted proposal!');
    }
  } else if (action === 'decline') {
    const declineReason = reason || 'Proposed scope or fee not aligned with current phase budget.';
    const { error } = await client
      .from('proposals')
      .update({
        status: 'declined',
        decline_reason: declineReason,
        decided_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    if (error) console.error('Error:', error);
    else {
      await client.from('proposal_events').insert({
        proposal_id: proposalId,
        event_type: 'declined',
        actor_id: clientId,
        note: declineReason
      });
      console.log('✓ Successfully declined proposal!');
    }
  } else {
    console.error(`Unknown action '${action}'. Use 'view', 'shortlist', or 'decline'.`);
  }
}

run();
