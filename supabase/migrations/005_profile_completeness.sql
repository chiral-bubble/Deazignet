-- ==============================================================================
-- Migration 005: Database-Driven Profile Completeness Functions
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_profile_completeness(p_designer_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_has_photo BOOLEAN := FALSE;
    v_has_bio BOOLEAN := FALSE;
    v_has_specialization BOOLEAN := FALSE;
    v_portfolio_count INTEGER := 0;
    v_credential_count INTEGER := 0;
    v_completed_count INTEGER := 0;
    v_score INTEGER := 0;
    v_checklist JSONB;
BEGIN
    -- 1. Check profile photo
    SELECT (avatar_path IS NOT NULL AND length(trim(avatar_path)) > 0)
    INTO v_has_photo
    FROM public.profiles
    WHERE id = p_designer_id;

    -- 2. Check bio, specialization, title
    SELECT 
        (bio IS NOT NULL AND length(trim(bio)) >= 50),
        (title IS NOT NULL AND length(trim(title)) > 0 AND cardinality(specializations) > 0)
    INTO v_has_bio, v_has_specialization
    FROM public.designer_profiles
    WHERE user_id = p_designer_id;

    -- 3. Check portfolio count
    SELECT COUNT(*)
    INTO v_portfolio_count
    FROM public.portfolio_projects
    WHERE designer_id = p_designer_id;

    -- 4. Check credential count
    SELECT COUNT(*)
    INTO v_credential_count
    FROM public.credentials
    WHERE designer_id = p_designer_id;

    -- Tally completed items
    IF COALESCE(v_has_photo, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_bio, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF COALESCE(v_has_specialization, FALSE) THEN v_completed_count := v_completed_count + 1; END IF;
    IF v_portfolio_count >= 3 THEN v_completed_count := v_completed_count + 1; END IF;
    IF v_credential_count >= 1 THEN v_completed_count := v_completed_count + 1; END IF;

    v_score := ROUND((v_completed_count::NUMERIC / 5.0) * 100);

    v_checklist := jsonb_build_array(
        jsonb_build_object(
            'id', 'photo',
            'label', 'Profile photo',
            'tab', 'profile',
            'completed', COALESCE(v_has_photo, FALSE)
        ),
        jsonb_build_object(
            'id', 'bio',
            'label', 'About & bio (min 50 characters)',
            'tab', 'profile',
            'completed', COALESCE(v_has_bio, FALSE)
        ),
        jsonb_build_object(
            'id', 'specialization',
            'label', 'Specialization & title',
            'tab', 'profile',
            'completed', COALESCE(v_has_specialization, FALSE)
        ),
        jsonb_build_object(
            'id', 'portfolio',
            'label', 'Portfolio (min 3 projects)',
            'tab', 'portfolio',
            'completed', (v_portfolio_count >= 3)
        ),
        jsonb_build_object(
            'id', 'credentials',
            'label', 'Professional registration / credentials',
            'tab', 'credentials',
            'completed', (v_credential_count >= 1)
        )
    );

    RETURN jsonb_build_object(
        'score', v_score,
        'checklist', v_checklist
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
