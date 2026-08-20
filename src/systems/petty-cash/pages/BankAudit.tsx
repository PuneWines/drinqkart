import { useState, useEffect, useCallback, useMemo } from "react";
import {
  FaSave, FaSync, FaSearch, FaFileAlt, FaFileCsv
} from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabase";

interface BankAuditRecord {
  id?: number;
  tally_id: string;
  audit_cash: number;
  cash_diff_audit: number;
  bank_cash_date: string | null;
  audit_gpay: number;
  gpay_diff: number;
  bank_gpay_date: string | null;
  audit_paytm: number;
  paytm_diff: number;
  bank_paytm_date: string | null;
  audit_phonepe: number;
  phonepay_diff: number;
  bank_phone_pay_date: string | null;
  total_diff: number;
  narration: string | null;
}

interface GroupedTally {
  tally_id: string; // distinct tally_id string key
  date: string;
  counters: string[];
  shopNames: string[];
  userNames: string[];
  totalCash: number;
  totalGpay: number;
  totalPaytm: number;
  totalPhonePe: number;
  recordCount: number;
  audit: BankAuditRecord;
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

export default function BankAudit() {
  const { user, isAdmin, getAllowedCounters, hasShopAccess, hasPageModifyAccess } = useAuth();
  const isModifyAllowed = hasPageModifyAccess("Bank Audit");
  const [groupedTallies, setGroupedTallies] = useState<GroupedTally[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTallyId, setSavingTallyId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [counterFilter, setCounterFilter] = useState("");

  // Checkbox selection state & live edited values
  const [selectedTallyIds, setSelectedTallyIds] = useState<Set<string>>(new Set());
  const [draftEdits, setDraftEdits] = useState<Record<string, BankAuditRecord>>({});

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch all petty_cash_tallies records
      const { data: talliesData, error: talliesError } = await supabase
        .from("petty_cash_tallies")
        .select("*")
        .order("date", { ascending: false });

      if (talliesError) throw talliesError;

      // 2. Fetch all petty_cash_bank_audit records
      const { data: auditData, error: auditError } = await supabase
        .from("petty_cash_bank_audit")
        .select("*");

      if (auditError && auditError.code !== 'PGRST116') {
        console.warn("[BankAudit] Audit table fetch note:", auditError.message);
      }

      const auditMap: Record<string, BankAuditRecord> = {};
      if (auditData) {
        auditData.forEach((item: any) => {
          const tIdStr = (item.tally_id || "").toString();
          auditMap[tIdStr] = {
            id: item.id,
            tally_id: tIdStr,
            audit_cash: Number(item.audit_cash) || 0,
            cash_diff_audit: Number(item.cash_diff_audit) || 0,
            bank_cash_date: item.bank_cash_date || null,
            audit_gpay: Number(item.audit_gpay) || 0,
            gpay_diff: Number(item.gpay_diff) || 0,
            bank_gpay_date: item.bank_gpay_date || null,
            audit_paytm: Number(item.audit_paytm) || 0,
            paytm_diff: Number(item.paytm_diff) || 0,
            bank_paytm_date: item.bank_paytm_date || null,
            audit_phonepe: Number(item.audit_phonepe) || 0,
            phonepay_diff: Number(item.phonepay_diff) || 0,
            bank_phone_pay_date: item.bank_phone_pay_date || null,
            total_diff: Number(item.total_diff) || 0,
            narration: item.narration || ""
          };
        });
      }

      // 3. Group petty_cash_tallies by distinct tally_id string
      const tallyGroupsMap: Record<string, {
        date: string;
        counters: Set<string>;
        shops: Set<string>;
        users: Set<string>;
        totalCash: number;
        totalGpay: number;
        totalPaytm: number;
        totalPhonePe: number;
        count: number;
      }> = {};

      (talliesData || []).forEach((t: any) => {
        const key = (t.tally_id || `ID-${t.id}`).toString().trim();
        if (!tallyGroupsMap[key]) {
          tallyGroupsMap[key] = {
            date: t.date || "",
            counters: new Set(),
            shops: new Set(),
            users: new Set(),
            totalCash: 0,
            totalGpay: 0,
            totalPaytm: 0,
            totalPhonePe: 0,
            count: 0
          };
        }

        const group = tallyGroupsMap[key];
        if (t.counter) group.counters.add(t.counter);
        if (t.shop_name) group.shops.add(t.shop_name);
        if (t.name) group.users.add(t.name);

        group.totalCash += getRowTotalCash(t);
        group.totalGpay += getRowTotalGpay(t);
        group.totalPaytm += getRowTotalPaytm(t);
        group.totalPhonePe += getRowTotalPhonePe(t);
        group.count += 1;
      });

      // 4. Construct GroupedTally objects
      const groupedList: GroupedTally[] = Object.entries(tallyGroupsMap).map(([tId, grp]) => {
        const existingAudit = auditMap[tId] || {
          tally_id: tId,
          audit_cash: 0,
          cash_diff_audit: 0,
          bank_cash_date: null,
          audit_gpay: 0,
          gpay_diff: 0,
          bank_gpay_date: null,
          audit_paytm: 0,
          paytm_diff: 0,
          bank_paytm_date: null,
          audit_phonepe: 0,
          phonepay_diff: 0,
          bank_phone_pay_date: null,
          total_diff: 0,
          narration: ""
        };

        return {
          tally_id: tId,
          date: grp.date,
          counters: Array.from(grp.counters),
          shopNames: Array.from(grp.shops),
          userNames: Array.from(grp.users),
          totalCash: grp.totalCash,
          totalGpay: grp.totalGpay,
          totalPaytm: grp.totalPaytm,
          totalPhonePe: grp.totalPhonePe,
          recordCount: grp.count,
          audit: existingAudit
        };
      });

      setGroupedTallies(groupedList);

      // Initialize draft edits state
      const initialDrafts: Record<string, BankAuditRecord> = {};
      groupedList.forEach((g) => {
        initialDrafts[g.tally_id] = { ...g.audit };
      });
      setDraftEdits(initialDrafts);

    } catch (err: any) {
      console.error("[BankAudit] Error fetching data:", err);
      showToast(err.message || "Failed to load audit data", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchShops = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("shop").select("id, shop_name").order("shop_name");
      if (!error && data) {
        setShops(data.map((r: any) => ({ id: r.id.toString(), name: r.shop_name || "" })));
      }
    } catch (err) {
      console.error("[BankAudit] Error fetching shops:", err);
    }
  }, []);

  useEffect(() => {
    fetchRows();
    fetchShops();
  }, [fetchRows, fetchShops]);

  // Allowed counters permission check
  const allowedCounters = useMemo(() => {
    if (!user) return [];
    if (isAdmin() || user.role === 'admin' || user.role === 'office_admin') {
      return ['Counter 1', 'Counter 2', 'Counter 3', 'Counter 4'];
    }
    const ac = getAllowedCounters();
    if (ac && ac.length > 0) {
      return ac;
    }
    return ['Counter 1', 'Counter 2', 'Counter 3', 'Counter 4'];
  }, [user, isAdmin, getAllowedCounters]);

  const counterOptions = useMemo(() => {
    const defaultCounters = ['Counter 1', 'Counter 2', 'Counter 3', 'Counter 4'];
    return defaultCounters.filter((c) =>
      allowedCounters.some(
        (ac) => ac.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === c.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
      )
    );
  }, [allowedCounters]);

  // Filtered list based on search/date/shop/counter
  const filtered = useMemo(() => {
    return groupedTallies.filter((g) => {
      const hasAllowedCounter = g.counters.length === 0 || g.counters.some((cVal) =>
        allowedCounters.some((ac) => ac.toLowerCase().trim().replace(/[^a-z0-9]/g, '') === cVal.toLowerCase().trim().replace(/[^a-z0-9]/g, ''))
      );
      if (!hasAllowedCounter) return false;

      const hasAllowedShop = g.shopNames.length === 0 || g.shopNames.some((sName) => hasShopAccess(sName));
      if (!hasAllowedShop) return false;

      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        g.tally_id.toLowerCase().includes(q) ||
        g.userNames.some((u) => u.toLowerCase().includes(q)) ||
        g.shopNames.some((s) => s.toLowerCase().includes(q)) ||
        g.counters.some((c) => c.toLowerCase().includes(q));

      const matchesFromDate = !fromDate || g.date >= fromDate;
      const matchesToDate = !toDate || g.date <= toDate;
      const matchesShop = !shopFilter || g.shopNames.some((s) => s.toLowerCase() === shopFilter.toLowerCase());
      const matchesCounter = !counterFilter || g.counters.some((c) => c.toLowerCase().trim() === counterFilter.toLowerCase().trim());

      return matchesSearch && matchesFromDate && matchesToDate && matchesShop && matchesCounter;
    });
  }, [groupedTallies, allowedCounters, hasShopAccess, search, fromDate, toDate, shopFilter, counterFilter]);

  // Checkbox Selection Logic
  const handleToggleSelectRow = (tallyId: string) => {
    setSelectedTallyIds((prev) => {
      const next = new Set(prev);
      if (next.has(tallyId)) {
        next.delete(tallyId);
      } else {
        next.add(tallyId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedTallyIds.size === filtered.length && filtered.length > 0) {
      setSelectedTallyIds(new Set());
    } else {
      setSelectedTallyIds(new Set(filtered.map((g) => g.tally_id)));
    }
  };

  // Live draft change handler
  const handleDraftChange = (tallyId: string, field: keyof BankAuditRecord, val: any) => {
    setDraftEdits((prev) => {
      const current = prev[tallyId] || { tally_id: tallyId } as BankAuditRecord;
      const updated = { ...current, [field]: val };

      // Find total calculations for auto-diff helper
      const targetGroup = groupedTallies.find((g) => g.tally_id === tallyId);
      const totalCash = targetGroup?.totalCash || 0;
      const totalGpay = targetGroup?.totalGpay || 0;
      const totalPaytm = targetGroup?.totalPaytm || 0;
      const totalPhonePe = targetGroup?.totalPhonePe || 0;

      // Auto-compute diffs if user changes audit values (while keeping diff fields editable)
      if (field === "audit_cash") {
        updated.cash_diff_audit = totalCash - (Number(val) || 0);
      } else if (field === "audit_gpay") {
        updated.gpay_diff = totalGpay - (Number(val) || 0);
      } else if (field === "audit_paytm") {
        updated.paytm_diff = totalPaytm - (Number(val) || 0);
      } else if (field === "audit_phonepe") {
        updated.phonepay_diff = totalPhonePe - (Number(val) || 0);
      }

      // Auto-update total_diff sum
      updated.total_diff = (Number(updated.cash_diff_audit) || 0) +
        (Number(updated.gpay_diff) || 0) +
        (Number(updated.paytm_diff) || 0) +
        (Number(updated.phonepay_diff) || 0);

      return {
        ...prev,
        [tallyId]: updated
      };
    });
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filtered.length === 0) {
      showToast("No audit data to export", "error");
      return;
    }

    const headers = [
      "Tally ID",
      "Date",
      "Counter(s)",
      "Shop Name",
      "User(s)",
      "Total Cash",
      "Audit Cash",
      "Cash Diff",
      "Bank Cash Date",
      "Total GPay",
      "Audit GPay",
      "GPay Diff",
      "Bank GPay Date",
      "Total Paytm",
      "Audit Paytm",
      "Paytm Diff",
      "Bank Paytm Date",
      "Total PhonePe",
      "Audit PhonePe",
      "PhonePe Diff",
      "Bank PhonePe Date",
      "Total Diff",
      "Narration"
    ];

    const rows = filtered.map((g) => {
      const draft = draftEdits[g.tally_id] || g.audit;
      return [
        g.tally_id,
        g.date ? new Date(g.date).toLocaleDateString('en-IN') : '',
        g.counters.join("; "),
        g.shopNames.join("; "),
        g.userNames.join("; "),
        g.totalCash,
        draft.audit_cash ?? 0,
        draft.cash_diff_audit ?? 0,
        draft.bank_cash_date || '',
        g.totalGpay,
        draft.audit_gpay ?? 0,
        draft.gpay_diff ?? 0,
        draft.bank_gpay_date || '',
        g.totalPaytm,
        draft.audit_paytm ?? 0,
        draft.paytm_diff ?? 0,
        draft.bank_paytm_date || '',
        g.totalPhonePe,
        draft.audit_phonepe ?? 0,
        draft.phonepay_diff ?? 0,
        draft.bank_phone_pay_date || '',
        draft.total_diff ?? 0,
        draft.narration || ''
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => {
        const str = val === null || val === undefined ? '' : String(val);
        const escaped = str.replace(/"/g, '""');
        return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') ? `"${escaped}"` : escaped;
      }).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bank_audit_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filtered.length} row(s) to CSV`);
  };

  // Single Row Save Action (Upsert to petty_cash_bank_audit)
  const handleSaveSingleRow = async (tallyId: string) => {
    if (!isModifyAllowed) {
      showToast("You have view-only access to this page.", "error");
      return;
    }
    const draft = draftEdits[tallyId];
    if (!draft) return;
    setSavingTallyId(tallyId);

    try {
      const payload = {
        tally_id: tallyId,
        audit_cash: Number(draft.audit_cash) || 0,
        cash_diff_audit: Number(draft.cash_diff_audit) || 0,
        bank_cash_date: draft.bank_cash_date || null,
        audit_gpay: Number(draft.audit_gpay) || 0,
        gpay_diff: Number(draft.gpay_diff) || 0,
        bank_gpay_date: draft.bank_gpay_date || null,
        audit_paytm: Number(draft.audit_paytm) || 0,
        paytm_diff: Number(draft.paytm_diff) || 0,
        bank_paytm_date: draft.bank_paytm_date || null,
        audit_phonepe: Number(draft.audit_phonepe) || 0,
        phonepay_diff: Number(draft.phonepay_diff) || 0,
        bank_phone_pay_date: draft.bank_phone_pay_date || null,
        total_diff: Number(draft.total_diff) || 0,
        narration: draft.narration || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("petty_cash_bank_audit")
        .upsert([payload], { onConflict: "tally_id" });

      if (error) throw error;

      showToast(`Saved audit record for Tally ${tallyId}`);
      // Refresh local state
      setGroupedTallies((prev) =>
        prev.map((g) => (g.tally_id === tallyId ? { ...g, audit: { ...draft } } : g))
      );
    } catch (err: any) {
      console.error("[BankAudit] Error saving row:", err);
      showToast(err.message || "Failed to save audit row", "error");
    } finally {
      setSavingTallyId(null);
    }
  };

  // Bulk Save Action (Top Right Button)
  const handleBulkSave = async () => {
    if (!isModifyAllowed) {
      showToast("You have view-only access to this page.", "error");
      return;
    }
    if (selectedTallyIds.size === 0) {
      showToast("Please select at least one row checkbox to save.", "error");
      return;
    }
    setBulkSaving(true);

    try {
      const payloads = Array.from(selectedTallyIds).map((tId) => {
        const draft = draftEdits[tId];
        return {
          tally_id: tId,
          audit_cash: Number(draft.audit_cash) || 0,
          cash_diff_audit: Number(draft.cash_diff_audit) || 0,
          bank_cash_date: draft.bank_cash_date || null,
          audit_gpay: Number(draft.audit_gpay) || 0,
          gpay_diff: Number(draft.gpay_diff) || 0,
          bank_gpay_date: draft.bank_gpay_date || null,
          audit_paytm: Number(draft.audit_paytm) || 0,
          paytm_diff: Number(draft.paytm_diff) || 0,
          bank_paytm_date: draft.bank_paytm_date || null,
          audit_phonepe: Number(draft.audit_phonepe) || 0,
          phonepay_diff: Number(draft.phonepay_diff) || 0,
          bank_phone_pay_date: draft.bank_phone_pay_date || null,
          total_diff: Number(draft.total_diff) || 0,
          narration: draft.narration || null,
          updated_at: new Date().toISOString()
        };
      });

      const { error } = await supabase
        .from("petty_cash_bank_audit")
        .upsert(payloads, { onConflict: "tally_id" });

      if (error) throw error;

      showToast(`Successfully bulk saved ${selectedTallyIds.size} audit record(s)`);
      // Refresh local state
      setGroupedTallies((prev) =>
        prev.map((g) =>
          selectedTallyIds.has(g.tally_id) ? { ...g, audit: { ...draftEdits[g.tally_id] } } : g
        )
      );
    } catch (err: any) {
      console.error("[BankAudit] Error bulk saving:", err);
      showToast(err.message || "Bulk save failed", "error");
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium text-sm transition-all ${toastMsg.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
          {toastMsg.text}
        </div>
      )}      {/* Header & Bulk Save Toolbar */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 font-sans">Bank Audit Table</h2>
          <p className="text-xs text-gray-500 mt-1">Audit and reconcile bank deposits grouped by Tally ID</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchRows}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-all flex items-center gap-2 cursor-pointer"
          >
            <FaSync className={loading ? "animate-spin" : ""} /> Refresh
          </button>

          {/* Bulk Save Button Top Right - Visible only if user has modify access */}
          {isModifyAllowed && (
            <button
              onClick={handleBulkSave}
              disabled={bulkSaving}
              className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer ${selectedTallyIds.size > 0
                  ? 'bg-[#2a5298] hover:bg-[#1e3c72]'
                  : 'bg-[#2a5298]/90 hover:bg-[#2a5298]'
                }`}
            >
              <FaSave /> {bulkSaving ? "Saving..." : selectedTallyIds.size > 0 ? `Bulk Save (${selectedTallyIds.size})` : "Bulk Save"}
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* From Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] bg-white"
              />
            </div>

            {/* To Date */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] bg-white"
              />
            </div>

            {/* Shop Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Shop:</label>
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] bg-white max-w-[160px]"
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
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] bg-white min-w-[120px]"
              >
                <option value="">All Counters</option>
                {counterOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[180px]">
              <FaSearch className="absolute left-2.5 top-2.5 text-gray-400 text-xs" />
              <input
                type="text"
                placeholder="Search Tally ID, User, Shop..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#2a5298] bg-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Bank Audit Table */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold uppercase tracking-wider">Loading Bank Audit Data...</span>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Sub-header bar directly above table */}
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <FaFileAlt className="text-[#2a5298]" />
              <span className="text-xs font-semibold text-gray-700">{filtered.length} Tally Batch{filtered.length !== 1 ? 'es' : ''} found</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-xs font-medium text-gray-500">
                {isModifyAllowed ? (
                  <>Selected: <strong className="text-[#2a5298]">{selectedTallyIds.size}</strong> of {filtered.length}</>
                ) : (
                  <span className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 rounded-md border border-amber-200">
                    View Only Mode
                  </span>
                )}
              </div>

              {/* Export CSV Button at extreme right just above table */}
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 text-xs font-bold text-[#2a5298] bg-white hover:bg-blue-50 rounded-lg border border-blue-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
                title="Export audit data to CSV"
              >
                <FaFileCsv className="text-sm text-green-700" /> Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1950px] divide-y divide-gray-200 border-collapse">
              <thead className="bg-[#2a5298] text-white text-left font-sans sticky top-0 z-10 shadow-sm">
                <tr>
                  {/* Select Checkbox & Inline Save Column - Only if Modify Allowed */}
                  {isModifyAllowed && (
                    <th className="px-2 py-2 text-center min-w-[70px] border-r border-blue-800 bg-blue-900/90">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && selectedTallyIds.size === filtered.length}
                          onChange={handleToggleSelectAll}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          title="Select All"
                        />
                        <span className="text-[10px] font-bold uppercase tracking-wider leading-none">Save</span>
                      </div>
                    </th>
                  )}

                  {/* Tally Identifiers */}
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 min-w-[65px]">Tally<br/>ID</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 min-w-[75px]">Date</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 min-w-[90px]">Counter(s)</th>
                  <th className="px-2 py-2 text-left text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 min-w-[95px]">Shop<br/>Name</th>
                  <th className="px-2 py-2 text-left text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 min-w-[85px]">User(s)</th>

                  {/* Cash Section */}
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 bg-blue-900/60 min-w-[85px]">Total<br/>Cash</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[85px]">Audit<br/>Cash</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[80px]">Cash<br/>Diff</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[105px]">Bank Cash<br/>Date</th>

                  {/* GPay Section */}
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 bg-blue-900/60 min-w-[85px]">Total<br/>GPay</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[85px]">Audit<br/>GPay</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[80px]">GPay<br/>Diff</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[105px]">Bank G-Pay<br/>Date</th>

                  {/* Paytm Section */}
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 bg-blue-900/60 min-w-[85px]">Total<br/>Paytm</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[85px]">Audit<br/>Paytm</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[80px]">Paytm<br/>Diff</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[105px]">Bank Paytm<br/>Date</th>

                  {/* PhonePe Section */}
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-semibold uppercase tracking-wider border-r border-blue-800 bg-blue-900/60 min-w-[85px]">Total<br/>PhonePe</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[85px]">Audit<br/>PhonePe</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[80px]">PhonePe<br/>Diff</th>
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-red-900/80 text-yellow-300 min-w-[105px]">Bank Phone<br/>Pay Date</th>

                  {/* Totals & Narration */}
                  <th className="px-2 py-2 text-center text-[11px] leading-tight font-bold uppercase tracking-wider border-r border-blue-800 bg-slate-900 min-w-[85px]">Total<br/>Diff</th>
                  <th className="px-2 py-2 text-left text-[11px] leading-tight font-bold uppercase tracking-wider bg-blue-950 text-cyan-300 min-w-[160px]">Narration</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isModifyAllowed ? 24 : 23} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <FaFileAlt className="text-4xl text-gray-300" />
                        <p className="font-medium">No records found</p>
                      </div>
                    </td>
                  </tr>
                )}

                {filtered.map((group) => {
                  const tId = group.tally_id;
                  const isChecked = selectedTallyIds.has(tId);
                  const draft = draftEdits[tId] || { ...group.audit };

                  return (
                    <tr
                      key={tId}
                      className={`transition-colors ${isChecked ? 'bg-amber-50/70' : 'hover:bg-blue-50/30'}`}
                    >
                      {/* Checkbox + Inline Save Button Cell - Only if Modify Allowed */}
                      {isModifyAllowed && (
                        <td className="px-1 py-1 text-center border-r border-gray-200 bg-gray-50/40">
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelectRow(tId)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                            />
                            {isChecked && (
                              <button
                                onClick={() => handleSaveSingleRow(tId)}
                                disabled={savingTallyId === tId}
                                className="px-1 py-0.5 text-[9px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition-all flex items-center justify-center gap-0.5 cursor-pointer"
                                title="Save row data to petty_cash_bank_audit"
                              >
                                <FaSave className="text-[9px]" />
                                {savingTallyId === tId ? "..." : "Save"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Tally ID */}
                      <td className="px-2 py-1 text-center font-mono font-bold text-[#2a5298] whitespace-nowrap border-r border-gray-200">
                        {tId}
                      </td>

                      {/* Date */}
                      <td className="px-2 py-1 text-center text-gray-700 whitespace-nowrap border-r border-gray-200 font-medium text-[11px]">
                        {group.date ? new Date(group.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : "—"}
                      </td>

                      {/* Counter(s) */}
                      <td className="px-1.5 py-1 text-center border-r border-gray-200">
                        <div className="flex flex-wrap gap-0.5 justify-center">
                          {group.counters.map((c) => (
                            <span key={c} className="inline-flex items-center px-1 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase">
                              {c}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Shop Name(s) */}
                      <td className="px-2 py-1 text-gray-700 font-medium whitespace-nowrap border-r border-gray-200 text-xs">
                        {group.shopNames.join(", ") || "—"}
                      </td>

                      {/* User(s) */}
                      <td className="px-2 py-1 text-gray-600 whitespace-nowrap border-r border-gray-200 text-xs">
                        {group.userNames.join(", ") || "—"}
                      </td>

                      {/* Total Cash (Calculated sum across tally_id rows in petty_cash_tallies) */}
                      <td className="px-1.5 py-1 font-bold text-gray-900 text-center whitespace-nowrap border-r border-gray-200 bg-gray-50/50">
                        {fmt(group.totalCash)}
                      </td>

                      {/* Audit Cash (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.audit_cash ?? ""}
                          onChange={(e) => handleDraftChange(tId, "audit_cash", e.target.value)}
                          placeholder="0"
                          className="w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-semibold text-rose-700 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* Cash Diff Audit (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.cash_diff_audit ?? ""}
                          onChange={(e) => handleDraftChange(tId, "cash_diff_audit", e.target.value)}
                          placeholder="0"
                          className={`w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent text-center ${Number(draft.cash_diff_audit) < 0 ? 'text-red-600' : Number(draft.cash_diff_audit) > 0 ? 'text-blue-600' : 'text-gray-700'
                            }`}
                        />
                      </td>

                      {/* Bank Cash Date (Editable Date Picker) */}
                      <td className="px-0.5 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="date"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.bank_cash_date || ""}
                          onChange={(e) => handleDraftChange(tId, "bank_cash_date", e.target.value)}
                          className="w-full px-0.5 py-0.5 text-[11px] border border-amber-300 rounded text-rose-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* Total GPay (Calculated sum across tally_id rows in petty_cash_tallies) */}
                      <td className="px-1.5 py-1 font-bold text-gray-900 text-center whitespace-nowrap border-r border-gray-200 bg-gray-50/50">
                        {fmt(group.totalGpay)}
                      </td>

                      {/* Audit GPay (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.audit_gpay ?? ""}
                          onChange={(e) => handleDraftChange(tId, "audit_gpay", e.target.value)}
                          placeholder="0"
                          className="w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-semibold text-rose-700 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* GPay Diff (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.gpay_diff ?? ""}
                          onChange={(e) => handleDraftChange(tId, "gpay_diff", e.target.value)}
                          placeholder="0"
                          className={`w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent text-center ${Number(draft.gpay_diff) < 0 ? 'text-red-600' : Number(draft.gpay_diff) > 0 ? 'text-blue-600' : 'text-gray-700'
                            }`}
                        />
                      </td>

                      {/* Bank G-Pay Date (Editable Date Picker) */}
                      <td className="px-0.5 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="date"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.bank_gpay_date || ""}
                          onChange={(e) => handleDraftChange(tId, "bank_gpay_date", e.target.value)}
                          className="w-full px-0.5 py-0.5 text-[11px] border border-amber-300 rounded text-rose-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* Total Paytm (Calculated sum across tally_id rows in petty_cash_tallies) */}
                      <td className="px-1.5 py-1 font-bold text-gray-900 text-center whitespace-nowrap border-r border-gray-200 bg-gray-50/50">
                        {fmt(group.totalPaytm)}
                      </td>

                      {/* Audit Paytm (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.audit_paytm ?? ""}
                          onChange={(e) => handleDraftChange(tId, "audit_paytm", e.target.value)}
                          placeholder="0"
                          className="w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-semibold text-rose-700 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* Paytm Diff (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.paytm_diff ?? ""}
                          onChange={(e) => handleDraftChange(tId, "paytm_diff", e.target.value)}
                          placeholder="0"
                          className={`w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent text-center ${Number(draft.paytm_diff) < 0 ? 'text-red-600' : Number(draft.paytm_diff) > 0 ? 'text-blue-600' : 'text-gray-700'
                            }`}
                        />
                      </td>

                      {/* Bank Paytm Date (Editable Date Picker) */}
                      <td className="px-0.5 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="date"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.bank_paytm_date || ""}
                          onChange={(e) => handleDraftChange(tId, "bank_paytm_date", e.target.value)}
                          className="w-full px-0.5 py-0.5 text-[11px] border border-amber-300 rounded text-rose-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* Total PhonePe (Calculated sum across tally_id rows in petty_cash_tallies) */}
                      <td className="px-1.5 py-1 font-bold text-gray-900 text-center whitespace-nowrap border-r border-gray-200 bg-gray-50/50">
                        {fmt(group.totalPhonePe)}
                      </td>

                      {/* Audit PhonePe (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.audit_phonepe ?? ""}
                          onChange={(e) => handleDraftChange(tId, "audit_phonepe", e.target.value)}
                          placeholder="0"
                          className="w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-semibold text-rose-700 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* PhonePe Diff (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.phonepay_diff ?? ""}
                          onChange={(e) => handleDraftChange(tId, "phonepay_diff", e.target.value)}
                          placeholder="0"
                          className={`w-full px-1 py-0.5 text-xs border border-amber-300 rounded font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent text-center ${Number(draft.phonepay_diff) < 0 ? 'text-red-600' : Number(draft.phonepay_diff) > 0 ? 'text-blue-600' : 'text-gray-700'
                            }`}
                        />
                      </td>

                      {/* Bank Phone Pay Date (Editable Date Picker) */}
                      <td className="px-0.5 py-1 border-r border-gray-200 bg-yellow-50/30">
                        <input
                          type="date"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.bank_phone_pay_date || ""}
                          onChange={(e) => handleDraftChange(tId, "bank_phone_pay_date", e.target.value)}
                          className="w-full px-0.5 py-0.5 text-[11px] border border-amber-300 rounded text-rose-700 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-700 text-center"
                        />
                      </td>

                      {/* Total Diff (Editable Input) */}
                      <td className="px-1 py-1 border-r border-gray-200 bg-slate-50">
                        <input
                          type="number"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.total_diff ?? ""}
                          onChange={(e) => handleDraftChange(tId, "total_diff", e.target.value)}
                          placeholder="0"
                          className={`w-full px-1 py-0.5 text-xs border border-slate-300 rounded font-extrabold focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white disabled:bg-transparent disabled:border-transparent text-center ${Number(draft.total_diff) < 0 ? 'text-red-600' : Number(draft.total_diff) > 0 ? 'text-emerald-700' : 'text-gray-800'
                            }`}
                        />
                      </td>

                      {/* Narration (Editable Text) */}
                      <td className="px-2 py-1 border-r border-gray-200 min-w-[160px]">
                        <input
                          type="text"
                          disabled={!isModifyAllowed || !isChecked}
                          value={draft.narration || ""}
                          onChange={(e) => handleDraftChange(tId, "narration", e.target.value)}
                          placeholder="Audit narration & remarks..."
                          className="w-full px-2 py-1 text-xs border border-blue-300 rounded text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-transparent disabled:border-transparent disabled:text-gray-600"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
