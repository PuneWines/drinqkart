export const roundPoBox = (val) => {
  const x = parseFloat(val) || 0;
  if (x <= 0) return 0;
  const rounded = Math.ceil(x * 4) / 4;
  return parseFloat(rounded.toFixed(4));
};

export const transformActivePartyItems = (filteredApprovedItems, activeParty) => {
  if (!activeParty) return [];
  return filteredApprovedItems
    .filter(item => item.party_name === activeParty)
    .map(row => {
      const hasApprovedInDb = row.approved_box !== null && row.approved_box !== undefined;
      const orderBox = row.order_box !== null && row.order_box !== undefined ? parseFloat(row.order_box) : 0;
      const orderQty = row.order_qty !== null && row.order_qty !== undefined ? parseFloat(row.order_qty) : 0;
      const approvedBox = hasApprovedInDb ? parseFloat(row.approved_box) : 0;
      const approvedQty = row.approved_qty !== null && row.approved_qty !== undefined ? parseFloat(row.approved_qty) : 0;
      const bcs = row.bcs !== null && row.bcs !== undefined ? parseFloat(row.bcs) : null;

      const rawBaseBox = row.po_box !== null && row.po_box !== undefined
        ? parseFloat(row.po_box)
        : (hasApprovedInDb ? approvedBox : orderBox);

      const poBox = roundPoBox(rawBaseBox);

      const poQty = row.po_qty !== null && row.po_qty !== undefined
        ? parseFloat(row.po_qty)
        : (bcs ? Math.round(poBox * bcs) : (hasApprovedInDb ? approvedQty : orderQty));

      const qtyType = (poBox > 0 && poBox % 1 === 0) ? "Box" : "Bottles";
      const displayQty = qtyType === "Box" 
        ? poBox.toString() 
        : Math.ceil(poQty).toString();

      return {
        ...row,
        hasApprovedInDb,
        itemName: row.item_name,
        brandName: row.brand_name,
        liquorType: row.liquor_type,
        closingQty: row.closing_qty,
        bcs,
        orderQty,
        orderBox,
        approvedQty,
        approvedBox,
        poQty,
        poBox,
        qtyType,
        displayQty,
        shopName: row.shop_name,
        perDaySale: row.per_day_sale_last_month ?? row.perDaySale ?? "—"
      };
    })
    .filter(row => row.poQty > 0 || row.approvedQty > 0 || row.orderQty > 0);
};

export const calculateTotals = (items) => {
  const totalBoxes = items
    .filter(r => (r.qtyType || ((parseFloat(r.poBox || 0) > 0 && parseFloat(r.poBox || 0) % 1 === 0) ? "Box" : "Bottles")) === "Box")
    .reduce((s, r) => s + (parseFloat(r.poBox) || 0), 0);

  const totalBottles = items
    .filter(r => (r.qtyType || ((parseFloat(r.poBox || 0) > 0 && parseFloat(r.poBox || 0) % 1 === 0) ? "Box" : "Bottles")) === "Bottles")
    .reduce((s, r) => s + (parseFloat(r.poQty) || 0), 0);

  const displayTotalBoxes = Math.round(totalBoxes).toString();
  const displayTotalBottles = Math.ceil(totalBottles).toLocaleString("en-IN");

  return {
    totalBoxes,
    totalBottles,
    displayTotalBoxes,
    displayTotalBottles
  };
};
