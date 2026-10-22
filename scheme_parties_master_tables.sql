-- ==============================================================================
-- FINAL SCHEME PARTIES MASTER (TRADERS, COMPANIES, BRANDS)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Scheme Traders Table
CREATE TABLE IF NOT EXISTS public.scheme_traders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Scheme Companies Table
CREATE TABLE IF NOT EXISTS public.scheme_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Scheme Brands Table (Pure Brand Name only)
CREATE TABLE IF NOT EXISTS public.scheme_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_scheme_traders_name ON public.scheme_traders (name);
CREATE INDEX IF NOT EXISTS idx_scheme_companies_name ON public.scheme_companies (name);
CREATE INDEX IF NOT EXISTS idx_scheme_brands_name ON public.scheme_brands (name);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.scheme_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_brands ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (Allow Read, Insert, Update, Delete for all)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all on scheme_traders" ON public.scheme_traders;
    DROP POLICY IF EXISTS "Allow all on scheme_companies" ON public.scheme_companies;
    DROP POLICY IF EXISTS "Allow all on scheme_brands" ON public.scheme_brands;
    DROP POLICY IF EXISTS "Allow public read on scheme_traders" ON public.scheme_traders;
    DROP POLICY IF EXISTS "Allow public write on scheme_traders" ON public.scheme_traders;
    DROP POLICY IF EXISTS "Allow public read on scheme_companies" ON public.scheme_companies;
    DROP POLICY IF EXISTS "Allow public write on scheme_companies" ON public.scheme_companies;
    DROP POLICY IF EXISTS "Allow public read on scheme_brands" ON public.scheme_brands;
    DROP POLICY IF EXISTS "Allow public write on scheme_brands" ON public.scheme_brands;
END $$;

CREATE POLICY "Allow all on scheme_traders" ON public.scheme_traders
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on scheme_companies" ON public.scheme_companies
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all on scheme_brands" ON public.scheme_brands
    FOR ALL USING (true) WITH CHECK (true);

-- 7. Grant Permissions to API roles
GRANT ALL ON TABLE public.scheme_traders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.scheme_companies TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.scheme_brands TO anon, authenticated, service_role;
