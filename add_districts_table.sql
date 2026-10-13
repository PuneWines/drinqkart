-- =========================================================================
-- DRINQKART PURCHASE SYSTEM MIGRATION SCRIPT (NO SEED DATA)
-- Purpose:
--   1. Create 'purchase_districts' table with RLS & access policies
--   2. Add 'district' column to 'purchase_company_settings' table
--   3. Add 'district_contacts' JSONB column to 'purchase_vendors' table
--   4. Add 'district' column to 'purchase_purchase_orders' table
-- =========================================================================

-- 1. Create purchase_districts table (without inserting sample rows)
CREATE TABLE IF NOT EXISTS public.purchase_districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and policies on purchase_districts
ALTER TABLE public.purchase_districts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_districts' AND policyname = 'Allow public read access on purchase_districts'
    ) THEN
        CREATE POLICY "Allow public read access on purchase_districts"
        ON public.purchase_districts FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_districts' AND policyname = 'Allow public insert on purchase_districts'
    ) THEN
        CREATE POLICY "Allow public insert on purchase_districts"
        ON public.purchase_districts FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_districts' AND policyname = 'Allow public update on purchase_districts'
    ) THEN
        CREATE POLICY "Allow public update on purchase_districts"
        ON public.purchase_districts FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_districts' AND policyname = 'Allow public delete on purchase_districts'
    ) THEN
        CREATE POLICY "Allow public delete on purchase_districts"
        ON public.purchase_districts FOR DELETE USING (true);
    END IF;
END $$;

-- 2. Add district column to purchase_company_settings table
ALTER TABLE public.purchase_company_settings
ADD COLUMN IF NOT EXISTS district TEXT;

-- Populate existing district data from bank_details JSON if present
UPDATE public.purchase_company_settings
SET district = bank_details->>'district'
WHERE (district IS NULL OR district = '') AND bank_details->>'district' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_company_district
ON public.purchase_company_settings(district);

-- 3. Add district_contacts JSONB column to purchase_vendors table
ALTER TABLE public.purchase_vendors
ADD COLUMN IF NOT EXISTS district_contacts JSONB DEFAULT '[]'::jsonb;

-- 4. Add district column to purchase_purchase_orders table
ALTER TABLE public.purchase_purchase_orders
ADD COLUMN IF NOT EXISTS district TEXT;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_district
ON public.purchase_purchase_orders(district);

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
