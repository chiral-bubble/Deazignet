/**
 * Dezignet Test Suite: US Market Conversion, Memberships, Progressive Platform Fee & Terminology Compliance
 * 
 * Verifies:
 * 1. Progressive Platform Fee scale (marginal tiers + cumulative_project basis):
 *    - $2,000 -> $200.00
 *    - $5,000 -> $437.50
 *    - $10,000 -> $687.50
 *    - $20,000 -> $1,037.50
 *    - $50,000 -> $1,787.50
 *    - $50,000 engagement paid as five $10,000 payments: $687.50, $350.00, $250.00, $250.00, $250.00 (sum $1,787.50)
 *    - Unfunded later milestones create zero fee.
 *    - Fee schedule snapshotting and version tracking.
 *    - Proportional refund handling.
 * 2. Membership Plans (Free: $0, Basic: $19/mo, Gold: $49/mo):
 *    - Rename plan key and labels from "Upgraded" to "Gold".
 *    - Proposal limits: Free (3), Basic (15), Gold (null / unlimited).
 *    - Portfolio limits: Free (3), Basic (12), Gold (null / unlimited).
 *    - Images per project: one setting for all plans (default 10).
 *    - Annual billing setting: `annual_billing_enabled` (default false).
 *    - Effective plan resolution (`getEffectivePlan` takes highest of paid & active grant).
 *    - Entitlements: direct_invitations (false, true, true), search_priority (false, false, true).
 * 3. US Market formatters & validators:
 *    - ZIP code, Phone numbers, USD formatting, License masking, Date formatting.
 * 4. Zero forbidden legacy terms in codebase.
 * 5. Escrow terminology compliance.
 * 6. Profile completeness uniform 6 items (no credentials required).
 * 7. Background job runners.
 *
 * Usage:
 *   npx tsx scripts/test-us-plans-invitations.ts
 */

import {
  calculatePlatformFeeFallback,
  calculateRefundAdjustment,
  computeAnnualSavings,
  getCurrentFeeScheduleSnapshot,
  getEffectivePlan
} from '../src/services/plansService';
import {
  validateZipCode,
  validateUsPhone,
  formatUsPhone,
  formatUSD,
  formatDate,
  maskLicenseNumber,
  US_STATES
} from '../src/services/usMarketService';
import {
  PLAN_TIERS_CONFIG,
  isPaymentsTerminologyApproved,
  getPaymentsSettings,
  PROGRESSIVE_FEE_TEXT
} from '../src/config/paymentsConfig';
import { calculateProfileCompleteness } from '../src/services/designerProfileService';
import { mapCategoryToUs, mapSpecializationsToUs, US_CATEGORIES } from './migrate-categories-to-us';
import { runLicenseExpiryJob } from './run-license-expiry-job';
import { runInvitationExpiryJob } from './run-invitation-expiry-job';
import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, passed: boolean, details?: string) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error(`     Details: ${details}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 DEZIGNET PROGRESSIVE PLATFORM FEES & MEMBERSHIP PLANS TEST SUITE');
  console.log('===============================================================\n');

  // --- TEST GROUP 1: PROGRESSIVE PLATFORM FEE GOLDEN TEST CASES ---
  console.log('--- TEST GROUP 1: Progressive Platform Fee Golden Cases (Marginal + Cumulative Project) ---');

  // 1. $2,000 -> $200.00 (200,000 cents -> 20,000 cents @ 10%)
  const fee2k = calculatePlatformFeeFallback('free', 200000, 0);
  assert('Progressive fee: $2,000.00 yields $200.00 (10%)', fee2k.fee_cents === 20000 && fee2k.fee_dollars === 200.0);

  // 2. $5,000 -> $437.50 ($2,500 @ 10% = $250 + $2,500 @ 7.5% = $187.50)
  const fee5k = calculatePlatformFeeFallback('free', 500000, 0);
  assert('Progressive fee: $5,000.00 yields $437.50', fee5k.fee_cents === 43750 && fee5k.fee_dollars === 437.5);

  // 3. $10,000 -> $687.50 ($437.50 on first $5k + $5,000 @ 5% = $250)
  const fee10k = calculatePlatformFeeFallback('free', 1000000, 0);
  assert('Progressive fee: $10,000.00 yields $687.50', fee10k.fee_cents === 68750 && fee10k.fee_dollars === 687.5);

  // 4. $20,000 -> $1,037.50 ($687.50 on first $10k + $10,000 @ 3.5% = $350)
  const fee20k = calculatePlatformFeeFallback('free', 2000000, 0);
  assert('Progressive fee: $20,000.00 yields $1,037.50', fee20k.fee_cents === 103750 && fee20k.fee_dollars === 1037.5);

  // 5. $50,000 -> $1,787.50 ($1,037.50 on first $20k + $30,000 @ 2.5% = $750)
  const fee50k = calculatePlatformFeeFallback('free', 5000000, 0);
  assert('Progressive fee: $50,000.00 yields $1,787.50', fee50k.fee_cents === 178750 && fee50k.fee_dollars === 1787.5);

  // 6. A $50,000 engagement paid as five $10,000 payments yields fees:
  //    $687.50, $350.00, $250.00, $250.00, $250.00 (total $1,787.50)
  const p1 = calculatePlatformFeeFallback('free', 1000000, 0);
  const p2 = calculatePlatformFeeFallback('free', 1000000, 1000000);
  const p3 = calculatePlatformFeeFallback('free', 1000000, 2000000);
  const p4 = calculatePlatformFeeFallback('free', 1000000, 3000000);
  const p5 = calculatePlatformFeeFallback('free', 1000000, 4000000);

  assert('Five-payment engagement: Payment 1 ($10k) fee is $687.50', p1.fee_dollars === 687.5 && p1.fee_cents === 68750);
  assert('Five-payment engagement: Payment 2 ($10k) fee is $350.00', p2.fee_dollars === 350.0 && p2.fee_cents === 35000);
  assert('Five-payment engagement: Payment 3 ($10k) fee is $250.00', p3.fee_dollars === 250.0 && p3.fee_cents === 25000);
  assert('Five-payment engagement: Payment 4 ($10k) fee is $250.00', p4.fee_dollars === 250.0 && p4.fee_cents === 25000);
  assert('Five-payment engagement: Payment 5 ($10k) fee is $250.00', p5.fee_dollars === 250.0 && p5.fee_cents === 25000);

  const sumPayments = p1.fee_cents + p2.fee_cents + p3.fee_cents + p4.fee_cents + p5.fee_cents;
  assert('Five-payment engagement: Sum of fees ($1,787.50) matches single $50k engagement', sumPayments === 178750);

  // 7. Unfunded later milestones create no fee
  const unfunded = calculatePlatformFeeFallback('free', 0, 1000000);
  assert('Unfunded later milestones create zero fee', unfunded.fee_cents === 0 && unfunded.fee_dollars === 0.0);

  // 8. Rounding to cents and snapshots are verified
  const snap = getCurrentFeeScheduleSnapshot();
  assert('Fee schedule snapshot version is 2026.11-progressive', snap.version === '2026.11-progressive');
  assert('Fee schedule snapshot mode is marginal and basis is cumulative_project', snap.fee_tier_mode === 'marginal' && snap.fee_basis === 'cumulative_project');
  assert('Transaction fee calculation returns valid snapshot object', !!p1.fee_schedule_snapshot && p1.fee_schedule_snapshot.version === '2026.11-progressive');

  // 9. Refund adjustment proportional commission handling
  const refundTest = calculateRefundAdjustment(1000000, 68750, 500000); // 50% refund on $10k payment
  assert('Proportional refund on 50% of payment returns 50% fee ($343.75)', refundTest.refundedFeeCents === 34375);

  // 10. Progressive tiers identical for all plans (free, basic, gold)
  const basic5k = calculatePlatformFeeFallback('basic', 500000, 0);
  const gold5k = calculatePlatformFeeFallback('gold', 500000, 0);
  assert('Basic plan uses identical progressive fee ($437.50 for $5k)', basic5k.fee_dollars === 437.5);
  assert('Gold plan uses identical progressive fee ($437.50 for $5k)', gold5k.fee_dollars === 437.5);

  // 11. Whole amount mode backward compatibility check
  const wholeAmtCheck = calculatePlatformFeeFallback('free', 100000, 0, undefined, 'whole_amount', 'per_milestone');
  assert('Legacy whole_amount mode supported when explicitly requested', wholeAmtCheck.fee_cents === 10000);

  // --- TEST GROUP 2: MEMBERSHIP PLANS CONFIG & TIERS ---
  console.log('\n--- TEST GROUP 2: Membership Plans Config, Limits & Entitlements ---');

  const basicSavings = computeAnnualSavings(19.00, 190.00);
  assert('Basic plan computed savings equals 17% (not hardcoded)', basicSavings === 17);

  const goldSavings = computeAnnualSavings(49.00, 490.00);
  assert('Gold plan computed savings equals 17% (not hardcoded)', goldSavings === 17);

  const freePlan = PLAN_TIERS_CONFIG.find(p => p.id === 'free');
  const basicPlan = PLAN_TIERS_CONFIG.find(p => p.id === 'basic');
  const goldPlan = PLAN_TIERS_CONFIG.find(p => p.id === 'gold');

  assert('Free plan price is $0', freePlan?.monthlyPrice === 0);
  assert('Basic plan price is $19/mo', basicPlan?.monthlyPrice === 19);
  assert('Gold plan price is $49/mo', goldPlan?.monthlyPrice === 49);

  assert('Free plan proposal limit is 3', freePlan?.proposalsPerMonth === 3);
  assert('Basic plan proposal limit is 15', basicPlan?.proposalsPerMonth === 15);
  assert('Gold plan proposal limit is null (unlimited)', goldPlan?.proposalsPerMonth === null);

  assert('Free plan portfolio project limit is 3', freePlan?.portfolioProjectsLimit === 3);
  assert('Basic plan portfolio project limit is 12', basicPlan?.portfolioProjectsLimit === 12);
  assert('Gold plan portfolio project limit is null (unlimited)', goldPlan?.portfolioProjectsLimit === null);

  const paymentsSettings = getPaymentsSettings();
  assert('images_per_portfolio_project is ONE admin setting (default 10)', paymentsSettings.images_per_portfolio_project === 10);
  assert('annual_billing_enabled setting defaults to false', paymentsSettings.annual_billing_enabled === false);
  assert('unlimited_daily_proposal_cap setting defaults to 25', paymentsSettings.unlimited_daily_proposal_cap === 25);

  assert('Platform fee text updated across plans to progressive scale description',
    freePlan?.platformFeeText === PROGRESSIVE_FEE_TEXT &&
    basicPlan?.platformFeeText === PROGRESSIVE_FEE_TEXT &&
    goldPlan?.platformFeeText === PROGRESSIVE_FEE_TEXT
  );

  // Effective plan resolution test (highest of paid subscription and active complimentary grant)
  const eff1 = getEffectivePlan('free', { plan_key: 'gold' });
  const eff2 = getEffectivePlan('basic', null);
  const eff3 = getEffectivePlan('gold', { plan_key: 'basic' });
  assert('Effective plan resolves grant over lower paid (Free + Gold grant = Gold)', eff1 === 'gold');
  assert('Effective plan resolves paid plan when no grant (Basic = Basic)', eff2 === 'basic');
  assert('Effective plan resolves higher paid over lower grant (Gold paid + Basic grant = Gold)', eff3 === 'gold');

  // --- TEST GROUP 3: PROFILE COMPLETENESS UNIFORM CHECK ---
  console.log('\n--- TEST GROUP 3: Profile Completeness (Uniform 6 items, No Credential Required) ---');

  const mockProfile: any = {
    avatarUrl: 'https://example.com/photo.jpg',
    about: 'Experienced residential architect specializing in modern sustainable design.',
    professionalType: 'Architect',
    specializations: ['Residential'],
    location: { city: 'Denver', state: 'CO', country: 'US' },
    portfolio: [{ id: 'p1', title: 'Modern Villa', images: [{ id: 'i1', url: 'https://img.com/1.jpg' }] }],
    credentials: [] // zero credentials
  };

  const completeness = calculateProfileCompleteness(mockProfile);
  assert('Profile completeness checklist has exactly 6 items', completeness.checklist.length === 6);
  assert('Profile completeness does NOT require credentials', !completeness.checklist.some(item => item.id.includes('cred')));
  assert('Complete profile without credentials achieves 100% score', completeness.score === 100);

  // --- TEST GROUP 4: US FORMATTERS & VALIDATORS ---
  console.log('\n--- TEST GROUP 4: US Formatters & Validators ---');

  assert('US_STATES contains exactly 51 entries (50 states + DC)', US_STATES.length === 51);
  assert('TX, CO, NY, CA, DC are in US_STATES', ['TX', 'CO', 'NY', 'CA', 'DC'].every(s => US_STATES.some(us => us.code === s)));

  assert('Valid 5-digit ZIP: 78701', validateZipCode('78701'));
  assert('Valid ZIP+4: 78701-1234', validateZipCode('78701-1234'));
  assert('Invalid ZIP: 4 digits (7870)', !validateZipCode('7870'));
  assert('Invalid ZIP: letters (7870A)', !validateZipCode('7870A'));
  assert('Invalid ZIP: empty string', !validateZipCode(''));

  assert('Valid 10-digit phone: 5125550198', validateUsPhone('5125550198'));
  assert('Valid +1 phone: +1 512 555 0198', validateUsPhone('+1 512 555 0198'));
  assert('Valid formatted phone: (512) 555-0198', validateUsPhone('(512) 555-0198'));
  assert('Phone formatter produces (512) 555-0198', formatUsPhone('5125550198') === '(512) 555-0198');
  assert('Invalid phone: 7 digits (5550198)', !validateUsPhone('5550198'));

  assert('USD formatter produces $12,500.00 for 12500', formatUSD(12500) === '$12,500.00');
  assert('USD formatter produces $0.00 for 0', formatUSD(0) === '$0.00');

  const formattedDate = formatDate('2026-11-04T00:00:00Z');
  assert('Date formatted as MM/DD/YYYY', /^\d{2}\/\d{2}\/\d{4}$/.test(formattedDate));

  assert('Masks all but last 3 chars: ARCH-123456 -> ••••••••456', maskLicenseNumber('ARCH-123456') === '••••••••456');
  assert('Short license 3 chars remains unmasked: 123 -> 123', maskLicenseNumber('123') === '123');

  // --- TEST GROUP 5: ZERO FORBIDDEN LEGACY TERMS ---
  console.log('\n--- TEST GROUP 5: Zero Forbidden Legacy Terms in Codebase ---');

  function walk(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath, fileList);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html') || file.endsWith('.css')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const srcFiles = walk(path.resolve(process.cwd(), 'src'));
  const forbiddenTerms = ['nigeria', 'lagos', 'abuja', 'ibadan', 'naira', 'flutterwave', 'paystack'];
  let totalForbiddenFound = 0;

  for (const f of srcFiles) {
    const content = fs.readFileSync(f, 'utf8');
    for (const term of forbiddenTerms) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        totalForbiddenFound += matches.length;
        console.error(`     Forbidden term "${term}" found in ${f}`);
      }
    }
  }

  assert('Zero occurrences of forbidden legacy terms in src/', totalForbiddenFound === 0, `Found ${totalForbiddenFound} forbidden terms`);

  // --- TEST GROUP 6: ESCROW TERMINOLOGY COMPLIANCE CHECK ---
  console.log('\n--- TEST GROUP 6: Escrow Terminology Compliance (payments_terminology_approved = false) ---');

  assert('payments_terminology_approved default setting is false', isPaymentsTerminologyApproved() === false);

  let userFacingEscrowFound = 0;
  const userFacingViolations: string[] = [];

  const userFacingEscrowRegexes = [
    />[^<]*\bescrow\b[^<]*</i,
    /alert\([^)]*\bescrow\b[^)]*\)/i,
    /confirm\([^)]*\bescrow\b[^)]*\)/i,
    /title:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /detail:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /reviewText:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /document\.title\s*=\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /placeholder:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /description:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /statusNote:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /subtitle:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i,
    /statusText:\s*['"`][^'"`]*\bescrow\b[^'"`]*['"`]/i
  ];

  for (const f of srcFiles) {
    if (f.endsWith('.css')) continue;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;

      for (const re of userFacingEscrowRegexes) {
        if (re.test(trimmed)) {
          if (!trimmed.includes('inEscrowAmount') &&
              !trimmed.includes('funds_in_escrow') &&
              !trimmed.includes('in_escrow') &&
              !trimmed.includes('escrowStatus') &&
              !trimmed.includes('escrow_status') &&
              !trimmed.includes('escrowCurrentMilestone') &&
              !trimmed.includes('hasActiveProjectsOrEscrow') &&
              !trimmed.includes('class=')) {
            userFacingEscrowFound++;
            userFacingViolations.push(`${path.basename(f)}:${idx + 1}: ${trimmed}`);
          }
        }
      }
    });
  }

  assert(
    'Zero occurrences of "escrow" in user-facing UI text while payments_terminology_approved is false',
    userFacingEscrowFound === 0,
    `Found ${userFacingEscrowFound} occurrences:\n${userFacingViolations.join('\n')}`
  );

  // --- TEST GROUP 7: US CATEGORIES & MIGRATION MAPPINGS ---
  console.log('\n--- TEST GROUP 7: US Categories & Migration Logic ---');
  assert('US_CATEGORIES contains exactly 6 official categories', US_CATEGORIES.length === 6);
  assert('Residential, Commercial, Hospitality, Institutional, Healthcare, Industrial present',
    ['Residential', 'Commercial', 'Hospitality', 'Institutional', 'Healthcare', 'Industrial'].every(c => US_CATEGORIES.includes(c as any)));

  assert('Category mapper maps "Civic" -> "Institutional"', mapCategoryToUs('Civic') === 'Institutional');
  assert('Category mapper maps "Cultural" -> "Institutional"', mapCategoryToUs('Cultural') === 'Institutional');
  assert('Category mapper maps "Hotel & hospitality" -> "Hospitality"', mapCategoryToUs('Hotel & hospitality') === 'Hospitality');
  assert('Category mapper maps "Logistics" -> "Industrial"', mapCategoryToUs('Logistics') === 'Industrial');
  assert('Category mapper maps "Landscape" -> "Residential"', mapCategoryToUs('Landscape') === 'Residential');
  assert('Category mapper preserves "Commercial"', mapCategoryToUs('Commercial') === 'Commercial');
  assert('Category mapper preserves "Healthcare"', mapCategoryToUs('Healthcare') === 'Healthcare');

  const mappedSpecs = mapSpecializationsToUs(['Sustainable', 'Civic', 'BIM']);
  assert('Specialization mapper maps and deduplicates legacy specs',
    mappedSpecs.length === 3 &&
    mappedSpecs.includes('Residential') &&
    mappedSpecs.includes('Institutional') &&
    mappedSpecs.includes('Commercial')
  );

  // --- TEST GROUP 8: BACKGROUND JOB RUNNERS ---
  console.log('\n--- TEST GROUP 8: Background Job Runners ---');
  assert('runLicenseExpiryJob is defined and callable', typeof runLicenseExpiryJob === 'function');
  assert('runInvitationExpiryJob is defined and callable', typeof runInvitationExpiryJob === 'function');

  // --- SUMMARY ---
  console.log('\n===============================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} passed (${failedTests} failed)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
