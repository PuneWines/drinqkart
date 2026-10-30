import { QueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';

// Shared data layer for every stock_balance page (Stock Balance Sheet, Stock Report, Valuation Report).
// Snapshots are cached one day at a time, so a page that needs a date range only fetches the days
// that no other page has already loaded.

export const STOCK_TABLE = 'stock_balance';
export const DEFAULT_RANGE_DAYS = 30;

const FETCH_CHUNK = 1000;
const DAY_CONCURRENCY = 4;
const PAST_DAY_STALE_MS = 30 * 60 * 1000;
const TODAY_STALE_MS = 60 * 1000;
const GC_MS = 60 * 60 * 1000;

// Columns that the report pages need; the Stock Balance Sheet keeps its own paged select('*')
export const STOCK_COLUMNS = [
  'store_name', 'snapshot_date', 'item_id', 'item_description', 'liquor_type', 'subhead', 'type5',
  'opening_qty', 'qty_in', 'qty_out', 'closing_qty', 'purchase_bottle_rate', 'mrp_bottle_rate',
  'bottles_per_case'
].join(', ');

// A client of its own: fetchQuery works without a provider, so no wiring in App.jsx is needed
export const stockQueryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: GC_MS, retry: 1 } }
});

export const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayISO = () => toISODate(new Date());

// Default range for every stock page: the last 30 days, ending today
export function getDefaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - (DEFAULT_RANGE_DAYS - 1));
  return { start: toISODate(start), end: toISODate(end) };
}

export function eachDate(start, end) {
  const days = [];
  if (!start || !end || end < start) return days;
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur <= last) {
    days.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const dayKey = (date) => ['stock-day', date];

async function fetchDay(date) {
  const all = [];
  for (let from = 0; ; from += FETCH_CHUNK) {
    const { data, error } = await supabase
      .from(STOCK_TABLE)
      .select(STOCK_COLUMNS)
      .eq('snapshot_date', date)
      .order('store_name', { ascending: true })
      .order('item_id', { ascending: true })
      .range(from, from + FETCH_CHUNK - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < FETCH_CHUNK) break;
  }
  return all;
}

// Rows of one day (all shops), from the cache when fresh enough
export function loadStockDay(date) {
  return stockQueryClient.fetchQuery({
    queryKey: dayKey(date),
    queryFn: () => fetchDay(date),
    staleTime: date >= todayISO() ? TODAY_STALE_MS : PAST_DAY_STALE_MS
  });
}

const isDayCached = (date) => {
  const state = stockQueryClient.getQueryState(dayKey(date));
  if (!state || state.status !== 'success' || state.isInvalidated) return false;
  const staleMs = date >= todayISO() ? TODAY_STALE_MS : PAST_DAY_STALE_MS;
  return Date.now() - state.dataUpdatedAt < staleMs;
};

// Rows for every day in [start, end]. Cached days are reused; only the missing ones are fetched.
// onProgress({ done, total }) fires as days arrive; isCancelled() stops a superseded request early.
export async function loadStockRange(start, end, { onProgress, isCancelled } = {}) {
  const days = eachDate(start, end);
  const total = days.length;
  const byDay = new Map();
  let done = 0;

  const missing = [];
  days.forEach((d) => {
    if (isDayCached(d)) {
      byDay.set(d, stockQueryClient.getQueryData(dayKey(d)) || []);
      done++;
    } else {
      missing.push(d);
    }
  });
  onProgress?.({ done, total });

  let next = 0;
  const worker = async () => {
    while (next < missing.length) {
      if (isCancelled?.()) return;
      const d = missing[next++];
      byDay.set(d, await loadStockDay(d));
      done++;
      onProgress?.({ done, total });
    }
  };
  await Promise.all(Array.from({ length: Math.min(DAY_CONCURRENCY, missing.length) }, worker));

  if (isCancelled?.()) return null;
  return days.flatMap((d) => byDay.get(d) || []);
}

// Most recent snapshot date inside [start, end], or null when there is none
export async function findLatestSnapshotDate(start, end) {
  let query = supabase
    .from(STOCK_TABLE)
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1);
  if (start) query = query.gte('snapshot_date', start);
  if (end) query = query.lte('snapshot_date', end);
  const { data, error } = await query;
  if (error) throw error;
  return data?.[0]?.snapshot_date || null;
}

// Call after any insert / delete on stock_balance so other pages refetch
export function invalidateStockCache() {
  return stockQueryClient.invalidateQueries({ queryKey: ['stock-day'] });
}
