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
}

export interface AuthState {
  user: AuthUser | null;
  session: any | null;
  isLoading: boolean;
  role: UserRole | null;
}

let currentAuthState: AuthState = {
  user: null,
  session: null,
  isLoading: true,
  role: null
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
 * Fetch profile role directly from the database profiles table.
 * Never trusts user-editable client metadata.
 */
export async function fetchUserRole(userId: string): Promise<{ role: UserRole; fullName: string } | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.warn('Failed to load profile role:', error);
      return null;
    }

    const row = data as { role: UserRole; full_name: string };
    return {
      role: row.role || 'client',
      fullName: row.full_name || ''
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
        role: 'designer'
      },
      session: { mock: true },
      isLoading: false,
      role: 'designer'
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
          role: profile?.role || 'client'
        },
        session,
        isLoading: false,
        role: profile?.role || 'client'
      };
    } else {
      currentAuthState = {
        user: null,
        session: null,
        isLoading: false,
        role: null
      };
    }
  } catch (err) {
    console.error('Auth initialization error:', err);
    currentAuthState = {
      user: null,
      session: null,
      isLoading: false,
      role: null
    };
  }

  notifyListeners();

  // Listen to Supabase auth state transitions
  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const profile = await fetchUserRole(session.user.id);
      currentAuthState = {
        user: {
          id: session.user.id,
          email: session.user.email || '',
          fullName: profile?.fullName || session.user.user_metadata?.full_name || 'User',
          role: profile?.role || 'client'
        },
        session,
        isLoading: false,
        role: profile?.role || 'client'
      };
    } else {
      currentAuthState = {
        user: null,
        session: null,
        isLoading: false,
        role: null
      };
    }
    notifyListeners();
  });

  return currentAuthState;
}

/**
 * Sign up with Email, Password, Full Name, and strictly whitelisted Role
 */
export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
  role: 'designer' | 'client';
}): Promise<{ success: boolean; requiresConfirmation?: boolean; error?: string }> {
  const { email, password, fullName, role } = params;

  // Strict client-side validation
  if (!email || !password || !fullName) {
    return { success: false, error: 'All fields are required.' };
  }
  if (role !== 'designer' && role !== 'client') {
    return { success: false, error: 'Account type must be Designer or Client.' };
  }
  if (password.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role
        }
      }
    });

    if (error) {
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
 */
export async function logIn(
  email: string,
  pass: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Login failed to return authenticated user.' };
    }

    const profile = await fetchUserRole(data.user.id);
    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email || '',
      fullName: profile?.fullName || data.user.user_metadata?.full_name || 'User',
      role: profile?.role || 'client'
    };

    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Login failed.' };
  }
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
      role: null
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
