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

import {
  getPlans,
  getPlanFeeTiers,
  updateMockPlan,
  updateMockFeeTiers,
  type Plan,
  type PlanFeeTier
} from './plansService';
import { getAllMockDesigners } from './designerProfileService';
import { getProjects, getProject, type Project } from './projectsService';

export interface AdminMatchingSettings {
  matching_weights: {
    specialization_match: number;
    subcategory_portfolio: number;
    same_city: number;
    same_state: number;
    verified: number;
    rating: number;
    completed_projects: number;
  };
  matching_plan_boost: {
    free: number;
    basic: number;
    upgraded: number;
  };
  matching_new_designer_boost: number;
  insurance_section_enabled: boolean;
  priority_label_mode: 'label' | 'hidden';
  fee_tier_mode: 'whole_amount' | 'marginal';
  fee_basis: 'per_milestone' | 'cumulative';
}

export interface AdminSuggestedDesigner {
  designer_id: string;
  full_name: string;
  avatar_path: string | null;
  discipline: string;
  title: string;
  studio_name: string;
  city: string;
  state: string;
  years_experience: number;
  hourly_rate: number | null;
  rating_average: number;
  rating_count: number;
  completed_projects_count: number;
  is_verified: boolean;
  plan_key: 'free' | 'basic' | 'upgraded';
  match_score: number;
  plan_boost: number;
  reasons: Array<{ type: string; text: string }>;
  score_breakdown: Record<string, number>;
}

// In-memory working copy for audit logs
const mockAuditLogs: AdminAuditLogItem[] = [
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

// In-memory matching and fee calculation settings
let mockMatchingSettings: AdminMatchingSettings = {
  matching_weights: {
    specialization_match: 35,
    subcategory_portfolio: 15,
    same_city: 15,
    same_state: 10,
    verified: 10,
    rating: 10,
    completed_projects: 5
  },
  matching_plan_boost: {
    free: 0,
    basic: 5,
    upgraded: 15
  },
  matching_new_designer_boost: 5,
  insurance_section_enabled: false,
  priority_label_mode: 'label',
  fee_tier_mode: 'whole_amount',
  fee_basis: 'per_milestone'
};

/**
 * Persists an entry to admin_audit_log
 */
export async function adminRecordAuditLog(
  action: string,
  targetType: string,
  targetId: string | null,
  beforeState: any,
  afterState: any
): Promise<void> {
  const newEntry: AdminAuditLogItem = {
    id: 'audit-' + Math.random().toString(36).substring(2, 9),
    admin_id: 'admin-uuid',
    admin_email: 'admin@dezignet.com',
    action,
    target_type: targetType,
    target_id: targetId,
    before_state: beforeState,
    after_state: afterState,
    created_at: new Date().toISOString()
  };

  mockAuditLogs.unshift(newEntry);

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.rpc as any)('log_admin_action', {
        p_action: action,
        p_target_type: targetType,
        p_target_id: targetId || '',
        p_before: beforeState,
        p_after: afterState
      });
    } catch {
      try {
        await supabase.from('admin_audit_log').insert({
          admin_id: '00000000-0000-0000-0000-000000000000',
          admin_email: 'admin@dezignet.com',
          action,
          target_type: targetType,
          target_id: targetId,
          before_state: beforeState,
          after_state: afterState
        });
      } catch (e) {
        console.warn('Could not persist audit log to DB, kept in-memory:', e);
      }
    }
  }
}

/**
 * Retrieves the audit log of all administrative actions
 */
export async function adminGetAuditLogs(): Promise<AdminAuditLogItem[]> {
  if (USE_MOCKS.projects) {
    return JSON.parse(JSON.stringify(mockAuditLogs));
  }

  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      return JSON.parse(JSON.stringify(mockAuditLogs));
    }

    return data as AdminAuditLogItem[];
  } catch {
    return JSON.parse(JSON.stringify(mockAuditLogs));
  }
}

export const adminGetAuditLog = adminGetAuditLogs;

/**
 * Admin: Get all Membership Plans
 */
export async function adminGetPlans(): Promise<Plan[]> {
  return getPlans();
}

/**
 * Admin: Update a Membership Plan and record in audit log
 */
export async function adminUpdatePlan(
  planKey: string,
  updates: Partial<Plan>
): Promise<Plan> {
  const currentPlans = await getPlans();
  const before = currentPlans.find(p => p.key === planKey);

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.from as any)('plans')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('key', planKey);
    } catch (e) {
      console.warn('DB update failed, falling back to mock update:', e);
    }
  }

  const updated = updateMockPlan(planKey, updates);

  await adminRecordAuditLog(
    'update_membership_plan',
    'plans',
    planKey,
    before,
    updated
  );

  return updated;
}

/**
 * Admin: Get all Plan Fee Tiers
 */
export async function adminGetFeeTiers(): Promise<PlanFeeTier[]> {
  return getPlanFeeTiers();
}

/**
 * Admin: Update Fee Tiers for a Plan with validation and audit logging
 */
export async function adminUpdateFeeTiers(
  planKey: 'free' | 'basic' | 'upgraded',
  tiers: Array<{ from_amount_cents: number; rate_percent: number; sort_order?: number }>
): Promise<PlanFeeTier[]> {
  if (!tiers || tiers.length === 0) {
    throw new Error('Fee tiers must contain at least one tier starting at $0.');
  }

  const sorted = [...tiers].sort((a, b) => a.from_amount_cents - b.from_amount_cents);

  if (sorted[0].from_amount_cents !== 0) {
    throw new Error('Base tier must start at 0 threshold ($0).');
  }

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (t.rate_percent < 0 || t.rate_percent > 100) {
      throw new Error(`Rate percent must be between 0% and 100% (found ${t.rate_percent}%).`);
    }
    if (i > 0 && t.from_amount_cents <= sorted[i - 1].from_amount_cents) {
      throw new Error(`Thresholds must be strictly ascending (found $${t.from_amount_cents / 100} after $${sorted[i - 1].from_amount_cents / 100}).`);
    }
  }

  const beforeTiers = (await getPlanFeeTiers()).filter(t => t.plan_key === planKey);

  if (!USE_MOCKS.projects) {
    try {
      await (supabase.from as any)('plan_fee_tiers')
        .delete()
        .eq('plan_key', planKey);

      await (supabase.from as any)('plan_fee_tiers')
        .insert(
          sorted.map((t, idx) => ({
            plan_key: planKey,
            from_amount_cents: t.from_amount_cents,
            rate_percent: t.rate_percent,
            sort_order: idx + 1
          }))
        );
    } catch (e) {
      console.warn('DB fee tiers update failed, falling back:', e);
    }
  }

  const savedTiers = updateMockFeeTiers(planKey, sorted);

  await adminRecordAuditLog(
    'update_plan_fee_tiers',
    'plan_fee_tiers',
    planKey,
    beforeTiers,
    savedTiers
  );

  return savedTiers;
}

/**
 * Admin: Get current matching & fee calculation settings
 */
export async function adminGetMatchingSettings(): Promise<AdminMatchingSettings> {
  if (!USE_MOCKS.projects) {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'matching_weights',
          'matching_plan_boost',
          'matching_new_designer_boost',
          'insurance_section_enabled',
          'priority_label_mode',
          'fee_tier_mode',
          'fee_basis'
        ]);

      if (!error && data && data.length > 0) {
        data.forEach(item => {
          try {
            if (item.key === 'matching_weights') {
              mockMatchingSettings.matching_weights = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            } else if (item.key === 'matching_plan_boost') {
              mockMatchingSettings.matching_plan_boost = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
            } else if (item.key === 'matching_new_designer_boost') {
              mockMatchingSettings.matching_new_designer_boost = parseInt(String(item.value), 10) || 5;
            } else if (item.key === 'insurance_section_enabled') {
              mockMatchingSettings.insurance_section_enabled = item.value === 'true' || item.value === true;
            } else if (item.key === 'priority_label_mode') {
              mockMatchingSettings.priority_label_mode = item.value as any;
            } else if (item.key === 'fee_tier_mode') {
              mockMatchingSettings.fee_tier_mode = item.value as any;
            } else if (item.key === 'fee_basis') {
              mockMatchingSettings.fee_basis = item.value as any;
            }
          } catch {}
        });
      }
    } catch (e) {
      console.warn('Failed to fetch app settings from DB:', e);
    }
  }

  return JSON.parse(JSON.stringify(mockMatchingSettings));
}

/**
 * Admin: Update matching and fee calculation settings with audit logging
 */
export async function adminUpdateMatchingSettings(
  settings: Partial<AdminMatchingSettings>
): Promise<AdminMatchingSettings> {
  const before = JSON.parse(JSON.stringify(mockMatchingSettings));

  Object.assign(mockMatchingSettings, settings);

  if (!USE_MOCKS.projects) {
    try {
      if (settings.matching_weights) {
        await adminUpdateAppSetting('matching_weights', JSON.stringify(settings.matching_weights));
      }
      if (settings.matching_plan_boost) {
        await adminUpdateAppSetting('matching_plan_boost', JSON.stringify(settings.matching_plan_boost));
      }
      if (settings.matching_new_designer_boost !== undefined) {
        await adminUpdateAppSetting('matching_new_designer_boost', String(settings.matching_new_designer_boost));
      }
      if (settings.insurance_section_enabled !== undefined) {
        await adminUpdateAppSetting('insurance_section_enabled', String(settings.insurance_section_enabled));
      }
      if (settings.priority_label_mode) {
        await adminUpdateAppSetting('priority_label_mode', settings.priority_label_mode);
      }
      if (settings.fee_tier_mode) {
        await adminUpdateAppSetting('fee_tier_mode', settings.fee_tier_mode);
      }
      if (settings.fee_basis) {
        await adminUpdateAppSetting('fee_basis', settings.fee_basis);
      }
    } catch (e) {
      console.warn('DB settings update failed, falling back:', e);
    }
  }

  await adminRecordAuditLog(
    'update_matching_settings',
    'app_settings',
    'matching',
    before,
    mockMatchingSettings
  );

  return JSON.parse(JSON.stringify(mockMatchingSettings));
}

/**
 * Admin: Read-only Suggestion Tester preview
 * Selects an open project and returns top 20 suggested designers with scores, breakdown reasons, and plan boosts
 */
export async function adminTestSuggestions(projectId: string): Promise<AdminSuggestedDesigner[]> {
  const settings = await adminGetMatchingSettings();
  const weights = settings.matching_weights;
  const planBoosts = settings.matching_plan_boost;

  // Try RPC if not mocks
  if (!USE_MOCKS.projects) {
    try {
      const { data, error } = await (supabase.rpc as any)('suggest_designers', {
        p_project_id: projectId,
        p_limit: 20
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => {
          const planKey = (item.plan_key || 'free') as 'free' | 'basic' | 'upgraded';
          const boost = planBoosts[planKey] || 0;
          return {
            designer_id: item.designer_id,
            full_name: item.full_name,
            avatar_path: item.avatar_path,
            discipline: item.discipline || 'Architect',
            title: item.title || 'Architect',
            studio_name: item.studio_name || '',
            city: item.city || '',
            state: item.state || '',
            years_experience: item.years_experience || 0,
            hourly_rate: item.hourly_rate ?? null,
            rating_average: item.rating_average || 0,
            rating_count: item.rating_count || 0,
            completed_projects_count: item.completed_projects_count || 0,
            is_verified: Boolean(item.is_verified),
            plan_key: planKey,
            match_score: item.match_score || 0,
            plan_boost: boost,
            reasons: Array.isArray(item.reasons) ? item.reasons : [],
            score_breakdown: item.score_breakdown || {}
          };
        });
      }
    } catch (e) {
      console.warn('RPC suggest_designers failed, computing client-side simulation:', e);
    }
  }

  // Lookup target project details
  const projects = await getProjects();
  let project: any = projects.find((p: Project) => p.id === projectId);
  if (!project) {
    project = await getProject(projectId);
  }

  const projectCategory = project?.category || 'Residential';
  const projectState = project?.state || project?.location?.split(',')[1]?.trim() || 'California';
  const projectCity = project?.city || project?.location?.split(',')[0]?.trim() || '';

  const allDesigners = getAllMockDesigners();

  const scoredList: AdminSuggestedDesigner[] = allDesigners
    .map(d => {
      const planKey = (d.currentPlanId || 'free') as 'free' | 'basic' | 'upgraded';
      const planBoost = planBoosts[planKey] || 0;

      const matchesCategory = d.specializations.some(s =>
        s.toLowerCase().includes(projectCategory.toLowerCase()) ||
        projectCategory.toLowerCase().includes(s.toLowerCase())
      );
      const specScore = matchesCategory ? weights.specialization_match : 0;

      const subcatProjects = d.portfolio.filter(p =>
        p.category?.toLowerCase() === projectCategory.toLowerCase()
      ).length;
      const subcatScore = Math.min(subcatProjects * weights.subcategory_portfolio, 25);

      const sameCity = Boolean(projectCity && d.location.city.toLowerCase() === projectCity.toLowerCase());
      const cityScore = sameCity ? weights.same_city : 0;

      const sameState = Boolean(projectState && d.location.state?.toLowerCase() === projectState.toLowerCase());
      const stateScore = sameState && !sameCity ? weights.same_state : 0;

      const isVerified = (planKey === 'basic' || planKey === 'upgraded') && Boolean(d.credentials && d.credentials.some(c => c.status === 'verified'));
      const verifiedScore = isVerified ? weights.verified : 0;

      const ratingScore = d.stats.reviewCount >= 3
        ? Math.round((d.stats.averageRating / 5.0) * weights.rating)
        : 0;

      const completedScore = Math.min(Math.round((d.stats.projectsCompleted / 10.0) * weights.completed_projects), 5);

      const isNew = d.memberSince?.includes('2025') || d.memberSince?.includes('2026');
      const newBoostScore = isNew ? settings.matching_new_designer_boost : 0;

      const totalScore =
        specScore +
        subcatScore +
        cityScore +
        stateScore +
        verifiedScore +
        ratingScore +
        completedScore +
        newBoostScore +
        planBoost;

      const reasons: Array<{ type: string; text: string }> = [];
      if (matchesCategory) {
        reasons.push({ type: 'category', text: `Specializes in ${projectCategory} (+${specScore})` });
      }
      if (subcatScore > 0) {
        reasons.push({ type: 'portfolio', text: `${subcatProjects} ${projectCategory} portfolio project(s) (+${subcatScore})` });
      }
      if (isVerified) {
        reasons.push({ type: 'verified', text: `Verified credentials (+${verifiedScore})` });
      }
      if (sameCity) {
        reasons.push({ type: 'location', text: `Located in same city (${d.location.city}) (+${cityScore})` });
      } else if (sameState) {
        reasons.push({ type: 'location', text: `Located in same state (${d.location.state}) (+${stateScore})` });
      }
      if (sameCity) {
        reasons.push({ type: 'location', text: `Studio located in ${d.location.city} (+${cityScore})` });
      } else if (sameState) {
        reasons.push({ type: 'location', text: `Studio located in ${d.location.state} (+${stateScore})` });
      }
      if (isVerified) {
        reasons.push({ type: 'verified', text: `AIA/NCARB certified (+${verifiedScore})` });
      }
      if (ratingScore > 0) {
        reasons.push({ type: 'rating', text: `${d.stats.averageRating} avg rating (${d.stats.reviewCount} reviews) (+${ratingScore})` });
      }
      if (planBoost > 0) {
        reasons.push({ type: 'plan_boost', text: `${planKey.toUpperCase()} plan priority boost (+${planBoost})` });
      }
      if (newBoostScore > 0) {
        reasons.push({ type: 'new_designer', text: `New verified talent boost (+${newBoostScore})` });
      }

      return {
        designer_id: d.id,
        full_name: d.name,
        avatar_path: d.avatarUrl,
        discipline: d.professionalType,
        title: d.professionalTitle,
        studio_name: d.companyName || '',
        city: d.location.city,
        state: d.location.state || '',
        years_experience: d.yearsOfExperience,
        hourly_rate: (d.hourlyRate !== undefined ? d.hourlyRate : null) as number | null,
        rating_average: d.stats.averageRating,
        rating_count: d.stats.reviewCount,
        completed_projects_count: d.stats.projectsCompleted,
        is_verified: isVerified,
        plan_key: planKey,
        match_score: totalScore,
        plan_boost: planBoost,
        reasons,
        score_breakdown: {
          specialization: specScore,
          portfolio: subcatScore,
          location: cityScore + stateScore,
          verified: verifiedScore,
          rating: ratingScore,
          completed: completedScore,
          new_designer: newBoostScore,
          plan_boost: planBoost
        }
      };
    });

  scoredList.sort((a, b) => b.match_score - a.match_score);
  return scoredList.slice(0, 20);
}


