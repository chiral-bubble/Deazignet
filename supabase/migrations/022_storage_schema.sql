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

