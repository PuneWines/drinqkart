const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function backfill() {
  console.log('--- STARTING BACKFILL ---');
  // 1. Fetch indents
  const { data: indents, error: indErr } = await supabase.from('purchase_indents').select('*');
  if (indErr) throw indErr;
  const indentMap = new Map();
  indents.forEach(i => indentMap.set(i.id, i));

  // 2. Fetch POs for po_number lookup
  const { data: pos } = await supabase.from('purchase_purchase_orders').select('id, po_number, shop_name, vendor_name, trader_status, transporter_status, receiver_status, created_at');
  const poMap = new Map();
  pos?.forEach(p => poMap.set(p.id, p));

  // 3. Fetch existing purchase_dashboard rows so we don't duplicate
  const { data: existingDash } = await supabase.from('purchase_dashboard').select('indent_id, item_name');
  const existingKeys = new Set(
    (existingDash || []).map(r => r.indent_id + '::' + (r.item_name || '').trim().toLowerCase())
  );
  console.log('Currently in purchase_dashboard:', existingDash?.length, 'records');

  // 4. Process approved items
  const { data: approvedItems, error: appErr } = await supabase.from('purchase_approved_indent_items').select('*');
  if (appErr) throw appErr;
  console.log('Fetched approved items:', approvedItems.length);

  const rowsToInsert = [];
  const CHUNK_SIZE = 100;

  for (const item of approvedItems) {
    let parentIndentId = item.indent_id;
    if (!parentIndentId && item.unique_indent_id) {
      parentIndentId = item.unique_indent_id.split('::')[0];
    }
    if (!parentIndentId) {
      parentIndentId = item.party_indent_id || 'HISTORICAL-INDENT';
    }

    const parentIndent = indentMap.get(parentIndentId);
    let shopName = parentIndent?.shop_name;
    if (!shopName && item.po_id && poMap.has(item.po_id)) {
      shopName = poMap.get(item.po_id).shop_name;
    }
    if (!shopName) {
      shopName = 'TLS';
    }

    const itemName = (item.item_name || '').trim();
    if (!itemName) continue;

    const key = parentIndentId + '::' + itemName.toLowerCase();
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const po = item.po_id ? poMap.get(item.po_id) : null;

    rowsToInsert.push({
      indent_id: String(parentIndentId),
      shop_name: shopName,
      party_name: item.party_name || 'UNKNOWN',
      company_name: item.company_name || null,
      item_name: itemName,
      order_box: item.order_box != null ? parseFloat(item.order_box) : 0,
      order_qty: item.order_qty != null ? parseFloat(item.order_qty) : 0,
      indent_emp_code: 'System Import',
      indent_created_at: item.created_at || new Date().toISOString(),
      approved_box: item.approved_box != null ? parseFloat(item.approved_box) : (item.order_box != null ? parseFloat(item.order_box) : 0),
      approved_qty: item.approved_qty != null ? parseFloat(item.approved_qty) : (item.order_qty != null ? parseFloat(item.order_qty) : 0),
      approver_action: 'Approved (History)',
      approver_emp_code: item.approved_by_emp_code || 'Approver',
      approved_at: item.updated_at || item.created_at || new Date().toISOString(),
      po_id: item.po_id || null,
      po_number: po?.po_number || null,
      po_box: item.po_box != null ? parseFloat(item.po_box) : null,
      po_qty: item.po_qty != null ? parseFloat(item.po_qty) : null,
      po_action: item.po_id ? 'Ordered in PO' : null,
      po_emp_code: null,
      po_generated_at: po ? po.created_at : null,
      trader_status: po?.trader_status || 'Pending',
      transporter_status: po?.transporter_status || 'Pending',
      receiver_status: po?.receiver_status || 'Pending',
      is_deleted: false,
      updated_at: new Date().toISOString()
    });
  }

  // 5. Process pending indent items (with order_qty > 0 or !is_excluded)
  const { data: rawIndentItems, error: rawErr } = await supabase
    .from('purchase_indent_items')
    .select('*')
    .gt('order_qty', 0);
  if (rawErr) throw rawErr;
  console.log('Fetched raw indent items with order_qty > 0:', rawIndentItems.length);

  for (const item of rawIndentItems) {
    const parentIndentId = item.indent_id || 'HISTORICAL-INDENT';
    const parentIndent = indentMap.get(parentIndentId);
    const shopName = parentIndent?.shop_name || 'TLS';
    const itemName = (item.item_name || '').trim();
    if (!itemName) continue;

    const key = parentIndentId + '::' + itemName.toLowerCase();
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    rowsToInsert.push({
      indent_id: String(parentIndentId),
      shop_name: shopName,
      party_name: item.party_name || 'UNKNOWN',
      company_name: item.company_name || null,
      item_name: itemName,
      order_box: item.order_box != null ? parseFloat(item.order_box) : 0,
      order_qty: item.order_qty != null ? parseFloat(item.order_qty) : 0,
      indent_emp_code: item.created_by_emp_code || 'Indent Team',
      indent_created_at: item.created_at || new Date().toISOString(),
      approved_box: null,
      approved_qty: null,
      approver_action: null,
      approver_emp_code: null,
      approved_at: null,
      po_id: null,
      po_number: null,
      po_box: null,
      po_qty: null,
      po_action: null,
      po_emp_code: null,
      po_generated_at: null,
      trader_status: 'Pending',
      transporter_status: 'Pending',
      receiver_status: 'Pending',
      is_deleted: Boolean(item.is_excluded),
      deletion_stage: item.is_excluded ? 'indent' : null,
      deletion_reason: item.exclusion_reason || null,
      updated_at: new Date().toISOString()
    });
  }

  console.log('Total new rows to insert into purchase_dashboard:', rowsToInsert.length);

  let insertedCount = 0;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    const { error: insErr } = await supabase.from('purchase_dashboard').insert(chunk);
    if (insErr) {
      console.error('Error inserting chunk at index', i, insErr);
      throw insErr;
    }
    insertedCount += chunk.length;
    console.log(`Inserted ${insertedCount} / ${rowsToInsert.length}`);
  }

  console.log('--- BACKFILL COMPLETED SUCCESSFULLY ---');
  const { count: finalCount } = await supabase.from('purchase_dashboard').select('*', { count: 'exact', head: true });
  console.log('FINAL TOTAL COUNT in purchase_dashboard:', finalCount);
}

backfill();
