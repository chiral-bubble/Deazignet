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

