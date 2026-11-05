-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT INVITATIONS & DESIGNER SUGGESTIONS
-- 041_project_invitations_and_suggestions.sql
-- Project Invitations, Matching & Suggestions Algorithm, Search for Clients
-- ==============================================================================

-- 1. Project Invitations Table
CREATE TABLE IF NOT EXISTS public.project_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.profiles(id),
    designer_id UUID NOT NULL REFERENCES public.profiles(id),
    message TEXT CHECK (message IS NULL OR char_length(message) <= 500),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'viewed', 'declined', 'proposal_sent', 'expired', 'withdrawn')),
    decline_reason_code TEXT CHECK (decline_reason_code IS NULL OR decline_reason_code IN ('not_available', 'not_a_good_fit', 'budget_too_low', 'other')),
    decline_note TEXT CHECK (decline_note IS NULL OR char_length(decline_note) <= 300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    viewed_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
    UNIQUE (project_id, designer_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_project ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS idx_invitations_designer ON public.project_invitations(designer_id);
CREATE INDEX IF NOT EXISTS idx_invitations_client ON public.project_invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON public.project_invitations(expires_at) WHERE status IN ('sent', 'viewed');

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view invitations for own projects" ON public.project_invitations
    FOR SELECT TO authenticated
    USING (client_id = auth.uid());

CREATE POLICY "Designers can view invitations sent to them" ON public.project_invitations
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

CREATE POLICY "Admins have full access to invitations" ON public.project_invitations
    FOR ALL TO authenticated
    USING (public.is_admin());

-- 2. Suggestion Events Table (For analytics and CTR, auto-purge after 90 days)
CREATE TABLE IF NOT EXISTS public.suggestion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('shown', 'opened_profile', 'invited', 'saved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestion_events_project ON public.suggestion_events(project_id);
CREATE INDEX IF NOT EXISTS idx_suggestion_events_designer ON public.suggestion_events(designer_id);

ALTER TABLE public.suggestion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can log suggestion events for own projects" ON public.suggestion_events
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.client_id = auth.uid())
        OR public.is_admin()
    );

CREATE POLICY "Admins can view suggestion events" ON public.suggestion_events
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 3. App Settings for Invitations & Matching
INSERT INTO public.app_settings (key, value) VALUES
('invitations_per_project_max', '10'::jsonb),
('invitations_per_client_per_day', '20'::jsonb),
('invitation_expiry_days', '14'::jsonb),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 25, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'::jsonb),
('matching_new_designer_boost', '5'::jsonb),
('matching_max_active_engagements', '8'::jsonb),
('matching_require_state_license', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 4. Notification Types Insert
INSERT INTO public.notification_types (type, title_template, body_template, email_template) VALUES
('invitation_received', 'Project Invitation', 'You received an invitation to submit a proposal for {{project_title}}.', 'invitation_received'),
('invitation_declined', 'Invitation Declined', 'A designer declined your project invitation.', 'invitation_declined'),
('invitation_expired', 'Invitation Expired', 'An invitation for {{project_title}} has expired.', 'invitation_expired')
ON CONFLICT (type) DO NOTHING;

-- 5. Invite Designer Function
CREATE OR REPLACE FUNCTION public.invite_designer(
    p_project_id UUID,
    p_designer_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_client_id UUID := auth.uid();
    v_project RECORD;
    v_designer RECORD;
    v_max_per_project INT;
    v_max_per_client_day INT;
    v_expiry_days INT;
    v_proj_inv_count INT;
    v_daily_inv_count INT;
    v_new_inv_id UUID;
BEGIN
    -- 1. Verify project ownership and state
    SELECT id, client_id, status, title, proposal_deadline INTO v_project
    FROM public.projects
    WHERE id = p_project_id;

    IF v_project IS NULL OR (v_project.client_id != v_client_id AND NOT public.is_admin()) THEN
        RAISE EXCEPTION 'project_not_found' USING ERRCODE = '42501';
    END IF;

    IF v_project.status NOT IN ('open', 'published') THEN
        RAISE EXCEPTION 'project_not_open' USING ERRCODE = '22023';
    END IF;

    IF v_project.proposal_deadline IS NOT NULL AND v_project.proposal_deadline < CURRENT_DATE THEN
        RAISE EXCEPTION 'project_not_open' USING ERRCODE = '22023';
    END IF;

    -- 2. Verify designer eligibility
    SELECT dp.user_id, dp.is_available, dp.show_in_search, dp.accepts_invitations,
           p.role, p.plan_key, pl.directory_listing, pl.direct_invitations
    INTO v_designer
    FROM public.designer_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE dp.user_id = p_designer_id;

    IF v_designer IS NULL OR v_designer.role != 'designer' THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
    END IF;

    -- Plan check: must have directory_listing and direct_invitations
    IF NOT (v_designer.directory_listing = true AND v_designer.direct_invitations = true) THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
    END IF;

    -- Availability and settings check
    IF NOT (v_designer.show_in_search = true AND v_designer.is_available = true) THEN
        RAISE EXCEPTION 'designer_unavailable' USING ERRCODE = '22023';
    END IF;

    IF v_designer.accepts_invitations = false THEN
        RAISE EXCEPTION 'invitations_off' USING ERRCODE = '22023';
    END IF;

    -- 3. Check for existing proposal or active invitation
    IF EXISTS (
        SELECT 1 FROM public.proposals 
        WHERE project_id = p_project_id AND designer_id = p_designer_id AND status != 'withdrawn'
    ) THEN
        RAISE EXCEPTION 'already_proposed' USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.project_invitations 
        WHERE project_id = p_project_id AND designer_id = p_designer_id 
          AND status IN ('sent', 'viewed')
    ) THEN
        RAISE EXCEPTION 'already_invited' USING ERRCODE = '23505';
    END IF;

    -- 4. Check limits
    SELECT COALESCE((value #>> '{}')::int, 10) INTO v_max_per_project 
    FROM public.app_settings WHERE key = 'invitations_per_project_max';
    
    SELECT COALESCE((value #>> '{}')::int, 20) INTO v_max_per_client_day 
    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';

    SELECT COALESCE((value #>> '{}')::int, 14) INTO v_expiry_days 
    FROM public.app_settings WHERE key = 'invitation_expiry_days';

    SELECT COUNT(*) INTO v_proj_inv_count
    FROM public.project_invitations
    WHERE project_id = p_project_id AND status NOT IN ('expired', 'withdrawn', 'declined');

    IF v_proj_inv_count >= v_max_per_project THEN
        RAISE EXCEPTION 'limit_reached' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_daily_inv_count
    FROM public.project_invitations
    WHERE client_id = v_client_id AND created_at >= CURRENT_DATE;

    IF v_daily_inv_count >= v_max_per_client_day THEN
        RAISE EXCEPTION 'limit_reached' USING ERRCODE = '22023';
    END IF;

    -- 5. Insert invitation
    INSERT INTO public.project_invitations (
        project_id, client_id, designer_id, message, expires_at
    ) VALUES (
        p_project_id, v_client_id, p_designer_id, TRIM(p_message),
        NOW() + (v_expiry_days || ' days')::INTERVAL
    )
    RETURNING id INTO v_new_inv_id;

    -- 6. Send notification to designer
    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',
        jsonb_build_object(
            'invitation_id', v_new_inv_id,
            'project_id', p_project_id,
            'project_title', v_project.title
        ),
        '/projects/' || p_project_id
    );

    -- 7. Log suggestion event & analytics
    INSERT INTO public.suggestion_events (project_id, designer_id, event_type)
    VALUES (p_project_id, p_designer_id, 'invited');

    PERFORM public.record_analytics_event(p_designer_id, 'invitation_received');

    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', v_new_inv_id
    );
END;
$$;

-- 6. Withdraw Invitation Function (Client)
CREATE OR REPLACE FUNCTION public.withdraw_invitation(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.project_invitations
    SET status = 'withdrawn', responded_at = NOW()
    WHERE id = p_invitation_id
      AND client_id = auth.uid()
      AND status IN ('sent', 'viewed');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation_not_found_or_cannot_withdraw' USING ERRCODE = '22023';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. Mark Invitation Viewed Function (Designer)
CREATE OR REPLACE FUNCTION public.mark_invitation_viewed(p_invitation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.project_invitations
    SET status = 'viewed', viewed_at = NOW()
    WHERE id = p_invitation_id
      AND designer_id = auth.uid()
      AND status = 'sent';

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Decline Invitation Function (Designer)
CREATE OR REPLACE FUNCTION public.decline_invitation(
    p_invitation_id UUID,
    p_reason_code TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_inv RECORD;
BEGIN
    SELECT pi.id, pi.client_id, pi.project_id, pi.designer_id, p.title AS project_title
    INTO v_inv
    FROM public.project_invitations pi
    JOIN public.projects p ON p.id = pi.project_id
    WHERE pi.id = p_invitation_id AND pi.designer_id = auth.uid() AND pi.status IN ('sent', 'viewed');

    IF v_inv IS NULL THEN
        RAISE EXCEPTION 'invitation_not_found' USING ERRCODE = '22023';
    END IF;

    UPDATE public.project_invitations
    SET status = 'declined',
        decline_reason_code = p_reason_code,
        decline_note = TRIM(p_note),
        responded_at = NOW()
    WHERE id = p_invitation_id;

    -- Notify client
    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',
        jsonb_build_object(
            'invitation_id', p_invitation_id,
            'project_id', v_inv.project_id,
            'project_title', v_inv.project_title,
            'reason_code', p_reason_code
        ),
        '/client/projects/' || v_inv.project_id
    );

    PERFORM public.record_analytics_event(v_inv.designer_id, 'invitation_declined');

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Auto-link proposal submission to invitation status
CREATE OR REPLACE FUNCTION public.handle_proposal_invitation_link()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.project_invitations
    SET status = 'proposal_sent', responded_at = NOW()
    WHERE project_id = NEW.project_id 
      AND designer_id = NEW.designer_id
      AND status IN ('sent', 'viewed');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_link_proposal_invitation ON public.proposals;
CREATE TRIGGER trg_link_proposal_invitation
    AFTER INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_proposal_invitation_link();

-- 10. Expire Invitations Scheduled Job Function
CREATE OR REPLACE FUNCTION public.expire_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    FOR r IN
        SELECT pi.id, pi.client_id, pi.designer_id, pi.project_id, p.title AS project_title
        FROM public.project_invitations pi
        JOIN public.projects p ON p.id = pi.project_id
        WHERE pi.status IN ('sent', 'viewed')
          AND (
              pi.expires_at < NOW() 
              OR p.status IN ('closed', 'cancelled', 'completed')
              OR (p.proposal_deadline IS NOT NULL AND p.proposal_deadline < CURRENT_DATE)
          )
    LOOP
        UPDATE public.project_invitations
        SET status = 'expired', responded_at = NOW()
        WHERE id = r.id;

        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',
            jsonb_build_object(
                'invitation_id', r.id,
                'project_id', r.project_id,
                'project_title', r.project_title
            ),
            '/client/projects/' || r.project_id
        );

        v_count := v_count + 1;
    END LOOP;

    -- Audit log entry
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'job_expire_invitations',
        'system',
        '00000000-0000-0000-0000-000000000000'::uuid,
        jsonb_build_object('expired_count', v_count)
    );

    RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$$;

-- Alias for scheduled background job
CREATE OR REPLACE FUNCTION public.expire_project_invitations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.expire_invitations();
END;
$$;

-- 11. Suggest Designers Function
CREATE OR REPLACE FUNCTION public.suggest_designers(
    p_project_id UUID,
    p_limit INT DEFAULT 6,
    p_exclude_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project RECORD;
    v_weights JSONB;
    v_max_active INT;
    v_require_state_license BOOLEAN;
    v_new_boost INT;
    v_results JSONB := '[]'::jsonb;
    v_cand RECORD;
BEGIN
    -- Project lookup and ownership verify
    SELECT p.*, c.name AS category_name
    INTO v_project
    FROM public.projects p
    LEFT JOIN public.categories c ON c.id::text = p.category OR c.name = p.category
    WHERE p.id = p_project_id;

    IF v_project IS NULL THEN
        RAISE EXCEPTION 'project_not_found';
    END IF;

    IF v_project.client_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    -- Settings
    SELECT COALESCE(value::jsonb, '{"specialization_match":30,"subcategory_portfolio":10,"state_license":25,"same_city":15,"same_state":10,"verified":10,"rating":10,"completed_projects":5}'::jsonb)
    INTO v_weights FROM public.app_settings WHERE key = 'matching_weights';

    SELECT COALESCE((value #>> '{}')::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';
    SELECT COALESCE((value #>> '{}')::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';
    SELECT COALESCE((value #>> '{}')::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';

    FOR v_cand IN
        WITH candidate_pool AS (
            SELECT
                dp.user_id,
                p.full_name,
                p.avatar_path,
                dp.professional_type,
                dp.title,
                dp.studio_name,
                dp.city,
                dp.state,
                dp.years_experience,
                dp.hourly_rate,
                dp.show_hourly_rate,
                p.plan_key,
                p.created_at AS member_since,
                COALESCE((
                    SELECT ROUND(AVG(r.rating)::numeric, 1) 
                    FROM public.reviews r 
                    WHERE r.designer_id = dp.user_id AND r.status = 'visible'
                ), 0.0) AS rating_avg,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.reviews r 
                    WHERE r.designer_id = dp.user_id AND r.status = 'visible'
                ), 0) AS rating_cnt,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.contracts c 
                    WHERE c.designer_id = dp.user_id AND c.status = 'completed'
                ), 0) AS completed_cnt,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.contracts c 
                    WHERE c.designer_id = dp.user_id AND c.status IN ('active', 'in_progress', 'signed')
                ), 0) AS active_cnt,
                EXISTS (
                    SELECT 1 FROM public.credentials cr 
                    WHERE cr.designer_id = dp.user_id 
                      AND cr.status = 'verified' 
                      AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                ) AS is_verified,
                EXISTS (
                    SELECT 1 FROM public.credentials cr 
                    WHERE cr.designer_id = dp.user_id 
                      AND cr.issuing_state = v_project.state
                      AND cr.status = 'verified' 
                      AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                ) AS has_state_license,
                (v_project.category_name = ANY(dp.specializations) OR v_project.category = ANY(dp.specializations)) AS matches_category,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.portfolio_projects pp 
                    WHERE pp.designer_id = dp.user_id 
                      AND pp.subcategory = v_project.subcategory
                ), 0) AS subcategory_portfolio_count,
                (SELECT dls.licensed_states FROM public.designer_licensed_states dls WHERE dls.designer_id = dp.user_id) AS licensed_states
            FROM public.designer_profiles dp
            JOIN public.profiles p ON p.id = dp.user_id
            JOIN public.plans pl ON pl.key = p.plan_key
            WHERE p.role = 'designer'
              AND pl.directory_listing = true
              AND pl.direct_invitations = true
              AND dp.show_in_search = true
              AND dp.is_available = true
              AND dp.accepts_invitations = true
              AND dp.bio IS NOT NULL
              AND dp.user_id != v_project.client_id
              AND dp.user_id != ALL(COALESCE(p_exclude_ids, ARRAY[]::UUID[]))
              -- Exclude designers who already proposed
              AND NOT EXISTS (
                  SELECT 1 FROM public.proposals prop 
                  WHERE prop.project_id = p_project_id 
                    AND prop.designer_id = dp.user_id 
                    AND prop.status != 'withdrawn'
              )
              -- Exclude active invitations
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status IN ('sent', 'viewed')
              )
              -- Exclude declined invitations
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status = 'declined'
              )
              -- Filter: discipline matches project disciplines if set
              AND (
                  v_project.disciplines IS NULL 
                  OR array_length(v_project.disciplines, 1) IS NULL
                  OR dp.professional_type = ANY(v_project.disciplines)
              )
        ),
        scored_candidates AS (
            SELECT 
                cp.*,
                (
                    -- Specialization match
                    (CASE WHEN cp.matches_category THEN COALESCE((v_weights->>'specialization_match')::int, 30) ELSE 0 END)
                    -- Portfolio in subcategory (10 each, max 20)
                    + LEAST(cp.subcategory_portfolio_count * COALESCE((v_weights->>'subcategory_portfolio')::int, 10), 20)
                    -- State license
                    + (CASE WHEN cp.has_state_license THEN COALESCE((v_weights->>'state_license')::int, 25) ELSE 0 END)
                    -- Location
                    + (CASE 
                        WHEN cp.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(cp.city) = LOWER(v_project.city) THEN COALESCE((v_weights->>'same_city')::int, 15)
                        WHEN cp.state IS NOT NULL AND v_project.state IS NOT NULL AND cp.state = v_project.state THEN COALESCE((v_weights->>'same_state')::int, 10)
                        ELSE 0 
                      END)
                    -- Verified
                    + (CASE WHEN cp.is_verified THEN COALESCE((v_weights->>'verified')::int, 10) ELSE 0 END)
                    -- Rating (scaled to 10 with 3+ reviews)
                    + (CASE WHEN cp.rating_cnt >= 3 THEN ROUND((cp.rating_avg / 5.0) * COALESCE((v_weights->>'rating')::int, 10)) ELSE 0 END)
                    -- Completed projects (scale to 5)
                    + LEAST(ROUND((cp.completed_cnt::numeric / 10.0) * COALESCE((v_weights->>'completed_projects')::int, 5)), 5)
                    -- New designer boost (<90 days)
                    + (CASE WHEN cp.member_since >= NOW() - INTERVAL '90 days' THEN v_new_boost ELSE 0 END)
                    -- Plan boost: Free 0, Basic 5, Upgraded 15
                    + (CASE cp.plan_key WHEN 'upgraded' THEN 15 WHEN 'basic' THEN 5 ELSE 0 END)
                )::int AS match_score,
                -- Deterministic daily tie-break hash
                md5(p_project_id::text || CURRENT_DATE::text || cp.user_id::text) AS daily_hash
            FROM candidate_pool cp
            WHERE cp.active_cnt < v_max_active
              AND (NOT v_require_state_license OR cp.has_state_license = true)
        )
        SELECT * FROM scored_candidates
        ORDER BY match_score DESC, daily_hash ASC
        LIMIT p_limit
    LOOP
        DECLARE
            v_reasons JSONB := '[]'::jsonb;
        BEGIN
            IF v_cand.matches_category THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'category', 'text', 'Specializes in ' || COALESCE(v_project.category_name, v_project.category));
            END IF;
            IF v_cand.has_state_license THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'licensed', 'text', 'Licensed in ' || COALESCE(v_project.state, 'state'));
            END IF;
            IF v_cand.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(v_cand.city) = LOWER(v_project.city) THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in ' || v_cand.city);
            ELSIF v_cand.state IS NOT NULL AND v_project.state IS NOT NULL AND v_cand.state = v_project.state THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Located in ' || v_cand.state);
            END IF;
            IF v_cand.rating_cnt >= 3 THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'rating', 'text', v_cand.rating_avg || ' rating (' || v_cand.rating_cnt || ' reviews)');
            END IF;

            v_results := v_results || jsonb_build_object(
                'designer_id', v_cand.user_id,
                'full_name', v_cand.full_name,
                'avatar_path', v_cand.avatar_path,
                'discipline', v_cand.professional_type,
                'title', v_cand.title,
                'studio_name', v_cand.studio_name,
                'city', v_cand.city,
                'state', v_cand.state,
                'years_experience', v_cand.years_experience,
                'hourly_rate', CASE WHEN v_cand.show_hourly_rate THEN v_cand.hourly_rate ELSE NULL END,
                'rating_average', v_cand.rating_avg,
                'rating_count', v_cand.rating_cnt,
                'completed_projects_count', v_cand.completed_cnt,
                'is_verified', v_cand.is_verified,
                'plan_key', v_cand.plan_key,
                'match_score', v_cand.match_score,
                'reasons', v_reasons,
                'licensed_states', COALESCE(v_cand.licensed_states, ARRAY[]::TEXT[])
            );

            -- Log suggestion impression & designer analytics
            INSERT INTO public.suggestion_events (project_id, designer_id, event_type)
            VALUES (p_project_id, v_cand.user_id, 'shown');

            PERFORM public.record_analytics_event(v_cand.user_id, 'suggestion_appearance');
        END;
    END LOOP;

    RETURN v_results;
END;
$$;

-- 12. Search Designers for Client Function
CREATE OR REPLACE FUNCTION public.search_designers_for_client(
    p_query TEXT DEFAULT NULL,
    p_discipline TEXT DEFAULT NULL,
    p_specialization TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_licensed_in_state TEXT DEFAULT NULL,
    p_min_years INT DEFAULT NULL,
    p_min_rating NUMERIC DEFAULT NULL,
    p_verified_only BOOLEAN DEFAULT FALSE,
    p_available_only BOOLEAN DEFAULT FALSE,
    p_sort TEXT DEFAULT 'best_match',
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0,
    p_project_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total INT;
    v_rows JSONB := '[]'::jsonb;
    v_label_mode TEXT;
    v_rec RECORD;
BEGIN
    SELECT COALESCE(value #>> '{}', 'label') INTO v_label_mode FROM public.app_settings WHERE key = 'priority_label_mode';

    -- Query from public_designer_profiles (strictly enforces directory_listing = true)
    WITH filtered AS (
        SELECT 
            pdp.*,
            (CASE pdp.plan_key WHEN 'upgraded' THEN 15 WHEN 'basic' THEN 5 ELSE 0 END) AS plan_boost,
            CASE 
                WHEN p_project_id IS NOT NULL THEN (
                    SELECT cr.issuing_state IS NOT NULL
                    FROM public.projects proj
                    LEFT JOIN public.credentials cr ON cr.designer_id = pdp.user_id 
                        AND cr.issuing_state = proj.state 
                        AND cr.status = 'verified' 
                        AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                    WHERE proj.id = p_project_id
                    LIMIT 1
                )
                ELSE false
            END AS licensed_in_project_state
        FROM public.public_designer_profiles pdp
        WHERE (p_query IS NULL OR (
            pdp.full_name ILIKE '%' || p_query || '%' OR
            pdp.studio_name ILIKE '%' || p_query || '%' OR
            pdp.title ILIKE '%' || p_query || '%' OR
            pdp.city ILIKE '%' || p_query || '%'
        ))
        AND (p_discipline IS NULL OR pdp.professional_type::text = p_discipline)
        AND (p_specialization IS NULL OR p_specialization = ANY(pdp.specializations))
        AND (p_state IS NULL OR pdp.state = p_state)
        AND (p_city IS NULL OR pdp.city ILIKE '%' || p_city || '%')
        AND (p_licensed_in_state IS NULL OR p_licensed_in_state = ANY(pdp.licensed_states))
        AND (p_min_years IS NULL OR pdp.years_experience >= p_min_years)
        AND (p_min_rating IS NULL OR pdp.rating_average >= p_min_rating)
        AND (NOT p_verified_only OR pdp.verified = true)
        AND (NOT p_available_only OR pdp.is_available = true)
    )
    SELECT COUNT(*) INTO v_total FROM filtered;

    FOR v_rec IN
        SELECT f.*,
               CASE WHEN f.plan_boost > 0 AND v_label_mode = 'label' THEN true ELSE false END AS is_promoted
        FROM filtered f
        ORDER BY
            CASE WHEN p_sort = 'rating' THEN f.rating_average END DESC NULLS LAST,
            CASE WHEN p_sort = 'experience' THEN f.years_experience END DESC NULLS LAST,
            CASE WHEN p_sort = 'newest' THEN f.member_since END DESC NULLS LAST,
            -- Default best_match: weighted rank + plan boost
            (f.rating_average * 10 + f.years_experience + f.plan_boost) DESC
        LIMIT p_limit OFFSET p_offset
    LOOP
        v_rows := v_rows || jsonb_build_object(
            'designer_id', v_rec.user_id,
            'full_name', v_rec.full_name,
            'avatar_path', v_rec.avatar_path,
            'discipline', v_rec.professional_type,
            'title', v_rec.title,
            'studio_name', v_rec.studio_name,
            'bio', v_rec.bio,
            'specializations', v_rec.specializations,
            'city', v_rec.city,
            'state', v_rec.state,
            'years_experience', v_rec.years_experience,
            'hourly_rate', CASE WHEN v_rec.show_hourly_rate THEN v_rec.hourly_rate ELSE NULL END,
            'rating_average', v_rec.rating_average,
            'rating_count', v_rec.rating_count,
            'is_verified', v_rec.verified,
            'is_available', v_rec.is_available,
            'accepts_invitations', v_rec.accepts_invitations,
            'licensed_states', v_rec.licensed_states,
            'is_promoted', v_rec.is_promoted,
            'plan_key', v_rec.plan_key
        );

        -- Record search appearance in analytics
        PERFORM public.record_analytics_event(v_rec.user_id, 'search_appearance');
    END LOOP;

    RETURN jsonb_build_object(
        'total', v_total,
        'page', (p_offset / p_limit) + 1,
        'limit', p_limit,
        'results', v_rows
    );
END;
$$;

-- 13. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_designer_specializations_gin ON public.designer_profiles USING GIN(specializations);
CREATE INDEX IF NOT EXISTS idx_designer_state ON public.designer_profiles(state);
CREATE INDEX IF NOT EXISTS idx_designer_city ON public.designer_profiles(city);
CREATE INDEX IF NOT EXISTS idx_designer_available_search ON public.designer_profiles(user_id) WHERE show_in_search = true AND is_available = true;

