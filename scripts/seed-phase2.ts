/**
 * Phase 2 Seed Script (Dev Only)
 * Seeds 4 clients, 12 realistic Nigerian architectural projects, milestone plans, and proposals.
 *
 * Usage:
 *   npx tsx scripts/seed-phase2.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const STANDARD_PHASES = [
  {
    sort_order: 1,
    name: 'Pre-Design & Site Feasibility',
    description: 'Topographical analysis, zoning compliance, boundary checks, and architectural design brief sign-off.',
    deliverables: ['Site analysis report', 'Zoning setback clearance', 'Client requirements brief'],
    billing_trigger: 'Approval of Site Feasibility Document',
    fee_percent: 15
  },
  {
    sort_order: 2,
    name: 'Schematic Design',
    description: 'Initial spatial layouts, 3D volumetric massing, preliminary floor plans, and mood board directions.',
    deliverables: ['Concept floor plans (1:100)', 'Massing 3D sketches', 'Spatial relationship matrix'],
    billing_trigger: 'Client Selection & Sign-off of Schematic Concept',
    fee_percent: 20
  },
  {
    sort_order: 3,
    name: 'Design Development',
    description: 'Refined architectural drawings, exterior elevations, window schedules, materials palette, and MEP coordination.',
    deliverables: ['Dimensioned floor plans', '4 exterior elevations', 'Structural coordination overlay'],
    billing_trigger: 'Approval of Coordinated Design Development Package',
    fee_percent: 25
  },
  {
    sort_order: 4,
    name: 'Construction Documents',
    description: 'Permit-ready working drawings, structural details, door/window schedules, and technical building specifications.',
    deliverables: ['Full CAD/BIM construction set', 'Building specifications', 'Foundation & framing details'],
    billing_trigger: 'Delivery of Signed Architectural Permit Set',
    fee_percent: 25
  },
  {
    sort_order: 5,
    name: 'Bidding & Permitting',
    description: 'Assisting client with municipal development approvals, contractor bid evaluation, and tender inquiries.',
    deliverables: ['Local planning submission package', 'Bid tender response analysis', 'Bill of quantities review'],
    billing_trigger: 'Statutory Approval & Contractor Contract Award',
    fee_percent: 10
  },
  {
    sort_order: 6,
    name: 'Construction Administration',
    description: 'Periodic site inspections to certify compliance with architectural drawings and milestone sign-offs.',
    deliverables: ['Site observation reports', 'Shop drawing submittal reviews', 'Defects punch list'],
    billing_trigger: 'Final Certificate of Architectural Completion',
    fee_percent: 5
  }
];

async function createOrGetUser(email: string, pass: string, fullName: string, role: 'designer' | 'client') {
  const { data: listData } = await adminClient.auth.admin.listUsers();
  const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    return existing;
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: pass,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role
    }
  });

  if (error || !data.user) {
    throw new Error(`Failed to create ${email}: ${error?.message}`);
  }

  console.log(`✓ Created user: ${email} (${data.user.id})`);
  return data.user;
}

async function seedPhase2() {
  console.log('🚀 Seeding Phase 2 Clients, Nigerian Projects, Milestones & Proposals...\n');

  // ==========================================================================
  // 1. Seed 4 Client Accounts
  // ==========================================================================
  const clientsData = [
    { email: 'client1@dezignet.test', name: 'Chief Adeleke Johnson', location: 'Victoria Island, Lagos', verified: true },
    { email: 'client2@dezignet.test', name: 'Dr. Ngozi Okonjo', location: 'Maitama, Abuja', verified: true },
    { email: 'client3@dezignet.test', name: 'Alhaji Sanusi Bello', location: 'Kano / Abuja', verified: false },
    { email: 'client4@dezignet.test', name: 'Engr. Tara Davies', location: 'Old GRA, Port Harcourt', verified: true }
  ];

  const clients: any[] = [];
  for (const c of clientsData) {
    const user = await createOrGetUser(c.email, 'Password123!', c.name, 'client');
    await adminClient.from('profiles').upsert({
      id: user.id,
      role: 'client',
      full_name: c.name,
      location: c.location
    });
    await adminClient.from('client_profiles').upsert({
      user_id: user.id,
      payment_verified: c.verified
    });
    clients.push({ ...c, id: user.id });
    console.log(`✓ Seeded client: ${c.name} (${c.email})`);
  }

  // Get designer accounts for proposal creation
  const { data: usersList } = await adminClient.auth.admin.listUsers();
  const completeDesigner = usersList?.users?.find(u => u.email === 'designer.complete@dezignet.test');
  const newDesigner = usersList?.users?.find(u => u.email === 'designer.new@dezignet.test');
  const otherDesigner = usersList?.users?.find(u => u.email === 'zainab.aliyu@dezignet.test');

  if (!completeDesigner) {
    console.warn('Warning: designer.complete@dezignet.test not found. Run seed-phase1.ts first.');
  }

  // ==========================================================================
  // 2. Seed 12 Nigerian Architectural Projects
  // ==========================================================================
  const projectsSpec = [
    {
      clientIndex: 0,
      title: 'Modern Cantilevered Waterfront Residence, Banana Island Lagos',
      category: 'Residential',
      subcategory: 'Luxury Villa',
      description: 'Executive architectural commission for a 5-bedroom cliff-edge lagoon residence. Scope includes post-tensioned cantilevered terraces, motorized louvers, infinity pool, and private jetty.',
      budget: 125000,
      payment_type: 'milestone',
      timeline_days: 140,
      deadline: '2026-11-28',
      area_sqft: 6800,
      location_text: 'Banana Island, Ikoyi, Lagos',
      city: 'Lagos',
      state_region: 'Lagos State',
      status: 'open'
    },
    {
      clientIndex: 1,
      title: 'Mixed-Use Commercial & Tech Innovation Hub, Central Business District Abuja',
      category: 'Commercial',
      subcategory: 'Corporate Workspace',
      description: 'Comprehensive design and spatial master plan for an 8-story commercial tech atrium. Scope includes glulam timber pavilions, central daylight lightwell, and LEED certified envelope.',
      budget: 185000,
      payment_type: 'milestone',
      timeline_days: 200,
      deadline: '2026-12-15',
      area_sqft: 18000,
      location_text: 'Central Business District, Abuja',
      city: 'Abuja',
      state_region: 'FCT',
      status: 'open'
    },
    {
      clientIndex: 3,
      title: 'Boutique Hydrothermal Wellness Spa & Eco-Resort, Port Harcourt Waterfront',
      category: 'Hospitality',
      subcategory: 'Boutique Hotel & Spa',
      description: 'Tactile architectural master plan for a 36-key eco-conscious riverfront resort with subterranean salt-water pools and sustainable timber framing.',
      budget: 95000,
      payment_type: 'hourly',
      hourly_rate_max: 95.0,
      timeline_days: 120,
      deadline: '2026-11-20',
      area_sqft: 8500,
      location_text: 'Bonny River Waterfront, Port Harcourt',
      city: 'Port Harcourt',
      state_region: 'Rivers State',
      status: 'open'
    },
    {
      clientIndex: 2,
      title: 'Traditional Terracotta Civic Cultural Center & Amphitheater, Kano',
      category: 'Civic',
      subcategory: 'Cultural Center',
      description: '600-seat civic performance theater utilizing locally sourced compressed earth blocks, passive solar chimneys, and acoustic courtyard geometries.',
      budget: 140000,
      payment_type: 'milestone',
      timeline_days: 180,
      deadline: '2026-12-05',
      area_sqft: 14200,
      location_text: 'Nasarawa GRA, Kano',
      city: 'Kano',
      state_region: 'Kano State',
      status: 'open'
    },
    {
      clientIndex: 0,
      title: 'Private Sky Penthouse Solarium & Urban Rooftop Garden, Victoria Island',
      category: 'Landscape',
      subcategory: 'Penthouse Garden',
      description: 'Multi-tiered rooftop garden atop a 14-story residential tower. Verification of dead-load capacity, automated drip irrigation, and sea-breeze wind deflectors.',
      budget: 48000,
      payment_type: 'milestone',
      timeline_days: 84,
      deadline: '2026-11-15',
      area_sqft: 3400,
      location_text: 'Ahmadu Bello Way, Victoria Island, Lagos',
      city: 'Lagos',
      state_region: 'Lagos State',
      status: 'open'
    },
    {
      clientIndex: 1,
      title: 'Luxury Hilltop Contemporary Chalet & Retreat, Asokoro Abuja',
      category: 'Residential',
      subcategory: 'Private Estate',
      description: 'Panoramic mountain view 6-bedroom estate with cantilevered basalt stone living volume, solar battery microgrid, and subterranean wine cellar.',
      budget: 210000,
      payment_type: 'milestone',
      timeline_days: 210,
      deadline: '2026-12-20',
      area_sqft: 11500,
      location_text: 'Asokoro Extension, Abuja',
      city: 'Abuja',
      state_region: 'FCT',
      status: 'open'
    },
    {
      clientIndex: 3,
      title: 'Pediatric Medical Specialist Clinic & Diagnostic Pavilion, GRA Port Harcourt',
      category: 'Commercial',
      subcategory: 'Healthcare Architecture',
      description: 'Specialized healthcare pavilion with sensory pediatric waiting courtyards, sterile cleanrooms, and daylight-integrated radiology suite.',
      budget: 115000,
      payment_type: 'hourly',
      hourly_rate_max: 90.0,
      timeline_days: 150,
      deadline: '2026-11-30',
      area_sqft: 7200,
      location_text: 'Phase 2 GRA, Port Harcourt',
      city: 'Port Harcourt',
      state_region: 'Rivers State',
      status: 'open'
    },
    {
      clientIndex: 2,
      title: 'Heritage Courtyard Boutique Hotel & Textile Gallery, Zaria Road',
      category: 'Hospitality',
      subcategory: 'Heritage Hotel',
      description: 'Adaptive reuse of mid-century architectural compound into a 24-key boutique heritage hotel with central shaded fountain courts.',
      budget: 82000,
      payment_type: 'milestone',
      timeline_days: 110,
      deadline: '2026-11-22',
      area_sqft: 6100,
      location_text: 'Zaria Road, Kano',
      city: 'Kano',
      state_region: 'Kano State',
      status: 'open'
    },
    {
      clientIndex: 0,
      title: 'Atlantic View Modular Container Co-Working Space, Lekki Phase 1',
      category: 'Commercial',
      subcategory: 'Creative Studio',
      description: 'Low-carbon modular upcycled steel container creative campus with open-air amphitheater and sustainable rainwater catchment.',
      budget: 65000,
      payment_type: 'milestone',
      timeline_days: 90,
      deadline: '2026-10-31',
      area_sqft: 4500,
      location_text: 'Admiralty Way, Lekki Phase 1, Lagos',
      city: 'Lagos',
      state_region: 'Lagos State',
      status: 'awarded' // Awarded project requirement
    },
    {
      clientIndex: 1,
      title: 'Eco-Sustainable Residential Farmstead Villa, Keffi Corridor',
      category: 'Residential',
      subcategory: 'Farmhouse Villa',
      description: 'Permaculture integrated off-grid family homestead featuring rammed earth thermal walls, natural pool, and solar pergola.',
      budget: 90000,
      payment_type: 'milestone',
      timeline_days: 130,
      deadline: '2026-10-15',
      area_sqft: 5200,
      location_text: 'Keffi Road, Abuja Outskirts',
      city: 'Abuja',
      state_region: 'Nasarawa / FCT',
      status: 'closed' // Closed project requirement
    },
    {
      clientIndex: 2,
      title: 'Suburban Villa Expansion & Structural Renovation Concept, Bompai',
      category: 'Residential',
      subcategory: 'Villa Renovation',
      description: 'Draft design package for structural underpinning and modern steel pavilion extension to a historic suburban residence.',
      budget: 45000,
      payment_type: 'milestone',
      timeline_days: 60,
      deadline: '2026-12-01',
      area_sqft: 2800,
      location_text: 'Bompai GRA, Kano',
      city: 'Kano',
      state_region: 'Kano State',
      status: 'draft' // Draft project 1
    },
    {
      clientIndex: 3,
      title: 'Industrial Marina Operations Headquarters & Yacht Club Concept',
      category: 'Commercial',
      subcategory: 'Maritime Commercial',
      description: 'Draft feasibility package for a dual-purpose maritime logistics office and private yacht basin lounge.',
      budget: 130000,
      payment_type: 'hourly',
      hourly_rate_max: 110.0,
      timeline_days: 160,
      deadline: '2026-12-10',
      area_sqft: 9800,
      location_text: 'Trans-Amadi Industrial Layout, Port Harcourt',
      city: 'Port Harcourt',
      state_region: 'Rivers State',
      status: 'draft' // Draft project 2
    }
  ];

  const createdProjects: any[] = [];
  for (let i = 0; i < projectsSpec.length; i++) {
    const spec = projectsSpec[i];
    const client = clients[spec.clientIndex];

    // Check if project exists by title
    const { data: existing } = await adminClient
      .from('projects')
      .select('id, title')
      .eq('title', spec.title)
      .maybeSingle();

    let projectId = existing?.id;

    if (!projectId) {
      // 1. Insert as draft first to satisfy lifecycle trigger
      const { data: pData, error: pErr } = await adminClient
        .from('projects')
        .insert({
          client_id: client.id,
          title: spec.title,
          category: spec.category,
          subcategory: spec.subcategory,
          description: spec.description,
          budget: spec.budget,
          payment_type: spec.payment_type as any,
          hourly_rate_max: spec.hourly_rate_max ?? null,
          timeline_days: spec.timeline_days,
          deadline: spec.deadline,
          area_sqft: spec.area_sqft,
          location_text: spec.location_text,
          city: spec.city,
          state_region: spec.state_region,
          status: 'draft'
        })
        .select('id')
        .single();

      if (pErr || !pData) {
        console.error(`Error inserting project ${spec.title}:`, pErr);
        continue;
      }
      projectId = pData.id;

      // 2. Insert milestones if milestone payment type
      if (spec.payment_type === 'milestone') {
        const milestonesToInsert = STANDARD_PHASES.map((ph) => ({
          project_id: projectId,
          sort_order: ph.sort_order,
          name: ph.name,
          description: ph.description,
          deliverables: ph.deliverables,
          billing_trigger: ph.billing_trigger,
          fee_percent: ph.fee_percent
        }));

        const { error: mErr } = await adminClient
          .from('project_milestones')
          .insert(milestonesToInsert);

        if (mErr) {
          console.error(`Error inserting milestones for ${spec.title}:`, mErr);
        }
      }

      // 3. Transition to target status (open, awarded, closed)
      if (spec.status !== 'draft') {
        const { error: uErr } = await adminClient
          .from('projects')
          .update({
            status: spec.status as any,
            published_at: new Date().toISOString()
          })
          .eq('id', projectId);

        if (uErr) {
          console.error(`Error updating project status for ${spec.title}:`, uErr);
        }
      }

      console.log(`✓ Seeded project (${spec.status}): ${spec.title}`);
    } else {
      console.log(`Project already exists: ${spec.title}`);
    }

    createdProjects.push({ id: projectId, ...spec });
  }

  // ==========================================================================
  // 3. Seed Proposals from Designers across all statuses
  // ==========================================================================
  if (completeDesigner) {
    console.log('\nSeeding proposals across all statuses for test designers...');

    const openProjects = createdProjects.filter(p => p.status === 'open');

    // Proposal 1: Pending (Complete Designer on Project 0)
    if (openProjects[0]) {
      await adminClient.from('proposals').upsert({
        project_id: openProjects[0].id,
        designer_id: completeDesigner.id,
        status: 'pending',
        cover_letter: 'Chief Johnson, our studio specializes in cantilevered waterfront residences. Having reviewed your site brief, our post-tensioned floor plate methodology will maximize ocean views while remaining within setback restrictions.',
        total_price: 120000,
        currency: 'USD',
        delivery_days: 140,
        project_snapshot: { project: openProjects[0], milestones: STANDARD_PHASES },
        sent_at: new Date(Date.now() - 3600000 * 24).toISOString()
      }, { onConflict: 'project_id,designer_id' });
      console.log('✓ Seeded proposal (pending) on Project 1');
    }

    // Proposal 2: Viewed (Complete Designer on Project 1)
    if (openProjects[1]) {
      await adminClient.from('proposals').upsert({
        project_id: openProjects[1].id,
        designer_id: completeDesigner.id,
        status: 'viewed',
        cover_letter: 'Dr. Okonjo, we propose a climate-responsive central atrium design with solar chimneys for natural thermal stack ventilation. Attached are 3 mass timber projects from our portfolio.',
        total_price: 180000,
        currency: 'USD',
        delivery_days: 190,
        viewed_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        project_snapshot: { project: openProjects[1], milestones: STANDARD_PHASES },
        sent_at: new Date(Date.now() - 3600000 * 48).toISOString()
      }, { onConflict: 'project_id,designer_id' });
      console.log('✓ Seeded proposal (viewed) on Project 2');
    }

    // Proposal 3: Shortlisted (Complete Designer on Project 3)
    if (openProjects[2]) {
      await adminClient.from('proposals').upsert({
        project_id: openProjects[2].id,
        designer_id: completeDesigner.id,
        status: 'shortlisted',
        cover_letter: 'Engr. Davies, our studio offers hourly architectural oversight for high-humidity coastal hydrothermal facilities. We are certified in waterproof structural concrete design.',
        total_price: 92000,
        hourly_rate: 90,
        estimated_hours: 1020,
        currency: 'USD',
        delivery_days: 120,
        viewed_at: new Date(Date.now() - 3600000 * 36).toISOString(),
        decided_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        project_snapshot: { project: openProjects[2] },
        sent_at: new Date(Date.now() - 3600000 * 72).toISOString()
      }, { onConflict: 'project_id,designer_id' });
      console.log('✓ Seeded proposal (shortlisted) on Project 3');
    }

    // Proposal 4: Declined with Reason (Other Designer on Project 0)
    if (openProjects[0] && otherDesigner) {
      await adminClient.from('proposals').upsert({
        project_id: openProjects[0].id,
        designer_id: otherDesigner.id,
        status: 'declined',
        cover_letter: 'Chief Johnson, we propose a modular prefabricated concrete villa system for your Banana Island estate.',
        total_price: 135000,
        currency: 'USD',
        delivery_days: 150,
        viewed_at: new Date(Date.now() - 3600000 * 50).toISOString(),
        decided_at: new Date(Date.now() - 3600000 * 20).toISOString(),
        decline_reason: 'Proposed budget exceeded current phase capital allocation for civil groundworks.',
        project_snapshot: { project: openProjects[0], milestones: STANDARD_PHASES },
        sent_at: new Date(Date.now() - 3600000 * 80).toISOString()
      }, { onConflict: 'project_id,designer_id' });
      console.log('✓ Seeded proposal (declined with reason) on Project 1');
    }

    // Proposal 5: Withdrawn with Reason (Complete Designer on Project 4)
    if (openProjects[3]) {
      await adminClient.from('proposals').upsert({
        project_id: openProjects[3].id,
        designer_id: completeDesigner.id,
        status: 'withdrawn',
        cover_letter: 'Alhaji Sanusi, we have developed civic amphitheater spaces with earthen brick vaults across Northern Nigeria.',
        total_price: 138000,
        currency: 'USD',
        delivery_days: 175,
        decided_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        withdraw_reason: 'Studio capacity fully committed to another institutional commission for Q4.',
        project_snapshot: { project: openProjects[3], milestones: STANDARD_PHASES },
        sent_at: new Date(Date.now() - 3600000 * 96).toISOString()
      }, { onConflict: 'project_id,designer_id' });
      console.log('✓ Seeded proposal (withdrawn with reason) on Project 4');
    }
  }

  console.log('\n🎉 Phase 2 Seeding Complete!');
  console.log('Clients ready:');
  clientsData.forEach(c => console.log(` - ${c.name.padEnd(25)} (${c.email})`));
}

seedPhase2().catch(err => {
  console.error('Seed script error:', err);
  process.exit(1);
});
