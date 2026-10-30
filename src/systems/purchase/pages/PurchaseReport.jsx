import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  FileText, RefreshCw, Search, Calendar, Store, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import useShopStore from "../store/useShopStore";

const PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 400;

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

function getPageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

const GROUP_OPTIONS = [
  { value: "none", label: "No grouping" },
  { value: "trader", label: "Trader wise" },
  { value: "brand", label: "Brand wise" },
  { value: "item", label: "Item wise" },
];

const STATUS_STYLES = {
  Deleted: "bg-red-50 text-red-700 border-red-200",
  Received: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Receiver Rejected": "bg-red-50 text-red-700 border-red-200",
  "In Transit": "bg-sky-50 text-sky-700 border-sky-200",
  "Transporter Rejected": "bg-red-50 text-red-700 border-red-200",
  "Trader Confirmed": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Trader Rejected": "bg-red-50 text-red-700 border-red-200",
  "On Hold": "bg-amber-50 text-amber-700 border-amber-200",
  "PO Generated": "bg-violet-50 text-violet-700 border-violet-200",
  Approved: "bg-teal-50 text-teal-700 border-teal-200",
  "Indent Raised": "bg-slate-100 text-slate-700 border-slate-200",
};

const isYes = (v) => String(v || "").toLowerCase() === "yes";
const isNo = (v) => String(v || "").toLowerCase() === "no";

// Where the item currently sits in Indent → Approval → PO → Trader → Transporter → Received
function getCycleStatus(r) {
  if (r.is_deleted) return "Deleted";
  if (isYes(r.receiver_status)) return "Received";
  if (isNo(r.receiver_status)) return "Receiver Rejected";
  if (isYes(r.transporter_status)) return "In Transit";
  if (isNo(r.transporter_status)) return "Transporter Rejected";
  if (isYes(r.trader_status)) return "Trader Confirmed";
  if (isNo(r.trader_status)) return "Trader Rejected";
  if (r.po_action === "On Hold") return "On Hold";
  if (r.po_number || r.po_id) return "PO Generated";
  if (r.approved_at) return "Approved";
  return "Indent Raised";
}

const BADGE = {
  Approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Rejected: "bg-red-50 text-red-700 border-red-200",
  Deleted: "bg-red-50 text-red-700 border-red-200",
  Pending: "bg-slate-100 text-slate-600 border-slate-200",
  "Added in PO": "bg-amber-50 text-amber-700 border-amber-200",
};

function getApprovalStatus(r) {
  if (r.is_deleted) return "Deleted";
  const a = String(r.approver_action || "");
  if (!a && r.po_action === "Direct Added in PO") return "Added in PO";
  if (/^rejected/i.test(a)) return "Rejected";
  if (a) return "Approved";
  return "Pending";
}

function getPartyStatus(v) {
  const s = String(v || "").toLowerCase();
  if (s === "yes" || s === "verified") return "Accepted";
  if (s === "no") return "Rejected";
  return "Pending";
}

function StatusBadge({ value }) {
  return (
    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${BADGE[value] || BADGE.Pending}`}>
      {value}
    </span>
  );
}

const fmtDate =(v) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-GB");
};
const num = (v) => (v === null || v === undefined || v === "" ? "—" : v);

// Only items whose indent has a generated PO, narrowed by the page filters
function applyFilters(query, { shopFilter, startDate, endDate, search }) {
  query = query.not("po_number", "is", null);
  if (shopFilter) query = query.eq("shop_name", shopFilter);
  if (startDate) query = query.gte("indent_created_at", new Date(`${startDate}T00:00:00`).toISOString());
  if (endDate) query = query.lte("indent_created_at", new Date(`${endDate}T23:59:59.999`).toISOString());
  const q = (search || "").replace(/[,()]/g, " ").trim();
  if (q) {
    query = query.or(
      `item_name.ilike.%${q}%,party_name.ilike.%${q}%,company_name.ilike.%${q}%,company_scope.ilike.%${q}%,po_number.ilike.%${q}%,indent_id.ilike.%${q}%`
    );
  }
  return query;
}

// Resolve transporter / receiver / brand / company scope from the PO each row belongs to
async function enrichRows(list) {
  const poNumbers = [...new Set(list.map((r) => r.po_number).filter(Boolean))];
  const poMap = {};
  if (poNumbers.length > 0) {
    const [posRes, trRes, rcRes] = await Promise.all([
      supabase
        .from("purchase_purchase_orders")
        .select("po_number, transporter_number, receiver_number, po_items, created_at, company_scope")
        .in("po_number", poNumbers),
      supabase.from("purchase_transporters").select("name, contact_number"),
      supabase.from("purchase_receivers").select("name, contact_number"),
    ]);
    const trMap = {};
    (trRes.data || []).forEach((t) => { if (t.contact_number) trMap[t.contact_number.trim()] = t.name; });
    const rcMap = {};
    (rcRes.data || []).forEach((t) => { if (t.contact_number) rcMap[t.contact_number.trim()] = t.name; });

    (posRes.data || []).forEach((po) => {
      let items = po.po_items;
      if (typeof items === "string") {
        try { items = JSON.parse(items); } catch { items = []; }
      }
      const tn = (po.transporter_number || "").trim();
      const rn = (po.receiver_number || "").trim();
      poMap[po.po_number] = {
        transporter: trMap[tn] || po.transporter_number || "",
        receiver: rcMap[rn] || po.receiver_number || "",
        items: Array.isArray(items) ? items : [],
        created_at: po.created_at,
        company_scope: po.company_scope || "",
      };
    });
  }

  return list.map((r) => {
    const po = poMap[r.po_number];
    const poItem = po?.items.find(
      (i) => (i.item_name || i.itemName || i.name) === r.item_name
    );
    return {
      ...r,
      company_scope: r.company_scope || po?.company_scope || "",
      order_date: r.po_generated_at || r.indent_created_at || po?.created_at,
      brand: r.brand_name || poItem?.brand_name || poItem?.brandName || "",
      transporter: po?.transporter || "",
      receiver: po?.receiver || "",
      cycle: getCycleStatus(r),
    };
  });
}

export default function PurchaseReport() {
  const shops = useShopStore((s) => s.shops) || [];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [startDate, setStartDate] = useState(() => daysAgoISO(30));
  const [endDate, setEndDate] = useState(() => todayISO());
  const [groupBy, setGroupBy] = useState("none");

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const next = search.trim();
    if (next === debouncedSearch) return;
    const t = setTimeout(() => {
      setDebouncedSearch(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search, debouncedSearch]);

  const fetchRows = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    setError("");
    try {
      const from = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from("purchase_dashboard")
        .select("*", { count: "exact" });

      query = applyFilters(query, { shopFilter, startDate, endDate, search: debouncedSearch })
        .order("indent_created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      const { data, error: qErr, count } = await query;
      if (requestId !== latestRequestRef.current) return;
      if (qErr) throw qErr;

      const mapped = await enrichRows(data || []);
      if (requestId !== latestRequestRef.current) return;

      setRows(mapped);
      setTotalCount(count || 0);
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      console.error("Error fetching purchase report:", err);
      setError(err.message || "Failed to load purchase report");
      setRows([]);
      setTotalCount(0);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [shopFilter, startDate, endDate, debouncedSearch, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Export every row matching the current filters (all pages), not just the visible one
  const handleExport = async () => {
    setExporting(true);
    try {
      const all = [];
      const BATCH = 1000;
      for (let from = 0; ; from += BATCH) {
        const { data, error: qErr } = await applyFilters(
          supabase.from("purchase_dashboard").select("*"),
          { shopFilter, startDate, endDate, search: debouncedSearch }
        )
          .order("indent_created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(from, from + BATCH - 1);
        if (qErr) throw qErr;
        all.push(...(data || []));
        if (!data || data.length < BATCH) break;
      }
      if (all.length === 0) {
        alert("No records to export for the selected filters.");
        return;
      }

      const enriched = await enrichRows(all);
      const sheetRows = enriched.map((r) => ({
        "Order Date": fmtDate(r.order_date),
        "Order No": r.po_number || r.indent_id || "",
        "Trader Name": r.party_name || "",
        "Company Name": r.company_scope || "Not generated",
        "Item Name": r.item_name || "",
        "Brand Name": r.brand || "",
        "Generated Qty": parseFloat(r.order_qty) || 0,
        "Order Qty (Bottle)": r.po_qty ?? "",
        "Order Qty (Box)": r.po_box ?? "",
        "Approved Status": getApprovalStatus(r),
        "Trader Status": getPartyStatus(r.trader_status),
        "Transporter Status": getPartyStatus(r.transporter_status),
        "Receiver Status": getPartyStatus(r.receiver_status),
        "Cycle Status": r.cycle,
      }));

      const ws = XLSX.utils.json_to_sheet(sheetRows);
      ws["!cols"] = Object.keys(sheetRows[0]).map((k) => ({
        wch: Math.min(40, Math.max(k.length, ...sheetRows.map((row) => String(row[k]).length)) + 2),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Purchase Report");
      XLSX.writeFile(wb, `Purchase_Report_${startDate || "all"}_to_${endDate || "all"}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed: " + (err.message || err));
    } finally {
      setExporting(false);
    }
  };

  // Group the loaded page; group headers show subtotals
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: null, rows }];
    const keyOf = (r) =>
      (groupBy === "trader" ? r.party_name : groupBy === "brand" ? r.brand : r.item_name) || "Unknown";
    const map = new Map();
    rows.forEach((r) => {
      const k = keyOf(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({ key, rows: list }));
  }, [rows, groupBy]);

  const sum = (list, f) => list.reduce((a, r) => a + (parseFloat(r[f]) || 0), 0);
  const COLS = 14;

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden flex flex-col flex-1">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100/80 shadow-sm shrink-0">
            <FileText size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Purchase Report</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Trader, brand and item wise view of the indent → PO → transport → received cycle
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            <span>{exporting ? "Exporting..." : "Export Excel"}</span>
          </button>
          <button
            onClick={fetchRows}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-nowrap overflow-x-auto min-w-0">
          <div className="relative flex-1 lg:flex-none lg:w-64 min-w-44">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item, trader, company, PO no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl shrink-0">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">From:</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-transparent text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl shrink-0">
            <Calendar size={13} className="text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500">To:</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-transparent text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => { setStartDate(""); setEndDate(""); setPage(1); }}
            className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold px-1.5 py-1 rounded-lg whitespace-nowrap shrink-0 hover:bg-slate-100 transition cursor-pointer"
          >
            Clear dates
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end shrink-0 flex-wrap">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none cursor-pointer"
          >
            {GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-400 shrink-0" />
            <select
              value={shopFilter}
              onChange={(e) => { setShopFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none cursor-pointer"
            >
              <option value="">All Shops</option>
              {shops.map((s) => {
                const name = typeof s === "string" ? s : s.name || s.shop_name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60 whitespace-nowrap">
            Total: <b className="text-indigo-900">{totalCount.toLocaleString()}</b>
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        <div className="overflow-x-auto overflow-y-auto h-[75vh] min-h-150 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="px-3 py-3">Order Date</th>
                <th className="px-3 py-3">Order No</th>
                <th className="px-3 py-3">Trader Name</th>
                <th className="px-3 py-3">Company Name</th>
                <th className="px-3 py-3">Item Name</th>
                <th className="px-3 py-3">Brand Name</th>
                <th className="px-3 py-3 text-right">Generated Qty</th>
                <th className="px-3 py-3 text-right">Order Qty (Bottle)</th>
                <th className="px-3 py-3 text-right">Order Qty (Box)</th>
                <th className="px-3 py-3">Approved Status</th>
                <th className="px-3 py-3">Trader Status</th>
                <th className="px-3 py-3">Transporter Status</th>
                <th className="px-3 py-3">Receiver Status</th>
                <th className="px-3 py-3">Cycle Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={COLS} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">Loading purchase report...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={COLS} className="text-center py-14 text-red-600 text-xs font-semibold">{error}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No purchase records found</span>
                      <p className="text-xs text-slate-400">Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                grouped.map((g) => (
                  <GroupBlock key={g.key ?? "all"} group={g} sum={sum} cols={COLS} />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div>
            {totalCount > 0 ? (
              <>
                Showing <span className="font-bold text-slate-800">{((page - 1) * PAGE_SIZE + 1).toLocaleString()}</span>
                {"–"}
                <span className="font-bold text-slate-800">{Math.min(page * PAGE_SIZE, totalCount).toLocaleString()}</span>
                {" of "}
                <span className="font-bold text-slate-800">{totalCount.toLocaleString()}</span> records
              </>
            ) : (
              <>Showing <span className="font-bold text-slate-800">0</span> records</>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-center">
            <PagerBtn onClick={() => setPage(1)} disabled={loading || page <= 1} title="First page"><ChevronsLeft size={14} /></PagerBtn>
            <PagerBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={loading || page <= 1} title="Previous page"><ChevronLeft size={14} /></PagerBtn>
            {getPageList(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`gap-${i}`} className="px-1.5 text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  disabled={loading}
                  className={`min-w-7.5 px-2 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed ${
                    p === page
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {p.toLocaleString()}
                </button>
              )
            )}
            <PagerBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={loading || page >= totalPages} title="Next page"><ChevronRight size={14} /></PagerBtn>
            <PagerBtn onClick={() => setPage(totalPages)} disabled={loading || page >= totalPages} title="Last page"><ChevronsRight size={14} /></PagerBtn>
            <span className="ml-2 text-[11px] text-slate-400">
              Page {page.toLocaleString()} of {totalPages.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagerBtn({ children, ...props }) {
  return (
    <button
      {...props}
      className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
    >
      {children}
    </button>
  );
}

function GroupBlock({ group, sum, cols }) {
  return (
    <>
      {group.key !== null && (
        <tr className="bg-indigo-50/70">
          <td colSpan={cols - 8} className="px-3 py-2 font-bold text-indigo-900">
            {group.key} <span className="text-slate-500 font-medium">({group.rows.length})</span>
          </td>
          <td className="px-3 py-2 text-right font-mono font-bold text-indigo-900">{sum(group.rows, "order_qty")}</td>
          <td className="px-3 py-2 text-right font-mono font-bold text-indigo-900">{sum(group.rows, "po_qty")}</td>
          <td className="px-3 py-2 text-right font-mono font-bold text-indigo-900">{sum(group.rows, "po_box")}</td>
          <td colSpan={5} />
        </tr>
      )}
      {group.rows.map((r, idx) => (
        <tr key={r.id ?? `${r.indent_id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
          <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{fmtDate(r.order_date)}</td>
          <td className="px-3 py-2.5 font-bold text-indigo-900">{r.po_number || r.indent_id || "—"}</td>
          <td className="px-3 py-2.5 text-slate-800 font-semibold">{r.party_name || "—"}</td>
          <td className="px-3 py-2.5 text-slate-600">{r.company_scope || <span className="text-slate-400 italic">Not generated</span>}</td>
          <td className="px-3 py-2.5 font-bold text-slate-900">{r.item_name || "—"}</td>
          <td className="px-3 py-2.5 text-slate-700">{r.brand || "—"}</td>
          <td className="px-3 py-2.5 text-right font-mono text-slate-600">{num(r.order_qty)}</td>
          <td className="px-3 py-2.5 text-right font-mono text-slate-700">{num(r.po_qty)}</td>
          <td className="px-3 py-2.5 text-right font-mono text-slate-700">{num(r.po_box)}</td>
          <td className="px-3 py-2.5"><StatusBadge value={getApprovalStatus(r)} /></td>
          <td className="px-3 py-2.5"><StatusBadge value={getPartyStatus(r.trader_status)} /></td>
          <td className="px-3 py-2.5"><StatusBadge value={getPartyStatus(r.transporter_status)} /></td>
          <td className="px-3 py-2.5"><StatusBadge value={getPartyStatus(r.receiver_status)} /></td>
          <td className="px-3 py-2.5">
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_STYLES[r.cycle] || STATUS_STYLES["Indent Raised"]}`}>
              {r.cycle}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
