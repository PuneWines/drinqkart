import React from "react";
import SearchableDropdown from "./SearchableDropdown";

const POVendorBox = ({
  dbParties,
  partyName,
  onPartyChange,
  vendorDetails,
  onDeleteVendor,
  companyScope,
  isMissingVendorLedger,
  cleanVendorName,
  availableDistricts = [],
  selectedDistrict = "",
  onDistrictChange,
  availableAreas = [],
  selectedArea = "",
  onAreaChange,
}) => {
  const activeCompanyScope = companyScope;
  return (
    <div className="po-box">
      <div className="po-box-header">Vendor</div>
      <div className="po-box-body">
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              marginBottom: "4px",
              color: "#64748b",
              fontSize: "0.75rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Party Name
          </div>
          <SearchableDropdown
            options={dbParties}
            value={partyName}
            onChange={(val) => {
              if (onPartyChange) onPartyChange(val);
            }}
            placeholder="Select a party"
            onDeleteOption={onDeleteVendor}
          />
        </div>
        {/* Company Scope Field (shown if vendor is scoped to a specific company) */}
        {activeCompanyScope && (
          <div
            style={{
              marginBottom: "8px",
              padding: "6px 8px",
              backgroundColor: "#f1f5f9",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                color: "#64748b",
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "2px",
              }}
            >
              Company Scope
            </div>
            <div
              style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1e293b" }}
            >
              {activeCompanyScope}
            </div>
          </div>
        )}
        {/* District & Area Selection (50/50 Half-split with perpendicular divider line) */}
        {availableDistricts && availableDistricts.length > 0 && (
          <div
            style={{
              marginBottom: "10px",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              overflow: "hidden",
            }}
          >
            {/* Left Half: Vendor District */}
            <div
              style={{
                padding: "8px 10px",
                borderRight: "1px solid #cbd5e1",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    color: "#475569",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Vendor District *
                </span>
                {!selectedDistrict && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "#dc2626",
                      fontWeight: 600,
                    }}
                  >
                    Required
                  </span>
                )}
              </div>
              <select
                value={selectedDistrict}
                onChange={(e) =>
                  onDistrictChange && onDistrictChange(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: selectedDistrict ? "#0f172a" : "#64748b",
                  backgroundColor: "#ffffff",
                  border: selectedDistrict
                    ? "1px solid #94a3b8"
                    : "1px solid #f87171",
                  borderRadius: "4px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Select District</option>
                {availableDistricts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </div>

            {/* Right Half: Vendor Area */}
            <div
              style={{
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                backgroundColor: !selectedDistrict ? "#f1f5f9" : "#f8fafc",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <span
                  style={{
                    color: selectedDistrict ? "#475569" : "#94a3b8",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Vendor Area *
                </span>
                {selectedDistrict && !selectedArea && availableAreas && availableAreas.length > 0 && (
                  <span
                    style={{
                      fontSize: "0.65rem",
                      color: "#dc2626",
                      fontWeight: 600,
                    }}
                  >
                    Required
                  </span>
                )}
              </div>
              <select
                value={selectedArea || ""}
                disabled={!selectedDistrict || !availableAreas || availableAreas.length === 0}
                onChange={(e) =>
                  onAreaChange && onAreaChange(e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: selectedArea ? "#0f172a" : "#64748b",
                  backgroundColor:
                    !selectedDistrict || !availableAreas || availableAreas.length === 0
                      ? "#f1f5f9"
                      : "#ffffff",
                  border: !selectedDistrict
                    ? "1px solid #cbd5e1"
                    : selectedArea
                    ? "1px solid #94a3b8"
                    : "1px solid #f87171",
                  borderRadius: "4px",
                  outline: "none",
                  cursor: !selectedDistrict ? "not-allowed" : "pointer",
                }}
              >
                <option value="">
                  {!selectedDistrict
                    ? "Select District first"
                    : availableAreas && availableAreas.length > 0
                    ? "Select Area"
                    : "All Areas / Direct"}
                </option>
                {(availableAreas || []).map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {/* Missing Vendor from Supplier Ledger Warning */}
        {isMissingVendorLedger && (
          <div
            style={{
              marginBottom: "10px",
              padding: "8px 10px",
              backgroundColor: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              fontSize: "0.75rem",
              lineHeight: 1.4,
            }}
          >
            <strong style={{ display: "block", marginBottom: "2px" }}>
              ⚠️ Not Registered in Supplier Ledger
            </strong>
            <div>
              {activeCompanyScope ? (
                <>
                  No vendor record found in Supplier Ledger for{" "}
                  <strong>{cleanVendorName || partyName}</strong> with Company
                  Scope <strong>{activeCompanyScope}</strong>.
                </>
              ) : (
                <>
                  No Direct vendor record found in Supplier Ledger for{" "}
                  <strong>{cleanVendorName || partyName}</strong>.
                </>
              )}
            </div>
            <div
              style={{ marginTop: "4px", color: "#b91c1c", fontSize: "0.7rem" }}
            >
              Add this vendor in <strong>Settings → Vendor Management</strong>{" "}
              before submitting this PO.
            </div>
          </div>
        )}
        <strong>Address:</strong> {vendorDetails?.address || "—"}
        <br />
        <strong>GSTIN:</strong> {vendorDetails?.gstin || "—"}
        <br />
        <strong>Contact Name:</strong> {vendorDetails?.contact_name || "—"}
        <br />
        <strong>Contact:</strong> {vendorDetails?.contact || "—"}
        <br />
        <strong>Email:</strong> {vendorDetails?.email || "—"}
      </div>
    </div>
  );
};

export default POVendorBox;
