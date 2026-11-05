import fs from 'fs';
import path from 'path';

function buildCombinedMigration() {
    console.log('Building clean 038-041 migrations...');

    const header = `-- ==============================================================================
-- DEZIGNET SUPABASE CONSOLIDATED MIGRATION - US MARKET, PLANS, STUDIO & INVITATIONS
-- Combined 038_us_market_tax_license_updates.sql
--          039_plans_and_platform_fee_tiers.sql
--          040_studio_insights_and_slugs.sql
--          041_project_invitations_and_suggestions.sql
-- ==============================================================================

-- Safe enum additions for notification_type
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

    // Process 038
    let f038 = fs.readFileSync('supabase/migrations/038_us_market_tax_license_updates.sql', 'utf8');
    // Ensure safe credentials creation without DROP TABLE
    const credOld = /-- 7\. US Professional Credentials Table[\s\S]*?-- Trigger: protect review fields and reset status on edit/;
    const credSafe = `-- 7. US Professional Credentials Table (Idempotent schema)
CREATE TABLE IF NOT EXISTS public.credentials (
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
END $$;

CREATE INDEX IF NOT EXISTS idx_credentials_designer_id ON public.credentials(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(designer_id, status);
CREATE INDEX IF NOT EXISTS idx_credentials_issuing_state ON public.credentials(issuing_state);

-- Trigger: protect review fields and reset status on edit`;

    f038 = f038.replace(credOld, credSafe);

    // Notification inserts in 038
    f038 = f038.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*r\.designer_id,\s*'credential_expired',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',`
    );

    f038 = f038.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*r\.designer_id,\s*'credential_expiring',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',`
    );

    // Write updated 038
    fs.writeFileSync('supabase/migrations/038_us_market_tax_license_updates.sql', f038, 'utf8');

    // Process 039
    let f039 = fs.readFileSync('supabase/migrations/039_plans_and_platform_fee_tiers.sql', 'utf8');
    f039 = f039.replace(
        "SELECT COALESCE(value, 'development') INTO v_env",
        "SELECT COALESCE(value #>> '{}', 'development') INTO v_env"
    );
    f039 = f039.replace(
        "('fee_tier_mode', 'whole_amount'),",
        "('fee_tier_mode', '\"whole_amount\"'::jsonb),"
    );
    f039 = f039.replace(
        "('fee_basis', 'per_milestone'),",
        "('fee_basis', '\"per_milestone\"'::jsonb),"
    );
    f039 = f039.replace(
        "('basic_account_note', 'Basic account: portfolio not available'),",
        "('basic_account_note', '\"Basic account: portfolio not available\"'::jsonb),"
    );
    f039 = f039.replace(
        "('priority_label_mode', 'label'),",
        "('priority_label_mode', '\"label\"'::jsonb),"
    );
    f039 = f039.replace(
        "('verified_badge_requires_paid_plan', 'true'),",
        "('verified_badge_requires_paid_plan', 'true'::jsonb),"
    );
    f039 = f039.replace(
        "('free_show_rating_on_proposals', 'true'),",
        "('free_show_rating_on_proposals', 'true'::jsonb),"
    );
    f039 = f039.replace(
        "('free_proposal_bio_max_chars', '300'),",
        "('free_proposal_bio_max_chars', '300'::jsonb),"
    );
    f039 = f039.replace(
        "('matching_plan_boost', '{\"free\": 0, \"basic\": 5, \"upgraded\": 15}'),",
        "('matching_plan_boost', '{\"free\": 0, \"basic\": 5, \"upgraded\": 15}'::jsonb),"
    );
    f039 = f039.replace(
        "('client_service_fee_percent', '0'),",
        "('client_service_fee_percent', '0'::jsonb),"
    );
    f039 = f039.replace(
        "('client_deposit_percent', 'null')",
        "('client_deposit_percent', 'null'::jsonb)"
    );

    // Coalesce fix in view
    f039 = f039.replace(
        "(SELECT value FROM public.app_settings WHERE key = 'basic_account_note')",
        "(SELECT value #>> '{}' FROM public.app_settings WHERE key = 'basic_account_note')"
    );
    f039 = f039.replace(
        "(SELECT value FROM public.app_settings WHERE key = 'free_show_rating_on_proposals')",
        "(SELECT value #>> '{}' FROM public.app_settings WHERE key = 'free_show_rating_on_proposals')"
    );
    f039 = f039.replace(
        "(SELECT value::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars')",
        "(SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'free_proposal_bio_max_chars')"
    );
    fs.writeFileSync('supabase/migrations/039_plans_and_platform_fee_tiers.sql', f039, 'utf8');

    // Process 040
    let f040 = fs.readFileSync('supabase/migrations/040_studio_insights_and_slugs.sql', 'utf8');
    fs.writeFileSync('supabase/migrations/040_studio_insights_and_slugs.sql', f040, 'utf8');

    // Process 041
    let f041 = fs.readFileSync('supabase/migrations/041_project_invitations_and_suggestions.sql', 'utf8');
    // Audit log safe block in 041
    const auditLogTarget = `    -- Audit log entry
    INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
    VALUES (
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
        'job_expire_invitations',
        'system',
        '00000000-0000-0000-0000-000000000000'::uuid,
        jsonb_build_object('expired_count', v_count)
    );`;

    const auditLogSafe = `    -- Audit log entry (safe exception block)
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

    f041 = f041.replace(auditLogTarget, auditLogSafe);

    // Notification inserts in 041
    f041 = f041.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*p_designer_id,\s*'invitation_received',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',
        'Project Invitation',
        'You received an invitation to submit a proposal for ' || v_project.title || '.',`
    );

    f041 = f041.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*v_inv\.client_id,\s*'invitation_declined',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',
        'Invitation Declined',
        'A designer declined your project invitation.',`
    );

    f041 = f041.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*r\.client_id,\s*'invitation_expired',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',
            'Invitation Expired',
            'An invitation for ' || r.project_title || ' has expired.',`
    );
    fs.writeFileSync('supabase/migrations/041_project_invitations_and_suggestions.sql', f041, 'utf8');

    // Combine all 4 into 038_through_041
    let combined = header + '\n\n' + f038 + '\n\n' + f039 + '\n\n' + f040 + '\n\n' + f041;

    // Apply policy drops across combined
    const policies: [string, string][] = [
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
        ['Admins can view suggestion events', 'public.suggestion_events'],
        ['Anyone can read notification types', 'public.notification_types']
    ];

    for (const [polName, tabName] of policies) {
        const createPol = `CREATE POLICY "${polName}" ON ${tabName}`;
        const dropPol = `DROP POLICY IF EXISTS "${polName}" ON ${tabName};\n`;
        if (combined.includes(createPol) && !combined.includes(dropPol + createPol)) {
            combined = combined.split(createPol).join(dropPol + createPol);
        }
    }

    fs.writeFileSync('supabase/migrations/038_through_041_us_plans_invitations_all.sql', combined, 'utf8');
    console.log('Successfully generated clean combined migration!');
}

buildCombinedMigration();
