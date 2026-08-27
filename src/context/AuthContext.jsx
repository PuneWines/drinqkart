import { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Single unified session for Drinqkart Master project. Every logged-in user's
// session is stored under `drinqkart_user` and fanned out into subsystem keys
// (hr_user, vishal_snacks_user, etc.) so legacy subsystem components continue to function.
const STORAGE_KEY = 'drinqkart_user';

export const parseChecklistAllowedPages = (userData) => {
  if (!userData) return [];
  const pageSet = new Set();

  const mapToRouteLabel = (rawName) => {
    if (!rawName || typeof rawName !== 'string') return;
    const name = rawName.trim();
    if (!name) return;

    const lower = name.toLowerCase();
    if (lower === "dashboard") pageSet.add("Dashboard");
    else if (lower === "announcements" || lower === "announcement" || lower === "notifications") pageSet.add("Announcements");
    else if (lower === "quick task" || lower === "quicktask" || lower === "quick_task") pageSet.add("Quick Task");
    else if (lower === "assign task" || lower === "assigntask" || lower === "assign_task") pageSet.add("Assign Task");
    else if (lower === "work records" || lower === "work details" || lower === "workdetails" || lower === "workrecords" || lower === "work_records" || lower === "work_tasks" || lower === "worktasks") {
      pageSet.add("Work Records");
      pageSet.add("Work Details");
    }
    else if (lower === "delegation") pageSet.add("Delegation");
    else if (lower === "task" || lower === "all tasks" || lower === "alltasks" || lower === "tasks" || lower === "all_task") {
      pageSet.add("Task");
      pageSet.add("All Tasks");
    }
    else if (lower === "calendar") pageSet.add("Calendar");
    else if (lower === "holiday list" || lower === "holidaylist" || lower === "holiday" || lower === "holiday_list") {
      pageSet.add("Holiday List");
      pageSet.add("Holiday");
      pageSet.add("Working Day Calendar");
    }
    else if (lower === "working day calendar" || lower === "workingdaycalendar" || lower === "working_day_calendar") {
      pageSet.add("Working Day Calendar");
      pageSet.add("Holiday List");
      pageSet.add("Holiday");
    }
    else if (lower === "admin approval" || lower === "adminapproval" || lower === "manager approval" || lower === "admin_approval") pageSet.add("Admin Approval");
    else if (lower === "mis report" || lower === "misreport" || lower === "mis_report" || lower === "mis_reporting") pageSet.add("MIS Report");
    else if (lower === "settings" || lower === "setting" || lower === "master setting" || lower === "master_setting" || lower === "mastersettings") pageSet.add("Settings");
    else pageSet.add(name);
  };

  const processEntry = (entry) => {
    if (typeof entry !== 'string') return;
    const trimmed = entry.trim();
    if (trimmed.startsWith('checklist_delegation.')) {
      const parts = trimmed.split('.');
      if (parts.length >= 2 && parts[1]) {
        mapToRouteLabel(parts[1]);
      }
    } else if (trimmed.startsWith('checklist.')) {
      const parts = trimmed.split('.');
      if (parts.length >= 2 && parts[1]) {
        mapToRouteLabel(parts[1]);
      }
    } else {
      mapToRouteLabel(trimmed);
    }
  };

  let rawMasterAccess = userData.master_user_system_page_access;
  if (typeof rawMasterAccess === 'string') {
    try {
      let parsed = JSON.parse(rawMasterAccess);
      while (typeof parsed === 'string') parsed = JSON.parse(parsed);
      rawMasterAccess = parsed;
    } catch (e) { }
  }

  if (Array.isArray(rawMasterAccess) && rawMasterAccess.length > 0) {
    rawMasterAccess.forEach(processEntry);
  } else if (rawMasterAccess && typeof rawMasterAccess === 'object' && Object.keys(rawMasterAccess).length > 0) {
    Object.keys(rawMasterAccess).forEach(processEntry);
  }

  if (pageSet.size === 0) {
    let rawPageAccess = userData.page_access;
    if (typeof rawPageAccess === 'string') {
      try {
        let parsed = JSON.parse(rawPageAccess);
        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
        rawPageAccess = parsed;
      } catch (e) { }
    }
    if (Array.isArray(rawPageAccess)) {
      rawPageAccess.forEach(processEntry);
    }
  }

  return Array.from(pageSet);
};

const syncSubsystemSessions = (userObj) => {
  if (!userObj) return;
  const accessValue = userObj.user_access || userObj.shop_name || userObj.shop || "";
  localStorage.setItem('user-name', userObj.user_name || userObj.username || "");
  localStorage.setItem('user-id', userObj.id || "");
  localStorage.setItem('role', userObj.role || "");
  localStorage.setItem('email_id', userObj.email_id || userObj.email || "");
  localStorage.setItem('user_access', accessValue);
  localStorage.setItem('shop_name', userObj.shop_name || userObj.shop || "");
  localStorage.setItem('profile_image', userObj.profile_image || "");
  localStorage.setItem('can_self_assign', userObj.can_self_assign === true ? "true" : "false");
  localStorage.setItem('designation', userObj.designation || userObj.Designation || "");

  const allowedPages = parseChecklistAllowedPages(userObj);
  localStorage.setItem('page_access', JSON.stringify(allowedPages));
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
    username: userObj.user_name || userObj.username || "",
    name: userObj.user_name || userObj.username || "User",
    role: userObj.role || "user",
    master_user_system_page_access: userObj.master_user_system_page_access,
    counter_access: userObj.counter_access || [],
    counterAccess: userObj.counter_access || [],
    pages: userObj.page_access || (userObj.master_user_system_page_access ? [] : ['Dashboard', 'Petty Cash Form', 'Cash Tally - Counter 1', 'Cash Tally - Counter 2', 'Cash Tally - Counter 3', 'Reports']),
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

  const refreshUser = async () => {
    if (user?.id) {
      try {
        const { data } = await supabase
          .from('users')
          .select('master_user_system_page_access, shop_name, user_access, counter_access, role, user_name, email_id')
          .eq('id', user.id)
          .maybeSingle();
        if (data) {
          const updatedUser = {
            ...user,
            ...data,
            master_user_system_page_access: data.master_user_system_page_access,
            shop_name: data.shop_name,
            user_access: data.user_access,
            counter_access: data.counter_access
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
          localStorage.setItem('master_user_system_page_access', typeof data.master_user_system_page_access === 'string' ? data.master_user_system_page_access : JSON.stringify(data.master_user_system_page_access));
          syncSubsystemSessions(updatedUser);
          setUser(updatedUser);
          return updatedUser;
        }
      } catch (e) {
        console.error("Session master access sync error:", e);
      }
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const tryChecklistLogin = async (trimmedInput, password) => {
    const cleanDigits = trimmedInput.replace(/\D/g, "");

    // 1. Resolve user_name or email_id by matching entered mobile number against 'number' column
    let loginHandle = trimmedInput;
    try {
      const filterCond = cleanDigits
        ? `number.eq.${trimmedInput},number.eq.${cleanDigits}`
        : `number.eq.${trimmedInput}`;

      const { data: matchedUsers } = await supabase
        .from('users')
        .select('user_name, email_id, number, status')
        .or(filterCond)
        .limit(1);

      if (matchedUsers && matchedUsers.length > 0) {
        const foundUser = matchedUsers[0];
        const currentStatus = (foundUser.status || 'active').toLowerCase().trim();
        if (currentStatus !== 'active') {
          return { success: false, isInactive: true };
        }
        loginHandle = foundUser.user_name || foundUser.email_id || trimmedInput;
      }
    } catch (err) {
      console.error("Error matching mobile number in users table:", err);
    }

    // 2. Pass resolved user handle to secure_login RPC for bcrypt password verification
    const { data: rpcData, error: rpcError } = await supabase.rpc('secure_login', {
      input_username: loginHandle,
      input_password: password
    });

    if (!rpcError && rpcData && (Array.isArray(rpcData) ? rpcData.length > 0 : rpcData)) {
      let userObj = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      
      const userStatus = (userObj.status || 'active').toLowerCase().trim();
      if (userStatus !== 'active') {
        return { success: false, isInactive: true };
      }

      // Fetch latest master_user_system_page_access, counter_access & status directly from users table
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('master_user_system_page_access, status, counter_access')
          .eq('id', userObj.id)
          .maybeSingle();

        if (dbUser) {
          const latestStatus = (dbUser.status || 'active').toLowerCase().trim();
          if (latestStatus !== 'active') {
            return { success: false, isInactive: true };
          }
          if (dbUser.master_user_system_page_access) {
            userObj.master_user_system_page_access = dbUser.master_user_system_page_access;
          }
          if (dbUser.counter_access) {
            userObj.counter_access = dbUser.counter_access;
          }
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
      } else if (selectedRole === 'HOD') {
        isRoleValid = userRole === 'hod';
      } else if (selectedRole === 'manager') {
        isRoleValid = userRole === 'manager';
      } else if (selectedRole === 'user') {
        isRoleValid = !isMaster && userRole !== 'admin' && userRole !== 'manager' && userRole !== 'hod';
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
      return { success: false, message: 'Account Inactive: Your user account is set to inactive. Access denied. Please contact admin.' };
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
        } else if (selectedRole === 'HOD') {
          isRoleValid = userRole === 'hod';
        } else if (selectedRole === 'manager') {
          isRoleValid = userRole === 'manager';
        } else if (selectedRole === 'user') {
          isRoleValid = !isMaster && userRole !== 'admin' && userRole !== 'manager' && userRole !== 'hod';
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
      } else if (fallbackChecklistRes && fallbackChecklistRes.isInactive) {
        return { success: false, message: 'Account Inactive: Your user account is set to inactive. Access denied. Please contact admin.' };
      }
    }

    return { success: false, message: 'Invalid mobile number or password' };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    clearSubsystemSessions();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
