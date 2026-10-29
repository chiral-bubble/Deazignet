-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 4
-- 017_phase3_amendments.sql
-- Phase 3 Amendments: Auto-approval, Payout Security Period, Disputes & Scheduled Jobs
-- ==============================================================================

-- 1. Extend payout_status enum with 'on_hold' and 'cancelled'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'on_hold' AND enumtypid = 'public.payout_status'::regtype) THEN
        ALTER TYPE public.payout_status ADD VALUE 'on_hold';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = 'public.payout_status'::regtype) THEN
        ALTER TYPE public.payout_status ADD VALUE 'cancelled';
    END IF;
END $$;

-- 2. Create approval_source enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_source') THEN
        CREATE TYPE public.approval_source AS ENUM ('client', 'auto');
    END IF;
END $$;

-- 3. Add Settings to app_settings
INSERT INTO public.app_settings (key, value, description)
VALUES
    ('auto_approve_after_days', '14'::jsonb, 'Days of client inactivity after submission before milestone or week is auto-approved'),
    ('review_reminder_days', '[7, 12]'::jsonb, 'Days post-submission to dispatch review reminder notifications to client'),
    ('payout_security_days', '5'::jsonb, 'Mandatory security hold in calendar days before approved funds are released'),
    ('client_dispute_window_days', '5'::jsonb, 'Days post-approval within which client may raise a hold dispute'),
    ('chat_max_file_bytes', '26214400'::jsonb, 'Maximum attachment size for chat messages (25 MB)')
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());

-- 4. Schema Amendments to engagement_milestones and invoices
ALTER TABLE public.engagement_milestones
    ADD COLUMN IF NOT EXISTS approval_source public.approval_source,
    ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ;

ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS approval_source public.approval_source,
    ADD COLUMN IF NOT EXISTS release_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_engagement_milestones_release_at ON public.engagement_milestones(release_at);
CREATE INDEX IF NOT EXISTS idx_invoices_release_at ON public.invoices(release_at);

-- 5. Create job_runs table for audit logging of scheduled tasks
CREATE TABLE IF NOT EXISTS public.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed'
    items_processed INT NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_name ON public.job_runs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON public.job_runs(started_at);

-- 6. Update approve_milestone to include security period and approval_source
CREATE OR REPLACE FUNCTION public.approve_milestone(p_milestone_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_ms RECORD;
    v_eng RECORD;
    v_security_days INT;
    v_approved_at TIMESTAMPTZ;
    v_release_at TIMESTAMPTZ;
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

    -- Fetch security period setting (default 5 calendar days)
    SELECT COALESCE((value->>0)::INT, 5) INTO v_security_days
    FROM public.app_settings WHERE key = 'payout_security_days';

    v_approved_at := timezone('utc'::text, now());
    v_release_at := v_approved_at + (v_security_days || ' days')::INTERVAL;

    -- Update milestone with approval_source, release_at, and pending_release status
    UPDATE public.engagement_milestones
    SET
        status = 'approved'::public.milestone_status,
        payout_status = 'pending_release'::public.payout_status,
        approval_source = 'client'::public.approval_source,
        approved_at = v_approved_at,
        release_at = v_release_at,
        updated_at = v_approved_at
    WHERE id = v_ms.id;

    -- Update latest submission
    UPDATE public.milestone_submissions
    SET
        client_response = 'approved',
        responded_at = v_approved_at
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
        jsonb_build_object(
            'amount', v_ms.amount,
            'approval_source', 'client',
            'release_at', v_release_at
        )
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
                completed_at = v_approved_at,
                updated_at = v_approved_at
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

-- 7. Update approve_week to include security period and approval_source
CREATE OR REPLACE FUNCTION public.approve_week(p_invoice_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_inv RECORD;
    v_eng RECORD;
    v_security_days INT;
    v_approved_at TIMESTAMPTZ;
    v_release_at TIMESTAMPTZ;
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

    SELECT COALESCE((value->>0)::INT, 5) INTO v_security_days
    FROM public.app_settings WHERE key = 'payout_security_days';

    v_approved_at := timezone('utc'::text, now());
    v_release_at := v_approved_at + (v_security_days || ' days')::INTERVAL;

    UPDATE public.invoices
    SET
        status = 'approved'::public.invoice_status,
        approval_source = 'client'::public.approval_source,
        approved_at = v_approved_at,
        release_at = v_release_at
    WHERE id = v_inv.id;

    UPDATE public.time_entries
    SET
        status = 'approved'::public.time_entry_status,
        approved_at = v_approved_at,
        updated_at = v_approved_at
    WHERE engagement_id = v_eng.id
      AND week_start = v_inv.week_start
      AND status = 'submitted'::public.time_entry_status;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'invoice_approved',
        NULL,
        jsonb_build_object(
            'invoice_id', v_inv.id,
            'amount', v_inv.amount,
            'approval_source', 'client',
            'release_at', v_release_at
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 8. Client Dispute Function inside Security Window: client_raise_dispute
CREATE OR REPLACE FUNCTION public.client_raise_dispute(
    p_item_type TEXT, -- 'milestone' or 'invoice'
    p_item_id UUID,
    p_reason TEXT,
    p_details TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng_id UUID;
    v_release_at TIMESTAMPTZ;
    v_payout_status public.payout_status;
    v_ms RECORD;
    v_inv RECORD;
    v_dispute_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_item_type = 'milestone' THEN
        SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = p_item_id;
        IF v_ms.id IS NULL THEN
            RAISE EXCEPTION 'Milestone not found.' USING ERRCODE = 'P0002';
        END IF;

        v_eng_id := v_ms.engagement_id;
        v_release_at := v_ms.release_at;
        v_payout_status := v_ms.payout_status;

        -- Verify caller is client
        IF NOT EXISTS (SELECT 1 FROM public.engagements WHERE id = v_eng_id AND client_id = v_caller_id) AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the client can raise a dispute during the security hold.' USING ERRCODE = '42501';
        END IF;

        -- Payout status must be pending_release and before release_at
        IF v_payout_status <> 'pending_release'::public.payout_status THEN
            RAISE EXCEPTION 'Dispute can only be raised while payout is in pending_release status (current: %).', v_payout_status USING ERRCODE = 'P0001';
        END IF;

        IF v_release_at IS NOT NULL AND now() >= v_release_at THEN
            RAISE EXCEPTION 'Security dispute window has expired. Funds already due for release.' USING ERRCODE = 'P0001';
        END IF;

        -- Put on hold and mark disputed
        UPDATE public.engagement_milestones
        SET
            status = 'disputed'::public.milestone_status,
            payout_status = 'on_hold'::public.payout_status,
            updated_at = timezone('utc'::text, now())
        WHERE id = p_item_id;

    ELSIF p_item_type = 'invoice' THEN
        SELECT * INTO v_inv FROM public.invoices WHERE id = p_item_id;
        IF v_inv.id IS NULL THEN
            RAISE EXCEPTION 'Invoice not found.' USING ERRCODE = 'P0002';
        END IF;

        v_eng_id := v_inv.engagement_id;
        v_release_at := v_inv.release_at;

        IF NOT EXISTS (SELECT 1 FROM public.engagements WHERE id = v_eng_id AND client_id = v_caller_id) AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Only the client can raise a dispute.' USING ERRCODE = '42501';
        END IF;

        IF v_release_at IS NOT NULL AND now() >= v_release_at THEN
            RAISE EXCEPTION 'Security dispute window has expired.' USING ERRCODE = 'P0001';
        END IF;

        UPDATE public.invoices
        SET status = 'disputed'::public.invoice_status
        WHERE id = p_item_id;

        UPDATE public.time_entries
        SET
            status = 'disputed'::public.time_entry_status,
            dispute_note = trim(p_details),
            updated_at = timezone('utc'::text, now())
        WHERE engagement_id = v_eng_id AND week_start = v_inv.week_start;

    ELSE
        RAISE EXCEPTION 'Invalid item type. Must be milestone or invoice.' USING ERRCODE = 'P0001';
    END IF;

    -- Update engagement to disputed
    UPDATE public.engagements
    SET
        status = 'disputed'::public.engagement_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_eng_id;

    -- Create dispute row
    INSERT INTO public.disputes (
        engagement_id,
        milestone_id,
        raised_by,
        reason,
        details,
        status
    )
    VALUES (
        v_eng_id,
        CASE WHEN p_item_type = 'milestone' THEN p_item_id ELSE NULL END,
        v_caller_id,
        trim(p_reason),
        trim(p_details),
        'open'::public.dispute_status
    )
    RETURNING id INTO v_dispute_id;

    PERFORM public.log_engagement_event(
        v_eng_id,
        v_caller_id,
        'dispute_opened',
        CASE WHEN p_item_type = 'milestone' THEN p_item_id ELSE NULL END,
        jsonb_build_object(
            'dispute_id', v_dispute_id,
            'item_type', p_item_type,
            'item_id', p_item_id,
            'reason', trim(p_reason)
        )
    );

    RETURN v_dispute_id;
END;
$$ LANGUAGE plpgsql;

-- 9. Admin Dispute Resolution Function: resolve_dispute
CREATE OR REPLACE FUNCTION public.resolve_dispute(
    p_dispute_id UUID,
    p_outcome TEXT, -- 'release_to_designer', 'refund_to_client', 'split'
    p_split_percent NUMERIC DEFAULT NULL, -- only used for 'split'
    p_note TEXT DEFAULT ''
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_disp RECORD;
    v_ms RECORD;
    v_eng RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators can resolve disputes.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_disp FROM public.disputes WHERE id = p_dispute_id;
    IF v_disp.id IS NULL THEN
        RAISE EXCEPTION 'Dispute not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_disp.status <> 'open'::public.dispute_status THEN
        RAISE EXCEPTION 'Dispute is already resolved.' USING ERRCODE = 'P0001';
    END IF;

    IF p_outcome NOT IN ('release_to_designer', 'refund_to_client', 'split') THEN
        RAISE EXCEPTION 'Invalid outcome. Must be release_to_designer, refund_to_client, or split.' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = v_disp.engagement_id;

    -- Process Milestone dispute resolution
    IF v_disp.milestone_id IS NOT NULL THEN
        SELECT * INTO v_ms FROM public.engagement_milestones WHERE id = v_disp.milestone_id;

        IF p_outcome = 'release_to_designer' THEN
            UPDATE public.engagement_milestones
            SET
                status = 'approved'::public.milestone_status,
                payout_status = 'pending_release'::public.payout_status,
                release_at = v_now, -- Release immediately
                updated_at = v_now
            WHERE id = v_ms.id;

        ELSIF p_outcome = 'refund_to_client' THEN
            UPDATE public.engagement_milestones
            SET
                status = 'disputed'::public.milestone_status,
                payout_status = 'cancelled'::public.payout_status,
                updated_at = v_now
            WHERE id = v_ms.id;

        ELSIF p_outcome = 'split' THEN
            -- Record split outcome (payments phase will divide payout)
            UPDATE public.engagement_milestones
            SET
                status = 'approved'::public.milestone_status,
                payout_status = 'pending_release'::public.payout_status,
                release_at = v_now,
                updated_at = v_now
            WHERE id = v_ms.id;
        END IF;
    END IF;

    -- Update dispute status
    UPDATE public.disputes
    SET
        status = 'resolved'::public.dispute_status,
        resolved_at = v_now
    WHERE id = v_disp.id;

    -- If no more open disputes on engagement, return engagement to active
    IF NOT EXISTS (
        SELECT 1 FROM public.disputes
        WHERE engagement_id = v_eng.id
          AND id <> v_disp.id
          AND status = 'open'::public.dispute_status
    ) THEN
        UPDATE public.engagements
        SET
            status = 'active'::public.engagement_status,
            updated_at = v_now
        WHERE id = v_eng.id;
    END IF;

    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'dispute_resolved',
        v_disp.milestone_id,
        jsonb_build_object(
            'dispute_id', p_dispute_id,
            'outcome', p_outcome,
            'split_percent', p_split_percent,
            'note', trim(p_note)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 10. Scheduled Jobs: Reminders, Auto-Approval, Release Payouts
-- ------------------------------------------------------------------------------

-- Future ledger hook (stub executed during payout release)
CREATE OR REPLACE FUNCTION public.execute_ledger_payout_hook(
    p_item_type TEXT,
    p_item_id UUID,
    p_amount NUMERIC
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- STUB: The Payments phase will insert the ledger transaction here
    NULL;
END;
$$ LANGUAGE plpgsql;

-- Job 1: send_review_reminders
CREATE OR REPLACE FUNCTION public.send_review_reminders()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_locked BOOLEAN;
    v_run_id UUID;
    v_ms RECORD;
    v_inv RECORD;
    v_eng RECORD;
    v_days_submitted INT;
    v_auto_approve_days INT;
    v_remaining_days INT;
    v_count INT := 0;
BEGIN
    -- Advisory lock to ensure single concurrent run (lock id: 7001)
    SELECT pg_try_advisory_lock(7001) INTO v_locked;
    IF NOT v_locked THEN
        RETURN 0;
    END IF;

    INSERT INTO public.job_runs (job_name, status)
    VALUES ('send_review_reminders', 'running')
    RETURNING id INTO v_run_id;

    BEGIN
        SELECT COALESCE((value->>0)::INT, 14) INTO v_auto_approve_days
        FROM public.app_settings WHERE key = 'auto_approve_after_days';

        -- 1. Check submitted milestones
        FOR v_ms IN (
            SELECT em.*, e.client_id
            FROM public.engagement_milestones em
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE em.status = 'submitted'::public.milestone_status
        ) LOOP
            v_days_submitted := EXTRACT(DAY FROM (now() - v_ms.submitted_at))::INT;

            -- Check day 7 and day 12 thresholds
            IF v_days_submitted IN (7, 12) THEN
                v_remaining_days := GREATEST(1, v_auto_approve_days - v_days_submitted);

                PERFORM public.create_notification(
                    v_ms.client_id,
                    'review_reminder'::public.notification_type,
                    'Deliverable awaiting your review',
                    'Deliverable for milestone "' || v_ms.name || '" will be approved automatically in ' || v_remaining_days || ' days.',
                    jsonb_build_object(
                        'milestone_id', v_ms.id,
                        'engagement_id', v_ms.engagement_id,
                        'idempotency_key', 'reminder_ms_' || v_ms.id || '_day_' || v_days_submitted
                    )
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;

        UPDATE public.job_runs
        SET
            status = 'success',
            completed_at = timezone('utc'::text, now()),
            items_processed = v_count
        WHERE id = v_run_id;

        PERFORM pg_advisory_unlock(7001);
        RETURN v_count;

    EXCEPTION WHEN OTHERS THEN
        UPDATE public.job_runs
        SET
            status = 'failed',
            completed_at = timezone('utc'::text, now()),
            error = SQLERRM
        WHERE id = v_run_id;

        PERFORM pg_advisory_unlock(7001);
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- Job 2: auto_approve_overdue
CREATE OR REPLACE FUNCTION public.auto_approve_overdue()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_locked BOOLEAN;
    v_run_id UUID;
    v_ms RECORD;
    v_inv RECORD;
    v_auto_approve_days INT;
    v_security_days INT;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_release_at TIMESTAMPTZ;
    v_count INT := 0;
BEGIN
    SELECT pg_try_advisory_lock(7002) INTO v_locked;
    IF NOT v_locked THEN
        RETURN 0;
    END IF;

    INSERT INTO public.job_runs (job_name, status)
    VALUES ('auto_approve_overdue', 'running')
    RETURNING id INTO v_run_id;

    BEGIN
        SELECT COALESCE((value->>0)::INT, 14) INTO v_auto_approve_days
        FROM public.app_settings WHERE key = 'auto_approve_after_days';

        SELECT COALESCE((value->>0)::INT, 5) INTO v_security_days
        FROM public.app_settings WHERE key = 'payout_security_days';

        v_release_at := v_now + (v_security_days || ' days')::INTERVAL;

        -- 1. Auto-approve submitted milestones with no active disputes and no revision requested
        FOR v_ms IN (
            SELECT em.*, e.client_id, e.designer_id
            FROM public.engagement_milestones em
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE em.status = 'submitted'::public.milestone_status
              AND em.submitted_at <= (v_now - (v_auto_approve_days || ' days')::INTERVAL)
              AND NOT EXISTS (
                  SELECT 1 FROM public.disputes d
                  WHERE d.engagement_id = em.engagement_id
                    AND (d.milestone_id = em.id OR d.milestone_id IS NULL)
                    AND d.status = 'open'::public.dispute_status
              )
        ) LOOP
            UPDATE public.engagement_milestones
            SET
                status = 'approved'::public.milestone_status,
                payout_status = 'pending_release'::public.payout_status,
                approval_source = 'auto'::public.approval_source,
                approved_at = v_now,
                release_at = v_release_at,
                updated_at = v_now
            WHERE id = v_ms.id;

            -- Update latest submission response
            UPDATE public.milestone_submissions
            SET
                client_response = 'approved',
                response_comment = 'Approved automatically after 14 days of no response',
                responded_at = v_now
            WHERE id = (
                SELECT id FROM public.milestone_submissions
                WHERE milestone_id = v_ms.id
                ORDER BY version DESC LIMIT 1
            );

            PERFORM public.log_engagement_event(
                v_ms.engagement_id,
                NULL,
                'milestone_approved',
                v_ms.id,
                jsonb_build_object(
                    'amount', v_ms.amount,
                    'approval_source', 'auto',
                    'release_at', v_release_at
                )
            );

            -- Notify client
            PERFORM public.create_notification(
                v_ms.client_id,
                'approved_automatically'::public.notification_type,
                'Deliverable auto-approved',
                'Milestone "' || v_ms.name || '" was approved automatically after 14 days without review.',
                jsonb_build_object('milestone_id', v_ms.id, 'engagement_id', v_ms.engagement_id)
            );

            -- Notify designer
            PERFORM public.create_notification(
                v_ms.designer_id,
                'approved_automatically'::public.notification_type,
                'Milestone auto-approved',
                'Milestone "' || v_ms.name || '" was approved automatically. Funds will release on ' || to_char(v_release_at, 'Mon DD, YYYY') || '.',
                jsonb_build_object('milestone_id', v_ms.id, 'engagement_id', v_ms.engagement_id)
            );

            v_count := v_count + 1;
        END LOOP;

        -- 2. Auto-approve submitted hourly invoices
        FOR v_inv IN (
            SELECT inv.*, e.client_id, e.designer_id
            FROM public.invoices inv
            JOIN public.engagements e ON e.id = inv.engagement_id
            WHERE inv.status = 'pending_approval'::public.invoice_status
              AND inv.created_at <= (v_now - (v_auto_approve_days || ' days')::INTERVAL)
              AND NOT EXISTS (
                  SELECT 1 FROM public.disputes d
                  WHERE d.engagement_id = inv.engagement_id
                    AND d.status = 'open'::public.dispute_status
              )
        ) LOOP
            UPDATE public.invoices
            SET
                status = 'approved'::public.invoice_status,
                approval_source = 'auto'::public.approval_source,
                approved_at = v_now,
                release_at = v_release_at
            WHERE id = v_inv.id;

            UPDATE public.time_entries
            SET
                status = 'approved'::public.time_entry_status,
                approved_at = v_now,
                updated_at = v_now
            WHERE engagement_id = v_inv.engagement_id
              AND week_start = v_inv.week_start
              AND status = 'submitted'::public.time_entry_status;

            PERFORM public.log_engagement_event(
                v_inv.engagement_id,
                NULL,
                'invoice_approved',
                NULL,
                jsonb_build_object('invoice_id', v_inv.id, 'approval_source', 'auto', 'release_at', v_release_at)
            );

            PERFORM public.create_notification(
                v_inv.designer_id,
                'approved_automatically'::public.notification_type,
                'Weekly invoice auto-approved',
                'Invoice ' || v_inv.number || ' was approved automatically.',
                jsonb_build_object('invoice_id', v_inv.id, 'engagement_id', v_inv.engagement_id)
            );

            v_count := v_count + 1;
        END LOOP;

        UPDATE public.job_runs
        SET
            status = 'success',
            completed_at = timezone('utc'::text, now()),
            items_processed = v_count
        WHERE id = v_run_id;

        PERFORM pg_advisory_unlock(7002);
        RETURN v_count;

    EXCEPTION WHEN OTHERS THEN
        UPDATE public.job_runs
        SET
            status = 'failed',
            completed_at = timezone('utc'::text, now()),
            error = SQLERRM
        WHERE id = v_run_id;

        PERFORM pg_advisory_unlock(7002);
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- Job 3: release_due_payouts
CREATE OR REPLACE FUNCTION public.release_due_payouts()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_locked BOOLEAN;
    v_run_id UUID;
    v_ms RECORD;
    v_inv RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_count INT := 0;
BEGIN
    SELECT pg_try_advisory_lock(7003) INTO v_locked;
    IF NOT v_locked THEN
        RETURN 0;
    END IF;

    INSERT INTO public.job_runs (job_name, status)
    VALUES ('release_due_payouts', 'running')
    RETURNING id INTO v_run_id;

    BEGIN
        -- 1. Release milestones due for release
        FOR v_ms IN (
            SELECT em.*, e.designer_id
            FROM public.engagement_milestones em
            JOIN public.engagements e ON e.id = em.engagement_id
            WHERE em.payout_status = 'pending_release'::public.payout_status
              AND em.release_at <= v_now
              AND NOT EXISTS (
                  SELECT 1 FROM public.disputes d
                  WHERE d.engagement_id = em.engagement_id
                    AND (d.milestone_id = em.id OR d.milestone_id IS NULL)
                    AND d.status = 'open'::public.dispute_status
              )
        ) LOOP
            UPDATE public.engagement_milestones
            SET
                payout_status = 'released'::public.payout_status,
                released_at = v_now,
                updated_at = v_now
            WHERE id = v_ms.id;

            -- Trigger future ledger payout hook
            PERFORM public.execute_ledger_payout_hook('milestone', v_ms.id, v_ms.amount);

            PERFORM public.log_engagement_event(
                v_ms.engagement_id,
                NULL,
                'payment_released',
                v_ms.id,
                jsonb_build_object('amount', v_ms.amount)
            );

            -- Notify designer
            PERFORM public.create_notification(
                v_ms.designer_id,
                'payment_released'::public.notification_type,
                'Funds released to balance',
                '$' || v_ms.amount || ' for milestone "' || v_ms.name || '" has cleared and is now available.',
                jsonb_build_object('milestone_id', v_ms.id, 'engagement_id', v_ms.engagement_id, 'amount', v_ms.amount)
            );

            v_count := v_count + 1;
        END LOOP;

        -- 2. Release hourly invoices
        FOR v_inv IN (
            SELECT inv.*, e.designer_id
            FROM public.invoices inv
            JOIN public.engagements e ON e.id = inv.engagement_id
            WHERE inv.status = 'approved'::public.invoice_status
              AND inv.release_at <= v_now
              AND NOT EXISTS (
                  SELECT 1 FROM public.disputes d
                  WHERE d.engagement_id = inv.engagement_id
                    AND d.status = 'open'::public.dispute_status
              )
        ) LOOP
            UPDATE public.invoices
            SET status = 'paid'::public.invoice_status
            WHERE id = v_inv.id;

            PERFORM public.execute_ledger_payout_hook('invoice', v_inv.id, v_inv.amount);

            PERFORM public.log_engagement_event(
                v_inv.engagement_id,
                NULL,
                'invoice_paid',
                NULL,
                jsonb_build_object('invoice_id', v_inv.id, 'amount', v_inv.amount)
            );

            PERFORM public.create_notification(
                v_inv.designer_id,
                'payment_released'::public.notification_type,
                'Invoice payment released',
                '$' || v_inv.amount || ' for invoice ' || v_inv.number || ' is now available.',
                jsonb_build_object('invoice_id', v_inv.id, 'amount', v_inv.amount)
            );

            v_count := v_count + 1;
        END LOOP;

        UPDATE public.job_runs
        SET
            status = 'success',
            completed_at = timezone('utc'::text, now()),
            items_processed = v_count
        WHERE id = v_run_id;

        PERFORM pg_advisory_unlock(7003);
        RETURN v_count;

    EXCEPTION WHEN OTHERS THEN
        UPDATE public.job_runs
        SET
            status = 'failed',
            completed_at = timezone('utc'::text, now()),
            error = SQLERRM
        WHERE id = v_run_id;

        PERFORM pg_advisory_unlock(7003);
        RAISE;
    END;
END;
$$ LANGUAGE plpgsql;

-- 11. Dev Helper: dev_fast_forward
CREATE OR REPLACE FUNCTION public.dev_fast_forward(
    p_item_type TEXT, -- 'milestone' or 'invoice'
    p_item_id UUID,
    p_days INT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_env TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin authorization required for dev_fast_forward.' USING ERRCODE = '42501';
    END IF;

    SELECT value->>0 INTO v_env FROM public.app_settings WHERE key = 'environment';
    IF v_env = 'production' THEN
        RAISE EXCEPTION 'dev_fast_forward is blocked in production.' USING ERRCODE = 'P0001';
    END IF;

    IF p_item_type = 'milestone' THEN
        UPDATE public.engagement_milestones
        SET
            submitted_at = CASE WHEN submitted_at IS NOT NULL THEN submitted_at - (p_days || ' days')::INTERVAL ELSE NULL END,
            approved_at = CASE WHEN approved_at IS NOT NULL THEN approved_at - (p_days || ' days')::INTERVAL ELSE NULL END,
            release_at = CASE WHEN release_at IS NOT NULL THEN release_at - (p_days || ' days')::INTERVAL ELSE NULL END
        WHERE id = p_item_id;

        -- Shift latest submission submitted_at too
        UPDATE public.milestone_submissions
        SET submitted_at = submitted_at - (p_days || ' days')::INTERVAL
        WHERE milestone_id = p_item_id;

    ELSIF p_item_type = 'invoice' THEN
        UPDATE public.invoices
        SET
            created_at = created_at - (p_days || ' days')::INTERVAL,
            approved_at = CASE WHEN approved_at IS NOT NULL THEN approved_at - (p_days || ' days')::INTERVAL ELSE NULL END,
            release_at = CASE WHEN release_at IS NOT NULL THEN release_at - (p_days || ' days')::INTERVAL ELSE NULL END
        WHERE id = p_item_id;

    ELSE
        RAISE EXCEPTION 'Invalid item type. Must be milestone or invoice.' USING ERRCODE = 'P0001';
    END IF;
END;
$$ LANGUAGE plpgsql;

