import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  FileSpreadsheet, RefreshCw, Search, Calendar, Store, ChevronRight, ChevronDown
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import {
  getDefaultDateRange, todayISO, findLatestSnapshotDate, loadStockDay, invalidateStockCache
} from '../stock/stockData';

const fmtQty = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const groupKey = (r) => [r.liquor_type || '—', r.subhead || '—', r.type5 || '—'].join('||');

const emptyCell = () => ({ qty: 0, purchase: 0, mrp: 0 });
const addTo = (cell, qty, purchase, mrp) => {
  cell.qty += qty;
  cell.purchase += purchase;
  cell.mrp += mrp;
};

export default function ValuationReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => getDefaultDateRange().start);
  const [endDate, setEndDate] = useState(() => getDefaultDateRange().end);
  const [snapshotDate, setSnapshotDate] = useState(''); // snapshot actually valued (latest one inside the range)
  const [shopFilter, setShopFilter] = useState('');
  const [valueBasis, setValueBasis] = useState('both'); // 'both' | 'purchase' | 'mrp'
  const showPurchase = valueBasis !== 'mrp';
  const showMrp = valueBasis !== 'purchase';
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const latestRequestRef = useRef(0);

  // Value the closing stock of the most recent snapshot inside [startDate, endDate].
  // The day comes from the shared cache, so it is free when another stock page already loaded it.
  const fetchRows = useCallback(async () => {
    if (!startDate || !endDate) return;
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const date = await findLatestSnapshotDate(startDate, endDate);
      if (requestId !== latestRequestRef.current) return;
      if (!date) {
        setSnapshotDate('');
        setRows([]);
        return;
      }
      const dayRows = await loadStockDay(date);
      if (requestId !== latestRequestRef.current) return;
      setSnapshotDate(date);
      setRows(dayRows);
      setExpanded(new Set());
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      console.error('Valuation report fetch error:', err);
      toast.error('Failed to load stock data: ' + (err.message || 'unknown error'));
      setRows([]);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleRefresh = async () => {
    await invalidateStockCache();
    fetchRows();
  };

  const handleStartChange = (value) => {
    if (!value) return;
    setStartDate(value);
    if (endDate < value) setEndDate(value);
  };
  const handleEndChange = (value) => {
    if (!value) return;
    setEndDate(value);
    if (startDate > value) setStartDate(value);
  };

  // Shop list comes from the whole snapshot so filtering doesn't shrink the dropdown
  const allShops = useMemo(() => [...new Set(rows.map((r) => r.store_name).filter(Boolean))].sort(), [rows]);
  const shops = useMemo(() => (shopFilter ? [shopFilter] : allShops), [shopFilter, allShops]);

  // Group -> items -> per-shop cells
  const { groups, grand } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map();
    const grandCells = {};
    const total = emptyCell();
    shops.forEach((s) => (grandCells[s] = emptyCell()));

    rows.forEach((r) => {
      const shop = r.store_name;
      if (shopFilter && shop !== shopFilter) return;
      if (term) {
        const hay = `${r.item_description || ''} ${r.item_id || ''} ${r.subhead || ''} ${r.liquor_type || ''} ${r.type5 || ''}`.toLowerCase();
        if (!hay.includes(term)) return;
      }
      const qty = Number(r.closing_qty) || 0;
      const purchase = qty * (Number(r.purchase_bottle_rate) || 0);
      const mrp = qty * (Number(r.mrp_bottle_rate) || 0);

      const key = groupKey(r);
      if (!map.has(key)) {
        map.set(key, {
          key,
          liquorType: r.liquor_type || '—',
          category: r.subhead || '—',
          biobii: r.type5 || '—',
          cells: {},
          total: emptyCell(),
          items: new Map()
        });
      }
      const g = map.get(key);
      if (!g.cells[shop]) g.cells[shop] = emptyCell();
      addTo(g.cells[shop], qty, purchase, mrp);
      addTo(g.total, qty, purchase, mrp);

      if (!g.items.has(r.item_id)) {
        g.items.set(r.item_id, { itemId: r.item_id, name: r.item_description, cells: {}, total: emptyCell() });
      }
      const it = g.items.get(r.item_id);
      if (!it.cells[shop]) it.cells[shop] = emptyCell();
      addTo(it.cells[shop], qty, purchase, mrp);
      addTo(it.total, qty, purchase, mrp);

      if (!grandCells[shop]) grandCells[shop] = emptyCell();
      addTo(grandCells[shop], qty, purchase, mrp);
      addTo(total, qty, purchase, mrp);
    });

    const list = [...map.values()]
      .map((g) => ({
        ...g,
        items: [...g.items.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      }))
      .sort(
        (a, b) =>
          a.liquorType.localeCompare(b.liquorType) ||
          a.category.localeCompare(b.category) ||
          a.biobii.localeCompare(b.biobii)
      );
    return { groups: list, grand: { cells: grandCells, total } };
  }, [rows, shops, shopFilter, search]);

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Qty plus one column per selected value basis, for each shop and the total
  const perShopCols = 1 + (showPurchase ? 1 : 0) + (showMrp ? 1 : 0);
  const colCount = 4 + (shops.length + 1) * perShopCols;

  const renderCells = (cells, total, cls = '') => (
    <>
      {[...shops.map((s) => [s, cells[s] || emptyCell(), false]), ['TOTAL', total, true]].map(([s, c, isTotal]) => (
        <React.Fragment key={s}>
          <td className={`px-3 py-2 text-right font-mono border-l ${isTotal ? 'border-slate-300 font-bold' : 'border-slate-200'} ${cls}`}>
            {fmtQty(c.qty)}
          </td>
          {showPurchase && (
            <td className={`px-3 py-2 text-right font-mono ${isTotal ? 'font-bold' : ''} ${cls}`}>{fmtMoney(c.purchase)}</td>
          )}
          {showMrp && (
            <td className={`px-3 py-2 text-right font-mono ${isTotal ? 'font-bold' : ''} ${cls}`}>{fmtMoney(c.mrp)}</td>
          )}
        </React.Fragment>
      ))}
    </>
  );

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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Valuation Report</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Closing stock grouped by liquor type, category and BII/BIO — click a row to see its items
              {snapshotDate && (
                <> · valued as of <b className="text-slate-700">{snapshotDate}</b> (latest snapshot in range)</>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-2.5 min-w-0">
        <div className="relative flex-1 sm:flex-none sm:w-64 min-w-50">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search item, category, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
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
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
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
          }}
          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
          title="Reset to the last 7 days"
        >
          Reset (7D)
        </button>

        <div className="flex items-center gap-1.5">
          <Store size={14} className="text-slate-400 shrink-0" />
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none transition cursor-pointer"
          >
            <option value="">All Shops</option>
            {allShops.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <select
          value={valueBasis}
          onChange={(e) => setValueBasis(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none transition cursor-pointer"
        >
          <option value="both">Purchase + MRP Value</option>
          <option value="purchase">Purchase Value</option>
          <option value="mrp">MRP Value</option>
        </select>

        <span className="ml-auto text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60 whitespace-nowrap">
          Groups: <b className="text-indigo-900">{groups.length}</b>
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        <div className="overflow-x-auto overflow-y-auto h-[75vh] min-h-150 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20">
              <tr>
                <th rowSpan={2} className="px-3 py-3 w-8" />
                <th rowSpan={2} className="px-3 py-3">Liquor Type</th>
                <th rowSpan={2} className="px-3 py-3">Category</th>
                <th rowSpan={2} className="px-3 py-3">BII/BIO</th>
                {shops.map((s) => (
                  <th key={s} colSpan={perShopCols} className="px-3 py-2 text-center border-l border-slate-600">{s}</th>
                ))}
                <th colSpan={perShopCols} className="px-3 py-2 text-center border-l border-slate-500 bg-slate-900">Total</th>
              </tr>
              <tr>
                {[...shops, 'TOTAL'].map((s) => (
                  <React.Fragment key={s}>
                    <th className="px-3 py-2 text-right border-l border-slate-600">Closing Qty</th>
                    {showPurchase && <th className="px-3 py-2 text-right">Purchase Value</th>}
                    {showMrp && <th className="px-3 py-2 text-right">MRP Value</th>}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="font-medium">
              {loading ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">Loading stock data...</span>
                    </div>
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No stock data in this date range</span>
                      <p className="text-xs text-slate-400">Try another date range or shop.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {groups.map((g) => {
                    const open = expanded.has(g.key);
                    return (
                      <React.Fragment key={g.key}>
                        <tr
                          onClick={() => toggle(g.key)}
                          className={`cursor-pointer border-b border-slate-100 transition-colors ${
                            open ? 'bg-indigo-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-500">
                            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-900">{g.liquorType}</td>
                          <td className="px-3 py-2 text-slate-800">{g.category}</td>
                          <td className="px-3 py-2 text-slate-600">{g.biobii}</td>
                          {renderCells(g.cells, g.total)}
                        </tr>

                        {open && (
                          <>
                            <tr className="bg-slate-100 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                              <td />
                              <td className="px-3 py-1.5">Item ID</td>
                              <td className="px-3 py-1.5" colSpan={2}>Item Name</td>
                              <td colSpan={(shops.length + 1) * perShopCols} className="px-3 py-1.5 text-right">
                                {g.items.length} item{g.items.length === 1 ? '' : 's'}
                              </td>
                            </tr>
                            {g.items.map((it) => (
                              <tr key={it.itemId} className="bg-slate-50/70 border-b border-slate-100 text-slate-700">
                                <td />
                                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{it.itemId}</td>
                                <td className="px-3 py-2 font-semibold" colSpan={2}>{it.name || '—'}</td>
                                {renderCells(it.cells, it.total)}
                              </tr>
                            ))}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  <tr className="bg-slate-800 text-white font-bold sticky bottom-0">
                    <td />
                    <td className="px-3 py-2.5" colSpan={3}>Grand Total</td>
                    {renderCells(grand.cells, grand.total, 'text-white')}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
