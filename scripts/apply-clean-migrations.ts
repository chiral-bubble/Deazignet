import fs from 'fs';

function applyClean() {
    console.log('Applying surgical fixes to original migration files...');

    // --- 038 ---
    let f038 = fs.readFileSync('supabase/migrations/038_us_market_tax_license_updates.sql', 'utf8');

    const notifHeader = `-- Safe enum additions for notification_type
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

-- Ensure notifications table has link column and permissive titles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT;
        BEGIN ALTER TABLE public.notifications ALTER COLUMN title DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER TABLE public.notifications ALTER COLUMN body DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;
`;

    // Safe credentials create without DROP TABLE
    const targetOldCred = `DROP TABLE IF EXISTS public.credentials CASCADE;

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

    const safeCredReplacement = `CREATE TABLE IF NOT EXISTS public.credentials (
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

-- Safely add US-model columns if table pre-existed
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

-- Constraints
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

    f038 = f038.replace(targetOldCred, () => safeCredReplacement);

    // Insurance policies drop guards
    const insPol1 = `CREATE POLICY "Public can view verified insurance" ON public.designer_insurance`;
    f038 = f038.replace(insPol1, () => `DROP POLICY IF EXISTS "Public can view verified insurance" ON public.designer_insurance;\n` + insPol1);

    const insPol2 = `CREATE POLICY "Designers can view and manage own insurance" ON public.designer_insurance`;
    f038 = f038.replace(insPol2, () => `DROP POLICY IF EXISTS "Designers can view and manage own insurance" ON public.designer_insurance;\n` + insPol2);

    const insPol3 = `CREATE POLICY "Admins have full access to insurance" ON public.designer_insurance`;
    f038 = f038.replace(insPol3, () => `DROP POLICY IF EXISTS "Admins have full access to insurance" ON public.designer_insurance;\n` + insPol3);

    // Notifications in 038 with title and body
    f038 = f038.replace(
        `        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',`,
        () => `        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',`
    );

    f038 = f038.replace(
        `        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',`,
        () => `        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',`
    );

    f038 = notifHeader + '\n\n' + f038;
    fs.writeFileSync('supabase/migrations/038_us_market_tax_license_updates.sql', f038, 'utf8');

    // --- 039 ---
    let f039 = fs.readFileSync('supabase/migrations/039_plans_and_platform_fee_tiers.sql', 'utf8');

    // Plans policies drop guards
    const planPol1 = `CREATE POLICY "Anyone can read plans" ON public.plans`;
    f039 = f039.replace(planPol1, () => `DROP POLICY IF EXISTS "Anyone can read plans" ON public.plans;\n` + planPol1);

    const planPol2 = `CREATE POLICY "Admins can manage plans" ON public.plans`;
    f039 = f039.replace(planPol2, () => `DROP POLICY IF EXISTS "Admins can manage plans" ON public.plans;\n` + planPol2);

    const tierPol1 = `CREATE POLICY "Anyone can read plan fee tiers" ON public.plan_fee_tiers`;
    f039 = f039.replace(tierPol1, () => `DROP POLICY IF EXISTS "Anyone can read plan fee tiers" ON public.plan_fee_tiers;\n` + tierPol1);

    const tierPol2 = `CREATE POLICY "Admins can manage fee tiers" ON public.plan_fee_tiers`;
    f039 = f039.replace(tierPol2, () => `DROP POLICY IF EXISTS "Admins can manage fee tiers" ON public.plan_fee_tiers;\n` + tierPol2);

    // Settings values as JSONB
    const oldSettings039 = `INSERT INTO public.app_settings (key, value) VALUES
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

    const newSettings039 = `INSERT INTO public.app_settings (key, value) VALUES
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

    f039 = f039.replace(oldSettings039, () => newSettings039);

    // Settings JSON extraction in 039 functions and view
    f039 = f039.replace(
        `SELECT COALESCE(value, 'whole_amount') INTO v_mode FROM public.app_settings WHERE key = 'fee_tier_mode';`,
        () => `SELECT COALESCE(value #>> '{}', 'whole_amount') INTO v_mode FROM public.app_settings WHERE key = 'fee_tier_mode';`
    );

    f039 = f039.replace(
        `SELECT COALESCE(value, 'per_milestone') INTO v_basis FROM public.app_settings WHERE key = 'fee_basis';`,
        () => `SELECT COALESCE(value #>> '{}', 'per_milestone') INTO v_basis FROM public.app_settings WHERE key = 'fee_basis';`
    );

    f039 = f039.replace(
        `SELECT COALESCE(value, 'development') INTO v_env`,
        () => `SELECT COALESCE(value #>> '{}', 'development') INTO v_env`
    );

    f039 = f039.replace(
        `LEFT(dp.bio, COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars'), 300))`,
        () => `LEFT(dp.bio, COALESCE((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars'), 300))`
    );

    f039 = f039.replace(
        `COALESCE(
        (SELECT value FROM public.app_settings WHERE key = 'basic_account_note'),
        'Basic account: portfolio not available'
    )`,
        () => `COALESCE(
        (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'basic_account_note'),
        'Basic account: portfolio not available'
    )`
    );

    f039 = f039.replace(
        /WHEN \(SELECT value FROM public\.app_settings WHERE key = 'free_show_rating_on_proposals'\) = 'true'/g,
        () => `WHEN (SELECT value #>> '{}' FROM public.app_settings WHERE key = 'free_show_rating_on_proposals') = 'true'`
    );

    fs.writeFileSync('supabase/migrations/039_plans_and_platform_fee_tiers.sql', f039, 'utf8');

    // --- 040 ---
    let f040 = fs.readFileSync('supabase/migrations/040_studio_insights_and_slugs.sql', 'utf8');

    const pol040_1 = `CREATE POLICY "Designers can view own analytics" ON public.designer_analytics_daily`;
    f040 = f040.replace(pol040_1, () => `DROP POLICY IF EXISTS "Designers can view own analytics" ON public.designer_analytics_daily;\n` + pol040_1);

    const pol040_2 = `CREATE POLICY "Admins can view all analytics" ON public.designer_analytics_daily`;
    f040 = f040.replace(pol040_2, () => `DROP POLICY IF EXISTS "Admins can view all analytics" ON public.designer_analytics_daily;\n` + pol040_2);

    const pol040_3 = `CREATE POLICY "Anyone can lookup slug history for redirects" ON public.studio_slug_history`;
    f040 = f040.replace(pol040_3, () => `DROP POLICY IF EXISTS "Anyone can lookup slug history for redirects" ON public.studio_slug_history;\n` + pol040_3);

    const pol040_4 = `CREATE POLICY "Anyone can read reserved slugs" ON public.reserved_slugs`;
    f040 = f040.replace(pol040_4, () => `DROP POLICY IF EXISTS "Anyone can read reserved slugs" ON public.reserved_slugs;\n` + pol040_4);

    fs.writeFileSync('supabase/migrations/040_studio_insights_and_slugs.sql', f040, 'utf8');

    // --- 041 ---
    let f041 = fs.readFileSync('supabase/migrations/041_project_invitations_and_suggestions.sql', 'utf8');

    const invPol1 = `CREATE POLICY "Clients can view invitations for own projects" ON public.project_invitations`;
    f041 = f041.replace(invPol1, () => `DROP POLICY IF EXISTS "Clients can view invitations for own projects" ON public.project_invitations;\n` + invPol1);

    const invPol2 = `CREATE POLICY "Designers can view invitations sent to them" ON public.project_invitations`;
    f041 = f041.replace(invPol2, () => `DROP POLICY IF EXISTS "Designers can view invitations sent to them" ON public.project_invitations;\n` + invPol2);

    const invPol3 = `CREATE POLICY "Admins have full access to invitations" ON public.project_invitations`;
    f041 = f041.replace(invPol3, () => `DROP POLICY IF EXISTS "Admins have full access to invitations" ON public.project_invitations;\n` + invPol3);

    const sugPol1 = `CREATE POLICY "Clients can log suggestion events for own projects" ON public.suggestion_events`;
    f041 = f041.replace(sugPol1, () => `DROP POLICY IF EXISTS "Clients can log suggestion events for own projects" ON public.suggestion_events;\n` + sugPol1);

    const sugPol2 = `CREATE POLICY "Admins can view suggestion events" ON public.suggestion_events`;
    f041 = f041.replace(sugPol2, () => `DROP POLICY IF EXISTS "Admins can view suggestion events" ON public.suggestion_events;\n` + sugPol2);

    // Settings JSONB in 041
    const oldSettings041 = `INSERT INTO public.app_settings (key, value) VALUES
('invitations_per_project_max', '10'),
('invitations_per_client_per_day', '20'),
('invitation_expiry_days', '14'),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 25, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'),
('matching_new_designer_boost', '5'),
('matching_max_active_engagements', '8'),
('matching_require_state_license', 'false')`;

    const newSettings041 = `INSERT INTO public.app_settings (key, value) VALUES
('invitations_per_project_max', '10'::jsonb),
('invitations_per_client_per_day', '20'::jsonb),
('invitation_expiry_days', '14'::jsonb),
('matching_weights', '{"specialization_match": 30, "subcategory_portfolio": 10, "state_license": 25, "same_city": 15, "same_state": 10, "verified": 10, "rating": 10, "completed_projects": 5}'::jsonb),
('matching_new_designer_boost', '5'::jsonb),
('matching_max_active_engagements', '8'::jsonb),
('matching_require_state_license', 'false'::jsonb)`;

    f041 = f041.replace(oldSettings041, () => newSettings041);

    // Notification types table before insert
    const notifTypesBlock = `-- 4. Notification Types Table & Seed
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

    f041 = f041.replace('-- 4. Notification Types Insert\nINSERT INTO public.notification_types (type, title_template, body_template, email_template) VALUES', () => notifTypesBlock);

    // Notification inserts in 041
    f041 = f041.replace(
        `    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',`,
        () => `    INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',
        'Project Invitation',
        'You received an invitation to submit a proposal for ' || v_project.title || '.',`
    );

    f041 = f041.replace(
        `    INSERT INTO public.notifications (user_id, type, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',`,
        () => `    INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',
        'Invitation Declined',
        'A designer declined your project invitation.',`
    );

    f041 = f041.replace(
        `        INSERT INTO public.notifications (user_id, type, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',`,
        () => `        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',
            'Invitation Expired',
            'An invitation for ' || r.project_title || ' has expired.',`
    );

    // Audit log safe block in 041
    const oldAudit041 = `    -- Audit log entry
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'job_expire_invitations',
        'system',
        '00000000-0000-0000-0000-000000000000'::uuid,
        jsonb_build_object('expired_count', v_count)
    );`;

    const safeAudit041 = `    -- Audit log entry (safe exception block)
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

    f041 = f041.replace(oldAudit041, () => safeAudit041);

    // App settings extraction in 041
    f041 = f041.replace(
        `SELECT COALESCE(value::int, 10) INTO v_max_per_project \n    FROM public.app_settings WHERE key = 'invitations_per_project_max';`,
        () => `SELECT COALESCE((value #>> '{}')::int, 10) INTO v_max_per_project \n    FROM public.app_settings WHERE key = 'invitations_per_project_max';`
    );

    f041 = f041.replace(
        `SELECT COALESCE(value::int, 20) INTO v_max_per_client_day \n    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';`,
        () => `SELECT COALESCE((value #>> '{}')::int, 20) INTO v_max_per_client_day \n    FROM public.app_settings WHERE key = 'invitations_per_client_per_day';`
    );

    f041 = f041.replace(
        `SELECT COALESCE(value::int, 14) INTO v_expiry_days \n    FROM public.app_settings WHERE key = 'invitation_expiry_days';`,
        () => `SELECT COALESCE((value #>> '{}')::int, 14) INTO v_expiry_days \n    FROM public.app_settings WHERE key = 'invitation_expiry_days';`
    );

    f041 = f041.replace(
        `SELECT COALESCE(value::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';\n    SELECT COALESCE(value::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';\n    SELECT COALESCE(value::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';`,
        () => `SELECT COALESCE((value #>> '{}')::int, 8) INTO v_max_active FROM public.app_settings WHERE key = 'matching_max_active_engagements';\n    SELECT COALESCE((value #>> '{}')::boolean, false) INTO v_require_state_license FROM public.app_settings WHERE key = 'matching_require_state_license';\n    SELECT COALESCE((value #>> '{}')::int, 5) INTO v_new_boost FROM public.app_settings WHERE key = 'matching_new_designer_boost';`
    );

    f041 = f041.replace(
        `SELECT COALESCE(value, 'label') INTO v_label_mode FROM public.app_settings WHERE key = 'priority_label_mode';`,
        () => `SELECT COALESCE(value #>> '{}', 'label') INTO v_label_mode FROM public.app_settings WHERE key = 'priority_label_mode';`
    );

    fs.writeFileSync('supabase/migrations/041_project_invitations_and_suggestions.sql', f041, 'utf8');

    // Combine all 4 files
    const combined = [
        '-- ==============================================================================',
        '-- DEZIGNET SUPABASE CONSOLIDATED MIGRATION - US MARKET, PLANS, STUDIO & INVITATIONS',
        '-- ==============================================================================\n',
        f038,
        '\n-- ==============================================================================',
        '-- PART 2: PLANS & TIERED PLATFORM FEES',
        '-- ==============================================================================\n',
        f039,
        '\n-- ==============================================================================',
        '-- PART 3: STUDIO INSIGHTS & SLUGS',
        '-- ==============================================================================\n',
        f040,
        '\n-- ==============================================================================',
        '-- PART 4: PROJECT INVITATIONS & DESIGNER SUGGESTIONS',
        '-- ==============================================================================\n',
        f041
    ].join('\n');

    fs.writeFileSync('supabase/migrations/038_through_041_us_plans_invitations_all.sql', combined, 'utf8');
    console.log('Clean surgical migrations generated successfully!');
}

applyClean();
