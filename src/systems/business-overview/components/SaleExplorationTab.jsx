import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  Store,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowUpRight,
  Layers,
  ShoppingBag,
  BarChart2,
  BarChart3,
  Table,
  Search,
  SlidersHorizontal,
  X,
  Filter,
  Eye,
  EyeOff,
  ArrowUpDown,
  Split,
  Layers2,
} from "lucide-react";

// Formatters
const nfCurrency = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const nfNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });

const STORE_PALETTE = [
  "#312e81", // Deep Indigo
  "#ea580c", // Vibrant Orange
  "#059669", // Emerald
  "#0284c7", // Sky Blue
  "#9333ea", // Purple
  "#e11d48", // Rose
  "#ca8a04", // Amber
  "#475569", // Slate
];

const getShopColor = (shopName, distinctShops = []) => {
  const idx = distinctShops.indexOf(shopName);
  if (idx === -1) return "#64748b";
  return STORE_PALETTE[idx % STORE_PALETTE.length];
};

function formatMetricValue(val, metric) {
  if (!val || isNaN(val)) return metric === "Revenue" || metric === "Profit" ? "₹ 0" : "0";
  if (metric === "Revenue" || metric === "Profit" || metric === "Amount") {
    if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹ ${(val / 100000).toFixed(2)} L`;
    if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)} K`;
    return `₹ ${nfCurrency.format(val)}`;
  }
  if (metric === "Case") {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K Cases`;
    return `${nfNumber.format(val)} Cases`;
  }
  // Quantity / Quality
  if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M Units`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K Units`;
  return `${Math.round(val).toLocaleString("en-IN")} Units`;
}

function formatExactNumber(val, metric) {
  if (!val || isNaN(val)) return "0";
  if (metric === "Revenue" || metric === "Profit" || metric === "Amount") return `₹ ${Math.round(val).toLocaleString("en-IN")}`;
  if (metric === "Case") return `${nfNumber.format(val)} Cases`;
  return `${Math.round(val).toLocaleString("en-IN")} Units`;
}

/**
 * 5TH TAB COMPONENT: SALE EXPLORATION DASHBOARD
 */
export default function SaleExplorationTab({
  liveRecords = [],
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}) {
  // Local Controls
  const [metric, setMetric] = useState("Revenue"); // "Revenue" | "Quantity" | "Case" | "Profit"
  const [selectedStore, setSelectedStore] = useState("All");
  const [trendFreq, setTrendFreq] = useState("Weekly"); // "Daily" | "Weekly" | "Monthly"
  const [paretoThreshold, setParetoThreshold] = useState(80); // 80% default threshold (editable)
  const [categoryViewMode, setCategoryViewMode] = useState("category"); // "category" | "product"
  const [categoryDisplayStyle, setCategoryDisplayStyle] = useState("stacked"); // "stacked" | "grouped" | "table"
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryLimit, setCategoryLimit] = useState("10"); // "5" | "10" | "20" | "all"
  const [hideZeroSales, setHideZeroSales] = useState(true);
  const [categorySort, setCategorySort] = useState("total"); // "total" | "name" | "shop"
  const [expandedCats, setExpandedCats] = useState({}); // { [catName]: boolean }
  const [hoveredParetoIdx, setHoveredParetoIdx] = useState(null);
  const [hoveredTrendPt, setHoveredTrendPt] = useState(null);
  const [hoveredShopPartition, setHoveredShopPartition] = useState(null);
  const [pinnedShop, setPinnedShop] = useState(null);

  // Extract available stores
  const storeOptions = useMemo(() => {
    const s = new Set();
    liveRecords.forEach((r) => {
      const st = (r.shop_id || r.shop_name || r.store || "").trim();
      if (st) s.add(st);
    });
    return ["All", ...Array.from(s).sort()];
  }, [liveRecords]);

  // Filter records by Shop (default All)
  const filteredRecords = useMemo(() => {
    if (selectedStore === "All") return liveRecords;
    return liveRecords.filter((r) => {
      const st = (r.shop_id || r.shop_name || r.store || "").trim();
      return st === selectedStore;
    });
  }, [liveRecords, selectedStore]);

  // Helper to get item value based on active metric
  const getRecordValue = (r) => {
    const q = Number(r.quantity_out ?? r.quantity ?? r.qty) || 0;
    const mrp = Number(r.mrp_rate ?? r.mrp ?? r.amount) || 0;
    const purRate = Number(r.purchase_rate ?? r.pur_rate) || mrp * 0.8;
    const bcs = Number(r.b_cs) > 0 ? Number(r.b_cs) : 12;
    const amt = r.amount !== undefined ? Number(r.amount) : q * mrp;

    if (metric === "Quantity") return q;
    if (metric === "Case") return q / bcs;
    if (metric === "Profit") {
      if (r.profit !== undefined && !isNaN(Number(r.profit)) && Number(r.profit) !== 0) {
        return Number(r.profit);
      }
      return q * (mrp - purRate);
    }
    // Revenue (Total sale)
    return amt;
  };

  // 1. COMPUTED AGGREGATIONS
  const aggregations = useMemo(() => {
    let totalVal = 0;
    let totalQty = 0;
    let totalCases = 0;
    let totalAmount = 0;

    const brandMap = {};
    const catMap = {};
    const liquorTypeMap = {};
    const storeTotalsMap = {};
    const catStoreMap = {};
    const catProductMap = {};
    const brandStoreMap = {};
    const dateMap = {};

    filteredRecords.forEach((r) => {
      const val = getRecordValue(r);
      const q = Number(r.quantity_out ?? r.quantity ?? r.qty) || 0;
      const mrp = Number(r.mrp_rate ?? r.mrp ?? r.amount) || 0;
      const bcs = Number(r.b_cs) > 0 ? Number(r.b_cs) : 12;
      const amt = r.amount !== undefined ? Number(r.amount) : q * mrp;
      const cs = q / bcs;

      totalVal += val;
      totalQty += q;
      totalCases += cs;
      totalAmount += amt;

      // Brand / Product
      const brand = (r.brand_name || r.item_name || r.brand || "Other Brand").trim();
      brandMap[brand] = (brandMap[brand] || 0) + val;

      // Category / Subhead
      const cat = (r.subhead || r.category || "General").trim();
      catMap[cat] = (catMap[cat] || 0) + val;

      // Liquor Type
      const lt = (r.liquor_type || "OTHER").trim().toUpperCase();
      liquorTypeMap[lt] = (liquorTypeMap[lt] || 0) + val;

      // Store
      const st = (r.shop_id || r.shop_name || r.store || "Unknown Store").trim();
      storeTotalsMap[st] = (storeTotalsMap[st] || 0) + val;

      // Store + Category
      if (!catStoreMap[cat]) catStoreMap[cat] = {};
      catStoreMap[cat][st] = (catStoreMap[cat][st] || 0) + val;

      // Category + Product + Store
      if (!catProductMap[cat]) catProductMap[cat] = {};
      if (!catProductMap[cat][brand]) catProductMap[cat][brand] = {};
      catProductMap[cat][brand][st] = (catProductMap[cat][brand][st] || 0) + val;

      // Product + Store
      if (!brandStoreMap[brand]) brandStoreMap[brand] = {};
      brandStoreMap[brand][st] = (brandStoreMap[brand][st] || 0) + val;

      // Date
      const d = (r.date || "").slice(0, 10);
      if (d) {
        dateMap[d] = (dateMap[d] || 0) + val;
      }
    });

    // Top Products for Pareto
    const sortedBrands = Object.entries(brandMap)
      .map(([name, val]) => ({ name, value: val }))
      .sort((a, b) => b.value - a.value);

    let cum = 0;
    let cutoffCount = 0;
    const paretoBrands = sortedBrands.slice(0, 24).map((b, i) => {
      cum += b.value;
      const cumPct = totalVal > 0 ? (cum / totalVal) * 100 : 0;
      const isWithinThreshold = cumPct <= paretoThreshold || (i > 0 && ((cum - b.value) / (totalVal || 1)) * 100 < paretoThreshold);
      if (isWithinThreshold) cutoffCount = i + 1;
      return {
        ...b,
        cumValue: cum,
        cumPercent: Math.min(cumPct, 100),
        isWithinThreshold,
        rank: i + 1,
      };
    });

    // Distinct Shops sorted by total volume
    const distinctShops = Object.keys(storeTotalsMap).sort(
      (a, b) => storeTotalsMap[b] - storeTotalsMap[a],
    );

    // Categories with Shop Partitions & Top Products
    const categoryListWithShops = Object.entries(catStoreMap)
      .map(([catName, shops]) => {
        const catTotal = Object.values(shops).reduce((a, b) => a + b, 0);
        const shopPartitions = Object.entries(shops)
          .map(([shop, val]) => {
            const pct = catTotal > 0 ? (val / catTotal) * 100 : 0;
            return {
              shop,
              val,
              pct,
              pctOfCategory: pct,
            };
          })
          .sort((a, b) => b.val - a.val);

        // Top products under this category
        const prodsObj = catProductMap[catName] || {};
        const products = Object.entries(prodsObj)
          .map(([prodName, pShops]) => {
            const prodTotal = Object.values(pShops).reduce((a, b) => a + b, 0);
            const prodPartitions = Object.entries(pShops)
              .map(([shop, val]) => {
                const pct = prodTotal > 0 ? (val / prodTotal) * 100 : 0;
                return {
                  shop,
                  val,
                  pct,
                  pctOfProduct: pct,
                };
              })
              .sort((a, b) => b.val - a.val);

            return {
              name: prodName,
              totalVal: prodTotal,
              pctOfCategory: catTotal > 0 ? (prodTotal / catTotal) * 100 : 0,
              shopPartitions: prodPartitions,
            };
          })
          .sort((a, b) => b.totalVal - a.totalVal);

        return {
          name: catName,
          totalVal: catTotal,
          percentOfTotal: totalVal > 0 ? (catTotal / totalVal) * 100 : 0,
          shopPartitions,
          products: products.slice(0, 5),
        };
      })
      .sort((a, b) => b.totalVal - a.totalVal);

    // Products with Shop Partitions
    const productListWithShops = Object.entries(brandStoreMap)
      .map(([prodName, shops]) => {
        const prodTotal = Object.values(shops).reduce((a, b) => a + b, 0);
        const shopPartitions = Object.entries(shops)
          .map(([shop, val]) => {
            const pct = prodTotal > 0 ? (val / prodTotal) * 100 : 0;
            return {
              shop,
              val,
              pct,
              pctOfProduct: pct,
            };
          })
          .sort((a, b) => b.val - a.val);

        return {
          name: prodName,
          totalVal: prodTotal,
          percentOfTotal: totalVal > 0 ? (prodTotal / totalVal) * 100 : 0,
          shopPartitions,
        };
      })
      .sort((a, b) => b.totalVal - a.totalVal);

    // Date Trend List based on Frequency
    const dates = Object.keys(dateMap).sort();
    let trendList = [];

    if (trendFreq === "Daily") {
      trendList = dates.map((d) => ({
        label: d.length === 10 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d,
        fullDate: d,
        value: dateMap[d],
      }));
    } else if (trendFreq === "Weekly") {
      const weekMap = {};
      dates.forEach((d) => {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return;
        const weekNum = Math.ceil(dt.getDate() / 7);
        const m = dt.toLocaleString("en-US", { month: "short" });
        const key = `${m} W${weekNum}`;
        weekMap[key] = (weekMap[key] || 0) + dateMap[d];
      });
      trendList = Object.entries(weekMap).map(([label, val]) => ({
        label,
        value: val,
      }));
    } else {
      const monthMap = {};
      dates.forEach((d) => {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return;
        const m = dt.toLocaleString("en-US", { month: "short", year: "2-digit" });
        monthMap[m] = (monthMap[m] || 0) + dateMap[d];
      });
      trendList = Object.entries(monthMap).map(([label, val]) => ({
        label,
        value: val,
      }));
    }

    return {
      totalVal,
      totalQty,
      totalCases,
      totalAmount,
      paretoBrands,
      cutoffCount: Math.max(cutoffCount, 1),
      distinctShops,
      storeTotalsMap,
      categoryListWithShops,
      productListWithShops,
      trendList,
      dateCount: dates.length,
    };
  }, [filteredRecords, metric, trendFreq, paretoThreshold]);

  // Pareto Chart Dimensions
  const paretoMax = Math.max(...aggregations.paretoBrands.map((b) => b.value), 1);
  const avgTrendVal =
    aggregations.trendList.length > 0
      ? aggregations.trendList.reduce((acc, t) => acc + t.value, 0) /
        aggregations.trendList.length
      : 0;

  // Filtered & Sorted Category/Product list for the breakdown section
  const breakdownData = useMemo(() => {
    const rawList =
      categoryViewMode === "category"
        ? aggregations.categoryListWithShops
        : aggregations.productListWithShops;

    let items = [...rawList];

    // Filter out zero sales if toggle is on
    if (hideZeroSales) {
      items = items.filter((item) => item.totalVal > 0);
    }

    // Filter by search term
    if (categorySearch.trim()) {
      const q = categorySearch.toLowerCase().trim();
      items = items.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Sort items
    if (categorySort === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name));
    } else if (categorySort === "shop" && pinnedShop) {
      items.sort((a, b) => {
        const aShopVal = a.shopPartitions.find((sp) => sp.shop === pinnedShop)?.val || 0;
        const bShopVal = b.shopPartitions.find((sp) => sp.shop === pinnedShop)?.val || 0;
        return bShopVal - aShopVal;
      });
    } else {
      // Default: Total sale descending
      items.sort((a, b) => b.totalVal - a.totalVal);
    }

    const totalMatchingCount = items.length;
    const maxVal = items.length > 0 ? Math.max(...items.map((it) => it.totalVal)) : 1;

    // Apply limit
    if (categoryLimit !== "all") {
      const limitNum = parseInt(categoryLimit, 10) || 10;
      items = items.slice(0, limitNum);
    }

    return {
      items,
      totalMatchingCount,
      rawCount: rawList.length,
      maxVal,
    };
  }, [
    categoryViewMode,
    aggregations.categoryListWithShops,
    aggregations.productListWithShops,
    hideZeroSales,
    categorySearch,
    categorySort,
    pinnedShop,
    categoryLimit,
  ]);

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-slate-800 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & FILTER BAR (Matches Tableau Spec) */}
      {/* ========================================================= */}
      <div className="bg-white rounded-2xl border-2 border-[#b8ddf8] p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-6 bg-[#ff6b2b] rounded-full inline-block" />
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              MERCHANDISE & SALES EXPLORATION
            </h1>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-0.5 pl-4.5">
            Performance Scope:{" "}
            <span className="font-black text-slate-700">
              {startDate || "01 Jan 2026"}
            </span>{" "}
            up to{" "}
            <span className="font-black text-slate-700">
              {endDate || "31 Oct 2026"}
            </span>{" "}
            by <span className="font-black text-[#ff6b2b]">{metric}</span>
          </p>
        </div>

        {/* Global Controls Grid */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metrics Selector */}
          <div className="flex flex-col">
            <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
              Metrics
            </label>
            <div className="relative">
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="py-1.5 pl-3 pr-8 text-xs font-black bg-slate-50 border border-[#badbf4] rounded-xl text-slate-800 focus:outline-hidden focus:border-[#ff6b2b] cursor-pointer shadow-2xs appearance-none min-w-36"
              >
                <option value="Quantity">Quality (Quantity)</option>
                <option value="Revenue">Revenue (Total sale)</option>
                <option value="Case">Case Sold</option>
                <option value="Profit">Profit</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Shop Selection */}
          <div className="flex flex-col">
            <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
              Shop
            </label>
            <div className="relative">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="py-1.5 pl-3 pr-8 text-xs font-black bg-slate-50 border border-[#badbf4] rounded-xl text-slate-800 focus:outline-hidden focus:border-[#ff6b2b] cursor-pointer shadow-2xs appearance-none max-w-44 truncate"
              >
                {storeOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Start Date */}
          <div className="flex flex-col">
            <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate || ""}
              onChange={(e) => setStartDate && setStartDate(e.target.value)}
              className="py-1.5 px-2 text-xs font-bold bg-slate-50 border border-[#badbf4] rounded-xl text-slate-800 focus:outline-hidden focus:border-[#ff6b2b] cursor-pointer shadow-2xs"
            />
          </div>

          {/* End Date */}
          <div className="flex flex-col">
            <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider mb-0.5">
              End Date
            </label>
            <input
              type="date"
              value={endDate || ""}
              onChange={(e) => setEndDate && setEndDate(e.target.value)}
              className="py-1.5 px-2 text-xs font-bold bg-slate-50 border border-[#badbf4] rounded-xl text-slate-800 focus:outline-hidden focus:border-[#ff6b2b] cursor-pointer shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TOP SECTION: 70-30 SPLIT (Pareto Chart + Orange Hero Card) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 items-stretch">
        {/* ======================================================= */}
        {/* 30% LEFT / SIDE: DISTINCT ORANGE HERO CARD & BREAKDOWN  */}
        {/* ======================================================= */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* Main Orange Card */}
          <div className="bg-linear-to-br from-[#ff6b2b] via-[#f95711] to-[#e44600] text-white rounded-2xl p-5 shadow-lg shadow-orange-500/25 flex flex-col justify-between relative overflow-hidden min-h-47.5">
            {/* Background geometric accents */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute right-4 top-4 text-white/20">
              <Sparkles className="w-12 h-12 stroke-1" />
            </div>

            <div>
              <span className="text-xs font-black uppercase tracking-widest text-orange-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Total {metric}
              </span>
              <div className="text-3xl sm:text-4xl font-black tracking-tight mt-2 text-white drop-shadow-sm">
                {formatMetricValue(aggregations.totalVal, metric)}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
              <span className="text-orange-100 font-bold flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-white" />
                In {aggregations.dateCount || 30} Day(s) Record
              </span>
              <span className="bg-white/20 backdrop-blur-xs px-2.5 py-0.5 rounded-full font-black text-[11px] text-white">
                {selectedStore}
              </span>
            </div>
          </div>

          {/* Mini Category & Liquor Breakdown Box */}
          <div className="bg-white rounded-2xl border-2 border-[#badbf4] p-3.5 shadow-xs flex-1 flex flex-col justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Top Categories by {metric}</span>
              <span className="text-[10px] text-slate-400 font-bold">Shop Partitioned</span>
            </h3>

            <div className="flex flex-col gap-2.5">
              {aggregations.categoryListWithShops.slice(0, 4).map((cat) => {
                return (
                  <div key={cat.name} className="flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[11px] font-bold">
                      <span className="truncate max-w-37.5 text-slate-700">
                        {cat.name}
                      </span>
                      <span className="font-black text-slate-900">
                        {cat.percentOfTotal.toFixed(1)}%
                      </span>
                    </div>
                    {/* Horizontal Shop-Partitioned Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex shadow-2xs border border-slate-200">
                      {cat.shopPartitions.map((sp) => (
                        <div
                          key={sp.shop}
                          style={{
                            width: `${Number(sp.pct || 0)}%`,
                            backgroundColor: getShopColor(sp.shop, aggregations.distinctShops),
                          }}
                          className="h-full transition-all duration-300 hover:brightness-125"
                          title={`${sp.shop}: ${formatMetricValue(sp.val, metric)} (${Number(sp.pct || 0).toFixed(1)}%)`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 70% RIGHT: TOP PRODUCTS PARETO CHART (80/20 RULE)       */}
        {/* ======================================================= */}
        <div className="lg:col-span-7 bg-white rounded-2xl border-2 border-[#badbf4] p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-90">
          {/* Pareto Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                Top Products by {metric} — Pareto Chart
              </h2>
              <p className="text-xs font-bold text-slate-600 mt-0.5">
                <span className="text-emerald-700 font-black">
                  {paretoThreshold}% of {metric}
                </span>{" "}
                are generated by{" "}
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-black">
                  {aggregations.cutoffCount} product(s)
                </span>{" "}
                out of {aggregations.paretoBrands.length} listed
              </p>
            </div>

            {/* Interactive Editable Threshold Control */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs shadow-2xs hover:border-emerald-400 focus-within:border-emerald-500 transition-all">
              <label htmlFor="pareto-threshold-input" className="font-extrabold text-slate-600 cursor-pointer select-none">
                % Threshold
              </label>
              <div className="relative flex items-center">
                <input
                  id="pareto-threshold-input"
                  type="number"
                  min="1"
                  max="100"
                  value={paretoThreshold}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setParetoThreshold("");
                    } else {
                      const val = Number(raw);
                      if (!isNaN(val)) {
                        setParetoThreshold(Math.max(1, Math.min(100, val)));
                      }
                    }
                  }}
                  onBlur={() => {
                    if (!paretoThreshold || paretoThreshold < 1) {
                      setParetoThreshold(80);
                    }
                  }}
                  className="w-14 bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-center font-black text-slate-900 text-xs focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-400 shadow-inner"
                />
                <span className="text-xs font-black text-slate-600 ml-1">%</span>
              </div>
            </div>
          </div>

          {/* Pareto SVG Combination Chart */}
          <div className="flex-1 w-full relative min-h-55">
            {(() => {
              const svgW = 800;
              const svgH = 220;
              const padL = 48;
              const padR = 48;
              const padT = 18;
              const padB = 42;
              const barCount = aggregations.paretoBrands.length || 1;
              const barSlotW = (svgW - padL - padR) / barCount;
              const barW = Math.max(barSlotW * 0.72, 8);

              // Coords for Cumulative Line
              const linePoints = aggregations.paretoBrands.map((b, idx) => {
                const x = padL + idx * barSlotW + barSlotW / 2;
                const y = padT + (1 - b.cumPercent / 100) * (svgH - padT - padB);
                return { x, y, ...b };
              });

              let linePathD = "";
              if (linePoints.length > 0) {
                linePathD = linePoints.reduce((acc, pt, i) => {
                  if (i === 0) return `M ${pt.x},${pt.y}`;
                  return `${acc} L ${pt.x},${pt.y}`;
                }, "");
              }

              const thresholdY =
                padT + (1 - paretoThreshold / 100) * (svgH - padT - padB);

              return (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-full block overflow-visible select-none"
                >
                  {/* Left Y-Axis Grid Lines & Values (0%, 25%, 50%, 75%, 100%) */}
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const y = padT + (1 - pct / 100) * (svgH - padT - padB);
                    const leftVal = (paretoMax * (pct / 100));
                    return (
                      <g key={pct}>
                        <line
                          x1={padL}
                          y1={y}
                          x2={svgW - padR}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                        {/* Left Y Axis Number */}
                        <text
                          x={padL - 6}
                          y={y + 3.5}
                          textAnchor="end"
                          className="text-[9.5px] fill-slate-400 font-bold"
                        >
                          {leftVal >= 1000 ? `${Math.round(leftVal / 1000)}k` : Math.round(leftVal)}
                        </text>
                        {/* Right Y Axis Cumulative % */}
                        <text
                          x={svgW - padR + 6}
                          y={y + 3.5}
                          textAnchor="start"
                          className="text-[9.5px] fill-slate-400 font-bold"
                        >
                          {pct}%
                        </text>
                      </g>
                    );
                  })}

                  {/* 80% Threshold Horizontal Guideline */}
                  <line
                    x1={padL}
                    y1={thresholdY}
                    x2={svgW - padR}
                    y2={thresholdY}
                    stroke="#059669"
                    strokeWidth="1.5"
                    strokeDasharray="4,4"
                  />
                  <text
                    x={svgW - padR - 10}
                    y={thresholdY - 6}
                    textAnchor="end"
                    className="text-[10px] font-black fill-emerald-700"
                  >
                    {Number(paretoThreshold || 80).toFixed(2)}% Threshold
                  </text>

                  {/* Individual Product Bars */}
                  {aggregations.paretoBrands.map((b, idx) => {
                    const x = padL + idx * barSlotW + (barSlotW - barW) / 2;
                    const h = Math.max((b.value / paretoMax) * (svgH - padT - padB), 4);
                    const y = svgH - padB - h;
                    const isWithin = b.isWithinThreshold;
                    const isHovered = hoveredParetoIdx === idx;

                    return (
                      <g
                        key={b.name}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHoveredParetoIdx(idx)}
                        onMouseLeave={() => setHoveredParetoIdx(null)}
                      >
                        {/* Bar */}
                        <rect
                          x={x}
                          y={y}
                          width={barW}
                          height={h}
                          rx={3}
                          fill={
                            isHovered
                              ? "#047857"
                              : isWithin
                                ? "#10b981"
                                : "#cbd5e1"
                          }
                          opacity={isHovered ? 1 : isWithin ? 0.9 : 0.6}
                        />

                        {/* Top Value on Hover */}
                        {isHovered && (
                          <text
                            x={x + barW / 2}
                            y={y - 6}
                            textAnchor="middle"
                            className="text-[10px] font-black fill-slate-900"
                          >
                            {formatExactNumber(b.value, metric)}
                          </text>
                        )}

                        {/* Bottom X-Axis Label */}
                        <text
                          x={x + barW / 2}
                          y={svgH - padB + 14}
                          textAnchor="end"
                          transform={`rotate(-45, ${x + barW / 2}, ${svgH - padB + 14})`}
                          className={`text-[8.5px] font-bold ${
                            isWithin ? "fill-slate-800" : "fill-slate-400"
                          }`}
                        >
                          {b.name.length > 10 ? `${b.name.slice(0, 9)}..` : b.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* Smooth Cumulative % Curve (Black/Navy) */}
                  {linePathD && (
                    <path
                      d={linePathD}
                      fill="none"
                      stroke="#0f172a"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Cumulative % Line Points */}
                  {linePoints.map((pt, idx) => {
                    const isHovered = hoveredParetoIdx === idx;
                    return (
                      <circle
                        key={`pt-${idx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 5 : 2.5}
                        fill={isHovered ? "#10b981" : "#0f172a"}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BOTTOM 50-50 SECTION: SALE TREND & TOP CATEGORY BY STORE */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* LEFT 50%: SALE TRENDS (Daily / Weekly / Monthly) */}
        <div className="bg-white rounded-2xl border-2 border-[#b8ddf8] p-4 sm:p-5 shadow-xs flex flex-col justify-between min-h-85">
          {/* Trend Header with Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {trendFreq} Total Sale Trend
                </h2>
                <span className="text-[11px] font-bold text-slate-500">
                  (Average: {formatMetricValue(avgTrendVal, metric)})
                </span>
              </div>
            </div>

            {/* Frequency Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {["Daily", "Weekly", "Monthly"].map((f) => (
                <button
                  key={f}
                  onClick={() => setTrendFreq(f)}
                  className={`px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer ${
                    trendFreq === f
                      ? "bg-white text-indigo-950 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Trend Line Chart */}
          <div className="w-full relative flex-1 min-h-48 flex items-center">
            {(() => {
              const list = aggregations.trendList;
              if (!list.length) {
                return (
                  <div className="w-full h-44 flex items-center justify-center text-slate-400 text-xs font-bold">
                    No date records found for selected period
                  </div>
                );
              }

              const svgW = 600;
              const svgH = 200;
              const padL = 54;
              const padR = 20;
              const padT = 20;
              const padB = 34;

              const maxVal = Math.max(...list.map((d) => d.value), 1) * 1.15;
              const ceiling = maxVal;

              const getX = (idx) =>
                padL + (idx / Math.max(list.length - 1, 1)) * (svgW - padL - padR);
              const getY = (val) =>
                padT + (1 - val / ceiling) * (svgH - padT - padB);

              const coords = list.map((d, i) => ({
                x: getX(i),
                y: getY(d.value),
                ...d,
              }));

              const pathD = coords.reduce((acc, pt, i) => {
                if (i === 0) return `M ${pt.x},${pt.y}`;
                return `${acc} L ${pt.x},${pt.y}`;
              }, "");

              const avgY = getY(avgTrendVal);

              const maxPt = [...coords].sort((a, b) => b.value - a.value)[0];

              return (
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-full block overflow-visible select-none"
                >
                  {/* Y Axis Grid Lines */}
                  {[0, 0.33, 0.66, 1].map((ratio) => {
                    const val = ceiling * ratio;
                    const y = getY(val);
                    return (
                      <g key={ratio}>
                        <line
                          x1={padL}
                          y1={y}
                          x2={svgW - padR}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                        <text
                          x={padL - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          className="text-[9.5px] fill-slate-400 font-bold"
                        >
                          {formatShortK(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Avg Line */}
                  <line
                    x1={padL}
                    y1={avgY}
                    x2={svgW - padR}
                    y2={avgY}
                    stroke="#94a3b8"
                    strokeWidth="1.2"
                    strokeDasharray="4,4"
                  />
                  <text
                    x={padL + 10}
                    y={avgY - 5}
                    className="text-[9px] fill-slate-500 font-extrabold"
                  >
                    Avg: {formatShortK(avgTrendVal)}
                  </text>

                  {/* Trend Path */}
                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#475569"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Points */}
                  {coords.map((pt, idx) => {
                    const isHovered = hoveredTrendPt === idx;
                    const isMax = maxPt && maxPt.label === pt.label;
                    return (
                      <g
                        key={idx}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTrendPt(idx)}
                        onMouseLeave={() => setHoveredTrendPt(null)}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : isMax ? 4.5 : 3}
                          fill={isMax ? "#ff6b2b" : "#334155"}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        {isMax && (
                          <text
                            x={pt.x}
                            y={pt.y - 8}
                            textAnchor="middle"
                            className="text-[9.5px] font-black fill-[#ff6b2b]"
                          >
                            Peak: {formatMetricValue(pt.value, metric)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {coords.map((pt, i) => {
                    const step = Math.max(Math.floor(coords.length / 8), 1);
                    if (i % step !== 0 && i !== coords.length - 1) return null;
                    return (
                      <text
                        key={`xl-${i}`}
                        x={pt.x}
                        y={svgH - padB + 16}
                        textAnchor="middle"
                        className="text-[9.5px] font-bold fill-slate-600"
                      >
                        {pt.label}
                      </text>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* RIGHT 50%: HORIZONTAL CATEGORY & PRODUCT BREAKDOWN WITH MULTI-MODE SHOP PARTITIONS */}
        <div className="bg-[#f8fcff] rounded-2xl p-4 sm:p-5 border-2 border-[#b8ddf8] shadow-xs flex flex-col justify-between min-h-95">
          {/* Header with Title & View Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5 pb-2.5 border-b border-slate-200">
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                <Layers className="w-4.5 h-4.5 text-indigo-600" />
                {categoryViewMode === "category" ? "Category Breakdown" : "Product Breakdown"} by Shop
              </h2>
              <p className="text-[11px] font-bold text-slate-500">
                Showing {breakdownData.items.length} of {breakdownData.totalMatchingCount} {categoryViewMode === "category" ? "categories" : "products"}
                {pinnedShop ? ` (Focused on ${pinnedShop})` : ""}
              </p>
            </div>

            {/* View Switchers: Scope & Visual Style */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Category / Product Scope Toggle */}
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 p-0.5 rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCategoryViewMode("category")}
                  className={`px-2 py-1 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    categoryViewMode === "category"
                      ? "bg-indigo-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="View by Category"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Category
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryViewMode("product")}
                  className={`px-2 py-1 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    categoryViewMode === "product"
                      ? "bg-indigo-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  title="View by Product"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Product
                </button>
              </div>

              {/* Display Style Toggle (Stacked vs Side-by-Side vs Table) */}
              <div className="flex items-center gap-0.5 bg-white border border-slate-200 p-0.5 rounded-xl shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCategoryDisplayStyle("stacked")}
                  className={`p-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    categoryDisplayStyle === "stacked"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                  title="Segmented / Stacked Bars"
                >
                  <Layers2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10.5px]">Segmented</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryDisplayStyle("grouped")}
                  className={`p-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    categoryDisplayStyle === "grouped"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                  title="Side-by-Side Comparison"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10.5px]">Compare</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryDisplayStyle("table")}
                  className={`p-1.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    categoryDisplayStyle === "table"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                  title="Matrix Data Table"
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[10.5px]">Matrix</span>
                </button>
              </div>
            </div>
          </div>

          {/* Controls Bar: Search, Limit, Zero Filter, Sort */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            {/* Search Input */}
            {/* <div className="relative flex-1 min-w-[140px] max-w-xs"> */}
              <div className="relative flex-1 min-w-35 max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder={`Search ${categoryViewMode}...`}
                className="w-full pl-8 pr-7 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:border-indigo-400 shadow-2xs text-slate-800"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Top N Limit */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-xl shadow-2xs text-[11px] font-bold text-slate-700">
                <span className="text-slate-500 font-extrabold text-[10px]">Show:</span>
                <select
                  value={categoryLimit}
                  onChange={(e) => setCategoryLimit(e.target.value)}
                  className="bg-transparent font-black text-slate-900 focus:outline-hidden cursor-pointer text-xs"
                >
                  <option value="5">Top 5</option>
                  <option value="10">Top 10</option>
                  <option value="20">Top 20</option>
                  <option value="all">All ({breakdownData.totalMatchingCount})</option>
                </select>
              </div>

              {/* Hide Zero Sales Filter Toggle */}
              <button
                type="button"
                onClick={() => setHideZeroSales((prev) => !prev)}
                className={`px-2 py-1 text-[11px] font-bold rounded-xl border transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                  hideZeroSales
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-black"
                    : "bg-white border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title={hideZeroSales ? "Showing only items with sales > 0" : "Showing all items including zero sales"}
              >
                {hideZeroSales ? (
                  <EyeOff className="w-3 h-3 text-indigo-600" />
                ) : (
                  <Eye className="w-3 h-3 text-slate-400" />
                )}
                <span>Hide ₹0</span>
              </button>

              {/* Sort By Selector */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-xl shadow-2xs text-[11px] font-bold text-slate-700">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <select
                  value={categorySort}
                  onChange={(e) => setCategorySort(e.target.value)}
                  className="bg-transparent font-black text-slate-900 focus:outline-hidden cursor-pointer text-xs"
                >
                  <option value="total">High → Low</option>
                  <option value="name">Name (A-Z)</option>
                  {pinnedShop && <option value="shop">{pinnedShop} Share</option>}
                </select>
              </div>
            </div>
          </div>

          {/* Shop Legend / Interactive Pinned Filter Key */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3 px-1">
            <span className="text-[10.5px] font-black text-slate-700 flex items-center gap-1 mr-0.5">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              Shops:
            </span>
            {aggregations.distinctShops.map((shopName) => {
              const color = getShopColor(shopName, aggregations.distinctShops);
              const storeTotal = aggregations.storeTotalsMap[shopName] || 0;
              const isPinned = pinnedShop === shopName;
              const isOther = pinnedShop && !isPinned;

              return (
                <button
                  key={shopName}
                  type="button"
                  onClick={() => {
                    setPinnedShop((prev) => (prev === shopName ? null : shopName));
                    if (!pinnedShop) setCategorySort("shop");
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold transition-all cursor-pointer ${
                    isPinned
                      ? "ring-2 ring-indigo-600 bg-indigo-900 text-white shadow-xs font-black scale-105"
                      : isOther
                        ? "opacity-40 bg-white/60 text-slate-400 border border-slate-200"
                        : "bg-white border border-slate-200 text-slate-800 hover:border-slate-400 shadow-2xs"
                  }`}
                  title={isPinned ? `Click to unpin ${shopName}` : `Click to focus on ${shopName}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="truncate max-w-32">{shopName}</span>
                  <span
                    className={`text-[9.5px] font-extrabold ${
                      isPinned ? "text-indigo-200" : "text-slate-500"
                    }`}
                  >
                    ({formatMetricValue(storeTotal, metric)})
                  </span>
                </button>
              );
            })}

            {pinnedShop && (
              <button
                type="button"
                onClick={() => {
                  setPinnedShop(null);
                  setCategorySort("total");
                }}
                className="text-[10px] font-black text-indigo-700 hover:text-indigo-900 underline ml-1 cursor-pointer"
              >
                Reset Focus
              </button>
            )}
          </div>

          {/* MAIN VISUALIZATION CONTAINER */}
          <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-80 pr-1 custom-scrollbar">
            {breakdownData.items.length === 0 ? (
              <div className="w-full py-12 flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-1 bg-white/60 rounded-xl border border-dashed border-slate-200">
                <Search className="w-6 h-6 text-slate-300" />
                <span>No matching items found</span>
                {categorySearch && (
                  <button
                    type="button"
                    onClick={() => setCategorySearch("")}
                    className="text-indigo-600 text-xs font-black underline mt-1"
                  >
                    Clear search filter
                  </button>
                )}
              </div>
            ) : categoryDisplayStyle === "table" ? (
              /* ======================================================= */
              /* MODE 3: MATRIX DATA TABLE VIEW                          */
              /* ======================================================= */
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-[10.5px] font-black text-slate-600 uppercase tracking-wider">
                      <th className="py-2 px-2.5 w-8 text-center">#</th>
                      <th className="py-2 px-3">
                        {categoryViewMode === "category" ? "Category" : "Product"}
                      </th>
                      <th className="py-2 px-3 text-right">Total {metric}</th>
                      <th className="py-2 px-2.5 text-right">% Share</th>
                      {aggregations.distinctShops.map((st) => (
                        <th key={st} className="py-2 px-3 text-right">
                          <span className="flex items-center justify-end gap-1">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor: getShopColor(
                                  st,
                                  aggregations.distinctShops,
                                ),
                              }}
                            />
                            {st}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {breakdownData.items.map((item, idx) => {
                      return (
                        <tr
                          key={item.name}
                          className="hover:bg-indigo-50/40 transition-colors font-semibold"
                        >
                          <td className="py-2 px-2.5 text-center text-[10px] font-black text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900 truncate max-w-44">
                            {item.name}
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900">
                            {formatMetricValue(item.totalVal, metric)}
                          </td>
                          <td className="py-2 px-2.5 text-right">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-extrabold text-slate-700">
                              {item.percentOfTotal.toFixed(1)}%
                            </span>
                          </td>
                          {aggregations.distinctShops.map((st) => {
                            const partition = item.shopPartitions.find(
                              (sp) => sp.shop === st,
                            );
                            const val = partition?.val || 0;
                            const pct = partition?.pct || 0;
                            const hasSale = val > 0;

                            return (
                              <td
                                key={st}
                                className={`py-2 px-3 text-right ${
                                  hasSale ? "font-bold text-slate-900" : "text-slate-300 font-normal"
                                }`}
                              >
                                {hasSale ? (
                                  <div className="flex flex-col items-end">
                                    <span>{formatMetricValue(val, metric)}</span>
                                    <span className="text-[9.5px] text-slate-500 font-extrabold">
                                      {pct.toFixed(1)}%
                                    </span>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : categoryDisplayStyle === "grouped" ? (
              /* ======================================================= */
              /* MODE 2: SIDE-BY-SIDE SHOP COMPARISON BARS               */
              /* ======================================================= */
              breakdownData.items.map((item, idx) => {
                const isExpanded = !!expandedCats[item.name];

                return (
                  <div
                    key={item.name}
                    className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-indigo-300 transition-all"
                  >
                    {/* Header: Rank + Name + Total + Share */}
                    <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className="text-xs font-black text-slate-800 truncate"
                          title={item.name}
                        >
                          {item.name}
                        </span>
                        {categoryViewMode === "category" &&
                          item.products &&
                          item.products.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCats((prev) => ({
                                  ...prev,
                                  [item.name]: !prev[item.name],
                                }))
                              }
                              className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-colors cursor-pointer"
                            >
                              {item.products.length} Products
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-black text-slate-900">
                          {formatMetricValue(item.totalVal, metric)}
                        </span>
                        <span className="text-[10px] font-black text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          {item.percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Side-by-Side Shop Bars */}
                    <div className="flex flex-col gap-1.5">
                      {item.shopPartitions
                        .filter((sp) => !hideZeroSales || sp.val > 0)
                        .map((sp) => {
                          const color = getShopColor(
                            sp.shop,
                            aggregations.distinctShops,
                          );
                          const isPinned = pinnedShop === sp.shop;
                          const barWidthPct = Math.max(Number(sp.pct || 0), 2);

                          return (
                            <div
                              key={sp.shop}
                              className={`flex items-center gap-2 text-xs py-0.5 px-1.5 rounded-lg transition-colors ${
                                isPinned ? "bg-indigo-50/80 font-black" : ""
                              }`}
                            >
                              <div className="flex items-center gap-1.5 w-28 shrink-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <span
                                  className="truncate text-[11px] font-bold text-slate-700"
                                  title={sp.shop}
                                >
                                  {sp.shop}
                                </span>
                              </div>

                              {/* Shop Comparison Bar */}
                              <div className="flex-1 bg-slate-100 rounded-md h-3.5 overflow-hidden flex shadow-inner">
                                <div
                                  style={{
                                    width: `${barWidthPct}%`,
                                    backgroundColor: color,
                                  }}
                                  className="h-full rounded-sm transition-all duration-300"
                                />
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 w-24 justify-end">
                                <span className="text-[11px] font-black text-slate-900">
                                  {formatMetricValue(sp.val, metric)}
                                </span>
                                <span className="text-[9.5px] font-extrabold text-slate-500 w-10 text-right">
                                  {Number(sp.pct || 0).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Expandable Top Products Breakdown under this Category */}
                    {categoryViewMode === "category" && isExpanded && item.products && (
                      <div className="mt-2.5 flex flex-col gap-2 pl-3 border-l-2 border-indigo-300 bg-slate-50/70 rounded-lg p-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900">
                          Top Products in {item.name}:
                        </span>
                        {item.products.map((prod) => (
                          <div key={prod.name} className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-center text-[10.5px] font-bold">
                              <span className="truncate max-w-45 text-slate-700">
                                {prod.name}
                              </span>
                              <span className="font-black text-slate-900">
                                {formatMetricValue(prod.totalVal, metric)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200/80 rounded-md h-2.5 overflow-hidden flex shadow-2xs">
                              {prod.shopPartitions.map((psp) => (
                                <div
                                  key={psp.shop}
                                  style={{
                                    width: `${Number(psp.pct || 0)}%`,
                                    backgroundColor: getShopColor(
                                      psp.shop,
                                      aggregations.distinctShops,
                                    ),
                                  }}
                                  className="h-full hover:brightness-125 transition-all"
                                  title={`${prod.name} • ${psp.shop}: ${formatMetricValue(psp.val, metric)} (${Number(psp.pct || 0).toFixed(1)}%)`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              /* ======================================================= */
              /* MODE 1: MODERN SEGMENTED / STACKED BARS                 */
              /* ======================================================= */
              breakdownData.items.map((item, idx) => {
                const isExpanded = !!expandedCats[item.name];
                const relativeBarWidth = Math.max(
                  (item.totalVal / (breakdownData.maxVal || 1)) * 100,
                  10,
                );

                // Active non-zero partitions
                const activePartitions = item.shopPartitions.filter(
                  (sp) => sp.val > 0,
                );

                return (
                  <div
                    key={item.name}
                    className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs hover:border-indigo-300 transition-all"
                  >
                    {/* Item Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className="text-xs font-black text-slate-800 truncate"
                          title={item.name}
                        >
                          {item.name}
                        </span>
                        {categoryViewMode === "category" &&
                          item.products &&
                          item.products.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCats((prev) => ({
                                  ...prev,
                                  [item.name]: !prev[item.name],
                                }))
                              }
                              className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-colors cursor-pointer"
                            >
                              {item.products.length} Products
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-black text-slate-900">
                          {formatMetricValue(item.totalVal, metric)}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {item.percentOfTotal.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Horizontal Multi-Segment Shop Partitioned Progress Bar */}
                    <div className="w-full bg-slate-100 rounded-lg h-4.5 overflow-hidden flex border border-slate-200 shadow-inner">
                      <div
                        style={{ width: `${relativeBarWidth}%` }}
                        className="h-full flex overflow-hidden rounded-md transition-all duration-500"
                      >
                        {item.shopPartitions.map((sp) => {
                          const color = getShopColor(
                            sp.shop,
                            aggregations.distinctShops,
                          );
                          const isPinned = pinnedShop === sp.shop;
                          const isOther = pinnedShop && !isPinned;

                          if (sp.val <= 0) return null;

                          return (
                            <div
                              key={sp.shop}
                              style={{
                                width: `${Number(sp.pct || 0)}%`,
                                backgroundColor: color,
                              }}
                              className={`h-full flex items-center justify-center text-[9px] font-black text-white truncate px-1 transition-all cursor-pointer ${
                                isPinned
                                  ? "brightness-125 ring-1 ring-white"
                                  : isOther
                                    ? "opacity-30 grayscale-30"
                                    : "hover:brightness-125"
                              }`}
                              onMouseEnter={() =>
                                setHoveredShopPartition({
                                  item: item.name,
                                  shop: sp.shop,
                                  val: sp.val,
                                  pct: Number(sp.pct || 0),
                                })
                              }
                              onMouseLeave={() => setHoveredShopPartition(null)}
                              title={`${item.name} • ${sp.shop}: ${formatExactNumber(sp.val, metric)} (${Number(sp.pct || 0).toFixed(1)}%)`}
                            >
                              {Number(sp.pct || 0) >= 15 ? (
                                <span className="drop-shadow-xs truncate select-none">
                                  {Number(sp.pct || 0).toFixed(0)}%
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Clean Contributing Shop Badges (Only Active Stores with Sales > 0) */}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-600 font-bold">
                      {activePartitions.length === 0 ? (
                        <span className="text-slate-400 italic">No sales recorded</span>
                      ) : (
                        activePartitions.map((sp) => {
                          const color = getShopColor(
                            sp.shop,
                            aggregations.distinctShops,
                          );
                          const isPinned = pinnedShop === sp.shop;
                          return (
                            <span
                              key={sp.shop}
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 ${
                                isPinned
                                  ? "font-black text-indigo-950 bg-indigo-50 border-indigo-300"
                                  : ""
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-full inline-block shrink-0"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-slate-700 font-semibold">{sp.shop}:</span>
                              <span className="font-extrabold text-slate-900">
                                {formatMetricValue(sp.val, metric)}
                              </span>
                              <span className="text-slate-500 font-bold text-[9px]">
                                ({Number(sp.pct || 0).toFixed(1)}%)
                              </span>
                            </span>
                          );
                        })
                      )}
                    </div>

                    {/* Expandable Top Products Breakdown under this Category */}
                    {categoryViewMode === "category" && isExpanded && item.products && (
                      <div className="mt-2.5 flex flex-col gap-2 pl-3 border-l-2 border-indigo-300 bg-slate-50/70 rounded-lg p-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900">
                          Top Products in {item.name}:
                        </span>
                        {item.products.map((prod) => (
                          <div key={prod.name} className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-center text-[10.5px] font-bold">
                              <span className="truncate max-w-45 text-slate-700">
                                {prod.name}
                              </span>
                              <span className="font-black text-slate-900">
                                {formatMetricValue(prod.totalVal, metric)}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200/80 rounded-md h-2.5 overflow-hidden flex shadow-2xs">
                              {prod.shopPartitions.map((psp) => (
                                <div
                                  key={psp.shop}
                                  style={{
                                    width: `${Number(psp.pct || 0)}%`,
                                    backgroundColor: getShopColor(
                                      psp.shop,
                                      aggregations.distinctShops,
                                    ),
                                  }}
                                  className="h-full hover:brightness-125 transition-all"
                                  title={`${prod.name} • ${psp.shop}: ${formatMetricValue(psp.val, metric)} (${Number(psp.pct || 0).toFixed(1)}%)`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Hover Detail Callout */}
          {hoveredShopPartition && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl px-3 py-1.5 text-[11px] font-bold flex items-center justify-between mt-2 animate-fade-in shadow-2xs">
              <span className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-600" />
                <span>{hoveredShopPartition.item}</span>
                <span className="text-slate-400">•</span>
                <span className="font-black text-indigo-950">{hoveredShopPartition.shop}</span>
              </span>
              <span className="font-black text-indigo-950 text-xs">
                {formatMetricValue(hoveredShopPartition.val, metric)} (
                {Number(hoveredShopPartition.pct || 0).toFixed(1)}% of category)
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] font-black text-slate-600 border-t border-[#b8ddf8] pt-2 mt-2 px-1">
            <span>Category Breakdown by Shop</span>
            <span className="text-slate-500 font-bold text-[10.5px]">
              {categoryDisplayStyle === "stacked" ? "Segmented Proportion Bar" : categoryDisplayStyle === "grouped" ? "Side-by-Side Comparison" : "Tabular Matrix View"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatShortK(v) {
  if (v >= 10000000) return `${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return Math.round(v);
}
