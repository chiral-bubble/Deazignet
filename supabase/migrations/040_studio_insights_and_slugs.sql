-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - STUDIO INSIGHTS & STUDIO WEB ADDRESS
-- 040_studio_insights_and_slugs.sql
-- Daily Aggregate Analytics, Slug Reservations, 90-day Redirects, Funnel
-- ==============================================================================

-- 1. Daily Designer Analytics Table (Kept for 13 months, aggregated daily)
CREATE TABLE IF NOT EXISTS public.designer_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    profile_views INT NOT NULL DEFAULT 0,
    search_appearances INT NOT NULL DEFAULT 0,
    suggestion_appearances INT NOT NULL DEFAULT 0,
    invitations_received INT NOT NULL DEFAULT 0,
    invitations_declined INT NOT NULL DEFAULT 0,
    proposals_sent INT NOT NULL DEFAULT 0,
    proposals_viewed INT NOT NULL DEFAULT 0,
    proposals_shortlisted INT NOT NULL DEFAULT 0,
    proposals_declined INT NOT NULL DEFAULT 0,
    proposals_accepted INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (designer_id, date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_designer_date ON public.designer_analytics_daily(designer_id, date DESC);

ALTER TABLE public.designer_analytics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Designers can view own analytics" ON public.designer_analytics_daily
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

CREATE POLICY "Admins can view all analytics" ON public.designer_analytics_daily
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- 2. Studio Slug History & 90-day Redirects
CREATE TABLE IF NOT EXISTS public.studio_slug_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ,
    redirect_until TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_studio_slug_history_slug ON public.studio_slug_history(slug);
CREATE INDEX IF NOT EXISTS idx_studio_slug_history_designer ON public.studio_slug_history(designer_id);

ALTER TABLE public.studio_slug_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can lookup slug history for redirects" ON public.studio_slug_history
    FOR SELECT TO authenticated, anon
    USING (true);

-- 3. Reserved Slugs Table
CREATE TABLE IF NOT EXISTS public.reserved_slugs (
    slug TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT 'system_reserved'
);

ALTER TABLE public.reserved_slugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reserved slugs" ON public.reserved_slugs
    FOR SELECT TO authenticated, anon
    USING (true);

INSERT INTO public.reserved_slugs (slug, reason) VALUES
('admin', 'system'),
('api', 'system'),
('auth', 'system'),
('app', 'system'),
('studio', 'system'),
('explore', 'system'),
('dezignet', 'system'),
('settings', 'system'),
('profile', 'system'),
('projects', 'system'),
('proposals', 'system'),
('contracts', 'system'),
('billing', 'system'),
('payments', 'system'),
('support', 'system'),
('help', 'system'),
('legal', 'system'),
('terms', 'system'),
('privacy', 'system'),
('dashboard', 'system'),
('messages', 'system'),
('conversations', 'system'),
('find-designers', 'system')
ON CONFLICT (slug) DO NOTHING;

-- 4. Record Analytics Event RPC
CREATE OR REPLACE FUNCTION public.record_analytics_event(
    p_designer_id UUID,
    p_event_type TEXT,
    p_viewer_hash TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Ignore self-views
    IF auth.uid() = p_designer_id THEN
        RETURN;
    END IF;

    -- Ensure daily counter row exists
    INSERT INTO public.designer_analytics_daily (designer_id, date)
    VALUES (p_designer_id, CURRENT_DATE)
    ON CONFLICT (designer_id, date) DO NOTHING;

    CASE p_event_type
        WHEN 'profile_view' THEN
            UPDATE public.designer_analytics_daily
            SET profile_views = profile_views + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'search_appearance' THEN
            UPDATE public.designer_analytics_daily
            SET search_appearances = search_appearances + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'suggestion_appearance' THEN
            UPDATE public.designer_analytics_daily
            SET suggestion_appearances = suggestion_appearances + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'invitation_received' THEN
            UPDATE public.designer_analytics_daily
            SET invitations_received = invitations_received + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'invitation_declined' THEN
            UPDATE public.designer_analytics_daily
            SET invitations_declined = invitations_declined + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_sent' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_sent = proposals_sent + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_viewed' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_viewed = proposals_viewed + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_shortlisted' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_shortlisted = proposals_shortlisted + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_declined' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_declined = proposals_declined + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        WHEN 'proposal_accepted' THEN
            UPDATE public.designer_analytics_daily
            SET proposals_accepted = proposals_accepted + 1, updated_at = NOW()
            WHERE designer_id = p_designer_id AND date = CURRENT_DATE;

        ELSE
            -- No-op for untracked events
            NULL;
    END CASE;
END;
$$;

-- 5. Get Studio Insights Function (Upgraded plan only, period 7, 30, 90 days)
CREATE OR REPLACE FUNCTION public.get_studio_insights(
    p_designer_id UUID,
    p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_key TEXT;
    v_has_insights BOOLEAN;
    v_current RECORD;
    v_previous RECORD;
    v_win_rate NUMERIC(5,1) := 0.0;
BEGIN
    -- Owner or admin only
    IF auth.uid() != p_designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized'
            USING ERRCODE = '42501';
    END IF;

    -- Verify designer plan has studio_insights
    SELECT p.plan_key, pl.studio_insights INTO v_plan_key, v_has_insights
    FROM public.profiles p
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE p.id = p_designer_id;

    IF NOT COALESCE(v_has_insights, false) THEN
        RAISE EXCEPTION 'plan_upgrade_required'
            USING ERRCODE = '42501';
    END IF;

    -- Validate period
    IF p_days NOT IN (7, 30, 90) THEN
        p_days := 30;
    END IF;

    -- Current period sums
    SELECT
        COALESCE(SUM(profile_views), 0) AS profile_views,
        COALESCE(SUM(search_appearances), 0) AS search_appearances,
        COALESCE(SUM(suggestion_appearances), 0) AS suggestion_appearances,
        COALESCE(SUM(invitations_received), 0) AS invitations_received,
        COALESCE(SUM(invitations_declined), 0) AS invitations_declined,
        COALESCE(SUM(proposals_sent), 0) AS proposals_sent,
        COALESCE(SUM(proposals_viewed), 0) AS proposals_viewed,
        COALESCE(SUM(proposals_shortlisted), 0) AS proposals_shortlisted,
        COALESCE(SUM(proposals_declined), 0) AS proposals_declined,
        COALESCE(SUM(proposals_accepted), 0) AS proposals_accepted
    INTO v_current
    FROM public.designer_analytics_daily
    WHERE designer_id = p_designer_id
      AND date >= CURRENT_DATE - (p_days || ' days')::INTERVAL;

    -- Previous period sums (for comparison text)
    SELECT
        COALESCE(SUM(profile_views), 0) AS profile_views,
        COALESCE(SUM(search_appearances), 0) AS search_appearances,
        COALESCE(SUM(suggestion_appearances), 0) AS suggestion_appearances,
        COALESCE(SUM(invitations_received), 0) AS invitations_received,
        COALESCE(SUM(invitations_declined), 0) AS invitations_declined,
        COALESCE(SUM(proposals_sent), 0) AS proposals_sent,
        COALESCE(SUM(proposals_viewed), 0) AS proposals_viewed,
        COALESCE(SUM(proposals_shortlisted), 0) AS proposals_shortlisted,
        COALESCE(SUM(proposals_declined), 0) AS proposals_declined,
        COALESCE(SUM(proposals_accepted), 0) AS proposals_accepted
    INTO v_previous
    FROM public.designer_analytics_daily
    WHERE designer_id = p_designer_id
      AND date >= CURRENT_DATE - (p_days * 2 || ' days')::INTERVAL
      AND date < CURRENT_DATE - (p_days || ' days')::INTERVAL;

    IF v_current.proposals_sent > 0 THEN
        v_win_rate := ROUND((v_current.proposals_accepted::NUMERIC / v_current.proposals_sent) * 100.0, 1);
    END IF;

    RETURN jsonb_build_object(
        'period_days', p_days,
        'current', row_to_json(v_current),
        'previous', row_to_json(v_previous),
        'win_rate', v_win_rate
    );
END;
$$;

-- 6. Claim Studio Slug Function
CREATE OR REPLACE FUNCTION public.claim_studio_slug(
    p_designer_id UUID,
    p_new_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_slug TEXT;
    v_old_slug TEXT;
    v_last_updated TIMESTAMPTZ;
    v_plan_has_url BOOLEAN;
BEGIN
    IF auth.uid() != p_designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    -- Check plan has studio_url
    SELECT pl.studio_url INTO v_plan_has_url
    FROM public.profiles p
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE p.id = p_designer_id;

    IF NOT COALESCE(v_plan_has_url, false) THEN
        RAISE EXCEPTION 'plan_upgrade_required' USING ERRCODE = '42501';
    END IF;

    v_clean_slug := LOWER(TRIM(p_new_slug));

    -- Validate format: 3 to 40 characters, lowercase letters, digits, and hyphens, no leading/trailing hyphen
    IF v_clean_slug !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' THEN
        RAISE EXCEPTION 'invalid_slug_format' USING ERRCODE = '22023';
    END IF;

    -- Check reserved words
    IF EXISTS (SELECT 1 FROM public.reserved_slugs WHERE slug = v_clean_slug) THEN
        RAISE EXCEPTION 'slug_reserved' USING ERRCODE = '22023';
    END IF;

    -- Check if another active designer already holds this slug
    IF EXISTS (
        SELECT 1 FROM public.designer_profiles 
        WHERE studio_slug = v_clean_slug AND user_id != p_designer_id
    ) THEN
        RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
    END IF;

    -- Check if redirect exists for another designer within 90 days
    IF EXISTS (
        SELECT 1 FROM public.studio_slug_history 
        WHERE slug = v_clean_slug 
          AND designer_id != p_designer_id 
          AND redirect_until > NOW()
    ) THEN
        RAISE EXCEPTION 'slug_reserved_redirect' USING ERRCODE = '23505';
    END IF;

    -- Check 30-day throttle on changes
    SELECT studio_slug, studio_slug_updated_at INTO v_old_slug, v_last_updated
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    IF v_last_updated IS NOT NULL AND v_last_updated > NOW() - INTERVAL '30 days' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'slug_change_too_soon' USING ERRCODE = '42501';
    END IF;

    -- Archive old slug in history with 90-day redirect
    IF v_old_slug IS NOT NULL AND v_old_slug != v_clean_slug THEN
        INSERT INTO public.studio_slug_history (designer_id, slug, claimed_at, released_at, redirect_until)
        VALUES (p_designer_id, v_old_slug, COALESCE(v_last_updated, NOW()), NOW(), NOW() + INTERVAL '90 days');
    END IF;

    -- Update active slug
    UPDATE public.designer_profiles
    SET studio_slug = v_clean_slug, studio_slug_updated_at = NOW()
    WHERE user_id = p_designer_id;

    -- Record new slug in history
    INSERT INTO public.studio_slug_history (designer_id, slug, claimed_at)
    VALUES (p_designer_id, v_clean_slug, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'slug', v_clean_slug
    );
END;
$$;

-- 7. Resolve Studio Slug Function
CREATE OR REPLACE FUNCTION public.resolve_studio_slug(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_slug TEXT := LOWER(TRIM(p_slug));
    v_designer_id UUID;
    v_redirect_designer_id UUID;
    v_redirect_active_slug TEXT;
    v_plan_has_url BOOLEAN;
BEGIN
    -- Direct lookup on active studio_slug
    SELECT dp.user_id, pl.studio_url INTO v_designer_id, v_plan_has_url
    FROM public.designer_profiles dp
    JOIN public.profiles p ON p.id = dp.user_id
    JOIN public.plans pl ON pl.key = p.plan_key
    WHERE dp.studio_slug = v_clean_slug;

    IF v_designer_id IS NOT NULL THEN
        IF v_plan_has_url = true THEN
            RETURN jsonb_build_object(
                'status', 'found',
                'designer_id', v_designer_id,
                'slug', v_clean_slug
            );
        ELSE
            -- Downgraded plan: slug stops resolving
            RETURN jsonb_build_object('status', 'plan_expired');
        END IF;
    END IF;

    -- Check redirect history within 90 days
    SELECT designer_id INTO v_redirect_designer_id
    FROM public.studio_slug_history
    WHERE slug = v_clean_slug AND redirect_until > NOW()
    ORDER BY released_at DESC
    LIMIT 1;

    IF v_redirect_designer_id IS NOT NULL THEN
        SELECT studio_slug INTO v_redirect_active_slug
        FROM public.designer_profiles
        WHERE user_id = v_redirect_designer_id;

        IF v_redirect_active_slug IS NOT NULL THEN
            RETURN jsonb_build_object(
                'status', 'redirect',
                'new_slug', v_redirect_active_slug,
                'designer_id', v_redirect_designer_id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('status', 'not_found');
END;
$$;

