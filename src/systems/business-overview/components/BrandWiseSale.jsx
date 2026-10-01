import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Calendar } from "lucide-react";

const SEGS = ["Sale", "Purchase", "Closing qty", "Closing case"];
const SEARCH_BY_OPTIONS = ["Item Name", "Brand Name", "Company", "Trader Wise"];
const KPI_OPTIONS = ["Amount", "Qty", "Case"];
const AGG_OPTIONS = ["Total", "Avg"];

// Indian number formatters
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

/**
 * Custom MultiSelectDropdown matching the exact UI spec
 */
function MultiSelectDropdown({
  label,
  options = [],
  selected = new Set(),
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const count = selected.size;
  const buttonText =
    count === 0
      ? "All"
      : count <= 2
      ? Array.from(selected).join(", ")
      : `${count} selected`;

  const isAll = options.length > 0 && selected.size === options.length;

  return (
    <div className="relative" ref={dropdownRef}>
      <span className="block text-[12px] font-semibold text-[#6a7488] mb-1">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-2 px-2.5 border rounded-lg text-left text-sm flex items-center justify-between cursor-pointer transition-colors bg-white ${
            count > 0 && !isAll
              ? "border-[#1f6feb] text-[#1f6feb] font-semibold"
              : "border-[#dde2ea] text-[#1b2230]"
          }`}
        >
          <span className="truncate pr-1">{buttonText}</span>
          <span className="text-xs text-[#6a7488] shrink-0">▾</span>
        </button>

        {isOpen && (
          <div className="absolute z-30 top-full left-0 right-0 min-w-45 mt-1 bg-white border border-[#dde2ea] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.2)] max-h-64 overflow-y-auto">
            <div className="flex justify-between py-1.5 px-2.5 border-b border-[#dde2ea] text-xs font-semibold">
              <a
                onClick={() => onChange(new Set(options))}
                className="text-[#1f6feb] cursor-pointer hover:underline"
              >
                Select all
              </a>
              <a
                onClick={() => onChange(new Set())}
                className="text-[#6a7488] cursor-pointer hover:underline"
              >
                Clear
              </a>
            </div>
            <div className="py-1">
              {options.map((opt) => {
                const checked = selected.has(opt);
                return (
                  <label
                    key={opt}
                    className="flex gap-2 items-center py-1.5 px-2.5 cursor-pointer text-sm text-[#1b2230] hover:bg-[#eef2fb] select-none"
                  >
                    <input
                      type="checkbox"
                      value={opt}
                      checked={checked}
                      onChange={() => {
                        const next = new Set(selected);
                        if (checked) {
                          next.delete(opt);
                        } else {
                          next.add(opt);
                        }
                        onChange(next);
                      }}
                      className="cursor-pointer"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrandWiseSale({
  liveRecords = [],
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  // 1. Dynamic stores list extracted from live records
  const availableStores = useMemo(() => {
    const sSet = new Set();
    liveRecords.forEach((r) => {
      const st = (r.shop_id || r.shop_name || r.store || "").trim();
      if (st) sSet.add(st);
    });
    return Array.from(sSet).sort();
  }, [liveRecords]);

  // Filters State
  const [selectedStores, setSelectedStores] = useState(new Set());
  const [selectedSegments, setSelectedSegments] = useState(new Set(["Sale", "Purchase"]));
  const [searchBy, setSearchBy] = useState("Brand Name");
  const [kpi, setKpi] = useState("Amount");
  const [aggregation, setAggregation] = useState("Total");
  const [searchQuery, setSearchQuery] = useState("");

  // Initialize store selection
  useEffect(() => {
    if (availableStores.length > 0 && selectedStores.size === 0) {
      setSelectedStores(new Set(availableStores.slice(0, Math.min(2, availableStores.length))));
    }
  }, [availableStores]);

  // 2. Compute filtered stores & segments for table headers
  const activeStores = useMemo(() => {
    if (selectedStores.size === 0) return availableStores;
    return availableStores.filter((s) => selectedStores.has(s));
  }, [availableStores, selectedStores]);

  const activeSegments = useMemo(() => {
    if (selectedSegments.size === 0) return SEGS;
    return SEGS.filter((s) => selectedSegments.has(s));
  }, [selectedSegments]);

  // 3. Process records & aggregate into pivot grid
  const { pivotData, rowKeys, columnTotals } = useMemo(() => {
    const isAvg = aggregation === "Avg";
    const qLower = searchQuery.trim().toLowerCase();

    // Map record to metric
    const getMetric = (r, segmentIndex) => {
      const size = Number(r.b_cs) > 0 ? Number(r.b_cs) : 12;
      const rate = Number(r.mrp_rate || r.mrp || r.rate || r.amount) || 0;
      const purchaseRate = Number(r.purchase_rate || r.pur_rate) || rate;

      const saleQty = Number(r.quantity_out ?? r.quantity ?? r.qty) || 0;
      const purQty = Number(r.quantity_in ?? r.purchase_qty ?? r.in_qty) || 0;
      const closeQty = Number(r.closing_qty ?? r.balance_qty ?? r.close_qty) || 0;
      const closeCase = closeQty / size;
      const saleCase = saleQty / size;
      const purCase = purQty / size;

      if (segmentIndex === 0) {
        // Sale
        if (kpi === "Qty") return saleQty;
        if (kpi === "Amount") return r.amount !== undefined ? Number(r.amount) : saleQty * rate;
        return saleCase;
      }
      if (segmentIndex === 1) {
        // Purchase
        if (kpi === "Qty") return purQty;
        if (kpi === "Amount") return purQty * purchaseRate;
        return purCase;
      }
      if (segmentIndex === 2) {
        // Closing qty
        if (kpi === "Qty") return closeQty;
        if (kpi === "Amount") return closeQty * rate;
        return closeCase;
      }
      if (segmentIndex === 3) {
        // Closing case
        if (kpi === "Qty") return closeCase;
        if (kpi === "Amount") return closeCase * rate * size;
        return closeCase;
      }
      return 0;
    };

    // Grouping Map: { [Label]: { [Store]: [sumSeg0, sumSeg1, sumSeg2, sumSeg3, count] } }
    const grid = {};
    const dateCounts = {};

    liveRecords.forEach((r) => {
      const store = (r.shop_id || r.shop_name || r.store || "").trim();
      if (!store) return;
      if (selectedStores.size > 0 && !selectedStores.has(store)) return;

      let rowLabel = "";
      if (searchBy === "Item Name") {
        rowLabel = (r.item_name || r.item || "Unknown Item").trim();
      } else if (searchBy === "Company") {
        rowLabel = (r.company_name || r.company || r.subhead || "General").trim();
      } else if (searchBy === "Trader Wise") {
        rowLabel = (r.party_name || r.party || r.supplier || r.trader || "Direct Trader").trim();
      } else {
        // Brand Name (default)
        rowLabel = (r.brand_name || r.brand || r.item_name || "General Brand").trim();
      }

      if (!rowLabel) rowLabel = "Other";

      if (qLower && !rowLabel.toLowerCase().includes(qLower)) {
        return;
      }

      if (!grid[rowLabel]) grid[rowLabel] = {};
      if (!grid[rowLabel][store]) {
        grid[rowLabel][store] = [0, 0, 0, 0, 0];
      }

      for (let sIdx = 0; sIdx < 4; sIdx++) {
        grid[rowLabel][store][sIdx] += getMetric(r, sIdx);
      }
      grid[rowLabel][store][4] += 1;

      if (!dateCounts[store]) dateCounts[store] = new Set();
      if (r.date) dateCounts[store].add(r.date);
    });

    const sortedRowKeys = Object.keys(grid).sort((a, b) => a.localeCompare(b));

    // Calculate column totals
    const totals = {};
    sortedRowKeys.forEach((rowKey) => {
      activeStores.forEach((store) => {
        const storeData = grid[rowKey]?.[store];
        activeSegments.forEach((segName) => {
          const segIdx = SEGS.indexOf(segName);
          const colKey = `${store}__${segName}`;
          let val = 0;
          if (storeData) {
            val = isAvg
              ? storeData[4] > 0
                ? storeData[segIdx] / Math.max(1, dateCounts[store]?.size || 1)
                : 0
              : storeData[segIdx];
          }
          totals[colKey] = (totals[colKey] || 0) + val;
        });
      });
    });

    return {
      pivotData: grid,
      rowKeys: sortedRowKeys,
      columnTotals: totals,
    };
  }, [liveRecords, selectedStores, activeStores, activeSegments, searchBy, kpi, aggregation, searchQuery]);

  const formatValue = (v) => {
    if (v === undefined || v === null || isNaN(v) || v === 0) return "-";
    if (kpi === "Case" || aggregation === "Avg") {
      return nf1.format(v);
    }
    return nf0.format(v);
  };

  const formatTotalValue = (v) => {
    if (v === undefined || v === null || isNaN(v)) return "0";
    if (kpi === "Case" || aggregation === "Avg") {
      return nf1.format(v);
    }
    return nf0.format(v);
  };

  // Export Table Data to Excel
  const handleExportExcel = () => {
    if (rowKeys.length === 0) return;

    const headersRow1 = [searchBy];
    activeStores.forEach((s) => {
      activeSegments.forEach(() => headersRow1.push(s));
    });

    const headersRow2 = [""];
    activeStores.forEach(() => {
      activeSegments.forEach((seg) => headersRow2.push(seg));
    });

    const rows = rowKeys.map((rowKey) => {
      const rowArr = [rowKey];
      activeStores.forEach((store) => {
        const storeData = pivotData[rowKey]?.[store];
        activeSegments.forEach((segName) => {
          const segIdx = SEGS.indexOf(segName);
          let v = 0;
          if (storeData) {
            v = aggregation === "Avg" ? storeData[segIdx] / Math.max(1, storeData[4] || 1) : storeData[segIdx];
          }
          rowArr.push(v);
        });
      });
      return rowArr;
    });

    const totalRow = ["Total"];
    activeStores.forEach((store) => {
      activeSegments.forEach((segName) => {
        const colKey = `${store}__${segName}`;
        totalRow.push(columnTotals[colKey] || 0);
      });
    });
    rows.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet([headersRow1, headersRow2, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BrandWiseSale");
    XLSX.writeFile(wb, `Brand_Wise_Sale_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="w-full text-[#1b2230] font-sans">
      {/* Header matching exact UI spec */}
      <header className="bg-[#1f6feb] text-white rounded-xl p-4 sm:px-5 mb-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <h1 className="m-0 text-xl sm:text-[22px] font-bold leading-tight">
            Brand Wise Item Wise Trader Wise Sale
          </h1>
          <p className="mt-0.5 opacity-85 text-xs sm:text-[13px]">
            Pick stores and segments, choose how to view, then type in the search bar to filter rows.
          </p>
        </div>
        {rowKeys.length > 0 && (
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
            title="Export to Excel"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        )}
      </header>

      {/* Filter Card matching exact UI spec */}
      <div className="bg-white border border-[#dde2ea] rounded-xl p-3.5 mb-3.5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* 1. Select Store Multi-Select */}
          <MultiSelectDropdown
            label="Select Store"
            options={availableStores}
            selected={selectedStores}
            onChange={setSelectedStores}
          />

          {/* 2. Search By Select */}
          <div>
            <span className="block text-[12px] font-semibold text-[#6a7488] mb-1">
              Search By
            </span>
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="w-full py-2 px-2.5 border border-[#dde2ea] rounded-lg bg-white text-[#1b2230] text-sm cursor-pointer outline-none focus:border-[#1f6feb]"
            >
              {SEARCH_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Select Segment Multi-Select */}
          <MultiSelectDropdown
            label="Select Segment"
            options={SEGS}
            selected={selectedSegments}
            onChange={setSelectedSegments}
          />

          {/* 4. KPI Select */}
          <div>
            <span className="block text-[12px] font-semibold text-[#6a7488] mb-1">
              KPI
            </span>
            <select
              value={kpi}
              onChange={(e) => setKpi(e.target.value)}
              className="w-full py-2 px-2.5 border border-[#dde2ea] rounded-lg bg-white text-[#1b2230] text-sm cursor-pointer outline-none focus:border-[#1f6feb]"
            >
              {KPI_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Aggregation Select */}
          <div>
            <span className="block text-[12px] font-semibold text-[#6a7488] mb-1">
              Aggregation
            </span>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
              className="w-full py-2 px-2.5 border border-[#dde2ea] rounded-lg bg-white text-[#1b2230] text-sm cursor-pointer outline-none focus:border-[#1f6feb]"
            >
              {AGG_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* 6. Start Date */}
          <div>
            <span className="block text-[12px] font-semibold text-[#6a7488] mb-1">
              Start Date
            </span>
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => setStartDate && setStartDate(e.target.value)}
              className="w-full py-2 px-2.5 border border-[#dde2ea] rounded-lg bg-white text-[#1b2230] text-sm cursor-pointer outline-none focus:border-[#1f6feb]"
            />
          </div>

          {/* 7. End Date */}
          <div>
            <span className="block text-[12px] font-semibold text-[#6a7488] mb-1">
              End Date
            </span>
            <input
              type="date"
              value={endDate || ""}
              onChange={(e) => setEndDate && setEndDate(e.target.value)}
              className="w-full py-2 px-2.5 border border-[#dde2ea] rounded-lg bg-white text-[#1b2230] text-sm cursor-pointer outline-none focus:border-[#1f6feb]"
            />
          </div>
        </div>

        {/* Search row matching exact UI spec */}
        <div className="mt-3 flex gap-2.5 items-center flex-wrap">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${searchBy}...`}
            className="flex-1 min-w-[200px] text-sm sm:text-[15px] py-2 px-3 border border-[#dde2ea] rounded-lg bg-white text-[#1b2230] outline-none focus:border-[#1f6feb]"
          />
          <span className="text-[#6a7488] text-xs whitespace-nowrap font-medium">
            {rowKeys.length} {searchBy.toLowerCase()} rows
          </span>
        </div>
      </div>

      {/* Table Card matching exact UI spec */}
      <div className="bg-white border border-[#dde2ea] rounded-xl p-3.5 shadow-xs">
        <div className="overflow-auto max-h-[70vh] border border-[#dde2ea] rounded-lg relative custom-scrollbar">
          {rowKeys.length === 0 ? (
            <div className="p-8 text-center text-[#6a7488] text-sm">
              No matching rows. Try a different search.
            </div>
          ) : (
            <table className="border-collapse border-spacing-0 w-full text-sm">
              <thead>
                {/* Header Row 1: Dimension Label (Yellow) + Store Names (Green) */}
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky top-0 left-0 z-20 bg-[#ffe699] text-[#1b2230] font-bold text-left py-2 px-3 border-b border-r border-[#dde2ea] min-w-57.5 whitespace-nowrap align-middle"
                  >
                    {searchBy}
                  </th>
                  {activeStores.map((store) => (
                    <th
                      key={store}
                      colSpan={activeSegments.length}
                      className="sticky top-0 z-10 bg-[#c6e0b4] text-[#1b2230] font-bold text-center py-2 px-3 border-b border-r border-[#dde2ea] whitespace-nowrap"
                    >
                      {store}
                    </th>
                  ))}
                </tr>

                {/* Header Row 2: Segments (Light Green) */}
                <tr>
                  {activeStores.map((store) =>
                    activeSegments.map((segName) => (
                      <th
                        key={`${store}__${segName}`}
                        className="sticky top-[37px] z-10 bg-[#e2efda] text-[#1b2230] font-semibold text-center py-2 px-3 border-b border-r border-[#dde2ea] whitespace-nowrap text-xs"
                      >
                        {segName}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody className="bg-white">
                {rowKeys.map((rowKey) => (
                  <tr key={rowKey} className="hover:bg-[#eef2fb] transition-colors">
                    {/* Sticky Left Label Column */}
                    <td className="sticky left-0 z-1 bg-white text-[#1b2230] font-semibold text-left py-2 px-3 border-b border-r border-[#dde2ea] whitespace-nowrap">
                      {rowKey}
                    </td>

                    {/* Data Cells */}
                    {activeStores.map((store) =>
                      activeSegments.map((segName) => {
                        const segIdx = SEGS.indexOf(segName);
                        const storeData = pivotData[rowKey]?.[store];
                        let val = 0;
                        if (storeData) {
                          val =
                            aggregation === "Avg"
                              ? storeData[4] > 0
                                ? storeData[segIdx] / Math.max(1, storeData[4] || 1)
                                : 0
                              : storeData[segIdx];
                        }

                        return (
                          <td
                            key={`${store}__${segName}`}
                            className="py-2 px-3 border-b border-r border-[#dde2ea] text-right text-[#1b2230] whitespace-nowrap tabular-nums"
                          >
                            {formatValue(val)}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}

                {/* Sticky Total Row */}
                <tr className="sticky bottom-0 z-10 bg-[#eef2fb] font-bold">
                  <td className="sticky left-0 z-20 bg-[#eef2fb] text-[#1b2230] font-bold text-left py-2 px-3 border-b border-r border-[#dde2ea] whitespace-nowrap">
                    Total
                  </td>
                  {activeStores.map((store) =>
                    activeSegments.map((segName) => {
                      const colKey = `${store}__${segName}`;
                      const totalVal = columnTotals[colKey] || 0;
                      return (
                        <td
                          key={colKey}
                          className="py-2 px-3 border-b border-r border-[#dde2ea] text-right text-[#1b2230] font-bold whitespace-nowrap tabular-nums bg-[#eef2fb]"
                        >
                          {formatTotalValue(totalVal)}
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <div className="text-[#6a7488] text-xs mt-2 font-medium">
          {aggregation === "Total"
            ? "Total = sum of selected stock records. (Closing = latest recorded stock); Avg = average per recorded period. No selection in Store or Segment shows all."
            : "Avg = average per recorded period. No selection in Store or Segment shows all."}
        </div>
      </div>
    </div>
  );
}
