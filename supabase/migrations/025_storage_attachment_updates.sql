-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 025_storage_attachment_updates.sql
-- Relate tables to files.id & Update attach functions (Milestone, Chat, Profile)
-- ==============================================================================

-- 1. Alter Existing Tables to Reference files(id)
ALTER TABLE public.submission_files
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submission_files_file_id ON public.submission_files(file_id);

ALTER TABLE public.message_attachments
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_message_attachments_file_id ON public.message_attachments(file_id);

ALTER TABLE public.portfolio_images
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_images_file_id ON public.portfolio_images(file_id);

ALTER TABLE public.credentials
    ADD COLUMN IF NOT EXISTS certificate_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credentials_certificate_file_id ON public.credentials(certificate_file_id);

ALTER TABLE public.project_images
    ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_images_file_id ON public.project_images(file_id);

-- ------------------------------------------------------------------------------
-- 2. Update submit_milestone to accept files.id
-- ------------------------------------------------------------------------------
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
    v_item JSONB;
    v_file_id UUID;
    v_file RECORD;
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
    IF v_eng.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only the assigned designer can submit deliverables.' USING ERRCODE = '42501';
    END IF;

    IF v_ms.status NOT IN ('funded'::public.milestone_status, 'in_progress'::public.milestone_status, 'revision_requested'::public.milestone_status) THEN
        RAISE EXCEPTION 'Milestone is not in a submittable status (current: %).', v_ms.status USING ERRCODE = 'P0001';
    END IF;

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

    -- Process attached files
    IF p_files IS NOT NULL AND jsonb_array_length(p_files) > 0 THEN
        IF jsonb_array_length(p_files) > 10 THEN
            RAISE EXCEPTION 'Maximum 10 deliverable files per submission.' USING ERRCODE = 'P0001';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_files) LOOP
            -- Determine if item is UUID string or object with file_id / id
            IF jsonb_typeof(v_item) = 'string' THEN
                v_file_id := (v_item#>>'{}')::UUID;
            ELSE
                v_file_id := COALESCE(v_item->>'file_id', v_item->>'id')::UUID;
            END IF;

            IF v_file_id IS NOT NULL THEN
                SELECT * INTO v_file FROM public.files WHERE id = v_file_id;
                IF v_file.id IS NULL THEN
                    RAISE EXCEPTION 'File % not found.' , v_file_id USING ERRCODE = 'P0002';
                END IF;

                IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
                    RAISE EXCEPTION 'Cannot attach file belonging to another user.' USING ERRCODE = '42501';
                END IF;

                IF v_file.purpose <> 'deliverable' THEN
                    RAISE EXCEPTION 'File % was not uploaded for deliverable purpose.', v_file.original_name
                        USING HINT = 'invalid_file', ERRCODE = 'P0001';
                END IF;

                IF v_file.status IN ('infected'::public.file_status, 'rejected'::public.file_status) THEN
                    RAISE EXCEPTION 'Cannot attach file %: failed security scan.', v_file.original_name
                        USING HINT = 'scan_failed', ERRCODE = 'P0001';
                END IF;

                IF v_file.attached_at IS NOT NULL AND v_file.submission_id IS NOT NULL AND v_file.submission_id <> v_sub_id THEN
                    RAISE EXCEPTION 'File % is already attached to another submission.', v_file.original_name
                        USING HINT = 'invalid_file', ERRCODE = 'P0001';
                END IF;

                -- Insert into submission_files
                INSERT INTO public.submission_files (
                    submission_id,
                    file_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_sub_id,
                    v_file.id,
                    v_file.path,
                    v_file.original_name,
                    v_file.size_bytes,
                    v_file.mime_type
                );

                -- Mark file as permanently attached and immutable
                UPDATE public.files
                SET
                    attached_at = timezone('utc'::text, now()),
                    milestone_id = v_ms.id,
                    submission_id = v_sub_id
                WHERE id = v_file.id;
            ELSE
                -- Legacy support for raw path submission (test suites)
                INSERT INTO public.submission_files (
                    submission_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_sub_id,
                    v_item->>'path',
                    COALESCE(v_item->>'file_name', 'deliverable.pdf'),
                    COALESCE((v_item->>'size_bytes')::BIGINT, 1048576),
                    COALESCE(v_item->>'mime_type', 'application/pdf')
                );
            END IF;
        END LOOP;
    END IF;

    -- Update milestone status
    UPDATE public.engagement_milestones
    SET
        status = 'submitted'::public.milestone_status,
        submitted_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_ms.id;

    -- Log engagement event
    PERFORM public.log_engagement_event(
        v_eng.id,
        v_caller_id,
        'deliverable_submitted',
        v_ms.id,
        jsonb_build_object(
            'version', v_new_ver,
            'submission_id', v_sub_id,
            'files_count', COALESCE(jsonb_array_length(p_files), 0)
        )
    );

    -- Notify client
    PERFORM public.create_notification(
        v_eng.client_id,
        'deliverable_submitted'::public.notification_type,
        'Deliverable submitted for ' || v_ms.name,
        'Designer submitted Version ' || v_new_ver || ' for review.',
        jsonb_build_object('milestone_id', v_ms.id, 'engagement_id', v_eng.id, 'version', v_new_ver)
    );

    RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. Update send_message to accept files.id
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
    v_item JSONB;
    v_file_id UUID;
    v_file RECORD;
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

    -- Participation check
    IF v_caller_id <> v_conv.client_id AND v_caller_id <> v_conv.designer_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only conversation participants can send messages.' USING ERRCODE = '42501';
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

    -- Compute content flag
    v_flagged := public.check_message_flagged(p_body);

    -- Insert message
    INSERT INTO public.messages (
        conversation_id,
        sender_id,
        kind,
        body,
        flagged
    )
    VALUES (
        p_conversation_id,
        v_caller_id,
        'user',
        p_body,
        v_flagged
    )
    RETURNING id INTO v_msg_id;

    -- Attachments
    IF p_attachments IS NOT NULL AND jsonb_array_length(p_attachments) > 0 THEN
        IF jsonb_array_length(p_attachments) > 10 THEN
            RAISE EXCEPTION 'Maximum 10 attachments per message.' USING ERRCODE = 'P0001';
        END IF;

        FOR v_item IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
            IF jsonb_typeof(v_item) = 'string' THEN
                v_file_id := (v_item#>>'{}')::UUID;
            ELSE
                v_file_id := COALESCE(v_item->>'file_id', v_item->>'id')::UUID;
            END IF;

            IF v_file_id IS NOT NULL THEN
                SELECT * INTO v_file FROM public.files WHERE id = v_file_id;
                IF v_file.id IS NULL THEN
                    RAISE EXCEPTION 'File % not found.' , v_file_id USING ERRCODE = 'P0002';
                END IF;

                IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
                    RAISE EXCEPTION 'Cannot attach file belonging to another user.' USING ERRCODE = '42501';
                END IF;

                IF v_file.purpose NOT IN ('chat_attachment', 'deliverable') THEN
                    RAISE EXCEPTION 'File % has wrong purpose for chat attachment.', v_file.original_name
                        USING HINT = 'invalid_file', ERRCODE = 'P0001';
                END IF;

                IF v_file.status IN ('infected'::public.file_status, 'rejected'::public.file_status) THEN
                    RAISE EXCEPTION 'Cannot attach file %: failed security scan.', v_file.original_name
                        USING HINT = 'scan_failed', ERRCODE = 'P0001';
                END IF;

                INSERT INTO public.message_attachments (
                    message_id,
                    file_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_msg_id,
                    v_file.id,
                    v_file.path,
                    v_file.original_name,
                    v_file.size_bytes,
                    v_file.mime_type
                );

                UPDATE public.files
                SET
                    attached_at = v_now,
                    conversation_id = p_conversation_id
                WHERE id = v_file.id;
            ELSE
                -- Legacy support for raw path attachments
                INSERT INTO public.message_attachments (
                    message_id,
                    path,
                    file_name,
                    size_bytes,
                    mime_type
                )
                VALUES (
                    v_msg_id,
                    v_item->>'path',
                    COALESCE(v_item->>'file_name', 'attachment'),
                    COALESCE((v_item->>'size_bytes')::BIGINT, 1048576),
                    v_item->>'mime_type'
                );
            END IF;
        END LOOP;
    END IF;

    -- Update conversation preview and timestamp
    UPDATE public.conversations
    SET
        last_message_at = v_now,
        last_message_preview = substring(p_body from 1 for 120)
    WHERE id = p_conversation_id;

    -- Update sender's last_read_at
    INSERT INTO public.conversation_user_settings (conversation_id, user_id, last_read_at)
    VALUES (p_conversation_id, v_caller_id, v_now)
    ON CONFLICT (conversation_id, user_id) DO UPDATE
    SET last_read_at = v_now;

    -- Notify recipient
    v_recipient_id := CASE WHEN v_caller_id = v_conv.client_id THEN v_conv.designer_id ELSE v_conv.client_id END;

    PERFORM public.create_notification(
        v_recipient_id,
        'message_received'::public.notification_type,
        'New message received',
        substring(p_body from 1 for 100),
        jsonb_build_object('conversation_id', p_conversation_id, 'sender_id', v_caller_id)
    );

    RETURN v_msg_id;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 4. Helper Attachment Functions (Avatar, Portfolio, Credentials)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_avatar(p_file_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_file RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;

    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    IF v_file.purpose <> 'avatar' THEN
        RAISE EXCEPTION 'File purpose must be avatar.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    IF v_file.status <> 'clean' THEN
        RAISE EXCEPTION 'File must be clean before setting as avatar.' USING HINT = 'file_not_ready', ERRCODE = 'P0001';
    END IF;

    UPDATE public.designer_profiles
    SET avatar_path = v_file.path, updated_at = timezone('utc'::text, now())
    WHERE user_id = v_caller_id;

    UPDATE public.files
    SET attached_at = timezone('utc'::text, now())
    WHERE id = p_file_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.attach_credential_certificate(
    p_credential_id UUID,
    p_file_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID;
    v_cred RECORD;
    v_file RECORD;
BEGIN
    v_caller_id := (SELECT auth.uid());
    SELECT * INTO v_cred FROM public.credentials WHERE id = p_credential_id;
    IF v_cred.id IS NULL THEN
        RAISE EXCEPTION 'Credential not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_cred.designer_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_file FROM public.files WHERE id = p_file_id;
    IF v_file.id IS NULL THEN
        RAISE EXCEPTION 'File not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_file.owner_id <> v_caller_id AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized.' USING ERRCODE = '42501';
    END IF;

    IF v_file.purpose <> 'certificate' THEN
        RAISE EXCEPTION 'File purpose must be certificate.' USING HINT = 'invalid_file', ERRCODE = 'P0001';
    END IF;

    IF v_file.status <> 'clean' THEN
        RAISE EXCEPTION 'File must be clean before attaching.' USING HINT = 'file_not_ready', ERRCODE = 'P0001';
    END IF;

    UPDATE public.credentials
    SET
        certificate_path = v_file.path,
        certificate_file_id = v_file.id,
        updated_at = timezone('utc'::text, now())
    WHERE id = p_credential_id;

    UPDATE public.files
    SET
        attached_at = timezone('utc'::text, now()),
        credential_id = p_credential_id
    WHERE id = p_file_id;
END;
$$ LANGUAGE plpgsql;

