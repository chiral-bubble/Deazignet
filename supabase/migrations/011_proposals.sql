-- ==============================================================================
-- DEZIGNET PHASE 2: 011_proposals.sql
-- Proposals, Proposal Milestones, Portfolio Items, Events, Versions & Logic
-- ==============================================================================

-- 1. Proposals Table
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status public.proposal_status NOT NULL DEFAULT 'pending',
    cover_letter TEXT NOT NULL CHECK (char_length(cover_letter) <= 1500),
    total_price NUMERIC(12,2) NOT NULL CHECK (total_price > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    delivery_days INT NOT NULL CHECK (delivery_days > 0),
    hourly_rate NUMERIC(12,2) CHECK (hourly_rate IS NULL OR hourly_rate > 0),
    estimated_hours NUMERIC(8,2) CHECK (estimated_hours IS NULL OR estimated_hours > 0),
    exclusions TEXT,
    question_for_client TEXT,
    client_answer TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    decline_reason TEXT,
    withdraw_reason TEXT,
    version_count INT NOT NULL DEFAULT 1 CHECK (version_count >= 1),
    project_snapshot JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_proposals_project_designer UNIQUE (project_id, designer_id)
);

CREATE INDEX IF NOT EXISTS idx_proposals_project_id ON public.proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_designer_id ON public.proposals(designer_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_sent_at ON public.proposals(sent_at);

DROP TRIGGER IF EXISTS trg_proposals_updated_at ON public.proposals;
CREATE TRIGGER trg_proposals_updated_at
    BEFORE UPDATE ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 2. Proposal Milestones Table
CREATE TABLE IF NOT EXISTS public.proposal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    project_milestone_id UUID REFERENCES public.project_milestones(id) ON DELETE SET NULL,
    fee_percent NUMERIC(5,2) NOT NULL CHECK (fee_percent > 0 AND fee_percent <= 100),
    amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_milestones_proposal_id ON public.proposal_milestones(proposal_id);

-- 3. Proposal Portfolio Items Table (Max 5 items per proposal)
CREATE TABLE IF NOT EXISTS public.proposal_portfolio_items (
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    portfolio_project_id UUID NOT NULL REFERENCES public.portfolio_projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (proposal_id, portfolio_project_id)
);

-- Trigger to enforce maximum 5 portfolio items
CREATE OR REPLACE FUNCTION public.check_max_proposal_portfolio_items()
RETURNS TRIGGER AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.proposal_portfolio_items
    WHERE proposal_id = NEW.proposal_id;

    IF v_count >= 5 THEN
        RAISE EXCEPTION 'A proposal can include a maximum of 5 portfolio projects.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_portfolio_items_count ON public.proposal_portfolio_items;
CREATE TRIGGER trg_check_portfolio_items_count
    BEFORE INSERT ON public.proposal_portfolio_items
    FOR EACH ROW
    EXECUTE FUNCTION public.check_max_proposal_portfolio_items();

-- 4. Proposal Events Timeline Table
CREATE TABLE IF NOT EXISTS public.proposal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (
        event_type IN ('sent', 'viewed', 'shortlisted', 'declined', 'withdrawn', 'edited', 'accepted')
    ),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_events_proposal_id ON public.proposal_events(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_events_created_at ON public.proposal_events(created_at);

-- 5. Proposal Versions Table (Change history)
CREATE TABLE IF NOT EXISTS public.proposal_versions (
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    version INT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (proposal_id, version)
);

-- 6. Helper Function: proposal_usage
CREATE OR REPLACE FUNCTION public.proposal_usage(p_designer_id UUID)
RETURNS TABLE (
    used INT,
    "limit" INT,
    period_end DATE
) AS $$
DECLARE
    v_plan public.plan_tier;
    v_limit INT;
    v_withdrawn_restores BOOLEAN := FALSE;
    v_used INT;
    v_month_start TIMESTAMPTZ;
    v_month_end TIMESTAMPTZ;
BEGIN
    v_month_start := date_trunc('month', NOW());
    v_month_end := v_month_start + INTERVAL '1 month';

    -- Get designer's plan
    SELECT coalesce(plan, 'free'::public.plan_tier) INTO v_plan
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    IF v_plan IS NULL THEN
        v_plan := 'free'::public.plan_tier;
    END IF;

    -- Get plan limit
    SELECT monthly_proposal_limit INTO v_limit
    FROM public.plan_limits
    WHERE plan = v_plan;

    IF v_limit IS NULL THEN
        v_limit := 5;
    END IF;

    -- Check app setting
    SELECT coalesce((value)::BOOLEAN, FALSE) INTO v_withdrawn_restores
    FROM public.app_settings
    WHERE key = 'withdrawn_restores_slot';

    -- Count proposals
    IF v_withdrawn_restores THEN
        SELECT COUNT(*)::INT INTO v_used
        FROM public.proposals
        WHERE designer_id = p_designer_id
          AND sent_at >= v_month_start
          AND sent_at < v_month_end
          AND status <> 'withdrawn'::public.proposal_status;
    ELSE
        SELECT COUNT(*)::INT INTO v_used
        FROM public.proposals
        WHERE designer_id = p_designer_id
          AND sent_at >= v_month_start
          AND sent_at < v_month_end;
    END IF;

    RETURN QUERY
    SELECT v_used, v_limit, (v_month_end::DATE - 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Database Function: submit_proposal
-- Enforces all 7 core submission rules in ONE atomic transaction
CREATE OR REPLACE FUNCTION public.submit_proposal(
    p_project_id UUID,
    p_cover_letter TEXT,
    p_total_price NUMERIC,
    p_currency TEXT DEFAULT 'USD',
    p_delivery_days INT DEFAULT 14,
    p_hourly_rate NUMERIC DEFAULT NULL,
    p_estimated_hours NUMERIC DEFAULT NULL,
    p_exclusions TEXT DEFAULT NULL,
    p_question_for_client TEXT DEFAULT NULL,
    p_milestone_offers JSONB DEFAULT '[]'::JSONB,
    p_portfolio_item_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS UUID AS $$
DECLARE
    v_caller_id UUID;
    v_caller_role public.user_role;
    v_project public.projects%ROWTYPE;
    v_completeness JSONB;
    v_completeness_score INT;
    v_usage RECORD;
    v_snapshot JSONB;
    v_proposal_id UUID;
    v_item JSONB;
    v_item_fee_sum NUMERIC(6,2) := 0;
    v_port_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated'
            USING ERRCODE = '42501';
    END IF;

    -- 1. Caller must be a designer
    SELECT role INTO v_caller_role
    FROM public.profiles
    WHERE id = v_caller_id;

    IF v_caller_role <> 'designer'::public.user_role THEN
        RAISE EXCEPTION 'Only registered designers can submit proposals.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Project must be open and not the designer's own
    SELECT * INTO v_project
    FROM public.projects
    WHERE id = p_project_id;

    IF v_project.id IS NULL THEN
        RAISE EXCEPTION 'project_closed'
            USING HINT = 'project_closed', ERRCODE = 'P0001';
    END IF;

    IF v_project.status <> 'open'::public.project_status THEN
        RAISE EXCEPTION 'project_closed'
            USING HINT = 'project_closed', ERRCODE = 'P0001';
    END IF;

    IF v_project.client_id = v_caller_id THEN
        RAISE EXCEPTION 'Designers cannot submit proposals to their own projects.'
            USING ERRCODE = 'P0001';
    END IF;

    -- 3. Profile completeness >= 60%
    SELECT (get_profile_completeness(v_caller_id)->>'score')::INT
    INTO v_completeness_score;

    IF v_completeness_score IS NULL OR v_completeness_score < 60 THEN
        RAISE EXCEPTION 'profile_incomplete'
            USING HINT = 'profile_incomplete', ERRCODE = 'P0001';
    END IF;

    -- 4. Not already applied
    IF EXISTS (
        SELECT 1 FROM public.proposals
        WHERE project_id = p_project_id AND designer_id = v_caller_id
    ) THEN
        RAISE EXCEPTION 'already_applied'
            USING HINT = 'already_applied', ERRCODE = 'P0001';
    END IF;

    -- 5. Monthly proposal limit check
    SELECT * INTO v_usage FROM public.proposal_usage(v_caller_id);
    IF v_usage.used >= v_usage.limit THEN
        RAISE EXCEPTION 'limit_reached'
            USING HINT = 'limit_reached', ERRCODE = 'P0001';
    END IF;

    -- 6. Validate inputs
    IF p_total_price <= 0 THEN
        RAISE EXCEPTION 'Total price must be greater than zero.'
            USING ERRCODE = 'P0001';
    END IF;

    IF char_length(p_cover_letter) > 1500 THEN
        RAISE EXCEPTION 'Cover letter exceeds maximum allowed length of 1500 characters.'
            USING ERRCODE = 'P0001';
    END IF;

    IF v_project.payment_type = 'milestone'::public.payment_type THEN
        IF p_milestone_offers IS NULL OR jsonb_array_length(p_milestone_offers) = 0 THEN
            RAISE EXCEPTION 'Milestone proposals must include phase offers.'
                USING ERRCODE = 'P0001';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_milestone_offers) LOOP
            v_item_fee_sum := v_item_fee_sum + (v_item->>'fee_percent')::NUMERIC;
        END LOOP;

        IF abs(v_item_fee_sum - 100.0) > 0.01 THEN
            RAISE EXCEPTION 'invalid_percentages'
                USING HINT = 'invalid_percentages', ERRCODE = 'P0001';
        END IF;
    ELSIF v_project.payment_type = 'hourly'::public.payment_type THEN
        IF p_hourly_rate IS NULL OR p_hourly_rate <= 0 THEN
            RAISE EXCEPTION 'invalid_hourly_fields'
                USING HINT = 'invalid_hourly_fields', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- 7. Snapshot project state at submit time
    SELECT json_build_object(
        'project', row_to_json(v_project),
        'milestones', (
            SELECT json_agg(row_to_json(pm))
            FROM public.project_milestones pm
            WHERE pm.project_id = v_project.id
        )
    )::JSONB INTO v_snapshot;

    -- 8. Atomic insertion: proposal row
    INSERT INTO public.proposals (
        project_id,
        designer_id,
        status,
        cover_letter,
        total_price,
        currency,
        delivery_days,
        hourly_rate,
        estimated_hours,
        exclusions,
        question_for_client,
        sent_at,
        project_snapshot
    ) VALUES (
        p_project_id,
        v_caller_id,
        'pending'::public.proposal_status,
        p_cover_letter,
        p_total_price,
        coalesce(p_currency, 'USD'),
        p_delivery_days,
        p_hourly_rate,
        p_estimated_hours,
        p_exclusions,
        p_question_for_client,
        NOW(),
        v_snapshot
    ) RETURNING id INTO v_proposal_id;

    -- Insert milestone offers
    IF v_project.payment_type = 'milestone'::public.payment_type THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_milestone_offers) LOOP
            INSERT INTO public.proposal_milestones (
                proposal_id,
                project_milestone_id,
                fee_percent,
                amount
            ) VALUES (
                v_proposal_id,
                (v_item->>'project_milestone_id')::UUID,
                (v_item->>'fee_percent')::NUMERIC,
                (v_item->>'amount')::NUMERIC
            );
        END LOOP;
    END IF;

    -- Insert portfolio items (max 5)
    IF p_portfolio_item_ids IS NOT NULL THEN
        FOREACH v_port_id IN ARRAY p_portfolio_item_ids LOOP
            INSERT INTO public.proposal_portfolio_items (
                proposal_id,
                portfolio_project_id
            ) VALUES (
                v_proposal_id,
                v_port_id
            ) ON CONFLICT DO NOTHING;
        END LOOP;
    END IF;

    -- Insert 'sent' timeline event
    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        v_proposal_id,
        'sent',
        v_caller_id,
        'Proposal submitted by designer'
    );

    RETURN v_proposal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Database Function: update_proposal
CREATE OR REPLACE FUNCTION public.update_proposal(
    p_proposal_id UUID,
    p_cover_letter TEXT,
    p_total_price NUMERIC,
    p_delivery_days INT,
    p_hourly_rate NUMERIC DEFAULT NULL,
    p_estimated_hours NUMERIC DEFAULT NULL,
    p_exclusions TEXT DEFAULT NULL,
    p_question_for_client TEXT DEFAULT NULL,
    p_milestone_offers JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_allow_edit_if_viewed BOOLEAN := FALSE;
    v_item JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;

    IF v_prop.id IS NULL OR v_prop.designer_id <> v_caller_id THEN
        RAISE EXCEPTION 'Proposal not found or unauthorized.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status <> 'pending'::public.proposal_status THEN
        RAISE EXCEPTION 'not_editable'
            USING HINT = 'not_editable', ERRCODE = 'P0001';
    END IF;

    -- Check setting
    SELECT coalesce((value)::BOOLEAN, TRUE) INTO v_allow_edit_if_viewed
    FROM public.app_settings
    WHERE key = 'proposal_edit_before_view';

    IF v_allow_edit_if_viewed AND v_prop.viewed_at IS NOT NULL THEN
        RAISE EXCEPTION 'not_editable'
            USING HINT = 'not_editable', ERRCODE = 'P0001';
    END IF;

    -- Save current version into proposal_versions
    INSERT INTO public.proposal_versions (
        proposal_id,
        version,
        data
    ) VALUES (
        v_prop.id,
        v_prop.version_count,
        row_to_json(v_prop)::JSONB
    );

    -- Update proposal
    UPDATE public.proposals
    SET
        cover_letter = coalesce(p_cover_letter, cover_letter),
        total_price = coalesce(p_total_price, total_price),
        delivery_days = coalesce(p_delivery_days, delivery_days),
        hourly_rate = coalesce(p_hourly_rate, hourly_rate),
        estimated_hours = coalesce(p_estimated_hours, estimated_hours),
        exclusions = coalesce(p_exclusions, exclusions),
        question_for_client = coalesce(p_question_for_client, question_for_client),
        version_count = version_count + 1,
        updated_at = NOW()
    WHERE id = p_proposal_id;

    -- Update milestone offers if provided
    IF p_milestone_offers IS NOT NULL AND jsonb_array_length(p_milestone_offers) > 0 THEN
        DELETE FROM public.proposal_milestones WHERE proposal_id = p_proposal_id;
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_milestone_offers) LOOP
            INSERT INTO public.proposal_milestones (
                proposal_id,
                project_milestone_id,
                fee_percent,
                amount
            ) VALUES (
                p_proposal_id,
                (v_item->>'project_milestone_id')::UUID,
                (v_item->>'fee_percent')::NUMERIC,
                (v_item->>'amount')::NUMERIC
            );
        END LOOP;
    END IF;

    -- Record 'edited' event
    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'edited',
        v_caller_id,
        'Proposal updated to version ' || (v_prop.version_count + 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Database Function: withdraw_proposal
CREATE OR REPLACE FUNCTION public.withdraw_proposal(
    p_proposal_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;

    IF v_prop.id IS NULL OR (v_prop.designer_id <> v_caller_id AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'Proposal not found or unauthorized.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status NOT IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status, 'shortlisted'::public.proposal_status) THEN
        RAISE EXCEPTION 'Only pending, viewed, or shortlisted proposals can be withdrawn.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET
        status = 'withdrawn'::public.proposal_status,
        withdraw_reason = p_reason,
        decided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'withdrawn',
        v_caller_id,
        coalesce(p_reason, 'Withdrawn by designer')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 10. Database Function: mark_proposal_viewed
CREATE OR REPLACE FUNCTION public.mark_proposal_viewed(p_proposal_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_proj public.projects%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can mark proposals as viewed.'
            USING ERRCODE = '42501';
    END IF;

    -- Only set viewed_at once
    IF v_prop.viewed_at IS NULL THEN
        UPDATE public.proposals
        SET
            viewed_at = NOW(),
            status = CASE
                WHEN status = 'pending'::public.proposal_status THEN 'viewed'::public.proposal_status
                ELSE status
            END,
            updated_at = NOW()
        WHERE id = p_proposal_id;

        INSERT INTO public.proposal_events (
            proposal_id,
            event_type,
            actor_id,
            note
        ) VALUES (
            p_proposal_id,
            'viewed',
            v_caller_id,
            'Client viewed proposal'
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 11. Database Function: shortlist_proposal
CREATE OR REPLACE FUNCTION public.shortlist_proposal(p_proposal_id UUID)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_proj public.projects%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can shortlist proposals.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status NOT IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status) THEN
        RAISE EXCEPTION 'Only pending or viewed proposals can be shortlisted.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET
        status = 'shortlisted'::public.proposal_status,
        decided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'shortlisted',
        v_caller_id,
        'Proposal shortlisted by client'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 12. Database Function: decline_proposal
CREATE OR REPLACE FUNCTION public.decline_proposal(
    p_proposal_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_caller_id UUID;
    v_prop public.proposals%ROWTYPE;
    v_proj public.projects%ROWTYPE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can decline proposals.'
            USING ERRCODE = '42501';
    END IF;

    IF v_prop.status IN ('accepted'::public.proposal_status, 'withdrawn'::public.proposal_status) THEN
        RAISE EXCEPTION 'Cannot decline an accepted or withdrawn proposal.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.proposals
    SET
        status = 'declined'::public.proposal_status,
        decline_reason = p_reason,
        decided_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    INSERT INTO public.proposal_events (
        proposal_id,
        event_type,
        actor_id,
        note
    ) VALUES (
        p_proposal_id,
        'declined',
        v_caller_id,
        coalesce(p_reason, 'Proposal declined by client')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
