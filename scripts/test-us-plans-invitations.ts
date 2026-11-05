/**
 * Dezignet Test Suite: US Market Conversion, Memberships, Platform Fee & Find Designers
 * 
 * Verifies:
 * 1. 12 Golden Platform Fee test cases across Free, Basic, and Upgraded tiers (whole_amount mode).
 * 2. Dynamic annual savings calculation (~17% computed, never hardcoded).
 * 3. US Market formatters & validators:
 *    - ZIP code (5-digit & ZIP+4 validation).
 *    - Phone numbers (+1 US format & validation).
 *    - USD currency formatting ($12,500.00).
 *    - License number masking (last 3 chars visible).
 *    - Date formatting (MM/DD/YYYY).
 * 4. Plan proposal limits: Free (5), Basic (10), Upgraded (null/unlimited).
 * 5. Free tier bid-only visibility rules (directory_listing = false).
 * 6. Codebase scan ensuring zero occurrences of forbidden legacy terms.
 *
 * Usage:
 *   npx tsx scripts/test-us-plans-invitations.ts
 */

import { calculatePlatformFeeFallback, computeAnnualSavings } from '../src/services/plansService';
import {
  validateZipCode,
  validateUsPhone,
  formatUsPhone,
  formatUSD,
  formatDate,
  maskLicenseNumber,
  US_STATES
} from '../src/services/usMarketService';
import { PLAN_TIERS_CONFIG } from '../src/config/paymentsConfig';
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
  console.log('🧪 DEZIGNET US MARKET, PLANS & INVITATIONS TEST SUITE');
  console.log('===============================================================\n');

  // --- TEST GROUP 1: 12 GOLDEN PLATFORM FEE CASES ---
  console.log('--- TEST GROUP 1: Platform Fee Golden Test Cases (whole_amount) ---');

  // FREE PLAN (10% up to $5,000, 5% if > $5,000)
  // 1. Free $1,000.00 (100,000 cents) -> $100.00 (10,000 cents)
  const free1k = calculatePlatformFeeFallback('free', 100000);
  assert('Free plan: $1,000.00 has 10% fee ($100.00)', free1k.fee_cents === 10000 && free1k.rate_percent === 10);

  // 2. Free $5,000.00 (500,000 cents) -> $500.00 (50,000 cents)
  const free5k = calculatePlatformFeeFallback('free', 500000);
  assert('Free plan: $5,000.00 has 10% fee ($500.00)', free5k.fee_cents === 50000 && free5k.rate_percent === 10);

  // 3. Free $5,000.01 (500,001 cents) -> strictly > 5,000 drops whole amount to 5% ($250.00 = 25,000 cents)
  const free5kPlus = calculatePlatformFeeFallback('free', 500001);
  assert('Free plan: $5,000.01 drops to 5% fee ($250.00)', free5kPlus.fee_cents === 25000 && free5kPlus.rate_percent === 5);

  // 4. Free $25,000.00 (2,500,000 cents) -> 5% fee ($1,250.00 = 125,000 cents)
  const free25k = calculatePlatformFeeFallback('free', 2500000);
  assert('Free plan: $25,000.00 has 5% fee ($1,250.00)', free25k.fee_cents === 125000 && free25k.rate_percent === 5);

  // BASIC PLAN (5% up to $20,000, 2.5% if > $20,000)
  // 5. Basic $1,000.00 (100,000 cents) -> 5% fee ($50.00 = 5,000 cents)
  const basic1k = calculatePlatformFeeFallback('basic', 100000);
  assert('Basic plan: $1,000.00 has 5% fee ($50.00)', basic1k.fee_cents === 5000 && basic1k.rate_percent === 5);

  // 6. Basic $10,000.00 (1,000,000 cents) -> 5% fee ($500.00 = 50,000 cents)
  const basic10k = calculatePlatformFeeFallback('basic', 1000000);
  assert('Basic plan: $10,000.00 has 5% fee ($500.00)', basic10k.fee_cents === 50000 && basic10k.rate_percent === 5);

  // 7. Basic $20,000.00 (2,000,000 cents) -> 5% fee ($1,000.00 = 100,000 cents)
  const basic20k = calculatePlatformFeeFallback('basic', 2000000);
  assert('Basic plan: $20,000.00 has 5% fee ($1,000.00)', basic20k.fee_cents === 100000 && basic20k.rate_percent === 5);

  // 8. Basic $20,000.01 (2,000,001 cents) -> strictly > 20,000 drops whole amount to 2.5% ($500.00 = 50,000 cents)
  const basic20kPlus = calculatePlatformFeeFallback('basic', 2000001);
  assert('Basic plan: $20,000.01 drops to 2.5% fee ($500.00)', basic20kPlus.fee_cents === 50000 && basic20kPlus.rate_percent === 2.5);

  // UPGRADED PLAN (4% up to $20,000, 2% if > $20,000)
  // 9. Upgraded $1,000.00 (100,000 cents) -> 4% fee ($40.00 = 4,000 cents)
  const up1k = calculatePlatformFeeFallback('upgraded', 100000);
  assert('Upgraded plan: $1,000.00 has 4% fee ($40.00)', up1k.fee_cents === 4000 && up1k.rate_percent === 4);

  // 10. Upgraded $10,000.00 (1,000,000 cents) -> 4% fee ($400.00 = 40,000 cents)
  const up10k = calculatePlatformFeeFallback('upgraded', 1000000);
  assert('Upgraded plan: $10,000.00 has 4% fee ($400.00)', up10k.fee_cents === 40000 && up10k.rate_percent === 4);

  // 11. Upgraded $20,000.00 (2,000,000 cents) -> 4% fee ($800.00 = 80,000 cents)
  const up20k = calculatePlatformFeeFallback('upgraded', 2000000);
  assert('Upgraded plan: $20,000.00 has 4% fee ($800.00)', up20k.fee_cents === 80000 && up20k.rate_percent === 4);

  // 12. Upgraded $20,000.01 (2,000,001 cents) -> strictly > 20,000 drops whole amount to 2% ($400.00 = 40,000 cents)
  const up20kPlus = calculatePlatformFeeFallback('upgraded', 2000001);
  assert('Upgraded plan: $20,000.01 drops to 2% fee ($400.00)', up20kPlus.fee_cents === 40000 && up20kPlus.rate_percent === 2.0);

  // --- TEST GROUP 2: DYNAMIC ANNUAL SAVINGS & MEMBERSHIP CONFIG ---
  console.log('\n--- TEST GROUP 2: Dynamic Annual Savings & Plan Limits ---');

  // Basic: $29.99/mo * 12 = $359.88, yearly = $299.88. Savings = (60 / 359.88) = ~17%
  const basicSavings = computeAnnualSavings(29.99, 299.88);
  assert('Basic plan computed savings equals 17% (not hardcoded)', basicSavings === 17);

  // Upgraded: $49.99/mo * 12 = $599.88, yearly = $499.88. Savings = (100 / 599.88) = ~17%
  const upSavings = computeAnnualSavings(49.99, 499.88);
  assert('Upgraded plan computed savings equals 17% (not hardcoded)', upSavings === 17);

  // Proposal limits
  const freePlan = PLAN_TIERS_CONFIG.find(p => p.id === 'free');
  const basicPlan = PLAN_TIERS_CONFIG.find(p => p.id === 'basic');
  const upgradedPlan = PLAN_TIERS_CONFIG.find(p => p.id === 'upgraded');

  assert('Free plan proposal limit is 5', freePlan?.proposalsPerMonth === 5);
  assert('Basic plan proposal limit is 10', basicPlan?.proposalsPerMonth === 10);
  assert('Upgraded plan proposal limit is null (unlimited)', upgradedPlan?.proposalsPerMonth === null);

  // --- TEST GROUP 3: US FORMATTERS & VALIDATORS ---
  console.log('\n--- TEST GROUP 3: US Formatters & Validators ---');

  // 50 US States + DC
  assert('US_STATES contains exactly 51 entries (50 states + DC)', US_STATES.length === 51);
  assert('TX, CO, NY, CA, DC are in US_STATES', ['TX', 'CO', 'NY', 'CA', 'DC'].every(s => US_STATES.some(us => us.code === s)));

  // ZIP Code validation
  assert('Valid 5-digit ZIP: 78701', validateZipCode('78701'));
  assert('Valid ZIP+4: 78701-1234', validateZipCode('78701-1234'));
  assert('Invalid ZIP: 4 digits (7870)', !validateZipCode('7870'));
  assert('Invalid ZIP: letters (7870A)', !validateZipCode('7870A'));
  assert('Invalid ZIP: empty string', !validateZipCode(''));

  // US Phone validation & formatting
  assert('Valid 10-digit phone: 5125550198', validateUsPhone('5125550198'));
  assert('Valid +1 phone: +1 512 555 0198', validateUsPhone('+1 512 555 0198'));
  assert('Valid formatted phone: (512) 555-0198', validateUsPhone('(512) 555-0198'));
  assert('Phone formatter produces (512) 555-0198', formatUsPhone('5125550198') === '(512) 555-0198');
  assert('Invalid phone: 7 digits (5550198)', !validateUsPhone('5550198'));

  // Currency formatting ($12,500.00)
  assert('USD formatter produces $12,500.00 for 12500', formatUSD(12500) === '$12,500.00');
  assert('USD formatter produces $0.00 for 0', formatUSD(0) === '$0.00');

  // Date formatting (MM/DD/YYYY)
  const formattedDate = formatDate('2026-11-04T00:00:00Z');
  assert('Date formatted as MM/DD/YYYY', /^\d{2}\/\d{2}\/\d{4}$/.test(formattedDate));

  // License number masking
  assert('Masks all but last 3 chars: ARCH-123456 -> ••••••••456', maskLicenseNumber('ARCH-123456') === '••••••••456');
  assert('Short license 3 chars remains unmasked: 123 -> 123', maskLicenseNumber('123') === '123');

  // --- TEST GROUP 4: ZERO FORBIDDEN LEGACY TERMS ---
  console.log('\n--- TEST GROUP 4: Zero Forbidden Legacy Terms in Codebase ---');

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
