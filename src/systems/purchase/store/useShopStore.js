import { create } from "zustand";
import { supabase } from "../../../lib/supabase";

const getInitialShop = (shops = []) => {
  try {
    const saved = localStorage.getItem("globalSelectedShop");
    if (saved && (saved === "All" || shops.includes(saved))) {
      return saved;
    }
  } catch (e) {
    // ignore
  }
  return "All";
};

const useShopStore = create((set, get) => ({
  shops: [],
  shopsDetails: [],
  loading: false,
  selectedShop: "All",
  fetchShops: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('shop')
        .select('id, shop_name, full_name, gstin, contact, email, address')
        .order('shop_name', { ascending: true });

      if (!error && data) {
        const shopNames = data.map(s => s.shop_name).filter(Boolean);
        const currentSelected = get().selectedShop;
        const initial = getInitialShop(shopNames);
        set({
          shops: shopNames,
          shopsDetails: data || [],
          loading: false,
          selectedShop: shopNames.includes(currentSelected) || currentSelected === "All" ? currentSelected : initial
        });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      console.error("Failed to fetch shops from global shop table:", e);
      set({ loading: false });
    }
  },
  getShopRecord: (shopName) => {
    if (!shopName || shopName === "All") return null;
    const details = get().shopsDetails || [];
    const target = String(shopName).trim().toUpperCase();
    return details.find(s => {
      const sn = String(s.shop_name || "").trim().toUpperCase();
      const fn = String(s.full_name || "").trim().toUpperCase();
      return (sn && (sn === target || target.includes(sn) || sn.includes(target))) ||
             (fn && (fn === target || target.includes(fn) || fn.includes(target)));
    }) || null;
  },
  getShopFullName: (shopName) => {
    const rec = get().getShopRecord(shopName);
    return rec?.full_name || shopName;
  },
  setSelectedShop: (shop) => {
    try {
      localStorage.setItem("globalSelectedShop", shop);
    } catch (e) {
      // ignore
    }
    set({ selectedShop: shop });
  },
}));

// Trigger initial load
useShopStore.getState().fetchShops();

export default useShopStore;
