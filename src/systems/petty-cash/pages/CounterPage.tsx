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
  const [showCounterSelectDropdown, setShowCounterSelectDropdown] = useState(false);
  const tallyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parseAllowedCounters = () => {
      try {
        const userStr = localStorage.getItem("currentUser");
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u && Array.isArray(u.counter_access)) {
            return u.counter_access.map((c: any) => String(c).trim().toUpperCase());
          }
          if (u && Array.isArray(u.counterAccess)) {
            return u.counterAccess.map((c: any) => String(c).trim().toUpperCase());
          }
        }
      } catch (e) {
        console.error("[CounterPage] Error parsing currentUser:", e);
      }

      try {
        const hrUserStr = localStorage.getItem("hr_user");
        if (hrUserStr) {
          const hr = JSON.parse(hrUserStr);
          if (hr && Array.isArray(hr.counter_access)) {
            return hr.counter_access.map((c: any) => String(c).trim().toUpperCase());
          }
        }
      } catch (e) {
        console.error("[CounterPage] Error parsing hr_user:", e);
      }

      return getAllowedCounters();
    };

    setAllowedCounters(parseAllowedCounters());
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
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [activeModalCounter, setActiveModalCounter] = useState<string>("COUNTER-1");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteCounter, setDeleteCounter] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Grouped rows expand state (Key is "counter_date")
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDate = (counterKey: string, dateVal: string) => {
    const key = `${counterKey}_${dateVal}`;
    setExpandedDates(prev => ({ ...prev, [key]: !prev[key] }));
  };

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

    return matchesSearch && matchesFromDate && matchesToDate && matchesShop;
  });

  const hasActiveFilters = Boolean(search || fromDate || toDate || shopFilter);
  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setShopFilter("");
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans">
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

      {/* ── Table Card for Each Counter ── */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Loading cash tallies...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {allowedCounters.map((cVal) => {
            const rowsForThisCounter = groupedByCounter[cVal] || [];

            // Group by date
            const dateGroups: Record<string, TallyRow[]> = {};
            rowsForThisCounter.forEach((row) => {
              const d = row.date;
              if (!dateGroups[d]) {
                dateGroups[d] = [];
              }
              dateGroups[d].push(row);
            });

            const sortedDates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));

            return (
              <div key={cVal} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
                {/* Collapsible header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                    {cVal}
                    <span className="text-xs text-gray-400 font-normal">
                      ({rowsForThisCounter.length} records)
                    </span>
                  </h2>

                </div>

                {rowsForThisCounter.length === 0 ? (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    No cash tally records found for {cVal}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
                      <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5 w-44">Date</th>
                          <th className="px-4 py-2.5">Shop Name(s)</th>
                          <th className="px-4 py-2.5">Staff Name(s)</th>
                          <th className="px-4 py-2.5 w-32">Total Retail Scan (₹)</th>
                          <th className="px-4 py-2.5 w-32">Total Expense (₹)</th>
                          <th className="px-4 py-2.5 w-24 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-850">
                        {sortedDates.map((dateVal) => {
                          const entries = dateGroups[dateVal];
                          const expandKey = `${cVal}_${dateVal}`;
                          const isExpanded = !!expandedDates[expandKey];
                          const totalRetail = entries.reduce((s, r) => s + r.retailScanAmount, 0);
                          const totalExp = entries.reduce((s, r) => s + r.totalExpense, 0);

                          const uniqueShops = Array.from(new Set(entries.map((e) => e.shopName))).join(", ");
                          const uniqueNames = Array.from(new Set(entries.map((e) => e.name))).join(", ");

                          return (
                            <tbody key={dateVal} className="divide-y divide-gray-100">
                              {/* Date summary row */}
                              <tr
                                onClick={() => toggleDate(cVal, dateVal)}
                                className="bg-slate-50/50 hover:bg-blue-50/30 transition-colors cursor-pointer"
                              >
                                <td className="px-4 py-2.5 whitespace-nowrap font-bold text-gray-900 flex items-center gap-2">
                                  <span className="text-[9px] text-gray-500 w-3">{isExpanded ? "▼" : "▶"}</span>
                                  <FaCalendarAlt className="text-gray-400 text-[11px]" />
                                  {dateVal}
                                  {entries.length > 1 && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-extrabold rounded-full">
                                      {entries.length} Entries
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 truncate max-w-[200px]">
                                  {uniqueShops}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-gray-600 truncate max-w-[150px]">
                                  {uniqueNames}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-slate-800">
                                  {fmt(totalRetail)}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-rose-600">
                                  {fmt(totalExp)}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-right text-gray-400 text-[10px] font-bold uppercase tracking-wider select-none">
                                  {isExpanded ? "Collapse" : "Expand"}
                                </td>
                              </tr>

                              {/* Expanded individual sub-rows */}
                              {isExpanded &&
                                entries.map((entry) => (
                                  <tr
                                    key={entry.id}
                                    className="bg-white hover:bg-slate-50/80 transition-colors border-l-2 border-blue-500/50"
                                  >
                                    <td className="pl-8 pr-4 py-2 whitespace-nowrap font-mono text-[10px] text-slate-400">
                                      ↳ {entry.tally_id}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-[#2a5298] border border-blue-100 font-semibold">
                                        <FaStore size={9} />
                                        {entry.shopName}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">
                                      <span className="inline-flex items-center gap-1">
                                        <FaUser className="text-gray-400 text-[10px]" />
                                        {entry.name}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-600 font-normal">
                                      {fmt(entry.retailScanAmount)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-rose-500 font-normal">
                                      {fmt(entry.totalExpense)}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right space-x-2">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditModal(entry);
                                        }}
                                        title="Edit Record"
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                      >
                                        <FaEdit size={12} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteId(entry.id);
                                          setDeleteCounter(entry.counterVal);
                                        }}
                                        title="Delete Record"
                                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                      >
                                        <FaTrash size={12} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
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
