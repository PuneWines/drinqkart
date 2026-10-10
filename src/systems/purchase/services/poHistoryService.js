import { supabase } from "../lib/supabase";

const PAGE_SIZE = 1000;

export const PO_LIGHT_COLUMNS = [
  "id",
  "po_number",
  "po_type",
  "shop_name",
  "vendor_name",
  "vendor_id",
  "created_at",
  "total_order_qty",
  "total_order_box",
  "total_approved_qty",
  "total_approved_box",
  "total_po_qty",
  "total_po_box",
  "first_brand_name",
  "indent_id",
  "trader_pdf_url",
  "transporter_pdf_url",
  "receiver_pdf_url",
  "trader_status",
  "transporter_status",
  "receiver_status",
].join(", ");

/**
 * Fetch all purchase orders with lightweight display columns in parallel.
 * Returns the full list for client-side filtering/search in < 1 second.
 */
export const fetchAllPurchaseOrders = async () => {
  // Fetch initial 2 pages (0..1999) in parallel along with the total count
  const [res0, res1] = await Promise.all([
    supabase
      .from("purchase_purchase_orders")
      .select(PO_LIGHT_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(0, PAGE_SIZE - 1),
    supabase
      .from("purchase_purchase_orders")
      .select(PO_LIGHT_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(PAGE_SIZE, PAGE_SIZE * 2 - 1),
  ]);

  if (res0.error) throw res0.error;
  if (res1.error) throw res1.error;

  let allData = [...(res0.data || []), ...(res1.data || [])];
  const totalCount = res0.count || allData.length;

  // If table exceeds 2,000 rows, fetch remaining pages concurrently
  if (totalCount > PAGE_SIZE * 2) {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const remainingPromises = [];
    for (let p = 2; p < totalPages; p++) {
      remainingPromises.push(
        supabase
          .from("purchase_purchase_orders")
          .select(PO_LIGHT_COLUMNS)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)
      );
    }
    const additionalResults = await Promise.all(remainingPromises);
    for (const res of additionalResults) {
      if (res.error) throw res.error;
      if (res.data) {
        allData = allData.concat(res.data);
      }
    }
  }

  // Resolve shop_name for older records if missing
  const missingShopPOs = allData.filter((po) => !po.shop_name && po.indent_id);
  if (missingShopPOs.length > 0) {
    const parentIndentIds = [
      ...new Set(
        missingShopPOs
          .map((po) => {
            const parts = po.indent_id.split("::");
            return parts[0];
          })
          .filter(Boolean)
      ),
    ];

    if (parentIndentIds.length > 0) {
      const { data: indents, error: indentsError } = await supabase
        .from("purchase_indents")
        .select("id, shop_name")
        .in("id", parentIndentIds);

      if (!indentsError && indents) {
        const indentMap = indents.reduce((acc, ind) => {
          acc[ind.id] = ind.shop_name;
          return acc;
        }, {});

        allData = allData.map((po) => {
          if (!po.shop_name) {
            const parts = (po.indent_id || "").split("::");
            const parentId = parts[0];
            return {
              ...po,
              shop_name: indentMap[parentId] || "Unknown",
            };
          }
          return po;
        });
      }
    }
  }

  return allData.map((po) => ({
    ...po,
    shop_name: po.shop_name || "Unknown",
  }));
};

/**
 * Fetch a single purchase order by ID.
 */
export const fetchPurchaseOrderById = async (id) => {
  const { data, error } = await supabase
    .from("purchase_purchase_orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;

  if (data && !data.shop_name && data.indent_id) {
    const parentId = data.indent_id.split("::")[0];
    const { data: indent } = await supabase
      .from("purchase_indents")
      .select("shop_name")
      .eq("id", parentId)
      .single();
    if (indent) {
      data.shop_name = indent.shop_name;
    }
  }

  if (data) {
    data.shop_name = data.shop_name || "Unknown";
  }

  return data;
};
