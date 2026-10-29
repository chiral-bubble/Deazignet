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
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 4
-- 018_conversations_schema.sql
-- Conversations & Realtime Messaging Schema
-- ==============================================================================

-- Drop tables if needed for clean migrations
DROP TABLE IF EXISTS public.conversation_reports CASCADE;
DROP TABLE IF EXISTS public.conversation_user_settings CASCADE;
DROP TABLE IF EXISTS public.message_attachments CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- 1. Conversations Table
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    CONSTRAINT uq_conversations_client_designer_project UNIQUE (client_id, designer_id, project_id)
);

-- 2. Messages Table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NULL for system notifications
    kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system')),
    system_type TEXT,
    body TEXT NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 4000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    delivered_at TIMESTAMPTZ,
    flagged BOOLEAN NOT NULL DEFAULT false
);

-- 3. Message Attachments Table (Max 10 per message)
CREATE TABLE public.message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    mime_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Conversation User Settings Table (Per-user flags: muted, archived, read receipts)
CREATE TABLE public.conversation_user_settings (
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    muted BOOLEAN NOT NULL DEFAULT false,
    archived BOOLEAN NOT NULL DEFAULT false,
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

-- 5. Conversation Reports Table
CREATE TABLE public.conversation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
    details TEXT NOT NULL CHECK (char_length(trim(details)) > 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for Fast Lookups and Cursor Pagination
CREATE INDEX IF NOT EXISTS idx_conversations_client_id ON public.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_designer_id ON public.conversations(designer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON public.message_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_conv_user_settings_user ON public.conversation_user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_reports_conversation ON public.conversation_reports(conversation_id);
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 4
-- 019_conversations_functions.sql
-- Business Logic & Security Functions for Conversations
-- Security Definer, search_path = public, strict participation checks
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper: Compute Flagged Content (Email, Phone, Off-platform payment)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_message_flagged(p_body TEXT)
RETURNS BOOLEAN
IMMUTABLE
AS $$
BEGIN
    -- 1. Email pattern
    IF p_body ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN
        RETURN true;
    END IF;

    -- 2. Phone number pattern (7+ digits with common separators)
    IF p_body ~ '(\+?[0-9]{1,3}[-.\s]?)?(\(?\d{3,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{3,4}' AND length(regexp_replace(p_body, '[^0-9]', '', 'g')) >= 8 THEN
        RETURN true;
    END IF;

    -- 3. Off-platform payment keywords
    IF p_body ~* '(paypal|zelle|venmo|cashapp|crypto|bitcoin|usdt|wire transfer|pay outside|bank transfer|direct transfer|remita|western union)' THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. start_conversation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_conversation(
    p_project_id UUID,
    p_designer_id UUID,
    p_first_message TEXT,
    p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_prop RECORD;
    v_conv_id UUID;
    v_msg_id UUID;
    v_flagged BOOLEAN;
    v_file JSONB;
    v_max_bytes BIGINT;
    v_ext TEXT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Rule: Only the project owner (client) can initiate a conversation
    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the client project owner can initiate a conversation.' USING ERRCODE = '42501';
    END IF;

    -- Rule: Must have viewed proposal that is not declined or withdrawn
    SELECT * INTO v_prop FROM public.proposals
    WHERE project_id = p_project_id AND designer_id = p_designer_id;

    IF v_prop.id IS NULL THEN
        RAISE EXCEPTION 'No proposal found for this designer on this project.' USING ERRCODE = 'P0001';
    END IF;

    IF v_prop.viewed_at IS NULL AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Client must view the designer proposal before initiating a conversation.' USING ERRCODE = 'P0001';
    END IF;

    IF v_prop.status IN ('declined'::public.proposal_status, 'withdrawn'::public.proposal_status) THEN
        RAISE EXCEPTION 'Cannot start a conversation on a declined or withdrawn proposal.' USING ERRCODE = 'P0001';
    END IF;

    -- Find existing or create conversation
    SELECT id INTO v_conv_id FROM public.conversations
    WHERE client_id = v_caller_id AND designer_id = p_designer_id AND project_id = p_project_id;

    IF v_conv_id IS NULL THEN
        INSERT INTO public.conversations (
            project_id,
            proposal_id,
            client_id,
            designer_id,
            created_by,
            last_message_at,
            last_message_preview
        )
        VALUES (
            p_project_id,
            v_prop.id,
            v_caller_id,
            p_designer_id,
            v_caller_id,
            timezone('utc'::text, now()),
            substring(p_first_message from 1 for 100)
        )
        RETURNING id INTO v_conv_id;

        -- Create initial user settings for both parties
        INSERT INTO public.conversation_user_settings (conversation_id, user_id, last_read_at)
        VALUES
            (v_conv_id, v_caller_id, timezone('utc'::text, now())),
            (v_conv_id, p_designer_id, NULL)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Compute content flag
    v_flagged := public.check_message_flagged(p_first_message);

    -- Insert first message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        kind,
        body,
        flagged
    )
    VALUES (
        v_conv_id,
        v_caller_id,
        'user',
        p_first_message,
        v_flagged
    )
    RETURNING id INTO v_msg_id;

    -- Insert any attachments
    IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
        IF jsonb_array_length(p_attachments) > 10 THEN
            RAISE EXCEPTION 'Maximum 10 attachments per message.' USING ERRCODE = 'P0001';
        END IF;

        SELECT COALESCE((value->>0)::BIGINT, 26214400) INTO v_max_bytes
        FROM public.app_settings WHERE key = 'chat_max_file_bytes';

        FOR v_file IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
            IF (v_file->>'size_bytes')::BIGINT > v_max_bytes THEN
                RAISE EXCEPTION 'Attachment exceeds maximum size of 25MB.' USING ERRCODE = 'P0001';
            END IF;

            v_ext := lower(substring(v_file->>'file_name' from '\.([^\.]+)$'));
            IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'pdf', 'dwg', 'ifc', 'zip', 'gif', 'webp') THEN
                RAISE EXCEPTION 'Attachment file type .% is not allowed in chat.', v_ext USING ERRCODE = 'P0001';
            END IF;

            INSERT INTO public.message_attachments (message_id, path, file_name, size_bytes, mime_type)
            VALUES (
                v_msg_id,
                v_file->>'path',
                v_file->>'file_name',
                (v_file->>'size_bytes')::BIGINT,
                v_file->>'mime_type'
            );
        END LOOP;
    END IF;

    -- Send message_received notification to designer
    PERFORM public.create_notification(
        p_designer_id,
        'message_received'::public.notification_type,
        'New message from client',
        substring(p_first_message from 1 for 100),
        jsonb_build_object(
            'conversation_id', v_conv_id,
            'project_id', p_project_id,
            'sender_id', v_caller_id
        )
    );

    RETURN v_conv_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. send_message
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_message(
    p_conversation_id UUID,
    p_body TEXT,
    p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_recipient_id UUID;
    v_recent_msg_count INT;
    v_client_msg_exists BOOLEAN;
    v_flagged BOOLEAN;
    v_msg_id UUID;
    v_file JSONB;
    v_max_bytes BIGINT;
    v_ext TEXT;
    v_is_muted BOOLEAN;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF v_conv.id IS NULL THEN
        RAISE EXCEPTION 'Conversation not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Participant check
    IF v_conv.client_id <> v_caller_id AND v_conv.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'You are not a participant in this conversation.'
            USING HINT = 'not_participant', ERRCODE = '42501';
    END IF;

    -- Closed check
    IF v_conv.status = 'closed' THEN
        RAISE EXCEPTION 'This conversation is closed and read-only.'
            USING HINT = 'conversation_closed', ERRCODE = 'P0001';
    END IF;

    -- Designer rule: Client must have sent at least one message first
    IF v_caller_id = v_conv.designer_id AND NOT public.is_admin() THEN
        SELECT EXISTS (
            SELECT 1 FROM public.messages
            WHERE conversation_id = v_conv.id
              AND sender_id = v_conv.client_id
        ) INTO v_client_msg_exists;

        IF NOT v_client_msg_exists THEN
            RAISE EXCEPTION 'Designers can only reply after the client has sent a message.'
                USING HINT = 'waiting_for_client', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Rate limiting: Max 20 messages per minute per user
    SELECT COUNT(*) INTO v_recent_msg_count
    FROM public.messages
    WHERE sender_id = v_caller_id
      AND created_at >= (v_now - INTERVAL '1 minute');

    IF v_recent_msg_count >= 20 AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Message rate limit exceeded (maximum 20 messages per minute).'
            USING HINT = 'rate_limited', ERRCODE = 'P0001';
    END IF;

    -- Content flagging
    v_flagged := public.check_message_flagged(p_body);

    -- Insert Message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        kind,
        body,
        flagged
    )
    VALUES (
        v_conv.id,
        v_caller_id,
        'user',
        trim(p_body),
        v_flagged
    )
    RETURNING id INTO v_msg_id;

    -- Process Attachments
    IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
        IF jsonb_array_length(p_attachments) > 10 THEN
            RAISE EXCEPTION 'Maximum 10 attachments per message.' USING ERRCODE = 'P0001';
        END IF;

        SELECT COALESCE((value->>0)::BIGINT, 26214400) INTO v_max_bytes
        FROM public.app_settings WHERE key = 'chat_max_file_bytes';

        FOR v_file IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
            IF (v_file->>'size_bytes')::BIGINT > v_max_bytes THEN
                RAISE EXCEPTION 'Attachment exceeds maximum size of 25MB.'
                    USING HINT = 'invalid_file', ERRCODE = 'P0001';
            END IF;

            v_ext := lower(substring(v_file->>'file_name' from '\.([^\.]+)$'));
            IF v_ext NOT IN ('jpg', 'jpeg', 'png', 'pdf', 'dwg', 'ifc', 'zip', 'gif', 'webp') THEN
                RAISE EXCEPTION 'Attachment file type .% is not allowed in chat.', v_ext
                    USING HINT = 'invalid_file', ERRCODE = 'P0001';
            END IF;

            INSERT INTO public.message_attachments (message_id, path, file_name, size_bytes, mime_type)
            VALUES (
                v_msg_id,
                v_file->>'path',
                v_file->>'file_name',
                (v_file->>'size_bytes')::BIGINT,
                v_file->>'mime_type'
            );
        END LOOP;
    END IF;

    -- Update conversation preview and timestamp
    UPDATE public.conversations
    SET
        last_message_at = v_now,
        last_message_preview = substring(trim(p_body) from 1 for 100)
    WHERE id = v_conv.id;

    -- Update sender's last_read_at
    INSERT INTO public.conversation_user_settings (conversation_id, user_id, last_read_at)
    VALUES (v_conv.id, v_caller_id, v_now)
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = v_now;

    -- Notify recipient (if not muted)
    v_recipient_id := CASE WHEN v_caller_id = v_conv.client_id THEN v_conv.designer_id ELSE v_conv.client_id END;

    SELECT COALESCE(muted, false) INTO v_is_muted
    FROM public.conversation_user_settings
    WHERE conversation_id = v_conv.id AND user_id = v_recipient_id;

    IF NOT v_is_muted THEN
        PERFORM public.create_notification(
            v_recipient_id,
            'message_received'::public.notification_type,
            'New message',
            substring(trim(p_body) from 1 for 100),
            jsonb_build_object(
                'conversation_id', v_conv.id,
                'message_id', v_msg_id,
                'sender_id', v_caller_id
            )
        );
    END IF;

    RETURN v_msg_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. Delivery & Read Receipts: mark_delivered, mark_read
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_delivered(p_conversation_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF v_conv.id IS NULL THEN RETURN; END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RETURN;
    END IF;

    UPDATE public.messages
    SET delivered_at = v_now
    WHERE conversation_id = p_conversation_id
      AND sender_id <> v_caller_id
      AND delivered_at IS NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_read(p_conversation_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_conv RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN RETURN; END IF;

    SELECT * INTO v_conv FROM public.conversations WHERE id = p_conversation_id;
    IF v_conv.id IS NULL THEN RETURN; END IF;

    IF v_conv.client_id <> v_caller_id AND v_conv.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RETURN;
    END IF;

    -- Update delivered on any un-delivered incoming messages
    UPDATE public.messages
    SET delivered_at = COALESCE(delivered_at, v_now)
    WHERE conversation_id = p_conversation_id
      AND sender_id <> v_caller_id;

    -- Update last_read_at in user settings
    INSERT INTO public.conversation_user_settings (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, v_now)
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET last_read_at = v_now;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. User Settings & Reports
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_conversation_flags(
    p_conversation_id UUID,
    p_muted BOOLEAN DEFAULT NULL,
    p_archived BOOLEAN DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.conversation_user_settings (conversation_id, user_id, muted, archived)
    VALUES (
        p_conversation_id,
        v_caller_id,
        COALESCE(p_muted, false),
        COALESCE(p_archived, false)
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET
        muted = COALESCE(p_muted, conversation_user_settings.muted),
        archived = COALESCE(p_archived, conversation_user_settings.archived);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.report_conversation(
    p_conversation_id UUID,
    p_reason TEXT,
    p_details TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_rep_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.conversation_reports (conversation_id, reporter_id, reason, details)
    VALUES (p_conversation_id, v_caller_id, trim(p_reason), trim(p_details))
    RETURNING id INTO v_rep_id;

    RETURN v_rep_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. get_unread_counts
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_total INT := 0;
    v_conv_list JSONB := '[]'::jsonb;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('total_unread', 0, 'conversations', '[]'::jsonb);
    END IF;

    SELECT
        COALESCE(SUM(c.unread_count), 0),
        COALESCE(jsonb_agg(jsonb_build_object(
            'conversation_id', c.conversation_id,
            'unread_count', c.unread_count
        )), '[]'::jsonb)
    INTO v_total, v_conv_list
    FROM (
        SELECT
            conv.id AS conversation_id,
            COUNT(m.id)::INT AS unread_count
        FROM public.conversations conv
        LEFT JOIN public.conversation_user_settings cus
            ON cus.conversation_id = conv.id AND cus.user_id = v_caller_id
        JOIN public.messages m
            ON m.conversation_id = conv.id
            AND m.sender_id <> v_caller_id
            AND (cus.last_read_at IS NULL OR m.created_at > cus.last_read_at)
        WHERE (conv.client_id = v_caller_id OR conv.designer_id = v_caller_id)
        GROUP BY conv.id
    ) c;

    RETURN jsonb_build_object(
        'total_unread', v_total,
        'conversations', v_conv_list
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. Automated System Messages from Engagement & Proposal Events
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_event_to_system_message()
RETURNS TRIGGER AS $$
DECLARE
    v_conv_id UUID;
    v_body TEXT;
    v_sys_type TEXT;
BEGIN
    -- Determine linked conversation
    SELECT id INTO v_conv_id FROM public.conversations
    WHERE project_id = (SELECT project_id FROM public.engagements WHERE id = NEW.engagement_id);

    IF v_conv_id IS NULL THEN RETURN NEW; END IF;

    CASE NEW.event_type
        WHEN 'proposal_accepted' THEN
            v_body := 'Proposal was accepted. Engagement officially started.';
            v_sys_type := 'proposal_accepted';
        WHEN 'milestone_funded' THEN
            v_body := 'Milestone funds deposited into escrow.';
            v_sys_type := 'milestone_funded';
        WHEN 'milestone_started' THEN
            v_body := 'Designer started work on milestone.';
            v_sys_type := 'milestone_started';
        WHEN 'milestone_submitted' THEN
            v_body := 'Deliverables submitted for review.';
            v_sys_type := 'deliverable_submitted';
        WHEN 'revision_requested' THEN
            v_body := 'Client requested revisions on deliverables.';
            v_sys_type := 'revision_requested';
        WHEN 'milestone_approved' THEN
            v_body := 'Milestone approved. Funds moving to security release hold.';
            v_sys_type := 'milestone_approved';
        WHEN 'payment_released' THEN
            v_body := 'Funds released from escrow.';
            v_sys_type := 'payment_released';
        WHEN 'dispute_opened' THEN
            v_body := 'Dispute opened. Payout held on hold.';
            v_sys_type := 'dispute_opened';
        WHEN 'dispute_resolved' THEN
            v_body := 'Dispute has been resolved by administration.';
            v_sys_type := 'dispute_resolved';
        WHEN 'engagement_completed' THEN
            v_body := 'Contract completed. All terms fulfilled.';
            v_sys_type := 'engagement_completed';
        ELSE
            RETURN NEW;
    END CASE;

    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        kind,
        system_type,
        body
    )
    VALUES (
        v_conv_id,
        NULL,
        'system',
        v_sys_type,
        v_body
    );

    UPDATE public.conversations
    SET
        last_message_at = timezone('utc'::text, now()),
        last_message_preview = v_body
    WHERE id = v_conv_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_engagement_event_to_system_msg ON public.engagement_events;
CREATE TRIGGER trg_engagement_event_to_system_msg
AFTER INSERT ON public.engagement_events
FOR EACH ROW EXECUTE FUNCTION public.handle_event_to_system_message();

-- Close conversation trigger when engagement completes or is cancelled
CREATE OR REPLACE FUNCTION public.close_conversation_on_finish()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed'::public.engagement_status, 'cancelled'::public.engagement_status) THEN
        UPDATE public.conversations
        SET status = 'closed'
        WHERE project_id = NEW.project_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_close_conversation_on_finish ON public.engagements;
CREATE TRIGGER trg_close_conversation_on_finish
AFTER UPDATE OF status ON public.engagements
FOR EACH ROW EXECUTE FUNCTION public.close_conversation_on_finish();
-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 4
-- 020_notifications.sql
-- Notification Types, Preferences, Creation & Management Functions
-- ==============================================================================

-- 1. Create notification_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE public.notification_type AS ENUM (
            'proposal_received',
            'proposal_viewed',
            'proposal_shortlisted',
            'proposal_accepted',
            'proposal_declined',
            'milestone_funded',
            'deliverable_submitted',
            'review_reminder',
            'deliverable_approved',
            'approved_automatically',
            'revision_requested',
            'payment_released',
            'dispute_opened',
            'dispute_resolved',
            'withdrawal_paid',
            'withdrawal_failed',
            'message_received',
            'credential_verified',
            'credential_rejected',
            'plan_renewal',
            'system_announcement'
        );
    END IF;
END $$;

-- 2. Drop tables if recreating
DROP TABLE IF EXISTS public.notification_preferences CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;

-- 3. Notifications Table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
    body TEXT NOT NULL CHECK (char_length(trim(body)) > 0),
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    read_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- 4. Notification Preferences Table
CREATE TABLE public.notification_preferences (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type public.notification_type NOT NULL,
    in_app BOOLEAN NOT NULL DEFAULT true,
    email BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON public.notifications(deleted_at);

-- ------------------------------------------------------------------------------
-- 5. Helper Function: create_notification (Security Definer, Idempotent, Opt-Out)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type public.notification_type,
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_in_app BOOLEAN;
    v_idempotency_key TEXT;
    v_existing_id UUID;
    v_notification_id UUID;
BEGIN
    -- Check user preference for this notification type
    SELECT in_app INTO v_in_app
    FROM public.notification_preferences
    WHERE user_id = p_user_id AND type = p_type;

    IF v_in_app IS FALSE THEN
        -- User explicitly turned off in-app notifications for this type
        RETURN NULL;
    END IF;

    -- Idempotency check: avoid duplicate notifications for the same underlying event
    v_idempotency_key := p_data->>'idempotency_key';
    IF v_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM public.notifications
        WHERE user_id = p_user_id
          AND type = p_type
          AND (data->>'idempotency_key') = v_idempotency_key
          AND created_at >= (timezone('utc'::text, now()) - INTERVAL '30 days')
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            RETURN v_existing_id;
        END IF;
    END IF;

    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        p_user_id,
        p_type,
        trim(p_title),
        trim(p_body),
        p_data
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. Notification Management Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_notification_read(
    p_id UUID,
    p_read BOOLEAN DEFAULT true
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
    SET read_at = CASE WHEN p_read THEN timezone('utc'::text, now()) ELSE NULL END
    WHERE id = p_id
      AND (user_id = v_caller_id OR public.is_admin());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(
    p_type public.notification_type DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.notifications
    SET read_at = timezone('utc'::text, now())
    WHERE user_id = v_caller_id
      AND read_at IS NULL
      AND (p_type IS NULL OR type = p_type);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.delete_notification(p_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- Soft delete to allow 10-second undo
    UPDATE public.notifications
    SET deleted_at = timezone('utc'::text, now())
    WHERE id = p_id
      AND (user_id = v_caller_id OR public.is_admin());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.undo_delete_notification(p_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_notif RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_notif FROM public.notifications WHERE id = p_id;
    IF v_notif.id IS NULL THEN
        RAISE EXCEPTION 'Notification not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_notif.user_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    -- Undo permitted only within 10 seconds
    IF v_notif.deleted_at IS NULL OR v_notif.deleted_at < (timezone('utc'::text, now()) - INTERVAL '10 seconds') THEN
        RAISE EXCEPTION 'Undo delete window has expired (exceeded 10 seconds).' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.notifications
    SET deleted_at = NULL
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.purge_old_notifications()
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INT := 0;
BEGIN
    -- Purge notifications older than 180 days, and soft-deleted after 7 days
    WITH deleted_rows AS (
        DELETE FROM public.notifications
        WHERE created_at < (timezone('utc'::text, now()) - INTERVAL '180 days')
           OR deleted_at < (timezone('utc'::text, now()) - INTERVAL '7 days')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted_rows;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. Automatic Event Wiring: Proposal Events & Credential Verification
-- ------------------------------------------------------------------------------

-- Trigger on proposal_events: dispatches notifications to designer
CREATE OR REPLACE FUNCTION public.handle_proposal_event_to_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_prop RECORD;
    v_proj RECORD;
BEGIN
    SELECT * INTO v_prop FROM public.proposals WHERE id = NEW.proposal_id;
    IF v_prop.id IS NULL THEN RETURN NEW; END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = v_prop.project_id;

    CASE NEW.event_type
        WHEN 'viewed' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_viewed'::public.notification_type,
                'Client viewed your proposal',
                'Your proposal for "' || v_proj.title || '" was viewed by the client.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_viewed_' || v_prop.id
                )
            );
        WHEN 'shortlisted' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_shortlisted'::public.notification_type,
                'Proposal shortlisted!',
                'Congratulations! Your proposal for "' || v_proj.title || '" was shortlisted.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_shortlisted_' || v_prop.id
                )
            );
        WHEN 'accepted' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_accepted'::public.notification_type,
                'Proposal accepted! Project awarded',
                'Your proposal for "' || v_proj.title || '" was accepted. Engagement has started.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_accepted_' || v_prop.id
                )
            );
        WHEN 'declined' THEN
            PERFORM public.create_notification(
                v_prop.designer_id,
                'proposal_declined'::public.notification_type,
                'Proposal update',
                'Your proposal for "' || v_proj.title || '" was declined.',
                jsonb_build_object(
                    'proposal_id', v_prop.id,
                    'project_id', v_proj.id,
                    'idempotency_key', 'prop_declined_' || v_prop.id
                )
            );
        ELSE
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proposal_event_to_notification ON public.proposal_events;
CREATE TRIGGER trg_proposal_event_to_notification
AFTER INSERT ON public.proposal_events
FOR EACH ROW EXECUTE FUNCTION public.handle_proposal_event_to_notification();

-- Trigger on credentials table for Admin Review Notifications
CREATE OR REPLACE FUNCTION public.handle_credential_status_to_notification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'verified'::public.credential_status THEN
            PERFORM public.create_notification(
                NEW.designer_id,
                'credential_verified'::public.notification_type,
                'Professional credential verified',
                'Your credential "' || NEW.title || '" has been verified by the Dezignet review team.',
                jsonb_build_object('credential_id', NEW.id)
            );
        ELSIF NEW.status = 'rejected'::public.credential_status THEN
            PERFORM public.create_notification(
                NEW.designer_id,
                'credential_rejected'::public.notification_type,
                'Credential review decision',
                'Your credential "' || NEW.title || '" was rejected: ' || COALESCE(NEW.rejection_reason, 'Information could not be validated.'),
                jsonb_build_object('credential_id', NEW.id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_credential_status_to_notif ON public.credentials;
CREATE TRIGGER trg_credential_status_to_notif
AFTER UPDATE OF status ON public.credentials
FOR EACH ROW EXECUTE FUNCTION public.handle_credential_status_to_notification();

-- Admin broadcast: announce_system
CREATE OR REPLACE FUNCTION public.announce_system(
    p_title TEXT,
    p_body TEXT,
    p_audience TEXT DEFAULT 'all' -- 'all', 'designer', 'client'
)
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_count INT := 0;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin authorization required.' USING ERRCODE = '42501';
    END IF;

    FOR v_user IN (
        SELECT id FROM public.profiles
        WHERE (p_audience = 'all' OR role::TEXT = p_audience)
    ) LOOP
        PERFORM public.create_notification(
            v_user.id,
            'system_announcement'::public.notification_type,
            p_title,
            p_body,
            jsonb_build_object('audience', p_audience)
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
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
