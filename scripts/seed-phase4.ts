/**
 * Phase 4 Database Seeding Script
 * Seeds realistic conversations, messages, notifications, and Phase 3 amendment test data.
 *
 * Usage:
 *   npx tsx scripts/seed-phase4.ts
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

async function seedPhase4() {
  console.log('===============================================================');
  console.log('🌱 SEEDING DEZIGNET PHASE 4: CONVERSATIONS & NOTIFICATIONS');
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

  // Ensure client exists in client_profiles
  await adminClient.from('client_profiles').upsert({ user_id: client.id });

  // 2. Ensure an Active Engagement exists
  let { data: eng } = await adminClient
    .from('engagements')
    .select('id, project_id, proposal_id, client_id, designer_id')
    .eq('client_id', client.id)
    .eq('designer_id', designer.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!eng) {
    // Look for awarded project & accepted proposal
    const { data: proj } = await adminClient
      .from('projects')
      .select('id')
      .eq('client_id', client.id)
      .limit(1)
      .maybeSingle();

    if (!proj) {
      throw new Error('Please run seed-phase3.ts first to create base projects and engagements.');
    }

    const { data: prop } = await adminClient
      .from('proposals')
      .select('id')
      .eq('project_id', proj.id)
      .eq('designer_id', designer.id)
      .limit(1)
      .maybeSingle();

    if (prop) {
      const { data: newEng } = await adminClient
        .from('engagements')
        .insert({
          project_id: proj.id,
          proposal_id: prop.id,
          client_id: client.id,
          designer_id: designer.id,
          payment_type: 'milestone',
          total_price: 50000.00,
          currency: 'USD',
          status: 'active',
          terms_snapshot: { scope: 'Full architectural drawings' }
        })
        .select()
        .single();
      eng = newEng;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. SEED PHASE 3 AMENDMENT TEST MILESTONES
  // ---------------------------------------------------------------------------
  console.log('📦 Seeding Phase 3 Amendment Test Milestones...');
  if (eng) {
    // 3a. Milestone submitted 15 days ago (Ready for 14-day auto-approval)
    const submitted15DaysAgo = new Date(Date.now() - 15 * 86400 * 1000).toISOString();
    const { data: msAuto, error: msAutoErr } = await adminClient
      .from('engagement_milestones')
      .insert({
        engagement_id: eng.id,
        sort_order: 10,
        name: 'Auto-Approve Test Milestone (15 Days Inactive)',
        description: 'Test deliverable submitted 15 days ago with no client feedback.',
        amount: 8500.00,
        fee_percent: 10.0,
        status: 'submitted',
        payout_status: 'not_due',
        funded_at: submitted15DaysAgo,
        started_at: submitted15DaysAgo,
        submitted_at: submitted15DaysAgo,
        revision_count: 0
      })
      .select()
      .single();

    if (msAuto) {
      await adminClient.from('milestone_submissions').insert({
        milestone_id: msAuto.id,
        version: 1,
        notes: 'Submitted initial design scheme 15 days ago.',
        submitted_at: submitted15DaysAgo
      });
      console.log(`  ✓ Milestone for 14-day Auto-Approval created: ${msAuto.id}`);
    }

    // 3b. Milestone approved 3 days ago (In 5-day security hold)
    const approved3DaysAgo = new Date(Date.now() - 3 * 86400 * 1000).toISOString();
    const releaseIn2Days = new Date(Date.now() + 2 * 86400 * 1000).toISOString();
    const { data: msHold, error: msHoldErr } = await adminClient
      .from('engagement_milestones')
      .insert({
        engagement_id: eng.id,
        sort_order: 11,
        name: 'Payout Security Hold Milestone (Releases in 2 days)',
        description: 'Approved 3 days ago; in 5-day mandatory security hold.',
        amount: 12000.00,
        fee_percent: 10.0,
        status: 'approved',
        payout_status: 'pending_release',
        approval_source: 'client',
        funded_at: approved3DaysAgo,
        started_at: approved3DaysAgo,
        submitted_at: approved3DaysAgo,
        approved_at: approved3DaysAgo,
        release_at: releaseIn2Days,
        revision_count: 0
      })
      .select()
      .single();

    if (msHold) {
      console.log(`  ✓ Milestone in 5-day Security Hold created: ${msHold.id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. SEED REALISTIC CONVERSATIONS & MESSAGES
  // ---------------------------------------------------------------------------
  console.log('\n💬 Seeding Conversations & Messages...');

  if (eng) {
    // 4a. Active Conversation with rich history
    const { data: conv1 } = await adminClient
      .from('conversations')
      .upsert({
        project_id: eng.project_id,
        proposal_id: eng.proposal_id,
        client_id: client.id,
        designer_id: designer.id,
        status: 'active',
        last_message_preview: 'I have attached the updated structural schematics and elevations for Section B.',
        last_message_at: new Date(Date.now() - 25 * 60 * 1000).toISOString()
      }, { onConflict: 'project_id,designer_id' })
      .select()
      .single();

    if (conv1) {
      // User settings
      await adminClient.from('conversation_user_settings').upsert([
        { conversation_id: conv1.id, user_id: designer.id, muted: false, archived: false, last_read_at: new Date().toISOString() },
        { conversation_id: conv1.id, user_id: client.id, muted: false, archived: false, last_read_at: new Date().toISOString() }
      ]);

      // Messages in Conversation 1
      const m1Time = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const m2Time = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const m3Time = new Date(Date.now() - 25 * 60 * 1000).toISOString();

      await adminClient.from('messages').insert([
        {
          conversation_id: conv1.id,
          sender_id: client.id,
          kind: 'text',
          body: 'Hello! Excited to kick off this project with you. Can you review the foundation depth requirements for the steep hillside slope?',
          created_at: m1Time,
          delivered_at: m1Time
        },
        {
          conversation_id: conv1.id,
          sender_id: designer.id,
          kind: 'text',
          body: 'Absolutely. We will conduct a thorough structural load calculation and provide stepped footing details in the Phase 1 deliverable.',
          created_at: m2Time,
          delivered_at: m2Time
        }
      ]);

      const { data: msg3 } = await adminClient
        .from('messages')
        .insert({
          conversation_id: conv1.id,
          sender_id: designer.id,
          kind: 'text',
          body: 'I have attached the updated structural schematics and elevations for Section B.',
          created_at: m3Time,
          delivered_at: m3Time
        })
        .select()
        .single();

      if (msg3) {
        await adminClient.from('message_attachments').insert([
          {
            message_id: msg3.id,
            path: '/mock-uploads/Section_B_Elevations_Rev3.pdf',
            file_name: 'Section_B_Elevations_Rev3.pdf',
            size_bytes: 4850000,
            mime_type: 'application/pdf'
          },
          {
            message_id: msg3.id,
            path: '/mock-uploads/Structural_Foundation_Plan.dwg',
            file_name: 'Structural_Foundation_Plan.dwg',
            size_bytes: 12400000,
            mime_type: 'application/octet-stream'
          }
        ]);
      }

      // System message
      await adminClient.from('messages').insert({
        conversation_id: conv1.id,
        sender_id: client.id,
        kind: 'system',
        system_type: 'milestone_funded',
        body: 'Milestone 1 funded into escrow: $18,500.00',
        created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
      });

      console.log(`  ✓ Active Conversation seeded: ${conv1.id} with messages & attachments`);
    }

    // 4b. Conversation with unread messages for designer
    // Create an inquiry project
    const { data: proj2 } = await adminClient
      .from('projects')
      .insert({
        client_id: client.id,
        title: 'Boutique Hotel Wellness Pavilion',
        description: 'Eco-conscious spa pavilion with natural ventilation.',
        category: 'Hospitality',
        subcategory: 'Hotels',
        budget: 45000.00,
        currency: 'USD',
        payment_type: 'milestone',
        status: 'open'
      })
      .select()
      .single();

    if (proj2) {
      const { data: prop2 } = await adminClient
        .from('proposals')
        .insert({
          project_id: proj2.id,
          designer_id: designer.id,
          total_price: 42000.00,
          currency: 'USD',
          delivery_days: 30,
          cover_letter: 'Experienced in luxury hospitality and hydrothermal spa planning.',
          project_snapshot: { title: proj2.title, budget: proj2.budget },
          status: 'viewed',
          viewed_at: new Date(Date.now() - 3600 * 1000).toISOString()
        })
        .select()
        .single();

      if (prop2) {
        const { data: conv2 } = await adminClient
          .from('conversations')
          .insert({
            project_id: proj2.id,
            proposal_id: prop2.id,
            client_id: client.id,
            designer_id: designer.id,
            status: 'active',
            last_message_preview: 'Could we schedule a discovery call to discuss the thermal mass specifications?',
            last_message_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
          })
          .select()
          .single();

        if (conv2) {
          // Unread by designer (last_read_at is before message time)
          await adminClient.from('conversation_user_settings').upsert([
            { conversation_id: conv2.id, user_id: designer.id, muted: false, archived: false, last_read_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
            { conversation_id: conv2.id, user_id: client.id, muted: false, archived: false, last_read_at: new Date().toISOString() }
          ]);

          await adminClient.from('messages').insert({
            conversation_id: conv2.id,
            sender_id: client.id,
            kind: 'text',
            body: 'Could we schedule a discovery call to discuss the thermal mass specifications?',
            created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString()
          });

          console.log(`  ✓ Unread Conversation seeded: ${conv2.id}`);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 5. SEED NOTIFICATIONS & PREFERENCES
  // ---------------------------------------------------------------------------
  console.log('\n🔔 Seeding Notifications & Preferences for Designer...');

  // Set default notification preferences
  await adminClient.from('notification_preferences').upsert([
    { user_id: designer.id, type: 'message_received', in_app: true, email: false },
    { user_id: designer.id, type: 'deliverable_approved', in_app: true, email: true },
    { user_id: designer.id, type: 'payment_released', in_app: true, email: true },
    { user_id: designer.id, type: 'milestone_funded', in_app: true, email: true },
    { user_id: designer.id, type: 'review_reminder', in_app: true, email: true }
  ]);

  const notifications = [
    {
      user_id: designer.id,
      type: 'message_received',
      title: 'New message from Dr. Julian Sterling',
      body: '"The cantilevers over the terrace are looking stunning. Could we verify the wind load calcs?"',
      read_at: null,
      data: { conversation_id: 'conv-1', client_name: 'Dr. Julian Sterling', destination_url: '#conversations' },
      created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'proposal_shortlisted',
      title: 'Proposal shortlisted by Vance Kinetic Capital',
      body: 'Your architectural proposal for Fintech Headquarters Workspace Architecture was moved to final selection.',
      read_at: null,
      data: { proposal_id: 'prop-2', project_title: 'Fintech Headquarters', destination_url: '#my-work/proposals' },
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'payment_released',
      title: 'Milestone payment released: $12,500.00',
      body: 'Funds for Phase 2: Detailed Architectural Drawings have cleared after the 5-day security period.',
      read_at: null,
      data: { amount: 12500, destination_url: '#payments/transactions' },
      created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'deliverable_approved',
      title: 'Deliverable approved: Alpine Hotel Hydrothermal Spa',
      body: 'Alpine Heritage Group approved Phase 1 schematics. Funds will release in 5 days.',
      read_at: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
      data: { project_id: 'proj-spa', destination_url: '#my-work/projects' },
      created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'proposal_viewed',
      title: 'Proposal viewed by Ambassador David Lindqvist',
      body: 'Client reviewed your proposal and portfolio for Geneva Diplomatic Executive Lounge.',
      read_at: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
      data: { proposal_id: 'prop-3', destination_url: '#my-work/proposals' },
      created_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'milestone_funded',
      title: 'Milestone deposit funded into escrow: $18,500.00',
      body: 'Katherine Sterling funded Phase 2 for Modern Cantilevered Residence.',
      read_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
      data: { amount: 18500, destination_url: '#my-work/projects' },
      created_at: new Date(Date.now() - 4 * 86400 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'credential_verified',
      title: 'AIA license credentials verified',
      body: 'Your AIA Registered Architect credential was approved and the badge is now live.',
      read_at: new Date(Date.now() - 4 * 86400 * 1000).toISOString(),
      data: { credential_name: 'AIA Registered Architect', destination_url: '#profile' },
      created_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'review_reminder',
      title: 'Deliverable review reminder dispatched to client',
      body: 'Client has been reminded of the submitted deliverable (Phase 2). Auto-approves in 2 days if unreviewed.',
      read_at: null,
      data: { milestone_name: 'Phase 2', destination_url: '#my-work/projects' },
      created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
    },
    {
      user_id: designer.id,
      type: 'system_announcement',
      title: 'Platform Maintenance Notice',
      body: 'Dezignet will undergo scheduled infrastructure maintenance on Sunday from 2 AM to 4 AM UTC.',
      read_at: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
      data: { importance: 'routine', destination_url: '#' },
      created_at: new Date(Date.now() - 6 * 86400 * 1000).toISOString()
    }
  ];

  const { error: notifErr } = await adminClient.from('notifications').insert(notifications);
  if (notifErr) {
    console.warn('  ⚠️ Note inserting notifications:', notifErr.message);
  } else {
    console.log(`  ✓ Inserted ${notifications.length} realistic notifications`);
  }

  console.log('\n===============================================================');
  console.log('✅ PHASE 4 SEEDING COMPLETE!');
  console.log('===============================================================\n');
}

seedPhase4().catch((err) => {
  console.error('\n❌ Seeding failed:', err);
  process.exit(1);
});

