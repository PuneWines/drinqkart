import React, { useState, useMemo } from "react";
import { Trash2, PauseCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

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

const POItemsTable = ({
  partyName,
  items = [],
  isReceiver,
  onRemoveItem,
  onHoldItem,
  onUpdateItem,
  headerActions,
  sortBy: externalSortBy,
  sortDir: externalSortDir,
  onSortChange,
}) => {
  const [internalSortBy, setInternalSortBy] = useState("name");
  const [internalSortDir, setInternalSortDir] = useState("asc");

  const currentSortBy = externalSortBy !== undefined ? externalSortBy : internalSortBy;
  const currentSortDir = externalSortDir !== undefined ? externalSortDir : internalSortDir;

  const handleToggleSort = (field) => {
    let newDir = "asc";
    if (currentSortBy === field) {
      newDir = currentSortDir === "asc" ? "desc" : "asc";
    }
    if (onSortChange) {
      onSortChange(field, newDir);
    } else {
      setInternalSortBy(field);
      setInternalSortDir(newDir);
    }
  };

  const orderQtyRows = useMemo(() => {
    const list = [...items];
    return list.sort((a, b) => {
      if (currentSortBy === "name") {
        const nameA = (a.itemName || a.item_name || "").trim().toLowerCase();
        const nameB = (b.itemName || b.item_name || "").trim().toLowerCase();
        const comp = nameA.localeCompare(nameB);
        if (comp !== 0) return currentSortDir === "asc" ? comp : -comp;
        const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
        const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
        return mlA - mlB;
      }
      if (currentSortBy === "size") {
        const mlA = parseFloat(a.mls !== undefined ? a.mls : a.ml_s) || 0;
        const mlB = parseFloat(b.mls !== undefined ? b.mls : b.ml_s) || 0;
        const comp = mlA - mlB;
        if (comp !== 0) return currentSortDir === "asc" ? comp : -comp;
        const nameA = (a.itemName || a.item_name || "").trim().toLowerCase();
        const nameB = (b.itemName || b.item_name || "").trim().toLowerCase();
        return nameA.localeCompare(nameB);
      }
      return 0;
    });
  }, [items, currentSortBy, currentSortDir]);

  const totalPoBoxes = orderQtyRows.reduce((s, r) => {
    const boxVal = parseFloat(r.poBox !== undefined && r.poBox !== null ? r.poBox : (r.approvedBox ?? r.orderBox)) || 0;
    const type = r.qtyType || ((boxVal > 0 && boxVal % 1 === 0) ? "Box" : "Bottles");
    return type === "Box" ? s + boxVal : s;
  }, 0);

  const totalPoBottles = orderQtyRows.reduce((s, r) => {
    const boxVal = parseFloat(r.poBox !== undefined && r.poBox !== null ? r.poBox : (r.approvedBox ?? r.orderBox)) || 0;
    const qtyVal = parseFloat(r.poQty !== undefined && r.poQty !== null ? r.poQty : (r.approvedQty ?? r.orderQty)) || 0;
    const type = r.qtyType || ((boxVal > 0 && boxVal % 1 === 0) ? "Box" : "Bottles");
    return type === "Bottles" ? s + qtyVal : s;
  }, 0);

  const displayTotalBoxes = Math.round(totalPoBoxes).toLocaleString("en-IN");
  const displayTotalBottles = Math.round(totalPoBottles).toLocaleString("en-IN");

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }} className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
            Sort:
          </span>
          <button
            type="button"
            onClick={() => handleToggleSort("name")}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: currentSortBy === "name" ? '1px solid #4f46e5' : '1px solid #cbd5e1',
              backgroundColor: currentSortBy === "name" ? '#eef2ff' : '#ffffff',
              color: currentSortBy === "name" ? '#4338ca' : '#475569',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            {currentSortBy === "name" ? (
              currentSortDir === "asc" ? <ArrowUp size={13} color="#4338ca" /> : <ArrowDown size={13} color="#4338ca" />
            ) : (
              <ArrowUpDown size={13} />
            )}
            Sort by Name {currentSortBy === "name" ? (currentSortDir === "asc" ? "(A-Z)" : "(Z-A)") : ""}
          </button>
          <button
            type="button"
            onClick={() => handleToggleSort("size")}
            style={{
              padding: '5px 12px',
              borderRadius: '6px',
              border: currentSortBy === "size" ? '1px solid #4f46e5' : '1px solid #cbd5e1',
              backgroundColor: currentSortBy === "size" ? '#eef2ff' : '#ffffff',
              color: currentSortBy === "size" ? '#4338ca' : '#475569',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.15s ease'
            }}
          >
            {currentSortBy === "size" ? (
              currentSortDir === "asc" ? <ArrowUp size={13} color="#4338ca" /> : <ArrowDown size={13} color="#4338ca" />
            ) : (
              <ArrowUpDown size={13} />
            )}
            Sort by Size (MLS) {currentSortBy === "size" ? (currentSortDir === "asc" ? "(Low-High)" : "(High-Low)") : ""}
          </button>
        </div>
        {headerActions && (
          <div>
            {headerActions}
          </div>
        )}
      </div>
      <table className="po-items-table">
        <thead>
          <tr>
            <th className="po-text-center">S.No</th>
            <th>Shop Name</th>
            <th
              onClick={() => handleToggleSort("name")}
              style={{ cursor: "pointer", userSelect: "none" }}
              title="Click to sort by Item Name"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>Item Name</span>
                {currentSortBy === "name" ? (
                  currentSortDir === "asc" ? <ArrowUp size={13} color="#4f46e5" /> : <ArrowDown size={13} color="#4f46e5" />
                ) : (
                  <ArrowUpDown size={12} color="#94a3b8" />
                )}
              </div>
            </th>
            <th
              className="po-text-center"
              onClick={() => handleToggleSort("size")}
              style={{ cursor: "pointer", userSelect: "none" }}
              title="Click to sort by Size (MLS)"
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                <span>Size (mls)</span>
                {currentSortBy === "size" ? (
                  currentSortDir === "asc" ? <ArrowUp size={13} color="#4f46e5" /> : <ArrowDown size={13} color="#4f46e5" />
                ) : (
                  <ArrowUpDown size={12} color="#94a3b8" />
                )}
              </div>
            </th>
            <th className="po-text-center">Per Day Sale</th>
            <th className="po-text-center">Closing Stock in Bottle</th>
            <th className="po-text-center">Order Box</th>
            <th className="po-text-center">Order Qty</th>
            <th className="po-text-center">Approved Box</th>
            <th className="po-text-center">Approved Qty</th>
            <th className="po-text-center" style={{ color: "#4338ca" }}>PO Box (Boxes)</th>
            <th className="po-text-center" style={{ color: "#4338ca" }}>PO Qty (Bottles)</th>
            <th className="po-text-center">Qty Type</th>
            {!isReceiver && (onRemoveItem || onHoldItem) && <th className="po-text-center">Action</th>}
          </tr>
        </thead>
        <tbody>
          {partyName ? (
            <>
              {orderQtyRows.map((item, i) => {
                const currentPoBox = item.poBox !== undefined && item.poBox !== null ? item.poBox : (item.hasApprovedInDb ? item.approvedBox : item.orderBox);
                const currentPoQty = item.poQty !== undefined && item.poQty !== null ? item.poQty : (item.hasApprovedInDb ? item.approvedQty : item.orderQty);
                const perDaySaleVal = item.per_day_sale_last_month ?? item.perDaySale ?? "—";
                return (
                <tr key={item.id || i}>
                  <td className="po-text-center">{i + 1}</td>
                  <td><strong>{item.shopName || "—"}</strong></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong>{item.itemName || "—"}</strong>
                      {item.is_on_hold && (
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: '#fef3c7',
                          color: '#d97706',
                          border: '1px solid #fde68a'
                        }}>
                          On Hold
                        </span>
                      )}
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
                  <td className="po-text-center" style={{ fontWeight: "600", color: "#334155" }}>
                    {item.mls || item.ml_s || "—"}
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
                  {item.approvedBox != null && item.approvedBox !== "" ? item.approvedBox : 0}
                </td>
                <td className="po-text-center" style={{ color: "#0f172a", fontWeight: "500" }}>
                  {item.approvedQty != null && item.approvedQty !== "" ? item.approvedQty : 0}
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
                {!isReceiver && (onRemoveItem || onHoldItem) && (
                  <td className="po-text-center">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                      {onHoldItem && (
                        <button
                          onClick={() => onHoldItem(item.id)}
                          title={item.is_on_hold ? "Unhold item" : "Hold item"}
                          style={{
                            background: "none",
                            border: "none",
                            color: item.is_on_hold ? "#d97706" : "#f59e0b",
                            cursor: "pointer",
                            padding: "4px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "4px",
                            transition: "background-color 0.2s"
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#fef3c7"}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                        >
                          <PauseCircle size={15} />
                        </button>
                      )}
                      {onRemoveItem && (
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
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )})}

            {orderQtyRows.length > 0 && (
              <tr style={{ fontWeight: "bold", borderTop: "2px solid #94a3b8", backgroundColor: "#f8fafc" }}>
                <td colSpan={10} style={{ textAlign: "right", padding: "10px 16px" }}><strong>PO Total:</strong></td>
                <td className="po-text-center" style={{ padding: "10px 16px", fontWeight: "700", color: "#1e1b4b" }}>{displayTotalBoxes}</td>
                <td className="po-text-center" style={{ padding: "10px 16px", fontWeight: "700", color: "#1e1b4b" }}>{displayTotalBottles}</td>
                <td className="po-text-center" style={{ padding: "10px 16px" }}></td>
                {!isReceiver && onRemoveItem && <td className="po-text-center" style={{ padding: "10px 16px" }}></td>}
              </tr>
            )}
          </>
        ) : (
          <tr>
            <td colSpan={!isReceiver && onRemoveItem ? 14 : 13} className="po-text-center" style={{ padding: "24px", color: "#64748b", fontStyle: "italic" }}>
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
