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
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: () => boolean;
  hasPageAccess: (pageName: string) => boolean;
  hasShopAccess: (shopName: string) => boolean;
  hasCounterAccess: (counter: number) => boolean;
  getAllowedCounters: () => number[];
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ----- Utilities -----

/** Pages parser: handles both array from Supabase and raw strings */
export const parsePages = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  const str = raw.toString().replace(/[{}]/g, "").trim();
  if (!str) return [];
  return str.split(",").map((p: string) => p.trim()).filter((p: string) => p.length > 0);
};

/** Shops parser: handles both array from Supabase and raw strings */
export const parseShops = (raw: any): string[] | 'all' => {
  if (Array.isArray(raw)) {
    if (raw.length === 1 && raw[0].toLowerCase() === 'all') return 'all';
    return raw;
  }
  if (!raw) return 'all';
  const str = raw.toString().trim();
  if (str.toLowerCase() === 'all' || !str) return 'all';
  return str.split(",").map((s: string) => s.trim()).filter((s: string) => s.length > 0);
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
            pages: userData.page_access || ['Dashboard', 'Petty Cash Form', 'Cash Tally - Counter 1', 'Cash Tally - Counter 2', 'Cash Tally - Counter 3', 'Reports'],
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
    setIsSyncing(true);
    console.log(`[AuthContext] Refreshing data for: ${user.username} via Supabase...`);

    try {
      let data: any = null;
      let { data: usersData } = await supabase
        .from('users')
        .select('*')
        .eq('user_name', user.username)
        .maybeSingle();

      if (usersData) {
        data = usersData;
      } else {
        const { data: pcData } = await supabase
          .from('petty_cash_user')
          .select('*')
          .eq('username', user.username)
          .maybeSingle();
        data = pcData;
      }

      if (data) {
        const name = data.user_name || data.name || data.username || "";
        const role = data.role || "User";
        const pages = parsePages(data.pages || data.master_user_system_page_access);
        const shops = parseShops(data.shops || data.shop_name || data.user_access);

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
            prev.name !== name;

          if (hasChanged) {
            console.log("[AuthContext] User permissions updated from Supabase.");
            return {
              ...prev,
              name,
              role,
              pages,
              shops,
              initials
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

  const hasPageAccess = (pageName: string): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;

    // Guard: pages may be undefined if session was saved before the field existed
    if (!Array.isArray(user.pages)) return false;

    const normalize = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const target = normalize(pageName);
    const userPages = user.pages.map(p => normalize(p));

    if (userPages.includes(target)) return true;

    const aliases: Record<string, string[]> = {
      "pettycashform": ["patecashform", "pettycash", "patecash"],
      "cashtallycounter1": ["counter1", "cashtally1"],
      "cashtallycounter2": ["counter2", "cashtally2"],
      "cashtallycounter3": ["counter3", "cashtally3"],
      "dashboard": ["home"],
      "reports": ["report"]
    };

    const targetAliases = aliases[target] || [];
    if (userPages.some(up => targetAliases.includes(up))) return true;

    return false;
  };

  const hasShopAccess = (shopName: string): boolean => {
    if (!user) return false;
    if (isAdmin()) return true;
    if (user.shops === 'all') return true;

    const shopList = Array.isArray(user.shops) ? user.shops : [];
    return shopList.some(
      (s) => s.trim().toLowerCase() === shopName?.trim().toLowerCase()
    );
  };

  const hasCounterAccess = (counter: number): boolean => {
    return hasPageAccess(`Cash Tally - Counter ${counter}`);
  };

  const getAllowedCounters = (): number[] => {
    const counters: number[] = [];
    if (hasCounterAccess(1)) counters.push(1);
    if (hasCounterAccess(2)) counters.push(2);
    if (hasCounterAccess(3)) counters.push(3);
    return counters;
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