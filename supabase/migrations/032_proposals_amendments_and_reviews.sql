-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROPOSAL REVIEW & REVIEWS SCHEMA
-- 032_proposals_amendments_and_reviews.sql
-- Missing Proposal Terms, Decline Reasons, Reviews & Ratings
-- ==============================================================================

-- 1. Enums for Proposal Terms & Decline Reasons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reimbursable_expenses_type') THEN
        CREATE TYPE public.reimbursable_expenses_type AS ENUM ('none', 'at_cost', 'capped');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decline_reason_code') THEN
        CREATE TYPE public.decline_reason_code AS ENUM (
            'price_too_high',
            'timeline_too_long',
            'not_enough_experience',
            'chose_another_designer',
            'project_changed',
            'other'
        );
    END IF;
END $$;

-- 2. Add Missing Terms to Proposals Table
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS assumptions TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS reimbursable_expenses_type public.reimbursable_expenses_type NOT NULL DEFAULT 'none',
    ADD COLUMN IF NOT EXISTS reimbursable_cap NUMERIC(12, 2) CHECK (reimbursable_cap IS NULL OR reimbursable_cap >= 0),
    ADD COLUMN IF NOT EXISTS additional_services_rate NUMERIC(10, 2) CHECK (additional_services_rate IS NULL OR additional_services_rate > 0),
    ADD COLUMN IF NOT EXISTS included_revisions_per_phase INT NOT NULL DEFAULT 2 CHECK (included_revisions_per_phase >= 0),
    ADD COLUMN IF NOT EXISTS decline_reason_code public.decline_reason_code,
    ADD COLUMN IF NOT EXISTS decline_note TEXT CHECK (char_length(decline_note) <= 1000),
    ADD COLUMN IF NOT EXISTS question_answered_at TIMESTAMPTZ;

-- 3. Extend Notification Types
DO $$
BEGIN
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'proposal_question_answered';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_ready_to_sign';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_signed_by_other_party';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_active';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_expired';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_cancelled';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_received';
    ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_reply';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL UNIQUE REFERENCES public.engagements(id) ON DELETE RESTRICT,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    communication_rating INT CHECK (communication_rating IS NULL OR (communication_rating >= 1 AND communication_rating <= 5)),
    quality_rating INT CHECK (quality_rating IS NULL OR (quality_rating >= 1 AND quality_rating <= 5)),
    timeliness_rating INT CHECK (timeliness_rating IS NULL OR (timeliness_rating >= 1 AND timeliness_rating <= 5)),
    comment TEXT NOT NULL CHECK (char_length(trim(comment)) >= 10 AND char_length(comment) <= 1500),
    would_hire_again BOOLEAN NOT NULL DEFAULT true,
    designer_reply TEXT CHECK (char_length(designer_reply) <= 800),
    replied_at TIMESTAMPTZ,
    reply_editable_until TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
    hidden_reason TEXT,
    hidden_by UUID REFERENCES public.profiles(id),
    hidden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    editable_until TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_reviews_designer_id ON public.reviews (designer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews (client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_engagement_id ON public.reviews (engagement_id);

