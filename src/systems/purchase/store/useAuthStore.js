import { create } from "zustand";
import { supabase } from "../lib/supabase";

const getInitialUser = () => {
  try {
    const storedUser = localStorage.getItem('currentUser') || localStorage.getItem('drinqkart_user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (e) {
    return null;
  }
};

// Purchase system page permissions key mapping
export const PURCHASE_PERM_MAP = {
  dashboard: "purchase.Dashboard.modify",
  indent: "purchase.Indent.modify",
  approval: "purchase.Approval.modify",
  po: "purchase.PO.modify",
  po_history: "purchase.PO History.modify",
  orders_pipeline: "purchase.Orders Pipeline.modify",
  trader_verification: "purchase.Trader.modify",
  transporter_verification: "purchase.Transporter.modify",
  receiving: "purchase.Receiving.modify",
  setting: "purchase.Settings.modify",
};

export const parsePurchasePermissionsFromAccess = (masterAccess) => {
  let list = masterAccess || [];
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch (e) { list = []; }
  }
  if (!Array.isArray(list)) list = Object.keys(list || {});

  const permKeys = [];
  Object.entries(PURCHASE_PERM_MAP).forEach(([key, val]) => {
    if (list.includes(val) || list.includes(val.replace('.modify', '.view'))) {
      permKeys.push(key);
    }
  });
  return permKeys;
};

export const buildMasterAccessFromPurchasePerms = (existingAccess, selectedPurchasePerms) => {
  let existingList = existingAccess || [];
  if (typeof existingList === "string") {
    try { existingList = JSON.parse(existingList); } catch (e) { existingList = []; }
  }
  if (!Array.isArray(existingList)) existingList = Object.keys(existingList || {});

  // Filter out any existing purchase.* permissions
  const nonPurchasePerms = existingList.filter((p) => typeof p === "string" && !p.startsWith("purchase."));

  // Build new purchase permissions
  const newPurchasePerms = (selectedPurchasePerms || []).map((k) => PURCHASE_PERM_MAP[k]).filter(Boolean);

  return [...nonPurchasePerms, ...newPurchasePerms];
};

const useAuthStore = create((set, get) => ({
  currentUser: getInitialUser(),
  users: [],
  loading: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .or(`user_name.eq.${username},username.eq.${username}`)
        .eq('password', password)
        .single();

      if (error || !data) {
        set({ loading: false });
        return { success: false, error: 'Invalid username or password' };
      }

      if (data.status && data.status.toLowerCase().trim() !== 'active') {
        set({ loading: false });
        return { success: false, error: 'Account Inactive: Your user account is set to inactive. Access denied. Please contact admin.' };
      }

      localStorage.setItem('currentUser', JSON.stringify(data));
      set({ currentUser: data, loading: false });
      return { success: true };
    } catch (err) {
      set({ loading: false });
      return { success: false, error: 'Login failed. Please try again.' };
    }
  },

  logout: () => {
    localStorage.removeItem('currentUser');
    set({ currentUser: null });
  },

  fetchUsers: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('user_name', { ascending: true });

    if (!error && data) {
      const mapped = data.map(u => ({
        ...u,
        username: u.user_name || u.username,
        email: u.email_id || u.email || "",
        permissions: parsePurchasePermissionsFromAccess(u.master_user_system_page_access)
      }));
      set({ users: mapped, loading: false });
    } else {
      set({ loading: false });
    }
  },

  updateUser: async (userId, updatedData) => {
    const { users } = get();
    const existingUser = users.find(u => u.id === userId);
    const masterAccess = buildMasterAccessFromPurchasePerms(
      existingUser?.master_user_system_page_access,
      updatedData.permissions || []
    );

    const payload = {
      user_name: updatedData.username,
      password: updatedData.password,
      role: updatedData.role,
      email_id: updatedData.email || null,
      master_user_system_page_access: masterAccess
    };

    const { error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', userId);

    if (!error) {
      const updatedUser = {
        ...existingUser,
        ...payload,
        username: updatedData.username,
        email: updatedData.email,
        permissions: updatedData.permissions || []
      };
      set({
        users: users.map((u) => (u.id === userId ? updatedUser : u)),
      });
      return { success: true };
    }
    return { success: false, error: error.message };
  },

  createUser: async (userData) => {
    const masterAccess = buildMasterAccessFromPurchasePerms([], userData.permissions || []);
    const payload = {
      user_name: userData.username,
      password: userData.password,
      role: userData.role || 'user',
      email_id: userData.email || null,
      status: 'active',
      master_user_system_page_access: masterAccess
    };

    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select()
      .single();

    if (!error && data) {
      const newUser = {
        ...data,
        username: data.user_name || data.username,
        email: data.email_id || data.email || "",
        permissions: parsePurchasePermissionsFromAccess(data.master_user_system_page_access)
      };
      const { users } = get();
      set({ users: [...users, newUser] });
      return { success: true, data: newUser };
    }
    return { success: false, error: error?.message || 'Error creating user' };
  },

  deleteUser: async (userId) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (!error) {
      const { users } = get();
      set({ users: users.filter((u) => u.id !== userId) });
      return { success: true };
    }
    return { success: false, error: error.message };
  },

  hasPermission: (permission) => {
    const { currentUser } = get();
    return currentUser?.permissions?.includes(permission) || false;
  },

  initSession: () => {
    const storedUser = localStorage.getItem('currentUser') || localStorage.getItem('drinqkart_user');
    if (storedUser) {
      set({ currentUser: JSON.parse(storedUser) });
    }
  }
}));

export default useAuthStore;