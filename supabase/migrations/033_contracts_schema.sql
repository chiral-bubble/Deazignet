-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CONTRACTS SCHEMA
-- 033_contracts_schema.sql
-- Professional Architectural Services Agreement Architecture, Signatures & Sequence
-- ==============================================================================

-- 1. Extend Status Enums
DO $$
BEGIN
    ALTER TYPE public.engagement_status ADD VALUE IF NOT EXISTS 'pending_signature';
    ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contract_status') THEN
        CREATE TYPE public.contract_status AS ENUM (
            'awaiting_signatures',
            'partially_signed',
            'active',
            'completed',
            'cancelled',
            'expired'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signature_style_type') THEN
        CREATE TYPE public.signature_style_type AS ENUM ('typed', 'drawn');
    END IF;
END $$;

-- 2. Contract Terms Versions (Standard platform legal templates)
CREATE TABLE IF NOT EXISTS public.contract_terms_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed Initial Contract Standard Terms Version
INSERT INTO public.contract_terms_versions (version, title, body_markdown)
VALUES (
    '2026.1',
    'Standard Terms of Professional Architectural & Design Services',
    '### Placeholder: to be reviewed and replaced by legal counsel before launch

1. **Ownership of Work Product & License on Payment**: Upon receipt of full payment for each milestone, the Designer grants the Client an exclusive, perpetual, irrevocable license to use the Deliverables for the construction, maintenance, and marketing of the specified project. Preliminary sketches and unapproved drafts remain the intellectual property of the Designer.

2. **Confidentiality & Non-Disclosure**: Both parties agree to maintain the confidentiality of proprietary site information, financial terms, and private access instructions. Public portfolio rights apply only to non-confidential visual renders upon milestone completion.

3. **Termination & Suspension**: Either party may terminate or suspend services with 14 calendar days written notice. In the event of suspension for non-payment, the Designer shall resume work within 5 business days of funding receipt.

4. **Revisions & Change Orders**: Revisions in excess of the specified included revisions per phase constitute Additional Services and shall be billed at the agreed hourly rate or an agreed supplementary fee.

5. **Liability Limits**: To the fullest extent permitted by applicable law, Designer liability is capped at the total fee received for the specific engagement. Neither party shall be liable for indirect or consequential damages.

6. **Dispute Resolution & Escalation**: In the event of a dispute, the parties shall first submit to the Dezignet platform mediation protocol. Escrowed funds shall remain frozen pending resolution.

7. **Governing Law & Jurisdiction**: This Agreement shall be governed by the laws of the jurisdiction where the project site is situated.

8. **Platform Role**: Dezignet acts as an independent platform escrow agent and technology venue, and is not a party to the direct design contract.'
)
ON CONFLICT (version) DO NOTHING;

-- 3. Contract Number Sequence (DZ-YYYY-####)
CREATE SEQUENCE IF NOT EXISTS public.contract_number_seq START WITH 1001;

-- 4. Contracts Table (Immutable Snapshot)
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    engagement_id UUID NOT NULL UNIQUE REFERENCES public.engagements(id) ON DELETE RESTRICT,
    number TEXT NOT NULL UNIQUE,
    status public.contract_status NOT NULL DEFAULT 'awaiting_signatures',
    terms_version_id UUID NOT NULL REFERENCES public.contract_terms_versions(id) ON DELETE RESTRICT,
    content JSONB NOT NULL,
    content_hash TEXT NOT NULL,
    pdf_file_id UUID REFERENCES public.files(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    activated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_contracts_engagement_id ON public.contracts (engagement_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts (status);

-- 5. Contract Signatures (Bilateral)
CREATE TABLE IF NOT EXISTS public.contract_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    signer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    signer_role public.user_role NOT NULL,
    typed_name TEXT NOT NULL,
    signature_style public.signature_style_type NOT NULL DEFAULT 'typed',
    signature_file_id UUID REFERENCES public.files(id),
    signed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ip_address INET,
    user_agent TEXT,
    content_hash_at_signing TEXT NOT NULL,
    CONSTRAINT uq_contract_signer UNIQUE (contract_id, signer_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_signer ON public.contract_signatures (signer_id);

-- 6. Contract Settings
INSERT INTO public.app_settings (key, value, description)
VALUES ('contract_sign_deadline_days', '7'::jsonb, 'Number of days parties have to sign a prepared contract before expiration')
ON CONFLICT (key) DO NOTHING;

-- 7. Contracts Storage Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'contracts',
    'contracts',
    false,
    15728640, -- 15 MB
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

