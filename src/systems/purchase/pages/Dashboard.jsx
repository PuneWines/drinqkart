import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import useShopStore from "../store/useShopStore";
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
  ChevronDown,
  ChevronUp,
  Briefcase,
  PackageCheck,
  FileEdit,
  AlertCircle,
  RotateCcw,
  Clock,
  CheckCircle2,
  X,
  Activity,
  Filter
} from "lucide-react";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const {
    selectedShop: globalShop,
    setSelectedShop,
    shops: storeShops,
    fetchShops,
    assignedShops,
    isShopAdmin,
  } = useShopStore();

  // Load store data on mount
  useEffect(() => {
    if (fetchShops) fetchShops();
  }, [fetchShops]);

  // Filter States with persistent localStorage memory
  const [filterShop, setFilterShop] = useState(() => {
    const { isAdmin, assignedShops: initialAssigned } = useShopStore.getState();
    if (!isAdmin && initialAssigned && initialAssigned.length > 0) {
      const saved = localStorage.getItem("purchase_dashboard_filter_shop");
      if (saved && initialAssigned.some(s => s.toLowerCase() === saved.toLowerCase())) {
        return saved;
      }
      return initialAssigned[0];
    }
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
    setFilterParty("All");
    localStorage.setItem("purchase_dashboard_filter_party", "All");
    setFilterCompany("All");
    localStorage.setItem("purchase_dashboard_filter_company", "All");
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
    // When party changes, reset company filter to All so it only filters companies valid for this party
    setFilterCompany("All");
    localStorage.setItem("purchase_dashboard_filter_company", "All");
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

  const hasActiveFilters = Boolean(
    (filterShop && filterShop !== "All") ||
    (filterCompany && filterCompany !== "All") ||
    (filterParty && filterParty !== "All") ||
    (filterStatus && filterStatus !== "All") ||
    (filterTimeframe && filterTimeframe !== "all") ||
    (searchQuery && searchQuery.trim() !== "")
  );

  const resetAllFilters = () => {
    const defaultShop =
      !isShopAdmin && assignedShops && assignedShops.length > 0
        ? assignedShops[0]
        : "All";
    setFilterShop(defaultShop);
    localStorage.setItem("purchase_dashboard_filter_shop", defaultShop);
    if (setSelectedShop) setSelectedShop(defaultShop);

    setFilterCompany("All");
    localStorage.setItem("purchase_dashboard_filter_company", "All");

    setFilterParty("All");
    localStorage.setItem("purchase_dashboard_filter_party", "All");

    setFilterStatus("All");
    localStorage.setItem("purchase_dashboard_filter_status", "All");

    setFilterTimeframe("all");
    localStorage.setItem("purchase_dashboard_filter_timeframe", "all");

    setSearchQuery("");
    localStorage.setItem("purchase_dashboard_search_query", "");

    setCurrentPage(1);
  };

  // Sync with global sidebar shop if user explicitly changes shop in sidebar
  useEffect(() => {
    if (globalShop) {
      if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
        const allowedShop =
          assignedShops.find(
            (s) => s.toLowerCase() === globalShop.toLowerCase(),
          ) || assignedShops[0];
        if (allowedShop !== filterShop) {
          setFilterShop(allowedShop);
          localStorage.setItem("purchase_dashboard_filter_shop", allowedShop);
          setCurrentPage(1);
        }
      } else if (globalShop !== filterShop) {
        setFilterShop(globalShop);
        localStorage.setItem("purchase_dashboard_filter_shop", globalShop);
        setCurrentPage(1);
      }
    }
  }, [globalShop, isShopAdmin, assignedShops]);

  // Fetch audit records from purchase_dashboard
  const {
    data: dashboardLogs = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery({
    queryKey: ["purchaseDashboardLogs", isShopAdmin, (assignedShops || []).join(",")],
    queryFn: async () => {
      let query = supabase
        .from("purchase_dashboard")
        .select("*")
        .order("indent_created_at", { ascending: false })
        .limit(5000);

      if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
        query = query.in("shop_name", assignedShops);
      } else if (!isShopAdmin && (!assignedShops || assignedShops.length === 0)) {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      let logs = data || [];
      if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
        logs = logs.filter(
          (row) =>
            row.shop_name &&
            assignedShops.some(
              (s) => s.toLowerCase() === row.shop_name.toLowerCase(),
            ),
        );
      }

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
    if (!isShopAdmin) {
      if (!assignedShops || assignedShops.length === 0) return [];
      return [...assignedShops];
    }
    const set = new Set(["All"]);
    (storeShops || []).forEach(s => set.add(s));
    dashboardLogs.forEach(row => {
      if (row.shop_name) set.add(row.shop_name);
    });
    return Array.from(set);
  }, [dashboardLogs, storeShops, isShopAdmin, assignedShops]);

  // Extract Unique Parties for dropdown (filtered by selected shop)
  const availableParties = useMemo(() => {
    const set = new Set();
    dashboardLogs.forEach(row => {
      if (filterShop && filterShop !== "All") {
        if ((row.shop_name || "").toLowerCase() !== filterShop.toLowerCase()) return;
      }
      const p = (row.party_name || "").trim();
      if (p) set.add(p);
    });
    return ["All", ...Array.from(set).sort()];
  }, [dashboardLogs, filterShop]);

  // Extract Unique Companies strictly from sheet data in dashboardLogs,
  // dynamically filtered by the selected Party (and selected Shop)
  const availableCompanies = useMemo(() => {
    const set = new Set();
    dashboardLogs.forEach(row => {
      if (filterShop && filterShop !== "All") {
        if ((row.shop_name || "").toLowerCase() !== filterShop.toLowerCase()) return;
      }
      if (filterParty && filterParty !== "All") {
        if ((row.party_name || "").trim().toLowerCase() !== filterParty.trim().toLowerCase()) return;
      }
      const c = (row.company_name || "").trim();
      if (c) set.add(c);
    });
    return ["All", ...Array.from(set).sort()];
  }, [dashboardLogs, filterShop, filterParty]);

  const hasUnassignedCompanyInLogs = useMemo(() => {
    return dashboardLogs.some(row => {
      if (filterShop && filterShop !== "All") {
        if ((row.shop_name || "").toLowerCase() !== filterShop.toLowerCase()) return false;
      }
      if (filterParty && filterParty !== "All") {
        if ((row.party_name || "").trim().toLowerCase() !== filterParty.trim().toLowerCase()) return false;
      }
      return !(row.company_name || "").trim();
    });
  }, [dashboardLogs, filterShop, filterParty]);

  // Ensure filterCompany stays valid when availableCompanies changes
  useEffect(() => {
    if (filterCompany !== "All" && filterCompany !== "__NONE__") {
      if (!availableCompanies.includes(filterCompany)) {
        setFilterCompany("All");
        localStorage.setItem("purchase_dashboard_filter_company", "All");
      }
    }
  }, [availableCompanies, filterCompany]);

  // Party-specific company filter state: { [partyName]: selectedCompany }
  const [partyCompanyFilters, setPartyCompanyFilters] = useState({});
  // Party expansion state: default is COLLAPSED (not always open!)
  const [expandedParties, setExpandedParties] = useState({});

  const handlePartyCompanyFilterChange = (partyName, comp) => {
    setPartyCompanyFilters(prev => ({
      ...prev,
      [partyName]: comp
    }));
  };

  const togglePartyExpand = (partyName) => {
    setExpandedParties(prev => ({
      ...prev,
      [partyName]: !prev[partyName]
    }));
  };

  const expandAllParties = (partyNames) => {
    const all = {};
    partyNames.forEach(name => {
      all[name] = true;
    });
    setExpandedParties(all);
  };

  const collapseAllParties = () => {
    setExpandedParties({});
  };

  // 1. Base Filtered dataset (Shop, Company, Party, Timeframe, Search)
  const baseFilteredData = useMemo(() => {
    let result = [...dashboardLogs];

    // Only indents completely deleted at draft/indent stage are omitted.
    // Items rejected or deleted at approval or PO stage MUST BE DISPLAYED in the audit trail!
    result = result.filter(row => !(row.is_deleted && row.deletion_stage === "indent"));

    // 0. Defense-in-depth: Shop authorization check for non-admins
    if (!isShopAdmin) {
      if (!assignedShops || assignedShops.length === 0) return [];
      result = result.filter(
        (row) =>
          row.shop_name &&
          assignedShops.some(
            (s) => s.toLowerCase() === row.shop_name.toLowerCase(),
          ),
      );
    }

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

    // 4. Timeframe Filter
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

    // 5. Search Query
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
  }, [dashboardLogs, filterShop, filterCompany, filterParty, filterTimeframe, searchQuery]);

  // 2. High-level KPI metrics computed on the active shop/company/party filtered view
  const metrics = useMemo(() => {
    let total = baseFilteredData.length;
    let pendingApproval = 0;
    let approvedReady = 0;
    let completed = 0;
    let modified = 0;
    let rejected = 0;

    baseFilteredData.forEach(r => {
      const lowerApp = (r.approver_action || "").toLowerCase();
      const isCompleted = !r.is_deleted && r.po_qty > 0 && Boolean(r.po_number);
      const isApproved = !r.is_deleted && !isCompleted && (
        (r.approved_qty != null && r.approved_qty > 0) ||
        (r.approver_action && !lowerApp.includes("delete") && !lowerApp.includes("reject"))
      );
      const isRejected = r.is_deleted || (r.approver_action && (lowerApp.includes("delete") || lowerApp.includes("reject")));
      const isPending = !r.is_deleted && !isCompleted && !isApproved && !isRejected;

      if (isCompleted) completed++;
      else if (isApproved) approvedReady++;
      else if (isPending) pendingApproval++;

      if (
        (r.approver_action && r.approver_action.includes("Modified")) ||
        (r.po_action && r.po_action.includes("Modified"))
      ) {
        modified++;
      }
      if (isRejected) {
        rejected++;
      }
    });

    return { total, pendingApproval, approvedReady, completed, modified, rejected };
  }, [baseFilteredData]);

  // 3. Final Filtered dataset (applies filterStatus)
  const filteredData = useMemo(() => {
    let result = [...baseFilteredData];

    if (filterStatus !== "All") {
      if (filterStatus === "PendingApproval") {
        result = result.filter(r => !r.is_deleted && !r.po_number && (r.approved_qty == null || r.approved_qty === 0) && (!r.approver_action || r.approver_action.includes("pending")));
      } else if (filterStatus === "ApprovedReady") {
        result = result.filter(r => {
          const lowerApp = (r.approver_action || "").toLowerCase();
          return !r.is_deleted && !r.po_number && (
            (r.approved_qty != null && r.approved_qty > 0) ||
            (r.approver_action && !lowerApp.includes("delete") && !lowerApp.includes("reject"))
          );
        });
      } else if (filterStatus === "Completed") {
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
            r.is_deleted ||
            (r.approver_action && (r.approver_action.includes("Reject") || r.approver_action.includes("Deleted") || r.approver_action.includes("delete"))) ||
            (r.po_action && (r.po_action.includes("Deleted") || r.po_action.includes("Removed")))
        );
      } else if (filterStatus === "DeletedIndent") {
        result = result.filter(r => r.is_deleted);
      }
    }

    return result;
  }, [baseFilteredData, filterStatus]);

  // Group filtered records into dedicated Party containers
  const partyGroups = useMemo(() => {
    const map = new Map();

    filteredData.forEach(row => {
      const party = (row.party_name || "Unassigned Party").trim();
      if (!map.has(party)) {
        map.set(party, []);
      }
      map.get(party).push(row);
    });

    return Array.from(map.entries()).map(([partyName, rawRows]) => {
      // Find companies extracted from sheets that exist for this specific party
      const companyCountMap = new Map();
      let unassignedCount = 0;

      rawRows.forEach(r => {
        const c = (r.company_name || "").trim();
        if (c) {
          companyCountMap.set(c, (companyCountMap.get(c) || 0) + 1);
        } else {
          unassignedCount++;
        }
      });

      const partyCompanies = Array.from(companyCountMap.keys()).sort();
      const activePartyCompany = partyCompanyFilters[partyName] || "All";

      // Filter rows by the party-level company dropdown
      let displayedRows = rawRows;
      if (activePartyCompany !== "All") {
        if (activePartyCompany === "__NONE__") {
          displayedRows = rawRows.filter(r => !(r.company_name || "").trim());
        } else {
          displayedRows = rawRows.filter(
            r => (r.company_name || "").trim().toLowerCase() === activePartyCompany.toLowerCase()
          );
        }
      }

      // Unique shops for this party
      const shopsSet = new Set();
      rawRows.forEach(r => {
        if (r.shop_name) shopsSet.add(r.shop_name);
      });
      const uniqueShops = Array.from(shopsSet).sort();

      // Lifecycle counts for this party (using displayedRows)
      const ordCount = displayedRows.filter(r => r.order_box != null || r.order_qty != null).length;
      const appCount = displayedRows.filter(
        r => {
          const lowerApp = (r.approver_action || "").toLowerCase();
          return !r.is_deleted && (r.approved_box != null || r.approved_qty != null || (r.approver_action && !lowerApp.includes("delete") && !lowerApp.includes("reject")));
        }
      ).length;
      const poCount = displayedRows.filter(
        r => !r.is_deleted && ((r.po_box != null && r.po_box > 0) || Boolean(r.po_number))
      ).length;
      const rejCount = displayedRows.filter(
        r => {
          const lowerApp = (r.approver_action || "").toLowerCase();
          return r.is_deleted || (r.approver_action && (lowerApp.includes("delete") || lowerApp.includes("reject")));
        }
      ).length;

      // Box totals
      const totalOrderBox = displayedRows.reduce((acc, r) => acc + (parseFloat(r.order_box) || 0), 0);
      const totalApprovedBox = displayedRows.reduce((acc, r) => acc + (parseFloat(r.approved_box) || 0), 0);
      const totalPoBox = displayedRows.reduce((acc, r) => acc + (parseFloat(r.po_box) || 0), 0);

      return {
        partyName,
        totalItemsCount: rawRows.length,
        displayedRows,
        partyCompanies,
        companyCountMap,
        unassignedCount,
        activePartyCompany,
        uniqueShops,
        ordCount,
        appCount,
        poCount,
        rejCount,
        totalOrderBox,
        totalApprovedBox,
        totalPoBox
      };
    }).sort((a, b) => a.partyName.localeCompare(b.partyName));
  }, [filteredData, partyCompanyFilters]);

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

  // Fetch users from `users` table for rich employee hover details
  const { data: usersMap = new Map() } = useQuery({
    queryKey: ["purchaseDashboardUsers"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("user_name, employee_id, role, shop_name, Designation");
        if (error) {
          console.warn("Could not load users for employee hover:", error);
          return new Map();
        }
        const map = new Map();
        (data || []).forEach(u => {
          if (u.user_name) {
            map.set(u.user_name.toLowerCase().trim(), u);
          }
          if (u.employee_id) {
            map.set(String(u.employee_id).toLowerCase().trim(), u);
          }
        });
        return map;
      } catch (err) {
        console.warn("Error fetching users:", err);
        return new Map();
      }
    },
    staleTime: 5 * 60 * 1000
  });

  const getEmployeeDetails = (empCode) => {
    if (!empCode) return null;
    const clean = String(empCode).trim();
    const user = usersMap.get(clean.toLowerCase());
    if (user) {
      return {
        name: user.user_name || clean,
        code: user.employee_id || clean,
        role: user.role || "Staff",
        shop: user.shop_name || "—",
        designation: user.Designation || "—"
      };
    }
    return {
      name: clean,
      code: clean,
      role: "Staff",
      shop: "—",
      designation: "—"
    };
  };

  const EmployeeBadge = ({ empCode, stage, timestamp, reason }) => {
    if (!empCode) return null;
    const emp = getEmployeeDetails(empCode);
    const formattedDate = timestamp ? new Date(timestamp).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }) : null;

    return (
      <div className="relative group inline-block">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/90 hover:border-indigo-300 transition-all cursor-pointer">
          <User size={10} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
          <span className="truncate max-w-28 font-medium">{emp ? emp.name : empCode}</span>
        </span>

        {/* Hover Tooltip Popover */}
        <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-56 p-2.5 bg-slate-900 text-white rounded-lg shadow-2xl text-left pointer-events-none border border-slate-700 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5 mb-1.5">
            <div className="font-bold text-xs text-white flex items-center gap-1.5 truncate">
              <User size={12} className="text-indigo-400 shrink-0" />
              <span className="truncate">{emp ? emp.name : empCode}</span>
            </div>
            {emp?.role && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 uppercase shrink-0">
                {emp.role}
              </span>
            )}
          </div>
          
          <div className="space-y-1 text-[10px] text-slate-300">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Emp Code:</span>
              <span className="font-bold text-slate-100 font-mono">{emp?.code || empCode}</span>
            </div>
            {stage && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Action:</span>
                <span className="font-semibold text-emerald-400">{stage}</span>
              </div>
            )}
            {emp?.shop && emp.shop !== "—" && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Shop:</span>
                <span className="font-semibold text-slate-200 truncate max-w-32">{emp.shop}</span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Timestamp:</span>
                <span className="text-[9px] text-slate-300 font-mono">{formattedDate}</span>
              </div>
            )}
            {reason && (
              <div className="pt-1 text-[9px] text-rose-300 border-t border-slate-800">
                <span className="font-bold text-rose-400">Reason:</span> {reason}
              </div>
            )}
          </div>

          {/* Tooltip Arrow */}
          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-900"></div>
        </div>
      </div>
    );
  };

  // Helper renderers for 3 core lifecycle stages (Order Generated, Approval, PO)
  const renderOrderGeneratedCell = (row) => {
    const isExtraAdded = (row.approver_action || "").toLowerCase().includes("extra add");
    const isDirectPo = (row.po_action || "").toLowerCase().includes("direct add");
    const isIndentDeleted = row.is_deleted && row.deletion_stage === "indent";

    if (isIndentDeleted) {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
            <XCircle size={10} /> Deleted
          </span>
          <div>
            <EmployeeBadge
              empCode={row.deleted_by_emp_code || row.indent_emp_code}
              stage="Deleted at Indent"
              timestamp={row.deleted_at || row.indent_created_at}
              reason={row.deletion_reason}
            />
          </div>
        </div>
      );
    }

    if (isExtraAdded || isDirectPo || (row.order_box == null && row.order_qty == null)) {
      return <span className="text-slate-300 font-medium select-none">—</span>;
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
            Order Generated
          </span>
          <span className="text-[11px] font-bold text-slate-800">
            {row.order_box != null ? `${parseFloat(row.order_box).toFixed(2)} Bx` : ""}
            {row.order_box != null && row.order_qty != null ? " • " : ""}
            {row.order_qty != null ? `${Math.round(row.order_qty)} units` : ""}
          </span>
        </div>
        <div>
          <EmployeeBadge
            empCode={row.indent_emp_code}
            stage="Indent Created"
            timestamp={row.indent_created_at}
          />
        </div>
      </div>
    );
  };

  const renderApprovalCell = (row) => {
    const appAction = (row.approver_action || "").trim();
    const lower = appAction.toLowerCase();

    if (lower === "delete" || lower.includes("delete") || lower.includes("reject") || (row.is_deleted && row.deletion_stage === "approval")) {
      const isRej = lower.includes("reject") || (row.deletion_reason && row.deletion_reason.toLowerCase().includes("reject"));
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
            <XCircle size={10} /> {isRej ? "Rejected" : "Deleted"}
          </span>
          <div>
            <EmployeeBadge
              empCode={row.approver_emp_code || row.deleted_by_emp_code}
              stage={isRej ? "Rejected at Approval" : "Deleted at Approval"}
              timestamp={row.deleted_at || row.approved_at}
              reason={row.deletion_reason}
            />
          </div>
        </div>
      );
    }

    if (lower.includes("extra add") || appAction === "Extra add by approver") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/70">
              Extra Added
            </span>
            {row.approved_box != null && (
              <span className="text-[11px] font-bold text-purple-900">
                {parseFloat(row.approved_box).toFixed(2)} Bx • {Math.round(row.approved_qty)} units
              </span>
            )}
          </div>
          <div>
            <EmployeeBadge
              empCode={row.approver_emp_code}
              stage="Extra Added by Approver"
              timestamp={row.approved_at}
            />
          </div>
        </div>
      );
    }

    const isModified = (
      (row.approved_box != null && row.order_box != null && parseFloat(row.approved_box) !== parseFloat(row.order_box)) ||
      lower.includes("modified")
    );

    if (row.approved_box != null || row.approved_qty != null || lower.includes("approved")) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
              isModified
                ? "bg-amber-50 text-amber-800 border border-amber-200/70"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200/70"
            }`}>
              {isModified ? "Modified" : "Approved"}
            </span>
            <span className={`text-[11px] font-bold ${isModified ? "text-amber-900" : "text-emerald-900"}`}>
              {row.approved_box != null ? `${parseFloat(row.approved_box).toFixed(2)} Bx` : ""}
              {row.approved_box != null && row.approved_qty != null ? " • " : ""}
              {row.approved_qty != null ? `${Math.round(row.approved_qty)} units` : ""}
            </span>
          </div>
          <div>
            <EmployeeBadge
              empCode={row.approver_emp_code}
              stage={isModified ? "Modified by Approver" : "Approved"}
              timestamp={row.approved_at}
            />
          </div>
        </div>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
        Pending Approval
      </span>
    );
  };

  const renderPoCell = (row) => {
    const poAction = (row.po_action || "").trim();
    const lower = poAction.toLowerCase();

    if (lower === "delete" || lower.includes("delete") || lower.includes("removed") || (row.is_deleted && row.deletion_stage === "po")) {
      return (
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs">
            <XCircle size={10} /> Dropped in PO
          </span>
          <div>
            <EmployeeBadge
              empCode={row.po_emp_code || row.deleted_by_emp_code}
              stage="Dropped / Removed in PO"
              timestamp={row.deleted_at || row.po_generated_at}
              reason={row.deletion_reason}
            />
          </div>
        </div>
      );
    }

    if (lower.includes("direct add") || poAction === "Direct Added in PO") {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Direct Added
            </span>
            <span className="text-[11px] font-bold text-indigo-950">
              {row.po_number ? `${row.po_number} • ` : ""}
              {row.po_box != null ? `${parseFloat(row.po_box).toFixed(2)} Bx` : ""}
              {row.po_qty != null ? ` • ${Math.round(row.po_qty)} units` : ""}
            </span>
          </div>
          <div>
            <EmployeeBadge
              empCode={row.po_emp_code}
              stage="Direct Added in PO"
              timestamp={row.po_generated_at}
            />
          </div>
        </div>
      );
    }

    if (row.po_id || row.po_number || (row.po_box != null && row.po_box > 0)) {
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              PO Created
            </span>
            <span className="text-[11px] font-bold text-indigo-950">
              {row.po_number ? `${row.po_number} • ` : ""}
              {row.po_box != null ? `${parseFloat(row.po_box).toFixed(2)} Bx` : ""}
              {row.po_qty != null ? ` • ${Math.round(row.po_qty)} units` : ""}
            </span>
          </div>
          <div>
            <EmployeeBadge
              empCode={row.po_emp_code}
              stage="PO Created"
              timestamp={row.po_generated_at}
            />
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
      
      {/* ── Top Dashboard Header ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Activity size={18} />
              </span>
              Purchase Audit & Lifecycle Monitor
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Realtime audit tracking across Store Indent, Management Approval, Purchase Order & Verified Receiving.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-400" />
            <span>{filterShop === "All" ? "All Shops Active" : filterShop}</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className={`p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl transition-all cursor-pointer ${
              isRefetching ? "animate-spin" : ""
            }`}
            title="Refresh dashboard data"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Metric Summary Cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Items */}
        <div 
          onClick={() => handleStatusChange("All")}
          className={`p-3.5 bg-linear-to-b from-white to-slate-50/50 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
            filterStatus === "All"
              ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20"
              : "border-slate-200 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Items</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{metrics.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Matching active filters</div>
        </div>

        {/* Order Generated (Pending Approval) */}
        <div 
          onClick={() => handleStatusChange(filterStatus === "PendingApproval" ? "All" : "PendingApproval")}
          className={`p-3.5 bg-linear-to-b from-white to-blue-50/20 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
            filterStatus === "PendingApproval"
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30"
              : "border-slate-200 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Order Generated</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1">{metrics.pendingApproval}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Pending approval stage</div>
        </div>

        {/* Approved (Ready for PO) */}
        <div 
          onClick={() => handleStatusChange(filterStatus === "ApprovedReady" ? "All" : "ApprovedReady")}
          className={`p-3.5 bg-linear-to-b from-white to-emerald-50/20 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
            filterStatus === "ApprovedReady"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30"
              : "border-slate-200 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Approved</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{metrics.approvedReady}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Approved & ready for PO</div>
        </div>

        {/* PO Completed */}
        <div 
          onClick={() => handleStatusChange(filterStatus === "Completed" ? "All" : "Completed")}
          className={`p-3.5 bg-linear-to-b from-white to-indigo-50/20 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
            filterStatus === "Completed"
              ? "border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30"
              : "border-slate-200 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>PO Completed</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <PackageCheck size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-700 mt-1">{metrics.completed}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Active & ordered in PO</div>
        </div>

        {/* Modified / Dropped */}
        <div 
          onClick={() => handleStatusChange(filterStatus === "Modified" ? "All" : "Modified")}
          className={`p-3.5 bg-linear-to-b from-white to-amber-50/20 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
            filterStatus === "Modified"
              ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30"
              : "border-slate-200 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Modified Qty</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileEdit size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{metrics.modified}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Quantities updated</div>
        </div>

        {/* Rejected / Deleted */}
        <div 
          onClick={() => handleStatusChange(filterStatus === "RejectedApproval" ? "All" : "RejectedApproval")}
          className={`p-3.5 bg-linear-to-b from-white to-rose-50/20 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 ${
            filterStatus === "RejectedApproval"
              ? "border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/30"
              : "border-slate-200 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Rejected / Deleted</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle size={14} />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{metrics.rejected}</div>
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">Rejected or deleted items</div>
        </div>
      </div>

      {/* ── Sleek Compact Control Bar ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Quick Search */}
        <div className="flex-1 min-w-64 max-w-md relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search items, indent, PO#, party, company, employee..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Middle: Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shop */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:border-slate-300 transition-all">
            <Building2 size={13} className="text-slate-400 shrink-0" />
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

          {/* Party (First) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 max-w-44 hover:border-slate-300 transition-all">
            <User size={13} className="text-slate-400 shrink-0" />
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

          {/* Company (Second - filtered by selected Party) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 max-w-44 hover:border-slate-300 transition-all">
            <Briefcase size={13} className="text-slate-400 shrink-0" />
            <select
              value={filterCompany}
              onChange={(e) => handleCompanyChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer truncate w-full"
            >
              <option value="All">All Companies</option>
              {availableCompanies.filter(c => c !== "All").map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {hasUnassignedCompanyInLogs && (
                <option value="__NONE__">Unassigned Company</option>
              )}
            </select>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:border-slate-300 transition-all">
            <Layers size={13} className="text-slate-400 shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All Stages</option>
              <option value="PendingApproval">Order Generated (Pending Approval)</option>
              <option value="ApprovedReady">Approved (Pending PO)</option>
              <option value="Completed">PO Completed</option>
              <option value="Modified">Quantity Modified</option>
              <option value="DroppedPO">Dropped in PO</option>
              <option value="RejectedApproval">Rejected</option>
              <option value="DeletedIndent">Deleted</option>
            </select>
          </div>

          {/* Timeframe */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 hover:border-slate-300 transition-all">
            <Calendar size={13} className="text-slate-400 shrink-0" />
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
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              title="Reset all filters to show all records"
            >
              <RotateCcw size={12} />
              <span>Reset Filters</span>
            </button>
          )}

          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-3 py-1.5 rounded-xl font-mono">
            {filteredData.length} records
          </span>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Download CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* ── Party-Wise Indent Management Containers ────────────── */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} className="text-indigo-600" />
            Parties ({partyGroups.length})
          </span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            • Click any party to view audit trail (collapsed by default)
          </span>
        </div>
        {partyGroups.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => expandAllParties(partyGroups.map(p => p.partyName))}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ChevronDown size={13} />
              <span>Expand All</span>
            </button>
            <button
              onClick={collapseAllParties}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <ChevronUp size={13} />
              <span>Collapse All</span>
            </button>
          </div>
        )}
      </div>

      {partyGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-12 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Search size={22} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-700">No matching records found</div>
              <div className="text-xs text-slate-400 mt-1">
                {hasActiveFilters 
                  ? "Your active filters returned 0 records. Try resetting filters to view all store indents."
                  : "No records found in the audit table yet."}
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {partyGroups.map((group) => {
            // Default is COLLAPSED (so it does NOT always open!)
            // Auto-expand only if the user specifically filtered down to a single party
            const isExpanded = (partyGroups.length === 1 && filterParty !== "All")
              ? (expandedParties[group.partyName] !== false)
              : Boolean(expandedParties[group.partyName]);
            const isCollapsed = !isExpanded;

            return (
              <div
                key={group.partyName}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isExpanded
                    ? "border-indigo-300 ring-2 ring-indigo-500/10 shadow-md"
                    : "border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-xs"
                }`}
              >
                {/* ── Party Header Bar ─────────────────────────────── */}
                <div
                  onClick={() => togglePartyExpand(group.partyName)}
                  className={`p-3.5 ${
                    isExpanded
                      ? "bg-gradient-to-r from-indigo-50/40 via-white to-slate-50/60 border-b border-indigo-100"
                      : "bg-white hover:bg-slate-50/80"
                  } flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors`}
                  title={isCollapsed ? `Click to expand ${group.partyName}` : `Click to collapse ${group.partyName}`}
                >
                  
                  {/* Left: Party Identity & Metadata */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {group.partyName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm md:text-base">{group.partyName}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {group.displayedRows.length}{group.displayedRows.length !== group.totalItemsCount ? ` / ${group.totalItemsCount}` : ""} items
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {group.uniqueShops.map(s => (
                          <span key={s} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Dedicated Company Dropdown & Stage Summaries & Collapse Toggle */}
                  <div className="flex items-center flex-wrap gap-2.5">
                    
                    {/* Dedicated Company Dropdown for this Party */}
                    <div 
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 bg-slate-50 border border-slate-300/80 rounded-xl px-2.5 py-1 hover:bg-white hover:border-indigo-400 transition-colors cursor-default"
                    >
                      <Briefcase size={13} className="text-indigo-600 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company:</span>
                      <select
                        value={group.activePartyCompany}
                        onChange={(e) => handlePartyCompanyFilterChange(group.partyName, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer max-w-44 truncate"
                        title="Filter this party's items by company extracted from sheet"
                      >
                        <option value="All">All Companies ({group.totalItemsCount})</option>
                        {group.partyCompanies.map(comp => (
                          <option key={comp} value={comp}>
                            {comp} ({group.companyCountMap.get(comp) || 0})
                          </option>
                        ))}
                        {group.unassignedCount > 0 && (
                          <option value="__NONE__">Unassigned ({group.unassignedCount})</option>
                        )}
                      </select>
                    </div>

                    {/* Quick Stage Status Counts */}
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60" title="Order Generated">
                        Ord: {group.ordCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60" title="Approved">
                        App: {group.appCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60" title="In PO">
                        PO: {group.poCount}
                      </span>
                      {group.rejCount > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/60 font-bold" title="Rejected or Deleted">
                          Rej: {group.rejCount}
                        </span>
                      )}
                    </div>

                    {/* Quick Box Summary Preview */}
                    <div className="hidden md:flex items-center text-xs font-bold text-slate-700 bg-slate-100/70 border border-slate-200 px-2.5 py-1 rounded-xl">
                      <span>Order: {group.totalOrderBox.toFixed(2)} Bx</span>
                    </div>

                    {/* Collapse / Expand Toggle Icon */}
                    <div
                      className={`p-1.5 rounded-xl transition-all shrink-0 ${
                        isExpanded ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                      title={isCollapsed ? "Click to expand" : "Click to collapse"}
                    >
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* ── Party Table Body ─────────────────────────────── */}
                {!isCollapsed && (
                  <div>
                    {group.displayedRows.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500">
                        <p>No records for company <span className="font-bold text-slate-700">"{group.activePartyCompany}"</span> under this party.</p>
                        <button
                          onClick={() => handlePartyCompanyFilterChange(group.partyName, "All")}
                          className="mt-2 text-indigo-600 hover:underline font-semibold cursor-pointer"
                        >
                          Show all companies for this party
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
                        <table className="w-full text-left text-xs text-slate-700 border-collapse">
                          <thead className="bg-slate-50/95 backdrop-blur-xs text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3">Indent ID</th>
                              <th className="py-2.5 px-3">Shop</th>
                              <th className="py-2.5 px-3">Company</th>
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
                            {group.displayedRows.map((row) => (
                              <tr
                                key={row.id}
                                className="hover:bg-slate-50/80 transition-colors"
                              >
                                {/* Indent ID */}
                                <td className="py-2.5 px-3 font-bold text-indigo-900 whitespace-nowrap" title={row.indent_id}>
                                  {row.indent_id && row.indent_id.length > 15
                                    ? `IN-${row.indent_id.slice(0, 8).toUpperCase()}`
                                    : (row.indent_id || "—")}
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

                                {/* Item Name */}
                                <td className="py-2.5 px-3 font-bold text-slate-900 min-w-50">
                                  {row.item_name}
                                </td>

                                {/* Order Generated */}
                                <td className="py-2.5 px-3 bg-blue-50/20 whitespace-nowrap min-w-44">
                                  {renderOrderGeneratedCell(row)}
                                </td>

                                {/* Approval */}
                                <td className="py-2.5 px-3 bg-emerald-50/20 whitespace-nowrap min-w-44">
                                  {renderApprovalCell(row)}
                                </td>

                                {/* PO */}
                                <td className="py-2.5 px-3 bg-indigo-50/20 whitespace-nowrap min-w-44">
                                  {renderPoCell(row)}
                                </td>

                                {/* Vendor (Trader) */}
                                <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                  {row.is_deleted && !row.po_number ? (
                                    <span className="text-slate-300 font-medium select-none">—</span>
                                  ) : (
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
                                  )}
                                </td>

                                {/* Transporter */}
                                <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                  {row.is_deleted && !row.po_number ? (
                                    <span className="text-slate-300 font-medium select-none">—</span>
                                  ) : (
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
                                  )}
                                </td>

                                {/* Receiver */}
                                <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                  {row.is_deleted && !row.po_number ? (
                                    <span className="text-slate-300 font-medium select-none">—</span>
                                  ) : (
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
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          {/* Party Table Summary Footer */}
                          <tfoot className="bg-slate-50 font-semibold text-[11px] text-slate-700 border-t border-slate-200">
                            <tr>
                              <td colSpan="4" className="py-2 px-3 text-right text-slate-500 font-bold">
                                Total for {group.activePartyCompany === "All" ? "All Companies" : group.activePartyCompany}:
                              </td>
                              <td className="py-2 px-3 bg-blue-50/40 font-bold text-blue-900">
                                {group.totalOrderBox.toFixed(2)} Bx
                              </td>
                              <td className="py-2 px-3 bg-emerald-50/40 font-bold text-emerald-900">
                                {group.totalApprovedBox.toFixed(2)} Bx
                              </td>
                              <td className="py-2 px-3 bg-indigo-50/40 font-bold text-indigo-900">
                                {group.totalPoBox.toFixed(2)} Bx
                              </td>
                              <td colSpan="3" className="py-2 px-3 text-center text-slate-400">
                                {group.displayedRows.length} items
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
