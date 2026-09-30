import React from "react";
import { TrendingUp, ChevronDown } from "lucide-react";

/**
 * Common Dashboard Filter & Metric Sidebar
 * Reusable across all tabs (Overview, Sales, and future tabs)
 */
export const DashboardFilterSidebar = ({
  computed = {},
  activeLiquorType = null,
  selectedStore = "All",
  setSelectedStore,
  storeOptions = ["All"],
  selectedLiquorType = "All",
  setSelectedLiquorType,
  liquorTypeOptions = ["All"],
  selectedSubhead = "All",
  setSelectedSubhead,
  subheadOptions = ["All"],
  startDate = "",
  setStartDate,
  endDate = "",
  setEndDate,
  formatIndianDate = (d) => d,
}) => {
  return (
    <aside className="w-full lg:w-[230px] bg-[#2C1D11] border-b lg:border-b-0 lg:border-r border-[#C9A84C]/20 p-3.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 shrink-0 justify-between">
      {/* Brand Header */}
      <div className="bg-[#C9A84C] rounded-xl p-3 px-3.5 flex items-center justify-between shadow-sm">
        <div className="flex flex-col text-left">
          <h1 className="text-base font-black text-[#1c120c] tracking-tight leading-tight">
            DrinqKart
          </h1>
          <span className="text-[9px] font-bold text-[#1c120c]/70 tracking-wider uppercase mt-0.5">
            Sales Dashboard
          </span>
        </div>
        <div className="w-10 h-8 flex items-end justify-center relative pb-0.5 shrink-0">
          <div className="flex items-end gap-1 h-6">
            <div className="w-2 h-2.5 bg-[#1c120c]/40 rounded-t-xs"></div>
            <div className="w-2 h-4 bg-[#1c120c]/60 rounded-t-xs"></div>
            <div className="w-2 h-6 bg-[#1c120c]/80 rounded-t-xs"></div>
          </div>
          <div className="absolute -top-1 -right-0.5 text-[#1c120c]">
            <TrendingUp className="w-4 h-4 stroke-3" />
          </div>
        </div>
      </div>

      {/* Metric Card 0: Total Sell */}
      <div className="bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-xl py-2.5 px-3.5 flex flex-col items-center justify-center text-center transition-all hover:bg-[#C9A84C]/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] leading-tight">
          Total Sell
        </span>
        <span className="text-xl font-black tracking-tight leading-tight mt-0.5 text-white">
          {computed.totalSalesFormatted || "₹ 0"}
        </span>
        {activeLiquorType && (
          <span className="text-[9px] font-bold text-[#C9A84C]/80 mt-0.5 bg-white/5 px-2 py-0.5 rounded-full">
            {activeLiquorType}:{" "}
            {computed.liquorTypeSalesList?.find(
              (l) => l.type === activeLiquorType,
            )?.formatted || "₹ 0"}
          </span>
        )}
      </div>

      {/* Metric Card 1: Total Profit */}
      <div className="bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-xl py-2.5 px-3.5 flex flex-col items-center justify-center text-center transition-all hover:bg-[#C9A84C]/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] leading-tight">
          Total Profit
        </span>
        <span className="text-xl font-black tracking-tight leading-tight mt-0.5 text-white">
          {computed.totalProfitFormatted || "₹ 0"}
        </span>
      </div>

      {/* Metric Card 2: Total Quantity Sold */}
      <div className="bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-xl py-2.5 px-3.5 flex flex-col items-center justify-center text-center transition-all hover:bg-[#C9A84C]/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] leading-tight">
          Total Qty Sold
        </span>
        <span className="text-xl font-black tracking-tight leading-tight mt-0.5 text-white">
          {computed.totalQtyFormatted || "0"}
        </span>
      </div>

      {/* Metric Card 3: Total Cases Sold */}
      <div className="bg-[#C9A84C]/15 border border-[#C9A84C]/30 rounded-xl py-2.5 px-3.5 flex flex-col items-center justify-center text-center transition-all hover:bg-[#C9A84C]/20">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#C9A84C] leading-tight">
          Total Cases Sold
        </span>
        <span className="text-xl font-black tracking-tight leading-tight mt-0.5 text-white">
          {computed.totalCasesFormatted || "0"}
        </span>
      </div>

      {/* Filter 1: Select Store */}
      <div className="bg-white/8 rounded-xl p-2.5 px-3 border border-[#C9A84C]/20 flex flex-col hover:border-[#C9A84C]/50 transition-all">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[10px] font-black text-[#C9A84C] uppercase tracking-wider">
            Select Store
          </label>
          <span className="text-[9px] font-bold text-[#1c120c] bg-[#C9A84C]/80 px-1.5 py-0.5 rounded border border-[#C9A84C]/50">
            Shop
          </span>
        </div>
        <div className="relative bg-[#1c120c]/60 rounded-lg border border-[#C9A84C]/25 hover:border-[#C9A84C]/60 focus-within:border-[#C9A84C] focus-within:ring-1 focus-within:ring-[#C9A84C]/30 transition-all">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore && setSelectedStore(e.target.value)}
            className="w-full bg-transparent py-1.5 pl-2.5 pr-7 text-xs font-bold text-white outline-none cursor-pointer appearance-none"
          >
            {storeOptions.map((st) => (
              <option key={st} value={st} className="bg-[#2C1D11] text-white">
                {st}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#C9A84C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filter 2: Liquor Type */}
      <div className="bg-white/8 rounded-xl p-2.5 px-3 border border-[#C9A84C]/20 flex flex-col hover:border-[#C9A84C]/50 transition-all">
        <label className="text-[10px] font-black text-[#C9A84C] uppercase tracking-wider mb-1.5">
          Liquor Type
        </label>
        <div className="relative bg-[#1c120c]/60 rounded-lg border border-[#C9A84C]/25 hover:border-[#C9A84C]/60 focus-within:border-[#C9A84C] focus-within:ring-1 focus-within:ring-[#C9A84C]/30 transition-all">
          <select
            value={selectedLiquorType}
            onChange={(e) => setSelectedLiquorType && setSelectedLiquorType(e.target.value)}
            className="w-full bg-transparent py-1.5 pl-2.5 pr-7 text-xs font-bold text-white outline-none cursor-pointer appearance-none"
          >
            {liquorTypeOptions.map((lt) => (
              <option key={lt} value={lt} className="bg-[#2C1D11] text-white">
                {lt}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#C9A84C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filter 3: Category / Subhead */}
      <div className="bg-white/8 rounded-xl p-2.5 px-3 border border-[#C9A84C]/20 flex flex-col hover:border-[#C9A84C]/50 transition-all">
        <label className="text-[10px] font-black text-[#C9A84C] uppercase tracking-wider mb-1.5">
          Category / Subhead
        </label>
        <div className="relative bg-[#1c120c]/60 rounded-lg border border-[#C9A84C]/25 hover:border-[#C9A84C]/60 focus-within:border-[#C9A84C] focus-within:ring-1 focus-within:ring-[#C9A84C]/30 transition-all">
          <select
            value={selectedSubhead}
            onChange={(e) => setSelectedSubhead && setSelectedSubhead(e.target.value)}
            className="w-full bg-transparent py-1.5 pl-2.5 pr-7 text-xs font-bold text-white outline-none cursor-pointer appearance-none"
          >
            {subheadOptions.map((sh) => (
              <option key={sh} value={sh} className="bg-[#2C1D11] text-white">
                {sh}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-[#C9A84C] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filter 4 + 5: Date Range with guaranteed Indian DD/MM/YYYY format */}
      <div className="bg-white/8 rounded-xl p-2.5 px-3 border border-[#C9A84C]/20 flex flex-col gap-2 hover:border-[#C9A84C]/50 transition-all">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-[#C9A84C] uppercase tracking-wider">
            Date Range
          </label>
          <span className="text-[8.5px] font-bold text-[#C9A84C]/80">
            DD/MM/YYYY
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="relative bg-[#1c120c]/60 rounded-lg border border-[#C9A84C]/25 hover:border-[#C9A84C]/60 focus-within:border-[#C9A84C] focus-within:ring-1 focus-within:ring-[#C9A84C]/30 transition-all flex items-center h-8 px-2.5">
            <span className="text-[9px] font-black text-[#C9A84C]/70 select-none mr-2">
              FROM
            </span>
            <span className="text-xs font-bold text-white flex-1 select-none">
              {formatIndianDate(startDate)}
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate && setStartDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span className="text-[11px] text-[#C9A84C]/80 pointer-events-none select-none">
              📅
            </span>
          </div>
          <div className="relative bg-[#1c120c]/60 rounded-lg border border-[#C9A84C]/25 hover:border-[#C9A84C]/60 focus-within:border-[#C9A84C] focus-within:ring-1 focus-within:ring-[#C9A84C]/30 transition-all flex items-center h-8 px-2.5">
            <span className="text-[9px] font-black text-[#C9A84C]/70 select-none mr-2">
              TO
            </span>
            <span className="text-xs font-bold text-white flex-1 select-none">
              {formatIndianDate(endDate)}
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate && setEndDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <span className="text-[11px] text-[#C9A84C]/80 pointer-events-none select-none">
              📅
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default DashboardFilterSidebar;
