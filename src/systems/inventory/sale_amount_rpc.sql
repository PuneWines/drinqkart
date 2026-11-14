-- ============================================================================
-- Inventory: atomic Sale Amount (Form Entry Desk) functions
-- Run ONCE in the Supabase SQL editor (safe to re-run).
--
-- Why: the Sale Amount submit writes to 3 tables
--   Inventory_inventory_transactions -> Inventory_daily_sales_summary -> Inventory_manager_report
-- Doing that as separate client calls left partial data behind when a later
-- step failed. These functions run each flow inside ONE database transaction:
-- either every table is written or none is.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Repair identity sequences that fell behind MAX(id)
--    (cause of: duplicate key value violates unique constraint "..._pkey")
--    Re-run this after any import/restore that inserted explicit ids.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  seq text;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'Inventory\_%'
  LOOP
    seq := pg_get_serial_sequence(format('public.%I', r.tbl), 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format(
        'SELECT setval(%L, COALESCE((SELECT MAX(id) FROM public.%I), 0) + 1, false)',
        seq, r.tbl
      );
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Helper: recompute running balance for one shop from a date onwards
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inv_recalc_manager_balances(p_shop_name text, p_start_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  running numeric;
  rec record;
BEGIN
  SELECT COALESCE(balance, 0) INTO running
  FROM public."Inventory_manager_report"
  WHERE shop_name = p_shop_name AND report_date < p_start_date
  ORDER BY report_date DESC, id DESC
  LIMIT 1;

  running := COALESCE(running, 0);

  FOR rec IN
    SELECT id, gpay_amount, cash_amount, expense_amount, withdrawal_amount
    FROM public."Inventory_manager_report"
    WHERE shop_name = p_shop_name AND report_date >= p_start_date
    ORDER BY report_date ASC, id ASC
  LOOP
    running := running
      + COALESCE(rec.gpay_amount, 0)
      + COALESCE(rec.cash_amount, 0)
      - COALESCE(rec.expense_amount, 0)
      - COALESCE(rec.withdrawal_amount, 0);

    UPDATE public."Inventory_manager_report"
    SET balance = running, updated_at = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Submit Sale Amount (atomic, one entry per shop per day)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_sale_amount(
  p_date date,
  p_shop_id bigint,
  p_gpay numeric,
  p_cash numeric,
  p_expense numeric,
  p_total_closing numeric,
  p_withdrawal numeric DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_shop_name text;
  v_tx_id bigint;
  v_total_sales numeric := 0;
BEGIN
  -- Resolve shop name
  SELECT shop_name INTO v_shop_name FROM public."Inventory_shop" WHERE id = p_shop_id;
  IF v_shop_name IS NULL THEN
    BEGIN
      EXECUTE 'SELECT COALESCE(shop_name, name) FROM public.shop WHERE id = $1'
        INTO v_shop_name USING p_shop_id;
    EXCEPTION WHEN OTHERS THEN
      v_shop_name := NULL;
    END;
  END IF;

  IF v_shop_name IS NULL OR v_shop_name = '' THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND: shop % does not exist', p_shop_id;
  END IF;

  -- Same-day guard: one Sale Amount entry per shop per date
  IF EXISTS (
    SELECT 1 FROM public."Inventory_inventory_transactions"
    WHERE transaction_type = 'sale_amount'
      AND transaction_date = p_date
      AND shop_id IS NOT DISTINCT FROM p_shop_id
  ) OR EXISTS (
    SELECT 1 FROM public."Inventory_manager_report"
    WHERE report_date = p_date AND shop_name = v_shop_name AND entry_type = 'sales'
  ) THEN
    RAISE EXCEPTION 'SALE_ALREADY_ENTERED: sale amount already entered for % on %', v_shop_name, p_date;
  END IF;

  -- Expected sales = sum(ledger sale_qty * item mrp) for this shop/date
  SELECT COALESCE(SUM(COALESCE(l.sale_qty, 0) * COALESCE(i.mrp, 20)), 0)
  INTO v_total_sales
  FROM public."Inventory_stock_ledger" l
  JOIN public."Inventory_items" i ON i.id = l.item_id
  WHERE l.ledger_date = p_date
    AND i.shop_id IS NOT DISTINCT FROM p_shop_id;

  INSERT INTO public."Inventory_inventory_transactions" (transaction_date, transaction_type, shop_id)
  VALUES (p_date, 'sale_amount', p_shop_id)
  RETURNING id INTO v_tx_id;

  INSERT INTO public."Inventory_daily_sales_summary"
    (transaction_id, gpay_amount, cash_amount, expense_amount, total_closing_amount, "Total_sales_amt", withdrawal_amount)
  VALUES
    (v_tx_id, COALESCE(p_gpay, 0), COALESCE(p_cash, 0), COALESCE(p_expense, 0),
     COALESCE(p_total_closing, 0), v_total_sales, COALESCE(p_withdrawal, 0));

  INSERT INTO public."Inventory_manager_report"
    (report_date, shop_name, entry_type, gpay_amount, cash_amount, expense_amount, withdrawal_amount, balance, updated_at)
  VALUES
    (p_date, v_shop_name, 'sales', COALESCE(p_gpay, 0), COALESCE(p_cash, 0), COALESCE(p_expense, 0),
     COALESCE(p_withdrawal, 0), 0, now());

  PERFORM public.inv_recalc_manager_balances(v_shop_name, p_date);

  RETURN v_tx_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Helper: make the manager report row for (shop, date) equal the SUM of all
--    summary rows for that shop/date (handles dates that have several summary rows).
--    Deletes the manager report row when no summary rows remain.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inv_sync_manager_report_day(p_shop_id bigint, p_shop_name text, p_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
  v_gpay numeric;
  v_cash numeric;
  v_exp numeric;
  v_report_id bigint;
BEGIN
  SELECT count(*), COALESCE(sum(d.gpay_amount),0), COALESCE(sum(d.cash_amount),0), COALESCE(sum(d.expense_amount),0)
  INTO v_count, v_gpay, v_cash, v_exp
  FROM public."Inventory_daily_sales_summary" d
  JOIN public."Inventory_inventory_transactions" t ON t.id = d.transaction_id
  WHERE t.transaction_type = 'sale_amount'
    AND t.transaction_date = p_date
    AND t.shop_id IS NOT DISTINCT FROM p_shop_id;

  IF v_count = 0 THEN
    DELETE FROM public."Inventory_manager_report"
    WHERE report_date = p_date AND shop_name = p_shop_name AND entry_type = 'sales';
  ELSE
    SELECT id INTO v_report_id
    FROM public."Inventory_manager_report"
    WHERE report_date = p_date AND shop_name = p_shop_name AND entry_type = 'sales'
    ORDER BY id LIMIT 1;

    IF v_report_id IS NOT NULL THEN
      UPDATE public."Inventory_manager_report"
      SET gpay_amount = v_gpay, cash_amount = v_cash, expense_amount = v_exp, updated_at = now()
      WHERE id = v_report_id;
    ELSE
      INSERT INTO public."Inventory_manager_report"
        (report_date, shop_name, entry_type, gpay_amount, cash_amount, expense_amount, balance, updated_at)
      VALUES (p_date, p_shop_name, 'sales', v_gpay, v_cash, v_exp, 0, now());
    END IF;
  END IF;

  PERFORM public.inv_recalc_manager_balances(p_shop_name, p_date);
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. Update a saved Sale Amount row (atomic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_sale_amount_summary(
  p_row_id bigint,
  p_gpay numeric,
  p_cash numeric,
  p_expense numeric,
  p_total_closing numeric
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_date date;
  v_shop_id bigint;
  v_shop_name text;
BEGIN
  SELECT t.transaction_date, t.shop_id, s.shop_name
  INTO v_date, v_shop_id, v_shop_name
  FROM public."Inventory_daily_sales_summary" d
  JOIN public."Inventory_inventory_transactions" t ON t.id = d.transaction_id
  LEFT JOIN public."Inventory_shop" s ON s.id = t.shop_id
  WHERE d.id = p_row_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROW_NOT_FOUND: summary row % does not exist', p_row_id;
  END IF;

  UPDATE public."Inventory_daily_sales_summary"
  SET gpay_amount = COALESCE(p_gpay, 0),
      cash_amount = COALESCE(p_cash, 0),
      expense_amount = COALESCE(p_expense, 0),
      total_closing_amount = COALESCE(p_total_closing, 0)
  WHERE id = p_row_id;

  IF v_date IS NOT NULL AND v_shop_name IS NOT NULL THEN
    PERFORM public.inv_sync_manager_report_day(v_shop_id, v_shop_name, v_date);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Delete a saved Sale Amount row (atomic)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_sale_amount_summary(p_row_id bigint)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_tx_id bigint;
  v_date date;
  v_shop_id bigint;
  v_shop_name text;
BEGIN
  SELECT d.transaction_id, t.transaction_date, t.shop_id, s.shop_name
  INTO v_tx_id, v_date, v_shop_id, v_shop_name
  FROM public."Inventory_daily_sales_summary" d
  JOIN public."Inventory_inventory_transactions" t ON t.id = d.transaction_id
  LEFT JOIN public."Inventory_shop" s ON s.id = t.shop_id
  WHERE d.id = p_row_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROW_NOT_FOUND: summary row % does not exist', p_row_id;
  END IF;

  DELETE FROM public."Inventory_daily_sales_summary" WHERE id = p_row_id;

  IF v_tx_id IS NOT NULL THEN
    DELETE FROM public."Inventory_inventory_transactions" WHERE id = v_tx_id;
  END IF;

  IF v_date IS NOT NULL AND v_shop_name IS NOT NULL THEN
    PERFORM public.inv_sync_manager_report_day(v_shop_id, v_shop_name, v_date);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.inv_recalc_manager_balances(text, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.inv_sync_manager_report_day(bigint, text, date) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_sale_amount(date, bigint, numeric, numeric, numeric, numeric, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sale_amount_summary(bigint, numeric, numeric, numeric, numeric) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_sale_amount_summary(bigint) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
