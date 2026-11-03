import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  FileText, RefreshCw, Search, Calendar, Store, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import * as XLSX from "xlsx";
import useShopStore from "../store/useShopStore";
import useCompanyStore from "../store/useCompanyStore";
import { isTransporterSkippedForOrder } from "../utils/poHelpers";

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
  "Direct Delivery": "bg-sky-50 text-sky-700 border-sky-200",
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

// Overall lifecycle status
function getCycleStatus(r) {
  if (r.is_deleted) return "Deleted";
  if (isYes(r.receiver_status)) return "Received";
  if (isNo(r.receiver_status)) return "Receiver Rejected";

  // If the order was actually processed/approved by a transporter, honor the real physical audit trail!
  if (isYes(r.transporter_status)) return "In Transit";
  if (isNo(r.transporter_status)) return "Transporter Rejected";

  // If transporter was bypassed / skipped
  if (r.is_transporter_skipped) {
    if (isYes(r.trader_status)) return "Direct Delivery";
    if (isNo(r.trader_status)) return "Trader Rejected";
  } else {
    if (isYes(r.trader_status)) return "Trader Confirmed";
    if (isNo(r.trader_status)) return "Trader Rejected";
  }

  if (r.po_action === "On Hold") return "On Hold";
  if (r.po_number || r.po_id) return "PO Generated";
  if (r.approved_at) return "Approved";
  return "Indent Raised";
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-GB");
}

function fmtQty(v) {
  if (v === null || v === undefined || v === "") return "—";
  const num = parseFloat(v);
  if (isNaN(num)) return "—";
  // Round to at most 2 decimal places and format
  return Number(num.toFixed(2)).toLocaleString("en-IN");
}

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

// Enrich each row with resolved lifecycle data: stage statuses and quantities
async function enrichRows(list, companies = []) {
  const poNumbers = [...new Set(list.map((r) => r.po_number).filter(Boolean))];
  const poMap = {};
  if (poNumbers.length > 0) {
    const [posRes, trRes, rcRes] = await Promise.all([
      supabase
        .from("purchase_purchase_orders")
        .select("id, po_number, shop_name, transporter_number, receiver_number, po_items, created_at, company_scope, received_items, delivered_items, transporter_remarks, transporter_status, trader_item_statuses")
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
      let receivedItems = po.received_items;
      if (typeof receivedItems === "string") {
        try { receivedItems = JSON.parse(receivedItems); } catch { receivedItems = {}; }
      }
      let deliveredItems = po.delivered_items;
      if (typeof deliveredItems === "string") {
        try { deliveredItems = JSON.parse(deliveredItems); } catch { deliveredItems = {}; }
      }
      let traderDecisions = po.trader_item_statuses;
      if (typeof traderDecisions === "string") {
        try { traderDecisions = JSON.parse(traderDecisions); } catch { traderDecisions = {}; }
      }
      const tn = (po.transporter_number || "").trim();
      const rn = (po.receiver_number || "").trim();

      const isSkipped = isTransporterSkippedForOrder(po, companies);

      poMap[po.po_number] = {
        id: po.id,
        transporter: isSkipped ? "Direct Delivery (Skipped)" : (trMap[tn] || po.transporter_number || ""),
        receiver: rcMap[rn] || po.receiver_number || "",
        items: Array.isArray(items) ? items : [],
        received_items: receivedItems || {},
        delivered_items: deliveredItems || {},
        trader_item_statuses: traderDecisions || {},
        created_at: po.created_at,
        company_scope: po.company_scope || "",
        is_transporter_skipped: isSkipped,
        po_raw: po,
      };
    });
  }

  return list.map((r) => {
    const po = poMap[r.po_number];
    const poItem = po?.items.find(
      (i) => (i.item_name || i.itemName || i.name) === r.item_name
    );

    // ──────────────────────────────────────────────
    // 1. Indent Stage
    // ──────────────────────────────────────────────
    const indentQty = r.order_qty != null ? parseFloat(r.order_qty) : 0;
    const indentBox = r.order_box != null ? parseFloat(r.order_box) : 0;

    let indentStatus = "Raised";
    if (r.po_action === "Direct Added in PO") {
      indentStatus = "Direct PO";
    } else if (r.approver_action === "Extra add by approver") {
      indentStatus = "Extra Added";
    } else if (indentQty === 0) {
      indentStatus = "No Indent";
    }

    // ──────────────────────────────────────────────
    // 2. Approval Stage
    // ──────────────────────────────────────────────
    let approvedQty = r.approved_qty != null ? parseFloat(r.approved_qty) : (r.approved_at ? indentQty : null);
    const approvedBox = r.approved_box != null ? parseFloat(r.approved_box) : (r.approved_at ? indentBox : null);

    let approvalDiff = null;
    let approvalType = "Approved";

    if (r.is_deleted && r.deletion_stage === "approval") {
      approvalType = "Rejected";
    } else if (r.po_action === "Direct Added in PO") {
      approvalType = "Added in PO";
      approvedQty = approvedQty ?? 0;
    } else if (r.approver_action === "Extra add by approver" || (indentQty === 0 && (approvedQty || 0) > 0)) {
      approvalType = "Extra Added";
      approvalDiff = approvedQty;
    } else if (approvedQty !== null) {
      approvalDiff = Math.round((approvedQty - indentQty) * 100) / 100;
      if (Math.abs(approvalDiff) > 0.001) {
        approvalType = "Modified";
      } else {
        approvalType = "Approved";
      }
    } else {
      approvalType = "Pending";
    }

    // ──────────────────────────────────────────────
    // 3. PO Stage
    // ──────────────────────────────────────────────
    const poQty = r.po_qty != null ? parseFloat(r.po_qty) : null;
    const poBox = r.po_box != null ? parseFloat(r.po_box) : null;

    let poDiff = null;
    let poModificationType = "PO Generated";
    if (r.po_action === "Direct Added in PO") {
      poModificationType = "Direct Added";
      poDiff = poQty;
    } else if (poQty !== null && approvedQty !== null) {
      poDiff = Math.round((poQty - approvedQty) * 100) / 100;
      if (Math.abs(poDiff) > 0.001) {
        poModificationType = "Modified";
      } else {
        poModificationType = "PO Generated";
      }
    } else if (poQty !== null) {
      poDiff = Math.round((poQty - indentQty) * 100) / 100;
      poModificationType = Math.abs(poDiff) > 0.001 ? "Modified" : "PO Generated";
    } else if (r.po_action === "On Hold") {
      poModificationType = "On Hold";
    } else {
      poModificationType = "Pending";
    }

    // ──────────────────────────────────────────────
    // 4. Trader (Vendor) Stage
    // ──────────────────────────────────────────────
    let traderStatus = "Pending";
    let traderQty = null;
    const itemTraderDecision = poItem?.id ? po?.trader_item_statuses?.[poItem.id] : null;

    if (itemTraderDecision === "rejected" || itemTraderDecision === "no") {
      traderStatus = "Rejected";
      traderQty = 0;
    } else if (isNo(r.trader_status)) {
      traderStatus = "Rejected";
      traderQty = 0;
    } else if (isYes(r.trader_status) || itemTraderDecision === "approved" || itemTraderDecision === "yes") {
      traderStatus = "Accepted";
      traderQty = poQty;
    } else {
      traderStatus = "Pending";
      traderQty = null;
    }

    // ──────────────────────────────────────────────
    // 5. Transporter Stage
    // ──────────────────────────────────────────────
    const hasApprovedTransporter = isYes(r.transporter_status) || isYes(po?.po_raw?.transporter_status);
    const hasRejectedTransporter = isNo(r.transporter_status) || isNo(po?.po_raw?.transporter_status);
    const isTransporterSkipped = !hasApprovedTransporter && !hasRejectedTransporter && (po?.is_transporter_skipped || isTransporterSkippedForOrder(po?.po_raw, companies));

    let transporterStatus = "Pending";
    let transporterQty = null;

    if (hasApprovedTransporter) {
      // Historical or active order was actually approved on the transporter page -> honor physical reality
      transporterStatus = "In Transit";
      const delMap = po?.delivered_items || {};
      let foundDel = null;
      if (poItem?.id && delMap[poItem.id]) {
        foundDel = delMap[poItem.id];
      } else {
        const matchKey = Object.keys(delMap).find((k) => {
          const itemObj = delMap[k];
          return (itemObj.itemName || itemObj.item_name) === r.item_name;
        });
        if (matchKey) foundDel = delMap[matchKey];
      }
      transporterQty = foundDel?.deliveredQty != null ? parseFloat(foundDel.deliveredQty) : poQty;
    } else if (hasRejectedTransporter) {
      transporterStatus = "Rejected";
      transporterQty = 0;
    } else if (isTransporterSkipped) {
      transporterStatus = "Skipped (Direct)";
      transporterQty = poQty;
    } else {
      transporterStatus = "Pending";
      transporterQty = null;
    }

    // ──────────────────────────────────────────────
    // 6. Receiver Stage
    // ──────────────────────────────────────────────
    let receivedQty = null;
    if (isYes(r.receiver_status) || po?.po_raw?.receiver_status === "yes") {
      const recMap = po?.received_items || {};
      let foundRec = null;
      if (poItem?.id && recMap[poItem.id]) {
        foundRec = recMap[poItem.id];
      } else {
        const matchKey = Object.keys(recMap).find((k) => {
          const itemObj = recMap[k];
          return (itemObj.itemName || itemObj.item_name) === r.item_name;
        });
        if (matchKey) foundRec = recMap[matchKey];
      }

      if (foundRec && foundRec.receivedQty != null) {
        receivedQty = parseFloat(foundRec.receivedQty);
      } else if (poQty !== null) {
        receivedQty = poQty;
      }
    }

    let receivingVariance = null;
    let receiverStatus = "Pending";
    if (isNo(r.receiver_status)) {
      receiverStatus = "Rejected";
      receivedQty = 0;
    } else if (receivedQty !== null && poQty !== null) {
      receivingVariance = Math.round((receivedQty - poQty) * 100) / 100;
      if (Math.abs(receivingVariance) < 0.001) {
        receiverStatus = "Match";
      } else if (receivingVariance < 0) {
        receiverStatus = "Shortage";
      } else {
        receiverStatus = "Excess";
      }
    } else if (isYes(r.receiver_status)) {
      receiverStatus = "Received";
    }

    return {
      ...r,
      company_scope: r.company_scope || po?.company_scope || "",
      order_date: r.po_generated_at || r.indent_created_at || po?.created_at,
      brand: r.brand_name || poItem?.brand_name || poItem?.brandName || "",
      transporter: po?.transporter || (isTransporterSkipped ? "Direct Delivery (Skipped)" : ""),
      receiver: po?.receiver || "",

      // 1. Indent
      indent_status: indentStatus,
      indent_qty: indentQty,
      indent_box: indentBox,

      // 2. Approval
      approval_status: approvalType,
      approval_diff: approvalDiff,
      approved_qty: approvedQty,
      approved_box: approvedBox,

      // 3. PO
      po_status: poModificationType,
      po_diff: poDiff,
      po_qty: poQty,
      po_box: poBox,

      // 4. Trader
      trader_status: traderStatus,
      trader_qty: traderQty,

      // 5. Transporter
      is_transporter_skipped: isTransporterSkipped,
      transporter_status: transporterStatus,
      transporter_qty: transporterQty,

      // 6. Receiver
      receiver_status: receiverStatus,
      received_qty: receivedQty,
      receiving_variance: receivingVariance,

      // Cycle
      cycle: getCycleStatus({
        ...r,
        is_transporter_skipped: isTransporterSkipped,
      }),
    };
  });
}

export default function PurchaseReport() {
  const shops = useShopStore((s) => s.shops) || [];
  const companies = useCompanyStore((s) => s.companies) || [];
  const fetchCompanies = useCompanyStore((s) => s.fetchCompanies);

  useEffect(() => {
    if (!companies || companies.length === 0) {
      fetchCompanies();
    }
  }, [companies, fetchCompanies]);

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

      const mapped = await enrichRows(data || [], companies);
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
  }, [shopFilter, startDate, endDate, debouncedSearch, page, companies]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Export all filtered rows across all pages
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

      const enriched = await enrichRows(all, companies);
      const sheetRows = enriched.map((r) => ({
        "Order Date": fmtDate(r.order_date),
        "Order No": r.po_number || r.indent_id || "",
        "Trader Name": r.party_name || "",
        "Company Scope": r.company_scope || "Not generated",
        "Item Name": r.item_name || "",
        "Brand Name": r.brand || "",

        // 1. Indent Stage
        "Indent Status": r.indent_status,
        "Indent Qty": r.indent_qty != null ? r.indent_qty : 0,
        "Indent Box": r.indent_box != null ? r.indent_box : 0,

        // 2. Approval Stage
        "Approval Status": r.approval_status === "Modified"
          ? `Modified (${r.approval_diff > 0 ? `+${r.approval_diff}` : r.approval_diff})`
          : r.approval_status,
        "Approved Qty": r.approved_qty ?? "",
        "Approved Box": r.approved_box ?? "",

        // 3. PO Stage
        "PO Status": r.po_status === "Modified"
          ? `Modified (${r.po_diff > 0 ? `+${r.po_diff}` : r.po_diff})`
          : r.po_status,
        "PO Qty": r.po_qty ?? "",
        "PO Box": r.po_box ?? "",

        // 4. Trader Stage
        "Trader Status": r.trader_status,
        "Trader Qty": r.trader_qty ?? "",

        // 5. Transporter Stage
        "Transporter Status": r.transporter_status,
        "Transporter Qty": r.transporter_qty ?? "",

        // 6. Receiver Stage
        "Receiver Status": r.receiver_status === "Shortage"
          ? `Shortage (${r.receiving_variance})`
          : r.receiver_status === "Excess"
          ? `Excess (+${r.receiving_variance})`
          : r.receiver_status === "Match"
          ? "Match (100%)"
          : r.receiver_status,
        "Received Qty": r.received_qty ?? "",
        "Receiving Variance": r.receiving_variance ?? "",

        // Cycle Status
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
  const COLS = 19; // 6 info cols + (6 stages * 2) + 1 cycle

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden flex flex-col flex-1 font-sans text-xs text-slate-800">
      {/* Page Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100/80 shadow-2xs shrink-0">
            <FileText size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate font-sans">Purchase Report</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5 font-sans">
              Trader, brand and item wise view of the indent → approval → PO → vendor → transporter → received cycle
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white !rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans"
          >
            <Download size={14} />
            <span>{exporting ? "Exporting..." : "Export Excel"}</span>
          </button>
          <button
            onClick={fetchRows}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 !rounded-lg shadow-2xs transition-all cursor-pointer font-sans"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-nowrap overflow-x-auto min-w-0">
          <div className="relative flex-1 lg:flex-none lg:w-64 min-w-44">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item, trader, company, PO no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full pl-8 pr-3 text-xs border border-slate-200 !rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-sans shadow-2xs"
            />
          </div>
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 h-9 !rounded-lg shrink-0 shadow-2xs">
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
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 h-9 !rounded-lg shrink-0 shadow-2xs">
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
            className="text-[11px] text-slate-500 hover:text-slate-700 font-semibold px-2 py-1 rounded-md whitespace-nowrap shrink-0 hover:bg-slate-100 transition cursor-pointer"
          >
            Clear dates
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end shrink-0 flex-wrap">
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value)}
            className="h-9 px-3 text-xs border border-slate-200 !rounded-lg font-semibold text-slate-700 bg-white hover:bg-slate-50 outline-none cursor-pointer shadow-2xs font-sans"
          >
            {GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-400 shrink-0" />
            <select
              value={shopFilter}
              onChange={(e) => { setShopFilter(e.target.value); setPage(1); }}
              className="h-9 px-3 text-xs border border-slate-200 !rounded-lg font-semibold text-slate-700 bg-white hover:bg-slate-50 outline-none cursor-pointer shadow-2xs font-sans"
            >
              <option value="">All Shops</option>
              {shops.map((s) => {
                const name = typeof s === "string" ? s : s.name || s.shop_name;
                return <option key={name} value={name}>{name}</option>;
              })}
            </select>
          </div>
          <span className="h-9 inline-flex items-center text-xs font-semibold text-slate-500 bg-slate-50 px-3 !rounded-lg border border-slate-200/80 whitespace-nowrap shadow-2xs">
            Total: <b className="text-indigo-900 ml-1 font-mono">{totalCount.toLocaleString()}</b>
          </span>
        </div>
      </div>

      {/* Multi-Stage Lifecycle Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col min-w-0 w-full font-sans">
        <div className="overflow-x-auto overflow-y-auto h-[75vh] min-h-150 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="sticky top-0 z-20 shadow-xs select-none">
              {/* Tier 1 Header: Stages */}
              <tr className="bg-slate-900 text-slate-200 text-[11px] font-bold tracking-wider uppercase border-b border-slate-700">
                <th colSpan={6} className="px-3 py-2.5 text-left border-r border-slate-700 text-slate-300">
                  Order Details
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center border-r border-slate-700 bg-slate-800 text-indigo-300">
                  1. Indent Stage
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center border-r border-slate-700 bg-slate-800/90 text-teal-300">
                  2. Approval Stage
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center border-r border-slate-700 bg-slate-800 text-violet-300">
                  3. PO Stage
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center border-r border-slate-700 bg-slate-800/90 text-amber-300">
                  4. Trader Stage
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center border-r border-slate-700 bg-slate-800 text-sky-300">
                  5. Transporter Stage
                </th>
                <th colSpan={2} className="px-3 py-2.5 text-center border-r border-slate-700 bg-slate-800/90 text-emerald-300">
                  6. Receiver Stage
                </th>
                <th rowSpan={2} className="px-3 py-2.5 text-center bg-slate-900 text-slate-200 border-l border-slate-700">
                  Cycle Status
                </th>
              </tr>

              {/* Tier 2 Header: 2 Columns per Stage (Status + Qty) */}
              <tr className="bg-slate-800 text-slate-300 text-[10px] font-bold tracking-wider uppercase border-b border-slate-650">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">PO No</th>
                <th className="px-3 py-2">Trader</th>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 border-r border-slate-700">Brand</th>

                {/* 1. Indent */}
                <th className="px-3 py-2 bg-slate-800/70 text-slate-300">Status</th>
                <th className="px-3 py-2 text-right border-r border-slate-700 bg-slate-800/70 text-slate-200">Qty</th>

                {/* 2. Approval */}
                <th className="px-3 py-2 bg-slate-800/50 text-teal-300">Status</th>
                <th className="px-3 py-2 text-right border-r border-slate-700 bg-slate-800/50 text-teal-200">Qty</th>

                {/* 3. PO */}
                <th className="px-3 py-2 bg-slate-800/70 text-violet-300">Status</th>
                <th className="px-3 py-2 text-right border-r border-slate-700 bg-slate-800/70 text-violet-200">Qty</th>

                {/* 4. Trader */}
                <th className="px-3 py-2 bg-slate-800/50 text-amber-300">Status</th>
                <th className="px-3 py-2 text-right border-r border-slate-700 bg-slate-800/50 text-amber-200">Qty</th>

                {/* 5. Transporter */}
                <th className="px-3 py-2 bg-slate-800/70 text-sky-300">Status</th>
                <th className="px-3 py-2 text-right border-r border-slate-700 bg-slate-800/70 text-sky-200">Qty</th>

                {/* 6. Receiver */}
                <th className="px-3 py-2 bg-slate-800/50 text-emerald-300">Status</th>
                <th className="px-3 py-2 text-right border-r border-slate-700 bg-slate-800/50 text-emerald-200">Qty</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={COLS} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-indigo-600" />
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

        {/* Pagination Toolbar */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div>
            {totalCount > 0 ? (
              <>
                Showing <span className="font-bold text-slate-800 font-mono">{((page - 1) * PAGE_SIZE + 1).toLocaleString()}</span>
                {"–"}
                <span className="font-bold text-slate-800 font-mono">{Math.min(page * PAGE_SIZE, totalCount).toLocaleString()}</span>
                {" of "}
                <span className="font-bold text-slate-800 font-mono">{totalCount.toLocaleString()}</span> records
              </>
            ) : (
              <>Showing <span className="font-bold text-slate-800">0</span> records</>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap justify-center font-sans">
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
                  className={`min-w-7.5 px-2 py-1 !rounded-lg border text-xs font-semibold transition cursor-pointer disabled:cursor-not-allowed font-mono ${
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
      className="p-1.5 !rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-2xs"
    >
      {children}
    </button>
  );
}

function GroupBlock({ group, sum, cols }) {
  return (
    <>
      {group.key !== null && (
        <tr className="bg-indigo-50/70 border-b border-indigo-100 font-sans text-xs">
          <td colSpan={6} className="px-3 py-2 font-bold text-indigo-900 border-r border-indigo-200">
            {group.key} <span className="text-slate-500 font-medium">({group.rows.length})</span>
          </td>
          {/* 1. Indent Sum */}
          <td className="px-2.5 py-2 text-slate-400 italic text-[11px]">Subtotal</td>
          <td className="px-2.5 py-2 text-right font-mono font-bold text-indigo-900 border-r border-indigo-200">
            {fmtQty(sum(group.rows, "indent_qty"))}
          </td>

          {/* 2. Approval Sum */}
          <td className="px-2.5 py-2 text-slate-400 italic text-[11px]">Subtotal</td>
          <td className="px-2.5 py-2 text-right font-mono font-bold text-indigo-900 border-r border-indigo-200">
            {fmtQty(sum(group.rows, "approved_qty"))}
          </td>

          {/* 3. PO Sum */}
          <td className="px-2.5 py-2 text-slate-400 italic text-[11px]">Subtotal</td>
          <td className="px-2.5 py-2 text-right font-mono font-bold text-indigo-900 border-r border-indigo-200">
            {fmtQty(sum(group.rows, "po_qty"))}
          </td>

          {/* 4. Trader Sum */}
          <td className="px-2.5 py-2 text-slate-400 italic text-[11px]">Subtotal</td>
          <td className="px-2.5 py-2 text-right font-mono font-bold text-indigo-900 border-r border-indigo-200">
            {fmtQty(sum(group.rows, "trader_qty"))}
          </td>

          {/* 5. Transporter Sum */}
          <td className="px-2.5 py-2 text-slate-400 italic text-[11px]">Subtotal</td>
          <td className="px-2.5 py-2 text-right font-mono font-bold text-indigo-900 border-r border-indigo-200">
            {fmtQty(sum(group.rows, "transporter_qty"))}
          </td>

          {/* 6. Receiver Sum */}
          <td className="px-2.5 py-2 text-slate-400 italic text-[11px]">Subtotal</td>
          <td className="px-2.5 py-2 text-right font-mono font-bold text-indigo-900 border-r border-indigo-200">
            {fmtQty(sum(group.rows, "received_qty"))}
          </td>

          {/* Cycle */}
          <td className="px-3 py-2" />
        </tr>
      )}

      {group.rows.map((r, idx) => (
        <tr key={r.id ?? `${r.indent_id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
          {/* Order Details (6 cols) */}
          <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{fmtDate(r.order_date)}</td>
          <td className="px-3 py-2.5 font-bold text-indigo-900 font-mono">{r.po_number || r.indent_id || "—"}</td>
          <td className="px-3 py-2.5 text-slate-800 font-semibold">{r.party_name || "—"}</td>
          <td className="px-3 py-2.5 text-slate-600">{r.company_scope || <span className="text-slate-400 italic">Not generated</span>}</td>
          <td className="px-3 py-2.5 font-bold text-slate-900">{r.item_name || "—"}</td>
          <td className="px-3 py-2.5 text-slate-700 border-r border-slate-200/80">{r.brand || "—"}</td>

          {/* ────────────────────────────────────────────── */}
          {/* 1. Indent Stage (Status + Qty) */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-2.5 py-2.5">
            <IndentStatusBadge value={r.indent_status} />
          </td>
          <td
            className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200/80"
            title={r.indent_box > 0 ? `${r.indent_box} boxes` : undefined}
          >
            {fmtQty(r.indent_qty)}
          </td>

          {/* ────────────────────────────────────────────── */}
          {/* 2. Approval Stage (Status + Qty) */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-2.5 py-2.5">
            <ApprovalStatusBadge type={r.approval_status} diff={r.approval_diff} />
          </td>
          <td
            className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200/80"
            title={r.approved_box > 0 ? `${r.approved_box} boxes` : undefined}
          >
            {fmtQty(r.approved_qty)}
          </td>

          {/* ────────────────────────────────────────────── */}
          {/* 3. PO Stage (Status + Qty) */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-2.5 py-2.5">
            <POStatusBadge type={r.po_status} diff={r.po_diff} />
          </td>
          <td
            className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200/80"
            title={r.po_box > 0 ? `${r.po_box} boxes` : undefined}
          >
            {fmtQty(r.po_qty)}
          </td>

          {/* ────────────────────────────────────────────── */}
          {/* 4. Trader Stage (Status + Qty) */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-2.5 py-2.5">
            <TraderStatusBadge status={r.trader_status} />
          </td>
          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200/80">
            {fmtQty(r.trader_qty)}
          </td>

          {/* ────────────────────────────────────────────── */}
          {/* 5. Transporter Stage (Status + Qty) */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-2.5 py-2.5">
            <TransporterStatusBadge status={r.transporter_status} isSkipped={r.is_transporter_skipped} />
          </td>
          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200/80">
            {fmtQty(r.transporter_qty)}
          </td>

          {/* ────────────────────────────────────────────── */}
          {/* 6. Receiver Stage (Status + Qty) */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-2.5 py-2.5">
            <ReceiverStatusBadge status={r.receiver_status} variance={r.receiving_variance} />
          </td>
          <td className="px-2.5 py-2.5 text-right font-mono font-bold text-slate-800 border-r border-slate-200/80">
            {fmtQty(r.received_qty)}
          </td>

          {/* ────────────────────────────────────────────── */}
          {/* Overall Cycle Status */}
          {/* ────────────────────────────────────────────── */}
          <td className="px-3 py-2.5 text-center">
            <span className={`px-2.5 py-0.5 !rounded-full border text-[10px] font-bold ${STATUS_STYLES[r.cycle] || STATUS_STYLES["Indent Raised"]}`}>
              {r.cycle}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}

// ──────────────────────────────────────────────
// Stage Status Badges
// ──────────────────────────────────────────────

function IndentStatusBadge({ value }) {
  if (value === "Raised") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-200">Raised</span>;
  }
  if (value === "Direct PO") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">Direct PO</span>;
  }
  if (value === "Extra Added") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">Extra Added</span>;
  }
  return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-50 text-slate-400 border-slate-200">No Indent</span>;
}

function ApprovalStatusBadge({ type, diff }) {
  if (type === "Modified") {
    const formattedDiff = diff > 0 ? `+${diff}` : `${diff}`;
    return (
      <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200 inline-flex items-center gap-1">
        Modified <span className="font-mono text-[9px] opacity-90">({formattedDiff})</span>
      </span>
    );
  }
  if (type === "Extra Added") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">Extra Added</span>;
  }
  if (type === "Added in PO") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">Added in PO</span>;
  }
  if (type === "Approved") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-teal-50 text-teal-700 border-teal-200">Approved</span>;
  }
  if (type === "Rejected") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-red-50 text-red-700 border-red-200">Rejected</span>;
  }
  return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Pending</span>;
}

function POStatusBadge({ type, diff }) {
  if (type === "Direct Added") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">Direct PO</span>;
  }
  if (type === "Modified") {
    const formattedDiff = diff > 0 ? `+${diff}` : `${diff}`;
    return (
      <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-200 inline-flex items-center gap-1">
        Modified <span className="font-mono text-[9px] opacity-90">({formattedDiff})</span>
      </span>
    );
  }
  if (type === "On Hold") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">On Hold</span>;
  }
  if (type === "PO Generated") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-violet-50 text-violet-700 border-violet-200">Generated</span>;
  }
  return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Pending</span>;
}

function TraderStatusBadge({ status }) {
  if (status === "Accepted") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">Accepted</span>;
  }
  if (status === "Rejected") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-red-50 text-red-700 border-red-200">Rejected</span>;
  }
  return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Pending</span>;
}

function TransporterStatusBadge({ status, isSkipped }) {
  if (isSkipped || status === "Skipped (Direct)") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-300">Skipped (Direct)</span>;
  }
  if (status === "In Transit" || status === "Accepted") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-sky-50 text-sky-700 border-sky-200">In Transit</span>;
  }
  if (status === "Rejected") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-red-50 text-red-700 border-red-200">Rejected</span>;
  }
  return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Pending</span>;
}

function ReceiverStatusBadge({ status, variance }) {
  if (status === "Shortage") {
    return (
      <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-rose-50 text-rose-700 border-rose-200 inline-flex items-center gap-1">
        Shortage <span className="font-mono text-[9px] opacity-90">({variance})</span>
      </span>
    );
  }
  if (status === "Excess") {
    return (
      <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-purple-50 text-purple-700 border-purple-200 inline-flex items-center gap-1">
        Excess <span className="font-mono text-[9px] opacity-90">(+{variance})</span>
      </span>
    );
  }
  if (status === "Match") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">Match (100%)</span>;
  }
  if (status === "Received") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">Received</span>;
  }
  if (status === "Rejected") {
    return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-red-50 text-red-700 border-red-200">Rejected</span>;
  }
  return <span className="px-2 py-0.5 !rounded-full border text-[10px] font-bold bg-slate-100 text-slate-500 border-slate-200">Pending</span>;
}
