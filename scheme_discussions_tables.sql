-- =========================================================================
-- DRINQKART SCHEME DISCUSSIONS SYSTEM SCHEMA
-- Purpose:
--   1. Create 'scheme_discussions' table for trader schemes & visibility deals
--   2. Setup performance indexes for queries & filtering
--   3. Enable Row Level Security (RLS) and grant CRUD policies
--   4. Setup Supabase Storage bucket 'scheme_attachments' for photos & files
-- =========================================================================

-- 1. Create scheme_discussions table
CREATE TABLE IF NOT EXISTS public.scheme_discussions (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    trader TEXT,
    company TEXT,
    brand TEXT,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    scheme_type TEXT NOT NULL,
    basis TEXT,
    amt_unit TEXT,
    target_qty NUMERIC,
    target_unit TEXT,
    qty NUMERIC,
    free_qty NUMERIC,
    amount NUMERIC,
    all_stores BOOLEAN DEFAULT FALSE,
    stores JSONB DEFAULT '[]'::jsonb,
    discussion TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast filtering & searching
CREATE INDEX IF NOT EXISTS idx_scheme_discussions_dates ON public.scheme_discussions (from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_scheme_discussions_type ON public.scheme_discussions (scheme_type);
CREATE INDEX IF NOT EXISTS idx_scheme_discussions_trader ON public.scheme_discussions (trader);
CREATE INDEX IF NOT EXISTS idx_scheme_discussions_created_at ON public.scheme_discussions (created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.scheme_discussions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Allow select on scheme_discussions" ON public.scheme_discussions;
CREATE POLICY "Allow select on scheme_discussions"
    ON public.scheme_discussions
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow insert on scheme_discussions" ON public.scheme_discussions;
CREATE POLICY "Allow insert on scheme_discussions"
    ON public.scheme_discussions
    FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update on scheme_discussions" ON public.scheme_discussions;
CREATE POLICY "Allow update on scheme_discussions"
    ON public.scheme_discussions
    FOR UPDATE
    USING (true);

DROP POLICY IF EXISTS "Allow delete on scheme_discussions" ON public.scheme_discussions;
CREATE POLICY "Allow delete on scheme_discussions"
    ON public.scheme_discussions
    FOR DELETE
    USING (true);

-- 5. Supabase Storage Bucket setup for attachments (photos & documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('scheme_attachments', 'scheme_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for scheme_attachments
DROP POLICY IF EXISTS "Allow public read on scheme_attachments" ON storage.objects;
CREATE POLICY "Allow public read on scheme_attachments"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'scheme_attachments');

DROP POLICY IF EXISTS "Allow public upload on scheme_attachments" ON storage.objects;
CREATE POLICY "Allow public upload on scheme_attachments"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'scheme_attachments');

DROP POLICY IF EXISTS "Allow public delete on scheme_attachments" ON storage.objects;
CREATE POLICY "Allow public delete on scheme_attachments"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'scheme_attachments');
