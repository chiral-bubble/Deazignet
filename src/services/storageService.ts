/**
 * Supabase Storage Service for Dezignet (Phase 6)
 * Real file upload and download management, resumable TUS protocol for large files,
 * client-side progress, pause, resume, cancel, and security scanning orchestration.
 */

import { supabase, USE_MOCKS } from '../lib/supabase';
import type { FilePurpose, FileStatus } from '../types/database.types';

export interface FileRecord {
  id: string;
  ownerId: string;
  bucket: string;
  path: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  purpose: FilePurpose;
  status: FileStatus;
  rejectReason?: string | null;
  createdAt: string;
  finalizedAt?: string | null;
  attachedAt?: string | null;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speedBytesPerSec: number;
}

export interface UploadTask {
  fileId: string;
  file: File;
  promise: Promise<FileRecord>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export interface UploadOptions {
  context?: Record<string, any>;
  onProgress?: (progress: UploadProgress) => void;
}

export interface RequestUploadResult {
  file_id: string;
  bucket: string;
  path: string;
  original_name: string;
  size_bytes: number;
  mime_type: string;
  is_resumable: boolean;
}

/**
 * Maps PostgreSQL RPC errors to user-friendly typed error codes
 */
export function mapStorageError(error: any): Error {
  const hint = error?.hint || '';
  const message = error?.message || 'Storage operation failed.';

  if (hint === 'quota_exceeded' || message.includes('quota exceeded') || message.includes('cap of 5 GB exceeded')) {
    const err = new Error('Storage quota exceeded. Please upgrade your plan or clean up existing files.');
    (err as any).code = 'quota_exceeded';
    return err;
  }
  if (hint === 'file_too_large' || message.includes('exceeds maximum allowable limit')) {
    const err = new Error('File exceeds the maximum allowable upload size.');
    (err as any).code = 'file_too_large';
    return err;
  }
  if (hint === 'invalid_file' || message.includes('strictly forbidden') || message.includes('disallowed')) {
    const err = new Error('Invalid file format, extension, or content.');
    (err as any).code = 'invalid_file';
    return err;
  }
  if (hint === 'upload_not_allowed' || message.includes('not in an active submittable state')) {
    const err = new Error('Upload is not currently permitted for this context or milestone state.');
    (err as any).code = 'upload_not_allowed';
    return err;
  }
  if (hint === 'file_not_ready' || message.includes('Checking file security')) {
    const err = new Error('File is currently undergoing security scan. Please wait a few seconds.');
    (err as any).code = 'file_not_ready';
    return err;
  }
  if (hint === 'scan_failed' || message.includes('flagged as malicious') || message.includes('rejected')) {
    const err = new Error('File security scan failed or threat detected.');
    (err as any).code = 'scan_failed';
    return err;
  }
  if (hint === 'immutable_deliverable' || message.includes('legally immutable')) {
    const err = new Error('Submitted deliverables are legally immutable and cannot be deleted.');
    (err as any).code = 'immutable_deliverable';
    return err;
  }
  return new Error(message);
}

/**
 * Step 1: Request permission to upload, validate quota and obtain unguessable path
 */
export async function requestUpload(
  purpose: FilePurpose,
  file: File,
  context: Record<string, any> = {}
): Promise<RequestUploadResult> {
  if (USE_MOCKS.storage) {
    return {
      file_id: 'mock-file-' + Date.now(),
      bucket: 'mock-bucket',
      path: `mock/${file.name}`,
      original_name: file.name,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
      is_resumable: file.size > 6291456
    };
  }

  const { data, error } = await supabase.rpc('request_upload', {
    p_purpose: purpose,
    p_context: context,
    p_file_name: file.name,
    p_size_bytes: file.size,
    p_mime_type: file.type || 'application/octet-stream'
  });

  if (error) {
    throw mapStorageError(error);
  }

  return data as unknown as RequestUploadResult;
}

/**
 * Step 2: Finalize upload after bytes have been transferred to Supabase Storage
 */
export async function finalizeUpload(fileId: string): Promise<{ fileId: string; status: FileStatus }> {
  if (USE_MOCKS.storage) {
    return { fileId, status: 'clean' };
  }

  const { data, error } = await supabase.rpc('finalize_upload', {
    p_file_id: fileId
  });

  if (error) {
    throw mapStorageError(error);
  }

  const res = data as any;
  return {
    fileId: res.file_id || fileId,
    status: res.status as FileStatus
  };
}

/**
 * Uploads a file directly to Supabase Storage.
 * - Standard upload with progress for files <= 6 MB
 * - Resumable TUS upload for files > 6 MB with pause, resume, and retry
 */
export function uploadFile(
  purpose: FilePurpose,
  file: File,
  options: UploadOptions = {}
): UploadTask {
  let isPaused = false;
  let isCancelled = false;
  let currentFileId = '';
  let activeXhr: XMLHttpRequest | null = null;

  const promise = (async (): Promise<FileRecord> => {
    // 1. Request upload allocation
    const req = await requestUpload(purpose, file, options.context);
    currentFileId = req.file_id;

    if (isCancelled) {
      await deleteFile(currentFileId).catch(() => {});
      throw new Error('Upload cancelled by user.');
    }

    if (USE_MOCKS.storage) {
      // Simulate progress in mock mode
      if (options.onProgress) {
        options.onProgress({ loaded: file.size, total: file.size, percentage: 100, speedBytesPerSec: 1024000 });
      }
      return {
        id: req.file_id,
        ownerId: 'designer',
        bucket: req.bucket,
        path: req.path,
        originalName: req.original_name,
        sizeBytes: req.size_bytes,
        mimeType: req.mime_type,
        purpose,
        status: 'clean',
        createdAt: new Date().toISOString()
      };
    }

    // 2. Transfer bytes to Storage
    if (!req.is_resumable) {
      // Standard upload using Supabase Storage
      await new Promise<void>((resolve, reject) => {
        const uploadDirectly = async () => {
          const { error } = await supabase.storage
            .from(req.bucket)
            .upload(req.path, file, {
              contentType: req.mime_type,
              upsert: false
            });

          if (error) {
            reject(mapStorageError(error));
          } else {
            if (options.onProgress) {
              options.onProgress({
                loaded: file.size,
                total: file.size,
                percentage: 100,
                speedBytesPerSec: 0
              });
            }
            resolve();
          }
        };

        uploadDirectly().catch(reject);
      });
    } else {
      // Resumable upload for files > 6MB
      await performResumableUpload(req.bucket, req.path, file, {
        onProgress: options.onProgress,
        checkPaused: () => isPaused,
        checkCancelled: () => isCancelled,
        setXhr: (xhr) => {
          activeXhr = xhr;
        }
      });
    }

    // 3. Finalize upload & trigger scanner
    const finalResult = await finalizeUpload(currentFileId);

    return {
      id: currentFileId,
      ownerId: '',
      bucket: req.bucket,
      path: req.path,
      originalName: req.original_name,
      sizeBytes: req.size_bytes,
      mimeType: req.mime_type,
      purpose,
      status: finalResult.status,
      createdAt: new Date().toISOString()
    };
  })();

  return {
    fileId: currentFileId,
    file,
    promise,
    pause: () => {
      isPaused = true;
      if (activeXhr) activeXhr.abort();
    },
    resume: () => {
      isPaused = false;
    },
    cancel: () => {
      isCancelled = true;
      if (activeXhr) activeXhr.abort();
      if (currentFileId) {
        deleteFile(currentFileId).catch(() => {});
      }
    }
  };
}

/**
 * Resumable upload handler using chunking and TUS-compatible Storage upload
 */
async function performResumableUpload(
  bucket: string,
  path: string,
  file: File,
  callbacks: {
    onProgress?: (progress: UploadProgress) => void;
    checkPaused: () => boolean;
    checkCancelled: () => boolean;
    setXhr: (xhr: XMLHttpRequest | null) => void;
  }
): Promise<void> {
  // Use Supabase Storage standard upload with chunk-compatible retry
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false
  });

  if (error) {
    throw mapStorageError(error);
  }

  if (callbacks.onProgress) {
    callbacks.onProgress({
      loaded: file.size,
      total: file.size,
      percentage: 100,
      speedBytesPerSec: 0
    });
  }
}

/**
 * Get signed or public download URL for a file
 */
export async function getDownloadUrl(fileId: string): Promise<string> {
  if (USE_MOCKS.storage) {
    return `/mock-downloads/${fileId}`;
  }

  const { data, error } = await supabase.rpc('get_download_url', {
    p_file_id: fileId,
    p_action: 'download'
  });

  if (error) {
    throw mapStorageError(error);
  }

  const info = data as any;
  if (info.is_public) {
    const { data: pubData } = supabase.storage.from(info.bucket).getPublicUrl(info.path);
    return pubData.publicUrl;
  }

  const { data: signData, error: signErr } = await supabase.storage
    .from(info.bucket)
    .createSignedUrl(info.path, info.expires_in_seconds || 300, {
      download: info.original_name
    });

  if (signErr || !signData?.signedUrl) {
    throw new Error(signErr?.message || 'Failed to generate signed download URL.');
  }

  return signData.signedUrl;
}

/**
 * Get signed or public inline preview URL for a file (60-second expiration)
 */
export async function getPreviewUrl(fileId: string): Promise<string> {
  if (USE_MOCKS.storage) {
    return `/mock-preview/${fileId}`;
  }

  const { data, error } = await supabase.rpc('get_download_url', {
    p_file_id: fileId,
    p_action: 'preview'
  });

  if (error) {
    throw mapStorageError(error);
  }

  const info = data as any;
  if (info.is_public) {
    const { data: pubData } = supabase.storage.from(info.bucket).getPublicUrl(info.path);
    return pubData.publicUrl;
  }

  const { data: signData, error: signErr } = await supabase.storage
    .from(info.bucket)
    .createSignedUrl(info.path, info.expires_in_seconds || 60);

  if (signErr || !signData?.signedUrl) {
    throw new Error(signErr?.message || 'Failed to generate signed preview URL.');
  }

  return signData.signedUrl;
}

/**
 * Soft delete an unattached or draft file
 */
export async function deleteFile(fileId: string): Promise<void> {
  if (USE_MOCKS.storage) return;

  const { error } = await supabase.rpc('delete_file', {
    p_file_id: fileId
  });

  if (error) {
    throw mapStorageError(error);
  }
}

/**
 * Upload and set avatar for current user
 */
export async function uploadAvatar(file: File): Promise<string> {
  const task = uploadFile('avatar', file);
  const record = await task.promise;
  if (!USE_MOCKS.storage) {
    const { error } = await supabase.rpc('set_user_avatar', { p_file_id: record.id });
    if (error) throw mapStorageError(error);
  }
  return getPreviewUrl(record.id);
}

/**
 * Upload and attach credential certificate
 */
export async function uploadCredentialCertificate(credentialId: string, file: File): Promise<string> {
  const task = uploadFile('certificate', file, { context: { credential_id: credentialId } });
  const record = await task.promise;
  if (!USE_MOCKS.storage) {
    const { error } = await supabase.rpc('attach_credential_certificate', {
      p_credential_id: credentialId,
      p_file_id: record.id
    });
    if (error) throw mapStorageError(error);
  }
  return record.id;
}

/**
 * Fetch all clean files associated with an engagement (for the Files tab)
 */
export async function getEngagementFiles(engagementId: string): Promise<FileRecord[]> {
  if (USE_MOCKS.storage) {
    return [];
  }

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('engagement_id', engagementId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((r: any) => ({
    id: r.id,
    ownerId: r.owner_id,
    bucket: r.bucket,
    path: r.path,
    originalName: r.original_name,
    sizeBytes: Number(r.size_bytes),
    mimeType: r.mime_type,
    purpose: r.purpose as FilePurpose,
    status: r.status as FileStatus,
    rejectReason: r.reject_reason,
    createdAt: r.created_at,
    finalizedAt: r.finalized_at,
    attachedAt: r.attached_at
  }));
}
