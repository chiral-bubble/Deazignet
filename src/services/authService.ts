/**
 * Authentication Service for Dezignet (Phase 1)
 * Powered by Supabase Auth and database-enforced Profile Roles
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import type { UserRole } from '../types/database.types';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl?: string;
  onboardingCompleted?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  session: any | null;
  isLoading: boolean;
  role: UserRole | null;
  onboardingCompleted: boolean;
}

let currentAuthState: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  role: null,
  onboardingCompleted: true
};

type AuthListener = (state: AuthState) => void;
const listeners = new Set<AuthListener>();

export function getAuthState(): AuthState {
  return currentAuthState;
}

export function subscribeToAuth(listener: AuthListener): () => void {
  listeners.add(listener);
  listener(currentAuthState);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((fn) => fn(currentAuthState));
}

/**
 * Validates redirect / next URL safely against open redirect attacks
 * Only relative paths starting with a single '/' are accepted.
 */
export function safeNextPath(path?: string | null): string {
  if (!path) return '';
  const trimmed = path.trim();
  // Must start with '/' and not '//' (protocol-relative), and not contain scheme (e.g. javascript:, http:)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes(':')) {
    return trimmed;
  }
  return '';
}

/**
 * Fetch profile role and onboarding status directly from the database profiles table.
 * Never trusts user-editable client metadata.
 */
export async function fetchUserRole(userId: string): Promise<{
  role: UserRole;
  fullName: string;
  onboardingCompleted: boolean;
} | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, full_name, onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.warn('Failed to load profile role:', error);
      return null;
    }

    const row = data as { role: UserRole; full_name: string; onboarding_completed_at?: string | null };
    return {
      role: row.role || 'client',
      fullName: row.full_name || '',
      onboardingCompleted: !!row.onboarding_completed_at
    };
  } catch (err) {
    console.error('Error fetching user role:', err);
    return null;
  }
}

/**
 * Initialize Supabase Auth Session and subscribe to state changes
 */
export async function initAuth(): Promise<AuthState> {
  if (USE_MOCKS.auth) {
    // Mock user fallback
    currentAuthState = {
      user: {
        id: 'des-alexandre',
        email: 'alexandre.sterling@dezignet.studio',
        fullName: 'Alexandre Sterling',
        role: 'designer',
        onboardingCompleted: true
      },
      session: { mock: true },
      isLoading: false,
      role: 'designer',
      onboardingCompleted: true
    };
    notifyListeners();
    return currentAuthState;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const profile = await fetchUserRole(session.user.id);
      currentAuthState = {
        user: {
          id: session.user.id,
          email: session.user.email || '',
          fullName: profile?.fullName || session.user.user_metadata?.full_name || 'User',
          role: profile?.role || 'client',
          onboardingCompleted: profile?.onboardingCompleted ?? false
        },
        session,
        isLoading: false,
        role: profile?.role || 'client',
        onboardingCompleted: profile?.onboardingCompleted ?? false
      };
    } else {
      currentAuthState = {
        user: null,
        session: null,
        isLoading: false,
        role: null,
        onboardingCompleted: true
      };
    }
  } catch (err) {
    console.error('Auth initialization error:', err);
    currentAuthState = {
      user: null,
      session: null,
      isLoading: false,
      role: null,
      onboardingCompleted: true
    };
  }

  notifyListeners();

  // Listen to Supabase auth state transitions
  supabase.auth.onAuthStateChange(async (event, session) => {
    // 1. If this is a background token refresh or tab focus for the same user, preserve session quietly
    if (event === 'TOKEN_REFRESHED' && currentAuthState.user && session?.user?.id === currentAuthState.user.id) {
      currentAuthState.session = session;
      return;
    }

    // 2. If SIGNED_IN event fires repeatedly for the same user without identity change, do not notify/remount
    if (event === 'SIGNED_IN' && currentAuthState.user && session?.user?.id === currentAuthState.user.id) {
      currentAuthState.session = session;
      return;
    }

    if (session?.user) {
      const profile = await fetchUserRole(session.user.id);
      currentAuthState = {
        user: {
          id: session.user.id,
          email: session.user.email || '',
          fullName: profile?.fullName || session.user.user_metadata?.full_name || 'User',
          role: profile?.role || 'client',
          onboardingCompleted: profile?.onboardingCompleted ?? false
        },
        session,
        isLoading: false,
        role: profile?.role || 'client',
        onboardingCompleted: profile?.onboardingCompleted ?? false
      };
    } else {
      currentAuthState = {
        user: null,
        session: null,
        isLoading: false,
        role: null,
        onboardingCompleted: true
      };
    }
    notifyListeners();
  });

  return currentAuthState;
}

export interface SignUpParams {
  role: 'designer' | 'client';
  fullName: string;
  email: string;
  password: string;
  accountType?: 'individual' | 'company';
  companyName?: string;
  termsAccepted: boolean;
  termsVersion?: string;
}

export type AuthErrorCode =
  | 'terms_required'
  | 'weak_password'
  | 'invalid_role'
  | 'email_taken'
  | 'invalid_credentials'
  | 'email_not_verified'
  | 'rate_limited'
  | 'link_expired'
  | 'network_error';

/**
 * Sign up with Email, Password, Full Name, Terms Acceptance and Role whitelist
 */
export async function signUp(params: SignUpParams): Promise<{
  success: boolean;
  requiresConfirmation?: boolean;
  error?: string;
  code?: AuthErrorCode;
}> {
  const { email, password, fullName, role, accountType, companyName, termsAccepted, termsVersion = '2026.1' } = params;

  if (!termsAccepted) {
    return {
      success: false,
      error: 'You must agree to the Terms of Service and Privacy Policy to proceed.',
      code: 'terms_required'
    };
  }

  if (!email || !password || !fullName) {
    return { success: false, error: 'All fields are required.' };
  }

  if (role !== 'designer' && role !== 'client') {
    return { success: false, error: 'Invalid account type.', code: 'invalid_role' };
  }

  if (password.length < 8) {
    return {
      success: false,
      error: 'Password must be at least 8 characters with a mix of letters, numbers, and symbols.',
      code: 'weak_password'
    };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role,
          account_type: accountType || 'individual',
          company_name: companyName ? companyName.trim() : null,
          terms_accepted_at: new Date().toISOString(),
          terms_version: termsVersion
        }
      }
    });

    if (error) {
      if (error.message.toLowerCase().includes('already registered')) {
        return {
          success: false,
          error: 'An account with this email address already exists. Please log in or reset your password.',
          code: 'email_taken'
        };
      }
      if (error.status === 429 || error.message.toLowerCase().includes('rate')) {
        return {
          success: false,
          error: 'Too many requests. Please wait a few moments and try again.',
          code: 'rate_limited'
        };
      }
      return { success: false, error: error.message };
    }

    const requiresConfirmation = !data.session;
    return { success: true, requiresConfirmation };
  } catch (err: any) {
    return { success: false, error: err.message || 'Registration failed.' };
  }
}

/**
 * Log in with Email and Password
 * Returns neutral error if invalid; detects unverified emails
 */
export async function logIn(
  email: string,
  pass: string
): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
  code?: AuthErrorCode;
  isUnverified?: boolean;
}> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('email not confirmed')) {
        return {
          success: false,
          error: 'Please verify your email address to log in.',
          isUnverified: true,
          code: 'email_not_verified'
        };
      }
      if (error.status === 429 || msg.includes('rate limit')) {
        return {
          success: false,
          error: 'Too many attempts. Please try again in a few minutes.',
          code: 'rate_limited'
        };
      }
      // Neutral message to prevent user enumeration
      return {
        success: false,
        error: 'Incorrect email or password.',
        code: 'invalid_credentials'
      };
    }

    if (!data.user) {
      return { success: false, error: 'Incorrect email or password.', code: 'invalid_credentials' };
    }

    const profile = await fetchUserRole(data.user.id);
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email || '',
      fullName: profile?.fullName || data.user.user_metadata?.full_name || 'User',
      role: profile?.role || 'client',
      onboardingCompleted: profile?.onboardingCompleted ?? false
    };

    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: 'Unable to connect. Please check your network and try again.' };
  }
}

export const signIn = logIn;

/**
 * Resend verification email
 */
export async function resendVerification(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase()
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resend verification email.' };
  }
}

/**
 * Request password reset email (Neutral confirmation in all cases)
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectUrl = `${window.location.origin}/#reset-password`;
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl
    });
    // Always return success for user privacy
    return { success: true };
  } catch (err: any) {
    return { success: true }; // neutral
  }
}

/**
 * Update password from recovery link
 */
export async function updatePasswordFromRecovery(newPass: string): Promise<{ success: boolean; error?: string; code?: AuthErrorCode }> {
  if (newPass.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.', code: 'weak_password' };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPass
    });

    if (error) {
      if (error.message.toLowerCase().includes('expired')) {
        return { success: false, error: 'Password reset link has expired or has already been used.', code: 'link_expired' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Password update failed.' };
  }
}

/**
 * Save onboarding step
 */
export async function saveOnboardingStep(role: string, step: number, data: any): Promise<{ success: boolean; error?: string }> {
  if (USE_MOCKS.auth) {
    return { success: true };
  }

  try {
    const { error } = await supabase.rpc('save_onboarding_step', {
      p_role: role,
      p_step: step,
      p_data: data
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save onboarding data.' };
  }
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(role: string, data: any = {}): Promise<{ success: boolean; error?: string }> {
  if (USE_MOCKS.auth) {
    if (currentAuthState.user) {
      currentAuthState.user.onboardingCompleted = true;
      currentAuthState.onboardingCompleted = true;
      notifyListeners();
    }
    return { success: true };
  }

  try {
    const { error } = await supabase.rpc('complete_onboarding', {
      p_role: role,
      p_data: data
    });
    if (error) return { success: false, error: error.message };

    if (currentAuthState.user) {
      currentAuthState.user.onboardingCompleted = true;
      currentAuthState.onboardingCompleted = true;
      notifyListeners();
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to complete onboarding.' };
  }
}

/**
 * Get session state snapshot
 */
export function getSessionState(): AuthState {
  return currentAuthState;
}

/**
 * Log out
 */
export async function logOut(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Sign out error:', err);
  } finally {
    currentAuthState = {
      user: null,
      session: null,
      isLoading: false,
      role: null,
      onboardingCompleted: true
    };
    notifyListeners();
  }
}

/**
 * Request password reset email
 */
export async function sendPasswordResetEmail(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectUrl = `${window.location.origin}/#reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to send reset email.' };
  }
}

/**
 * Set new password (e.g. from reset password link)
 */
export async function resetPassword(
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  if (newPass.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPass
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Password update failed.' };
  }
}

/**
 * Change password in Profile Settings — Requires current password verification
 */
export async function changePasswordWithVerification(
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  if (USE_MOCKS.auth) {
    if (newPass.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }
    return { success: true };
  }

  const user = currentAuthState.user;
  if (!user || !user.email) {
    return { success: false, error: 'You must be signed in to change your password.' };
  }
  if (!currentPass) {
    return { success: false, error: 'Please enter your current password.' };
  }
  if (newPass.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }

  try {
    // 1. Verify current password
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPass
    });

    if (signInErr) {
      return { success: false, error: 'Current password does not match our records.' };
    }

    // 2. Apply new password
    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPass
    });

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Password change failed.' };
  }
}
