import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

function getEnv(key: string, defaultValue: string = ''): string {
  const gProcess = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  if (gProcess && gProcess.env && gProcess.env[key]) {
    return gProcess.env[key];
  }
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch {}
  return defaultValue;
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://hnssctjagfwdfbagpikv.supabase.co');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuc3NjdGphZ2Z3ZGZiYWdwaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjY5OTMsImV4cCI6MjEwODgwMjk5M30.T9oX4Bsvc3aZhicdwQZEjpUE7s6aevzOWS8V2JFbWk4');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  );
}

// Single typed Supabase client for all frontend modules (Anon Key only)
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Modular flags to toggle real Supabase vs mock layer independently
// Defaults to false (use real database)
export const USE_MOCKS = {
  auth: getEnv('VITE_USE_MOCKS_AUTH') === 'true',
  profiles: getEnv('VITE_USE_MOCKS_PROFILES') === 'true',
  portfolio: getEnv('VITE_USE_MOCKS_PORTFOLIO') === 'true',
  credentials: getEnv('VITE_USE_MOCKS_CREDENTIALS') === 'true',
  projects: getEnv('VITE_USE_MOCKS_PROJECTS') === 'true',
  proposals: getEnv('VITE_USE_MOCKS_PROPOSALS') === 'true',
  active_work: getEnv('VITE_USE_MOCKS_ACTIVE_WORK') === 'true',
  conversations: getEnv('VITE_USE_MOCKS_CONVERSATIONS') === 'true',
  notifications: getEnv('VITE_USE_MOCKS_NOTIFICATIONS') === 'true',
  storage: getEnv('VITE_USE_MOCKS_STORAGE') === 'true'
};
