SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."Inventory_fn_after_closing_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_old_date         date;
  v_new_daily_closing numeric;
BEGIN
  SELECT transaction_date INTO v_old_date
    FROM public.Inventory_inventory_transactions
   WHERE id = OLD.transaction_id;

  -- Recompute total (NULL if all closing entries for this date were deleted)
  SELECT SUM(csi.total_qty)
    INTO v_new_daily_closing
    FROM public.Inventory_closing_stock_items csi
    JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
   WHERE csi.item_id         = OLD.item_id
     AND it.transaction_date = v_old_date;

  -- NULL closing_qty restores "no closing entered" state correctly
  UPDATE public.Inventory_stock_ledger
     SET closing_qty = v_new_daily_closing,
         updated_at  = now()
   WHERE item_id    = OLD.item_id
     AND ledger_date = v_old_date;

  PERFORM public.Inventory_fn_cascade_recalculate(OLD.item_id, v_old_date);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_after_closing_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_after_closing_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tx_date       date;
  v_item_name     character varying;
  v_daily_closing numeric;
BEGIN
  SELECT transaction_date INTO v_tx_date
    FROM public.Inventory_inventory_transactions
   WHERE id = NEW.transaction_id;

  SELECT item_name INTO v_item_name
    FROM public.Inventory_items
   WHERE id = NEW.item_id;

  -- Sum ALL closing entries for this item+date (NEW row is already committed in AFTER trigger)
  SELECT SUM(csi.total_qty)
    INTO v_daily_closing
    FROM public.Inventory_closing_stock_items csi
    JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
   WHERE csi.item_id         = NEW.item_id
     AND it.transaction_date = v_tx_date;

  -- Upsert ledger row: set closing_qty to the daily total
  -- If no ledger row exists yet (closing before any purchase), create one with 0 purchase
  INSERT INTO public.Inventory_stock_ledger
    (item_id, item_name, ledger_date, opening_qty, purchase_qty, current_stock, sale_qty, closing_qty)
  VALUES
    (NEW.item_id, v_item_name, v_tx_date, 0, 0, 0, 0, v_daily_closing)
  ON CONFLICT (item_id, ledger_date) DO UPDATE SET
    closing_qty = v_daily_closing,
    item_name   = EXCLUDED.item_name,
    updated_at  = now();

  -- Cascade recalculate from this date forward (sets opening, current_stock, sale_qty)
  PERFORM public.Inventory_fn_cascade_recalculate(NEW.item_id, v_tx_date);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_after_closing_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_after_closing_stock_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tx_date             date;
  v_item_name           varchar;
  v_opening_qty         numeric := 0;
  v_prev_closing        numeric;
  v_prev_opening        numeric;
  v_prev_purchase       numeric;
  v_prev_date           date;
BEGIN
  -- 1. Get transaction date
  SELECT transaction_date
    INTO v_tx_date
    FROM public.Inventory_inventory_transactions
   WHERE id = NEW.transaction_id;

  -- 2. Get item name
  SELECT item_name
    INTO v_item_name
    FROM public.Inventory_items
   WHERE id = NEW.item_id;

  -- 3. Find the most recent ledger row from a PREVIOUS date (not today)
  SELECT closing_qty, opening_qty, purchase_qty, ledger_date
    INTO v_prev_closing, v_prev_opening, v_prev_purchase, v_prev_date
    FROM public.Inventory_stock_ledger
   WHERE item_id = NEW.item_id
     AND ledger_date < v_tx_date
   ORDER BY ledger_date DESC
   LIMIT 1;

  -- 4. Determine opening quantity:
  --    If a previous row exists, use its closing_qty.
  --    If the previous closing is NULL (unfinalized), carry forward calculated stock (opening + purchase).
  --    If no previous history exists at all, default opening to 0.
  IF v_prev_date IS NOT NULL THEN
    IF v_prev_closing IS NOT NULL THEN
      v_opening_qty := v_prev_closing;
    ELSE
      v_opening_qty := COALESCE(v_prev_opening, 0) + COALESCE(v_prev_purchase, 0);
    END IF;
  ELSE
    v_opening_qty := 0;
  END IF;

  -- 5. Upsert stock_ledger row for today
  --    closing_qty and sale_qty are NOT set here (finalized by midnight sync)
  INSERT INTO public.Inventory_stock_ledger
    (item_id, item_name, ledger_date, date_for_opening, opening_qty, purchase_qty)
  VALUES
    (NEW.item_id, v_item_name, v_tx_date, v_prev_date, v_opening_qty, 0)
  ON CONFLICT (item_id, ledger_date)
  DO UPDATE SET
    item_name        = EXCLUDED.item_name,
    opening_qty      = stock_ledger.opening_qty,      -- never overwrite
    date_for_opening = stock_ledger.date_for_opening, -- never overwrite
    updated_at       = now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_after_closing_stock_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_after_purchase_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_old_date date;
  v_new_date date;
BEGIN
  -- Get date of the old row (always exists for UPDATE/DELETE)
  SELECT transaction_date INTO v_old_date
    FROM public.Inventory_inventory_transactions
   WHERE id = OLD.transaction_id;

  -- Recompute purchase_qty for the old date from scratch
  -- (the UPDATE/DELETE already happened, so SUM reflects the new state)
  UPDATE public.Inventory_stock_ledger
     SET purchase_qty = (
           SELECT COALESCE(SUM(pi.quantity), 0)
             FROM public.Inventory_purchase_items pi
             JOIN public.Inventory_inventory_transactions it ON it.id = pi.transaction_id
            WHERE pi.item_id          = OLD.item_id
              AND it.transaction_date = v_old_date
         ),
         updated_at = now()
   WHERE item_id    = OLD.item_id
     AND ledger_date = v_old_date;

  -- If this was an UPDATE and item_id or date changed, handle the new side too
  IF TG_OP = 'UPDATE' THEN
    SELECT transaction_date INTO v_new_date
      FROM public.Inventory_inventory_transactions
     WHERE id = NEW.transaction_id;

    IF NEW.item_id IS DISTINCT FROM OLD.item_id
       OR v_new_date IS DISTINCT FROM v_old_date
    THEN
      UPDATE public.Inventory_stock_ledger
         SET purchase_qty = (
               SELECT COALESCE(SUM(pi.quantity), 0)
                 FROM public.Inventory_purchase_items pi
                 JOIN public.Inventory_inventory_transactions it ON it.id = pi.transaction_id
                WHERE pi.item_id          = NEW.item_id
                  AND it.transaction_date = v_new_date
             ),
             updated_at = now()
       WHERE item_id    = NEW.item_id
         AND ledger_date = v_new_date;

      PERFORM public.Inventory_fn_cascade_recalculate(NEW.item_id, v_new_date);
    END IF;
  END IF;

  -- Cascade from the earliest affected date for the old item
  PERFORM public.Inventory_fn_cascade_recalculate(OLD.item_id, v_old_date);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_after_purchase_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_after_purchase_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tx_date   date;
  v_item_name character varying;
BEGIN
  -- Get transaction date
  SELECT transaction_date INTO v_tx_date
    FROM public.Inventory_inventory_transactions
   WHERE id = NEW.transaction_id;

  -- Get item name for the write-once item_name field
  SELECT item_name INTO v_item_name
    FROM public.Inventory_items
   WHERE id = NEW.item_id;

  -- Upsert ledger row: accumulate purchase_qty only
  -- opening_qty and current_stock are set by fn_cascade_recalculate below
  INSERT INTO public.Inventory_stock_ledger
    (item_id, item_name, ledger_date, opening_qty, purchase_qty, current_stock, sale_qty, closing_qty)
  VALUES
    (NEW.item_id, v_item_name, v_tx_date, 0, NEW.quantity, NEW.quantity, 0, NULL)
  ON CONFLICT (item_id, ledger_date) DO UPDATE SET
    purchase_qty = public.Inventory_stock_ledger.purchase_qty + EXCLUDED.purchase_qty,
    item_name    = EXCLUDED.item_name,
    updated_at   = now();
  -- NOTE: We do NOT set opening_qty or current_stock here; cascade fixes them.

  -- Cascade recalculate from this date forward
  PERFORM public.Inventory_fn_cascade_recalculate(NEW.item_id, v_tx_date);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_after_purchase_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_after_purchase_item_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tx_date       date;
  v_item_name     varchar;
  v_opening_qty   numeric := 0;
  v_prev_closing  numeric;
  v_prev_opening  numeric;
  v_prev_purchase numeric;
  v_prev_date     date;
BEGIN
  -- 1. Get transaction date
  SELECT transaction_date
    INTO v_tx_date
    FROM public.Inventory_inventory_transactions
   WHERE id = NEW.transaction_id;

  -- 2. Get item name
  SELECT item_name
    INTO v_item_name
    FROM public.Inventory_items
   WHERE id = NEW.item_id;

  -- 3. Find the most recent ledger row BEFORE this date
  SELECT closing_qty, opening_qty, purchase_qty, ledger_date
    INTO v_prev_closing, v_prev_opening, v_prev_purchase, v_prev_date
    FROM public.Inventory_stock_ledger
   WHERE item_id = NEW.item_id
     AND ledger_date < v_tx_date
   ORDER BY ledger_date DESC
   LIMIT 1;

  -- 4. Determine opening quantity:
  --    If a previous row exists, use its closing_qty.
  --    If the previous closing is NULL (unfinalized), carry forward calculated stock (opening + purchase).
  --    If no previous history exists at all, default opening to 0.
  IF v_prev_date IS NOT NULL THEN
    IF v_prev_closing IS NOT NULL THEN
      v_opening_qty := v_prev_closing;
    ELSE
      v_opening_qty := COALESCE(v_prev_opening, 0) + COALESCE(v_prev_purchase, 0);
    END IF;
  ELSE
    v_opening_qty := 0;
  END IF;

  -- 5. Upsert ledger row
  INSERT INTO public.Inventory_stock_ledger
    (
      item_id,
      item_name,
      ledger_date,
      date_for_opening,
      opening_qty,
      purchase_qty
    )
  VALUES
    (
      NEW.item_id,
      v_item_name,
      v_tx_date,
      v_prev_date,
      v_opening_qty,
      NEW.quantity
    )
  ON CONFLICT (item_id, ledger_date)
  DO UPDATE SET
    purchase_qty = stock_ledger.purchase_qty + EXCLUDED.purchase_qty,
    item_name    = EXCLUDED.item_name,
    updated_at   = now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_after_purchase_item_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_cascade_recalculate"("p_item_id" bigint, "p_from_date" "date") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  rec            RECORD;
  v_prev_closing numeric;
  v_prev_current numeric;
  v_new_opening  numeric;
  v_new_current  numeric;
  v_new_sale     numeric;
BEGIN
  FOR rec IN
    SELECT id, ledger_date, purchase_qty, closing_qty
      FROM public.Inventory_stock_ledger
     WHERE item_id    = p_item_id
       AND ledger_date >= p_from_date
     ORDER BY ledger_date ASC
  LOOP
    -- Get the immediately preceding row's closing and current_stock
    SELECT closing_qty,
           opening_qty + purchase_qty   -- = current_stock of that row
      INTO v_prev_closing, v_prev_current
      FROM public.Inventory_stock_ledger
     WHERE item_id    = p_item_id
       AND ledger_date < rec.ledger_date
     ORDER BY ledger_date DESC
     LIMIT 1;

    -- Opening rule:
    --   previous has closing  → opening = that closing
    --   previous has no closing (NULL) → opening = previous current_stock
    --   no previous row → opening = 0
    v_new_opening := CASE
      WHEN v_prev_closing IS NOT NULL THEN v_prev_closing
      WHEN v_prev_current IS NOT NULL THEN v_prev_current
      ELSE 0
    END;

    -- current_stock = opening + purchase (never subtracts sales)
    v_new_current := v_new_opening + COALESCE(rec.purchase_qty, 0);

    -- sale_qty only computed when closing is known
    --   closing entered  → sale = current_stock - closing  (floor 0)
    --   closing NULL     → sale = 0
    v_new_sale := CASE
      WHEN rec.closing_qty IS NOT NULL
        THEN GREATEST(0, v_new_current - rec.closing_qty)
      ELSE 0
    END;

    UPDATE public.Inventory_stock_ledger
       SET opening_qty   = v_new_opening,
           current_stock = v_new_current,
           sale_qty      = v_new_sale,
           updated_at    = now()
     WHERE id = rec.id;

    -- Reset for next iteration (read fresh from DB in next loop body's SELECT)
    v_prev_closing := NULL;
    v_prev_current := NULL;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_cascade_recalculate"("p_item_id" bigint, "p_from_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_get_current_stock"("p_item_id" bigint) RETURNS numeric
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    CASE
      WHEN closing_qty IS NOT NULL THEN closing_qty
      ELSE current_stock
    END,
    0
  )
  FROM public.Inventory_stock_ledger
  WHERE item_id = p_item_id
  ORDER BY ledger_date DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."Inventory_fn_get_current_stock"("p_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_midnight_stock_sync"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT sl.item_id,
           sl.ledger_date,
           sl.sale_qty,
           i.item_name,
           i.shop_id
      FROM public.Inventory_stock_ledger sl
      JOIN public.Inventory_items i ON i.id = sl.item_id
     WHERE sl.closing_qty IS NOT NULL
       AND sl.ledger_date < CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM public.Inventory_sale_history sh
          WHERE sh.item_name        = i.item_name
            AND sh.transaction_date = sl.ledger_date
            AND sh.shop_id          = i.shop_id
       )
  LOOP
    INSERT INTO public.Inventory_sale_history (transaction_date, item_name, sale_qty, shop_id)
    VALUES (rec.ledger_date, rec.item_name, COALESCE(rec.sale_qty, 0), rec.shop_id);

    RAISE NOTICE 'sale_history written: item=%, date=%, qty=%',
      rec.item_name, rec.ledger_date, rec.sale_qty;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_midnight_stock_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_recalculate_current_stock"("p_item_id" bigint) RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_latest_closing_date date;
  v_latest_closing_qty  numeric := 0;
  v_purchases_since     numeric := 0;
BEGIN
  -- Find the most recent closing stock entry BEFORE today (exclude today's entries)
  SELECT it.transaction_date, csi.total_qty
    INTO v_latest_closing_date, v_latest_closing_qty
    FROM public.Inventory_closing_stock_items csi
    JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
   WHERE csi.item_id = p_item_id
     AND it.transaction_date < CURRENT_DATE
   ORDER BY it.transaction_date DESC, csi.created_at DESC
   LIMIT 1;

  IF v_latest_closing_date IS NULL THEN
    v_latest_closing_date := '1970-01-01'::date;
    v_latest_closing_qty  := 0;
  END IF;

  -- Sum all purchases since that latest closing date
  SELECT COALESCE(SUM(pi.quantity), 0)
    INTO v_purchases_since
    FROM public.Inventory_purchase_items pi
    JOIN public.Inventory_inventory_transactions it ON it.id = pi.transaction_id
   WHERE pi.item_id = p_item_id
     AND it.transaction_date > v_latest_closing_date;

  RETURN v_latest_closing_qty + v_purchases_since;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_recalculate_current_stock"("p_item_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_set_stock_ledger_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_set_stock_ledger_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_stock_as_of"("p_item_id" bigint, "p_date" "date") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_latest_closing_date date;
  v_latest_closing_qty  numeric := 0;
  v_purchases_since     numeric := 0;
BEGIN
  -- 1. Find the most recent closing date BEFORE the given date
  SELECT it.transaction_date INTO v_latest_closing_date
    FROM public.Inventory_closing_stock_items csi
    JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
   WHERE csi.item_id = p_item_id
     AND it.transaction_date < p_date
   ORDER BY it.transaction_date DESC
   LIMIT 1;

  -- 2. Sum ALL closing stock entries on that date (avoids the LIMIT 1 bug)
  IF v_latest_closing_date IS NOT NULL THEN
    SELECT COALESCE(SUM(csi.total_qty), 0) INTO v_latest_closing_qty
      FROM public.Inventory_closing_stock_items csi
      JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
     WHERE csi.item_id = p_item_id
       AND it.transaction_date = v_latest_closing_date;
  ELSE
    v_latest_closing_date := '1970-01-01'::date;
    v_latest_closing_qty  := 0;
  END IF;

  -- 3. Sum purchases between that closing and the given date (inclusive of p_date)
  SELECT COALESCE(SUM(pi.quantity), 0) INTO v_purchases_since
    FROM public.Inventory_purchase_items pi
    JOIN public.Inventory_inventory_transactions it ON it.id = pi.transaction_id
   WHERE pi.item_id = p_item_id
     AND it.transaction_date > v_latest_closing_date
     AND it.transaction_date <= p_date;       -- ← inclusive of p_date

  RETURN v_latest_closing_qty + v_purchases_since;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_stock_as_of"("p_item_id" bigint, "p_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_sync_current_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.Inventory_items
       SET current_stock = public.Inventory_fn_recalculate_current_stock(OLD.item_id)
     WHERE id = OLD.item_id;
    RETURN OLD;
  ELSE
    UPDATE public.Inventory_items
       SET current_stock = public.Inventory_fn_recalculate_current_stock(NEW.item_id)
     WHERE id = NEW.item_id;
    RETURN NEW;
  END IF;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_sync_current_stock"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_validate_closing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tx_date        date;
  v_current_stock  numeric;
  v_already_closed numeric;
BEGIN
  SELECT transaction_date INTO v_tx_date
    FROM public.Inventory_inventory_transactions
   WHERE id = NEW.transaction_id;

  -- Get current_stock from ledger for this date (= opening + purchase)
  SELECT current_stock INTO v_current_stock
    FROM public.Inventory_stock_ledger
   WHERE item_id    = NEW.item_id
     AND ledger_date = v_tx_date;

  -- No ledger row yet for this date (e.g. a purchase happened on a prior
  -- date but nothing has touched this date's row). Fall back to the most
  -- recent prior ledger row's carried-forward stock instead of defaulting
  -- to 0, matching fn_cascade_recalculate's opening-qty rule.
  IF NOT FOUND OR v_current_stock IS NULL THEN
    SELECT COALESCE(closing_qty, opening_qty + purchase_qty)
      INTO v_current_stock
      FROM public.Inventory_stock_ledger
     WHERE item_id    = NEW.item_id
       AND ledger_date < v_tx_date
     ORDER BY ledger_date DESC
     LIMIT 1;
  END IF;

  v_current_stock := COALESCE(v_current_stock, 0);

  -- Sum existing closing entries, excluding current row (handles UPDATE)
  SELECT COALESCE(SUM(csi.total_qty), 0) INTO v_already_closed
    FROM public.Inventory_closing_stock_items csi
    JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
   WHERE csi.item_id         = NEW.item_id
     AND it.transaction_date = v_tx_date
     AND csi.id IS DISTINCT FROM NEW.id;

  IF v_already_closed + NEW.total_qty > v_current_stock THEN
    RAISE EXCEPTION
      'Closing total (%) would exceed current stock (%) for item % on %.',
      v_already_closed + NEW.total_qty,
      v_current_stock,
      NEW.item_id,
      v_tx_date;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_validate_closing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Inventory_fn_validate_closing_stock"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_tx_date        date;
  v_current_stock  numeric;
  v_daily_total    numeric;
BEGIN
  -- Get the transaction date for this closing entry
  SELECT transaction_date
    INTO v_tx_date
    FROM public.Inventory_inventory_transactions
   WHERE id = NEW.transaction_id;

  -- Get current stock for the item
  SELECT COALESCE(current_stock, 0)
    INTO v_current_stock
    FROM public.Inventory_items
   WHERE id = NEW.item_id;

  -- Sum all closing entries already submitted for this item today
  SELECT COALESCE(SUM(csi.total_qty), 0)
    INTO v_daily_total
    FROM public.Inventory_closing_stock_items csi
    JOIN public.Inventory_inventory_transactions it ON it.id = csi.transaction_id
   WHERE csi.item_id = NEW.item_id
     AND it.transaction_date = v_tx_date;

  -- Reject if accumulated + this entry would exceed current stock
  IF v_daily_total + NEW.total_qty > v_current_stock THEN
    RAISE EXCEPTION
      'Daily closing total (%) would exceed current stock (%) for this item.',
      v_daily_total + NEW.total_qty, v_current_stock;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."Inventory_fn_validate_closing_stock"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."Inventory_app_users" (
    "id" bigint NOT NULL,
    "username" character varying(255) NOT NULL,
    "password" character varying(255) NOT NULL,
    "role" character varying(50) DEFAULT 'operator'::character varying NOT NULL,
    "shop_id" bigint,
    "is_approved" boolean DEFAULT false NOT NULL,
    "page_access" "jsonb" DEFAULT '["entry", "ledger"]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."Inventory_app_users" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_app_users_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_app_users_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_app_users_id_seq" OWNED BY "public"."Inventory_app_users"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_closing_stock_items" (
    "id" bigint NOT NULL,
    "transaction_id" bigint NOT NULL,
    "item_id" bigint NOT NULL,
    "last_closing_qty" numeric(12,2) DEFAULT 0,
    "godown_qty" numeric(12,2) DEFAULT 0,
    "counter_qty" numeric(12,2) DEFAULT 0,
    "total_qty" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" bigint
);


ALTER TABLE "public"."Inventory_closing_stock_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_closing_stock_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_closing_stock_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_closing_stock_items_id_seq" OWNED BY "public"."Inventory_closing_stock_items"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_daily_sales_summary" (
    "id" bigint NOT NULL,
    "transaction_id" bigint NOT NULL,
    "gpay_amount" numeric(12,2) DEFAULT 0,
    "cash_amount" numeric(12,2) DEFAULT 0,
    "expense_amount" numeric(12,2) DEFAULT 0,
    "total_closing_amount" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_name" bigint,
    "Total_sales_amt" numeric,
    "withdrawal_amount" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."Inventory_daily_sales_summary" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_daily_sales_summary_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_daily_sales_summary_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_daily_sales_summary_id_seq" OWNED BY "public"."Inventory_daily_sales_summary"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_inventory_transactions" (
    "id" bigint NOT NULL,
    "transaction_date" "date" NOT NULL,
    "transaction_type" character varying(30) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" bigint,
    CONSTRAINT "Inventory_inventory_transactions_transaction_type_check" CHECK ((("transaction_type")::"text" = ANY ((ARRAY['purchase'::character varying, 'closing_stock'::character varying, 'sale_amount'::character varying])::"text"[])))
);


ALTER TABLE "public"."Inventory_inventory_transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_inventory_transactions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_inventory_transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_inventory_transactions_id_seq" OWNED BY "public"."Inventory_inventory_transactions"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_items" (
    "id" bigint NOT NULL,
    "item_name" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" bigint,
    "opening_qty" bigint DEFAULT 0,
    "purchase_qty" bigint DEFAULT 0,
    "closing_qty" bigint DEFAULT 0,
    "mrp" bigint DEFAULT 20,
    "current_stock" numeric DEFAULT 0
);


ALTER TABLE "public"."Inventory_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_items_id_seq" OWNED BY "public"."Inventory_items"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_manager_report" (
    "id" bigint NOT NULL,
    "report_date" "date" NOT NULL,
    "shop_name" "text" NOT NULL,
    "gpay_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "cash_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "expense_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone,
    "entry_type" "text" DEFAULT 'sales'::"text" NOT NULL,
    "withdrawal_amount" numeric DEFAULT 0 NOT NULL,
    "note" "text",
    "shop_id" bigint,
    "performed_by" "text"
);


ALTER TABLE "public"."Inventory_manager_report" OWNER TO "postgres";


ALTER TABLE "public"."Inventory_manager_report" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Inventory_manager_report_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."Inventory_purchase_items" (
    "id" bigint NOT NULL,
    "transaction_id" bigint NOT NULL,
    "item_id" bigint NOT NULL,
    "vendor_id" bigint,
    "purchase_rate" numeric(12,2) DEFAULT 0,
    "quantity" numeric(12,2) DEFAULT 0,
    "gst_percent" numeric(5,2) DEFAULT 0,
    "discount" numeric(12,2) DEFAULT 0,
    "discount_type" character varying(20),
    "total_amount" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_name" bigint
);


ALTER TABLE "public"."Inventory_purchase_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_purchase_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_purchase_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_purchase_items_id_seq" OWNED BY "public"."Inventory_purchase_items"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_sale_history" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "transaction_date" "date" NOT NULL,
    "item_name" character varying(255) NOT NULL,
    "sale_qty" numeric NOT NULL,
    "shop_id" bigint
);


ALTER TABLE "public"."Inventory_sale_history" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_sale_history_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_sale_history_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_sale_history_id_seq" OWNED BY "public"."Inventory_sale_history"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_shop" (
    "id" bigint NOT NULL,
    "shop_name" character varying(255) NOT NULL
);


ALTER TABLE "public"."Inventory_shop" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_shop_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_shop_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_shop_id_seq" OWNED BY "public"."Inventory_shop"."id";



CREATE TABLE IF NOT EXISTS "public"."Inventory_stock_ledger" (
    "id" bigint NOT NULL,
    "item_id" bigint NOT NULL,
    "item_name" character varying,
    "ledger_date" "date" NOT NULL,
    "date_for_opening" "date",
    "opening_qty" numeric DEFAULT 0 NOT NULL,
    "purchase_qty" numeric DEFAULT 0 NOT NULL,
    "closing_qty" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sale_qty" numeric,
    "current_stock" numeric DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."Inventory_stock_ledger" OWNER TO "postgres";


COMMENT ON TABLE "public"."Inventory_stock_ledger" IS 'Stock ledger: one row per item per date. sale_qty is auto-computed as Opening + Purchase - Closing.';



COMMENT ON COLUMN "public"."Inventory_stock_ledger"."date_for_opening" IS 'The ledger_date of the previous entry whose closing_qty feeds this row''s opening_qty.';



CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_stock_ledger_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_stock_ledger_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_stock_ledger_id_seq" OWNED BY "public"."Inventory_stock_ledger"."id";



CREATE OR REPLACE VIEW "public"."Inventory_stock_ledger_view" AS
 WITH "purchase_agg" AS (
         SELECT "pi"."item_id",
            "it"."transaction_date" AS "ledger_date",
            "sum"("pi"."quantity") AS "total_purchased"
           FROM ("public"."Inventory_purchase_items" "pi"
             JOIN "public"."Inventory_inventory_transactions" "it" ON (("it"."id" = "pi"."transaction_id")))
          GROUP BY "pi"."item_id", "it"."transaction_date"
        ), "closing_agg" AS (
         SELECT DISTINCT ON ("csi"."item_id", "it"."transaction_date") "csi"."item_id",
            "it"."transaction_date" AS "ledger_date",
            "csi"."total_qty" AS "closing_qty"
           FROM ("public"."Inventory_closing_stock_items" "csi"
             JOIN "public"."Inventory_inventory_transactions" "it" ON (("it"."id" = "csi"."transaction_id")))
          ORDER BY "csi"."item_id", "it"."transaction_date", "csi"."created_at" DESC
        ), "all_dates" AS (
         SELECT "purchase_agg"."item_id",
            "purchase_agg"."ledger_date"
           FROM "purchase_agg"
        UNION
         SELECT "closing_agg"."item_id",
            "closing_agg"."ledger_date"
           FROM "closing_agg"
        ), "with_prev_closing" AS (
         SELECT "ad"."item_id",
            "ad"."ledger_date",
            COALESCE("pa"."total_purchased", (0)::numeric) AS "purchase_qty",
            COALESCE("ca"."closing_qty", (0)::numeric) AS "closing_qty",
            "lag"(COALESCE("ca"."closing_qty", (0)::numeric)) OVER (PARTITION BY "ad"."item_id" ORDER BY "ad"."ledger_date") AS "opening_qty"
           FROM (("all_dates" "ad"
             LEFT JOIN "purchase_agg" "pa" ON ((("pa"."item_id" = "ad"."item_id") AND ("pa"."ledger_date" = "ad"."ledger_date"))))
             LEFT JOIN "closing_agg" "ca" ON ((("ca"."item_id" = "ad"."item_id") AND ("ca"."ledger_date" = "ad"."ledger_date"))))
        )
 SELECT "i"."item_name" AS "Item Name",
    "wpc"."ledger_date" AS "Date",
    "lag"("wpc"."ledger_date") OVER (PARTITION BY "wpc"."item_id" ORDER BY "wpc"."ledger_date") AS "Date For Opening",
    COALESCE("wpc"."opening_qty", (0)::numeric) AS "Opening Quantity",
    "wpc"."purchase_qty" AS "Purchase Quantity",
    GREATEST(((COALESCE("wpc"."opening_qty", (0)::numeric) + "wpc"."purchase_qty") - "wpc"."closing_qty"), (0)::numeric) AS "Sale Quantity",
    "wpc"."closing_qty" AS "Closing Quantity"
   FROM ("with_prev_closing" "wpc"
     JOIN "public"."Inventory_items" "i" ON (("i"."id" = "wpc"."item_id")))
  ORDER BY "wpc"."ledger_date" DESC, "i"."item_name";


ALTER VIEW "public"."Inventory_stock_ledger_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."Inventory_stock_ledger_view" IS 'Live recalculation of the stock ledger from raw transactions. Use to audit stock_ledger table correctness.';



CREATE TABLE IF NOT EXISTS "public"."Inventory_vendors" (
    "id" bigint NOT NULL,
    "vendor_name" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "shop_id" bigint,
    "contact_number" character varying(50)
);


ALTER TABLE "public"."Inventory_vendors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."Inventory_v_purchase_summary" AS
 SELECT "t"."transaction_date",
    "i"."item_name",
    "v"."vendor_name",
    "p"."quantity",
    "p"."purchase_rate",
    "p"."total_amount"
   FROM ((("public"."Inventory_purchase_items" "p"
     JOIN "public"."Inventory_inventory_transactions" "t" ON (("t"."id" = "p"."transaction_id")))
     JOIN "public"."Inventory_items" "i" ON (("i"."id" = "p"."item_id")))
     LEFT JOIN "public"."Inventory_vendors" "v" ON (("v"."id" = "p"."vendor_id")));


ALTER VIEW "public"."Inventory_v_purchase_summary" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."Inventory_vendors_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."Inventory_vendors_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."Inventory_vendors_id_seq" OWNED BY "public"."Inventory_vendors"."id";



ALTER TABLE ONLY "public"."Inventory_app_users" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_app_users_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_closing_stock_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_closing_stock_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_daily_sales_summary" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_daily_sales_summary_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_inventory_transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_inventory_transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_purchase_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_purchase_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_sale_history" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_sale_history_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_shop" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_shop_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_stock_ledger" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_stock_ledger_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_vendors" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."Inventory_vendors_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Inventory_app_users"
    ADD CONSTRAINT "Inventory_app_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_app_users"
    ADD CONSTRAINT "Inventory_app_users_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."Inventory_closing_stock_items"
    ADD CONSTRAINT "Inventory_closing_stock_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_daily_sales_summary"
    ADD CONSTRAINT "Inventory_daily_sales_summary_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_daily_sales_summary"
    ADD CONSTRAINT "Inventory_daily_sales_summary_transaction_id_key" UNIQUE ("transaction_id");



ALTER TABLE ONLY "public"."Inventory_inventory_transactions"
    ADD CONSTRAINT "Inventory_inventory_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_items"
    ADD CONSTRAINT "Inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_manager_report"
    ADD CONSTRAINT "Inventory_manager_report_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_purchase_items"
    ADD CONSTRAINT "Inventory_purchase_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_sale_history"
    ADD CONSTRAINT "Inventory_sale_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_shop"
    ADD CONSTRAINT "Inventory_shop_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_stock_ledger"
    ADD CONSTRAINT "Inventory_stock_ledger_item_id_ledger_date_key" UNIQUE ("item_id", "ledger_date");



ALTER TABLE ONLY "public"."Inventory_stock_ledger"
    ADD CONSTRAINT "Inventory_stock_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_vendors"
    ADD CONSTRAINT "Inventory_vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Inventory_vendors"
    ADD CONSTRAINT "Inventory_vendors_vendor_name_key" UNIQUE ("vendor_name");



CREATE INDEX "Inventory_idx_app_users_username" ON "public"."Inventory_app_users" USING "btree" ("username");



CREATE INDEX "Inventory_idx_closing_stock_item" ON "public"."Inventory_closing_stock_items" USING "btree" ("item_id");



CREATE INDEX "Inventory_idx_closing_stock_transaction" ON "public"."Inventory_closing_stock_items" USING "btree" ("transaction_id");



CREATE INDEX "Inventory_idx_daily_sales_transaction" ON "public"."Inventory_daily_sales_summary" USING "btree" ("transaction_id");



CREATE INDEX "Inventory_idx_inventory_transactions_date" ON "public"."Inventory_inventory_transactions" USING "btree" ("transaction_date");



CREATE INDEX "Inventory_idx_inventory_transactions_type" ON "public"."Inventory_inventory_transactions" USING "btree" ("transaction_type");



CREATE INDEX "Inventory_idx_items_name" ON "public"."Inventory_items" USING "btree" ("item_name");



CREATE INDEX "Inventory_idx_purchase_items_item" ON "public"."Inventory_purchase_items" USING "btree" ("item_id");



CREATE INDEX "Inventory_idx_purchase_items_transaction" ON "public"."Inventory_purchase_items" USING "btree" ("transaction_id");



CREATE INDEX "Inventory_idx_purchase_items_vendor" ON "public"."Inventory_purchase_items" USING "btree" ("vendor_id");



CREATE INDEX "Inventory_idx_stock_ledger_date" ON "public"."Inventory_stock_ledger" USING "btree" ("ledger_date" DESC);



CREATE INDEX "Inventory_idx_stock_ledger_item_date" ON "public"."Inventory_stock_ledger" USING "btree" ("item_id", "ledger_date" DESC);



CREATE INDEX "Inventory_idx_vendors_name" ON "public"."Inventory_vendors" USING "btree" ("vendor_name");



CREATE OR REPLACE TRIGGER "Inventory_trg_after_closing_change" AFTER DELETE OR UPDATE ON "public"."Inventory_closing_stock_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_after_closing_change"();



CREATE OR REPLACE TRIGGER "Inventory_trg_after_closing_insert" AFTER INSERT ON "public"."Inventory_closing_stock_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_after_closing_insert"();



CREATE OR REPLACE TRIGGER "Inventory_trg_after_closing_stock_insert" AFTER INSERT ON "public"."Inventory_closing_stock_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_after_closing_stock_insert"();

ALTER TABLE "public"."Inventory_closing_stock_items" DISABLE TRIGGER "Inventory_trg_after_closing_stock_insert";



CREATE OR REPLACE TRIGGER "Inventory_trg_after_purchase_change" AFTER DELETE OR UPDATE ON "public"."Inventory_purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_after_purchase_change"();



CREATE OR REPLACE TRIGGER "Inventory_trg_after_purchase_insert" AFTER INSERT ON "public"."Inventory_purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_after_purchase_insert"();



CREATE OR REPLACE TRIGGER "Inventory_trg_after_purchase_item_insert" AFTER INSERT ON "public"."Inventory_purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_after_purchase_item_insert"();

ALTER TABLE "public"."Inventory_purchase_items" DISABLE TRIGGER "Inventory_trg_after_purchase_item_insert";



CREATE OR REPLACE TRIGGER "Inventory_trg_stock_ledger_updated_at" BEFORE UPDATE ON "public"."Inventory_stock_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_set_stock_ledger_updated_at"();



CREATE OR REPLACE TRIGGER "Inventory_trg_sync_current_stock_closing" BEFORE INSERT OR UPDATE ON "public"."Inventory_closing_stock_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_validate_closing_stock"();

ALTER TABLE "public"."Inventory_closing_stock_items" DISABLE TRIGGER "Inventory_trg_sync_current_stock_closing";



CREATE OR REPLACE TRIGGER "Inventory_trg_sync_current_stock_purchase" AFTER INSERT OR DELETE OR UPDATE ON "public"."Inventory_purchase_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_sync_current_stock"();

ALTER TABLE "public"."Inventory_purchase_items" DISABLE TRIGGER "Inventory_trg_sync_current_stock_purchase";



CREATE OR REPLACE TRIGGER "Inventory_trg_validate_closing" BEFORE INSERT OR UPDATE ON "public"."Inventory_closing_stock_items" FOR EACH ROW EXECUTE FUNCTION "public"."Inventory_fn_validate_closing"();



ALTER TABLE ONLY "public"."Inventory_app_users"
    ADD CONSTRAINT "Inventory_app_users_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."Inventory_shop"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Inventory_closing_stock_items"
    ADD CONSTRAINT "Inventory_closing_stock_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."Inventory_items"("id");



ALTER TABLE ONLY "public"."Inventory_closing_stock_items"
    ADD CONSTRAINT "Inventory_closing_stock_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."Inventory_shop"("id");



ALTER TABLE ONLY "public"."Inventory_closing_stock_items"
    ADD CONSTRAINT "Inventory_closing_stock_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."Inventory_inventory_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory_daily_sales_summary"
    ADD CONSTRAINT "Inventory_daily_sales_summary_shop_name_fkey" FOREIGN KEY ("shop_name") REFERENCES "public"."Inventory_shop"("id");



ALTER TABLE ONLY "public"."Inventory_daily_sales_summary"
    ADD CONSTRAINT "Inventory_daily_sales_summary_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."Inventory_inventory_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory_inventory_transactions"
    ADD CONSTRAINT "Inventory_inventory_transactions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."Inventory_shop"("id");



ALTER TABLE ONLY "public"."Inventory_items"
    ADD CONSTRAINT "Inventory_items_shop_name_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."Inventory_shop"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory_purchase_items"
    ADD CONSTRAINT "Inventory_purchase_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."Inventory_items"("id");



ALTER TABLE ONLY "public"."Inventory_purchase_items"
    ADD CONSTRAINT "Inventory_purchase_items_shop_name_fkey" FOREIGN KEY ("shop_name") REFERENCES "public"."Inventory_shop"("id");



ALTER TABLE ONLY "public"."Inventory_purchase_items"
    ADD CONSTRAINT "Inventory_purchase_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."Inventory_inventory_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory_purchase_items"
    ADD CONSTRAINT "Inventory_purchase_items_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."Inventory_vendors"("id");



ALTER TABLE ONLY "public"."Inventory_sale_history"
    ADD CONSTRAINT "Inventory_sale_history_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."Inventory_shop"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."Inventory_stock_ledger"
    ADD CONSTRAINT "Inventory_stock_ledger_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."Inventory_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Inventory_vendors"
    ADD CONSTRAINT "Inventory_vendors_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "public"."Inventory_shop"("id");



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_stock_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_stock_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_closing_stock_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_item_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_item_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_after_purchase_item_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_cascade_recalculate"("p_item_id" bigint, "p_from_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_cascade_recalculate"("p_item_id" bigint, "p_from_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_cascade_recalculate"("p_item_id" bigint, "p_from_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_get_current_stock"("p_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_get_current_stock"("p_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_get_current_stock"("p_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_midnight_stock_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_midnight_stock_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_midnight_stock_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_recalculate_current_stock"("p_item_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_recalculate_current_stock"("p_item_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_recalculate_current_stock"("p_item_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_set_stock_ledger_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_set_stock_ledger_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_set_stock_ledger_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_stock_as_of"("p_item_id" bigint, "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_stock_as_of"("p_item_id" bigint, "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_stock_as_of"("p_item_id" bigint, "p_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_sync_current_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_sync_current_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_sync_current_stock"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_validate_closing"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_validate_closing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_validate_closing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."Inventory_fn_validate_closing_stock"() TO "anon";
GRANT ALL ON FUNCTION "public"."Inventory_fn_validate_closing_stock"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Inventory_fn_validate_closing_stock"() TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_app_users" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_app_users" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_app_users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_app_users_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_app_users_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_app_users_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_closing_stock_items" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_closing_stock_items" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_closing_stock_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_closing_stock_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_closing_stock_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_closing_stock_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_daily_sales_summary" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_daily_sales_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_daily_sales_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_daily_sales_summary_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_daily_sales_summary_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_daily_sales_summary_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_inventory_transactions" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_inventory_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_inventory_transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_inventory_transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_inventory_transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_inventory_transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_manager_report" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_manager_report" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_manager_report" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_manager_report_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_manager_report_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_manager_report_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_purchase_items" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_purchase_items" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_purchase_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_purchase_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_purchase_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_purchase_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_sale_history" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_sale_history" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_sale_history" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_sale_history_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_sale_history_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_sale_history_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_shop" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_shop" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_shop" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_shop_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_shop_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_shop_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_stock_ledger" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_stock_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_stock_ledger" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_stock_ledger_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_stock_ledger_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_stock_ledger_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_stock_ledger_view" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_stock_ledger_view" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_stock_ledger_view" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_vendors" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_vendors" TO "service_role";



GRANT ALL ON TABLE "public"."Inventory_v_purchase_summary" TO "anon";
GRANT ALL ON TABLE "public"."Inventory_v_purchase_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."Inventory_v_purchase_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Inventory_vendors_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Inventory_vendors_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Inventory_vendors_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- ── Added for Petty Cash Counter Assignment feature ──

CREATE TABLE IF NOT EXISTS public.master_counter (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Populate default counters if not present
INSERT INTO public.master_counter (name) VALUES 
('COUNTER-1'),
('COUNTER-2'),
('COUNTER-3')
ON CONFLICT (name) DO NOTHING;

-- Add counter_access column to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS counter_access text[] DEFAULT '{}'::text[];

-- ── Added for Petty Cash Master Expenses feature ──

CREATE TABLE IF NOT EXISTS public.master_expenses (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name text UNIQUE NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Populate default expense dropdown options
INSERT INTO public.master_expenses (name) VALUES 
('Advance Amount'),
('Breakage Amount'),
('Custom Expense Name'),
('Medical Amount'),
('Incentive'),
('Shop Name')
ON CONFLICT (name) DO NOTHING;

-- ── Added for Petty Cash Expenses table ──
CREATE TABLE IF NOT EXISTS public.petty_cash_expense (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    patty_id text UNIQUE NOT NULL,
    date date NOT NULL,
    opening_qty numeric(12, 2) DEFAULT 0 NOT NULL,
    closing numeric(12, 2) DEFAULT 0 NOT NULL,
    shop_name text NOT NULL,
    tea_nasta numeric(12, 2) DEFAULT 0 NOT NULL,
    water_jar numeric(12, 2) DEFAULT 0 NOT NULL,
    light_bill numeric(12, 2) DEFAULT 0 NOT NULL,
    recharge numeric(12, 2) DEFAULT 0 NOT NULL,
    post_office numeric(12, 2) DEFAULT 0 NOT NULL,
    customer_discount numeric(12, 2) DEFAULT 0 NOT NULL,
    repair_maintenance numeric(12, 2) DEFAULT 0 NOT NULL,
    stationary numeric(12, 2) DEFAULT 0 NOT NULL,
    petrol numeric(12, 2) DEFAULT 0 NOT NULL,
    patil_petrol numeric(12, 2) DEFAULT 0 NOT NULL,
    excise_police numeric(12, 2) DEFAULT 0 NOT NULL,
    desi_bhada numeric(12, 2) DEFAULT 0 NOT NULL,
    room_expense numeric(12, 2) DEFAULT 0 NOT NULL,
    office_expense numeric(12, 2) DEFAULT 0 NOT NULL,
    personal_expense numeric(12, 2) DEFAULT 0 NOT NULL,
    misc_expense numeric(12, 2) DEFAULT 0 NOT NULL,
    misc_remarks text,
    other_purchase_voucher_no text,
    other_vendor_payment numeric(12, 2) DEFAULT 0 NOT NULL,
    difference_amount numeric(12, 2) DEFAULT 0 NOT NULL,
    credit_card_charges numeric(12, 2) DEFAULT 0 NOT NULL,
    username text NOT NULL,
    total_expense numeric(12, 2) DEFAULT 0 NOT NULL,
    transaction_status text DEFAULT 'Pending'::text NOT NULL,
    total_amount numeric(12, 2) DEFAULT 0 NOT NULL,
    expense_name text,
    employee_name text,
    from_shop text,
    to_shop text,
    description text,
    amount numeric(12, 2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);