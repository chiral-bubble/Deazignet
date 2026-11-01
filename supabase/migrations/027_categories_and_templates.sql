-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - CLIENT PROJECTS & ENTRY FLOW
-- 027_categories_and_templates.sql
-- Categories, Subcategories, Phase Templates & Global Project Settings
-- ==============================================================================

-- 1. Categories Table (Single source of truth for projects and designer specializations)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Subcategories Table
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON public.subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON public.categories(sort_order);

-- Seed Standard Categories and Subcategories (Production Single Source of Truth)
DO $$
DECLARE
    v_cat_res UUID;
    v_cat_comm UUID;
    v_cat_inst UUID;
    v_cat_health UUID;
    v_cat_ind UUID;
BEGIN
    -- Remove old test subcategories that conflict with clean structure
    DELETE FROM public.subcategories WHERE name IN (
        'Kitchen & Bath Design', 'Luxury Estate', 'Tiny Home & Modular', 'Sustainable Living',
        'Civic Centers', 'Municipal Buildings', 'Public Works', 'Educational Facilities',
        'Pop-Up & Experiential', 'Flagship Retail', 'ADU / Guest House'
    );

    -- 1. Residential
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Residential', 1)
    ON CONFLICT (name) DO UPDATE SET sort_order = 1
    RETURNING id INTO v_cat_res;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_res, 'Detached house / bungalow', 1),
        (v_cat_res, 'Duplex', 2),
        (v_cat_res, 'Terrace / semi-detached', 3),
        (v_cat_res, 'Apartment block', 4),
        (v_cat_res, 'Housing estate', 5),
        (v_cat_res, 'Student hostel', 6)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 2. Commercial
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Commercial', 2)
    ON CONFLICT (name) DO UPDATE SET sort_order = 2
    RETURNING id INTO v_cat_comm;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_comm, 'Office building', 1),
        (v_cat_comm, 'Retail / shopping', 2),
        (v_cat_comm, 'Hotel & hospitality', 3),
        (v_cat_comm, 'Restaurant & cafe', 4),
        (v_cat_comm, 'Mixed-use', 5),
        (v_cat_comm, 'Filling station', 6)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 3. Institutional
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Institutional', 3)
    ON CONFLICT (name) DO UPDATE SET sort_order = 3
    RETURNING id INTO v_cat_inst;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_inst, 'School & university', 1),
        (v_cat_inst, 'Church / mosque / worship', 2),
        (v_cat_inst, 'Government building', 3),
        (v_cat_inst, 'Cultural & civic', 4),
        (v_cat_inst, 'Sports & recreation', 5)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 4. Healthcare
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Healthcare', 4)
    ON CONFLICT (name) DO UPDATE SET sort_order = 4
    RETURNING id INTO v_cat_health;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_health, 'Hospital', 1),
        (v_cat_health, 'Clinic', 2),
        (v_cat_health, 'Laboratory', 3),
        (v_cat_health, 'Pharmacy', 4)
    ON CONFLICT (category_id, name) DO NOTHING;

    -- 5. Industrial
    INSERT INTO public.categories (name, sort_order)
    VALUES ('Industrial', 5)
    ON CONFLICT (name) DO UPDATE SET sort_order = 5
    RETURNING id INTO v_cat_ind;

    INSERT INTO public.subcategories (category_id, name, sort_order) VALUES
        (v_cat_ind, 'Warehouse', 1),
        (v_cat_ind, 'Factory', 2),
        (v_cat_ind, 'Logistics', 3)
    ON CONFLICT (category_id, name) DO NOTHING;
END $$;

-- 2. Phase Templates Table (Standard architectural phases)
CREATE TABLE IF NOT EXISTS public.phase_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sort_order INT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    deliverables TEXT[] DEFAULT '{}',
    billing_trigger TEXT,
    default_fee_percent NUMERIC(5,2) NOT NULL CHECK (default_fee_percent >= 0 AND default_fee_percent <= 100),
    fee_percent_without_predesign NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (fee_percent_without_predesign >= 0 AND fee_percent_without_predesign <= 100),
    is_optional BOOLEAN NOT NULL DEFAULT false
);

-- In case columns already exist
ALTER TABLE public.phase_templates
    ADD COLUMN IF NOT EXISTS fee_percent_without_predesign NUMERIC(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_optional BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_phase_templates_sort_order ON public.phase_templates(sort_order);

-- Seed Standard Phase Templates
-- Five phases default (Schematic 20, DD 25, CD 35, Bidding 5, CA 15 = 100)
-- With Pre-Design (10, 15, 20, 35, 5, 15 = 100)
DELETE FROM public.phase_templates;

INSERT INTO public.phase_templates (
    sort_order,
    name,
    description,
    deliverables,
    billing_trigger,
    default_fee_percent,
    fee_percent_without_predesign,
    is_optional
) VALUES
    (
        1,
        'Pre-Design / Site Feasibility',
        'Review of site survey, zoning and setbacks, feasibility diagrams',
        ARRAY['Site survey review', 'Zoning setback clearance', 'Feasibility diagrams'],
        'Approval of site feasibility document',
        10.00,
        0.00,
        true
    ),
    (
        2,
        'Schematic Design',
        'Layout options and building concepts',
        ARRAY['Concept floor plans', 'Massing 3D sketches', 'Spatial relationship matrix'],
        'Client selection and sign-off of schematic concept',
        15.00,
        20.00,
        false
    ),
    (
        3,
        'Design Development',
        'Refine the selected design, coordinate with consultants',
        ARRAY['Dimensioned floor plans', 'Exterior elevations', 'Consultant coordination overlay'],
        'Approval of coordinated design development package',
        20.00,
        25.00,
        false
    ),
    (
        4,
        'Construction Documents',
        'Permit and construction-ready drawing set',
        ARRAY['Full permit drawing set', 'Technical specifications', 'Foundation and framing details'],
        'Delivery of signed architectural permit set',
        35.00,
        35.00,
        false
    ),
    (
        5,
        'Bidding & Permitting',
        'Assist with contractor selection and permit responses',
        ARRAY['Permit submission support', 'Bid tender evaluation', 'Bill of quantities review'],
        'Statutory permit approval & contractor award',
        5.00,
        5.00,
        false
    ),
    (
        6,
        'Construction Administration',
        'Support during construction and respond to RFIs',
        ARRAY['Site observation reports', 'RFI responses', 'Defects punch list'],
        'Final certificate of completion',
        15.00,
        15.00,
        false
    );

-- 3. App Settings for Projects & Auto-Close
INSERT INTO public.app_settings (key, value, description)
VALUES
    ('project_auto_close_days', '60'::jsonb, 'Days of inactivity before an open project is automatically closed'),
    ('auto_close_warning_days', '7'::jsonb, 'Days before auto-close when a warning notification is sent to client'),
    ('max_project_images', '8'::jsonb, 'Maximum reference images per project'),
    ('max_description_chars', '2000'::jsonb, 'Maximum character length of project description')
ON CONFLICT (key) DO UPDATE
SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = timezone('utc'::text, now());
