-- ==============================================================================
-- DEZIGNET SUPABASE CONSOLIDATED MIGRATION (032 THROUGH 035)
-- Proposal Review & Comparison, Bilateral Contracts & Signatures, Reviews & Dashboard
-- ==============================================================================

-- >>> START dezignet/supabase/migrations/032_proposals_amendments_and_reviews.sql <<<
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


-- >>> START dezignet/supabase/migrations/033_contracts_schema.sql <<<
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CONTRACTS SCHEMA
-- 033_contracts_schema.sql
-- Professional Architectural Services Agreement Architecture, Signatures & Sequence
-- ==============================================================================

-- 1. Extend Status Enums
DO $$
BEGIN
    ALTER TYPE public.engagement_status ADD VALUE IF NOT EXISTS 'pending_signature';
    ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
        CREATE TYPE public.contract_status AS ENUM (
            'awaiting_signatures',
            'partially_signed',
            'active',
            'completed',
            'cancelled',
            'expired'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signature_style_type') THEN
        CREATE TYPE public.signature_style_type AS ENUM ('typed', 'drawn');
    END IF;
END $$;

-- 2. Contract Terms Versions (Standard platform legal templates)
CREATE TABLE IF NOT EXISTS public.contract_terms_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed Initial Contract Standard Terms Version
INSERT INTO public.contract_terms_versions (version, title, body_markdown)
VALUES (
    '2026.1',
    'Standard Terms of Professional Architectural & Design Services',
    '### Placeholder: to be reviewed and replaced by legal counsel before launch

1. **Ownership of Work Product & License on Payment**: Upon receipt of full payment for each milestone, the Designer grants the Client an exclusive, perpetual, irrevocable license to use the Deliverables for the construction, maintenance, and marketing of the specified project. Preliminary sketches and unapproved drafts remain the intellectual property of the Designer.

2. **Confidentiality & Non-Disclosure**: Both parties agree to maintain the confidentiality of proprietary site information, financial terms, and private access instructions. Public portfolio rights apply only to non-confidential visual renders upon milestone completion.

3. **Termination & Suspension**: Either party may terminate or suspend services with 14 calendar days written notice. In the event of suspension for non-payment, the Designer shall resume work within 5 business days of funding receipt.

4. **Revisions & Change Orders**: Revisions in excess of the specified included revisions per phase constitute Additional Services and shall be billed at the agreed hourly rate or an agreed supplementary fee.

5. **Liability Limits**: To the fullest extent permitted by applicable law, Designer liability is capped at the total fee received for the specific engagement. Neither party shall be liable for indirect or consequential damages.

6. **Dispute Resolution & Escalation**: In the event of a dispute, the parties shall first submit to the Dezignet platform mediation protocol. Escrowed funds shall remain frozen pending resolution.

7. **Governing Law & Jurisdiction**: This Agreement shall be governed by the laws of the jurisdiction where the project site is situated.

8. **Platform Role**: Dezignet acts as an independent platform escrow agent and technology venue, and is not a party to the direct design contract.'
)
ON CONFLICT (version) DO NOTHING;

-- 3. Contract Number Sequence (DZ-YYYY-####)
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START WITH 1001;

-- 4. Contracts Table (Immutable Snapshot)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL UNIQUE REFERENCES public.engagements(id) ON DELETE RESTRICT,
    number TEXT NOT NULL UNIQUE,
    status public.contract_status NOT NULL DEFAULT 'awaiting_signatures',
    terms_version_id UUID NOT NULL REFERENCES public.contract_terms_versions(id) ON DELETE RESTRICT,
    content JSONB NOT NULL,
    content_hash TEXT NOT NULL,
    pdf_file_id UUID REFERENCES public.files(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_contracts_engagement_id ON public.contracts (engagement_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts (status);

-- 5. Contract Signatures (Bilateral)
CREATE TABLE IF NOT EXISTS public.contract_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    signer_role public.user_role NOT NULL,
    typed_name TEXT NOT NULL,
    signature_style public.signature_style_type NOT NULL DEFAULT 'typed',
    signature_file_id UUID REFERENCES public.files(id),
    signed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ip_address INET,
    user_agent TEXT,
    content_hash_at_signing TEXT NOT NULL,
    CONSTRAINT uq_contract_signer UNIQUE (contract_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signer ON public.contract_signatures (signer_id);

-- 6. Contract Settings
INSERT INTO public.app_settings (key, value, description)
VALUES ('contract_sign_deadline_days', '7'::jsonb, 'Number of days parties have to sign a prepared contract before expiration')
ON CONFLICT (key) DO NOTHING;

-- 7. Contracts Storage Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'contracts',
    'contracts',
    false,
    15728640, -- 15 MB
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;


-- >>> START dezignet/supabase/migrations/034_proposals_contracts_reviews_functions.sql <<<
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - FUNCTIONS
-- 034_proposals_contracts_reviews_functions.sql
-- Proposal Review, Bilateral Contract Execution, Reviews, and Client Dashboard RPCs
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. get_project_proposals(p_project_id, p_status, p_search, p_sort)
-- Owner only. Returns list of proposals with designer summary & offer comparison
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_project_proposals(
    p_project_id UUID,
    p_status TEXT DEFAULT 'all',
    p_search TEXT DEFAULT NULL,
    p_sort TEXT DEFAULT 'newest'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_result JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can view proposals.' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_agg(sub.item)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'id', prop.id,
            'project_id', prop.project_id,
            'designer_id', prop.designer_id,
            'status', prop.status,
            'total_price', prop.total_price,
            'currency', prop.currency,
            'delivery_days', prop.delivery_days,
            'included_revisions_per_phase', prop.included_revisions_per_phase,
            'sent_at', prop.sent_at,
            'viewed_at', prop.viewed_at,
            'is_unviewed', (prop.viewed_at IS NULL),
            'cover_letter_preview', SUBSTRING(prop.cover_letter FROM 1 FOR 160),
            'price_diff_percent', CASE
                WHEN v_proj.design_budget > 0 THEN
                    ROUND(((prop.total_price - v_proj.design_budget) / v_proj.design_budget) * 100, 1)
                ELSE 0
            END,
            'designer', jsonb_build_object(
                'id', p.id,
                'full_name', p.full_name,
                'avatar_path', p.avatar_path,
                'city', p.location,
                'state_region', p.location,
                'title', dp.title,
                'studio_name', dp.studio_name,
                'professional_type', dp.professional_type,
                'years_experience', dp.years_experience,
                'rating_average', COALESCE(
                    (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews r WHERE r.designer_id = p.id AND r.status = 'visible'),
                    0
                ),
                'rating_count', COALESCE(
                    (SELECT COUNT(*)::INT FROM public.reviews r WHERE r.designer_id = p.id AND r.status = 'visible'),
                    0
                ),
                'verified', COALESCE(
                    (SELECT COUNT(*) > 0 FROM public.credentials c WHERE c.designer_id = p.id AND c.status = 'verified'),
                    false
                )
            )
        ) AS item
        FROM public.proposals prop
        JOIN public.profiles p ON p.id = prop.designer_id
        LEFT JOIN public.designer_profiles dp ON dp.user_id = prop.designer_id
        WHERE prop.project_id = p_project_id
          AND (
              p_status = 'all'
              OR (p_status = 'new' AND prop.status IN ('pending') AND prop.viewed_at IS NULL)
              OR (p_status = 'viewed' AND prop.viewed_at IS NOT NULL AND prop.status IN ('pending', 'viewed'))
              OR prop.status::TEXT = p_status
          )
          AND (
              p_search IS NULL OR char_length(trim(p_search)) = 0
              OR p.full_name ILIKE ('%' || trim(p_search) || '%')
              OR dp.studio_name ILIKE ('%' || trim(p_search) || '%')
          )
        ORDER BY
            CASE WHEN p_sort = 'newest' THEN prop.sent_at END DESC NULLS LAST,
            CASE WHEN p_sort = 'lowest_price' THEN prop.total_price END ASC NULLS LAST,
            CASE WHEN p_sort = 'fastest_delivery' THEN prop.delivery_days END ASC NULLS LAST
    ) sub;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. get_proposal(p_proposal_id)
-- Owner only. Full detail without auto-marking viewed
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_proposal(p_proposal_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_prop RECORD;
    v_proj RECORD;
    v_milestones JSONB;
    v_portfolio JSONB;
    v_timeline JSONB;
    v_result JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND v_prop.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
    END IF;

    -- Fetch milestone breakdown
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', pm.id,
            'name', pm.name,
            'description', pm.description,
            'deliverables', pm.deliverables,
            'billing_trigger', pm.billing_trigger,
            'fee_percent', pm.fee_percent,
            'amount', ROUND((v_prop.total_price * pm.fee_percent / 100), 2)
        )
        ORDER BY pm.sort_order ASC
    )
    INTO v_milestones
    FROM public.project_milestones pm
    WHERE pm.project_id = v_proj.id;

    -- Fetch attached portfolio items
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', pp.id,
            'title', pp.title,
            'cover_image_path', pp.cover_image_path,
            'category', pp.category,
            'description', pp.description
        )
    )
    INTO v_portfolio
    FROM public.portfolio_projects pp
    WHERE pp.designer_id = v_prop.designer_id
    LIMIT 4;

    -- Build status timeline
    v_timeline := jsonb_build_array(
        jsonb_build_object('event', 'Sent', 'timestamp', v_prop.sent_at),
        CASE WHEN v_prop.viewed_at IS NOT NULL THEN
            jsonb_build_object('event', 'Viewed by client', 'timestamp', v_prop.viewed_at)
        ELSE NULL END,
        CASE WHEN v_prop.question_answered_at IS NOT NULL THEN
            jsonb_build_object('event', 'Question answered', 'timestamp', v_prop.question_answered_at)
        ELSE NULL END,
        CASE WHEN v_prop.decided_at IS NOT NULL THEN
            jsonb_build_object('event', 'Decision: ' || v_prop.status::text, 'timestamp', v_prop.decided_at)
        ELSE NULL END
    );

    SELECT jsonb_build_object(
        'id', v_prop.id,
        'project_id', v_prop.project_id,
        'designer_id', v_prop.designer_id,
        'status', v_prop.status,
        'cover_letter', v_prop.cover_letter,
        'total_price', v_prop.total_price,
        'currency', v_prop.currency,
        'delivery_days', v_prop.delivery_days,
        'hourly_rate', v_prop.hourly_rate,
        'estimated_hours', v_prop.estimated_hours,
        'assumptions', v_prop.assumptions,
        'exclusions', v_prop.exclusions,
        'reimbursable_expenses_type', v_prop.reimbursable_expenses_type,
        'reimbursable_cap', v_prop.reimbursable_cap,
        'additional_services_rate', v_prop.additional_services_rate,
        'included_revisions_per_phase', v_prop.included_revisions_per_phase,
        'question_for_client', v_prop.question_for_client,
        'client_answer', v_prop.client_answer,
        'question_answered_at', v_prop.question_answered_at,
        'sent_at', v_prop.sent_at,
        'viewed_at', v_prop.viewed_at,
        'decided_at', v_prop.decided_at,
        'decline_reason_code', v_prop.decline_reason_code,
        'decline_note', v_prop.decline_note,
        'withdraw_reason', v_prop.withdraw_reason,
        'milestones', COALESCE(v_milestones, '[]'::jsonb),
        'portfolio_items', COALESCE(v_portfolio, '[]'::jsonb),
        'timeline', v_timeline,
        'price_diff_percent', CASE
            WHEN v_proj.design_budget > 0 THEN
                ROUND(((v_prop.total_price - v_proj.design_budget) / v_proj.design_budget) * 100, 1)
            ELSE 0
        END,
        'designer', jsonb_build_object(
            'id', p.id,
            'full_name', p.full_name,
            'avatar_path', p.avatar_path,
            'location', p.location,
            'title', dp.title,
            'studio_name', dp.studio_name,
            'professional_type', dp.professional_type,
            'years_experience', dp.years_experience,
            'rating_average', COALESCE(
                (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews r WHERE r.designer_id = p.id AND r.status = 'visible'),
                0
            ),
            'rating_count', COALESCE(
                (SELECT COUNT(*)::INT FROM public.reviews r WHERE r.designer_id = p.id AND r.status = 'visible'),
                0
            ),
            'verified', COALESCE(
                (SELECT COUNT(*) > 0 FROM public.credentials c WHERE c.designer_id = p.id AND c.status = 'verified'),
                false
            )
        )
    )
    INTO v_result
    FROM public.profiles p
    LEFT JOIN public.designer_profiles dp ON dp.user_id = p.id
    WHERE p.id = v_prop.designer_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. compare_proposals(p_project_id, p_proposal_ids[])
-- Owner only. Side-by-side comparison of 2 to 3 proposals
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compare_proposals(
    p_project_id UUID,
    p_proposal_ids UUID[]
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_count INT;
    v_result JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can compare proposals.' USING ERRCODE = '42501';
    END IF;

    v_count := array_length(p_proposal_ids, 1);
    IF v_count < 2 OR v_count > 3 THEN
        RAISE EXCEPTION 'Comparison requires between 2 and 3 proposals.' USING ERRCODE = 'P0001';
    END IF;

    SELECT jsonb_agg(public.get_proposal(pid))
    INTO v_result
    FROM unnest(p_proposal_ids) AS pid;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. answer_proposal_question(p_proposal_id, p_answer)
-- Owner only. Can edit within 10 minutes; notifies designer
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.answer_proposal_question(
    p_proposal_id UUID,
    p_answer TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_prop RECORD;
    v_proj RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_answer IS NULL OR char_length(trim(p_answer)) = 0 THEN
        RAISE EXCEPTION 'Answer cannot be empty.' USING ERRCODE = 'P0001';
    END IF;

    IF char_length(p_answer) > 1000 THEN
        RAISE EXCEPTION 'Answer cannot exceed 1000 characters.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can answer proposal questions.' USING ERRCODE = '42501';
    END IF;

    v_now := timezone('utc'::text, now());

    -- If already answered, allow editing only within 10 minutes
    IF v_prop.question_answered_at IS NOT NULL AND (v_now - v_prop.question_answered_at) > INTERVAL '10 minutes' THEN
        RAISE EXCEPTION 'The 10-minute editing window for this answer has passed.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET client_answer = trim(p_answer),
        question_answered_at = COALESCE(question_answered_at, v_now),
        updated_at = v_now
    WHERE id = p_proposal_id;

    -- Send notification to designer
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        v_prop.designer_id,
        'proposal_question_answered',
        'Client Answered Your Question',
        'The client has answered your question regarding "' || v_proj.title || '".',
        jsonb_build_object(
            'project_id', v_proj.id,
            'proposal_id', v_prop.id
        )
    );

    RETURN jsonb_build_object('success', true, 'answered_at', v_now);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. decline_proposal(p_proposal_id, p_reason_code, p_note)
-- Extended with structured reason code and optional note
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.decline_proposal CASCADE;
CREATE OR REPLACE FUNCTION public.decline_proposal(
    p_proposal_id UUID,
    p_reason_code public.decline_reason_code DEFAULT 'other',
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_prop RECORD;
    v_proj RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can decline proposals.' USING ERRCODE = '42501';
    END IF;

    IF v_prop.status IN ('accepted', 'declined', 'withdrawn', 'expired') THEN
        RAISE EXCEPTION 'Proposal is already decided or withdrawn.' USING ERRCODE = 'P0001';
    END IF;

    v_now := timezone('utc'::text, now());

    UPDATE public.proposals
    SET status = 'declined',
        decline_reason_code = p_reason_code,
        decline_note = p_note,
        decided_at = v_now,
        updated_at = v_now
    WHERE id = p_proposal_id;

    -- Notify designer
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        v_prop.designer_id,
        'proposal_declined',
        'Proposal Declined',
        'Your proposal for "' || v_proj.title || '" was not selected.',
        jsonb_build_object('project_id', v_proj.id, 'proposal_id', v_prop.id)
    );

    RETURN jsonb_build_object('success', true, 'status', 'declined');
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. create_contract(p_engagement_id)
-- Internal helper called by accept_proposal to generate contract snapshot
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_contract(p_engagement_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_eng RECORD;
    v_proj RECORD;
    v_prop RECORD;
    v_client RECORD;
    v_designer RECORD;
    v_designer_prof RECORD;
    v_terms_ver RECORD;
    v_seq_num BIGINT;
    v_contract_num TEXT;
    v_content JSONB;
    v_hash TEXT;
    v_deadline_days INT;
    v_expires_at TIMESTAMPTZ;
    v_contract_id UUID;
    v_milestones JSONB;
BEGIN
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_eng.project_id;
    SELECT * INTO v_prop FROM public.proposals WHERE id = v_eng.proposal_id;
    SELECT * INTO v_client FROM public.profiles WHERE id = v_eng.client_id;
    SELECT * INTO v_designer FROM public.profiles WHERE id = v_eng.designer_id;
    SELECT * INTO v_designer_prof FROM public.designer_profiles WHERE user_id = v_eng.designer_id;

    -- Fetch latest standard terms version
    SELECT * INTO v_terms_ver
    FROM public.contract_terms_versions
    ORDER BY effective_from DESC
    LIMIT 1;

    -- Generate contract number (DZ-YYYY-####)
    v_seq_num := nextval('public.contract_number_seq');
    v_contract_num := 'DZ-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_seq_num::text, 4, '0');

    -- Deadline from settings
    SELECT COALESCE((value->>0)::INT, 7) INTO v_deadline_days
    FROM public.app_settings
    WHERE key = 'contract_sign_deadline_days';

    v_expires_at := timezone('utc'::text, now()) + (v_deadline_days || ' days')::INTERVAL;

    -- Fetch engagement milestones
    SELECT jsonb_agg(
        jsonb_build_object(
            'phase_number', em.sort_order,
            'name', em.name,
            'deliverables', em.deliverables,
            'billing_trigger', em.billing_trigger,
            'fee_percent', em.fee_percent,
            'amount', em.amount
        )
        ORDER BY em.sort_order ASC
    )
    INTO v_milestones
    FROM public.engagement_milestones em
    WHERE em.engagement_id = v_eng.id;

    -- Assemble 10 canonical contract sections
    v_content := jsonb_build_object(
        'section_1_header', jsonb_build_object(
            'contract_number', v_contract_num,
            'date', CURRENT_DATE,
            'project_title', v_proj.title,
            'category', v_proj.category,
            'subcategory', v_proj.subcategory,
            'client', jsonb_build_object(
                'name', v_client.full_name,
                'location', v_client.location
            ),
            'designer', jsonb_build_object(
                'name', v_designer.full_name,
                'studio_name', v_designer_prof.studio_name,
                'professional_type', v_designer_prof.professional_type,
                'location', v_designer.location
            )
        ),
        'section_2_scope', jsonb_build_object(
            'project_description', v_proj.description,
            'cover_letter', v_prop.cover_letter
        ),
        'section_3_assumptions_exclusions', jsonb_build_object(
            'assumptions', v_prop.assumptions,
            'exclusions', v_prop.exclusions
        ),
        'section_4_compensation', jsonb_build_object(
            'total_price', v_eng.total_price,
            'currency', v_eng.currency,
            'payment_type', v_eng.payment_type,
            'hourly_rate', v_eng.hourly_rate,
            'weekly_hours_cap', v_eng.weekly_hours_cap,
            'milestones', COALESCE(v_milestones, '[]'::jsonb)
        ),
        'section_5_reimbursable_additional', jsonb_build_object(
            'reimbursable_expenses_type', v_prop.reimbursable_expenses_type,
            'reimbursable_cap', v_prop.reimbursable_cap,
            'additional_services_rate', COALESCE(v_prop.additional_services_rate, v_prop.hourly_rate)
        ),
        'section_6_revisions', jsonb_build_object(
            'included_revisions_per_phase', v_prop.included_revisions_per_phase,
            'policy', 'Revisions beyond the included count shall be billed as Additional Services.'
        ),
        'section_7_timeline', jsonb_build_object(
            'delivery_days', v_prop.delivery_days,
            'policy', 'Milestone due dates are computed upon activation and funding of each phase.'
        ),
        'section_8_payment_terms', jsonb_build_object(
            'escrow_funding', 'Milestones must be funded in escrow before design commencement.',
            'review_period_days', 14,
            'security_hold_days', 5,
            'platform_fee_percent', v_eng.platform_fee_percent
        ),
        'section_9_standard_terms', jsonb_build_object(
            'terms_version', v_terms_ver.version,
            'body_markdown', v_terms_ver.body_markdown
        ),
        'section_10_signatures', jsonb_build_object(
            'status', 'awaiting_signatures'
        )
    );

    -- Compute canonical SHA-256 hash of content
    v_hash := encode(digest(v_content::text, 'sha256'), 'hex');

    -- Insert Contract Row
    INSERT INTO public.contracts (
        engagement_id,
        number,
        status,
        terms_version_id,
        content,
        content_hash,
        expires_at
    )
    VALUES (
        v_eng.id,
        v_contract_num,
        'awaiting_signatures',
        v_terms_ver.id,
        v_content,
        v_hash,
        v_expires_at
    )
    RETURNING id INTO v_contract_id;

    RETURN v_contract_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. accept_proposal(p_proposal_id)
-- AMENDED: Creates engagement in 'pending_signature' and contract in 'awaiting_signatures'
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.accept_proposal(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.accept_proposal(p_proposal_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_prop RECORD;
    v_proj RECORD;
    v_fee_pct NUMERIC(5, 2);
    v_hours_cap NUMERIC(4, 1);
    v_engagement_id UUID;
    v_contract_id UUID;
    v_now TIMESTAMPTZ;
    v_pm RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can accept a proposal.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status <> 'open'::public.project_status THEN
        RAISE EXCEPTION 'Only open projects can accept proposals.' USING ERRCODE = 'P0001';
    END IF;

    IF v_prop.status NOT IN ('pending', 'viewed', 'shortlisted') THEN
        RAISE EXCEPTION 'Proposal cannot be accepted in its current state.' USING ERRCODE = 'P0001';
    END IF;

    v_now := timezone('utc'::text, now());

    SELECT COALESCE((value->>0)::NUMERIC, 10.00) INTO v_fee_pct
    FROM public.app_settings
    WHERE key = 'platform_fee_percent';

    SELECT (value->>0)::NUMERIC INTO v_hours_cap
    FROM public.app_settings
    WHERE key = 'weekly_hours_cap_default';

    -- 1. Create Engagement in 'pending_signature' status
    INSERT INTO public.engagements (
        project_id,
        proposal_id,
        client_id,
        designer_id,
        payment_type,
        total_price,
        currency,
        platform_fee_percent,
        hourly_rate,
        weekly_hours_cap,
        status,
        terms_snapshot,
        started_at
    )
    VALUES (
        v_proj.id,
        v_prop.id,
        v_proj.client_id,
        v_prop.designer_id,
        v_proj.payment_type,
        v_prop.total_price,
        v_prop.currency,
        COALESCE(v_fee_pct, 10.00),
        v_prop.hourly_rate,
        v_hours_cap,
        'pending_signature',
        jsonb_build_object(
            'scope', v_prop.cover_letter,
            'assumptions', v_prop.assumptions,
            'exclusions', v_prop.exclusions,
            'delivery_days', v_prop.delivery_days
        ),
        v_now
    )
    RETURNING id INTO v_engagement_id;

    -- 2. Populate Engagement Milestones
    IF v_proj.payment_type = 'milestone' THEN
        FOR v_pm IN (SELECT * FROM public.project_milestones WHERE project_id = v_proj.id ORDER BY sort_order ASC) LOOP
            INSERT INTO public.engagement_milestones (
                engagement_id,
                sort_order,
                name,
                description,
                deliverables,
                billing_trigger,
                fee_percent,
                amount,
                status
            )
            VALUES (
                v_engagement_id,
                v_pm.sort_order,
                v_pm.name,
                v_pm.description,
                v_pm.deliverables,
                v_pm.billing_trigger,
                v_pm.fee_percent,
                ROUND((v_prop.total_price * v_pm.fee_percent / 100), 2),
                'awaiting_funding'
            );
        END LOOP;
    END IF;

    -- 3. Update Accepted Proposal & Decline Other Proposals
    UPDATE public.proposals
    SET status = 'accepted', decided_at = v_now, updated_at = v_now
    WHERE id = p_proposal_id;

    UPDATE public.proposals
    SET status = 'declined',
        decline_reason_code = 'chose_another_designer',
        decline_note = 'Client selected another proposal.',
        decided_at = v_now,
        updated_at = v_now
    WHERE project_id = v_proj.id AND id <> p_proposal_id AND status NOT IN ('withdrawn');

    -- 4. Award Project
    UPDATE public.projects
    SET status = 'awarded', updated_at = v_now
    WHERE id = v_proj.id;

    -- 5. Create Canonical Contract
    v_contract_id := public.create_contract(v_engagement_id);

    -- 6. Notifications
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        v_prop.designer_id,
        'contract_ready_to_sign',
        'Contract Ready for Signature',
        'Your proposal for "' || v_proj.title || '" was accepted! Please review and sign the agreement.',
        jsonb_build_object('project_id', v_proj.id, 'engagement_id', v_engagement_id, 'contract_id', v_contract_id)
    );

    RETURN jsonb_build_object(
        'success', true,
        'engagement_id', v_engagement_id,
        'contract_id', v_contract_id,
        'project_id', v_proj.id
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 8. sign_contract(p_contract_id, p_typed_name, p_signature_style, p_signature_file_id, p_agreed)
-- Bilateral signing. Second signature activates contract & engagement
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sign_contract(
    p_contract_id UUID,
    p_typed_name TEXT,
    p_signature_style public.signature_style_type DEFAULT 'typed',
    p_signature_file_id UUID DEFAULT NULL,
    p_agreed BOOLEAN DEFAULT false,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_contract RECORD;
    v_eng RECORD;
    v_proj RECORD;
    v_user RECORD;
    v_role public.user_role;
    v_other_party_id UUID;
    v_sig_count INT;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT p_agreed THEN
        RAISE EXCEPTION 'You must agree to the contract terms before signing.' USING ERRCODE = 'P0001';
    END IF;

    -- Row lock contract to prevent concurrent race conditions
    SELECT * INTO v_contract
    FROM public.contracts
    WHERE id = p_contract_id
    FOR UPDATE;

    IF v_contract.id IS NULL THEN
        RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_contract.status NOT IN ('awaiting_signatures', 'partially_signed') THEN
        RAISE EXCEPTION 'Contract is not open for signatures (current: %).', v_contract.status USING ERRCODE = 'P0001';
    END IF;

    IF v_contract.expires_at <= timezone('utc'::text, now()) THEN
        RAISE EXCEPTION 'Contract signing deadline has expired.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_contract.engagement_id;
    SELECT * INTO v_proj FROM public.projects WHERE id = v_eng.project_id;
    SELECT * INTO v_user FROM public.profiles WHERE id = v_caller_id;

    -- Determine caller role
    IF v_caller_id = v_eng.client_id THEN
        v_role := 'client';
        v_other_party_id := v_eng.designer_id;
    ELSIF v_caller_id = v_eng.designer_id THEN
        v_role := 'designer';
        v_other_party_id := v_eng.client_id;
    ELSE
        RAISE EXCEPTION 'You are not a party to this contract.' USING ERRCODE = '42501';
    END IF;

    -- Name match verification (case-insensitive, trimmed)
    IF lower(trim(p_typed_name)) <> lower(trim(v_user.full_name)) THEN
        RAISE EXCEPTION 'Typed signature name must match your legal account name (%) exactly.', v_user.full_name
            USING HINT = 'name_mismatch', ERRCODE = 'P0001';
    END IF;

    -- Check if already signed
    IF EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = p_contract_id AND signer_id = v_caller_id) THEN
        RAISE EXCEPTION 'You have already signed this contract.' USING ERRCODE = 'P0001';
    END IF;

    v_now := timezone('utc'::text, now());

    -- Record signature
    INSERT INTO public.contract_signatures (
        contract_id,
        signer_id,
        signer_role,
        typed_name,
        signature_style,
        signature_file_id,
        signed_at,
        ip_address,
        user_agent,
        content_hash_at_signing
    )
    VALUES (
        p_contract_id,
        v_caller_id,
        v_role,
        trim(p_typed_name),
        p_signature_style,
        p_signature_file_id,
        v_now,
        p_ip_address::inet,
        p_user_agent,
        v_contract.content_hash
    );

    SELECT COUNT(*) INTO v_sig_count
    FROM public.contract_signatures
    WHERE contract_id = p_contract_id;

    IF v_sig_count = 1 THEN
        -- First signature
        UPDATE public.contracts
        SET status = 'partially_signed'
        WHERE id = p_contract_id;

        -- Notify other party
        INSERT INTO public.notifications (
            user_id,
            type,
            title,
            body,
            data
        )
        VALUES (
            v_other_party_id,
            'contract_signed_by_other_party',
            'Contract Signed by Other Party',
            v_user.full_name || ' has signed the agreement for "' || v_proj.title || '". Please add your signature to activate.',
            jsonb_build_object('project_id', v_proj.id, 'contract_id', p_contract_id)
        );

        RETURN jsonb_build_object('status', 'partially_signed', 'signatures_count', 1);
    ELSE
        -- Second signature -> ACTIVATE CONTRACT & ENGAGEMENT
        UPDATE public.contracts
        SET status = 'active',
            activated_at = v_now
        WHERE id = p_contract_id;

        UPDATE public.engagements
        SET status = 'active',
            updated_at = v_now
        WHERE id = v_eng.id;

        -- Notify both parties
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES
        (
            v_eng.client_id,
            'contract_active',
            'Contract Active!',
            'Contract ' || v_contract.number || ' is now active. Please fund the first milestone to begin work.',
            jsonb_build_object('project_id', v_proj.id, 'contract_id', p_contract_id)
        ),
        (
            v_eng.designer_id,
            'contract_active',
            'Contract Active!',
            'Contract ' || v_contract.number || ' is now active. Work will commence once the client funds the first milestone.',
            jsonb_build_object('project_id', v_proj.id, 'contract_id', p_contract_id)
        );

        RETURN jsonb_build_object('status', 'active', 'signatures_count', 2, 'activated_at', v_now);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 9. cancel_contract(p_contract_id, p_reason)
-- Either party can cancel before both sign; reopens project
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_contract(
    p_contract_id UUID,
    p_reason TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_contract RECORD;
    v_eng RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_contract FROM public.contracts WHERE id = p_contract_id;
    IF v_contract.id IS NULL THEN
        RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_contract.engagement_id;
    IF v_caller_id <> v_eng.client_id AND v_caller_id <> v_eng.designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
    END IF;

    IF v_contract.status NOT IN ('awaiting_signatures', 'partially_signed') THEN
        RAISE EXCEPTION 'Active or closed contracts cannot be cancelled via this method.' USING ERRCODE = 'P0001';
    END IF;

    v_now := timezone('utc'::text, now());

    UPDATE public.contracts
    SET status = 'cancelled',
        cancelled_at = v_now,
        cancel_reason = p_reason
    WHERE id = p_contract_id;

    UPDATE public.engagements
    SET status = 'cancelled',
        cancelled_at = v_now
    WHERE id = v_eng.id;

    -- Reopen project
    UPDATE public.projects
    SET status = 'open',
        updated_at = v_now
    WHERE id = v_eng.project_id;

    -- Mark accepted proposal as expired
    UPDATE public.proposals
    SET status = 'expired',
        updated_at = v_now
    WHERE id = v_eng.proposal_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelled');
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 10. get_contract(p_engagement_id)
-- Parties or admin only
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_contract(p_engagement_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_contract RECORD;
    v_signatures JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_caller_id <> v_eng.client_id AND v_caller_id <> v_eng.designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_contract FROM public.contracts WHERE engagement_id = p_engagement_id;
    IF v_contract.id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'id', cs.id,
            'signer_id', cs.signer_id,
            'signer_role', cs.signer_role,
            'typed_name', cs.typed_name,
            'signature_style', cs.signature_style,
            'signed_at', cs.signed_at,
            'content_hash_at_signing', cs.content_hash_at_signing
        )
    )
    INTO v_signatures
    FROM public.contract_signatures cs
    WHERE cs.contract_id = v_contract.id;

    RETURN jsonb_build_object(
        'id', v_contract.id,
        'engagement_id', v_contract.engagement_id,
        'number', v_contract.number,
        'status', v_contract.status,
        'content', v_contract.content,
        'content_hash', v_contract.content_hash,
        'created_at', v_contract.created_at,
        'expires_at', v_contract.expires_at,
        'activated_at', v_contract.activated_at,
        'cancelled_at', v_contract.cancelled_at,
        'cancel_reason', v_contract.cancel_reason,
        'signatures', COALESCE(v_signatures, '[]'::jsonb),
        'client_id', v_eng.client_id,
        'designer_id', v_eng.designer_id
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 11. verify_contract(p_contract_id)
-- Recomputes SHA-256 hash and verifies integrity against signatures
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_contract(p_contract_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_contract RECORD;
    v_computed_hash TEXT;
    v_sigs_match BOOLEAN;
BEGIN
    SELECT * INTO v_contract FROM public.contracts WHERE id = p_contract_id;
    IF v_contract.id IS NULL THEN
        RAISE EXCEPTION 'Contract not found.' USING ERRCODE = 'P0002';
    END IF;

    v_computed_hash := encode(digest(v_contract.content::text, 'sha256'), 'hex');

    -- Verify all signature hashes match contract content hash
    SELECT COALESCE(bool_and(content_hash_at_signing = v_contract.content_hash), true)
    INTO v_sigs_match
    FROM public.contract_signatures
    WHERE contract_id = p_contract_id;

    RETURN jsonb_build_object(
        'verified', (v_computed_hash = v_contract.content_hash AND v_sigs_match),
        'stored_hash', v_contract.content_hash,
        'computed_hash', v_computed_hash,
        'signatures_intact', v_sigs_match
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 12. get_site_details(p_project_id)
-- AMENDED: Street & postal code visible to designer ONLY when contract is ACTIVE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_site_details(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_details RECORD;
    v_has_active_contract BOOLEAN;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Check if caller is hired designer on an active contract
    SELECT EXISTS (
        SELECT 1
        FROM public.engagements e
        JOIN public.contracts c ON c.engagement_id = e.id
        WHERE e.project_id = p_project_id
          AND e.designer_id = v_caller_id
          AND c.status = 'active'
    ) INTO v_has_active_contract;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() AND NOT v_has_active_contract THEN
        RAISE EXCEPTION 'Access denied to private site details. Contract must be fully signed and active.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_details FROM public.project_private_details WHERE project_id = p_project_id;
    IF v_details.project_id IS NULL THEN
        RETURN jsonb_build_object(
            'street', NULL,
            'postal_code', NULL,
            'site_notes', NULL,
            'access_instructions', NULL
        );
    END IF;

    RETURN jsonb_build_object(
        'street', v_details.street,
        'postal_code', v_details.postal_code,
        'site_notes', v_details.site_notes,
        'access_instructions', v_details.access_instructions
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 13. dev_fund_milestone(p_milestone_id)
-- AMENDED: Refuses if engagement is still 'pending_signature'
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.dev_fund_milestone(UUID) CASCADE;
CREATE OR REPLACE FUNCTION public.dev_fund_milestone(p_milestone_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_em RECORD;
    v_eng RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_em FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_em.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_em.engagement_id;
    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client can fund milestones.' USING ERRCODE = '42501';
    END IF;

    IF v_eng.status = 'pending_signature' THEN
        RAISE EXCEPTION 'Cannot fund milestones while contract is awaiting signatures.' USING ERRCODE = 'P0001';
    END IF;

    -- Sequential funding check
    IF EXISTS (
        SELECT 1 FROM public.engagement_milestones
        WHERE engagement_id = v_em.engagement_id
          AND sort_order < v_em.sort_order
          AND status IN ('awaiting_funding')
    ) THEN
        RAISE EXCEPTION 'Previous milestones must be funded first.' USING ERRCODE = 'P0001';
    END IF;

    v_now := timezone('utc'::text, now());

    UPDATE public.engagement_milestones
    SET status = 'funded',
        funded_at = v_now,
        payout_status = 'held_in_escrow',
        updated_at = v_now
    WHERE id = p_milestone_id;

    RETURN jsonb_build_object('success', true, 'status', 'funded');
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 14. Reviews Functions
-- create_review, update_review, reply_to_review
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_review(
    p_engagement_id UUID,
    p_rating INT,
    p_comment TEXT,
    p_would_hire_again BOOLEAN DEFAULT true,
    p_communication_rating INT DEFAULT NULL,
    p_quality_rating INT DEFAULT NULL,
    p_timeliness_rating INT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_rev_id UUID;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client can leave a review for this engagement.' USING ERRCODE = '42501';
    END IF;

    IF v_eng.status <> 'completed' THEN
        RAISE EXCEPTION 'Reviews can only be submitted after engagement completion.' USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (SELECT 1 FROM public.reviews WHERE engagement_id = p_engagement_id) THEN
        RAISE EXCEPTION 'A review has already been submitted for this engagement.' USING ERRCODE = 'P0001';
    END IF;

    v_now := timezone('utc'::text, now());

    INSERT INTO public.reviews (
        engagement_id,
        client_id,
        designer_id,
        rating,
        communication_rating,
        quality_rating,
        timeliness_rating,
        comment,
        would_hire_again,
        created_at,
        updated_at,
        editable_until
    )
    VALUES (
        p_engagement_id,
        v_caller_id,
        v_eng.designer_id,
        p_rating,
        p_communication_rating,
        p_quality_rating,
        p_timeliness_rating,
        trim(p_comment),
        p_would_hire_again,
        v_now,
        v_now,
        v_now + INTERVAL '14 days'
    )
    RETURNING id INTO v_rev_id;

    -- Notify designer
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
        v_eng.designer_id,
        'review_received',
        'New Review Received',
        'Your client submitted a review for your recent completed project.',
        jsonb_build_object('review_id', v_rev_id, 'engagement_id', p_engagement_id)
    );

    RETURN jsonb_build_object('success', true, 'review_id', v_rev_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.reply_to_review(
    p_review_id UUID,
    p_reply TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_rev RECORD;
    v_now TIMESTAMPTZ;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rev FROM public.reviews WHERE id = p_review_id;
    IF v_rev.id IS NULL THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_rev.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the reviewed designer can reply.' USING ERRCODE = '42501';
    END IF;

    v_now := timezone('utc'::text, now());

    IF v_rev.replied_at IS NOT NULL AND (v_now - v_rev.replied_at) > INTERVAL '10 minutes' THEN
        RAISE EXCEPTION 'The 10-minute editing window for your reply has expired.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.reviews
    SET designer_reply = trim(p_reply),
        replied_at = COALESCE(replied_at, v_now),
        reply_editable_until = COALESCE(reply_editable_until, v_now + INTERVAL '10 minutes'),
        updated_at = v_now
    WHERE id = p_review_id;

    RETURN jsonb_build_object('success', true, 'replied_at', v_now);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 15. get_client_dashboard()
-- Central Server-Side JSON aggregation for Client Dashboard screen
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_client_dashboard()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_client RECORD;
    v_open_count INT;
    v_new_proposals_count INT;
    v_active_engagements_count INT;
    v_escrow_funds NUMERIC(12, 2);
    v_attention_items JSONB;
    v_active_projects JSONB;
    v_recent_projects JSONB;
    v_upcoming_dates JSONB;
    v_notifications JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_client FROM public.profiles WHERE id = v_caller_id;

    -- Counts
    SELECT COUNT(*)::INT INTO v_open_count
    FROM public.projects
    WHERE client_id = v_caller_id AND status = 'open';

    SELECT COUNT(*)::INT INTO v_new_proposals_count
    FROM public.proposals prop
    JOIN public.projects p ON p.id = prop.project_id
    WHERE p.client_id = v_caller_id
      AND prop.viewed_at IS NULL
      AND prop.status = 'pending';

    SELECT COUNT(*)::INT INTO v_active_engagements_count
    FROM public.engagements
    WHERE client_id = v_caller_id AND status IN ('active', 'pending_signature');

    -- Funds in escrow: funded or held_in_escrow milestones
    SELECT COALESCE(SUM(em.amount), 0) INTO v_escrow_funds
    FROM public.engagement_milestones em
    JOIN public.engagements e ON e.id = em.engagement_id
    WHERE e.client_id = v_caller_id
      AND em.status IN ('funded', 'in_progress', 'submitted', 'revision_requested', 'approved')
      AND em.payout_status IN ('held_in_escrow', 'pending_release');

    -- Needs your attention list
    SELECT jsonb_agg(item)
    INTO v_attention_items
    FROM (
        -- Unviewed proposals
        SELECT jsonb_build_object(
            'type', 'review_proposal',
            'title', 'New proposal from ' || dp_prof.full_name,
            'subtitle', prj.title,
            'link', '#project-details?id=' || prj.id || '&tab=proposals',
            'action_label', 'Review proposal'
        ) AS item
        FROM public.proposals prop
        JOIN public.projects prj ON prj.id = prop.project_id
        JOIN public.profiles dp_prof ON dp_prof.id = prop.designer_id
        WHERE prj.client_id = v_caller_id AND prop.viewed_at IS NULL AND prop.status = 'pending'
        LIMIT 3
    ) sub;

    -- Active projects with progress bar & current milestone
    SELECT jsonb_agg(item)
    INTO v_active_projects
    FROM (
        SELECT jsonb_build_object(
            'id', e.id,
            'project_id', prj.id,
            'title', prj.title,
            'status', e.status,
            'designer_name', dp_prof.full_name,
            'designer_avatar', dp_prof.avatar_path,
            'total_milestones', (SELECT COUNT(*)::INT FROM public.engagement_milestones WHERE engagement_id = e.id),
            'approved_milestones', (SELECT COUNT(*)::INT FROM public.engagement_milestones WHERE engagement_id = e.id AND status = 'approved'),
            'escrow_amount', COALESCE(
                (SELECT SUM(amount) FROM public.engagement_milestones WHERE engagement_id = e.id AND payout_status = 'held_in_escrow'),
                0
            )
        ) AS item
        FROM public.engagements e
        JOIN public.projects prj ON prj.id = e.project_id
        JOIN public.profiles dp_prof ON dp_prof.id = e.designer_id
        WHERE e.client_id = v_caller_id AND e.status IN ('active', 'pending_signature')
        LIMIT 5
    ) sub;

    -- Recent 5 projects
    SELECT jsonb_agg(item)
    INTO v_recent_projects
    FROM (
        SELECT jsonb_build_object(
            'id', prj.id,
            'title', prj.title,
            'status', prj.status,
            'category', prj.category,
            'proposals_count', (SELECT COUNT(*)::INT FROM public.proposals WHERE project_id = prj.id),
            'unviewed_proposals_count', (SELECT COUNT(*)::INT FROM public.proposals WHERE project_id = prj.id AND viewed_at IS NULL AND status = 'pending'),
            'deadline', prj.deadline
        ) AS item
        FROM public.projects prj
        WHERE prj.client_id = v_caller_id
        ORDER BY prj.created_at DESC
        LIMIT 5
    ) sub;

    -- Notifications latest 5
    SELECT jsonb_agg(item)
    INTO v_notifications
    FROM (
        SELECT jsonb_build_object(
            'id', n.id,
            'title', n.title,
            'body', n.body,
            'type', n.type,
            'created_at', n.created_at,
            'read_at', n.read_at
        ) AS item
        FROM public.notifications n
        WHERE n.user_id = v_caller_id
        ORDER BY n.created_at DESC
        LIMIT 5
    ) sub;

    RETURN jsonb_build_object(
        'client_name', v_client.full_name,
        'summary', jsonb_build_object(
            'open_projects_count', v_open_count,
            'new_proposals_count', v_new_proposals_count,
            'active_projects_count', v_active_engagements_count,
            'funds_in_escrow', v_escrow_funds
        ),
        'attention_items', COALESCE(v_attention_items, '[]'::jsonb),
        'active_projects', COALESCE(v_active_projects, '[]'::jsonb),
        'recent_projects', COALESCE(v_recent_projects, '[]'::jsonb),
        'notifications', COALESCE(v_notifications, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql;


-- >>> START dezignet/supabase/migrations/035_proposals_contracts_rls.sql <<<
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - RLS & GRANTS
-- 035_proposals_contracts_rls.sql
-- Row Level Security for Contracts, Signatures, Reviews, Updated Views & Grants
-- ==============================================================================

-- 1. Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 2. Contracts RLS (Only parties and admins can view; immutable to direct writes)
DROP POLICY IF EXISTS "contracts_read_parties" ON public.contracts;
CREATE POLICY "contracts_read_parties"
    ON public.contracts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.engagements e
            WHERE e.id = contracts.engagement_id
              AND (e.client_id = (SELECT auth.uid()) OR e.designer_id = (SELECT auth.uid()))
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "contracts_deny_direct_write" ON public.contracts;
CREATE POLICY "contracts_deny_direct_write"
    ON public.contracts
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 3. Contract Signatures RLS
DROP POLICY IF EXISTS "contract_signatures_read_parties" ON public.contract_signatures;
CREATE POLICY "contract_signatures_read_parties"
    ON public.contract_signatures
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.contracts c
            JOIN public.engagements e ON e.id = c.engagement_id
            WHERE c.id = contract_signatures.contract_id
              AND (e.client_id = (SELECT auth.uid()) OR e.designer_id = (SELECT auth.uid()))
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "contract_signatures_deny_direct_write" ON public.contract_signatures;
CREATE POLICY "contract_signatures_deny_direct_write"
    ON public.contract_signatures
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);

-- 4. Terms Versions (Readable by all authenticated users)
DROP POLICY IF EXISTS "terms_versions_read_all" ON public.contract_terms_versions;
CREATE POLICY "terms_versions_read_all"
    ON public.contract_terms_versions
    FOR SELECT
    TO authenticated
    USING (true);

-- 5. Reviews RLS (Visible reviews readable by all logged-in users; client can insert)
DROP POLICY IF EXISTS "reviews_read_visible" ON public.reviews;
CREATE POLICY "reviews_read_visible"
    ON public.reviews
    FOR SELECT
    TO authenticated
    USING (status = 'visible' OR public.is_admin());

-- 6. Update public_designer_profiles View with Ratings
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;

CREATE OR REPLACE VIEW public.public_designer_profiles
WITH (security_barrier = true) AS
SELECT
    dp.user_id AS designer_id,
    p.full_name,
    p.avatar_path,
    p.location,
    dp.title,
    dp.studio_name,
    dp.bio,
    dp.professional_type,
    dp.specializations,
    dp.languages,
    dp.years_experience,
    dp.is_available,
    dp.availability_note,
    p.created_at AS member_since,
    dp.hourly_rate,
    dp.show_hourly_rate,
    dp.show_in_search,
    COALESCE(
        (SELECT COUNT(*) > 0 FROM public.credentials c WHERE c.designer_id = dp.user_id AND c.status = 'verified'),
        false
    ) AS verified,
    COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews r WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0.0
    ) AS rating_average,
    COALESCE(
        (SELECT COUNT(*)::INT FROM public.reviews r WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0
    ) AS rating_count,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE would_hire_again = true)::numeric / COUNT(*)) * 100, 0)
         FROM public.reviews r WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        100
    ) AS would_hire_again_percent
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.show_in_search = true;

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- 7. Function Grants
GRANT EXECUTE ON FUNCTION public.get_project_proposals(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_proposal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compare_proposals(UUID, UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_proposal_question(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_proposal(UUID, public.decline_reason_code, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_proposal(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_contract(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.sign_contract(UUID, TEXT, public.signature_style_type, UUID, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_contract(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_contract(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_contract(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_review(UUID, INT, TEXT, BOOLEAN, INT, INT, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reply_to_review(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_client_dashboard() TO authenticated, service_role;


