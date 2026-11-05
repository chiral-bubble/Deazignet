/**
 * US Categories & Specializations Migration Script
 *
 * Maps existing project rows, portfolio projects, and designer specializations
 * from legacy categories to the 6 official US Categories:
 * - Residential
 * - Commercial
 * - Hospitality
 * - Institutional
 * - Healthcare
 * - Industrial
 *
 * Usage:
 *   npx tsx scripts/migrate-categories-to-us.ts
 *   npx tsx scripts/migrate-categories-to-us.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const US_CATEGORIES = [
  'Residential',
  'Commercial',
  'Hospitality',
  'Institutional',
  'Healthcare',
  'Industrial'
] as const;

export type UsCategory = typeof US_CATEGORIES[number];

export const CATEGORY_MAP: Record<string, UsCategory> = {
  // Direct matches
  'residential': 'Residential',
  'commercial': 'Commercial',
  'hospitality': 'Hospitality',
  'institutional': 'Institutional',
  'healthcare': 'Healthcare',
  'industrial': 'Industrial',

  // Legacy architectural mappings
  'civic': 'Institutional',
  'cultural': 'Institutional',
  'religious': 'Institutional',
  'educational': 'Institutional',
  'school': 'Institutional',
  'government': 'Institutional',
  'sports': 'Institutional',
  'hotel & hospitality': 'Hospitality',
  'hotel': 'Hospitality',
  'resort': 'Hospitality',
  'restaurant & cafe': 'Commercial',
  'restaurant': 'Commercial',
  'retail': 'Commercial',
  'office': 'Commercial',
  'workspace': 'Commercial',
  'corporate': 'Commercial',
  'marine': 'Commercial',
  'landscape': 'Residential',
  'landscape architect': 'Residential',
  'interior architecture': 'Residential',
  'luxury': 'Residential',
  'sustainable': 'Residential',
  'timber': 'Residential',
  'passive solar': 'Residential',
  'resilience': 'Residential',
  'structural': 'Commercial',
  'bim': 'Commercial',
  'urban design': 'Commercial',
  'masterplanning': 'Commercial',
  'logistics': 'Industrial',
  'warehouse': 'Industrial',
  'manufacturing': 'Industrial'
};

export const SUBCATEGORY_MAP: Record<string, { category: UsCategory; subcategory: string }> = {
  'luxury villa': { category: 'Residential', subcategory: 'Custom home' },
  'private estate': { category: 'Residential', subcategory: 'Custom home' },
  'villa renovation': { category: 'Residential', subcategory: 'Home addition or remodel' },
  'farmhouse villa': { category: 'Residential', subcategory: 'Single-family home' },
  'detached house / bungalow': { category: 'Residential', subcategory: 'Single-family home' },
  'duplex': { category: 'Residential', subcategory: 'Multifamily' },
  'terrace / semi-detached': { category: 'Residential', subcategory: 'Townhome' },
  'apartment block': { category: 'Residential', subcategory: 'Multifamily' },
  'housing estate': { category: 'Residential', subcategory: 'Multifamily' },
  'student hostel': { category: 'Residential', subcategory: 'Student housing' },
  'penthouse garden': { category: 'Residential', subcategory: 'Multifamily' },
  'corporate workspace': { category: 'Commercial', subcategory: 'Office' },
  'office building': { category: 'Commercial', subcategory: 'Office' },
  'retail / shopping': { category: 'Commercial', subcategory: 'Retail' },
  'creative studio': { category: 'Commercial', subcategory: 'Office' },
  'filling station': { category: 'Commercial', subcategory: 'Retail' },
  'boutique hotel & spa': { category: 'Hospitality', subcategory: 'Hotel' },
  'heritage hotel': { category: 'Hospitality', subcategory: 'Hotel' },
  'cultural center': { category: 'Institutional', subcategory: 'Cultural' },
  'school & university': { category: 'Institutional', subcategory: 'Higher education' },
  'church / mosque / worship': { category: 'Institutional', subcategory: 'Religious' },
  'government building': { category: 'Institutional', subcategory: 'Government and civic' },
  'cultural & civic': { category: 'Institutional', subcategory: 'Cultural' },
  'sports & recreation': { category: 'Institutional', subcategory: 'Recreation' },
  'healthcare architecture': { category: 'Healthcare', subcategory: 'Clinic' },
  'laboratory': { category: 'Healthcare', subcategory: 'Clinic' },
  'pharmacy': { category: 'Healthcare', subcategory: 'Clinic' },
  'factory': { category: 'Industrial', subcategory: 'Manufacturing' },
  'maritime commercial': { category: 'Industrial', subcategory: 'Logistics' }
};

export function mapCategoryToUs(cat: string | null | undefined): UsCategory {
  if (!cat) return 'Residential';
  const clean = cat.trim().toLowerCase();
  if (CATEGORY_MAP[clean]) return CATEGORY_MAP[clean];
  const found = US_CATEGORIES.find((c) => c.toLowerCase() === clean);
  if (found) return found;
  return 'Residential';
}

export function mapSpecializationsToUs(specs: string[] | null | undefined): UsCategory[] {
  if (!specs || !Array.isArray(specs) || specs.length === 0) {
    return ['Residential'];
  }
  const mapped = specs.map(s => mapCategoryToUs(s));
  const unique = Array.from(new Set(mapped));
  return unique.length > 0 ? unique : ['Residential'];
}

export async function migrateCategoriesToUs(options: { dryRun?: boolean } = {}) {
  const isDryRun = options.dryRun ?? process.argv.includes('--dry-run');

  console.log('===============================================================');
  console.log(`🚀 US CATEGORIES MIGRATION ${isDryRun ? '(DRY RUN)' : ''}`);
  console.log('===============================================================\n');

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('⚠️ Supabase credentials not found. Validating mapping logic only.');
    console.log('Sample test mapping:');
    console.log('  "Civic" ->', mapCategoryToUs('Civic'));
    console.log('  "Luxury Villa" ->', mapCategoryToUs('Luxury Villa'));
    console.log('  ["Sustainable", "Civic", "BIM"] ->', mapSpecializationsToUs(['Sustainable', 'Civic', 'BIM']));
    return { projectsUpdated: 0, designersUpdated: 0, portfolioUpdated: 0 };
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  let projectsUpdated = 0;
  let designersUpdated = 0;
  let portfolioUpdated = 0;

  // 1. Migrate Projects
  console.log('📦 Step 1: Scanning projects table...');
  try {
    const { data: projects, error: pErr } = await adminClient
      .from('projects')
      .select('id, title, category, subcategory');

    if (pErr) {
      console.error('Error fetching projects:', pErr.message);
    } else if (projects) {
      for (const p of projects) {
        let newCat = mapCategoryToUs(p.category);
        let newSub = p.subcategory;

        if (p.subcategory) {
          const subLower = p.subcategory.trim().toLowerCase();
          if (SUBCATEGORY_MAP[subLower]) {
            newCat = SUBCATEGORY_MAP[subLower].category;
            newSub = SUBCATEGORY_MAP[subLower].subcategory;
          }
        }

        const catChanged = newCat !== p.category;
        const subChanged = newSub !== p.subcategory;

        if (catChanged || subChanged) {
          console.log(`  Project "${p.title}": [${p.category} > ${p.subcategory || 'none'}] -> [${newCat} > ${newSub || 'none'}]`);
          if (!isDryRun) {
            await adminClient
              .from('projects')
              .update({
                category: newCat,
                subcategory: newSub,
                updated_at: new Date().toISOString()
              })
              .eq('id', p.id);
          }
          projectsUpdated++;
        }
      }
    }
  } catch (err: any) {
    console.error('Projects migration error:', err?.message || err);
  }

  // 2. Migrate Portfolio Projects
  console.log('\n🎨 Step 2: Scanning portfolio_projects table...');
  try {
    const { data: portfolio, error: pfErr } = await adminClient
      .from('portfolio_projects')
      .select('id, title, category');

    if (pfErr) {
      console.warn('Note on portfolio_projects:', pfErr.message);
    } else if (portfolio) {
      for (const pf of portfolio) {
        const newCat = mapCategoryToUs(pf.category);
        if (newCat !== pf.category) {
          console.log(`  Portfolio "${pf.title}": "${pf.category}" -> "${newCat}"`);
          if (!isDryRun) {
            await adminClient
              .from('portfolio_projects')
              .update({
                category: newCat,
                updated_at: new Date().toISOString()
              })
              .eq('id', pf.id);
          }
          portfolioUpdated++;
        }
      }
    }
  } catch (err: any) {
    console.warn('Portfolio migration warning:', err?.message || err);
  }

  // 3. Migrate Designer Specializations
  console.log('\n👤 Step 3: Scanning designer_profiles table...');
  try {
    const { data: designers, error: dErr } = await adminClient
      .from('designer_profiles')
      .select('user_id, specializations');

    if (dErr) {
      console.error('Error fetching designer profiles:', dErr.message);
    } else if (designers) {
      for (const d of designers) {
        const oldSpecs = d.specializations || [];
        const newSpecs = mapSpecializationsToUs(oldSpecs);

        const isSame =
          oldSpecs.length === newSpecs.length &&
          oldSpecs.every((s: string, idx: number) => s === newSpecs[idx]);

        if (!isSame) {
          console.log(`  Designer ID ${d.user_id}: [${oldSpecs.join(', ')}] -> [${newSpecs.join(', ')}]`);
          if (!isDryRun) {
            await adminClient
              .from('designer_profiles')
              .update({
                specializations: newSpecs,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', d.user_id);
          }
          designersUpdated++;
        }
      }
    }
  } catch (err: any) {
    console.error('Designer profiles migration error:', err?.message || err);
  }

  console.log('\n===============================================================');
  console.log('🏁 MIGRATION SUMMARY:');
  console.log(`  - Projects Updated:           ${projectsUpdated}`);
  console.log(`  - Portfolio Projects Updated: ${portfolioUpdated}`);
  console.log(`  - Designer Profiles Updated:  ${designersUpdated}`);
  console.log('===============================================================\n');

  return { projectsUpdated, designersUpdated, portfolioUpdated };
}

if (process.argv[1]?.includes('migrate-categories-to-us')) {
  migrateCategoriesToUs().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
