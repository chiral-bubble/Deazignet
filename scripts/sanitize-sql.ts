import fs from 'fs';
import path from 'path';

function sanitizeFile(relPath: string) {
    const filePath = path.resolve(relPath);
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Notification enum values & notification table safe link/title column at the top
    const notifHelper = `-- Safe enum additions for notification_type
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

    if (!content.includes("ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'credential_expiring'")) {
        content = notifHelper + '\n' + content;
    }

    // 2. Safe credentials table replacement
    const targetCredDrop = "DROP TABLE IF EXISTS public.credentials CASCADE;";
    if (content.includes(targetCredDrop)) {
        const safeCred = `-- 7. US Professional Credentials Table (Safe idempotent create & column migration)
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
`;

        // Replace from DROP TABLE down to the CREATE TABLE closing parenthesis
        const credBlockRegex = /DROP TABLE IF EXISTS public\.credentials CASCADE;[\s\S]*?CREATE TABLE public\.credentials \([\s\S]*?CONSTRAINT credentials_issuing_state_check CHECK[^\)]+\)[\s\S]*?\);/;
        if (credBlockRegex.test(content)) {
            content = content.replace(credBlockRegex, safeCred);
        }
    }

    // 3. Fix environment setting in switch_designer_plan
    content = content.replace(
        "SELECT COALESCE(value, 'development') INTO v_env",
        "SELECT COALESCE(value #>> '{}', 'development') INTO v_env"
    );

    // 4. Update notification inserts to include title and body
    content = content.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*r\.designer_id,\s*'credential_expired',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',`
    );

    content = content.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*r\.designer_id,\s*'credential_expiring',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',`
    );

    content = content.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*p_designer_id,\s*'invitation_received',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        p_designer_id,
        'invitation_received',
        'Project Invitation',
        'You received an invitation to submit a proposal for ' || v_project.title || '.',`
    );

    content = content.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*v_inv\.client_id,\s*'invitation_declined',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
    VALUES (
        v_inv.client_id,
        'invitation_declined',
        'Invitation Declined',
        'A designer declined your project invitation.',`
    );

    content = content.replace(
        /INSERT INTO public\.notifications \(user_id, type, data, link\)\s*VALUES \(\s*r\.client_id,\s*'invitation_expired',/g,
        `INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.client_id,
            'invitation_expired',
            'Invitation Expired',
            'An invitation for ' || r.project_title || ' has expired.',`
    );

    // 5. Ensure DROP POLICY IF EXISTS before all policies
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
        // Deduplicate duplicate drops if any
        content = content.split(dropPol + dropPol).join(dropPol);
        if (content.includes(createPol) && !content.includes(dropPol + createPol)) {
            content = content.replace(createPol, dropPol + createPol);
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Sanitization complete for ${relPath}`);
}

sanitizeFile('supabase/migrations/038_through_041_us_plans_invitations_all.sql');
sanitizeFile('supabase/migrations/038_us_market_tax_license_updates.sql');
