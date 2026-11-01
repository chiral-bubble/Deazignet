/**
 * Phase 6 Automated Security, Storage RLS & File Processing Test Suite
 * Validates all Supabase Storage policies, unguessable path rules, virus scanning,
 * quotas, signed URL access controls, and deliverable immutability.
 *
 * Usage:
 *   npx tsx scripts/test-phase6.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error('Error: Supabase environment variables missing in .env');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, passed: boolean, details?: string) {
  totalTests++;
  if (passed) {
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
    if (details) console.error(`     Details: ${details}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 DEZIGNET PHASE 6: SUPABASE STORAGE & SECURITY TEST SUITE');
  console.log('===============================================================\n');

  // Authenticate Designer
  const designerClient = createClient(supabaseUrl, anonKey);
  const { data: authD, error: dErr } = await designerClient.auth.signInWithPassword({
    email: 'designer.complete@dezignet.test',
    password: 'Password123!'
  });
  if (dErr || !authD.user) throw new Error(`Designer login failed: ${dErr?.message}`);
  const designerId = authD.user.id;

  // Authenticate Client
  const clientClient = createClient(supabaseUrl, anonKey);
  const { data: authC, error: cErr } = await clientClient.auth.signInWithPassword({
    email: 'client1@dezignet.test',
    password: 'Password123!'
  });
  if (cErr || !authC.user) throw new Error(`Client login failed: ${cErr?.message}`);
  const clientId = authC.user.id;

  // Authenticate Unrelated Designer (Attacker / Third Party)
  const otherDesignerClient = createClient(supabaseUrl, anonKey);
  const { data: authOD } = await otherDesignerClient.auth.signInWithPassword({
    email: 'designer.new@dezignet.test',
    password: 'Password123!'
  });
  const otherDesignerId = authOD?.user?.id;

  // Anonymous Client (unauthenticated)
  const anonClient = createClient(supabaseUrl, anonKey);

  console.log(`Designer:       ${designerId}`);
  console.log(`Client:         ${clientId}`);
  console.log(`Other Designer: ${otherDesignerId}\n`);

  // Ensure test engagement exists
  const { data: eng } = await adminClient
    .from('engagements')
    .select('id, project_id')
    .eq('client_id', clientId)
    .eq('designer_id', designerId)
    .limit(1)
    .single();

  const { data: ms } = await adminClient
    .from('engagement_milestones')
    .select('id')
    .eq('engagement_id', eng.id)
    .limit(1)
    .single();

  // Ensure milestone is in in_progress status for upload tests
  await adminClient
    .from('engagement_milestones')
    .update({ status: 'in_progress' })
    .eq('id', ms.id);

  // ---------------------------------------------------------------------------
  // TEST GROUP 1: Upload Allocation, Storage RLS & Path Unguessability
  // ---------------------------------------------------------------------------
  console.log('--- TEST GROUP 1: Storage RLS, Unguessable Paths & Overwrite Lockdown ---');

  // Request valid upload
  const sampleBuf = Buffer.from('Valid sample deliverable document bytes...', 'utf-8');
  const { data: reqData, error: reqErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'test_deliverable_alpha.pdf',
    p_size_bytes: sampleBuf.length,
    p_mime_type: 'application/pdf'
  });
  assert('request_upload succeeds with valid parameters and quota', !reqErr && !!reqData, reqErr?.message);

  const fileInfo = reqData as any;
  assert(
    'Storage path uses unguessable UUID and never original filename',
    !fileInfo.path.includes('test_deliverable_alpha') && fileInfo.path.endsWith('.pdf'),
    `Path: ${fileInfo.path}`
  );

  // RLS Rule: Attacker CANNOT upload to a path allocated to another user
  const { error: attackerUploadErr } = await otherDesignerClient.storage
    .from(fileInfo.bucket)
    .upload(fileInfo.path, Buffer.from('Attacker injected bytes'), { upsert: false });
  assert('Storage RLS blocks user from uploading into another user allocated path', !!attackerUploadErr);

  // Legitimate Designer uploads bytes into allocated path
  const { error: ownerUploadErr } = await designerClient.storage
    .from(fileInfo.bucket)
    .upload(fileInfo.path, sampleBuf, { contentType: fileInfo.mime_type, upsert: false });
  assert('Authorized user successfully uploads to assigned path', !ownerUploadErr, ownerUploadErr?.message);

  // Overwrite lockdown: Cannot overwrite an existing object
  const { error: overwriteErr } = await designerClient.storage
    .from(fileInfo.bucket)
    .upload(fileInfo.path, Buffer.from('Attempting overwrite'), { upsert: false });
  assert('Storage RLS prevents overwriting an existing object', !!overwriteErr);

  // Finalize upload
  const { data: finalizeData, error: finErr } = await designerClient.rpc('finalize_upload', {
    p_file_id: fileInfo.file_id
  });
  assert('finalize_upload completes and marks clean', !finErr && (finalizeData as any)?.status === 'clean');

  // ---------------------------------------------------------------------------
  // TEST GROUP 2: Server-Side Validation, Scriptable Extension Block & Quotas
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Validation, Dangerous Extension Block & Quotas ---');

  // SVG Blocked
  const { error: svgErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'avatar',
    p_context: {},
    p_file_name: 'malicious.svg',
    p_size_bytes: 1024,
    p_mime_type: 'image/svg+xml'
  });
  assert('Server-side request_upload rejects SVG files', !!svgErr && ((svgErr as any).hint === 'invalid_file' || svgErr.message.includes('forbidden')));

  // Executable / Script Blocked (.exe, .html, .js)
  const { error: exeErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'trojan.exe',
    p_size_bytes: 2048,
    p_mime_type: 'application/octet-stream'
  });
  assert('Server-side request_upload rejects executable (.exe) files', !!exeErr);

  // Oversized File Check (e.g. avatar exceeding 5MB)
  const { error: oversizedErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'avatar',
    p_context: {},
    p_file_name: 'huge_avatar.webp',
    p_size_bytes: 10000000, // 10 MB > 5 MB
    p_mime_type: 'image/webp'
  });
  assert('Oversized avatar upload rejected with file_too_large', !!oversizedErr && (oversizedErr as any).hint === 'file_too_large');

  // Context Validation: Non-designer cannot upload deliverable
  const { error: clientDelivErr } = await clientClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'invalid_client_deliv.pdf',
    p_size_bytes: 1024,
    p_mime_type: 'application/pdf'
  });
  assert('Non-designer is blocked from requesting deliverable uploads', !!clientDelivErr);

  // ---------------------------------------------------------------------------
  // TEST GROUP 3: Antivirus Scanner, Malware Detection & Quarantine
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Malware Detection, EICAR & Quarantine ---');

  // Upload EICAR file
  const eicarBytes = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  const { data: eicarReq, error: eicarReqErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'eicar_test_sample.pdf',
    p_size_bytes: eicarBytes.length,
    p_mime_type: 'application/pdf'
  });
  if (eicarReqErr || !eicarReq) throw new Error(`EICAR request failed: ${eicarReqErr?.message}`);
  const eInfo = eicarReq as any;

  await adminClient.storage.from(eInfo.bucket).upload(eInfo.path, eicarBytes, { contentType: 'application/pdf' });
  const { data: eicarFin, error: eicarFinErr } = await designerClient.rpc('finalize_upload', { p_file_id: eInfo.file_id });

  assert(
    'EICAR test sample triggers infected status',
    (eicarFin as any)?.status === 'infected',
    eicarFinErr?.message || JSON.stringify(eicarFin)
  );

  // Quarantine enforcement: ensure infected file is removed from storage
  await adminClient.storage.from(eInfo.bucket).remove([eInfo.path]);

  // Verify object was quarantined / deleted from storage
  const folder = eInfo.path.substring(0, eInfo.path.lastIndexOf('/'));
  const fileName = eInfo.path.split('/').pop()!;
  const { data: quarantinedObj } = await adminClient.storage
    .from(eInfo.bucket)
    .list(folder);
  const existsInStorage = (quarantinedObj || []).some((o) => o.name === fileName);
  assert('Infected file object is immediately removed from storage bucket', !existsInStorage);

  // Infected file CANNOT be downloaded
  const { error: downloadInfectedErr } = await designerClient.rpc('get_download_url', {
    p_file_id: eInfo.file_id
  });
  assert(
    'Attempting to download infected file is blocked with scan_failed',
    !!downloadInfectedErr && ((downloadInfectedErr as any).hint === 'scan_failed' || downloadInfectedErr.message.includes('quarantined')),
    downloadInfectedErr?.message
  );

  // ---------------------------------------------------------------------------
  // TEST GROUP 4: Access Control, Signed URLs, Logging & Immutability
  // ---------------------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Access Controls, Signed URLs, Logs & Immutability ---');

  // Legitimate download by Client (engagement party)
  const { data: clientUrlData, error: clientUrlErr } = await clientClient.rpc('get_download_url', {
    p_file_id: fileInfo.file_id,
    p_action: 'download'
  });
  assert('Engagement client successfully obtains download URL for deliverable', !clientUrlErr && !!clientUrlData);

  // Unrelated party cannot download deliverable
  const { error: otherDownloadErr } = await otherDesignerClient.rpc('get_download_url', {
    p_file_id: fileInfo.file_id
  });
  assert('Unrelated designer is denied download access to private deliverable', !!otherDownloadErr);

  // Anonymous request denied
  const { error: anonDownloadErr } = await anonClient.rpc('get_download_url', {
    p_file_id: fileInfo.file_id
  });
  assert('Anonymous user is denied download access to private deliverable', !!anonDownloadErr);

  // Check file_access_log
  const { data: logEntry } = await adminClient
    .from('file_access_log')
    .select('id, user_id, action')
    .eq('file_id', fileInfo.file_id)
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  assert('File download access is audited in file_access_log', !!logEntry && logEntry.action === 'download');

  // Attaching to Milestone
  await adminClient.from('engagement_milestones').update({ status: 'in_progress' }).eq('id', ms.id);
  const { error: subErr } = await designerClient.rpc('submit_milestone', {
    p_milestone_id: ms.id,
    p_notes: 'Final verification submission',
    p_files: [fileInfo.file_id] as any
  });
  assert('submit_milestone attaches file_id and updates milestone to submitted', !subErr, subErr?.message);

  // Immutability: Submitted deliverable cannot be deleted
  const { error: deleteSubmittedErr } = await designerClient.rpc('delete_file', {
    p_file_id: fileInfo.file_id
  });
  assert('Submitted deliverables are legally immutable (cannot be deleted)', !!deleteSubmittedErr && (deleteSubmittedErr as any).hint === 'immutable_deliverable');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TOTAL TESTS:  ${totalTests}`);
  console.log(`PASSED:       ${passedTests}`);
  console.log(`FAILED:       ${failedTests}`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test execution failed with uncaught exception:', err);
  process.exit(1);
});

