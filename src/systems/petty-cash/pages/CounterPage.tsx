import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  FaPlus, FaEdit, FaTrash, FaSync, FaSearch, FaChevronDown,
  FaCalendarAlt, FaStore, FaUser,
  FaCoins, FaWallet, FaFileAlt, FaUndo, FaFileExcel
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
  status: string;
  raw: any;
}

const fmt = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

const getRowTotalCash = (rec: any) => {
  if (!rec) return 0;
  const rCash =
    (Number(rec.retail_500) || 0) * 500 +
    (Number(rec.retail_200) || 0) * 200 +
    (Number(rec.retail_100) || 0) * 100 +
    (Number(rec.retail_50) || 0) * 50 +
    (Number(rec.retail_20) || 0) * 20 +
    (Number(rec.retail_10) || 0) * 10 +
    (Number(rec.retail_1) || 0) * 1;
  const wsCash =
    (Number(rec.ws_500) || 0) * 500 +
    (Number(rec.ws_200) || 0) * 200 +
    (Number(rec.ws_100) || 0) * 100 +
    (Number(rec.ws_50) || 0) * 50 +
    (Number(rec.ws_20) || 0) * 20 +
    (Number(rec.ws_10) || 0) * 10 +
    (Number(rec.ws_1) || 0) * 1;
  const hdCash =
    (Number(rec.retail_1500) || 0) * 500 +
    (Number(rec.retail_2200) || 0) * 200 +
    (Number(rec.retail_3100) || 0) * 100 +
    (Number(rec.retail_450) || 0) * 50 +
    (Number(rec.retail_520) || 0) * 20 +
    (Number(rec.retail_610) || 0) * 10 +
    (Number(rec.retail_71) || 0) * 1;
  return rCash + wsCash + hdCash;
};

const getRowTotalGpay = (rec: any) => {
  if (!rec) return 0;
  return (
    (Number(rec.retail_gpay) || 0) +
    (Number(rec.ws_gpay_card) || Number(rec.ws_gpay) || 0) +
    (Number(rec.hd_gpay) || Number(rec.expense_gpay_card) || 0)
  );
};

const getRowTotalPhonePe = (rec: any) => {
  if (!rec) return 0;
  return (
    (Number(rec.retail_phonepe) || 0) +
    (Number(rec.ws_phonepe) || 0) +
    (Number(rec.hd_phonepe) || Number(rec.bd_phonepe) || 0)
  );
};

const getRowTotalPaytm = (rec: any) => {
  if (!rec) return 0;
  return (
    (Number(rec.retail_paytm) || 0) +
    (Number(rec.ws_paytm) || Number(rec.ws_patym) || 0) +
    (Number(rec.hd_paytm) || 0)
  );
};

const getRowTotalCard = (rec: any) => {
  if (!rec) return 0;
  return (
    (Number(rec.retail_card) || 0) +
    (Number(rec.ws_card) || 0) +
    (Number(rec.hd_card) || 0)
  );
};

const getRowTotalDiff = (rec: any) => {
  if (!rec) return 0;
  if (rec.retail_diff !== undefined || rec.wholesale_diff !== undefined || rec.home_delivery_diff !== undefined) {
    return (Number(rec.retail_diff) || 0) + (Number(rec.wholesale_diff) || 0) + (Number(rec.home_delivery_diff) || 0);
  }
  const rScan = Number(rec.retail_scan_amount) || 0;
  const rCash = (Number(rec.retail_500) || 0) * 500 + (Number(rec.retail_200) || 0) * 200 + (Number(rec.retail_100) || 0) * 100 + (Number(rec.retail_50) || 0) * 50 + (Number(rec.retail_20) || 0) * 20 + (Number(rec.retail_10) || 0) * 10 + (Number(rec.retail_1) || 0) * 1;
  const rCollected = rCash + (Number(rec.retail_gpay) || 0) + (Number(rec.retail_phonepe) || 0) + (Number(rec.retail_paytm) || 0) + (Number(rec.retail_card) || 0);
  const rDiff = rScan - rCollected;

  const wsBilling = (Number(rec.ws_cash_billing_amount) || 0) + (Number(rec.ws_credit_receipt) || 0);
  const wsCash = (Number(rec.ws_500) || 0) * 500 + (Number(rec.ws_200) || 0) * 200 + (Number(rec.ws_100) || 0) * 100 + (Number(rec.ws_50) || 0) * 50 + (Number(rec.ws_20) || 0) * 20 + (Number(rec.ws_10) || 0) * 10 + (Number(rec.ws_1) || 0) * 1;
  const wsActual = wsCash + (Number(rec.ws_gpay_card) || Number(rec.ws_gpay) || 0) + (Number(rec.ws_phonepe) || 0) + (Number(rec.ws_paytm) || Number(rec.ws_patym) || 0) + (Number(rec.ws_card) || 0);
  const wsDiff = wsBilling - wsActual;

  const hdAmt = Number(rec.home_delivery) || 0;
  const hdCash = (Number(rec.retail_1500) || 0) * 500 + (Number(rec.retail_2200) || 0) * 200 + (Number(rec.retail_3100) || 0) * 100 + (Number(rec.retail_450) || 0) * 50 + (Number(rec.retail_520) || 0) * 20 + (Number(rec.retail_610) || 0) * 10 + (Number(rec.retail_71) || 0) * 1;
  const hdCollected = hdCash + (Number(rec.hd_gpay) || Number(rec.expense_gpay_card) || 0) + (Number(rec.hd_card) || 0) + (Number(rec.hd_phonepe) || Number(rec.bd_phonepe) || 0) + (Number(rec.hd_paytm) || 0);
  const hdDiff = hdAmt - hdCollected;

  return rDiff + wsDiff + hdDiff;
};

const getRowCreditReceipt = (rec: any) => Number(rec?.ws_credit_receipt) || 0;

const getRowWholesaleAmount = (rec: any) => {
  if (!rec) return 0;
  const wsCash =
    (Number(rec.ws_500) || 0) * 500 +
    (Number(rec.ws_200) || 0) * 200 +
    (Number(rec.ws_100) || 0) * 100 +
    (Number(rec.ws_50) || 0) * 50 +
    (Number(rec.ws_20) || 0) * 20 +
    (Number(rec.ws_10) || 0) * 10 +
    (Number(rec.ws_1) || 0) * 1;
  return (
    wsCash +
    (Number(rec.ws_gpay_card) || Number(rec.ws_gpay) || 0) +
    (Number(rec.ws_phonepe) || 0) +
    (Number(rec.ws_paytm) || Number(rec.ws_patym) || 0) +
    (Number(rec.ws_card) || 0)
  );
};

const getRowHomeDeliveryAmount = (rec: any) => {
  if (!rec) return 0;
  const hdCash =
    (Number(rec.retail_1500) || 0) * 500 +
    (Number(rec.retail_2200) || 0) * 200 +
    (Number(rec.retail_3100) || 0) * 100 +
    (Number(rec.retail_450) || 0) * 50 +
    (Number(rec.retail_520) || 0) * 20 +
    (Number(rec.retail_610) || 0) * 10 +
    (Number(rec.retail_71) || 0) * 1;
  return (
    hdCash +
    (Number(rec.hd_gpay) || Number(rec.expense_gpay_card) || 0) +
    (Number(rec.hd_card) || 0) +
    (Number(rec.hd_phonepe) || Number(rec.bd_phonepe) || 0) +
    (Number(rec.hd_paytm) || 0)
  );
};

const getRowVoidSale = (rec: any) => Number(rec?.void_sale) || 0;

export default function CounterPage({ onClose }: CounterPageProps) {
  const { getAllowedCounters, user, hasPageModifyAccess } = useAuth();
  
  const allowedCounters = useMemo(() => getAllowedCounters(), [getAllowedCounters]);
  const counterOptions = allowedCounters;
  const [showCounterSelectDropdown, setShowCounterSelectDropdown] = useState(false);
  const tallyDropdownRef = useRef<HTMLDivElement>(null);

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

  const isModifyAllowed = hasPageModifyAccess("Cash Tally Counter");

  const resetFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setShopFilter("");
    setCounterFilter("");
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
        status: rec.status || "pending",
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
      status: raw.status || "pending",
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
      hd500: raw.retail_1500?.toString() || "",
      hd200: raw.retail_2200?.toString() || "",
      hd100: raw.retail_3100?.toString() || "",
      hd50: raw.retail_450?.toString() || "",
      hd20: raw.retail_520?.toString() || "",
      hd10: raw.retail_610?.toString() || "",
      hd1: raw.retail_71?.toString() || "",
      hdGpay:    (raw.hd_gpay    ?? raw.expense_gpay_card ?? "")?.toString() || "",
      hdCard:    (raw.hd_card    ?? "")?.toString() || "",
      hdPhonePe: (raw.hd_phonepe ?? "")?.toString() || "",
      hdPaytm:   (raw.hd_paytm   ?? "")?.toString() || "",
      voidSale: raw.void_sale?.toString() || "",
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

  const handleExportCSV = () => {
    const headers = [
      "#", "Tally ID", "Date", "Counter", "Shop Name", "User",
      "Retail Scan Amount", "Total Cash", "Total GPay", "Total PhonePe", "Total Paytm",
      "Total Card", "Total Diff", "Credit Receipt", "Wholesale Amount",
      "Home Delivery Amount", "Total Expense", "Status"
    ];

    const csvRows = [headers.join(",")];

    filtered.forEach((row, idx) => {
      const raw = row.raw || {};
      const totDiff = getRowTotalDiff(raw);
      const dateStr = row.date ? new Date(row.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "";
      
      const values = [
        idx + 1,
        `"${(row.tally_id || "").replace(/"/g, '""')}"`,
        `"${dateStr.replace(/"/g, '""')}"`,
        `"${(row.counterVal || "").replace(/"/g, '""')}"`,
        `"${(row.shopName || "").replace(/"/g, '""')}"`,
        `"${(row.name || "").replace(/"/g, '""')}"`,
        row.retailScanAmount || 0,
        getRowTotalCash(raw),
        getRowTotalGpay(raw),
        getRowTotalPhonePe(raw),
        getRowTotalPaytm(raw),
        getRowTotalCard(raw),
        totDiff,
        getRowCreditReceipt(raw),
        getRowWholesaleAmount(raw),
        getRowHomeDeliveryAmount(raw),
        row.totalExpense || 0,
        `"${(row.status || "pending").replace(/"/g, '""')}"`
      ];
      csvRows.push(values.join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Cash_Tally_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      {/* ── Paytm-Style Mobile Form Action Card (< 768px) ── */}
      {isModifyAllowed && (
        <div className="md:hidden bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2a5298] animate-ping" />
              Form Action
            </span>
            <span className="text-[10px] font-bold text-gray-400">Tap to open form</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddModal(allowedCounters[0] || 'COUNTER-1')}
              className="bg-[#2a5298]/5 p-3 rounded-2xl border border-[#2a5298]/20 shadow-xs flex flex-col items-center justify-center text-center active:scale-95 transition-all group cursor-pointer w-28 h-28"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#2a5298] text-white flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform">
                <FaCoins className="text-base" />
              </div>
              <span className="text-[11px] font-bold text-slate-800 leading-tight">Cash Tally</span>
              <span className="text-[9px] text-[#2a5298] font-semibold mt-0.5">Form</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Summary Cards (Over table) ── */}
      {isModifyAllowed && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4 font-sans">
            {/* 1. Retail Scan Amount */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 font-sans">Retail Scan Amount</p>
                <div className="text-xl font-bold text-slate-800 mt-1 tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                  {fmt(filtered.reduce((s, r) => s + r.retailScanAmount, 0))}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2a5298] flex items-center justify-center shrink-0 border border-blue-100">
                <FaCoins className="text-lg" />
              </div>
            </div>

            {/* 2. Wholesale Amount = (Wholesale Amount - Credit Receipt) */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 font-sans">Wholesale Amount</p>
                <div className="text-xl font-bold text-slate-800 mt-1 tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                  {fmt(filtered.reduce((s, r) => s + (Number(r.raw.ws_cash_billing_amount) || 0), 0))}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0 border border-green-100">
                <FaCoins className="text-lg" />
              </div>
            </div>

            {/* 3. Credit Receipt */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 font-sans">Credit Receipt</p>
                <div className="text-xl font-bold text-teal-700 mt-1 tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                  {fmt(filtered.reduce((sum, r) => sum + getRowCreditReceipt(r.raw), 0))}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
                <FaCoins className="text-lg" />
              </div>
            </div>

            {/* 4. Home Delivery Amount */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 font-sans">Home Delivery Amount</p>
                <div className="text-xl font-bold text-amber-700 mt-1 tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                  {fmt(filtered.reduce((sum, r) => sum + getRowHomeDeliveryAmount(r.raw), 0))}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                <FaWallet className="text-lg" />
              </div>
            </div>

            {/* 5. Net Total Card */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 font-sans">Net Total</p>
                <div className="text-xl font-bold text-emerald-700 mt-1 tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                  {fmt(filtered.reduce((s, r) => s + (r.retailScanAmount - r.totalExpense), 0))}
                </div>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <FaFileAlt className="text-lg" />
              </div>
            </div>
          </div>

          {/* ── Secondary Summary Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-sans">
            {/* 6. Total Expense */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total Expense</span>
              <div className="text-base font-bold text-rose-600 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((s, r) => s + r.totalExpense, 0))}
              </div>
            </div>

            {/* 7. Total GPay */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total GPay</span>
              <div className="text-base font-bold text-blue-700 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowTotalGpay(r.raw), 0))}
              </div>
            </div>

            {/* 8. Total PhonePe */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total PhonePe</span>
              <div className="text-base font-bold text-purple-700 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowTotalPhonePe(r.raw), 0))}
              </div>
            </div>

            {/* 9. Total Paytm */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total Paytm</span>
              <div className="text-base font-bold text-cyan-700 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowTotalPaytm(r.raw), 0))}
              </div>
            </div>

            {/* 10. Total Card */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total Card</span>
              <div className="text-base font-bold text-indigo-700 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowTotalCard(r.raw), 0))}
              </div>
            </div>

            {/* 11. Total Cash */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total Cash</span>
              <div className="text-base font-bold text-emerald-700 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowTotalCash(r.raw), 0))}
              </div>
            </div>

            {/* 12. Total void */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total void</span>
              <div className="text-base font-bold text-rose-600 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowVoidSale(r.raw), 0))}
              </div>
            </div>

            {/* 13. Total Diff */}
            <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-xs flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-gray-500 truncate font-sans">Total Diff</span>
              <div className="text-base font-bold text-slate-800 mt-1 truncate tracking-normal font-sans [font-family:-apple-system,BlinkMacSystemFont,'Segoe_UI',Roboto,sans-serif]">
                {fmt(filtered.reduce((sum, r) => sum + getRowTotalDiff(r.raw), 0))}
              </div>
            </div>
          </div>
        </div>
      )}

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
                disabled={!isModifyAllowed}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white disabled:opacity-60"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                disabled={!isModifyAllowed}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white disabled:opacity-60"
              />
            </div>

            {/* Shop Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Shop:</label>
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                disabled={!isModifyAllowed}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white max-w-[160px] disabled:opacity-60"
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
                disabled={!isModifyAllowed}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all bg-white min-w-[120px] disabled:opacity-60"
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
                disabled={!isModifyAllowed}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] transition-all disabled:opacity-60"
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

          {/* Refresh, Export & Fill Tally Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isModifyAllowed && (
              <>
                <button
                  onClick={fetchRows}
                  title="Refresh"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 transition-all text-xs font-medium cursor-pointer"
                >
                  <FaSync className={loading ? "animate-spin text-[11px]" : "text-[11px]"} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  title="Export as CSV"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all text-xs font-semibold rounded-lg cursor-pointer"
                >
                  <FaFileExcel className="text-[12px] text-emerald-700" />
                  <span>Export as CSV</span>
                </button>
              </>
            )}

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
      {isModifyAllowed && (
        loading ? (
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
                  {[
                    '#', 'Tally ID', 'Date', 'Counter', 'Shop Name', 'User',
                    'Retail Scan Amount', 'Wholesale Amount', 'Credit Receipt', 'Home Delivery Amount',
                    'Total Expense', 'Total GPay', 'Total PhonePe', 'Total Paytm', 'Total Card',
                    'Total Cash', 'Total void', 'Total Diff', 'Status', 'Actions'
                  ].map(h => (
                    <th key={h} className="px-4 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={20} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FaFileAlt className="text-4xl text-gray-300" />
                        <p className="font-medium">No records found</p>
                        {hasActiveFilters && <p className="text-xs">Try adjusting your filters</p>}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((row, idx) => {
                  const totDiff = getRowTotalDiff(row.raw);
                  return (
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

                      {/* 6. Retail Scan Amount */}
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap font-semibold">{fmt(row.retailScanAmount)}</td>
                      {/* 7. Wholesale Amount */}
                      <td className="px-4 py-3 text-green-700 whitespace-nowrap font-semibold">{fmt(getRowWholesaleAmount(row.raw))}</td>
                      {/* 8. Credit Receipt */}
                      <td className="px-4 py-3 text-teal-700 whitespace-nowrap font-semibold">{fmt(getRowCreditReceipt(row.raw))}</td>
                      {/* 9. Home Delivery Amount */}
                      <td className="px-4 py-3 text-amber-700 whitespace-nowrap font-semibold">{fmt(getRowHomeDeliveryAmount(row.raw))}</td>
                      {/* 10. Total Expense */}
                      <td className="px-4 py-3 text-rose-600 font-semibold whitespace-nowrap">{fmt(row.totalExpense)}</td>
                      {/* 11. Total GPay */}
                      <td className="px-4 py-3 text-blue-700 whitespace-nowrap font-semibold">{fmt(getRowTotalGpay(row.raw))}</td>
                      {/* 12. Total PhonePe */}
                      <td className="px-4 py-3 text-purple-700 whitespace-nowrap font-semibold">{fmt(getRowTotalPhonePe(row.raw))}</td>
                      {/* 13. Total Paytm */}
                      <td className="px-4 py-3 text-cyan-700 whitespace-nowrap font-semibold">{fmt(getRowTotalPaytm(row.raw))}</td>
                      {/* 14. Total Card */}
                      <td className="px-4 py-3 text-indigo-700 whitespace-nowrap font-semibold">{fmt(getRowTotalCard(row.raw))}</td>
                      {/* 15. Total Cash */}
                      <td className="px-4 py-3 text-emerald-700 whitespace-nowrap font-semibold">{fmt(getRowTotalCash(row.raw))}</td>
                      {/* 16. Total void */}
                      <td className="px-4 py-3 text-rose-600 whitespace-nowrap font-semibold">{fmt(getRowVoidSale(row.raw))}</td>
                      {/* 17. Total Diff */}
                      <td className={`px-4 py-3 whitespace-nowrap font-semibold ${totDiff < 0 ? 'text-red-600' : totDiff > 0 ? 'text-amber-600' : 'text-gray-700'}`}>{fmt(totDiff)}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          (row.status || 'pending').toLowerCase() === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {row.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isModifyAllowed && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenEditModal(row)} title="Edit" className="p-2 rounded-lg text-[#2a5298] hover:bg-blue-100 transition-colors"><FaEdit /></button>
                            <button onClick={() => { setDeleteId(row.id); setDeleteCounter(row.counterVal); }} title="Delete" className="p-2 rounded-lg text-red-500 hover:bg-red-100 transition-colors"><FaTrash /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )
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
