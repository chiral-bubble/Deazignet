-- ==============================================================================
-- DEZIGNET SUPABASE MIGRATION - PHASE 6
-- 023_storage_buckets.sql
-- Storage Buckets Creation, Size Limits & Allowed MIME Types
-- ==============================================================================

-- Create or update the 6 buckets in storage.buckets with strict constraints
DO $$
BEGIN
    -- 1. avatars: Public read, 5 MB limit, jpg/png/webp
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'avatars',
        'avatars',
        true,
        5242880, -- 5 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
        updated_at = timezone('utc'::text, now());

    -- 2. portfolio: Public read, 10 MB limit, jpg/png/webp
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'portfolio',
        'portfolio',
        true,
        10485760, -- 10 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = true,
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
        updated_at = timezone('utc'::text, now());

    -- 3. project-files: Private, 15 MB limit, client references & PDFs
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'project-files',
        'project-files',
        false,
        15728640, -- 15 MB
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 15728640,
        allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        updated_at = timezone('utc'::text, now());

    -- 4. certificates: Private, 10 MB limit, PDF/images
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'certificates',
        'certificates',
        false,
        10485760, -- 10 MB
        ARRAY['application/pdf', 'image/jpeg', 'image/png']
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 10485760,
        allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'],
        updated_at = timezone('utc'::text, now());

    -- 5. deliverables: Private, 250 MB limit, PDF/CAD/IFC/ZIP
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'deliverables',
        'deliverables',
        false,
        262144000, -- 250 MB
        ARRAY[
            'application/pdf',
            'application/acad',
            'application/x-acad',
            'application/autocad_dwg',
            'image/vnd.dwg',
            'image/x-dwg',
            'application/dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed',
            'model/ifc',
            'application/x-step'
        ]
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 262144000,
        allowed_mime_types = ARRAY[
            'application/pdf',
            'application/acad',
            'application/x-acad',
            'application/autocad_dwg',
            'image/vnd.dwg',
            'image/x-dwg',
            'application/dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed',
            'model/ifc',
            'application/x-step'
        ],
        updated_at = timezone('utc'::text, now());

    -- 6. chat: Private, 25 MB limit, images/PDF/CAD/ZIP
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
        'chat',
        'chat',
        false,
        26214400, -- 25 MB
        ARRAY[
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'application/acad',
            'image/vnd.dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed'
        ]
    )
    ON CONFLICT (id) DO UPDATE SET
        public = false,
        file_size_limit = 26214400,
        allowed_mime_types = ARRAY[
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'application/pdf',
            'application/acad',
            'image/vnd.dwg',
            'application/octet-stream',
            'application/zip',
            'application/x-zip-compressed'
        ],
        updated_at = timezone('utc'::text, now());
END $$;

