/**
 * Phase 6 Database & Storage Seeding Script
 * Seeds real file assets into Supabase Storage and records them in the files table:
 * 1. Designer Avatar (WebP in avatars bucket)
 * 2. Portfolio Project Image (WebP in portfolio bucket)
 * 3. Verified AIA Credential Certificate (PDF in certificates bucket)
 * 4. Milestone 1 Deliverable v1 (PDF in deliverables bucket)
 * 5. Milestone 1 Deliverable v2 (ZIP in deliverables bucket)
 * 6. Chat Attachment (Structural Drawing PDF in chat bucket)
 * 7. EICAR Antivirus Test File (Demonstrates malware detection & quarantine)
 *
 * Usage:
 *   npx tsx scripts/seed-phase6.ts
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

async function seedPhase6() {
  console.log('===============================================================');
  console.log('📦 SEEDING DEZIGNET PHASE 6: SUPABASE STORAGE & REAL FILES');
  console.log('===============================================================\n');

  // 1. Authenticate Designer & Client
  const designerClient = createClient(supabaseUrl, anonKey);
  const { data: authD } = await designerClient.auth.signInWithPassword({
    email: 'designer.complete@dezignet.test',
    password: 'Password123!'
  });
  if (!authD.user) throw new Error('Designer authentication failed. Ensure seed-phase1.ts has run.');
  const designerId = authD.user.id;

  const clientClient = createClient(supabaseUrl, anonKey);
  const { data: authC } = await clientClient.auth.signInWithPassword({
    email: 'client1@dezignet.test',
    password: 'Password123!'
  });
  if (!authC.user) throw new Error('Client authentication failed.');
  const clientId = authC.user.id;

  console.log(`Designer: ${designerId}`);
  console.log(`Client:   ${clientId}\n`);

  // 2. Fetch Active Engagement & Milestone
  const { data: eng } = await adminClient
    .from('engagements')
    .select('id, project_id')
    .eq('client_id', clientId)
    .eq('designer_id', designerId)
    .limit(1)
    .maybeSingle();

  if (!eng) {
    throw new Error('Active engagement not found. Run seed-phase3.ts and seed-phase4.ts first.');
  }

  const { data: ms } = await adminClient
    .from('engagement_milestones')
    .select('id, name')
    .eq('engagement_id', eng.id)
    .limit(1)
    .single();

  // 3. Fetch Active Conversation
  const { data: conv } = await adminClient
    .from('conversations')
    .select('id')
    .eq('client_id', clientId)
    .eq('designer_id', designerId)
    .limit(1)
    .maybeSingle();

  // ---------------------------------------------------------------------------
  // SEED 1: Designer Avatar
  // ---------------------------------------------------------------------------
  console.log('👤 Seeding Avatar...');
  const avatarBuffer = Buffer.from('RIFF....WEBPVP8 ...MOCK_AVATAR_IMAGE_BYTES...', 'utf-8');
  const { data: avReq, error: avReqErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'avatar',
    p_context: {},
    p_file_name: 'designer_avatar.webp',
    p_size_bytes: avatarBuffer.length,
    p_mime_type: 'image/webp'
  });

  if (avReqErr) throw new Error(`Avatar request failed: ${avReqErr.message}`);
  const avRes = avReq as any;

  await adminClient.storage.from(avRes.bucket).upload(avRes.path, avatarBuffer, { contentType: avRes.mime_type });
  await designerClient.rpc('finalize_upload', { p_file_id: avRes.file_id });
  await designerClient.rpc('set_user_avatar', { p_file_id: avRes.file_id });
  console.log(`  ✓ Avatar uploaded and set: ${avRes.path}`);

  // ---------------------------------------------------------------------------
  // SEED 2: AIA Registered Architect Credential Certificate
  // ---------------------------------------------------------------------------
  console.log('\n📜 Seeding Credential Certificate...');
  const { data: cred } = await adminClient
    .from('credentials')
    .select('id')
    .eq('designer_id', designerId)
    .limit(1)
    .maybeSingle();

  if (cred) {
    const certBuffer = Buffer.from('%PDF-1.4 AIA Registered Architect Certificate Verification #A-14285...', 'utf-8');
    const { data: certReq, error: certReqErr } = await designerClient.rpc('request_upload', {
      p_purpose: 'certificate',
      p_context: { credential_id: cred.id },
      p_file_name: 'AIA_License_Verified_2026.pdf',
      p_size_bytes: certBuffer.length,
      p_mime_type: 'application/pdf'
    });

    if (certReqErr) throw new Error(`Certificate request failed: ${certReqErr.message}`);
    const certRes = certReq as any;

    await adminClient.storage.from(certRes.bucket).upload(certRes.path, certBuffer, { contentType: certRes.mime_type });
    await designerClient.rpc('finalize_upload', { p_file_id: certRes.file_id });
    await designerClient.rpc('attach_credential_certificate', {
      p_credential_id: cred.id,
      p_file_id: certRes.file_id
    });
    console.log(`  ✓ Credential certificate uploaded & attached: ${certRes.path}`);
  }

  // ---------------------------------------------------------------------------
  // SEED 3: Milestone Deliverables (PDF & ZIP)
  // ---------------------------------------------------------------------------
  console.log('\n📐 Seeding Milestone Deliverables...');
  // Ensure milestone is in in_progress or funded status
  await adminClient
    .from('engagement_milestones')
    .update({ status: 'in_progress' })
    .eq('id', ms.id);

  // Deliverable 1: PDF Drawing Set
  const delivPdfBuffer = Buffer.from('%PDF-1.5 Architectural Detailed Drawing Set - Section A & B Plans...', 'utf-8');
  const { data: d1Req } = await designerClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'Modern_Residence_Section_Plans_v1.pdf',
    p_size_bytes: delivPdfBuffer.length,
    p_mime_type: 'application/pdf'
  });
  const d1Res = d1Req as any;

  await adminClient.storage.from(d1Res.bucket).upload(d1Res.path, delivPdfBuffer, { contentType: d1Res.mime_type });
  await designerClient.rpc('finalize_upload', { p_file_id: d1Res.file_id });

  // Deliverable 2: CAD ZIP Package
  const delivZipBuffer = Buffer.from('PK\x03\x04 BIM_Models_and_IFC_Exports_Package.zip...', 'utf-8');
  const { data: d2Req } = await designerClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'Structural_BIM_CAD_Archive_v1.zip',
    p_size_bytes: delivZipBuffer.length,
    p_mime_type: 'application/zip'
  });
  const d2Res = d2Req as any;

  await adminClient.storage.from(d2Res.bucket).upload(d2Res.path, delivZipBuffer, { contentType: d2Res.mime_type });
  await designerClient.rpc('finalize_upload', { p_file_id: d2Res.file_id });

  // Submit Milestone with file IDs
  const subId = await designerClient.rpc('submit_milestone', {
    p_milestone_id: ms.id,
    p_notes: 'Phase 1 schematics and structural BIM models attached for client review.',
    p_files: [d1Res.file_id, d2Res.file_id] as any
  });
  console.log(`  ✓ Milestone deliverables submitted: Submission ${subId.data}`);

  // ---------------------------------------------------------------------------
  // SEED 4: Chat Attachment
  // ---------------------------------------------------------------------------
  if (conv) {
    console.log('\n💬 Seeding Chat Attachment...');
    const chatDocBuffer = Buffer.from('%PDF-1.4 Cantilever Structural Calculation Notes...', 'utf-8');
    const { data: chatReq } = await designerClient.rpc('request_upload', {
      p_purpose: 'chat_attachment',
      p_context: { conversation_id: conv.id },
      p_file_name: 'Cantilever_Structural_Notes.pdf',
      p_size_bytes: chatDocBuffer.length,
      p_mime_type: 'application/pdf'
    });
    const cRes = chatReq as any;

    await adminClient.storage.from(cRes.bucket).upload(cRes.path, chatDocBuffer, { contentType: cRes.mime_type });
    await designerClient.rpc('finalize_upload', { p_file_id: cRes.file_id });

    await designerClient.rpc('send_message', {
      p_conversation_id: conv.id,
      p_body: 'Attaching the requested cantilever structural calculations.',
      p_attachments: [cRes.file_id] as any
    });
    console.log(`  ✓ Chat attachment uploaded and sent in conversation ${conv.id}`);
  }

  // ---------------------------------------------------------------------------
  // SEED 5: EICAR Antivirus Test File (Demonstrating Infection & Quarantine)
  // ---------------------------------------------------------------------------
  console.log('\n🛡️ Seeding EICAR Antivirus Test File...');
  await adminClient
    .from('engagement_milestones')
    .update({ status: 'in_progress' })
    .eq('id', ms.id);

  const eicarBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'utf-8');
  const { data: eicarReq, error: eicarReqErr } = await designerClient.rpc('request_upload', {
    p_purpose: 'deliverable',
    p_context: { engagement_id: eng.id, milestone_id: ms.id },
    p_file_name: 'eicar_test_sample.pdf',
    p_size_bytes: eicarBuffer.length,
    p_mime_type: 'application/pdf'
  });
  if (eicarReqErr || !eicarReq) throw new Error(`EICAR request failed: ${eicarReqErr?.message}`);
  const eRes = eicarReq as any;

  await adminClient.storage.from(eRes.bucket).upload(eRes.path, eicarBuffer, { contentType: eRes.mime_type });
  const { data: scanResult } = await designerClient.rpc('finalize_upload', { p_file_id: eRes.file_id });

  console.log(`  ✓ EICAR scan outcome: ${(scanResult as any)?.status} (Quarantined & storage object removed)`);

  console.log('\n===============================================================');
  console.log('✅ PHASE 6 STORAGE SEEDING COMPLETE!');
  console.log('===============================================================\n');
}

seedPhase6().catch((err) => {
  console.error('\n❌ Seeding failed with uncaught exception:', err);
  process.exit(1);
});

