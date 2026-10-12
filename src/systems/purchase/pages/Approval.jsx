import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useShopStore from "../store/useShopStore";
import useCompanyStore from "../store/useCompanyStore";
import useAuthStore from "../store/useAuthStore";
import "../styles/Pages.css";
import { supabase } from "../lib/supabase";
import { Loader2, Archive, X, Eye, Search, Trash2 } from "lucide-react";
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
    hour12: true
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
  const { selectedShop } = useShopStore();
  const { companies, fetchCompanies } = useCompanyStore();

  useEffect(() => {
    if (fetchCompanies) fetchCompanies();
  }, [fetchCompanies]);

  const [showExcludedModal, setShowExcludedModal] = useState(false);
  const [showInProcessModal, setShowInProcessModal] = useState(false);
  const [inProcessSearchQuery, setInProcessSearchQuery] = useState("");
  const [excludedSearchQuery, setExcludedSearchQuery] = useState("");
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
    const rawShop = (item?.shop_name || selectedShop || "").trim().toLowerCase();
    if (rawShop && rawShop !== "all") {
      const matched = companies.find(c => {
        const cName = (c.name || "").toLowerCase();
        return cName.includes(rawShop) || rawShop.includes(cName);
      });
      if (matched?.name) return matched.name;
    }
    return "";
  };

  const groupedApprovals = activeTab === "pending" ? pendingGroupedApprovals : historyGroupedApprovals;
  const setGroupedApprovals = activeTab === "pending" ? setPendingGroupedApprovals : setHistoryGroupedApprovals;

  useEffect(() => {
    setSelectedIndentId(null);
  }, [activeTab]);

  const modalItems = selectedIndentId ? (groupedApprovals[selectedIndentId] || []) : [];
  const isItemInSelectedCompany = (item) => {
    if (!item) return false;
    if (selectedCompanyFilter && selectedCompanyFilter !== 'All') {
      const comp = resolveItemCompany(item);
      if (selectedCompanyFilter === '__NONE__') {
        return !comp;
      }
      return comp.toLowerCase() === selectedCompanyFilter.trim().toLowerCase();
    }
    return true;
  };

  const activeBatchItems = modalItems.filter(item => !item.is_excluded && !item.already_in_lifecycle && isItemInSelectedCompany(item));
  const approvedCount = activeBatchItems.filter(item => indentStatuses[item.id] === 'approved').length;
  const rejectedCount = activeBatchItems.filter(item => indentStatuses[item.id] === 'rejected').length;
  const pendingCount = activeBatchItems.filter(item => !indentStatuses[item.id] || indentStatuses[item.id] === 'pending').length;

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
    setIndentStatuses(prev => ({
      ...prev,
      [itemId]: prev[itemId] === status ? null : status
    }));
  };

  const handleSelectAllFiltered = (status) => {
    if (activeBatchItems.length === 0) return;

    // If all target items already have this status, toggle them off (null); otherwise set all to status
    const allAlreadySet = activeBatchItems.every(item => indentStatuses[item.id] === status);
    const nextStatus = allAlreadySet ? null : status;

    setIndentStatuses(prev => {
      const next = { ...prev };
      activeBatchItems.forEach(item => {
        next[item.id] = nextStatus;
      });
      return next;
    });
  };

  const handleIncludeExcludedItem = (itemId) => {
    setGroupedApprovals(prev => {
      const updated = { ...prev };
      const currentItems = updated[selectedIndentId] || [];
      const itemIndex = currentItems.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        const item = { ...currentItems[itemIndex] };
        item.is_excluded = false;
        // Automatically default restored items to approved status
        setIndentStatuses(prevStatuses => ({
          ...prevStatuses,
          [itemId]: 'approved'
        }));
        currentItems[itemIndex] = item;
      }
      return updated;
    });
  };

  const handleDeleteBatch = async (groupKey, items) => {
    const displayLabel = groupKey.includes('::') ? groupKey.split('::')[1] : groupKey;
    const confirmMsg = `Are you sure you want to permanently delete all ${items.length} items in batch ${displayLabel}? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      const ids = items.map(item => item.id);
      const targetTable = activeTab === 'history' ? "purchase_approved_indent_items" : "purchase_indent_items";
      
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

      alert(`Batch ${displayLabel} successfully deleted!`);
      
      // Soft-delete in purchase_dashboard so audit trail and dashboard retain deleted items
      const targetIndentId = items[0]?.indent_id || items[0]?.party_indent_id;
      if (targetIndentId) {
        const currentUser = useAuthStore.getState().currentUser;
        const approverEmpCode = currentUser?.employee_id || currentUser?.emp_code || currentUser?.user_name || "Approver";
        const now = new Date().toISOString();
        await supabase
          .from('purchase_dashboard')
          .update({
            is_deleted: true,
            deletion_stage: 'approval',
            deletion_reason: 'Batch Deleted at Approval',
            deleted_by_emp_code: approverEmpCode,
            approver_emp_code: approverEmpCode,
            approver_action: 'delete',
            deleted_at: now,
            updated_at: now
          })
          .eq('indent_id', String(targetIndentId))
          .is('po_id', null);
      }
      
      // Update local state by removing the deleted group
      setGroupedApprovals(prev => {
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

  const handleDeleteItem = async (itemId, itemName) => {
    const confirmMsg = `Are you sure you want to permanently delete item "${itemName}"? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      const targetTable = activeTab === 'history' ? "purchase_approved_indent_items" : "purchase_indent_items";
      const { error } = await supabase
        .from(targetTable)
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      alert(`Item "${itemName}" successfully deleted!`);

      // Soft-delete in purchase_dashboard so audit trail and dashboard retain deleted items
      const currentItemsList = groupedApprovals[selectedIndentId] || [];
      const targetItem = currentItemsList.find(item => item.id === itemId);
      if (targetItem && targetItem.item_name) {
        const targetIndentId = targetItem.indent_id || targetItem.party_indent_id;
        if (targetIndentId) {
          const currentUser = useAuthStore.getState().currentUser;
          const approverEmpCode = currentUser?.employee_id || currentUser?.emp_code || currentUser?.user_name || "Approver";
          const now = new Date().toISOString();
          await supabase
            .from('purchase_dashboard')
            .update({
              is_deleted: true,
              deletion_stage: 'approval',
              deletion_reason: 'Item Deleted at Approval',
              deleted_by_emp_code: approverEmpCode,
              approver_emp_code: approverEmpCode,
              approver_action: 'delete',
              deleted_at: now,
              updated_at: now
            })
            .eq('indent_id', String(targetIndentId))
            .eq('item_name', targetItem.item_name)
            .is('po_id', null);
        }
      }

      // Update groupedApprovals state
      setGroupedApprovals(prev => {
        const updated = { ...prev };
        const currentItems = updated[selectedIndentId] || [];
        const filteredItems = currentItems.filter(item => item.id !== itemId);
        
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
      setOriginalIndentItems(prev => prev.filter(item => item.id !== itemId));
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
    const snapshot = items.map(item => ({ ...item }));
    setOriginalIndentItems(snapshot);
    
    // Backup current approval states for these items
    const statusSnapshot = {};
    items.forEach(item => {
      statusSnapshot[item.id] = indentStatuses[item.id] || null;
    });
    setOriginalStatuses(statusSnapshot);
  };

  const handleCloseIndent = () => {
    if (selectedIndentId && originalIndentItems.length > 0) {
      // Revert in-memory items back to original values
      setGroupedApprovals(prev => ({
        ...prev,
        [selectedIndentId]: originalIndentItems
      }));
    }
    if (originalStatuses) {
      // Revert statuses back to pre-edit state
      setIndentStatuses(prev => ({
        ...prev,
        ...originalStatuses
      }));
    }
    
    // Reset snapshots
    setOriginalIndentItems([]);
    setOriginalStatuses(null);
    setSelectedIndentId(null);
  };

  const handleInlineChange = (itemId, field, value) => {
    setGroupedApprovals(prev => {
      const updated = { ...prev };
      const currentItems = updated[selectedIndentId] || [];
      const itemIndex = currentItems.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        const item = { ...currentItems[itemIndex] };
        let numVal = value === "" ? null : parseFloat(value);
        item[field] = numVal;

        const bcs = parseFloat(item.bcs) || 0;
        if (bcs > 0) {
          if ((field === 'approved_box' || field === 'order_box') && numVal !== null) {
            item.approved_qty = parseFloat((numVal * bcs).toFixed(2));
          } else if ((field === 'approved_qty' || field === 'order_qty') && numVal !== null) {
            item.approved_box = parseFloat((numVal / bcs).toFixed(2));
          }
        }
        currentItems[itemIndex] = item;
      }
      return updated;
    });
  };

  const inlineInputStyle = {
    width: '100%',
    minWidth: '60px',
    maxWidth: '85px',
    padding: '4px 6px',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    backgroundColor: '#fff',
    fontSize: '13px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.2s',
    fontWeight: '700',
    color: '#4338ca',
    textAlign: 'center'
  };
  const queryClient = useQueryClient();

  // ── Supabase Realtime: auto-invalidate cache on DB changes ──
  useRealtimeSync();

  const { data: approvalsDataResponse, isLoading: isApprovalsQueryLoading } = useQuery({
    queryKey: ["approvalsData", selectedShop],
    queryFn: async () => {
      const pageSize = 1000;
      const totalPages = 10; // covers up to 10,000 pending items in parallel

      // 1. Fetch pending indent items in parallel pages
      const indentPageQueries = Array.from({ length: totalPages }, (_, page) => {
        if (selectedShop !== "All") {
          return supabase
            .from("purchase_indent_items")
            .select("*, purchase_indents!inner(shop_name)")
            .eq("purchase_indents.shop_name", selectedShop)
            .or('approval_status.eq.pending,approval_status.is.null')
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);
        } else {
          return supabase
            .from("purchase_indent_items")
            .select("*, purchase_indents(shop_name)")
            .or('approval_status.eq.pending,approval_status.is.null')
            .order("created_at", { ascending: false })
            .order("id", { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);
        }
      });

      // 2. Fetch approved indent items (history)
      let approvedQuery;
      if (selectedShop !== "All") {
        approvedQuery = supabase
          .from("purchase_approved_indent_items")
          .select("*, purchase_indents!inner(shop_name)")
          .eq("purchase_indents.shop_name", selectedShop)
          .order("created_at", { ascending: false })
          .limit(500);
      } else {
        approvedQuery = supabase
          .from("purchase_approved_indent_items")
          .select("*, purchase_indents(shop_name)")
          .order("created_at", { ascending: false })
          .limit(500);
      }

      // 3. Fetch rejected indent items (history)
      let rejectedQuery;
      if (selectedShop !== "All") {
        rejectedQuery = supabase
          .from("purchase_indent_items")
          .select("*, purchase_indents!inner(shop_name)")
          .eq("purchase_indents.shop_name", selectedShop)
          .eq("approval_status", "rejected")
          .order("updated_at", { ascending: false })
          .limit(500);
      } else {
        rejectedQuery = supabase
          .from("purchase_indent_items")
          .select("*, purchase_indents(shop_name)")
          .eq("approval_status", "rejected")
          .order("updated_at", { ascending: false })
          .limit(500);
      }

      const [approvedResult, rejectedResult, ...indentResults] = await Promise.all([
        approvedQuery,
        rejectedQuery,
        ...indentPageQueries
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
        rawRejectedIndentItems: rejectedResult.data || []
      };
    }
  });

  // Sync React Query data to local state for seamless backwards compatibility
  useEffect(() => {
    if (approvalsDataResponse) {
      const rawApproved = approvalsDataResponse.rawApprovedIndentItems || [];
      const approvedKeys = new Set(
        rawApproved.map(i => `${i.indent_id}::${i.party_indent_id}::${(i.item_name || '').trim().toLowerCase()}`)
      );
      const approvedOriginalIds = new Set(
        rawApproved.map(i => i.original_item_id).filter(Boolean)
      );

      // Filter out any items from rawIndentItems that are already in rawApproved
      const enrichedIndentItems = (approvalsDataResponse.rawIndentItems || [])
        .filter(item => {
          if (approvedOriginalIds.has(item.id)) return false;
          const key = `${item.indent_id}::${item.party_indent_id}::${(item.item_name || '').trim().toLowerCase()}`;
          if (approvedKeys.has(key)) return false;
          return true;
        })
        .map(item => ({
          ...item,
          shop_name: item.purchase_indents?.shop_name || "Unknown"
        }));

      const rawRejected = approvalsDataResponse.rawRejectedIndentItems || [];

      const enrichedApprovedItems = rawApproved.map(item => ({
        ...item,
        approval_status: "approved",
        is_excluded: false,
        shop_name: item.purchase_indents?.shop_name || "Unknown"
      }));

      const enrichedRejectedItems = rawRejected.map(item => ({
        ...item,
        approval_status: "rejected",
        is_excluded: false,
        shop_name: item.purchase_indents?.shop_name || "Unknown"
      }));

      const enrichedHistoryItems = [...enrichedApprovedItems, ...enrichedRejectedItems];

      const groupItemsByKey = (items) => {
        return items.reduce((acc, item) => {
          const fullId = item.party_indent_id || "Unknown";
          const parts = fullId.split('-');
          let basePartyId = fullId;
          if (parts.length >= 2 && fullId !== "Unknown") {
            basePartyId = `${parts[0]}-${parts[1]}`;
          }
          const groupKey = `${item.indent_id ?? 'no-indent'}::${basePartyId}`;
          if (!acc[groupKey]) acc[groupKey] = [];
          acc[groupKey].push(item);
          return acc;
        }, {});
      };

      setPendingGroupedApprovals(groupItemsByKey(enrichedIndentItems));
      setHistoryGroupedApprovals(groupItemsByKey(enrichedHistoryItems));
      
      // Pre-fill existing statuses for history items
      const initialStatuses = {};
      enrichedHistoryItems.forEach(item => {
        initialStatuses[item.id] = item.approval_status || 'approved';
      });
      setIndentStatuses(prev => ({ ...prev, ...initialStatuses }));
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
      const itemsToProcess = currentItems.filter(item => 
        !item.is_excluded && 
        !item.already_in_lifecycle && 
        isItemInSelectedCompany(item)
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

      const isCompanyFiltered = Boolean(selectedCompanyFilter && selectedCompanyFilter !== 'All');

      // Validate valid parent indent IDs to avoid foreign key constraints
      const { data: validIndents } = await supabase
        .from("purchase_indents")
        .select("id");
      const validIndentIds = new Set((validIndents || []).map(i => i.id));

      itemsToProcess.forEach(item => {
        const validParentId = (item.indent_id && validIndentIds.has(item.indent_id)) 
          ? item.indent_id 
          : null;

        if (!parentIndentId && validParentId) {
          parentIndentId = validParentId;
        }

        const status = indentStatuses[item.id];
        let autoBox = parseFloat(item.order_box) || 0;
        let autoQty = parseFloat(item.order_qty) || 0;
        let processedBox = item.approved_box !== undefined && item.approved_box !== null ? parseFloat(item.approved_box) : autoBox;
        let processedQty = item.approved_qty !== undefined && item.approved_qty !== null ? parseFloat(item.approved_qty) : autoQty;

        if (status === 'approved') {
          approvedIdsToDelete.push(item.id);
          hasAnyApproved = true;
          if (processedBox >= 0.90) {
            if (processedBox < 1.0) {
              processedBox = 1;
            } else {
              processedBox = Math.floor(processedBox);
            }
            const bcs = parseFloat(item.bcs) || 0;
            processedQty = bcs > 0 ? processedBox * bcs : processedQty;
          }

          const effectiveCompany = (isCompanyFiltered && selectedCompanyFilter !== '__NONE__')
            ? selectedCompanyFilter.trim()
            : null;

          approvedItemsPayload.push({
            original_item_id: item.id,
            indent_id: validParentId,
            party_indent_id: item.party_indent_id,
            item_name: item.item_name,
            brand_name: item.brand_name,
            company_name: item.company_name || null,
            filtered_company_name: effectiveCompany,
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
            po_status: 'pending'
          });
        } else if (status === 'rejected') {
          // Only items explicitly marked as rejected are updated to rejected
          rejectedIdsToUpdate.push(item.id);
          if (item.item_name) rejectedItemNames.push(item.item_name);
        }
      });

      if (approvedItemsPayload.length === 0 && rejectedIdsToUpdate.length === 0) {
        alert("No items have been selected for approval or rejection in this submission.");
        setIsLoading(false);
        return;
      }

      // 1. Insert approved items into approved_indent_items in chunks of 100
      if (approvedItemsPayload.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < approvedItemsPayload.length; i += chunkSize) {
          const chunk = approvedItemsPayload.slice(i, i + chunkSize);
          const { error: insertErr } = await supabase
            .from("purchase_approved_indent_items")
            .insert(chunk);
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
          i => !approvedIdsToDelete.includes(i.id) && !rejectedIdsToUpdate.includes(i.id) && (!i.approval_status || i.approval_status === 'pending')
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
      const approverEmpCode = currentUser?.employee_id || currentUser?.emp_code || currentUser?.user_name || currentUser?.name || "Approver";
      
      const targetIndentId = currentItems[0]?.indent_id || currentItems[0]?.party_indent_id || selectedIndentId;
      const effectiveCompany = (isCompanyFiltered && selectedCompanyFilter !== '__NONE__')
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
      const submittedIdsSet = new Set([...approvedIdsToDelete, ...rejectedIdsToUpdate]);
      
      setPendingGroupedApprovals(prev => {
        const updated = { ...prev };
        const items = updated[selectedIndentId] || [];
        const remainingItems = items.filter(item => !submittedIdsSet.has(item.id));

        if (remainingItems.length === 0) {
          delete updated[selectedIndentId];
        } else {
          updated[selectedIndentId] = remainingItems;
        }
        return updated;
      });

      setIndentStatuses(prev => {
        const next = { ...prev };
        submittedIdsSet.forEach(id => {
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
      alert("Approval Submission Restricted: " + (error.message || "Could not sync audit records to purchase_dashboard. All changes have been rolled back. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  // React Query handles loading on mount automatically, fetchApprovals is only needed for manual action refreshes

  const calculateTotalOrderBox = (items) => {
    return items.reduce((sum, item) => sum + (parseFloat(item.order_box) || 0), 0).toFixed(2);
  };

  const calculateTotalOrderQty = (items) => {
    return items.reduce((sum, item) => sum + (parseFloat(item.order_qty) || 0), 0).toFixed(2);
  };

  const thStyle = {
    padding: '8px 10px',
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    borderBottom: '2px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    whiteSpace: 'pre-line',
    lineHeight: '1.25',
    verticalAlign: 'bottom'
  };

  const tdStyle = {
    padding: '8px 10px',
    fontSize: '13px',
    color: '#1e293b',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: '500',
    verticalAlign: 'middle'
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
    const indentDisplayLabel = groupKey.includes('::') ? groupKey.split('::')[1] : groupKey;
    if (indentDisplayLabel.toLowerCase().includes(q)) return true;
    
    // Match Shop Name
    const shopName = items[0]?.shop_name || "";
    if (shopName.toLowerCase().includes(q)) return true;
    
    // Match Party Name
    const partyName = items[0]?.party_name || "";
    if (partyName.toLowerCase().includes(q)) return true;
    
    return false;
  };

  const pendingBatches = Object.entries(pendingGroupedApprovals).filter(([baseId, items]) => {
    const shopOk = selectedShop === "All" || (items[0]?.shop_name === selectedShop);
    const dateOk = checkDateRange(items[0]?.created_at);
    const searchOk = checkSearchQuery(baseId, items);
    // Batches in pendingGroupedApprovals that have active pending items
    return shopOk && dateOk && searchOk && items.some(item => !item.is_excluded && (!item.approval_status || item.approval_status === 'pending'));
  });

  const historyBatches = Object.entries(historyGroupedApprovals).filter(([baseId, items]) => {
    const shopOk = selectedShop === "All" || (items[0]?.shop_name === selectedShop);
    const dateOk = checkDateRange(items[0]?.created_at);
    const searchOk = checkSearchQuery(baseId, items);
    const activeItems = items.filter(item => !item.is_excluded);
    return shopOk && dateOk && searchOk && activeItems.length > 0;
  });

  const displayedBatches = activeTab === "pending" ? pendingBatches : historyBatches;

  return (
    <div className="page-container" style={{ padding: '20px', maxWidth: '100%', boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' }}>
          Approval Batches
        </h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '15px' }}>
          Review indent submissions batched by Indent ID
        </p>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pending' ? '2px solid #4f46e5' : '2px solid transparent',
            color: activeTab === 'pending' ? '#4f46e5' : '#64748b',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Pending ({pendingBatches.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '12px 24px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'history' ? '2px solid #4f46e5' : '2px solid transparent',
            color: activeTab === 'history' ? '#4f46e5' : '#64748b',
            fontWeight: '600',
            fontSize: '15px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          History ({historyBatches.length})
        </button>
      </div>

      {/* Controls: Search & Date Filters */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="Search by Indent ID, Shop Name or Party Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#1e293b',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
              fontWeight: '500'
            }}
            onFocus={(e) => e.target.style.borderColor = '#4f46e5'}
            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 0
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                outline: 'none',
                fontWeight: '500'
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#475569' }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1e293b',
                outline: 'none',
                fontWeight: '500'
              }}
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(""); setEndDate(""); }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {showLoadingScreen ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#94a3b8' }}>
          <Loader2 style={{ animation: 'spin 1s linear infinite', width: '40px', height: '40px', marginBottom: '16px' }} />
          <p>Loading batched data from Supabase...</p>
        </div>
      ) : displayedBatches.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
          <Archive style={{ width: '48px', height: '48px', color: '#cbd5e1', marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', fontWeight: '500', color: '#475569' }}>
            {activeTab === 'pending' ? "No pending indent items found" : "No history found"}
          </p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>
            {activeTab === 'pending' ? "Upload and submit a CSV on the Indent page to see data here." : "Submit some approvals to see them in history."}
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Indent ID</th>
                  <th style={thStyle}>Shop Name</th>
                  {activeTab === 'history' && <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>}
                  <th style={thStyle}>Party Name</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>{activeTab === 'pending' ? 'Created At' : 'Approved At'}</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Total Order Qty</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Total Order Box</th>
                </tr>
              </thead>
              <tbody>
                {displayedBatches.map(([groupKey, items], index) => {
                  // Extract the human-readable label (e.g. "IN-1") from the scoped key
                  const indentDisplayLabel = groupKey.includes('::') ? groupKey.split('::')[1] : groupKey;
                  return (
                  <tr 
                     key={groupKey} 
                     style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc', cursor: 'pointer', transition: 'background-color 0.2s' }} 
                     onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} 
                     onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8fafc'}
                     onClick={() => handleOpenIndent(groupKey)}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                        <button 
                          onClick={() => handleOpenIndent(groupKey)}
                          style={{
                            position: 'relative',
                            background: '#e0e7ff', // Soft indigo background
                            border: 'none',
                            color: '#4338ca', // Darker indigo text
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            fontWeight: '600',
                            fontSize: '13px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c7d2fe'} // Slightly darker soft indigo on hover
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e0e7ff'}
                          title={activeTab === 'pending' ? "Update items" : "View items"}
                        >
                          {activeTab === 'pending' ? 'Update' : 'View'}
                          {activeTab === 'pending' && (
                            <span style={{
                              position: 'absolute',
                              top: '-8px',
                              right: '-8px',
                              backgroundColor: '#fee2e2', // Soft red/pink background
                              color: '#dc2626', // Darker red text
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              border: '1px solid #fca5a5' // Subtle border for definition
                            }}>
                              {items.filter(item => !item.is_excluded).length}
                            </span>
                          )}
                        </button>
                        <button 
                          onClick={() => handleDeleteBatch(groupKey, items)}
                          style={{
                            background: '#fee2e2', // Soft red background
                            border: 'none',
                            color: '#dc2626', // Dark red text
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fca5a5'} // Slightly darker soft red on hover
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                          title="Delete entire batch"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#4338ca', fontWeight: '600' }}>{indentDisplayLabel}</td>
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{items[0]?.shop_name || "-"}</td>
                    {activeTab === 'history' && (
                      <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', backgroundColor: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#16a34a', fontWeight: '600', fontSize: '12px' }} title="Approved">
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 0 2px #dcfce7' }}></span>
                            {items.filter(i => !i.is_excluded && indentStatuses[i.id] === 'approved').length}
                          </div>
                          <div style={{ width: '1px', height: '14px', backgroundColor: '#e2e8f0' }}></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: '600', fontSize: '12px' }} title="Rejected">
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 0 2px #fee2e2' }}></span>
                            {items.filter(i => !i.is_excluded && indentStatuses[i.id] === 'rejected').length}
                          </div>
                        </div>
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'left' }}>{items[0]?.party_name || "-"}</td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>{formatDateTime(items[0]?.created_at)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>{calculateTotalOrderQty(items)}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>{calculateTotalOrderBox(items)}</td>
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
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '96vw',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                  Details for {selectedIndentId?.includes('::') ? selectedIndentId.split('::')[1] : selectedIndentId}
                </h2>
                <div style={{ margin: '8px 0 0', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Party: <strong style={{ color: '#0f172a' }}>{groupedApprovals[selectedIndentId]?.[0]?.party_name || "Unknown"}</strong>
                  </span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>

                  {/* Company Name Single Selection Dropdown Filter */}
                  {(() => {
                    const currentBatchItems = groupedApprovals[selectedIndentId] || [];
                    const uniqueCompanies = Array.from(
                      new Set(
                        currentBatchItems
                          .map(i => resolveItemCompany(i))
                          .filter(Boolean)
                      )
                    ).sort((a, b) => a.localeCompare(b));

                    const noCompanyCount = currentBatchItems.filter(i => !i.is_excluded && !resolveItemCompany(i)).length;

                    return (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <label htmlFor="modalCompanyFilter" style={{ fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                          Company:
                        </label>
                        <select
                          id="modalCompanyFilter"
                          value={selectedCompanyFilter}
                          onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            fontWeight: '600',
                            borderRadius: '8px',
                            border: '1.5px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#1e293b',
                            outline: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#4338ca'}
                          onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        >
                          <option value="All">All Companies ({currentBatchItems.filter(i => !i.is_excluded).length})</option>
                          {uniqueCompanies.map((comp) => {
                            const count = currentBatchItems.filter(i => !i.is_excluded && resolveItemCompany(i).toLowerCase() === comp.toLowerCase()).length;
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
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>
                      </div>
                    );
                  })()}

                  <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>Approved: {approvedCount}</span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>
                  <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>Rejected: {rejectedCount}</span>
                  {activeTab !== 'history' && (
                    <>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>
                      <span style={{ fontSize: '13px', color: '#eab308', fontWeight: '600' }}>Unchecked: {pendingCount}</span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {activeTab !== 'history' && (
                  <button
                    onClick={handleSubmitApprovals}
                    disabled={isLoading}
                    style={{
                      background: isLoading ? '#94a3b8' : '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#059669'; }}
                    onMouseLeave={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = '#10b981'; }}
                  >
                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                    {isLoading ? 'Submitting...' : 'Submit'}
                  </button>
                )}
                {activeTab !== 'history' && groupedApprovals[selectedIndentId]?.some(item => {
                  if (!item.already_in_lifecycle) return false;
                  return isItemInSelectedCompany(item);
                }) && (
                  <button
                    onClick={() => setShowInProcessModal(true)}
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                  >
                    View In-Process ({
                      groupedApprovals[selectedIndentId]?.filter(item => {
                        if (!item.already_in_lifecycle) return false;
                        return isItemInSelectedCompany(item);
                      }).length
                    })
                  </button>
                )}
                {activeTab !== 'history' && groupedApprovals[selectedIndentId]?.some(item => {
                  if (!item.is_excluded) return false;
                  return isItemInSelectedCompany(item);
                }) && (
                  <button
                    onClick={() => setShowExcludedModal(true)}
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                  >
                    View Excluded ({
                      groupedApprovals[selectedIndentId]?.filter(item => {
                        if (!item.is_excluded) return false;
                        return isItemInSelectedCompany(item);
                      }).length
                    })
                  </button>
                )}
                <button 
                  onClick={handleCloseIndent}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '36px', height: '36px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, textAlign: 'center', minWidth: '150px' }}>
                        <div>Approve / Reject</div>
                        {activeTab !== 'history' && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px', textTransform: 'none', fontWeight: 'normal', fontSize: '11px' }}>
                            <button
                              type="button"
                              onClick={() => handleSelectAllFiltered('approved')}
                              style={{
                                background: activeBatchItems.length > 0 && activeBatchItems.every(i => indentStatuses[i.id] === 'approved') ? '#16a34a' : '#dcfce7',
                                color: activeBatchItems.length > 0 && activeBatchItems.every(i => indentStatuses[i.id] === 'approved') ? '#ffffff' : '#166534',
                                border: '1px solid #86efac',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              title="Approve all visible items in this filter"
                            >
                              ✓ All
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectAllFiltered('rejected')}
                              style={{
                                background: activeBatchItems.length > 0 && activeBatchItems.every(i => indentStatuses[i.id] === 'rejected') ? '#dc2626' : '#fee2e2',
                                color: activeBatchItems.length > 0 && activeBatchItems.every(i => indentStatuses[i.id] === 'rejected') ? '#ffffff' : '#991b1b',
                                border: '1px solid #fca5a5',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                fontSize: '11px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              title="Reject all visible items in this filter"
                            >
                              ✗ All
                            </button>
                          </div>
                        )}
                      </th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Indent{"\n"}ID</th>
                      <th style={{ ...thStyle, textAlign: 'left' }}>Shop{"\n"}Name</th>
                      <th style={{ ...thStyle, textAlign: 'left', minWidth: '160px' }}>Item Name</th>
                      <th style={{ ...thStyle, textAlign: 'left', minWidth: '130px' }}>Company{"\n"}Name</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Per Day{"\n"}Sale</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Order{"\n"}Box</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Order{"\n"}Qty</th>
                      <th style={{ ...thStyle, textAlign: 'center', color: '#4338ca' }}>Approved{"\n"}Box</th>
                      <th style={{ ...thStyle, textAlign: 'center', color: '#4338ca' }}>Approved{"\n"}Qty</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Closing{"\n"}Qty</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>B/Cs</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Mls</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeBatchItems.map((item, index) => {
                      // Use nullish coalescing so a falsy but valid id (e.g. 0) is never
                      // replaced by the loop index, which would cause status key collisions.
                      const itemId = item.id ?? `fallback-${selectedIndentId}-${index}`;
                      return (
                      <tr key={itemId} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8fafc'}>
                        <td style={{ ...tdStyle, textAlign: 'center', minWidth: '135px' }}>
                          {activeTab === 'history' ? (
                            <span style={{ 
                              display: 'inline-block', 
                              padding: '4px 10px', 
                              borderRadius: '6px', 
                              fontSize: '12px', 
                              fontWeight: '600',
                              backgroundColor: indentStatuses[itemId] === 'approved' ? '#dcfce7' : '#fee2e2',
                              color: indentStatuses[itemId] === 'approved' ? '#16a34a' : '#dc2626'
                            }}>
                              {indentStatuses[itemId] === 'approved' ? 'Approved' : 'Rejected'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: indentStatuses[itemId] === 'approved' ? '#16a34a' : '#64748b', fontWeight: '500', transition: 'all 0.2s', fontSize: '13px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={indentStatuses[itemId] === 'approved'} 
                                  onChange={() => handleStatusChange(itemId, 'approved')} 
                                  style={{ width: '16px', height: '16px', accentColor: '#16a34a', cursor: 'pointer' }}
                                />
                                Approve
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: indentStatuses[itemId] === 'rejected' ? '#dc2626' : '#64748b', fontWeight: '500', transition: 'all 0.2s', fontSize: '13px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={indentStatuses[itemId] === 'rejected'} 
                                  onChange={() => handleStatusChange(itemId, 'rejected')} 
                                  style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
                                />
                                Reject
                              </label>
                            </div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{item.party_indent_id || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{item.shop_name || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: 'left' }}>{item.item_name}</td>
                        <td style={{ ...tdStyle, textAlign: 'left', color: '#475569' }}>{resolveItemCompany(item) || item.company_name || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                          {item.per_day_sale_last_month !== null && item.per_day_sale_last_month !== undefined ? item.per_day_sale_last_month : "—"}
                        </td>
                        {/* Order Box (Read-only System Auto-Calculated) */}
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                          {item.order_box !== undefined && item.order_box !== null ? item.order_box : "—"}
                        </td>
                        {/* Order Qty (Read-only System Auto-Calculated) */}
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                          {item.order_qty !== undefined && item.order_qty !== null ? item.order_qty : "—"}
                        </td>
                        {/* Approved Box (Editable input pre-filled with approved_box or order_box) */}
                        <td style={{ ...tdStyle, textAlign: 'center', padding: activeTab === 'history' ? '8px 10px' : '4px 6px' }}>
                          {activeTab === 'history' ? (
                            <span style={{ fontWeight: '700', color: '#4338ca' }}>{item.approved_box ?? item.order_box ?? "-"}</span>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={item.approved_box !== undefined && item.approved_box !== null ? item.approved_box : (item.order_box ?? "")}
                              onChange={(e) => handleInlineChange(item.id, 'approved_box', e.target.value)}
                              style={inlineInputStyle}
                              placeholder="-"
                            />
                          )}
                        </td>
                        {/* Approved Qty (Editable input pre-filled with approved_qty or order_qty) */}
                        <td style={{ ...tdStyle, textAlign: 'center', padding: activeTab === 'history' ? '8px 10px' : '4px 6px' }}>
                          {activeTab === 'history' ? (
                            <span style={{ fontWeight: '700', color: '#4338ca' }}>{item.approved_qty ?? item.order_qty ?? "-"}</span>
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={item.approved_qty !== undefined && item.approved_qty !== null ? item.approved_qty : (item.order_qty ?? "")}
                              onChange={(e) => handleInlineChange(item.id, 'approved_qty', e.target.value)}
                              style={inlineInputStyle}
                              placeholder="-"
                            />
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{item.closing_qty || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{item.bcs || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{item.mls || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.item_name)}
                            style={{
                              background: '#fee2e2',
                              border: 'none',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '8px',
                              borderRadius: '6px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fca5a5'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                            title="Delete item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Excluded Items Modal Overlay */}
              {showExcludedModal && (
                <div style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10005,
                  padding: '20px'
                }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '96vw',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
                  }}>
                    <div style={{
                      padding: '20px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#dc2626' }}>
                          Excluded Products for {selectedIndentId?.includes('::') ? selectedIndentId.split('::')[1] : selectedIndentId}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                          These items were excluded due to negative or low indent calculations. Search and click "+ Include" to add them back.
                        </p>
                      </div>
                      <button 
                        onClick={() => { setShowExcludedModal(false); setExcludedSearchQuery(""); }}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '50%',
                          width: '36px', height: '36px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#64748b',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Search Field */}
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search excluded items by item name, company, or brand..."
                          value={excludedSearchQuery}
                          onChange={(e) => setExcludedSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px 8px 36px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    {/* Table of Excluded Items */}
                    <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#fef2f2' }}>
                              <th style={{ ...thStyle, textAlign: 'center', backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Action</th>
                              <th style={{ ...thStyle, backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Indent{"\n"}ID</th>
                              <th style={{ ...thStyle, backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Shop{"\n"}Name</th>
                              <th style={{ ...thStyle, backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Item Name</th>
                              <th style={{ ...thStyle, backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Company{"\n"}Name</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Per Day{"\n"}Sale</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Order{"\n"}Box</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Order{"\n"}Qty</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Closing{"\n"}Qty</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>B/Cs</th>
                              <th style={{ ...thStyle, backgroundColor: '#fef2f2', color: '#991b1b', borderBottom: '2px solid #fca5a5' }}>Mls</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const query = (excludedSearchQuery || "").trim().toLowerCase();
                              const filteredItems = (groupedApprovals[selectedIndentId] || []).filter(item => {
                                if (!item.is_excluded) return false;
                                if (!isItemInSelectedCompany(item)) return false;
                                const itemName = (item.item_name || "").toLowerCase();
                                const brandName = (item.brand_name || "").toLowerCase();
                                const compName = (resolveItemCompany(item) || item.company_name || "").toLowerCase();
                                return itemName.includes(query) || brandName.includes(query) || compName.includes(query);
                              });

                              if (filteredItems.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={11} style={{ ...tdStyle, textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                                      No excluded items found matching your filter.
                                    </td>
                                  </tr>
                                );
                              }

                              return filteredItems.map((item, index) => {
                                const itemId = item.id ?? `fallback-excl-${selectedIndentId}-${index}`;
                                return (
                                  <tr key={itemId} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#fff5f5' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#fff5f5'}>
                                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                                      <button
                                        onClick={() => handleIncludeExcludedItem(itemId)}
                                        style={{
                                          backgroundColor: '#dc2626',
                                          color: '#ffffff',
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '6px 12px',
                                          fontSize: '12px',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                                      >
                                        + Include
                                      </button>
                                    </td>
                                    <td style={{ ...tdStyle, color: '#991b1b' }}>{item.party_indent_id || "-"}</td>
                                    <td style={tdStyle}>{item.shop_name || "-"}</td>
                                    <td style={tdStyle}>{item.item_name}</td>
                                    <td style={{ ...tdStyle, color: '#7f1d1d' }}>{item.company_name || "-"}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                                      {item.per_day_sale_last_month !== null && item.per_day_sale_last_month !== undefined ? item.per_day_sale_last_month : "—"}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>{item.order_box || "-"}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>{item.order_qty || "-"}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>{item.closing_qty || "-"}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>{item.bcs || "-"}</td>
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
                <div style={{
                  position: 'fixed',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10005,
                  padding: '20px'
                }}>
                  <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '96vw',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)'
                  }}>
                    <div style={{
                      padding: '20px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#1d4ed8' }}>
                          In-Process Items for {selectedIndentId?.includes('::') ? selectedIndentId.split('::')[1] : selectedIndentId}
                        </h2>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                          These items are currently active in the order-delivery lifecycle for this shop. Approving them is disabled to prevent duplicate orders.
                        </p>
                      </div>
                      <button 
                        onClick={() => { setShowInProcessModal(false); setInProcessSearchQuery(""); }}
                        style={{
                          background: '#f1f5f9',
                          border: 'none',
                          borderRadius: '50%',
                          width: '36px', height: '36px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#64748b',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                      >
                        <X size={20} />
                      </button>
                    </div>

                    {/* Search Field */}
                    <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                          type="text"
                          placeholder="Search in-process items by item name, company, or brand..."
                          value={inProcessSearchQuery}
                          onChange={(e) => setInProcessSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px 8px 36px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '14px',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    </div>

                    {/* Table of In-Process Items */}
                    <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#eff6ff' }}>
                              <th style={{ ...thStyle, textAlign: 'center', backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Status / Action</th>
                              <th style={{ ...thStyle, backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Indent{"\n"}ID</th>
                              <th style={{ ...thStyle, backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Shop{"\n"}Name</th>
                              <th style={{ ...thStyle, backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Item Name</th>
                              <th style={{ ...thStyle, backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Company{"\n"}Name</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Order{"\n"}Box</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Order{"\n"}Qty</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Closing{"\n"}Qty</th>
                              <th style={{ ...thStyle, textAlign: 'right', backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>B/Cs</th>
                              <th style={{ ...thStyle, backgroundColor: '#eff6ff', color: '#1e40af', borderBottom: '2px solid #93c5fd' }}>Mls</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const query = (inProcessSearchQuery || "").trim().toLowerCase();
                              const currentItems = groupedApprovals[selectedIndentId] || [];
                              const filteredInProcess = currentItems.filter(item => {
                                if (!item.already_in_lifecycle) return false;
                                if (!isItemInSelectedCompany(item)) return false;
                                const itemName = (item.item_name || "").toLowerCase();
                                const brandName = (item.brand_name || "").toLowerCase();
                                const compName = (resolveItemCompany(item) || item.company_name || "").toLowerCase();
                                return itemName.includes(query) || brandName.includes(query) || compName.includes(query);
                              });

                              if (filteredInProcess.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                                      No in-process items found.
                                    </td>
                                  </tr>
                                );
                              }

                              return filteredInProcess.map((item, index) => (
                                <tr key={item.id || index} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                  <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        backgroundColor: '#dbeafe',
                                        color: '#1e40af'
                                      }}>
                                        Active in Lifecycle
                                      </span>
                                      <button
                                        onClick={() => handleDeleteItem(item.id, item.item_name)}
                                        style={{
                                          background: '#fee2e2',
                                          border: 'none',
                                          color: '#dc2626',
                                          cursor: 'pointer',
                                          padding: '4px 8px',
                                          borderRadius: '6px',
                                          fontSize: '12px',
                                          fontWeight: '600'
                                        }}
                                        title="Delete held item"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ ...tdStyle, color: '#1e40af', fontWeight: '600' }}>{item.party_indent_id || "-"}</td>
                                  <td style={tdStyle}>{item.shop_name || "-"}</td>
                                  <td style={{ ...tdStyle, fontWeight: '700' }}>{item.item_name}</td>
                                  <td style={{ ...tdStyle, color: '#1e3a8a' }}>{item.company_name || "-"}</td>
                                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>{item.order_box || "-"}</td>
                                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>{item.order_qty || "-"}</td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>{item.closing_qty || "-"}</td>
                                  <td style={{ ...tdStyle, textAlign: 'right' }}>{item.bcs || "-"}</td>
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
