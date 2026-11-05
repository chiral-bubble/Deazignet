import fs from 'fs';

function run() {
    const filePath = 'supabase/migrations/038_through_041_us_plans_invitations_all.sql';
    let sql = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

    // 1. Top enum and notification table helper
    const topHelper = `-- Safe enum additions for notification_type
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'credential_expiring'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'credential_expired'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'invitation_received'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'invitation_declined'; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'invitation_expired'; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
        BEGIN ALTER TABLE public.notifications ALTER COLUMN title DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TABLE public.notifications ALTER COLUMN body DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;
\n`;

    sql = topHelper + sql;

    // 2. Credentials table safe create & alter
    const oldCredBlock = `DROP TABLE IF EXISTS public.credentials CASCADE;

CREATE TABLE public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    license_type TEXT NOT NULL,
    issuing_state TEXT NOT NULL,
    license_number TEXT NOT NULL,
    issue_year INTEGER CHECK (issue_year IS NULL OR (issue_year >= 1950 AND issue_year <= 2100)),
    expiration_date DATE,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT credentials_license_type_check CHECK (license_type IN ('architect', 'professional_engineer', 'landscape_architect', 'interior_designer', 'other')),
    CONSTRAINT credentials_issuing_state_check CHECK (issuing_state ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$')
);`;

    const newCredBlock = `CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    license_type TEXT NOT NULL DEFAULT 'other',
    issuing_state TEXT NOT NULL DEFAULT 'CA',
    license_number TEXT NOT NULL DEFAULT '',
    issue_year INTEGER CHECK (issue_year IS NULL OR (issue_year >= 1950 AND issue_year <= 2100)),
    expiration_date DATE,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS license_type TEXT DEFAULT 'other';
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS issuing_state TEXT DEFAULT 'CA';
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS license_number TEXT DEFAULT '';
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS issue_year INTEGER;
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS certificate_file TEXT;
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS status public.credential_status NOT NULL DEFAULT 'pending';
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.credentials ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_license_type_check') THEN
        ALTER TABLE public.credentials ADD CONSTRAINT credentials_license_type_check CHECK (license_type IN ('architect', 'professional_engineer', 'landscape_architect', 'interior_designer', 'other'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'credentials_issuing_state_check') THEN
        ALTER TABLE public.credentials ADD CONSTRAINT credentials_issuing_state_check CHECK (issuing_state ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$');
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;`;

    if (!sql.includes(oldCredBlock)) {
        console.error('ERROR: oldCredBlock not found!');
        process.exit(1);
    }
    sql = sql.split(oldCredBlock).join(newCredBlock);

    // 3. App Settings JSONB in Section 2 (Plans)
    const oldSettingsPlans = `INSERT INTO public.app_settings (key, value) VALUES
('fee_tier_mode', 'whole_amount'),
('fee_basis', 'per_milestone'),
('verified_badge_requires_paid_plan', 'true'),
('free_show_rating_on_proposals', 'true'),
('free_proposal_bio_max_chars', '300'),
('basic_account_note', 'Basic account: portfolio not available'),
('matching_plan_boost', '{"free": 0, "basic": 5, "upgraded": 15}'),
('priority_label_mode', 'label'),
('client_service_fee_percent', '0'),
('client_deposit_percent', 'null')`;

    const newSettingsPlans = `INSERT INTO public.app_settings (key, value) VALUES
('fee_tier_mode', '"whole_amount"'::jsonb),
('fee_basis', '"per_milestone"'::jsonb),
('verified_badge_requires_paid_plan', 'true'::jsonb),
('free_show_rating_on_proposals', 'true'::jsonb),
('free_proposal_bio_max_chars', '300'::jsonb),
('basic_account_note', '"Basic account: portfolio not available"'::jsonb),
('matching_plan_boost', '{"free": 0, "basic": 5, "upgraded": 15}'::jsonb),
('priority_label_mode', '"label"'::jsonb),
('client_service_fee_percent', '0'::jsonb),
('client_deposit_percent', 'null'::jsonb)`;

    if (!sql.includes(oldSettingsPlans)) {
        console.error('ERROR: oldSettingsPlans not found!');
        process.exit(1);
    }
    sql = sql.split(oldSettingsPlans).join(newSettingsPlans);

    // 4. JSON extraction in fee calculations & dev switch
    sql = sql.split("SELECT COALESCE(value, 'whole_amount') INTO v_mode FROM public.app_settings WHERE key = 'fee_tier_mode';")
             .join("SELECT COALESCE(value #>> '{}', 'whole_amount') INTO v_mode FROM public.app_settings WHERE key = 'fee_tier_mode';");

    sql = sql.split("SELECT COALESCE(value, 'per_milestone') INTO v_basis FROM public.app_settings WHERE key = 'fee_basis';")
             .join("SELECT COALESCE(value #>> '{}', 'per_milestone') INTO v_basis FROM public.app_settings WHERE key = 'fee_basis';");

    sql = sql.split("SELECT COALESCE(value, 'development') INTO v_env")
             .join("SELECT COALESCE(value #>> '{}', 'development') INTO v_env");

    // 5. proposal_designer_cards view JSON extraction
    sql = sql.split("LEFT(dp.bio, COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars'), 300))")
             .join("LEFT(dp.bio, COALESCE((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars'), 300))");

    sql = sql.split(`COALESCE(
        (SELECT value FROM public.app_settings WHERE key = 'basic_account_note'),
        'Basic account: portfolio not available'
    )`)
             .join(`COALESCE(
        (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'basic_account_note'),
        'Basic account: portfolio not available'
    )`);

    sql = sql.split("WHEN (SELECT value FROM public.app_settings WHERE key = 'free_show_rating_on_proposals') = 'true'")
             .join("WHEN (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'free_show_rating_on_proposals') = 'true'");

    // 6. App settings in invitations
    const oldSettingsInv = `INSERT INTO public.app_settings (key, value) VALUES
('invitations_per_project_max', '10'),
('invitations_per_client_per_day', '20'),
('invitation_expiry_days', '14'),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 25, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'),
('matching_new_designer_boost', '5'),
('matching_max_active_engagements', '8'),
('matching_require_state_license', 'false')`;

    const newSettingsInv = `INSERT INTO public.app_settings (key, value) VALUES
('invitations_per_project_max', '10'::jsonb),
('invitations_per_client_per_day', '20'::jsonb),
('invitation_expiry_days', '14'::jsonb),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 25, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'::jsonb),
('matching_new_designer_boost', '5'::jsonb),
('matching_max_active_engagements', '8'::jsonb),
('matching_require_state_license', 'false'::jsonb)`;

    if (!sql.includes(oldSettingsInv)) {
        console.error('ERROR: oldSettingsInv not found!');
        process.exit(1);
    }
    sql = sql.split(oldSettingsInv).join(newSettingsInv);

    // 7. Notification types table before insert
    const oldNotifTypes = `-- 4. Notification Types Insert
INSERT INTO public.notification_types (type, title_template, body_template, email_template) VALUES`;

    const newNotifTypes = `-- 4. Notification Types Table & Seed
CREATE TABLE IF NOT EXISTS public.notification_types (
    type TEXT PRIMARY KEY,
    title_template TEXT NOT NULL,
    body_template TEXT NOT NULL,
    email_template TEXT
);

ALTER TABLE public.notification_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read notification types" ON public.notification_types;
CREATE POLICY "Anyone can read notification types" ON public.notification_types
    FOR SELECT TO authenticated, anon
    USING (true);

INSERT INTO public.notification_types (type, title_template, body_template, email_template) VALUES`;

    if (!sql.includes(oldNotifTypes)) {
        console.error('ERROR: oldNotifTypes not found!');
        process.exit(1);
    }
    sql = sql.split(oldNotifTypes).join(newNotifTypes);

    // 8. Extraction in invite_designer & suggest_designers
    sql = sql.split("SELECT COALESCE(value::int, 10) INTO v_max_per_project \n    FROM public.app_settings WHERE key = 'invitations_per_project_max';")
             .join("SELECT COALESCE((value #>> '{}')::int, 10) INTO v_max_per_project \n    FROM public.app_settings WHERE key = 'invitations_per_project_max';");

    sql = sql.split("SELECT COALESCE(value::int, 20) INTO v_max_per_client_day \n    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';")
             .join("SELECT COALESCE((value #>> '{}')::int, 20) INTO v_max_per_client_day \n    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';");

    sql = sql.split("SELECT COALESCE(value::int, 14) INTO v_expiry_days \n    FROM public.app_settings WHERE key = 'invitation_expiry_days';")
             .join("SELECT COALESCE((value #>> '{}')::int, 14) INTO v_expiry_days \n    FROM public.app_settings WHERE key = 'invitation_expiry_days';");

    sql = sql.split(`    SELECT COALESCE(value::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';
    SELECT COALESCE(value::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';
    SELECT COALESCE(value::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';`)
             .join(`    SELECT COALESCE((value #>> '{}')::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';
    SELECT COALESCE((value #>> '{}')::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';
    SELECT COALESCE((value #>> '{}')::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';`);

    sql = sql.split("SELECT COALESCE(value, 'label') INTO v_label_mode FROM public.app_settings WHERE key = 'priority_label_mode';")
             .join("SELECT COALESCE(value #>> '{}', 'label') INTO v_label_mode FROM public.app_settings WHERE key = 'priority_label_mode';");

    // 9. Notifications insert with title & body
    sql = sql.split(`        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',`)
             .join(`        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',`);

    sql = sql.split(`        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',`)
             .join(`        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',`);

    sql = sql.split(`    -- 6. Send notification to designer
    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',`)
             .join(`    -- 6. Send notification to designer
    INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',
        'Project Invitation',
        'You received an invitation to submit a proposal for ' || v_project.title || '.',`);

    sql = sql.split(`    -- Notify client
    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',`)
             .join(`    -- Notify client
    INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',
        'Invitation Declined',
        'A designer declined your project invitation.',`);

    sql = sql.split(`        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',`)
             .join(`        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',
            'Invitation Expired',
            'An invitation for ' || r.project_title || ' has expired.',`);

    // 10. Audit log safe block in expire_invitations
    const oldAudit = `    -- Audit log entry
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'job_expire_invitations',
        'system',
        '00000000-0000-0000-0000-000000000000'::uuid,
        jsonb_build_object('expired_count', v_count)
    );`;

    const newAudit = `    -- Audit log entry (safe exception block)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_audit_log') THEN
        BEGIN
            INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, after_state)
            VALUES (
                auth.uid(),
                'job_expire_invitations',
                'system',
                '00000000-0000-0000-0000-000000000000',
                jsonb_build_object('expired_count', v_count)
            );
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;`;

    if (!sql.includes(oldAudit)) {
        console.error('ERROR: oldAudit not found!');
        process.exit(1);
    }
    sql = sql.split(oldAudit).join(newAudit);

    // 11. DROP POLICY IF EXISTS before all policies
    const policies = [
        ['Public can view verified insurance', 'public.designer_insurance'],
        ['Designers can view and manage own insurance', 'public.designer_insurance'],
        ['Admins have full access to insurance', 'public.designer_insurance'],
        ['Anyone can read plans', 'public.plans'],
        ['Admins can manage plans', 'public.plans'],
        ['Anyone can read plan fee tiers', 'public.plan_fee_tiers'],
        ['Admins can manage fee tiers', 'public.plan_fee_tiers'],
        ['Designers can view own analytics', 'public.designer_analytics_daily'],
        ['Admins can view all analytics', 'public.designer_analytics_daily'],
        ['Anyone can lookup slug history for redirects', 'public.studio_slug_history'],
        ['Anyone can read reserved slugs', 'public.reserved_slugs'],
        ['Clients can view invitations for own projects', 'public.project_invitations'],
        ['Designers can view invitations sent to them', 'public.project_invitations'],
        ['Admins have full access to invitations', 'public.project_invitations'],
        ['Clients can log suggestion events for own projects', 'public.suggestion_events'],
        ['Admins can view suggestion events', 'public.suggestion_events']
    ];

    for (const [polName, tabName] of policies) {
        const createPol = `CREATE POLICY "${polName}" ON ${tabName}`;
        const dropPol = `DROP POLICY IF EXISTS "${polName}" ON ${tabName};\n`;
        if (sql.includes(createPol)) {
            sql = sql.split(createPol).join(dropPol + createPol);
        }
    }

    fs.writeFileSync(filePath, sql, 'utf8');
    console.log('EXACT FIX COMPLETED SUCCESSFULLY!');
}

run();
