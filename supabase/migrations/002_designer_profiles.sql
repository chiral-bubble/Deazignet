-- ==============================================================================
-- Migration 002: Designer Profiles
-- Creates designer_profiles table, constraints, and updated_at trigger
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.designer_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    professional_type public.professional_type NOT NULL DEFAULT 'architect',
    title TEXT,
    studio_name TEXT,
    bio VARCHAR(600),
    specializations TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    languages TEXT[] NOT NULL DEFAULT ARRAY['English']::TEXT[],
    years_experience INTEGER NOT NULL DEFAULT 0 CHECK (years_experience >= 0),
    hourly_rate NUMERIC(10, 2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
    show_hourly_rate BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    availability_note TEXT,
    show_in_search BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_designer_profiles_type ON public.designer_profiles(professional_type);
CREATE INDEX IF NOT EXISTS idx_designer_profiles_search ON public.designer_profiles(show_in_search, is_available);

DROP TRIGGER IF EXISTS trg_designer_profiles_updated_at ON public.designer_profiles;
CREATE TRIGGER trg_designer_profiles_updated_at
    BEFORE UPDATE ON public.designer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Automatically create empty designer_profile row whenever a user with role 'designer' is created
CREATE OR REPLACE FUNCTION public.handle_designer_profile_init()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role = 'designer'::public.user_role THEN
        INSERT INTO public.designer_profiles (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_designer_profile_init ON public.profiles;
CREATE TRIGGER on_designer_profile_init
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_designer_profile_init();
