-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 3
-- 015_phase3_functions.sql
-- Transition Matrix Functions for Active Work
-- Security Definer, search_path = public, strict ownership & status checks
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: log_engagement_event
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_engagement_event(
    p_engagement_id UUID,
    p_actor_id UUID,
    p_event_type TEXT,
    p_milestone_id UUID DEFAULT NULL,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.engagement_events (
        engagement_id,
        actor_id,
        event_type,
        milestone_id,
        data
    )
    VALUES (
        p_engagement_id,
        p_actor_id,
        p_event_type,
        p_milestone_id,
        p_data
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Acceptance: accept_proposal
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_proposal(p_proposal_id UUID)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_prop RECORD;
    v_proj RECORD;
    v_fee_pct NUMERIC(5, 2);
    v_engagement_id UUID;
    v_pm RECORD;
    v_hours_cap NUMERIC(4, 1);
    v_terms_snapshot JSONB;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- Fetch proposal
    SELECT * INTO v_prop FROM public.proposals WHERE id = p_proposal_id;
    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'Proposal not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Fetch project
    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Ownership check: Client owner or admin
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can accept a proposal.' USING ERRCODE = '42501';
    END IF;

    -- Status validations
    IF v_proj.status <> 'open'::public.project_status THEN
        RAISE EXCEPTION 'Only open projects can accept proposals.' USING ERRCODE = 'P0001';
    END IF;

    IF v_prop.status NOT IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status, 'shortlisted'::public.proposal_status) THEN
        RAISE EXCEPTION 'Only pending, viewed, or shortlisted proposals can be accepted.' USING ERRCODE = 'P0001';
    END IF;

    -- Fetch platform fee percent from settings (default 10%)
    SELECT COALESCE((value->>0)::NUMERIC, 10.00) INTO v_fee_pct
    FROM public.app_settings
    WHERE key = 'platform_fee_percent';

    -- Fetch weekly hours cap default
    SELECT (value->>0)::NUMERIC INTO v_hours_cap
    FROM public.app_settings
    WHERE key = 'weekly_hours_cap_default';

    -- Build terms snapshot
    v_terms_snapshot := jsonb_build_object(
        'scope', v_prop.cover_letter,
        'exclusions', v_prop.exclusions,
        'delivery_days', v_prop.delivery_days,
        'cover_letter', v_prop.cover_letter,
        'project_snapshot', v_prop.project_snapshot,
        'project_title', v_proj.title,
        'category', v_proj.category,
        'subcategory', v_proj.subcategory
    );

    -- 1. Create Engagement
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
        'active'::public.engagement_status,
        v_terms_snapshot,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_engagement_id;

    -- 2. If milestone project, copy milestones from proposal_milestones
    IF v_proj.payment_type = 'milestone'::public.payment_type THEN
        FOR v_pm IN (
            SELECT
                pms.id,
                pms.fee_percent,
                pms.amount,
                pjm.sort_order,
                pjm.name,
                pjm.description,
                pjm.deliverables,
                pjm.billing_trigger
            FROM public.proposal_milestones pms
            JOIN public.project_milestones pjm ON pjm.id = pms.project_milestone_id
            WHERE pms.proposal_id = v_prop.id
            ORDER BY pjm.sort_order ASC
        ) LOOP
            INSERT INTO public.engagement_milestones (
                engagement_id,
                sort_order,
                name,
                description,
                deliverables,
                billing_trigger,
                fee_percent,
                amount,
                status,
                payout_status
            )
            VALUES (
                v_engagement_id,
                v_pm.sort_order,
                v_pm.name,
                v_pm.description,
                COALESCE(v_pm.deliverables, '{}'::text[]),
                v_pm.billing_trigger,
                v_pm.fee_percent,
                v_pm.amount,
                'awaiting_funding'::public.milestone_status,
                'not_due'::public.payout_status
            );
        END LOOP;
    END IF;

    -- 3. Mark selected proposal as accepted
    UPDATE public.proposals
    SET
        status = 'accepted'::public.proposal_status,
        decided_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_prop.id;

    -- 4. Decline all other active proposals on the project
    UPDATE public.proposals
    SET
        status = 'declined'::public.proposal_status,
        decline_reason = 'Another designer was selected',
        decided_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE project_id = v_proj.id
      AND id <> v_prop.id
      AND status IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status, 'shortlisted'::public.proposal_status);

    -- 5. Mark project as awarded
    UPDATE public.projects
    SET
        status = 'awarded'::public.project_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_proj.id;

    -- 6. Log Events
    PERFORM public.log_engagement_event(
        v_engagement_id,
        v_caller_id,
        'proposal_accepted',
        NULL,
        jsonb_build_object('proposal_id', v_prop.id, 'designer_id', v_prop.designer_id)
    );

    PERFORM public.log_engagement_event(
        v_engagement_id,
        v_caller_id,
        'engagement_started',
        NULL,
        jsonb_build_object('payment_type', v_proj.payment_type, 'total_price', v_prop.total_price)
    );

    RETURN v_engagement_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. Funding & Payout Dev Helpers (Admin only, non-production)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dev_fund_milestone(p_milestone_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_env TEXT;
    v_seq_funding BOOLEAN;
    v_ms RECORD;
    v_eng RECORD;
    v_has_unapproved BOOLEAN;
    v_offset_days INT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin authorization required for dev funding.' USING ERRCODE = '42501';
    END IF;

    -- Check environment
    SELECT value->>0 INTO v_env FROM public.app_settings WHERE key = 'environment';
    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_fund_milestone is blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_ms.status <> 'awaiting_funding'::public.milestone_status THEN
        RAISE EXCEPTION 'Milestone is not awaiting funding (current status: %).', v_ms.status USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;

    -- Check sequential funding rule
    SELECT COALESCE((value)::boolean, true) INTO v_seq_funding
    FROM public.app_settings WHERE key = 'sequential_funding';

    IF v_seq_funding THEN
        SELECT EXISTS (
            SELECT 1 FROM public.engagement_milestones
            WHERE engagement_id = v_ms.engagement_id
              AND sort_order < v_ms.sort_order
              AND status <> 'approved'::public.milestone_status
        ) INTO v_has_unapproved;

        IF v_has_unapproved THEN
            RAISE EXCEPTION 'Previous milestones must be approved before funding this milestone.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Compute due date: default 14 days or pro-rated delivery_days
    v_offset_days := GREATEST(7, ROUND(COALESCE((v_eng.terms_snapshot->>'delivery_days')::NUMERIC, 30.0) * (v_ms.fee_percent / 100.0))::INT);

    UPDATE public.engagement_milestones
    SET
        status = 'funded'::public.milestone_status,
        funded_at = timezone('utc'::text, now()),
        due_date = CURRENT_DATE + v_offset_days,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'milestone_funded',
        v_ms.id,
        jsonb_build_object('amount', v_ms.amount, 'due_date', (CURRENT_DATE + v_offset_days))
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.dev_release_milestone(p_milestone_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_env TEXT;
    v_ms RECORD;
    v_eng RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin authorization required for dev payment release.' USING ERRCODE = '42501';
    END IF;

    SELECT value->>0 INTO v_env FROM public.app_settings WHERE key = 'environment';
    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_release_milestone is blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_ms.status <> 'approved'::public.milestone_status THEN
        RAISE EXCEPTION 'Milestone must be approved before releasing payment.' USING ERRCODE = 'P0001';
    END IF;

    IF v_ms.payout_status <> 'pending_release'::public.payout_status THEN
        RAISE EXCEPTION 'Payout status must be pending_release (current: %).', v_ms.payout_status USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;

    UPDATE public.engagement_milestones
    SET
        payout_status = 'released'::public.payout_status,
        released_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'payment_released',
        v_ms.id,
        jsonb_build_object('amount', v_ms.amount)
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. Designer: start_milestone, submit_milestone, add_milestone_comment
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_milestone(p_milestone_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;
    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can start this milestone.' USING ERRCODE = '42501';
    END IF;

    IF v_ms.status <> 'funded'::public.milestone_status THEN
        RAISE EXCEPTION 'Milestone must be funded before starting work.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.engagement_milestones
    SET
        status = 'in_progress'::public.milestone_status,
        started_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'milestone_started',
        v_ms.id
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.submit_milestone(
    p_milestone_id UUID,
    p_notes TEXT,
    p_files JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
    v_max_ver INT;
    v_new_ver INT;
    v_sub_id UUID;
    v_file JSONB;
    v_max_size BIGINT;
    v_allowed_types JSONB;
    v_ext TEXT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;
    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can submit deliverables.' USING ERRCODE = '42501';
    END IF;

    IF v_ms.status NOT IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status, 'revision_requested'::public.milestone_status) THEN
        RAISE EXCEPTION 'Milestone is not in a submittable status (current: %).', v_ms.status USING ERRCODE = 'P0001';
    END IF;

    -- Fetch file upload settings
    SELECT COALESCE((value->>0)::BIGINT, 262144000) INTO v_max_size
    FROM public.app_settings WHERE key = 'max_file_size_bytes';

    SELECT value INTO v_allowed_types
    FROM public.app_settings WHERE key = 'allowed_file_types';

    -- Determine new version
    SELECT COALESCE(MAX(version), 0) INTO v_max_ver
    FROM public.milestone_submissions WHERE milestone_id = v_ms.id;
    v_new_ver := v_max_ver + 1;

    -- Create submission record
    INSERT INTO public.milestone_submissions (
        milestone_id,
        version,
        notes,
        submitted_at
    )
    VALUES (
        v_ms.id,
        v_new_ver,
        p_notes,
        timezone('utc'::text, now())
    )
    RETURNING id INTO v_sub_id;

    -- Validate and store submission files
    IF p_files IS NOT NULL AND jsonb_array_length(p_files) > 0 THEN
        FOR v_file IN SELECT * FROM jsonb_array_elements(p_files) LOOP
            -- Check size
            IF (v_file->>'size_bytes')::BIGINT > v_max_size THEN
                RAISE EXCEPTION 'File % exceeds max allowable size of % bytes.', (v_file->>'file_name'), v_max_size
                    USING ERRCODE = 'P0001';
            END IF;

            -- Check extension
            v_ext := lower(substring(v_file->>'file_name' from '\.([^\.]+)$'));
            IF v_allowed_types IS NOT NULL AND NOT (v_allowed_types ? v_ext) THEN
                RAISE EXCEPTION 'File % extension .% is not in allowed file types.', (v_file->>'file_name'), v_ext
                    USING ERRCODE = 'P0001';
            END IF;

            INSERT INTO public.submission_files (
                submission_id,
                path,
                file_name,
                size_bytes,
                mime_type
            )
            VALUES (
                v_sub_id,
                v_file->>'path',
                v_file->>'file_name',
                (v_file->>'size_bytes')::BIGINT,
                v_file->>'mime_type'
            );
        END LOOP;
    END IF;

    -- Update milestone status
    UPDATE public.engagement_milestones
    SET
        status = 'submitted'::public.milestone_status,
        submitted_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'milestone_submitted',
        v_ms.id,
        jsonb_build_object('version', v_new_ver, 'submission_id', v_sub_id)
    );

    RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.add_milestone_comment(
    p_milestone_id UUID,
    p_submission_id UUID,
    p_body TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
    v_comment_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;
    IF v_eng.client_id <> v_caller_id AND v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized to comment on this milestone.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.milestone_comments (
        milestone_id,
        submission_id,
        author_id,
        body
    )
    VALUES (
        v_ms.id,
        p_submission_id,
        v_caller_id,
        trim(p_body)
    )
    RETURNING id INTO v_comment_id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'comment_added',
        v_ms.id,
        jsonb_build_object('comment_id', v_comment_id)
    );

    RETURN v_comment_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. Time Tracking: log_time, update_time_entry, delete_time_entry, submit_week
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_time(
    p_engagement_id UUID,
    p_work_date DATE,
    p_hours NUMERIC,
    p_description TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_week_start DATE;
    v_curr_week_hours NUMERIC;
    v_entry_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can log hours.' USING ERRCODE = '42501';
    END IF;

    IF v_eng.status <> 'active'::public.engagement_status THEN
        RAISE EXCEPTION 'Cannot log time on an inactive engagement.' USING ERRCODE = 'P0001';
    END IF;

    IF v_eng.payment_type <> 'hourly'::public.payment_type THEN
        RAISE EXCEPTION 'Time tracking is only available for hourly engagements.' USING ERRCODE = 'P0001';
    END IF;

    -- Validation
    IF p_work_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot log time for future dates.' USING ERRCODE = 'P0001';
    END IF;

    IF p_hours < 0.25 OR p_hours > 12.00 OR mod(p_hours * 100, 25) <> 0 THEN
        RAISE EXCEPTION 'Hours must be between 0.25 and 12.0 in multiples of 0.25.' USING ERRCODE = 'P0001';
    END IF;

    v_week_start := DATE_TRUNC('week', p_work_date)::DATE;

    -- Weekly hours cap check
    IF v_eng.weekly_hours_cap IS NOT NULL THEN
        SELECT COALESCE(SUM(hours), 0) INTO v_curr_week_hours
        FROM public.time_entries
        WHERE engagement_id = v_eng.id
          AND week_start = v_week_start;

        IF (v_curr_week_hours + p_hours) > v_eng.weekly_hours_cap THEN
            RAISE EXCEPTION 'Logging % hours exceeds the weekly cap of % hours (current week: %).',
                p_hours, v_eng.weekly_hours_cap, v_curr_week_hours
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    INSERT INTO public.time_entries (
        engagement_id,
        designer_id,
        work_date,
        hours,
        description,
        status
    )
    VALUES (
        v_eng.id,
        v_eng.designer_id,
        p_work_date,
        p_hours,
        trim(p_description),
        'draft'::public.time_entry_status
    )
    RETURNING id INTO v_entry_id;

    RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_time_entry(
    p_entry_id UUID,
    p_work_date DATE,
    p_hours NUMERIC,
    p_description TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_entry RECORD;
    v_eng RECORD;
    v_week_start DATE;
    v_curr_week_hours NUMERIC;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_entry FROM public.time_entries WHERE id = p_entry_id;
    IF v_entry.id IS NULL THEN
        RAISE EXCEPTION 'Time entry not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_entry.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized to edit this time entry.' USING ERRCODE = '42501';
    END IF;

    IF v_entry.status <> 'draft'::public.time_entry_status THEN
        RAISE EXCEPTION 'Only draft time entries can be updated.' USING ERRCODE = 'P0001';
    END IF;

    IF p_work_date > CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot log time for future dates.' USING ERRCODE = 'P0001';
    END IF;

    IF p_hours < 0.25 OR p_hours > 12.00 OR mod(p_hours * 100, 25) <> 0 THEN
        RAISE EXCEPTION 'Hours must be between 0.25 and 12.0 in multiples of 0.25.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_entry.engagement_id;
    v_week_start := DATE_TRUNC('week', p_work_date)::DATE;

    IF v_eng.weekly_hours_cap IS NOT NULL THEN
        SELECT COALESCE(SUM(hours), 0) INTO v_curr_week_hours
        FROM public.time_entries
        WHERE engagement_id = v_eng.id
          AND week_start = v_week_start
          AND id <> v_entry.id;

        IF (v_curr_week_hours + p_hours) > v_eng.weekly_hours_cap THEN
            RAISE EXCEPTION 'Updating to % hours exceeds the weekly cap of % hours.',
                p_hours, v_eng.weekly_hours_cap
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    UPDATE public.time_entries
    SET
        work_date = p_work_date,
        hours = p_hours,
        description = trim(p_description),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_entry.id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.delete_time_entry(p_entry_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_entry RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_entry FROM public.time_entries WHERE id = p_entry_id;
    IF v_entry.id IS NULL THEN
        RAISE EXCEPTION 'Time entry not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_entry.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized to delete this time entry.' USING ERRCODE = '42501';
    END IF;

    IF v_entry.status <> 'draft'::public.time_entry_status THEN
        RAISE EXCEPTION 'Only draft time entries can be deleted.' USING ERRCODE = 'P0001';
    END IF;

    DELETE FROM public.time_entries WHERE id = v_entry.id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.submit_week(
    p_engagement_id UUID,
    p_week_start DATE
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_draft_count INT;
    v_hours_total NUMERIC(6, 2);
    v_amount NUMERIC(12, 2);
    v_inv_seq INT;
    v_inv_number TEXT;
    v_inv_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can submit weekly timesheets.' USING ERRCODE = '42501';
    END IF;

    IF v_eng.payment_type <> 'hourly'::public.payment_type THEN
        RAISE EXCEPTION 'Weekly submission is only valid for hourly engagements.' USING ERRCODE = 'P0001';
    END IF;

    -- Check if invoice already exists for this week
    IF EXISTS (SELECT 1 FROM public.invoices WHERE engagement_id = v_eng.id AND week_start = p_week_start) THEN
        RAISE EXCEPTION 'An invoice for week % has already been created.', p_week_start USING ERRCODE = 'P0001';
    END IF;

    -- Count draft entries for week
    SELECT COUNT(*), COALESCE(SUM(hours), 0)
    INTO v_draft_count, v_hours_total
    FROM public.time_entries
    WHERE engagement_id = v_eng.id
      AND week_start = p_week_start
      AND status = 'draft'::public.time_entry_status;

    IF v_draft_count = 0 THEN
        RAISE EXCEPTION 'No draft time entries found for week %.', p_week_start USING ERRCODE = 'P0001';
    END IF;

    v_amount := ROUND((v_hours_total * v_eng.hourly_rate), 2);

    -- Generate sequence invoice number (e.g. INV-001)
    SELECT COALESCE(COUNT(*), 0) + 1 INTO v_inv_seq
    FROM public.invoices
    WHERE engagement_id = v_eng.id;

    v_inv_number := 'INV-' || lpad(v_inv_seq::text, 3, '0');

    -- Lock time entries
    UPDATE public.time_entries
    SET
        status = 'submitted'::public.time_entry_status,
        submitted_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE engagement_id = v_eng.id
      AND week_start = p_week_start
      AND status = 'draft'::public.time_entry_status;

    -- Create Invoice
    INSERT INTO public.invoices (
        engagement_id,
        week_start,
        hours_total,
        hourly_rate,
        amount,
        status,
        number
    )
    VALUES (
        v_eng.id,
        p_week_start,
        v_hours_total,
        v_eng.hourly_rate,
        v_amount,
        'pending_approval'::public.invoice_status,
        v_inv_number
    )
    RETURNING id INTO v_inv_id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'week_submitted',
        NULL,
        jsonb_build_object('invoice_id', v_inv_id, 'number', v_inv_number, 'hours', v_hours_total, 'amount', v_amount)
    );

    RETURN v_inv_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. Client: approve_milestone, request_revision, approve_week, dispute_week
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_milestone(p_milestone_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
    v_auto_complete BOOLEAN;
    v_all_approved BOOLEAN;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;
    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client can approve milestone deliverables.' USING ERRCODE = '42501';
    END IF;

    IF v_ms.status <> 'submitted'::public.milestone_status THEN
        RAISE EXCEPTION 'Milestone must be submitted before approval (current: %).', v_ms.status USING ERRCODE = 'P0001';
    END IF;

    -- Update milestone
    UPDATE public.engagement_milestones
    SET
        status = 'approved'::public.milestone_status,
        payout_status = 'pending_release'::public.payout_status,
        approved_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    -- Update latest submission
    UPDATE public.milestone_submissions
    SET
        client_response = 'approved',
        responded_at = timezone('utc'::text, now())
    WHERE id = (
        SELECT id FROM public.milestone_submissions
        WHERE milestone_id = v_ms.id
        ORDER BY version DESC
        LIMIT 1
    );

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'milestone_approved',
        v_ms.id,
        jsonb_build_object('amount', v_ms.amount)
    );

    -- Check auto complete
    SELECT COALESCE((value)::boolean, false) INTO v_auto_complete
    FROM public.app_settings WHERE key = 'auto_complete_when_all_approved';

    IF v_auto_complete THEN
        SELECT NOT EXISTS (
            SELECT 1 FROM public.engagement_milestones
            WHERE engagement_id = v_eng.id
              AND status <> 'approved'::public.milestone_status
        ) INTO v_all_approved;

        IF v_all_approved THEN
            UPDATE public.engagements
            SET
                status = 'completed'::public.engagement_status,
                completed_at = timezone('utc'::text, now()),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_eng.id;

            PERFORM public.log_engagement_event(
                v_eng.id,
                v_caller_id,
                'engagement_completed',
                NULL,
                jsonb_build_object('reason', 'all_milestones_approved')
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.request_revision(
    p_milestone_id UUID,
    p_reason TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
    v_rev_limit INT;
    v_new_rev_count INT;
    v_sub_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id;
    IF v_ms.id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_ms.engagement_id;
    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client can request milestone revisions.' USING ERRCODE = '42501';
    END IF;

    IF v_ms.status <> 'submitted'::public.milestone_status THEN
        RAISE EXCEPTION 'Milestone must be submitted before requesting revision.' USING ERRCODE = 'P0001';
    END IF;

    -- Fetch revision limit (default 2)
    SELECT COALESCE((value->>0)::INT, 2) INTO v_rev_limit
    FROM public.app_settings WHERE key = 'revision_limit';

    v_new_rev_count := v_ms.revision_count + 1;

    -- Update milestone
    UPDATE public.engagement_milestones
    SET
        status = 'revision_requested'::public.milestone_status,
        revision_count = v_new_rev_count,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    -- Update latest submission
    SELECT id INTO v_sub_id
    FROM public.milestone_submissions
    WHERE milestone_id = v_ms.id
    ORDER BY version DESC
    LIMIT 1;

    IF v_sub_id IS NOT NULL THEN
        UPDATE public.milestone_submissions
        SET
            client_response = 'revision_requested',
            response_comment = trim(p_reason),
            responded_at = timezone('utc'::text, now())
        WHERE id = v_sub_id;
    END IF;

    -- Add revision thread comment
    INSERT INTO public.milestone_comments (
        milestone_id,
        submission_id,
        author_id,
        body
    )
    VALUES (
        v_ms.id,
        v_sub_id,
        v_caller_id,
        'Revision requested (Iteration ' || v_new_rev_count || '): ' || trim(p_reason)
    );

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'revision_requested',
        v_ms.id,
        jsonb_build_object(
            'revision_count', v_new_rev_count,
            'revision_limit', v_rev_limit,
            'is_over_limit', (v_new_rev_count > v_rev_limit),
            'reason', trim(p_reason)
        )
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.approve_week(p_invoice_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_inv RECORD;
    v_eng RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_inv.engagement_id;
    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client can approve weekly invoices.' USING ERRCODE = '42501';
    END IF;

    IF v_inv.status <> 'pending_approval'::public.invoice_status THEN
        RAISE EXCEPTION 'Invoice is not pending approval (current: %).', v_inv.status USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.invoices
    SET
        status = 'approved'::public.invoice_status,
        approved_at = timezone('utc'::text, now())
    WHERE id = v_inv.id;

    UPDATE public.time_entries
    SET
        status = 'approved'::public.time_entry_status,
        approved_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE engagement_id = v_eng.id
      AND week_start = v_inv.week_start
      AND status = 'submitted'::public.time_entry_status;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'invoice_approved',
        NULL,
        jsonb_build_object('invoice_id', v_inv.id, 'amount', v_inv.amount)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.dev_pay_invoice(p_invoice_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_env TEXT;
    v_inv RECORD;
    v_eng RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin authorization required for dev invoice payment.' USING ERRCODE = '42501';
    END IF;

    SELECT value->>0 INTO v_env FROM public.app_settings WHERE key = 'environment';
    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_pay_invoice is blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_inv.status <> 'approved'::public.invoice_status THEN
        RAISE EXCEPTION 'Invoice must be approved before payment.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_inv.engagement_id;

    UPDATE public.invoices
    SET status = 'paid'::public.invoice_status
    WHERE id = v_inv.id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'invoice_paid',
        NULL,
        jsonb_build_object('invoice_id', v_inv.id, 'amount', v_inv.amount)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.dispute_week(
    p_invoice_id UUID,
    p_note TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_inv RECORD;
    v_eng RECORD;
    v_dispute_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_inv.engagement_id;
    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client can dispute weekly invoices.' USING ERRCODE = '42501';
    END IF;

    IF v_inv.status <> 'pending_approval'::public.invoice_status THEN
        RAISE EXCEPTION 'Only pending invoices can be disputed.' USING ERRCODE = 'P0001';
    END IF;

    -- Update invoice and time entries
    UPDATE public.invoices
    SET status = 'disputed'::public.invoice_status
    WHERE id = v_inv.id;

    UPDATE public.time_entries
    SET
        status = 'disputed'::public.time_entry_status,
        dispute_note = trim(p_note),
        updated_at = timezone('utc'::text, now())
    WHERE engagement_id = v_eng.id
      AND week_start = v_inv.week_start
      AND status = 'submitted'::public.time_entry_status;

    -- Create dispute
    INSERT INTO public.disputes (
        engagement_id,
        raised_by,
        reason,
        details
    )
    VALUES (
        v_eng.id,
        v_caller_id,
        'Weekly invoice disputed (' || v_inv.number || ')',
        trim(p_note)
    )
    RETURNING id INTO v_dispute_id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'invoice_disputed',
        NULL,
        jsonb_build_object('invoice_id', v_inv.id, 'dispute_id', v_dispute_id, 'note', trim(p_note))
    );

    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. Lifecycle Completion, Disputes & Cancellations
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_engagement(p_engagement_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_has_unapproved_ms BOOLEAN;
    v_has_unreleased_ms BOOLEAN;
    v_has_unpaid_invoices BOOLEAN;
    v_has_open_entries BOOLEAN;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can finalize engagement completion.' USING ERRCODE = '42501';
    END IF;

    IF v_eng.status <> 'active'::public.engagement_status THEN
        RAISE EXCEPTION 'Engagement is not active (status: %).', v_eng.status USING ERRCODE = 'P0001';
    END IF;

    IF v_eng.payment_type = 'milestone'::public.payment_type THEN
        -- Check if all milestones are approved and released
        SELECT EXISTS (
            SELECT 1 FROM public.engagement_milestones
            WHERE engagement_id = v_eng.id AND status <> 'approved'::public.milestone_status
        ) INTO v_has_unapproved_ms;

        IF v_has_unapproved_ms THEN
            RAISE EXCEPTION 'Cannot complete engagement: all milestones must be approved first.' USING ERRCODE = 'P0001';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.engagement_milestones
            WHERE engagement_id = v_eng.id AND payout_status <> 'released'::public.payout_status
        ) INTO v_has_unreleased_ms;

        IF v_has_unreleased_ms THEN
            RAISE EXCEPTION 'Cannot complete engagement: all milestone payouts must be released first.' USING ERRCODE = 'P0001';
        END IF;

    ELSE
        -- Hourly: all invoices must be paid and no draft or submitted time entries
        SELECT EXISTS (
            SELECT 1 FROM public.invoices
            WHERE engagement_id = v_eng.id AND status <> 'paid'::public.invoice_status
        ) INTO v_has_unpaid_invoices;

        IF v_has_unpaid_invoices THEN
            RAISE EXCEPTION 'Cannot complete engagement: all invoices must be paid.' USING ERRCODE = 'P0001';
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.time_entries
            WHERE engagement_id = v_eng.id AND status IN ('draft'::public.time_entry_status, 'submitted'::public.time_entry_status)
        ) INTO v_has_open_entries;

        IF v_has_open_entries THEN
            RAISE EXCEPTION 'Cannot complete engagement: open time entries remain unbilled.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    UPDATE public.engagements
    SET
        status = 'completed'::public.engagement_status,
        completed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_eng.id;

    -- Update linked project to closed
    UPDATE public.projects
    SET
        status = 'closed'::public.project_status,
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_eng.project_id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'engagement_completed',
        NULL,
        jsonb_build_object('total_price', v_eng.total_price)
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.raise_dispute(
    p_engagement_id UUID,
    p_milestone_id UUID,
    p_reason TEXT,
    p_details TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_ms RECORD;
    v_dispute_after_days INT;
    v_rev_limit INT;
    v_is_eligible BOOLEAN := false;
    v_dispute_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_eng.client_id <> v_caller_id AND v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized to raise a dispute for this engagement.' USING ERRCODE = '42501';
    END IF;

    -- Fetch policy settings
    SELECT COALESCE((value->>0)::INT, 5) INTO v_dispute_after_days
    FROM public.app_settings WHERE key = 'dispute_after_days';

    SELECT COALESCE((value->>0)::INT, 2) INTO v_rev_limit
    FROM public.app_settings WHERE key = 'revision_limit';

    IF p_milestone_id IS NOT NULL THEN
        SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_milestone_id AND engagement_id = v_eng.id;
        IF v_ms.id IS NULL THEN
            RAISE EXCEPTION 'Milestone not found for this engagement.' USING ERRCODE = 'P0002';
        END IF;

        -- Inactivity check: submitted without response for dispute_after_days
        IF v_ms.status = 'submitted'::public.milestone_status AND v_ms.submitted_at < (now() - (v_dispute_after_days || ' days')::INTERVAL) THEN
            v_is_eligible := true;
        END IF;

        -- Revision limit check: revision_count >= revision_limit
        IF v_ms.revision_count >= v_rev_limit THEN
            v_is_eligible := true;
        END IF;
    ELSE
        -- General dispute or hourly contract dispute
        v_is_eligible := true;
    END IF;

    IF NOT v_is_eligible AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Dispute eligibility criteria not met (requires % days inactivity or exceeding % revisions).'
            , v_dispute_after_days, v_rev_limit
            USING ERRCODE = 'P0001';
    END IF;

    -- Mark milestone as disputed if specified
    IF p_milestone_id IS NOT NULL THEN
        UPDATE public.engagement_milestones
        SET
            status = 'disputed'::public.milestone_status,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_milestone_id;
    END IF;

    -- Mark engagement as disputed
    UPDATE public.engagements
    SET
        status = 'disputed'::public.engagement_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_eng.id;

    INSERT INTO public.disputes (
        engagement_id,
        milestone_id,
        raised_by,
        reason,
        details
    )
    VALUES (
        v_eng.id,
        p_milestone_id,
        v_caller_id,
        trim(p_reason),
        trim(p_details)
    )
    RETURNING id INTO v_dispute_id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'dispute_raised',
        p_milestone_id,
        jsonb_build_object('dispute_id', v_dispute_id, 'reason', trim(p_reason))
    );

    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cancel_engagement(
    p_engagement_id UUID,
    p_reason TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_has_funded_milestones BOOLEAN;
    v_has_invoices BOOLEAN;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_eng.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client or an administrator can cancel an engagement.' USING ERRCODE = '42501';
    END IF;

    IF v_eng.status <> 'active'::public.engagement_status THEN
        RAISE EXCEPTION 'Only active engagements can be cancelled.' USING ERRCODE = 'P0001';
    END IF;

    IF NOT public.is_admin() THEN
        IF v_eng.payment_type = 'milestone'::public.payment_type THEN
            -- Cannot cancel if any milestone has been funded
            SELECT EXISTS (
                SELECT 1 FROM public.engagement_milestones
                WHERE engagement_id = v_eng.id
                  AND status <> 'awaiting_funding'::public.milestone_status
            ) INTO v_has_funded_milestones;

            IF v_has_funded_milestones THEN
                RAISE EXCEPTION 'Cannot cancel engagement with funded milestones. Use dispute flow or contact support.' USING ERRCODE = 'P0001';
            END IF;
        ELSE
            -- Hourly
            SELECT EXISTS (
                SELECT 1 FROM public.invoices
                WHERE engagement_id = v_eng.id
            ) INTO v_has_invoices;

            IF v_has_invoices THEN
                RAISE EXCEPTION 'Cannot cancel engagement with submitted or approved invoices.' USING ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    UPDATE public.engagements
    SET
        status = 'cancelled'::public.engagement_status,
        cancelled_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_eng.id;

    UPDATE public.projects
    SET
        status = 'cancelled'::public.project_status,
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_eng.project_id;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'engagement_cancelled',
        NULL,
        jsonb_build_object('reason', trim(p_reason))
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.create_support_ticket(
    p_engagement_id UUID,
    p_type public.ticket_type,
    p_subject TEXT,
    p_details TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ticket_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.support_tickets (
        user_id,
        engagement_id,
        type,
        subject,
        details
    )
    VALUES (
        v_caller_id,
        p_engagement_id,
        p_type,
        trim(p_subject),
        trim(p_details)
    )
    RETURNING id INTO v_ticket_id;

    RETURN v_ticket_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 8. Single Source of Truth Designer Dashboard Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_designer_dashboard()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_active_count INT := 0;
    v_milestones_due_week INT := 0;
    v_proposals_pending INT := 0;
    v_proposals_viewed INT := 0;
    v_in_escrow NUMERIC(12, 2) := 0;
    v_pending_release NUMERIC(12, 2) := 0;
    v_total_earned NUMERIC(12, 2) := 0;
    v_available_to_withdraw NUMERIC(12, 2) := 0;
    v_upcoming_deadlines JSONB := '[]'::jsonb;
    v_attention_list JSONB := '[]'::jsonb;
    v_recent_proposals JSONB := '[]'::jsonb;
    v_active_projects JSONB := '[]'::jsonb;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- 1. Active Projects Count
    SELECT COUNT(*) INTO v_active_count
    FROM public.engagements
    WHERE designer_id = v_caller_id
      AND status = 'active'::public.engagement_status;

    -- 2. Proposals Pending & Viewed
    SELECT
        COUNT(*) FILTER (WHERE status = 'pending'::public.proposal_status),
        COUNT(*) FILTER (WHERE status = 'viewed'::public.proposal_status)
    INTO v_proposals_pending, v_proposals_viewed
    FROM public.proposals
    WHERE designer_id = v_caller_id;

    -- 3. Milestones Due This Week for Active Engagements
    SELECT COUNT(*) INTO v_milestones_due_week
    FROM public.engagement_milestones em
    JOIN public.engagements e ON e.id = em.engagement_id
    WHERE e.designer_id = v_caller_id
      AND e.status = 'active'::public.engagement_status
      AND em.status IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status)
      AND em.due_date IS NOT NULL
      AND em.due_date <= (CURRENT_DATE + INTERVAL '7 days');

    -- 4. Financial Calculations:
    -- Escrow: amount of funded, in_progress, submitted milestones
    SELECT COALESCE(SUM(em.amount), 0) INTO v_in_escrow
    FROM public.engagement_milestones em
    JOIN public.engagements e ON e.id = em.engagement_id
    WHERE e.designer_id = v_caller_id
      AND e.status = 'active'::public.engagement_status
      AND em.status IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status, 'submitted'::public.milestone_status);

    -- Pending Release: approved milestones not yet released
    SELECT COALESCE(SUM(em.amount), 0) INTO v_pending_release
    FROM public.engagement_milestones em
    JOIN public.engagements e ON e.id = em.engagement_id
    WHERE e.designer_id = v_caller_id
      AND em.payout_status = 'pending_release'::public.payout_status;

    -- Total Earned: released milestones + paid hourly invoices
    SELECT (
        COALESCE((
            SELECT SUM(em.amount)
            FROM public.engagement_milestones em
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE e.designer_id = v_caller_id
              AND em.payout_status = 'released'::public.payout_status
        ), 0) +
        COALESCE((
            SELECT SUM(inv.amount)
            FROM public.invoices inv
            JOIN public.engagements e ON e.id = inv.engagement_id
            WHERE e.designer_id = v_caller_id
              AND inv.status = 'paid'::public.invoice_status
        ), 0)
    ) INTO v_total_earned;

    -- Available to withdraw (all released funds ready)
    v_available_to_withdraw := v_total_earned;

    -- 5. Upcoming Deadlines Array
    SELECT COALESCE(jsonb_agg(d ORDER BY d->>'due_date' ASC), '[]'::jsonb) INTO v_upcoming_deadlines
    FROM (
        SELECT jsonb_build_object(
            'id', em.id,
            'title', em.name,
            'projectTitle', COALESCE(e.terms_snapshot->>'project_title', 'Contract'),
            'projectId', e.project_id,
            'engagementId', e.id,
            'dueDate', em.due_date,
            'isOverdue', (em.due_date < CURRENT_DATE)
        ) AS d
        FROM public.engagement_milestones em
        JOIN public.engagements e ON e.id = em.engagement_id
        WHERE e.designer_id = v_caller_id
          AND e.status = 'active'::public.engagement_status
          AND em.status IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status)
          AND em.due_date IS NOT NULL
        LIMIT 5
    ) sub;

    -- 6. Attention List Array
    SELECT COALESCE(jsonb_agg(att), '[]'::jsonb) INTO v_attention_list
    FROM (
        SELECT jsonb_build_object(
            'id', em.id,
            'type', 'revision_requested',
            'title', 'Revision Requested: ' || em.name,
            'projectTitle', COALESCE(e.terms_snapshot->>'project_title', 'Contract'),
            'engagementId', e.id,
            'revisionCount', em.revision_count
        ) AS att
        FROM public.engagement_milestones em
        JOIN public.engagements e ON e.id = em.engagement_id
        WHERE e.designer_id = v_caller_id
          AND e.status = 'active'::public.engagement_status
          AND em.status = 'revision_requested'::public.milestone_status
        UNION ALL
        SELECT jsonb_build_object(
            'id', inv.id,
            'type', 'invoice_disputed',
            'title', 'Invoice Disputed: ' || inv.number,
            'projectTitle', COALESCE(e.terms_snapshot->>'project_title', 'Contract'),
            'engagementId', e.id,
            'amount', inv.amount
        ) AS att
        FROM public.invoices inv
        JOIN public.engagements e ON e.id = inv.engagement_id
        WHERE e.designer_id = v_caller_id
          AND inv.status = 'disputed'::public.invoice_status
    ) att_sub;

    -- 7. Recent Proposals
    SELECT COALESCE(jsonb_agg(p ORDER BY p->>'sentDate' DESC), '[]'::jsonb) INTO v_recent_proposals
    FROM (
        SELECT jsonb_build_object(
            'id', prop.id,
            'projectId', prop.project_id,
            'projectTitle', proj.title,
            'sentDate', prop.sent_at,
            'proposedPrice', prop.total_price,
            'status', prop.status
        ) AS p
        FROM public.proposals prop
        JOIN public.projects proj ON proj.id = prop.project_id
        WHERE prop.designer_id = v_caller_id
        ORDER BY prop.sent_at DESC
        LIMIT 5
    ) prop_sub;

    -- 8. Active Projects Full Array
    SELECT COALESCE(jsonb_agg(act), '[]'::jsonb) INTO v_active_projects
    FROM (
        SELECT jsonb_build_object(
            'id', e.id,
            'projectId', e.project_id,
            'proposalId', e.proposal_id,
            'title', COALESCE(e.terms_snapshot->>'project_title', p.title),
            'category', COALESCE(e.terms_snapshot->>'category', p.category),
            'paymentType', e.payment_type,
            'status', e.status,
            'totalBudget', e.total_price,
            'currency', e.currency,
            'hourlyRate', e.hourly_rate,
            'inEscrowAmount', COALESCE((
                SELECT SUM(amount) FROM public.engagement_milestones
                WHERE engagement_id = e.id AND status IN ('funded', 'in_progress', 'submitted')
            ), 0),
            'completedMilestonesCount', (
                SELECT COUNT(*) FROM public.engagement_milestones
                WHERE engagement_id = e.id AND status = 'approved'
            ),
            'totalMilestonesCount', (
                SELECT COUNT(*) FROM public.engagement_milestones
                WHERE engagement_id = e.id
            ),
            'currentMilestoneName', (
                SELECT name FROM public.engagement_milestones
                WHERE engagement_id = e.id AND status IN ('funded', 'in_progress', 'submitted', 'revision_requested')
                ORDER BY sort_order ASC LIMIT 1
            ),
            'startedAt', e.started_at
        ) AS act
        FROM public.engagements e
        JOIN public.projects p ON p.id = e.project_id
        WHERE e.designer_id = v_caller_id
          AND e.status = 'active'::public.engagement_status
    ) act_sub;

    -- Return Consolidated Dashboard Payload
    RETURN jsonb_build_object(
        'activeProjectsCount', v_active_count,
        'milestonesDueThisWeek', v_milestones_due_week,
        'proposalsPendingCount', v_proposals_pending,
        'proposalsViewedCount', v_proposals_viewed,
        'inEscrowAmount', v_in_escrow,
        'pendingRelease', v_pending_release,
        'totalEarnedAmount', v_total_earned,
        'availableToWithdraw', v_available_to_withdraw,
        'upcomingDeadlines', v_upcoming_deadlines,
        'attentionList', v_attention_list,
        'recentProposals', v_recent_proposals,
        'activeProjects', v_active_projects
    );
END;
$$ LANGUAGE plpgsql;
