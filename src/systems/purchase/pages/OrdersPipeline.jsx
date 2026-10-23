import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { fetchPipelineOrders, fetchPipelineStats } from "../services/ordersPipelineService";
import useShopStore from "../store/useShopStore";
import useCompanyStore from "../store/useCompanyStore";
import { isTransporterSkippedForOrder } from "../utils/poHelpers";
import Toast, { useToast } from "../components/Toast";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import {
  Search,
  RefreshCw,
  GitFork,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Truck,
  Inbox,
  Package,
  Layers,
  X,
  TrendingDown,
  TrendingUp,
  Check,
  Eye,
  Download,
  Building2,
  Store,
  User,
  UserCheck,
  Calendar,
  ArrowUpDown,
  Filter,
  Copy,
  CheckCheck,
  ExternalLink,
} from "lucide-react";

const OrdersPipeline = () => {
  const { selectedShop, assignedShops, isShopAdmin } = useShopStore();
  const { companies, fetchCompanies } = useCompanyStore();

  useEffect(() => {
    if (!companies || companies.length === 0) {
      fetchCompanies();
    }
  }, [companies, fetchCompanies]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date-desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [expandedOrders, setExpandedOrders] = useState({});
  const [selectedPO, setSelectedPO] = useState(null); // For detail inspector drawer
  const [copiedPoId, setCopiedPoId] = useState(null);

  const { toasts, addToast, removeToast } = useToast();

  const LIMIT = 15;

  // ── Supabase Realtime: auto-invalidate cache on DB changes ──
  useRealtimeSync();

  // Debounce Search input to prevent lag while typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 1. Fetch lightweight stats data for KPIs
  const {
    data: statsData = [],
    isLoading: isLoadingStats,
    isRefetching: isRefetchingStats,
    refetch: refetchStats,
    error: statsError,
  } = useQuery({
    queryKey: [
      "pipelineStats",
      selectedShop,
      isShopAdmin,
      (assignedShops || []).join(","),
      startDate,
      endDate,
    ],
    queryFn: () =>
      fetchPipelineStats({
        shop: selectedShop,
        assignedShops,
        isShopAdmin,
        startDate,
        endDate,
      }),
    staleTime: Infinity,
  });

  // 2. Fetch paginated POs with infinite query
  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isRefetching: isRefetchingOrders,
    refetch: refetchOrders,
    error: ordersError,
  } = useInfiniteQuery({
    queryKey: [
      "pipelineOrders",
      selectedShop,
      isShopAdmin,
      (assignedShops || []).join(","),
      statusFilter,
      debouncedSearch,
      sortBy,
      startDate,
      endDate,
    ],
    queryFn: ({ pageParam = 0 }) =>
      fetchPipelineOrders({
        limit: LIMIT,
        offset: pageParam,
        shop: selectedShop,
        assignedShops,
        isShopAdmin,
        status: statusFilter,
        search: debouncedSearch,
        sortBy: sortBy,
        startDate,
        endDate,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === LIMIT ? allPages.length * LIMIT : undefined;
    },
    staleTime: Infinity,
  });

  // Extract flat list of orders
  const orders = useMemo(() => {
    let list = ordersData?.pages.flatMap((page) => page) || [];
    if (!isShopAdmin) {
      if (!assignedShops || assignedShops.length === 0) return [];
      list = list.filter(
        (po) =>
          po.shop_name &&
          assignedShops.some(
            (as) => as.toLowerCase() === po.shop_name.toLowerCase(),
          ),
      );
    }
    return list;
  }, [ordersData, isShopAdmin, assignedShops]);

  // Derived loading and refresh states
  const isLoading = isLoadingStats || isLoadingOrders;
  const isRefreshing = isRefetchingStats || isRefetchingOrders;

  // Error notifications
  useEffect(() => {
    if (statsError) {
      console.error("Error loading stats:", statsError);
      addToast("Failed to retrieve operational stats.", "error");
    }
  }, [statsError]);

  useEffect(() => {
    if (ordersError) {
      console.error("Error loading orders:", ordersError);
      addToast("Failed to retrieve orders pipeline data.", "error");
    }
  }, [ordersError]);

  const [isExporting, setIsExporting] = useState(false);

  // Manual refresh handler
  const handleRefresh = () => {
    refetchStats();
    refetchOrders();
  };

  // Bulk Export handler to export report to CSV
  const handleBulkExport = async () => {
    try {
      setIsExporting(true);

      const allOrders = await fetchPipelineOrders({
        limit: 10000,
        offset: 0,
        shop: selectedShop,
        assignedShops,
        isShopAdmin,
        status: statusFilter,
        search: debouncedSearch,
        sortBy: sortBy,
        startDate,
        endDate,
      });

      if (!allOrders || allOrders.length === 0) {
        addToast("No orders available to export.", "info");
        setIsExporting(false);
        return;
      }

      const headers = [
        "Shop Name",
        "PO No",
        "Trader Name",
        "Company Filter",
        "Order Qty",
        "Trader decision",
        "Pickup qty",
        "Transporter name",
        "Received Qty",
        "Receiver name",
      ];

      const csvRows = [];
      csvRows.push(headers.join(","));

      allOrders.forEach((po) => {
        const items = getPOItemsData(po);

        let totalOrderQty = po.total_order_qty || 0;
        let totalPickupQty = 0;
        let totalReceivedQty = 0;

        if (items.length > 0) {
          totalOrderQty = items.reduce((sum, item) => sum + (item.orderQty || 0), 0);
          totalPickupQty = items.reduce((sum, item) => sum + (item.transporterQty || 0), 0);
          totalReceivedQty = items.reduce((sum, item) => sum + (item.receiverQty || 0), 0);
        } else {
          totalPickupQty = po.transporter_status === "yes" ? totalOrderQty : 0;
          totalReceivedQty = po.receiver_status === "yes" ? totalOrderQty : 0;
        }

        let traderDecision = "Pending";
        if (po.trader_status === "yes") {
          const hasRejectedItem = items.some((i) => i.traderDecision === "Rejected");
          traderDecision = hasRejectedItem ? "Partially Accepted" : "Accepted";
        } else if (po.trader_status === "no") {
          traderDecision = "Rejected";
        }

        const shopName = `"${(po.shop_name || "Unknown").replace(/"/g, '""')}"`;
        const poNo = `"${(po.po_number || "").replace(/"/g, '""')}"`;
        const traderName = `"${(getCleanVendorName(po) || "—").replace(/"/g, '""')}"`;
        const companyName = `"${(getEffectiveCompanyName(po) || "—").replace(/"/g, '""')}"`;
        const orderQty = totalOrderQty;
        const decision = `"${traderDecision.replace(/"/g, '""')}"`;
        const pickupQty = totalPickupQty;
        const transporterName = `"${(po.transporter_name || "—").replace(/"/g, '""')}"`;
        const receivedQty = totalReceivedQty;
        const receiverName = `"${(po.receiver_name || "—").replace(/"/g, '""')}"`;

        csvRows.push([
          shopName,
          poNo,
          traderName,
          companyName,
          orderQty,
          decision,
          pickupQty,
          transporterName,
          receivedQty,
          receiverName,
        ].join(","));
      });

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("download", `Orders_Pipeline_Report_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast("Pipeline report exported successfully.", "success");
    } catch (err) {
      console.error("Error exporting report:", err);
      addToast("Failed to generate export report: " + err.message, "error");
    } finally {
      setIsExporting(false);
    }
  };

  // On Scroll Listener for Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop >=
        document.documentElement.offsetHeight - 150
      ) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleExpand = (id) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPoNumber = (e, poNumber, poId) => {
    e.stopPropagation();
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(poNumber);
      setCopiedPoId(poId);
      setTimeout(() => setCopiedPoId(null), 1800);
      addToast(`PO #${poNumber} copied to clipboard`, "info");
    }
  };

  // Helper: Format Date
  const formatDate = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Helper: Format Date & Time
  const formatDateTime = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // 1. Resolve Overall PO Status
  const getPOStatusText = (po) => {
    if (po.receiver_status === "yes") return "Completed";
    if (po.receiver_status === "no") return "Delivery Rejected";
    if (po.transporter_status === "yes") return "In Transit";
    if (po.transporter_status === "no") return "Pickup Rejected";
    if (po.trader_status === "yes") {
      let traderDecisions = po.trader_item_statuses || {};
      if (typeof traderDecisions === "string") {
        try {
          traderDecisions = JSON.parse(traderDecisions);
        } catch {
          traderDecisions = {};
        }
      }
      const values = Object.values(traderDecisions);
      if (values.includes("rejected")) {
        return "Partially Accepted";
      }
      return "Vendor Confirmed";
    }
    if (po.trader_status === "no") return "Vendor Rejected";
    return "Awaiting Supplier";
  };

  const getPOStatusColorClass = (statusText) => {
    switch (statusText) {
      case "Completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "In Transit":
        return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "Vendor Confirmed":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "Partially Accepted":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "Delivery Rejected":
      case "Pickup Rejected":
      case "Vendor Rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const getPOStatusBorderAccent = (statusText) => {
    switch (statusText) {
      case "Completed":
        return "border-l-emerald-500";
      case "In Transit":
        return "border-l-indigo-500";
      case "Vendor Confirmed":
        return "border-l-blue-500";
      case "Partially Accepted":
        return "border-l-purple-500";
      case "Delivery Rejected":
      case "Pickup Rejected":
      case "Vendor Rejected":
        return "border-l-rose-500";
      default:
        return "border-l-amber-500";
    }
  };

  // Company Scope is strictly the scope selected at creation, NOT the brand catalog manufacturer
  const getEffectiveCompanyName = (po) => {
    if (!po) return "";
    const scope = po.company_scope || po.filtered_company_name;
    if (scope && scope.trim()) {
      return scope.trim();
    }
    if (po.vendor_name && po.vendor_name.includes("::")) {
      const parts = po.vendor_name.split("::");
      return parts[1]?.trim() || "";
    }
    return "";
  };

  const getCleanVendorName = (po) => {
    if (!po || !po.vendor_name) return "—";
    if (po.vendor_name.includes("::")) {
      return po.vendor_name.split("::")[0].trim();
    }
    return po.vendor_name.trim();
  };

  // 2. Resolve Stakeholder Status details
  const getTraderStatusDetails = (po) => {
    if (po.trader_status === "yes") {
      let traderDecisions = po.trader_item_statuses || {};
      if (typeof traderDecisions === "string") {
        try {
          traderDecisions = JSON.parse(traderDecisions);
        } catch {
          traderDecisions = {};
        }
      }
      const values = Object.values(traderDecisions);
      if (values.includes("rejected")) {
        return {
          status: "Partially Accepted",
          color: "border-purple-500 bg-purple-50 text-purple-600",
          icon: <AlertCircle size={15} />,
        };
      }
      return {
        status: "Accepted",
        color: "border-emerald-500 bg-emerald-50 text-emerald-600",
        icon: <CheckCircle2 size={15} />,
      };
    }
    if (po.trader_status === "no") {
      return {
        status: "Rejected",
        color: "border-rose-500 bg-rose-50 text-rose-600",
        icon: <XCircle size={15} />,
      };
    }
    return {
      status: "Pending",
      color: "border-amber-500 bg-amber-50 text-amber-600 animate-pulse",
      icon: <Clock size={15} />,
    };
  };

  const getTransporterStatusDetails = (po) => {
    if (po.trader_status === "no") {
      return {
        status: "N/A",
        color: "border-slate-200 bg-slate-50 text-slate-400",
        icon: <AlertCircle size={15} />,
      };
    }
    if (isTransporterSkippedForOrder(po, companies)) {
      return {
        status: "Bypassed (Direct)",
        color: "border-blue-400 bg-blue-50 text-blue-600",
        icon: <CheckCircle2 size={15} />,
      };
    }
    if (po.transporter_status === "yes") {
      return {
        status: "Accepted",
        color: "border-emerald-500 bg-emerald-50 text-emerald-600",
        icon: <CheckCircle2 size={15} />,
      };
    }
    if (po.transporter_status === "no") {
      return {
        status: "Rejected",
        color: "border-rose-500 bg-rose-50 text-rose-600",
        icon: <XCircle size={15} />,
      };
    }
    return {
      status: "Pending",
      color: "border-amber-500 bg-amber-50 text-amber-600 animate-pulse",
      icon: <Clock size={15} />,
    };
  };

  const getReceiverStatusDetails = (po) => {
    if (po.trader_status === "no" || po.transporter_status === "no") {
      return {
        status: "N/A",
        color: "border-slate-200 bg-slate-50 text-slate-400",
        icon: <AlertCircle size={15} />,
      };
    }
    if (po.receiver_status === "yes") {
      return {
        status: "Accepted",
        color: "border-emerald-500 bg-emerald-50 text-emerald-600",
        icon: <CheckCircle2 size={15} />,
      };
    }
    if (po.receiver_status === "no") {
      return {
        status: "Rejected",
        color: "border-rose-500 bg-rose-50 text-rose-600",
        icon: <XCircle size={15} />,
      };
    }
    return {
      status: "Pending",
      color: "border-amber-500 bg-amber-50 text-amber-600 animate-pulse",
      icon: <Clock size={15} />,
    };
  };

  // Helper: Get structured list of items with decisions from trader, transporter, receiver
  const getPOItemsData = (po) => {
    const rawItems = po.po_items || [];
    let traderDecisions = po.trader_item_statuses || {};
    if (typeof traderDecisions === "string") {
      try {
        traderDecisions = JSON.parse(traderDecisions);
      } catch {
        traderDecisions = {};
      }
    }

    let transporterDelivered = po.delivered_items || {};
    if (typeof transporterDelivered === "string") {
      try {
        transporterDelivered = JSON.parse(transporterDelivered);
      } catch {
        transporterDelivered = {};
      }
    }

    let receiverReceived = po.received_items || {};
    if (typeof receiverReceived === "string") {
      try {
        receiverReceived = JSON.parse(receiverReceived);
      } catch {
        receiverReceived = {};
      }
    }

    return rawItems.map((item) => {
      const orderBox = item.orderBox !== undefined ? parseFloat(item.orderBox) : parseFloat(item.order_box || 0);
      const orderQty = item.orderQty !== undefined ? parseFloat(item.orderQty) : parseFloat(item.order_qty || 0);
      const qtyType = item.qtyType || (orderBox >= 0.9 ? "Box" : "Bottles");
      const displayQty = item.displayQty || (qtyType === "Box" ? Math.round(orderBox) : Math.ceil(orderQty));

      const traderDecision =
        traderDecisions[item.id] ||
        (po.trader_status === "yes" ? "approved" : po.trader_status === "no" ? "rejected" : "pending");

      let transporterDeliveredQty = transporterDelivered[item.id]?.deliveredQty;
      if (transporterDeliveredQty === undefined && po.transporter_status === "yes") {
        transporterDeliveredQty = displayQty;
      }

      let receiverReceivedQty = receiverReceived[item.id]?.receivedQty;
      if (receiverReceivedQty === undefined && po.receiver_status === "yes") {
        receiverReceivedQty = transporterDeliveredQty ?? displayQty;
      }

      return {
        id: item.id,
        itemName: item.itemName || item.item_name,
        brandName: item.brandName || item.brand_name,
        orderQty: displayQty,
        qtyType,
        traderDecision:
          traderDecision === "approved" ? "Accepted" : traderDecision === "rejected" ? "Rejected" : "Pending",
        transporterQty:
          traderDecision === "rejected" ? 0 : transporterDeliveredQty !== undefined ? transporterDeliveredQty : null,
        transporterStatus: po.transporter_status || "pending",
        receiverQty: traderDecision === "rejected" ? 0 : receiverReceivedQty !== undefined ? receiverReceivedQty : null,
        receiverStatus: po.receiver_status || "pending",
      };
    });
  };

  // Compute stats on client from lightweight statsData
  const stats = useMemo(() => {
    const total = statsData.length;
    const completed = statsData.filter((o) => o.receiver_status === "yes").length;
    const inTransit = statsData.filter((o) => o.transporter_status === "yes" && !o.receiver_status).length;
    const pendingSupplier = statsData.filter((o) => !o.trader_status).length;
    const issues = statsData.filter((o) => {
      if (o.trader_status === "no" || o.transporter_status === "no" || o.receiver_status === "no") return true;
      if (o.trader_status === "yes") {
        let traderDec = o.trader_item_statuses || {};
        if (typeof traderDec === "string") {
          try {
            traderDec = JSON.parse(traderDec);
          } catch {
            traderDec = {};
          }
        }
        return Object.values(traderDec).includes("rejected");
      }
      return false;
    }).length;

    return { total, completed, inTransit, pendingSupplier, issues };
  }, [statsData]);

  // Quick Filter status pills
  const statusPills = [
    {
      value: "All",
      label: "All Orders",
      count: stats.total,
      activeClass: "bg-indigo-600 text-white border-indigo-600 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-indigo-600",
    },
    {
      value: "Pending",
      label: "Awaiting Supplier",
      count: stats.pendingSupplier,
      activeClass: "bg-amber-600 text-white border-amber-600 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-600",
    },
    {
      value: "Transit",
      label: "In Transit",
      count: stats.inTransit,
      activeClass: "bg-blue-600 text-white border-blue-600 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-600",
    },
    {
      value: "Completed",
      label: "Completed",
      count: stats.completed,
      activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600",
    },
    {
      value: "Issues",
      label: "Discrepancy / Issues",
      count: stats.issues,
      activeClass: "bg-rose-600 text-white border-rose-600 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-600",
    },
  ];

  return (
    <div className="animate-fade-in min-h-screen bg-slate-50/70 pb-16 font-sans">
      {/* ── Page Header ───────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-6 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <GitFork size={12} className="text-indigo-600" />
                Operations Console
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                <Store size={12} className="text-slate-500" />
                {selectedShop === "All" ? "All Global Shops" : selectedShop}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              Orders Pipeline
            </h1>
            <p className="text-slate-500 text-xs md:text-sm max-w-2xl leading-relaxed">
              End-to-end operational visibility into Purchase Order lifecycles, supplier dispatch, transport pickups,
              and destination confirmations.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-stretch md:self-auto">
            <button
              onClick={handleBulkExport}
              disabled={isExporting || isLoading}
              className={`flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow transition-all duration-150 cursor-pointer ${
                isExporting ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              <Download size={14} className={isExporting ? "animate-bounce" : ""} />
              <span>{isExporting ? "Exporting CSV..." : "Bulk Export CSV"}</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs hover:shadow-xs transition-all duration-150 ${
                isRefreshing ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
              }`}
              title="Refresh pipeline data"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : "text-slate-500"} />
              <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Refresh"}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ── KPI Stats Grid ────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
          {/* Card 1: Total */}
          <div
            onClick={() => setStatusFilter("All")}
            className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group ${
              statusFilter === "All"
                ? "border-blue-500 ring-2 ring-blue-500/20 bg-linear-to-b from-blue-50/40 to-white"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600 transition-colors">
                Total Orders
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Package size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">{stats.total}</div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block truncate">
              Active shop view
            </span>
          </div>

          {/* Card 2: Awaiting Supplier */}
          <div
            onClick={() => setStatusFilter("Pending")}
            className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group ${
              statusFilter === "Pending"
                ? "border-amber-500 ring-2 ring-amber-500/20 bg-linear-to-b from-amber-50/40 to-white"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
                Awaiting Supplier
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600 tracking-tight">{stats.pendingSupplier}</div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block truncate">
              Trader verification
            </span>
          </div>

          {/* Card 3: In Transit */}
          <div
            onClick={() => setStatusFilter("Transit")}
            className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group ${
              statusFilter === "Transit"
                ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-linear-to-b from-indigo-50/40 to-white"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
                In Transit
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Truck size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-600 tracking-tight">{stats.inTransit}</div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block truncate">
              Transporter en route
            </span>
          </div>

          {/* Card 4: Completed */}
          <div
            onClick={() => setStatusFilter("Completed")}
            className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group ${
              statusFilter === "Completed"
                ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-linear-to-b from-emerald-50/40 to-white"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">
                Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-600 tracking-tight">{stats.completed}</div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block truncate">
              Stock verified
            </span>
          </div>

          {/* Card 5: Discrepancy / Issues */}
          <div
            onClick={() => setStatusFilter("Issues")}
            className={`bg-white rounded-2xl p-4.5 border transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 relative overflow-hidden group col-span-2 sm:col-span-1 ${
              statusFilter === "Issues"
                ? "border-rose-500 ring-2 ring-rose-500/20 bg-linear-to-b from-rose-50/40 to-white"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-rose-600 transition-colors">
                Discrepancy / Issues
              </span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-600 tracking-tight">{stats.issues}</div>
            <span className="text-[11px] font-medium text-slate-400 mt-1 block truncate">
              Shortages / rejections
            </span>
          </div>
        </section>

        {/* ── Filter / Control Bar ────────────────────────── */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 mb-6 space-y-3.5">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by PO#, Vendor, Shop, Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Sort & Dates */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-8 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="date-desc">Newest First</option>
                  <option value="date-asc">Oldest First</option>
                  <option value="po-asc">PO Number (A-Z)</option>
                  <option value="po-desc">PO Number (Z-A)</option>
                </select>
                <ArrowUpDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Date Filters */}
              <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-xs text-slate-600 font-semibold w-full sm:w-auto">
                <Calendar size={13} className="text-slate-400 shrink-0" />
                <span className="text-[10px] text-slate-400 uppercase font-bold">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-0 focus:outline-none text-slate-800 font-bold text-xs cursor-pointer"
                />
                <span className="text-[10px] text-slate-400 uppercase font-bold">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-0 focus:outline-none text-slate-800 font-bold text-xs cursor-pointer"
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="px-1.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded cursor-pointer transition-all ml-1"
                    title="Clear dates"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Status Pills */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Filter size={11} />
              Filter:
            </span>
            {statusPills.map((pill) => {
              const isActive = statusFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  onClick={() => setStatusFilter(pill.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
                    isActive ? pill.activeClass : pill.inactiveClass
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Main List Container ─────────────────────────── */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center flex flex-col items-center justify-center shadow-2xs gap-3 text-slate-400">
            <div className="w-9 h-9 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-sm font-semibold text-slate-600">Loading operations pipeline...</span>
            <span className="text-xs text-slate-400">Syncing purchase orders and stakeholder ledgers</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center flex flex-col items-center justify-center shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3.5 shadow-inner">
              <Package size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Orders in Pipeline</h3>
            <p className="text-slate-500 text-xs sm:text-sm max-w-sm mt-1 leading-relaxed">
              There are no purchase orders matching your selected status filter, shop view, or search terms.
            </p>
            {(statusFilter !== "All" || searchQuery || startDate || endDate) && (
              <button
                onClick={() => {
                  setStatusFilter("All");
                  setSearchQuery("");
                  setStartDate("");
                  setEndDate("");
                }}
                className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((po) => {
              const isExpanded = !!expandedOrders[po.id];
              const overallStatus = getPOStatusText(po);
              const statusColorClass = getPOStatusColorClass(overallStatus);
              const borderAccent = getPOStatusBorderAccent(overallStatus);

              const effectiveCompany = getEffectiveCompanyName(po);
              const cleanVendor = getCleanVendorName(po);

              const traderStage = getTraderStatusDetails(po);
              const transporterStage = getTransporterStatusDetails(po);
              const receiverStage = getReceiverStatusDetails(po);

              const items = getPOItemsData(po);
              const isSkippedTransporter = isTransporterSkippedForOrder(po, companies);

              // Progress bar fill
              const progressWidth =
                po.receiver_status === "yes"
                  ? "100%"
                  : po.transporter_status === "yes" || isSkippedTransporter
                  ? "66%"
                  : po.trader_status === "yes"
                  ? "33%"
                  : "10%";

              return (
                <div
                  key={po.id}
                  className={`bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:shadow-md transition-all duration-200 overflow-hidden border-l-4 ${borderAccent}`}
                >
                  {/* Card Main Row */}
                  <div
                    onClick={() => toggleExpand(po.id)}
                    className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between cursor-pointer select-none gap-4 hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Left: PO Identifier & Shop */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-2xs shrink-0">
                        <Package size={20} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base font-extrabold text-slate-900 tracking-tight font-mono">
                            {po.po_number}
                          </span>
                          <button
                            onClick={(e) => handleCopyPoNumber(e, po.po_number, po.id)}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer transition-colors"
                            title="Copy PO Number"
                          >
                            {copiedPoId === po.id ? (
                              <CheckCheck size={13} className="text-emerald-600" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                          {formatDate(po.created_at)}
                        </span>
                      </div>

                      {/* Destination Shop badge */}
                      <span className="inline-flex items-center gap-1 bg-indigo-50/80 border border-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-lg">
                        <Store size={11} className="text-indigo-500" />
                        {po.shop_name}
                      </span>

                      {/* Explicit Company Filter Badge (shown only if filtered) */}
                      {effectiveCompany && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                          <Building2 size={11} className="text-blue-500" />
                          {effectiveCompany}
                        </span>
                      )}
                    </div>

                    {/* Middle: 3 Stakeholder chips */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs font-semibold text-slate-600">
                      {/* Trader */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <User size={12} />
                        </div>
                        <div>
                          <span className="text-[9.5px] text-slate-400 uppercase font-bold block leading-none">
                            Trader
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-slate-800 font-bold max-w-36 truncate">{cleanVendor}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                po.trader_status === "yes"
                                  ? "bg-emerald-500"
                                  : po.trader_status === "no"
                                  ? "bg-rose-500"
                                  : "bg-amber-500 animate-pulse"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                      {/* Transporter */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <Truck size={12} />
                        </div>
                        <div>
                          <span className="text-[9.5px] text-slate-400 uppercase font-bold block leading-none">
                            Transporter
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-slate-800 font-bold max-w-32 truncate">
                              {isSkippedTransporter
                                ? "Bypassed (Direct)"
                                : po.transporter_name || "—"}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSkippedTransporter || po.transporter_status === "yes"
                                  ? "bg-emerald-500"
                                  : po.transporter_status === "no"
                                  ? "bg-rose-500"
                                  : "bg-amber-500 animate-pulse"
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                      {/* Receiver */}
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <UserCheck size={12} />
                        </div>
                        <div>
                          <span className="text-[9.5px] text-slate-400 uppercase font-bold block leading-none">
                            Receiver
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-slate-800 font-bold max-w-32 truncate">
                              {po.receiver_name || "—"}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                po.receiver_status === "yes"
                                  ? "bg-emerald-500"
                                  : po.receiver_status === "no"
                                  ? "bg-rose-500"
                                  : "bg-amber-500 animate-pulse"
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Pill & Toggle Action */}
                    <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${statusColorClass}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {overallStatus}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPO(po);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                        title="Open Logistics Inspector"
                      >
                        <Eye size={12} />
                        <span className="hidden sm:inline">Inspect</span>
                      </button>

                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Card Expanded Content */}
                  {isExpanded && (
                    <div className="px-5 pb-6 pt-4 border-t border-slate-100 bg-slate-50/50 space-y-6">
                      {/* Sub-Header Actions */}
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            Pipeline Flow Checklist
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600">
                            {items.length} Products
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {po.trader_pdf_url && (
                            <a
                              href={po.trader_pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg shadow-2xs transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FileText size={11} className="text-indigo-600" />
                              View PO PDF
                              <ExternalLink size={10} className="text-slate-400" />
                            </a>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPO(po);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                          >
                            <Eye size={12} /> Inspect Audit Log
                          </button>
                        </div>
                      </div>

                      {/* ── Visual Pipeline Timeline Stepper ── */}
                      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
                        <div className="relative flex items-center justify-between overflow-x-auto gap-4 py-2">
                          {/* Connecting track bar */}
                          <div className="absolute top-5 left-12 right-12 h-1 bg-slate-200 -z-0 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-indigo-500 to-emerald-500 transition-all duration-500 rounded-full"
                              style={{ width: progressWidth }}
                            />
                          </div>

                          {/* Node 1: Trader Review */}
                          <div className="flex flex-col items-center flex-1 text-center relative min-w-35 z-10">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 mb-2 shadow-xs bg-white ${traderStage.color}`}
                            >
                              {traderStage.icon}
                            </div>
                            <span className="text-xs font-bold text-slate-900 block">1. Trader Dispatch</span>
                            <span className="text-[10px] font-bold block mt-0.5 text-slate-500">
                              {traderStage.status}
                            </span>
                            {po.dispatch_date && (
                              <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                                {formatDateTime(po.dispatch_date)}
                              </span>
                            )}
                            <div className="mt-1 flex flex-col items-center max-w-35">
                              <span className="text-[10.5px] text-indigo-600 font-bold block truncate w-full">
                                {cleanVendor}
                              </span>
                              {effectiveCompany && (
                                <span className="inline-block text-[9px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded mt-0.5 shadow-2xs truncate max-w-full">
                                  {effectiveCompany}
                                </span>
                              )}
                              {po.tp_number && (
                                <span className="text-[9.5px] text-slate-500 font-mono mt-0.5 font-bold">
                                  TP: {po.tp_number}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Node 2: Transporter Logistics */}
                          <div className="flex flex-col items-center flex-1 text-center relative min-w-35 z-10">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 mb-2 shadow-xs bg-white ${transporterStage.color}`}
                            >
                              {transporterStage.icon}
                            </div>
                            <span className="text-xs font-bold text-slate-900 block">2. Logistics Transit</span>
                            <span className="text-[10px] font-bold block mt-0.5 text-slate-500">
                              {transporterStage.status}
                            </span>
                            {po.pickup_date && (
                              <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                                {formatDateTime(po.pickup_date)}
                              </span>
                            )}
                            <span className="text-[10.5px] text-indigo-600 font-bold block mt-1 max-w-35 truncate">
                              {isSkippedTransporter
                                ? "Bypassed (BALAJI)"
                                : po.transporter_name || "—"}
                            </span>
                          </div>

                          {/* Node 3: Receiver Confirmation */}
                          <div className="flex flex-col items-center flex-1 text-center relative min-w-35 z-10">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all duration-300 mb-2 shadow-xs bg-white ${receiverStage.color}`}
                            >
                              {receiverStage.icon}
                            </div>
                            <span className="text-xs font-bold text-slate-900 block">3. Destination Receipt</span>
                            <span className="text-[10px] font-bold block mt-0.5 text-slate-500">
                              {receiverStage.status}
                            </span>
                            {po.receiver_status === "yes" && (
                              <span className="text-[9.5px] text-emerald-600 font-bold block mt-0.5">
                                Verified Stock
                              </span>
                            )}
                            <span className="text-[10.5px] text-indigo-600 font-bold block mt-1 max-w-35 truncate">
                              {po.receiver_name || "—"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Stakeholder Remarks / Notes */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                          <div className="flex items-center gap-1.5 text-amber-700 font-bold text-[10.5px] uppercase tracking-wider mb-1">
                            <User size={12} />
                            <span>Trader Remarks</span>
                          </div>
                          <p className="text-xs text-slate-700 italic leading-relaxed">
                            {po.remarks ? `"${po.remarks}"` : <span className="text-slate-400 font-normal">No remarks recorded</span>}
                          </p>
                        </div>
                        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                          <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-[10.5px] uppercase tracking-wider mb-1">
                            <Truck size={12} />
                            <span>Transporter Remarks</span>
                          </div>
                          <p className="text-xs text-slate-700 italic leading-relaxed">
                            {po.transporter_remarks ? (
                              `"${po.transporter_remarks}"`
                            ) : isSkippedTransporter ? (
                              `"Direct Shop Delivery (Transporter Bypassed)"`
                            ) : (
                              <span className="text-slate-400 font-normal">No remarks recorded</span>
                            )}
                          </p>
                        </div>
                        <div className="bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[10.5px] uppercase tracking-wider mb-1">
                            <UserCheck size={12} />
                            <span>Receiver Remarks</span>
                          </div>
                          <p className="text-xs text-slate-700 italic leading-relaxed">
                            {po.receiver_remarks ? `"${po.receiver_remarks}"` : <span className="text-slate-400 font-normal">No remarks recorded</span>}
                          </p>
                        </div>
                      </div>

                      {/* Item-Level Decision Tracking Table */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={14} className="text-indigo-600" /> Item-Level Decision Matrix
                          </h5>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Live ledger cross-verification
                          </span>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs text-slate-800">
                              <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200 font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                                  <th className="p-3 w-12 text-center">#</th>
                                  <th className="p-3">Item Details</th>
                                  <th className="p-3 text-center w-28">Ordered Qty</th>
                                  <th className="p-3 text-center w-36">Trader Decision</th>
                                  <th className="p-3 text-center w-36">Transporter Pickup</th>
                                  <th className="p-3 text-center w-36">Destination Received</th>
                                  <th className="p-3 text-center w-36">Ledger Reconciliation</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => {
                                  const isApprovedByTrader = item.traderDecision === "Accepted";
                                  const refQty = item.transporterQty ?? item.orderQty;
                                  const finalQty = item.receiverQty ?? item.orderQty;
                                  const mismatchDiff =
                                    isApprovedByTrader && item.receiverQty !== null ? finalQty - refQty : null;

                                  return (
                                    <tr
                                      key={item.id}
                                      className={`border-b transition-colors ${
                                        !isApprovedByTrader
                                          ? "bg-rose-50/25 border-rose-100 hover:bg-rose-50/40"
                                          : mismatchDiff !== null && mismatchDiff !== 0
                                          ? "bg-amber-50/25 border-amber-100 hover:bg-amber-50/40"
                                          : "border-slate-100 hover:bg-slate-50/60"
                                      }`}
                                    >
                                      <td className="p-3 text-center text-slate-400 font-mono font-bold text-[11px]">
                                        {idx + 1}
                                      </td>
                                      <td className="p-3">
                                        <div
                                          className={`font-bold ${
                                            !isApprovedByTrader ? "text-slate-400 line-through" : "text-slate-900"
                                          }`}
                                        >
                                          {item.itemName}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                          {item.brandName}
                                        </div>
                                      </td>
                                      <td className="p-3 text-center">
                                        <span className="font-extrabold text-slate-900">{item.orderQty}</span>
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 ml-1 uppercase">
                                          {item.qtyType}
                                        </span>
                                      </td>
                                      <td className="p-3 text-center">
                                        <span
                                          className={`inline-flex items-center gap-1 font-bold text-[10px] px-2.5 py-0.5 rounded-full border ${
                                            isApprovedByTrader
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                              : item.traderDecision === "Rejected"
                                              ? "bg-rose-50 text-rose-700 border-rose-200"
                                              : "bg-amber-50 text-amber-700 border-amber-200"
                                          }`}
                                        >
                                          {item.traderDecision === "Accepted" ? (
                                            <Check size={10} />
                                          ) : item.traderDecision === "Rejected" ? (
                                            <X size={10} />
                                          ) : (
                                            <Clock size={10} />
                                          )}
                                          {item.traderDecision}
                                        </span>
                                      </td>
                                      <td className="p-3 text-center">
                                        {!isApprovedByTrader ? (
                                          <span className="text-rose-400 font-medium italic text-[11px]">
                                            Not Dispatched
                                          </span>
                                        ) : item.transporterQty !== null ? (
                                          <div className="inline-flex items-center gap-1">
                                            <span className="font-bold text-slate-900">{item.transporterQty}</span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                                              {item.qtyType}
                                            </span>
                                          </div>
                                        ) : isSkippedTransporter ? (
                                          <span className="text-blue-600 font-bold text-[11px]">Direct Transit</span>
                                        ) : (
                                          <span className="text-slate-400 italic text-[11px]">Pending</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center">
                                        {!isApprovedByTrader ? (
                                          <span className="text-slate-400 font-medium italic text-[11px]">N/A</span>
                                        ) : item.receiverQty !== null ? (
                                          <div className="inline-flex items-center gap-1">
                                            <span className="font-bold text-slate-900">{item.receiverQty}</span>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase">
                                              {item.qtyType}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 italic text-[11px]">Pending</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center">
                                        {!isApprovedByTrader ? (
                                          <span className="text-slate-400 font-medium">—</span>
                                        ) : mismatchDiff === null ? (
                                          <span className="text-slate-400 italic text-[11px]">Awaiting receipt</span>
                                        ) : mismatchDiff === 0 ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                            <Check size={10} /> Matched
                                          </span>
                                        ) : mismatchDiff < 0 ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                            <TrendingDown size={10} /> {mismatchDiff} Shortage
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                            <TrendingUp size={10} /> +{mismatchDiff} Surplus
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Loading Spinner for On Scroll Pagination */}
        {!isLoading && isFetchingNextPage && (
          <div className="flex justify-center items-center py-8 gap-2 text-slate-400">
            <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
            <span className="text-xs font-semibold">Loading more orders...</span>
          </div>
        )}
      </div>

      {/* ── PO Details Inspector Drawer ─────────── */}
      {selectedPO && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end transition-opacity duration-200"
          onClick={() => setSelectedPO(null)}
        >
          <div
            className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col border-l border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider block w-fit">
                  Logistics Inspector
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-lg font-extrabold text-slate-900 font-mono">{selectedPO.po_number}</h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {selectedPO.shop_name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPO(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 bg-white hover:bg-slate-100 rounded-full border border-slate-200 cursor-pointer transition-colors"
                title="Close Drawer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* PDF Document Quick Links */}
              <div className="space-y-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Logistics Documents (PDF)
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {selectedPO.trader_pdf_url && (
                    <a
                      href={selectedPO.trader_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors group text-inherit no-underline"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Supplier / Trader PDF</span>
                          <span className="text-[10px] text-slate-400 block">Original terms & quantities</span>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </a>
                  )}

                  {!isTransporterSkippedForOrder(selectedPO, companies) &&
                    (selectedPO.transporter_pdf_url || selectedPO.trader_pdf_url) && (
                      <a
                        href={selectedPO.transporter_pdf_url || selectedPO.trader_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors group text-inherit no-underline"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <Truck size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">Transporter Delivery PDF</span>
                            <span className="text-[10px] text-slate-400 block">Pickup & dispatch manifest</span>
                          </div>
                        </div>
                        <ExternalLink size={14} className="text-slate-400 group-hover:text-amber-600 transition-colors" />
                      </a>
                    )}

                  {selectedPO.receiver_pdf_url && (
                    <a
                      href={selectedPO.receiver_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors group text-inherit no-underline"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Inbox size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Receiver Acknowledgement PDF</span>
                          <span className="text-[10px] text-slate-400 block">Received verification record</span>
                        </div>
                      </div>
                      <ExternalLink size={14} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    </a>
                  )}
                </div>
              </div>

              {/* Order Overview Card */}
              <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4.5 space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                  Order Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">
                      Destination Shop
                    </span>
                    <span className="text-slate-800 font-bold text-sm">{selectedPO.shop_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">
                      Trader / Vendor
                    </span>
                    <span className="text-slate-800 font-bold text-sm">{getCleanVendorName(selectedPO)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">
                      Company Filter
                    </span>
                    <span className="text-blue-700 font-bold text-xs bg-blue-50 border border-blue-200 px-2 py-0.5 rounded inline-block mt-0.5">
                      {getEffectiveCompanyName(selectedPO) || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">
                      Created Date
                    </span>
                    <span className="text-slate-800 font-semibold">{formatDate(selectedPO.created_at)}</span>
                  </div>
                  {selectedPO.tp_number && (
                    <div className="col-span-2">
                      <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">
                        Transport Pass (TP)
                      </span>
                      <span className="text-slate-800 font-bold font-mono text-xs">{selectedPO.tp_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Audit Timeline */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                  Timeline Action History
                </h3>
                <div className="relative pl-6 border-l-2 border-slate-200 ml-3 space-y-6">
                  {/* Step 1: PO Created */}
                  <div className="relative">
                    <div className="absolute -left-7.75 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-2xs" />
                    <span className="text-xs font-bold text-slate-800 block">Purchase Order Created</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {formatDateTime(selectedPO.created_at)}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Purchase Order was automatically compiled from approved indents by the system.
                    </p>
                  </div>

                  {/* Step 2: Trader Review */}
                  <div className="relative">
                    <div
                      className={`absolute -left-7.75 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                        selectedPO.trader_status === "yes"
                          ? "bg-emerald-500"
                          : selectedPO.trader_status === "no"
                          ? "bg-rose-500"
                          : "bg-amber-500 animate-pulse"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-800 block">Trader Dispatch Verification</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {selectedPO.trader_status ? formatDateTime(selectedPO.dispatch_date) : "Awaiting response"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {selectedPO.trader_status === "yes"
                        ? `Trader confirmed dispatch and entered expected delivery schedule. Remarks: "${
                            selectedPO.remarks || "None"
                          }"`
                        : selectedPO.trader_status === "no"
                        ? `Trader rejected PO request. Remarks: "${selectedPO.remarks || "None"}"`
                        : `Awaiting Supplier (${getCleanVendorName(selectedPO)}${
                            getEffectiveCompanyName(selectedPO) ? ` - ${getEffectiveCompanyName(selectedPO)}` : ""
                          }) action on verification portal.`}
                    </p>
                  </div>

                  {/* Step 3: Transporter Confirmation */}
                  <div className="relative">
                    <div
                      className={`absolute -left-7.75 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                        isTransporterSkippedForOrder(selectedPO, companies) || selectedPO.transporter_status === "yes"
                          ? "bg-emerald-500"
                          : selectedPO.transporter_status === "no"
                          ? "bg-rose-500"
                          : "bg-amber-500 animate-pulse"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-800 block">Logistics Pickup Confirmation</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {isTransporterSkippedForOrder(selectedPO, companies)
                        ? "Bypassed"
                        : selectedPO.transporter_status
                        ? formatDateTime(selectedPO.pickup_date)
                        : "Awaiting response"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {isTransporterSkippedForOrder(selectedPO, companies)
                        ? `Transporter step is automatically bypassed for this shop destination.`
                        : selectedPO.transporter_status === "yes"
                        ? `Transporter (${selectedPO.transporter_name}) confirmed cargo pickup. Remarks: "${
                            selectedPO.transporter_remarks || "None"
                          }"`
                        : selectedPO.transporter_status === "no"
                        ? `Transporter rejected logistics pickup. Remarks: "${
                            selectedPO.transporter_remarks || "None"
                          }"`
                        : `Awaiting pickup confirmation from transporter (${selectedPO.transporter_name || "Assigned"}).`}
                    </p>
                  </div>

                  {/* Step 4: Receiver Delivery */}
                  <div className="relative">
                    <div
                      className={`absolute -left-7.75 top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                        selectedPO.receiver_status === "yes"
                          ? "bg-emerald-500"
                          : selectedPO.receiver_status === "no"
                          ? "bg-rose-500"
                          : "bg-amber-500 animate-pulse"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-800 block">Destination Delivery Receipt</span>
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                      {selectedPO.receiver_status === "yes" ? "Received & Verified" : "Awaiting response"}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {selectedPO.receiver_status === "yes"
                        ? `Receiver (${selectedPO.receiver_name}) verified stock arrival and recorded received counts. Remarks: "${
                            selectedPO.receiver_remarks || "None"
                          }"`
                        : selectedPO.receiver_status === "no"
                        ? `Receiver rejected delivery. Remarks: "${selectedPO.receiver_remarks || "None"}"`
                        : `Awaiting destination shop arrival verification from receiver (${
                            selectedPO.receiver_name || "Shop Incharge"
                          }).`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default OrdersPipeline;
