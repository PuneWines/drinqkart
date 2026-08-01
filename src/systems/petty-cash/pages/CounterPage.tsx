import { useState, useEffect, useCallback } from "react";
import {
  FaPlus, FaEdit, FaTrash, FaSync, FaSearch,
  FaCalculator, FaCalendarAlt, FaStore, FaUser,
  FaCoins, FaWallet, FaFileAlt, FaUndo
} from "react-icons/fa";
import CashTally from "./CashTally";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabase";

interface CounterPageProps {
  counter: number;
  onClose?: () => void;
}

interface TallyRow {
  id: string;
  tally_id: string;
  date: string;
  shopName: string;
  name: string;
  retailScanAmount: number;
  totalExpense: number;
  raw: any;
}

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export default function CounterPage({ counter }: CounterPageProps) {
  const { hasCounterAccess } = useAuth();
  const [rows, setRows] = useState<TallyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [shops, setShops] = useState<{ id: number; name: string }[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("petty_cash_tallies")
        .select("*")
        .eq("counter", counter)
        .order("date", { ascending: false });

      if (error) throw error;

      const mapped: TallyRow[] = (data || []).map((rec: any) => ({
        id: rec.tally_id || rec.id,
        tally_id: rec.tally_id || rec.id,
        date: rec.date || "",
        shopName: rec.shop_name || "—",
        name: rec.name || "—",
        retailScanAmount: Number(rec.retail_scan_amount) || 0,
        totalExpense: Number(rec.expense) || 0,
        raw: rec,
      }));

      setRows(mapped);
    } catch (err) {
      console.error(`[CounterPage ${counter}] Error fetching rows:`, err);
    } finally {
      setLoading(false);
    }
  }, [counter]);

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
      console.error(`[CounterPage ${counter}] Error fetching shops:`, err);
    }
  }, [counter]);

  useEffect(() => {
    fetchRows();
    fetchShops();
  }, [fetchRows, fetchShops]);

  const handleOpenAddModal = () => {
    setEditData(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (row: TallyRow) => {
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
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("petty_cash_tallies")
        .delete()
        .eq("tally_id", deleteId)
        .eq("counter", counter);
      if (error) throw error;
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
    } catch (err) {
      console.error(`[CounterPage ${counter}] Error deleting:`, err);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search.trim() ||
      r.shopName.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.date.includes(q) ||
      r.tally_id.toLowerCase().includes(q);

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

  if (!hasCounterAccess(counter)) {
    return (
      <div className="p-8 text-center text-gray-500 font-semibold bg-white rounded-2xl border border-gray-200">
        Access Denied: You do not have permission to view Counter {counter}.
      </div>
    );
  }

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

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh */}
            <button
              onClick={fetchRows}
              title="Refresh"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-medium cursor-pointer"
            >
              <FaSync className={loading ? "animate-spin text-[11px]" : "text-[11px]"} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Fill Tally Form */}
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2a5298] text-white rounded-lg font-semibold hover:bg-[#1e3d70] transition-all shadow-xs text-xs cursor-pointer"
            >
              <FaPlus className="text-[10px]" />
              <span>Fill Tally Form</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
            <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Shop Name</th>
                <th className="px-4 py-2.5">Staff Name</th>
                <th className="px-4 py-2.5">Retail Scan (₹)</th>
                <th className="px-4 py-2.5">Expense (₹)</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white font-medium text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#2a5298] border-t-transparent rounded-full animate-spin" />
                      <span>Loading Counter {counter} Records...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    No cash tally records found for Counter {counter}. Click "Fill Tally Form" to add one.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-gray-900 flex items-center gap-2">
                      <FaCalendarAlt className="text-gray-400 text-xs" />
                      {row.date}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#2a5298] border border-blue-200">
                        <FaStore className="text-[10px]" />
                        {row.shopName}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-gray-700">
                        <FaUser className="text-gray-400 text-xs" />
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-normal text-slate-800">
                      {fmt(row.retailScanAmount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-normal text-rose-600">
                      {fmt(row.totalExpense)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEditModal(row)}
                        title="Edit Record"
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                      >
                        <FaEdit size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteId(row.id)}
                        title="Delete Record"
                        className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      >
                        <FaTrash size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cash Tally Form Modal ── */}
      {isModalOpen && (
        <CashTally
          isOpen={isModalOpen}
          counter={counter}
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
                onClick={() => setDeleteId(null)}
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
