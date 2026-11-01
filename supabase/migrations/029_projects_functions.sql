-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 029_projects_functions.sql
-- Project Lifecycle Functions, Edit Lockdown Rules & Notification Triggers
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: get_site_details (Private Details Access Gate)
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
    v_has_signed_engagement BOOLEAN := FALSE;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    -- Check if caller is engagement designer (contract signed requirement in future phases)
    SELECT EXISTS (
        SELECT 1 FROM public.engagements e
        WHERE e.project_id = p_project_id
          AND e.designer_id = v_caller_id
          AND e.status IN ('active'::public.engagement_status, 'completed'::public.engagement_status)
    ) INTO v_has_signed_engagement;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() AND NOT v_has_signed_engagement THEN
        RAISE EXCEPTION 'Access denied to private site details.' USING ERRCODE = '42501';
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
        'project_id', v_details.project_id,
        'street', v_details.street,
        'postal_code', v_details.postal_code,
        'site_notes', v_details.site_notes,
        'access_instructions', v_details.access_instructions,
        'updated_at', v_details.updated_at
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. publish_project
-- Comprehensive server-side validation before transitioning from draft -> open
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_profile RECORD;
    v_max_desc_chars INT;
    v_phase_count INT;
    v_phase_sum NUMERIC(6,2);
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
        RAISE EXCEPTION 'Only the project owner can publish this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status = 'open'::public.project_status THEN
        RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'open');
    END IF;

    IF v_proj.status <> 'draft'::public.project_status THEN
        RAISE EXCEPTION 'Only draft projects can be published (current: %).', v_proj.status
            USING HINT = 'invalid_status', ERRCODE = 'P0001';
    END IF;

    -- Validate client profile completeness
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_caller_id;
    IF v_profile.full_name IS NULL OR char_length(trim(v_profile.full_name)) = 0
       OR v_profile.location IS NULL OR char_length(trim(v_profile.location)) = 0 THEN
        RAISE EXCEPTION 'Client profile is incomplete. Full name and location are required before publishing.'
            USING HINT = 'profile_incomplete', ERRCODE = 'P0001';
    END IF;

    -- Validate required project fields
    IF v_proj.title IS NULL OR char_length(trim(v_proj.title)) = 0 THEN
        RAISE EXCEPTION 'Project title is required.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF v_proj.category IS NULL OR char_length(trim(v_proj.category)) = 0 THEN
        RAISE EXCEPTION 'Project category is required.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate disciplines ("Professional needed")
    IF v_proj.disciplines IS NULL OR array_length(v_proj.disciplines, 1) IS NULL OR array_length(v_proj.disciplines, 1) = 0 THEN
        RAISE EXCEPTION 'At least one professional discipline is required before publishing.'
            USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate description limits
    SELECT COALESCE((value->>0)::INT, 2000) INTO v_max_desc_chars
    FROM public.app_settings WHERE key = 'max_description_chars';

    IF v_proj.description IS NULL OR char_length(trim(v_proj.description)) = 0 THEN
        RAISE EXCEPTION 'Project description is required.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF char_length(v_proj.description) > v_max_desc_chars THEN
        RAISE EXCEPTION 'Project description exceeds maximum allowable length of % characters.', v_max_desc_chars
            USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate design budget
    IF v_proj.design_budget IS NULL OR v_proj.design_budget <= 0 THEN
        RAISE EXCEPTION 'Design budget must be greater than zero.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate deadline in future
    IF v_proj.deadline IS NOT NULL AND v_proj.deadline <= CURRENT_DATE THEN
        RAISE EXCEPTION 'Project completion deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    -- Validate proposal deadline (must be before project deadline)
    IF v_proj.proposal_deadline IS NOT NULL THEN
        IF v_proj.proposal_deadline <= CURRENT_DATE THEN
            RAISE EXCEPTION 'Proposal deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        IF v_proj.deadline IS NOT NULL AND v_proj.proposal_deadline >= v_proj.deadline THEN
            RAISE EXCEPTION 'Proposal deadline must be earlier than the project completion deadline.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Scope & Payment Validation
    IF v_proj.payment_type = 'milestone'::public.payment_type THEN
        SELECT COUNT(*), COALESCE(SUM(fee_percent), 0)
        INTO v_phase_count, v_phase_sum
        FROM public.project_milestones
        WHERE project_id = p_project_id;

        IF v_phase_count = 0 THEN
            RAISE EXCEPTION 'Milestone projects must include at least one phase.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        IF ABS(v_phase_sum - 100.00) > 0.01 THEN
            RAISE EXCEPTION 'Milestone phase percentages must total exactly 100 percent (current sum: %).', v_phase_sum
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    ELSIF v_proj.payment_type = 'hourly'::public.payment_type THEN
        IF v_proj.hourly_rate_max IS NULL OR v_proj.hourly_rate_max <= 0 THEN
            RAISE EXCEPTION 'Hourly projects require a maximum hourly rate.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;

        SELECT COUNT(*) INTO v_phase_count
        FROM public.project_milestones
        WHERE project_id = p_project_id;

        IF v_phase_count > 0 THEN
            RAISE EXCEPTION 'Hourly projects cannot have milestone phases.'
                USING HINT = 'validation_failed', ERRCODE = 'P0001';
        END IF;
    END IF;

    -- Transition status
    UPDATE public.projects
    SET
        status = 'open'::public.project_status,
        published_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    -- Create in-app notification for client
    PERFORM public.create_notification(
        v_caller_id,
        'system_announcement'::public.notification_type,
        'Project Published',
        'Your project "' || v_proj.title || '" is now live and accepting proposals from designers.',
        jsonb_build_object('project_id', p_project_id, 'title', v_proj.title)
    );

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'status', 'open',
        'published_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. close_project
-- Stops accepting new proposals; existing proposals can still be evaluated
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
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
        RAISE EXCEPTION 'Only the project owner can close this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status = 'closed'::public.project_status THEN
        RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'closed');
    END IF;

    IF v_proj.status <> 'open'::public.project_status THEN
        RAISE EXCEPTION 'Only open projects can be closed (current: %).', v_proj.status
            USING HINT = 'invalid_status', ERRCODE = 'P0001';
    END IF;

    UPDATE public.projects
    SET
        status = 'closed'::public.project_status,
        closed_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'closed');
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. cancel_project
-- Allowed only while NO engagement exists. Declines all open proposals and notifies.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_project(
    p_project_id UUID,
    p_reason TEXT DEFAULT 'Project cancelled by the client'
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_prop RECORD;
    v_declined_count INT := 0;
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
        RAISE EXCEPTION 'Only the project owner can cancel this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status = 'cancelled'::public.project_status THEN
        RETURN jsonb_build_object('success', true, 'project_id', p_project_id, 'status', 'cancelled');
    END IF;

    -- Rule: Cannot cancel if any engagement exists
    IF EXISTS (
        SELECT 1 FROM public.engagements
        WHERE project_id = p_project_id
    ) THEN
        RAISE EXCEPTION 'Cannot cancel project because an engagement has already been established.'
            USING HINT = 'project_has_engagement', ERRCODE = 'P0001';
    END IF;

    -- Decline all active proposals on this project
    FOR v_prop IN
        SELECT id, designer_id FROM public.proposals
        WHERE project_id = p_project_id
          AND status IN ('pending'::public.proposal_status, 'viewed'::public.proposal_status, 'shortlisted'::public.proposal_status)
    LOOP
        UPDATE public.proposals
        SET
            status = 'declined'::public.proposal_status,
            client_feedback = COALESCE(p_reason, 'Project cancelled by the client'),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_prop.id;

        -- Notify affected designer
        PERFORM public.create_notification(
            v_prop.designer_id,
            'proposal_declined'::public.notification_type,
            'Project Cancelled',
            'The client has cancelled project "' || v_proj.title || '". Your proposal was automatically closed.',
            jsonb_build_object('project_id', p_project_id, 'proposal_id', v_prop.id)
        );

        v_declined_count := v_declined_count + 1;
    END LOOP;

    UPDATE public.projects
    SET
        status = 'cancelled'::public.project_status,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'status', 'cancelled',
        'declined_proposals_count', v_declined_count
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. duplicate_project
-- Copies fields, phases, and image records (references, not files) into a new draft
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.duplicate_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_orig RECORD;
    v_new_id UUID;
    v_priv RECORD;
    v_pm RECORD;
    v_img RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_orig FROM public.projects WHERE id = p_project_id;
    IF v_orig.id IS NULL THEN
        RAISE EXCEPTION 'Original project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_orig.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can duplicate this project.' USING ERRCODE = '42501';
    END IF;

    v_new_id := gen_random_uuid();

    -- Insert new project as draft
    INSERT INTO public.projects (
        id,
        client_id,
        title,
        description,
        category,
        subcategory,
        project_type_notes,
        design_budget,
        currency,
        payment_type,
        hourly_rate_max,
        timeline_days,
        deadline,
        area_sqft,
        location_text,
        city,
        state_region,
        building_status,
        site_status,
        existing_documents,
        proposal_deadline,
        area_unit,
        included_revisions_requested,
        status,
        wizard_step,
        last_saved_at
    )
    VALUES (
        v_new_id,
        v_caller_id,
        v_orig.title || ' (Copy)',
        v_orig.description,
        v_orig.category,
        v_orig.subcategory,
        v_orig.project_type_notes,
        v_orig.design_budget,
        v_orig.currency,
        v_orig.payment_type,
        v_orig.hourly_rate_max,
        v_orig.timeline_days,
        NULL, -- Reset deadline for copy
        v_orig.area_sqft,
        v_orig.location_text,
        v_orig.city,
        v_orig.state_region,
        v_orig.building_status,
        v_orig.site_status,
        v_orig.existing_documents,
        NULL, -- Reset proposal deadline
        v_orig.area_unit,
        v_orig.included_revisions_requested,
        'draft'::public.project_status,
        1,
        timezone('utc'::text, now())
    );

    -- Copy private site details if any
    SELECT * INTO v_priv FROM public.project_private_details WHERE project_id = p_project_id;
    IF v_priv.project_id IS NOT NULL THEN
        INSERT INTO public.project_private_details (
            project_id,
            street,
            postal_code,
            site_notes,
            access_instructions
        )
        VALUES (
            v_new_id,
            v_priv.street,
            v_priv.postal_code,
            v_priv.site_notes,
            v_priv.access_instructions
        );
    END IF;

    -- Copy milestone phases
    FOR v_pm IN SELECT * FROM public.project_milestones WHERE project_id = p_project_id ORDER BY sort_order ASC LOOP
        INSERT INTO public.project_milestones (
            project_id,
            sort_order,
            name,
            description,
            deliverables,
            billing_trigger,
            fee_percent
        )
        VALUES (
            v_new_id,
            v_pm.sort_order,
            v_pm.name,
            v_pm.description,
            v_pm.deliverables,
            v_pm.billing_trigger,
            v_pm.fee_percent
        );
    END LOOP;

    -- Copy image references
    FOR v_img IN SELECT * FROM public.project_images WHERE project_id = p_project_id ORDER BY sort_order ASC LOOP
        INSERT INTO public.project_images (
            project_id,
            path,
            sort_order,
            file_id
        )
        VALUES (
            v_new_id,
            v_img.path,
            v_img.sort_order,
            v_img.file_id
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'new_project_id', v_new_id,
        'title', v_orig.title || ' (Copy)'
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 6. delete_project
-- Drafts only. Cascade removes all related project data.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_project(p_project_id UUID)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
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
        RAISE EXCEPTION 'Only the project owner can delete this project.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status <> 'draft'::public.project_status THEN
        RAISE EXCEPTION 'Only draft projects can be deleted. Published projects must be closed or cancelled.'
            USING HINT = 'not_allowed', ERRCODE = 'P0001';
    END IF;

    DELETE FROM public.projects WHERE id = p_project_id;

    RETURN jsonb_build_object('success', true, 'deleted_project_id', p_project_id);
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 7. add_project_update
-- Owner only while open or awarded; notifies designers with proposals
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_project_update(
    p_project_id UUID,
    p_body TEXT
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_update_id UUID;
    v_designer RECORD;
    v_clean_body TEXT;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    v_clean_body := trim(p_body);
    IF v_clean_body IS NULL OR char_length(v_clean_body) = 0 THEN
        RAISE EXCEPTION 'Update body cannot be empty.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF char_length(v_clean_body) > 1000 THEN
        RAISE EXCEPTION 'Update body cannot exceed 1000 characters.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_proj FROM public.projects WHERE id = p_project_id;
    IF v_proj.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_proj.client_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the project owner can post updates.' USING ERRCODE = '42501';
    END IF;

    IF v_proj.status NOT IN ('open'::public.project_status, 'awarded'::public.project_status) THEN
        RAISE EXCEPTION 'Project updates can only be added while open or awarded.'
            USING HINT = 'not_allowed', ERRCODE = 'P0001';
    END IF;

    INSERT INTO public.project_updates (project_id, author_id, body)
    VALUES (p_project_id, v_caller_id, v_clean_body)
    RETURNING id INTO v_update_id;

    -- Notify all designers who submitted a proposal
    FOR v_designer IN
        SELECT DISTINCT designer_id FROM public.proposals
        WHERE project_id = p_project_id
          AND status <> 'withdrawn'::public.proposal_status
    LOOP
        PERFORM public.create_notification(
            v_designer.designer_id,
            'message_received'::public.notification_type,
            'Project Update: ' || v_proj.title,
            'The client added an update: "' || substring(v_clean_body from 1 for 80) || '..."',
            jsonb_build_object('project_id', p_project_id, 'update_id', v_update_id)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'update_id', v_update_id,
        'project_id', p_project_id,
        'created_at', timezone('utc'::text, now())
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 8. extend_deadline
-- Client extends project completion deadline; must be strictly in the future
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.extend_deadline(
    p_project_id UUID,
    p_new_deadline DATE
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_proj RECORD;
    v_designer RECORD;
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
        RAISE EXCEPTION 'Only the project owner can extend the deadline.' USING ERRCODE = '42501';
    END IF;

    IF p_new_deadline <= CURRENT_DATE THEN
        RAISE EXCEPTION 'New deadline must be in the future.' USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    IF v_proj.deadline IS NOT NULL AND p_new_deadline <= v_proj.deadline THEN
        RAISE EXCEPTION 'New deadline must be later than the existing deadline (%)' , v_proj.deadline
            USING HINT = 'validation_failed', ERRCODE = 'P0001';
    END IF;

    UPDATE public.projects
    SET
        deadline = p_new_deadline,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_project_id;

    -- Notify designers
    FOR v_designer IN
        SELECT DISTINCT designer_id FROM public.proposals
        WHERE project_id = p_project_id
          AND status <> 'withdrawn'::public.proposal_status
    LOOP
        PERFORM public.create_notification(
            v_designer.designer_id,
            'message_received'::public.notification_type,
            'Project Deadline Extended',
            'The client has extended the deadline for "' || v_proj.title || '" to ' || p_new_deadline || '.',
            jsonb_build_object('project_id', p_project_id, 'new_deadline', p_new_deadline)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'new_deadline', p_new_deadline
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 9. Trigger: Proposal Edit Lockdown on Projects
-- Once ANY proposal exists:
-- - design_budget, payment_type, category cannot change
-- - description changes must go through project updates
-- - title can only be corrected within 24 hours of publishing
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_project_updates()
RETURNS TRIGGER AS $$
DECLARE
    v_has_proposals BOOLEAN := FALSE;
BEGIN
    -- Draft projects can be edited freely by owner
    IF OLD.status = 'draft'::public.project_status THEN
        RETURN NEW;
    END IF;

    -- Check if proposals exist
    SELECT EXISTS (
        SELECT 1 FROM public.proposals WHERE project_id = NEW.id
    ) INTO v_has_proposals;

    IF v_has_proposals THEN
        -- 1. Budget and payment type lock
        IF (OLD.design_budget IS DISTINCT FROM NEW.design_budget OR OLD.payment_type IS DISTINCT FROM NEW.payment_type) THEN
            RAISE EXCEPTION 'Cannot modify design budget or payment type once proposals have been received.'
                USING HINT = 'not_editable', ERRCODE = 'P0001';
        END IF;

        -- 2. Category and Subcategory lock
        IF (OLD.category IS DISTINCT FROM NEW.category OR OLD.subcategory IS DISTINCT FROM NEW.subcategory) THEN
            RAISE EXCEPTION 'Cannot modify project category once proposals have been received.'
                USING HINT = 'not_editable', ERRCODE = 'P0001';
        END IF;

        -- 3. Description change lock (must use project updates)
        IF (OLD.description IS DISTINCT FROM NEW.description) THEN
            RAISE EXCEPTION 'Project description cannot be edited once proposals exist. Please use Project Updates to communicate scope clarifications.'
                USING HINT = 'not_editable', ERRCODE = 'P0001';
        END IF;

        -- 4. Title correction window (max 24 hours from published_at)
        IF (OLD.title IS DISTINCT FROM NEW.title) THEN
            IF OLD.published_at IS NOT NULL AND (timezone('utc'::text, now()) - OLD.published_at) > INTERVAL '24 hours' THEN
                RAISE EXCEPTION 'Project title can only be corrected within 24 hours of publishing.'
                    USING HINT = 'not_editable', ERRCODE = 'P0001';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 10. Trigger: Prevent Milestone Modifications Once Proposals Exist
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_project_milestone_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_proj_id UUID;
    v_has_proposals BOOLEAN;
BEGIN
    v_proj_id := COALESCE(NEW.project_id, OLD.project_id);

    SELECT EXISTS (
        SELECT 1 FROM public.proposals WHERE project_id = v_proj_id
    ) INTO v_has_proposals;

    IF v_has_proposals THEN
        RAISE EXCEPTION 'Milestone scope cannot be modified once proposals have been received.'
            USING HINT = 'not_editable', ERRCODE = 'P0001';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_project_milestone_lock ON public.project_milestones;
CREATE TRIGGER trg_check_project_milestone_lock
    BEFORE INSERT OR UPDATE OR DELETE ON public.project_milestones
    FOR EACH ROW
    EXECUTE FUNCTION public.check_project_milestone_lock();

-- ------------------------------------------------------------------------------
-- 11. Trigger: proposal_received Client Notification
-- When designer submits proposal, notify client
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_proposal_received_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id UUID;
    v_proj_title TEXT;
BEGIN
    SELECT client_id, title INTO v_client_id, v_proj_title
    FROM public.projects WHERE id = NEW.project_id;

    IF v_client_id IS NOT NULL THEN
        PERFORM public.create_notification(
            v_client_id,
            'proposal_received'::public.notification_type,
            'New Proposal Received',
            'A designer submitted a proposal for "' || v_proj_title || '".',
            jsonb_build_object(
                'project_id', NEW.project_id,
                'proposal_id', NEW.id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_proposal_received_notification ON public.proposals;
CREATE TRIGGER trg_proposal_received_notification
    AFTER INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_proposal_received_notification();

-- ------------------------------------------------------------------------------
-- 12. Scheduled Maintenance Job: Project Auto-Close & Warning
-- Warn 7 days before auto_close_days, close at auto_close_days, close expired proposal deadlines
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_project_auto_close()
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auto_close_days INT;
    v_warning_days INT;
    v_warn_count INT := 0;
    v_close_count INT := 0;
    v_deadline_close_count INT := 0;
    v_proj RECORD;
    v_lock_acquired BOOLEAN;
BEGIN
    -- Advisory lock to guarantee single-instance execution
    v_lock_acquired := pg_try_advisory_xact_lock(hashtext('check_project_auto_close'));
    IF NOT v_lock_acquired THEN
        RETURN jsonb_build_object('status', 'skipped', 'reason', 'lock_not_acquired');
    END IF;

    SELECT COALESCE((value->>0)::INT, 60) INTO v_auto_close_days
    FROM public.app_settings WHERE key = 'project_auto_close_days';

    SELECT COALESCE((value->>0)::INT, 7) INTO v_warning_days
    FROM public.app_settings WHERE key = 'auto_close_warning_days';

    -- 1. Close projects that passed proposal_deadline
    FOR v_proj IN
        SELECT id, client_id, title FROM public.projects
        WHERE status = 'open'::public.project_status
          AND proposal_deadline IS NOT NULL
          AND proposal_deadline < CURRENT_DATE
    LOOP
        UPDATE public.projects
        SET
            status = 'closed'::public.project_status,
            closed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_proj.id;

        PERFORM public.create_notification(
            v_proj.client_id,
            'system_announcement'::public.notification_type,
            'Proposal Window Closed',
            'The proposal deadline for "' || v_proj.title || '" has passed. The project is no longer accepting new proposals.',
            jsonb_build_object('project_id', v_proj.id)
        );

        v_deadline_close_count := v_deadline_close_count + 1;
    END LOOP;

    -- 2. Send 7-day warning notification for inactive open projects
    FOR v_proj IN
        SELECT id, client_id, title FROM public.projects
        WHERE status = 'open'::public.project_status
          AND published_at <= (timezone('utc'::text, now()) - ((v_auto_close_days - v_warning_days) || ' days')::INTERVAL)
          AND published_at > (timezone('utc'::text, now()) - (v_auto_close_days || ' days')::INTERVAL)
    LOOP
        PERFORM public.create_notification(
            v_proj.client_id,
            'system_announcement'::public.notification_type,
            'Project Expiring Soon',
            'Your project "' || v_proj.title || '" will be automatically closed in ' || v_warning_days || ' days due to inactivity.',
            jsonb_build_object('project_id', v_proj.id)
        );
        v_warn_count := v_warn_count + 1;
    END LOOP;

    -- 3. Auto-close projects reaching 60 days
    FOR v_proj IN
        SELECT id, client_id, title FROM public.projects
        WHERE status = 'open'::public.project_status
          AND published_at <= (timezone('utc'::text, now()) - (v_auto_close_days || ' days')::INTERVAL)
    LOOP
        UPDATE public.projects
        SET
            status = 'closed'::public.project_status,
            closed_at = timezone('utc'::text, now()),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_proj.id;

        PERFORM public.create_notification(
            v_proj.client_id,
            'system_announcement'::public.notification_type,
            'Project Automatically Closed',
            'Your project "' || v_proj.title || '" has been closed after ' || v_auto_close_days || ' days.',
            jsonb_build_object('project_id', v_proj.id)
        );
        v_close_count := v_close_count + 1;
    END LOOP;

    -- Log run
    INSERT INTO public.job_runs (job_name, items_processed, error_count, details)
    VALUES (
        'check_project_auto_close',
        v_warn_count + v_close_count + v_deadline_close_count,
        0,
        jsonb_build_object(
            'warnings_sent', v_warn_count,
            'auto_closed', v_close_count,
            'deadline_closed', v_deadline_close_count
        )
    );

    RETURN jsonb_build_object(
        'warnings_sent', v_warn_count,
        'auto_closed', v_close_count,
        'deadline_closed', v_deadline_close_count
    );
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 10. request_account_deletion
-- Validates eligibility (no open projects, active engagements, or held escrow funds)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion(p_email TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_user_email TEXT;
    v_has_open_projects BOOLEAN := FALSE;
    v_has_active_engagements BOOLEAN := FALSE;
    v_has_escrow_funds BOOLEAN := FALSE;
    v_ticket_id UUID;
BEGIN
    v_caller_id := (SELECT auth.uid());
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_caller_id;
    IF v_user_email IS NULL OR lower(trim(p_email)) <> lower(trim(v_user_email)) THEN
        RAISE EXCEPTION 'Provided email does not match your registered account email.' USING ERRCODE = 'P0001';
    END IF;

    -- Check open projects
    SELECT EXISTS (
        SELECT 1 FROM public.projects
        WHERE client_id = v_caller_id
          AND status IN ('open'::public.project_status, 'under_review'::public.project_status)
    ) INTO v_has_open_projects;

    IF v_has_open_projects THEN
        RAISE EXCEPTION 'Cannot delete account while you have open or under-review projects. Please close or cancel them first.' USING ERRCODE = 'P0001';
    END IF;

    -- Check active engagements
    SELECT EXISTS (
        SELECT 1 FROM public.engagements
        WHERE (client_id = v_caller_id OR designer_id = v_caller_id)
          AND status IN ('active'::public.engagement_status, 'in_dispute'::public.engagement_status)
    ) INTO v_has_active_engagements;

    IF v_has_active_engagements THEN
        RAISE EXCEPTION 'Cannot delete account while you have active engagements or ongoing work.' USING ERRCODE = 'P0001';
    END IF;

    -- Check funds in escrow
    SELECT EXISTS (
        SELECT 1 FROM public.engagement_milestones em
        JOIN public.engagements e ON e.id = em.engagement_id
        WHERE (e.client_id = v_caller_id OR e.designer_id = v_caller_id)
          AND em.escrow_status IN ('funded'::public.escrow_status, 'held'::public.escrow_status)
    ) INTO v_has_escrow_funds;

    IF v_has_escrow_funds THEN
        RAISE EXCEPTION 'Cannot delete account with funds held in escrow. Please complete or refund remaining milestones.' USING ERRCODE = 'P0001';
    END IF;

    -- Record deletion request timestamp on profile
    UPDATE public.profiles
    SET deletion_requested_at = timezone('utc'::text, now())
    WHERE id = v_caller_id;

    -- Create support ticket for manual compliance/legal handling
    INSERT INTO public.support_tickets (
        user_id,
        type,
        subject,
        details
    )
    VALUES (
        v_caller_id,
        'help'::public.ticket_type,
        'Account Deletion Request',
        'User ' || v_user_email || ' (ID: ' || v_caller_id || ') has submitted an official account deletion request. Please review compliance records and process accordingly.'
    )
    RETURNING id INTO v_ticket_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Account deletion request received and logged for administrative processing.',
        'ticket_id', v_ticket_id,
        'requested_at', now()
    );
END;
$$ LANGUAGE plpgsql;

