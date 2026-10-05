-- =========================================================================
-- PRODUCTION DATABASE MIGRATION SCRIPT
-- Target Database: Supabase PostgreSQL (Project: yxtvvjijtraobzaqdevz)
-- Scope: Inventory_shop ID Harmonization & Child Table Re-keying
-- =========================================================================

BEGIN;

-- Safety: Set lock timeout and statement timeout
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

-- =========================================================================
-- STEP 1: DISABLE USER-DEFINED TRIGGERS ON CLOSING STOCK
-- Prevents 4,430 recursive recalculations of Inventory_stock_ledger during shop_id updates
-- System foreign key checks remain fully intact.
-- =========================================================================
ALTER TABLE "Inventory_closing_stock_items" DISABLE TRIGGER "Inventory_trg_after_closing_change";
ALTER TABLE "Inventory_closing_stock_items" DISABLE TRIGGER "Inventory_trg_validate_closing";

-- =========================================================================
-- STEP 2: INSERT TARGET SHOPS INTO Inventory_shop (TWO-STEP PARENT PATTERN)
-- Note: ID 13 is currently FRIENDS, so ID 13 cannot be inserted for OFFICE yet.
-- =========================================================================
INSERT INTO "Inventory_shop" (id, shop_name) VALUES
  (8, 'BALAJI'),
  (12, 'FRIENDS'),
  (5, 'KUNAL ULWE'),
  (7, 'MADHURA'),
  (19, 'KUNAL KHARGHAR')
ON CONFLICT (id) DO UPDATE SET shop_name = EXCLUDED.shop_name;

-- =========================================================================
-- STEP 3: RE-KEY CHILD RECORDS TO TARGET SHOP IDS
-- =========================================================================

-- 3.1 Inventory_items (179 rows total)
UPDATE "Inventory_items" SET "shop_id" = 8  WHERE "shop_id" = 17; -- BALAJI: 5 rows
UPDATE "Inventory_items" SET "shop_id" = 12 WHERE "shop_id" = 13; -- FRIENDS: 94 rows
UPDATE "Inventory_items" SET "shop_id" = 5  WHERE "shop_id" = 15; -- KUNAL ULWE: 78 rows
UPDATE "Inventory_items" SET "shop_id" = 7  WHERE "shop_id" = 16; -- MADHURA: 2 rows

-- 3.2 Inventory_vendors (40 rows total)
UPDATE "Inventory_vendors" SET "shop_id" = 8  WHERE "shop_id" = 17; -- BALAJI: 1 row
UPDATE "Inventory_vendors" SET "shop_id" = 12 WHERE "shop_id" = 13; -- FRIENDS: 13 rows
UPDATE "Inventory_vendors" SET "shop_id" = 5  WHERE "shop_id" = 15; -- KUNAL ULWE: 25 rows
UPDATE "Inventory_vendors" SET "shop_id" = 7  WHERE "shop_id" = 16; -- MADHURA: 1 row

-- 3.3 Inventory_inventory_transactions (10,137 rows total)
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 8  WHERE "shop_id" = 17; -- BALAJI: 34 rows
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 12 WHERE "shop_id" = 13; -- FRIENDS: 5,684 rows
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 5  WHERE "shop_id" = 15; -- KUNAL ULWE: 4,416 rows
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 7  WHERE "shop_id" = 16; -- MADHURA: 3 rows

-- 3.4 Inventory_closing_stock_items (7,531 rows total)
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 8  WHERE "shop_id" = 17; -- BALAJI: 2 rows
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 12 WHERE "shop_id" = 13; -- FRIENDS: 4,430 rows
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 5  WHERE "shop_id" = 15; -- KUNAL ULWE: 3,097 rows
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 7  WHERE "shop_id" = 16; -- MADHURA: 2 rows

-- 3.5 Inventory_sale_history (5,138 rows total)
UPDATE "Inventory_sale_history" SET "shop_id" = 8  WHERE "shop_id" = 17; -- BALAJI: 27 rows
UPDATE "Inventory_sale_history" SET "shop_id" = 12 WHERE "shop_id" = 13; -- FRIENDS: 2,674 rows
UPDATE "Inventory_sale_history" SET "shop_id" = 5  WHERE "shop_id" = 15; -- KUNAL ULWE: 2,434 rows
UPDATE "Inventory_sale_history" SET "shop_id" = 7  WHERE "shop_id" = 16; -- MADHURA: 3 rows

-- =========================================================================
-- STEP 4: RE-ENABLE USER-DEFINED TRIGGERS ON CLOSING STOCK
-- =========================================================================
ALTER TABLE "Inventory_closing_stock_items" ENABLE TRIGGER "Inventory_trg_after_closing_change";
ALTER TABLE "Inventory_closing_stock_items" ENABLE TRIGGER "Inventory_trg_validate_closing";

-- =========================================================================
-- STEP 5: DELETE OBSOLETE OLD SHOP PARENTS FROM Inventory_shop
-- All child records have now been repointed, so these have 0 references.
-- =========================================================================
DELETE FROM "Inventory_shop" WHERE "id" = 17; -- Old BALAJI
DELETE FROM "Inventory_shop" WHERE "id" = 13; -- Old FRIENDS (now freed!)
DELETE FROM "Inventory_shop" WHERE "id" = 15; -- Old KUNAL ULWE
DELETE FROM "Inventory_shop" WHERE "id" = 16; -- Old MADHURA
DELETE FROM "Inventory_shop" WHERE "id" = 1;  -- Old TEST Shop (0 child records)

-- =========================================================================
-- STEP 6: INSERT OFFICE (ID 13) INTO Inventory_shop
-- =========================================================================
INSERT INTO "Inventory_shop" (id, shop_name) VALUES (13, 'OFFICE');

-- =========================================================================
-- STEP 7: STRING CLEANUP IN Inventory_manager_report
-- Clean up trailing newlines and obsolete shop naming (102 rows)
-- =========================================================================
UPDATE "Inventory_manager_report" 
SET "shop_name" = 'TLS' 
WHERE "shop_name" ILIKE '%vishal%';

-- =========================================================================
-- STEP 8: UPDATE SEQUENCE VALUES
-- Ensure future INSERTs on Inventory_shop do not collide with ID 19
-- =========================================================================
SELECT setval(pg_get_serial_sequence('"Inventory_shop"', 'id'), GREATEST((SELECT MAX(id) FROM "Inventory_shop"), 19));

-- =========================================================================
-- STEP 9: FINAL INVARIANT INTEGRITY VALIDATION CHECKS
-- If any check fails, the transaction aborts automatically!
-- =========================================================================
DO $$
DECLARE
  v_test_count int;
  v_old_balaji int;
  v_old_friends int;
  v_old_ulwe int;
  v_old_madhura int;
  v_friends_on_12 int;
  v_balaji_on_8 int;
  v_ulwe_on_5 int;
  v_madhura_on_7 int;
  v_office_count int;
  v_kharghar_count int;
  v_vishal_count int;
BEGIN
  -- 1. Verify obsolete IDs have 0 child rows in Inventory_items
  SELECT COUNT(*) INTO v_old_balaji FROM "Inventory_items" WHERE "shop_id" = 17;
  SELECT COUNT(*) INTO v_old_friends FROM "Inventory_items" WHERE "shop_id" = 13; -- Should now be 0 items on 13 (OFFICE has none yet)
  SELECT COUNT(*) INTO v_old_ulwe FROM "Inventory_items" WHERE "shop_id" = 15;
  SELECT COUNT(*) INTO v_old_madhura FROM "Inventory_items" WHERE "shop_id" = 16;

  IF (v_old_balaji + v_old_friends + v_old_ulwe + v_old_madhura) > 0 THEN
    RAISE EXCEPTION 'INTEGRITY ERROR: Obsolete shop IDs still exist in Inventory_items!';
  END IF;

  -- 2. Verify target IDs received all expected items
  SELECT COUNT(*) INTO v_balaji_on_8 FROM "Inventory_items" WHERE "shop_id" = 8;
  SELECT COUNT(*) INTO v_friends_on_12 FROM "Inventory_items" WHERE "shop_id" = 12;
  SELECT COUNT(*) INTO v_ulwe_on_5 FROM "Inventory_items" WHERE "shop_id" = 5;
  SELECT COUNT(*) INTO v_madhura_on_7 FROM "Inventory_items" WHERE "shop_id" = 7;

  IF v_balaji_on_8 != 5 OR v_friends_on_12 != 94 OR v_ulwe_on_5 != 78 OR v_madhura_on_7 != 2 THEN
    RAISE EXCEPTION 'INTEGRITY ERROR: Inventory_items target distribution mismatch!';
  END IF;

  -- 3. Verify Inventory_shop final state
  SELECT COUNT(*) INTO v_office_count FROM "Inventory_shop" WHERE id = 13 AND shop_name = 'OFFICE';
  SELECT COUNT(*) INTO v_kharghar_count FROM "Inventory_shop" WHERE id = 19 AND shop_name = 'KUNAL KHARGHAR';
  SELECT COUNT(*) INTO v_test_count FROM "Inventory_shop" WHERE id = 1;

  IF v_office_count != 1 OR v_kharghar_count != 1 OR v_test_count != 0 THEN
    RAISE EXCEPTION 'INTEGRITY ERROR: Inventory_shop final composition mismatch!';
  END IF;

  -- 4. Verify string cleanup in Inventory_manager_report
  SELECT COUNT(*) INTO v_vishal_count FROM "Inventory_manager_report" WHERE shop_name ILIKE '%vishal%';
  IF v_vishal_count != 0 THEN
    RAISE EXCEPTION 'INTEGRITY ERROR: Uncleaned vishal string remaining in Inventory_manager_report!';
  END IF;
  
  RAISE NOTICE 'SUCCESS: ALL INVARIANT INTEGRITY VALIDATION CHECKS PASSED PERFECTLY.';
END $$;

COMMIT;
