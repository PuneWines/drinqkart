// src/contexts/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../supabase';

// ----- Types -----

export interface User {
  username: string;
  name: string;
  role: string;
  pages: string[];
  shops: string[] | 'all';
  initials: string;
  loginTime: string;
  counterAccess?: string[];
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: () => boolean;
  hasPageAccess: (pageName: string) => boolean;
  hasPageModifyAccess: (pageName: string) => boolean;
  hasShopAccess: (shopName: string) => boolean;
  hasCounterAccess: (counter: string | number) => boolean;
  getAllowedCounters: () => string[];
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ----- Utilities & Constants -----

const PAGE_ALIASES: Record<string, string[]> = {
  "bankaudit": ["bankaudit", "bank audit", "bank-audit"],
  "bank audit": ["bankaudit", "bank audit", "bank-audit"],
  "pettycashform": ["patecashform", "pettycash", "patecash", "formentry", "pettycashformentry"],
  "pettycashformentry": ["patecashform", "pettycash", "patecash", "formentry", "pettycashform"],
  "cashtallycounter1": ["counter1", "cashtally1"],
  "cashtallycounter2": ["counter2", "cashtally2"],
  "cashtallycounter3": ["counter3", "cashtally3"],
  "counterinformation": ["counter1", "cashtally1", "counter2", "cashtally2", "counter3", "cashtally3", "counterinformation", "cashtallycounter1", "cashtallycounter2", "cashtallycounter3"],
  "cashtallycounter": ["counter1", "cashtally1", "counter2", "cashtally2", "counter3", "cashtally3", "counterinformation", "cashtallycounter1", "cashtallycounter2", "cashtallycounter3", "cashtallycounter"],
  "dashboard": ["home"],
  "reports": ["report", "financialreports"],
  "financialreports": ["reports", "report"]
};

/** Pages parser: handles both array from Supabase and raw strings */
export const parsePages = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  const str = raw.toString().replace(/[{}]/g, "").trim();
  if (!str) return [];
  return str.split(",").map((p: string) => p.trim()).filter((p: string) => p.length > 0);
};

/** Shops parser: handles arrays, Postgres braces {}, comma-separated strings, and 'all' */
export const parseShops = (raw: any): string[] | 'all' => {
  if (!raw) return 'all';

  let strArr: string[] = [];
  if (Array.isArray(raw)) {
    strArr = raw.map(v => String(v));
  } else {
    strArr = [String(raw)];
  }

  const items = strArr
    .flatMap(item => item.replace(/[{}]/g, "").split(","))
    .map(s => s.trim())
    .filter(Boolean);

  if (items.length === 0 || items.some(i => i.toLowerCase() === 'all')) {
    return 'all';
  }

  return items;
};

export const parseCounterAccess = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw.map(v => String(v).trim());
  if (!raw) return [];
  const str = raw.toString().replace(/[{}]/g, "").trim();
  if (!str) return [];
  return str.split(",").map((p: string) => p.trim()).filter((p: string) => p.length > 0);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      // 1. Intercept SSO auth parameters if present
      const params = new URLSearchParams(window.location.search);
      const authData = params.get('auth');
      if (authData) {
        const userData = JSON.parse(decodeURIComponent(authData));
        if (userData) {
          const mappedUser: User = {
            username: userData.user_name || userData.username || userData.name || "User",
            name: userData.user_name || userData.username || userData.name || "User",
            role: userData.role || "user",
            pages: userData.page_access || (userData.master_user_system_page_access ? [] : ['Dashboard', 'Petty Cash Form', 'Cash Tally - Counter 1', 'Cash Tally - Counter 2', 'Cash Tally - Counter 3', 'Reports']),
            shops: userData.shop_name || userData.user_access ? [userData.shop_name || userData.user_access] : 'all',
            initials: (userData.user_name || userData.username || "U").substring(0, 2).toUpperCase(),
            loginTime: new Date().toISOString()
          };
          localStorage.setItem('currentUser', JSON.stringify(mappedUser));
          localStorage.setItem('currentUserName', mappedUser.name);
          localStorage.setItem('currentUserRole', mappedUser.role);

          // Clear query params to keep URL clean
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          return mappedUser;
        }
      }
    } catch (e) {
      console.error('[AuthContext] Failed to parse SSO auth details:', e);
    }

    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as User;
        // Validate required fields – discard stale sessions missing pages
        if (!Array.isArray(parsed.pages)) {
          console.warn('[AuthContext] Stale session missing pages, clearing.');
          localStorage.removeItem('currentUser');
          return null;
        }
        return parsed;
      } catch (err) {
        console.error('[AuthContext] Failed to parse saved session:', err);
        localStorage.removeItem('currentUser');
        return null;
      }
    }
    return null;
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Initial Sync Logic: Fetch latest permissions on mount if logged in
  useEffect(() => {
    if (user && !isSyncing) {
      refreshUserData();
    }
  }, []); // Run once on mount

  useEffect(() => {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('currentUserName', user.name);
      localStorage.setItem('currentUserRole', user.role);
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('currentUserName');
      localStorage.removeItem('currentUserRole');
      localStorage.removeItem('userSession');
    }
  }, [user]);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
  };

  const isAdmin = (): boolean => {
    const roleLower = (user?.role || '').toLowerCase();
    const nameLower = (user?.username || user?.name || '').toLowerCase();
    return roleLower === 'admin' || roleLower === 'masteradmin' || nameLower === 'masteradmin';
  };

  /** 
   * Fetches latest user data from the users table (or petty_cash_user fallback) to sync permissions.
   */
  const refreshUserData = async () => {
    if (!user) return;
    const searchName = user.username || user.name;
    if (!searchName) return;
    setIsSyncing(true);
    console.log(`[AuthContext] Refreshing data for: ${searchName} via Supabase...`);

    try {
      let data: any = null;
      let { data: usersData } = await supabase
        .from('users')
        .select('*')
        .or(`user_name.eq."${searchName}",username.eq."${searchName}"`)
        .maybeSingle();

      if (usersData) {
        data = usersData;
      } else {
        const { data: pcData } = await supabase
          .from('petty_cash_user')
          .select('*')
          .eq('username', searchName)
          .maybeSingle();
        data = pcData;
      }

      if (data) {
        const name = data.user_name || data.name || data.username || "";
        const role = data.role || "User";
        const pages = parsePages(data.pages || data.master_user_system_page_access);
        const shops = parseShops(data.shops || data.shop_name || data.user_access);
        const counterAccess = parseCounterAccess(data.counter_access);

        const initials = name
          .split(' ')
          .map((n: string) => n[0] || '')
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'U';

        setUserState(prev => {
          if (!prev) return null;
          const hasChanged =
            prev.role !== role ||
            JSON.stringify(prev.pages) !== JSON.stringify(pages) ||
            JSON.stringify(prev.shops) !== JSON.stringify(shops) ||
            JSON.stringify(prev.counterAccess) !== JSON.stringify(counterAccess) ||
            prev.name !== name;

          if (hasChanged) {
            console.log("[AuthContext] User permissions updated from Supabase.");
            return {
              ...prev,
              name,
              role,
              pages,
              shops,
              initials,
              counterAccess
            };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("[AuthContext] Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    console.log(`[AuthContext] Supabase login attempt for: "${inputUser}"`);

    try {
      let data: any = null;
      let { data: usersData, error } = await supabase
        .from('users')
        .select('*')
        .or(`user_name.ilike.${inputUser},username.ilike.${inputUser}`)
        .maybeSingle();

      if (!usersData) {
        const pcRes = await supabase
          .from('petty_cash_user')
          .select('*')
          .eq('username', inputUser)
          .maybeSingle();
        data = pcRes.data;
        if (pcRes.error) error = pcRes.error;
      } else {
        data = usersData;
      }

      if (error && !data) {
        console.error("[AuthContext] Supabase login query error:", error);
        return { success: false, error: "Authentication service unavailable." };
      }

      if (!data) {
        console.warn(`[AuthContext] Login FAILED: No user found matching "${inputUser}"`);
        return { success: false, error: "Invalid User ID or password." };
      }

      if (data.password === inputPass) {
        const name = data.user_name || data.name || data.username || "";
        const role = data.role || "User";
        const pages = parsePages(data.pages || data.master_user_system_page_access);
        const shops = parseShops(data.shops || data.shop_name || data.user_access);
        const counterAccess = parseCounterAccess(data.counter_access);

        const initials = name
          .split(' ')
          .map((n: string) => n[0] || '')
          .join('')
          .toUpperCase()
          .slice(0, 2) || 'U';

        const userData: User = {
          username: inputUser,
          name,
          role,
          pages,
          shops,
          initials,
          loginTime: new Date().toISOString(),
          counterAccess,
        };

        setUserState(userData);
        console.log(`[AuthContext] Supabase Login SUCCESS for: ${name}`);
        return { success: true };
      }

      console.warn(`[AuthContext] Login FAILED: Password mismatch for "${inputUser}"`);
      return { success: false, error: "Invalid User ID or password." };
    } catch (err) {
      console.error("[AuthContext] Login Error:", err);
      return { success: false, error: "Connection error. Please try again." };
    }
  };

  const logout = () => {
    setUserState(null);
  };

  const getMasterPermissions = (): string[] => {
    try {
      const currentUserStr = localStorage.getItem("currentUser");
      if (currentUserStr) {
        const u = JSON.parse(currentUserStr);
        const rawAccess = u && (u.master_user_system_page_access || u.pages);
        if (rawAccess) {
          if (Array.isArray(rawAccess)) {
            return rawAccess.map(v => String(v));
          }
          if (typeof rawAccess === "string") {
            try {
              const parsed = JSON.parse(rawAccess);
              if (Array.isArray(parsed)) return parsed.map(v => String(v));
            } catch (e) { }
          }
        }
      }
    } catch (e) { }

    try {
      const raw = localStorage.getItem("master_user_system_page_access");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map(v => String(v));
        }
      }
    } catch (e) { }

    try {
      const hrUserStr = localStorage.getItem("hr_user");
      if (hrUserStr) {
        const hr = JSON.parse(hrUserStr);
        const rawAccess = hr && hr.master_user_system_page_access;
        if (rawAccess) {
          if (Array.isArray(rawAccess)) {
            return rawAccess.map(v => String(v));
          }
          if (typeof rawAccess === "string") {
            return JSON.parse(rawAccess);
          }
        }
      }
    } catch (e) { }

    if (user && Array.isArray(user.pages)) {
      return user.pages;
    }
    return [];
  };

  const hasPageAccess = (pageName: string): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;

    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const target = normalize(pageName);

    // Enforcement: Reports / Financial Reports only visible to admin & manager
    if (target === "reports" || target === "financialreports") {
      const roleLower = (user.role || '').toLowerCase().trim();
      if (roleLower !== "admin" && roleLower !== "manager" && roleLower !== "masteradmin") {
        return false;
      }
    }

    const masterPermissions = getMasterPermissions();

    // Parse permission keys if they are structured like "system.page.access"
    const userPages = masterPermissions.map(p => {
      const parts = p.split('.');
      if (parts.length >= 2) {
        return normalize(parts[1]);
      }
      return normalize(p);
    });

    if (userPages.includes(target)) return true;

    const targetAliases = PAGE_ALIASES[target] || [];
    if (userPages.some(up => targetAliases.includes(up))) return true;

    return false;
  };

  const hasPageModifyAccess = (pageName: string): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;

    const masterPermissions = getMasterPermissions();
    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const target = normalize(pageName);

    // If masterPermissions exist, check for explicit .modify / (Modify) permission
    if (masterPermissions.length > 0) {
      const hasDottedModify = masterPermissions.some(p => {
        const parts = p.split('.');
        if (parts.length >= 3) {
          const pgName = parts[1];
          const action = parts[2];
          const normPgName = normalize(pgName);
          const matchesTarget = normPgName === target || (PAGE_ALIASES[target] && PAGE_ALIASES[target].includes(normPgName));
          return matchesTarget && action.toLowerCase() === 'modify';
        }
        const pNorm = normalize(p);
        const matchesTarget = pNorm.includes(target) || (PAGE_ALIASES[target] && PAGE_ALIASES[target].some(alias => pNorm.includes(alias)));
        return matchesTarget && (pNorm.includes('modify') || pNorm.includes('edit'));
      });
      return hasDottedModify;
    }

    // Legacy fallback for systems where masterPermissions are not configured
    const roleLower = (user.role || '').toLowerCase().trim();
    return roleLower === 'admin' || roleLower === 'manager' || roleLower === 'masteradmin';
  };

  const hasShopAccess = (shopName: string): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;
    if (!user.shops || user.shops === 'all') return true;

    const rawList = Array.isArray(user.shops) ? user.shops : [user.shops];
    const shopList = rawList
      .flatMap(item => String(item).replace(/[{}]/g, "").split(","))
      .map(s => s.trim())
      .filter(Boolean);

    if (shopList.length === 0 || shopList.some(s => s.toLowerCase() === 'all')) {
      return true;
    }

    const normShop = shopName?.trim().toLowerCase();
    return shopList.some(
      (s) => s.toLowerCase() === normShop
    );
  };

  const hasCounterAccess = (counter: string | number): boolean => {
    if (isAdmin()) return true;
    if (!user) return false;
    const cStr = String(counter).trim().toUpperCase();

    let userCounters: string[] = [];
    if (Array.isArray(user.counterAccess)) {
      userCounters = user.counterAccess;
    }

    if (userCounters.length === 0) {
      try {
        const userStr = localStorage.getItem("currentUser");
        const hrUserStr = localStorage.getItem("hr_user");
        let rawAccess = null;

        if (userStr) {
          const u = JSON.parse(userStr);
          rawAccess = u && (u.counter_access || u.counterAccess);
        }
        if (!rawAccess && hrUserStr) {
          const hr = JSON.parse(hrUserStr);
          rawAccess = hr && (hr.counter_access || hr.counterAccess);
        }

        if (rawAccess) {
          if (Array.isArray(rawAccess)) {
            userCounters = rawAccess.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          } else if (typeof rawAccess === "string") {
            userCounters = rawAccess.split(",").map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          }
        }
      } catch (e) {
        console.error("[AuthContext] Error parsing counter access fallback:", e);
      }
    }

    if (userCounters.length === 0 || userCounters.some(c => String(c).trim().toLowerCase() === 'all')) {
      return true;
    }

    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const target = normalize(cStr);

    return userCounters.map(c => normalize(c)).includes(target);
  };

  const getAllowedCounters = (): string[] => {
    const defaultAll = ["COUNTER-1", "COUNTER-2", "COUNTER-3", "COUNTER-4"];
    if (isAdmin()) {
      return defaultAll;
    }

    let userCounters: string[] = [];
    if (user && Array.isArray(user.counterAccess)) {
      userCounters = user.counterAccess;
    }

    if (userCounters.length === 0) {
      try {
        const userStr = localStorage.getItem("currentUser");
        const hrUserStr = localStorage.getItem("hr_user");
        let rawAccess = null;

        if (userStr) {
          const u = JSON.parse(userStr);
          rawAccess = u && (u.counter_access || u.counterAccess);
        }
        if (!rawAccess && hrUserStr) {
          const hr = JSON.parse(hrUserStr);
          rawAccess = hr && (hr.counter_access || hr.counterAccess);
        }

        if (rawAccess) {
          if (Array.isArray(rawAccess)) {
            userCounters = rawAccess.map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          } else if (typeof rawAccess === "string") {
            userCounters = rawAccess.split(",").map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          }
        }
      } catch (e) { }
    }

    if (userCounters.length === 0 || userCounters.some(c => String(c).trim().toLowerCase() === 'all')) {
      return defaultAll;
    }

    const counters: string[] = [];
    userCounters.forEach(c => {
      const normalizedVal = String(c).trim().toUpperCase();
      if (normalizedVal && !counters.includes(normalizedVal)) {
        counters.push(normalizedVal);
      }
    });

    return counters.length > 0 ? counters : defaultAll;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin,
        hasPageAccess,
        hasPageModifyAccess,
        hasShopAccess,
        hasCounterAccess,
        getAllowedCounters,
        refreshUserData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};