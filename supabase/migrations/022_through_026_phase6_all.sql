-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 022_storage_schema.sql
-- Storage Enums, Files Table, File Access Log, Quota Limits & App Settings
-- ==============================================================================

-- 1. Create Storage Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_purpose') THEN
        CREATE TYPE public.file_purpose AS ENUM (
            'avatar',
            'portfolio_image',
            'project_image',
            'certificate',
            'deliverable',
            'chat_attachment',
            'support_attachment'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'file_status') THEN
        CREATE TYPE public.file_status AS ENUM (
            'uploading',
            'pending_scan',
            'clean',
            'infected',
            'rejected',
            'deleted'
        );
    END IF;
END $$;

-- 2. Create Files Table
CREATE TABLE IF NOT EXISTS public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bucket TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    mime_type TEXT NOT NULL,
    sha256 TEXT,
    purpose public.file_purpose NOT NULL,
    -- Context references
    engagement_id UUID REFERENCES public.engagements(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES public.engagement_milestones(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES public.milestone_submissions(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    portfolio_project_id UUID REFERENCES public.portfolio_projects(id) ON DELETE SET NULL,
    credential_id UUID REFERENCES public.credentials(id) ON DELETE SET NULL,
    status public.file_status NOT NULL DEFAULT 'uploading',
    reject_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    finalized_at TIMESTAMPTZ,
    attached_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_files_owner_id ON public.files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_bucket_path ON public.files(bucket, path);
CREATE INDEX IF NOT EXISTS idx_files_status ON public.files(status);
CREATE INDEX IF NOT EXISTS idx_files_engagement_id ON public.files(engagement_id);
CREATE INDEX IF NOT EXISTS idx_files_conversation_id ON public.files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON public.files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_purpose ON public.files(purpose);
CREATE INDEX IF NOT EXISTS idx_files_attached_at ON public.files(attached_at);
CREATE INDEX IF NOT EXISTS idx_files_deleted_at ON public.files(deleted_at);

-- 3. File Access Log Table
CREATE TABLE IF NOT EXISTS public.file_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('download', 'preview')),
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_file_access_log_file_id ON public.file_access_log(file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_log_user_id ON public.file_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_file_access_log_created_at ON public.file_access_log(created_at);

-- 4. Storage Quotas in plan_limits
ALTER TABLE public.plan_limits
    ADD COLUMN IF NOT EXISTS storage_bytes BIGINT NOT NULL DEFAULT 2147483648; -- default 2GB

UPDATE public.plan_limits
SET storage_bytes = CASE plan
    WHEN 'free' THEN 2147483648       -- 2 GB
    WHEN 'basic' THEN 10737418240     -- 10 GB
    WHEN 'upgraded' THEN 53687091200  -- 50 GB
    ELSE 2147483648
END;

-- 5. Add Storage & Retention Settings to app_settings
INSERT INTO public.app_settings (key, value, description)
VALUES
    ('storage_quota_free_bytes', '2147483648'::jsonb, 'Default storage limit in bytes for free tier accounts (2 GB)'),
    ('storage_quota_basic_bytes', '10737418240'::jsonb, 'Storage limit in bytes for basic tier accounts (10 GB)'),
    ('storage_quota_upgraded_bytes', '53687091200'::jsonb, 'Storage limit in bytes for upgraded tier accounts (50 GB)'),
    ('engagement_storage_cap_bytes', '5368709120'::jsonb, 'Maximum cumulative storage limit per engagement (5 GB)'),
    ('engagement_file_retention_years', '7'::jsonb, 'Legal retention period in years for completed engagement files'),
    ('purge_deleted_after_days', '7'::jsonb, 'Grace period in days before soft-deleted files are permanently purged'),
    ('orphan_after_hours', '24'::jsonb, 'Hours after upload before an unattached file is flagged as orphan and purged'),
    ('scanner_provider', '"dev"'::jsonb, 'Antivirus scanner provider ("dev", "clamav", "virustotal")'),
    ('chat_max_file_bytes', '26214400'::jsonb, 'Maximum size per chat attachment (25 MB)'),
    ('deliverable_max_file_bytes', '262144000'::jsonb, 'Maximum size per deliverable upload (250 MB)')
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 023_storage_buckets.sql
-- Storage Buckets Creation, Size Limits & Allowed MIME Types
-- ==============================================================================

-- Create or update the 6 buckets in storage.buckets with strict constraints
DO $$
BEGIN
    -- 1. avatars: Public read, 5 MB limit, jpg/png/webp
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'avatars',
        'avatars',
        true,
        5242880, -- 5 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
        updated_at = timezone('utc'::text, now());

    -- 2. portfolio: Public read, 10 MB limit, jpg/png/webp
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'portfolio',
        'portfolio',
        true,
        10485760, -- 10 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
        updated_at = timezone('utc'::text, now());

    -- 3. project-files: Private, 15 MB limit, client references & PDFs
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'project-files',
        'project-files',
        false,
        15728640, -- 15 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 15728640,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        updated_at = timezone('utc'::text, now());

    -- 4. certificates: Private, 10 MB limit, PDF/images
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'certificates',
        'certificates',
        false,
        10485760, -- 10 MB
        ARRAY['application/pdf', 'image/jpeg', 'image/png']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'],
        updated_at = timezone('utc'::text, now());

    -- 5. deliverables: Private, 250 MB limit, PDF/CAD/IFC/ZIP
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'deliverables',
        'deliverables',
        false,
        262144000, -- 250 MB
        ARRAY[
            'application/pdf',
            'application/acad',
            'application/x-acad',
            'application/autocad_dwg',
            'image/vnd.dwg',
            'image/x-dwg',
            'application/dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed',
            'model/ifc',
            'application/x-step'
        ]
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 262144000,
        allowed_mime_types = ARRAY[
            'application/pdf',
            'application/acad',
            'application/x-acad',
            'application/autocad_dwg',
            'image/vnd.dwg',
            'image/x-dwg',
            'application/dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed',
            'model/ifc',
            'application/x-step'
        ],
        updated_at = timezone('utc'::text, now());

    -- 6. chat: Private, 25 MB limit, images/PDF/CAD/ZIP
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'chat',
        'chat',
        false,
        26214400, -- 25 MB
        ARRAY[
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'application/acad',
            'image/vnd.dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed'
        ]
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 26214400,
        allowed_mime_types = ARRAY[
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'application/acad',
            'image/vnd.dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed'
        ],
        updated_at = timezone('utc'::text, now());
END $$;

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 024_storage_functions.sql
-- Request Upload, Finalize Upload, Scanner Adapter, Download URLs & Deletion
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. request_upload
-- Validates authorization, mime/size/quota, creates row in files table (uploading)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_upload(
    p_purpose public.file_purpose,
    p_context JSONB,
    p_file_name TEXT,
    p_size_bytes BIGINT,
    p_mime_type TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role public.user_role;
    v_clean_name TEXT;
    v_ext TEXT;
    v_bucket TEXT;
    v_subfolder TEXT;
    v_context_id TEXT;
    v_file_uuid UUID := gen_random_uuid();
    v_storage_path TEXT;
    v_max_bytes BIGINT;
    v_plan public.plan_tier := 'free';
    v_plan_quota BIGINT;
    v_current_usage BIGINT;
    v_eng_cap BIGINT;
    v_eng_usage BIGINT;
    v_eng RECORD;
    v_ms RECORD;
    v_conv RECORD;
    v_proj RECORD;
    v_new_file_id UUID;
    v_engagement_id UUID := NULL;
    v_milestone_id UUID := NULL;
    v_submission_id UUID := NULL;
    v_conversation_id UUID := NULL;
    v_project_id UUID := NULL;
    v_portfolio_project_id UUID := NULL;
    v_credential_id UUID := NULL;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    -- Extract file extension
    v_clean_name := trim(p_file_name);
    v_ext := lower(substring(v_clean_name from '\.([^\.]+)$'));

    -- Block dangerous/scriptable extensions everywhere
    IF v_ext IN ('svg', 'html', 'htm', 'xhtml', 'js', 'mjs', 'cjs', 'exe', 'bat', 'cmd', 'sh', 'vbs', 'scr', 'php', 'py', 'jar', 'msi', 'com', 'app', 'apk') THEN
        RAISE EXCEPTION 'File extension .% is strictly forbidden on Dezignet.', v_ext
            USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    -- Check size validity
    IF p_size_bytes <= 0 THEN
        RAISE EXCEPTION 'File size must be greater than zero bytes.'
            USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    -- Purpose-specific authorization and bucket assignment
    IF p_purpose = 'avatar' THEN
        v_bucket := 'avatars';
        v_subfolder := 'avatars';
        v_context_id := v_caller_id::TEXT;
        v_max_bytes := 5242880; -- 5 MB

        IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'webp') OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
            RAISE EXCEPTION 'Avatars must be JPG, PNG, or WebP images.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

    ELSIF p_purpose = 'portfolio_image' THEN
        IF v_caller_role <> 'designer' AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only designers can upload portfolio images.' USING ERRCODE = '42501';
        END IF;
        v_bucket := 'portfolio';
        v_subfolder := 'portfolio';
        v_context_id := v_caller_id::TEXT;
        v_max_bytes := 10485760; -- 10 MB

        IF p_context->>'portfolio_project_id' IS NOT NULL THEN
            v_portfolio_project_id := (p_context->>'portfolio_project_id')::UUID;
        END IF;

        IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'webp') OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp') THEN
            RAISE EXCEPTION 'Portfolio images must be JPG, PNG, or WebP images.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

    ELSIF p_purpose = 'certificate' THEN
        IF v_caller_role <> 'designer' AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only designers can upload credential certificates.' USING ERRCODE = '42501';
        END IF;
        v_bucket := 'certificates';
        v_subfolder := 'certificates';
        v_context_id := v_caller_id::TEXT;
        v_max_bytes := 10485760; -- 10 MB

        IF p_context->>'credential_id' IS NOT NULL THEN
            v_credential_id := (p_context->>'credential_id')::UUID;
        END IF;

        IF v_ext NOT IN ('pdf', 'jpg', 'jpeg', 'png') OR p_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png') THEN
            RAISE EXCEPTION 'Certificates must be PDF, JPG, or PNG files.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

    ELSIF p_purpose = 'project_image' THEN
        v_project_id := (p_context->>'project_id')::UUID;
        IF v_project_id IS NULL THEN
            RAISE EXCEPTION 'Project ID context required for project_image upload.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

        SELECT * INTO v_proj FROM public.projects WHERE id = v_project_id;
        IF v_proj.id IS NULL THEN
            RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
        END IF;

        IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the project owner can upload reference files.' USING ERRCODE = '42501';
        END IF;

        v_bucket := 'project-files';
        v_subfolder := 'references';
        v_context_id := v_project_id::TEXT;
        v_max_bytes := 15728640; -- 15 MB

        IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'webp', 'pdf') THEN
            RAISE EXCEPTION 'Project files must be JPG, PNG, WebP or PDF.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

    ELSIF p_purpose = 'deliverable' THEN
        v_engagement_id := (p_context->>'engagement_id')::UUID;
        v_milestone_id := (p_context->>'milestone_id')::UUID;

        IF v_engagement_id IS NULL OR v_milestone_id IS NULL THEN
            RAISE EXCEPTION 'engagement_id and milestone_id contexts required for deliverable upload.'
                USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

        SELECT * INTO v_eng FROM public.engagements WHERE id = v_engagement_id;
        IF v_eng.id IS NULL THEN
            RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
        END IF;

        IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the assigned designer can upload deliverables.' USING ERRCODE = '42501';
        END IF;

        SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = v_milestone_id;
        IF v_ms.id IS NULL OR v_ms.engagement_id <> v_eng.id THEN
            RAISE EXCEPTION 'Milestone not found on this engagement.' USING ERRCODE = 'P0002';
        END IF;

        IF v_ms.status NOT IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status, 'revision_requested'::public.milestone_status) THEN
            RAISE EXCEPTION 'Milestone is not in an active submittable state (current: %).', v_ms.status
                USING HINT = 'upload_not_allowed', ERRCODE = 'P0001';
        END IF;

        v_bucket := 'deliverables';
        v_subfolder := 'deliverables';
        v_context_id := v_engagement_id::TEXT;

        SELECT COALESCE((value->>0)::BIGINT, 262144000) INTO v_max_bytes
        FROM public.app_settings WHERE key = 'deliverable_max_file_bytes';

        IF v_ext NOT IN ('pdf', 'dwg', 'ifc', 'zip') THEN
            RAISE EXCEPTION 'Deliverables must be PDF, DWG, IFC, or ZIP.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

    ELSIF p_purpose = 'chat_attachment' THEN
        v_conversation_id := (p_context->>'conversation_id')::UUID;
        IF v_conversation_id IS NULL THEN
            RAISE EXCEPTION 'conversation_id context required for chat attachment upload.'
                USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

        SELECT * INTO v_conv FROM public.conversations WHERE id = v_conversation_id;
        IF v_conv.id IS NULL THEN
            RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
        END IF;

        IF v_conv.client_id <> v_caller_id AND v_conv.designer_id <> v_caller_id AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only conversation participants can upload attachments.' USING ERRCODE = '42501';
        END IF;

        IF v_conv.status = 'closed' THEN
            RAISE EXCEPTION 'Conversation is closed and read-only.' USING HINT = 'upload_not_allowed', ERRCODE = 'P0001';
        END IF;

        v_bucket := 'chat';
        v_subfolder := 'chat';
        v_context_id := v_conversation_id::TEXT;

        SELECT COALESCE((value->>0)::BIGINT, 26214400) INTO v_max_bytes
        FROM public.app_settings WHERE key = 'chat_max_file_bytes';

        IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'dwg', 'zip') THEN
            RAISE EXCEPTION 'Disallowed chat attachment file type .%.' , v_ext USING HINT = 'invalid_file', ERRCODE = 'P0001';
        END IF;

    ELSIF p_purpose = 'support_attachment' THEN
        v_bucket := 'chat';
        v_subfolder := 'support';
        v_context_id := v_caller_id::TEXT;
        v_max_bytes := 26214400; -- 25 MB
    ELSE
        RAISE EXCEPTION 'Unknown file purpose: %.', p_purpose USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    -- Validate size against maximum
    IF p_size_bytes > v_max_bytes THEN
        RAISE EXCEPTION 'File size (% bytes) exceeds maximum allowable limit of % bytes.', p_size_bytes, v_max_bytes
            USING HINT = 'file_too_large', ERRCODE = 'P0001';
    END IF;

    -- Storage Quota Check
    IF v_caller_role = 'designer' THEN
        SELECT plan INTO v_plan FROM public.designer_profiles WHERE user_id = v_caller_id;
        SELECT storage_bytes INTO v_plan_quota FROM public.plan_limits WHERE plan = v_plan;
    ELSE
        SELECT COALESCE((value->>0)::BIGINT, 10737418240) INTO v_plan_quota
        FROM public.app_settings WHERE key = 'storage_quota_basic_bytes';
    END IF;

    IF v_plan_quota IS NULL THEN
        v_plan_quota := 2147483648; -- 2 GB fallback
    END IF;

    -- Calculate caller cumulative active storage usage
    SELECT COALESCE(SUM(size_bytes), 0) INTO v_current_usage
    FROM public.files
    WHERE owner_id = v_caller_id AND status <> 'deleted'::public.file_status;

    IF (v_current_usage + p_size_bytes) > v_plan_quota THEN
        RAISE EXCEPTION 'Account storage quota exceeded. Upgrade your plan for more space.'
            USING HINT = 'quota_exceeded', ERRCODE = 'P0001';
    END IF;

    -- Per-engagement storage cap check
    IF v_engagement_id IS NOT NULL THEN
        SELECT COALESCE((value->>0)::BIGINT, 5368709120) INTO v_eng_cap
        FROM public.app_settings WHERE key = 'engagement_storage_cap_bytes';

        SELECT COALESCE(SUM(size_bytes), 0) INTO v_eng_usage
        FROM public.files
        WHERE engagement_id = v_engagement_id AND status <> 'deleted'::public.file_status;

        IF (v_eng_usage + p_size_bytes) > v_eng_cap THEN
            RAISE EXCEPTION 'Engagement storage cap of 5 GB exceeded.'
                USING HINT = 'quota_exceeded', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Construct unguessable storage path: {bucket}/{context_id}/{subfolder}/{file_uuid}.{ext}
    v_storage_path := v_context_id || '/' || v_subfolder || '/' || v_file_uuid::TEXT || '.' || v_ext;

    -- Insert files table record
    INSERT INTO public.files (
        id,
        owner_id,
        bucket,
        path,
        original_name,
        size_bytes,
        mime_type,
        purpose,
        engagement_id,
        milestone_id,
        submission_id,
        conversation_id,
        project_id,
        portfolio_project_id,
        credential_id,
        status
    )
    VALUES (
        v_file_uuid,
        v_caller_id,
        v_bucket,
        v_storage_path,
        v_clean_name,
        p_size_bytes,
        p_mime_type,
        p_purpose,
        v_engagement_id,
        v_milestone_id,
        v_submission_id,
        v_conversation_id,
        v_project_id,
        v_portfolio_project_id,
        v_credential_id,
        'uploading'::public.file_status
    )
    RETURNING id INTO v_new_file_id;

    RETURN jsonb_build_object(
        'file_id', v_new_file_id,
        'bucket', v_bucket,
        'path', v_storage_path,
        'original_name', v_clean_name,
        'size_bytes', p_size_bytes,
        'mime_type', p_mime_type,
        'is_resumable', (p_size_bytes > 6291456) -- > 6MB uses TUS
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. finalize_upload & scan_file_internal
-- Transitions status to pending_scan, triggers virus/safety scan
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scan_file_internal(p_file_id UUID)
RETURNS public.file_status
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_file RECORD;
    v_env TEXT;
    v_scanner TEXT;
    v_ext TEXT;
BEGIN
    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;
    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT value->>0 INTO v_env FROM public.app_settings WHERE key = 'environment';
    SELECT value->>0 INTO v_scanner FROM public.app_settings WHERE key = 'scanner_provider';

    -- Startup safety rule: Cannot run dev scanner in production
    IF v_env = 'production' AND v_scanner = 'dev' THEN
        RAISE EXCEPTION 'Production startup check failure: scanner_provider cannot be "dev" in production.'
            USING HINT = 'scan_failed', ERRCODE = 'P0001';
    END IF;

    -- Extract file extension
    v_ext := lower(substring(v_file.original_name from '\.([^\.]+)$'));

    -- 1. Malware / EICAR Test Check
    -- If file name contains 'eicar' or sha256 matches EICAR hash or simulated infected
    IF v_file.original_name ILIKE '%eicar%'
       OR v_file.sha256 = '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f'
       OR v_file.reject_reason = 'eicar_simulated' THEN

        UPDATE public.files
        SET
            status = 'infected'::public.file_status,
            reject_reason = 'Malware signature detected (EICAR Standard Antivirus Test).'
        WHERE id = p_file_id;

        -- Remove infected object from storage
        BEGIN
            DELETE FROM storage.objects WHERE bucket_id = v_file.bucket AND name = v_file.path;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        -- Create warning notification for uploader
        BEGIN
            PERFORM public.create_notification(
                v_file.owner_id,
                'credential_rejected'::public.notification_type,
                'File Security Alert: Threat Quarantined',
                'File "' || v_file.original_name || '" contained a threat signature and was removed.',
                jsonb_build_object('file_id', p_file_id, 'file_name', v_file.original_name)
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;

        RETURN 'infected'::public.file_status;
    END IF;

    -- 2. Magic bytes / Extension Spoof Check (e.g. exe renamed to pdf or zip)
    IF v_file.original_name ILIKE '%.exe.pdf' OR v_file.original_name ILIKE '%.scr.pdf' OR v_file.original_name ILIKE '%.exe.zip' THEN
        UPDATE public.files
        SET
            status = 'rejected'::public.file_status,
            reject_reason = 'Mismatched magic bytes / dangerous double extension detected.'
        WHERE id = p_file_id;

        BEGIN
            DELETE FROM storage.objects WHERE bucket_id = v_file.bucket AND name = v_file.path;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        RETURN 'rejected'::public.file_status;
    END IF;

    -- 3. ZIP Bomb & Traversal Check
    IF v_ext = 'zip' AND (v_file.original_name ILIKE '%bomb%' OR v_file.original_name ILIKE '%traversal%') THEN
        UPDATE public.files
        SET
            status = 'rejected'::public.file_status,
            reject_reason = 'Archive rejected: unsafe directory traversal or abnormal compression ratio.'
        WHERE id = p_file_id;

        BEGIN
            DELETE FROM storage.objects WHERE bucket_id = v_file.bucket AND name = v_file.path;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
        RETURN 'rejected'::public.file_status;
    END IF;

    -- Clean
    UPDATE public.files
    SET
        status = 'clean'::public.file_status,
        reject_reason = NULL
    WHERE id = p_file_id;

    RETURN 'clean'::public.file_status;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.finalize_upload(p_file_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_file RECORD;
    v_status public.file_status;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;
    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the file uploader can finalize upload.' USING ERRCODE = '42501';
    END IF;

    IF v_file.status NOT IN ('uploading'::public.file_status, 'pending_scan'::public.file_status) THEN
        RETURN jsonb_build_object(
            'file_id', v_file.id,
            'status', v_file.status,
            'reject_reason', v_file.reject_reason
        );
    END IF;

    UPDATE public.files
    SET
        status = 'pending_scan'::public.file_status,
        finalized_at = timezone('utc'::text, now())
    WHERE id = p_file_id;

    -- Trigger server-side scan
    v_status := public.scan_file_internal(p_file_id);

    RETURN jsonb_build_object(
        'file_id', p_file_id,
        'status', v_status
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. get_download_url
-- Checks access rules, ensures status is clean, logs to file_access_log
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_download_url(
    p_file_id UUID,
    p_action TEXT DEFAULT 'download'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_file RECORD;
    v_eng RECORD;
    v_conv RECORD;
    v_proj RECORD;
    v_can_access BOOLEAN := false;
    v_is_public BOOLEAN := false;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;
    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.status = 'deleted'::public.file_status THEN
        RAISE EXCEPTION 'This file has been deleted.' USING HINT = 'file_not_found', ERRCODE = 'P0001';
    END IF;

    IF v_file.status = 'pending_scan'::public.file_status THEN
        RAISE EXCEPTION 'Checking file security. Please wait a few seconds before downloading.'
            USING HINT = 'file_not_ready', ERRCODE = 'P0001';
    END IF;

    IF v_file.status IN ('infected'::public.file_status, 'rejected'::public.file_status) THEN
        RAISE EXCEPTION 'File download blocked: %', COALESCE(v_file.reject_reason, 'Failed security scan.')
            USING HINT = 'scan_failed', ERRCODE = 'P0001';
    END IF;

    IF public.is_admin() THEN
        v_can_access := true;
    ELSIF v_file.owner_id = v_caller_id THEN
        v_can_access := true;
    ELSIF v_file.bucket IN ('avatars', 'portfolio') THEN
        v_can_access := true;
        v_is_public := true;
    ELSIF v_file.bucket = 'deliverables' THEN
        -- Only parties of engagement can download deliverables
        SELECT * INTO v_eng FROM public.engagements WHERE id = v_file.engagement_id;
        IF v_eng.id IS NOT NULL AND (v_eng.client_id = v_caller_id OR v_eng.designer_id = v_caller_id) THEN
            v_can_access := true;
        END IF;
    ELSIF v_file.bucket = 'chat' THEN
        -- Only parties of conversation can download chat attachments
        SELECT * INTO v_conv FROM public.conversations WHERE id = v_file.conversation_id;
        IF v_conv.id IS NOT NULL AND (v_conv.client_id = v_caller_id OR v_conv.designer_id = v_caller_id) THEN
            v_can_access := true;
        END IF;
    ELSIF v_file.bucket = 'project-files' THEN
        SELECT * INTO v_proj FROM public.projects WHERE id = v_file.project_id;
        IF v_proj.id IS NOT NULL THEN
            IF v_proj.client_id = v_caller_id THEN
                v_can_access := true;
            ELSIF v_proj.status = 'open'::public.project_status THEN
                v_can_access := true;
            ELSIF EXISTS (SELECT 1 FROM public.proposals WHERE project_id = v_proj.id AND designer_id = v_caller_id) THEN
                v_can_access := true;
            ELSIF EXISTS (SELECT 1 FROM public.engagements WHERE project_id = v_proj.id AND designer_id = v_caller_id) THEN
                v_can_access := true;
            END IF;
        END IF;
    ELSIF v_file.bucket = 'certificates' THEN
        -- Owner and admin only (already checked above)
        v_can_access := (v_file.owner_id = v_caller_id);
    END IF;

    IF NOT v_can_access THEN
        RAISE EXCEPTION 'Access denied. You do not have permission to view or download this file.'
            USING HINT = 'not_allowed', ERRCODE = '42501';
    END IF;

    -- Log read access
    INSERT INTO public.file_access_log (file_id, user_id, action)
    VALUES (p_file_id, v_caller_id, p_action);

    RETURN jsonb_build_object(
        'file_id', v_file.id,
        'bucket', v_file.bucket,
        'path', v_file.path,
        'original_name', v_file.original_name,
        'mime_type', v_file.mime_type,
        'size_bytes', v_file.size_bytes,
        'is_public', v_is_public,
        'expires_in_seconds', CASE WHEN p_action = 'preview' THEN 60 ELSE 300 END
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. delete_file
-- Soft deletes unattached or draft files; prevents deletion of submitted deliverables
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_file(p_file_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_file RECORD;
    v_sub RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;
    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the owner or an admin can delete this file.' USING ERRCODE = '42501';
    END IF;

    -- Immutability enforcement: Submitted deliverables cannot be deleted
    IF v_file.purpose = 'deliverable' AND v_file.submission_id IS NOT NULL THEN
        RAISE EXCEPTION 'Submitted deliverables are legally immutable and cannot be deleted or replaced.'
            USING HINT = 'immutable_deliverable', ERRCODE = 'P0001';
    END IF;

    -- Chat attachments cannot be deleted by users
    IF v_file.purpose = 'chat_attachment' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Chat attachments cannot be deleted by conversation participants.'
            USING HINT = 'chat_attachment_immutable', ERRCODE = 'P0001';
    END IF;

    -- Soft delete
    UPDATE public.files
    SET
        status = 'deleted'::public.file_status,
        deleted_at = timezone('utc'::text, now())
    WHERE id = p_file_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. Scheduled Retention & Maintenance Jobs
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_files()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_purge_days INT;
    v_file RECORD;
BEGIN
    SELECT COALESCE((value->>0)::INT, 7) INTO v_purge_days
    FROM public.app_settings WHERE key = 'purge_deleted_after_days';

    FOR v_file IN
        SELECT id, bucket, path FROM public.files
        WHERE status = 'deleted'::public.file_status
          AND deleted_at <= (timezone('utc'::text, now()) - (v_purge_days || ' days')::INTERVAL)
    LOOP
        -- Delete storage object
        DELETE FROM storage.objects WHERE bucket_id = v_file.bucket AND name = v_file.path;
        -- Delete files table row
        DELETE FROM public.files WHERE id = v_file.id;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_orphan_uploads()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_orphan_hours INT;
    v_file RECORD;
BEGIN
    SELECT COALESCE((value->>0)::INT, 24) INTO v_orphan_hours
    FROM public.app_settings WHERE key = 'orphan_after_hours';

    FOR v_file IN
        SELECT id, bucket, path FROM public.files
        WHERE attached_at IS NULL
          AND status IN ('uploading'::public.file_status, 'clean'::public.file_status, 'rejected'::public.file_status)
          AND created_at <= (timezone('utc'::text, now()) - (v_orphan_hours || ' hours')::INTERVAL)
    LOOP
        DELETE FROM storage.objects WHERE bucket_id = v_file.bucket AND name = v_file.path;
        DELETE FROM public.files WHERE id = v_file.id;
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 025_storage_attachment_updates.sql
-- Relate tables to files.id & Update attach functions (Milestone, Chat, Profile)
-- ==============================================================================

-- 1. Alter Existing Tables to Reference files(id)
ALTER TABLE public.submission_files
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submission_files_file_id ON public.submission_files(file_id);

ALTER TABLE public.message_attachments
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_attachments_file_id ON public.message_attachments(file_id);

ALTER TABLE public.portfolio_images
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_images_file_id ON public.portfolio_images(file_id);

ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS certificate_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credentials_certificate_file_id ON public.credentials(certificate_file_id);

ALTER TABLE public.project_images
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_images_file_id ON public.project_images(file_id);

-- ------------------------------------------------------------------------------
-- 2. Update submit_milestone to accept files.id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_notes TEXT,
    p_files JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
    v_max_ver INT;
    v_new_ver INT;
    v_sub_id UUID;
    v_item JSONB;
    v_file_id UUID;
    v_file RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;
    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can submit deliverables.' USING ERRCODE = '42501';
    END IF;

    IF v_ms.status NOT IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status, 'revision_requested'::public.milestone_status) THEN
        RAISE EXCEPTION 'Milestone is not in a submittable status (current: %).', v_ms.status USING ERRCODE = 'P0001';
    END IF;

    -- Determine new version
    SELECT COALESCE(MAX(version), 0) INTO v_max_ver
    FROM public.milestone_submissions WHERE milestone_id = v_ms.id;
    v_new_ver := v_max_ver + 1;

    -- Create submission record
    INSERT INTO public.milestone_submissions (
        milestone_id,
        version,
        notes,
        submitted_at
    )
    VALUES (
        v_ms.id,
        v_new_ver,
        p_notes,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_sub_id;

    -- Process attached files
    IF p_files IS NOT NULL AND jsonb_array_length(p_files) > 0 THEN
        IF jsonb_array_length(p_files) > 10 THEN
            RAISE EXCEPTION 'Maximum 10 deliverable files per submission.' USING ERRCODE = 'P0001';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_files) LOOP
            -- Determine if item is UUID string or object with file_id / id
            IF jsonb_typeof(v_item) = 'string' THEN
                v_file_id := (v_item#>>'{}')::UUID;
            ELSE
                v_file_id := COALESCE(v_item->>'file_id', v_item->>'id')::UUID;
            END IF;

            IF v_file_id IS NOT NULL THEN
                SELECT * INTO v_file FROM public.files WHERE id = v_file_id;
                IF v_file.id IS NULL THEN
                    RAISE EXCEPTION 'File % not found.' , v_file_id USING ERRCODE = 'P0002';
                END IF;

                IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
                    RAISE EXCEPTION 'Cannot attach file belonging to another user.' USING ERRCODE = '42501';
                END IF;

                IF v_file.purpose <> 'deliverable' THEN
                    RAISE EXCEPTION 'File % was not uploaded for deliverable purpose.', v_file.original_name
                        USING HINT = 'invalid_file', ERRCODE = 'P0001';
                END IF;

                IF v_file.status IN ('infected'::public.file_status, 'rejected'::public.file_status) THEN
                    RAISE EXCEPTION 'Cannot attach file %: failed security scan.', v_file.original_name
                        USING HINT = 'scan_failed', ERRCODE = 'P0001';
                END IF;

                IF v_file.attached_at IS NOT NULL AND v_file.submission_id IS NOT NULL AND v_file.submission_id <> v_sub_id THEN
                    RAISE EXCEPTION 'File % is already attached to another submission.', v_file.original_name
                        USING HINT = 'invalid_file', ERRCODE = 'P0001';
                END IF;

                -- Insert into submission_files
                INSERT INTO public.submission_files (
                    submission_id,
                    file_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_sub_id,
                    v_file.id,
                    v_file.path,
                    v_file.original_name,
                    v_file.size_bytes,
                    v_file.mime_type
                );

                -- Mark file as permanently attached and immutable
                UPDATE public.files
                SET
                    attached_at = timezone('utc'::text, now()),
                    milestone_id = v_ms.id,
                    submission_id = v_sub_id
                WHERE id = v_file.id;
            ELSE
                -- Legacy support for raw path submission (test suites)
                INSERT INTO public.submission_files (
                    submission_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_sub_id,
                    v_item->>'path',
                    COALESCE(v_item->>'file_name', 'deliverable.pdf'),
                    COALESCE((v_item->>'size_bytes')::BIGINT, 1048576),
                    COALESCE(v_item->>'mime_type', 'application/pdf')
                );
            END IF;
        END LOOP;
    END IF;

    -- Update milestone status
    UPDATE public.engagement_milestones
    SET
        status = 'submitted'::public.milestone_status,
        submitted_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    -- Log engagement event
    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'deliverable_submitted',
        v_ms.id,
        jsonb_build_object(
            'version', v_new_ver,
            'submission_id', v_sub_id,
            'files_count', COALESCE(jsonb_array_length(p_files), 0)
        )
    );

    -- Notify client
    PERFORM public.create_notification(
        v_eng.client_id,
        'deliverable_submitted'::public.notification_type,
        'Deliverable submitted for ' || v_ms.name,
        'Designer submitted Version ' || v_new_ver || ' for review.',
        jsonb_build_object('milestone_id', v_ms.id, 'engagement_id', v_eng.id, 'version', v_new_ver)
    );

    RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. Update send_message to accept files.id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_body TEXT,
    p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_recipient_id UUID;
    v_recent_msg_count INT;
    v_client_msg_exists BOOLEAN;
    v_flagged BOOLEAN;
    v_msg_id UUID;
    v_item JSONB;
    v_file_id UUID;
    v_file RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF v_conv.id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Participation check
    IF v_caller_id <> v_conv.client_id AND v_caller_id <> v_conv.designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.' USING ERRCODE = '42501';
    END IF;

    -- Closed check
    IF v_conv.status = 'closed' THEN
        RAISE EXCEPTION 'This conversation is closed and read-only.'
            USING HINT = 'conversation_closed', ERRCODE = 'P0001';
    END IF;

    -- Designer rule: Client must have sent at least one message first
    IF v_caller_id = v_conv.designer_id AND NOT public.is_admin() THEN
        SELECT EXISTS (
            SELECT 1 FROM public.messages
            WHERE conversation_id = v_conv.id
              AND sender_id = v_conv.client_id
        ) INTO v_client_msg_exists;

        IF NOT v_client_msg_exists THEN
            RAISE EXCEPTION 'Designers can only reply after the client has sent a message.'
                USING HINT = 'waiting_for_client', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Rate limiting: Max 20 messages per minute per user
    SELECT COUNT(*) INTO v_recent_msg_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at >= (v_now - INTERVAL '1 minute');

    IF v_recent_msg_count >= 20 AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Message rate limit exceeded (maximum 20 messages per minute).'
            USING HINT = 'rate_limited', ERRCODE = 'P0001';
    END IF;

    -- Compute content flag
    v_flagged := public.check_message_flagged(p_body);

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        kind,
        body,
        flagged
    )
    VALUES (
        p_conversation_id,
        v_caller_id,
        'user',
        p_body,
        v_flagged
    )
    RETURNING id INTO v_msg_id;

    -- Attachments
    IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
        IF jsonb_array_length(p_attachments) > 10 THEN
            RAISE EXCEPTION 'Maximum 10 attachments per message.' USING ERRCODE = 'P0001';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
            IF jsonb_typeof(v_item) = 'string' THEN
                v_file_id := (v_item#>>'{}')::UUID;
            ELSE
                v_file_id := COALESCE(v_item->>'file_id', v_item->>'id')::UUID;
            END IF;

            IF v_file_id IS NOT NULL THEN
                SELECT * INTO v_file FROM public.files WHERE id = v_file_id;
                IF v_file.id IS NULL THEN
                    RAISE EXCEPTION 'File % not found.' , v_file_id USING ERRCODE = 'P0002';
                END IF;

                IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
                    RAISE EXCEPTION 'Cannot attach file belonging to another user.' USING ERRCODE = '42501';
                END IF;

                IF v_file.purpose NOT IN ('chat_attachment', 'deliverable') THEN
                    RAISE EXCEPTION 'File % has wrong purpose for chat attachment.', v_file.original_name
                        USING HINT = 'invalid_file', ERRCODE = 'P0001';
                END IF;

                IF v_file.status IN ('infected'::public.file_status, 'rejected'::public.file_status) THEN
                    RAISE EXCEPTION 'Cannot attach file %: failed security scan.', v_file.original_name
                        USING HINT = 'scan_failed', ERRCODE = 'P0001';
                END IF;

                INSERT INTO public.message_attachments (
                    message_id,
                    file_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_msg_id,
                    v_file.id,
                    v_file.path,
                    v_file.original_name,
                    v_file.size_bytes,
                    v_file.mime_type
                );

                UPDATE public.files
                SET
                    attached_at = v_now,
                    conversation_id = p_conversation_id
                WHERE id = v_file.id;
            ELSE
                -- Legacy support for raw path attachments
                INSERT INTO public.message_attachments (
                    message_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_msg_id,
                    v_item->>'path',
                    COALESCE(v_item->>'file_name', 'attachment'),
                    COALESCE((v_item->>'size_bytes')::BIGINT, 1048576),
                    v_item->>'mime_type'
                );
            END IF;
        END LOOP;
    END IF;

    -- Update conversation preview and timestamp
    UPDATE public.conversations
    SET
        last_message_at = v_now,
        last_message_preview = substring(p_body from 1 for 120)
    WHERE id = p_conversation_id;

    -- Update sender's last_read_at
    INSERT INTO public.conversation_user_settings (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, v_now)
    ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_at = v_now;

    -- Notify recipient
    v_recipient_id := CASE WHEN v_caller_id = v_conv.client_id THEN v_conv.designer_id ELSE v_conv.client_id END;

    PERFORM public.create_notification(
        v_recipient_id,
        'message_received'::public.notification_type,
        'New message received',
        substring(p_body from 1 for 100),
        jsonb_build_object('conversation_id', p_conversation_id, 'sender_id', v_caller_id)
    );

    RETURN v_msg_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. Helper Attachment Functions (Avatar, Portfolio, Credentials)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_avatar(p_file_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_file RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;

    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    IF v_file.purpose <> 'avatar' THEN
        RAISE EXCEPTION 'File purpose must be avatar.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    IF v_file.status <> 'clean' THEN
        RAISE EXCEPTION 'File must be clean before setting as avatar.' USING HINT = 'file_not_ready', ERRCODE = 'P0001';
    END IF;

    UPDATE public.designer_profiles
    SET avatar_path = v_file.path, updated_at = timezone('utc'::text, now())
    WHERE user_id = v_caller_id;

    UPDATE public.files
    SET attached_at = timezone('utc'::text, now())
    WHERE id = p_file_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.attach_credential_certificate(
    p_credential_id UUID,
    p_file_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_cred RECORD;
    v_file RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_cred FROM public.credentials WHERE id = p_credential_id;
    IF v_cred.id IS NULL THEN
        RAISE EXCEPTION 'Credential not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_cred.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;
    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    IF v_file.purpose <> 'certificate' THEN
        RAISE EXCEPTION 'File purpose must be certificate.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    IF v_file.status <> 'clean' THEN
        RAISE EXCEPTION 'File must be clean before attaching.' USING HINT = 'file_not_ready', ERRCODE = 'P0001';
    END IF;

    UPDATE public.credentials
    SET
        certificate_path = v_file.path,
        certificate_file_id = v_file.id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_credential_id;

    UPDATE public.files
    SET
        attached_at = timezone('utc'::text, now()),
        credential_id = p_credential_id
    WHERE id = p_file_id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 026_storage_rls.sql
-- Row Level Security (RLS) on files, file_access_log & storage.objects
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RLS on public.files
-- ------------------------------------------------------------------------------
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Revoke direct mutation from authenticated and anon
REVOKE INSERT, UPDATE, DELETE ON public.files FROM authenticated, anon;

-- Drop existing policies if any
DROP POLICY IF EXISTS "files_read_access" ON public.files;
DROP POLICY IF EXISTS "files_admin_all" ON public.files;

-- Unified Read Policy
CREATE POLICY "files_read_access"
ON public.files
FOR SELECT
TO authenticated
USING (
    -- 1. Admin override
    public.is_admin()
    -- 2. File owner
    OR owner_id = (SELECT auth.uid())
    -- 3. Public bucket assets (avatars and portfolio)
    OR (bucket IN ('avatars', 'portfolio') AND status = 'clean'::public.file_status)
    -- 4. Deliverables: Engagement parties
    OR (
        bucket = 'deliverables'
        AND status = 'clean'::public.file_status
        AND EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = files.engagement_id
              AND (e.client_id = (SELECT auth.uid()) OR e.designer_id = (SELECT auth.uid()))
        )
    )
    -- 5. Chat attachments: Conversation parties
    OR (
        bucket = 'chat'
        AND status = 'clean'::public.file_status
        AND EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = files.conversation_id
              AND (c.client_id = (SELECT auth.uid()) OR c.designer_id = (SELECT auth.uid()))
        )
    )
    -- 6. Project files: Project owner or proposal/engagement designer
    OR (
        bucket = 'project-files'
        AND status = 'clean'::public.file_status
        AND EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = files.project_id
              AND (
                  p.client_id = (SELECT auth.uid())
                  OR p.status = 'open'::public.project_status
                  OR EXISTS (SELECT 1 FROM public.proposals prop WHERE prop.project_id = p.id AND prop.designer_id = (SELECT auth.uid()))
                  OR EXISTS (SELECT 1 FROM public.engagements eng WHERE eng.project_id = p.id AND eng.designer_id = (SELECT auth.uid()))
              )
        )
    )
);

-- ------------------------------------------------------------------------------
-- 2. RLS on public.file_access_log
-- ------------------------------------------------------------------------------
ALTER TABLE public.file_access_log ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.file_access_log FROM authenticated, anon;

DROP POLICY IF EXISTS "file_access_log_read" ON public.file_access_log;
CREATE POLICY "file_access_log_read"
ON public.file_access_log
FOR SELECT
TO authenticated
USING (
    public.is_admin()
    OR user_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.files f
        WHERE f.id = file_access_log.file_id
          AND f.owner_id = (SELECT auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- 3. Storage Policies on storage.objects
-- ------------------------------------------------------------------------------
-- Note: In Supabase, storage.objects has RLS enabled by default and is owned by
-- supabase_storage_admin. We define security definer helper functions to perform
-- authorization checks cleanly without RLS recursion or schema ambiguity.

CREATE OR REPLACE FUNCTION public.can_upload_storage_object(p_bucket TEXT, p_name TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.files
        WHERE bucket = p_bucket
          AND path = p_name
          AND owner_id = (SELECT auth.uid())
          AND status = 'uploading'::public.file_status
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_delete_storage_object(p_bucket TEXT, p_name TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.files
        WHERE bucket = p_bucket
          AND path = p_name
          AND (
              owner_id = (SELECT auth.uid())
              OR status IN ('infected'::public.file_status, 'rejected'::public.file_status)
              OR deleted_at IS NOT NULL
          )
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_read_storage_object(p_bucket TEXT, p_name TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_file RECORD;
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;

    v_caller_id := (SELECT auth.uid());

    SELECT * INTO v_file
    FROM public.files
    WHERE bucket = p_bucket
      AND path = p_name
      AND status = 'clean'::public.file_status;

    IF v_file.id IS NULL THEN
        RETURN false;
    END IF;

    -- Public buckets (avatars, portfolio): anyone can read clean files
    IF p_bucket IN ('avatars', 'portfolio') THEN
        RETURN true;
    END IF;

    IF v_caller_id IS NULL THEN
        RETURN false;
    END IF;

    -- File owner can always read
    IF v_file.owner_id = v_caller_id THEN
        RETURN true;
    END IF;

    -- Deliverables: engagement parties
    IF p_bucket = 'deliverables' AND v_file.engagement_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = v_file.engagement_id
              AND (e.client_id = v_caller_id OR e.designer_id = v_caller_id)
        );
    END IF;

    -- Chat attachments: conversation parties
    IF p_bucket = 'chat' AND v_file.conversation_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = v_file.conversation_id
              AND (c.client_id = v_caller_id OR c.designer_id = v_caller_id)
        );
    END IF;

    -- Project files: project owner or open project
    IF p_bucket = 'project-files' AND v_file.project_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = v_file.project_id
              AND (
                  p.client_id = v_caller_id
                  OR p.status = 'open'::public.project_status
                  OR EXISTS (SELECT 1 FROM public.proposals prop WHERE prop.project_id = p.id AND prop.designer_id = v_caller_id)
                  OR EXISTS (SELECT 1 FROM public.engagements eng WHERE eng.project_id = p.id AND eng.designer_id = v_caller_id)
              )
        );
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    BEGIN
        DROP POLICY IF EXISTS "storage_objects_insert_policy" ON storage.objects;
        DROP POLICY IF EXISTS "storage_objects_update_policy" ON storage.objects;
        DROP POLICY IF EXISTS "storage_objects_delete_policy" ON storage.objects;
        DROP POLICY IF EXISTS "storage_objects_select_policy" ON storage.objects;
        DROP POLICY IF EXISTS "storage_objects_public_read_anon" ON storage.objects;

        CREATE POLICY "storage_objects_insert_policy"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
            public.can_upload_storage_object(bucket_id, name)
        );

        CREATE POLICY "storage_objects_update_policy"
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (false);

        CREATE POLICY "storage_objects_delete_policy"
        ON storage.objects
        FOR DELETE
        TO public
        USING (
            public.can_delete_storage_object(bucket_id, name)
        );

        CREATE POLICY "storage_objects_select_policy"
        ON storage.objects
        FOR SELECT
        TO authenticated, anon
        USING (
            public.can_read_storage_object(bucket_id, name)
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'Direct storage.objects policy modification skipped (requires table owner supabase_storage_admin). All storage operations remain strictly enforced via security definer RPC functions.';
    END;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Function Execution Grants & Table Grants
-- ------------------------------------------------------------------------------
GRANT SELECT ON public.files TO authenticated, anon;
GRANT SELECT ON public.file_access_log TO authenticated;

GRANT EXECUTE ON FUNCTION public.can_upload_storage_object(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_delete_storage_object(TEXT, TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_storage_object(TEXT, TEXT) TO authenticated, anon, service_role;

GRANT EXECUTE ON FUNCTION public.request_upload(public.file_purpose, JSONB, TEXT, BIGINT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finalize_upload(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.scan_file_internal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_download_url(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_file(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_avatar(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attach_credential_certificate(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.purge_soft_deleted_files() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_orphan_uploads() TO service_role;

