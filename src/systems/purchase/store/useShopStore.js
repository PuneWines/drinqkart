import { create } from "zustand";
import { supabase } from "../../../lib/supabase";

const getSavedShop = () => {
  try {
    const saved = localStorage.getItem("globalSelectedShop");
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    // ignore
  }
  return "All";
};

const getSavedShopsList = () => {
  try {
    const raw = localStorage.getItem("globalShopsList");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return [];
};

const getSavedShopsDetails = () => {
  try {
    const raw = localStorage.getItem("globalShopsDetails");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    // ignore
  }
  return [];
};

const useShopStore = create((set, get) => ({
  shops: getSavedShopsList(),
  shopsDetails: getSavedShopsDetails(),
  loading: false,
  selectedShop: getSavedShop(),

  fetchShops: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("shop")
        .select("id, shop_name, full_name, gstin, contact, email, address")
        .order("shop_name", { ascending: true });

      if (!error && data) {
        const shopNames = data.map((s) => s.shop_name).filter(Boolean);
        const saved = getSavedShop();
        const current = get().selectedShop;

        let activeShop = "All";
        if (saved && (saved === "All" || shopNames.includes(saved))) {
          activeShop = saved;
        } else if (
          current &&
          (current === "All" || shopNames.includes(current))
        ) {
          activeShop = current;
        }

        try {
          localStorage.setItem("globalShopsList", JSON.stringify(shopNames));
          localStorage.setItem(
            "globalShopsDetails",
            JSON.stringify(data || []),
          );
          localStorage.setItem("globalSelectedShop", activeShop);
        } catch (e) {
          // ignore
        }

        set({
          shops: shopNames,
          shopsDetails: data || [],
          loading: false,
          selectedShop: activeShop,
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
    return (
      details.find((s) => {
        const sn = String(s.shop_name || "")
          .trim()
          .toUpperCase();
        const fn = String(s.full_name || "")
          .trim()
          .toUpperCase();
        return (
          (sn &&
            (sn === target || target.includes(sn) || sn.includes(target))) ||
          (fn && (fn === target || target.includes(fn) || fn.includes(target)))
        );
      }) || null
    );
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
