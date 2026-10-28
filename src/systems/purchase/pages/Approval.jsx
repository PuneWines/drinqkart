import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useShopStore from "../store/useShopStore";
import useCompanyStore from "../store/useCompanyStore";
import useAuthStore from "../store/useAuthStore";
import "../styles/Pages.css";
import { supabase } from "../lib/supabase";
import {
  Loader2,
  Archive,
  X,
  Eye,
  Search,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { deleteSupersededLifecycleItems } from "../services/purchaseOrderService";
import { dashboardSyncService } from "../services/dashboardSyncService";

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

const Approval = () => {
  const [pendingGroupedApprovals, setPendingGroupedApprovals] = useState({});
  const [historyGroupedApprovals, setHistoryGroupedApprovals] = useState({});
  const [selectedIndentId, setSelectedIndentId] = useState(null);
  const [indentStatuses, setIndentStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(false); // start as false to avoid layout flicker on cache hit
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem("purchase_approval_active_tab") || "pending";
    } catch (e) {
      return "pending";
    }
  });
  const { selectedShop, assignedShops, isShopAdmin } = useShopStore();
  const { companies, fetchCompanies } = useCompanyStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (fetchCompanies) fetchCompanies();
  }, [fetchCompanies]);

  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [showInProcessModal, setShowInProcessModal] = useState(false);
  const [inProcessSearchQuery, setInProcessSearchQuery] = useState("");
  const [excludedSearchQuery, setExcludedSearchQuery] = useState("");
  const [modalSortField, setModalSortField] = useState("name"); // "name" | "size"
  const [modalSortDir, setModalSortDir] = useState("asc"); // "asc" | "desc"
  const [excludedSortField, setExcludedSortField] = useState("name");
  const [excludedSortDir, setExcludedSortDir] = useState("asc");
  const [inProcessSortField, setInProcessSortField] = useState("name");
  const [inProcessSortDir, setInProcessSortDir] = useState("asc");
  const [originalIndentItems, setOriginalIndentItems] = useState([]);
  const [originalStatuses, setOriginalStatuses] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    try {
      return localStorage.getItem("purchase_approval_start_date") || "";
    } catch (e) {
      return "";
    }
  });
  const [endDate, setEndDate] = useState(() => {
    try {
      return localStorage.getItem("purchase_approval_end_date") || "";
    } catch (e) {
      return "";
    }
  });
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem("purchase_approval_search_query") || "";
    } catch (e) {
      return "";
    }
  });
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState("All");

  useEffect(() => {
    try {
      localStorage.setItem("purchase_approval_active_tab", activeTab);
    } catch (e) {}
  }, [activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem("purchase_approval_search_query", searchQuery);
    } catch (e) {}
  }, [searchQuery]);

  useEffect(() => {
    try {
      localStorage.setItem("purchase_approval_start_date", startDate);
    } catch (e) {}
  }, [startDate]);

  useEffect(() => {
    try {
      localStorage.setItem("purchase_approval_end_date", endDate);
    } catch (e) {}
  }, [endDate]);

  const resolveItemCompany = (item) => {
    if (item?.company_name && item.company_name.trim()) {
      return item.company_name.trim();
    }
    const rawShop = (item?.shop_name || selectedShop || "")
      .trim()
      .toLowerCase();
    if (rawShop && rawShop !== "all") {
      const matched = companies.find((c) => {
        const cName = (c.name || "").toLowerCase();
        return cName.includes(rawShop) || rawShop.includes(cName);
      });
      if (matched?.name) return matched.name;
    }
    return "";
  };

  const groupedApprovals =
    activeTab === "pending" ? pendingGroupedApprovals : historyGroupedApprovals;
  const setGroupedApprovals =
    activeTab === "pending"
      ? setPendingGroupedApprovals
      : setHistoryGroupedApprovals;

  useEffect(() => {
    setSelectedIndentId(null);
  }, [activeTab]);

  const modalItems = selectedIndentId
    ? groupedApprovals[selectedIndentId] || []
    : [];
  const isItemInSelectedCompany = (item) => {
    if (!item) return false;
    if (selectedCompanyFilter && selectedCompanyFilter !== "All") {
      const comp = resolveItemCompany(item);
      if (selectedCompanyFilter === "__NONE__") {
        return !comp;
      }
      return comp.toLowerCase() === selectedCompanyFilter.trim().toLowerCase();
    }
    return true;
  };

  const activeBatchItems = modalItems.filter(
    (item) =>
      !item.is_excluded &&
      !item.already_in_lifecycle &&
      isItemInSelectedCompany(item),
  );
  const approvedCount = activeBatchItems.filter(
    (item) => indentStatuses[item.id] === "approved",
  ).length;
  const rejectedCount = activeBatchItems.filter(
    (item) => indentStatuses[item.id] === "rejected",
  ).length;
  const pendingCount = activeBatchItems.filter(
    (item) => !indentStatuses[item.id] || indentStatuses[item.id] === "pending",
  ).length;

  const sortedActiveBatchItems = useMemo(() => {
    const list = [...activeBatchItems];
    if (!modalSortField) return list;
    return list.sort((a, b) => {
      if (modalSortField === "name") {
        const nameA = (a.item_name || a.itemName || "").trim().toLowerCase();
        const nameB = (b.item_name || b.itemName || "").trim().toLowerCase();
        const comp = nameA.localeCompare(nameB);
        if (comp !== 0) return modalSortDir === "asc" ? comp : -comp;
        const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
        const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
        return mlA - mlB;
      }
      if (modalSortField === "size") {
        const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
        const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
        const comp = mlA - mlB;
        if (comp !== 0) return modalSortDir === "asc" ? comp : -comp;
        const nameA = (a.item_name || a.itemName || "").trim().toLowerCase();
        const nameB = (b.item_name || b.itemName || "").trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
  }, [activeBatchItems, modalSortField, modalSortDir]);

  useEffect(() => {
    if (!selectedIndentId) {
      setShowExcludedModal(false);
      setShowInProcessModal(false);
      setInProcessSearchQuery("");
      setExcludedSearchQuery("");
      setSelectedCompanyFilter("All");
    }
  }, [selectedIndentId]);

  const handleStatusChange = (itemId, status) => {
    setIndentStatuses((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === status ? null : status,
    }));
  };

  const handleSelectAllFiltered = (status) => {
    if (activeBatchItems.length === 0) return;

    // If all target items already have this status, toggle them off (null); otherwise set all to status
    const allAlreadySet = activeBatchItems.every(
      (item) => indentStatuses[item.id] === status,
    );
    const nextStatus = allAlreadySet ? null : status;

    setIndentStatuses((prev) => {
      const next = { ...prev };
      activeBatchItems.forEach((item) => {
        next[item.id] = nextStatus;
      });
      return next;
    });
  };

  const handleIncludeExcludedItem = (itemId) => {
    setGroupedApprovals((prev) => {
      const updated = { ...prev };
      const currentItems = updated[selectedIndentId] || [];
      const itemIndex = currentItems.findIndex((i) => i.id === itemId);
      if (itemIndex !== -1) {
        const item = { ...currentItems[itemIndex] };
        item.is_excluded = false;
        // Automatically default restored items to approved status
        setIndentStatuses((prevStatuses) => ({
          ...prevStatuses,
          [itemId]: "approved",
        }));
        currentItems[itemIndex] = item;
      }
      return updated;
    });
  };

  const handleDeleteBatch = async (groupKey, items) => {
    const displayLabel = groupKey.includes("::")
      ? groupKey.split("::")[1]
      : groupKey;
    const confirmMsg = `Are you sure you want to permanently delete all ${items.length} items in batch ${displayLabel}? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      const ids = items.map((item) => item.id);
      const targetTable =
        activeTab === "history"
          ? "purchase_approved_indent_items"
          : "purchase_indent_items";

      // Delete in chunks of 50 to avoid URL length limit errors in REST API
      const chunkSize = 50;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { error } = await supabase
          .from(targetTable)
          .delete()
          .in("id", chunk);

        if (error) throw error;
      }

      // Sync batch deletion to purchase_dashboard so audit trail and dashboard retain deleted items
      const currentUser = useAuthStore.getState().currentUser;
      const approverEmpCode =
        currentUser?.employee_id ||
        currentUser?.emp_code ||
        currentUser?.user_name ||
        currentUser?.name ||
        "Approver";

      const basePartyId = groupKey.includes("::")
        ? groupKey.split("::")[1]
        : groupKey;
      const baseIndentId = groupKey.includes("::")
        ? groupKey.split("::")[0]
        : null;

      await dashboardSyncService.syncBatchDeletedAtApproval({
        indentId: items[0]?.indent_id || baseIndentId,
        partyIndentId: items[0]?.party_indent_id || basePartyId,
        items,
        approverEmpCode,
        shopName: items[0]?.shop_name || items[0]?.purchase_indents?.shop_name,
        partyName: items[0]?.party_name,
      });

      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["purchase_dashboard_logs"] });
        queryClient.invalidateQueries({ queryKey: ["approvalsData"] });
      }

      alert(`Batch ${displayLabel} successfully deleted!`);

      // Update local state by removing the deleted group
      setGroupedApprovals((prev) => {
        const updated = { ...prev };
        delete updated[groupKey];
        return updated;
      });
    } catch (error) {
      console.error("Error deleting batch:", error);
      alert("Failed to delete batch.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async (itemId, itemName, itemObj = null) => {
    const confirmMsg = `Are you sure you want to permanently delete item "${itemName}"? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      const currentItemsList = groupedApprovals[selectedIndentId] || [];
      const targetItem = itemObj || currentItemsList.find((item) => item.id === itemId);

      const targetTable =
        activeTab === "history"
          ? "purchase_approved_indent_items"
          : "purchase_indent_items";
      const { error } = await supabase
        .from(targetTable)
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      // Sync deletion to purchase_dashboard so audit trail and dashboard retain deleted items
      const currentUser = useAuthStore.getState().currentUser;
      const approverEmpCode =
        currentUser?.employee_id ||
        currentUser?.emp_code ||
        currentUser?.user_name ||
        currentUser?.name ||
        "Approver";

      const basePartyId = selectedIndentId?.includes("::")
        ? selectedIndentId.split("::")[1]
        : selectedIndentId;
      const baseIndentId = selectedIndentId?.includes("::")
        ? selectedIndentId.split("::")[0]
        : null;

      if (targetItem) {
        await dashboardSyncService.syncItemDeletedAtApproval({
          indentId: targetItem.indent_id || baseIndentId,
          partyIndentId: targetItem.party_indent_id || basePartyId,
          item: targetItem,
          approverEmpCode,
          shopName: targetItem.shop_name || targetItem.purchase_indents?.shop_name,
          partyName: targetItem.party_name,
        });
      }

      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["purchase_dashboard_logs"] });
        queryClient.invalidateQueries({ queryKey: ["approvalsData"] });
      }

      alert(`Item "${itemName}" successfully deleted!`);

      // Update groupedApprovals state
      setGroupedApprovals((prev) => {
        const updated = { ...prev };
        const currentItems = updated[selectedIndentId] || [];
        const filteredItems = currentItems.filter((item) => item.id !== itemId);

        if (filteredItems.length === 0) {
          // If no items left in batch, remove the entire batch key and close the modal
          delete updated[selectedIndentId];
          setSelectedIndentId(null);
        } else {
          updated[selectedIndentId] = filteredItems;
        }
        return updated;
      });

      // Update originalIndentItems snapshot to keep rollback consistent
      setOriginalIndentItems((prev) =>
        prev.filter((item) => item.id !== itemId),
      );
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenIndent = (indentId) => {
    setSelectedIndentId(indentId);
    const items = groupedApprovals[indentId] || [];
    // Deep copy items array to preserve pre-edited values for a perfect rollback
    const snapshot = items.map((item) => ({ ...item }));
    setOriginalIndentItems(snapshot);

    // Backup current approval states for these items
    const statusSnapshot = {};
    items.forEach((item) => {
      statusSnapshot[item.id] = indentStatuses[item.id] || null;
    });
    setOriginalStatuses(statusSnapshot);
  };

  const handleCloseIndent = () => {
    if (selectedIndentId && originalIndentItems.length > 0) {
      // Revert in-memory items back to original values
      setGroupedApprovals((prev) => ({
        ...prev,
        [selectedIndentId]: originalIndentItems,
      }));
    }
    if (originalStatuses) {
      // Revert statuses back to pre-edit state
      setIndentStatuses((prev) => ({
        ...prev,
        ...originalStatuses,
      }));
    }

    // Reset snapshots
    setOriginalIndentItems([]);
    setOriginalStatuses(null);
    setSelectedIndentId(null);
  };

  const handleInlineChange = (itemId, field, value) => {
    setGroupedApprovals((prev) => {
      const updated = { ...prev };
      const currentItems = updated[selectedIndentId] || [];
      const itemIndex = currentItems.findIndex((i) => i.id === itemId);
      if (itemIndex !== -1) {
        const item = { ...currentItems[itemIndex] };
        let numVal = value === "" ? null : parseFloat(value);
        item[field] = numVal;

        const bcs = parseFloat(item.bcs) || 0;
        if (bcs > 0) {
          if (
            (field === "approved_box" || field === "order_box") &&
            numVal !== null
          ) {
            item.approved_qty = parseFloat((numVal * bcs).toFixed(2));
          } else if (
            (field === "approved_qty" || field === "order_qty") &&
            numVal !== null
          ) {
            item.approved_box = parseFloat((numVal / bcs).toFixed(2));
          }
        }
        currentItems[itemIndex] = item;
      }
      return updated;
    });
  };

  const inlineInputStyle = {
    width: "100%",
    minWidth: "60px",
    maxWidth: "85px",
    padding: "4px 6px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    backgroundColor: "#fff",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s",
    fontWeight: "700",
    color: "#4338ca",
    textAlign: "center",
  };

  // ── Supabase Realtime: auto-invalidate cache on DB changes ──
  useRealtimeSync();

  const { data: approvalsDataResponse, isLoading: isApprovalsQueryLoading } =
    useQuery({
      queryKey: [
        "approvalsData",
        selectedShop,
        isShopAdmin,
        (assignedShops || []).join(","),
      ],
      queryFn: async () => {
        // Enforce user shop scoping:
        // If user is not admin and has assigned shops, they can NEVER see unassigned shops
        const isRestricted =
          !isShopAdmin && Array.isArray(assignedShops) && assignedShops.length > 0;

        if (!isShopAdmin && (!assignedShops || assignedShops.length === 0)) {
          // Non-admin user with no shop assigned -> return empty data safely
          return {
            rawIndentItems: [],
            rawApprovedIndentItems: [],
            rawRejectedIndentItems: [],
          };
        }

        const effectiveShop = selectedShop;
        const useSingleShopFilter =
          effectiveShop &&
          effectiveShop !== "All" &&
          (!isRestricted ||
            assignedShops.some(
              (s) => s.toLowerCase() === effectiveShop.toLowerCase(),
            ));

        const pageSize = 1000;
        const totalPages = 10; // covers up to 10,000 pending items in parallel

        // 1. Fetch pending indent items in parallel pages
        const indentPageQueries = Array.from(
          { length: totalPages },
          (_, page) => {
            let q = supabase.from("purchase_indent_items");
            let queryWithSelect;

            if (useSingleShopFilter) {
              queryWithSelect = q
                .select("*, purchase_indents!inner(shop_name)")
                .eq("purchase_indents.shop_name", effectiveShop);
            } else if (isRestricted) {
              queryWithSelect = q
                .select("*, purchase_indents!inner(shop_name)")
                .in("purchase_indents.shop_name", assignedShops);
            } else {
              queryWithSelect = q.select("*, purchase_indents(shop_name)");
            }

            return queryWithSelect
              .or("approval_status.eq.pending,approval_status.is.null")
              .order("created_at", { ascending: false })
              .order("id", { ascending: true })
              .range(page * pageSize, (page + 1) * pageSize - 1);
          },
        );

        // 2. Fetch approved indent items (history)
        let approvedQuery = supabase.from("purchase_approved_indent_items");
        let approvedWithSelect;

        if (useSingleShopFilter) {
          approvedWithSelect = approvedQuery
            .select("*, purchase_indents!inner(shop_name)")
            .eq("purchase_indents.shop_name", effectiveShop);
        } else if (isRestricted) {
          approvedWithSelect = approvedQuery
            .select("*, purchase_indents!inner(shop_name)")
            .in("purchase_indents.shop_name", assignedShops);
        } else {
          approvedWithSelect = approvedQuery.select("*, purchase_indents(shop_name)");
        }
        approvedWithSelect = approvedWithSelect
          .order("created_at", { ascending: false })
          .limit(500);

        // 3. Fetch rejected indent items (history)
        let rejectedQuery = supabase.from("purchase_indent_items");
        let rejectedWithSelect;

        if (useSingleShopFilter) {
          rejectedWithSelect = rejectedQuery
            .select("*, purchase_indents!inner(shop_name)")
            .eq("purchase_indents.shop_name", effectiveShop);
        } else if (isRestricted) {
          rejectedWithSelect = rejectedQuery
            .select("*, purchase_indents!inner(shop_name)")
            .in("purchase_indents.shop_name", assignedShops);
        } else {
          rejectedWithSelect = rejectedQuery.select("*, purchase_indents(shop_name)");
        }
        rejectedWithSelect = rejectedWithSelect
          .eq("approval_status", "rejected")
          .order("updated_at", { ascending: false })
          .limit(500);

        const [approvedResult, rejectedResult, ...indentResults] =
          await Promise.all([
            approvedWithSelect,
            rejectedWithSelect,
            ...indentPageQueries,
          ]);

        if (approvedResult.error) throw approvedResult.error;
        if (rejectedResult.error) throw rejectedResult.error;

        let rawIndentItems = [];
        indentResults.forEach(({ data, error }) => {
          if (error) throw error;
          if (data) {
            rawIndentItems = [...rawIndentItems, ...data];
          }
        });

        return {
          rawIndentItems,
          rawApprovedIndentItems: approvedResult.data || [],
          rawRejectedIndentItems: rejectedResult.data || [],
        };
      },
    });

  // Sync React Query data to local state for seamless backwards compatibility
  useEffect(() => {
    if (approvalsDataResponse) {
      const rawApproved = approvalsDataResponse.rawApprovedIndentItems || [];
      const approvedKeys = new Set(
        rawApproved.map(
          (i) =>
            `${i.indent_id}::${i.party_indent_id}::${(i.item_name || "").trim().toLowerCase()}`,
        ),
      );
      const approvedOriginalIds = new Set(
        rawApproved.map((i) => i.original_item_id).filter(Boolean),
      );

      // Filter out any items from rawIndentItems that are already in rawApproved or outside assigned shops
      const enrichedIndentItems = (approvalsDataResponse.rawIndentItems || [])
        .filter((item) => {
          if (approvedOriginalIds.has(item.id)) return false;
          const key = `${item.indent_id}::${item.party_indent_id}::${(item.item_name || "").trim().toLowerCase()}`;
          if (approvedKeys.has(key)) return false;

          // Defense-in-depth: enforce assigned shops filter in memory
          if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
            const itemShop = item.purchase_indents?.shop_name || item.shop_name;
            if (
              !itemShop ||
              !assignedShops.some(
                (as) => as.toLowerCase() === itemShop.toLowerCase(),
              )
            ) {
              return false;
            }
          }
          return true;
        })
        .map((item) => ({
          ...item,
          shop_name: item.purchase_indents?.shop_name || "Unknown",
        }));

      const rawRejected = approvalsDataResponse.rawRejectedIndentItems || [];

      const enrichedApprovedItems = rawApproved
        .filter((item) => {
          if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
            const itemShop = item.purchase_indents?.shop_name || item.shop_name;
            if (
              !itemShop ||
              !assignedShops.some(
                (as) => as.toLowerCase() === itemShop.toLowerCase(),
              )
            ) {
              return false;
            }
          }
          return true;
        })
        .map((item) => ({
          ...item,
          approval_status: "approved",
          is_excluded: false,
          shop_name: item.purchase_indents?.shop_name || "Unknown",
        }));

      const enrichedRejectedItems = rawRejected
        .filter((item) => {
          if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
            const itemShop = item.purchase_indents?.shop_name || item.shop_name;
            if (
              !itemShop ||
              !assignedShops.some(
                (as) => as.toLowerCase() === itemShop.toLowerCase(),
              )
            ) {
              return false;
            }
          }
          return true;
        })
        .map((item) => ({
          ...item,
          approval_status: "rejected",
          is_excluded: false,
          shop_name: item.purchase_indents?.shop_name || "Unknown",
        }));

      const enrichedHistoryItems = [
        ...enrichedApprovedItems,
        ...enrichedRejectedItems,
      ];

      const groupItemsByKey = (items) => {
        return items.reduce((acc, item) => {
          const fullId = item.party_indent_id || "Unknown";
          const parts = fullId.split("-");
          let basePartyId = fullId;
          if (parts.length >= 2 && fullId !== "Unknown") {
            basePartyId = `${parts[0]}-${parts[1]}`;
          }
          const groupKey = `${item.indent_id ?? "no-indent"}::${basePartyId}`;
          if (!acc[groupKey]) acc[groupKey] = [];
          acc[groupKey].push(item);
          return acc;
        }, {});
      };

      setPendingGroupedApprovals(groupItemsByKey(enrichedIndentItems));
      setHistoryGroupedApprovals(groupItemsByKey(enrichedHistoryItems));

      // Pre-fill existing statuses for history items
      const initialStatuses = {};
      enrichedHistoryItems.forEach((item) => {
        initialStatuses[item.id] = item.approval_status || "approved";
      });
      setIndentStatuses((prev) => ({ ...prev, ...initialStatuses }));
    }
  }, [approvalsDataResponse]);

  const showLoadingScreen = isLoading || isApprovalsQueryLoading;

  // Keep fetchApprovals as a wrapper that triggers React Query cache invalidation
  const fetchApprovals = async () => {
    setIsLoading(true);
    await queryClient.invalidateQueries({ queryKey: ["approvalsData"] });
    setIsLoading(false);
  };

  const handleSubmitApprovals = async () => {
    if (!selectedIndentId) return;

    try {
      setIsLoading(true);
      const currentItems = groupedApprovals[selectedIndentId] || [];

      // Strictly restrict submission to items matching the active company filter and not excluded/already in lifecycle
      const itemsToProcess = currentItems.filter(
        (item) =>
          !item.is_excluded &&
          !item.already_in_lifecycle &&
          isItemInSelectedCompany(item),
      );

      if (itemsToProcess.length === 0) {
        alert("No items in the active filter selection to submit.");
        setIsLoading(false);
        return;
      }

      const approvedItemsPayload = [];
      const approvedIdsToDelete = [];
      const rejectedIdsToUpdate = [];
      let parentIndentId = null;
      let hasAnyApproved = false;

      const rejectedItemNames = [];

      const isCompanyFiltered = Boolean(
        selectedCompanyFilter && selectedCompanyFilter !== "All",
      );

      // Validate valid parent indent IDs to avoid foreign key constraints
      const { data: validIndents } = await supabase
        .from("purchase_indents")
        .select("id");
      const validIndentIds = new Set((validIndents || []).map((i) => i.id));

      itemsToProcess.forEach((item) => {
        const validParentId =
          item.indent_id && validIndentIds.has(item.indent_id)
            ? item.indent_id
            : null;

        if (!parentIndentId && validParentId) {
          parentIndentId = validParentId;
        }

        const status = indentStatuses[item.id];
        let autoBox = parseFloat(item.order_box) || 0;
        let autoQty = parseFloat(item.order_qty) || 0;
        let processedBox =
          item.approved_box !== undefined && item.approved_box !== null
            ? parseFloat(item.approved_box)
            : autoBox;
        let processedQty =
          item.approved_qty !== undefined && item.approved_qty !== null
            ? parseFloat(item.approved_qty)
            : autoQty;

        if (status === "approved") {
          approvedIdsToDelete.push(item.id);
          hasAnyApproved = true;
          if (processedBox >= 0.9) {
            if (processedBox < 1.0) {
              processedBox = 1;
            } else {
              processedBox = Math.floor(processedBox);
            }
            const bcs = parseFloat(item.bcs) || 0;
            processedQty = bcs > 0 ? processedBox * bcs : processedQty;
          }

          const effectiveCompany =
            isCompanyFiltered && selectedCompanyFilter !== "__NONE__"
              ? selectedCompanyFilter.trim()
              : null;

          approvedItemsPayload.push({
            original_item_id: item.id,
            indent_id: validParentId,
            party_indent_id: item.party_indent_id,
            item_name: item.item_name,
            brand_name: item.brand_name,
            company_name: item.company_name || null,
            company_scope: effectiveCompany,
            bcs: item.bcs,
            mls: item.mls,
            liquor_type: item.liquor_type,
            party_name: item.party_name,
            qty_out: item.qty_out,
            closing_qty: item.closing_qty,
            last_month_sale_box: item.last_month_sale_box,
            per_day_sale_last_month: item.per_day_sale_last_month,
            threshold_sale: item.threshold_sale,
            closing_qty_box: item.closing_qty_box,
            order_box: autoBox,
            order_qty: autoQty,
            approved_box: processedBox,
            approved_qty: processedQty,
            unique_indent_id: selectedIndentId,
            po_status: "pending",
          });
        } else if (status === "rejected") {
          // Only items explicitly marked as rejected are updated to rejected
          rejectedIdsToUpdate.push(item.id);
          if (item.item_name) rejectedItemNames.push(item.item_name);
        }
      });

      if (
        approvedItemsPayload.length === 0 &&
        rejectedIdsToUpdate.length === 0
      ) {
        alert(
          "No items have been selected for approval or rejection in this submission.",
        );
        setIsLoading(false);
        return;
      }

      // 1. Insert approved items into approved_indent_items in chunks of 100
      if (approvedItemsPayload.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < approvedItemsPayload.length; i += chunkSize) {
          const chunk = approvedItemsPayload.slice(i, i + chunkSize);
          let { error: insertErr } = await supabase
            .from("purchase_approved_indent_items")
            .insert(chunk);
          if (
            insertErr &&
            (insertErr.code === "PGRST204" ||
              insertErr.message?.includes("company_scope"))
          ) {
            const fallbackChunk = chunk.map(
              ({ company_scope, ...rest }) => rest,
            );
            const retry = await supabase
              .from("purchase_approved_indent_items")
              .insert(fallbackChunk);
            insertErr = retry.error;
          }
          if (insertErr) throw insertErr;
        }
      }

      // 2. Delete approved items from purchase_indent_items
      if (approvedIdsToDelete.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < approvedIdsToDelete.length; i += chunkSize) {
          const chunk = approvedIdsToDelete.slice(i, i + chunkSize);
          const { error: deleteErr } = await supabase
            .from("purchase_indent_items")
            .delete()
            .in("id", chunk);
          if (deleteErr) throw deleteErr;
        }
      }

      // 3. Update rejected items in purchase_indent_items to approval_status = 'rejected'
      if (rejectedIdsToUpdate.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < rejectedIdsToUpdate.length; i += chunkSize) {
          const chunk = rejectedIdsToUpdate.slice(i, i + chunkSize);
          const { error: updateErr } = await supabase
            .from("purchase_indent_items")
            .update({ approval_status: "rejected" })
            .in("id", chunk);
          if (updateErr) throw updateErr;
        }

        // Clean up superseded held rows in purchase_indent_items for these rejected item names
        const shopName = itemsToProcess[0]?.shop_name;
        if (shopName) {
          await deleteSupersededLifecycleItems(shopName, rejectedItemNames);
        }
      }

      // 4. Update parent indent status ONLY IF no more pending items exist in purchase_indent_items
      if (parentIndentId) {
        const { data: remainingItems } = await supabase
          .from("purchase_indent_items")
          .select("id, approval_status")
          .eq("indent_id", parentIndentId);

        const remainingPending = (remainingItems || []).filter(
          (i) =>
            !approvedIdsToDelete.includes(i.id) &&
            !rejectedIdsToUpdate.includes(i.id) &&
            (!i.approval_status || i.approval_status === "pending"),
        );

        if (remainingPending.length === 0) {
          const { error: indentErr } = await supabase
            .from("purchase_indents")
            .update({ status: hasAnyApproved ? "Approved" : "Rejected" })
            .eq("id", parentIndentId);
          if (indentErr) throw indentErr;
        }
      }

      // 5. Strictly sync audit data to purchase_dashboard with atomicity
      const currentUser = useAuthStore.getState().currentUser;
      const approverEmpCode =
        currentUser?.employee_id ||
        currentUser?.emp_code ||
        currentUser?.user_name ||
        currentUser?.name ||
        "Approver";

      const targetIndentId =
        currentItems[0]?.indent_id ||
        currentItems[0]?.party_indent_id ||
        selectedIndentId;
      const effectiveCompany =
        isCompanyFiltered && selectedCompanyFilter !== "__NONE__"
          ? selectedCompanyFilter.trim()
          : null;

      await dashboardSyncService.syncApprovalSubmitted({
        targetIndentId,
        itemsToProcess,
        indentStatuses,
        approverEmpCode,
        effectiveCompany,
        currentShopName: itemsToProcess[0]?.shop_name,
      });

      alert("Successfully submitted approvals!");

      // Auto-close modal immediately upon submission
      setSelectedIndentId(null);
      setShowExcludedModal(false);
      setShowInProcessModal(false);
      setSelectedCompanyFilter("All");
      setOriginalIndentItems([]);
      setOriginalStatuses(null);

      // Optimistically update local state immediately so submitted items/batches are hidden right away
      const submittedIdsSet = new Set([
        ...approvedIdsToDelete,
        ...rejectedIdsToUpdate,
      ]);

      setPendingGroupedApprovals((prev) => {
        const updated = { ...prev };
        const items = updated[selectedIndentId] || [];
        const remainingItems = items.filter(
          (item) => !submittedIdsSet.has(item.id),
        );

        if (remainingItems.length === 0) {
          delete updated[selectedIndentId];
        } else {
          updated[selectedIndentId] = remainingItems;
        }
        return updated;
      });

      setIndentStatuses((prev) => {
        const next = { ...prev };
        submittedIdsSet.forEach((id) => {
          delete next[id];
        });
        return next;
      });

      fetchApprovals();
    } catch (error) {
      console.error("Error submitting approvals:", error);
      // Compensating rollback if error occurs
      try {
        if (selectedIndentId) {
          await supabase
            .from("purchase_approved_indent_items")
            .delete()
            .eq("unique_indent_id", selectedIndentId);
        }
        if (rejectedIdsToUpdate && rejectedIdsToUpdate.length > 0) {
          await supabase
            .from("purchase_indent_items")
            .update({ approval_status: "pending" })
            .in("id", rejectedIdsToUpdate);
        }
      } catch (rbErr) {
        console.error("Failed to cleanly rollback approval error:", rbErr);
      }
      alert(
        "Approval Submission Restricted: " +
          (error.message ||
            "Could not sync audit records to purchase_dashboard. All changes have been rolled back. Please try again."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  // React Query handles loading on mount automatically, fetchApprovals is only needed for manual action refreshes

  const calculateTotalOrderBox = (items) => {
    return items
      .reduce((sum, item) => sum + (parseFloat(item.order_box) || 0), 0)
      .toFixed(2);
  };

  const calculateTotalOrderQty = (items) => {
    return items
      .reduce((sum, item) => sum + (parseFloat(item.order_qty) || 0), 0)
      .toFixed(2);
  };

  const thStyle = {
    padding: "8px 10px",
    textAlign: "left",
    fontSize: "11px",
    fontWeight: "700",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    borderBottom: "2px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    whiteSpace: "pre-line",
    lineHeight: "1.25",
    verticalAlign: "bottom",
  };

  const tdStyle = {
    padding: "8px 10px",
    fontSize: "13px",
    color: "#1e293b",
    borderBottom: "1px solid #e2e8f0",
    fontWeight: "500",
    verticalAlign: "middle",
  };

  const checkDateRange = (createdAt) => {
    if (!createdAt) return true;
    const date = new Date(createdAt);
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (date < start) return false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (date > end) return false;
    }
    return true;
  };

  const checkSearchQuery = (groupKey, items) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    // Match Indent Display Label / ID
    const indentDisplayLabel = groupKey.includes("::")
      ? groupKey.split("::")[1]
      : groupKey;
    if (indentDisplayLabel.toLowerCase().includes(q)) return true;

    // Match Shop Name
    const shopName = items[0]?.shop_name || "";
    if (shopName.toLowerCase().includes(q)) return true;

    // Match Party Name
    const partyName = items[0]?.party_name || "";
    if (partyName.toLowerCase().includes(q)) return true;

    return false;
  };

  const pendingBatches = Object.entries(pendingGroupedApprovals).filter(
    ([baseId, items]) => {
      const shopOk =
        !selectedShop ||
        selectedShop === "All" ||
        (items[0]?.shop_name || "").trim().toLowerCase() ===
          selectedShop.trim().toLowerCase();
      const dateOk = checkDateRange(items[0]?.created_at);
      const searchOk = checkSearchQuery(baseId, items);
      // Batches in pendingGroupedApprovals that have active pending items
      return (
        shopOk &&
        dateOk &&
        searchOk &&
        items.some(
          (item) =>
            !item.is_excluded &&
            (!item.approval_status || item.approval_status === "pending"),
        )
      );
    },
  );

  const historyBatches = Object.entries(historyGroupedApprovals).filter(
    ([baseId, items]) => {
      const shopOk =
        !selectedShop ||
        selectedShop === "All" ||
        (items[0]?.shop_name || "").trim().toLowerCase() ===
          selectedShop.trim().toLowerCase();
      const dateOk = checkDateRange(items[0]?.created_at);
      const searchOk = checkSearchQuery(baseId, items);
      const activeItems = items.filter((item) => !item.is_excluded);
      return shopOk && dateOk && searchOk && activeItems.length > 0;
    },
  );

  const displayedBatches =
    activeTab === "pending" ? pendingBatches : historyBatches;

  return (
    <div
      className="page-container"
      style={{
        padding: "20px",
        maxWidth: "100%",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            margin: 0,
            fontSize: "28px",
            fontWeight: "700",
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          Approval Batches
        </h1>
        <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "15px" }}>
          Review indent submissions batched by Indent ID
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginBottom: "24px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <button
          onClick={() => setActiveTab("pending")}
          style={{
            padding: "12px 24px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "pending"
                ? "2px solid #4f46e5"
                : "2px solid transparent",
            color: activeTab === "pending" ? "#4f46e5" : "#64748b",
            fontWeight: "600",
            fontSize: "15px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          Pending ({pendingBatches.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={{
            padding: "12px 24px",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === "history"
                ? "2px solid #4f46e5"
                : "2px solid transparent",
            color: activeTab === "history" ? "#4f46e5" : "#64748b",
            fontWeight: "600",
            fontSize: "15px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          History ({historyBatches.length})
        </button>
      </div>

      {/* Controls: Search & Date Filters */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          padding: "16px",
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Search Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: "1",
            minWidth: "260px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by Indent ID, Shop Name or Party Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px 10px 38px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#1e293b",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
              fontWeight: "500",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#4f46e5")}
            onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{ fontSize: "14px", fontWeight: "600", color: "#475569" }}
            >
              From:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1e293b",
                outline: "none",
                fontWeight: "500",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{ fontSize: "14px", fontWeight: "600", color: "#475569" }}
            >
              To:
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
                color: "#1e293b",
                outline: "none",
                fontWeight: "500",
              }}
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                color: "#475569",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#e2e8f0")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#f1f5f9")
              }
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {showLoadingScreen ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px",
            color: "#94a3b8",
          }}
        >
          <Loader2
            style={{
              animation: "spin 1s linear infinite",
              width: "40px",
              height: "40px",
              marginBottom: "16px",
            }}
          />
          <p>Loading batched data from Supabase...</p>
        </div>
      ) : displayedBatches.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 20px",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
            border: "1px dashed #cbd5e1",
            color: "#64748b",
          }}
        >
          <Archive
            style={{
              width: "48px",
              height: "48px",
              color: "#cbd5e1",
              marginBottom: "16px",
            }}
          />
          <p style={{ fontSize: "16px", fontWeight: "500", color: "#475569" }}>
            {activeTab === "pending"
              ? "No pending indent items found"
              : "No history found"}
          </p>
          <p style={{ fontSize: "14px", marginTop: "4px" }}>
            {activeTab === "pending"
              ? "Upload and submit a CSV on the Indent page to see data here."
              : "Submit some approvals to see them in history."}
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "center" }}>Action</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Indent ID</th>
                  <th style={thStyle}>Shop Name</th>
                  {activeTab === "history" && (
                    <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                  )}
                  <th style={thStyle}>Party Name</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>
                    {activeTab === "pending" ? "Created At" : "Approved At"}
                  </th>
                  <th style={{ ...thStyle, textAlign: "center" }}>
                    Total Order Qty
                  </th>
                  <th style={{ ...thStyle, textAlign: "center" }}>
                    Total Order Box
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedBatches.map(([groupKey, items], index) => {
                  // Extract the human-readable label (e.g. "IN-1") from the scoped key
                  const indentDisplayLabel = groupKey.includes("::")
                    ? groupKey.split("::")[1]
                    : groupKey;
                  return (
                    <tr
                      key={groupKey}
                      style={{
                        backgroundColor:
                          index % 2 === 0 ? "#ffffff" : "#f8fafc",
                        cursor: "pointer",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#f1f5f9")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          index % 2 === 0 ? "#ffffff" : "#f8fafc")
                      }
                      onClick={() => handleOpenIndent(groupKey)}
                    >
                      <td
                        style={{ ...tdStyle, textAlign: "center" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <button
                            onClick={() => handleOpenIndent(groupKey)}
                            style={{
                              position: "relative",
                              background: "#e0e7ff", // Soft indigo background
                              border: "none",
                              color: "#4338ca", // Darker indigo text
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "6px 16px",
                              borderRadius: "6px",
                              fontWeight: "600",
                              fontSize: "13px",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#c7d2fe")
                            } // Slightly darker soft indigo on hover
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#e0e7ff")
                            }
                            title={
                              activeTab === "pending"
                                ? "Update items"
                                : "View items"
                            }
                          >
                            {activeTab === "pending" ? "Update" : "View"}
                            {activeTab === "pending" && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: "-8px",
                                  right: "-8px",
                                  backgroundColor: "#fee2e2", // Soft red/pink background
                                  color: "#dc2626", // Darker red text
                                  borderRadius: "50%",
                                  width: "20px",
                                  height: "20px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  fontWeight: "bold",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                  border: "1px solid #fca5a5", // Subtle border for definition
                                }}
                              >
                                {
                                  items.filter((item) => !item.is_excluded)
                                    .length
                                }
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(groupKey, items)}
                            style={{
                              background: "#fee2e2", // Soft red background
                              border: "none",
                              color: "#dc2626", // Dark red text
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "8px",
                              borderRadius: "6px",
                              transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#fca5a5")
                            } // Slightly darker soft red on hover
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#fee2e2")
                            }
                            title="Delete entire batch"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          color: "#4338ca",
                          fontWeight: "600",
                        }}
                      >
                        {indentDisplayLabel}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "left" }}>
                        {items[0]?.shop_name || "-"}
                      </td>
                      {activeTab === "history" && (
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "10px",
                              backgroundColor: "#f8fafc",
                              padding: "4px 10px",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: "#16a34a",
                                fontWeight: "600",
                                fontSize: "12px",
                              }}
                              title="Approved"
                            >
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  backgroundColor: "#22c55e",
                                  boxShadow: "0 0 0 2px #dcfce7",
                                }}
                              ></span>
                              {
                                items.filter(
                                  (i) =>
                                    !i.is_excluded &&
                                    indentStatuses[i.id] === "approved",
                                ).length
                              }
                            </div>
                            <div
                              style={{
                                width: "1px",
                                height: "14px",
                                backgroundColor: "#e2e8f0",
                              }}
                            ></div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                color: "#dc2626",
                                fontWeight: "600",
                                fontSize: "12px",
                              }}
                              title="Rejected"
                            >
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  borderRadius: "50%",
                                  backgroundColor: "#ef4444",
                                  boxShadow: "0 0 0 2px #fee2e2",
                                }}
                              ></span>
                              {
                                items.filter(
                                  (i) =>
                                    !i.is_excluded &&
                                    indentStatuses[i.id] === "rejected",
                                ).length
                              }
                            </div>
                          </div>
                        </td>
                      )}
                      <td style={{ ...tdStyle, textAlign: "left" }}>
                        {items[0]?.party_name || "-"}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {formatDateTime(items[0]?.created_at)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          fontWeight: "700",
                          color: "#0f172a",
                        }}
                      >
                        {calculateTotalOrderQty(items)}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          fontWeight: "700",
                          color: "#0f172a",
                        }}
                      >
                        {calculateTotalOrderBox(items)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedIndentId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "96vw",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#0f172a",
                  }}
                >
                  Details for{" "}
                  {selectedIndentId?.includes("::")
                    ? selectedIndentId.split("::")[1]
                    : selectedIndentId}
                </h2>
                <div
                  style={{
                    margin: "8px 0 0",
                    display: "flex",
                    gap: "14px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Party:{" "}
                    <strong style={{ color: "#0f172a" }}>
                      {groupedApprovals[selectedIndentId]?.[0]?.party_name ||
                        "Unknown"}
                    </strong>
                  </span>
                  <span
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: "#cbd5e1",
                    }}
                  ></span>

                  {/* Company Name Single Selection Dropdown Filter */}
                  {(() => {
                    const currentBatchItems =
                      groupedApprovals[selectedIndentId] || [];
                    const uniqueCompanies = Array.from(
                      new Set(
                        currentBatchItems
                          .map((i) => resolveItemCompany(i))
                          .filter(Boolean),
                      ),
                    ).sort((a, b) => a.localeCompare(b));

                    const noCompanyCount = currentBatchItems.filter(
                      (i) => !i.is_excluded && !resolveItemCompany(i),
                    ).length;

                    return (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <label
                          htmlFor="modalCompanyFilter"
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#334155",
                          }}
                        >
                          Company:
                        </label>
                        <select
                          id="modalCompanyFilter"
                          value={selectedCompanyFilter}
                          onChange={(e) =>
                            setSelectedCompanyFilter(e.target.value)
                          }
                          style={{
                            padding: "4px 10px",
                            fontSize: "12px",
                            fontWeight: "600",
                            borderRadius: "8px",
                            border: "1.5px solid #cbd5e1",
                            backgroundColor: "#f8fafc",
                            color: "#1e293b",
                            outline: "none",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                          }}
                          onFocus={(e) =>
                            (e.currentTarget.style.borderColor = "#4338ca")
                          }
                          onBlur={(e) =>
                            (e.currentTarget.style.borderColor = "#cbd5e1")
                          }
                        >
                          <option value="All">
                            All Companies (
                            {
                              currentBatchItems.filter((i) => !i.is_excluded)
                                .length
                            }
                            )
                          </option>
                          {uniqueCompanies.map((comp) => {
                            const count = currentBatchItems.filter(
                              (i) =>
                                !i.is_excluded &&
                                resolveItemCompany(i).toLowerCase() ===
                                  comp.toLowerCase(),
                            ).length;
                            return (
                              <option key={comp} value={comp}>
                                {comp} ({count})
                              </option>
                            );
                          })}
                          {noCompanyCount > 0 && (
                            <option value="__NONE__">
                              Unassigned / None ({noCompanyCount})
                            </option>
                          )}
                        </select>
                        <span
                          style={{
                            width: "4px",
                            height: "4px",
                            borderRadius: "50%",
                            backgroundColor: "#cbd5e1",
                          }}
                        ></span>
                      </div>
                    );
                  })()}

                  <span
                    style={{
                      fontSize: "13px",
                      color: "#16a34a",
                      fontWeight: "600",
                    }}
                  >
                    Approved: {approvedCount}
                  </span>
                  <span
                    style={{
                      width: "4px",
                      height: "4px",
                      borderRadius: "50%",
                      backgroundColor: "#cbd5e1",
                    }}
                  ></span>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#dc2626",
                      fontWeight: "600",
                    }}
                  >
                    Rejected: {rejectedCount}
                  </span>
                  {activeTab !== "history" && (
                    <>
                      <span
                        style={{
                          width: "4px",
                          height: "4px",
                          borderRadius: "50%",
                          backgroundColor: "#cbd5e1",
                        }}
                      ></span>
                      <span
                        style={{
                          fontSize: "13px",
                          color: "#eab308",
                          fontWeight: "600",
                        }}
                      >
                        Unchecked: {pendingCount}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                {activeTab !== "history" && (
                  <button
                    onClick={handleSubmitApprovals}
                    disabled={isLoading}
                    style={{
                      background: isLoading ? "#94a3b8" : "#10b981",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 20px",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading)
                        e.currentTarget.style.backgroundColor = "#059669";
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading)
                        e.currentTarget.style.backgroundColor = "#10b981";
                    }}
                  >
                    {isLoading && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    {isLoading ? "Submitting..." : "Submit"}
                  </button>
                )}
                {activeTab !== "history" &&
                  groupedApprovals[selectedIndentId]?.some((item) => {
                    if (!item.already_in_lifecycle) return false;
                    return isItemInSelectedCompany(item);
                  }) && (
                    <button
                      onClick={() => setShowInProcessModal(true)}
                      style={{
                        background: "#2563eb",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 20px",
                        fontWeight: "600",
                        fontSize: "14px",
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#1d4ed8")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "#2563eb")
                      }
                    >
                      View In-Process (
                      {
                        groupedApprovals[selectedIndentId]?.filter((item) => {
                          if (!item.already_in_lifecycle) return false;
                          return isItemInSelectedCompany(item);
                        }).length
                      }
                      )
                    </button>
                  )}
                {activeTab !== "history" &&
                  groupedApprovals[selectedIndentId]?.some((item) => {
                    if (!item.is_excluded) return false;
                    return isItemInSelectedCompany(item);
                  }) && (
                    <button
                      onClick={() => setShowExcludedModal(true)}
                      style={{
                        background: "#ef4444",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "8px 20px",
                        fontWeight: "600",
                        fontSize: "14px",
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor = "#dc2626")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "#ef4444")
                      }
                    >
                      View Excluded (
                      {
                        groupedApprovals[selectedIndentId]?.filter((item) => {
                          if (!item.is_excluded) return false;
                          return isItemInSelectedCompany(item);
                        }).length
                      }
                      )
                    </button>
                  )}
                <button
                  onClick={handleCloseIndent}
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#64748b",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#e2e8f0";
                    e.currentTarget.style.color = "#0f172a";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#f1f5f9";
                    e.currentTarget.style.color = "#64748b";
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ padding: "24px", overflowY: "auto" }}>
              {/* Sort Controls Toolbar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "700",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Sort Items:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (modalSortField === "name") {
                        setModalSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                      } else {
                        setModalSortField("name");
                        setModalSortDir("asc");
                      }
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border:
                        modalSortField === "name"
                          ? "1px solid #6366f1"
                          : "1px solid #cbd5e1",
                      backgroundColor:
                        modalSortField === "name" ? "#eef2ff" : "#ffffff",
                      color: modalSortField === "name" ? "#4338ca" : "#475569",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                      boxShadow:
                        modalSortField === "name"
                          ? "0 1px 3px rgba(99,102,241,0.2)"
                          : "none",
                    }}
                  >
                    {modalSortField === "name" ? (
                      modalSortDir === "asc" ? (
                        <ArrowUp size={13} color="#4338ca" />
                      ) : (
                        <ArrowDown size={13} color="#4338ca" />
                      )
                    ) : (
                      <ArrowUpDown size={13} />
                    )}
                    Sort by Name{" "}
                    {modalSortField === "name"
                      ? modalSortDir === "asc"
                        ? "(A-Z)"
                        : "(Z-A)"
                      : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (modalSortField === "size") {
                        setModalSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                      } else {
                        setModalSortField("size");
                        setModalSortDir("asc");
                      }
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border:
                        modalSortField === "size"
                          ? "1px solid #6366f1"
                          : "1px solid #cbd5e1",
                      backgroundColor:
                        modalSortField === "size" ? "#eef2ff" : "#ffffff",
                      color: modalSortField === "size" ? "#4338ca" : "#475569",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                      boxShadow:
                        modalSortField === "size"
                          ? "0 1px 3px rgba(99,102,241,0.2)"
                          : "none",
                    }}
                  >
                    {modalSortField === "size" ? (
                      modalSortDir === "asc" ? (
                        <ArrowUp size={13} color="#4338ca" />
                      ) : (
                        <ArrowDown size={13} color="#4338ca" />
                      )
                    ) : (
                      <ArrowUpDown size={13} />
                    )}
                    Sort by Size (MLS){" "}
                    {modalSortField === "size"
                      ? modalSortDir === "asc"
                        ? "(Low-High)"
                        : "(High-Low)"
                      : ""}
                  </button>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    color: "#94a3b8",
                    fontWeight: "600",
                  }}
                >
                  Showing {sortedActiveBatchItems.length} items
                </span>
              </div>

              <div
                style={{
                  overflowX: "auto",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...thStyle,
                          textAlign: "center",
                          minWidth: "150px",
                        }}
                      >
                        <div>Approve / Reject</div>
                        {activeTab !== "history" && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "8px",
                              marginTop: "4px",
                              textTransform: "none",
                              fontWeight: "normal",
                              fontSize: "11px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectAllFiltered("approved")
                              }
                              style={{
                                background:
                                  activeBatchItems.length > 0 &&
                                  activeBatchItems.every(
                                    (i) => indentStatuses[i.id] === "approved",
                                  )
                                    ? "#16a34a"
                                    : "#dcfce7",
                                color:
                                  activeBatchItems.length > 0 &&
                                  activeBatchItems.every(
                                    (i) => indentStatuses[i.id] === "approved",
                                  )
                                    ? "#ffffff"
                                    : "#166534",
                                border: "1px solid #86efac",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              title="Approve all visible items in this filter"
                            >
                              ✓ All
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSelectAllFiltered("rejected")
                              }
                              style={{
                                background:
                                  activeBatchItems.length > 0 &&
                                  activeBatchItems.every(
                                    (i) => indentStatuses[i.id] === "rejected",
                                  )
                                    ? "#dc2626"
                                    : "#fee2e2",
                                color:
                                  activeBatchItems.length > 0 &&
                                  activeBatchItems.every(
                                    (i) => indentStatuses[i.id] === "rejected",
                                  )
                                    ? "#ffffff"
                                    : "#991b1b",
                                border: "1px solid #fca5a5",
                                borderRadius: "4px",
                                padding: "2px 6px",
                                fontSize: "11px",
                                fontWeight: "600",
                                cursor: "pointer",
                                transition: "all 0.15s",
                              }}
                              title="Reject all visible items in this filter"
                            >
                              ✗ All
                            </button>
                          </div>
                        )}
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        Indent{"\n"}ID
                      </th>
                      <th style={{ ...thStyle, textAlign: "left" }}>
                        Shop{"\n"}Name
                      </th>
                      <th
                        onClick={() => {
                          if (modalSortField === "name") {
                            setModalSortDir((prev) =>
                              prev === "asc" ? "desc" : "asc",
                            );
                          } else {
                            setModalSortField("name");
                            setModalSortDir("asc");
                          }
                        }}
                        style={{
                          ...thStyle,
                          textAlign: "left",
                          minWidth: "160px",
                          cursor: "pointer",
                          userSelect: "none",
                          backgroundColor:
                            modalSortField === "name" ? "#f1f5f9" : undefined,
                        }}
                        title="Click to sort by Item Name"
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>Item Name</span>
                          {modalSortField === "name" ? (
                            modalSortDir === "asc" ? (
                              <ArrowUp size={13} color="#4f46e5" />
                            ) : (
                              <ArrowDown size={13} color="#4f46e5" />
                            )
                          ) : (
                            <ArrowUpDown size={12} color="#94a3b8" />
                          )}
                        </div>
                      </th>
                      <th
                        style={{
                          ...thStyle,
                          textAlign: "left",
                          minWidth: "130px",
                        }}
                      >
                        Company{"\n"}Name
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        Per Day{"\n"}Sale
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        Order{"\n"}Box
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        Order{"\n"}Qty
                      </th>
                      <th
                        style={{
                          ...thStyle,
                          textAlign: "center",
                          color: "#4338ca",
                        }}
                      >
                        Approved{"\n"}Box
                      </th>
                      <th
                        style={{
                          ...thStyle,
                          textAlign: "center",
                          color: "#4338ca",
                        }}
                      >
                        Approved{"\n"}Qty
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        Closing{"\n"}Qty
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>B/Cs</th>
                      <th
                        onClick={() => {
                          if (modalSortField === "size") {
                            setModalSortDir((prev) =>
                              prev === "asc" ? "desc" : "asc",
                            );
                          } else {
                            setModalSortField("size");
                            setModalSortDir("asc");
                          }
                        }}
                        style={{
                          ...thStyle,
                          textAlign: "center",
                          cursor: "pointer",
                          userSelect: "none",
                          backgroundColor:
                            modalSortField === "size" ? "#f1f5f9" : undefined,
                        }}
                        title="Click to sort by Size (MLS)"
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                          }}
                        >
                          <span>Mls</span>
                          {modalSortField === "size" ? (
                            modalSortDir === "asc" ? (
                              <ArrowUp size={13} color="#4f46e5" />
                            ) : (
                              <ArrowDown size={13} color="#4f46e5" />
                            )
                          ) : (
                            <ArrowUpDown size={12} color="#94a3b8" />
                          )}
                        </div>
                      </th>
                      <th style={{ ...thStyle, textAlign: "center" }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActiveBatchItems.map((item, index) => {
                      // Use nullish coalescing so a falsy but valid id (e.g. 0) is never
                      // replaced by the loop index, which would cause status key collisions.
                      const itemId =
                        item.id ?? `fallback-${selectedIndentId}-${index}`;
                      return (
                        <tr
                          key={itemId}
                          style={{
                            backgroundColor:
                              index % 2 === 0 ? "#ffffff" : "#f8fafc",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor = "#f1f5f9")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              index % 2 === 0 ? "#ffffff" : "#f8fafc")
                          }
                        >
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              minWidth: "135px",
                            }}
                          >
                            {activeTab === "history" ? (
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  backgroundColor:
                                    indentStatuses[itemId] === "approved"
                                      ? "#dcfce7"
                                      : "#fee2e2",
                                  color:
                                    indentStatuses[itemId] === "approved"
                                      ? "#16a34a"
                                      : "#dc2626",
                                }}
                              >
                                {indentStatuses[itemId] === "approved"
                                  ? "Approved"
                                  : "Rejected"}
                              </span>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                  justifyContent: "center",
                                }}
                              >
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    cursor: "pointer",
                                    color:
                                      indentStatuses[itemId] === "approved"
                                        ? "#16a34a"
                                        : "#64748b",
                                    fontWeight: "500",
                                    transition: "all 0.2s",
                                    fontSize: "13px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      indentStatuses[itemId] === "approved"
                                    }
                                    onChange={() =>
                                      handleStatusChange(itemId, "approved")
                                    }
                                    style={{
                                      width: "16px",
                                      height: "16px",
                                      accentColor: "#16a34a",
                                      cursor: "pointer",
                                    }}
                                  />
                                  Approve
                                </label>
                                <label
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    cursor: "pointer",
                                    color:
                                      indentStatuses[itemId] === "rejected"
                                        ? "#dc2626"
                                        : "#64748b",
                                    fontWeight: "500",
                                    transition: "all 0.2s",
                                    fontSize: "13px",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={
                                      indentStatuses[itemId] === "rejected"
                                    }
                                    onChange={() =>
                                      handleStatusChange(itemId, "rejected")
                                    }
                                    style={{
                                      width: "16px",
                                      height: "16px",
                                      accentColor: "#dc2626",
                                      cursor: "pointer",
                                    }}
                                  />
                                  Reject
                                </label>
                              </div>
                            )}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              color: "#64748b",
                            }}
                          >
                            {item.party_indent_id || "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left" }}>
                            {item.shop_name || "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left" }}>
                            {item.item_name}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "left",
                              color: "#475569",
                            }}
                          >
                            {resolveItemCompany(item) ||
                              item.company_name ||
                              "-"}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              fontWeight: "700",
                              color: "#0f172a",
                            }}
                          >
                            {item.per_day_sale_last_month !== null &&
                            item.per_day_sale_last_month !== undefined
                              ? item.per_day_sale_last_month
                              : "—"}
                          </td>
                          {/* Order Box (Read-only System Auto-Calculated) */}
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              color: "#64748b",
                              fontWeight: "600",
                            }}
                          >
                            {item.order_box !== undefined &&
                            item.order_box !== null
                              ? item.order_box
                              : "—"}
                          </td>
                          {/* Order Qty (Read-only System Auto-Calculated) */}
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              color: "#64748b",
                              fontWeight: "600",
                            }}
                          >
                            {item.order_qty !== undefined &&
                            item.order_qty !== null
                              ? item.order_qty
                              : "—"}
                          </td>
                          {/* Approved Box (Editable input pre-filled with approved_box or order_box) */}
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              padding:
                                activeTab === "history"
                                  ? "8px 10px"
                                  : "4px 6px",
                            }}
                          >
                            {activeTab === "history" ? (
                              <span
                                style={{ fontWeight: "700", color: "#4338ca" }}
                              >
                                {item.approved_box ?? item.order_box ?? "-"}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={
                                  item.approved_box !== undefined &&
                                  item.approved_box !== null
                                    ? item.approved_box
                                    : (item.order_box ?? "")
                                }
                                onChange={(e) =>
                                  handleInlineChange(
                                    item.id,
                                    "approved_box",
                                    e.target.value,
                                  )
                                }
                                style={inlineInputStyle}
                                placeholder="-"
                              />
                            )}
                          </td>
                          {/* Approved Qty (Editable input pre-filled with approved_qty or order_qty) */}
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "center",
                              padding:
                                activeTab === "history"
                                  ? "8px 10px"
                                  : "4px 6px",
                            }}
                          >
                            {activeTab === "history" ? (
                              <span
                                style={{ fontWeight: "700", color: "#4338ca" }}
                              >
                                {item.approved_qty ?? item.order_qty ?? "-"}
                              </span>
                            ) : (
                              <input
                                type="number"
                                step="any"
                                value={
                                  item.approved_qty !== undefined &&
                                  item.approved_qty !== null
                                    ? item.approved_qty
                                    : (item.order_qty ?? "")
                                }
                                onChange={(e) =>
                                  handleInlineChange(
                                    item.id,
                                    "approved_qty",
                                    e.target.value,
                                  )
                                }
                                style={inlineInputStyle}
                                placeholder="-"
                              />
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {item.closing_qty || "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {item.bcs || "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {item.mls || "-"}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            <button
                              onClick={() =>
                                handleDeleteItem(item.id, item.item_name, item)
                              }
                              style={{
                                background: "#fee2e2",
                                border: "none",
                                color: "#dc2626",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                padding: "8px",
                                borderRadius: "6px",
                                transition: "background-color 0.2s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#fca5a5")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.backgroundColor =
                                  "#fee2e2")
                              }
                              title="Delete item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Excluded Items Modal Overlay */}
              {showExcludedModal && (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10005,
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      width: "100%",
                      maxWidth: "96vw",
                      maxHeight: "85vh",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <div
                      style={{
                        padding: "20px 24px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "18px",
                            fontWeight: "700",
                            color: "#dc2626",
                          }}
                        >
                          Excluded Products for{" "}
                          {selectedIndentId?.includes("::")
                            ? selectedIndentId.split("::")[1]
                            : selectedIndentId}
                        </h2>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "13px",
                            color: "#64748b",
                          }}
                        >
                          These items were excluded due to negative or low
                          indent calculations. Search and click "+ Include" to
                          add them back.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowExcludedModal(false);
                          setExcludedSearchQuery("");
                        }}
                        style={{
                          background: "#f1f5f9",
                          border: "none",
                          borderRadius: "50%",
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#64748b",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e2e8f0";
                          e.currentTarget.style.color = "#0f172a";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.color = "#64748b";
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Search Field & Sort Controls */}
                    <div
                      style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
                        <Search
                          size={16}
                          style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#94a3b8",
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Search excluded items by item name, company, or brand..."
                          value={excludedSearchQuery}
                          onChange={(e) =>
                            setExcludedSearchQuery(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "8px 12px 8px 36px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                          Sort:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (excludedSortField === "name") {
                              setExcludedSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                            } else {
                              setExcludedSortField("name");
                              setExcludedSortDir("asc");
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: excludedSortField === "name" ? "1px solid #dc2626" : "1px solid #cbd5e1",
                            backgroundColor: excludedSortField === "name" ? "#fef2f2" : "#ffffff",
                            color: excludedSortField === "name" ? "#dc2626" : "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {excludedSortField === "name" ? (
                            excludedSortDir === "asc" ? <ArrowUp size={13} color="#dc2626" /> : <ArrowDown size={13} color="#dc2626" />
                          ) : (
                            <ArrowUpDown size={13} />
                          )}
                          Name {excludedSortField === "name" ? (excludedSortDir === "asc" ? "(A-Z)" : "(Z-A)") : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (excludedSortField === "size") {
                              setExcludedSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                            } else {
                              setExcludedSortField("size");
                              setExcludedSortDir("asc");
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: excludedSortField === "size" ? "1px solid #dc2626" : "1px solid #cbd5e1",
                            backgroundColor: excludedSortField === "size" ? "#fef2f2" : "#ffffff",
                            color: excludedSortField === "size" ? "#dc2626" : "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {excludedSortField === "size" ? (
                            excludedSortDir === "asc" ? <ArrowUp size={13} color="#dc2626" /> : <ArrowDown size={13} color="#dc2626" />
                          ) : (
                            <ArrowUpDown size={13} />
                          )}
                          Size (MLS) {excludedSortField === "size" ? (excludedSortDir === "asc" ? "(Low-High)" : "(High-Low)") : ""}
                        </button>
                      </div>
                    </div>

                    {/* Table of Excluded Items */}
                    <div
                      style={{ padding: "24px", overflowY: "auto", flex: 1 }}
                    >
                      <div
                        style={{
                          overflowX: "auto",
                          borderRadius: "8px",
                          border: "1px solid #fee2e2",
                        }}
                      >
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            textAlign: "left",
                          }}
                        >
                          <thead>
                            <tr style={{ backgroundColor: "#fef2f2" }}>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "center",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Action
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Indent{"\n"}ID
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Shop{"\n"}Name
                              </th>
                              <th
                                onClick={() => {
                                  if (excludedSortField === "name") {
                                    setExcludedSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                                  } else {
                                    setExcludedSortField("name");
                                    setExcludedSortDir("asc");
                                  }
                                }}
                                style={{
                                  ...thStyle,
                                  backgroundColor: excludedSortField === "name" ? "#fee2e2" : "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                title="Click to sort by Item Name"
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                  <span>Item Name</span>
                                  {excludedSortField === "name" ? (
                                    excludedSortDir === "asc" ? <ArrowUp size={13} color="#991b1b" /> : <ArrowDown size={13} color="#991b1b" />
                                  ) : (
                                    <ArrowUpDown size={12} color="#fca5a5" />
                                  )}
                                </div>
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Company{"\n"}Name
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Per Day{"\n"}Sale
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Order{"\n"}Box
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Order{"\n"}Qty
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                Closing{"\n"}Qty
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                }}
                              >
                                B/Cs
                              </th>
                              <th
                                onClick={() => {
                                  if (excludedSortField === "size") {
                                    setExcludedSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                                  } else {
                                    setExcludedSortField("size");
                                    setExcludedSortDir("asc");
                                  }
                                }}
                                style={{
                                  ...thStyle,
                                  backgroundColor: excludedSortField === "size" ? "#fee2e2" : "#fef2f2",
                                  color: "#991b1b",
                                  borderBottom: "2px solid #fca5a5",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                title="Click to sort by Size (MLS)"
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                  <span>Mls</span>
                                  {excludedSortField === "size" ? (
                                    excludedSortDir === "asc" ? <ArrowUp size={13} color="#991b1b" /> : <ArrowDown size={13} color="#991b1b" />
                                  ) : (
                                    <ArrowUpDown size={12} color="#fca5a5" />
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const query = (excludedSearchQuery || "")
                                .trim()
                                .toLowerCase();
                              const filteredItems = (
                                groupedApprovals[selectedIndentId] || []
                              ).filter((item) => {
                                if (!item.is_excluded) return false;
                                if (!isItemInSelectedCompany(item))
                                  return false;
                                const itemName = (
                                  item.item_name || ""
                                ).toLowerCase();
                                const brandName = (
                                  item.brand_name || ""
                                ).toLowerCase();
                                const compName = (
                                  resolveItemCompany(item) ||
                                  item.company_name ||
                                  ""
                                ).toLowerCase();
                                return (
                                  itemName.includes(query) ||
                                  brandName.includes(query) ||
                                  compName.includes(query)
                                );
                              });

                              if (filteredItems.length === 0) {
                                return (
                                  <tr>
                                    <td
                                      colSpan={11}
                                      style={{
                                        ...tdStyle,
                                        textAlign: "center",
                                        padding: "36px",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      No excluded items found matching your
                                      filter.
                                    </td>
                                  </tr>
                                );
                              }

                              const sortedExcludedItems = [...filteredItems].sort((a, b) => {
                                if (excludedSortField === "name") {
                                  const nameA = (a.item_name || a.itemName || "").trim().toLowerCase();
                                  const nameB = (b.item_name || b.itemName || "").trim().toLowerCase();
                                  const comp = nameA.localeCompare(nameB);
                                  if (comp !== 0) return excludedSortDir === "asc" ? comp : -comp;
                                  const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
                                  const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
                                  return mlA - mlB;
                                }
                                if (excludedSortField === "size") {
                                  const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
                                  const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
                                  const comp = mlA - mlB;
                                  if (comp !== 0) return excludedSortDir === "asc" ? comp : -comp;
                                  const nameA = (a.item_name || a.itemName || "").trim().toLowerCase();
                                  const nameB = (b.item_name || b.itemName || "").trim().toLowerCase();
                                  return nameA.localeCompare(nameB);
                                }
                                return 0;
                              });

                              return sortedExcludedItems.map((item, index) => {
                                const itemId =
                                  item.id ??
                                  `fallback-excl-${selectedIndentId}-${index}`;
                                return (
                                  <tr
                                    key={itemId}
                                    style={{
                                      backgroundColor:
                                        index % 2 === 0 ? "#ffffff" : "#fff5f5",
                                    }}
                                    onMouseEnter={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        "#fee2e2")
                                    }
                                    onMouseLeave={(e) =>
                                      (e.currentTarget.style.backgroundColor =
                                        index % 2 === 0 ? "#ffffff" : "#fff5f5")
                                    }
                                  >
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "center",
                                      }}
                                    >
                                      <button
                                        onClick={() =>
                                          handleIncludeExcludedItem(itemId)
                                        }
                                        style={{
                                          backgroundColor: "#dc2626",
                                          color: "#ffffff",
                                          border: "none",
                                          borderRadius: "6px",
                                          padding: "6px 12px",
                                          fontSize: "12px",
                                          fontWeight: "600",
                                          cursor: "pointer",
                                          transition: "all 0.2s",
                                          boxShadow:
                                            "0 1px 2px rgba(0,0,0,0.05)",
                                        }}
                                        onMouseEnter={(e) =>
                                          (e.currentTarget.style.backgroundColor =
                                            "#b91c1c")
                                        }
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.backgroundColor =
                                            "#dc2626")
                                        }
                                      >
                                        + Include
                                      </button>
                                    </td>
                                    <td
                                      style={{ ...tdStyle, color: "#991b1b" }}
                                    >
                                      {item.party_indent_id || "-"}
                                    </td>
                                    <td style={tdStyle}>
                                      {item.shop_name || "-"}
                                    </td>
                                    <td style={tdStyle}>{item.item_name}</td>
                                    <td
                                      style={{ ...tdStyle, color: "#7f1d1d" }}
                                    >
                                      {item.company_name || "-"}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "right",
                                        fontWeight: "700",
                                        color: "#dc2626",
                                      }}
                                    >
                                      {item.per_day_sale_last_month !== null &&
                                      item.per_day_sale_last_month !== undefined
                                        ? item.per_day_sale_last_month
                                        : "—"}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "right",
                                        fontWeight: "700",
                                        color: "#dc2626",
                                      }}
                                    >
                                      {item.order_box || "-"}
                                    </td>
                                    <td
                                      style={{
                                        ...tdStyle,
                                        textAlign: "right",
                                        fontWeight: "700",
                                        color: "#dc2626",
                                      }}
                                    >
                                      {item.order_qty || "-"}
                                    </td>
                                    <td
                                      style={{ ...tdStyle, textAlign: "right" }}
                                    >
                                      {item.closing_qty || "-"}
                                    </td>
                                    <td
                                      style={{ ...tdStyle, textAlign: "right" }}
                                    >
                                      {item.bcs || "-"}
                                    </td>
                                    <td style={tdStyle}>{item.mls || "-"}</td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* In-Process Items Modal Overlay */}
              {showInProcessModal && (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: "rgba(15, 23, 42, 0.6)",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10005,
                    padding: "20px",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      width: "100%",
                      maxWidth: "96vw",
                      maxHeight: "85vh",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <div
                      style={{
                        padding: "20px 24px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <h2
                          style={{
                            margin: 0,
                            fontSize: "18px",
                            fontWeight: "700",
                            color: "#1d4ed8",
                          }}
                        >
                          In-Process Items for{" "}
                          {selectedIndentId?.includes("::")
                            ? selectedIndentId.split("::")[1]
                            : selectedIndentId}
                        </h2>
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: "13px",
                            color: "#64748b",
                          }}
                        >
                          These items are currently active in the order-delivery
                          lifecycle for this shop. Approving them is disabled to
                          prevent duplicate orders.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowInProcessModal(false);
                          setInProcessSearchQuery("");
                        }}
                        style={{
                          background: "#f1f5f9",
                          border: "none",
                          borderRadius: "50%",
                          width: "36px",
                          height: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#64748b",
                          transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e2e8f0";
                          e.currentTarget.style.color = "#0f172a";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.color = "#64748b";
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Search Field & Sort Controls */}
                    <div
                      style={{
                        padding: "16px 24px",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        gap: "12px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ position: "relative", flex: 1, minWidth: "260px" }}>
                        <Search
                          size={16}
                          style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#94a3b8",
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Search in-process items by item name, company, or brand..."
                          value={inProcessSearchQuery}
                          onChange={(e) =>
                            setInProcessSearchQuery(e.target.value)
                          }
                          style={{
                            width: "100%",
                            padding: "8px 12px 8px 36px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "14px",
                            outline: "none",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                          Sort:
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (inProcessSortField === "name") {
                              setInProcessSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                            } else {
                              setInProcessSortField("name");
                              setInProcessSortDir("asc");
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: inProcessSortField === "name" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                            backgroundColor: inProcessSortField === "name" ? "#eff6ff" : "#ffffff",
                            color: inProcessSortField === "name" ? "#1e40af" : "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {inProcessSortField === "name" ? (
                            inProcessSortDir === "asc" ? <ArrowUp size={13} color="#1e40af" /> : <ArrowDown size={13} color="#1e40af" />
                          ) : (
                            <ArrowUpDown size={13} />
                          )}
                          Name {inProcessSortField === "name" ? (inProcessSortDir === "asc" ? "(A-Z)" : "(Z-A)") : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (inProcessSortField === "size") {
                              setInProcessSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                            } else {
                              setInProcessSortField("size");
                              setInProcessSortDir("asc");
                            }
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            border: inProcessSortField === "size" ? "1px solid #2563eb" : "1px solid #cbd5e1",
                            backgroundColor: inProcessSortField === "size" ? "#eff6ff" : "#ffffff",
                            color: inProcessSortField === "size" ? "#1e40af" : "#475569",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          {inProcessSortField === "size" ? (
                            inProcessSortDir === "asc" ? <ArrowUp size={13} color="#1e40af" /> : <ArrowDown size={13} color="#1e40af" />
                          ) : (
                            <ArrowUpDown size={13} />
                          )}
                          Size (MLS) {inProcessSortField === "size" ? (inProcessSortDir === "asc" ? "(Low-High)" : "(High-Low)") : ""}
                        </button>
                      </div>
                    </div>

                    {/* Table of In-Process Items */}
                    <div
                      style={{ padding: "24px", overflowY: "auto", flex: 1 }}
                    >
                      <div
                        style={{
                          overflowX: "auto",
                          borderRadius: "8px",
                          border: "1px solid #bfdbfe",
                        }}
                      >
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            textAlign: "left",
                          }}
                        >
                          <thead>
                            <tr style={{ backgroundColor: "#eff6ff" }}>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "center",
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Status / Action
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Indent{"\n"}ID
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Shop{"\n"}Name
                              </th>
                              <th
                                onClick={() => {
                                  if (inProcessSortField === "name") {
                                    setInProcessSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                                  } else {
                                    setInProcessSortField("name");
                                    setInProcessSortDir("asc");
                                  }
                                }}
                                style={{
                                  ...thStyle,
                                  backgroundColor: inProcessSortField === "name" ? "#dbeafe" : "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                title="Click to sort by Item Name"
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                  <span>Item Name</span>
                                  {inProcessSortField === "name" ? (
                                    inProcessSortDir === "asc" ? <ArrowUp size={13} color="#1e40af" /> : <ArrowDown size={13} color="#1e40af" />
                                  ) : (
                                    <ArrowUpDown size={12} color="#93c5fd" />
                                  )}
                                </div>
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Company{"\n"}Name
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Order{"\n"}Box
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Order{"\n"}Qty
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                Closing{"\n"}Qty
                              </th>
                              <th
                                style={{
                                  ...thStyle,
                                  textAlign: "right",
                                  backgroundColor: "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                }}
                              >
                                B/Cs
                              </th>
                              <th
                                onClick={() => {
                                  if (inProcessSortField === "size") {
                                    setInProcessSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
                                  } else {
                                    setInProcessSortField("size");
                                    setInProcessSortDir("asc");
                                  }
                                }}
                                style={{
                                  ...thStyle,
                                  backgroundColor: inProcessSortField === "size" ? "#dbeafe" : "#eff6ff",
                                  color: "#1e40af",
                                  borderBottom: "2px solid #93c5fd",
                                  cursor: "pointer",
                                  userSelect: "none",
                                }}
                                title="Click to sort by Size (MLS)"
                              >
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                                  <span>Mls</span>
                                  {inProcessSortField === "size" ? (
                                    inProcessSortDir === "asc" ? <ArrowUp size={13} color="#1e40af" /> : <ArrowDown size={13} color="#1e40af" />
                                  ) : (
                                    <ArrowUpDown size={12} color="#93c5fd" />
                                  )}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const query = (inProcessSearchQuery || "")
                                .trim()
                                .toLowerCase();
                              const currentItems =
                                groupedApprovals[selectedIndentId] || [];
                              const filteredInProcess = currentItems.filter(
                                (item) => {
                                  if (!item.already_in_lifecycle) return false;
                                  if (!isItemInSelectedCompany(item))
                                    return false;
                                  const itemName = (
                                    item.item_name || ""
                                  ).toLowerCase();
                                  const brandName = (
                                    item.brand_name || ""
                                  ).toLowerCase();
                                  const compName = (
                                    resolveItemCompany(item) ||
                                    item.company_name ||
                                    ""
                                  ).toLowerCase();
                                  return (
                                    itemName.includes(query) ||
                                    brandName.includes(query) ||
                                    compName.includes(query)
                                  );
                                },
                              );

                              if (filteredInProcess.length === 0) {
                                return (
                                  <tr>
                                    <td
                                      colSpan={10}
                                      style={{
                                        padding: "30px",
                                        textAlign: "center",
                                        color: "#64748b",
                                      }}
                                    >
                                      No in-process items found.
                                    </td>
                                  </tr>
                                );
                              }

                              const sortedInProcess = [...filteredInProcess].sort((a, b) => {
                                if (inProcessSortField === "name") {
                                  const nameA = (a.item_name || a.itemName || "").trim().toLowerCase();
                                  const nameB = (b.item_name || b.itemName || "").trim().toLowerCase();
                                  const comp = nameA.localeCompare(nameB);
                                  if (comp !== 0) return inProcessSortDir === "asc" ? comp : -comp;
                                  const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
                                  const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
                                  return mlA - mlB;
                                }
                                if (inProcessSortField === "size") {
                                  const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
                                  const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
                                  const comp = mlA - mlB;
                                  if (comp !== 0) return inProcessSortDir === "asc" ? comp : -comp;
                                  const nameA = (a.item_name || a.itemName || "").trim().toLowerCase();
                                  const nameB = (b.item_name || b.itemName || "").trim().toLowerCase();
                                  return nameA.localeCompare(nameB);
                                }
                                return 0;
                              });

                              return sortedInProcess.map((item, index) => (
                                <tr
                                  key={item.id || index}
                                  style={{
                                    backgroundColor:
                                      index % 2 === 0 ? "#ffffff" : "#f8fafc",
                                  }}
                                >
                                  <td
                                    style={{
                                      ...tdStyle,
                                      textAlign: "center",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          display: "inline-block",
                                          padding: "4px 10px",
                                          borderRadius: "6px",
                                          fontSize: "11px",
                                          fontWeight: "700",
                                          backgroundColor: "#dbeafe",
                                          color: "#1e40af",
                                        }}
                                      >
                                        Active in Lifecycle
                                      </span>
                                      <button
                                        onClick={() =>
                                          handleDeleteItem(
                                            item.id,
                                            item.item_name,
                                            item,
                                          )
                                        }
                                        style={{
                                          background: "#fee2e2",
                                          border: "none",
                                          color: "#dc2626",
                                          cursor: "pointer",
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          fontSize: "12px",
                                          fontWeight: "600",
                                        }}
                                        title="Delete held item"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle,
                                      color: "#1e40af",
                                      fontWeight: "600",
                                    }}
                                  >
                                    {item.party_indent_id || "-"}
                                  </td>
                                  <td style={tdStyle}>
                                    {item.shop_name || "-"}
                                  </td>
                                  <td style={{ ...tdStyle, fontWeight: "700" }}>
                                    {item.item_name}
                                  </td>
                                  <td style={{ ...tdStyle, color: "#1e3a8a" }}>
                                    {item.company_name || "-"}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle,
                                      textAlign: "right",
                                      fontWeight: "700",
                                      color: "#2563eb",
                                    }}
                                  >
                                    {item.order_box || "-"}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle,
                                      textAlign: "right",
                                      fontWeight: "700",
                                      color: "#2563eb",
                                    }}
                                  >
                                    {item.order_qty || "-"}
                                  </td>
                                  <td
                                    style={{ ...tdStyle, textAlign: "right" }}
                                  >
                                    {item.closing_qty || "-"}
                                  </td>
                                  <td
                                    style={{ ...tdStyle, textAlign: "right" }}
                                  >
                                    {item.bcs || "-"}
                                  </td>
                                  <td style={tdStyle}>{item.mls || "-"}</td>
                                </tr>
                              ));
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approval;
