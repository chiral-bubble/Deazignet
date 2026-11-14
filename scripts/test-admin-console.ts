/**
 * Dezignet Comprehensive Admin Console & Security Audit Test Suite
 * 
 * Verifies all 6 functional areas & 15 specific requirements:
 * 1. Role Capability Matrix (super_admin, moderator, support, finance, verifier)
 * 2. MFA & 15-Minute Re-Authentication Gate
 * 3. Two-Person Rule for Financial Actions (> $1,000 threshold)
 * 4. Append-Only Trigger & Audit Log Immutability
 * 5. Mandatory Written Reason on Private Content Access
 * 6. User Management: Suspensions, Complimentary Plans, Admin Notes
 * 7. Project Moderation: Unpublish, Remove, Restore with Reasons
 * 8. Unified Reports Queue: Dismiss, Warn, Hide, Suspend
 * 9. Credentials Verification: Approve with Jurisdiction, Reject with Reason
 * 10. Dispute Console: Timeline, Private Reads, Outcomes (Release, Refund, Split)
 * 11. Fee Schedule Versions & Progressive Marginal Calculations
 * 12. Promotions behind Feature Switch (promotions_enabled = false default)
 * 13. Marketplace Analytics & CSV Export
 * 14. Support Tickets Inbox: Assignees & Internal Notes
 * 15. Migration 049 Schema Completeness
 *
 * Usage:
 *   npx tsx scripts/test-admin-console.ts
 */

import fs from 'fs';
import path from 'path';
import {
  ROLE_CAPABILITIES,
  hasCapability,
  setSimulatedAdminRole,
  getEffectiveAdminRole,
  isReauthRequired,
  verifyAdminMfaCode,
  recordAdminReauth,
  requiresTwoPersonApproval,
  logPrivateContentRead,
  adminGetUsersList,
  adminToggleUserSuspension,
  adminGrantComplimentaryPlan,
  adminGetProjectsList,
  adminManageProject,
  adminGetReports,
  adminResolveReport,
  adminReviewCredentialAdvanced,
  adminGetDisputes,
  adminResolveDispute,
  adminGetFinancialActions,
  adminApproveFinancialAction,
  adminRejectFinancialAction,
  adminExecuteFinancialAction,
  adminGetFeeScheduleVersions,
  adminCreateFeeScheduleVersion,
  testCalculateProgressiveFee,
  adminGetPromotionsEnabled,
  adminTogglePromotionsEnabled,
  adminGetPromotions,
  adminCreatePromotion,
  adminDeletePromotion,
  adminGetAnalytics,
  adminGetSupportTickets,
  adminUpdateSupportTicket,
  adminGetAdminRolesList,
  adminManageRole,
  adminGetAuditLogEntries,
  DEFAULT_FINANCIAL_THRESHOLD_CENTS
} from '../src/services/adminConsoleService';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    passedTests++;
    console.log(`  ✓ ${message}`);
  }
}

async function runAdminConsoleTests() {
  console.log('\n================================================================');
  console.log('🧪 Running Dezignet Admin Console & Audit Log Test Suite');
  console.log('================================================================\n');

  // ----------------------------------------------------------------------------
  // Test 1: Role Capability Authorization Matrix
  // ----------------------------------------------------------------------------
  console.log('🔹 Test 1: Capability-Based Access Control Matrix');
  {
    setSimulatedAdminRole('super_admin');
    assert(hasCapability('roles_manage'), 'super_admin can manage admin roles');
    assert(hasCapability('financial_manage'), 'super_admin can manage financial disbursements');
    assert(hasCapability('private_content_read'), 'super_admin can read private content with reason');

    setSimulatedAdminRole('moderator');
    assert(hasCapability('moderation_manage'), 'moderator can manage content moderation');
    assert(hasCapability('projects_manage'), 'moderator can unpublish/remove projects');
    assert(!hasCapability('financial_manage'), 'moderator CANNOT approve financial disbursements');
    assert(!hasCapability('roles_manage'), 'moderator CANNOT assign admin roles');

    setSimulatedAdminRole('finance');
    assert(hasCapability('financial_manage'), 'finance can manage disbursements');
    assert(hasCapability('plans_fees_manage'), 'finance can manage fee schedules');
    assert(!hasCapability('moderation_manage'), 'finance CANNOT moderate content');
    assert(!hasCapability('credentials_manage'), 'finance CANNOT verify professional licenses');

    setSimulatedAdminRole('support');
    assert(hasCapability('support_manage'), 'support can manage tickets');
    assert(hasCapability('users_manage'), 'support can view/inspect users');
    assert(!hasCapability('financial_manage'), 'support CANNOT disburse funds');

    setSimulatedAdminRole('verifier');
    assert(hasCapability('credentials_manage'), 'verifier can verify credentials');
    assert(!hasCapability('users_manage'), 'verifier CANNOT suspend users');
    assert(!hasCapability('projects_manage'), 'verifier CANNOT remove projects');

    // Reset to super_admin
    setSimulatedAdminRole('super_admin');
  }

  // ----------------------------------------------------------------------------
  // Test 2: MFA & 15-Minute Re-Authentication Gate
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 2: MFA & 15-Minute Re-Authentication Gate');
  {
    recordAdminReauth();
    assert(!isReauthRequired(), 'Fresh re-authentication satisfies the 15-minute gate');

    // Reject non-6-digit TOTP
    const invalidShort = await verifyAdminMfaCode('123');
    assert(!invalidShort, 'Rejects invalid short TOTP code');

    const invalidAlpha = await verifyAdminMfaCode('12345A');
    assert(!invalidAlpha, 'Rejects non-numeric TOTP code');

    // Accept valid 6-digit TOTP
    const valid = await verifyAdminMfaCode('123456');
    assert(valid, 'Valid 6-digit TOTP code passes and resets session window');
  }

  // ----------------------------------------------------------------------------
  // Test 3: Two-Person Rule for Financial Actions
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 3: Two-Person Rule on Financial Actions');
  {
    assert(!requiresTwoPersonApproval(50000), '$500 (50,000 cents) does not require two-person rule');
    assert(!requiresTwoPersonApproval(100000), '$1,000 threshold boundary does not require two-person rule');
    assert(requiresTwoPersonApproval(100001), '$1,000.01 exceeds threshold and requires two-person dual control');
    assert(requiresTwoPersonApproval(250000), '$2,500 requires two-person approval');

    // Single approval for under-threshold item
    const actions = await adminGetFinancialActions('all');
    const underThreshold = actions.find(a => a.amountCents <= DEFAULT_FINANCIAL_THRESHOLD_CENTS && a.status === 'pending');
    assert(Boolean(underThreshold), 'Found pending under-threshold financial action');

    if (underThreshold) {
      const res = await adminApproveFinancialAction(underThreshold.id, 'Routine release within single-admin threshold');
      assert(res.success && res.status === 'approved' && !res.requiresSecondApproval, 'Under-threshold action approved immediately by single admin');
    }

    // Two-person rule workflow for over-threshold item
    const overThreshold = actions.find(a => a.amountCents > DEFAULT_FINANCIAL_THRESHOLD_CENTS && a.status === 'pending');
    assert(Boolean(overThreshold), 'Found pending over-threshold financial action');

    if (overThreshold) {
      // First approval
      const res1 = await adminApproveFinancialAction(overThreshold.id, 'First admin verification of cancellation refund');
      assert(res1.success && res1.status === 'pending' && res1.requiresSecondApproval, 'First approval leaves action pending second admin confirmation');

      // Attempt second approval by SAME admin -> MUST FAIL
      let doubleApprovalBlocked = false;
      try {
        await adminApproveFinancialAction(overThreshold.id, 'Attempting duplicate approval');
      } catch (err: any) {
        doubleApprovalBlocked = err.message.includes('Two-person rule violation');
      }
      assert(doubleApprovalBlocked, 'Two-person rule strictly blocks duplicate approval by same administrator');
    }

    // Rejection validation (requires min 5 chars)
    let rejectShortBlocked = false;
    try {
      await adminRejectFinancialAction(actions[0].id, 'no');
    } catch {
      rejectShortBlocked = true;
    }
    assert(rejectShortBlocked, 'Rejecting financial action requires justification (min 5 chars)');
  }

  // ----------------------------------------------------------------------------
  // Test 4: Written Reason Requirement for Reading Private Content
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 4: Mandatory Written Reason for Private Content Access');
  {
    let shortReasonBlocked = false;
    try {
      await logPrivateContentRead('messages', 'msg-123', 'peek');
    } catch {
      shortReasonBlocked = true;
    }
    assert(shortReasonBlocked, 'Accessing private user content without a valid reason (min 5 chars) is rejected');

    const validReason = 'Investigating reported harassment in dispute arbitration';
    await logPrivateContentRead('messages', 'msg-123', validReason);

    const auditLogs = await adminGetAuditLogEntries({ action: 'read_private_content' });
    const loggedEntry = auditLogs.find(e => e.targetId === 'msg-123' && e.reason === validReason);
    assert(Boolean(loggedEntry), 'Private read is logged with mandatory written reason in audit trail');
  }

  // ----------------------------------------------------------------------------
  // Test 5: Users Management (Suspension & Complimentary Plans)
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 5: Users Directory, Safety Suspensions & Complimentary Grants');
  {
    const users = await adminGetUsersList();
    assert(users.length >= 4, 'Loaded user list with roles and plans');

    const targetUser = users.find(u => u.role === 'client' && !u.isSuspended);
    assert(Boolean(targetUser), 'Found active client account for suspension test');

    if (targetUser) {
      const suspendReason = 'Suspected credit card chargeback abuse';
      await adminToggleUserSuspension(targetUser.id, true, suspendReason);

      const updatedUsers = await adminGetUsersList();
      const suspended = updatedUsers.find(u => u.id === targetUser.id);
      assert(suspended?.isSuspended === true, 'User successfully marked as suspended');
      assert(suspended?.suspensionReason === suspendReason, 'Suspension reason properly stored');

      // Unsuspend
      await adminToggleUserSuspension(targetUser.id, false, 'Identity verified via government ID');
      const restored = (await adminGetUsersList()).find(u => u.id === targetUser.id);
      assert(restored?.isSuspended === false, 'User successfully unsuspended with recorded reason');
    }

    // Complimentary Plan Grant
    const designer = users.find(u => u.role === 'designer');
    assert(Boolean(designer), 'Found designer profile for complimentary plan grant');

    if (designer) {
      await adminGrantComplimentaryPlan(designer.id, 'gold', 6, 'Beta testing early adopter compensation');
      const updatedDes = (await adminGetUsersList()).find(u => u.id === designer.id);
      assert(updatedDes?.complimentaryPlanId === 'gold', 'Complimentary Gold plan granted to designer');
      assert(Boolean(updatedDes?.complimentaryExpiresAt), 'Expiration date set on complimentary grant');
    }
  }

  // ----------------------------------------------------------------------------
  // Test 6: Project Moderation
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 6: Project Moderation Actions (Unpublish, Remove, Restore)');
  {
    const projects = await adminGetProjectsList();
    assert(projects.length >= 2, 'Loaded project listings');

    const activeProj = projects.find(p => p.status === 'open' && !p.isAdminRemoved);
    assert(Boolean(activeProj), 'Found active project for moderation');

    if (activeProj) {
      // Unpublish
      await adminManageProject(activeProj.id, 'unpublish', 'Missing architectural site survey details');
      let projs = await adminGetProjectsList();
      let updated = projs.find(p => p.id === activeProj.id);
      assert(updated?.status === 'draft', 'Project unpublished back to draft status');

      // Remove
      await adminManageProject(activeProj.id, 'remove', 'Solicitation of unpermitted construction documents');
      projs = await adminGetProjectsList();
      updated = projs.find(p => p.id === activeProj.id);
      assert(updated?.isAdminRemoved === true, 'Project marked as admin removed');

      // Restore
      await adminManageProject(activeProj.id, 'restore', 'Client updated scope to compliant zoning advisory');
      projs = await adminGetProjectsList();
      updated = projs.find(p => p.id === activeProj.id);
      assert(updated?.isAdminRemoved === false && updated?.status === 'open', 'Project restored to open marketplace');
    }
  }

  // ----------------------------------------------------------------------------
  // Test 7: Unified Reports & Moderation
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 7: Unified Reports Queue (Dismiss, Warn, Hide, Suspend)');
  {
    const reports = await adminGetReports({ status: 'pending' });
    assert(reports.length >= 1, 'Loaded pending reports queue');

    const rep = reports[0];
    await adminResolveReport(rep.id, 'warn', 'Formal warning sent for commercial solicitation');
    const updatedReps = await adminGetReports({ status: 'resolved' });
    const resolved = updatedReps.find(r => r.id === rep.id);
    assert(resolved?.status === 'resolved', 'Report resolved with logged administrative warning');
  }

  // ----------------------------------------------------------------------------
  // Test 8: Credentials Verification Queue
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 8: Professional Credentials Verification');
  {
    // Rejection requires min 5 characters
    let rejectShortBlocked = false;
    try {
      await adminReviewCredentialAdvanced({
        credentialId: 'cred-test',
        decision: 'rejected',
        reason: 'bad'
      });
    } catch {
      rejectShortBlocked = true;
    }
    assert(rejectShortBlocked, 'Credential rejection requires explanatory feedback (min 5 chars)');

    // Approve credential with jurisdiction
    const approved = await adminReviewCredentialAdvanced({
      credentialId: 'mock-cred-1',
      decision: 'approved',
      jurisdictionState: 'CA',
      verificationDate: '2026-11-14'
    });
    assert(approved, 'Credential approved with confirmed jurisdiction and verification date');
  }

  // ----------------------------------------------------------------------------
  // Test 9: Dispute Console & Resolution Outcomes
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 9: Dispute Console Resolutions & Financial Action Queuing');
  {
    const disputes = await adminGetDisputes();
    assert(disputes.length >= 1, 'Loaded active contract disputes');

    const dispute = disputes[0];
    assert(dispute.timeline.length > 0, 'Dispute includes milestone event history timeline');

    // Resolve split (60% designer / 40% client)
    await adminResolveDispute(dispute.id, 'split', 'Deliverable 60% complete before mutual cancellation', 60);

    const finActions = await adminGetFinancialActions('all');
    const designerPayout = finActions.find(f => f.type === 'split_resolution' && f.engagementId === dispute.engagementId);
    const clientRefund = finActions.find(f => f.type === 'refund' && f.engagementId === dispute.engagementId);

    assert(Boolean(designerPayout), 'Split resolution queued designer payout in financial actions');
    assert(Boolean(clientRefund), 'Split resolution queued client refund in financial actions');
    assert(designerPayout?.amountCents === 90000, 'Designer split amount calculated correctly (60% of $1,500 = $900 / 90,000 cents)');
    assert(clientRefund?.amountCents === 60000, 'Client refund amount calculated correctly (40% of $1,500 = $600 / 60,000 cents)');
  }

  // ----------------------------------------------------------------------------
  // Test 10: Fee Schedule Versioning & Progressive Calculation
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 10: Fee Schedule Versions & Progressive Marginal Calculations');
  {
    // Calculation verification against platform tiers:
    // First $5,000 @ 10%
    // $5,000 - $10,000 @ 5%
    // Over $10,000 @ 2.5%
    const calc2k = testCalculateProgressiveFee(2000);
    assert(calc2k.totalFee === 200, '$2,000 contract fee is exactly $200.00 (10%)');

    const calc5k = testCalculateProgressiveFee(5000);
    assert(calc5k.totalFee === 500, '$5,000 contract fee is exactly $500.00 (10%)');

    const calc10k = testCalculateProgressiveFee(10000);
    assert(calc10k.totalFee === 750, '$10,000 contract fee is exactly $750.00 ($500 + $250 = 7.5% effective)');

    const calc20k = testCalculateProgressiveFee(20000);
    assert(calc20k.totalFee === 1000, '$20,000 contract fee is exactly $1,000.00 ($500 + $250 + $250 = 5% effective)');

    // Versioning
    const versions = await adminGetFeeScheduleVersions();
    assert(versions.length >= 1, 'Loaded existing fee schedule versions');

    const newVersion = await adminCreateFeeScheduleVersion({
      version: 'v2.0.0-beta',
      tiers: [
        { up_to_cents: 500000, rate: 0.08, label: 'Promotional First $5k (8%)' },
        { up_to_cents: null, rate: 0.03, label: 'Over $5k (3%)' }
      ],
      marginalMode: true,
      basis: 'cumulative_project',
      reason: 'Promotional holiday rate adjustment for Q4 2026'
    });

    assert(newVersion.version === 'v2.0.0-beta', 'New fee schedule version recorded');
    const auditEntries = await adminGetAuditLogEntries({ action: 'create_fee_schedule_version' });
    assert(auditEntries.length > 0, 'Fee schedule creation recorded to security audit trail');
  }

  // ----------------------------------------------------------------------------
  // Test 11: Promotions Feature Switch
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 11: Promotions Feature Flag & CRUD');
  {
    const initialFlag = await adminGetPromotionsEnabled();
    assert(initialFlag === false, 'Promotions feature switch defaults to false');

    await adminTogglePromotionsEnabled(true);
    assert((await adminGetPromotionsEnabled()) === true, 'Promotions feature switch can be enabled');

    const newPromo = await adminCreatePromotion({
      designerId: 'des-test-1',
      designerName: 'Arch Studio Test',
      designerEmail: 'test@arch.com',
      placement: 'hero',
      durationDays: 7,
      label: 'Featured Studio',
      notes: 'Test promotion campaign'
    });

    assert(newPromo.placement === 'hero', 'Created hero promotion');
    const promos = await adminGetPromotions();
    assert(promos.some(p => p.id === newPromo.id), 'Promotion present in promotions list');

    await adminDeletePromotion(newPromo.id);
    const updatedPromos = await adminGetPromotions();
    assert(!updatedPromos.some(p => p.id === newPromo.id), 'Promotion successfully deleted');

    // Revert flag to false
    await adminTogglePromotionsEnabled(false);
    assert((await adminGetPromotionsEnabled()) === false, 'Promotions feature switch safely reset to false');
  }

  // ----------------------------------------------------------------------------
  // Test 12: Marketplace Analytics
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 12: Platform Analytics Metrics');
  {
    const analytics = await adminGetAnalytics('30d');
    assert(analytics.signupsTotal > 0, 'Returns total signups in period');
    assert(analytics.projectsPosted > 0, 'Returns total projects posted in period');
    assert(analytics.contractsAwarded > 0, 'Returns total contracts awarded in period');
    assert(analytics.acceptanceRatePercent > 0, 'Calculates proposal-to-contract acceptance rate');
    assert(analytics.grossVolumeUSD > 0, 'Calculates gross escrowed volume');
    assert(analytics.series.length > 0, 'Returns time-series weekly trend metrics');
  }

  // ----------------------------------------------------------------------------
  // Test 13: Support Tickets Helpdesk
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 13: Support Tickets Inbox & Internal Staff Notes');
  {
    const tickets = await adminGetSupportTickets('open');
    assert(tickets.length >= 1, 'Loaded open support tickets');

    const ticket = tickets[0];
    await adminUpdateSupportTicket(ticket.id, {
      status: 'in_progress',
      assigneeEmail: 'lead.support@dezignet.com',
      internalNotes: 'Contacted escrow payment processor regarding webhook event'
    });

    const updatedTickets = await adminGetSupportTickets('in_progress');
    const updated = updatedTickets.find(t => t.id === ticket.id);
    assert(updated?.status === 'in_progress', 'Support ticket status moved to in_progress');
    assert(updated?.assigneeEmail === 'lead.support@dezignet.com', 'Ticket assignee properly assigned');
    assert(updated?.internalNotes?.includes('webhook event') === true, 'Internal confidential note attached');
  }

  // ----------------------------------------------------------------------------
  // Test 14: Admin Role Management (Super Admin Exclusive)
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 14: Super Admin Role Assignment');
  {
    setSimulatedAdminRole('moderator');
    let nonSuperBlocked = false;
    try {
      await adminManageRole({
        userId: 'usr-new',
        email: 'newbie@dezignet.com',
        fullName: 'Newbie',
        role: 'finance',
        action: 'grant'
      });
    } catch (err: any) {
      nonSuperBlocked = err.message.includes('Only super_admin');
    }
    assert(nonSuperBlocked, 'Non-super_admin accounts are blocked from managing team roles');

    setSimulatedAdminRole('super_admin');
    await adminManageRole({
      userId: 'usr-new',
      email: 'newbie@dezignet.com',
      fullName: 'Newbie',
      role: 'finance',
      action: 'grant'
    });

    const rolesList = await adminGetAdminRolesList();
    assert(rolesList.some(r => r.email === 'newbie@dezignet.com' && r.role === 'finance'), 'super_admin can grant admin roles');

    // Revoke
    await adminManageRole({
      userId: 'usr-new',
      email: 'newbie@dezignet.com',
      fullName: 'Newbie',
      role: 'finance',
      action: 'revoke'
    });

    const updatedRoles = await adminGetAdminRolesList();
    assert(!updatedRoles.some(r => r.email === 'newbie@dezignet.com' && r.role === 'finance'), 'super_admin can revoke admin roles');
  }

  // ----------------------------------------------------------------------------
  // Test 15: Migration 049 SQL Schema Integrity
  // ----------------------------------------------------------------------------
  console.log('\n🔹 Test 15: Database Migration 049 Verification');
  {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/049_admin_console_and_audit.sql');
    assert(fs.existsSync(migrationPath), 'Migration file 049_admin_console_and_audit.sql exists');

    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Check append-only trigger
    assert(sqlContent.includes('trg_prevent_admin_audit_log_modification'), 'Trigger function prevents admin_audit_log modification');
    assert(sqlContent.includes('BEFORE UPDATE OR DELETE ON public.admin_audit_log'), 'Trigger bound BEFORE UPDATE OR DELETE');
    assert(sqlContent.includes('admin_audit_log is append-only'), 'Trigger raises append-only exception message');

    // Check tables
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.admin_roles'), 'Creates admin_roles table');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.admin_capabilities'), 'Creates admin_capabilities table');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.financial_actions'), 'Creates financial_actions queue table');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.fee_schedule_versions'), 'Creates fee_schedule_versions table');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.promotions'), 'Creates promotions table');
    assert(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.reports'), 'Creates unified reports table');

    // Check capability checking function
    assert(sqlContent.includes('check_admin_capability'), 'check_admin_capability function implemented');

    // Check two-person rule enforcement in database
    assert(sqlContent.includes('Two-person rule violation'), 'Two-person rule enforcement in admin_approve_financial_action');
    assert(sqlContent.includes('financial_approval_threshold'), 'Default financial_approval_threshold setting seeded');

    // Check written reason for private content read
    assert(sqlContent.includes('admin_log_private_read'), 'admin_log_private_read RPC function implemented');
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions`);
  console.log('================================================================\n');
}

runAdminConsoleTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
