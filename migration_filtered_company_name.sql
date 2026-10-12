-- =========================================================================
-- DRINQKART PRODUCTION DATABASE MIGRATION SCRIPT
-- Purpose: Add filtered_company_name & company_name columns to cleanly
--          support Direct Vendor vs. Vendor + Company workflows without "::"
-- =========================================================================

-- 1. Add company_name and filtered_company_name to purchase_purchase_orders
ALTER TABLE purchase_purchase_orders 
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS filtered_company_name TEXT;

-- 2. Add filtered_company_name to purchase_approved_indent_items
ALTER TABLE purchase_approved_indent_items 
ADD COLUMN IF NOT EXISTS filtered_company_name TEXT;

-- 3. Add filtered_company_name to purchase_indent_items (for consistency)
ALTER TABLE purchase_indent_items 
ADD COLUMN IF NOT EXISTS filtered_company_name TEXT;

-- 4. Add filtered_company_name to purchase_dashboard
ALTER TABLE purchase_dashboard 
ADD COLUMN IF NOT EXISTS filtered_company_name TEXT;

-- 5. Add company_name to purchase_vendors (to designate Direct Vendor vs. Vendor + Company account)
ALTER TABLE purchase_vendors 
ADD COLUMN IF NOT EXISTS company_name TEXT;

-- 6. Add requires_transporter toggle to purchase_company_settings (default: true)
ALTER TABLE purchase_company_settings 
ADD COLUMN IF NOT EXISTS requires_transporter BOOLEAN DEFAULT true;

-- Default any Kunal company profile to false (preserves current behavior)
UPDATE purchase_company_settings 
SET requires_transporter = false 
WHERE UPPER(name) LIKE '%KUNAL%';

-- =========================================================================
-- DATA BACKFILL & NORMALIZATION (MIGRATE EXISTING "::" RECORDS)
-- =========================================================================

-- Migrate existing POs where vendor_name was stored as "VENDOR::COMPANY"
UPDATE purchase_purchase_orders
SET 
  filtered_company_name = split_part(vendor_name, '::', 2),
  vendor_name = split_part(vendor_name, '::', 1)
WHERE vendor_name LIKE '%::%';

-- Migrate any approved items where party_name or unique_indent_id had "::"
UPDATE purchase_approved_indent_items
SET 
  filtered_company_name = company_name
WHERE filtered_company_name IS NULL 
  AND company_name IS NOT NULL;

-- Create index for fast portal and lifecycle lookups
CREATE INDEX IF NOT EXISTS idx_po_vendor_filtered_comp 
ON purchase_purchase_orders (vendor_name, filtered_company_name);

CREATE INDEX IF NOT EXISTS idx_approved_vendor_filtered_comp 
ON purchase_approved_indent_items (party_name, filtered_company_name);
