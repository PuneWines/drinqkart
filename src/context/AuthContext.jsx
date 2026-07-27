import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Single unified session for Drinqkart Master project. Every logged-in user's
// session is stored under `drinqkart_user` and fanned out into subsystem keys
// (hr_user, vishal_snacks_user, etc.) so legacy subsystem components continue to function.
const STORAGE_KEY = 'drinqkart_user';

const syncSubsystemSessions = (userObj) => {
  if (!userObj) return;
  // 1. Checklist Delegation Keys
  localStorage.setItem('user-name', userObj.user_name || userObj.username || "");
  localStorage.setItem('user-id', userObj.id || "");
  localStorage.setItem('role', userObj.role || "");
  localStorage.setItem('email_id', userObj.email_id || userObj.email || "");
  localStorage.setItem('user_access', userObj.user_access || "");
  localStorage.setItem('profile_image', userObj.profile_image || "");
  localStorage.setItem('can_self_assign', userObj.can_self_assign === true ? "true" : "false");
  localStorage.setItem('designation', userObj.designation || userObj.Designation || "");
  localStorage.setItem('page_access', typeof userObj.page_access === 'string' ? userObj.page_access : JSON.stringify(userObj.page_access || []));
  const masterAccessVal = userObj.master_user_system_page_access;
  localStorage.setItem('master_user_system_page_access', typeof masterAccessVal === 'string' ? masterAccessVal : JSON.stringify(masterAccessVal || []));

  // 2. HR System Key (hr_user)
  localStorage.setItem('hr_user', JSON.stringify(userObj));

  // 3. Inventory key (vishal_snacks_user)
  const mappedInventoryUser = {
    id: userObj.id,
    username: userObj.user_name || userObj.username,
    role: userObj.role?.toLowerCase() === 'admin' ? 'admin' : 'operator',
    shop_id: userObj.shop_id || null,
    shop_name: userObj.shop_name || userObj.user_access || null,
    is_approved: true,
    page_access: userObj.page_access || (userObj.role?.toLowerCase() === 'admin' ? [
      'entry_dashboard', 'entry_purchases', 'entry_closing', 'entry_cashtally',
      'ledger_table', 'ledger_reports', 'ledger_purchases', 'ledger_sales',
      'ledger_closing', 'manager_report', 'master_items', 'master_vendors', 'users_management'
    ] : ['entry_dashboard', 'entry_purchases', 'entry_closing', 'entry_cashtally']),
    created_at: userObj.created_at || new Date().toISOString()
  };
  localStorage.setItem('vishal_snacks_user', JSON.stringify(mappedInventoryUser));

  // 4. Petty Cash Keys
  localStorage.setItem('currentUser', JSON.stringify({
    username: userObj.username || "",
    name: userObj.user_name || userObj.username || "User",
    role: userObj.role || "user",
    pages: userObj.page_access || ['Dashboard', 'Petty Cash Form', 'Cash Tally - Counter 1', 'Cash Tally - Counter 2', 'Cash Tally - Counter 3', 'Reports'],
    shops: userObj.shop_name || userObj.user_access ? [userObj.shop_name || userObj.user_access] : 'all',
    initials: (userObj.user_name || userObj.username || "U").substring(0, 2).toUpperCase(),
    loginTime: new Date().toISOString()
  }));
  localStorage.setItem('currentUserName', userObj.user_name || userObj.username || "User");
  localStorage.setItem('currentUserRole', userObj.role || "user");
};

const clearSubsystemSessions = () => {
  localStorage.removeItem('user-name');
  localStorage.removeItem('user-id');
  localStorage.removeItem('role');
  localStorage.removeItem('email_id');
  localStorage.removeItem('user_access');
  localStorage.removeItem('profile_image');
  localStorage.removeItem('can_self_assign');
  localStorage.removeItem('designation');
  localStorage.removeItem('page_access');
  localStorage.removeItem('master_user_system_page_access');
  localStorage.removeItem('hr_user');
  localStorage.removeItem('vishal_snacks_user');
  localStorage.removeItem('vishal_snacks_page');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('currentUserName');
  localStorage.removeItem('currentUserRole');
  localStorage.removeItem('userSession');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Auth initialization error:", e);
      return null;
    }
  });

  useEffect(() => {
    if (user?.id) {
      supabase
        .from('users')
        .select('master_user_system_page_access')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.master_user_system_page_access) {
            const updatedUser = { ...user, master_user_system_page_access: data.master_user_system_page_access };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
            localStorage.setItem('master_user_system_page_access', typeof data.master_user_system_page_access === 'string' ? data.master_user_system_page_access : JSON.stringify(data.master_user_system_page_access));
            setUser(updatedUser);
          }
        })
        .catch((e) => console.error("Session master access sync error:", e));
    }
  }, []);

  const tryChecklistLogin = async (trimmedInput, password) => {
    const { data: rpcData, error: rpcError } = await supabase.rpc('secure_login', {
      input_username: trimmedInput,
      input_password: password
    });

    if (!rpcError && rpcData && (Array.isArray(rpcData) ? rpcData.length > 0 : rpcData)) {
      let userObj = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (userObj.status === 'inactive') {
        return { success: false, isInactive: true };
      }

      // Fetch latest master_user_system_page_access directly from users table
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('master_user_system_page_access')
          .eq('id', userObj.id)
          .single();

        if (dbUser && dbUser.master_user_system_page_access) {
          userObj.master_user_system_page_access = dbUser.master_user_system_page_access;
        }
      } catch (e) {
        console.error("Master access fetch error:", e);
      }

      return { success: true, user: userObj };
    }
    return { success: false };
  };

  const login = async (identifier, password, selectedRole = 'user') => {
    const trimmedInput = identifier.trim();

    const checklistRes = await tryChecklistLogin(trimmedInput, password);
    if (checklistRes.success) {
      const userObj = { ...checklistRes.user, system: 'checklist' };
      const userRole = (userObj.role || 'user').toLowerCase().trim();
      const isMaster = (userObj.user_name || userObj.username || '').toLowerCase().trim() === 'masteradmin';

      // Strict role matching check
      let isRoleValid = false;
      if (selectedRole === 'admin') {
        isRoleValid = isMaster || userRole === 'admin';
      } else if (selectedRole === 'manager') {
        isRoleValid = userRole === 'manager';
      } else if (selectedRole === 'user') {
        isRoleValid = !isMaster && userRole !== 'admin' && userRole !== 'manager';
      }

      if (!isRoleValid) {
        return {
          success: false,
          message: `Access Denied: Your account role (${userObj.role || 'user'}) cannot log in as ${selectedRole.toUpperCase()}. Please select ${userRole.toUpperCase()} option.`
        };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
      syncSubsystemSessions(userObj);
      setUser(userObj);
      return { success: true, redirect: '/dashboard/admin' };
    } else if (checklistRes.isInactive) {
      return { success: false, message: 'Your account is inactive. Please contact admin.' };
    }

    if (!trimmedInput.includes('@')) {
      const fallbackChecklistRes = await tryChecklistLogin(`${trimmedInput}@gmail.com`, password);
      if (fallbackChecklistRes.success) {
        const userObj = { ...fallbackChecklistRes.user, system: 'checklist' };
        const userRole = (userObj.role || 'user').toLowerCase().trim();
        const isMaster = (userObj.user_name || userObj.username || '').toLowerCase().trim() === 'masteradmin';

        let isRoleValid = false;
        if (selectedRole === 'admin') {
          isRoleValid = isMaster || userRole === 'admin';
        } else if (selectedRole === 'manager') {
          isRoleValid = userRole === 'manager';
        } else if (selectedRole === 'user') {
          isRoleValid = !isMaster && userRole !== 'admin' && userRole !== 'manager';
        }

        if (!isRoleValid) {
          return {
            success: false,
            message: `Access Denied: Your account role (${userObj.role || 'user'}) cannot log in as ${selectedRole.toUpperCase()}. Please select ${userRole.toUpperCase()} option.`
          };
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
        syncSubsystemSessions(userObj);
        setUser(userObj);
        return { success: true, redirect: '/dashboard/admin' };
      }
    }

    return { success: false, message: 'Invalid username/email or password.' };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    clearSubsystemSessions();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
