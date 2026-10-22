-- =========================================================================
-- DRINQKART PURCHASE & LOGISTICS DATABASE SCHEMA MIGRATION
-- Purpose:
--   1. Add 'area' and 'vendor_phone' columns to purchase_purchase_orders
--   2. Add 'areas' JSONB column to purchase_districts table
--   3. Ensure 'district_contacts' exists on purchase_vendors table
--   4. Ensure 'district' and 'company_scope' exist on purchase_purchase_orders
--   5. Reload PostgREST schema cache
-- =========================================================================

-- 1. Add area & vendor_phone to purchase_purchase_orders
ALTER TABLE public.purchase_purchase_orders 
ADD COLUMN IF NOT EXISTS area TEXT;

ALTER TABLE public.purchase_purchase_orders 
ADD COLUMN IF NOT EXISTS vendor_phone TEXT;

ALTER TABLE public.purchase_purchase_orders 
ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE public.purchase_purchase_orders 
ADD COLUMN IF NOT EXISTS company_scope TEXT;

-- 2. Add areas JSONB column to purchase_districts (for area list per district)
ALTER TABLE public.purchase_districts 
ADD COLUMN IF NOT EXISTS areas JSONB DEFAULT '[]'::jsonb;

-- 3. Ensure district_contacts exists on purchase_vendors
ALTER TABLE public.purchase_vendors 
ADD COLUMN IF NOT EXISTS district_contacts JSONB DEFAULT '[]'::jsonb;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_purchase_po_area ON public.purchase_purchase_orders(area);
CREATE INDEX IF NOT EXISTS idx_purchase_po_vendor_phone ON public.purchase_purchase_orders(vendor_phone);
CREATE INDEX IF NOT EXISTS idx_purchase_po_district ON public.purchase_purchase_orders(district);
CREATE INDEX IF NOT EXISTS idx_purchase_po_company_scope ON public.purchase_purchase_orders(company_scope);

-- 5. Reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
