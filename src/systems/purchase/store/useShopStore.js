import { create } from "zustand";
import { supabase } from "../../../lib/supabase";

export const getEffectiveUserShops = () => {
  let user = null;
  try {
    const raw =
      localStorage.getItem("drinqkart_user") ||
      localStorage.getItem("currentUser") ||
      localStorage.getItem("user");
    if (raw) user = JSON.parse(raw);
  } catch (e) {}

  const role = (
    user?.role ||
    localStorage.getItem("role") ||
    localStorage.getItem("currentUserRole") ||
    ""
  )
    .toLowerCase()
    .trim();
  const userName = (
    user?.user_name ||
    user?.username ||
    localStorage.getItem("user-name") ||
    localStorage.getItem("currentUserName") ||
    ""
  )
    .toLowerCase()
    .trim();

  // Superadmin holds supreme global store authority across all shops.
  const isGlobalSuperadmin =
    role === "superadmin" ||
    role === "masteradmin";

  if (isGlobalSuperadmin) {
    return { isAdmin: true, isGlobal: true, assignedShops: [] };
  }

  const rawSources = [
    user?.shop_name,
    user?.user_access,
    user?.shops,
    localStorage.getItem("shop_name"),
    localStorage.getItem("user_access"),
  ];

  const assigned = [];
  rawSources.forEach((raw) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach((s) => {
        if (
          typeof s === "string" &&
          s.trim() &&
          s.trim().toLowerCase() !== "all" &&
          s.trim().toLowerCase() !== "n/a"
        ) {
          assigned.push(s.trim());
        }
      });
    } else if (typeof raw === "string") {
      raw.split(",").forEach((s) => {
        const trimmed = s.trim();
        if (
          trimmed &&
          trimmed.toLowerCase() !== "all" &&
          trimmed.toLowerCase() !== "n/a"
        ) {
          assigned.push(trimmed);
        }
      });
    }
  });

  return { isAdmin: false, assignedShops: [...new Set(assigned)] };
};

const getSavedShop = () => {
  const { isAdmin, assignedShops } = getEffectiveUserShops();
  if (!isAdmin && assignedShops.length > 0) {
    try {
      const saved = localStorage.getItem("globalSelectedShop");
      if (
        saved &&
        saved.trim() &&
        assignedShops.some(
          (s) => s.toLowerCase() === saved.trim().toLowerCase(),
        )
      ) {
        return saved.trim();
      }
    } catch (e) {}
    return assignedShops[0];
  }

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
  const { isAdmin, assignedShops } = getEffectiveUserShops();
  if (!isAdmin && assignedShops.length > 0) {
    return assignedShops;
  }
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

const initialInfo = getEffectiveUserShops();

const useShopStore = create((set, get) => ({
  shops: getSavedShopsList(),
  allShops: [],
  shopsDetails: getSavedShopsDetails(),
  loading: false,
  selectedShop: getSavedShop(),
  assignedShops: initialInfo.assignedShops,
  isShopAdmin: initialInfo.isAdmin,

  fetchShops: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from("shop")
        .select("id, shop_name, full_name, gstin, contact, email, address")
        .order("shop_name", { ascending: true });

      if (!error && data) {
        const shopNames = data.map((s) => s.shop_name).filter(Boolean);
        const { isAdmin, assignedShops } = getEffectiveUserShops();

        let visibleShops = shopNames;
        if (!isAdmin && assignedShops.length > 0) {
          visibleShops = shopNames.filter((sn) =>
            assignedShops.some(
              (as) =>
                as.toLowerCase() === sn.toLowerCase() ||
                as.toLowerCase().includes(sn.toLowerCase()) ||
                sn.toLowerCase().includes(as.toLowerCase()),
            ),
          );
          if (visibleShops.length === 0) {
            visibleShops = assignedShops;
          }
        }

        const saved = getSavedShop();
        const current = get().selectedShop;

        let activeShop = "All";
        if (!isAdmin && visibleShops.length > 0) {
          if (
            saved &&
            saved !== "All" &&
            visibleShops.some((s) => s.toLowerCase() === saved.toLowerCase())
          ) {
            activeShop = saved;
          } else if (
            current &&
            current !== "All" &&
            visibleShops.some((s) => s.toLowerCase() === current.toLowerCase())
          ) {
            activeShop = current;
          } else {
            activeShop = visibleShops[0];
          }
        } else {
          if (saved && (saved === "All" || shopNames.includes(saved))) {
            activeShop = saved;
          } else if (
            current &&
            (current === "All" || shopNames.includes(current))
          ) {
            activeShop = current;
          }
        }

        try {
          localStorage.setItem("globalShopsList", JSON.stringify(visibleShops));
          localStorage.setItem(
            "globalShopsDetails",
            JSON.stringify(data || []),
          );
          localStorage.setItem("globalSelectedShop", activeShop);
        } catch (e) {
          // ignore
        }

        set({
          shops: visibleShops,
          allShops: shopNames,
          shopsDetails: data || [],
          loading: false,
          selectedShop: activeShop,
          assignedShops: !isAdmin ? visibleShops : [],
          isShopAdmin: isAdmin,
        });
      } else {
        if (error) {
          console.warn("[useShopStore] Could not refresh shops from DB, retaining cached shops:", error.message || error);
        }
        set({ loading: false });
      }
    } catch (e) {
      console.warn("[useShopStore] Network/API unreachable for shop fetch, using cached shops:", e?.message || e);
      set({ loading: false });
    }
  },

  syncUserShops: () => {
    const info = getEffectiveUserShops();
    const currentSelected = get().selectedShop;
    let nextShop = currentSelected;
    let nextVisible = get().allShops.length > 0 ? get().allShops : get().shops;

    if (!info.isAdmin && info.assignedShops.length > 0) {
      if (get().allShops.length > 0) {
        nextVisible = get().allShops.filter((sn) =>
          info.assignedShops.some(
            (as) =>
              as.toLowerCase() === sn.toLowerCase() ||
              as.toLowerCase().includes(sn.toLowerCase()) ||
              sn.toLowerCase().includes(as.toLowerCase()),
          ),
        );
        if (nextVisible.length === 0) nextVisible = info.assignedShops;
      } else {
        nextVisible = info.assignedShops;
      }

      const match = nextVisible.find(
        (s) => s.toLowerCase() === (currentSelected || "").toLowerCase(),
      );
      nextShop = match || nextVisible[0];
    }

    try {
      localStorage.setItem("globalSelectedShop", nextShop);
    } catch (e) {}

    set({
      assignedShops: !info.isAdmin ? nextVisible : [],
      isShopAdmin: info.isAdmin,
      shops: nextVisible,
      selectedShop: nextShop,
    });
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
    const { isAdmin, assignedShops } = getEffectiveUserShops();
    let targetShop = shop;
    if (!isAdmin && assignedShops.length > 0) {
      const allowed = assignedShops.some(
        (as) => as.toLowerCase() === (shop || "").toLowerCase(),
      );
      if (!allowed) {
        targetShop = assignedShops[0];
      }
    }
    try {
      localStorage.setItem("globalSelectedShop", targetShop);
    } catch (e) {
      // ignore
    }
    set({ selectedShop: targetShop });
  },
}));

// Trigger initial load
useShopStore.getState().fetchShops();

export default useShopStore;
