export const transformActivePartyItems = (filteredApprovedItems, activeParty) => {
  if (!activeParty) return [];
  return filteredApprovedItems
    .filter(item => item.party_name === activeParty)
    .map(row => {
      const orderBox = row.order_box !== null && row.order_box !== undefined ? parseFloat(row.order_box) : 0;
      const orderQty = row.order_qty !== null && row.order_qty !== undefined ? parseFloat(row.order_qty) : 0;
      const approvedBox = row.approved_box !== null && row.approved_box !== undefined ? parseFloat(row.approved_box) : orderBox;
      const approvedQty = row.approved_qty !== null && row.approved_qty !== undefined ? parseFloat(row.approved_qty) : orderQty;
      const poBox = row.po_box !== null && row.po_box !== undefined ? parseFloat(row.po_box) : approvedBox;
      const poQty = row.po_qty !== null && row.po_qty !== undefined ? parseFloat(row.po_qty) : approvedQty;
      const bcs = row.bcs !== null && row.bcs !== undefined ? parseFloat(row.bcs) : null;

      const qtyType = poBox >= 0.90 ? "Box" : "Bottles";
      const displayQty = qtyType === "Box" 
        ? Math.round(poBox).toString() 
        : Math.ceil(poQty).toString();

      return {
        ...row,
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
    .filter(r => r.qtyType === "Box")
    .reduce((s, r) => s + (r.orderBox || 0), 0);

  const totalBottles = items
    .filter(r => r.qtyType === "Bottles")
    .reduce((s, r) => s + (r.orderQty || 0), 0);

  const displayTotalBoxes = totalBoxes % 1 === 0 ? totalBoxes.toString() : totalBoxes.toFixed(2);
  const displayTotalBottles = Math.ceil(totalBottles).toLocaleString("en-IN");

  return {
    totalBoxes,
    totalBottles,
    displayTotalBoxes,
    displayTotalBottles
  };
};
