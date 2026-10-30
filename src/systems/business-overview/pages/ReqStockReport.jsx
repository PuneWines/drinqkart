import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet, Download, RefreshCw, Search, Calendar, Store,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import useStockRange from '../stock/useStockRange';
import { getDefaultDateRange, todayISO } from '../stock/stockData';

const PAGE_SIZE = 100;
const DEFAULT_ORDER_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const fmtQty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });

const daysBetween = (fromISO, toISO) =>
  Math.round((new Date(`${toISO}T00:00:00`) - new Date(`${fromISO}T00:00:00`)) / DAY_MS);

// Required stock: sale over the date range -> per day average -> quantity needed to cover the next N days,
// Current closing qty (last day of the range) is shown for reference and is not subtracted.
export default function ReqStockReport() {
  const [startDate, setStartDate] = useState(() => getDefaultDateRange().start);
  const [endDate, setEndDate] = useState(() => getDefaultDateRange().end);
  const [minSale, setMinSale] = useState('');
  const [orderDays, setOrderDays] = useState(DEFAULT_ORDER_DAYS);
  const [shopFilter, setShopFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ key: 'order', dir: 'desc' });

  const handleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
    setPage(1);
  };

  const { rows, loading, error, progress, refresh } = useStockRange(startDate, endDate);

  const handleStartChange = (value) => {
    if (!value) return;
    setStartDate(value);
    if (endDate < value) setEndDate(value);
    setPage(1);
  };
  const handleEndChange = (value) => {
    if (!value) return;
    setEndDate(value);
    if (startDate > value) setStartDate(value);
    setPage(1);
  };

  const shops = useMemo(() => [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort(), [rows]);

  const rangeDays = Math.max(1, daysBetween(startDate, endDate) + 1);
  const days = Number(orderDays) || 0;

  const items = useMemo(() => {
    // per shop + item: closing of its last day; sale summed over the range
    const perShopItem = new Map();
    rows.forEach((r) => {
      if (shopFilter && r.store_name !== shopFilter) return;
      const key = `${r.store_name}||${r.item_id}`;
      let s = perShopItem.get(key);
      if (!s) {
        s = { itemId: r.item_id, name: r.item_description, lastDate: r.snapshot_date, closing: Number(r.closing_qty) || 0, sale: 0 };
        perShopItem.set(key, s);
      }
      s.sale += Number(r.qty_out) || 0;
      if (r.snapshot_date >= s.lastDate) {
        s.lastDate = r.snapshot_date;
        s.closing = Number(r.closing_qty) || 0;
      }
    });

    // roll the shops up into one line per item
    const byItem = new Map();
    perShopItem.forEach((s) => {
      let it = byItem.get(s.itemId);
      if (!it) {
        it = { itemId: s.itemId, name: s.name, sale: 0, current: 0 };
        byItem.set(s.itemId, it);
      }
      it.sale += s.sale;
      it.current += s.closing;
    });

    return [...byItem.values()].map((it) => {
      // per day is rounded to 1 decimal (as shown), so the order is exactly the displayed per day x days
      const perDay = Math.round((it.sale / rangeDays) * 10) / 10;
      return { ...it, perDay, order: Math.round(perDay * days * 10) / 10 };
    });
  }, [rows, shopFilter, rangeDays, days]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    const minSaleQty = Number(minSale) || 0;
    return items
      .filter((it) => it.sale > 0 && it.sale >= minSaleQty)
      .filter((it) => !term || `${it.name || ''} ${it.itemId || ''}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const { key, dir } = sort;
        const mul = dir === 'asc' ? 1 : -1;
        const cmp = key === 'name' ? (a.name || '').localeCompare(b.name || '') : a[key] - b[key];
        return cmp * mul || (a.name || '').localeCompare(b.name || '');
      });
  }, [items, search, minSale, sort]);

  const totalOrder = useMemo(() => visible.reduce((sum, it) => sum + it.order, 0), [visible]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExport = () => {
    if (!visible.length) {
      toast.error('Nothing to export');
      return;
    }
    const data = visible.map((it) => ({
      'Row Labels': it.name || it.itemId,
      'Sale': it.sale,
      'Current Closing Qty': it.current,
      'Per Day': Number(it.perDay.toFixed(1)),
      [`Order -${days}`]: Number(it.order.toFixed(1))
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Req Stock Report');
    XLSX.writeFile(wb, `Req_Stock_Report_${startDate}_to_${endDate}.xlsx`);
  };

  const loadingLabel = progress.total
    ? `Loading stock data... ${progress.done}/${progress.total} days`
    : 'Loading stock data...';

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden flex flex-col flex-1">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100/80 shadow-sm shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Req Stock Report</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Sale, per day average and the quantity to order to cover the next {days} day{days === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleExport}
            disabled={loading || !visible.length}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-9 pl-9 pr-4 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
            <Store size={14} className="text-slate-400 shrink-0" />
            <select
              value={shopFilter}
              onChange={(e) => { setShopFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="">All Shops</option>
              {shops.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 whitespace-nowrap sm:ml-auto">
            <span className="flex items-center h-9 bg-slate-50 px-3 rounded-xl border border-slate-200/60">
              Items:&nbsp;<b className="text-indigo-900">{visible.length.toLocaleString()}</b>
            </span>
            <span className="flex items-center h-9 bg-slate-50 px-3 rounded-xl border border-slate-200/60">
              Order:&nbsp;<b className="text-indigo-900">{fmtQty(totalOrder)}</b>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={startDate}
              max={todayISO()}
              onChange={(e) => handleStartChange(e.target.value)}
              className="bg-transparent text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={todayISO()}
              onChange={(e) => handleEndChange(e.target.value)}
              className="bg-transparent text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const def = getDefaultDateRange();
              setStartDate(def.start);
              setEndDate(def.end);
              setPage(1);
            }}
            className="h-9 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-3 rounded-xl hover:bg-indigo-50 transition cursor-pointer"
            title="Reset to the last 7 days"
          >
            Reset (7D)
          </button>

          <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Sale threshold (min):</span>
            <input
              type="number"
              min={0}
              value={minSale}
              onChange={(e) => { setMinSale(e.target.value); setPage(1); }}
              placeholder="0"
              title="Show items whose Sale is at least this value"
              className="w-16 bg-transparent text-xs text-slate-700 outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Order for (days):</span>
            <input
              type="number"
              min={1}
              value={orderDays}
              onChange={(e) => setOrderDays(e.target.value)}
              title="Order quantity = per day x this many days"
              className="w-14 bg-transparent text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Per day = sale ÷ {rangeDays} days</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl px-4 py-3">
          Failed to load stock data: {error.message || 'unknown error'}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        <div className="overflow-x-auto overflow-y-auto h-[75vh] min-h-150 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="px-3 py-3 w-12 text-right">#</th>
                {[
                  ['name', 'Row Labels', ''],
                  ['sale', 'Sale', 'text-right'],
                  ['current', 'Current Closing Qty', 'text-right'],
                  ['perDay', 'Per Day', 'text-right'],
                  ['order', `Order -${days}`, 'text-right']
                ].map(([key, label, align]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`px-3 py-3 cursor-pointer hover:text-white ${align}`}
                    title="Click to sort"
                  >
                    {label}
                    <span className="ml-1 text-indigo-300">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">{loadingLabel}</span>
                    </div>
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No items with sales found</span>
                      <p className="text-xs text-slate-400">Try a different date range or shop.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((it, idx) => (
                  <tr key={it.itemId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2.5 text-right text-slate-400 font-mono text-[11px]">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{it.name || it.itemId}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-600 font-semibold">{fmtQty(it.sale)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmtQty(it.current)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-700">{fmtQty(it.perDay)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40">{fmtQty(it.order)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div>
            Showing{' '}
            <span className="font-bold text-slate-800">
              {visible.length ? ((page - 1) * PAGE_SIZE + 1).toLocaleString() : 0}
            </span>
            {'–'}
            <span className="font-bold text-slate-800">{Math.min(page * PAGE_SIZE, visible.length).toLocaleString()}</span>
            {' of '}
            <span className="font-bold text-slate-800">{visible.length.toLocaleString()}</span> items
          </div>
          <div className="flex items-center gap-1">
            {[
              [ChevronsLeft, () => setPage(1), page <= 1, 'First page'],
              [ChevronLeft, () => setPage((p) => Math.max(1, p - 1)), page <= 1, 'Previous page'],
              [ChevronRight, () => setPage((p) => Math.min(totalPages, p + 1)), page >= totalPages, 'Next page'],
              [ChevronsRight, () => setPage(totalPages), page >= totalPages, 'Last page']
            ].map(([Icon, onClick, disabled, title]) => (
              <button
                key={title}
                onClick={onClick}
                disabled={loading || disabled}
                title={title}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <Icon size={14} />
              </button>
            ))}
            <span className="px-2 font-semibold text-slate-600">
              Page {page} / {totalPages}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
