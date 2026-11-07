-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - OPTIONAL CREDENTIALS & TRUST SIGNALS
-- 043_credentials_optional_trust_signals.sql
-- Converts state licensure from requirement/gate to optional trust signals
-- ==============================================================================

-- 1. Update public.credentials schema
-- Add credential_type, title, issuing_body
ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS credential_type TEXT DEFAULT 'license',
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS issuing_body TEXT;

-- Backfill existing credentials before dropping/relaxing constraints
UPDATE public.credentials
SET 
    credential_type = 'license',
    title = COALESCE(title, INITCAP(REPLACE(COALESCE(license_type, 'architect'), '_', ' '))),
    issuing_body = COALESCE(issuing_body, CASE WHEN issuing_state IS NOT NULL THEN issuing_state || ' Licensing Board' ELSE 'State Licensing Board' END)
WHERE title IS NULL OR credential_type IS NULL;

-- Relax constraints: issuing_state, license_number, issue_year, expiration_date, certificate_file are all optional
ALTER TABLE public.credentials
    ALTER COLUMN issuing_state DROP NOT NULL,
    ALTER COLUMN license_number DROP NOT NULL;

-- Update credential_type constraint
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_license_type_check') THEN
        ALTER TABLE public.credentials DROP CONSTRAINT credentials_license_type_check;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_credential_type_check') THEN
        ALTER TABLE public.credentials
            ADD CONSTRAINT credentials_credential_type_check
            CHECK (credential_type IN ('license', 'certification', 'registration', 'other'));
    END IF;
    -- Relax issuing state check to allow NULL
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_issuing_state_check') THEN
        ALTER TABLE public.credentials DROP CONSTRAINT credentials_issuing_state_check;
        ALTER TABLE public.credentials
            ADD CONSTRAINT credentials_issuing_state_check
            CHECK (issuing_state IS NULL OR issuing_state ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$');
    END IF;
END $$;

-- Make license_type nullable or drop it (kept nullable for backwards-compatible reads if needed)
ALTER TABLE public.credentials ALTER COLUMN license_type DROP NOT NULL;

-- 2. Trigger: protect review fields and reset status to pending when modified
CREATE OR REPLACE FUNCTION public.handle_credential_ownership_and_reset()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Check if non-admin is updating
    IF NOT public.is_admin() THEN
        -- Owner cannot set or change status manually
        IF (TG_OP = 'INSERT' AND NEW.status != 'pending') OR 
           (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND OLD.status != 'verified') THEN
            RAISE EXCEPTION 'owners_cannot_set_status'
                USING ERRCODE = '42501';
        END IF;

        -- Non-admin cannot set admin review audit fields
        IF (TG_OP = 'UPDATE') AND (
            NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
            NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
            NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
        ) THEN
            RAISE EXCEPTION 'owners_cannot_set_review_fields'
                USING ERRCODE = '42501';
        END IF;

        -- If editing an existing verified credential, reset it to pending
        IF TG_OP = 'UPDATE' AND OLD.status = 'verified' AND (
            NEW.credential_type IS DISTINCT FROM OLD.credential_type OR
            NEW.title IS DISTINCT FROM OLD.title OR
            NEW.issuing_body IS DISTINCT FROM OLD.issuing_body OR
            NEW.issuing_state IS DISTINCT FROM OLD.issuing_state OR
            NEW.license_number IS DISTINCT FROM OLD.license_number OR
            NEW.issue_year IS DISTINCT FROM OLD.issue_year OR
            NEW.expiration_date IS DISTINCT FROM OLD.expiration_date OR
            NEW.certificate_file IS DISTINCT FROM OLD.certificate_file
        ) THEN
            NEW.status = 'pending';
            NEW.reviewed_by = NULL;
            NEW.reviewed_at = NULL;
            NEW.rejection_reason = NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Update Credential Expiration Scheduled Job
-- Runs ONLY for credentials that have an expiration_date
CREATE OR REPLACE FUNCTION public.check_credential_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Mark expired credentials strictly where expiration_date IS NOT NULL
    FOR r IN 
        SELECT id, designer_id, issuing_state, credential_type, title, expiration_date
        FROM public.credentials
        WHERE status = 'verified' 
          AND expiration_date IS NOT NULL 
          AND expiration_date < CURRENT_DATE
    LOOP
        UPDATE public.credentials
        SET status = 'expired', updated_at = NOW()
        WHERE id = r.id;

        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            jsonb_build_object(
                'credential_id', r.id,
                'credential_type', r.credential_type,
                'title', r.title,
                'state', r.issuing_state,
                'message', 'Your ' || COALESCE(r.title, 'credential') || ' has expired.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;

    -- Notify credentials expiring in 30 days
    FOR r IN 
        SELECT id, designer_id, issuing_state, credential_type, title, expiration_date
        FROM public.credentials
        WHERE status = 'verified' 
          AND expiration_date IS NOT NULL
          AND expiration_date = CURRENT_DATE + INTERVAL '30 days'
    LOOP
        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            jsonb_build_object(
                'credential_id', r.id,
                'credential_type', r.credential_type,
                'title', r.title,
                'state', r.issuing_state,
                'expiration_date', r.expiration_date,
                'message', 'Your ' || COALESCE(r.title, 'credential') || ' expires in 30 days.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;
END;
$$;

-- 4. Proposals: remove license acknowledgement columns
ALTER TABLE public.proposals
    DROP COLUMN IF EXISTS license_acknowledgement,
    DROP COLUMN IF EXISTS license_acknowledgement_text;

-- 5. Drop designer_licensed_states view
DROP VIEW IF EXISTS public.designer_licensed_states CASCADE;

-- 6. Update App Settings:
-- Remove matching_require_state_license and licensed_state_proposal_mode
-- Add insurance_section_enabled (default false)
-- Update matching_weights without state_license
DELETE FROM public.app_settings 
WHERE key IN ('matching_require_state_license', 'licensed_state_proposal_mode');

INSERT INTO public.app_settings (key, value) VALUES
('insurance_section_enabled', 'false'),
('matching_weights', '{"specialization_match": 35, "subcategory_portfolio": 15, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 7. Update public_designer_profiles view
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
    p.plan_key,
    -- Verified trust badge: designer on paid plan with at least one verified unexpired credential
    (p.plan_key IN ('basic', 'upgraded') AND EXISTS (
        SELECT 1 
        FROM public.credentials c 
        WHERE c.designer_id = dp.user_id 
          AND c.status = 'verified' 
          AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)
    )) AS verified,
    COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 1) 
         FROM public.reviews r 
         WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0.0
    ) AS rating_average,
    COALESCE(
        (SELECT COUNT(*)::INT 
         FROM public.reviews r 
         WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        0
    ) AS rating_count,
    COALESCE(
        (SELECT ROUND((COUNT(*) FILTER (WHERE would_hire_again = true)::numeric / COUNT(*)) * 100, 0)
         FROM public.reviews r 
         WHERE r.designer_id = dp.user_id AND r.status = 'visible'),
        100
    ) AS would_hire_again_percent,
    -- Credentials list (without exposing raw unmasked license numbers publicly)
    COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', c.id,
                    'credential_type', c.credential_type,
                    'title', c.title,
                    'issuing_body', c.issuing_body,
                    'issuing_state', c.issuing_state,
                    'status', c.status,
                    'status_label', CASE 
                        WHEN c.status = 'verified' AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE) AND p.plan_key IN ('basic', 'upgraded') THEN 'Verified'
                        WHEN c.status = 'expired' OR (c.expiration_date IS NOT NULL AND c.expiration_date < CURRENT_DATE) THEN 'Expired'
                        ELSE 'Self-reported'
                    END
                ) ORDER BY c.created_at ASC
            )
            FROM public.credentials c
            WHERE c.designer_id = dp.user_id
        ),
        '[]'::jsonb
    ) AS credentials,
    COALESCE(
        (SELECT COUNT(*) > 0 
         FROM public.designer_insurance di 
         WHERE di.designer_id = dp.user_id 
           AND di.status = 'verified' 
           AND di.expiration_date >= CURRENT_DATE),
        false
    ) AS is_insured
FROM public.designer_profiles dp
JOIN public.profiles p ON p.id = dp.user_id
JOIN public.plans pl ON pl.key = p.plan_key
WHERE p.role = 'designer'
  AND pl.directory_listing = true;

GRANT SELECT ON public.public_designer_profiles TO authenticated, anon;

-- 8. Profile Completeness function: No credential required anywhere
CREATE OR REPLACE FUNCTION public.get_profile_completeness(p_designer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_plan_key TEXT := 'free';
    v_has_prof_type BOOLEAN := FALSE;
    v_has_specialization BOOLEAN := FALSE;
    v_has_location BOOLEAN := FALSE;
    v_has_bio BOOLEAN := FALSE;
    v_portfolio_count INTEGER := 0;
    v_score INTEGER := 0;
    v_checklist JSONB;
BEGIN
    SELECT COALESCE(plan_key, 'free') INTO v_plan_key
    FROM public.profiles
    WHERE id = p_designer_id;

    SELECT 
        (professional_type IS NOT NULL AND length(trim(professional_type)) > 0),
        (cardinality(specializations) > 0),
        ((city IS NOT NULL AND length(trim(city)) > 0) OR (state IS NOT NULL AND length(trim(state)) > 0)),
        (bio IS NOT NULL AND length(trim(bio)) >= 20)
    INTO v_has_prof_type, v_has_specialization, v_has_location, v_has_bio
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    SELECT COUNT(*) INTO v_portfolio_count
    FROM public.portfolio_projects
    WHERE designer_id = p_designer_id;

    IF v_plan_key = 'free' THEN
        -- Free designers: professional type, specialization, location, short bio (photo optional)
        v_score := 0;
        IF COALESCE(v_has_prof_type, FALSE) THEN v_score := v_score + 25; END IF;
        IF COALESCE(v_has_specialization, FALSE) THEN v_score := v_score + 25; END IF;
        IF COALESCE(v_has_location, FALSE) THEN v_score := v_score + 25; END IF;
        IF COALESCE(v_has_bio, FALSE) THEN v_score := v_score + 25; END IF;

        v_checklist := jsonb_build_array(
            jsonb_build_object('id', 'professional_type', 'label', 'Professional type', 'tab', 'profile', 'completed', COALESCE(v_has_prof_type, FALSE)),
            jsonb_build_object('id', 'specialization', 'label', 'Specialization', 'tab', 'profile', 'completed', COALESCE(v_has_specialization, FALSE)),
            jsonb_build_object('id', 'location', 'label', 'Location', 'tab', 'profile', 'completed', COALESCE(v_has_location, FALSE)),
            jsonb_build_object('id', 'bio', 'label', 'Short bio', 'tab', 'profile', 'completed', COALESCE(v_has_bio, FALSE))
        );
    ELSE
        -- Paid designers: professional type, specialization, location, bio + portfolio (min 2 projects), NO credentials required
        v_score := 0;
        IF COALESCE(v_has_prof_type, FALSE) THEN v_score := v_score + 20; END IF;
        IF COALESCE(v_has_specialization, FALSE) THEN v_score := v_score + 20; END IF;
        IF COALESCE(v_has_location, FALSE) THEN v_score := v_score + 20; END IF;
        IF COALESCE(v_has_bio, FALSE) THEN v_score := v_score + 20; END IF;
        IF v_portfolio_count >= 2 THEN v_score := v_score + 20; END IF;

        v_checklist := jsonb_build_array(
            jsonb_build_object('id', 'professional_type', 'label', 'Professional type', 'tab', 'profile', 'completed', COALESCE(v_has_prof_type, FALSE)),
            jsonb_build_object('id', 'specialization', 'label', 'Specialization', 'tab', 'profile', 'completed', COALESCE(v_has_specialization, FALSE)),
            jsonb_build_object('id', 'location', 'label', 'Location', 'tab', 'profile', 'completed', COALESCE(v_has_location, FALSE)),
            jsonb_build_object('id', 'bio', 'label', 'Professional bio', 'tab', 'profile', 'completed', COALESCE(v_has_bio, FALSE)),
            jsonb_build_object('id', 'portfolio', 'label', 'Portfolio (min 2 projects)', 'tab', 'portfolio', 'completed', (v_portfolio_count >= 2))
        );
    END IF;

    RETURN jsonb_build_object(
        'score', v_score,
        'checklist', v_checklist
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 9. Update Matching and Suggestions Function
-- Remove state_license weight and matching_require_state_license
CREATE OR REPLACE FUNCTION public.get_project_designer_suggestions(
    p_project_id UUID,
    p_limit INT DEFAULT 5,
    p_exclude_ids UUID[] DEFAULT ARRAY[]::UUID[],
    p_verified_credentials_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    designer_id UUID,
    full_name TEXT,
    avatar_path TEXT,
    professional_type TEXT,
    title TEXT,
    studio_name TEXT,
    city TEXT,
    state TEXT,
    years_experience INT,
    hourly_rate INT,
    show_hourly_rate BOOLEAN,
    plan_key TEXT,
    rating_avg NUMERIC,
    rating_cnt INT,
    completed_cnt INT,
    is_verified BOOLEAN,
    match_score INT,
    match_reasons JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project RECORD;
    v_weights JSONB;
    v_max_active INT;
    v_new_boost INT;
    v_cand RECORD;
BEGIN
    SELECT 
        p.id,
        p.client_id,
        p.category,
        COALESCE(c.name, p.category) AS category_name,
        p.subcategory,
        p.city,
        p.state,
        p.disciplines
    INTO v_project
    FROM public.projects p
    LEFT JOIN public.categories c ON c.id::text = p.category OR c.slug = p.category
    WHERE p.id = p_project_id;

    IF v_project IS NULL THEN
        RAISE EXCEPTION 'project_not_found';
    END IF;

    IF v_project.client_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    -- Settings
    SELECT COALESCE(value::jsonb, '{"specialization_match":35,"subcategory_portfolio":15,"same_city":15,"same_state":10,"verified":10,"rating":10,"completed_projects":5}'::jsonb)
    INTO v_weights FROM public.app_settings WHERE key = 'matching_weights';

    SELECT COALESCE(value::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';
    SELECT COALESCE(value::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';

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
                (p.plan_key IN ('basic', 'upgraded') AND EXISTS (
                    SELECT 1 FROM public.credentials cr 
                    WHERE cr.designer_id = dp.user_id 
                      AND cr.status = 'verified' 
                      AND (cr.expiration_date IS NULL OR cr.expiration_date >= CURRENT_DATE)
                )) AS is_verified,
                (v_project.category_name = ANY(dp.specializations) OR v_project.category = ANY(dp.specializations)) AS matches_category,
                COALESCE((
                    SELECT COUNT(*)::int 
                    FROM public.portfolio_projects pp 
                    WHERE pp.designer_id = dp.user_id 
                      AND pp.subcategory = v_project.subcategory
                ), 0) AS subcategory_portfolio_count
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
              AND NOT EXISTS (
                  SELECT 1 FROM public.proposals prop 
                  WHERE prop.project_id = p_project_id 
                    AND prop.designer_id = dp.user_id 
                    AND prop.status != 'withdrawn'
              )
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status IN ('sent', 'viewed')
              )
              AND NOT EXISTS (
                  SELECT 1 FROM public.project_invitations pi 
                  WHERE pi.project_id = p_project_id 
                    AND pi.designer_id = dp.user_id 
                    AND pi.status = 'declined'
              )
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
                    (CASE WHEN cp.matches_category THEN COALESCE((v_weights->>'specialization_match')::int, 35) ELSE 0 END)
                    + LEAST(cp.subcategory_portfolio_count * COALESCE((v_weights->>'subcategory_portfolio')::int, 15), 25)
                    + (CASE 
                        WHEN cp.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(cp.city) = LOWER(v_project.city) THEN COALESCE((v_weights->>'same_city')::int, 15)
                        WHEN cp.state IS NOT NULL AND v_project.state IS NOT NULL AND cp.state = v_project.state THEN COALESCE((v_weights->>'same_state')::int, 10)
                        ELSE 0 
                      END)
                    + (CASE WHEN cp.is_verified THEN COALESCE((v_weights->>'verified')::int, 10) ELSE 0 END)
                    + (CASE WHEN cp.rating_cnt >= 3 THEN ROUND((cp.rating_avg / 5.0) * COALESCE((v_weights->>'rating')::int, 10)) ELSE 0 END)
                    + LEAST(ROUND((cp.completed_cnt::numeric / 10.0) * COALESCE((v_weights->>'completed_projects')::int, 5)), 5)
                    + (CASE WHEN cp.member_since >= NOW() - INTERVAL '90 days' THEN v_new_boost ELSE 0 END)
                    + (CASE cp.plan_key WHEN 'upgraded' THEN 15 WHEN 'basic' THEN 5 ELSE 0 END)
                )::int AS match_score,
                md5(p_project_id::text || CURRENT_DATE::text || cp.user_id::text) AS daily_hash
            FROM candidate_pool cp
            WHERE cp.active_cnt < v_max_active
              AND (NOT p_verified_credentials_only OR cp.is_verified = true)
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
            IF v_cand.is_verified THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'verified', 'text', 'Verified credentials');
            END IF;
            IF v_cand.city IS NOT NULL AND v_project.city IS NOT NULL AND LOWER(v_cand.city) = LOWER(v_project.city) THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Based in ' || v_cand.city);
            ELSIF v_cand.state IS NOT NULL AND v_project.state IS NOT NULL AND v_cand.state = v_project.state THEN
                v_reasons := v_reasons || jsonb_build_object('type', 'location', 'text', 'Based in ' || v_cand.state);
            END IF;

            designer_id := v_cand.user_id;
            full_name := v_cand.full_name;
            avatar_path := v_cand.avatar_path;
            professional_type := v_cand.professional_type;
            title := v_cand.title;
            studio_name := v_cand.studio_name;
            city := v_cand.city;
            state := v_cand.state;
            years_experience := v_cand.years_experience;
            hourly_rate := v_cand.hourly_rate;
            show_hourly_rate := v_cand.show_hourly_rate;
            plan_key := v_cand.plan_key;
            rating_avg := v_cand.rating_avg;
            rating_cnt := v_cand.rating_cnt;
            completed_cnt := v_cand.completed_cnt;
            is_verified := v_cand.is_verified;
            match_score := v_cand.match_score;
            match_reasons := v_reasons;
            RETURN NEXT;
        END;
    END LOOP;
END;
$$;

