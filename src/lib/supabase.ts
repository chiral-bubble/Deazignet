import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hnssctjagfwdfbagpikv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhuc3NjdGphZ2Z3ZGZiYWdwaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjY5OTMsImV4cCI6MjEwODgwMjk5M30.T9oX4Bsvc3aZhicdwQZEjpUE7s6aevzOWS8V2JFbWk4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

