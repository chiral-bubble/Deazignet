/**
 * Admin Service Layer for Dezignet
 * Security Definer RPC wrappers for Feedback Review, Credential Verification,
 * Reference Data Editing (Categories, Phase Templates, App Settings),
 * and Admin Audit Logs.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';

export interface AdminFeedbackItem {
  id: string;
  author_id: string | null;
  author_name: string | null;
  author_email: string | null;
  type: 'broken' | 'confusing' | 'change' | 'missing';
  severity: 'blocker' | 'annoying' | 'minor';
  message: string;
  screenshot_path: string | null;
  context: Record<string, any>;
  status: 'new' | 'seen' | 'planned' | 'fixed' | 'wont_fix';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminPendingCredential {
  id: string;
  designer_id: string;
  designer_name: string;
  designer_email: string;
  body_name: string;
  license_number: string;
  state_region: string;
  verification_year: number;
  certificate_path: string;
  status: string;
  submitted_at: string;
}

export interface AdminAuditLogItem {
  id: string;
  admin_id: string;
  admin_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  before_state: any;
  after_state: any;
  created_at: string;
}

/**
 * Retrieves feedback items for administrative review
 */
export async function adminGetFeedback(filters: {
  status?: string;
  type?: string;
  severity?: string;
} = {}): Promise<AdminFeedbackItem[]> {
  if (USE_MOCKS.projects) {
    return [
      {
        id: 'mock-fb-1',
        author_id: 'mock-user-1',
        author_name: 'Marcus Vance, AIA',
        author_email: 'partner.architect@dezignet.com',
        type: 'change',
        severity: 'minor',
        message: 'The billing triggers on Construction Documents should explicitly mention municipal building department permit filing.',
        screenshot_path: null,
        context: { route: '/projects', browser: 'Chrome 122', viewport: '1440x900' },
        status: 'new',
        admin_notes: null,
        created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        updated_at: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ];
  }

  const { data, error } = await (supabase.rpc as any)('admin_get_feedback', {
    p_status: filters.status || 'all',
    p_type: filters.type || 'all',
    p_severity: filters.severity || 'all'
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch feedback.');
  }

  return (data as AdminFeedbackItem[]) || [];
}

/**
 * Updates feedback status and admin internal note
 */
export async function adminUpdateFeedbackStatus(
  feedbackId: string,
  status: string,
  notes?: string
): Promise<void> {
  if (USE_MOCKS.projects) return;

  const { error } = await (supabase.rpc as any)('admin_update_feedback_status', {
    p_feedback_id: feedbackId,
    p_status: status,
    p_notes: notes || null
  });

  if (error) {
    throw new Error(error.message || 'Failed to update feedback.');
  }
}

/**
 * Retrieves pending designer credentials awaiting verification
 */
export async function adminGetPendingCredentials(): Promise<AdminPendingCredential[]> {
  if (USE_MOCKS.profiles) {
    return [
      {
        id: 'mock-cred-1',
        designer_id: 'mock-des-1',
        designer_name: 'Marcus Vance, AIA',
        designer_email: 'partner.architect@dezignet.com',
        body_name: 'National Council of Architectural Registration Boards (NCARB)',
        license_number: 'NCARB-78921 / TBAE-24180',
        state_region: 'Texas',
        verification_year: 2017,
        certificate_path: '/assets/demo/sample-schematic.svg',
        status: 'pending',
        submitted_at: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    ];
  }

  const { data, error } = await (supabase.rpc as any)('admin_get_pending_credentials');
  if (error) {
    throw new Error(error.message || 'Failed to fetch credentials.');
  }

  return (data as AdminPendingCredential[]) || [];
}

/**
 * Approves or rejects a designer's credential submission
 */
export async function adminReviewCredential(
  credentialId: string,
  decision: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<void> {
  if (USE_MOCKS.profiles) return;

  const { error } = await (supabase.rpc as any)('admin_review_credential', {
    p_credential_id: credentialId,
    p_decision: decision,
    p_rejection_reason: rejectionReason || null
  });

  if (error) {
    throw new Error(error.message || 'Failed to review credential.');
  }
}

/**
 * Admin: Add or rename reference categories / subcategories
 */
export async function adminUpdateCategory(
  action: 'add_category' | 'rename_category' | 'add_subcategory' | 'rename_subcategory',
  targetId?: string,
  data?: any
): Promise<any> {
  if (USE_MOCKS.projects) return { success: true };

  const { data: result, error } = await (supabase.rpc as any)('admin_update_reference_category', {
    p_action: action,
    p_target_id: targetId || null,
    p_data: data || {}
  });

  if (error) {
    throw new Error(error.message || 'Failed to update category.');
  }

  return result;
}

/**
 * Admin: Update milestone phase template parameters and recommended splits
 */
export async function adminUpdatePhaseTemplate(
  action: 'update',
  templateId: string,
  data: any
): Promise<any> {
  if (USE_MOCKS.projects) return { success: true };

  const { data: result, error } = await (supabase.rpc as any)('admin_update_phase_template', {
    p_action: action,
    p_template_id: templateId,
    p_data: data
  });

  if (error) {
    throw new Error(error.message || 'Failed to update template.');
  }

  return result;
}

/**
 * Admin: Update operational app setting value
 */
export async function adminUpdateAppSetting(
  key: string,
  value: any,
  description?: string
): Promise<any> {
  if (USE_MOCKS.projects) return { success: true };

  const { data: result, error } = await (supabase.rpc as any)('admin_update_app_setting', {
    p_key: key,
    p_value: typeof value === 'object' ? value : JSON.stringify(value),
    p_description: description || null
  });

  if (error) {
    throw new Error(error.message || 'Failed to update setting.');
  }

  return result;
}

/**
 * Admin: Marks a test user account email as verified
 */
export async function adminVerifyUserEmail(userId: string): Promise<void> {
  if (USE_MOCKS.auth) return;

  const { error } = await (supabase.rpc as any)('admin_verify_user_email', {
    p_user_id: userId
  });

  if (error) {
    throw new Error(error.message || 'Failed to verify email.');
  }
}

/**
 * Retrieves the audit log of all administrative actions
 */
export async function adminGetAuditLogs(): Promise<AdminAuditLogItem[]> {
  if (USE_MOCKS.projects) {
    return [
      {
        id: 'mock-audit-1',
        admin_id: 'admin-uuid',
        admin_email: 'admin@dezignet.com',
        action: 'review_credential',
        target_type: 'designer_credentials',
        target_id: 'mock-cred-1',
        before_state: { status: 'pending' },
        after_state: { decision: 'approved' },
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  }

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || 'Failed to fetch audit log.');
  }

  return (data as AdminAuditLogItem[]) || [];
}

export const adminGetAuditLog = adminGetAuditLogs;

