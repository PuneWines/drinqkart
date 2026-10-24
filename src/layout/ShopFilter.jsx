import React from "react";
import useShopStore from "../systems/purchase/store/useShopStore";
import { useAuth } from "../context/AuthContext";
import { Store } from "lucide-react";

const PALETTES = [
  "bg-white border-blue-200 text-blue-800 hover:bg-blue-50/50",
  "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50/50",
  "bg-white border-amber-200 text-amber-800 hover:bg-amber-50/50",
  "bg-white border-purple-200 text-purple-800 hover:bg-purple-50/50",
  "bg-white border-rose-200 text-rose-800 hover:bg-rose-50/50",
  "bg-white border-indigo-200 text-indigo-800 hover:bg-indigo-50/50",
  "bg-white border-teal-200 text-teal-800 hover:bg-teal-50/50",
  "bg-white border-cyan-200 text-cyan-800 hover:bg-cyan-50/50",
];

const getShopLabel = (shop) => {
  if (!shop) return "";
  const name = typeof shop === "string" ? shop : String(shop);
  if (name.length > 22) {
    return `${name.slice(0, 19)}...`;
  }
  return name;
};

const getUnselectedStyle = (shop, shopsDetails = []) => {
  if (!shop) return "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
  const str = String(shop).trim();
  const detail = shopsDetails?.find(
    (s) => (s.shop_name || s.name || "").trim().toLowerCase() === str.toLowerCase()
  );
  if (detail?.badge_color && typeof detail.badge_color === "string" && detail.badge_color.includes("border-")) {
    return detail.badge_color;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return PALETTES[Math.abs(hash) % PALETTES.length];
};

const ShopFilter = ({ isCollapsed = false }) => {
  const { user } = useAuth();
  const { shops, shopsDetails, selectedShop, setSelectedShop } = useShopStore();

  const userRole = (user?.role || "").toLowerCase().trim();
  const userName = (user?.user_name || user?.username || "")
    .toLowerCase()
    .trim();
  const isAdmin =
    !userRole ||
    userRole === "admin" ||
    userRole === "superadmin" ||
    userRole === "hod" ||
    userName === "masteradmin" ||
    userName === "admin";

  // 1. If not admin and no assigned shop, hide filter
  if (!isAdmin && (!shops || shops.length === 0)) {
    return null;
  }

  // 2. If not admin and exactly 1 assigned shop, show locked assigned store indicator
  if (!isAdmin && shops.length === 1) {
    const singleShop = shops[0];
    if (isCollapsed) {
      return (
        <div className="p-2 border-b border-[#C9A84C]/20 flex justify-center">
          <div
            title={`Assigned Store: ${singleShop}`}
            className="p-2 rounded-lg bg-blue-50 text-blue-700 relative flex items-center justify-center cursor-default"
          >
            <Store size={18} />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white" />
          </div>
        </div>
      );
    }

    return (
      <div className="p-3 border-b border-[#C9A84C]/20 bg-slate-50/50">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            ASSIGNED STORE
          </span>
        </div>
        <div className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white border border-blue-200 text-blue-800 flex items-center justify-between shadow-2xs">
          <span className="truncate">{singleShop}</span>
          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 ml-1.5" title="Active Shop" />
        </div>
      </div>
    );
  }

  // 3. Multi-shop mode (Admin or Manager/User with multiple assigned shops)
  if (isCollapsed) {
    return (
      <div className="p-2 border-b border-[#C9A84C]/20 flex justify-center">
        <button
          type="button"
          title={`Shop Filter: ${selectedShop}`}
          onClick={() => {
            const allOptionList = isAdmin ? ["All", ...shops] : [...shops];
            const currentIndex = allOptionList.indexOf(selectedShop);
            const nextShop =
              allOptionList[(currentIndex + 1) % allOptionList.length];
            setSelectedShop(nextShop);
          }}
          className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer relative"
        >
          <Store size={18} />
          {selectedShop !== "All" && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 border-b border-[#C9A84C]/20 bg-slate-50/50">
      <div className="flex items-center gap-1.5 mb-2">
        <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {isAdmin ? "SHOP FILTER" : "ASSIGNED STORES"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {/* All Shops button (Admin only) */}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setSelectedShop("All")}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer text-center truncate border ${
              selectedShop === "All"
                ? "bg-[#2563eb] border-[#2563eb] text-white font-bold shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            All Shops
          </button>
        )}

        {/* Dynamic Shop Buttons */}
        {shops.map((shop) => {
          const isSelected = selectedShop === shop;
          return (
            <button
              key={shop}
              type="button"
              onClick={() => setSelectedShop(shop)}
              title={shop}
              className={`px-2.5 py-1.5 rounded-2xl  text-xs font-semibold transition-all duration-150 cursor-pointer text-center truncate border ${
                isSelected
                  ? "bg-[#2563eb] border-[#2563eb] text-white font-bold shadow-xs "
                  : getUnselectedStyle(shop, shopsDetails)
              }`}
            >
              {getShopLabel(shop)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ShopFilter;
