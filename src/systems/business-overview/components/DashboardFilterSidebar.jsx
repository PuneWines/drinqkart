import React from "react";
import { TrendingUp, ChevronDown, Calendar } from "lucide-react";

/**
 * Common Dashboard Filter & Metric Sidebar
 * Reusable across all tabs (Overview, Sales, Group Wise, Brand Wise)
 * Styled with the executive light-blue and purple gradient UI theme
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
    <aside className="w-full lg:w-72 xl:w-76 bg-[#e2f1fc] border-b lg:border-b-0 lg:border-r-2 border-[#b8ddf8] p-3.5 sm:p-4 flex flex-col gap-2.5 shrink-0 self-stretch justify-between">
      {/* Brand Header */}
      <div className="bg-[#edf6fe] rounded-2xl p-3 sm:p-3.5 border-2 border-[#badbf4] flex flex-col items-center justify-center text-center shadow-xs">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1.5">
          DrinqKart
        </h1>
        <div className="w-20 h-14 flex items-end justify-center relative pb-1">
          <div className="flex items-end gap-1.5 h-10">
            <div className="w-3.5 h-5 bg-[#38bdf8] rounded-t-xs"></div>
            <div className="w-3.5 h-8 bg-[#2563eb] rounded-t-xs"></div>
            <div className="w-3.5 h-10 bg-[#fbbf24] rounded-t-xs"></div>
          </div>
          <div className="absolute top-0 right-0 text-[#15803d]">
            <TrendingUp className="w-7 h-7 stroke-3" />
          </div>
        </div>
      </div>

      {/* Metric Card 1: Total Profit */}
      <div className="bg-linear-to-r from-[#6b6bf7] to-[#7f58e8] rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-indigo-200/50 flex flex-col items-center justify-center text-center transition-all hover:scale-[1.01]">
        <span className="text-xs font-black uppercase tracking-wider text-indigo-100">
          Total Profit
        </span>
        <span className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
          {computed.totalProfitFormatted || "₹ 0"}
        </span>
      </div>

      {/* Metric Card 2: Total Quantity Sold */}
      <div className="bg-linear-to-r from-[#6b6bf7] to-[#7f58e8] rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-indigo-200/50 flex flex-col items-center justify-center text-center transition-all hover:scale-[1.01]">
        <span className="text-xs font-black uppercase tracking-wider text-indigo-100">
          Total Quantity Sold
        </span>
        <span className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
          {computed.totalQtyFormatted || "0"}
        </span>
      </div>

      {/* Metric Card 3: Total Case Sold */}
      <div className="bg-linear-to-r from-[#6b6bf7] to-[#7f58e8] rounded-2xl p-3 sm:p-3.5 text-white shadow-md shadow-indigo-200/50 flex flex-col items-center justify-center text-center transition-all hover:scale-[1.01]">
        <span className="text-xs font-black uppercase tracking-wider text-indigo-100">
          Total Case Sold
        </span>
        <span className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">
          {computed.totalCasesFormatted || "0"}
        </span>
      </div>

      {/* Filter 1: Select Store */}
      <div className="bg-[#edf6fe] rounded-2xl p-3 border-2 border-[#badbf4] flex flex-col shadow-xs hover:border-indigo-400 transition-all">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
            Select Store
          </label>
          <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-md border border-indigo-200/50">
            Shop Filter
          </span>
        </div>
        <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore && setSelectedStore(e.target.value)}
            className="w-full bg-transparent py-2 pl-3 pr-7 text-xs font-bold text-slate-800 outline-none cursor-pointer appearance-none"
          >
            {storeOptions.map((st) => (
              <option
                key={st}
                value={st}
                className="py-2 px-3 my-1 bg-white text-slate-800 font-semibold text-xs"
              >
                {st}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-indigo-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filter 2: Liquor Type */}
      <div className="bg-[#edf6fe] rounded-2xl p-3 border-2 border-[#badbf4] flex flex-col shadow-xs hover:border-indigo-400 transition-all">
        <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
          Liquor Type
        </label>
        <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all">
          <select
            value={selectedLiquorType}
            onChange={(e) => setSelectedLiquorType && setSelectedLiquorType(e.target.value)}
            className="w-full bg-transparent py-2 pl-3 pr-7 text-xs font-bold text-slate-800 outline-none cursor-pointer appearance-none"
          >
            {liquorTypeOptions.map((lt) => (
              <option
                key={lt}
                value={lt}
                className="py-2 px-3 my-1 bg-white text-slate-800 font-semibold text-xs"
              >
                {lt}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-indigo-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filter 3: Category / Subhead */}
      <div className="bg-[#edf6fe] rounded-2xl p-3 border-2 border-[#badbf4] flex flex-col shadow-xs hover:border-indigo-400 transition-all">
        <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
          Category / Subhead
        </label>
        <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all">
          <select
            value={selectedSubhead}
            onChange={(e) => setSelectedSubhead && setSelectedSubhead(e.target.value)}
            className="w-full bg-transparent py-2 pl-3 pr-7 text-xs font-bold text-slate-800 outline-none cursor-pointer appearance-none"
          >
            {subheadOptions.map((sh) => (
              <option
                key={sh}
                value={sh}
                className="py-2 px-3 my-1 bg-white text-slate-800 font-semibold text-xs"
              >
                {sh}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-indigo-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Filter 4: Start Date */}
      <div className="bg-[#edf6fe] rounded-2xl p-3 border-2 border-[#badbf4] flex flex-col shadow-xs hover:border-indigo-400 transition-all">
        <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
          Start Date
        </label>
        <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all flex items-center justify-between">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate && setStartDate(e.target.value)}
            className="w-full bg-transparent py-2 pl-3 pr-6 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          />
          <Calendar className="w-3.5 h-3.5 text-indigo-600 absolute right-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Filter 5: End Date */}
      <div className="bg-[#edf6fe] rounded-2xl p-3 border-2 border-[#badbf4] flex flex-col shadow-xs hover:border-indigo-400 transition-all">
        <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
          End Date
        </label>
        <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all flex items-center justify-between">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate && setEndDate(e.target.value)}
            className="w-full bg-transparent py-2 pl-3 pr-6 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          />
          <Calendar className="w-3.5 h-3.5 text-indigo-600 absolute right-2.5 pointer-events-none" />
        </div>
      </div>
    </aside>
  );
};

export default DashboardFilterSidebar;
