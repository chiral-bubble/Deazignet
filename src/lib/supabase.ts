import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env'
  );
}

// Single typed Supabase client for all frontend modules (Anon Key only)
export const supabase = createClient<Database>(
  supabaseUrl || 'https://hnssctjagfwdfbagpikv.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuc3NjdGphZ2Z3ZGZiYWdwaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjY5OTMsImV4cCI6MjEwODgwMjk5M30.T9oX4Bsvc3aZhicdwQZEjpUE7s6aevzOWS8V2JFbWk4',
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
  auth: import.meta.env.VITE_USE_MOCKS_AUTH === 'true',
  profiles: import.meta.env.VITE_USE_MOCKS_PROFILES === 'true',
  portfolio: import.meta.env.VITE_USE_MOCKS_PORTFOLIO === 'true',
  credentials: import.meta.env.VITE_USE_MOCKS_CREDENTIALS === 'true',
  projects: import.meta.env.VITE_USE_MOCKS_PROJECTS === 'true',
  proposals: import.meta.env.VITE_USE_MOCKS_PROPOSALS === 'true',
  active_work: import.meta.env.VITE_USE_MOCKS_ACTIVE_WORK === 'true'
};
