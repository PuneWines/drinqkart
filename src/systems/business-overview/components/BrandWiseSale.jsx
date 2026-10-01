import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Download, Search, ChevronDown, Layers } from "lucide-react";

const SEGS = ["Sale", "Purchase", "Closing qty", "Closing case"];
const SEARCH_BY_OPTIONS = ["Brand Name"];
const KPI_OPTIONS = ["Amount", "Qty", "Case"];
const AGG_OPTIONS = ["Total", "Avg"];

// Indian number formatters
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * MultiSelectDropdown component with 'Select all' / 'Clear' and checkboxes
 */
function MultiSelectDropdown({ label, options = [], selected = new Set(), onChange, placeholder = "Select" }) {
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
    <div className="relative flex flex-col gap-1 min-w-[160px] flex-1" ref={dropdownRef}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full py-2 px-3 border rounded-xl text-left font-medium text-xs flex items-center justify-between transition-all cursor-pointer shadow-xs ${
            count > 0 && !isAll
              ? "border-blue-500 text-blue-600 font-bold bg-blue-50/50"
              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
          }`}
        >
          <span className="truncate pr-2">{buttonText}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-1.5 w-full min-w-[200px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 text-[11px] font-bold text-blue-600 mb-1">
              <button
                type="button"
                onClick={() => onChange(new Set(options))}
                className="hover:underline cursor-pointer"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-slate-400 hover:text-slate-600 hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {options.map((opt) => {
                const checked = selected.has(opt);
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
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
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
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

export default function BrandWiseSale({ liveRecords = [] }) {
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

  // Initialize store selection when stores load
  useEffect(() => {
    if (availableStores.length > 0 && selectedStores.size === 0) {
      // Default to first 2 or all if fewer
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
        grid[rowLabel][store] = [0, 0, 0, 0, 0]; // [sale, pur, closeQty, closeCase, recordCount]
      }

      for (let sIdx = 0; sIdx < 4; sIdx++) {
        grid[rowLabel][store][sIdx] += getMetric(r, sIdx);
      }
      grid[rowLabel][store][4] += 1;

      if (!dateCounts[store]) dateCounts[store] = new Set();
      if (r.date) dateCounts[store].add(r.date);
    });

    const sortedRowKeys = Object.keys(grid).sort((a, b) => a.localeCompare(b));

    // Calculate column totals for bottom total row
    const totals = {};
    sortedRowKeys.forEach((rowKey) => {
      activeStores.forEach((store) => {
        const storeData = grid[rowKey]?.[store];
        activeSegments.forEach((segName) => {
          const segIdx = SEGS.indexOf(segName);
          const colKey = `${store}__${segName}`;
          let val = 0;
          if (storeData) {
            val = isAvg ? (storeData[4] > 0 ? storeData[segIdx] / Math.max(1, dateCounts[store]?.size || 1) : 0) : storeData[segIdx];
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
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-[#1f6feb] text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 shrink-0" />
            Brand Wise Item Wise Trader Wise Sale
          </h1>
          <p className="text-blue-100 text-xs sm:text-sm mt-1 font-medium">
            Pick stores and segments, choose how to view, then type in the search bar to filter real records.
          </p>
        </div>
        {rowKeys.length > 0 && (
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Download size={14} />
            Export Excel
          </button>
        )}
      </div>

      {/* Control Card with Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Select Store Dropdown */}
          <MultiSelectDropdown
            label="Select Store"
            options={availableStores}
            selected={selectedStores}
            onChange={setSelectedStores}
            placeholder="All Stores"
          />

          {/* Search By Select */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Search By</span>
            <select
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none cursor-pointer"
            >
              {SEARCH_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Select Segment Dropdown */}
          <MultiSelectDropdown
            label="Select Segment"
            options={SEGS}
            selected={selectedSegments}
            onChange={setSelectedSegments}
            placeholder="All Segments"
          />

          {/* KPI Metric Select */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">KPI</span>
            <select
              value={kpi}
              onChange={(e) => setKpi(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none cursor-pointer"
            >
              {KPI_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Aggregation Select */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Aggregation</span>
            <select
              value={aggregation}
              onChange={(e) => setAggregation(e.target.value)}
              className="py-2 px-3 border border-slate-200 rounded-xl bg-white text-slate-800 text-xs font-semibold focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none cursor-pointer"
            >
              {AGG_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar & Row Count Badge */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${searchBy}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all outline-none"
            />
          </div>
          <span className="text-xs font-bold text-slate-500 shrink-0">
            {rowKeys.length} {searchBy.toLowerCase()} rows
          </span>
        </div>
      </div>

      {/* Main Pivot Table Viewport */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2">
        <div className="overflow-x-auto max-h-[70vh] border border-slate-200 rounded-xl bg-slate-50 custom-scrollbar shadow-inner relative">
          {rowKeys.length === 0 ? (
            <div className="py-20 text-center text-slate-400 font-medium text-xs">
              No matching records found for the selected store/search criteria.
            </div>
          ) : (
            <table className="border-collapse border-spacing-0 w-full text-xs">
              <thead>
                {/* Header Row 1: Dimension Label + Stores (Colspan = Active Segments Count) */}
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky top-0 left-0 z-20 bg-[#ffe699] text-[#1b2230] font-bold text-left px-3.5 py-2.5 border-b border-r border-slate-300 min-w-[230px] shadow-sm select-none"
                  >
                    {searchBy}
                  </th>
                  {activeStores.map((store) => (
                    <th
                      key={store}
                      colSpan={activeSegments.length}
                      className="sticky top-0 z-10 bg-[#c6e0b4] text-[#1b2230] font-extrabold text-center px-3 py-2 border-b border-r border-slate-300 whitespace-nowrap shadow-2xs select-none"
                    >
                      {store}
                    </th>
                  ))}
                </tr>

                {/* Header Row 2: Segments under each Store */}
                <tr>
                  {activeStores.map((store) =>
                    activeSegments.map((segName) => (
                      <th
                        key={`${store}__${segName}`}
                        className="sticky top-[37px] z-10 bg-[#e2efda] text-[#1b2230] font-bold text-center px-3 py-1.5 border-b border-r border-slate-300 whitespace-nowrap select-none text-[11px]"
                      >
                        {segName}
                      </th>
                    ))
                  )}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-slate-200">
                {rowKeys.map((rowKey) => (
                  <tr key={rowKey} className="hover:bg-[#eef2fb] transition-colors group">
                    {/* Sticky Left Label Column */}
                    <td className="sticky left-0 z-1 bg-white group-hover:bg-[#eef2fb] text-slate-900 font-semibold px-3.5 py-2 border-r border-slate-200 text-left min-w-[230px] whitespace-nowrap shadow-2xs">
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
                            className="px-3 py-2 text-right border-r border-slate-200 whitespace-nowrap text-slate-800 font-medium tabular-nums text-xs"
                          >
                            {formatValue(val)}
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}

                {/* Sticky Total Row */}
                <tr className="sticky bottom-0 z-10 bg-[#eef2fb] font-extrabold border-t-2 border-slate-300">
                  <td className="sticky left-0 z-20 bg-[#eef2fb] text-slate-900 font-black px-3.5 py-2.5 border-r border-slate-300 text-left shadow-xs">
                    Total
                  </td>
                  {activeStores.map((store) =>
                    activeSegments.map((segName) => {
                      const colKey = `${store}__${segName}`;
                      const totalVal = columnTotals[colKey] || 0;
                      return (
                        <td
                          key={colKey}
                          className="px-3 py-2.5 text-right border-r border-slate-300 whitespace-nowrap text-slate-900 font-black tabular-nums text-xs"
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

        <div className="text-[11px] font-medium text-slate-500 pt-1">
          {aggregation === "Total"
            ? "Total = sum of selected stock records. Closing values reflect total closing stock."
            : "Avg = average per recorded entry date. No selection in Store or Segment shows all."}
        </div>
      </div>
    </div>
  );
}
