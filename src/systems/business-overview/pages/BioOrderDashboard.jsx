

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ClipboardList, Download, RefreshCw, Search, FileSpreadsheet,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw,
  SlidersHorizontal, Store, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import useStockRange from '../stock/useStockRange';
import { getDefaultDateRange } from '../stock/stockData';

const PAGE_SIZE = 100;
const DEFAULT_REQUIRE_DAYS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// Dynamic, distinct, high-contrast store palettes (auto-cycles for any number of future shops)
const STORE_PALETTES = [
  { header: 'bg-[#1e1b4b]', subHeader: 'bg-[#151239]', cellBg: 'bg-[#eef2ff]/60 group-hover:bg-[#e0e7ff]/90', borderR: 'border-r-2 border-indigo-300', accent: 'text-indigo-200', dot: 'bg-indigo-400', progress: 'bg-indigo-600', name: 'Indigo' },
  { header: 'bg-[#064e3b]', subHeader: 'bg-[#04392b]', cellBg: 'bg-[#ecfdf5]/60 group-hover:bg-[#d1fae5]/90', borderR: 'border-r-2 border-emerald-300', accent: 'text-emerald-200', dot: 'bg-emerald-400', progress: 'bg-emerald-600', name: 'Emerald' },
  { header: 'bg-[#0f4c6c]', subHeader: 'bg-[#0a3850]', cellBg: 'bg-[#ecfeff]/60 group-hover:bg-[#cffafe]/90', borderR: 'border-r-2 border-cyan-300', accent: 'text-cyan-200', dot: 'bg-cyan-400', progress: 'bg-cyan-600', name: 'Cyan' },
  { header: 'bg-[#581c87]', subHeader: 'bg-[#431466]', cellBg: 'bg-[#faf5ff]/60 group-hover:bg-[#f3e8ff]/90', borderR: 'border-r-2 border-purple-300', accent: 'text-purple-200', dot: 'bg-purple-400', progress: 'bg-purple-600', name: 'Purple' },
  { header: 'bg-[#7c2d12]', subHeader: 'bg-[#5d210d]', cellBg: 'bg-[#fffbeb]/60 group-hover:bg-[#fef3c7]/90', borderR: 'border-r-2 border-amber-300', accent: 'text-amber-200', dot: 'bg-amber-400', progress: 'bg-amber-600', name: 'Amber' },
  { header: 'bg-[#831843]', subHeader: 'bg-[#631132]', cellBg: 'bg-[#fff1f2]/60 group-hover:bg-[#ffe4e6]/90', borderR: 'border-r-2 border-rose-300', accent: 'text-rose-200', dot: 'bg-rose-400', progress: 'bg-rose-600', name: 'Rose' },
  { header: 'bg-[#1e3a8a]', subHeader: 'bg-[#172b68]', cellBg: 'bg-[#eff6ff]/60 group-hover:bg-[#dbeafe]/90', borderR: 'border-r-2 border-blue-300', accent: 'text-blue-200', dot: 'bg-blue-400', progress: 'bg-blue-600', name: 'Blue' },
  { header: 'bg-[#134e4a]', subHeader: 'bg-[#0d3b37]', cellBg: 'bg-[#f0fdfa]/60 group-hover:bg-[#ccfbf1]/90', borderR: 'border-r-2 border-teal-300', accent: 'text-teal-200', dot: 'bg-teal-400', progress: 'bg-teal-600', name: 'Teal' },
  { header: 'bg-[#701a75]', subHeader: 'bg-[#541257]', cellBg: 'bg-[#fdf4ff]/60 group-hover:bg-[#fae8ff]/90', borderR: 'border-r-2 border-fuchsia-300', accent: 'text-fuchsia-200', dot: 'bg-fuchsia-400', progress: 'bg-fuchsia-600', name: 'Fuchsia' },
  { header: 'bg-[#312e81]', subHeader: 'bg-[#232062]', cellBg: 'bg-[#f5f3ff]/60 group-hover:bg-[#ede9fe]/90', borderR: 'border-r-2 border-violet-300', accent: 'text-violet-200', dot: 'bg-violet-400', progress: 'bg-violet-600', name: 'Violet' },
];

const getShopPalette = (index) => STORE_PALETTES[index % STORE_PALETTES.length];

const SUB_COLS = [
  { key: 'sale', label: 'Sale', shortLabel: 'Sale', toggle: 'Sale' },
  { key: 'perDay', label: '/Day', shortLabel: '/Day', toggle: 'Per Day' },
  { key: 'closing', label: 'Close', shortLabel: 'Close', toggle: 'Closing' },
  { key: 'ordBtl', label: 'Btl', shortLabel: 'Btl', toggle: 'Ord Btl' },
  { key: 'ordBox', label: 'Box', shortLabel: 'Box', toggle: 'Ord Box' }
];
const BOX_KEYS = ['ordBox', 'inc', 'final'];
const LABELS = { sale: 'Sale', perDay: '/Day', closing: 'Close', ordBtl: 'Btl', ordBox: 'Box', inc: 'Inc', final: 'Final' };

const daysBetween = (fromISO, toISO) =>
  Math.round((new Date(`${toISO}T00:00:00`) - new Date(`${fromISO}T00:00:00`)) / DAY_MS);

const fmtInt = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmt1 = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtBox = (n, roundUp = false) => {
  if (roundUp && n > 0) {
    return Math.ceil(n).toLocaleString('en-IN');
  }
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtCell = (key, v) => (BOX_KEYS.includes(key) ? fmtBox(v) : key === 'perDay' ? fmt1(v) : fmtInt(v));

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function BioOrderDashboard() {
  const [startDate, setStartDate] = useState(() => getDefaultDateRange().start);
  const [endDate, setEndDate] = useState(() => getDefaultDateRange().end);
  const [requireDays, setRequireDays] = useState(String(DEFAULT_REQUIRE_DAYS));
  const [targetBoxes, setTargetBoxes] = useState('');
  const [selectedShops, setSelectedShops] = useState(null); // null = all
  const [hideNegative, setHideNegative] = useState(false);
  const [colToggles, setColToggles] = useState({ sale: true, perDay: false, closing: true, ordBtl: false, ordBox: true });
  const [viewMode, setViewMode] = useState('full'); // 'full' or 'compact'
  const [roundUpBoxes, setRoundUpBoxes] = useState(false); // Round cases up to full box
  const [sortField, setSortField] = useState('ordBox'); // 'ordBox', 'sale', 'name', 'bpc'
  const [sortAsc, setSortAsc] = useState(false);
  const [liquorType, setLiquorType] = useState('');
  const [supplier, setSupplier] = useState('');
  const [company, setCompany] = useState('');
  const [brand, setBrand] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showShopsDropdown, setShowShopsDropdown] = useState(false);
  const [showColsDropdown, setShowColsDropdown] = useState(false);
  const shopsDropdownRef = useRef(null);
  const colsDropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (shopsDropdownRef.current && !shopsDropdownRef.current.contains(e.target)) {
        setShowShopsDropdown(false);
      }
      if (colsDropdownRef.current && !colsDropdownRef.current.contains(e.target)) {
        setShowColsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { rows, loading, error, refresh } = useStockRange(startDate, endDate);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim().toLowerCase()); setPage(1); }, 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  const rangeDays = Math.max(1, daysBetween(startDate, endDate) + 1);
  const divisor = rangeDays;
  const reqDays = Number(requireDays) || 0;
  const target = Number(targetBoxes) || 0;
  const targetActive = target > 0;

  const handleStartChange = (v) => {
    if (!v) return;
    setStartDate(v);
    if (endDate < v) setEndDate(v);
    setPage(1);
  };
  const handleEndChange = (v) => {
    if (!v) return;
    setEndDate(v);
    if (startDate > v) setStartDate(v);
    setPage(1);
  };

  const allShops = useMemo(() => [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort(), [rows]);
  const activeShops = useMemo(
    () => (selectedShops ? allShops.filter((s) => selectedShops.includes(s)) : allShops),
    [allShops, selectedShops]
  );

  const toggleShop = (shop) => {
    const cur = selectedShops || allShops;
    const next = cur.includes(shop) ? cur.filter((s) => s !== shop) : [...cur, shop];
    setSelectedShops(next.length === allShops.length ? null : next);
    setPage(1);
  };

  // Base aggregation per item
  const baseItems = useMemo(() => {
    const byItem = new Map();
    rows.forEach((r) => {
      const shop = r.store_name;
      if (!shop || !r.item_id) return;
      let it = byItem.get(r.item_id);
      if (!it) {
        it = {
          itemId: r.item_id,
          name: r.item_description || r.item_id,
          mls: r.mls,
          liquorType: r.liquor_type || '',
          brand: r.brand_name || '',
          supplier: r.party_name || r.company_name || '',
          company: r.company_name || '',
          bpc: 0,
          shops: new Map()
        };
        byItem.set(r.item_id, it);
      }
      const bpc = Number(r.bottles_per_case) || 0;
      if (bpc > 0) it.bpc = bpc;
      let s = it.shops.get(shop);
      if (!s) {
        s = { sale: 0, closing: 0, lastDate: '' };
        it.shops.set(shop, s);
      }
      s.sale += Number(r.qty_out) || 0;
      if (r.snapshot_date >= s.lastDate) {
        s.lastDate = r.snapshot_date;
        s.closing = Number(r.closing_qty) || 0;
      }
    });
    return [...byItem.values()];
  }, [rows]);

  const uniq = (key) => [...new Set(baseItems.map((i) => i[key]).filter(Boolean))].sort();
  const liquorTypes = useMemo(() => uniq('liquorType'), [baseItems]); // eslint-disable-line react-hooks/exhaustive-deps
  const suppliers = useMemo(() => uniq('supplier'), [baseItems]); // eslint-disable-line react-hooks/exhaustive-deps
  const companies = useMemo(() => uniq('company'), [baseItems]); // eslint-disable-line react-hooks/exhaustive-deps
  const brands = useMemo(() => uniq('brand'), [baseItems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculations + proportional allocation engine + dynamic sorting
  const calc = useMemo(() => {
    const term = search;
    const items = baseItems
      .filter((it) => !liquorType || it.liquorType === liquorType)
      .filter((it) => !supplier || it.supplier === supplier)
      .filter((it) => !company || it.company === company)
      .filter((it) => !brand || it.brand === brand)
      .filter((it) => !term || `${it.name} ${it.itemId}`.toLowerCase().includes(term))
      .map((it) => {
        const cells = {};
        activeShops.forEach((shop) => {
          const s = it.shops.get(shop);
          if (!s) return;
          const perDay = s.sale / divisor;
          const ordBtl = perDay * reqDays - s.closing;
          const ordBox = it.bpc > 0 ? ordBtl / it.bpc : 0;
          cells[shop] = { sale: s.sale, perDay, closing: s.closing, ordBtl, ordBox, inc: 0, final: ordBox };
        });
        return { ...it, cells };
      })
      .filter((it) => Object.keys(it.cells).length > 0);

    const storeTotals = {};
    activeShops.forEach((s) => { storeTotals[s] = 0; });
    items.forEach((it) => {
      Object.entries(it.cells).forEach(([shop, c]) => { storeTotals[shop] += Math.max(0, c.ordBox); });
    });
    const grand = Object.values(storeTotals).reduce((a, b) => a + b, 0);
    const shortfall = targetActive ? Math.max(0, target - grand) : 0;

    const storeInc = {};
    activeShops.forEach((s) => {
      storeInc[s] = grand > 0 ? (storeTotals[s] / grand) * shortfall : 0;
    });

    items.forEach((it) => {
      const tot = { perDay: 0, closing: 0, ordBtl: 0, ordBox: 0, inc: 0, final: 0, sale: 0 };
      Object.entries(it.cells).forEach(([shop, c]) => {
        if (shortfall > 0 && c.ordBox > 0 && storeTotals[shop] > 0) {
          c.inc = c.ordBox * (storeInc[shop] / storeTotals[shop]);
          c.final = c.ordBox + c.inc;
        }
        tot.sale += c.sale;
        tot.perDay += c.perDay;
        tot.closing += c.closing;
        tot.ordBtl += Math.max(0, c.ordBtl);
        tot.ordBox += Math.max(0, c.ordBox);
        tot.inc += c.inc;
        tot.final += Math.max(0, c.final);
      });
      it.total = tot;
    });

    // Filtering
    const filtered = hideNegative ? items.filter((it) => it.total.ordBox > 0) : items;

    // Sorting
    const sorted = [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortField === 'ordBox') diff = a.total.ordBox - b.total.ordBox;
      else if (sortField === 'sale') diff = a.total.sale - b.total.sale;
      else if (sortField === 'bpc') diff = (a.bpc || 0) - (b.bpc || 0);
      else if (sortField === 'name') diff = a.name.localeCompare(b.name);
      return sortAsc ? diff : -diff;
    });

    // Footer sums
    const footer = { shops: {}, total: { sale: 0, perDay: 0, closing: 0, ordBtl: 0, ordBox: 0, inc: 0, final: 0 } };
    activeShops.forEach((s) => {
      footer.shops[s] = { sale: 0, perDay: 0, closing: 0, ordBtl: 0, ordBox: 0, inc: 0, final: 0 };
    });
    sorted.forEach((it) => {
      Object.entries(it.cells).forEach(([shop, c]) => {
        const f = footer.shops[shop];
        f.sale += c.sale;
        f.perDay += c.perDay;
        f.closing += c.closing;
        f.ordBtl += Math.max(0, c.ordBtl);
        f.ordBox += Math.max(0, c.ordBox);
        f.inc += c.inc;
        f.final += Math.max(0, c.final);
      });
      Object.keys(footer.total).forEach((k) => { footer.total[k] += it.total[k]; });
    });

    return { visible: sorted, footer, grand, shortfall, storeTotals };
  }, [baseItems, activeShops, divisor, reqDays, target, targetActive, hideNegative, liquorType, supplier, company, brand, search, sortField, sortAsc]);

  const { visible, footer, grand, shortfall, storeTotals } = calc;

  const shopCols = useMemo(() => {
    const keys = viewMode === 'compact'
      ? ['ordBox']
      : SUB_COLS.filter((c) => colToggles[c.key]).map((c) => c.key);
    if (targetActive) keys.push('inc', 'final');
    return keys;
  }, [viewMode, colToggles, targetActive]);

  const totalCols = useMemo(() => {
    if (viewMode === 'compact') {
      const keys = ['ordBox'];
      if (targetActive) keys.push('inc', 'final');
      return keys;
    }
    const keys = ['perDay', 'closing', 'ordBtl', 'ordBox'];
    if (targetActive) keys.push('inc', 'final');
    return keys;
  }, [viewMode, targetActive]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = visible.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc((p) => !p);
    } else {
      setSortField(field);
      setSortAsc(false); // default desc
    }
  };

  const resetFilters = () => {
    setStartDate(getDefaultDateRange().start);
    setEndDate(getDefaultDateRange().end);
    setRequireDays(String(DEFAULT_REQUIRE_DAYS));
    setTargetBoxes('');
    setSelectedShops(null);
    setHideNegative(false);
    setColToggles({ sale: true, perDay: false, closing: true, ordBtl: false, ordBox: true });
    setViewMode('full');
    setRoundUpBoxes(false);
    setSortField('ordBox');
    setSortAsc(false);
    setLiquorType('');
    setSupplier('');
    setCompany('');
    setBrand('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const buildExportGrid = () => {
    const head1 = ['Item Name', 'Item Code', 'B/CS'];
    const head2 = ['', '', ''];
    const merges = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Item Name
      { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Item Code
      { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }  // B/CS
    ];

    let colIdx = 3;
    activeShops.forEach((shop) => {
      merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + shopCols.length - 1 } });
      shopCols.forEach((k, i) => {
        head1.push(i === 0 ? shop : '');
        head2.push(LABELS[k]);
      });
      colIdx += shopCols.length;
    });

    merges.push({ s: { r: 0, c: colIdx }, e: { r: 0, c: colIdx + totalCols.length - 1 } });
    totalCols.forEach((k, i) => {
      head1.push(i === 0 ? 'CONSOLIDATED TOTAL' : '');
      head2.push(LABELS[k]);
    });

    const num = (k, v) => {
      if (roundUpBoxes && BOX_KEYS.includes(k)) return Math.ceil(v || 0);
      if (BOX_KEYS.includes(k) || k === 'perDay') return Number(Number(v || 0).toFixed(2));
      return Math.round(v || 0);
    };

    const body = visible.map((it) => {
      const line = [it.name, it.itemId, it.bpc || ''];
      activeShops.forEach((shop) => {
        const c = it.cells[shop];
        shopCols.forEach((k) => line.push(c ? num(k, c[k]) : ''));
      });
      totalCols.forEach((k) => line.push(num(k, it.total[k])));
      return line;
    });

    const foot = ['TOTAL', '', ''];
    activeShops.forEach((shop) => shopCols.forEach((k) => foot.push(num(k, footer.shops[shop][k]))));
    totalCols.forEach((k) => foot.push(num(k, footer.total[k])));

    const totalRows = 2 + body.length; // head1 + head2 + body
    merges.push({ s: { r: totalRows, c: 0 }, e: { r: totalRows, c: 2 } }); // Merge TOTAL in footer

    // Auto column widths
    const colWidths = [
      { wch: 36 }, // Item Name
      { wch: 12 }, // Item Code
      { wch: 8 },  // B/CS
    ];
    activeShops.forEach(() => {
      shopCols.forEach((k) => {
        colWidths.push({ wch: k === 'ordBox' || k === 'final' ? 12 : 10 });
      });
    });
    totalCols.forEach((k) => {
      colWidths.push({ wch: k === 'ordBox' || k === 'final' ? 14 : 11 });
    });

    return { aoa: [head1, head2, ...body, foot], merges, colWidths };
  };

  const handleExportXlsx = () => {
    if (!visible.length) return toast.error('Nothing to export');
    const { aoa, merges, colWidths } = buildExportGrid();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BIO Order Matrix');
    XLSX.writeFile(wb, `BIO_Order_${startDate}_to_${endDate}.xlsx`);
    toast.success('Excel exported successfully');
  };

  const handleExportCsv = () => {
    if (!visible.length) return toast.error('Nothing to export');
    const { aoa } = buildExportGrid();
    const [h1, h2, ...rest] = aoa;
    let currentShop = '';
    const header = h1.map((h, i) => {
      if (h) currentShop = h;
      if (i < 3) return h1[i] || h2[i];
      return `${currentShop} - ${h2[i]}`;
    });
    const csv = [header, ...rest].map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `BIO_Order_${startDate}_to_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const orderCls = (k, v) => {
    if (k === 'inc') return v > 0 ? 'text-indigo-600 font-bold' : 'text-slate-400';
    if (k === 'final' || k === 'ordBox') return v > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400 font-normal';
    if (k === 'ordBtl') return v > 0 ? 'text-emerald-700 font-semibold' : 'text-slate-400 font-normal';
    return 'text-slate-700 font-medium';
  };

  const formatValue = (key, val) => {
    if (BOX_KEYS.includes(key)) return fmtBox(val, roundUpBoxes);
    return fmtCell(key, val);
  };

  return (
    <div className="w-full max-w-full min-w-0 p-2.5 sm:p-3 md:p-4 space-y-2.5 overflow-x-hidden flex flex-col flex-1 text-slate-800">
      <Toaster position="top-right" />

      {/* COMPACT TOP HEADER */}
      <div className="bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100 shadow-2xs shrink-0">
            <ClipboardList size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900 tracking-tight truncate">BIO Order Dashboard</h1>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {visible.length} items
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium truncate">
              Sale / {divisor}d × {reqDays}d buffer − current stock = replenishment order
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Rounding Mode Toggle */}
          <button
            onClick={() => setRoundUpBoxes((p) => !p)}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs ${roundUpBoxes ? 'bg-amber-100 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            title="Toggle between exact decimal cartons and full-box rounding"
          >
            <Layers size={13} className={roundUpBoxes ? 'text-amber-700' : 'text-slate-400'} />
            <span>{roundUpBoxes ? 'Rounded Cartons' : 'Exact Decimals'}</span>
          </button>

          <button
            onClick={handleExportXlsx}
            disabled={loading || !visible.length}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all cursor-pointer disabled:opacity-40"
            title="Export full matrix to Excel"
          >
            <FileSpreadsheet size={13} />
            <span>Excel</span>
          </button>
          <button
            onClick={handleExportCsv}
            disabled={loading || !visible.length}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-all cursor-pointer disabled:opacity-40"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ULTRA-COMPACT CONTROL BAR (2-ROW SYSTEM DESIGN) */}
      <div className="bg-[#edf6fe] rounded-xl border-2 border-[#badbf4] p-2.5 sm:p-3 shadow-2xs flex flex-col gap-2">
        {/* Row 1: Core Mathematical Drivers & Date */}
        <div className="flex flex-wrap items-center gap-2">
          {/* From / To Date */}
          <div className="flex items-center bg-white border border-[#badbf4] rounded-lg px-2 py-1 shadow-2xs gap-1.5">
            <span className="text-[11px] font-bold text-slate-500">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartChange(e.target.value)}
              className="text-xs font-semibold text-slate-800 outline-none bg-transparent cursor-pointer"
            />
            <span className="text-slate-300">|</span>
            <span className="text-[11px] font-bold text-slate-500">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndChange(e.target.value)}
              className="text-xs font-semibold text-slate-800 outline-none bg-transparent cursor-pointer"
            />
          </div>

          {/* Required Coverage Days */}
          <div className="flex items-center bg-white border border-[#badbf4] rounded-lg px-2 py-1 shadow-2xs gap-1" title="Buffer days to order for">
            <span className="text-[11px] font-bold text-slate-500">Buffer:</span>
            <input
              type="number"
              min="1"
              value={requireDays}
              onChange={(e) => setRequireDays(e.target.value)}
              className="w-12 text-xs font-bold text-emerald-700 outline-none text-center bg-emerald-50/50 rounded"
            />
            <span className="text-[10px] text-slate-400 font-semibold">days</span>
          </div>

          {/* Target MOQ / Truckload */}
          <div className="flex items-center bg-white border border-[#badbf4] rounded-lg px-2 py-1 shadow-2xs gap-1" title="Target Order Boxes (auto-distributes shortfall)">
            <span className="text-[11px] font-bold text-indigo-700">Target:</span>
            <input
              type="number"
              min="0"
              placeholder={fmtBox(grand)}
              value={targetBoxes}
              onChange={(e) => setTargetBoxes(e.target.value)}
              className="w-16 text-xs font-bold text-indigo-900 outline-none text-center bg-indigo-50/80 rounded"
            />
            <span className="text-[10px] text-slate-400 font-semibold">box</span>
            <span className="text-[10px] text-slate-500 font-semibold border-l border-slate-200 pl-1.5">
              Current: <span className="font-bold text-emerald-700 tabular-nums">{fmtBox(grand)}</span> box
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-7 pl-7 pr-2 text-xs bg-white border border-[#badbf4] rounded-lg focus:outline-none focus:border-indigo-500 shadow-2xs font-semibold text-slate-800"
            />
          </div>

          {/* Reset */}
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 h-7 px-2 text-xs font-bold bg-white hover:bg-slate-100 text-slate-600 border border-[#badbf4] rounded-lg shadow-2xs cursor-pointer"
            title="Reset all filters to default"
          >
            <RotateCcw size={12} className="text-indigo-600" />
            <span>Reset</span>
          </button>
        </div>

        {/* Row 2: Secondary Filters & Layout Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#badbf4]/60">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Compact/Full */}
            <div className="flex rounded-lg overflow-hidden border border-[#badbf4] text-xs font-bold bg-white shadow-2xs">
              <button
                onClick={() => setViewMode('compact')}
                className={`px-2 py-1 cursor-pointer transition-colors ${viewMode === 'compact' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                title="Only shows Order Box per shop for high compactness"
              >
                Compact (Box Only)
              </button>
              <button
                onClick={() => setViewMode('full')}
                className={`px-2 py-1 cursor-pointer transition-colors ${viewMode === 'full' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                title="Shows selected sub-columns per shop"
              >
                Detailed View
              </button>
            </div>

            {/* Negative Filter */}
            <label className="flex items-center gap-1 bg-white border border-[#badbf4] px-2 py-1 rounded-lg text-xs font-bold text-slate-700 cursor-pointer shadow-2xs">
              <input
                type="checkbox"
                checked={hideNegative}
                onChange={(e) => { setHideNegative(e.target.checked); setPage(1); }}
                className="rounded text-indigo-600 focus:ring-0"
              />
              <span>Hide Surplus (≤0)</span>
            </label>

            {/* Shops Dropdown Selector with Color Indicators */}
            <div className="relative" ref={shopsDropdownRef}>
              <button
                onClick={() => setShowShopsDropdown((p) => !p)}
                className="flex items-center gap-1.5 bg-white border border-[#badbf4] px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-2xs cursor-pointer hover:bg-slate-50"
              >
                <Store size={12} className="text-indigo-600" />
                <span>Shops ({activeShops.length}/{allShops.length})</span>
                <ChevronDown size={11} className="text-slate-400" />
              </button>
              {showShopsDropdown && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-40 space-y-1">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100 text-[11px] font-bold text-slate-600">
                    <span>Active Stores</span>
                    <button
                      onClick={() => setSelectedShops(activeShops.length === allShops.length ? [] : null)}
                      className="text-indigo-600 hover:underline cursor-pointer"
                    >
                      {activeShops.length === allShops.length ? 'Clear All' : 'Select All'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {allShops.map((s) => {
                      const idx = activeShops.indexOf(s);
                      const pal = idx >= 0 ? getShopPalette(idx) : null;
                      return (
                        <label key={s} className="flex items-center gap-2 px-1.5 py-1 text-xs text-slate-700 hover:bg-slate-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={activeShops.includes(s)}
                            onChange={() => toggleShop(s)}
                            className="rounded text-indigo-600"
                          />
                          {pal ? <span className={`w-2.5 h-2.5 rounded-full ${pal.dot} shrink-0`} /> : <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />}
                          <span className="font-semibold truncate">{s}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Column Visibility Selector (when Detailed View) */}
            {viewMode === 'full' && (
              <div className="relative" ref={colsDropdownRef}>
                <button
                  onClick={() => setShowColsDropdown((p) => !p)}
                  className="flex items-center gap-1.5 bg-white border border-[#badbf4] px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 shadow-2xs cursor-pointer hover:bg-slate-50"
                >
                  <SlidersHorizontal size={12} className="text-indigo-600" />
                  <span>Columns</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>
                {showColsDropdown && (
                  <div className="absolute left-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-40 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide px-1">Sub-Columns</span>
                    {SUB_COLS.map((c) => (
                      <label key={c.key} className="flex items-center gap-2 px-1.5 py-1 text-xs text-slate-700 hover:bg-indigo-50/50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={colToggles[c.key]}
                          onChange={(e) => setColToggles((p) => ({ ...p, [c.key]: e.target.checked }))}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-semibold">{c.toggle}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dimension Dropdowns */}
          <div className="flex items-center gap-1.5">
            <select
              value={liquorType}
              onChange={(e) => { setLiquorType(e.target.value); setPage(1); }}
              className="h-7 px-2 bg-white border border-[#badbf4] rounded-lg text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer"
            >
              <option value="">All Liquor</option>
              {liquorTypes.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={supplier}
              onChange={(e) => { setSupplier(e.target.value); setPage(1); }}
              className="h-7 px-2 bg-white border border-[#badbf4] rounded-lg text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={company}
              onChange={(e) => { setCompany(e.target.value); setPage(1); }}
              className="h-7 px-2 bg-white border border-[#badbf4] rounded-lg text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="">All Companies</option>
              {companies.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <select
              value={brand}
              onChange={(e) => { setBrand(e.target.value); setPage(1); }}
              className="h-7 px-2 bg-white border border-[#badbf4] rounded-lg text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="">All Brands</option>
              {brands.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* COMPACT KPI METRIC RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="bg-white border-2 border-[#badbf4] rounded-xl px-3 py-1.5 shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500">Order Boxes</span>
          <span className="text-sm sm:text-base font-black text-emerald-700 tabular-nums">{fmtBox(grand, roundUpBoxes)}</span>
        </div>
        <div className="bg-white border-2 border-[#badbf4] rounded-xl px-3 py-1.5 shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500">Target Box</span>
          <span className="text-sm sm:text-base font-black text-indigo-900 tabular-nums">{targetActive ? fmtBox(target, roundUpBoxes) : '—'}</span>
        </div>
        <div className="bg-white border-2 border-[#badbf4] rounded-xl px-3 py-1.5 shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500">Shortfall</span>
          <span className={`text-sm sm:text-base font-black tabular-nums ${targetActive && shortfall > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {targetActive ? `+${fmtBox(shortfall, roundUpBoxes)}` : '—'}
          </span>
        </div>
        <div className="bg-white border-2 border-[#badbf4] rounded-xl px-3 py-1.5 shadow-2xs flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-500">Total Bottles</span>
          <span className="text-sm sm:text-base font-black text-slate-800 tabular-nums">{fmtInt(footer.total.ordBtl)}</span>
        </div>
        <div className="bg-white border-2 border-[#badbf4] rounded-xl px-3 py-1.5 shadow-2xs flex items-center justify-between col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-slate-500">Shops Active</span>
          <span className="text-sm sm:text-base font-black text-purple-900 tabular-nums">{activeShops.length} <span className="text-[10px] text-slate-400 font-bold">/ {allShops.length}</span></span>
        </div>
      </div>

      {/* TARGET PROGRESS & DYNAMIC SHOP ALLOCATION BAR */}
      {targetActive && grand > 0 && (
        <div className="bg-white border border-[#badbf4] rounded-xl p-2.5 shadow-2xs flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <span>Target Order Fulfillment:</span>
              <span className="text-indigo-700">{fmtBox(grand)} / {fmtBox(target)} Boxes</span>
              <span className="text-[11px] font-semibold text-slate-500">({Math.min(100, (grand / target) * 100).toFixed(1)}%)</span>
            </span>
            {shortfall > 0 && (
              <span className="text-amber-700 text-[11px] font-bold">
                Shortfall +{fmtBox(shortfall)} distributed proportionally to stores
              </span>
            )}
          </div>
          {/* Multi-segmented color progress bar */}
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
            {activeShops.map((shop, i) => {
              const pal = getShopPalette(i);
              const b = storeTotals[shop] || 0;
              const pct = target > 0 ? (b / target) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <div
                  key={shop}
                  className={`${pal.progress} transition-all duration-300 relative group`}
                  style={{ width: `${pct}%` }}
                  title={`${shop}: ${fmtBox(b)} boxes (${pct.toFixed(1)}%)`}
                />
              );
            })}
            {shortfall > 0 && (
              <div
                className="bg-amber-400/80 transition-all duration-300"
                style={{ width: `${(shortfall / target) * 100}%` }}
                title={`Shortfall to Target: ${fmtBox(shortfall)} boxes`}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-bold text-slate-600">
            {activeShops.map((shop, i) => {
              const pal = getShopPalette(i);
              const b = storeTotals[shop] || 0;
              const pct = grand > 0 ? ((b / grand) * 100).toFixed(1) : 0;
              return (
                <span key={shop} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${pal.dot}`} />
                  <span>{shop}: {fmtBox(b)} box ({pct}%)</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg px-3 py-2">
          Error loading stock data: {error.message || String(error)}
        </div>
      )}

      {/* MATRIX TABLE */}
      <div className="bg-white rounded-xl border-2 border-[#badbf4] shadow-xs overflow-hidden flex flex-col min-w-0">
        {loading && !rows.length ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw size={20} className="animate-spin text-indigo-600" />
            <span>Loading store stock balances...</span>
          </div>
        ) : !visible.length ? (
          <div className="p-8 text-center text-xs font-semibold text-slate-500">
            No items match the current filters. Try resetting filters.
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] border-collapse">
            <table className="w-full text-xs text-left border-collapse min-w-max">
              {/* TWO-LEVEL DRINQKART HEADER */}
              <thead className="sticky top-0 z-20">
                <tr className="bg-[#180e5b] text-white font-bold select-none text-[11px] border-b border-indigo-950">
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('name')}
                    className="py-2 px-3 text-left font-black tracking-wide border-r border-indigo-900/60 bg-[#180e5b] min-w-[220px] max-w-[280px] cursor-pointer hover:bg-[#231475] transition-colors"
                    title="Click to sort by Item Name"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span>Item Name</span>
                      {sortField === 'name' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
                    </div>
                  </th>
                  <th
                    rowSpan={2}
                    onClick={() => handleSort('bpc')}
                    className="py-2 px-2 text-right font-black border-r border-indigo-900/60 bg-[#180e5b] min-w-[52px] cursor-pointer hover:bg-[#231475] transition-colors"
                    title="Click to sort by Bottles per case"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>B/CS</span>
                      {sortField === 'bpc' ? (sortAsc ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
                    </div>
                  </th>
                  {activeShops.map((shop, i) => {
                    const pal = getShopPalette(i);
                    return (
                      <th
                        key={shop}
                        colSpan={shopCols.length}
                        className={`py-1.5 px-2 text-center font-black border-r-2 border-slate-900/50 tracking-wide text-white ${pal.header}`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${pal.dot}`} />
                          <span>{shop}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th
                    colSpan={totalCols.length}
                    onClick={() => handleSort('ordBox')}
                    className="py-1.5 px-2 text-center font-black bg-[#120a44] text-amber-300 tracking-wide cursor-pointer hover:bg-[#1a0f5e] transition-colors"
                    title="Click to sort by Total Order Box"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>TOTAL</span>
                      {sortField === 'ordBox' ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={11} className="opacity-50" />}
                    </div>
                  </th>
                </tr>
                <tr className="bg-[#120a44] text-white select-none text-[10px] font-bold border-b border-slate-300">
                  {activeShops.map((shop, i) => {
                    const pal = getShopPalette(i);
                    return shopCols.map((k, colIdx) => (
                      <th
                        key={`${shop}-${k}`}
                        className={`py-1 px-1.5 text-right whitespace-nowrap ${pal.subHeader} ${colIdx === shopCols.length - 1 ? 'border-r-2 border-slate-900/50' : 'border-r border-white/10'} ${k === 'ordBox' ? 'text-emerald-300 font-extrabold' : k === 'inc' ? 'text-indigo-200' : 'text-slate-300'}`}
                        style={{ minWidth: 48 }}
                      >
                        {LABELS[k]}
                      </th>
                    ));
                  })}
                  {totalCols.map((k) => (
                    <th
                      key={`t-${k}`}
                      className="py-1 px-1.5 text-right border-r border-indigo-900/40 bg-[#0e0735] text-amber-200 whitespace-nowrap"
                      style={{ minWidth: 52 }}
                    >
                      {LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {pageItems.map((it, idx) => (
                  <tr
                    key={it.itemId}
                    className={`hover:bg-indigo-50/50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-[#fcfdff]'}`}
                  >
                    {/* Item Description */}
                    <td
                      className="py-1.5 px-3 font-semibold text-slate-900 border-r border-slate-200 min-w-[220px] max-w-[280px]"
                      title={it.name}
                    >
                      <div className="truncate text-xs font-bold text-slate-900 group-hover:text-indigo-950">{it.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium truncate">{it.itemId}</div>
                    </td>

                    {/* Bottles per case */}
                    <td
                      className="py-1.5 px-2 text-right font-bold text-slate-600 border-r border-slate-200 min-w-[52px] tabular-nums"
                    >
                      {it.bpc || '—'}
                    </td>

                    {/* Shop Columns with whole column colored by shop */}
                    {activeShops.map((shop, i) => {
                      const pal = getShopPalette(i);
                      const isLastCol = (colIdx) => colIdx === shopCols.length - 1;
                      return shopCols.map((k, colIdx) => {
                        const c = it.cells[shop];
                        const val = c ? c[k] : 0;
                        return (
                          <td
                            key={`${shop}-${k}`}
                            className={`py-1.5 px-1.5 text-right tabular-nums text-xs transition-colors ${pal.cellBg} ${isLastCol(colIdx) ? pal.borderR : 'border-r border-slate-300/40'} ${orderCls(k, val)}`}
                          >
                            {c ? formatValue(k, val) : '—'}
                          </td>
                        );
                      });
                    })}

                    {/* Total Columns with distinct emerald tint */}
                    {totalCols.map((k, colIdx) => (
                      <td
                        key={`t-${k}`}
                        className={`py-1.5 px-1.5 text-right tabular-nums text-xs bg-[#ecfdf5]/70 group-hover:bg-[#d1fae5] transition-colors ${colIdx === totalCols.length - 1 ? '' : 'border-r border-emerald-200/50'} ${orderCls(k, it.total[k])}`}
                      >
                        {formatValue(k, it.total[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* FOOTER TOTALS */}
              <tfoot className="sticky bottom-0 z-20">
                <tr className="bg-[#180e5b] text-white font-black text-xs border-t-2 border-indigo-400">
                  <td
                    className="py-2 px-3 bg-[#180e5b] text-white border-r border-indigo-900/60 min-w-[220px] max-w-[280px]"
                  >
                    TOTAL ({visible.length} items)
                  </td>
                  <td
                    className="py-2 px-2 bg-[#180e5b] text-white border-r border-indigo-900/60 min-w-[52px]"
                  />
                  {activeShops.map((shop, i) => {
                    const pal = getShopPalette(i);
                    return shopCols.map((k, colIdx) => (
                      <td
                        key={`f-${shop}-${k}`}
                        className={`py-2 px-1.5 text-right tabular-nums font-black text-white ${colIdx === shopCols.length - 1 ? 'border-r-2 border-slate-900/50' : 'border-r border-white/10'} ${pal.header}`}
                      >
                        {formatValue(k, footer.shops[shop][k])}
                      </td>
                    ));
                  })}
                  {totalCols.map((k) => (
                    <td
                      key={`f-t-${k}`}
                      className="py-2 px-1.5 text-right tabular-nums border-r border-indigo-900/40 bg-[#120a44] font-black text-amber-300"
                    >
                      {formatValue(k, footer.total[k])}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {visible.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 text-xs font-semibold text-slate-600 bg-slate-50">
            <span>Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, visible.length)} of {visible.length} items</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 py-0.5 font-bold text-slate-800">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 cursor-pointer"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
