import React from "react";
import useShopStore from "../systems/purchase/store/useShopStore";
import { useAuth } from "../context/AuthContext";
import { Store } from "lucide-react";

const ShopFilter = ({ isCollapsed = false }) => {
  const { user } = useAuth();
  const { shops, selectedShop, setSelectedShop } = useShopStore();

  const userRole = (user?.role || "").toLowerCase().trim();
  const userName = (user?.user_name || user?.username || "")
    .toLowerCase()
    .trim();
  const isAdmin =
    !userRole || userRole === "admin" || userName === "masteradmin" || userName === "admin";

  const getShopLabel = (shop) => {
    if (shop === "The Liquor Story - Vishal - Hinjewadi") {
      return "The Liquor Story ...";
    }
    return shop;
  };

  const getUnselectedStyle = (shop) => {
    switch (shop) {
      case "FRIENDS":
        return "bg-white border-blue-200 text-blue-800 hover:bg-blue-50/50";
      case "The Liquor Story - Vishal - Hinjewadi":
        return "bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50/50";
      case "MADHURA":
        return "bg-white border-amber-200 text-amber-800 hover:bg-amber-50/50";
      case "KUNAL":
      case "KUNAL ULWE":
      case "KUNAL KHARGHAR":
        return "bg-white border-purple-200 text-purple-800 hover:bg-purple-50/50";
      case "BALAJI":
        return "bg-white border-rose-200 text-rose-800 hover:bg-rose-50/50";
      default:
        return "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
    }
  };

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
                  : getUnselectedStyle(shop)
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
