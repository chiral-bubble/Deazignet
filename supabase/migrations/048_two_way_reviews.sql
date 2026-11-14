-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - TWO-WAY DOUBLE-BLIND REVIEWS SYSTEM
-- 048_two_way_reviews.sql
-- Implements bilateral reviews for completed engagements:
-- 1. Double-blind 14-day review window
-- 2. Client reviews designer & Designer reviews client with dimension ratings
-- 3. Pre-reveal editing by author; post-reveal 10-minute editable reply
-- 4. Review reporting, moderation (hide/restore) & audit logging
-- 5. Automated pair-reveal via reveal_pending_reviews() cron job honoring disputes
-- 6. Rating aggregation with min_reviews_for_average (3) threshold
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATION TYPES & APPLICATION SETTINGS
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_requested'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_revealed'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_reply'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_hidden'; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notification_types') THEN
        INSERT INTO public.notification_types (type, title_template, body_template, email_template) VALUES
        ('review_requested', 'Review Requested', 'Your engagement has completed. Please leave your review.', 'review_requested'),
        ('review_revealed', 'Reviews Published', 'Reviews for your completed engagement have been published.', 'review_revealed'),
        ('review_reply', 'Review Reply Posted', 'A reply has been posted to your review.', 'review_reply'),
        ('review_hidden', 'Review Moderated', 'Your review has been hidden by moderators.', 'review_hidden')
        ON CONFLICT (type) DO UPDATE SET
            title_template = EXCLUDED.title_template,
            body_template = EXCLUDED.body_template;
    END IF;
END $$;

-- Upsert App Settings
INSERT INTO public.app_settings (key, value, description) VALUES
('review_window_days', '14'::jsonb, 'Double-blind review window in days after engagement completion'),
('min_reviews_for_average', '3'::jsonb, 'Minimum number of revealed reviews required before showing average rating'),
('review_reminder_days', '[3, 10]'::jsonb, 'Days after completion to send review reminder notifications')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 2. UPGRADE REVIEWS TABLE SCHEMA & MIGRATE DATA
-- ------------------------------------------------------------------------------

-- Drop unique constraint on engagement_id alone so both parties can review
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.reviews'::regclass 
          AND contype = 'u'
          AND conname NOT LIKE '%role%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
    END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop previous status check constraint
DO $$
BEGIN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Add two-way review columns
ALTER TABLE public.reviews
    ADD COLUMN IF NOT EXISTS reviewer_role TEXT,
    ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS reviewee_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS ratings JSONB,
    ADD COLUMN IF NOT EXISTS would_work_again BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS reply TEXT,
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS flagged_content BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS flag_reasons TEXT[] NOT NULL DEFAULT '{}';

-- Migrate existing client reviews
UPDATE public.reviews
SET reviewer_role = 'client',
    reviewer_id = COALESCE(reviewer_id, client_id),
    reviewee_id = COALESCE(reviewee_id, designer_id),
    would_work_again = COALESCE(would_work_again, would_hire_again, TRUE),
    reply = COALESCE(reply, designer_reply),
    edited_at = COALESCE(edited_at, updated_at),
    revealed_at = COALESCE(revealed_at, created_at),
    ratings = COALESCE(
        ratings,
        jsonb_strip_nulls(
            jsonb_build_object(
                'communication', communication_rating,
                'quality_of_work', quality_rating,
                'timeliness', timeliness_rating
            )
        )
    )
WHERE reviewer_role IS NULL;

-- Set NOT NULL constraints
ALTER TABLE public.reviews
    ALTER COLUMN reviewer_role SET NOT NULL,
    ALTER COLUMN reviewer_id SET NOT NULL,
    ALTER COLUMN reviewee_id SET NOT NULL;

-- Add updated constraints
DO $$
BEGIN
    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reviewer_role_check;
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_reviewer_role_check CHECK (reviewer_role IN ('client', 'designer'));

    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_check CHECK (status IN ('pending', 'visible', 'hidden'));

    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_reply_len_check;
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_reply_len_check CHECK (reply IS NULL OR char_length(reply) <= 800);

    ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_engagement_role_unique;
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_engagement_role_unique UNIQUE (engagement_id, reviewer_role);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.reviews ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON public.reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status_revealed ON public.reviews(status, revealed_at);
CREATE INDEX IF NOT EXISTS idx_reviews_engagement_role ON public.reviews(engagement_id, reviewer_role);

-- ------------------------------------------------------------------------------
-- 3. REVIEWS REPORTS TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.reviews_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL CHECK (reason IN ('inappropriate_content', 'harassment', 'conflict_of_interest', 'false_information', 'private_contact_info', 'other')),
    details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),
    resolution TEXT,
    resolved_by UUID REFERENCES public.profiles(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reviews_reports_review_id ON public.reviews_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reports_reporter_id ON public.reviews_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reports_status ON public.reviews_reports(status);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_read_policy" ON public.reviews;
DROP POLICY IF EXISTS "reviews_read_visible" ON public.reviews;
CREATE POLICY "reviews_read_policy"
    ON public.reviews
    FOR SELECT
    TO authenticated, anon
    USING (
        (status = 'visible' AND revealed_at IS NOT NULL)
        OR ((SELECT auth.uid()) IS NOT NULL AND reviewer_id = (SELECT auth.uid()))
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "reviews_reports_read_policy" ON public.reviews_reports;
CREATE POLICY "reviews_reports_read_policy"
    ON public.reviews_reports
    FOR SELECT
    TO authenticated
    USING (
        reporter_id = (SELECT auth.uid())
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "reviews_reports_insert_policy" ON public.reviews_reports;
CREATE POLICY "reviews_reports_insert_policy"
    ON public.reviews_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (
        reporter_id = (SELECT auth.uid())
    );

-- ------------------------------------------------------------------------------
-- 5. REVIEWS FUNCTIONS
-- ------------------------------------------------------------------------------

-- Helper: Flag detection for contact info & external links
CREATE OR REPLACE FUNCTION public.check_review_content_flags(p_comment TEXT)
RETURNS RECORD
LANGUAGE plpgsql
AS $$
DECLARE
    v_flagged BOOLEAN := FALSE;
    v_reasons TEXT[] := ARRAY[]::TEXT[];
    v_res RECORD;
BEGIN
    -- Email pattern
    IF p_comment ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' THEN
        v_flagged := TRUE;
        v_reasons := array_append(v_reasons, 'contains_email');
    END IF;

    -- Phone pattern
    IF p_comment ~ '(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
       OR p_comment ~ '\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b'
       OR p_comment ~ '\b\d{10,12}\b' THEN
        v_flagged := TRUE;
        v_reasons := array_append(v_reasons, 'contains_phone');
    END IF;

    -- External link pattern
    IF p_comment ~* 'https?://[^\s]+'
       OR p_comment ~* 'www\.[^\s]+'
       OR p_comment ~* '\b[a-zA-Z0-9.-]+\.(com|org|net|io|co|dev|design|app)\b' THEN
        v_flagged := TRUE;
        v_reasons := array_append(v_reasons, 'contains_link');
    END IF;

    SELECT v_flagged AS flagged, v_reasons AS reasons INTO v_res;
    RETURN v_res;
END;
$$;

-- 5.1 submit_review
CREATE OR REPLACE FUNCTION public.submit_review(
    p_engagement_id UUID,
    p_rating INT,
    p_ratings JSONB DEFAULT NULL,
    p_would_work_again BOOLEAN DEFAULT TRUE,
    p_comment TEXT DEFAULT ''
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_eng RECORD;
    v_role TEXT;
    v_reviewee_id UUID;
    v_window_days INT;
    v_completed_at TIMESTAMPTZ;
    v_total_ms INT := 0;
    v_approved_ms INT := 0;
    v_total_inv INT := 0;
    v_approved_inv INT := 0;
    v_flags RECORD;
    v_other_rev RECORD;
    v_has_open_dispute BOOLEAN := FALSE;
    v_initial_status TEXT := 'pending';
    v_revealed_at TIMESTAMPTZ := NULL;
    v_rev_id UUID;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_eng FROM public.engagements WHERE id = p_engagement_id;
    IF v_eng.id IS NULL THEN
        RAISE EXCEPTION 'Engagement not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Determine reviewer role & counterpart
    IF v_eng.client_id = v_caller_id THEN
        v_role := 'client';
        v_reviewee_id := v_eng.designer_id;
    ELSIF v_eng.designer_id = v_caller_id THEN
        v_role := 'designer';
        v_reviewee_id := v_eng.client_id;
    ELSE
        RAISE EXCEPTION 'Only the client or designer of this engagement can submit a review.' USING ERRCODE = '42501';
    END IF;

    -- Completed engagements only (not cancelled)
    IF v_eng.status <> 'completed'::public.engagement_status OR v_eng.cancelled_at IS NOT NULL THEN
        RAISE EXCEPTION 'Reviews exist only for completed engagements.' USING ERRCODE = 'P0001';
    END IF;

    -- Validate payment approval eligibility:
    -- All milestones approved (if milestone-based) or all invoices approved (if hourly),
    -- with at least one approved payment milestone/week.
    IF EXISTS (SELECT 1 FROM public.engagement_milestones WHERE engagement_id = v_eng.id) THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'approved' OR payout_status = 'released')
        INTO v_total_ms, v_approved_ms
        FROM public.engagement_milestones
        WHERE engagement_id = v_eng.id;

        IF v_approved_ms = 0 THEN
            RAISE EXCEPTION 'At least one payment-approved milestone must exist to review.' USING ERRCODE = 'P0001';
        END IF;

        IF v_approved_ms < v_total_ms THEN
            RAISE EXCEPTION 'All milestones must be approved before leaving a review.' USING ERRCODE = 'P0001';
        END IF;
    ELSIF EXISTS (SELECT 1 FROM public.invoices WHERE engagement_id = v_eng.id) THEN
        SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('approved', 'paid'))
        INTO v_total_inv, v_approved_inv
        FROM public.invoices
        WHERE engagement_id = v_eng.id;

        IF v_approved_inv = 0 THEN
            RAISE EXCEPTION 'At least one payment-approved week must exist to review.' USING ERRCODE = 'P0001';
        END IF;

        IF v_approved_inv < v_total_inv THEN
            RAISE EXCEPTION 'All weekly invoices must be approved before leaving a review.' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Check review window (default 14 days)
    SELECT COALESCE((value#>>'{}')::INT, 14) INTO v_window_days
    FROM public.app_settings WHERE key = 'review_window_days';
    IF v_window_days IS NULL THEN v_window_days := 14; END IF;

    v_completed_at := COALESCE(v_eng.completed_at, v_eng.updated_at);
    IF v_now > (v_completed_at + (v_window_days || ' days')::INTERVAL) THEN
        RAISE EXCEPTION 'The %-day review window for this engagement has closed.', v_window_days USING ERRCODE = 'P0001';
    END IF;

    -- One review per party per engagement
    IF EXISTS (
        SELECT 1 FROM public.reviews
        WHERE engagement_id = p_engagement_id AND reviewer_role = v_role
    ) THEN
        RAISE EXCEPTION 'You have already submitted a review for this engagement.' USING ERRCODE = 'P0001';
    END IF;

    -- Rating & comment validations
    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5.' USING ERRCODE = 'P0001';
    END IF;

    IF char_length(trim(p_comment)) < 10 OR char_length(p_comment) > 1500 THEN
        RAISE EXCEPTION 'Comment must be between 10 and 1500 characters.' USING ERRCODE = 'P0001';
    END IF;

    -- Detect phone, email, and links (flag only - does not reject)
    v_flags := public.check_review_content_flags(p_comment);

    -- Check counterpart review and open dispute status
    SELECT * INTO v_other_rev
    FROM public.reviews
    WHERE engagement_id = p_engagement_id AND reviewer_role <> v_role;

    SELECT EXISTS (
        SELECT 1 FROM public.disputes
        WHERE engagement_id = p_engagement_id AND status = 'open'
    ) INTO v_has_open_dispute;

    -- Double-blind rule: If counterpart review exists AND no open dispute, reveal immediately!
    IF v_other_rev.id IS NOT NULL AND NOT v_has_open_dispute THEN
        v_initial_status := 'visible';
        v_revealed_at := v_now;
    ELSE
        v_initial_status := 'pending';
        v_revealed_at := NULL;
    END IF;

    -- Insert review
    INSERT INTO public.reviews (
        engagement_id,
        reviewer_role,
        reviewer_id,
        reviewee_id,
        client_id,
        designer_id,
        rating,
        ratings,
        would_work_again,
        would_hire_again,
        comment,
        status,
        flagged_content,
        flag_reasons,
        revealed_at,
        created_at,
        updated_at,
        editable_until
    ) VALUES (
        p_engagement_id,
        v_role,
        v_caller_id,
        v_reviewee_id,
        v_eng.client_id,
        v_eng.designer_id,
        p_rating,
        p_ratings,
        p_would_work_again,
        p_would_work_again,
        trim(p_comment),
        v_initial_status,
        v_flags.flagged,
        v_flags.reasons,
        v_revealed_at,
        v_now,
        v_now,
        v_completed_at + (v_window_days || ' days')::INTERVAL
    ) RETURNING id INTO v_rev_id;

    -- If both reviews are now submitted and no dispute, reveal counterpart as well
    IF v_initial_status = 'visible' AND v_other_rev.id IS NOT NULL THEN
        UPDATE public.reviews
        SET status = 'visible',
            revealed_at = v_now,
            updated_at = v_now
        WHERE id = v_other_rev.id;

        -- Send review_revealed notifications to both parties
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES
            (v_caller_id, 'review_revealed', 'Reviews Revealed', 'Both reviews for your completed engagement have been published.', jsonb_build_object('engagement_id', p_engagement_id, 'review_id', v_rev_id)),
            (v_reviewee_id, 'review_revealed', 'Reviews Revealed', 'Both reviews for your completed engagement have been published.', jsonb_build_object('engagement_id', p_engagement_id, 'review_id', v_other_rev.id));
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'review_id', v_rev_id,
        'status', v_initial_status,
        'revealed', (v_initial_status = 'visible'),
        'flagged', v_flags.flagged,
        'flag_reasons', v_flags.reasons
    );
END;
$$ LANGUAGE plpgsql;

-- Backward compatible alias: create_review
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
    v_ratings JSONB;
BEGIN
    v_ratings := jsonb_strip_nulls(jsonb_build_object(
        'communication', p_communication_rating,
        'quality_of_work', p_quality_rating,
        'timeliness', p_timeliness_rating
    ));

    RETURN public.submit_review(
        p_engagement_id,
        p_rating,
        v_ratings,
        p_would_hire_again,
        p_comment
    );
END;
$$ LANGUAGE plpgsql;

-- 5.2 update_review (Editable only before reveal by the author)
CREATE OR REPLACE FUNCTION public.update_review(
    p_review_id UUID,
    p_rating INT,
    p_ratings JSONB DEFAULT NULL,
    p_would_work_again BOOLEAN DEFAULT TRUE,
    p_comment TEXT DEFAULT ''
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_rev RECORD;
    v_flags RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rev FROM public.reviews WHERE id = p_review_id;
    IF v_rev.id IS NULL THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_rev.reviewer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the review author can edit this review.' USING ERRCODE = '42501';
    END IF;

    -- Once revealed, reviews cannot be edited
    IF v_rev.revealed_at IS NOT NULL OR v_rev.status <> 'pending' THEN
        RAISE EXCEPTION 'Once revealed, reviews cannot be edited.' USING ERRCODE = 'P0001';
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5.' USING ERRCODE = 'P0001';
    END IF;

    IF char_length(trim(p_comment)) < 10 OR char_length(p_comment) > 1500 THEN
        RAISE EXCEPTION 'Comment must be between 10 and 1500 characters.' USING ERRCODE = 'P0001';
    END IF;

    v_flags := public.check_review_content_flags(p_comment);

    UPDATE public.reviews
    SET rating = p_rating,
        ratings = p_ratings,
        would_work_again = p_would_work_again,
        would_hire_again = p_would_work_again,
        comment = trim(p_comment),
        flagged_content = v_flags.flagged,
        flag_reasons = v_flags.reasons,
        edited_at = v_now,
        updated_at = v_now
    WHERE id = p_review_id;

    RETURN jsonb_build_object(
        'success', true,
        'review_id', p_review_id,
        'edited_at', v_now,
        'flagged', v_flags.flagged,
        'flag_reasons', v_flags.reasons
    );
END;
$$ LANGUAGE plpgsql;

-- 5.3 reply_to_review (Reviewed party posts one reply after reveal, editable for 10 minutes)
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
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rev FROM public.reviews WHERE id = p_review_id;
    IF v_rev.id IS NULL THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_rev.reviewee_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the reviewed party can reply to this review.' USING ERRCODE = '42501';
    END IF;

    IF v_rev.revealed_at IS NULL OR v_rev.status <> 'visible' THEN
        RAISE EXCEPTION 'You cannot reply to an unrevealed review.' USING ERRCODE = 'P0001';
    END IF;

    IF v_rev.replied_at IS NOT NULL AND (v_rev.reply_editable_until IS NOT NULL AND v_now > v_rev.reply_editable_until) THEN
        RAISE EXCEPTION 'The 10-minute editing window for your reply has expired.' USING ERRCODE = 'P0001';
    END IF;

    IF char_length(trim(p_reply)) = 0 OR char_length(p_reply) > 800 THEN
        RAISE EXCEPTION 'Reply must be between 1 and 800 characters.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.reviews
    SET reply = trim(p_reply),
        designer_reply = trim(p_reply),
        replied_at = COALESCE(replied_at, v_now),
        reply_editable_until = COALESCE(reply_editable_until, v_now + INTERVAL '10 minutes'),
        updated_at = v_now
    WHERE id = p_review_id;

    -- Notify reviewer about the reply
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
        v_rev.reviewer_id,
        'review_reply',
        'New Review Reply',
        'A reply has been posted to your review.',
        jsonb_build_object('review_id', p_review_id, 'engagement_id', v_rev.engagement_id)
    );

    RETURN jsonb_build_object('success', true, 'review_id', p_review_id, 'replied_at', v_now);
END;
$$ LANGUAGE plpgsql;

-- 5.4 report_review
CREATE OR REPLACE FUNCTION public.report_review(
    p_review_id UUID,
    p_reason TEXT,
    p_details TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_report_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.reviews WHERE id = p_review_id) THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    IF p_reason NOT IN ('inappropriate_content', 'harassment', 'conflict_of_interest', 'false_information', 'private_contact_info', 'other') THEN
        RAISE EXCEPTION 'Invalid report reason.' USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.reviews_reports (
        review_id,
        reporter_id,
        reason,
        details,
        status
    ) VALUES (
        p_review_id,
        v_caller_id,
        p_reason,
        trim(p_details),
        'pending'
    ) RETURNING id INTO v_report_id;

    RETURN jsonb_build_object('success', true, 'report_id', v_report_id);
END;
$$ LANGUAGE plpgsql;

-- 5.5 hide_review (Admin only, audit logged)
CREATE OR REPLACE FUNCTION public.hide_review(
    p_review_id UUID,
    p_reason TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_rev RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    v_caller_id := (SELECT auth.uid());

    SELECT * INTO v_rev FROM public.reviews WHERE id = p_review_id;
    IF v_rev.id IS NULL THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    UPDATE public.reviews
    SET status = 'hidden',
        hidden_reason = p_reason,
        hidden_by = v_caller_id,
        hidden_at = v_now,
        updated_at = v_now
    WHERE id = p_review_id;

    -- Audit log
    BEGIN
        PERFORM public.log_admin_action('hide_review', 'review', p_review_id::TEXT, jsonb_build_object('reason', p_reason));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- Send notification to reviewer
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
        v_rev.reviewer_id,
        'review_hidden',
        'Review Hidden',
        'Your review has been hidden by moderators: ' || p_reason,
        jsonb_build_object('review_id', p_review_id, 'engagement_id', v_rev.engagement_id, 'reason', p_reason)
    );

    RETURN jsonb_build_object('success', true, 'review_id', p_review_id, 'status', 'hidden');
END;
$$ LANGUAGE plpgsql;

-- 5.6 restore_review (Admin only, audit logged)
CREATE OR REPLACE FUNCTION public.restore_review(
    p_review_id UUID
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rev RECORD;
    v_new_status TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Admin privileges required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_rev FROM public.reviews WHERE id = p_review_id;
    IF v_rev.id IS NULL THEN
        RAISE EXCEPTION 'Review not found.' USING ERRCODE = 'P0002';
    END IF;

    v_new_status := CASE WHEN v_rev.revealed_at IS NOT NULL THEN 'visible' ELSE 'pending' END;

    UPDATE public.reviews
    SET status = v_new_status,
        hidden_reason = NULL,
        hidden_by = NULL,
        hidden_at = NULL,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_review_id;

    -- Audit log
    BEGIN
        PERFORM public.log_admin_action('restore_review', 'review', p_review_id::TEXT, jsonb_build_object('restored_to', v_new_status));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object('success', true, 'review_id', p_review_id, 'status', v_new_status);
END;
$$ LANGUAGE plpgsql;

-- 5.7 reveal_pending_reviews (pg_cron job: reveals pairs when both exist OR window ends, honoring disputes)
CREATE OR REPLACE FUNCTION public.reveal_pending_reviews()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_days INT;
    v_revealed_count INT := 0;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_rec RECORD;
    v_rev RECORD;
BEGIN
    SELECT COALESCE((value#>>'{}')::INT, 14) INTO v_window_days
    FROM public.app_settings WHERE key = 'review_window_days';
    IF v_window_days IS NULL THEN v_window_days := 14; END IF;

    FOR v_rec IN
        SELECT DISTINCT e.id AS engagement_id, e.client_id, e.designer_id
        FROM public.engagements e
        JOIN public.reviews r ON r.engagement_id = e.id AND r.status = 'pending'
        WHERE e.status = 'completed'::public.engagement_status
          AND NOT EXISTS (
              SELECT 1 FROM public.disputes d
              WHERE d.engagement_id = e.id AND d.status = 'open'
          )
          AND (
              -- Both submitted
              (
                  (SELECT COUNT(DISTINCT reviewer_role) FROM public.reviews r2
                   WHERE r2.engagement_id = e.id AND r2.status = 'pending') >= 2
              )
              OR
              -- Review window expired
              (
                  v_now >= (COALESCE(e.completed_at, e.updated_at) + (v_window_days || ' days')::INTERVAL)
              )
          )
    LOOP
        -- Reveal reviews for this engagement
        FOR v_rev IN
            UPDATE public.reviews
            SET status = 'visible',
                revealed_at = v_now,
                updated_at = v_now
            WHERE engagement_id = v_rec.engagement_id
              AND status = 'pending'
            RETURNING id, reviewer_id, reviewee_id
        LOOP
            v_revealed_count := v_revealed_count + 1;

            -- Send review_revealed notification
            INSERT INTO public.notifications (user_id, type, title, body, data)
            VALUES (
                v_rev.reviewee_id,
                'review_revealed',
                'Reviews Published',
                'Reviews for your completed engagement have been published.',
                jsonb_build_object('engagement_id', v_rec.engagement_id, 'review_id', v_rev.id)
            );
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'revealed_count', v_revealed_count);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. ENGAGEMENT COMPLETION TRIGGER -> REVIEW REQUEST NOTIFICATIONS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_engagement_completion_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'completed'::public.engagement_status AND (OLD.status IS NULL OR OLD.status <> 'completed'::public.engagement_status) THEN
        -- Send review_requested notification to client
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
            NEW.client_id,
            'review_requested',
            'Review Your Completed Project',
            'Your project has completed. Please leave a review for your designer within 14 days.',
            jsonb_build_object('engagement_id', NEW.id, 'role', 'client')
        );

        -- Send review_requested notification to designer
        INSERT INTO public.notifications (user_id, type, title, body, data)
        VALUES (
            NEW.designer_id,
            'review_requested',
            'Review Your Client',
            'Your project has completed. Please leave a review for your client within 14 days.',
            jsonb_build_object('engagement_id', NEW.id, 'role', 'designer')
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_engagement_completed_reviews ON public.engagements;
CREATE TRIGGER trg_engagement_completed_reviews
    AFTER UPDATE OF status ON public.engagements
    FOR EACH ROW
    WHEN (NEW.status = 'completed'::public.engagement_status)
    EXECUTE FUNCTION public.handle_engagement_completion_reviews();

-- ------------------------------------------------------------------------------
-- 7. UPDATED VIEWS WITH RATING AGGREGATION & MIN_REVIEWS_FOR_AVERAGE (3)
-- ------------------------------------------------------------------------------

-- 7.1 public_designer_profiles view
DROP VIEW IF EXISTS public.public_designer_profiles CASCADE;

CREATE OR REPLACE VIEW public.public_designer_profiles AS
SELECT
    dp.user_id,
    dp.professional_type,
    dp.title,
    dp.studio_name,
    dp.bio,
    dp.specializations,
    dp.languages,
    dp.years_experience,
    dp.city,
    dp.state,
    p.full_name,
    p.avatar_path,
    p.location,
    p.created_at AS member_since,
    dp.hourly_rate,
    dp.show_hourly_rate,
    dp.show_in_search,
    dp.is_available,
    dp.accepts_invitations,
    dp.studio_slug,
    public.get_effective_plan(dp.user_id) AS plan_key,
    COALESCE(
        (SELECT COUNT(*) > 0
         FROM public.credentials c
         WHERE c.designer_id = dp.user_id
           AND c.status = 'verified'
           AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)),
        FALSE
    ) AS is_verified,
    COALESCE(
        (SELECT COUNT(*) > 0
         FROM public.credentials c
         WHERE c.designer_id = dp.user_id
           AND c.status = 'verified'
           AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)),
        FALSE
    ) AS verified,
    (public.get_effective_plan(dp.user_id) = 'gold') AS is_promoted,
    -- Rating Average: ONLY computed when visible revealed review count >= min_reviews_for_average (3)
    (
        SELECT CASE
            WHEN COUNT(*) >= COALESCE((SELECT (value#>>'{}')::INT FROM public.app_settings WHERE key = 'min_reviews_for_average'), 3)
            THEN ROUND(AVG(rating)::numeric, 1)
            ELSE NULL
        END
        FROM public.reviews r
        WHERE (r.reviewee_id = dp.user_id OR (r.reviewee_id IS NULL AND r.designer_id = dp.user_id))
          AND (r.reviewer_role = 'client' OR r.reviewer_role IS NULL)
          AND r.status = 'visible'
          AND r.revealed_at IS NOT NULL
    ) AS rating_average,
    -- Rating Count: Count always shows
    COALESCE(
        (SELECT COUNT(*)::INT
         FROM public.reviews r
         WHERE (r.reviewee_id = dp.user_id OR (r.reviewee_id IS NULL AND r.designer_id = dp.user_id))
           AND (r.reviewer_role = 'client' OR r.reviewer_role IS NULL)
           AND r.status = 'visible'
           AND r.revealed_at IS NOT NULL),
        0
    ) AS rating_count,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE COALESCE(would_work_again, would_hire_again) = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100, 0)
         FROM public.reviews r
         WHERE (r.reviewee_id = dp.user_id OR (r.reviewee_id IS NULL AND r.designer_id = dp.user_id))
           AND (r.reviewer_role = 'client' OR r.reviewer_role IS NULL)
           AND r.status = 'visible'
           AND r.revealed_at IS NOT NULL),
        100
    ) AS would_hire_again_percent,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE COALESCE(would_work_again, would_hire_again) = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100, 0)
         FROM public.reviews r
         WHERE (r.reviewee_id = dp.user_id OR (r.reviewee_id IS NULL AND r.designer_id = dp.user_id))
           AND (r.reviewer_role = 'client' OR r.reviewer_role IS NULL)
           AND r.status = 'visible'
           AND r.revealed_at IS NOT NULL),
        100
    ) AS would_work_again_percent
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
WHERE dp.show_in_search = TRUE;

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- 7.2 client_summaries view with rating aggregation
DROP VIEW IF EXISTS public.client_summaries CASCADE;

CREATE OR REPLACE VIEW public.client_summaries
WITH (security_barrier = TRUE) AS
SELECT
    cp.user_id,
    CASE
        WHEN POSITION(' ' IN trim(p.full_name)) > 0 THEN
            SPLIT_PART(trim(p.full_name), ' ', 1) || ' ' ||
            SUBSTRING(SPLIT_PART(trim(p.full_name), ' ', 2), 1, 1) || '.'
        ELSE
            trim(p.full_name)
    END AS display_name,
    cp.account_type,
    cp.company_name,
    p.location AS city,
    p.location AS state_region,
    TO_CHAR(p.created_at, 'Month YYYY') AS member_since,
    (
        SELECT COUNT(*)::INT
        FROM public.projects prj
        WHERE prj.client_id = cp.user_id
          AND prj.status <> 'cancelled'::public.project_status
    ) AS projects_posted,
    cp.payment_verified,
    -- Rating Average for Client: only when count >= min_reviews_for_average (3)
    (
        SELECT CASE
            WHEN COUNT(*) >= COALESCE((SELECT (value#>>'{}')::INT FROM public.app_settings WHERE key = 'min_reviews_for_average'), 3)
            THEN ROUND(AVG(rating)::numeric, 1)
            ELSE NULL
        END
        FROM public.reviews r
        WHERE r.reviewee_id = cp.user_id
          AND r.reviewer_role = 'designer'
          AND r.status = 'visible'
          AND r.revealed_at IS NOT NULL
    ) AS rating_average,
    -- Rating Count for Client
    COALESCE(
        (SELECT COUNT(*)::INT
         FROM public.reviews r
         WHERE r.reviewee_id = cp.user_id
           AND r.reviewer_role = 'designer'
           AND r.status = 'visible'
           AND r.revealed_at IS NOT NULL),
        0
    ) AS rating_count,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE COALESCE(would_work_again, would_hire_again) = TRUE)::numeric / NULLIF(COUNT(*), 0)) * 100, 0)
         FROM public.reviews r
         WHERE r.reviewee_id = cp.user_id
           AND r.reviewer_role = 'designer'
           AND r.status = 'visible'
           AND r.revealed_at IS NOT NULL),
        100
    ) AS would_work_again_percent
FROM public.client_profiles cp
JOIN public.profiles p ON p.id = cp.user_id
WHERE
    (SELECT auth.role()) = 'authenticated'
    AND (
        EXISTS (
            SELECT 1 FROM public.projects op
            WHERE op.client_id = cp.user_id
              AND op.status = 'open'::public.project_status
        )
        OR EXISTS (
            SELECT 1
            FROM public.proposals prop
            JOIN public.projects p2 ON p2.id = prop.project_id
            WHERE p2.client_id = cp.user_id
              AND prop.designer_id = (SELECT auth.uid())
        )
        OR cp.user_id = (SELECT auth.uid())
        OR public.is_admin()
    );

GRANT SELECT ON public.client_summaries TO authenticated;
REVOKE SELECT ON public.client_summaries FROM anon;

-- ------------------------------------------------------------------------------
-- 8. SCHEDULE HOURLY CRON JOB FOR REVEALING PENDING REVIEWS
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
        BEGIN
            PERFORM cron.unschedule('reveal-pending-reviews-hourly');
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            PERFORM cron.schedule(
                'reveal-pending-reviews-hourly',
                '0 * * * *',
                'SELECT public.reveal_pending_reviews()'
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;
END $$;
