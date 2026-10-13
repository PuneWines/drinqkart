-- =========================================================================
-- DRINQKART PRODUCTION DATABASE MIGRATION SCRIPT
-- Purpose: Rename / Add 'company_scope' to replace 'filtered_company_name'
--          This cleanly distinguishes Direct Vendors vs. Company-Scoped Vendors.
-- =========================================================================

-- 1. Add company_scope to purchase_purchase_orders & copy existing values
ALTER TABLE public.purchase_purchase_orders 
ADD COLUMN IF NOT EXISTS company_scope TEXT;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_purchase_orders' AND column_name = 'filtered_company_name'
  ) THEN
    UPDATE public.purchase_purchase_orders
    SET company_scope = filtered_company_name
    WHERE company_scope IS NULL AND filtered_company_name IS NOT NULL;
  END IF;
END $$;

-- 2. Add company_scope to purchase_approved_indent_items & copy existing values
ALTER TABLE public.purchase_approved_indent_items 
ADD COLUMN IF NOT EXISTS company_scope TEXT;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_approved_indent_items' AND column_name = 'filtered_company_name'
  ) THEN
    UPDATE public.purchase_approved_indent_items
    SET company_scope = filtered_company_name
    WHERE company_scope IS NULL AND filtered_company_name IS NOT NULL;
  END IF;
END $$;

-- 3. Add company_scope to purchase_indent_items
ALTER TABLE public.purchase_indent_items 
ADD COLUMN IF NOT EXISTS company_scope TEXT;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_indent_items' AND column_name = 'filtered_company_name'
  ) THEN
    UPDATE public.purchase_indent_items
    SET company_scope = filtered_company_name
    WHERE company_scope IS NULL AND filtered_company_name IS NOT NULL;
  END IF;
END $$;

-- 4. Add company_scope to purchase_dashboard
ALTER TABLE public.purchase_dashboard 
ADD COLUMN IF NOT EXISTS company_scope TEXT;

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'purchase_dashboard' AND column_name = 'filtered_company_name'
  ) THEN
    UPDATE public.purchase_dashboard
    SET company_scope = filtered_company_name
    WHERE company_scope IS NULL AND filtered_company_name IS NOT NULL;
  END IF;
END $$;

-- 5. Create performance indexes for company_scope
CREATE INDEX IF NOT EXISTS idx_po_vendor_company_scope 
ON public.purchase_purchase_orders (vendor_name, company_scope);

CREATE INDEX IF NOT EXISTS idx_approved_vendor_company_scope 
ON public.purchase_approved_indent_items (party_name, company_scope);

-- 6. Reload schema cache for PostgREST / Supabase
NOTIFY pgrst, 'reload schema';
