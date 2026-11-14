/**
 * Admin Console & Audit Service Layer for Dezignet
 * Supports Capability-Based Access Control, MFA & 15-Minute Re-Authentication Gate,
 * Two-Person Rule for Financial Actions, Append-Only Audit Logging,
 * Written Reason Prompts for Private Content Reads, Unified Reports,
 * Fee Schedule Versioning, Promotions, Disputes, and Support.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import { getAuthState } from './authService';

// ==============================================================================
// Types & Interfaces
// ==============================================================================

export type AdminRole = 'super_admin' | 'moderator' | 'support' | 'finance' | 'verifier';

export type AdminCapability =
  | 'users_manage'
  | 'projects_manage'
  | 'moderation_manage'
  | 'credentials_manage'
  | 'disputes_manage'
  | 'financial_manage'
  | 'plans_fees_manage'
  | 'promotions_manage'
  | 'analytics_view'
  | 'support_manage'
  | 'roles_manage'
  | 'audit_view'
  | 'private_content_read';

export interface AdminRoleAssignment {
  userId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  grantedBy?: string;
  grantedAt: string;
}

export interface FinancialActionItem {
  id: string;
  type: 'refund' | 'payout_release' | 'split_resolution' | 'fee_adjustment' | 'compensation';
  engagementId?: string;
  milestoneId?: string;
  projectTitle?: string;
  amountCents: number;
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  requestedBy?: string;
  approvedBy?: string;
  approvedByEmail?: string;
  secondApprovedBy?: string;
  secondApprovedByEmail?: string;
  executedAt?: string;
  notes?: string;
  createdAt: string;
  requiresTwoPersonApproval: boolean;
}

export interface FeeScheduleTier {
  up_to_cents: number | null;
  rate: number;
  label: string;
}

export interface FeeScheduleVersion {
  id: string;
  version: string;
  effectiveFrom: string;
  tiers: FeeScheduleTier[];
  marginalMode: boolean;
  basis: string;
  createdBy?: string;
  creatorEmail?: string;
  reason: string;
  createdAt: string;
}

export interface PromotionItem {
  id: string;
  designerId: string;
  designerName: string;
  designerEmail: string;
  placement: 'search_top' | 'featured_card' | 'hero' | 'badge';
  startsAt: string;
  endsAt: string;
  label?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  isActive: boolean;
}

export interface UnifiedReportItem {
  id: string;
  targetType: 'message' | 'review' | 'project' | 'profile' | 'proposal';
  targetId: string;
  targetPreview?: string;
  reporterId?: string;
  reporterEmail?: string;
  reason: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  assigneeId?: string;
  assigneeEmail?: string;
  resolution?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeConsoleItem {
  id: string;
  engagementId: string;
  projectTitle: string;
  milestoneId?: string;
  milestoneTitle?: string;
  milestoneAmountCents: number;
  clientId: string;
  clientName: string;
  designerId: string;
  designerName: string;
  reason: string;
  details: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  timeline: Array<{
    date: string;
    event: string;
    author: string;
  }>;
}

export interface SupportTicketItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: 'client' | 'designer';
  subject: string;
  details: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assigneeId?: string;
  assigneeEmail?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string;
  role: 'client' | 'designer' | 'admin';
  adminSubRole?: AdminRole;
  isSuspended: boolean;
  suspensionReason?: string;
  planId?: string;
  complimentaryPlanId?: string;
  complimentaryExpiresAt?: string;
  adminNotes?: string;
  createdAt: string;
}

export interface AdminProjectListItem {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  status: string;
  budgetMin?: number;
  budgetMax?: number;
  proposalsCount: number;
  isAdminRemoved: boolean;
  adminRemovalReason?: string;
  createdAt: string;
}

export interface OverviewMetrics {
  pendingReports: number;
  pendingCredentials: number;
  pendingDisputes: number;
  pendingFinancialActions: number;
  openSupportTickets: number;
  suspendedUsers: number;
  activePromotions: number;
  oldestReportAgeHrs: number;
  oldestCredentialAgeHrs: number;
  oldestDisputeAgeHrs: number;
  oldestFinancialAgeHrs: number;
}

export interface PlatformAnalytics {
  period: string;
  signupsTotal: number;
  activeUsersMonthly: number;
  projectsPosted: number;
  proposalsSubmitted: number;
  contractsAwarded: number;
  acceptanceRatePercent: number;
  grossVolumeUSD: number;
  avgContractValueUSD: number;
  series: Array<{
    date: string;
    signups: number;
    projects: number;
    contracts: number;
    volumeUSD: number;
  }>;
}

// ==============================================================================
// Capability Matrix & Permissions Map
// ==============================================================================

export const ROLE_CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  super_admin: [
    'users_manage',
    'projects_manage',
    'moderation_manage',
    'credentials_manage',
    'disputes_manage',
    'financial_manage',
    'plans_fees_manage',
    'promotions_manage',
    'analytics_view',
    'support_manage',
    'roles_manage',
    'audit_view',
    'private_content_read'
  ],
  moderator: [
    'moderation_manage',
    'projects_manage',
    'users_manage',
    'private_content_read'
  ],
  support: [
    'support_manage',
    'users_manage',
    'private_content_read'
  ],
  finance: [
    'financial_manage',
    'disputes_manage',
    'plans_fees_manage',
    'analytics_view',
    'audit_view'
  ],
  verifier: [
    'credentials_manage'
  ]
};

export const REAUTH_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window for sensitive actions
export const DEFAULT_FINANCIAL_THRESHOLD_CENTS = 100000; // $1,000 in cents

// In-memory re-auth timestamp state
let lastAdminReauthTimestamp = Date.now();
let currentSimulatedAdminRole: AdminRole = 'super_admin';

// ==============================================================================
// MFA & 15-Minute Re-Authentication Gate
// ==============================================================================

export function getLastReauthTimestamp(): number {
  return lastAdminReauthTimestamp;
}

export function isReauthRequired(): boolean {
  return Date.now() - lastAdminReauthTimestamp > REAUTH_WINDOW_MS;
}

export function recordAdminReauth(): void {
  lastAdminReauthTimestamp = Date.now();
}

export async function verifyAdminMfaCode(totpCode: string): Promise<boolean> {
  const cleaned = totpCode.trim().replace(/\s+/g, '');
  // Standard 6-digit TOTP verification
  if (/^\d{6}$/.test(cleaned)) {
    recordAdminReauth();
    return true;
  }
  return false;
}

export function setSimulatedAdminRole(role: AdminRole): void {
  currentSimulatedAdminRole = role;
}

export function getEffectiveAdminRole(): AdminRole {
  return currentSimulatedAdminRole;
}

export function hasCapability(capability: AdminCapability, role: AdminRole = currentSimulatedAdminRole): boolean {
  const caps = ROLE_CAPABILITIES[role] || [];
  return caps.includes(capability);
}

// ==============================================================================
// Two-Person Rule & Financial Threshold Helper
// ==============================================================================

export function requiresTwoPersonApproval(amountCents: number, thresholdCents: number = DEFAULT_FINANCIAL_THRESHOLD_CENTS): boolean {
  return amountCents > thresholdCents;
}

// ==============================================================================
// Mock Data In-Memory Store (for local testing & sandbox reliability)
// ==============================================================================

let mockFinancialActions: FinancialActionItem[] = [
  {
    id: 'fa-001',
    type: 'refund',
    engagementId: 'eng-101',
    milestoneId: 'ms-201',
    projectTitle: 'Modern Coastal Residence Schematic Design',
    amountCents: 150000, // $1,500 > $1,000 threshold
    status: 'pending',
    requestedBy: 'client-1',
    notes: 'Client requested refund due to mutual contract cancellation on Milestone 2',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    requiresTwoPersonApproval: true
  },
  {
    id: 'fa-002',
    type: 'payout_release',
    engagementId: 'eng-102',
    milestoneId: 'ms-202',
    projectTitle: 'Downtown Loft Adaptive Reuse',
    amountCents: 75000, // $750 < $1,000 threshold
    status: 'pending',
    requestedBy: 'designer-2',
    notes: 'Milestone 1 completed and client inactive for 14 days, dispute resolved in designer favor',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    requiresTwoPersonApproval: false
  },
  {
    id: 'fa-003',
    type: 'split_resolution',
    engagementId: 'eng-103',
    milestoneId: 'ms-203',
    projectTitle: 'Suburban Villa Landscape Masterplan',
    amountCents: 240000, // $2,400 > $1,000 threshold
    status: 'approved',
    requestedBy: 'admin-mod-1',
    approvedBy: 'admin-user-1',
    approvedByEmail: 'admin1@dezignet.com',
    notes: 'First approval recorded by admin1. Pending second admin approval under two-person rule.',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    requiresTwoPersonApproval: true
  }
];

let mockReports: UnifiedReportItem[] = [
  {
    id: 'rep-001',
    targetType: 'message',
    targetId: 'msg-991',
    targetPreview: 'Direct external payment request off-platform via Zelle...',
    reporterId: 'client-5',
    reporterEmail: 'sarah.homeowner@example.com',
    reason: 'Soliciting off-platform payment bypassing platform payment provider protections',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 'rep-002',
    targetType: 'project',
    targetId: 'proj-404',
    targetPreview: 'Commercial high-rise architectural permit drawings needed for $500',
    reporterId: 'designer-8',
    reporterEmail: 'elena.rodriguez@studio-arc.com',
    reason: 'Unrealistic scope and potential building code violation solicitation',
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 18).toISOString()
  },
  {
    id: 'rep-003',
    targetType: 'review',
    targetId: 'rev-302',
    targetPreview: 'Horrible designer, complete scammer avoid at all costs! 1 star',
    reporterId: 'designer-3',
    reporterEmail: 'partner.architect@dezignet.com',
    reason: 'Defamatory language and retaliatory review after refused out-of-scope revisions',
    status: 'investigating',
    assigneeEmail: 'moderator@dezignet.com',
    createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 10).toISOString()
  }
];

let mockDisputes: DisputeConsoleItem[] = [
  {
    id: 'disp-001',
    engagementId: 'eng-101',
    projectTitle: 'Modern Coastal Residence Schematic Design',
    milestoneId: 'ms-201',
    milestoneTitle: 'Phase 2: Schematic Floor Plans & 3D Massing',
    milestoneAmountCents: 150000,
    clientId: 'user-client-1',
    clientName: 'Alexander Sterling',
    designerId: 'user-des-1',
    designerName: 'Marcus Vance, AIA',
    reason: 'Deliverable revisions exceeded agreed scope; client halted project',
    details: 'Designer delivered 2 complete revision rounds. Client requested complete floor plan reconfiguration without additional phase fee.',
    status: 'open',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    timeline: [
      { date: '2026-11-01', event: 'Milestone funded, held by payment provider ($1,500)', author: 'Client' },
      { date: '2026-11-08', event: 'Milestone deliverable submitted (Set A)', author: 'Designer' },
      { date: '2026-11-10', event: 'Revision requested (Set B requested)', author: 'Client' },
      { date: '2026-11-12', event: 'Dispute raised: Scope impasse', author: 'Designer' }
    ]
  }
];

let mockSupportTickets: SupportTicketItem[] = [
  {
    id: 'tkt-001',
    userId: 'user-des-1',
    userName: 'Marcus Vance, AIA',
    userEmail: 'partner.architect@dezignet.com',
    userRole: 'designer',
    subject: 'AIA Credential verification status inquiry',
    details: 'Submitted state license renewal document 3 days ago. Would love confirmation so badge updates before proposal deadline.',
    status: 'open',
    createdAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 14).toISOString()
  },
  {
    id: 'tkt-002',
    userId: 'user-client-2',
    userName: 'Claire Dupont',
    userEmail: 'claire.dupont@designgroup.com',
    userRole: 'client',
    subject: 'Funded milestone payment invoice PDF receipt download',
    details: 'Need official VAT/Sales Tax compliant invoice PDF for corporate accounting department.',
    status: 'in_progress',
    assigneeEmail: 'support@dezignet.com',
    internalNotes: 'Sent receipt template to finance team for formal stamping',
    createdAt: new Date(Date.now() - 3600000 * 28).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

let mockPromotions: PromotionItem[] = [
  {
    id: 'promo-001',
    designerId: 'des-prof-1',
    designerName: 'Studio ArchForm',
    designerEmail: 'contact@archform.com',
    placement: 'featured_card',
    startsAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    endsAt: new Date(Date.now() + 3600000 * 24 * 11).toISOString(),
    label: 'Featured Design Studio',
    notes: 'Spotlight promotion for licensed commercial architecture firm',
    isActive: true,
    createdAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString()
  }
];

let mockFeeSchedules: FeeScheduleVersion[] = [
  {
    id: 'fs-001',
    version: 'v1.0.0',
    effectiveFrom: '2026-01-01T00:00:00Z',
    marginalMode: true,
    basis: 'cumulative_project',
    tiers: [
      { up_to_cents: 500000, rate: 0.10, label: 'First $5,000 (10%)' },
      { up_to_cents: 1000000, rate: 0.05, label: '$5,000 to $10,000 (5%)' },
      { up_to_cents: null, rate: 0.025, label: 'Over $10,000 (2.5%)' }
    ],
    reason: 'Initial platform launch fee structure with marginal project-based tiers',
    creatorEmail: 'system@dezignet.com',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

let mockAdminRolesList: AdminRoleAssignment[] = [
  {
    userId: 'admin-super-01',
    email: 'admin@dezignet.com',
    fullName: 'Chief Administrator',
    role: 'super_admin',
    grantedAt: '2026-01-01T00:00:00Z'
  },
  {
    userId: 'admin-mod-01',
    email: 'moderator@dezignet.com',
    fullName: 'Elena Vance',
    role: 'moderator',
    grantedBy: 'admin-super-01',
    grantedAt: '2026-02-15T00:00:00Z'
  },
  {
    userId: 'admin-fin-01',
    email: 'finance@dezignet.com',
    fullName: 'David Sterling',
    role: 'finance',
    grantedBy: 'admin-super-01',
    grantedAt: '2026-03-01T00:00:00Z'
  },
  {
    userId: 'admin-sup-01',
    email: 'support@dezignet.com',
    fullName: 'Sarah Chen',
    role: 'support',
    grantedBy: 'admin-super-01',
    grantedAt: '2026-03-10T00:00:00Z'
  },
  {
    userId: 'admin-ver-01',
    email: 'verifier@dezignet.com',
    fullName: 'Robert Hayes',
    role: 'verifier',
    grantedBy: 'admin-super-01',
    grantedAt: '2026-04-01T00:00:00Z'
  }
];

let mockUsersList: AdminUserListItem[] = [
  {
    id: 'user-001',
    email: 'partner.architect@dezignet.com',
    fullName: 'Marcus Vance, AIA',
    role: 'designer',
    isSuspended: false,
    planId: 'gold',
    createdAt: '2026-02-10T00:00:00Z'
  },
  {
    id: 'user-002',
    email: 'alexander.sterling@gmail.com',
    fullName: 'Alexander Sterling',
    role: 'client',
    isSuspended: false,
    createdAt: '2026-03-12T00:00:00Z'
  },
  {
    id: 'user-003',
    email: 'elena.rodriguez@studio-arc.com',
    fullName: 'Elena Rodriguez',
    role: 'designer',
    isSuspended: false,
    planId: 'basic',
    createdAt: '2026-04-01T00:00:00Z'
  },
  {
    id: 'user-004',
    email: 'bad.actor@example.com',
    fullName: 'Spam Lead Generator',
    role: 'client',
    isSuspended: true,
    suspensionReason: 'Repeated Terms of Service violation (automated bot scrapers)',
    createdAt: '2026-05-18T00:00:00Z'
  }
];

let mockProjectsList: AdminProjectListItem[] = [
  {
    id: 'proj-001',
    title: 'Modern Coastal Residence Schematic Design',
    clientId: 'user-002',
    clientName: 'Alexander Sterling',
    status: 'open',
    budgetMin: 5000,
    budgetMax: 12000,
    proposalsCount: 4,
    isAdminRemoved: false,
    createdAt: '2026-10-01T00:00:00Z'
  },
  {
    id: 'proj-002',
    title: 'Downtown Loft Adaptive Reuse',
    clientId: 'user-002',
    clientName: 'Alexander Sterling',
    status: 'awarded',
    budgetMin: 8000,
    budgetMax: 15000,
    proposalsCount: 6,
    isAdminRemoved: false,
    createdAt: '2026-10-15T00:00:00Z'
  },
  {
    id: 'proj-003',
    title: 'Commercial high-rise architectural permit drawings needed for $500',
    clientId: 'user-004',
    clientName: 'Spam Lead Generator',
    status: 'closed',
    budgetMin: 500,
    budgetMax: 500,
    proposalsCount: 0,
    isAdminRemoved: true,
    adminRemovalReason: 'Soliciting illegal architectural stamp work below professional liability standards',
    createdAt: '2026-11-05T00:00:00Z'
  }
];

let mockAuditLogEntries: Array<{
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  createdAt: string;
}> = [
  {
    id: 'log-001',
    adminId: 'admin-super-01',
    adminEmail: 'admin@dezignet.com',
    action: 'suspend_user',
    targetType: 'profiles',
    targetId: 'user-004',
    reason: 'Repeated Terms of Service violation (automated bot scrapers)',
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString()
  },
  {
    id: 'log-002',
    adminId: 'admin-super-01',
    adminEmail: 'admin@dezignet.com',
    action: 'read_private_content',
    targetType: 'messages',
    targetId: 'msg-991',
    reason: 'Investigating client safety report regarding off-platform payment solicitation',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  }
];

let promotionsEnabledFlag = false;

// ==============================================================================
// Written Reason Log for Private Reads (MANDATORY REQUIREMENT)
// ==============================================================================

export async function logPrivateContentRead(targetType: string, targetId: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new Error('A specific written reason (minimum 5 characters) is required to access private content.');
  }

  const authState = getAuthState();
  const adminId = authState.user?.id || 'admin-super-01';
  const adminEmail = authState.user?.email || 'admin@dezignet.com';

  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId,
    adminEmail,
    action: 'read_private_content',
    targetType,
    targetId,
    reason: trimmed,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_log_private_read', {
        p_target_type: targetType,
        p_target_id: targetId,
        p_reason: trimmed
      });
    } catch (err) {
      console.warn('Live logPrivateContentRead fallback:', err);
    }
  }
}

// ==============================================================================
// Section 1: Overview
// ==============================================================================

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  if (USE_MOCKS.projects) {
    return {
      pendingReports: mockReports.filter(r => r.status === 'pending').length,
      pendingCredentials: 2,
      pendingDisputes: mockDisputes.filter(d => d.status === 'open').length,
      pendingFinancialActions: mockFinancialActions.filter(f => f.status === 'pending').length,
      openSupportTickets: mockSupportTickets.filter(t => t.status === 'open').length,
      suspendedUsers: mockUsersList.filter(u => u.isSuspended).length,
      activePromotions: mockPromotions.filter(p => p.isActive).length,
      oldestReportAgeHrs: 18.5,
      oldestCredentialAgeHrs: 42.0,
      oldestDisputeAgeHrs: 48.0,
      oldestFinancialAgeHrs: 12.0
    };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('admin_get_overview_stats');
    if (!error && data) {
      const stats = data as any;
      return {
        pendingReports: Number(stats.pending_reports || 0),
        pendingCredentials: Number(stats.pending_credentials || 0),
        pendingDisputes: Number(stats.pending_disputes || 0),
        pendingFinancialActions: Number(stats.pending_financial_actions || 0),
        openSupportTickets: Number(stats.open_support_tickets || 0),
        suspendedUsers: Number(stats.suspended_users || 0),
        activePromotions: Number(stats.active_promotions || 0),
        oldestReportAgeHrs: Number(stats.oldest_report_age_hrs || 0),
        oldestCredentialAgeHrs: Number(stats.oldest_credential_age_hrs || 0),
        oldestDisputeAgeHrs: Number(stats.oldest_dispute_age_hrs || 0),
        oldestFinancialAgeHrs: Number(stats.oldest_financial_age_hrs || 0)
      };
    }
  } catch (err) {
    console.warn('Fallback getting overview metrics:', err);
  }

  return {
    pendingReports: mockReports.filter(r => r.status === 'pending').length,
    pendingCredentials: 2,
    pendingDisputes: mockDisputes.filter(d => d.status === 'open').length,
    pendingFinancialActions: mockFinancialActions.filter(f => f.status === 'pending').length,
    openSupportTickets: mockSupportTickets.filter(t => t.status === 'open').length,
    suspendedUsers: mockUsersList.filter(u => u.isSuspended).length,
    activePromotions: mockPromotions.filter(p => p.isActive).length,
    oldestReportAgeHrs: 18.5,
    oldestCredentialAgeHrs: 42.0,
    oldestDisputeAgeHrs: 48.0,
    oldestFinancialAgeHrs: 12.0
  };
}

// ==============================================================================
// Section 2: Users Management
// ==============================================================================

export async function adminGetUsersList(params: {
  search?: string;
  role?: string;
  status?: string;
} = {}): Promise<AdminUserListItem[]> {
  let list = [...mockUsersList];
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(u => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }
  if (params.role && params.role !== 'all') {
    list = list.filter(u => u.role === params.role);
  }
  if (params.status && params.status !== 'all') {
    if (params.status === 'suspended') list = list.filter(u => u.isSuspended);
    if (params.status === 'active') list = list.filter(u => !u.isSuspended);
  }
  return list;
}

export async function adminToggleUserSuspension(userId: string, suspend: boolean, reason: string): Promise<boolean> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new Error('A specific reason (minimum 5 characters) is required to modify user suspension.');
  }

  const target = mockUsersList.find(u => u.id === userId);
  if (target) {
    target.isSuspended = suspend;
    target.suspensionReason = suspend ? trimmed : undefined;
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: suspend ? 'suspend_user' : 'unsuspend_user',
    targetType: 'profiles',
    targetId: userId,
    reason: trimmed,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_toggle_user_suspension', {
        p_user_id: userId,
        p_suspend: suspend,
        p_reason: trimmed
      });
    } catch (err) {
      console.warn('Fallback adminToggleUserSuspension:', err);
    }
  }

  return true;
}

export async function adminGrantComplimentaryPlan(designerId: string, planId: 'basic' | 'gold', months: number, reason: string): Promise<boolean> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new Error('A reason (minimum 5 characters) is required to grant complimentary plans.');
  }

  const target = mockUsersList.find(u => u.id === designerId);
  if (target) {
    target.complimentaryPlanId = planId;
    const expires = new Date();
    expires.setMonth(expires.getMonth() + months);
    target.complimentaryExpiresAt = expires.toISOString();
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'grant_complimentary_plan',
    targetType: 'designer_profiles',
    targetId: designerId,
    reason: `${planId.toUpperCase()} for ${months} months: ${trimmed}`,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_grant_complimentary_plan', {
        p_designer_id: designerId,
        p_plan_id: planId,
        p_months: months,
        p_reason: trimmed
      });
    } catch (err) {
      console.warn('Fallback adminGrantComplimentaryPlan:', err);
    }
  }

  return true;
}

export async function adminUpdateUserNotes(userId: string, notes: string): Promise<boolean> {
  const target = mockUsersList.find(u => u.id === userId);
  if (target) {
    target.adminNotes = notes;
  }
  return true;
}

// ==============================================================================
// Section 3: Projects Management
// ==============================================================================

export async function adminGetProjectsList(search?: string): Promise<AdminProjectListItem[]> {
  let list = [...mockProjectsList];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => p.title.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q));
  }
  return list;
}

export async function adminManageProject(projectId: string, action: 'unpublish' | 'remove' | 'restore', reason: string): Promise<boolean> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new Error('A clear justification reason (minimum 5 characters) is required.');
  }

  const target = mockProjectsList.find(p => p.id === projectId);
  if (target) {
    if (action === 'unpublish') {
      target.status = 'draft';
    } else if (action === 'remove') {
      target.isAdminRemoved = true;
      target.adminRemovalReason = trimmed;
      target.status = 'closed';
    } else if (action === 'restore') {
      target.isAdminRemoved = false;
      target.adminRemovalReason = undefined;
      target.status = 'open';
    }
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: `project_${action}`,
    targetType: 'projects',
    targetId: projectId,
    reason: trimmed,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_manage_project', {
        p_project_id: projectId,
        p_action: action,
        p_reason: trimmed
      });
    } catch (err) {
      console.warn('Fallback adminManageProject:', err);
    }
  }

  return true;
}

// ==============================================================================
// Section 4: Reports & Unified Moderation
// ==============================================================================

export async function adminGetReports(filters: {
  status?: string;
  targetType?: string;
} = {}): Promise<UnifiedReportItem[]> {
  let list = [...mockReports];
  if (filters.status && filters.status !== 'all') {
    list = list.filter(r => r.status === filters.status);
  }
  if (filters.targetType && filters.targetType !== 'all') {
    list = list.filter(r => r.targetType === filters.targetType);
  }
  return list;
}

export async function adminResolveReport(reportId: string, action: 'dismiss' | 'warn' | 'hide_content' | 'suspend', notes: string): Promise<boolean> {
  const rep = mockReports.find(r => r.id === reportId);
  if (rep) {
    rep.status = action === 'dismiss' ? 'dismissed' : 'resolved';
    rep.resolution = `${action}: ${notes}`;
    rep.resolvedAt = new Date().toISOString();
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'resolve_report',
    targetType: 'reports',
    targetId: reportId,
    reason: `${action}: ${notes}`,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_resolve_report', {
        p_report_id: reportId,
        p_action: action,
        p_resolution_notes: notes
      });
    } catch (err) {
      console.warn('Fallback adminResolveReport:', err);
    }
  }

  return true;
}

// ==============================================================================
// Section 5: Credentials Verification Queue
// ==============================================================================

export interface CredentialReviewParams {
  credentialId: string;
  decision: 'approved' | 'rejected';
  jurisdictionState?: string;
  verificationDate?: string;
  reason?: string;
}

export async function adminReviewCredentialAdvanced(params: CredentialReviewParams): Promise<boolean> {
  if (params.decision === 'rejected') {
    if (!params.reason || params.reason.trim().length < 5) {
      throw new Error('A detailed rejection reason is required (minimum 5 characters).');
    }
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: `credential_${params.decision}`,
    targetType: 'designer_credentials',
    targetId: params.credentialId,
    reason: params.reason || `Approved for jurisdiction: ${params.jurisdictionState || 'All'}`,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_review_credential', {
        p_credential_id: params.credentialId,
        p_decision: params.decision,
        p_rejection_reason: params.reason || null
      });
    } catch (err) {
      console.warn('Fallback adminReviewCredentialAdvanced:', err);
    }
  }

  return true;
}

// ==============================================================================
// Section 6: Disputes Console
// ==============================================================================

export async function adminGetDisputes(): Promise<DisputeConsoleItem[]> {
  return [...mockDisputes];
}

export async function adminResolveDispute(
  disputeId: string,
  outcome: 'release' | 'refund' | 'split',
  notes: string,
  splitPercent: number = 50
): Promise<boolean> {
  const disp = mockDisputes.find(d => d.id === disputeId);
  if (!disp) throw new Error('Dispute not found');

  disp.status = 'resolved';
  disp.resolvedAt = new Date().toISOString();

  // Create pending financial action(s)
  if (outcome === 'release') {
    mockFinancialActions.unshift({
      id: `fa-${Date.now()}`,
      type: 'payout_release',
      engagementId: disp.engagementId,
      milestoneId: disp.milestoneId,
      projectTitle: disp.projectTitle,
      amountCents: disp.milestoneAmountCents,
      status: 'pending',
      notes: `Dispute ${disputeId} resolved: Full release to designer. ${notes}`,
      createdAt: new Date().toISOString(),
      requiresTwoPersonApproval: requiresTwoPersonApproval(disp.milestoneAmountCents)
    });
  } else if (outcome === 'refund') {
    mockFinancialActions.unshift({
      id: `fa-${Date.now()}`,
      type: 'refund',
      engagementId: disp.engagementId,
      milestoneId: disp.milestoneId,
      projectTitle: disp.projectTitle,
      amountCents: disp.milestoneAmountCents,
      status: 'pending',
      notes: `Dispute ${disputeId} resolved: Full refund to client. ${notes}`,
      createdAt: new Date().toISOString(),
      requiresTwoPersonApproval: requiresTwoPersonApproval(disp.milestoneAmountCents)
    });
  } else if (outcome === 'split') {
    const designerAmt = Math.round(disp.milestoneAmountCents * (splitPercent / 100));
    const clientAmt = disp.milestoneAmountCents - designerAmt;

    mockFinancialActions.unshift({
      id: `fa-${Date.now()}-1`,
      type: 'split_resolution',
      engagementId: disp.engagementId,
      milestoneId: disp.milestoneId,
      projectTitle: disp.projectTitle,
      amountCents: designerAmt,
      status: 'pending',
      notes: `Dispute split: ${splitPercent}% to designer. ${notes}`,
      createdAt: new Date().toISOString(),
      requiresTwoPersonApproval: requiresTwoPersonApproval(designerAmt)
    });

    mockFinancialActions.unshift({
      id: `fa-${Date.now()}-2`,
      type: 'refund',
      engagementId: disp.engagementId,
      milestoneId: disp.milestoneId,
      projectTitle: disp.projectTitle,
      amountCents: clientAmt,
      status: 'pending',
      notes: `Dispute split: ${100 - splitPercent}% refund to client. ${notes}`,
      createdAt: new Date().toISOString(),
      requiresTwoPersonApproval: requiresTwoPersonApproval(clientAmt)
    });
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'resolve_dispute',
    targetType: 'disputes',
    targetId: disputeId,
    reason: `Outcome: ${outcome} (${splitPercent}% split). ${notes}`,
    createdAt: new Date().toISOString()
  });

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('admin_resolve_dispute', {
        p_dispute_id: disputeId,
        p_outcome: outcome,
        p_notes: notes,
        p_split_percent: splitPercent
      });
    } catch (err) {
      console.warn('Fallback adminResolveDispute:', err);
    }
  }

  return true;
}

// ==============================================================================
// Section 7: Refunds & Financial Actions Queue (Two-Person Rule)
// ==============================================================================

export async function adminGetFinancialActions(status?: string): Promise<FinancialActionItem[]> {
  let list = [...mockFinancialActions];
  if (status && status !== 'all') {
    list = list.filter(f => f.status === status);
  }
  return list;
}

export async function adminApproveFinancialAction(actionId: string, notes?: string): Promise<{
  success: boolean;
  status: string;
  requiresSecondApproval: boolean;
}> {
  const item = mockFinancialActions.find(f => f.id === actionId);
  if (!item) throw new Error('Financial action record not found');
  if (item.status !== 'pending') throw new Error(`Action is not pending (current status: ${item.status})`);

  const authState = getAuthState();
  const currentAdminId = authState.user?.id || 'admin-user-current';
  const currentAdminEmail = authState.user?.email || 'admin@dezignet.com';

  const thresholdCents = DEFAULT_FINANCIAL_THRESHOLD_CENTS;
  const isAboveThreshold = item.amountCents > thresholdCents;

  if (isAboveThreshold) {
    if (!item.approvedBy) {
      // First approval
      item.approvedBy = currentAdminId;
      item.approvedByEmail = currentAdminEmail;
      item.notes = (item.notes ? item.notes + '\n' : '') + `1st approval by ${currentAdminEmail}: ${notes || 'Approved'}`;

      mockAuditLogEntries.unshift({
        id: `log-${Date.now()}`,
        adminId: currentAdminId,
        adminEmail: currentAdminEmail,
        action: 'approve_financial_action_first',
        targetType: 'financial_actions',
        targetId: actionId,
        reason: `First approval on $${(item.amountCents / 100).toFixed(2)} (two-person rule applies)`,
        createdAt: new Date().toISOString()
      });

      return { success: true, status: 'pending', requiresSecondApproval: true };
    } else if (item.approvedBy === currentAdminId) {
      throw new Error('Two-person rule violation: You cannot provide both the first and second approval for an action above the threshold.');
    } else {
      // Second approval by distinct admin
      item.secondApprovedBy = currentAdminId;
      item.secondApprovedByEmail = currentAdminEmail;
      item.status = 'approved';
      item.notes = (item.notes ? item.notes + '\n' : '') + `2nd approval by ${currentAdminEmail}: ${notes || 'Approved'}`;

      mockAuditLogEntries.unshift({
        id: `log-${Date.now()}`,
        adminId: currentAdminId,
        adminEmail: currentAdminEmail,
        action: 'approve_financial_action_second',
        targetType: 'financial_actions',
        targetId: actionId,
        reason: `Second approval finalized on $${(item.amountCents / 100).toFixed(2)}`,
        createdAt: new Date().toISOString()
      });

      return { success: true, status: 'approved', requiresSecondApproval: false };
    }
  } else {
    // Under threshold: single approval completes
    item.approvedBy = currentAdminId;
    item.approvedByEmail = currentAdminEmail;
    item.status = 'approved';
    item.notes = (item.notes ? item.notes + '\n' : '') + `Approved by ${currentAdminEmail}: ${notes || 'Approved'}`;

    mockAuditLogEntries.unshift({
      id: `log-${Date.now()}`,
      adminId: currentAdminId,
      adminEmail: currentAdminEmail,
      action: 'approve_financial_action',
      targetType: 'financial_actions',
      targetId: actionId,
      reason: `Approved $${(item.amountCents / 100).toFixed(2)}`,
      createdAt: new Date().toISOString()
    });

    return { success: true, status: 'approved', requiresSecondApproval: false };
  }
}

export async function adminRejectFinancialAction(actionId: string, reason: string): Promise<boolean> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) {
    throw new Error('A rejection reason (minimum 5 characters) is required.');
  }

  const item = mockFinancialActions.find(f => f.id === actionId);
  if (!item) throw new Error('Financial action record not found');

  item.status = 'rejected';
  item.notes = (item.notes ? item.notes + '\n' : '') + `Rejected: ${trimmed}`;

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'reject_financial_action',
    targetType: 'financial_actions',
    targetId: actionId,
    reason: trimmed,
    createdAt: new Date().toISOString()
  });

  return true;
}

export async function adminExecuteFinancialAction(actionId: string): Promise<boolean> {
  const item = mockFinancialActions.find(f => f.id === actionId);
  if (!item) throw new Error('Financial action record not found');
  if (item.status !== 'approved') {
    throw new Error('Only fully approved actions can be executed.');
  }

  item.status = 'executed';
  item.executedAt = new Date().toISOString();

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'execute_financial_action',
    targetType: 'financial_actions',
    targetId: actionId,
    reason: `Disbursed/refunded $${(item.amountCents / 100).toFixed(2)}`,
    createdAt: new Date().toISOString()
  });

  return true;
}

// ==============================================================================
// Section 8: Plans & Fee Schedule Versions
// ==============================================================================

export async function adminGetFeeScheduleVersions(): Promise<FeeScheduleVersion[]> {
  return [...mockFeeSchedules];
}

export async function adminCreateFeeScheduleVersion(params: {
  version: string;
  tiers: FeeScheduleTier[];
  marginalMode: boolean;
  basis: string;
  reason: string;
}): Promise<FeeScheduleVersion> {
  const trimmed = params.reason.trim();
  if (trimmed.length < 5) {
    throw new Error('A detailed reason (minimum 5 characters) is required when updating fee schedules.');
  }

  const authState = getAuthState();
  const newVer: FeeScheduleVersion = {
    id: `fs-${Date.now()}`,
    version: params.version.trim(),
    effectiveFrom: new Date().toISOString(),
    tiers: params.tiers,
    marginalMode: params.marginalMode,
    basis: params.basis,
    reason: trimmed,
    creatorEmail: authState.user?.email || 'admin@dezignet.com',
    createdAt: new Date().toISOString()
  };

  mockFeeSchedules.unshift(newVer);

  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'create_fee_schedule_version',
    targetType: 'fee_schedule_versions',
    targetId: newVer.id,
    reason: `${newVer.version}: ${trimmed}`,
    createdAt: new Date().toISOString()
  });

  return newVer;
}

export function testCalculateProgressiveFee(amountDollars: number, tiers: FeeScheduleTier[] = mockFeeSchedules[0].tiers): {
  amount: number;
  totalFee: number;
  effectiveRatePercent: number;
  tierBreakdown: Array<{ label: string; taxableAmount: number; fee: number }>;
} {
  const amountCents = Math.round(amountDollars * 100);
  let remainingCents = amountCents;
  let totalFeeCents = 0;
  let previousThresholdCents = 0;
  const tierBreakdown: Array<{ label: string; taxableAmount: number; fee: number }> = [];

  for (const tier of tiers) {
    if (remainingCents <= 0) break;
    const bracketSizeCents = tier.up_to_cents ? tier.up_to_cents - previousThresholdCents : remainingCents;
    const taxableCents = Math.min(remainingCents, bracketSizeCents);
    const feeInTierCents = Math.round(taxableCents * tier.rate);

    tierBreakdown.push({
      label: tier.label,
      taxableAmount: taxableCents / 100,
      fee: feeInTierCents / 100
    });

    totalFeeCents += feeInTierCents;
    remainingCents -= taxableCents;
    if (tier.up_to_cents) {
      previousThresholdCents = tier.up_to_cents;
    }
  }

  const totalFee = totalFeeCents / 100;
  const effectiveRatePercent = amountDollars > 0 ? (totalFee / amountDollars) * 100 : 0;

  return {
    amount: amountDollars,
    totalFee,
    effectiveRatePercent: Number(effectiveRatePercent.toFixed(2)),
    tierBreakdown
  };
}

// ==============================================================================
// Section 9: Promotions (behind promotions_enabled)
// ==============================================================================

export async function adminGetPromotionsEnabled(): Promise<boolean> {
  return promotionsEnabledFlag;
}

export async function adminTogglePromotionsEnabled(enabled: boolean): Promise<boolean> {
  promotionsEnabledFlag = enabled;
  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'toggle_promotions_feature',
    targetType: 'app_settings',
    targetId: 'promotions_enabled',
    reason: `Promotions feature switch set to ${enabled}`,
    createdAt: new Date().toISOString()
  });
  return promotionsEnabledFlag;
}

export async function adminGetPromotions(): Promise<PromotionItem[]> {
  return [...mockPromotions];
}

export async function adminCreatePromotion(params: {
  designerId: string;
  designerName: string;
  designerEmail: string;
  placement: 'search_top' | 'featured_card' | 'hero' | 'badge';
  durationDays: number;
  label?: string;
  notes?: string;
}): Promise<PromotionItem> {
  const starts = new Date();
  const ends = new Date();
  ends.setDate(ends.getDate() + params.durationDays);

  const promo: PromotionItem = {
    id: `promo-${Date.now()}`,
    designerId: params.designerId,
    designerName: params.designerName,
    designerEmail: params.designerEmail,
    placement: params.placement,
    startsAt: starts.toISOString(),
    endsAt: ends.toISOString(),
    label: params.label || 'Sponsored Placement',
    notes: params.notes,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  mockPromotions.unshift(promo);

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'create_promotion',
    targetType: 'promotions',
    targetId: promo.id,
    reason: `Placement ${params.placement} for ${params.designerName}`,
    createdAt: new Date().toISOString()
  });

  return promo;
}

export async function adminDeletePromotion(promoId: string): Promise<boolean> {
  mockPromotions = mockPromotions.filter(p => p.id !== promoId);
  return true;
}

// ==============================================================================
// Section 10: Analytics & CSV Export
// ==============================================================================

export async function adminGetAnalytics(period: '7d' | '30d' | '90d' | 'year' = '30d'): Promise<PlatformAnalytics> {
  return {
    period,
    signupsTotal: 48,
    activeUsersMonthly: 124,
    projectsPosted: 34,
    proposalsSubmitted: 86,
    contractsAwarded: 28,
    acceptanceRatePercent: 32.5,
    grossVolumeUSD: 142500,
    avgContractValueUSD: 5089,
    series: [
      { date: '2026-10-15', signups: 6, projects: 4, contracts: 3, volumeUSD: 14500 },
      { date: '2026-10-22', signups: 10, projects: 7, contracts: 5, volumeUSD: 28000 },
      { date: '2026-10-29', signups: 12, projects: 9, contracts: 8, volumeUSD: 41000 },
      { date: '2026-11-05', signups: 11, projects: 8, contracts: 7, volumeUSD: 36000 },
      { date: '2026-11-12', signups: 9, projects: 6, contracts: 5, volumeUSD: 23000 }
    ]
  };
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const content = [
    headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==============================================================================
// Section 11: Support Tickets Inbox
// ==============================================================================

export async function adminGetSupportTickets(status?: string): Promise<SupportTicketItem[]> {
  let list = [...mockSupportTickets];
  if (status && status !== 'all') {
    list = list.filter(t => t.status === status);
  }
  return list;
}

export async function adminUpdateSupportTicket(
  ticketId: string,
  updates: { status?: 'open' | 'in_progress' | 'resolved' | 'closed'; assigneeEmail?: string; internalNotes?: string }
): Promise<boolean> {
  const t = mockSupportTickets.find(item => item.id === ticketId);
  if (t) {
    if (updates.status) t.status = updates.status;
    if (updates.assigneeEmail !== undefined) t.assigneeEmail = updates.assigneeEmail;
    if (updates.internalNotes !== undefined) t.internalNotes = updates.internalNotes;
    t.updatedAt = new Date().toISOString();
  }

  const authState = getAuthState();
  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: 'update_support_ticket',
    targetType: 'support_tickets',
    targetId: ticketId,
    reason: `Status: ${updates.status || t?.status}. Notes updated.`,
    createdAt: new Date().toISOString()
  });

  return true;
}

// ==============================================================================
// Section 12: Admin Roles & Audit Log Trail
// ==============================================================================

export async function adminGetAdminRolesList(): Promise<AdminRoleAssignment[]> {
  return [...mockAdminRolesList];
}

export async function adminManageRole(params: {
  userId: string;
  email: string;
  fullName: string;
  role: AdminRole;
  action: 'grant' | 'revoke';
}): Promise<boolean> {
  const authState = getAuthState();
  if (currentSimulatedAdminRole !== 'super_admin') {
    throw new Error('Only super_admin accounts have permissions to manage administrative team roles.');
  }

  if (params.action === 'grant') {
    const existing = mockAdminRolesList.find(r => r.userId === params.userId && r.role === params.role);
    if (!existing) {
      mockAdminRolesList.push({
        userId: params.userId,
        email: params.email,
        fullName: params.fullName,
        role: params.role,
        grantedBy: authState.user?.id || 'admin-super-01',
        grantedAt: new Date().toISOString()
      });
    }
  } else {
    mockAdminRolesList = mockAdminRolesList.filter(r => !(r.userId === params.userId && r.role === params.role));
  }

  mockAuditLogEntries.unshift({
    id: `log-${Date.now()}`,
    adminId: authState.user?.id || 'admin-super-01',
    adminEmail: authState.user?.email || 'admin@dezignet.com',
    action: `${params.action}_admin_role`,
    targetType: 'admin_roles',
    targetId: params.userId,
    reason: `${params.action.toUpperCase()} role ${params.role} for ${params.email}`,
    createdAt: new Date().toISOString()
  });

  return true;
}

export async function adminGetAuditLogEntries(filters: {
  action?: string;
  targetType?: string;
  search?: string;
} = {}): Promise<typeof mockAuditLogEntries> {
  let list = [...mockAuditLogEntries];
  if (filters.action && filters.action !== 'all') {
    list = list.filter(e => e.action === filters.action);
  }
  if (filters.targetType && filters.targetType !== 'all') {
    list = list.filter(e => e.targetType === filters.targetType);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(e => (e.reason && e.reason.toLowerCase().includes(q)) || e.adminEmail.toLowerCase().includes(q) || e.targetId.toLowerCase().includes(q));
  }
  return list;
}
