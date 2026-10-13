-- =========================================================================
-- DRINQKART DATABASE MIGRATION SCRIPT
-- Purpose: Add 'location' column to global 'shop' table and populate defaults
-- =========================================================================

-- 1. Add location column to global shop table
ALTER TABLE shop 
ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Populate default area locations for existing shops
UPDATE shop SET location = 'AKOLE' WHERE UPPER(shop_name) = 'BALAJI' AND (location IS NULL OR location = '');
UPDATE shop SET location = 'BAVDHAN' WHERE UPPER(shop_name) = 'MADHURA' AND (location IS NULL OR location = '');
UPDATE shop SET location = 'HINJEWADI' WHERE UPPER(shop_name) = 'TLS' AND (location IS NULL OR location = '');
UPDATE shop SET location = 'WAGHOLI' WHERE UPPER(shop_name) = 'FRIENDS' AND (location IS NULL OR location = '');
UPDATE shop SET location = 'ULWE' WHERE UPPER(shop_name) LIKE '%ULWE%' AND (location IS NULL OR location = '');
UPDATE shop SET location = 'KHARGHAR' WHERE UPPER(shop_name) LIKE '%KHARGHAR%' AND (location IS NULL OR location = '');
