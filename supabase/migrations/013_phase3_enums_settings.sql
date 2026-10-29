-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 3
-- 013_phase3_enums_settings.sql
-- Enums and Application Settings for Active Work
-- ==============================================================================

-- 1. Create Phase 3 Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engagement_status') THEN
        CREATE TYPE public.engagement_status AS ENUM ('active', 'completed', 'cancelled', 'disputed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_status') THEN
        CREATE TYPE public.milestone_status AS ENUM (
            'awaiting_funding',
            'funded',
            'in_progress',
            'submitted',
            'revision_requested',
            'approved',
            'disputed'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payout_status') THEN
        CREATE TYPE public.payout_status AS ENUM ('not_due', 'pending_release', 'released');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_entry_status') THEN
        CREATE TYPE public.time_entry_status AS ENUM ('draft', 'submitted', 'approved', 'disputed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE public.invoice_status AS ENUM ('pending_approval', 'approved', 'paid', 'disputed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dispute_status') THEN
        CREATE TYPE public.dispute_status AS ENUM ('open', 'resolved');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_type') THEN
        CREATE TYPE public.ticket_type AS ENUM ('help', 'problem');
    END IF;
END $$;

-- 2. Seed Phase 3 Application Settings
INSERT INTO public.app_settings (key, value, description)
VALUES
    ('environment', '"development"'::jsonb, 'Current environment stage (development, staging, production)'),
    ('revision_limit', '2'::jsonb, 'Standard free revision iterations permitted before extra charges or dispute'),
    ('dispute_after_days', '5'::jsonb, 'Days of inactivity required before raising an unresponsive counterparty dispute'),
    ('sequential_funding', 'true'::jsonb, 'Enforce sequential funding of milestone phases (milestone N cannot fund until N-1 is approved)'),
    ('weekly_hours_cap_default', 'null'::jsonb, 'Default maximum weekly hours allowed for hourly engagements (null = no cap)'),
    ('max_file_size_bytes', '262144000'::jsonb, 'Maximum deliverable file size in bytes (250 MB)'),
    ('allowed_file_types', '["pdf", "dwg", "ifc", "zip", "png", "jpg", "jpeg"]'::jsonb, 'Allowed file extensions for milestone deliverable attachments'),
    ('auto_complete_when_all_approved', 'false'::jsonb, 'Automatically mark engagement completed when all milestones are approved and released')
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());
