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
  loading: false,
  selectedShop: "All",
  fetchShops: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('shop')
        .select('shop_name')
        .order('shop_name', { ascending: true });

      if (!error && data) {
        const shopNames = data.map(s => s.shop_name).filter(Boolean);
        const currentSelected = get().selectedShop;
        const initial = getInitialShop(shopNames);
        set({
          shops: shopNames,
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
