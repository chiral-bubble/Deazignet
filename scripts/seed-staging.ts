/**
 * Dezignet Staging Database Seeder & Reset Script
 * Idempotent seeder that sets up realistic United States architectural test data for staging handover.
 *
 * Reads passwords from environment variables:
 * - ADMIN_PASSWORD (defaults to 'AdminTest2026!')
 * - TESTER_PASSWORD (defaults to 'TesterPass2026!')
 * - USER_PASSWORD (defaults to 'Dezignet2026!')
 *
 * Usage:
 *   npx tsx scripts/seed-staging.ts
 * Or via npm:
 *   npm run staging:reset
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Supabase environment variables missing in .env');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminTest2026!';
const TESTER_PASSWORD = process.env.TESTER_PASSWORD || 'TesterPass2026!';
const USER_PASSWORD = process.env.USER_PASSWORD || 'Dezignet2026!';

interface AccountSpec {
  email: string;
  fullName: string;
  role: 'client' | 'designer' | 'admin';
  password: string;
  location?: string;
  isTester: boolean;
  completeOnboarding: boolean;
  professionalType?: string;
  specializations?: string[];
  hourlyRate?: number;
}

const ACCOUNTS: AccountSpec[] = [
  // 1 Admin
  {
    email: 'admin@dezignet.com',
    fullName: 'System Administrator',
    role: 'admin',
    password: ADMIN_PASSWORD,
    isTester: true,
    completeOnboarding: true
  },
  // Tester Pair 1 (Partner Primary - Architect & Client)
  {
    email: 'partner.client@dezignet.com',
    fullName: 'Dr. Eleanor Vance',
    role: 'client',
    password: TESTER_PASSWORD,
    location: 'Austin, TX',
    isTester: true,
    completeOnboarding: true
  },
  {
    email: 'partner.architect@dezignet.com',
    fullName: 'Marcus Vance, AIA',
    role: 'designer',
    password: TESTER_PASSWORD,
    location: 'Austin, TX',
    isTester: true,
    completeOnboarding: true,
    professionalType: 'architect',
    specializations: ['Residential', 'Commercial'],
    hourlyRate: 145
  },
  // Tester Pair 2 (Partner Secondary)
  {
    email: 'partner.client2@dezignet.com',
    fullName: 'David Miller',
    role: 'client',
    password: TESTER_PASSWORD,
    location: 'Denver, CO',
    isTester: true,
    completeOnboarding: true
  },
  {
    email: 'partner.designer2@dezignet.com',
    fullName: 'Sarah Jenkins',
    role: 'designer',
    password: TESTER_PASSWORD,
    location: 'San Francisco, CA',
    isTester: true,
    completeOnboarding: true,
    professionalType: 'interior_designer',
    specializations: ['Residential', 'Commercial'],
    hourlyRate: 110
  },
  // Empty Designer to test initial Onboarding
  {
    email: 'new.designer@dezignet.com',
    fullName: 'Alex Rivera',
    role: 'designer',
    password: USER_PASSWORD,
    location: 'Seattle, WA',
    isTester: true,
    completeOnboarding: false
  },
  // Additional browse accounts
  {
    email: 'designer.commercial@dezignet.com',
    fullName: 'Jennifer Hayes, AIA',
    role: 'designer',
    password: USER_PASSWORD,
    location: 'Chicago, IL',
    isTester: false,
    completeOnboarding: true,
    professionalType: 'architect',
    specializations: ['Commercial', 'Institutional'],
    hourlyRate: 160
  },
  {
    email: 'client.corporate@dezignet.com',
    fullName: 'Beacon Crest Development LLC',
    role: 'client',
    password: USER_PASSWORD,
    location: 'Miami, FL',
    isTester: false,
    completeOnboarding: true
  }
];

async function getOrCreateUser(spec: AccountSpec): Promise<string> {
  const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 100 });
  const existing = listData?.users?.find(u => u.email?.toLowerCase() === spec.email.toLowerCase());

  let userId: string;

  if (existing) {
    userId = existing.id;
    await adminClient.auth.admin.updateUserById(userId, {
      password: spec.password,
      email_confirm: true,
      user_metadata: {
        full_name: spec.fullName,
        role: spec.role
      }
    });
  } else {
    const { data: created, error: cErr } = await adminClient.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: {
        full_name: spec.fullName,
        role: spec.role
      }
    });
    if (cErr || !created.user) {
      throw new Error(`Failed to create user ${spec.email}: ${cErr?.message}`);
    }
    userId = created.user.id;
  }

  // Update public profile
  await adminClient.from('profiles').upsert({
    id: userId,
    full_name: spec.fullName,
    role: spec.role,
    location: spec.location || 'United States',
    is_tester: spec.isTester,
    onboarding_completed_at: spec.completeOnboarding ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  });

  // Role-specific records
  if (spec.role === 'client') {
    await adminClient.from('client_profiles').upsert({
      user_id: userId,
      account_type: 'individual',
      payment_verified: true
    });
  } else if (spec.role === 'designer') {
    await adminClient.from('designer_profiles').upsert({
      user_id: userId,
      professional_type: spec.professionalType || 'architect',
      hourly_rate: spec.hourlyRate || 125,
      specializations: spec.specializations || ['Residential'],
      years_experience: 12,
      bio: 'Licensed architect (AIA, NCARB Certified) specializing in contemporary, energy-efficient residential and commercial architecture across the United States.'
    });
  }

  return userId;
}

async function cleanJunkData() {
  console.log('🧹 Purging any corrupt test artifacts...');
  const junkPatterns = ['%tEST2%', '%hjksdfndj%', '%yy%'];
  for (const pat of junkPatterns) {
    await adminClient.from('projects').delete().ilike('title', pat);
  }
}

async function seedStaging() {
  console.log('===============================================================');
  console.log('🏗️  DEZIGNET STAGING DATABASE SEED & RESET (UNITED STATES)');
  console.log('===============================================================\n');

  // 1. Ensure staging environment setting
  await adminClient.from('app_settings').upsert([
    { key: 'environment', value: 'staging' },
    { key: 'auto_approval_days', value: 5 },
    { key: 'security_period_days', value: 5 },
    { key: 'max_revisions_per_phase', value: 2 },
    { key: 'max_description_chars', value: 2000 }
  ]);

  await cleanJunkData();

  // 2. Create / update accounts
  console.log('👥 Creating / updating US test accounts...');
  const userIds: Record<string, string> = {};
  for (const spec of ACCOUNTS) {
    const uid = await getOrCreateUser(spec);
    userIds[spec.email] = uid;
    console.log(`  ✓ ${spec.role.toUpperCase().padEnd(8)}: ${spec.email} (${spec.fullName})`);
  }

  const client1Id = userIds['partner.client@dezignet.com'];
  const architectId = userIds['partner.architect@dezignet.com'];
  const client2Id = userIds['partner.client2@dezignet.com'];

  // 3. Seed Verified Credentials for Marcus Vance, AIA
  console.log('\n📜 Adding verified AIA / NCARB credentials for Marcus Vance, AIA...');
  await adminClient.from('credentials').upsert({
    designer_id: architectId,
    body_name: 'National Council of Architectural Registration Boards (NCARB)',
    license_number: 'NCARB-78921 / TBAE-24180',
    state_region: 'Texas',
    verification_year: 2017,
    status: 'verified',
    certificate_path: '/assets/demo/sample-schematic.svg',
    submitted_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    verified_at: new Date(Date.now() - 86400000 * 28).toISOString()
  });

  // 4. Seed Projects Across Every Lifecycle Stage
  console.log('\n📁 Seeding US architectural projects across all workflow stages...');

  // --------------------------------------------------------------------------
  // Stage 1: Open project with proposals (one shortlisted, one with a question)
  // --------------------------------------------------------------------------
  const { data: projOpen } = await adminClient.from('projects').upsert({
    client_id: client1Id,
    title: 'Luxury 5-Bedroom Hillside Villa, Austin TX',
    category: 'Residential',
    subcategory: 'Detached house / bungalow',
    disciplines: ['architect', 'engineer'],
    description: 'Seeking a licensed architect to develop schematic design through construction documents for a 5,200 sq ft modern hillside villa with an infinity pool and passive solar shading.',
    location_city: 'Austin',
    location_state: 'Texas',
    design_budget: 65000,
    payment_type: 'milestone',
    status: 'open',
    proposal_deadline: new Date(Date.now() + 86400000 * 10).toISOString().split('T')[0],
    deadline: new Date(Date.now() + 86400000 * 90).toISOString().split('T')[0],
    published_at: new Date(Date.now() - 86400000 * 2).toISOString()
  }).select('id').single();

  if (projOpen) {
    // Milestones
    await adminClient.from('project_milestones').delete().eq('project_id', projOpen.id);
    await adminClient.from('project_milestones').insert([
      { project_id: projOpen.id, phase_order: 1, title: 'Schematic Design', fee_percent: 20, fee_amount: 13000 },
      { project_id: projOpen.id, phase_order: 2, title: 'Design Development', fee_percent: 25, fee_amount: 16250 },
      { project_id: projOpen.id, phase_order: 3, title: 'Construction Documents', fee_percent: 30, fee_amount: 19500 },
      { project_id: projOpen.id, phase_order: 4, title: 'Bidding & Permitting', fee_percent: 15, fee_amount: 9750 },
      { project_id: projOpen.id, phase_order: 5, title: 'Construction Administration', fee_percent: 10, fee_amount: 6500 }
    ]);

    // Proposal 1: Marcus Vance, AIA (Shortlisted)
    await adminClient.from('proposals').upsert({
      project_id: projOpen.id,
      designer_id: architectId,
      status: 'shortlisted',
      total_fee: 62000,
      cover_letter: 'Dear Dr. Vance, our practice has extensive experience designing hillside homes in the Austin Hill Country. We will integrate post-tension foundation coordination and IBC/IRC code compliance.',
      assumptions: ['Client provides boundary & topographic survey and geotechnical soils report', 'City of Austin municipal plan review fees paid directly by client'],
      reimbursable_expenses_type: 'at_cost',
      included_revisions_per_phase: 2,
      created_at: new Date(Date.now() - 86400000).toISOString()
    });

    console.log('  ✓ Stage 1: Open project with shortlisted proposal created.');
  }

  // --------------------------------------------------------------------------
  // Stage 2: Contract waiting for signature
  // --------------------------------------------------------------------------
  const { data: projContract } = await adminClient.from('projects').upsert({
    client_id: client1Id,
    title: 'Boutique Hotel & Rooftop Lounge, Miami Beach FL',
    category: 'Commercial',
    subcategory: 'Hotel & hospitality',
    disciplines: ['architect', 'interior_designer'],
    description: 'Full architectural redesign for a 32-key historic Art Deco boutique hotel with a modern rooftop lounge in South Beach.',
    location_city: 'Miami Beach',
    location_state: 'Florida',
    design_budget: 110000,
    payment_type: 'milestone',
    status: 'in_progress',
    deadline: new Date(Date.now() + 86400000 * 120).toISOString().split('T')[0]
  }).select('id').single();

  if (projContract) {
    const { data: propContract } = await adminClient.from('proposals').upsert({
      project_id: projContract.id,
      designer_id: architectId,
      status: 'accepted',
      total_fee: 105000,
      cover_letter: 'Full architectural, interior and historic preservation review scope.',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString()
    }).select('id').single();

    if (propContract) {
      await adminClient.from('contracts').upsert({
        project_id: projContract.id,
        proposal_id: propContract.id,
        client_id: client1Id,
        designer_id: architectId,
        total_amount: 105000,
        currency: 'USD',
        status: 'draft',
        designer_signature: 'Marcus Vance, AIA',
        designer_signed_at: new Date(Date.now() - 86400000).toISOString(),
        client_signature: null,
        client_signed_at: null,
        contract_terms: {
          milestones: [
            { title: 'Schematic Concepts & Spatial Massing', amount: 21000 },
            { title: 'Design Development & MEP Coordination', amount: 31500 },
            { title: 'Construction Drawing Set & Specifications', amount: 31500 },
            { title: 'Permitting Support & Contractor Bidding', amount: 21000 }
          ]
        }
      });
    }
    console.log('  ✓ Stage 2: Contract awaiting client signature created.');
  }

  // --------------------------------------------------------------------------
  // Stage 3: Active Milestone Project (in review & funded)
  // --------------------------------------------------------------------------
  const { data: projActive } = await adminClient.from('projects').upsert({
    client_id: client1Id,
    title: 'Contemporary Duplex with Cantilevered Terrace, Seattle WA',
    category: 'Residential',
    subcategory: 'Duplex',
    disciplines: ['architect'],
    description: 'Active design execution: 4-bedroom urban duplex overlooking Puget Sound.',
    location_city: 'Seattle',
    location_state: 'Washington',
    design_budget: 72000,
    payment_type: 'milestone',
    status: 'in_progress'
  }).select('id').single();

  if (projActive) {
    const { data: propActive } = await adminClient.from('proposals').upsert({
      project_id: projActive.id,
      designer_id: architectId,
      status: 'accepted',
      total_fee: 72000
    }).select('id').single();

    if (propActive) {
      const { data: engActive } = await adminClient.from('engagements').upsert({
        project_id: projActive.id,
        proposal_id: propActive.id,
        client_id: client1Id,
        designer_id: architectId,
        contract_type: 'milestone',
        agreed_amount: 72000,
        status: 'in_progress',
        created_at: new Date(Date.now() - 86400000 * 14).toISOString()
      }).select('id').single();

      if (engActive) {
        // Milestone 1: Approved & Released
        await adminClient.from('milestones').upsert({
          engagement_id: engActive.id,
          sequence_order: 1,
          title: 'Schematic Layout & Site Analysis',
          amount: 14400,
          status: 'released',
          funded_at: new Date(Date.now() - 86400000 * 12).toISOString(),
          approved_at: new Date(Date.now() - 86400000 * 6).toISOString()
        });

        // Milestone 2: Submitted (in review)
        await adminClient.from('milestones').upsert({
          engagement_id: engActive.id,
          sequence_order: 2,
          title: 'Detailed Architectural Layouts & Elevations',
          amount: 21600,
          status: 'submitted',
          funded_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          submitted_at: new Date(Date.now() - 86400000 * 2).toISOString()
        });

        // Milestone 3: Awaiting Funding
        await adminClient.from('milestones').upsert({
          engagement_id: engActive.id,
          sequence_order: 3,
          title: 'Building Permit Drawing Set & Structural Integration',
          amount: 36000,
          status: 'pending_funding'
        });
      }
    }
    console.log('  ✓ Stage 3: Active milestone project created.');
  }

  // --------------------------------------------------------------------------
  // Stage 4: Active Hourly Project
  // --------------------------------------------------------------------------
  const { data: projHourly } = await adminClient.from('projects').upsert({
    client_id: client2Id,
    title: 'Corporate Innovation Campus, Denver Tech Center CO',
    category: 'Commercial',
    subcategory: 'Office building',
    disciplines: ['architect'],
    description: 'Hourly consultation for commercial office space planning and sustainable wellness interior design.',
    location_city: 'Denver',
    location_state: 'Colorado',
    design_budget: 25000,
    payment_type: 'hourly',
    hourly_rate_max: 120,
    status: 'in_progress'
  }).select('id').single();

  if (projHourly) {
    console.log('  ✓ Stage 4: Active hourly project created.');
  }

  // --------------------------------------------------------------------------
  // Stage 5: Completed Project with Review & Designer Reply
  // --------------------------------------------------------------------------
  const { data: projDone } = await adminClient.from('projects').upsert({
    client_id: client1Id,
    title: 'Modern Minimalist Penthouse Renovation, Manhattan NY',
    category: 'Residential',
    subcategory: 'Apartment block',
    disciplines: ['interior_designer', 'architect'],
    description: 'Complete architectural gut renovation of a 3,500 sq ft pre-war loft penthouse.',
    location_city: 'New York',
    location_state: 'New York',
    design_budget: 50000,
    payment_type: 'milestone',
    status: 'completed'
  }).select('id').single();

  if (projDone) {
    await adminClient.from('reviews').upsert({
      project_id: projDone.id,
      client_id: client1Id,
      designer_id: architectId,
      rating: 5,
      feedback: 'Marcus delivered flawless architectural precision, navigating Department of Buildings approvals smoothly. Exceptional communication.',
      designer_reply: 'Thank you Dr. Vance. It was a pleasure collaborating on this Manhattan residence.',
      created_at: new Date(Date.now() - 86400000 * 20).toISOString()
    });
    console.log('  ✓ Stage 5: Completed project with review created.');
  }

  // --------------------------------------------------------------------------
  // Stage 6: Cancelled Project
  // --------------------------------------------------------------------------
  await adminClient.from('projects').upsert({
    client_id: client2Id,
    title: 'Logistics Hub & Distribution Center, Chicago IL',
    category: 'Industrial',
    subcategory: 'Logistics',
    disciplines: ['engineer'],
    description: 'Feasibility design for a multi-bay industrial distribution center.',
    location_city: 'Chicago',
    location_state: 'Illinois',
    design_budget: 35000,
    status: 'cancelled',
    cancelled_reason: 'Client site acquisition postponed by zoning authority.'
  });
  console.log('  ✓ Stage 6: Cancelled project created.');

  // --------------------------------------------------------------------------
  // Stage 7: Draft Project
  // --------------------------------------------------------------------------
  await adminClient.from('projects').upsert({
    client_id: client1Id,
    title: 'Civic Arts Pavilion & Sculpture Garden, Portland OR',
    category: 'Institutional',
    subcategory: 'Cultural & civic',
    disciplines: ['architect'],
    description: 'Preliminary design concept for a municipal exhibition and pavilion space.',
    location_city: 'Portland',
    location_state: 'Oregon',
    design_budget: 75000,
    payment_type: 'milestone',
    status: 'draft'
  });
  console.log('  ✓ Stage 7: Draft project created.');

  console.log('\n===============================================================');
  console.log('✅ STAGING RESET COMPLETED IN FULL (UNITED STATES DATASET)');
  console.log('===============================================================');
  console.log('Credentials Summary:');
  console.log(`• Admin:              admin@dezignet.com          / ${ADMIN_PASSWORD}`);
  console.log(`• Partner (Client):   partner.client@dezignet.com / ${TESTER_PASSWORD} (Dr. Eleanor Vance)`);
  console.log(`• Partner (Architect):partner.architect@dezignet.com / ${TESTER_PASSWORD} (Marcus Vance, AIA)`);
  console.log(`• New Designer:       new.designer@dezignet.com   / ${USER_PASSWORD} (Alex Rivera)`);
  console.log('===============================================================\n');
}

seedStaging().catch(err => {
  console.error('❌ Staging seed failed:', err);
  process.exit(1);
});
