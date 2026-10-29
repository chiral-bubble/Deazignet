-- ==============================================================================
-- DEZIGNET SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Production-ready schema matching docs/data-model-notes.md
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. DESIGNERS (Profiles)
CREATE TABLE IF NOT EXISTS public.designers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_url TEXT,
    professional_title TEXT NOT NULL,
    professional_type TEXT NOT NULL DEFAULT 'Architect',
    company_name TEXT,
    location JSONB NOT NULL DEFAULT '{"city": "Rotterdam", "country": "Netherlands"}'::jsonb,
    email TEXT NOT NULL,
    phone TEXT,
    languages TEXT[] NOT NULL DEFAULT ARRAY['English']::TEXT[],
    years_of_experience INTEGER NOT NULL DEFAULT 5,
    about TEXT NOT NULL DEFAULT '',
    specializations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    hide_rate_from_peers BOOLEAN NOT NULL DEFAULT FALSE,
    show_in_search BOOLEAN NOT NULL DEFAULT TRUE,
    is_available_for_projects BOOLEAN NOT NULL DEFAULT TRUE,
    availability_note TEXT,
    member_since TEXT NOT NULL DEFAULT '2023',
    stats JSONB NOT NULL DEFAULT '{"projectsCompleted": 0, "averageRating": 5.0, "reviewCount": 0, "responseTime": "< 2 hours"}'::jsonb,
    current_plan_id TEXT NOT NULL DEFAULT 'basic',
    plan_billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
    portfolio JSONB NOT NULL DEFAULT '[]'::jsonb,
    reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
    sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
    notification_prefs JSONB NOT NULL DEFAULT '{"email": {}, "inApp": {}}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PROJECTS (Client Marketplace Commissions)
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    budget NUMERIC(12, 2) NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('Milestone', 'Hourly')),
    timeline TEXT NOT NULL,
    deadline TEXT NOT NULL,
    posted_date TEXT NOT NULL,
    area NUMERIC(10, 2) NOT NULL DEFAULT 0,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    client JSONB NOT NULL,
    reference_images JSONB NOT NULL DEFAULT '[]'::jsonb,
    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
    hourly_rate NUMERIC(10, 2),
    estimated_hours NUMERIC(10, 2),
    proposals_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PROPOSALS (Designer Submissions)
CREATE TABLE IF NOT EXISTS public.proposals (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    project_title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_location TEXT,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('Milestone', 'Hourly')),
    proposed_price NUMERIC(12, 2) NOT NULL,
    client_budget NUMERIC(12, 2),
    delivery_time TEXT NOT NULL,
    sent_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    status_hint TEXT,
    cover_letter TEXT NOT NULL,
    phases JSONB NOT NULL DEFAULT '[]'::jsonb,
    hourly_rate NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACTIVE PROJECTS (Awarded Contracts)
CREATE TABLE IF NOT EXISTS public.active_projects (
    id TEXT PRIMARY KEY,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_company TEXT,
    client_location TEXT NOT NULL,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('Milestone', 'Hourly')),
    status TEXT NOT NULL DEFAULT 'awaiting_deliverable',
    status_label TEXT NOT NULL,
    category TEXT NOT NULL,
    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_milestone_name TEXT,
    completed_milestones_count INTEGER NOT NULL DEFAULT 0,
    total_milestones_count INTEGER NOT NULL DEFAULT 0,
    next_deadline TEXT,
    relative_deadline TEXT,
    escrow_current_milestone NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_deliverable_due BOOLEAN NOT NULL DEFAULT FALSE,
    has_uploaded_deliverable BOOLEAN NOT NULL DEFAULT FALSE,
    awaiting_review BOOLEAN NOT NULL DEFAULT FALSE,
    hours_this_week NUMERIC(8, 2) DEFAULT 0,
    hourly_rate NUMERIC(10, 2) DEFAULT 0,
    unbilled_amount NUMERIC(12, 2) DEFAULT 0,
    total_hours_logged NUMERIC(8, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TIME LOGS
CREATE TABLE IF NOT EXISTS public.time_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES public.active_projects(id) ON DELETE CASCADE,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    hours NUMERIC(6, 2) NOT NULL,
    description TEXT NOT NULL,
    rate NUMERIC(10, 2) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'unbilled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    project_title TEXT,
    client_name TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    date TEXT NOT NULL,
    client_name TEXT NOT NULL,
    project_title TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'paid',
    download_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. PAYOUT ACCOUNTS
CREATE TABLE IF NOT EXISTS public.payout_accounts (
    id TEXT PRIMARY KEY,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'bank_account',
    bank_name TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number_masked TEXT NOT NULL,
    routing_number TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    country TEXT NOT NULL DEFAULT 'US',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    client_name TEXT NOT NULL,
    client_company TEXT,
    client_avatar TEXT,
    project_id TEXT,
    project_title TEXT,
    project_status TEXT,
    project_budget NUMERIC(12, 2),
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_message TEXT,
    last_message_time TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('designer', 'client')),
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id TEXT PRIMARY KEY,
    designer_id TEXT REFERENCES public.designers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    relative_time TEXT NOT NULL,
    is_unread BOOLEAN NOT NULL DEFAULT TRUE,
    action_link_text TEXT,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. DESIGNER BALANCES
CREATE TABLE IF NOT EXISTS public.designer_balances (
    designer_id TEXT PRIMARY KEY REFERENCES public.designers(id) ON DELETE CASCADE,
    available_to_withdraw NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pending_release NUMERIC(12, 2) NOT NULL DEFAULT 0,
    in_escrow NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS) Configuration
ALTER TABLE public.designers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designer_balances ENABLE ROW LEVEL SECURITY;

-- Allow Public/Anon Read for Marketplace & Profiles, Full Access with Anon/Service Key for development
DROP POLICY IF EXISTS "Public can view marketplace projects" ON public.projects;
CREATE POLICY "Public can view marketplace projects" ON public.projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view designers" ON public.designers;
CREATE POLICY "Public can view designers" ON public.designers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service and Anon Access designers" ON public.designers;
CREATE POLICY "Service and Anon Access designers" ON public.designers FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access projects" ON public.projects;
CREATE POLICY "Service and Anon Access projects" ON public.projects FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access proposals" ON public.proposals;
CREATE POLICY "Service and Anon Access proposals" ON public.proposals FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access active_projects" ON public.active_projects;
CREATE POLICY "Service and Anon Access active_projects" ON public.active_projects FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access time_logs" ON public.time_logs;
CREATE POLICY "Service and Anon Access time_logs" ON public.time_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access transactions" ON public.transactions;
CREATE POLICY "Service and Anon Access transactions" ON public.transactions FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access invoices" ON public.invoices;
CREATE POLICY "Service and Anon Access invoices" ON public.invoices FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access payout_accounts" ON public.payout_accounts;
CREATE POLICY "Service and Anon Access payout_accounts" ON public.payout_accounts FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access conversations" ON public.conversations;
CREATE POLICY "Service and Anon Access conversations" ON public.conversations FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access messages" ON public.messages;
CREATE POLICY "Service and Anon Access messages" ON public.messages FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access notifications" ON public.notifications;
CREATE POLICY "Service and Anon Access notifications" ON public.notifications FOR ALL USING (true);

DROP POLICY IF EXISTS "Service and Anon Access designer_balances" ON public.designer_balances;
CREATE POLICY "Service and Anon Access designer_balances" ON public.designer_balances FOR ALL USING (true);

