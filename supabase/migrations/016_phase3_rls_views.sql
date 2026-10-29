-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 3
-- 016_phase3_rls_views.sql
-- Row Level Security and Permissions for Active Work
-- Deny by default, mutations only via SECURITY DEFINER functions
-- ==============================================================================

-- 1. Revoke Direct Mutations from authenticated and anon
REVOKE INSERT, UPDATE, DELETE ON public.engagements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.engagement_milestones FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.milestone_submissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.submission_files FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.milestone_comments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.time_entries FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.engagement_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.disputes FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.support_tickets FROM anon, authenticated;

-- Allow SELECT on tables for authenticated users (guarded by RLS)
GRANT SELECT ON public.engagements TO authenticated;
GRANT SELECT ON public.engagement_milestones TO authenticated;
GRANT SELECT ON public.milestone_submissions TO authenticated;
GRANT SELECT ON public.submission_files TO authenticated;
GRANT SELECT ON public.milestone_comments TO authenticated;
GRANT SELECT ON public.time_entries TO authenticated;
GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT ON public.engagement_events TO authenticated;
GRANT SELECT ON public.disputes TO authenticated;
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;

-- 2. Enable Row Level Security (RLS) on All Tables
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (Deny by default, (SELECT auth.uid()) party checks)

-- engagements: Both parties and admin
DROP POLICY IF EXISTS "engagements_select_parties" ON public.engagements;
CREATE POLICY "engagements_select_parties" ON public.engagements
    FOR SELECT TO authenticated
    USING (
        client_id = (SELECT auth.uid()) OR
        designer_id = (SELECT auth.uid()) OR
        public.is_admin()
    );

-- engagement_milestones: Inherits party access from engagement
DROP POLICY IF EXISTS "engagement_milestones_select_parties" ON public.engagement_milestones;
CREATE POLICY "engagement_milestones_select_parties" ON public.engagement_milestones
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = engagement_milestones.engagement_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- milestone_submissions: Inherits party access
DROP POLICY IF EXISTS "milestone_submissions_select_parties" ON public.milestone_submissions;
CREATE POLICY "milestone_submissions_select_parties" ON public.milestone_submissions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagement_milestones em
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE em.id = milestone_submissions.milestone_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- submission_files: Inherits party access
DROP POLICY IF EXISTS "submission_files_select_parties" ON public.submission_files;
CREATE POLICY "submission_files_select_parties" ON public.submission_files
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.milestone_submissions ms
            JOIN public.engagement_milestones em ON em.id = ms.milestone_id
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE ms.id = submission_files.submission_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- milestone_comments: Inherits party access
DROP POLICY IF EXISTS "milestone_comments_select_parties" ON public.milestone_comments;
CREATE POLICY "milestone_comments_select_parties" ON public.milestone_comments
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagement_milestones em
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE em.id = milestone_comments.milestone_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- time_entries: Both parties and admin
DROP POLICY IF EXISTS "time_entries_select_parties" ON public.time_entries;
CREATE POLICY "time_entries_select_parties" ON public.time_entries
    FOR SELECT TO authenticated
    USING (
        designer_id = (SELECT auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = time_entries.engagement_id
              AND (e.client_id = (SELECT auth.uid()) OR public.is_admin())
        )
    );

-- invoices: Both parties and admin
DROP POLICY IF EXISTS "invoices_select_parties" ON public.invoices;
CREATE POLICY "invoices_select_parties" ON public.invoices
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = invoices.engagement_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- engagement_events: Both parties and admin
DROP POLICY IF EXISTS "engagement_events_select_parties" ON public.engagement_events;
CREATE POLICY "engagement_events_select_parties" ON public.engagement_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = engagement_events.engagement_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- disputes: Both parties and admin
DROP POLICY IF EXISTS "disputes_select_parties" ON public.disputes;
CREATE POLICY "disputes_select_parties" ON public.disputes
    FOR SELECT TO authenticated
    USING (
        raised_by = (SELECT auth.uid()) OR
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = disputes.engagement_id
              AND (
                  e.client_id = (SELECT auth.uid()) OR
                  e.designer_id = (SELECT auth.uid()) OR
                  public.is_admin()
              )
        )
    );

-- support_tickets: Creator and admin
DROP POLICY IF EXISTS "support_tickets_select_user" ON public.support_tickets;
CREATE POLICY "support_tickets_select_user" ON public.support_tickets
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid()) OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "support_tickets_insert_user" ON public.support_tickets;
CREATE POLICY "support_tickets_insert_user" ON public.support_tickets
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid()) OR
        public.is_admin()
    );

-- 4. Grant Function Execution Privileges
GRANT EXECUTE ON FUNCTION public.accept_proposal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_fund_milestone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_release_milestone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_milestone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_milestone(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_milestone_comment(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_time(UUID, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_time_entry(UUID, DATE, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_time_entry(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_week(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_milestone(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_revision(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_week(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_pay_invoice(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_week(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_engagement(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.raise_dispute(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_engagement(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(UUID, public.ticket_type, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_designer_dashboard() TO authenticated;
