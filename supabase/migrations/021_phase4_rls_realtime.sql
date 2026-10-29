-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 4
-- 021_phase4_rls_realtime.sql
-- Row Level Security, Grants & Realtime Publications for Phase 4
-- ==============================================================================

-- 1. Revoke Direct Mutations from authenticated and anon
REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.message_attachments FROM anon, authenticated;
REVOKE DELETE ON public.conversation_user_settings FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.conversation_reports FROM anon, authenticated;
REVOKE INSERT, DELETE ON public.notifications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.job_runs FROM anon, authenticated;

-- Allow SELECT
GRANT SELECT ON public.conversations TO authenticated;
GRANT SELECT ON public.messages TO authenticated;
GRANT SELECT ON public.message_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.conversation_user_settings TO authenticated;
GRANT SELECT, INSERT ON public.conversation_reports TO authenticated;
GRANT SELECT, UPDATE (read_at, deleted_at) ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT ON public.job_runs TO authenticated;

-- 2. Enable Row Level Security (RLS) on All Phase 4 Tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- conversations: Only participants. For designers, hidden until at least 1 client message exists.
DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations
    FOR SELECT TO authenticated
    USING (
        client_id = (SELECT auth.uid()) OR
        (
            designer_id = (SELECT auth.uid()) AND (
                EXISTS (
                    SELECT 1 FROM public.messages m
                    WHERE m.conversation_id = conversations.id
                      AND m.sender_id = conversations.client_id
                ) OR
                public.is_admin()
            )
        ) OR
        public.is_admin()
    );

-- messages: Only participants of the conversation
DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant" ON public.messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
              AND (
                  c.client_id = (SELECT auth.uid()) OR
                  c.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- message_attachments: Inherits participant access
DROP POLICY IF EXISTS "message_attachments_select_participant" ON public.message_attachments;
CREATE POLICY "message_attachments_select_participant" ON public.message_attachments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.conversations c ON c.id = m.conversation_id
            WHERE m.id = message_attachments.message_id
              AND (
                  c.client_id = (SELECT auth.uid()) OR
                  c.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- conversation_user_settings: Own settings only
DROP POLICY IF EXISTS "conv_settings_select_own" ON public.conversation_user_settings;
CREATE POLICY "conv_settings_select_own" ON public.conversation_user_settings
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "conv_settings_insert_own" ON public.conversation_user_settings;
CREATE POLICY "conv_settings_insert_own" ON public.conversation_user_settings
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "conv_settings_update_own" ON public.conversation_user_settings;
CREATE POLICY "conv_settings_update_own" ON public.conversation_user_settings
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- conversation_reports: Reporter and admin
DROP POLICY IF EXISTS "conv_reports_select_own" ON public.conversation_reports;
CREATE POLICY "conv_reports_select_own" ON public.conversation_reports
    FOR SELECT TO authenticated
    USING (reporter_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "conv_reports_insert_own" ON public.conversation_reports;
CREATE POLICY "conv_reports_insert_own" ON public.conversation_reports
    FOR INSERT TO authenticated
    WITH CHECK (reporter_id = (SELECT auth.uid()) OR public.is_admin());

-- notifications: Own non-deleted notifications
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
    FOR SELECT TO authenticated
    USING (
        (user_id = (SELECT auth.uid()) AND deleted_at IS NULL) OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- notification_preferences: Own preferences
DROP POLICY IF EXISTS "notif_pref_select_own" ON public.notification_preferences;
CREATE POLICY "notif_pref_select_own" ON public.notification_preferences
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "notif_pref_insert_own" ON public.notification_preferences;
CREATE POLICY "notif_pref_insert_own" ON public.notification_preferences
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "notif_pref_update_own" ON public.notification_preferences;
CREATE POLICY "notif_pref_update_own" ON public.notification_preferences
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin());

-- job_runs: Admin only
DROP POLICY IF EXISTS "job_runs_select_admin" ON public.job_runs;
CREATE POLICY "job_runs_select_admin" ON public.job_runs
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 4. Enable Supabase Realtime
DO $$
BEGIN
    -- Configure publication tables for Realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 5. Grant Function Execution Privileges
GRANT EXECUTE ON FUNCTION public.client_raise_dispute(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_fast_forward(TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_review_reminders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_approve_overdue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_due_payouts() TO authenticated;

GRANT EXECUTE ON FUNCTION public.start_conversation(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_delivered(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_conversation_flags(UUID, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_conversation(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_notification(UUID, public.notification_type, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read(public.notification_type) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_delete_notification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.announce_system(TEXT, TEXT, TEXT) TO authenticated;

