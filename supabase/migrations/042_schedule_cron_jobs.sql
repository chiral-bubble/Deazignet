-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - SCHEDULED CRON JOBS
-- 042_schedule_cron_jobs.sql
-- Enables pg_cron extension and registers daily midnight jobs for:
-- 1. Expiring overdue project invitations
-- 2. Checking and notifying expiring/expired professional licenses
-- ==============================================================================

-- 1. Enable pg_cron extension under extensions schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- 2. Remove existing jobs if already registered
DO $$
BEGIN
    PERFORM cron.unschedule('expire-invitations-daily');
    PERFORM cron.unschedule('check-licenses-daily');
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3. Schedule daily invitation expiration at 00:00 UTC
SELECT cron.schedule(
    'expire-invitations-daily',
    '0 0 * * *',
    'SELECT public.expire_project_invitations()'
);

-- 4. Schedule daily credential & license expiration check at 00:00 UTC
SELECT cron.schedule(
    'check-licenses-daily',
    '0 0 * * *',
    'SELECT public.check_credential_expirations()'
);

-- 5. Verify scheduled jobs
SELECT jobid, jobname, schedule, command, active FROM cron.job;

