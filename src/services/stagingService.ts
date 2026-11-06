/**
 * Staging & Tester Service Layer for Dezignet
 * Handles environment detection, tester status, dev/staging test controls,
 * and in-app feedback submission.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import { getAuthState } from './authService';

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface FeedbackSubmissionPayload {
  type: 'broken' | 'confusing' | 'change' | 'missing';
  severity: 'blocker' | 'annoying' | 'minor';
  message: string;
  screenshotPath?: string | null;
  context?: Record<string, any>;
}

export interface FastForwardResult {
  success: boolean;
  days_shifted: number;
  milestones_shifted: number;
  submissions_shifted: number;
  auto_approved: number;
  payouts_released: number;
}

/**
 * Returns the current active deployment environment
 */
export async function getEnvironment(): Promise<AppEnvironment> {
  // Vite env flag takes precedence if defined
  const metaEnv = (import.meta as any).env?.VITE_APP_ENV;
  if (metaEnv === 'production' || metaEnv === 'staging' || metaEnv === 'development') {
    return metaEnv;
  }

  if (USE_MOCKS.projects || (typeof localStorage !== 'undefined' && (localStorage.getItem('dezignet_mock_auth') === 'true' || Boolean(localStorage.getItem('dezignet_mock_role'))))) {
    return 'staging';
  }

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'environment')
      .maybeSingle();

    if (error || !data) {
      return (import.meta as any).env?.PROD ? 'production' : 'staging';
    }

    const rawVal = typeof data.value === 'string' ? data.value : (data.value as any)?.replace?.(/"/g, '') || data.value;
    return (rawVal as AppEnvironment) || 'staging';
  } catch {
    return 'staging';
  }
}

/**
 * Checks whether the current authenticated user has tester privileges
 */
export async function isTester(): Promise<boolean> {
  const authState = getAuthState();
  if (!authState.user) return false;
  if (authState.role === 'admin') return true;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_tester')
      .eq('id', authState.user.id)
      .maybeSingle();

    if (error || !data) return false;
    return !!(data as any).is_tester;
  } catch {
    return false;
  }
}

/**
 * Fast-forward milestones and submissions by N days (allowed in dev and staging only)
 */
export async function devFastForward(days: number, engagementId?: string): Promise<FastForwardResult> {
  if (USE_MOCKS.active_work) {
    return {
      success: true,
      days_shifted: days,
      milestones_shifted: 1,
      submissions_shifted: 1,
      auto_approved: days >= 5 ? 1 : 0,
      payouts_released: days >= 5 ? 1 : 0
    };
  }

  const { data, error } = await (supabase.rpc as any)('dev_fast_forward', {
    p_days: days,
    p_engagement_id: engagementId || null
  });

  if (error) {
    throw new Error(error.message || 'Fast forward failed.');
  }

  return data as FastForwardResult;
}

/**
 * Simulates a client chat message in the given conversation (staging/dev only)
 */
export async function devSimulateMessage(conversationId: string, body: string): Promise<any> {
  if (USE_MOCKS.conversations) {
    return { success: true, conversation_id: conversationId, message_id: 'mock-sim-msg-' + Date.now() };
  }

  const { data, error } = await (supabase.rpc as any)('dev_simulate_message', {
    p_conversation_id: conversationId,
    p_body: body
  });

  if (error) {
    throw new Error(error.message || 'Simulate message failed.');
  }

  return data;
}

/**
 * Simulates a test notification for the user (staging/dev only)
 */
export async function devSimulateNotification(
  userId: string,
  title: string,
  body: string,
  type = 'system_announcement'
): Promise<any> {
  if (USE_MOCKS.notifications) {
    return { success: true, notification_id: 'mock-notif-' + Date.now() };
  }

  const { data, error } = await (supabase.rpc as any)('dev_simulate_notification', {
    p_user_id: userId,
    p_title: title,
    p_body: body,
    p_type: type
  });

  if (error) {
    throw new Error(error.message || 'Simulate notification failed.');
  }

  return data;
}

/**
 * Submits tester feedback to the database with attached context
 */
export async function submitFeedback(payload: FeedbackSubmissionPayload): Promise<{ success: boolean; feedback_id: string }> {
  if (USE_MOCKS.projects) {
    return { success: true, feedback_id: 'mock-fb-' + Date.now() };
  }

  const { data, error } = await (supabase.rpc as any)('submit_feedback', {
    p_type: payload.type,
    p_severity: payload.severity,
    p_message: payload.message,
    p_screenshot_path: payload.screenshotPath || null,
    p_context: payload.context || {}
  });

  if (error) {
    throw new Error(error.message || 'Failed to submit feedback.');
  }

  return data as { success: boolean; feedback_id: string };
}

