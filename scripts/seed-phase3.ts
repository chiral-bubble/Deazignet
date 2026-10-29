/**
 * Phase 3 Database Seeding Script
 * Seeds realistic active work engagements matching the mock dataset:
 * 1. Milestone Engagement (Modern Cantilevered Residence):
 *    - Milestone 1: Approved & Released
 *    - Milestone 2: Funded, In Progress
 *    - Milestone 3: Awaiting Funding
 * 2. Hourly Engagement (Corporate HQ Interior):
 *    - Draft time entries, submitted week, pending approval invoice
 * 3. Dispute-Ready Engagement:
 *    - Milestone with 2 revisions requested (eligible for dispute under revision_limit policy)
 *
 * Usage:
 *   npx tsx scripts/seed-phase3.ts
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

async function seedPhase3() {
  console.log('===============================================================');
  console.log('🌱 SEEDING DEZIGNET PHASE 3: ACTIVE WORK & ENGAGEMENTS');
  console.log('===============================================================\n');

  // 1. Fetch designer and client accounts
  const { data: users, error: uErr } = await adminClient.auth.admin.listUsers();
  if (uErr || !users.users) throw new Error(`Failed to list users: ${uErr?.message}`);

  const designer = users.users.find((u) => u.email === 'designer.complete@dezignet.test');
  const client = users.users.find((u) => u.email === 'client1@dezignet.test') || users.users.find((u) => u.email === 'client@dezignet.test');

  if (!designer || !client) {
    throw new Error('Required test accounts (designer.complete / client1) not found. Run seed-phase1.ts and seed-phase2.ts first.');
  }

  console.log(`Found Designer: ${designer.email} (${designer.id})`);
  console.log(`Found Client:   ${client.email} (${client.id})\n`);

  // 2. Fetch or create projects for engagements
  // Project 1: Milestone Contract
  const { data: proj1 } = await adminClient
    .from('projects')
    .select('id, title, payment_type')
    .eq('client_id', client.id)
    .eq('payment_type', 'milestone')
    .limit(1)
    .maybeSingle();

  // Project 2: Hourly Contract
  const { data: proj2 } = await adminClient
    .from('projects')
    .select('id, title, payment_type')
    .eq('client_id', client.id)
    .eq('payment_type', 'hourly')
    .limit(1)
    .maybeSingle();

  if (!proj1 || !proj2) {
    throw new Error('Projects not found for client. Ensure seed-phase2.ts has been executed.');
  }

  // 3. Clear pre-existing test engagements for clean idempotency
  await adminClient.from('engagements').delete().in('project_id', [proj1.id, proj2.id]);

  console.log('Seeding Engagement 1: Milestone Contract (Modern Cantilevered Residence)...');
  // Find or create accepted proposal for proj1
  let { data: prop1 } = await adminClient
    .from('proposals')
    .select('id, total_price, currency, delivery_days')
    .eq('project_id', proj1.id)
    .eq('designer_id', designer.id)
    .maybeSingle();

  if (!prop1) {
    const { data: newProp } = await adminClient
      .from('proposals')
      .insert({
        project_id: proj1.id,
        designer_id: designer.id,
        total_price: 64000.00,
        currency: 'USD',
        delivery_days: 90,
        cover_letter: 'Comprehensive architectural development proposal.',
        status: 'accepted',
        sent_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        decided_at: new Date(Date.now() - 12 * 86400000).toISOString()
      })
      .select()
      .single();
    prop1 = newProp;
  } else {
    await adminClient.from('proposals').update({ status: 'accepted' }).eq('id', prop1.id);
  }

  await adminClient.from('projects').update({ status: 'awarded' }).eq('id', proj1.id);

  // Insert Engagement 1
  const { data: eng1, error: eng1Err } = await adminClient
    .from('engagements')
    .insert({
      project_id: proj1.id,
      proposal_id: prop1!.id,
      client_id: client.id,
      designer_id: designer.id,
      payment_type: 'milestone',
      total_price: 64000.00,
      currency: 'USD',
      platform_fee_percent: 10.00,
      status: 'active',
      terms_snapshot: {
        project_title: proj1.title,
        category: 'Architecture',
        delivery_days: 90
      },
      started_at: new Date(Date.now() - 12 * 86400000).toISOString()
    })
    .select()
    .single();

  if (eng1Err) throw new Error(`Failed to create Engagement 1: ${eng1Err.message}`);

  // Insert 3 Milestones for Engagement 1
  // MS 1: Approved & Released ($19,200)
  const { data: ms1 } = await adminClient
    .from('engagement_milestones')
    .insert({
      engagement_id: eng1.id,
      sort_order: 1,
      name: 'Phase 1: Concept Design & Site Analysis',
      deliverables: ['Site analysis PDF', 'Moodboards', 'Schematic floor plans'],
      fee_percent: 30.00,
      amount: 19200.00,
      status: 'approved',
      payout_status: 'released',
      funded_at: new Date(Date.now() - 12 * 86400000).toISOString(),
      started_at: new Date(Date.now() - 11 * 86400000).toISOString(),
      submitted_at: new Date(Date.now() - 6 * 86400000).toISOString(),
      approved_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      released_at: new Date(Date.now() - 3 * 86400000).toISOString()
    })
    .select()
    .single();

  // MS 2: Funded, In Progress ($25,600)
  const { data: ms2 } = await adminClient
    .from('engagement_milestones')
    .insert({
      engagement_id: eng1.id,
      sort_order: 2,
      name: 'Phase 2: Detailed Architectural Drawings & 3D Renderings',
      deliverables: ['Full CAD drawings', 'High-res exterior renderings', 'Material schedule'],
      fee_percent: 40.00,
      amount: 25600.00,
      status: 'in_progress',
      payout_status: 'not_due',
      due_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      funded_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      started_at: new Date(Date.now() - 2 * 86400000).toISOString()
    })
    .select()
    .single();

  // MS 3: Awaiting Funding ($19,200)
  await adminClient.from('engagement_milestones').insert({
    engagement_id: eng1.id,
    sort_order: 3,
    name: 'Phase 3: Construction Dossier & Authority Approval Package',
    deliverables: ['Structural sets', 'MEP coordination plans', 'Signed submission packet'],
    fee_percent: 30.00,
    amount: 19200.00,
    status: 'awaiting_funding',
    payout_status: 'not_due'
  });

  console.log(`✓ Engagement 1 created (${eng1.id}) with 3 milestones.`);

  console.log('\nSeeding Engagement 2: Hourly Contract (Corporate HQ Interior)...');
  // Proposal for proj2
  let { data: prop2 } = await adminClient
    .from('proposals')
    .select('id, hourly_rate')
    .eq('project_id', proj2.id)
    .eq('designer_id', designer.id)
    .maybeSingle();

  if (!prop2) {
    const { data: newProp } = await adminClient
      .from('proposals')
      .insert({
        project_id: proj2.id,
        designer_id: designer.id,
        total_price: 3500.00,
        hourly_rate: 70.00,
        estimated_hours: 50,
        currency: 'USD',
        delivery_days: 30,
        cover_letter: 'Interior space planning and construction supervision on hourly terms.',
        status: 'accepted',
        sent_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        decided_at: new Date(Date.now() - 9 * 86400000).toISOString()
      })
      .select()
      .single();
    prop2 = newProp;
  } else {
    await adminClient.from('proposals').update({ status: 'accepted' }).eq('id', prop2.id);
  }

  await adminClient.from('projects').update({ status: 'awarded' }).eq('id', proj2.id);

  const { data: eng2, error: eng2Err } = await adminClient
    .from('engagements')
    .insert({
      project_id: proj2.id,
      proposal_id: prop2!.id,
      client_id: client.id,
      designer_id: designer.id,
      payment_type: 'hourly',
      total_price: 3500.00,
      currency: 'USD',
      platform_fee_percent: 10.00,
      hourly_rate: 70.00,
      weekly_hours_cap: 35.0,
      status: 'active',
      terms_snapshot: {
        project_title: proj2.title,
        category: 'Interior Design',
        delivery_days: 30
      },
      started_at: new Date(Date.now() - 9 * 86400000).toISOString()
    })
    .select()
    .single();

  if (eng2Err) throw new Error(`Failed to create Engagement 2: ${eng2Err.message}`);

  // Seed time entries for Engagement 2
  const today = new Date();
  const dateStr1 = new Date(today.getTime() - 2 * 86400000).toISOString().split('T')[0];
  const dateStr2 = new Date(today.getTime() - 1 * 86400000).toISOString().split('T')[0];

  await adminClient.from('time_entries').insert([
    {
      engagement_id: eng2.id,
      designer_id: designer.id,
      work_date: dateStr1,
      hours: 4.50,
      description: 'Zoning analysis and initial space layout drafts',
      status: 'submitted',
      submitted_at: new Date().toISOString()
    },
    {
      engagement_id: eng2.id,
      designer_id: designer.id,
      work_date: dateStr2,
      hours: 3.50,
      description: 'Executive suite 3D elevation modeling',
      status: 'submitted',
      submitted_at: new Date().toISOString()
    }
  ]);

  // Insert Invoice for Engagement 2
  const weekStart = new Date(today.getTime() - 4 * 86400000).toISOString().split('T')[0];
  await adminClient.from('invoices').insert({
    engagement_id: eng2.id,
    week_start: weekStart,
    hours_total: 8.00,
    hourly_rate: 70.00,
    amount: 560.00,
    status: 'pending_approval',
    number: 'INV-001'
  });

  console.log(`✓ Engagement 2 created (${eng2.id}) with 8.0 logged hours and invoice INV-001.`);

  console.log('\nSeeding Engagement 3: Dispute Eligibility Milestone (2 Revisions Reached)...');
  // Create third test project for revision & dispute check
  const { data: proj3 } = await adminClient
    .from('projects')
    .insert({
      client_id: client.id,
      title: 'Boutique Hotel Lobby Refurbishment',
      description: 'Hospitality renovation project with active revisions.',
      category: 'Commercial Architecture',
      budget: 15000.00,
      currency: 'USD',
      payment_type: 'milestone',
      status: 'awarded'
    })
    .select()
    .single();

  const { data: prop3 } = await adminClient
    .from('proposals')
    .insert({
      project_id: proj3!.id,
      designer_id: designer.id,
      total_price: 15000.00,
      currency: 'USD',
      delivery_days: 45,
      cover_letter: 'Boutique hotel lobby proposal.',
      status: 'accepted'
    })
    .select()
    .single();

  const { data: eng3 } = await adminClient
    .from('engagements')
    .insert({
      project_id: proj3!.id,
      proposal_id: prop3!.id,
      client_id: client.id,
      designer_id: designer.id,
      payment_type: 'milestone',
      total_price: 15000.00,
      currency: 'USD',
      platform_fee_percent: 10.00,
      status: 'active',
      terms_snapshot: {
        project_title: proj3!.title,
        category: 'Commercial Architecture'
      }
    })
    .select()
    .single();

  // Milestone with 2 revisions requested
  await adminClient.from('engagement_milestones').insert({
    engagement_id: eng3!.id,
    sort_order: 1,
    name: 'Initial Concept & FF&E Selection',
    fee_percent: 100.00,
    amount: 15000.00,
    status: 'revision_requested',
    payout_status: 'not_due',
    revision_count: 2,
    funded_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    started_at: new Date(Date.now() - 9 * 86400000).toISOString(),
    submitted_at: new Date(Date.now() - 5 * 86400000).toISOString()
  });

  console.log(`✓ Engagement 3 created (${eng3!.id}) with revision_count = 2 (ready for dispute testing).`);

  console.log('\n🎉 Phase 3 Seeding Complete!');
}

seedPhase3().catch((err) => {
  console.error('\n❌ Seeding failed:', err);
  process.exit(1);
});
