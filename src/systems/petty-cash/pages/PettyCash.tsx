import { useState, useEffect, useCallback } from 'react';
import {
  FaPlus, FaEdit, FaTrash, FaSync, FaSearch,
  FaFileAlt, FaStore, FaTimes, FaSave, FaCoins, FaWallet, FaUndo,
} from 'react-icons/fa';
import PettyCashModal, { CategoryAmounts } from '../components/PettyCashModal';
import { supabase } from '../supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PettyCashRow {
  id: string;
  date: string;
  shopName: string;
  username: string;
  openingQty: number;
  closing: number;
  totalExpense: number;
  totalAmount: number;
  transactionStatus: string;
  raw: Record<string, any>;
}

interface ShopRow {
  id: number;
  name: string;
}

interface PettyCashProps {
  onClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const statusColors: Record<string, string> = {
  Approved: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  Pending: 'bg-amber-100  text-amber-700  border border-amber-300',
  Rejected: 'bg-red-100    text-red-700    border border-red-300',
};

// ─── Map DB record → CategoryAmounts ─────────────────────────────────────────
function mapToFormData(rec: Record<string, any>): CategoryAmounts {
  return {
    id: rec.patty_id || '',
    username: rec.username || '',
    shopName: rec.shop_name || '',
    openingQty: rec.opening_qty?.toString() || '',
    teaNasta: rec.tea_nasta?.toString() || '',
    waterJar: rec.water_jar?.toString() || '',
    lightBill: rec.light_bill?.toString() || '',
    recharge: rec.recharge?.toString() || '',
    postOffice: rec.post_office?.toString() || '',
    customerDiscount: rec.customer_discount?.toString() || '',
    repairMaintenance: rec.repair_maintenance?.toString() || '',
    stationary: rec.stationary?.toString() || '',
    excisePolice: rec.excise_police?.toString() || '',
    desiBhada: rec.desi_bhada?.toString() || '',
    otherPurchaseVoucherNo: rec.other_purchase_voucher_no || '',
    otherVendorPayment: rec.other_vendor_payment?.toString() || '',
    differenceAmount: rec.difference_amount?.toString() || '',
    petrol: rec.petrol?.toString() || '',
    patilPetrol: rec.patil_petrol?.toString() || '',
    roomExpense: rec.room_expense?.toString() || '',
    officeExpense: rec.office_expense?.toString() || '',
    personalExpense: rec.personal_expense?.toString() || '',
    miscExpense: rec.misc_expense?.toString() || '',
    closing: rec.closing?.toString() || '',
    creditCardCharges: rec.credit_card_charges?.toString() || '',
    otherExpenses: rec.other_expenses || [],
    miscRemarks: rec.misc_remarks || '',
    transactionStatus: rec.transaction_status || 'Pending',
    date: rec.date || new Date().toISOString().split('T')[0],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PettyCash({ onClose = () => { } }: PettyCashProps) {

  // ── Expense state ───────────────────────────────────────────────────────────
  const [rows, setRows] = useState<PettyCashRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<CategoryAmounts | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Shop state ──────────────────────────────────────────────────────────────
  const [shopsPanelOpen, setShopsPanelOpen] = useState(false);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [shopsLoading, setShopsLoading] = useState(false);
  const [shopSearch, setShopSearch] = useState('');
  const [shopModal, setShopModal] = useState(false);
  const [shopEditTarget, setShopEditTarget] = useState<ShopRow | null>(null);
  const [shopNameInput, setShopNameInput] = useState('');
  const [shopSaving, setShopSaving] = useState(false);
  const [shopError, setShopError] = useState('');
  const [shopDeleteTarget, setShopDeleteTarget] = useState<ShopRow | null>(null);
  const [shopDeleting, setShopDeleting] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // Expense — fetch / CRUD
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('petty_cash_expense')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      setRows((data || []).map((rec: any) => ({
        id: rec.patty_id,
        date: rec.date,
        shopName: rec.shop_name || '—',
        username: rec.username || '—',
        openingQty: rec.opening_qty || 0,
        closing: rec.closing || 0,
        totalExpense: rec.total_expense || 0,
        totalAmount: rec.total_amount || 0,
        transactionStatus: rec.transaction_status || 'Pending',
        raw: rec,
      })));
    } catch (err) { console.error('Error fetching petty cash:', err); }
    finally { setLoading(false); }
  }, []);

  const fetchShops = useCallback(async () => {
    setShopsLoading(true);
    try {
      const { data, error } = await supabase
        .from('petty_cash_shops')
        .select('*')
        .order('id', { ascending: true });
      if (error) throw error;
      setShops((data || []).map((r: any) => ({ id: r.id, name: r.name || '' })));
    } catch (err) { console.error('Error fetching shops:', err); }
    finally { setShopsLoading(false); }
  }, []);

  useEffect(() => {
    fetchRows();
    fetchShops();
  }, [fetchRows, fetchShops]);

  const openAddModal = () => { setEditData(undefined); setIsModalOpen(true); };
  const openEditModal = (row: PettyCashRow) => { setEditData(mapToFormData(row.raw)); setIsModalOpen(true); };
  const handleSave = () => { setIsModalOpen(false); fetchRows(); };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('petty_cash_expense').delete().eq('patty_id', deleteId);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== deleteId));
    } catch (err) { console.error('Error deleting:', err); }
    finally { setDeleting(false); setDeleteId(null); }
  };

  const filtered = rows.filter(r => {
    const matchesSearch =
      !search.trim() ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.shopName.toLowerCase().includes(search.toLowerCase()) ||
      r.username.toLowerCase().includes(search.toLowerCase()) ||
      r.date.includes(search);

    const matchesFromDate = !fromDate || r.date >= fromDate;
    const matchesToDate = !toDate || r.date <= toDate;
    const matchesShop = !shopFilter || r.shopName.toLowerCase() === shopFilter.toLowerCase();

    return matchesSearch && matchesFromDate && matchesToDate && matchesShop;
  });

  const hasActiveFilters = Boolean(search || fromDate || toDate || shopFilter);
  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setShopFilter('');
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Shops — fetch / CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  const openShopsPanel = () => { setShopsPanelOpen(true); fetchShops(); };

  const openAddShop = () => {
    setShopEditTarget(null);
    setShopNameInput('');
    setShopError('');
    setShopModal(true);
  };

  const openEditShop = (shop: ShopRow) => {
    setShopEditTarget(shop);
    setShopNameInput(shop.name);
    setShopError('');
    setShopModal(true);
  };

  const handleShopSave = async () => {
    setShopError('');
    if (!shopNameInput.trim()) { setShopError('Shop name is required.'); return; }
    setShopSaving(true);
    try {
      if (shopEditTarget) {
        const { error } = await supabase.from('petty_cash_shops').update({ name: shopNameInput.trim() }).eq('id', shopEditTarget.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('petty_cash_shops').insert([{ name: shopNameInput.trim() }]);
        if (error) throw error;
      }
      await fetchShops();
      setShopModal(false);
    } catch (err: any) { setShopError(err.message || 'Failed to save.'); }
    finally { setShopSaving(false); }
  };

  const confirmShopDelete = async () => {
    if (!shopDeleteTarget) return;
    setShopDeleting(true);
    try {
      const { error } = await supabase.from('petty_cash_shops').delete().eq('id', shopDeleteTarget.id);
      if (error) throw error;
      setShops(prev => prev.filter(s => s.id !== shopDeleteTarget.id));
      setShopDeleteTarget(null);
    } catch (err: any) { alert('Delete failed: ' + (err.message || err)); }
    finally { setShopDeleting(false); }
  };

  const filteredShops = shops.filter(s =>
    !shopSearch.trim() ||
    s.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
    String(s.id).includes(shopSearch)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Summary Cards (Over table) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
        {/* Total Opening Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Total Opening</p>
            <h3 className="text-lg font-medium font-sans text-gray-800 mt-1">
              {fmt(filtered.reduce((s, r) => s + r.openingQty, 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2a5298] flex items-center justify-center shrink-0 border border-blue-100">
            <FaCoins className="text-lg" />
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Total Expense</p>
            <h3 className="text-lg font-medium font-sans text-rose-600 mt-1">
              {fmt(filtered.reduce((s, r) => s + r.totalExpense, 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <FaWallet className="text-lg" />
          </div>
        </div>

        {/* Total Closing Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Total Closing</p>
            <h3 className="text-lg font-medium font-sans text-emerald-700 mt-1">
              {fmt(filtered.reduce((s, r) => s + r.closing, 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <FaFileAlt className="text-lg" />
          </div>
        </div>
      </div>

      {/* ── Filter Bar (Below cards) ── */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">

          {/* Filters: From Date, To Date, Shop Select, Search */}
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* From Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white"
              />
            </div>

            {/* Shop Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Shop:</label>
              <select
                value={shopFilter}
                onChange={e => setShopFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white max-w-[160px]"
              >
                <option value="">All Shops</option>
                {shops.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search by ID, shop, user…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all"
              />
            </div>

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all font-medium border border-red-200 cursor-pointer"
              >
                <FaUndo className="text-[10px]" /> Clear
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh */}
            <button
              onClick={fetchRows}
              title="Refresh"
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-medium cursor-pointer"
            >
              <FaSync className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Shops */}
            <button
              onClick={openShopsPanel}
              title="Manage Shops"
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-medium cursor-pointer"
            >
              <FaStore />
              <span className="hidden sm:inline">Shops</span>
            </button>

            {/* Add New Expense */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#2a5298] text-white rounded-lg font-semibold hover:bg-[#1e3d70] transition-all shadow-md text-xs cursor-pointer"
            >
              <FaPlus />
              <span className="hidden sm:inline">Add New Expense</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-500">
          <FaFileAlt className="text-[#2a5298]" />
          <span>{loading ? 'Loading…' : `${filtered.length} record${filtered.length !== 1 ? 's' : ''}`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#2a5298] text-white">
              <tr>
                {['#', 'ID', 'Date', 'Shop', 'User', 'Opening', 'Expense', 'Closing', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin" />
                    <span>Loading records…</span>
                  </div>
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-16 text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <FaFileAlt className="text-4xl text-gray-300" />
                    <p className="font-medium">No records found</p>
                    {hasActiveFilters && <p className="text-xs">Try adjusting your filters</p>}
                  </div>
                </td></tr>
              )}
              {!loading && filtered.map((row, idx) => (
                <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#2a5298] whitespace-nowrap">{row.id}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{row.shopName}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.username}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(row.openingQty)}</td>
                  <td className="px-4 py-3 text-rose-600 font-semibold whitespace-nowrap">{fmt(row.totalExpense)}</td>
                  <td className="px-4 py-3 text-emerald-700 font-semibold whitespace-nowrap">{fmt(row.closing)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[row.transactionStatus] ?? 'bg-gray-100 text-gray-600 border border-gray-300'}`}>
                      {row.transactionStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditModal(row)} title="Edit" className="p-2 rounded-lg text-[#2a5298] hover:bg-blue-100 transition-colors"><FaEdit /></button>
                      <button onClick={() => setDeleteId(row.id)} title="Delete" className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition-colors"><FaTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── PettyCash Modal ── */}
      <PettyCashModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editData} />

      {/* ── Delete Expense Confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><FaTrash className="text-red-500" /></div>
              <div>
                <h3 className="font-bold text-gray-800">Delete Record</h3>
                <p className="text-sm text-gray-500 mt-0.5">Delete <span className="font-mono font-semibold text-[#2a5298]">{deleteId}</span>? This cannot be undone.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {deleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          Shops slide-over panel
      ════════════════════════════════════════════════ */}
      {shopsPanelOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShopsPanelOpen(false)} />

          {/* Panel */}
          <aside className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#2a5298]">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FaStore /> Manage Shops
              </h2>
              <button onClick={() => setShopsPanelOpen(false)} className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white">
                <FaTimes />
              </button>
            </div>

            {/* Search + Add */}
            <div className="px-5 py-3 border-b border-gray-100 flex gap-2">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search shops…"
                  value={shopSearch}
                  onChange={e => setShopSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all"
                />
              </div>
              <button
                onClick={openAddShop}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#2a5298] text-white rounded-lg text-sm font-semibold hover:bg-[#1e3d70] transition-all shadow-sm"
              >
                <FaPlus className="text-xs" /> Add Shop
              </button>
            </div>

            {/* Shop list */}
            <div className="flex-1 overflow-y-auto">
              {shopsLoading && (
                <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
                  <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Loading shops…</span>
                </div>
              )}

              {!shopsLoading && filteredShops.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
                  <FaStore className="text-4xl text-gray-300" />
                  <p className="font-medium text-sm">No shops found</p>
                  <button onClick={openAddShop} className="mt-1 text-sm text-[#2a5298] hover:underline font-medium">+ Add your first shop</button>
                </div>
              )}

              {!shopsLoading && filteredShops.map((shop, idx) => (
                <div
                  key={shop.id}
                  className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 hover:bg-blue-50/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-400 w-5 shrink-0">{idx + 1}</span>
                    <span className="font-mono text-xs font-bold text-[#2a5298] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shrink-0">
                      #{shop.id}
                    </span>
                    <span className="text-sm font-medium text-gray-800 truncate">{shop.name}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditShop(shop)} title="Edit" className="p-1.5 rounded-lg text-[#2a5298] hover:bg-blue-100 transition-colors"><FaEdit className="text-xs" /></button>
                    <button onClick={() => setShopDeleteTarget(shop)} title="Delete" className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-colors"><FaTrash className="text-xs" /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Panel footer */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-center">
              {filteredShops.length} shop{filteredShops.length !== 1 ? 's' : ''} · Changes reflect instantly in the entry form
            </div>
          </aside>
        </div>
      )}

      {/* ── Add / Edit Shop Modal ── */}
      {shopModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <FaStore className="text-[#2a5298]" />
                {shopEditTarget ? 'Edit Shop' : 'Add New Shop'}
              </h3>
              <button onClick={() => setShopModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <FaTimes className="text-gray-500" />
              </button>
            </div>

            {shopError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">{shopError}</div>
            )}

            {shopEditTarget && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">Shop ID:</span>
                <span className="font-mono font-bold text-[#2a5298] bg-blue-50 px-2 py-0.5 rounded text-sm border border-blue-200">#{shopEditTarget.id}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Shop Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={shopNameInput}
                onChange={e => setShopNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleShopSave(); }}
                placeholder="Shop name"
                autoFocus
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all"
              />
              <p className="text-xs text-gray-400 mt-1.5">Appears in the Petty Cash entry form dropdown.</p>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShopModal(false)} disabled={shopSaving} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm font-medium">Cancel</button>
              <button onClick={handleShopSave} disabled={shopSaving} className="flex items-center gap-2 px-5 py-2 bg-[#2a5298] text-white rounded-lg hover:bg-[#1e3d70] text-sm font-semibold shadow-md disabled:opacity-60">
                {shopSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <FaSave />
                {shopSaving ? 'Saving…' : shopEditTarget ? 'Save Changes' : 'Add Shop'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Shop Confirm ── */}
      {shopDeleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0"><FaTrash className="text-red-500" /></div>
              <div>
                <h3 className="font-bold text-gray-800">Delete Shop</h3>
                <p className="text-sm text-gray-500 mt-0.5">Delete <span className="font-semibold text-gray-800">"{shopDeleteTarget.name}"</span>? It will no longer appear in the entry form.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShopDeleteTarget(null)} disabled={shopDeleting} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium">Cancel</button>
              <button onClick={confirmShopDelete} disabled={shopDeleting} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {shopDeleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {shopDeleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}