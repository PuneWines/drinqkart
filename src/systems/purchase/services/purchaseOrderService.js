import { supabase } from "../lib/supabase";

export const fetchNextPoNumber = async () => {
  const yr = new Date().getFullYear();
  const { data, error } = await supabase
    .from("purchase_purchase_orders")
    .select("po_number")
    .order("created_at", { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (!error && data && data.length > 0 && data[0].po_number) {
    const parts = data[0].po_number.split("-");
    if (parts.length > 1) {
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        nextSeq = lastSeq + 1;
      }
    }
  }
  return `${yr}/PO-${String(nextSeq).padStart(2, "0")}`;
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
    // Query 1: Fetch pending approved items (both pending and null po_status)
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
      .select("indent_id, vendor_name")
      .order("created_at", { ascending: false })
      .limit(500),

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

  // Map for backward compatibility with frontend code expecting indentsData and resolved shop_name
  const enrichedIndentData = (rawIndentItems || []).map(item => ({
    ...item,
    approval_status: "approved",
    is_excluded: false,
    shop_name: indentMap[item.indent_id] || item.purchase_indents?.shop_name || "Unknown"
  }));

  // Create a minimal indents list compatible with any other parts expecting it
  const formattedIndentsData = (rawIndentItems || []).map(item => ({
    id: item.indent_id,
    shop_name: indentMap[item.indent_id] || item.purchase_indents?.shop_name || "Unknown"
  }));

  return {
    indentData: enrichedIndentData,
    poData: rawPoData || [],
    indentsData: formattedIndentsData,
    vendorsData: vendorsData || [],
    transpData: transpData || [],
    recvData: recvData || []
  };
};

export const generateVendorId = async (activeParty) => {
  if (!activeParty) return "VN-000";
  const { data: vendor } = await supabase
    .from('purchase_vendors')
    .select('id')
    .ilike('party_name', activeParty.trim())
    .limit(1)
    .maybeSingle();

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
  'receiver_pdf_url'
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
  const { data, error } = await supabase
    .from('purchase_purchase_orders')
    .insert([payload])
    .select();

  if (error) throw error;
  return data;
};

export const getOrCreateVendorPortalLink = async (activeParty, currentVendorId, baseUrl) => {
  if (!activeParty) return "";
  const { data: vendorRow } = await supabase
    .from("purchase_vendors")
    .select("id, portal_link")
    .ilike("party_name", activeParty.trim())
    .limit(1)
    .maybeSingle();

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

