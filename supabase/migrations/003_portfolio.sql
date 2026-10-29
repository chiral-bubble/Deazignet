-- ==============================================================================
-- Migration 003: Portfolio Projects & Portfolio Images
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.portfolio_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    designer_id UUID NOT NULL REFERENCES public.designer_profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    year INTEGER CHECK (year IS NULL OR (year >= 1900 AND year <= 2100)),
    category TEXT,
    location TEXT,
    description TEXT,
    role TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    cover_image_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_projects_designer ON public.portfolio_projects(designer_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_sort ON public.portfolio_projects(designer_id, sort_order);

DROP TRIGGER IF EXISTS trg_portfolio_projects_updated_at ON public.portfolio_projects;
CREATE TRIGGER trg_portfolio_projects_updated_at
    BEFORE UPDATE ON public.portfolio_projects
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.portfolio_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_project_id UUID NOT NULL REFERENCES public.portfolio_projects(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_images_project ON public.portfolio_images(portfolio_project_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_images_sort ON public.portfolio_images(portfolio_project_id, sort_order);

DROP TRIGGER IF EXISTS trg_portfolio_images_updated_at ON public.portfolio_images;
CREATE TRIGGER trg_portfolio_images_updated_at
    BEFORE UPDATE ON public.portfolio_images
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
