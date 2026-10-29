-- ==============================================================================
-- Migration 004: Credentials & Review Protection Triggers
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    number TEXT NOT NULL,
    state_region TEXT NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1950 AND year <= 2100),
    certificate_path TEXT,
    status public.credential_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.profiles(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credentials_designer ON public.credentials(designer_id);
CREATE INDEX IF NOT EXISTS idx_credentials_status ON public.credentials(designer_id, status);

DROP TRIGGER IF EXISTS trg_credentials_updated_at ON public.credentials;
CREATE TRIGGER trg_credentials_updated_at
    BEFORE UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Protect administrative review fields from designer manipulation
CREATE OR REPLACE FUNCTION public.protect_credential_review_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if non-admin is trying to update review fields
    IF NOT public.is_admin() THEN
        -- Prevent designer from changing status directly (except through the automated reset trigger)
        IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status != 'verified' THEN
            RAISE EXCEPTION 'Only administrators can update credential review status.';
        END IF;

        IF NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
           NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
           NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at THEN
            RAISE EXCEPTION 'Only administrators can modify verification audit records.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_credential_review_fields ON public.credentials;
CREATE TRIGGER trg_protect_credential_review_fields
    BEFORE UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_credential_review_fields();

-- Trigger: Automatically reset a verified credential to 'pending' upon core field edit
CREATE OR REPLACE FUNCTION public.reset_verified_credential_on_edit()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'verified'::public.credential_status THEN
        IF (NEW.body IS DISTINCT FROM OLD.body) OR
           (NEW.number IS DISTINCT FROM OLD.number) OR
           (NEW.state_region IS DISTINCT FROM OLD.state_region) OR
           (NEW.year IS DISTINCT FROM OLD.year) OR
           (NEW.certificate_path IS DISTINCT FROM OLD.certificate_path) THEN
            NEW.status := 'pending'::public.credential_status;
            NEW.reviewed_by := NULL;
            NEW.reviewed_at := NULL;
            NEW.rejection_reason := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reset_verified_credential ON public.credentials;
CREATE TRIGGER trg_reset_verified_credential
    BEFORE UPDATE ON public.credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.reset_verified_credential_on_edit();
