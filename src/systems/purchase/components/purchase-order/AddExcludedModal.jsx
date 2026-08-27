import React, { useState, useEffect } from "react";
import { X, CheckSquare, Square, Plus, Search, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

const AddExcludedModal = ({
  isOpen,
  onClose,
  mode = "excluded", // "excluded" | "rejected"
  vendorName,
  shopName,
  onAddItems,
  alreadyAddedIds = []
}) => {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const isRejectedMode = mode === "rejected";
  const titleText = isRejectedMode ? "Add Rejected Indents" : "Add Excluded Indents";
  const headerBgColor = isRejectedMode ? "#fef2f2" : "#fffbeb";
  const headerIconBg = isRejectedMode ? "#fee2e2" : "#fef3c7";
  const headerIconColor = isRejectedMode ? "#dc2626" : "#d97706";
  const titleColor = isRejectedMode ? "#991b1b" : "#92400e";
  const subTitleColor = isRejectedMode ? "#b91c1c" : "#b45309";
  const btnBgColor = isRejectedMode ? "#dc2626" : "#d97706";

  useEffect(() => {
    if (isOpen && vendorName) {
      fetchItems();
    } else {
      setItems([]);
      setSelectedIds(new Set());
      setSearchQuery("");
      setError(null);
    }
  }, [isOpen, vendorName, shopName, mode]);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Query purchase_indent_items
      let query = supabase
        .from("purchase_indent_items")
        .select("*, purchase_indents(shop_name)")
        .order("created_at", { ascending: false });

      if (isRejectedMode) {
        query = query.ilike("approval_status", "%rejected%");
      } else {
        query = query.eq("is_excluded", true);
      }

      if (vendorName) {
        const trimmedVendor = vendorName.trim();
        query = query.ilike("party_name", `%${trimmedVendor}%`);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      let fetchedItems = (data || []).map(row => {
        const parentShop = Array.isArray(row.purchase_indents)
          ? row.purchase_indents[0]?.shop_name
          : row.purchase_indents?.shop_name;
        const shopNameVal = row.shop_name || parentShop || "Unknown";

        return {
          ...row,
          shopName: shopNameVal,
          orderBox: row.order_box ? parseFloat(row.order_box) : 0,
          orderQty: row.order_qty ? parseFloat(row.order_qty) : 0,
          approvedBox: row.approved_box !== null && row.approved_box !== undefined ? parseFloat(row.approved_box) : parseFloat(row.order_box || 0),
          approvedQty: row.approved_qty !== null && row.approved_qty !== undefined ? parseFloat(row.approved_qty) : parseFloat(row.order_qty || 0),
          poBox: row.po_box !== null && row.po_box !== undefined ? parseFloat(row.po_box) : (row.approved_box !== null && row.approved_box !== undefined ? parseFloat(row.approved_box) : parseFloat(row.order_box || 0)),
          poQty: row.po_qty !== null && row.po_qty !== undefined ? parseFloat(row.po_qty) : (row.approved_qty !== null && row.approved_qty !== undefined ? parseFloat(row.approved_qty) : parseFloat(row.order_qty || 0)),
          bcs: row.bcs ? parseFloat(row.bcs) : null,
          itemName: row.item_name,
          brandName: row.brand_name,
          liquorType: row.liquor_type,
          closingQty: row.closing_qty
        };
      });

      // Filter by shopName if specified and not 'All'
      if (shopName && shopName !== "All") {
        const cleanShop = shopName.trim().toUpperCase();
        fetchedItems = fetchedItems.filter(
          item => !item.shopName || item.shopName === "Unknown" || item.shopName.trim().toUpperCase() === cleanShop
        );
      }

      // Filter out items already in the active table
      const filtered = fetchedItems.filter(item => !alreadyAddedIds.includes(item.id));
      setItems(filtered);
    } catch (err) {
      console.error(`[AddExcludedModal] Error fetching ${mode} items:`, err);
      setError(`Failed to load ${mode} items.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const handleConfirmAdd = () => {
    const selectedItems = items.filter(i => selectedIds.has(i.id));
    onAddItems(selectedItems);
    onClose();
  };

  const filteredItems = items.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (item.itemName || "").toLowerCase().includes(q) ||
      (item.brandName || "").toLowerCase().includes(q) ||
      (item.shopName || "").toLowerCase().includes(q)
    );
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: headerBgColor
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: headerIconBg,
              color: headerIconColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isRejectedMode ? <XCircle size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: titleColor }}>
                {titleText}
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: subTitleColor }}>
                Vendor: <strong>{vendorName}</strong> {shopName && shopName !== 'All' ? `• Shop: ${shopName}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search by item name or brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {filteredItems.length > 0 && (
            <button
              onClick={handleSelectAll}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {selectedIds.size === filteredItems.length ? <CheckSquare size={16} color={btnBgColor} /> : <Square size={16} />}
              Select All ({filteredItems.length})
            </button>
          )}
        </div>

        {/* List Content */}
        <div style={{ padding: '0 24px', overflowY: 'auto', flex: 1, minHeight: '240px' }}>
          {isLoading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
              Loading {mode} items...
            </div>
          )}

          {error && (
            <div style={{ padding: '20px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', margin: '20px 0' }}>
              {error}
            </div>
          )}

          {!isLoading && !error && filteredItems.length === 0 && (
            <div style={{ padding: '50px 0', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '500' }}>No {mode} indents found for this vendor.</p>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>All {mode} items have either been added or none were created.</p>
            </div>
          )}

          {!isLoading && !error && filteredItems.length > 0 && (
            <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleSelect(item.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: isSelected ? `1px solid ${btnBgColor}` : '1px solid #e2e8f0',
                      backgroundColor: isSelected ? headerBgColor : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ color: isSelected ? btnBgColor : '#cbd5e1' }}>
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
                          {item.itemName}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '12px' }}>
                          <span>Shop: <strong>{item.shopName}</strong></span>
                          <span>B/Cs: <strong>{item.bcs || "—"}</strong></span>
                          {isRejectedMode ? (
                            <span>Status: <strong style={{ color: '#dc2626' }}>Rejected</strong></span>
                          ) : (
                            <span>Exclusion Reason: <strong style={{ color: '#d97706' }}>{item.exclusion_reason || 'low order qty'}</strong></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>Auto Qty</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: btnBgColor }}>
                        {item.orderBox || 0} bx ({item.orderQty || 0} un)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
            {selectedIds.size} item{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmAdd}
              disabled={selectedIds.size === 0}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: selectedIds.size > 0 ? btnBgColor : '#cbd5e1',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} /> Add Selected Items ({selectedIds.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddExcludedModal;
