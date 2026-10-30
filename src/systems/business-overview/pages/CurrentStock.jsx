import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Boxes, RefreshCw, Search, Calendar, Store, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { todayISO, loadStockDay, findLatestSnapshotDate, invalidateStockCache } from '../stock/stockData';

const PAGE_SIZE = 100;

const fmtQty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtBox = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Closing Qty (Box) = closing qty / bottles per case
const toBox = (qty, bottlesPerCase) => (bottlesPerCase > 0 ? qty / bottlesPerCase : 0);

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Stock as it stands on one chosen date (a single snapshot, not a range)
export default function CurrentStock() {
  const [date, setDate] = useState(todayISO);
  const [rows, setRows] = useState([]);
  const [snapshotDate, setSnapshotDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [shopFilter, setShopFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'label', dir: 'asc' });
  const [page, setPage] = useState(1);
  const latestRequestRef = useRef(0);

  const fetchRows = useCallback(async () => {
    if (!date) return;
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      // Stock on a date = closing of the latest snapshot on or before it (today may not be snapshotted yet)
      const snap = await findLatestSnapshotDate(null, date);
      if (requestId !== latestRequestRef.current) return;
      if (!snap) {
        setSnapshotDate('');
        setRows([]);
        return;
      }
      const dayRows = await loadStockDay(snap);
      if (requestId !== latestRequestRef.current) return;
      setSnapshotDate(snap);
      setRows(dayRows);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      console.error('Current stock fetch error:', err);
      toast.error('Failed to load stock data: ' + (err.message || 'unknown error'));
      setRows([]);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleRefresh = async () => {
    await invalidateStockCache();
    fetchRows();
  };

  const handleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'label' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const shops = useMemo(() => [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.liquor_type).filter(Boolean))].sort(), [rows]);
  // Categories narrow to the chosen liquor type so the list only offers combinations that exist
  const categories = useMemo(
    () => [...new Set(rows.filter((r) => !typeFilter || r.liquor_type === typeFilter).map((r) => r.subhead).filter(Boolean))].sort(),
    [rows, typeFilter]
  );

  // One line per item, summed over the selected shop(s)
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map();
    rows.forEach((r) => {
      if (shopFilter && r.store_name !== shopFilter) return;
      if (typeFilter && r.liquor_type !== typeFilter) return;
      if (categoryFilter && r.subhead !== categoryFilter) return;
      if (term && !`${r.item_description || ''} ${r.item_id || ''} ${r.subhead || ''}`.toLowerCase().includes(term)) return;

      const closing = Number(r.closing_qty) || 0;
      let it = map.get(r.item_id);
      if (!it) {
        it = {
          key: r.item_id,
          label: r.item_description || r.item_id,
          liquorType: r.liquor_type || '—',
          subhead: r.subhead || '—',
          bottlesPerCase: Number(r.bottles_per_case) || 0,
          closing: 0,
          purchaseValue: 0,
          mrpValue: 0
        };
        map.set(r.item_id, it);
      }
      if (!it.bottlesPerCase) it.bottlesPerCase = Number(r.bottles_per_case) || 0;
      it.closing += closing;
      it.purchaseValue += closing * (Number(r.purchase_bottle_rate) || 0);
      it.mrpValue += closing * (Number(r.mrp_bottle_rate) || 0);
    });
    return [...map.values()].map((it) => ({ ...it, closingBox: toBox(it.closing, it.bottlesPerCase) }));
  }, [rows, shopFilter, typeFilter, categoryFilter, search]);

  const tableRows = useMemo(() => {
    const mul = sort.dir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      const cmp = typeof a[sort.key] === 'string' ? a[sort.key].localeCompare(b[sort.key]) : a[sort.key] - b[sort.key];
      return cmp * mul || a.label.localeCompare(b.label);
    });
  }, [items, sort]);

  const grand = useMemo(
    () =>
      items.reduce(
        (t, it) => ({
          closing: t.closing + it.closing,
          closingBox: t.closingBox + it.closingBox,
          purchaseValue: t.purchaseValue + it.purchaseValue,
          mrpValue: t.mrpValue + it.mrpValue
        }),
        { closing: 0, closingBox: 0, purchaseValue: 0, mrpValue: 0 }
      ),
    [items]
  );

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const out = [['Item ID', 'Item', 'Liquor Type', 'Category', 'Bottles / Case', 'Closing Qty', 'Closing Qty (Box)', 'Purchase Value', 'MRP Value']];
    tableRows.forEach((r) =>
      out.push([r.key, r.label, r.liquorType, r.subhead, r.bottlesPerCase, r.closing, r.closingBox.toFixed(2), r.purchaseValue.toFixed(2), r.mrpValue.toFixed(2)])
    );
    const blob = new Blob(['﻿' + out.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `current-stock_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const headers = [
    ['label', 'Item', ''],
    ['liquorType', 'Liquor Type', ''],
    ['subhead', 'Category', ''],
    ['bottlesPerCase', 'Bottles / Case', 'text-right'],
    ['closing', 'Closing Qty', 'text-right'],
    ['closingBox', 'Closing Qty (Box)', 'text-right']
  ];

  const cards = [
    ['Closing Qty', fmtQty(grand.closing), 'text-indigo-700'],
    ['Closing Qty (Box)', fmtBox(grand.closingBox), 'text-indigo-700'],
    ['Items', items.length.toLocaleString(), 'text-slate-800']
  ];

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden flex flex-col flex-1">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100/80 shadow-sm shrink-0">
            <Boxes size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Current Stock</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Closing stock on the selected date · Box = Closing Qty ÷ Bottles per Case
              {snapshotDate && (
                <> · showing closing of <b className="text-slate-700">{snapshotDate}</b>{snapshotDate !== date && ' (latest snapshot on or before the date)'}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={exportCsv}
            disabled={loading || tableRows.length === 0}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-2.5 min-w-0">
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search item, category..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full h-9 pl-9 pr-4 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
          <Calendar size={13} className="text-slate-400 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-500">Date:</span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(e) => { if (e.target.value) { setDate(e.target.value); setPage(1); } }}
            className="bg-transparent text-xs text-slate-700 outline-none font-medium"
          />
        </div>
        <button
          type="button"
          onClick={() => { setDate(todayISO()); setPage(1); }}
          className="h-9 text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-3 rounded-xl hover:bg-indigo-50 transition cursor-pointer"
        >
          Today
        </button>

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

        <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCategoryFilter(''); setPage(1); }}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="">All Liquor Types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer max-w-56"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`text-base font-bold font-mono mt-1 truncate ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        <div className="overflow-x-auto overflow-y-auto h-[70vh] min-h-125 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20 shadow-xs">
              <tr>
                {headers.map(([key, label, align]) => (
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
            <tbody className="font-medium">
              {loading ? (
                <tr>
                  <td colSpan={headers.length} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">Loading stock data...</span>
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Boxes size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No stock data for {date}</span>
                      <p className="text-xs text-slate-400">No snapshot exists on or before this date. Try another date or filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {pageRows.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        {r.label}
                        <span className="ml-2 text-[10px] font-mono font-medium text-slate-400">{r.key}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{r.liquorType}</td>
                      <td className="px-3 py-2.5 text-slate-700">{r.subhead}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.bottlesPerCase || '—'}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700">{fmtQty(r.closing)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700">
                        {r.bottlesPerCase ? fmtBox(r.closingBox) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-800 text-white font-bold sticky bottom-0">
                    <td className="px-3 py-2.5" colSpan={4}>Grand Total</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtQty(grand.closing)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtBox(grand.closingBox)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div>
            Showing{' '}
            <span className="font-bold text-slate-800">
              {tableRows.length ? ((page - 1) * PAGE_SIZE + 1).toLocaleString() : 0}
            </span>
            {'–'}
            <span className="font-bold text-slate-800">{Math.min(page * PAGE_SIZE, tableRows.length).toLocaleString()}</span>
            {' of '}
            <span className="font-bold text-slate-800">{tableRows.length.toLocaleString()}</span> rows
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
