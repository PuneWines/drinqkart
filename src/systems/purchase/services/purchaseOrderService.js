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
    { data: recvData, error: recvError },
    { data: rawHoldRows, error: holdError }
  ] = await Promise.all([
    // Query 1: Fetch approved items (pending, null, or on_hold po_status)
    supabase
      .from("purchase_approved_indent_items")
      .select("*")
      .or("po_status.eq.pending,po_status.is.null")
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
      .order("created_at", { ascending: false }),

    // Query 7: Fetch held items from dedicated purchase_hold table
    supabase
      .from("purchase_hold")
      .select("*")
      .order("held_at", { ascending: false })
  ]);

  if (indentError) console.error("Error fetching approved indent items:", indentError);
  if (indentsError) console.error("Error fetching purchase indents:", indentsError);
  if (poError) console.error("Error fetching purchase orders:", poError);
  if (vendorsError) console.error("Error fetching vendors:", vendorsError);
  if (transpError) console.error("Error fetching transporters:", transpError);
  if (recvError) console.error("Error fetching receivers:", recvError);
  if (holdError) console.error("Error fetching held items from purchase_hold:", holdError);

  const indentMap = (indentsData || []).reduce((acc, ind) => {
    if (ind.id && ind.shop_name) acc[ind.id] = ind.shop_name;
    return acc;
  }, {});

  // For items without indent_id (e.g. unheld items), resolve shop_name from purchase_dashboard
  const nullIndentItems = (rawIndentItems || []).filter(item => !item.indent_id && (item.unique_indent_id || item.item_name));
  let dashboardShopMap = {};
  if (nullIndentItems.length > 0) {
    try {
      const uniqueIds = [...new Set(nullIndentItems.map(i => (i.unique_indent_id || "").split("::")[0].trim()).filter(Boolean))];
      if (uniqueIds.length > 0) {
        const { data: dashRows } = await supabase
          .from("purchase_dashboard")
          .select("indent_id, item_name, shop_name")
          .in("indent_id", uniqueIds);
        if (dashRows) {
          dashRows.forEach(r => {
            if (r.indent_id && r.item_name && r.shop_name) {
              dashboardShopMap[`${r.indent_id}::${r.item_name}`] = r.shop_name;
              dashboardShopMap[r.indent_id] = r.shop_name;
            }
          });
        }
      }
    } catch (e) {
      console.warn("Could not query dashboard for null indent shops:", e);
    }
  }

  const enrichedAllItems = (rawIndentItems || []).map(item => {
    const cleanUniqueId = (item.unique_indent_id || "").split("::")[0].trim();
    const resolvedShop = 
      indentMap[item.indent_id] || 
      item.purchase_indents?.shop_name || 
      dashboardShopMap[`${cleanUniqueId}::${item.item_name}`] || 
      dashboardShopMap[cleanUniqueId] || 
      "Unknown";

    return {
      ...item,
      approval_status: "approved",
      is_excluded: item.po_status === "excluded",
      shop_name: resolvedShop
    };
  });

  const pendingItems = enrichedAllItems.filter(item => item.po_status !== "on_hold");

  // Format purchase_hold rows into batches and item IDs
  const batchMap = {};
  const heldItemIdsSet = new Set();
  (rawHoldRows || []).forEach(row => {
    if (row.original_item_id) heldItemIdsSet.add(row.original_item_id);
    heldItemIdsSet.add(row.id);

    const bId = row.hold_batch_id || `batch-${row.party_key || row.party_name}`;
    if (!batchMap[bId]) {
      batchMap[bId] = {
        batchId: bId,
        type: row.hold_type || "complete_po",
        partyKey: row.party_key || (row.company_scope ? `${row.party_name}::${row.company_scope}` : row.party_name),
        partyName: row.party_name,
        companyScope: row.company_scope || row.filtered_company_name || null,
        companyName: row.company_name || null,
        shopName: row.shop_name,
        heldAt: row.held_at ? new Date(row.held_at).toLocaleString() : new Date().toLocaleString(),
        heldByEmpCode: row.held_by_emp_code,
        items: []
      };
    }

    batchMap[bId].items.push({
      id: row.id,
      hold_id: row.id,
      original_item_id: row.original_item_id,
      itemName: row.item_name,
      item_name: row.item_name,
      brandName: row.brand_name || row.item_name,
      brand_name: row.brand_name || row.item_name,
      company_name: row.company_name,
      company_scope: row.company_scope,
      filtered_company_name: row.filtered_company_name,
      partyName: row.party_name,
      party_name: row.party_name,
      shopName: row.shop_name,
      shop_name: row.shop_name,
      bcs: row.bcs,
      mls: row.mls,
      liquor_type: row.liquor_type,
      orderBox: row.order_box,
      orderQty: row.order_qty,
      approvedBox: row.approved_box,
      approvedQty: row.approved_qty,
      poBox: row.po_box != null ? row.po_box : row.approved_box,
      poQty: row.po_qty != null ? row.po_qty : row.approved_qty,
      unique_indent_id: row.original_unique_indent_id,
      original_unique_indent_id: row.original_unique_indent_id,
      party_indent_id: row.party_indent_id,
      indent_emp_code: row.indent_emp_code,
      indent_created_at: row.indent_created_at,
      approver_emp_code: row.approver_emp_code,
      approved_at: row.approved_at,
      approver_action: row.approver_action,
      is_on_hold: true
    });
  });

  const heldBatches = Object.values(batchMap);

  // Create a minimal indents list compatible with any other parts expecting it
  const formattedIndentsData = pendingItems.map(item => ({
    id: item.indent_id,
    shop_name: item.shop_name
  }));

  return {
    indentData: pendingItems,
    heldBatches: heldBatches,
    heldItemIds: heldItemIdsSet,
    heldIndentData: heldBatches,
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
  'district',
  'area',
  'vendor_phone',
  'vendor_id'
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

  // Graceful fallback if 'area', 'vendor_phone', 'district', or 'company_scope' columns are not yet migrated in PostgreSQL (PGRST204)
  if (error && (error.code === 'PGRST204' || error.message?.includes('area') || error.message?.includes('vendor_phone') || error.message?.includes('district') || error.message?.includes('company_scope'))) {
    console.warn("purchase_purchase_orders table fallback retry:", error.message);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.area;
    delete fallbackPayload.vendor_phone;

    let retry = await supabase
      .from('purchase_purchase_orders')
      .insert([fallbackPayload])
      .select();

    if (retry.error && (retry.error.code === 'PGRST204' || retry.error.message?.includes('district') || retry.error.message?.includes('company_scope'))) {
      delete fallbackPayload.district;
      delete fallbackPayload.company_scope;
      retry = await supabase
        .from('purchase_purchase_orders')
        .insert([fallbackPayload])
        .select();
    }

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

/**
 * Move items from active PO into dedicated purchase_hold table, preserving full lifecycle and company scopes.
 */
export const holdItemsToHoldTable = async ({
  items = [],
  partyKey,
  partyName,
  companyScope,
  companyName,
  shopName,
  holdType = "complete_po",
  holdReason = null,
  empCode = null,
}) => {
  if (!items || items.length === 0) return [];

  const holdBatchId = `hold-batch-${Date.now()}`;
  const now = new Date().toISOString();

  // Query purchase_dashboard to enrich lifecycle info (indent & approval metadata)
  const itemNames = items.map(i => i.itemName || i.item_name).filter(Boolean);
  let dashboardMap = {};
  if (itemNames.length > 0) {
    try {
      const { data: dashRows } = await supabase
        .from("purchase_dashboard")
        .select("item_name, indent_emp_code, indent_created_at, approver_emp_code, approver_action, approved_at, shop_name")
        .in("item_name", itemNames)
        .order("created_at", { ascending: false })
        .limit(200);
      if (dashRows) {
        dashRows.forEach(r => {
          if (!dashboardMap[r.item_name]) {
            dashboardMap[r.item_name] = r;
          }
        });
      }
    } catch (e) {
      console.warn("Could not query dashboard for hold lifecycle enrichment:", e);
    }
  }

  const holdPayload = items.map(item => {
    const itemName = item.itemName || item.item_name;
    const dashInfo = dashboardMap[itemName] || {};
    const itemShop = shopName || item.shopName || item.shop_name || dashInfo.shop_name || "Unknown";

    return {
      hold_batch_id: holdBatchId,
      hold_type: holdType,
      party_key: partyKey || (companyScope ? `${partyName}::${companyScope}` : partyName),
      party_name: partyName || item.partyName || item.party_name || "Unspecified Vendor",
      company_scope: companyScope || item.company_scope || item.filtered_company_name || null,
      filtered_company_name: companyScope || item.company_scope || item.filtered_company_name || null,
      company_name: companyName || item.company_name || null,
      shop_name: itemShop,

      original_item_id: item.id || null,
      original_unique_indent_id: item.unique_indent_id || item.indent_id || null,
      party_indent_id: item.party_indent_id || null,
      item_name: itemName,
      brand_name: item.brandName || item.brand_name || itemName,
      bcs: item.bcs != null ? parseFloat(item.bcs) : null,
      mls: item.mls != null ? parseFloat(item.mls) : (item.ml_s != null ? parseFloat(item.ml_s) : null),
      liquor_type: item.liquorType || item.liquor_type || null,
      qty_out: item.qtyOut != null ? parseFloat(item.qtyOut) : (item.qty_out != null ? parseFloat(item.qty_out) : 0),
      closing_qty: item.closingQty != null ? parseFloat(item.closingQty) : (item.closing_qty != null ? parseFloat(item.closing_qty) : 0),

      order_box: item.orderBox != null ? parseFloat(item.orderBox) : (item.order_box != null ? parseFloat(item.order_box) : 0),
      order_qty: item.orderQty != null ? parseFloat(item.orderQty) : (item.order_qty != null ? parseFloat(item.order_qty) : 0),
      indent_emp_code: item.indent_emp_code || dashInfo.indent_emp_code || null,
      indent_created_at: item.indent_created_at || dashInfo.indent_created_at || null,

      approved_box: item.approvedBox != null ? parseFloat(item.approvedBox) : (item.approved_box != null ? parseFloat(item.approved_box) : (item.orderBox || item.order_box || 0)),
      approved_qty: item.approvedQty != null ? parseFloat(item.approvedQty) : (item.approved_qty != null ? parseFloat(item.approved_qty) : (item.orderQty || item.order_qty || 0)),
      approver_emp_code: item.approved_by_emp_code || dashInfo.approver_emp_code || null,
      approver_action: dashInfo.approver_action || "Approved",
      approved_at: dashInfo.approved_at || null,

      po_box: item.poBox != null ? parseFloat(item.poBox) : (item.po_box != null ? parseFloat(item.po_box) : null),
      po_qty: item.poQty != null ? parseFloat(item.poQty) : (item.po_qty != null ? parseFloat(item.po_qty) : null),

      held_by_emp_code: empCode,
      held_at: now,
      hold_reason: holdReason,
    };
  });

  // 1. Insert into purchase_hold in chunks of 50
  const chunkSize = 50;
  let insertedHoldItems = [];
  for (let i = 0; i < holdPayload.length; i += chunkSize) {
    const chunk = holdPayload.slice(i, i + chunkSize);
    const { data: inserted, error: insertErr } = await supabase
      .from("purchase_hold")
      .insert(chunk)
      .select();
    if (insertErr) throw insertErr;
    if (inserted) insertedHoldItems = [...insertedHoldItems, ...inserted];
  }

  // 2. Delete those items from purchase_approved_indent_items
  const idsToDelete = items.map(i => i.id).filter(Boolean);
  if (idsToDelete.length > 0) {
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize);
      await supabase
        .from("purchase_approved_indent_items")
        .delete()
        .in("id", chunk);
    }
  }

  // 3. Update purchase_dashboard with po_action = 'On Hold'
  if (itemNames.length > 0) {
    try {
      const uniqueIndentIds = [...new Set(items.map(i => (i.unique_indent_id || i.indent_id || "").split("::")[0].trim()).filter(Boolean))];
      for (const indId of uniqueIndentIds) {
        await supabase
          .from("purchase_dashboard")
          .update({
            po_action: "On Hold",
            po_emp_code: empCode,
            updated_at: now
          })
          .eq("indent_id", indId)
          .in("item_name", itemNames)
          .is("po_id", null);
      }
    } catch (dashErr) {
      console.warn("Could not sync dashboard hold status:", dashErr);
    }
  }

  return insertedHoldItems;
};

/**
 * Fetch held items from purchase_hold, grouped into vendor/company batches.
 */
export const fetchHeldFromHoldTable = async (assignedShops = [], isShopAdmin = true) => {
  let query = supabase
    .from("purchase_hold")
    .select("*")
    .order("held_at", { ascending: false });

  if (!isShopAdmin && assignedShops && assignedShops.length > 0) {
    query = query.in("shop_name", assignedShops);
  }

  const { data: rawHoldRows, error } = await query;
  if (error) {
    console.error("Error fetching held items from purchase_hold:", error);
    return { batches: [], heldItemIds: new Set() };
  }

  if (!rawHoldRows || rawHoldRows.length === 0) {
    return { batches: [], heldItemIds: new Set() };
  }

  const heldItemIds = new Set(rawHoldRows.map(r => r.original_item_id || r.id));

  const batchMap = {};
  rawHoldRows.forEach(row => {
    const bId = row.hold_batch_id || `batch-${row.party_key || row.party_name}`;
    if (!batchMap[bId]) {
      batchMap[bId] = {
        batchId: bId,
        type: row.hold_type || "complete_po",
        partyKey: row.party_key || (row.company_scope ? `${row.party_name}::${row.company_scope}` : row.party_name),
        partyName: row.party_name,
        companyScope: row.company_scope || row.filtered_company_name || null,
        companyName: row.company_name || null,
        shopName: row.shop_name,
        heldAt: row.held_at ? new Date(row.held_at).toLocaleString() : new Date().toLocaleString(),
        heldByEmpCode: row.held_by_emp_code,
        items: []
      };
    }

    batchMap[bId].items.push({
      id: row.id,
      hold_id: row.id,
      original_item_id: row.original_item_id,
      itemName: row.item_name,
      item_name: row.item_name,
      brandName: row.brand_name || row.item_name,
      brand_name: row.brand_name || row.item_name,
      company_name: row.company_name,
      company_scope: row.company_scope,
      filtered_company_name: row.filtered_company_name,
      partyName: row.party_name,
      party_name: row.party_name,
      shopName: row.shop_name,
      shop_name: row.shop_name,
      bcs: row.bcs,
      mls: row.mls,
      liquor_type: row.liquor_type,
      orderBox: row.order_box,
      orderQty: row.order_qty,
      approvedBox: row.approved_box,
      approvedQty: row.approved_qty,
      poBox: row.po_box != null ? row.po_box : row.approved_box,
      poQty: row.po_qty != null ? row.po_qty : row.approved_qty,
      unique_indent_id: row.original_unique_indent_id,
      original_unique_indent_id: row.original_unique_indent_id,
      party_indent_id: row.party_indent_id,
      indent_emp_code: row.indent_emp_code,
      indent_created_at: row.indent_created_at,
      approver_emp_code: row.approver_emp_code,
      approved_at: row.approved_at,
      approver_action: row.approver_action,
      is_on_hold: true
    });
  });

  return {
    batches: Object.values(batchMap),
    heldItemIds
  };
};

/**
 * Restore held batch or single item from purchase_hold back to active PO pipeline under a new unique Indent ID.
 */
export const restoreHeldFromHoldTable = async ({
  batchId = null,
  holdItemId = null,
  empCode = null
}) => {
  let query = supabase.from("purchase_hold").select("*");
  if (holdItemId) {
    query = query.eq("id", holdItemId);
  } else if (batchId) {
    query = query.eq("hold_batch_id", batchId);
  } else {
    return null;
  }

  const { data: rowsToRestore, error: fetchErr } = await query;
  if (fetchErr) throw fetchErr;
  if (!rowsToRestore || rowsToRestore.length === 0) return null;

  const sampleRow = rowsToRestore[0];
  const partyName = sampleRow.party_name;
  const companyScope = sampleRow.company_scope || sampleRow.filtered_company_name || null;
  const originalUniqueIndentId = sampleRow.original_unique_indent_id || "IN-1";

  // 1. Resolve new unique sub-increment indent ID (e.g. IN-670-1 or IN-670-2)
  const newUniqueIndentId = await resolveSubIncrementIndentId(
    originalUniqueIndentId,
    partyName,
    companyScope
  );

  const now = new Date().toISOString();

  // 2. Prepare payload for purchase_approved_indent_items
  const approvedPayload = rowsToRestore.map(row => ({
    id: row.original_item_id || undefined,
    indent_id: null, // Detached so Indent page remains 100% unlocked for new submissions
    party_indent_id: row.party_indent_id,
    unique_indent_id: newUniqueIndentId,
    item_name: row.item_name,
    brand_name: row.brand_name || row.item_name,
    company_name: row.company_name,
    company_scope: row.company_scope,
    filtered_company_name: row.filtered_company_name,
    party_name: row.party_name,
    bcs: row.bcs,
    mls: row.mls,
    liquor_type: row.liquor_type,
    qty_out: row.qty_out || 0,
    closing_qty: row.closing_qty || 0,
    order_box: row.order_box || 0,
    order_qty: row.order_qty || 0,
    approved_box: row.approved_box != null ? row.approved_box : row.order_box,
    approved_qty: row.approved_qty != null ? row.approved_qty : row.order_qty,
    po_box: row.po_box != null ? row.po_box : row.approved_box,
    po_qty: row.po_qty != null ? row.po_qty : row.approved_qty,
    po_status: "pending",
    approval_status: "approved",
    approved_by_emp_code: row.approver_emp_code || null,
    created_at: now,
    updated_at: now
  }));

  // Delete any existing rows with matching id to prevent duplicates
  const existingIdsToDelete = approvedPayload.map((p) => p.id).filter(Boolean);
  if (existingIdsToDelete.length > 0) {
    for (let i = 0; i < existingIdsToDelete.length; i += chunkSize) {
      const chunk = existingIdsToDelete.slice(i, i + chunkSize);
      await supabase
        .from("purchase_approved_indent_items")
        .delete()
        .in("id", chunk);
    }
  }

  // Insert into purchase_approved_indent_items
  for (let i = 0; i < approvedPayload.length; i += chunkSize) {
    const chunk = approvedPayload.slice(i, i + chunkSize);
    const { error: insErr } = await supabase
      .from("purchase_approved_indent_items")
      .insert(chunk);
    if (insErr) {
      console.warn("Direct insert failed on restore, retrying with upsert:", insErr.message);
      const { error: upsertErr } = await supabase
        .from("purchase_approved_indent_items")
        .upsert(chunk, { onConflict: "id" });
      if (upsertErr) throw upsertErr;
    }
  }

  // 3. Update or recreate dashboard record with new unique Indent ID and full preserved lifecycle
  const newCleanId = (newUniqueIndentId || "").split("::")[0].trim();
  const oldCleanId = (originalUniqueIndentId || "").split("::")[0].trim();
  const itemNames = rowsToRestore.map(r => r.item_name).filter(Boolean);

  try {
    const { data: existingDash } = await supabase
      .from("purchase_dashboard")
      .select("id, item_name")
      .eq("indent_id", oldCleanId)
      .in("item_name", itemNames)
      .is("po_id", null);

    if (existingDash && existingDash.length > 0) {
      const existingItemNames = existingDash.map(d => d.item_name);
      await supabase
        .from("purchase_dashboard")
        .update({
          indent_id: newCleanId,
          po_action: "Pending PO",
          is_deleted: false,
          deleted_at: null,
          deletion_stage: null,
          deletion_reason: null,
          updated_at: now
        })
        .eq("indent_id", oldCleanId)
        .in("item_name", existingItemNames);
    } else {
      // If the old indent was deleted from purchase_dashboard, restore with full lifecycle
      const dashPayload = rowsToRestore.map(row => ({
        indent_id: newCleanId,
        shop_name: row.shop_name,
        party_name: row.party_name,
        company_name: row.company_name,
        company_scope: row.company_scope,
        filtered_company_name: row.filtered_company_name,
        item_name: row.item_name,
        order_box: row.order_box,
        order_qty: row.order_qty,
        indent_emp_code: row.indent_emp_code,
        indent_created_at: row.indent_created_at,
        approved_box: row.approved_box,
        approved_qty: row.approved_qty,
        approver_emp_code: row.approver_emp_code,
        approver_action: row.approver_action || "Approved",
        approved_at: row.approved_at,
        po_action: "Pending PO",
        is_deleted: false,
        created_at: now,
        updated_at: now
      }));
      await supabase.from("purchase_dashboard").insert(dashPayload);
    }
  } catch (dashSyncErr) {
    console.warn("Could not sync dashboard during unhold:", dashSyncErr);
  }

  // 4. Delete the rows from purchase_hold
  const holdIdsToDelete = rowsToRestore.map(r => r.id);
  for (let i = 0; i < holdIdsToDelete.length; i += chunkSize) {
    const chunk = holdIdsToDelete.slice(i, i + chunkSize);
    await supabase.from("purchase_hold").delete().in("id", chunk);
  }

  return {
    newUniqueIndentId,
    partyKey: sampleRow.party_key,
    partyName: sampleRow.party_name,
    companyScope: sampleRow.company_scope,
    restoredCount: rowsToRestore.length
  };
};

/**
 * Permanently delete held batch or single item from purchase_hold and mark in dashboard.
 */
export const deleteHeldFromHoldTable = async (batchId, holdItemId = null) => {
  let query = supabase.from("purchase_hold").select("*");
  if (holdItemId) {
    query = query.eq("id", holdItemId);
  } else if (batchId) {
    query = query.eq("hold_batch_id", batchId);
  } else {
    return;
  }

  const { data: rows } = await query;
  if (!rows || rows.length === 0) return;

  const itemNames = rows.map(r => r.item_name);
  const indentIds = [...new Set(rows.map(r => (r.original_unique_indent_id || "").split("::")[0].trim()).filter(Boolean))];

  // Mark in dashboard as deleted from hold
  try {
    for (const indId of indentIds) {
      await supabase
        .from("purchase_dashboard")
        .update({
          is_deleted: true,
          deletion_stage: "po",
          deletion_reason: "Deleted from On Hold",
          deleted_at: new Date().toISOString()
        })
        .eq("indent_id", indId)
        .in("item_name", itemNames)
        .is("po_id", null);
    }
  } catch (e) {
    console.warn("Could not mark dashboard deleted from hold:", e);
  }

  // Delete from purchase_hold
  const ids = rows.map(r => r.id);
  const chunkSize = 50;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    await supabase.from("purchase_hold").delete().in("id", chunk);
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

