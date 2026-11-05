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

-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - US MARKET CONVERSION & LICENSING
-- 038_us_market_tax_license_updates.sql
-- US States, Tax Info Status, US Professional Credentials, Insurance, Categories
-- ==============================================================================

-- 1. US State 2-letter Domain
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'us_state_code') THEN
        CREATE DOMAIN public.us_state_code AS TEXT
        CHECK (VALUE ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$');
    END IF;
END $$;

-- 2. Add 'expired' to credential_status if not present
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.credential_status'::regtype AND enumlabel = 'expired'
    ) THEN
        ALTER TYPE public.credential_status ADD VALUE 'expired';
    END IF;
END $$;

-- 3. Profiles updates: time_zone, tax_info_status, plan_key
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'America/New_York',
    ADD COLUMN IF NOT EXISTS tax_info_status TEXT NOT NULL DEFAULT 'not_provided',
    ADD COLUMN IF NOT EXISTS plan_key TEXT NOT NULL DEFAULT 'free';

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tax_info_status_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_tax_info_status_check
            CHECK (tax_info_status IN ('not_provided', 'provided'));
    END IF;
END $$;

-- 4. Designer profiles updates: city, state, zip_code, accepts_invitations
ALTER TABLE public.designer_profiles
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS zip_code TEXT,
    ADD COLUMN IF NOT EXISTS accepts_invitations BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS studio_slug TEXT,
    ADD COLUMN IF NOT EXISTS studio_slug_updated_at TIMESTAMPTZ;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'designer_profiles_zip_code_check'
    ) THEN
        ALTER TABLE public.designer_profiles
            ADD CONSTRAINT designer_profiles_zip_code_check
            CHECK (zip_code IS NULL OR zip_code ~ '^\d{5}(-\d{4})?$');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'designer_profiles_state_check'
    ) THEN
        ALTER TABLE public.designer_profiles
            ADD CONSTRAINT designer_profiles_state_check
            CHECK (state IS NULL OR state ~ '^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$');
    END IF;
END $$;

-- 5. Projects updates: permit jurisdiction, HOA/historic district, ZIP code
ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS permit_jurisdiction TEXT,
    ADD COLUMN IF NOT EXISTS hoa_or_historic_district TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS zip_code TEXT;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_hoa_district_check'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_hoa_district_check
            CHECK (hoa_or_historic_district IS NULL OR hoa_or_historic_district IN ('yes', 'no', 'unsure'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_zip_code_check'
    ) THEN
        ALTER TABLE public.projects
            ADD CONSTRAINT projects_zip_code_check
            CHECK (zip_code IS NULL OR zip_code ~ '^\d{5}(-\d{4})?$');
    END IF;
END $$;

-- Populate state on projects from state_region if 2 letters
UPDATE public.projects 
SET state = UPPER(state_region)
WHERE state IS NULL AND state_region ~* '^[a-z]{2}$';

-- 6. Proposals updates: license acknowledgement
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS license_acknowledgement BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS license_acknowledgement_text TEXT;

-- 7. US Professional Credentials Table (Idempotent schema)
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

-- Trigger: protect review fields and reset status on edit
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
            NEW.license_type IS DISTINCT FROM OLD.license_type OR
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

DROP TRIGGER IF EXISTS trg_credential_ownership_reset ON public.credentials;
CREATE TRIGGER trg_credential_ownership_reset
    BEFORE INSERT OR UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_credential_ownership_and_reset();

-- RLS for credentials
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified credentials" ON public.credentials;
CREATE POLICY "Public can view verified credentials" ON public.credentials
    FOR SELECT TO authenticated, anon
    USING (status = 'verified');

DROP POLICY IF EXISTS "Designers can view own credentials" ON public.credentials;
CREATE POLICY "Designers can view own credentials" ON public.credentials
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can insert own credentials" ON public.credentials;
CREATE POLICY "Designers can insert own credentials" ON public.credentials
    FOR INSERT TO authenticated
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can update own credentials" ON public.credentials;
CREATE POLICY "Designers can update own credentials" ON public.credentials
    FOR UPDATE TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can delete own credentials" ON public.credentials;
CREATE POLICY "Designers can delete own credentials" ON public.credentials
    FOR DELETE TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to credentials" ON public.credentials;
CREATE POLICY "Admins have full access to credentials" ON public.credentials
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. Professional Liability Insurance Table
CREATE TABLE IF NOT EXISTS public.designer_insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.designer_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verified insurance" ON public.designer_insurance
    FOR SELECT TO authenticated, anon
    USING (status = 'verified' AND expiration_date >= CURRENT_DATE);

CREATE POLICY "Designers can view and manage own insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

CREATE POLICY "Admins have full access to insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. Licensed States View
CREATE OR REPLACE VIEW public.designer_licensed_states AS
SELECT 
    designer_id,
    array_agg(issuing_state ORDER BY issuing_state) AS licensed_states
FROM public.credentials
WHERE status = 'verified' 
  AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
GROUP BY designer_id;

GRANT SELECT ON public.designer_licensed_states TO authenticated, anon, service_role;

-- 10. Credential Expiration Scheduled Job Function
CREATE OR REPLACE FUNCTION public.check_credential_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Mark expired credentials
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type
        FROM public.credentials
        WHERE status = 'verified' AND expiration_date < CURRENT_DATE
    LOOP
        UPDATE public.credentials
        SET status = 'expired', updated_at = NOW()
        WHERE id = r.id;

        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;

    -- Notify credentials expiring in 30 days
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type, expiration_date
        FROM public.credentials
        WHERE status = 'verified' 
          AND expiration_date = CURRENT_DATE + INTERVAL '30 days'
    LOOP
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'expiration_date', r.expiration_date,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;
END;
$$;

-- 11. US Categories & Subcategories Seed
DO $$
DECLARE
    v_res UUID;
    v_comm UUID;
    v_hosp UUID;
    v_inst UUID;
    v_health UUID;
    v_ind UUID;
BEGIN
    -- Truncate / clean subcategories and re-seed
    DELETE FROM public.subcategories;
    DELETE FROM public.categories;

    -- Residential
    INSERT INTO public.categories (name, sort_order) VALUES ('Residential', 1) RETURNING id INTO v_res;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_res, 'Single-family home', 1),
        (v_res, 'Custom home', 2),
        (v_res, 'Home addition or remodel', 3),
        (v_res, 'ADU (accessory dwelling unit)', 4),
        (v_res, 'Townhome', 5),
        (v_res, 'Multifamily', 6),
        (v_res, 'Student housing', 7);

    -- Commercial
    INSERT INTO public.categories (name, sort_order) VALUES ('Commercial', 2) RETURNING id INTO v_comm;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_comm, 'Office', 1),
        (v_comm, 'Retail', 2),
        (v_comm, 'Restaurant', 3),
        (v_comm, 'Mixed-use', 4),
        (v_comm, 'Medical office', 5);

    -- Hospitality
    INSERT INTO public.categories (name, sort_order) VALUES ('Hospitality', 3) RETURNING id INTO v_hosp;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_hosp, 'Hotel', 1),
        (v_hosp, 'Short-term rental', 2);

    -- Institutional
    INSERT INTO public.categories (name, sort_order) VALUES ('Institutional', 4) RETURNING id INTO v_inst;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_inst, 'K-12 school', 1),
        (v_inst, 'Higher education', 2),
        (v_inst, 'Religious', 3),
        (v_inst, 'Government and civic', 4),
        (v_inst, 'Cultural', 5),
        (v_inst, 'Recreation', 6);

    -- Healthcare
    INSERT INTO public.categories (name, sort_order) VALUES ('Healthcare', 5) RETURNING id INTO v_health;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_health, 'Hospital', 1),
        (v_health, 'Clinic', 2),
        (v_health, 'Dental or specialty', 3),
        (v_health, 'Senior living', 4);

    -- Industrial
    INSERT INTO public.categories (name, sort_order) VALUES ('Industrial', 6) RETURNING id INTO v_ind;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_ind, 'Warehouse', 1),
        (v_ind, 'Manufacturing', 2),
        (v_ind, 'Logistics', 3);
END $$;

);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $;

CREATE INDEX IF NOT EXISTS idx_credentials_designer_id ON public.credentials(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(designer_id, status);
CREATE INDEX IF NOT EXISTS idx_credentials_issuing_state ON public.credentials(issuing_state);

-- Trigger: protect review fields and reset status on edit
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
            NEW.license_type IS DISTINCT FROM OLD.license_type OR
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

DROP TRIGGER IF EXISTS trg_credential_ownership_reset ON public.credentials;
CREATE TRIGGER trg_credential_ownership_reset
    BEFORE INSERT OR UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_credential_ownership_and_reset();

-- RLS for credentials
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified credentials" ON public.credentials;
CREATE POLICY "Public can view verified credentials" ON public.credentials
    FOR SELECT TO authenticated, anon
    USING (status = 'verified');

DROP POLICY IF EXISTS "Designers can view own credentials" ON public.credentials;
CREATE POLICY "Designers can view own credentials" ON public.credentials
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can insert own credentials" ON public.credentials;
CREATE POLICY "Designers can insert own credentials" ON public.credentials
    FOR INSERT TO authenticated
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can update own credentials" ON public.credentials;
CREATE POLICY "Designers can update own credentials" ON public.credentials
    FOR UPDATE TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can delete own credentials" ON public.credentials;
CREATE POLICY "Designers can delete own credentials" ON public.credentials
    FOR DELETE TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to credentials" ON public.credentials;
CREATE POLICY "Admins have full access to credentials" ON public.credentials
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. Professional Liability Insurance Table
CREATE TABLE IF NOT EXISTS public.designer_insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.designer_insurance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified insurance" ON public.designer_insurance;
CREATE POLICY "Public can view verified insurance" ON public.designer_insurance
    FOR SELECT TO authenticated, anon
    USING (status = 'verified' AND expiration_date >= CURRENT_DATE);

DROP POLICY IF EXISTS "Designers can view and manage own insurance" ON public.designer_insurance;
CREATE POLICY "Designers can view and manage own insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to insurance" ON public.designer_insurance;
CREATE POLICY "Admins have full access to insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. Licensed States View
CREATE OR REPLACE VIEW public.designer_licensed_states AS
SELECT 
    designer_id,
    array_agg(issuing_state ORDER BY issuing_state) AS licensed_states
FROM public.credentials
WHERE status = 'verified' 
  AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
GROUP BY designer_id;

GRANT SELECT ON public.designer_licensed_states TO authenticated, anon, service_role;

-- 10. Credential Expiration Scheduled Job Function
CREATE OR REPLACE FUNCTION public.check_credential_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Mark expired credentials
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type
        FROM public.credentials
        WHERE status = 'verified' AND expiration_date < CURRENT_DATE
    LOOP
        UPDATE public.credentials
        SET status = 'expired', updated_at = NOW()
        WHERE id = r.id;

        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;

    -- Notify credentials expiring in 30 days
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type, expiration_date
        FROM public.credentials
        WHERE status = 'verified' 
          AND expiration_date = CURRENT_DATE + INTERVAL '30 days'
    LOOP
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'expiration_date', r.expiration_date,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;
END;
$$;

-- 11. US Categories & Subcategories Seed
DO $$
DECLARE
    v_res UUID;
    v_comm UUID;
    v_hosp UUID;
    v_inst UUID;
    v_health UUID;
    v_ind UUID;
BEGIN
    -- Truncate / clean subcategories and re-seed
    DELETE FROM public.subcategories;
    DELETE FROM public.categories;

    -- Residential
    INSERT INTO public.categories (name, sort_order) VALUES ('Residential', 1) RETURNING id INTO v_res;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_res, 'Single-family home', 1),
        (v_res, 'Custom home', 2),
        (v_res, 'Home addition or remodel', 3),
        (v_res, 'ADU (accessory dwelling unit)', 4),
        (v_res, 'Townhome', 5),
        (v_res, 'Multifamily', 6),
        (v_res, 'Student housing', 7);

    -- Commercial
    INSERT INTO public.categories (name, sort_order) VALUES ('Commercial', 2) RETURNING id INTO v_comm;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_comm, 'Office', 1),
        (v_comm, 'Retail', 2),
        (v_comm, 'Restaurant', 3),
        (v_comm, 'Mixed-use', 4),
        (v_comm, 'Medical office', 5);

    -- Hospitality
    INSERT INTO public.categories (name, sort_order) VALUES ('Hospitality', 3) RETURNING id INTO v_hosp;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_hosp, 'Hotel', 1),
        (v_hosp, 'Short-term rental', 2);

    -- Institutional
    INSERT INTO public.categories (name, sort_order) VALUES ('Institutional', 4) RETURNING id INTO v_inst;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_inst, 'K-12 school', 1),
        (v_inst, 'Higher education', 2),
        (v_inst, 'Religious', 3),
        (v_inst, 'Government and civic', 4),
        (v_inst, 'Cultural', 5),
        (v_inst, 'Recreation', 6);

    -- Healthcare
    INSERT INTO public.categories (name, sort_order) VALUES ('Healthcare', 5) RETURNING id INTO v_health;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_health, 'Hospital', 1),
        (v_health, 'Clinic', 2),
        (v_health, 'Dental or specialty', 3),
        (v_health, 'Senior living', 4);

    -- Industrial
    INSERT INTO public.categories (name, sort_order) VALUES ('Industrial', 6) RETURNING id INTO v_ind;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_ind, 'Warehouse', 1),
        (v_ind, 'Manufacturing', 2),
        (v_ind, 'Logistics', 3);
END $$;

);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $;


CREATE INDEX IF NOT EXISTS idx_credentials_designer_id ON public.credentials(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(designer_id, status);
CREATE INDEX IF NOT EXISTS idx_credentials_issuing_state ON public.credentials(issuing_state);

-- Trigger: protect review fields and reset status on edit
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
            NEW.license_type IS DISTINCT FROM OLD.license_type OR
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

DROP TRIGGER IF EXISTS trg_credential_ownership_reset ON public.credentials;
CREATE TRIGGER trg_credential_ownership_reset
    BEFORE INSERT OR UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_credential_ownership_and_reset();

-- RLS for credentials
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified credentials" ON public.credentials;
CREATE POLICY "Public can view verified credentials" ON public.credentials
    FOR SELECT TO authenticated, anon
    USING (status = 'verified');

DROP POLICY IF EXISTS "Designers can view own credentials" ON public.credentials;
CREATE POLICY "Designers can view own credentials" ON public.credentials
    FOR SELECT TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can insert own credentials" ON public.credentials;
CREATE POLICY "Designers can insert own credentials" ON public.credentials
    FOR INSERT TO authenticated
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can update own credentials" ON public.credentials;
CREATE POLICY "Designers can update own credentials" ON public.credentials
    FOR UPDATE TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

DROP POLICY IF EXISTS "Designers can delete own credentials" ON public.credentials;
CREATE POLICY "Designers can delete own credentials" ON public.credentials
    FOR DELETE TO authenticated
    USING (designer_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to credentials" ON public.credentials;
CREATE POLICY "Admins have full access to credentials" ON public.credentials
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 8. Professional Liability Insurance Table
CREATE TABLE IF NOT EXISTS public.designer_insurance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    expiration_date DATE NOT NULL,
    certificate_file TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.designer_insurance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verified insurance" ON public.designer_insurance
    FOR SELECT TO authenticated, anon
    USING (status = 'verified' AND expiration_date >= CURRENT_DATE);

CREATE POLICY "Designers can view and manage own insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (designer_id = auth.uid())
    WITH CHECK (designer_id = auth.uid());

CREATE POLICY "Admins have full access to insurance" ON public.designer_insurance
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 9. Licensed States View
CREATE OR REPLACE VIEW public.designer_licensed_states AS
SELECT 
    designer_id,
    array_agg(issuing_state ORDER BY issuing_state) AS licensed_states
FROM public.credentials
WHERE status = 'verified' 
  AND (expiration_date IS NULL OR expiration_date >= CURRENT_DATE)
GROUP BY designer_id;

GRANT SELECT ON public.designer_licensed_states TO authenticated, anon, service_role;

-- 10. Credential Expiration Scheduled Job Function
CREATE OR REPLACE FUNCTION public.check_credential_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
BEGIN
    -- Mark expired credentials
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type
        FROM public.credentials
        WHERE status = 'verified' AND expiration_date < CURRENT_DATE
    LOOP
        UPDATE public.credentials
        SET status = 'expired', updated_at = NOW()
        WHERE id = r.id;

        -- Send notification to designer
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expired',
            'License Expired',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' has expired.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;

    -- Notify credentials expiring in 30 days
    FOR r IN 
        SELECT id, designer_id, issuing_state, license_type, expiration_date
        FROM public.credentials
        WHERE status = 'verified' 
          AND expiration_date = CURRENT_DATE + INTERVAL '30 days'
    LOOP
        INSERT INTO public.notifications (user_id, type, title, body, data, link)
        VALUES (
            r.designer_id,
            'credential_expiring',
            'License Expiring Soon',
            'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.',
            jsonb_build_object(
                'credential_id', r.id,
                'license_type', r.license_type,
                'state', r.issuing_state,
                'expiration_date', r.expiration_date,
                'message', 'Your ' || r.license_type || ' license in ' || r.issuing_state || ' expires in 30 days.'
            ),
            '/designer/profile#credentials'
        );
    END LOOP;
END;
$$;

-- 11. US Categories & Subcategories Seed
DO $$
DECLARE
    v_res UUID;
    v_comm UUID;
    v_hosp UUID;
    v_inst UUID;
    v_health UUID;
    v_ind UUID;
BEGIN
    -- Truncate / clean subcategories and re-seed
    DELETE FROM public.subcategories;
    DELETE FROM public.categories;

    -- Residential
    INSERT INTO public.categories (name, sort_order) VALUES ('Residential', 1) RETURNING id INTO v_res;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_res, 'Single-family home', 1),
        (v_res, 'Custom home', 2),
        (v_res, 'Home addition or remodel', 3),
        (v_res, 'ADU (accessory dwelling unit)', 4),
        (v_res, 'Townhome', 5),
        (v_res, 'Multifamily', 6),
        (v_res, 'Student housing', 7);

    -- Commercial
    INSERT INTO public.categories (name, sort_order) VALUES ('Commercial', 2) RETURNING id INTO v_comm;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_comm, 'Office', 1),
        (v_comm, 'Retail', 2),
        (v_comm, 'Restaurant', 3),
        (v_comm, 'Mixed-use', 4),
        (v_comm, 'Medical office', 5);

    -- Hospitality
    INSERT INTO public.categories (name, sort_order) VALUES ('Hospitality', 3) RETURNING id INTO v_hosp;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_hosp, 'Hotel', 1),
        (v_hosp, 'Short-term rental', 2);

    -- Institutional
    INSERT INTO public.categories (name, sort_order) VALUES ('Institutional', 4) RETURNING id INTO v_inst;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_inst, 'K-12 school', 1),
        (v_inst, 'Higher education', 2),
        (v_inst, 'Religious', 3),
        (v_inst, 'Government and civic', 4),
        (v_inst, 'Cultural', 5),
        (v_inst, 'Recreation', 6);

    -- Healthcare
    INSERT INTO public.categories (name, sort_order) VALUES ('Healthcare', 5) RETURNING id INTO v_health;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_health, 'Hospital', 1),
        (v_health, 'Clinic', 2),
        (v_health, 'Dental or specialty', 3),
        (v_health, 'Senior living', 4);

    -- Industrial
    INSERT INTO public.categories (name, sort_order) VALUES ('Industrial', 6) RETURNING id INTO v_ind;
    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_ind, 'Warehouse', 1),
        (v_ind, 'Manufacturing', 2),
        (v_ind, 'Logistics', 3);
END $$;

