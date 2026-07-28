import { useState, useEffect, useCallback } from "react";
import {
  FaPlus, FaEdit, FaTrash, FaSync, FaSearch,
  FaCalculator, FaCalendarAlt, FaStore, FaUser
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

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

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
    return (
      r.shopName.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.date.includes(q) ||
      r.tally_id.toLowerCase().includes(q)
    );
  });

  if (!hasCounterAccess(counter)) {
    return (
      <div className="p-8 text-center text-gray-500 font-semibold bg-white rounded-2xl border border-gray-200">
        Access Denied: You do not have permission to view Counter {counter}.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FaCalculator className="text-[#2a5298]" />
            Counter {counter} Cash Tally Records
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            View daily tally records and submit new entries for Counter {counter}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tally records..."
              className="pl-7 pr-2.5 py-1.5 border border-gray-300 rounded-md text-xs bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#2a5298] focus:border-[#2a5298] w-48 sm:w-56"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={fetchRows}
            title="Refresh"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-md hover:bg-gray-100 transition-all text-xs font-medium cursor-pointer"
          >
            <FaSync className={loading ? "animate-spin text-[11px]" : "text-[11px]"} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Add Tally Entry / Fill Form */}
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#2a5298] text-white rounded-md font-semibold hover:bg-[#1e3d70] transition-all shadow-xs text-xs cursor-pointer"
          >
            <FaPlus className="text-[10px]" />
            <span>Fill Tally Form</span>
          </button>
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
                    <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-800">
                      {fmt(row.retailScanAmount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-bold text-rose-600">
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

        {/* Summary Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-6 text-xs font-semibold">
            <div>
              <span className="text-gray-500">Total Scan Amount: </span>
              <span className="font-bold text-slate-900">{fmt(filtered.reduce((s, r) => s + r.retailScanAmount, 0))}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Expenses: </span>
              <span className="font-bold text-rose-600">{fmt(filtered.reduce((s, r) => s + r.totalExpense, 0))}</span>
            </div>
          </div>
        )}
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
