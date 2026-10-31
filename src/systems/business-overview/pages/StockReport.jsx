import { Fragment, useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet, RefreshCw, Search, Calendar, Store, Download, AlertTriangle,
  ChevronRight, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import useStockRange from '../stock/useStockRange';
import { getDefaultDateRange, todayISO } from '../stock/stockData';

const PAGE_SIZE = 100;
const EPS = 0.01;

const VIEWS = [
  { id: 'item', label: 'Item-wise' },
  { id: 'shop', label: 'Shop-wise' },
  { id: 'category', label: 'Category-wise' },
  { id: 'detail', label: 'Detail' }
];

// Detail view: one row per shop + date + item, with every stock balance column
// key, header label, header align, cell render, cell class
const fmtMoney0 = (n) => `₹${n}`;
const DETAIL_COLUMNS = [
  ['shop', 'Shop', '', (r) => r.shop || '—', 'font-bold text-indigo-900'],
  ['date', 'Date', '', (r) => r.date || '—', 'text-slate-600 font-mono text-[11px]'],
  ['itemId', 'Item ID', '', (r) => r.itemId || '—', 'text-slate-600 font-mono text-[11px]'],
  ['label', 'Item Name', '', (r) => r.label, 'font-bold text-slate-900'],
  ['opening', 'Opening Qty', 'text-right', (r) => r.opening, 'text-right font-mono text-slate-600'],
  ['qtyIn', 'Qty In', 'text-right', (r) => `+${r.qtyIn}`, 'text-right font-mono text-emerald-600 font-semibold'],
  ['qtyOut', 'Qty Out', 'text-right', (r) => `-${r.qtyOut}`, 'text-right font-mono text-amber-600 font-semibold'],
  ['closing', 'Closing Qty', 'text-right', (r) => r.closing, 'text-right font-mono font-bold text-indigo-700 bg-indigo-50/40'],
  ['purchaseRate', 'Purchase Rate', 'text-right', (r) => fmtMoney0(r.purchaseRate), 'text-right font-mono text-slate-700'],
  ['mrpRate', 'MRP Rate', 'text-right', (r) => fmtMoney0(r.mrpRate), 'text-right font-mono text-slate-700 font-semibold'],
  ['subhead', 'Subhead', '', (r) => r.subhead || '—', 'text-slate-600'],
  ['brandId', 'Brand ID', '', (r) => (r.brandId === '' ? '—' : r.brandId), 'text-slate-600 font-mono text-[11px]'],
  ['brandName', 'Brand Name', '', (r) => r.brandName || '—', 'text-slate-800 font-semibold'],
  ['liquorType', 'Liquor Type', '', (r) => r.liquorType || '—', 'text-slate-600'],
  ['bottlesPerCase', 'B/Cs', 'text-right', (r) => r.bottlesPerCase || '—', 'text-right text-slate-600'],
  ['mls', 'Mls', 'text-right', (r) => (r.mls === '' ? '—' : r.mls), 'text-right text-slate-600'],
  ['types', 'Type 1..6', '', (r) => r.types || '—', 'text-slate-600'],
  ['company', 'Company Name', '', (r) => r.company || '—', 'text-slate-600'],
  ['party', 'Party Name', '', (r) => r.party || '—', 'text-slate-600']
];

// Item-level stock balance columns shown after the totals in the Item/Shop/Category views.
// Group rows have none of these (undefined), so they render as a dash.
const EXTRA_KEYS = ['shop', 'date', 'itemId', 'purchaseRate', 'mrpRate', 'subhead', 'brandId', 'brandName', 'liquorType', 'bottlesPerCase', 'mls', 'types', 'company', 'party'];
const EXTRA_COLUMNS = DETAIL_COLUMNS.filter(([key]) => EXTRA_KEYS.includes(key));
const GROUP_COLUMN_COUNT = 8 + EXTRA_COLUMNS.length; // expander + label + 6 totals + check + extras

const fmtQty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyTotals = () => ({ opening: 0, qtyIn: 0, qtyOut: 0, closing: 0, purchaseValue: 0, mrpValue: 0 });
const addTotals = (t, l) => {
  t.opening += l.opening;
  t.qtyIn += l.qtyIn;
  t.qtyOut += l.qtyOut;
  t.closing += l.closing;
  t.purchaseValue += l.purchaseValue;
  t.mrpValue += l.mrpValue;
};
// Opening + In - Out should equal Closing; a gap means an adjustment or a bad snapshot
const hasGap = (t) => Math.abs(t.opening + t.qtyIn - t.qtyOut - t.closing) > EPS;

// Roll shop+item lines up by itemId (used for item-wise rows and for the items inside a group)
function rollUpItems(lines) {
  const map = new Map();
  lines.forEach((l) => {
    let it = map.get(l.itemId);
    if (!it) {
      it = {
        key: l.itemId, label: l.name || l.itemId, sub: l.itemId, gaps: 0, ...emptyTotals(),
        itemId: l.itemId, shops: new Set(), firstDate: l.firstDate, lastDate: l.lastDate,
        purchaseRate: l.purchaseRate, mrpRate: l.mrpRate, subhead: l.subhead, brandId: l.brandId,
        brandName: l.brandName, liquorType: l.liquorType, bottlesPerCase: l.bottlesPerCase,
        mls: l.mls, types: l.types, company: l.company, party: l.party
      };
      map.set(l.itemId, it);
    }
    addTotals(it, l);
    if (hasGap(l)) it.gaps++;
    it.shops.add(l.shop);
    if (l.firstDate < it.firstDate) it.firstDate = l.firstDate;
    if (l.lastDate >= it.lastDate) {
      it.lastDate = l.lastDate;
      it.purchaseRate = l.purchaseRate;
      it.mrpRate = l.mrpRate;
    }
  });
  return [...map.values()].map(({ shops, ...it }) => ({
    ...it,
    shop: shops.size === 1 ? [...shops][0] : `${shops.size} shops`,
    date: it.firstDate === it.lastDate ? it.firstDate : `${it.firstDate} → ${it.lastDate}`
  }));
}

function buildGroups(lines, keyFn, labelFn) {
  const map = new Map();
  lines.forEach((l) => {
    const key = keyFn(l);
    let g = map.get(key);
    if (!g) {
      g = { key, label: labelFn(l), lines: [], gaps: 0, ...emptyTotals() };
      map.set(key, g);
    }
    g.lines.push(l);
    addTotals(g, l);
    if (hasGap(l)) g.gaps++;
  });
  return [...map.values()].map(({ lines: ls, ...g }) => ({
    ...g,
    sub: `${rollUpItems(ls).length} items`,
    children: rollUpItems(ls).sort((a, b) => a.label.localeCompare(b.label))
  }));
}

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function StockReport() {
  const [startDate, setStartDate] = useState(() => getDefaultDateRange().start);
  const [endDate, setEndDate] = useState(() => getDefaultDateRange().end);
  const [view, setView] = useState('item');
  const [shopFilter, setShopFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [hideIdle, setHideIdle] = useState(true);
  const [sort, setSort] = useState({ key: 'label', dir: 'asc' });
  const [expanded, setExpanded] = useState(new Set());
  const [page, setPage] = useState(1);

  // Shared per-day cache: days already loaded by another stock page are not fetched again
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
  const handleSort = (key) => {
    // text columns start ascending, number columns descending
    const isText = ['label', 'shop', 'date', 'itemId', 'subhead', 'brandId', 'brandName', 'liquorType', 'types', 'company', 'party'].includes(key);
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: isText ? 'asc' : 'desc' }));
    setPage(1);
  };
  const changeView = (id) => {
    setView(id);
    setExpanded(new Set());
    setPage(1);
  };

  const shops = useMemo(() => [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort(), [rows]);
  const types = useMemo(() => [...new Set(rows.map((r) => r.liquor_type).filter(Boolean))].sort(), [rows]);

  // One line per shop + item: opening of its first day, movement over the range, closing of its last day
  const lines = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byKey = new Map();
    rows.forEach((r) => {
      if (shopFilter && r.store_name !== shopFilter) return;
      if (typeFilter && r.liquor_type !== typeFilter) return;
      if (term && !`${r.item_description || ''} ${r.item_id || ''} ${r.subhead || ''} ${r.brand_name || ''} ${r.party_name || ''} ${r.company_name || ''}`.toLowerCase().includes(term)) return;

      const key = `${r.store_name}||${r.item_id}`;
      let l = byKey.get(key);
      if (!l) {
        l = {
          shop: r.store_name,
          itemId: r.item_id,
          name: r.item_description,
          liquorType: r.liquor_type || '—',
          subhead: r.subhead || '—',
          firstDate: r.snapshot_date,
          lastDate: r.snapshot_date,
          opening: Number(r.opening_qty) || 0,
          qtyIn: 0,
          qtyOut: 0,
          closing: Number(r.closing_qty) || 0,
          purchaseRate: Number(r.purchase_bottle_rate) || 0,
          mrpRate: Number(r.mrp_bottle_rate) || 0,
          brandId: r.brand_id ?? '',
          brandName: r.brand_name || '',
          bottlesPerCase: Number(r.bottles_per_case) || 0,
          mls: r.mls ?? '',
          types: [r.type1, r.type2, r.type3, r.type4, r.type5, r.type6].filter(Boolean).join(', '),
          company: r.company_name || '',
          party: r.party_name || ''
        };
        byKey.set(key, l);
      }
      l.qtyIn += Number(r.qty_in) || 0;
      l.qtyOut += Number(r.qty_out) || 0;
      if (r.snapshot_date < l.firstDate) {
        l.firstDate = r.snapshot_date;
        l.opening = Number(r.opening_qty) || 0;
      }
      if (r.snapshot_date >= l.lastDate) {
        l.lastDate = r.snapshot_date;
        l.closing = Number(r.closing_qty) || 0;
        l.purchaseRate = Number(r.purchase_bottle_rate) || 0;
        l.mrpRate = Number(r.mrp_bottle_rate) || 0;
      }
    });

    return [...byKey.values()]
      .map((l) => ({ ...l, purchaseValue: l.closing * l.purchaseRate, mrpValue: l.closing * l.mrpRate }))
      .filter((l) => !hideIdle || l.qtyIn !== 0 || l.qtyOut !== 0);
  }, [rows, shopFilter, typeFilter, search, hideIdle]);

  // Detail view rows: every snapshot row that passes the filters, not rolled up
  const detailRows = useMemo(() => {
    if (view !== 'detail') return [];
    const term = search.trim().toLowerCase();
    const out = [];
    rows.forEach((r) => {
      if (shopFilter && r.store_name !== shopFilter) return;
      if (typeFilter && r.liquor_type !== typeFilter) return;
      if (term && !`${r.item_description || ''} ${r.item_id || ''} ${r.subhead || ''} ${r.brand_name || ''} ${r.party_name || ''} ${r.company_name || ''}`.toLowerCase().includes(term)) return;
      const qtyIn = Number(r.qty_in) || 0;
      const qtyOut = Number(r.qty_out) || 0;
      if (hideIdle && qtyIn === 0 && qtyOut === 0) return;
      out.push({
        key: `${r.store_name}||${r.snapshot_date}||${r.item_id}`,
        shop: r.store_name || '',
        date: r.snapshot_date || '',
        itemId: r.item_id || '',
        label: r.item_description || r.item_id || '',
        opening: Number(r.opening_qty) || 0,
        qtyIn,
        qtyOut,
        closing: Number(r.closing_qty) || 0,
        purchaseRate: Number(r.purchase_bottle_rate) || 0,
        mrpRate: Number(r.mrp_bottle_rate) || 0,
        subhead: r.subhead || '',
        brandId: r.brand_id ?? '',
        brandName: r.brand_name || '',
        liquorType: r.liquor_type || '',
        bottlesPerCase: Number(r.bottles_per_case) || 0,
        mls: r.mls ?? '',
        types: [r.type1, r.type2, r.type3, r.type4, r.type5, r.type6].filter(Boolean).join(', '),
        company: r.company_name || '',
        party: r.party_name || ''
      });
    });
    return out;
  }, [rows, view, shopFilter, typeFilter, search, hideIdle]);

  const tableRows = useMemo(() => {
    if (view === 'detail') {
      const mul = sort.dir === 'asc' ? 1 : -1;
      return [...detailRows].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        const cmp = typeof av === 'string' || typeof bv === 'string'
          ? String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
          : av - bv;
        return cmp * mul || a.label.localeCompare(b.label) || a.shop.localeCompare(b.shop);
      });
    }
    let list;
    if (view === 'shop') list = buildGroups(lines, (l) => l.shop, (l) => l.shop);
    else if (view === 'category') list = buildGroups(lines, (l) => `${l.liquorType}||${l.subhead}`, (l) => `${l.liquorType} / ${l.subhead}`);
    else list = rollUpItems(lines).map((r) => ({ ...r, children: null }));

    const mul = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === 'string' || typeof bv === 'string'
        ? String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
        : (av ?? 0) - (bv ?? 0);
      return cmp * mul || a.label.localeCompare(b.label);
    });
  }, [lines, view, sort, detailRows]);

  const grand = useMemo(() => {
    const t = emptyTotals();
    lines.forEach((l) => addTotals(t, l));
    return { ...t, gaps: lines.filter(hasGap).length };
  }, [lines]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const pageRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const exportCsv = () => {
    if (view === 'detail') {
      const detailOut = [DETAIL_COLUMNS.map(([, label]) => label)];
      tableRows.forEach((r) => detailOut.push(DETAIL_COLUMNS.map(([key]) => r[key])));
      const blob = new Blob(['﻿' + detailOut.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-report_detail_${startDate}_to_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const head = ['Group', 'Item', 'Opening Qty', 'Qty In', 'Qty Out', 'Closing Qty', 'Purchase Value', 'MRP Value'];
    const num = (r) => [r.opening, r.qtyIn, r.qtyOut, r.closing, r.purchaseValue.toFixed(2), r.mrpValue.toFixed(2)];
    const out = [head];
    tableRows.forEach((r) => {
      if (r.children) {
        out.push([r.label, '', ...num(r)]);
        r.children.forEach((c) => out.push([r.label, c.label, ...num(c)]));
      } else {
        out.push(['', r.label, ...num(r)]);
      }
    });
    const blob = new Blob(['﻿' + out.map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-report_${view}_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadingLabel = progress.total
    ? `Loading stock data... ${progress.done}/${progress.total} days`
    : 'Loading stock data...';

  const headers = [
    ['label', VIEWS.find((v) => v.id === view).label.replace('-wise', ''), ''],
    ['opening', 'Opening Qty', 'text-right'],
    ['qtyIn', 'Qty In', 'text-right'],
    ['qtyOut', 'Qty Out', 'text-right'],
    ['closing', 'Closing Qty', 'text-right'],
    ['purchaseValue', 'Purchase Value', 'text-right'],
    ['mrpValue', 'MRP Value', 'text-right']
  ];

  const renderNums = (r, cls = '') => (
    <>
      <td className={`px-3 py-2.5 text-right font-mono text-slate-600 ${cls}`}>{fmtQty(r.opening)}</td>
      <td className={`px-3 py-2.5 text-right font-mono text-emerald-600 font-semibold ${cls}`}>+{fmtQty(r.qtyIn)}</td>
      <td className={`px-3 py-2.5 text-right font-mono text-amber-600 font-semibold ${cls}`}>-{fmtQty(r.qtyOut)}</td>
      <td className={`px-3 py-2.5 text-right font-mono font-bold text-indigo-700 ${cls}`}>{fmtQty(r.closing)}</td>
      <td className={`px-3 py-2.5 text-right font-mono text-slate-700 ${cls}`}>{fmtMoney(r.purchaseValue)}</td>
      <td className={`px-3 py-2.5 text-right font-mono text-slate-700 ${cls}`}>{fmtMoney(r.mrpValue)}</td>
      <td className={`px-3 py-2.5 text-center ${cls}`}>
        {r.gaps > 0 && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-1.5 py-0.5"
            title="Opening + In − Out does not match Closing"
          >
            <AlertTriangle size={11} />
            {r.gaps > 1 ? r.gaps : ''}
          </span>
        )}
      </td>
      {EXTRA_COLUMNS.map(([key, , , render, colCls]) => (
        <td key={key} className={`px-3 py-2.5 ${colCls.replace(/bg-\S+/g, '')} ${cls}`}>
          {r[key] === undefined ? '—' : render(r)}
        </td>
      ))}
    </>
  );

  const cards = [
    ['Opening', fmtQty(grand.opening), 'text-slate-800'],
    ['Qty In', `+${fmtQty(grand.qtyIn)}`, 'text-emerald-600'],
    ['Qty Out', `-${fmtQty(grand.qtyOut)}`, 'text-amber-600'],
    ['Closing', fmtQty(grand.closing), 'text-indigo-700'],
    ['Purchase Value', fmtMoney(grand.purchaseValue), 'text-slate-800'],
    ['MRP Value', fmtMoney(grand.mrpValue), 'text-slate-800']
  ];

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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Stock Report</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Opening, purchase (in), sale (out) and closing stock for the selected dates
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
        {/* Row 1: view, search, shop, category */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center h-9 bg-slate-100 rounded-xl p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => changeView(v.id)}
                className={`h-8 px-3 text-xs font-semibold rounded-[10px] transition cursor-pointer ${
                  view === v.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item, subhead..."
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

          <div className="flex items-center gap-1.5 h-9 bg-slate-50 border border-slate-200 px-2.5 rounded-xl">
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="">All Liquor Types</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: date range, options */}
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

          <label
            className={`flex items-center gap-1.5 h-9 px-3 text-xs font-semibold border rounded-xl cursor-pointer select-none transition ${
              hideIdle ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <input
              type="checkbox"
              checked={hideIdle}
              onChange={(e) => { setHideIdle(e.target.checked); setPage(1); }}
              className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
            Hide items with no In/Out
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-2xl px-4 py-3">
          Failed to load stock data: {error.message || 'unknown error'}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cards.map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`text-base font-bold font-mono mt-1 truncate ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      {grand.gaps > 0 && (
        <p className="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5 -mt-2">
          <AlertTriangle size={13} />
          {grand.gaps.toLocaleString()} shop-item line{grand.gaps === 1 ? '' : 's'} where Opening + In − Out does not match Closing (stock adjustments or snapshot gaps).
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        <div className="overflow-x-auto overflow-y-auto h-[70vh] min-h-125 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20 shadow-xs">
              <tr>
                {view === 'detail' ? (
                  DETAIL_COLUMNS.map(([key, label, align]) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={`px-3 py-3 cursor-pointer hover:text-white ${align}`}
                      title="Click to sort"
                    >
                      {label}
                      <span className="ml-1 text-indigo-300">{sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                    </th>
                  ))
                ) : (
                  <>
                    {view !== 'item' && <th className="px-3 py-3 w-8" />}
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
                    <th className="px-3 py-3 text-center" title="Opening + In − Out vs Closing">Check</th>
                    {EXTRA_COLUMNS.map(([key, label, align]) => (
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
                  </>
                )}
              </tr>
            </thead>
            <tbody className="font-medium">
              {loading ? (
                <tr>
                  <td colSpan={view === 'detail' ? DETAIL_COLUMNS.length : GROUP_COLUMN_COUNT} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">{loadingLabel}</span>
                    </div>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={view === 'detail' ? DETAIL_COLUMNS.length : GROUP_COLUMN_COUNT} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No stock data for these filters</span>
                      <p className="text-xs text-slate-400">Try another date range, shop or turn off "Hide items with no In/Out".</p>
                    </div>
                  </td>
                </tr>
              ) : view === 'detail' ? (
                pageRows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    {DETAIL_COLUMNS.map(([key, , , render, cls]) => (
                      <td key={key} className={`px-3 py-2.5 ${cls}`}>{render(r)}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <>
                  {pageRows.map((r) => {
                    const open = expanded.has(r.key);
                    const expandable = Boolean(r.children);
                    return (
                      <Fragment key={r.key}>
                        <tr
                          onClick={expandable ? () => toggle(r.key) : undefined}
                          className={`border-b border-slate-100 transition-colors ${
                            expandable ? 'cursor-pointer' : ''
                          } ${open ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                        >
                          {view !== 'item' && (
                            <td className="px-3 py-2.5 text-slate-500">
                              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                          )}
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            {r.label}
                            {r.sub && <span className="ml-2 text-[10px] font-mono font-medium text-slate-400">{r.sub}</span>}
                          </td>
                          {renderNums(r)}
                        </tr>
                        {open &&
                          r.children.map((c) => (
                            <tr key={`${r.key}-${c.key}`} className="bg-slate-50/70 border-b border-slate-100 text-slate-700">
                              <td />
                              <td className="px-3 py-2 font-semibold">
                                {c.label}
                                <span className="ml-2 text-[10px] font-mono font-medium text-slate-400">{c.sub}</span>
                              </td>
                              {renderNums(c)}
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                  <tr className="bg-slate-800 text-white font-bold sticky bottom-0">
                    {view !== 'item' && <td />}
                    <td className="px-3 py-2.5">Grand Total</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtQty(grand.opening)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">+{fmtQty(grand.qtyIn)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">-{fmtQty(grand.qtyOut)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtQty(grand.closing)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtMoney(grand.purchaseValue)}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtMoney(grand.mrpValue)}</td>
                    <td colSpan={1 + EXTRA_COLUMNS.length} />
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
