import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Layers,
  RotateCcw,
  Download,
  Search,
  Check,
  ChevronDown,
  Filter,
  BarChart3,
  TrendingUp,
  Store,
  Layers3,
  Info,
} from "lucide-react";

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const DIMS = [
  { label: "Select Store", key: "store", icon: Store },
  { label: "Liquor Type", key: "lt", icon: Layers },
  { label: "Subhead", key: "sub", icon: Layers3 },
  { label: "Type 1", key: "t1", icon: Filter },
  { label: "Type 2", key: "t2", icon: Filter },
  { label: "Type 5", key: "t5", icon: Filter },
  { label: "KPI Metric", key: "kpi", icon: BarChart3 },
];

const GROUP_KEYS = ["lt", "sub", "t1", "t2", "t5"];
const KPIS = ["Amount", "Quantity", "Case"];

const DIM_LABELS = {
  store: "Store",
  lt: "Liquor Type",
  sub: "Subhead",
  t1: "Type 1",
  t2: "Type 2",
  t5: "Type 5",
  kpi: "KPI",
};

// Formatter helpers
const nfCurrency = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});
const nfQty = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});
const nfCase = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatKpiValue(val, kpi) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return "-";
  if (kpi === "Amount") return `₹ ${nfCurrency.format(val)}`;
  if (kpi === "Case") return nfCase.format(val);
  return nfQty.format(val);
}

function formatKpiTotal(val, kpi) {
  if (val === undefined || val === null || isNaN(val)) return "0";
  if (kpi === "Amount") return `₹ ${nfCurrency.format(val)}`;
  if (kpi === "Case") return nfCase.format(val);
  return nfQty.format(val);
}

// Strictly map actual live DB stock_balance_records without any hardcoded mock fallbacks
function mapLiveRecordsToGroupSchema(records) {
  if (!records || !records.length) return [];
  return records.map((r) => {
    const q = Number(r.quantity_out ?? r.quantity ?? r.qty) || 0;
    const mrp = Number(r.mrp_rate ?? r.mrp ?? r.amount) || 0;
    const bcs = Number(r.b_cs) > 0 ? Number(r.b_cs) : 12;
    const amount = r.amount !== undefined ? Number(r.amount) : q * mrp;
    const cases =
      r.case !== undefined || r.cases !== undefined
        ? Number(r.case ?? r.cases)
        : Math.round((q / bcs) * 10) / 10;

    const lt = (r.liquor_type || "").trim();
    const sub = (r.subhead || "").trim();
    const t1 = (r.type1 || r.type_1 || "").trim();
    const t2 = (r.type2 || r.type_2 || "").trim();
    const t5 = (r.type5 || r.type_5 || "").trim();
    const store = (r.shop_id || r.shop_name || r.store || "").trim();

    return {
      date: r.date || "",
      store,
      lt,
      sub,
      t1,
      t2,
      t5,
      Quantity: q,
      Amount: amount,
      Case: cases,
    };
  });
}

// ==========================================
// MULTI-SELECT DROPDOWN COMPONENT
// ==========================================
function MultiSelectDropdown({
  label,
  options = [],
  selected = new Set(),
  onChange,
  icon: Icon,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((o) =>
      String(o).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [options, searchTerm]);

  const handleSelectAll = (e) => {
    e.stopPropagation();
    onChange(new Set(options));
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange(new Set());
  };

  const handleToggle = (opt) => {
    const next = new Set(selected);
    if (next.has(opt)) {
      next.delete(opt);
    } else {
      next.add(opt);
    }
    onChange(next);
  };

  const isNoneSelected = selected.size === 0;

  let buttonText = "All";
  if (!isNoneSelected) {
    if (selected.size === 1) {
      buttonText = Array.from(selected)[0];
    } else if (selected.size <= 2) {
      buttonText = Array.from(selected).join(", ");
    } else {
      buttonText = `${selected.size} selected`;
    }
  }

  return (
    <div className="flex flex-col gap-1 min-w-[140px] flex-1 relative" ref={dropdownRef}>
      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3 text-indigo-600 shrink-0" />}
        <span>{label}</span>
      </label>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-between gap-1.5 transition-all text-left shadow-2xs ${
          !isNoneSelected
            ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold ring-2 ring-indigo-200/50"
            : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
        }`}
      >
        <span className="truncate">{buttonText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!isNoneSelected && (
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">
              {selected.size}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* DROPDOWN POPOVER */}
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 min-w-[210px] w-full max-w-[280px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Action Header */}
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100 text-[11px]">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>

          {/* Quick Search */}
          {options.length > 5 && (
            <div className="relative px-1">
              <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-3 text-center">
                No options available
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selected.has(opt);
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                      checked
                        ? "bg-indigo-50/70 text-indigo-900 font-bold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(opt)}
                      className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN GROUP WISE STORE WISE SALE COMPONENT
// ==========================================
export default function GroupWiseStoreWiseSale({ liveRecords = [] }) {
  // Always map directly from live database records
  const data = useMemo(() => mapLiveRecordsToGroupSchema(liveRecords), [liveRecords]);

  // Search in table
  const [tableSearch, setTableSearch] = useState("");

  // Selected filters for each dimension
  const [sel, setSel] = useState({
    store: new Set(),
    lt: new Set(),
    sub: new Set(),
    t1: new Set(),
    t2: new Set(),
    t5: new Set(),
    kpi: new Set(["Amount"]),
  });

  // Derive distinct options per dimension from current dataset
  const opts = useMemo(() => {
    const o = {};
    DIMS.forEach(({ key }) => {
      if (key === "kpi") {
        o[key] = KPIS;
      } else {
        const unique = Array.from(
          new Set(
            data
              .map((d) => d[key])
              .filter((v) => v !== undefined && v !== null && v !== "" && v !== "-"),
          ),
        ).sort();
        o[key] = unique;
      }
    });
    return o;
  }, [data]);

  // Handle Dimension Selection
  const handleDimChange = (key, nextSet) => {
    setSel((prev) => ({
      ...prev,
      [key]: nextSet,
    }));
  };

  // Clear all filters
  const handleClearAll = () => {
    setSel({
      store: new Set(),
      lt: new Set(),
      sub: new Set(),
      t1: new Set(),
      t2: new Set(),
      t5: new Set(),
      kpi: new Set(["Amount"]),
    });
    setTableSearch("");
  };

  // ==========================================
  // PIVOT CALCULATION ENGINE
  // ==========================================
  const pivotResults = useMemo(() => {
    // 1. Filter rows by dimension selections
    const filteredRows = data.filter((row) => {
      // Check store filter
      if (sel.store.size > 0 && !sel.store.has(row.store)) return false;

      // Check group dimensions
      for (const k of GROUP_KEYS) {
        if (sel[k].size > 0 && !sel[k].has(row[k])) return false;
      }

      return true;
    });

    // 2. Active group dimensions (the categories ticked)
    const activeGroupKeys = GROUP_KEYS.filter((k) => sel[k].size > 0);

    // Dynamic header text
    const groupHeaderText = activeGroupKeys.length
      ? `Group (${activeGroupKeys.map((k) => DIM_LABELS[k]).join(" + ")})`
      : "Group";

    // Store column headers
    const availableStores = opts.store || [];
    const activeStores = sel.store.size
      ? availableStores.filter((s) => sel.store.has(s))
      : availableStores;

    // Active KPIs
    const activeKpis = sel.kpi.size ? KPIS.filter((k) => sel.kpi.has(k)) : ["Amount"];

    // Row Label generator
    const getRowLabel = (r) => {
      if (activeGroupKeys.length === 0) {
        return r.lt || r.sub || r.store || "All";
      }
      const parts = activeGroupKeys
        .map((k) => r[k])
        .filter((v) => v && v !== "-");
      return parts.length > 0 ? parts.join(" + ") : "(none)";
    };

    // Calculate Summary Stats
    let totalAmt = 0;
    let totalQty = 0;
    let totalCs = 0;
    filteredRows.forEach((r) => {
      totalAmt += Number(r.Amount) || 0;
      totalQty += Number(r.Quantity) || 0;
      totalCs += Number(r.Case) || 0;
    });

    // Unified Pivot Structure:
    // grid[label][store][kpi] = sum
    const grid = {};

    filteredRows.forEach((r) => {
      const label = getRowLabel(r);
      if (!grid[label]) grid[label] = {};
      const storeName = r.store || "UNASSIGNED";
      if (!grid[label][storeName]) {
        grid[label][storeName] = { Amount: 0, Quantity: 0, Case: 0 };
      }
      grid[label][storeName].Amount += Number(r.Amount) || 0;
      grid[label][storeName].Quantity += Number(r.Quantity) || 0;
      grid[label][storeName].Case += Number(r.Case) || 0;
    });

    let rowKeys = Object.keys(grid).sort((a, b) => a.localeCompare(b));

    // Filter by table search
    if (tableSearch) {
      const searchLower = tableSearch.toLowerCase();
      rowKeys = rowKeys.filter((k) => k.toLowerCase().includes(searchLower));
    }

    // Column Totals: colTotals[store][kpi]
    const colTotals = {};
    activeStores.forEach((st) => {
      colTotals[st] = { Amount: 0, Quantity: 0, Case: 0 };
      activeKpis.forEach((kpi) => {
        colTotals[st][kpi] = rowKeys.reduce((sum, rKey) => sum + (grid[rKey]?.[st]?.[kpi] || 0), 0);
      });
    });

    // Grand Totals across all stores: grandTotals[kpi]
    const grandTotals = {};
    activeKpis.forEach((kpi) => {
      grandTotals[kpi] = activeStores.reduce((sum, st) => sum + (colTotals[st]?.[kpi] || 0), 0);
    });

    // Rows array
    const rows = rowKeys.map((label) => {
      const storeValues = {};
      const rowTotals = { Amount: 0, Quantity: 0, Case: 0 };

      activeStores.forEach((st) => {
        storeValues[st] = {};
        activeKpis.forEach((kpi) => {
          const val = grid[label]?.[st]?.[kpi] || 0;
          storeValues[st][kpi] = val;
          rowTotals[kpi] += val;
        });
      });

      return {
        label,
        storeValues,
        rowTotals,
      };
    });

    return {
      filteredCount: filteredRows.length,
      totalAmt,
      totalQty,
      totalCs,
      activeStoresCount: activeStores.length,
      groupHeader: groupHeaderText,
      stores: activeStores,
      kpis: activeKpis,
      rows,
      colTotals,
      grandTotals,
    };
  }, [data, sel, opts.store, tableSearch]);

  // Export to Excel Functionality
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const { groupHeader, stores, kpis, rows, colTotals, grandTotals } = pivotResults;

      const sheetData = [];

      if (kpis.length > 1) {
        // Top header (Store names)
        const topHeader = [""];
        stores.forEach((st) => {
          topHeader.push(st);
          for (let i = 1; i < kpis.length; i++) topHeader.push("");
        });
        topHeader.push("Total");
        for (let i = 1; i < kpis.length; i++) topHeader.push("");
        sheetData.push(topHeader);

        // Sub header (KPI names)
        const subHeader = [groupHeader];
        stores.forEach(() => {
          kpis.forEach((kpi) => subHeader.push(kpi));
        });
        kpis.forEach((kpi) => subHeader.push(kpi));
        sheetData.push(subHeader);
      } else {
        // Single KPI header
        const header = [groupHeader, ...stores, `Total (${kpis[0]})`];
        sheetData.push(header);
      }

      // Row data
      rows.forEach((r) => {
        const rowData = [r.label];
        stores.forEach((st) => {
          kpis.forEach((kpi) => {
            rowData.push(r.storeValues[st]?.[kpi] || 0);
          });
        });
        kpis.forEach((kpi) => {
          rowData.push(r.rowTotals[kpi] || 0);
        });
        sheetData.push(rowData);
      });

      // Total row
      const totalRow = ["Total"];
      stores.forEach((st) => {
        kpis.forEach((kpi) => {
          totalRow.push(colTotals[st]?.[kpi] || 0);
        });
      });
      kpis.forEach((kpi) => {
        totalRow.push(grandTotals[kpi] || 0);
      });
      sheetData.push(totalRow);

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, "Group Wise Sale");

      XLSX.writeFile(
        wb,
        `Group_Wise_Store_Wise_Sale_${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* KPI METRIC CARDS ROW */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#f8fcff] border-2 border-[#b8ddf8] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> Total Sales Amount
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-xl font-black text-indigo-950">
              ₹ {nfCurrency.format(pivotResults.totalAmt)}
            </span>
          </div>
        </div>

        <div className="bg-[#f8fcff] border-2 border-[#b8ddf8] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" /> Total Cases Sold
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-xl font-black text-blue-950">
              {nfCase.format(pivotResults.totalCs)} <span className="text-xs font-bold text-slate-500">Cases</span>
            </span>
          </div>
        </div>

        <div className="bg-[#f8fcff] border-2 border-[#b8ddf8] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-emerald-600" /> Total Bottles / Qty
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-xl font-black text-emerald-950">
              {nfQty.format(pivotResults.totalQty)} <span className="text-xs font-bold text-slate-500">Units</span>
            </span>
          </div>
        </div>

        <div className="bg-[#f8fcff] border-2 border-[#b8ddf8] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Store className="w-3.5 h-3.5 text-purple-600" /> Active Stores & Rows
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-xl font-black text-purple-950">
              {pivotResults.activeStoresCount}{" "}
              <span className="text-xs font-bold text-slate-500">Stores</span> /{" "}
              {pivotResults.filteredCount.toLocaleString()}{" "}
              <span className="text-xs font-bold text-slate-500">Rows</span>
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MULTI-DIMENSIONAL FILTER CONTROLS CARD */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        {/* Top filter row: Multi-Selects */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {/* Multi-Select Dimension Filters */}
          {DIMS.map((dim) => (
            <MultiSelectDropdown
              key={dim.key}
              label={dim.label}
              icon={dim.icon}
              options={opts[dim.key] || []}
              selected={sel[dim.key] || new Set()}
              onChange={(nextSet) => handleDimChange(dim.key, nextSet)}
            />
          ))}
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Clear All Button */}
            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear All Filters
            </button>

            {/* Export to Excel Button */}
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              title="Export Pivot Table to Excel"
            >
              <Download className="w-3.5 h-3.5" />
              Export Pivot to Excel
            </button>
          </div>

          {/* Search inside table */}
          <div className="relative min-w-[200px] max-w-[320px] flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search group items in table..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:border-indigo-400 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SINGLE UNIFIED PIVOT TABLE WITH SCROLL */}
      {/* ========================================================= */}
      {pivotResults.rows.length === 0 || pivotResults.filteredCount === 0 ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
          <Info className="w-8 h-8 text-amber-600" />
          <p className="font-bold text-amber-900 text-sm">
            No records found for the current combination of filters.
          </p>
          <p className="text-xs text-amber-700">
            Try clicking "Clear All Filters" or expanding your filter selections above.
          </p>
          <button
            onClick={handleClearAll}
            className="mt-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-[#b8ddf8] shadow-xs overflow-hidden flex flex-col">
          {/* Card Header */}
          <div className="bg-[#f0f7ff] border-b-2 border-[#b8ddf8] px-4 py-3 sm:px-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                {pivotResults.kpis.join(" / ")} — Group Wise Store Wise Sale
              </h2>
            </div>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
              {pivotResults.rows.length} {pivotResults.rows.length === 1 ? "Row" : "Rows"}
            </span>
          </div>

          {/* Table Scroll Wrapper */}
          <div className="overflow-x-auto overflow-y-auto max-h-[72vh] custom-scrollbar border border-slate-100">
            <table className="w-full text-xs text-left border-collapse min-w-[700px]">
              {/* Table Header */}
              <thead>
                {pivotResults.kpis.length > 1 ? (
                  <>
                    {/* Top Header: Group and Stores */}
                    <tr className="bg-[#180e5b] text-white font-bold sticky top-0 z-30 select-none">
                      <th
                        rowSpan={2}
                        className="py-3 px-4 text-left font-black tracking-wide border-r border-indigo-900/60 min-w-[220px] bg-[#180e5b] text-white align-middle sticky left-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.25)]"
                      >
                        {pivotResults.groupHeader}
                      </th>
                      {pivotResults.stores.map((store) => (
                        <th
                          key={store}
                          colSpan={pivotResults.kpis.length}
                          className="py-2.5 px-3 text-center font-black border-r border-indigo-900/60 bg-[#1e1273] text-white tracking-wide"
                        >
                          {store}
                        </th>
                      ))}
                      <th
                        colSpan={pivotResults.kpis.length}
                        className="py-2.5 px-3 text-center font-black bg-[#120a44] text-white tracking-wide"
                      >
                        Total
                      </th>
                    </tr>

                    {/* Sub Header: KPIs */}
                    <tr className="sticky top-[37px] z-30 select-none">
                      {pivotResults.stores.map((store) =>
                        pivotResults.kpis.map((kpi) => (
                          <th
                            key={`${store}-${kpi}`}
                            className="py-2 px-2.5 text-right font-extrabold border-r border-indigo-900/40 bg-[#25178d] text-indigo-100 min-w-[95px] text-[11px]"
                          >
                            {kpi}
                          </th>
                        ))
                      )}
                      {pivotResults.kpis.map((kpi) => (
                        <th
                          key={`total-${kpi}`}
                          className="py-2 px-2.5 text-right font-extrabold border-r border-indigo-950/60 bg-[#160d52] text-amber-300 min-w-[105px] text-[11px]"
                        >
                          {kpi}
                        </th>
                      ))}
                    </tr>
                  </>
                ) : (
                  /* Single KPI header */
                  <tr className="bg-[#180e5b] text-white font-bold sticky top-0 z-30 select-none">
                    <th className="py-3 px-4 text-left font-black tracking-wide border-r border-indigo-900/60 min-w-[220px] sticky left-0 z-40 bg-[#180e5b] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.25)]">
                      {pivotResults.groupHeader}
                    </th>
                    {pivotResults.stores.map((store) => (
                      <th
                        key={store}
                        className="py-3 px-3.5 text-right font-black border-r border-indigo-900/60 min-w-[110px]"
                      >
                        {store}
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right font-black bg-[#120a44] min-w-[130px]">
                      Total ({pivotResults.kpis[0]})
                    </th>
                  </tr>
                )}
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pivotResults.rows.map((row, rIdx) => (
                  <tr
                    key={row.label || rIdx}
                    className="hover:bg-indigo-50/50 transition-colors group"
                  >
                    {/* Group Label (Sticky on horizontal scroll) */}
                    <td
                      className="py-2.5 px-4 font-bold text-slate-900 border-r border-slate-200 group-hover:text-indigo-900 truncate max-w-[280px] sticky left-0 z-10 bg-white group-hover:bg-indigo-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
                      title={row.label}
                    >
                      {row.label}
                    </td>

                    {/* Store Columns */}
                    {pivotResults.stores.map((store) =>
                      pivotResults.kpis.map((kpi) => {
                        const val = row.storeValues[store]?.[kpi] || 0;
                        return (
                          <td
                            key={`${store}-${kpi}`}
                            className="py-2.5 px-2.5 text-right tabular-nums border-r border-slate-100"
                          >
                            {val > 0 ? (
                              <span className="font-semibold text-slate-800">
                                {formatKpiValue(val, kpi)}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-light">-</span>
                            )}
                          </td>
                        );
                      })
                    )}

                    {/* Row Totals */}
                    {pivotResults.kpis.map((kpi) => (
                      <td
                        key={`total-${kpi}`}
                        className="py-2.5 px-3 text-right font-black tabular-nums bg-indigo-50/40 text-indigo-950 group-hover:bg-indigo-100/50 border-r border-indigo-100/50"
                      >
                        {formatKpiTotal(row.rowTotals[kpi], kpi)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* Grand Total Footer */}
              <tfoot>
                <tr className="bg-[#eef4ff] border-t-2 border-indigo-300 font-black text-slate-900 sticky bottom-0 z-20 shadow-[0_-2px_5px_-2px_rgba(0,0,0,0.1)]">
                  <td className="py-3 px-4 font-black text-indigo-950 border-r border-indigo-300 sticky left-0 bottom-0 z-30 bg-[#eef4ff] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)]">
                    Total
                  </td>
                  {pivotResults.stores.map((store) =>
                    pivotResults.kpis.map((kpi) => (
                      <td
                        key={`${store}-${kpi}`}
                        className="py-3 px-2.5 text-right tabular-nums border-r border-indigo-200 text-indigo-950 font-black bg-[#eef4ff]"
                      >
                        {formatKpiTotal(
                          pivotResults.colTotals[store]?.[kpi] || 0,
                          kpi
                        )}
                      </td>
                    ))
                  )}
                  {pivotResults.kpis.map((kpi) => (
                    <td
                      key={`total-${kpi}`}
                      className="py-3 px-3 text-right tabular-nums bg-[#dbeafe] text-indigo-950 font-black border-r border-indigo-300/60"
                    >
                      {formatKpiTotal(pivotResults.grandTotals[kpi] || 0, kpi)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
