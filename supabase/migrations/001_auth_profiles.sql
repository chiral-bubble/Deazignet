-- ==============================================================================
-- Migration 001: Auth & Profiles
-- Creates enums, updated_at helper, profiles table, and auth.users trigger
-- ==============================================================================

-- 1. Create custom ENUMs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE public.user_role AS ENUM ('client', 'designer', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'professional_type') THEN
        CREATE TYPE public.professional_type AS ENUM (
            'architect',
            'interior_designer',
            'landscape_architect',
            'engineer'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_status') THEN
        CREATE TYPE public.credential_status AS ENUM ('pending', 'verified', 'rejected');
    END IF;
END $$;

-- 2. Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Profiles Table (1:1 with auth.users)
-- Private user profile. Email remains in auth.users to prevent duplicate source of truth.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.user_role NOT NULL DEFAULT 'client',
    full_name TEXT NOT NULL,
    avatar_path TEXT,
    location TEXT,
    phone TEXT, -- Private field; never exposed to public
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Admin check helper function (used in RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = (SELECT auth.uid())
          AND role = 'admin'::public.user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger on auth.users creation
-- Strictly whitelists user_role to 'designer' or 'client', defaulting to 'client'.
-- 'admin' is NEVER assignable at signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    chosen_role TEXT;
    assigned_role public.user_role;
    user_name TEXT;
BEGIN
    chosen_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'client'));
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    -- Strict role whitelist guard
    IF chosen_role = 'designer' THEN
        assigned_role := 'designer'::public.user_role;
    ELSE
        assigned_role := 'client'::public.user_role;
    END IF;

    -- Insert profile
    INSERT INTO public.profiles (id, role, full_name)
    VALUES (NEW.id, assigned_role, user_name)
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Trigger to prevent users from updating their own role
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Users cannot alter account role. Contact support.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_role();

