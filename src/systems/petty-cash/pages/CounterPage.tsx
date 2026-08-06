import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FaPlus, FaEdit, FaTrash, FaSync, FaSearch, FaChevronDown,
  FaCalendarAlt, FaStore, FaUser,
  FaCoins, FaWallet, FaFileAlt, FaUndo
} from "react-icons/fa";
import CashTally from "./CashTally";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabase";

interface CounterPageProps {
  onClose?: () => void;
}

interface TallyRow {
  id: string;
  tally_id: string;
  counterVal: string;
  date: string;
  shopName: string;
  name: string;
  retailScanAmount: number;
  totalExpense: number;
  raw: any;
}

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function CounterPage({ onClose }: CounterPageProps) {
  const { getAllowedCounters } = useAuth();
  
  const [allowedCounters, setAllowedCounters] = useState<string[]>([]);
  const [counterOptions, setCounterOptions] = useState<string[]>([]);
  const [showCounterSelectDropdown, setShowCounterSelectDropdown] = useState(false);
  const tallyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parseAllowedCounters = () => {
      try {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          const u = JSON.parse(userStr);
          const rawAccess = u && (u.counter_access || u.counterAccess);
          if (rawAccess) {
            if (Array.isArray(rawAccess)) {
              return rawAccess.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
            }
            if (typeof rawAccess === "string") {
              return rawAccess.split(",").map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
            }
          }
        }
      } catch (e) {
        console.error("[CounterPage] Error parsing currentUser:", e);
      }

      try {
        const hrUserStr = localStorage.getItem("hr_user");
        if (hrUserStr) {
          const hr = JSON.parse(hrUserStr);
          const rawAccess = hr && (hr.counter_access || hr.counterAccess);
          if (rawAccess) {
            if (Array.isArray(rawAccess)) {
              return rawAccess.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
            }
            if (typeof rawAccess === "string") {
              return rawAccess.split(",").map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
            }
          }
        }
      } catch (e) {
        console.error("[CounterPage] Error parsing hr_user:", e);
      }

      return getAllowedCounters();
    };

    const parsed = parseAllowedCounters();
    setAllowedCounters(parsed);
    setCounterOptions(parsed);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tallyDropdownRef.current &&
        !tallyDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCounterSelectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [rows, setRows] = useState<TallyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [counterFilter, setCounterFilter] = useState("");
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [activeModalCounter, setActiveModalCounter] = useState<string>("COUNTER-1");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCounter, setDeleteCounter] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleFillTallyClick = () => {
    handleOpenAddModal(allowedCounters[0] || "COUNTER-1");
  };

  const fetchRows = useCallback(async () => {
    if (allowedCounters.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("petty_cash_tallies")
        .select("*")
        .in("counter", allowedCounters)
        .order("date", { ascending: false });

      if (error) throw error;

      const mapped: TallyRow[] = (data || []).map((rec: any) => ({
        id: rec.tally_id || rec.id,
        tally_id: rec.tally_id || rec.id,
        counterVal: rec.counter || "COUNTER-1",
        date: rec.date || "",
        shopName: rec.shop_name || "—",
        name: rec.name || "—",
        retailScanAmount: Number(rec.retail_scan_amount) || 0,
        totalExpense: Number(rec.expense) || 0,
        raw: rec,
      }));

      setRows(mapped);
    } catch (err) {
      console.error("[CounterPage] Error fetching rows:", err);
    } finally {
      setLoading(false);
    }
  }, [allowedCounters]);

  const fetchShops = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shop")
        .select("*")
        .order("shop_name", { ascending: true });

      if (!error && data && data.length > 0) {
        setShops(data.map((r: any, idx: number) => ({ id: r.id || idx + 1, name: r.shop_name || r.name || "" })));
      } else {
        const { data: pcData, error: pcError } = await supabase
          .from("petty_cash_shops")
          .select("*")
          .order("id", { ascending: true });
        if (!pcError && pcData) {
          setShops(pcData.map((r: any) => ({ id: r.id, name: r.name || "" })));
        }
      }
    } catch (err) {
      console.error("[CounterPage] Error fetching shops:", err);
    }
  }, []);

  useEffect(() => {
    fetchRows();
    fetchShops();
  }, [fetchRows, fetchShops]);

  const handleOpenAddModal = (cVal: string) => {
    setActiveModalCounter(cVal);
    setEditData(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (row: TallyRow) => {
    setActiveModalCounter(row.counterVal);
    const raw = row.raw || {};
    const formattedData = {
      tally_id: raw.tally_id,
      date: raw.date,
      name: raw.name,
      shopName: raw.shop_name,
      retailScanAmount: raw.retail_scan_amount?.toString() || "",
      retail500: raw.retail_500?.toString() || "",
      retail200: raw.retail_200?.toString() || "",
      retail100: raw.retail_100?.toString() || "",
      retail50: raw.retail_50?.toString() || "",
      retail20: raw.retail_20?.toString() || "",
      retail10: raw.retail_10?.toString() || "",
      retail1: raw.retail_1?.toString() || "",
      retailGpay: raw.retail_gpay?.toString() || "",
      retailPhonePe: raw.retail_phonepe?.toString() || "",
      retailPaytm: raw.retail_paytm?.toString() || "",
      retailCard: raw.retail_card?.toString() || "",
      wsCashBillingAmount: raw.ws_cash_billing_amount?.toString() || "",
      wsCreditBillingAmount: raw.ws_credit_billing_amount?.toString() || "",
      wsCreditReceipt: raw.ws_credit_receipt?.toString() || "",
      ws500: raw.ws_500?.toString() || "",
      ws200: raw.ws_200?.toString() || "",
      ws100: raw.ws_100?.toString() || "",
      ws50: raw.ws_50?.toString() || "",
      ws20: raw.ws_20?.toString() || "",
      ws10: raw.ws_10?.toString() || "",
      ws1: raw.ws_1?.toString() || "",
      wsGpayCard: raw.ws_gpay_card?.toString() || "",
      wsPhonePe: raw.ws_phonepe?.toString() || "",
      wsPaytm: raw.ws_paytm?.toString() || "",
      wsCard: raw.ws_card?.toString() || "",
      expense: raw.expense?.toString() || "",
      homeDelivery: raw.home_delivery?.toString() || "",
      retail1500: raw.retail_1500?.toString() || "",
      retail2200: raw.retail_2200?.toString() || "",
      retail3100: raw.retail_3100?.toString() || "",
      retail450: raw.retail_450?.toString() || "",
      retail520: raw.retail_520?.toString() || "",
      retail610: raw.retail_610?.toString() || "",
      retail71: raw.retail_71?.toString() || "",
      voidSale: raw.void_sale?.toString() || "",
      expenseGpayCard: raw.expense_gpay_card?.toString() || "",
    };
    setEditData(formattedData);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId || !deleteCounter) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("petty_cash_tallies")
        .delete()
        .eq("tally_id", deleteId)
        .eq("counter", deleteCounter);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      setDeleteCounter(null);
    } catch (err) {
      console.error("[CounterPage] Error deleting tally:", err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = rows.filter((r) => {
    const isCounterAllowed = allowedCounters.some(
      (c) => c.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === r.counterVal.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
    );
    if (!isCounterAllowed) return false;

    const q = search.toLowerCase();
    const matchesSearch =
      !search.trim() ||
      r.shopName.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.date.includes(q) ||
      r.tally_id.toLowerCase().includes(q) ||
      r.counterVal.toLowerCase().includes(q);

    const matchesFromDate = !fromDate || r.date >= fromDate;
    const matchesToDate = !toDate || r.date <= toDate;
    const matchesShop = !shopFilter || r.shopName.toLowerCase() === shopFilter.toLowerCase();
    const matchesCounter = !counterFilter || r.counterVal.toLowerCase().trim() === counterFilter.toLowerCase().trim();

    return matchesSearch && matchesFromDate && matchesToDate && matchesShop && matchesCounter;
  });

  const hasActiveFilters = Boolean(search || fromDate || toDate || shopFilter || counterFilter);
  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setShopFilter("");
    setCounterFilter("");
  };

  if (allowedCounters.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 font-semibold bg-white rounded-2xl border border-gray-200">
        Access Denied: You do not have permission to view any cash tally counters.
      </div>
    );
  }

  // Group filtered records by counter
  const groupedByCounter: Record<string, TallyRow[]> = {};
  filtered.forEach((row) => {
    const cVal = row.counterVal;
    if (!groupedByCounter[cVal]) {
      groupedByCounter[cVal] = [];
    }
    groupedByCounter[cVal].push(row);
  });

  return (
    <div className="space-y-5">
      {/* ── Summary Cards (Over table) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 font-sans">
        {/* Total Retail Scan Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Total Retail Scan</p>
            <h3 className="text-lg font-medium font-sans text-slate-800 mt-1">
              {fmt(filtered.reduce((s, r) => s + r.retailScanAmount, 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2a5298] flex items-center justify-center shrink-0 border border-blue-100">
            <FaCoins className="text-lg" />
          </div>
        </div>

        {/* Total Wholesale Scan Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Total Wholesale Scan</p>
            <h3 className="text-lg font-medium font-sans text-slate-800 mt-1">
              {fmt(filtered.reduce((s, r) => s + (Number(r.raw.ws_cash_billing_amount) || 0) + (Number(r.raw.ws_credit_receipt) || 0), 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0 border border-green-100">
            <FaCoins className="text-lg" />
          </div>
        </div>

        {/* Total Expenses and Others Scan Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Total Expenses & Others Scan</p>
            <h3 className="text-lg font-medium font-sans text-slate-800 mt-1">
              {fmt(filtered.reduce((s, r) => s + r.totalExpense + (Number(r.raw.home_delivery) || 0) + (Number(r.raw.void_sale) || 0) + (Number(r.raw.expense_gpay_card) || 0), 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
            <FaWallet className="text-lg" />
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500">Total Expenses</p>
            <h3 className="text-lg font-medium font-normal text-rose-600 mt-1">
              {fmt(filtered.reduce((s, r) => s + r.totalExpense, 0))}
            </h3>
          </div>
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <FaWallet className="text-lg" />
          </div>
        </div>

        {/* Net Total Card */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-normal text-gray-500 font-sans">Net Total</p>
            <h3 className="text-lg font-medium font-sans text-emerald-700 mt-1">
              {fmt(filtered.reduce((s, r) => s + (r.retailScanAmount - r.totalExpense), 0))}
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
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white"
              />
            </div>

            {/* Shop Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Shop:</label>
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white max-w-[160px]"
              >
                <option value="">All Shops</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Counter Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Counter:</label>
              <select
                value={counterFilter}
                onChange={(e) => setCounterFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white min-w-[120px]"
              >
                <option value="">All Counters</option>
                {counterOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search tally records…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

          {/* Refresh & Fill Tally Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchRows}
              title="Refresh"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-medium cursor-pointer"
            >
              <FaSync className={loading ? "animate-spin text-[11px]" : "text-[11px]"} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Fill Tally Entry Button */}
            {allowedCounters.length > 0 && (
              <button
                onClick={handleFillTallyClick}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2a5298] text-white rounded-lg font-semibold hover:bg-[#1e3d70] transition-all shadow-xs text-xs cursor-pointer"
              >
                <FaPlus className="text-[10px]" />
                <span>Fill Tally Entry</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Loading cash tallies...</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-500">
            <FaFileAlt className="text-[#2a5298]" />
            <span>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#2a5298] text-white text-left">
                <tr>
                  {['#', 'ID', 'Date', 'Counter', 'Shop', 'User', 'Retail Scan', 'Expense', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FaFileAlt className="text-4xl text-gray-300" />
                        <p className="font-medium">No records found</p>
                        {hasActiveFilters && <p className="text-xs">Try adjusting your filters</p>}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((row, idx) => (
                  <tr key={row.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#2a5298] whitespace-nowrap">{row.tally_id}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {row.date ? new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase">
                        {row.counterVal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{row.shopName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.name}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-semibold">{fmt(row.retailScanAmount)}</td>
                    <td className="px-4 py-3 text-rose-600 font-semibold whitespace-nowrap">{fmt(row.totalExpense)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleOpenEditModal(row)} title="Edit" className="p-2 rounded-lg text-[#2a5298] hover:bg-blue-100 transition-colors"><FaEdit /></button>
                        <button onClick={() => { setDeleteId(row.id); setDeleteCounter(row.counterVal); }} title="Delete" className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition-colors"><FaTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Cash Tally Form Modal ── */}
      {isModalOpen && (
        <CashTally
          isOpen={isModalOpen}
          counter={activeModalCounter}
          initialData={editData}
          onClose={() => {
            setIsModalOpen(false);
            fetchRows();
          }}
        />
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <FaTrash className="text-red-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Delete Tally Record</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Are you sure you want to delete this record? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setDeleteId(null);
                  setDeleteCounter(null);
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {deleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
