import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { 
  FileSpreadsheet, RefreshCw, Search, Trash2, Calendar, Store, CheckSquare, BarChart3,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 400;

// Quote a value for a PostgREST or() filter so commas, brackets etc. in the search text don't break it
const quoteFilterValue = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

// Page numbers to show around the current page, with '…' gaps
function getPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

// stock_balance has no id column; rows are unique on (store_name, snapshot_date, item_id)
const STOCK_TABLE = 'stock_balance';
const ROW_KEY_SEP = '||';
const makeRowKey = (r) => [r.store_name, r.snapshot_date, r.item_id].join(ROW_KEY_SEP);
const parseRowKey = (key) => {
  const [store_name, snapshot_date, item_id] = String(key).split(ROW_KEY_SEP);
  return { store_name, snapshot_date, item_id };
};

const DEFAULT_SHOPS = [
  'BALAJI', 'FRIENDS', 'KUNAL KHARGHAR', 'KUNAL ULWE', 'MADHURA', 'OFFICE', 'TLS'
];

export default function StockBalance() {
  const navigate = useNavigate();
  const [stockRecords, setStockRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState([]);
  
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const latestRequestRef = useRef(0);

  // Bulk Selection States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Fetch shops for selection and auto-matching
  useEffect(() => {
    async function loadShops() {
      try {
        let { data } = await supabase.from('shop').select('id, shop_name');
        if (!data || data.length === 0) {
          const res = await supabase.from('shops').select('id, name');
          data = res.data;
        }
        if (data && data.length > 0) {
          const formatted = data.map(s => ({
            id: s.id || s.shop_name || s.name,
            name: (s.shop_name || s.name || '').trim()
          })).filter(s => s.name);
          setShops(formatted);
        } else {
          setShops(DEFAULT_SHOPS.map(name => ({ id: name, name })));
        }
      } catch (err) {
        console.error('Error fetching shops:', err);
        setShops(DEFAULT_SHOPS.map(name => ({ id: name, name })));
      }
    }
    loadShops();
  }, []);

  // Wait until the user stops typing before searching, and go back to page 1
  useEffect(() => {
    const next = search.trim();
    if (next === debouncedSearch) return;
    const t = setTimeout(() => {
      setDebouncedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);

  // Any filter change starts again from page 1
  const handleShopFilterChange = (value) => { setShopFilter(value); setPage(1); };
  const handleStartDateChange = (value) => { setStartDate(value); setPage(1); };
  const handleEndDateChange = (value) => { setEndDate(value); setPage(1); };

  // Fetch one page (PAGE_SIZE rows) of stock records, plus the total count for the current filters
  const fetchStockRecords = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from(STOCK_TABLE)
        .select('*', { count: 'exact' });

      if (shopFilter) {
        query = query.eq('store_name', shopFilter);
      }

      if (startDate) {
        query = query.gte('snapshot_date', startDate);
      }
      if (endDate) {
        query = query.lte('snapshot_date', endDate);
      }

      if (debouncedSearch) {
        const v = quoteFilterValue(`%${debouncedSearch}%`);
        query = query.or(`item_description.ilike.${v},item_id.ilike.${v},brand_name.ilike.${v},subhead.ilike.${v},party_name.ilike.${v},company_name.ilike.${v}`);
      }

      // Unique ordering so rows never repeat or go missing between pages
      query = query
        .order('snapshot_date', { ascending: false })
        .order('store_name', { ascending: true })
        .order('item_id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;

      // A newer request (filter / page change) has started; ignore this result
      if (requestId !== latestRequestRef.current) return;

      if (error) {
        // Page is past the end of the results (e.g. rows were deleted) - go back to page 1
        if (error.code === 'PGRST103' && page > 1) {
          setPage(1);
          return;
        }
        console.warn('Table stock_balance query notice:', error.message);
        if (error.code === '57014') {
          // Postgres statement timeout - usually a broad search across all dates/shops
          toast.error('Search took too long. Narrow it down with a Shop or Date filter and try again.', { id: 'stock-timeout' });
        } else {
          toast.error('Failed to load stock records: ' + error.message);
        }
        setStockRecords([]);
        setTotalCount(0);
        return;
      }

      const total = count || 0;
      setTotalCount(total);

      // Current page no longer exists (e.g. after deleting rows) - jump to the last page
      const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }

      // Map stock_balance columns to the shape the table renders
      const mapped = (data || []).map(r => ({
        ...r,
        id: makeRowKey(r),
        shop_id: r.store_name,
        date: r.snapshot_date,
        item_name: r.item_description,
        quantity_in: r.qty_in,
        quantity_out: r.qty_out,
        purchase_rate: r.purchase_bottle_rate,
        mrp_rate: r.mrp_bottle_rate,
        b_cs: r.bottles_per_case
      }));
      setStockRecords(mapped);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      console.error('Error fetching stock records:', err);
      toast.error('Failed to load stock records');
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [shopFilter, startDate, endDate, debouncedSearch, page]);

  useEffect(() => {
    fetchStockRecords();
    setSelectedIds(new Set());
  }, [fetchStockRecords]);

  // Toggle Select Mode
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectMode(true);
    }
  };

  // Single Record Delete
  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this stock record?')) return;
    
    const toastId = toast.loading('Deleting record...');
    try {
      const { data, error } = await supabase
        .from(STOCK_TABLE)
        .delete()
        .match(parseRowKey(id))
        .select('item_id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No row was deleted (record not found or delete not permitted)');
      }
      setStockRecords(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Record deleted successfully', { id: toastId });
      fetchStockRecords();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete: ' + err.message, { id: toastId });
    }
  };

  // Selection handlers - Clean 1-to-1 individual row selection
  const handleToggleSelectRow = (id) => {
    if (!id) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllLoaded = (checked) => {
    if (checked) {
      const allIds = stockRecords.filter(r => r.id).map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Bulk Delete implementation with batching and UUID validation
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No records selected for deletion!');
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete ${selectedIds.size} selected stock records? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeletingBulk(true);
    const toastId = toast.loading(`Deleting ${selectedIds.size} selected records...`);

    try {
      const dbIdsToDelete = Array.from(selectedIds);

      // Group selected rows by shop + date, then delete their item_ids in chunks
      const groups = new Map();
      dbIdsToDelete.forEach(key => {
        const { store_name, snapshot_date, item_id } = parseRowKey(key);
        const groupKey = `${store_name}${ROW_KEY_SEP}${snapshot_date}`;
        if (!groups.has(groupKey)) groups.set(groupKey, { store_name, snapshot_date, itemIds: [] });
        groups.get(groupKey).itemIds.push(item_id);
      });

      // Chunk deletions in batches of 100 to avoid HTTP URI length limits
      const CHUNK_SIZE = 100;
      const chunks = [];
      groups.forEach(g => {
        for (let i = 0; i < g.itemIds.length; i += CHUNK_SIZE) {
          chunks.push({ store_name: g.store_name, snapshot_date: g.snapshot_date, itemIds: g.itemIds.slice(i, i + CHUNK_SIZE) });
        }
      });

      let deletedCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunks.length > 1) {
          toast.loading(`Deleting chunk ${i + 1} of ${chunks.length}...`, { id: toastId });
        }

        const { data, error } = await supabase
          .from(STOCK_TABLE)
          .delete()
          .eq('store_name', chunk.store_name)
          .eq('snapshot_date', chunk.snapshot_date)
          .in('item_id', chunk.itemIds)
          .select('item_id');

        if (error) {
          console.error('Bulk delete batch error:', error);
          throw new Error(error.message || `Failed to delete batch ${i + 1}`);
        }
        deletedCount += (data || []).length;
      }

      if (deletedCount === 0) {
        throw new Error('No rows were deleted (records not found or delete not permitted)');
      }

      // Immediate UI cleanup
      const deletedSet = new Set(dbIdsToDelete);
      setStockRecords(prev => prev.filter(r => !deletedSet.has(r.id)));
      setSelectedIds(new Set());

      toast.success(`Successfully deleted ${deletedCount} records!`, { id: toastId });
      fetchStockRecords();
    } catch (err) {
      console.error('Error deleting records:', err);
      toast.error(`Delete failed: ${err.message}`, { id: toastId });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const isAllSelected = stockRecords.length > 0 && stockRecords.every(r => selectedIds.has(r.id));
  const isPartiallySelected = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden flex flex-col flex-1">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100/80 shadow-sm shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Stock Balance Management</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Monitor Purchase, Sale & Stock Balances across shop locations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">

          {/* Executive Dashboard Button */}
          <button
            onClick={() => navigate('/systems/business-overview/sales-analytics')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            id="view-executive-dashboard-btn"
          >
            <BarChart3 size={15} />
            <span>Executive Dashboard</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchStockRecords}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer"
            id="refresh-stock-btn"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Sticky Bar (Shows when records are selected) */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="bg-indigo-900 text-white px-4 sm:px-5 py-3 rounded-2xl shadow-lg border border-indigo-800 flex flex-wrap items-center justify-between gap-3 min-w-0 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-700 text-white font-bold text-xs">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {selectedIds.size} stock record{selectedIds.size > 1 ? 's' : ''} selected
              </p>
              <p className="text-[11px] text-indigo-200">
                You can delete all selected records in a single bulk operation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isAllSelected && (
              <button
                onClick={() => handleSelectAllLoaded(true)}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-xl transition cursor-pointer"
              >
                Select All Loaded ({stockRecords.length})
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-xl transition cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl shadow transition cursor-pointer disabled:opacity-50"
              id="bulk-delete-confirm-btn"
            >
              <Trash2 size={14} />
              {isDeletingBulk ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap min-w-0">
          {/* Search Box */}
          <div className="relative flex-1 sm:flex-none sm:w-64 md:w-72 min-w-50">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item, brand, subhead, party, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              id="stock-search-input"
            />
          </div>

          {/* Date Range Filters */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none font-medium"
                id="filter-start-date"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none font-medium"
                id="filter-end-date"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
              >
                Clear Dates
              </button>
            )}

            {/* Select Button in Filter Toolbar */}
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                isSelectMode
                  ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
              id="filter-toggle-select-btn"
            >
              <CheckSquare size={14} />
              <span>{isSelectMode ? 'Cancel Selection' : 'Select'}</span>
            </button>

            {/* Delete button opens right beside Select button when Select is pressed */}
            {isSelectMode && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeletingBulk || selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                id="filter-bulk-delete-btn"
              >
                <Trash2 size={13} />
                <span>{isDeletingBulk ? 'Deleting...' : `Delete (${selectedIds.size})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Shop Dropdown & Total Counter */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-400 shrink-0" />
            <select
              value={shopFilter}
              onChange={(e) => handleShopFilterChange(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none transition cursor-pointer"
              id="filter-shop-select"
            >
              <option value="">All Shops</option>
              {shops.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60 whitespace-nowrap">
            Total: <b className="text-indigo-900">{totalCount.toLocaleString()}</b>
          </span>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        {/* Table Viewport with 2x height and prominent independent vertical and horizontal scrollbars */}
        <div className="overflow-x-auto overflow-y-auto h-[75vh] min-h-150 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20 shadow-xs">
              <tr>
                {/* Select All Checkbox Column: ONLY opens when Select button is pressed */}
                {isSelectMode && (
                  <th className="px-3.5 py-3 text-center w-10 animate-in fade-in">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onChange={(e) => handleSelectAllLoaded(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      title={isAllSelected ? 'Deselect all' : 'Select all loaded records'}
                    />
                  </th>
                )}
                <th className="px-2 py-3 text-center w-10">Action</th>
                <th className="px-3 py-3">Shop</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Item ID</th>
                <th className="px-3 py-3">Item Name</th>
                <th className="px-3 py-3 text-right">Opening Qty</th>
                <th className="px-3 py-3 text-right">Qty In</th>
                <th className="px-3 py-3 text-right">Qty Out</th>
                <th className="px-3 py-3 text-right">Closing Qty</th>
                <th className="px-3 py-3 text-right">Purchase Rate</th>
                <th className="px-3 py-3 text-right">MRP Rate</th>
                <th className="px-3 py-3">Subhead</th>
                <th className="px-3 py-3">Brand ID</th>
                <th className="px-3 py-3">Brand Name</th>
                <th className="px-3 py-3">Liquor Type</th>
                <th className="px-3 py-3">B/Cs</th>
                <th className="px-3 py-3">Mls</th>
                <th className="px-3 py-3">Type 1..6</th>
                <th className="px-3 py-3">Company Name</th>
                <th className="px-3 py-3">Party Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={isSelectMode ? 21 : 20} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">Loading stock records from database...</span>
                    </div>
                  </td>
                </tr>
              ) : stockRecords.length === 0 ? (
                <tr>
                  <td colSpan={isSelectMode ? 21 : 20} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No stock balance records found</span>
                      <p className="text-xs text-slate-400">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stockRecords.map((r, idx) => {
                  const recordKey = r.id || `row-${idx}`;
                  const isChecked = Boolean(r.id && selectedIds.has(r.id));

                  return (
                    <tr 
                      key={recordKey} 
                      className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-indigo-50/70' : ''}`}
                    >
                      {/* Checkbox: ONLY open for each entry when Select button is pressed */}
                      {isSelectMode && (
                        <td className="px-3.5 py-2.5 text-center animate-in fade-in">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectRow(r.id)}
                            className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Single Action: Delete */}
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>

                      {/* Data Columns */}
                      <td className="px-3 py-2.5 font-bold text-indigo-900">{r.shop_id || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{r.date || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{r.item_id || '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{r.item_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.opening_qty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-semibold">+{r.quantity_in}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-600 font-semibold">-{r.quantity_out}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40 rounded">
                        {r.closing_qty}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">₹{r.purchase_rate}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 font-semibold">₹{r.mrp_rate}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.subhead || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{r.brand_id ?? '—'}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-semibold">{r.brand_name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.liquor_type || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.b_cs || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.mls || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {[r.type1, r.type2, r.type3, r.type4, r.type5, r.type6].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{r.company_name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.party_name || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div>
            {totalCount > 0 ? (
              <>
                Showing <span className="font-bold text-slate-800">{((page - 1) * PAGE_SIZE + 1).toLocaleString()}</span>
                {'–'}
                <span className="font-bold text-slate-800">{Math.min(page * PAGE_SIZE, totalCount).toLocaleString()}</span>
                {' of '}
                <span className="font-bold text-slate-800">{totalCount.toLocaleString()}</span> records
              </>
            ) : (
              <>Showing <span className="font-bold text-slate-800">0</span> records</>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-1 flex-wrap justify-center" id="stock-pagination">
            <button
              onClick={() => setPage(1)}
              disabled={loading || page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              title="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={loading || page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              title="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {getPageList(page, totalPages).map((p, i) => (
              p === '…' ? (
                <span key={`gap-${i}`} className="px-1.5 text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={`min-w-[30px] px-2 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                    p === page
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.toLocaleString()}
                </button>
              )
            ))}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={loading || page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              title="Next page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={loading || page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
              title="Last page"
            >
              <ChevronsRight size={14} />
            </button>
            <span className="ml-2 text-[11px] text-slate-400">
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
