-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 3
-- 014_engagements_schema.sql
-- Active Work Schema: Engagements, Milestones, Submissions, Time, Invoices, Events
-- ==============================================================================

-- Drop tables if needed for clean re-run
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.disputes CASCADE;
DROP TABLE IF EXISTS public.engagement_events CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.milestone_comments CASCADE;
DROP TABLE IF EXISTS public.submission_files CASCADE;
DROP TABLE IF EXISTS public.milestone_submissions CASCADE;
DROP TABLE IF EXISTS public.engagement_milestones CASCADE;
DROP TABLE IF EXISTS public.engagements CASCADE;

-- 1. Engagements Table
CREATE TABLE public.engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL UNIQUE REFERENCES public.proposals(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    payment_type public.payment_type NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00,
    hourly_rate NUMERIC(10, 2) CHECK (hourly_rate IS NULL OR hourly_rate > 0),
    weekly_hours_cap NUMERIC(4, 1) CHECK (weekly_hours_cap IS NULL OR weekly_hours_cap > 0),
    status public.engagement_status NOT NULL DEFAULT 'active',
    terms_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Engagement Milestones Table
CREATE TABLE public.engagement_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT,
    deliverables TEXT[] NOT NULL DEFAULT '{}'::text[],
    billing_trigger TEXT,
    fee_percent NUMERIC(5, 2) NOT NULL CHECK (fee_percent > 0 AND fee_percent <= 100),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    due_date DATE,
    status public.milestone_status NOT NULL DEFAULT 'awaiting_funding',
    payout_status public.payout_status NOT NULL DEFAULT 'not_due',
    funded_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    revision_count INT NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Milestone Submissions Table (Versions)
CREATE TABLE public.milestone_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES public.engagement_milestones(id) ON DELETE CASCADE,
    version INT NOT NULL CHECK (version >= 1),
    notes TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    client_response TEXT CHECK (client_response IS NULL OR client_response IN ('approved', 'revision_requested')),
    response_comment TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_milestone_version UNIQUE (milestone_id, version)
);

-- 4. Submission Files Table
CREATE TABLE public.submission_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.milestone_submissions(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Milestone Comments Table (Revision thread)
CREATE TABLE public.milestone_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    milestone_id UUID NOT NULL REFERENCES public.engagement_milestones(id) ON DELETE CASCADE,
    submission_id UUID REFERENCES public.milestone_submissions(id) ON DELETE SET NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Time Entries Table (Hourly contracts)
CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    work_date DATE NOT NULL,
    hours NUMERIC(4, 2) NOT NULL CHECK (hours >= 0.25 AND hours <= 12 AND mod(hours * 100, 25) = 0),
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    status public.time_entry_status NOT NULL DEFAULT 'draft',
    week_start DATE NOT NULL,
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    dispute_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Trigger to automatically populate week_start on time_entries
CREATE OR REPLACE FUNCTION public.set_time_entry_week_start()
RETURNS TRIGGER AS $$
BEGIN
    NEW.week_start := DATE_TRUNC('week', NEW.work_date)::DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_time_entry_week_start
BEFORE INSERT OR UPDATE OF work_date ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.set_time_entry_week_start();

-- 7. Invoices Table (Weekly billing for hourly contracts)
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    hours_total NUMERIC(6, 2) NOT NULL CHECK (hours_total > 0),
    hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate > 0),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    status public.invoice_status NOT NULL DEFAULT 'pending_approval',
    number TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_engagement_invoice_week UNIQUE (engagement_id, week_start)
);

-- 8. Engagement Events Table (Activity audit log)
CREATE TABLE public.engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    event_type TEXT NOT NULL,
    milestone_id UUID REFERENCES public.engagement_milestones(id) ON DELETE SET NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. Disputes Table
CREATE TABLE public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.engagement_milestones(id) ON DELETE SET NULL,
    raised_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    details TEXT NOT NULL CHECK (length(trim(details)) > 0),
    status public.dispute_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

-- 10. Support Tickets Table
CREATE TABLE public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    engagement_id UUID REFERENCES public.engagements(id) ON DELETE SET NULL,
    type public.ticket_type NOT NULL,
    subject TEXT NOT NULL CHECK (length(trim(subject)) > 0),
    details TEXT NOT NULL CHECK (length(trim(details)) > 0),
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes on ALL Foreign Keys and Search Columns
CREATE INDEX IF NOT EXISTS idx_engagements_project_id ON public.engagements(project_id);
CREATE INDEX IF NOT EXISTS idx_engagements_proposal_id ON public.engagements(proposal_id);
CREATE INDEX IF NOT EXISTS idx_engagements_client_id ON public.engagements(client_id);
CREATE INDEX IF NOT EXISTS idx_engagements_designer_id ON public.engagements(designer_id);
CREATE INDEX IF NOT EXISTS idx_engagements_status ON public.engagements(status);

CREATE INDEX IF NOT EXISTS idx_engagement_milestones_engagement_id ON public.engagement_milestones(engagement_id);
CREATE INDEX IF NOT EXISTS idx_engagement_milestones_status ON public.engagement_milestones(status);
CREATE INDEX IF NOT EXISTS idx_engagement_milestones_payout_status ON public.engagement_milestones(payout_status);

CREATE INDEX IF NOT EXISTS idx_milestone_submissions_milestone_id ON public.milestone_submissions(milestone_id);
CREATE INDEX IF NOT EXISTS idx_submission_files_submission_id ON public.submission_files(submission_id);
CREATE INDEX IF NOT EXISTS idx_milestone_comments_milestone_id ON public.milestone_comments(milestone_id);
CREATE INDEX IF NOT EXISTS idx_milestone_comments_author_id ON public.milestone_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_engagement_id ON public.time_entries(engagement_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_designer_id ON public.time_entries(designer_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_week_start ON public.time_entries(week_start);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON public.time_entries(status);

CREATE INDEX IF NOT EXISTS idx_invoices_engagement_id ON public.invoices(engagement_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

CREATE INDEX IF NOT EXISTS idx_engagement_events_engagement_id ON public.engagement_events(engagement_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_actor_id ON public.engagement_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_engagement_events_milestone_id ON public.engagement_events(milestone_id);

CREATE INDEX IF NOT EXISTS idx_disputes_engagement_id ON public.disputes(engagement_id);
CREATE INDEX IF NOT EXISTS idx_disputes_raised_by ON public.disputes(raised_by);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_engagement_id ON public.support_tickets(engagement_id);
