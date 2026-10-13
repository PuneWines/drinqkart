import { supabase } from "../lib/supabase";

export const fetchNextPoNumber = async () => {
  const yr = new Date().getFullYear();
  let maxSeq = 0;
  let page = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("purchase_purchase_orders")
      .select("po_number")
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error("Error fetching purchase orders for sequence:", error);
      break;
    }

    if (data && data.length > 0) {
      data.forEach((row) => {
        if (row.po_number) {
          // Robustly matches main sequence right after PO-, e.g. "2026/PO-1566" or "2026/PO-1566-1"
          const match = row.po_number.match(/PO-(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      });
      page++;
      if (data.length < PAGE_SIZE) hasMore = false;
    } else {
      hasMore = false;
    }
  }

  const nextSeq = maxSeq > 0 ? maxSeq + 1 : 1;
  return `${yr}/PO-${String(nextSeq).padStart(2, "0")}`;
};

/**
 * Resolves the PO Number for a set of items.
 * If the items are from a sub-incremented indent (e.g. '-1'),
 * finds the parent PO number and sub-increments it (e.g. '2026/PO-1566-1').
 * Otherwise, returns the standard sequential PO number.
 */
export const resolvePoNumberForItems = async (items, defaultNextPoNumber) => {
  if (!items || items.length === 0) return defaultNextPoNumber;

  const sample = items[0];
  const uniqueIndentId = sample.unique_indent_id || sample.indent_id;
  if (!uniqueIndentId) return defaultNextPoNumber;

  // Check if uniqueIndentId has a sub-increment, e.g. "uuid-1::IN-29" or "IND-0042-1"
  const parts = String(uniqueIndentId).split("::");
  const mainIndent = parts[0].trim();
  const subMatch = mainIndent.match(/^(.*)-(\d+)$/);

  if (!subMatch) return defaultNextPoNumber;

  const rootMainIndent = subMatch[1];
  const subIndex = subMatch[2];

  // Look up the parent PO in purchase_purchase_orders
  const cleanParty = (sample.partyName || sample.party_name || "").split("::")[0].trim().toLowerCase();

  const { data: pos, error } = await supabase
    .from("purchase_purchase_orders")
    .select("po_number, indent_id, vendor_name")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !pos) return defaultNextPoNumber;

  // Find the parent PO that matches the root indent and vendor
  const parentPo = pos.find(p => {
    const pIndentMain = (p.indent_id || "").split("::")[0].trim().toLowerCase();
    const pVendor = (p.vendor_name || "").split("::")[0].trim().toLowerCase();
    return pIndentMain === rootMainIndent.toLowerCase() && (!cleanParty || pVendor === cleanParty);
  });

  if (!parentPo || !parentPo.po_number) return defaultNextPoNumber;

  // Extract base parent PO number (keep main sequence YYYY/PO-XXXX, strip existing sub-PO suffix like -1, -2)
  const poMatch = parentPo.po_number.match(/^(.*PO-\d+)(?:-(\d+))?$/i);
  const parentBasePoNumber = poMatch ? poMatch[1] : parentPo.po_number;

  // Find next available sub-PO sequence for this parent
  let candidateSub = parseInt(subIndex, 10) || 1;
  while (pos.some(p => p.po_number === `${parentBasePoNumber}-${candidateSub}`)) {
    candidateSub++;
  }

  return `${parentBasePoNumber}-${candidateSub}`;
};

export const fetchPageData = async () => {
  // Execute database queries in parallel to eliminate request waterfalls
  const [
    { data: rawIndentItems, error: indentError },
    { data: indentsData, error: indentsError },
    { data: rawPoData, error: poError },
    { data: vendorsData, error: vendorsError },
    { data: transpData, error: transpError },
    { data: recvData, error: recvError }
  ] = await Promise.all([
    // Query 1: Fetch approved items (pending, null, or on_hold po_status)
    supabase
      .from("purchase_approved_indent_items")
      .select("*")
      .or("po_status.eq.pending,po_status.is.null,po_status.eq.on_hold")
      .order("id", { ascending: false }),

    // Query 2: Fetch indents to resolve shop_name reliably
    supabase
      .from("purchase_indents")
      .select("id, shop_name"),

    // Query 3: Fetch recent purchase orders to check for existing POs (avoiding full table scan)
    supabase
      .from("purchase_purchase_orders")
      .select("indent_id, vendor_name, company_scope, filtered_company_name, company_name")
      .order("created_at", { ascending: false })
      .limit(500)
      .then(res => {
        if (res.error) {
          return supabase
            .from("purchase_purchase_orders")
            .select("indent_id, vendor_name, filtered_company_name, company_name")
            .order("created_at", { ascending: false })
            .limit(500);
        }
        return res;
      }),

    // Query 4: Fetch all vendors
    supabase
      .from("purchase_vendors")
      .select("*"),

    // Query 5: Fetch all transporters
    supabase
      .from("purchase_transporters")
      .select("*")
      .order("created_at", { ascending: false }),

    // Query 6: Fetch all receivers
    supabase
      .from("purchase_receivers")
      .select("*")
      .order("created_at", { ascending: false })
  ]);

  if (indentError) console.error("Error fetching approved indent items:", indentError);
  if (indentsError) console.error("Error fetching purchase indents:", indentsError);
  if (poError) console.error("Error fetching purchase orders:", poError);
  if (vendorsError) console.error("Error fetching vendors:", vendorsError);
  if (transpError) console.error("Error fetching transporters:", transpError);
  if (recvError) console.error("Error fetching receivers:", recvError);

  const indentMap = (indentsData || []).reduce((acc, ind) => {
    if (ind.id && ind.shop_name) acc[ind.id] = ind.shop_name;
    return acc;
  }, {});

  const enrichedAllItems = (rawIndentItems || []).map(item => ({
    ...item,
    approval_status: "approved",
    is_excluded: item.po_status === "excluded",
    shop_name: indentMap[item.indent_id] || item.purchase_indents?.shop_name || "Unknown"
  }));

  const pendingItems = enrichedAllItems.filter(item => item.po_status !== "on_hold");
  const heldItems = enrichedAllItems.filter(item => item.po_status === "on_hold");

  // Create a minimal indents list compatible with any other parts expecting it
  const formattedIndentsData = pendingItems.map(item => ({
    id: item.indent_id,
    shop_name: item.shop_name
  }));

  return {
    indentData: pendingItems,
    heldIndentData: heldItems,
    poData: rawPoData || [],
    indentsData: formattedIndentsData,
    vendorsData: vendorsData || [],
    transpData: transpData || [],
    recvData: recvData || []
  };
};

export const generateVendorId = async (activeParty, filteredCompanyName) => {
  if (!activeParty) return "VN-000";
  const cleanParty = activeParty.includes("::") ? activeParty.split("::")[0].trim() : activeParty.trim();
  const comp = filteredCompanyName || (activeParty.includes("::") ? activeParty.split("::")[1].trim() : null);

  let query = supabase
    .from('purchase_vendors')
    .select('id')
    .ilike('party_name', cleanParty);

  if (comp) {
    query = query.ilike('company_name', comp.trim());
  } else {
    query = query.is('company_name', null);
  }

  const { data: vendor } = await query.limit(1).maybeSingle();

  if (vendor) {
    return `VN-${String(vendor.id).padStart(3, "0")}`;
  }
  return "VN-000";
};

const ALLOWED_PO_COLUMNS = [
  'id',
  'po_number',
  'indent_id',
  'vendor_name',
  'company_name',
  'company_scope',
  'filtered_company_name',
  'total_order_qty',
  'total_order_box',
  'total_approved_qty',
  'total_approved_box',
  'total_po_qty',
  'total_po_box',
  'trader_status',
  'trader_remarks',
  'dispatch_date',
  'trader_pdf_url',
  'transporter_number',
  'transporter_status',
  'transporter_remarks',
  'pickup_date',
  'tp_number',
  'receiver_number',
  'receiver_status',
  'receiver_remarks',
  'received_items',
  'delivered_items',
  'trader_item_statuses',
  'shop_name',
  'created_at',
  'updated_at',
  'first_brand_name',
  'receiver_pdf_url',
  'po_items',
  'district'
];

const sanitizePoPayload = (data) => {
  const sanitized = {};
  ALLOWED_PO_COLUMNS.forEach(col => {
    if (data[col] !== undefined) {
      sanitized[col] = data[col];
    }
  });
  return sanitized;
};

export const insertPurchaseOrder = async (poData) => {
  const payload = sanitizePoPayload(poData);
  let { data, error } = await supabase
    .from('purchase_purchase_orders')
    .insert([payload])
    .select();

  // Graceful fallback if 'company_scope' or 'district' columns are not yet migrated in PostgreSQL (PGRST204)
  if (error && (error.code === 'PGRST204' || error.message?.includes('district') || error.message?.includes('company_scope'))) {
    console.warn("purchase_purchase_orders table fallback retry:", error.message);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.district;
    delete fallbackPayload.company_scope;
    const retry = await supabase
      .from('purchase_purchase_orders')
      .insert([fallbackPayload])
      .select();
    if (retry.error) throw retry.error;
    return retry.data;
  }

  if (error) throw error;
  return data;
};

export const getOrCreateVendorPortalLink = async (activeParty, filteredCompanyName, baseUrl) => {
  if (!activeParty) return "";
  const cleanParty = activeParty.includes("::") ? activeParty.split("::")[0].trim() : activeParty.trim();
  const comp = filteredCompanyName || (activeParty.includes("::") ? activeParty.split("::")[1].trim() : null);

  let query = supabase
    .from("purchase_vendors")
    .select("id, portal_link")
    .ilike("party_name", cleanParty);

  if (comp) {
    query = query.ilike("company_name", comp.trim());
  } else {
    query = query.is("company_name", null);
  }

  const { data: vendorRow } = await query.limit(1).maybeSingle();

  if (!vendorRow) return "";

  let dbPortalLink = vendorRow.portal_link;
  if (!dbPortalLink) {
    dbPortalLink = `/vendor-portal/${vendorRow.id}`;
    await supabase
      .from("purchase_vendors")
      .update({ portal_link: dbPortalLink })
      .eq("id", vendorRow.id);
  }
  return dbPortalLink.startsWith("http") ? dbPortalLink : `${baseUrl}${dbPortalLink}`;
};

export const getOrCreateTransporterPortalLink = async (selectedTransporter, transporters, baseUrl) => {
  const transporterRow = transporters.find(t => t.contact_number === selectedTransporter);
  if (!transporterRow) return "";
  let dbPortalLink = transporterRow.portal_link;
  if (!dbPortalLink) {
    dbPortalLink = `/transporter-portal/${transporterRow.id}`;
    await supabase
      .from("purchase_transporters")
      .update({ portal_link: dbPortalLink })
      .eq("id", transporterRow.id);
  }
  return dbPortalLink.startsWith("http") ? dbPortalLink : `${baseUrl}${dbPortalLink}`;
};

export const getOrCreateReceiverPortalLink = async (selectedReceiver, receivers, baseUrl) => {
  const receiverRow = receivers.find(r => r.contact_number === selectedReceiver);
  if (!receiverRow) return "";
  let dbPortalLink = receiverRow.portal_link;
  if (!dbPortalLink) {
    dbPortalLink = `/receiver-portal/${receiverRow.id}`;
    try {
      await supabase
        .from("purchase_receivers")
        .update({ portal_link: dbPortalLink })
        .eq("id", receiverRow.id);
    } catch (err) {
      console.warn("Could not save portal_link for receiver in database (column might be missing):", err);
    }
  }
  return dbPortalLink.startsWith("http") ? dbPortalLink : `${baseUrl}${dbPortalLink}`;
};

export const excludeIndentItems = async (ids, reason) => {
  if (!ids || ids.length === 0) return [];
  
  const chunkSize = 50;
  let allUpdatedData = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("purchase_approved_indent_items")
      .update({ po_status: "excluded", exclusion_reason: reason, updated_at: new Date().toISOString() })
      .in("id", chunk)
      .select();

    if (error) throw error;
    if (data) allUpdatedData = [...allUpdatedData, ...data];
  }

  return allUpdatedData.map(item => ({
    ...item,
    is_excluded: true,
    exclusion_reason: reason
  }));
};

export const holdIndentItems = async (ids) => {
  if (!ids || ids.length === 0) return [];
  const chunkSize = 50;
  let allUpdatedData = [];

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("purchase_approved_indent_items")
      .update({ po_status: "on_hold", updated_at: new Date().toISOString() })
      .in("id", chunk)
      .select();

    if (error) throw error;
    if (data) allUpdatedData = [...allUpdatedData, ...data];
  }
  return allUpdatedData;
};

export const resolveSubIncrementIndentId = async (currentUniqueIndentId, partyName, companyScope = null) => {
  if (!currentUniqueIndentId) return currentUniqueIndentId;

  const cleanParty = partyName?.includes("::") ? partyName.split("::")[0].trim().toLowerCase() : (partyName || "").trim().toLowerCase();
  const cleanFilteredComp = (companyScope || (partyName?.includes("::") ? partyName.split("::")[1] : "") || "").trim().toLowerCase();

  let { data: existingPos, error: poErr } = await supabase
    .from("purchase_purchase_orders")
    .select("indent_id, vendor_name, company_scope, filtered_company_name")
    .order("created_at", { ascending: false })
    .limit(500);

  if (poErr) {
    const fallback = await supabase
      .from("purchase_purchase_orders")
      .select("indent_id, vendor_name, filtered_company_name")
      .order("created_at", { ascending: false })
      .limit(500);
    existingPos = fallback.data;
    poErr = fallback.error;
  }

  if (poErr || !existingPos) return currentUniqueIndentId;

  // Extract base indent ID (handling any party suffix like "::IN-1")
  const parts = String(currentUniqueIndentId).split("::");
  let mainIndent = parts[0].trim();
  const partySuffix = parts.slice(1).join("::");

  // Determine root indent code:
  // If mainIndent already ends with a sub-increment like "-1", "-2":
  let rootIndent = mainIndent;
  const subIncMatch = mainIndent.match(/^(.*)-(\d+)$/);
  if (subIncMatch) {
    const candidateRoot = subIncMatch[1];
    const rootMatchesPo = existingPos.some(po => {
      const poIndentMain = (po.indent_id || "").split("::")[0].trim().toLowerCase();
      return poIndentMain === candidateRoot.toLowerCase() || poIndentMain.startsWith(`${candidateRoot.toLowerCase()}-`);
    });
    if (rootMatchesPo) {
      rootIndent = candidateRoot;
    }
  }

  // Helper to check if a candidate indent ID already has a PO for this vendor
  const hasMatchingPo = (candidateIndentMain) => {
    return existingPos.some(po => {
      const poIndentMain = (po.indent_id || "").split("::")[0].trim().toLowerCase();
      if (poIndentMain !== candidateIndentMain.toLowerCase()) return false;

      const poVendor = po.vendor_name?.includes("::")
        ? po.vendor_name.split("::")[0].trim().toLowerCase()
        : (po.vendor_name || "").trim().toLowerCase();

      if (poVendor !== cleanParty) return false;

      const poFilteredComp = (
        po.company_scope ||
        po.filtered_company_name ||
        (po.vendor_name?.includes("::") ? po.vendor_name.split("::")[1] : "") ||
        ""
      ).trim().toLowerCase();

      if (cleanFilteredComp) {
        return poFilteredComp === cleanFilteredComp;
      }
      return !poFilteredComp;
    });
  };

  // If no PO exists for this indent + party, keep original indent ID
  if (!hasMatchingPo(mainIndent)) {
    return currentUniqueIndentId;
  }

  // A PO was generated! Find the next available sub-increment: -1, -2, -3...
  let nextSubIndex = 1;
  while (true) {
    const candidateMain = `${rootIndent}-${nextSubIndex}`;
    if (!hasMatchingPo(candidateMain)) {
      return partySuffix ? `${candidateMain}::${partySuffix}` : candidateMain;
    }
    nextSubIndex++;
  }
};

export const restoreHeldIndentItems = async (ids, newUniqueIndentId = null) => {
  if (!ids || ids.length === 0) return [];
  const chunkSize = 50;
  let allUpdatedData = [];

  const updatePayload = {
    po_status: "pending",
    updated_at: new Date().toISOString()
  };

  if (newUniqueIndentId) {
    updatePayload.unique_indent_id = newUniqueIndentId;
  }

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("purchase_approved_indent_items")
      .update(updatePayload)
      .in("id", chunk)
      .select();

    if (error) throw error;
    if (data) allUpdatedData = [...allUpdatedData, ...data];
  }
  return allUpdatedData;
};

/**
 * Mark approved items as ordered in approved_indent_items table, and save final po_box and po_qty.
 */
export const markApprovedItemsAsOrdered = async (uniqueIndentId, vendorName, poId, itemsList = []) => {
  if (!uniqueIndentId || !vendorName || !poId) return;

  if (itemsList && itemsList.length > 0) {
    for (const item of itemsList) {
      const updatePayload = {
        po_status: "ordered",
        po_id: poId,
        updated_at: new Date().toISOString(),
        po_box: item.poBox !== undefined && item.poBox !== null ? parseFloat(item.poBox) : (item.approvedBox ?? item.orderBox),
        po_qty: item.poQty !== undefined && item.poQty !== null ? parseFloat(item.poQty) : (item.approvedQty ?? item.orderQty)
      };

      if (item.id) {
        const { data } = await supabase
          .from("purchase_approved_indent_items")
          .update(updatePayload)
          .eq("id", item.id)
          .select();

        // If item was not in purchase_approved_indent_items (e.g. excluded item from purchase_indent_items)
        if (!data || data.length === 0) {
          await supabase
            .from("purchase_indent_items")
            .update({
              po_status: "ordered",
              po_id: poId,
              is_excluded: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", item.id);
        }
      }
    }
  } else {
    const { error } = await supabase
      .from("purchase_approved_indent_items")
      .update({ po_status: "ordered", po_id: poId, updated_at: new Date().toISOString() })
      .eq("unique_indent_id", uniqueIndentId)
      .eq("party_name", vendorName);

    if (error) throw error;
  }
};

/**
 * Deprecated: deleteIndentAfterPO is a no-op now because items are deleted from indent_items
 * immediately after approval, and archived to approved_indent_items.
 */
export const deleteIndentAfterPO = async (uniqueIndentId) => {
  console.log("deleteIndentAfterPO called (no-op). Items are managed via approved_indent_items.");
};

export const fetchItemList = async () => {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("purchase_item_list")
      .select("id, item_name, bc_s, ml_s")
      .order("item_name", { ascending: true })
      .order("id", { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      page++;
      if (data.length < pageSize) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }
  return allData;
};

/**
 * Fetch all item names currently active in the lifecycle for a given shop.
 * Matches strictly on Shop Name + Item Name.
 */
export const getInLifecycleItemNames = async (shopName) => {
  if (!shopName || shopName === "All") return new Set();

  const activeNames = new Set();

  try {
    // Step 1: Fetch pending items in purchase_indent_items for shopName
    const { data: indentItems } = await supabase
      .from("purchase_indent_items")
      .select("item_name, purchase_indents!inner(shop_name)")
      .eq("purchase_indents.shop_name", shopName)
      .eq("is_excluded", false)
      .or("already_in_lifecycle.eq.false,already_in_lifecycle.is.null")
      .or("approval_status.eq.pending,approval_status.is.null")
      .is("po_id", null);

    (indentItems || []).forEach(item => {
      if (item.item_name) {
        activeNames.add(item.item_name.trim().toLowerCase());
      }
    });

    // Step 2: Fetch active POs for this shop that are NOT completed ('yes') or rejected ('no')
    const { data: activePOs } = await supabase
      .from("purchase_purchase_orders")
      .select("id")
      .eq("shop_name", shopName)
      .neq("receiver_status", "yes")
      .neq("receiver_status", "no")
      .neq("trader_status", "no")
      .neq("transporter_status", "no");

    const activePoIds = (activePOs || []).map(po => po.id);

    // Step 3: Fetch approved items waiting for PO or attached to an active PO
    const { data: approvedItems } = await supabase
      .from("purchase_approved_indent_items")
      .select("item_name, po_id, purchase_indents!inner(shop_name)")
      .eq("purchase_indents.shop_name", shopName)
      .neq("po_status", "excluded");

    (approvedItems || []).forEach(item => {
      const isWaitingForPo = !item.po_id;
      const isAttachedToActivePo = item.po_id && activePoIds.includes(item.po_id);

      if ((isWaitingForPo || isAttachedToActivePo) && item.item_name) {
        activeNames.add(item.item_name.trim().toLowerCase());
      }
    });

    // Step 4: Fetch items from purchase_indent_items attached to active POs
    if (activePoIds.length > 0) {
      const { data: manualPoItems } = await supabase
        .from("purchase_indent_items")
        .select("item_name")
        .in("po_id", activePoIds);

      (manualPoItems || []).forEach(item => {
        if (item.item_name) {
          activeNames.add(item.item_name.trim().toLowerCase());
        }
      });
    }
  } catch (err) {
    console.error("Error fetching in-lifecycle item names:", err);
  }

  return activeNames;
};

/**
 * Permanently delete rows in purchase_indent_items marked already_in_lifecycle = true
 * when an active lifecycle for shopName and specified item names finishes or is rejected.
 */
export const deleteSupersededLifecycleItems = async (shopName, itemNamesList = []) => {
  if (!shopName || !itemNamesList || itemNamesList.length === 0) return;

  try {
    const { data: indents } = await supabase
      .from("purchase_indents")
      .select("id")
      .eq("shop_name", shopName);

    if (!indents || indents.length === 0) return;

    const indentIds = indents.map(i => i.id);
    const cleanItemNames = itemNamesList.map(n => n.trim().toLowerCase()).filter(Boolean);

    const { data: heldItems } = await supabase
      .from("purchase_indent_items")
      .select("id, item_name")
      .in("indent_id", indentIds)
      .eq("already_in_lifecycle", true);

    if (!heldItems || heldItems.length === 0) return;

    const idsToDelete = heldItems
      .filter(item => item.item_name && cleanItemNames.includes(item.item_name.trim().toLowerCase()))
      .map(item => item.id);

    if (idsToDelete.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        await supabase
          .from("purchase_indent_items")
          .delete()
          .in("id", chunk);
      }
      console.log(`✅ Permanently deleted ${idsToDelete.length} superseded in-process rows for shop "${shopName}".`);
    }
  } catch (err) {
    console.error("Error deleting superseded lifecycle items:", err);
  }
};

