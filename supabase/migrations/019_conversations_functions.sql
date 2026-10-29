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

