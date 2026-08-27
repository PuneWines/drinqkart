import { Trash2 } from "lucide-react";

const inputCellStyle = {
  width: "100%",
  minWidth: "72px",
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: "6px",
  textAlign: "center",
  fontSize: "13px",
  fontWeight: "600",
  color: "#1e293b",
  backgroundColor: "#ffffff",
  outline: "none",
  boxSizing: "border-box"
};

const POItemsTable = ({ partyName, items = [], isReceiver, onRemoveItem, onUpdateItem, headerActions }) => {
  const orderQtyRows = items;

  const totalPoBoxes = orderQtyRows.reduce(
    (s, r) => s + (parseFloat(r.poBox !== undefined && r.poBox !== null ? r.poBox : (r.approvedBox ?? r.orderBox)) || 0),
    0
  );

  const totalPoBottles = orderQtyRows.reduce(
    (s, r) => s + (parseFloat(r.poQty !== undefined && r.poQty !== null ? r.poQty : (r.approvedQty ?? r.orderQty)) || 0),
    0
  );

  const displayTotalBoxes = Math.round(totalPoBoxes).toLocaleString("en-IN");
  const displayTotalBottles = Math.round(totalPoBottles).toLocaleString("en-IN");

  return (
    <div>
      {headerActions && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }} className="no-print">
          {headerActions}
        </div>
      )}
      <table className="po-items-table">
        <thead>
          <tr>
            <th className="po-text-center">S.No</th>
            <th>Shop Name</th>
            <th>Item Name</th>
            <th className="po-text-center">Per Day Sale</th>
            <th className="po-text-center">Closing Stock in Bottle</th>
            <th className="po-text-center">Order Box</th>
            <th className="po-text-center">Order Qty</th>
            <th className="po-text-center">Approved Box</th>
            <th className="po-text-center">Approved Qty</th>
            <th className="po-text-center" style={{ color: "#4338ca" }}>PO Box (Boxes)</th>
            <th className="po-text-center" style={{ color: "#4338ca" }}>PO Qty (Bottles)</th>
            <th className="po-text-center">Qty Type</th>
            {!isReceiver && onRemoveItem && <th className="po-text-center">Action</th>}
          </tr>
        </thead>
        <tbody>
          {partyName ? (
            <>
              {orderQtyRows.map((item, i) => {
                const currentPoBox = item.poBox !== undefined && item.poBox !== null ? item.poBox : (item.approvedBox ?? item.orderBox);
                const currentPoQty = item.poQty !== undefined && item.poQty !== null ? item.poQty : (item.approvedQty ?? item.orderQty);
                const perDaySaleVal = item.per_day_sale_last_month ?? item.perDaySale ?? "—";
                return (
                <tr key={item.id || i}>
                  <td className="po-text-center">{i + 1}</td>
                  <td><strong>{item.shopName || "—"}</strong></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong>{item.itemName || "—"}</strong>
                      {item.is_excluded && (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: '#fef3c7',
                          color: '#b45309',
                          border: '1px solid #fde68a'
                        }}>
                          Excluded
                        </span>
                      )}
                      {(item.approval_status === 'rejected' || item.is_rejected) && (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fecaca'
                        }}>
                          Rejected
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="po-text-center" style={{ fontWeight: "600", color: "#0f172a" }}>
                    {perDaySaleVal}
                  </td>
                <td className="po-text-center">
                  {item.closingQty != null ? item.closingQty : "—"}
                </td>
                {/* Order Box & Qty (Read-only System Auto) */}
                <td className="po-text-center" style={{ color: "#64748b" }}>
                  {item.orderBox != null && item.orderBox !== "" ? item.orderBox : "—"}
                </td>
                <td className="po-text-center" style={{ color: "#64748b" }}>
                  {item.orderQty != null && item.orderQty !== "" ? item.orderQty : "—"}
                </td>
                {/* Approved Box & Qty (Read-only Approved) */}
                <td className="po-text-center" style={{ color: "#0f172a", fontWeight: "500" }}>
                  {item.approvedBox != null && item.approvedBox !== "" ? item.approvedBox : (item.orderBox ?? "—")}
                </td>
                <td className="po-text-center" style={{ color: "#0f172a", fontWeight: "500" }}>
                  {item.approvedQty != null && item.approvedQty !== "" ? item.approvedQty : (item.orderQty ?? "—")}
                </td>
                {/* PO Box (Editable input pre-filled with approved/order) */}
                <td className="po-text-center" style={item.qtyType === "Box" ? { fontWeight: "600" } : {}}>
                  {onUpdateItem ? (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={currentPoBox ?? ""}
                      onChange={(e) => onUpdateItem(item.id, "poBox", e.target.value)}
                      style={inputCellStyle}
                    />
                  ) : (
                    currentPoBox != null && currentPoBox !== "" ? currentPoBox : "—"
                  )}
                </td>
                {/* PO Qty (Editable input pre-filled with approved/order) */}
                <td className="po-text-center" style={item.qtyType === "Bottles" ? { fontWeight: "600" } : {}}>
                  {onUpdateItem ? (
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={currentPoQty ?? ""}
                      onChange={(e) => onUpdateItem(item.id, "poQty", e.target.value)}
                      style={inputCellStyle}
                    />
                  ) : (
                    currentPoQty != null && currentPoQty !== "" ? currentPoQty : "—"
                  )}
                </td>
                <td className="po-text-center" style={{ color: "#64748b", fontSize: "0.8rem" }}>
                  {item.qtyType || "—"}
                </td>
                {!isReceiver && onRemoveItem && (
                  <td className="po-text-center">
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="po-item-delete-btn"
                      title="Remove item"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "4px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px",
                        transition: "background-color 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#fee2e2"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            )})}

            {orderQtyRows.length > 0 && (
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #94a3b8", backgroundColor: "#f8fafc" }}>
                <td colSpan={9} style={{ textAlign: "right", padding: "10px 16px" }}><strong>PO Total:</strong></td>
                <td className="po-text-center" style={{ padding: "10px 16px", fontWeight: "700", color: "#1e1b4b" }}>{displayTotalBoxes}</td>
                <td className="po-text-center" style={{ padding: "10px 16px", fontWeight: "700", color: "#1e1b4b" }}>{displayTotalBottles}</td>
                <td className="po-text-center" style={{ padding: "10px 16px" }}></td>
                {!isReceiver && onRemoveItem && <td className="po-text-center" style={{ padding: "10px 16px" }}></td>}
              </tr>
            )}
          </>
        ) : (
          <tr>
            <td colSpan={!isReceiver && onRemoveItem ? 13 : 12} className="po-text-center" style={{ padding: "24px", color: "#64748b", fontStyle: "italic" }}>
              Please select a vendor above to view the items list.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
  );
};

export default POItemsTable;
