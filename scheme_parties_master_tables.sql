-- ==============================================================================
-- SCHEME PARTIES MASTER (TRADERS, COMPANIES, BRANDS)
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

-- 3. Scheme Brands Table
CREATE TABLE IF NOT EXISTS public.scheme_brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Indexes for fast search & joins
CREATE INDEX IF NOT EXISTS idx_scheme_traders_name ON public.scheme_traders (name);
CREATE INDEX IF NOT EXISTS idx_scheme_companies_name ON public.scheme_companies (name);
CREATE INDEX IF NOT EXISTS idx_scheme_brands_name ON public.scheme_brands (name);
CREATE INDEX IF NOT EXISTS idx_scheme_brands_company ON public.scheme_brands (company_name);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.scheme_traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheme_brands ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies (allow read & write)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read on scheme_traders" ON public.scheme_traders;
    DROP POLICY IF EXISTS "Allow public write on scheme_traders" ON public.scheme_traders;
    DROP POLICY IF EXISTS "Allow public read on scheme_companies" ON public.scheme_companies;
    DROP POLICY IF EXISTS "Allow public write on scheme_companies" ON public.scheme_companies;
    DROP POLICY IF EXISTS "Allow public read on scheme_brands" ON public.scheme_brands;
    DROP POLICY IF EXISTS "Allow public write on scheme_brands" ON public.scheme_brands;
END $$;

CREATE POLICY "Allow public read on scheme_traders" ON public.scheme_traders FOR SELECT USING (true);
CREATE POLICY "Allow public write on scheme_traders" ON public.scheme_traders FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on scheme_companies" ON public.scheme_companies FOR SELECT USING (true);
CREATE POLICY "Allow public write on scheme_companies" ON public.scheme_companies FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read on scheme_brands" ON public.scheme_brands FOR SELECT USING (true);
CREATE POLICY "Allow public write on scheme_brands" ON public.scheme_brands FOR ALL USING (true) WITH CHECK (true);

-- 7. Seed Initial Traders
INSERT INTO public.scheme_traders (name) VALUES
('GAYATRI ENTERPRISES'),
('WINE ENTERPRISES PVT LTD'),
('MILLINNIUM SPIRITS PVT LTD'),
('VINTAGE SPIRITS'),
('K.S.N. IRANI & CO.'),
('MML SPIRITS PRIVATE LIMITED'),
('VC TRADERS')
ON CONFLICT (name) DO NOTHING;

-- 8. Seed Initial Companies
INSERT INTO public.scheme_companies (name) VALUES
('SEAGRAM/PERNOD RICARD'),
('BACARDI'),
('RADICO KHAITAN'),
('ACE BEVERAGEZ'),
('MONICA ALCO BEV'),
('MEHER DISTILLERIES'),
('12TH MAN BREWING'),
('Comte de Grasse')
ON CONFLICT (name) DO NOTHING;

-- 9. Seed Initial Brands (with optional associated company)
INSERT INTO public.scheme_brands (name, company_name) VALUES
('Royal Stag', 'SEAGRAM/PERNOD RICARD'),
('Blenders Pride', 'SEAGRAM/PERNOD RICARD'),
('Jameson', 'SEAGRAM/PERNOD RICARD'),
('Ballantine''s', 'SEAGRAM/PERNOD RICARD'),
('Chivas Regal', 'SEAGRAM/PERNOD RICARD'),
('Bacardi Carta Blanca', 'BACARDI'),
('Magic Moments', 'RADICO KHAITAN'),
('Corona', '12TH MAN BREWING'),
('Budweiser', '12TH MAN BREWING')
ON CONFLICT (name) DO NOTHING;
