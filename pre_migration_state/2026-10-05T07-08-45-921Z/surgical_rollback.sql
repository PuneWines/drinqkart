-- ========================================================================
-- SURGICAL ROLLBACK SCRIPT (Generated at 2026-10-05T07:09:02.564Z)
-- Targets specifically the exact row IDs captured in pre_migration_state/2026-10-05T07-08-45-921Z
-- ========================================================================
BEGIN;

-- Disable recalculation triggers during rollback to avoid cascading timeouts
ALTER TABLE "Inventory_closing_stock_items" DISABLE TRIGGER ALL;
ALTER TABLE "Inventory_purchase_items" DISABLE TRIGGER ALL;

-- 1. Restore child records by exact ID

-- Revert Inventory_items
UPDATE "Inventory_items" SET "shop_id" = 17 WHERE "id" IN (480,493,482,485,492);
UPDATE "Inventory_items" SET "shop_id" = 13 WHERE "id" IN (551,499,505,552,395,557,416,562,567,572,577,500,409,394,468,506,467,535,536,407,402,412,546,392,410,553,558,563,474,543,554,559,564,569,560,414,400,565,570,385,473,578,404,398,399,469,403,413,487,401,579,472,397,387,496,489,490,502,508,390,466,411,393,515,405,488,501,507,408,396,491,497,503,509,386,415,470,391,498,504,510,534,550,556,561,566,571,580,406,544,549,389,388,555);
UPDATE "Inventory_items" SET "shop_id" = 15 WHERE "id" IN (438,443,447,457,460,479,512,518,459,435,462,442,448,450,453,456,437,422,446,424,420,427,478,524,530,537,451,454,574,423,463,465,575,441,418,428,433,417,419,511,425,517,429,430,523,434,439,432,440,475,520,532,513,519,525,531,495,538,464,458,445,477,516,522,528,540,476,421,426,431,527,449,533,452,455,461,539,436);
UPDATE "Inventory_items" SET "shop_id" = 16 WHERE "id" IN (486,514);

-- Revert Inventory_vendors
UPDATE "Inventory_vendors" SET "shop_id" = 17 WHERE "id" IN (39);
UPDATE "Inventory_vendors" SET "shop_id" = 13 WHERE "id" IN (124,127,128,35,37,38,40,41,42,81,89,90,123);
UPDATE "Inventory_vendors" SET "shop_id" = 15 WHERE "id" IN (126,36,46,47,48,49,50,51,52,54,55,56,57,59,60,61,62,63,64,65,66,67,82,83,88);
UPDATE "Inventory_vendors" SET "shop_id" = 16 WHERE "id" IN (58);

-- Revert Inventory_inventory_transactions
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 17 WHERE "id" IN (NULL);
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 13 WHERE "id" IN (NULL);
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 15 WHERE "id" IN (NULL);
UPDATE "Inventory_inventory_transactions" SET "shop_id" = 16 WHERE "id" IN (NULL);

-- Revert Inventory_closing_stock_items
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 17 WHERE "id" IN (NULL);
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 13 WHERE "id" IN (NULL);
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 15 WHERE "id" IN (NULL);
UPDATE "Inventory_closing_stock_items" SET "shop_id" = 16 WHERE "id" IN (NULL);

-- Revert Inventory_sale_history
UPDATE "Inventory_sale_history" SET "shop_id" = 17 WHERE "id" IN (NULL);
UPDATE "Inventory_sale_history" SET "shop_id" = 13 WHERE "id" IN (NULL);
UPDATE "Inventory_sale_history" SET "shop_id" = 15 WHERE "id" IN (NULL);
UPDATE "Inventory_sale_history" SET "shop_id" = 16 WHERE "id" IN (NULL);

-- Re-enable triggers
ALTER TABLE "Inventory_closing_stock_items" ENABLE TRIGGER ALL;
ALTER TABLE "Inventory_purchase_items" ENABLE TRIGGER ALL;

COMMIT;
