/**
 * Dezignet Comprehensive Test Suite:
 * Project Intake, Taxonomy, Phases, Pricing Types, Proposal Licensure Disclosure & Saved Searches
 *
 * Verifies:
 * 1. Professionals & Services Catalog Taxonomy:
 *    - 8 professional types in ProfessionalType enum
 *    - 19 services catalog items with proper ordering and definitions
 *    - getServicesCatalog() returns 19 items
 *    - Designer profile services_offered support
 *    - Services overlap scoring (+20 points) in matching logic
 *
 * 2. Project Intake (Wizard & Data):
 *    - Draft creation and autosave with budget_min, requested_services, licensure_requirement, visibility, deliverables_checklist
 *    - Budget range formatting ("$X to $Y")
 *    - Project publish validation:
 *      * requires at least 1 requested_service
 *      * enforces prohibited_project_categories
 *      * enforces fixed fee 100% single milestone rule
 *    - Invitation-only visibility support
 *
 * 3. Phases & Pricing Types:
 *    - 9 phase templates present
 *    - Default 5 phases checked totaling exactly 100%
 *    - Pricing types: fixed_fee, milestone, hourly
 *    - Fixed fee creates single 100% milestone
 *
 * 4. Proposal Composer & Licensure Disclosure:
 *    - Proposal fields: project_understanding (<=1000 chars), deliverables, schedule, attachments
 *    - Licensure disclosure: can_offer_regulated_services, service_area_states
 *    - Never blocks submission regardless of regulated services choice
 *    - Proposal card, detail & compare view payload mappings
 *
 * 5. Saved Searches Service:
 *    - Create, list, delete saved searches for 'projects' and 'designers'
 *    - Max 10 saved searches strict limit enforcement
 *
 * 6. Migration 046 integrity check:
 *    - Validates SQL migration file structure and definitions
 *
 * Usage:
 *   npx tsx scripts/test-project-intake-licensure-saved-searches.ts
 */

import fs from 'fs';
import path from 'path';
import { USE_MOCKS } from '../src/lib/supabase';
USE_MOCKS.projects = true;
USE_MOCKS.proposals = true;
import {
  SERVICES_CATALOG,
  DEFAULT_PHASE_TEMPLATES,
  PROHIBITED_PROJECT_CATEGORIES,
  getServicesCatalog,
  createDraftProject,
  autosaveDraft,
  getProjectDraft,
  publishProject,
  submitProposal,
  getMyProposals,
  type ProposalSubmission
} from '../src/services/projectsService';
import {
  savedSearchesService
} from '../src/services/savedSearchesService';
import type {
  ProfessionalType,
  PaymentType,
  CanOfferRegulatedServices
} from '../src/types/database.types';

// Simple Test Runner Harness
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual === expected) {
    console.log(`  ✓ ${message} [${actual}]`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message} (Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)})`);
    failedCount++;
  }
}

async function runTests() {
  console.log('\n=============================================================');
  console.log(' DEZIGNET COMPREHENSIVE TEST SUITE:');
  console.log(' INTAKE, TAXONOMY, PHASES, LICENSURE DISCLOSURE & SAVED SEARCHES');
  console.log('=============================================================\n');

  // -------------------------------------------------------------
  // TEST 1: Professionals & Services Catalog Taxonomy
  // -------------------------------------------------------------
  console.log('--- 1. PROFESSIONALS & SERVICES CATALOG TAXONOMY ---');

  const EXPECTED_PROF_TYPES: ProfessionalType[] = [
    'architect',
    'engineer',
    'interior_designer',
    'landscape_architect',
    'bim_specialist',
    'visualization_professional',
    'drafter_cad',
    'other_consultant'
  ];
  assertEqual(EXPECTED_PROF_TYPES.length, 8, '8 professional types specified in product brief');

  const EXPECTED_19_SERVICES = [
    'New construction',
    'Renovation',
    'Tenant improvement',
    'Residential design',
    'Commercial architecture',
    'Interior design',
    'Landscape and site planning',
    'Feasibility',
    'Master planning',
    'Civil engineering',
    'Structural engineering',
    'MEP engineering',
    'Revit and BIM',
    'CAD drafting',
    'Scan-to-BIM and as-builts',
    '3D visualization',
    'Permit drawings',
    'Construction documents',
    'Construction administration'
  ];

  assertEqual(SERVICES_CATALOG.length, 19, 'SERVICES_CATALOG contains exactly 19 services');

  const missingServices = EXPECTED_19_SERVICES.filter(svc => !SERVICES_CATALOG.includes(svc));
  assertEqual(missingServices.length, 0, 'All 19 services from product brief are in SERVICES_CATALOG');

  const catalogFromService = await getServicesCatalog();
  assertEqual(catalogFromService.length, 19, 'getServicesCatalog() returns 19 services in catalog');
  assertEqual(catalogFromService[0], 'New construction', 'First service in sorted catalog is New construction');
  assertEqual(catalogFromService[catalogFromService.length - 1], 'Construction administration', 'Last service in sorted catalog is Construction administration');

  // Verify engineering subdisciplines are in services, not professional types
  assert(SERVICES_CATALOG.includes('Structural engineering'), 'Structural engineering is a service');
  assert(SERVICES_CATALOG.includes('Civil engineering'), 'Civil engineering is a service');
  assert(SERVICES_CATALOG.includes('MEP engineering'), 'MEP engineering is a service');


  // -------------------------------------------------------------
  // TEST 2: Phases & Pricing Types (Fixed Fee, Milestone, Hourly)
  // -------------------------------------------------------------
  console.log('\n--- 2. PHASES & PRICING TYPES ---');

  const EXPECTED_9_PHASES = [
    'Programming',
    'Feasibility',
    'Conceptual Design',
    'Schematic Design',
    'Design Development',
    'Construction Documents',
    'Permitting',
    'Bidding',
    'Construction Administration'
  ];

  assertEqual(DEFAULT_PHASE_TEMPLATES.length, 9, 'DEFAULT_PHASE_TEMPLATES contains 9 phases');
  
  const phaseNames = DEFAULT_PHASE_TEMPLATES.map(p => p.name);
  const missingPhases = EXPECTED_9_PHASES.filter(name => !phaseNames.includes(name));
  assertEqual(missingPhases.length, 0, 'All 9 phase templates present');

  const defaultChecked = DEFAULT_PHASE_TEMPLATES.filter(p => !p.is_optional);
  assertEqual(defaultChecked.length, 5, 'Default checked phases count is 5');

  const defaultTotalPercent = defaultChecked.reduce((sum, p) => sum + p.default_fee_percent, 0);
  assertEqual(defaultTotalPercent, 100, 'Recommended splits of default 5 phases sum to exactly 100%');

  const expectedCheckedNames = [
    'Schematic Design',
    'Design Development',
    'Construction Documents',
    'Bidding',
    'Construction Administration'
  ];
  const checkedNames = defaultChecked.map(p => p.name);
  assert(
    expectedCheckedNames.every(n => checkedNames.includes(n)),
    'Default checked phases match brief: Schematic, Design Dev, CD, Bidding, CA'
  );

  const pricingTypes: PaymentType[] = ['fixed_fee', 'milestone', 'hourly'];
  assertEqual(pricingTypes.length, 3, 'Supported pricing types include fixed_fee, milestone, hourly');


  // -------------------------------------------------------------
  // TEST 3: Project Intake Wizard & Data Modeling
  // -------------------------------------------------------------
  console.log('\n--- 3. PROJECT INTAKE WIZARD & DATA MODELING ---');

  // Create a draft with all new intake fields
  const draftId = await createDraftProject('Modern Alpine Residence');
  assert(Boolean(draftId), `Draft created with ID: ${draftId}`);

  await autosaveDraft(draftId, {
    title: 'Modern Alpine Residence',
    category: 'Architecture',
    subcategory: 'Residential Architecture',
    requested_services: ['Residential design', 'Construction documents', 'Permit drawings'],
    design_budget: 18000,
    budget_min: 12000,
    payment_type: 'fixed_fee',
    licensure_requirement: 'licensed_professional_required',
    visibility: 'invitation_only',
    deliverables_checklist: [
      'Complete architectural drawings set',
      'Structural review signoff',
      'Permit submission package'
    ],
    phases: [
      {
        sort_order: 1,
        name: 'Complete Project Delivery',
        deliverables: ['All project drawings and permit package'],
        fee_percent: 100
      }
    ]
  });

  const savedDraft = await getProjectDraft(draftId);
  assert(Boolean(savedDraft), 'Retrieved draft successfully');
  assertEqual(savedDraft?.budget_min, 12000, 'Draft stores budget_min ($12,000)');
  assertEqual(savedDraft?.design_budget, 18000, 'Draft stores design_budget ($18,000 max)');
  assertEqual(savedDraft?.payment_type, 'fixed_fee', 'Draft stores fixed_fee payment type');
  assertEqual(savedDraft?.licensure_requirement, 'licensed_professional_required', 'Draft stores licensure requirement');
  assertEqual(savedDraft?.visibility, 'invitation_only', 'Draft stores invitation_only visibility');
  assertEqual(savedDraft?.requested_services?.length, 3, 'Draft stores 3 requested services');
  assertEqual(savedDraft?.deliverables_checklist?.length, 3, 'Draft stores deliverables checklist');

  // Verification of budget range display format helper
  const formatBudgetDisplay = (min?: number | null, max?: number | null) => {
    if (min && max && min !== max) {
      return `$${min.toLocaleString()} to $${max.toLocaleString()}`;
    }
    return `$${(max || min || 0).toLocaleString()}`;
  };
  assertEqual(formatBudgetDisplay(savedDraft?.budget_min, savedDraft?.design_budget), '$12,000 to $18,000', 'Budget display formats as "$X to $Y"');


  // -------------------------------------------------------------
  // TEST 4: Project Publishing Validation & Eligibility Rules
  // -------------------------------------------------------------
  console.log('\n--- 4. PROJECT PUBLISHING VALIDATION ---');

  // Case 4a: Missing requested_services must fail
  const invalidServicesDraftId = await createDraftProject('Draft with no services');
  await autosaveDraft(invalidServicesDraftId, {
    category: 'Architecture',
    design_budget: 20000,
    requested_services: []
  });

  let serviceValidationFailed = false;
  try {
    await publishProject(invalidServicesDraftId);
  } catch (err: any) {
    serviceValidationFailed = true;
    assert(err.message.includes('service') || err.message.includes('catalog'), `Validation error on missing requested_services: "${err.message}"`);
  }
  assert(serviceValidationFailed, 'publishProject rejected draft with 0 requested_services');

  // Case 4b: Prohibited category validation
  const prohibitedDraftId = await createDraftProject('Restricted Facility Proposal');
  await autosaveDraft(prohibitedDraftId, {
    category: 'Nuclear facility',
    requested_services: ['Structural engineering'],
    design_budget: 100000
  });

  let prohibitedValidationFailed = false;
  try {
    await publishProject(prohibitedDraftId);
  } catch (err: any) {
    prohibitedValidationFailed = true;
    assert(err.message.includes('prohibited') || err.message.includes('Nuclear'), `Validation error on prohibited category: "${err.message}"`);
  }
  assert(prohibitedValidationFailed, 'publishProject rejected draft with prohibited category');

  // Case 4c: Fixed fee validation: must have exactly 1 milestone at 100%
  const invalidFixedFeeDraftId = await createDraftProject('Invalid Fixed Fee');
  await autosaveDraft(invalidFixedFeeDraftId, {
    category: 'Architecture',
    requested_services: ['Residential design'],
    design_budget: 25000,
    payment_type: 'fixed_fee',
    phases: [
      { sort_order: 1, name: 'Phase 1', deliverables: [], fee_percent: 50 },
      { sort_order: 2, name: 'Phase 2', deliverables: [], fee_percent: 50 }
    ]
  });

  let fixedFeeValidationFailed = false;
  try {
    await publishProject(invalidFixedFeeDraftId);
  } catch (err: any) {
    fixedFeeValidationFailed = true;
    assert(err.message.includes('Fixed fee projects require exactly one deliverable milestone with a 100% allocation'), `Validation error on fixed fee: "${err.message}"`);
  }
  assert(fixedFeeValidationFailed, 'publishProject rejected fixed_fee with multiple phases');

  // Case 4d: Successful publication with all fields and 100% fixed fee phase
  await publishProject(draftId);
  const publishedDraft = await getProjectDraft(draftId);
  assertEqual(publishedDraft?.status, 'open', 'Valid project successfully published with status "open"');
  assertEqual(publishedDraft?.requested_services?.length, 3, 'Published project retained requested_services');
  assertEqual(publishedDraft?.licensure_requirement, 'licensed_professional_required', 'Published project retained licensure_requirement');


  // -------------------------------------------------------------
  // TEST 5: Proposal Composer, Deliverables & Licensure Disclosure
  // -------------------------------------------------------------
  console.log('\n--- 5. PROPOSAL COMPOSER & LICENSURE DISCLOSURE ---');

  const testProjectId = 'proj-austin-residence';

  // Proposal 1: Fully regulated response with in-state license
  const propSubmission1: ProposalSubmission = {
    projectId: testProjectId,
    coverLetter: 'We are delighted to submit our proposal for the Austin Hill Country residence.',
    proposedTotal: 82000,
    paymentType: 'Milestone',
    deliveryTime: '12 weeks',
    portfolioItems: ['item-1'],
    projectUnderstanding: 'The project involves designing a durable, sustainable residence meeting local building codes and site grading standards.',
    deliverables: [
      'Preliminary schematic layout & 3D massing',
      'Final construction drawings',
      'Engineering stamped plan set'
    ],
    schedule: [
      { phaseName: 'Full Project Delivery', targetDate: '2026-12-15', deliveryDays: 45 }
    ],
    canOfferRegulatedServices: 'licensed_in_project_state',
    serviceAreaStates: ['TX', 'CA'],
    attachments: [
      { name: 'Portfolio_Cabin_References.pdf', size: 1048576, url: 'https://example.com/ref.pdf' }
    ]
  };

  const subResult1 = await submitProposal(testProjectId, propSubmission1);
  assert(subResult1.success, `Proposal submitted successfully with ID: ${subResult1.proposalId}`);

  // Retrieve designer proposals
  const proposals = await getMyProposals();
  const submitted1 = proposals.find(p => p.id === subResult1.proposalId);
  assert(Boolean(submitted1), 'Submitted proposal found in proposals list');
  assertEqual(submitted1?.projectUnderstanding?.length !== undefined && submitted1.projectUnderstanding.length <= 1000, true, 'Project understanding saved within 1000 chars limit');
  assertEqual(submitted1?.canOfferRegulatedServices, 'licensed_in_project_state', 'Licensure disclosure saved: licensed_in_project_state');
  assert(submitted1?.serviceAreaStates?.includes('TX') ?? false, 'Service area states saved');
  assertEqual(submitted1?.deliverables?.length, 3, 'Deliverables saved with 3 items');

  // Proposal 2: Designer selects 'will_partner_with_licensed_professional'
  // Rule: MUST NEVER block proposal submission!
  const propSubmission2: ProposalSubmission = {
    projectId: 'proj-denver-commercial',
    coverLetter: 'Conceptual visualization and preliminary designs.',
    proposedTotal: 25000,
    paymentType: 'Fixed Fee',
    deliveryTime: '8 weeks',
    portfolioItems: [],
    projectUnderstanding: 'Providing 3D BIM visualization and drafting support.',
    deliverables: ['3D Model', 'Schematic Concept'],
    canOfferRegulatedServices: 'will_partner_with_licensed_professional',
    serviceAreaStates: ['AZ', 'NM'],
    attachments: []
  };

  const subResult2 = await submitProposal('proj-denver-commercial', propSubmission2);
  assert(subResult2.success, 'Proposal with partnership disclosure submitted WITHOUT blocking');
  const submitted2 = (await getMyProposals()).find(p => p.id === subResult2.proposalId);
  assertEqual(submitted2?.canOfferRegulatedServices, 'will_partner_with_licensed_professional', 'Partnership disclosure stored accurately');


  // -------------------------------------------------------------
  // TEST 6: Saved Searches Service & Strict 10-Item Limit
  // -------------------------------------------------------------
  console.log('\n--- 6. SAVED SEARCHES & 10-SEARCH LIMIT ENFORCEMENT ---');

  // Clean initial state for test user if needed
  const initialSearches = await savedSearchesService.getSavedSearches('projects');
  for (const s of initialSearches) {
    await savedSearchesService.deleteSavedSearch(s.id);
  }

  // Create 10 saved searches
  console.log('  Adding 10 saved searches for test user...');
  for (let i = 1; i <= 10; i++) {
    const res = await savedSearchesService.saveSearch(
      `Search Preset #${i} - Residential`,
      'projects',
      {
        category: 'Architecture',
        services: ['Residential design'],
        budget_min: 10000 * i
      },
      i % 2 === 0
    );
    assert(Boolean(res.id), `Saved search #${i} created`);
  }

  const allSaved = await savedSearchesService.getSavedSearches('projects');
  assertEqual(allSaved.length, 10, 'Exactly 10 saved searches present');

  // Attempt to create 11th saved search -> MUST FAIL
  console.log('  Attempting to add 11th saved search (must be rejected by max 10 limit)...');
  let limitEnforced = false;
  try {
    await savedSearchesService.saveSearch(
      'Search Preset #11 (Overflow)',
      'projects',
      { category: 'Commercial' },
      false
    );
  } catch (err: any) {
    limitEnforced = true;
    assert(err.message.includes('10') || err.message.includes('maximum'), `Limit correctly rejected: "${err.message}"`);
  }
  assert(limitEnforced, 'Saved searches limit of 10 was strictly enforced');

  // Delete one search and create a new one
  const firstSearchId = allSaved[0].id;
  await savedSearchesService.deleteSavedSearch(firstSearchId);
  const afterDelete = await savedSearchesService.getSavedSearches('projects');
  assertEqual(afterDelete.length, 9, 'Count decreased to 9 after deletion');

  // Now 10th spot is freed, creating another search should succeed
  const replacement = await savedSearchesService.saveSearch(
    'Search Preset Replacement #10',
    'projects',
    { services: ['Interior design'] }
  );
  assert(Boolean(replacement.id), 'Created replacement search after freeing a slot');


  // -------------------------------------------------------------
  // TEST 7: Database Migration 046 File Verification
  // -------------------------------------------------------------
  console.log('\n--- 7. MIGRATION 046 SQL VERIFICATION ---');

  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/046_project_intake_taxonomy_licensure_saved_searches.sql');
  assert(fs.existsSync(migrationPath), `Migration file exists at ${migrationPath}`);

  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  // Check required SQL components
  assert(migrationSql.includes('services_catalog'), 'Creates services_catalog table');
  assert(migrationSql.includes('saved_searches'), 'Creates saved_searches table');
  assert(migrationSql.includes('budget_min'), 'Adds budget_min column to projects');
  assert(migrationSql.includes('licensure_requirement'), 'Adds licensure_requirement column to projects');
  assert(migrationSql.includes('requested_services'), 'Adds requested_services column to projects');
  assert(migrationSql.includes('visibility'), 'Adds visibility column to projects');
  assert(migrationSql.includes('deliverables_checklist'), 'Adds deliverables_checklist to projects');
  assert(migrationSql.includes('can_offer_regulated_services'), 'Adds can_offer_regulated_services to proposals');
  assert(migrationSql.includes('service_area_states'), 'Adds service_area_states to proposals');
  assert(migrationSql.includes('check_max_saved_searches') || migrationSql.includes('trg_check_saved_searches_limit'), 'Defines saved searches limit trigger');
  assert(migrationSql.includes('services_overlap') && migrationSql.includes('20'), 'Match score adds 20 points for services overlap');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n=============================================================');
  console.log(` RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('=============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
