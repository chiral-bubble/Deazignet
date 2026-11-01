import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('--- Checking with Anon/Public client ---');
  const { data: catAnon, error: catAnonErr } = await anonClient.from('categories').select('*');
  console.log('Anon categories:', catAnon?.length, 'Error:', catAnonErr);

  const { data: subAnon, error: subAnonErr } = await anonClient.from('subcategories').select('*');
  console.log('Anon subcategories:', subAnon?.length, 'Error:', subAnonErr);

  const { data: ptAnon, error: ptAnonErr } = await anonClient.from('phase_templates').select('*');
  console.log('Anon phase_templates:', ptAnon?.length, 'Error:', ptAnonErr);

  console.log('--- Checking with Admin client ---');
  const { data: catAdmin, error: catAdminErr } = await adminClient.from('categories').select('*');
  console.log('Admin categories:', catAdmin?.length, 'Error:', catAdminErr);

  const { data: subAdmin, error: subAdminErr } = await adminClient.from('subcategories').select('*');
  console.log('Admin subcategories:', subAdmin?.length, 'Error:', subAdminErr);

  const { data: ptAdmin, error: ptAdminErr } = await adminClient.from('phase_templates').select('*');
  console.log('Admin phase_templates:', ptAdmin?.length, 'Error:', ptAdminErr);

  if (catAdmin && catAdmin.length > 0) {
    console.log('Sample category:', catAdmin[0]);
  }
}

run().catch(console.error);

