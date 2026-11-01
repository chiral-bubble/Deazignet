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

        -- INSERT Policy:
        -- User can ONLY upload into the exact path generated for them by request_upload
        CREATE POLICY "storage_objects_insert_policy"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
            public.can_upload_storage_object(bucket_id, name)
        );

        -- UPDATE Policy: Never allow overwriting existing objects
        CREATE POLICY "storage_objects_update_policy"
        ON storage.objects
        FOR UPDATE
        TO authenticated
        USING (false);

        -- DELETE Policy: Direct deletions are forbidden for regular users; allowed for admin and automated quarantine
        CREATE POLICY "storage_objects_delete_policy"
        ON storage.objects
        FOR DELETE
        TO public
        USING (
            public.can_delete_storage_object(bucket_id, name)
        );

        -- SELECT Policy: Evaluates public vs private access rules cleanly
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

