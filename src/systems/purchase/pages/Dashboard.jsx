import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useShopStore from "../store/useShopStore";
import useCompanyStore from "../store/useCompanyStore";
import { supabase } from "../lib/supabase";
import {
  Search,
  Building2,
  Calendar,
  RefreshCw,
  Download,
  XCircle,
  Check,
  User,
  Layers,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  PackageCheck,
  FileEdit,
  AlertCircle
} from "lucide-react";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { selectedShop: globalShop, setSelectedShop, shops: storeShops, fetchShops } = useShopStore();
  const { companies, fetchCompanies } = useCompanyStore();

  // Load store data on mount
  useEffect(() => {
    if (fetchShops) fetchShops();
    if (fetchCompanies) fetchCompanies();
  }, [fetchShops, fetchCompanies]);

  // Filter States with persistent localStorage memory
  const [filterShop, setFilterShop] = useState(() => {
    return localStorage.getItem("purchase_dashboard_filter_shop") || globalShop || "All";
  });
  const [filterCompany, setFilterCompany] = useState(() => {
    return localStorage.getItem("purchase_dashboard_filter_company") || "All";
  });
  const [filterParty, setFilterParty] = useState(() => {
    return localStorage.getItem("purchase_dashboard_filter_party") || "All";
  });
  const [filterStatus, setFilterStatus] = useState(() => {
    return localStorage.getItem("purchase_dashboard_filter_status") || "All";
  });
  const [filterTimeframe, setFilterTimeframe] = useState(() => {
    return localStorage.getItem("purchase_dashboard_filter_timeframe") || "all";
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    return localStorage.getItem("purchase_dashboard_search_query") || "";
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Filter Handlers with automatic persistence
  const handleShopChange = (shop) => {
    setFilterShop(shop);
    localStorage.setItem("purchase_dashboard_filter_shop", shop);
    if (setSelectedShop) setSelectedShop(shop);
    setCurrentPage(1);
  };

  const handleCompanyChange = (company) => {
    setFilterCompany(company);
    localStorage.setItem("purchase_dashboard_filter_company", company);
    setCurrentPage(1);
  };

  const handlePartyChange = (party) => {
    setFilterParty(party);
    localStorage.setItem("purchase_dashboard_filter_party", party);
    setCurrentPage(1);
  };

  const handleStatusChange = (status) => {
    setFilterStatus(status);
    localStorage.setItem("purchase_dashboard_filter_status", status);
    setCurrentPage(1);
  };

  const handleTimeframeChange = (timeframe) => {
    setFilterTimeframe(timeframe);
    localStorage.setItem("purchase_dashboard_filter_timeframe", timeframe);
    setCurrentPage(1);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    localStorage.setItem("purchase_dashboard_search_query", query);
    setCurrentPage(1);
  };

  // Sync with global sidebar shop if user explicitly changes shop in sidebar
  useEffect(() => {
    if (globalShop && globalShop !== filterShop) {
      setFilterShop(globalShop);
      localStorage.setItem("purchase_dashboard_filter_shop", globalShop);
      setCurrentPage(1);
    }
  }, [globalShop]);

  // Fetch audit records from purchase_dashboard
  const {
    data: dashboardLogs = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ["purchaseDashboardLogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_dashboard")
        .select("*")
        .order("indent_created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;
      const logs = data || [];

      // Fetch live statuses from purchase_purchase_orders for any active POs
      const poIds = Array.from(new Set(logs.map(r => r.po_id).filter(Boolean)));
      if (poIds.length > 0) {
        try {
          const { data: pos } = await supabase
            .from("purchase_purchase_orders")
            .select("id, trader_status, transporter_status, receiver_status")
            .in("id", poIds);

          if (pos && pos.length > 0) {
            const poMap = new Map();
            pos.forEach(p => poMap.set(p.id, p));
            return logs.map(r => {
              if (r.po_id && poMap.has(r.po_id)) {
                const live = poMap.get(r.po_id);
                return {
                  ...r,
                  trader_status: live.trader_status || r.trader_status || "Pending",
                  transporter_status: live.transporter_status || r.transporter_status || "Pending",
                  receiver_status: live.receiver_status || r.receiver_status || "Pending"
                };
              }
              return r;
            });
          }
        } catch (poErr) {
          console.error("Failed to merge live PO statuses:", poErr);
        }
      }
      return logs;
    },
    staleTime: 10000
  });

  // Extract Unique Shops for dropdown
  const availableShops = useMemo(() => {
    const set = new Set(["All"]);
    (storeShops || []).forEach(s => set.add(s));
    dashboardLogs.forEach(row => {
      if (row.shop_name) set.add(row.shop_name);
    });
    return Array.from(set);
  }, [dashboardLogs, storeShops]);

  // Extract Unique Companies for dropdown
  const availableCompanies = useMemo(() => {
    const set = new Set(["All"]);
    (companies || []).forEach(c => {
      if (c.name) set.add(c.name);
    });
    dashboardLogs.forEach(row => {
      if (row.company_name) set.add(row.company_name);
    });
    return Array.from(set);
  }, [dashboardLogs, companies]);

  // Extract Unique Parties for dropdown
  const availableParties = useMemo(() => {
    const set = new Set(["All"]);
    dashboardLogs.forEach(row => {
      if (row.party_name) set.add(row.party_name);
    });
    return Array.from(set);
  }, [dashboardLogs]);

  // Filtered dataset
  const filteredData = useMemo(() => {
    let result = [...dashboardLogs];

    // Rule: Indents or items deleted before PO generation must be completely removed from dashboard
    result = result.filter(row => !(row.is_deleted && !row.po_id));

    // 1. Shop Filter
    if (filterShop && filterShop !== "All") {
      result = result.filter(
        row => (row.shop_name || "").toLowerCase() === filterShop.toLowerCase()
      );
    }

    // 2. Company Filter
    if (filterCompany && filterCompany !== "All") {
      if (filterCompany === "__NONE__") {
        result = result.filter(row => !(row.company_name || "").trim());
      } else {
        result = result.filter(
          row => (row.company_name || "").trim().toLowerCase() === filterCompany.trim().toLowerCase()
        );
      }
    }

    // 3. Party Filter
    if (filterParty && filterParty !== "All") {
      result = result.filter(
        row => (row.party_name || "").toLowerCase() === filterParty.toLowerCase()
      );
    }

    // 4. Status Filter
    if (filterStatus !== "All") {
      if (filterStatus === "Completed") {
        result = result.filter(r => !r.is_deleted && r.po_qty > 0 && r.po_number);
      } else if (filterStatus === "Modified") {
        result = result.filter(
          r =>
            (r.approver_action && r.approver_action.includes("Modified")) ||
            (r.po_action && r.po_action.includes("Modified"))
        );
      } else if (filterStatus === "DroppedPO") {
        result = result.filter(
          r =>
            r.po_action &&
            (r.po_action.includes("Deleted") || r.po_action.includes("Removed"))
        );
      } else if (filterStatus === "RejectedApproval") {
        result = result.filter(
          r =>
            r.approver_action &&
            (r.approver_action.includes("Reject") || r.approver_action.includes("Deleted"))
        );
      } else if (filterStatus === "DeletedIndent") {
        result = result.filter(r => r.is_deleted);
      }
    }

    // 5. Timeframe Filter
    if (filterTimeframe !== "all") {
      const now = new Date();
      result = result.filter(row => {
        if (!row.indent_created_at) return true;
        const rowDate = new Date(row.indent_created_at);
        const diffDays = (now - rowDate) / (1000 * 60 * 60 * 24);
        if (filterTimeframe === "today") return diffDays <= 1;
        if (filterTimeframe === "7days") return diffDays <= 7;
        if (filterTimeframe === "30days") return diffDays <= 30;
        return true;
      });
    }

    // 6. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        row =>
          (row.item_name && row.item_name.toLowerCase().includes(q)) ||
          (row.indent_id && row.indent_id.toLowerCase().includes(q)) ||
          (row.po_number && row.po_number.toLowerCase().includes(q)) ||
          (row.party_name && row.party_name.toLowerCase().includes(q)) ||
          (row.company_name && row.company_name.toLowerCase().includes(q)) ||
          (row.shop_name && row.shop_name.toLowerCase().includes(q)) ||
          (row.indent_emp_code && row.indent_emp_code.toLowerCase().includes(q)) ||
          (row.approver_emp_code && row.approver_emp_code.toLowerCase().includes(q)) ||
          (row.po_emp_code && row.po_emp_code.toLowerCase().includes(q)) ||
          (row.deleted_by_emp_code && row.deleted_by_emp_code.toLowerCase().includes(q))
      );
    }

    return result;
  }, [dashboardLogs, filterShop, filterCompany, filterParty, filterStatus, filterTimeframe, searchQuery]);

  // High-level KPI metrics computed on the active shop/company/party filtered view
  const metrics = useMemo(() => {
    let total = filteredData.length;
    let completed = 0;
    let modified = 0;
    let rejected = 0;

    filteredData.forEach(r => {
      if (!r.is_deleted && r.po_qty > 0 && r.po_number) {
        completed++;
      }
      if (
        (r.approver_action && r.approver_action.includes("Modified")) ||
        (r.po_action && r.po_action.includes("Modified"))
      ) {
        modified++;
      }
      if (
        r.is_deleted ||
        (r.po_action && (r.po_action.includes("Deleted") || r.po_action.includes("Removed"))) ||
        (r.approver_action && (r.approver_action.includes("Reject") || r.approver_action.includes("Deleted")))
      ) {
        rejected++;
      }
    });

    return { total, completed, modified, rejected };
  }, [filteredData]);

  // Paginated records
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Export to CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) {
      alert("No data to export!");
      return;
    }

    const headers = [
      "Indent ID",
      "Shop Name",
      "Company Name",
      "Party Name",
      "Item Name",
      "Order Generated",
      "Order Box",
      "Order Qty",
      "Indent By",
      "Approval",
      "Approved Box",
      "Approved Qty",
      "Approver Action",
      "Approver By",
      "PO",
      "PO Number",
      "PO Box",
      "PO Qty",
      "PO Action",
      "PO By",
      "Vendor Status",
      "Transporter Status",
      "Receiver Status"
    ];

    const rows = filteredData.map(r => [
      `"${r.indent_id || ""}"`,
      `"${r.shop_name || ""}"`,
      `"${r.company_name || ""}"`,
      `"${r.party_name || ""}"`,
      `"${r.item_name || ""}"`,
      (r.order_box != null || r.order_qty != null) ? `"${r.item_name || ""}"` : '""',
      r.order_box != null ? r.order_box : "",
      r.order_qty != null ? r.order_qty : "",
      `"${r.indent_emp_code || ""}"`,
      r.approver_action === "delete" ? '"delete"' : (r.approved_box != null ? `"${r.item_name || ""}"` : '""'),
      r.approved_box != null ? r.approved_box : "",
      r.approved_qty != null ? r.approved_qty : "",
      `"${r.approver_action || ""}"`,
      `"${r.approver_emp_code || ""}"`,
      r.po_action === "delete" ? '"delete"' : (r.po_number ? `"${r.item_name || ""}"` : '""'),
      `"${r.po_number || ""}"`,
      r.po_box != null ? r.po_box : "",
      r.po_qty != null ? r.po_qty : "",
      `"${r.po_action || ""}"`,
      `"${r.po_emp_code || ""}"`,
      `"${r.trader_status || "Pending"}"`,
      `"${r.transporter_status || "Pending"}"`,
      `"${r.receiver_status || "Pending"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Purchase_Dashboard_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper renderers for 3 core lifecycle stages (Order Generated, Approval, PO)
  const renderOrderGeneratedCell = (row) => {
    const isExtraAdded = (row.approver_action || "").toLowerCase().includes("extra add");
    const isDirectPo = (row.po_action || "").toLowerCase().includes("direct add");
    const isIndentDeleted = row.is_deleted && row.deletion_stage === "indent";

    if (isIndentDeleted) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300 shadow-xs">
          <XCircle size={11} /> delete
        </span>
      );
    }

    if (isExtraAdded || isDirectPo || (row.order_box == null && row.order_qty == null)) {
      return <span className="text-slate-300 font-medium select-none">—</span>;
    }

    return (
      <div>
        <div className="font-semibold text-slate-800">{row.item_name}</div>
        <div className="text-[10px] text-slate-400">
          {row.order_box != null ? `${parseFloat(row.order_box).toFixed(2)} Bx` : ""}
          {row.order_box != null && row.order_qty != null ? " • " : ""}
          {row.order_qty != null ? `${Math.round(row.order_qty)} units` : ""}
          {row.indent_emp_code ? ` (${row.indent_emp_code})` : ""}
        </div>
      </div>
    );
  };

  const renderApprovalCell = (row) => {
    const appAction = (row.approver_action || "").trim();
    const lower = appAction.toLowerCase();

    if (lower === "delete" || lower.includes("reject") || (row.is_deleted && row.deletion_stage === "approval")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300 shadow-xs">
          <XCircle size={11} /> delete
        </span>
      );
    }

    if (lower.includes("extra add") || appAction === "Extra add by approver") {
      return (
        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
            Extra add by approver
          </span>
          {row.approved_box != null && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              {parseFloat(row.approved_box).toFixed(2)} Bx • {Math.round(row.approved_qty)} units
              {row.approver_emp_code ? ` (${row.approver_emp_code})` : ""}
            </div>
          )}
        </div>
      );
    }

    if (row.approved_box != null || row.approved_qty != null || lower.includes("approved")) {
      return (
        <div>
          <div className="font-semibold text-emerald-800">{row.item_name}</div>
          <div className="text-[10px] text-slate-400">
            {row.approved_box != null ? `${parseFloat(row.approved_box).toFixed(2)} Bx` : ""}
            {row.approved_box != null && row.approved_qty != null ? " • " : ""}
            {row.approved_qty != null ? `${Math.round(row.approved_qty)} units` : ""}
            {row.approver_emp_code ? ` (${row.approver_emp_code})` : ""}
          </div>
        </div>
      );
    }

    return <span className="text-slate-300 font-medium select-none">—</span>;
  };

  const renderPoCell = (row) => {
    const poAction = (row.po_action || "").trim();
    const lower = poAction.toLowerCase();

    if (lower === "delete" || lower.includes("delete") || lower.includes("removed") || (row.is_deleted && row.deletion_stage === "po")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-300 shadow-xs">
          <XCircle size={11} /> delete
        </span>
      );
    }

    if (lower.includes("direct add") || poAction === "Direct Added in PO") {
      return (
        <div>
          <div className="font-semibold text-indigo-900">{row.item_name}</div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-0.5 shadow-xs">
            Direct Added in PO
          </span>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {row.po_number ? `${row.po_number} • ` : ""}
            {row.po_box != null ? `${parseFloat(row.po_box).toFixed(2)} Bx` : ""}
            {row.po_qty != null ? ` • ${Math.round(row.po_qty)} units` : ""}
          </div>
        </div>
      );
    }

    if (row.po_id || row.po_number || (row.po_box != null && row.po_box > 0)) {
      return (
        <div>
          <div className="font-semibold text-indigo-900">{row.item_name}</div>
          <div className="text-[10px] text-slate-400">
            {row.po_number ? <span className="font-bold text-slate-600">{row.po_number} • </span> : null}
            {row.po_box != null ? `${parseFloat(row.po_box).toFixed(2)} Bx` : ""}
            {row.po_box != null && row.po_qty != null ? " • " : ""}
            {row.po_qty != null ? `${Math.round(row.po_qty)} units` : ""}
          </div>
        </div>
      );
    }

    return <span className="text-slate-300 font-medium select-none">—</span>;
  };

  // Modern Action Badge Styler
  const renderActionBadge = (actionText) => {
    if (!actionText || actionText === "—") {
      return <span className="text-slate-300 font-medium select-none">—</span>;
    }
    const lower = actionText.toLowerCase();

    if (lower.includes("reject") || lower.includes("deleted") || lower === "delete") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
          {actionText}
        </span>
      );
    }
    if (lower.includes("modified") || lower.includes("added")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          {actionText}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        {actionText}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <RefreshCw className="animate-spin text-indigo-600" size={36} />
        <p className="font-semibold text-sm">Loading Purchase Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1750px] mx-auto px-3 sm:px-4 md:px-6 py-4 font-sans space-y-4">
      
      {/* ── Metric Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div 
          onClick={() => handleStatusChange("All")}
          className={`p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-xs hover:border-indigo-300 ${
            filterStatus === "All" ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Items</span>
            <Layers size={15} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Matching active filters</div>
        </div>

        <div 
          onClick={() => handleStatusChange(filterStatus === "Completed" ? "All" : "Completed")}
          className={`p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-xs hover:border-emerald-300 ${
            filterStatus === "Completed" ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>PO Completed</span>
            <PackageCheck size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.completed}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active & ordered in PO</div>
        </div>

        <div 
          onClick={() => handleStatusChange(filterStatus === "Modified" ? "All" : "Modified")}
          className={`p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-xs hover:border-amber-300 ${
            filterStatus === "Modified" ? "border-amber-500 ring-2 ring-amber-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Modified Qty</span>
            <FileEdit size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.modified}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Quantities updated</div>
        </div>

        <div 
          onClick={() => handleStatusChange(filterStatus === "RejectedApproval" ? "All" : "RejectedApproval")}
          className={`p-3.5 bg-white rounded-xl border transition-all cursor-pointer shadow-xs hover:border-rose-300 ${
            filterStatus === "RejectedApproval" ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Rejected / Dropped</span>
            <AlertCircle size={15} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{metrics.rejected}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rejected, dropped or deleted</div>
        </div>
      </div>

      {/* ── Sleek Compact Control Bar ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Quick Search */}
        <div className="flex-1 min-w-64 max-w-md relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search items, indent, PO#, party, company, employee..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium"
          />
        </div>

        {/* Middle: Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shop */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Building2 size={13} className="text-slate-400" />
            <select
              value={filterShop}
              onChange={(e) => handleShopChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              {availableShops.map(s => (
                <option key={s} value={s}>{s === "All" ? "All Shops" : s}</option>
              ))}
            </select>
          </div>

          {/* Company */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 max-w-44">
            <Briefcase size={13} className="text-slate-400" />
            <select
              value={filterCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer truncate w-full"
            >
              <option value="All">All Companies</option>
              {availableCompanies.filter(c => c !== "All").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="__NONE__">Unassigned Company</option>
            </select>
          </div>

          {/* Party */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 max-w-44">
            <select
              value={filterParty}
              onChange={(e) => handlePartyChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer truncate w-full"
            >
              {availableParties.map(p => (
                <option key={p} value={p}>{p === "All" ? "All Parties" : p}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <select
              value={filterStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All Stages</option>
              <option value="Completed">PO Completed</option>
              <option value="Modified">Quantity Modified</option>
              <option value="DroppedPO">Dropped in PO</option>
              <option value="RejectedApproval">Rejected</option>
              <option value="DeletedIndent">Deleted</option>
            </select>
          </div>

          {/* Timeframe */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
            <Calendar size={13} className="text-slate-400" />
            <select
              value={filterTimeframe}
              onChange={(e) => handleTimeframeChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">7 Days</option>
              <option value="30days">30 Days</option>
            </select>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 rounded-md">
            {filteredData.length} records
          </span>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            title="Download CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className={`p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer ${
              isRefetching ? "animate-spin" : ""
            }`}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Master Reconciliation Data Table ──────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 border-collapse">
            <thead className="bg-slate-50/90 backdrop-blur-xs text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">Indent ID</th>
                <th className="py-2.5 px-3">Shop</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3">Party Name</th>
                <th className="py-2.5 px-3 font-extrabold text-slate-800">Item Name</th>
                <th className="py-2.5 px-3 bg-blue-50/50">Order Generated</th>
                <th className="py-2.5 px-3 bg-emerald-50/50">Approval</th>
                <th className="py-2.5 px-3 bg-indigo-50/50">PO</th>
                <th className="py-2.5 px-2.5 text-center">Vendor</th>
                <th className="py-2.5 px-2.5 text-center">Transporter</th>
                <th className="py-2.5 px-2.5 text-center">Receiver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-400 font-medium">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Indent ID */}
                      <td className="py-2.5 px-3 font-bold text-indigo-900 whitespace-nowrap">
                        {row.indent_id}
                      </td>

                      {/* Shop */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-700">
                        {row.shop_name || "—"}
                      </td>

                      {/* Company */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-600">
                        {row.company_name ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                            {row.company_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>

                      {/* Party */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-800">
                        {row.party_name || "—"}
                      </td>

                      {/* 1. Item Name */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 min-w-50">
                        {row.item_name}
                      </td>

                      {/* 2. Order Generated */}
                      <td className="py-2.5 px-3 bg-blue-50/20 whitespace-nowrap min-w-44">
                        {renderOrderGeneratedCell(row)}
                      </td>

                      {/* 3. Approval */}
                      <td className="py-2.5 px-3 bg-emerald-50/20 whitespace-nowrap min-w-44">
                        {renderApprovalCell(row)}
                      </td>

                      {/* 4. PO */}
                      <td className="py-2.5 px-3 bg-indigo-50/20 whitespace-nowrap min-w-44">
                        {renderPoCell(row)}
                      </td>

                      {/* Vendor (Trader) */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.trader_status === "yes" || row.trader_status === "Verified"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.trader_status === "no"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.trader_status === "yes" || row.trader_status === "Verified"
                            ? "✓ Verified"
                            : row.trader_status === "no"
                            ? "✗ Rejected"
                            : (row.trader_status || "Pending")}
                        </span>
                      </td>

                      {/* Transporter */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.transporter_status === "yes" || row.transporter_status === "Dispatched"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.transporter_status === "no"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.transporter_status === "yes" || row.transporter_status === "Dispatched"
                            ? "✓ Dispatched"
                            : row.transporter_status === "no"
                            ? "✗ Rejected"
                            : (row.transporter_status || "Pending")}
                        </span>
                      </td>

                      {/* Receiver */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.receiver_status === "yes" || row.receiver_status === "Received"
                              ? "bg-emerald-100 text-emerald-800"
                              : row.receiver_status === "no"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.receiver_status === "yes" || row.receiver_status === "Received"
                            ? "✓ Received"
                            : row.receiver_status === "no"
                            ? "✗ Rejected"
                            : (row.receiver_status || "Pending")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Compact Pagination Bar ────────────────────────────── */}
        {totalPages > 1 && (
          <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold">{(currentPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold">{Math.min(currentPage * pageSize, filteredData.length)}</span> of{" "}
              <span className="font-semibold">{filteredData.length}</span> entries
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 bg-white rounded-md disabled:opacity-40 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} />
              </button>

              <span className="font-semibold px-2">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 bg-white rounded-md disabled:opacity-40 hover:bg-slate-100 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
