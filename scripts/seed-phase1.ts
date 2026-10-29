/**
 * Phase 1 Seed Script (Dev Only)
 * Creates 3 primary test accounts (New Designer, Complete Designer, Client)
 * Plus 12 discoverable designers using Nigerian locations and architectural names.
 *
 * Usage:
 *   npx tsx scripts/seed-phase1.ts
 *   npx tsx scripts/seed-phase1.ts --wipe
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

// Admin client with service_role key to manage auth users and bypass RLS during seeding
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const isWipe = process.argv.includes('--wipe');

const ARCH_PHOTOS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=400&q=80'
];

const PORTFOLIO_COVERS = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80'
];

async function wipeTestUsers() {
  console.log('🧹 Wiping existing @dezignet.test seed accounts...');
  const { data: users, error } = await adminClient.auth.admin.listUsers();
  if (error) {
    console.error('Failed to list users:', error);
    return;
  }

  const testUsers = (users.users || []).filter((u) => u.email?.endsWith('@dezignet.test'));
  for (const u of testUsers) {
    console.log(`Deleting ${u.email} (${u.id})...`);
    await adminClient.auth.admin.deleteUser(u.id);
  }
  console.log(`Wiped ${testUsers.length} test accounts.\n`);
}

async function createOrGetUser(email: string, pass: string, fullName: string, role: 'designer' | 'client') {
  const { data: listData } = await adminClient.auth.admin.listUsers();
  const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    console.log(`User ${email} already exists (${existing.id}).`);
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

async function seedPhase1() {
  if (isWipe) {
    await wipeTestUsers();
  }

  console.log('🚀 Seeding Phase 1 Test Users & Designer Ateliers...\n');

  // ==========================================================================
  // 1. Primary Test Users
  // ==========================================================================

  // (1) New Designer (Empty profile)
  const newDesigner = await createOrGetUser(
    'designer.new@dezignet.test',
    'Password123!',
    'Amara Okafor',
    'designer'
  );
  await adminClient.from('profiles').upsert({
    id: newDesigner.id,
    role: 'designer',
    full_name: 'Amara Okafor',
    location: 'Enugu, Nigeria',
    phone: '+234 802 111 2233'
  });
  await adminClient.from('designer_profiles').upsert({
    user_id: newDesigner.id,
    title: 'Graduate Architectural Designer',
    bio: '',
    specializations: [],
    languages: ['English', 'Igbo'],
    years_experience: 1,
    show_hourly_rate: true,
    is_available: true,
    show_in_search: true
  });
  console.log('✓ Seeded: New Designer (empty profile)');

  // (2) Complete Designer (Full portfolio & verified credential)
  const completeDesigner = await createOrGetUser(
    'designer.complete@dezignet.test',
    'Password123!',
    'Babajide Adeleke',
    'designer'
  );
  await adminClient.from('profiles').upsert({
    id: completeDesigner.id,
    role: 'designer',
    full_name: 'Babajide Adeleke',
    avatar_path: ARCH_PHOTOS[0],
    location: 'Victoria Island, Lagos, Nigeria',
    phone: '+234 803 456 7890'
  });
  await adminClient.from('designer_profiles').upsert({
    user_id: completeDesigner.id,
    professional_type: 'architect',
    title: 'Principal Architect & Urbanist',
    studio_name: 'Adeleke Atelier Architecture',
    bio: 'Specializing in climate-responsive tropical brutalism, post-tensioned cantilevers, and timber integration. Over 15 years leading prestigious residential and commercial masterplans across West Africa.',
    specializations: ['Residential', 'Sustainable', 'Commercial', 'Masterplanning'],
    languages: ['English', 'Yoruba', 'French'],
    years_experience: 16,
    hourly_rate: 175.00,
    show_hourly_rate: true,
    is_available: true,
    availability_note: 'Accepting select residential and civic commissions for Q1 2027.',
    show_in_search: true
  });

  // Add 3 Portfolio Projects for Complete Designer
  const projects = [
    {
      title: 'Eko Atlantic Waterfront Penthouse',
      year: 2024,
      category: 'Residential',
      location: 'Victoria Island, Lagos',
      description: 'Ultra-luxury duplex residence with oceanfront cantilevers and passive solar cedar screening.',
      role: 'Lead Architect',
      sort_order: 1,
      cover_image_path: PORTFOLIO_COVERS[0]
    },
    {
      title: 'Ikoyi Technology Innovation Hub',
      year: 2023,
      category: 'Commercial',
      location: 'Ikoyi, Lagos',
      description: 'Biophilic open-plan workplace with acoustic timber baffles and 4-storey central solar atrium.',
      role: 'Architectural Director',
      sort_order: 2,
      cover_image_path: PORTFOLIO_COVERS[1]
    },
    {
      title: 'Maitama Contemporary Hillside Villa',
      year: 2022,
      category: 'Residential',
      location: 'Abuja, FCT',
      description: 'Rammed earth and off-shutter concrete estate configured for natural cross-ventilation.',
      role: 'Design Principal',
      sort_order: 3,
      cover_image_path: PORTFOLIO_COVERS[2]
    }
  ];

  for (const p of projects) {
    const { data: proj } = await adminClient
      .from('portfolio_projects')
      .insert({
        designer_id: completeDesigner.id,
        ...p
      })
      .select()
      .single();

    if (proj) {
      await adminClient.from('portfolio_images').insert([
        { portfolio_project_id: proj.id, path: p.cover_image_path, sort_order: 1 },
        { portfolio_project_id: proj.id, path: PORTFOLIO_COVERS[3], sort_order: 2 }
      ]);
    }
  }

  // Add Verified Credential for Complete Designer
  await adminClient.from('credentials').insert({
    designer_id: completeDesigner.id,
    body: 'ARCON',
    number: 'F-8821',
    state_region: 'Lagos',
    year: 2010,
    certificate_path: 'https://dezignet.studio/certs/arcon-f8821.pdf',
    status: 'verified',
    reviewed_at: new Date().toISOString()
  });
  console.log('✓ Seeded: Complete Designer with 3 projects & verified credential');

  // (3) Client Account
  const clientUser = await createOrGetUser(
    'client@dezignet.test',
    'Password123!',
    'Dr. Femi Johnson',
    'client'
  );
  await adminClient.from('profiles').upsert({
    id: clientUser.id,
    role: 'client',
    full_name: 'Dr. Femi Johnson',
    location: 'Ikoyi, Lagos, Nigeria',
    phone: '+234 809 999 8877'
  });
  console.log('✓ Seeded: Client Account (Dr. Femi Johnson)');

  // ==========================================================================
  // 2. Extra 12 Designers for Search (Nigerian Locations & Specialized Ateliers)
  // ==========================================================================
  console.log('\nSeeding 12 discoverable designers for talent search...');

  const extraDesigners = [
    {
      name: 'Zainab Aliyu',
      email: 'zainab.aliyu@dezignet.test',
      city: 'Abuja',
      state: 'FCT',
      title: 'Civic & Cultural Heritage Architect',
      studio: 'Aliyu Vernacular Works',
      bio: 'Blending northern Nigerian earth architecture with contemporary glass curtain wall technology.',
      specs: ['Civic', 'Sustainable', 'Cultural'],
      years: 12,
      rate: 150,
      verified: true
    },
    {
      name: 'Nnamdi Eze',
      email: 'nnamdi.eze@dezignet.test',
      city: 'Enugu',
      state: 'Enugu State',
      title: 'Topographic & Hillside Architect',
      studio: 'Eze & Partners',
      bio: 'Terraced hillside residential villas harmonized with undulating coal-city rock formations.',
      specs: ['Residential', 'Landscape', 'Structural'],
      years: 14,
      rate: 160,
      verified: true
    },
    {
      name: 'Folake Coker',
      email: 'folake.coker@dezignet.test',
      city: 'Ikeja',
      state: 'Lagos State',
      title: 'Sustainable Interior Architect & BIM Lead',
      studio: 'Coker Spatial Atelier',
      bio: 'Acoustic treatment, corporate workplace agile planning, and bespoke African teak joinery.',
      specs: ['Interior Architecture', 'Commercial', 'BIM'],
      years: 9,
      rate: 130,
      verified: true
    },
    {
      name: 'Chukwuma Obi',
      email: 'chukwuma.obi@dezignet.test',
      city: 'Port Harcourt',
      state: 'Rivers State',
      title: 'Marine & Waterfront Structural Architect',
      studio: 'Delta Shoreline Architects',
      bio: 'Designing elevated pile residences, private yacht clubs, and flood-resilient coastal infrastructure.',
      specs: ['Marine', 'Residential', 'Resilience'],
      years: 17,
      rate: 190,
      verified: true
    },
    {
      name: 'Halima Bello',
      email: 'halima.bello@dezignet.test',
      city: 'Kaduna',
      state: 'Kaduna State',
      title: 'Passive Solar & Rammed Earth Architect',
      studio: 'Bello Earth & Sun Studio',
      bio: 'Thermally isolated adobe residential developments with integrated solar harvesting arrays.',
      specs: ['Sustainable', 'Residential', 'Passive Solar'],
      years: 8,
      rate: 125,
      verified: false
    },
    {
      name: 'Damilola Balogun',
      email: 'damilola.balogun@dezignet.test',
      city: 'Lekki',
      state: 'Lagos State',
      title: 'Modern Luxury Villa Specialist',
      studio: 'Studio Balogun Lagos',
      bio: 'Curating minimalist glass pavilions, cantilevered infinity pools, and zero-energy private residences.',
      specs: ['Residential', 'Luxury', 'Interior Architecture'],
      years: 11,
      rate: 165,
      verified: true
    },
    {
      name: 'Yetunde Adelegan',
      email: 'yetunde.adelegan@dezignet.test',
      city: 'Ibadan',
      state: 'Oyo State',
      title: 'Tropical Landscape & Urban Ecology Architect',
      studio: 'Adelegan Botanic Environments',
      bio: 'Restorative urban pocket parks, rain gardens, and native wetland conservation masterplans.',
      specs: ['Landscape Architect', 'Urban Design', 'Sustainable'],
      years: 13,
      rate: 140,
      verified: true
    },
    {
      name: 'Ibrahim Danjuma',
      email: 'ibrahim.danjuma@dezignet.test',
      city: 'Kano',
      state: 'Kano State',
      title: 'Commercial Logistics & Industrial Architect',
      studio: 'Danjuma Infrastructure Group',
      bio: 'High-bay dry port logistics hubs, cold storage distribution facilities, and long-span warehouses.',
      specs: ['Industrial', 'Commercial', 'Logistics'],
      years: 15,
      rate: 155,
      verified: true
    },
    {
      name: 'Kemi Oshodi',
      email: 'kemi.oshodi@dezignet.test',
      city: 'Victoria Island',
      state: 'Lagos State',
      title: 'High-Density Residential Architect',
      studio: 'Oshodi Urban Density',
      bio: 'Compact urban high-rises with sky gardens, automated underground parking, and smart metering.',
      specs: ['Residential', 'Urban Design', 'BIM'],
      years: 10,
      rate: 145,
      verified: true
    },
    {
      name: 'Emeka Nwosu',
      email: 'emeka.nwosu@dezignet.test',
      city: 'Asaba',
      state: 'Delta State',
      title: 'Hospitality & Luxury Resort Architect',
      studio: 'Nwosu Leisure Atelier',
      bio: 'Boutique riverfront lodges, conference retreats, and wellness spas built with locally quarried stone.',
      specs: ['Hospitality', 'Commercial', 'Landscape'],
      years: 14,
      rate: 150,
      verified: false
    },
    {
      name: 'Aisha Mohammed',
      email: 'aisha.mohammed@dezignet.test',
      city: 'Jos',
      state: 'Plateau State',
      title: 'Alpine & Highland Biophilic Architect',
      studio: 'Plateau High Living',
      bio: 'Taking advantage of Jos temperate altitude with natural stone masonry, glass conservatories, and timber trusses.',
      specs: ['Residential', 'Sustainable', 'Timber'],
      years: 9,
      rate: 135,
      verified: true
    },
    {
      name: 'Tunde Bakare',
      email: 'tunde.bakare@dezignet.test',
      city: 'Abeokuta',
      state: 'Ogun State',
      title: 'Granite Outcrop & Quarry Architectural Lead',
      studio: 'Bakare Rock Atelier',
      bio: 'Integrating monumental granite boulders into foundations and exterior living amphitheaters.',
      specs: ['Residential', 'Landscape', 'Structural'],
      years: 16,
      rate: 170,
      verified: true
    }
  ];

  for (let i = 0; i < extraDesigners.length; i++) {
    const d = extraDesigners[i];
    const user = await createOrGetUser(d.email, 'Password123!', d.name, 'designer');

    await adminClient.from('profiles').upsert({
      id: user.id,
      role: 'designer',
      full_name: d.name,
      avatar_path: ARCH_PHOTOS[i % ARCH_PHOTOS.length],
      location: `${d.city}, ${d.state}, Nigeria`,
      phone: `+234 80${i} 000 1122`
    });

    await adminClient.from('designer_profiles').upsert({
      user_id: user.id,
      title: d.title,
      studio_name: d.studio,
      bio: d.bio,
      specializations: d.specs,
      languages: ['English'],
      years_experience: d.years,
      hourly_rate: d.rate,
      show_hourly_rate: true,
      show_in_search: true,
      is_available: true
    });

    // Add 1 sample portfolio project
    await adminClient.from('portfolio_projects').insert({
      designer_id: user.id,
      title: `${d.city} Signature Commission`,
      year: 2023,
      category: d.specs[0] || 'Residential',
      location: `${d.city}, Nigeria`,
      description: d.bio,
      role: 'Lead Architect',
      sort_order: 1,
      cover_image_path: PORTFOLIO_COVERS[i % PORTFOLIO_COVERS.length]
    });

    if (d.verified) {
      await adminClient.from('credentials').insert({
        designer_id: user.id,
        body: 'NIA / ARCON',
        number: `REG-${2000 + i}`,
        state_region: d.state,
        year: 2012 + (i % 8),
        status: 'verified',
        reviewed_at: new Date().toISOString()
      });
    }

    console.log(`✓ Seeded search designer (${i + 1}/12): ${d.name} (${d.city}, ${d.state})`);
  }

  console.log('\n🎉 Phase 1 Seeding Complete!');
  console.log('Accounts ready:');
  console.log(' - New Designer:      designer.new@dezignet.test      / Password123!');
  console.log(' - Complete Designer: designer.complete@dezignet.test / Password123!');
  console.log(' - Client:            client@dezignet.test            / Password123!');
}

seedPhase1().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
