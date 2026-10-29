import React from 'react';
import { Eye, Lock } from 'lucide-react';

/**
 * Universal Permission Engine for Drinqkart
 * Parses `master_user_system_page_access` and provides precise
 * `none`, `view`, and `modify` states across all enterprise subsystems.
 */

// Safely extract and normalize access permission strings
export const parseAccessStrings = (raw) => {
  if (!raw) return [];
  let current = raw;
  
  // Recursively unroll double-serialized JSON strings
  while (typeof current === 'string') {
    const trimmed = current.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed === current) break;
        current = parsed;
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  if (Array.isArray(current)) {
    return current
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  if (current && typeof current === 'object') {
    return Object.keys(current)
      .filter(k => current[k] === true || current[k] === 'true' || current[k] === 'modify' || current[k] === 'view')
      .map(k => k.trim());
  }

  if (typeof current === 'string' && current.trim().length > 0) {
    if (current.includes(',')) {
      return current.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [current.trim()];
  }

  return [];
};

// Normalize text for fuzzy matching (alphanumeric only, lowercase)
export const normalizePermKey = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
};

// Read active user safely from localStorage fallback
export const getUserFromStorage = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('drinqkart_user') || localStorage.getItem('currentUser');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

export const isUserSuperadmin = (user = null) => {
  const userObj = user || getUserFromStorage() || {};
  const storedRole = (typeof localStorage !== 'undefined' ? localStorage.getItem('role') || localStorage.getItem('currentUserRole') || '' : '').toLowerCase().trim();
  const userRole = (userObj.role || '').toLowerCase().trim();

  return (
    userRole === 'superadmin' ||
    userRole === 'masteradmin' ||
    storedRole === 'superadmin' ||
    storedRole === 'masteradmin'
  );
};

export const isUserShopScoped = (user = null) => {
  return !isUserSuperadmin(user);
};

// Retrieve assigned shops for a user
export const getUserAssignedShops = (user) => {
  const userObj = user || getUserFromStorage() || {};

  // Superadmin and HOD have global authority across all enterprise shops
  if (isUserSuperadmin(userObj)) {
    return [];
  }

  const rawSources = [
    userObj.user_access,
    userObj.shop_name,
    userObj.assigned_shops,
    userObj.shops,
    userObj.shop,
    typeof localStorage !== 'undefined' ? localStorage.getItem('user_access') : null,
    typeof localStorage !== 'undefined' ? localStorage.getItem('assigned_shops') : null,
    typeof localStorage !== 'undefined' ? localStorage.getItem('shop_name') : null,
    typeof localStorage !== 'undefined' ? localStorage.getItem('shop') : null,
  ];

  const shopsSet = new Set();
  let hasAll = false;

  const addShop = (val) => {
    if (!val || typeof val !== 'string') return;
    const trimmed = val.trim();
    if (!trimmed || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'no shop') return;
    if (trimmed.toLowerCase() === 'all' || trimmed.toLowerCase() === 'admin') {
      hasAll = true;
      return;
    }
    shopsSet.add(trimmed);
  };

  rawSources.forEach((raw) => {
    if (!raw) return;
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (typeof item === 'string') {
          if (item.includes(',')) {
            item.split(',').forEach(addShop);
          } else {
            addShop(item);
          }
        }
      });
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            parsed.forEach((p) => {
              if (typeof p === 'string') {
                if (p.includes(',')) p.split(',').forEach(addShop);
                else addShop(p);
              }
            });
            return;
          }
        } catch {}
      }
      trimmed.split(',').forEach(addShop);
    }
  });

  if (hasAll) {
    return [];
  }

  return Array.from(shopsSet);
};

// Known alias mappings for pages across subsystems
export const PAGE_ALIASES = {
  // Purchase
  'indent': ['indent'],
  'po': ['po', 'purchaseorder', 'purchaseorders'],
  'approval': ['approval', 'adminapproval', 'admin_approval', 'admin approval', 'approvals'],
  'orderspipeline': ['orderspipeline', 'orderpipeline', 'pipeline'],
  'pohistory': ['pohistory', 'history'],
  'trader': ['trader', 'traderverification'],
  'transporter': ['transporter', 'transporterverification'],
  'receiving': ['receiving'],
  'settings': ['settings', 'setting'],

  // Inventory
  'purchaseformentry': ['purchaseformentry', 'purchaseentry', 'purchase'],
  'closingstockformentry': ['closingstockformentry', 'closingstockentry', 'closingstock', 'closing'],
  'cashtallyformentry': ['cashtallyformentry', 'cashtallyentry', 'cashtally', 'saleamount'],
  'formentry': ['formentry', 'forms', 'entry'],
  'stockledger': ['stockledger', 'tableview', 'reportscharts', 'ledger'],

  // HR
  'joiningshop': ['joiningshop', 'joiningcompany', 'shop', 'shops'],
  'employees': ['employees', 'employee'],
  'dashboard': ['dashboard'],
  'dailyattendance': ['dailyattendance', 'attendance', 'daily'],
  'payroll': ['payroll'],
  'leavemanagement': ['leavemanagement', 'leave'],
  'roster': ['roster', 'roaster'],
  'employeelearning': ['employeelearning', 'learning'],

  // Petty Cash
  'pettycashform': ['pettycashform', 'formentry', 'pettycash', 'form'],
  'cashtallycounter': ['cashtallycounter', 'cashtally', 'counter', 'counter1', 'counter2', 'counter3'],
  'financialreports': ['financialreports', 'reports'],
  'bankaudit': ['bankaudit', 'audit'],

  // Checklist
  'task': ['task', 'alltasks', 'tasks', 'all_task', 'all task'],
  'alltasks': ['task', 'alltasks', 'tasks', 'all_task', 'all task'],
  'assigntask': ['assigntask', 'checklisttask', 'assign_task', 'assign task', 'maintenancetask', 'repairtask', 'eatask'],
  'quicktask': ['quicktask', 'quick_task', 'quick task'],
  'workrecords': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'workdetails': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'scheduledworktasks': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'scheduled': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'adminapproval': ['adminapproval', 'approval', 'stage3', 'admin_approval', 'admin approval', 'managerapproval', 'manager approval'],
  'usersmanagement': ['usersmanagement', 'users'],
  'mastersetting': ['mastersetting', 'userandsystemaccess'],

  // Business Overview
  'documentmanager': ['documentmanager', 'document_manager', 'document manager', 'documents', 'docmanager']
};



/**
 * Checks if the user is authorized to delete purchase indents/items.
 * Allowed roles: masteradmin, superadmin, admin, hod.
 * Disallowed roles: manager, user, or others.
 */
export const canDeletePurchaseIndent = (user) => {
  const userObj = user || getUserFromStorage() || {};
  const role = (
    userObj.role ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('role') || localStorage.getItem('currentUserRole')
      : '') ||
    ''
  ).toLowerCase().trim();

  // Explicitly deny manager and standard users
  if (role === 'manager' || role === 'user') {
    return false;
  }

  return (
    role === 'masteradmin' ||
    role === 'superadmin' ||
    role === 'admin' ||
    role === 'hod'
  );
};

// Centralized system key matching (handles hyphen, underscore, and alias variations)
export const isSystemMatch = (sysA, sysB) => {
  if (!sysA || !sysB) return false;
  const a = normalizePermKey(sysA);
  const b = normalizePermKey(sysB);
  if (a === b) return true;
  if ((a === 'checklist' || a === 'checklistdelegation') && (b === 'checklist' || b === 'checklistdelegation')) return true;
  if ((a === 'saleanalytics' || a === 'salesanalytics') && (b === 'saleanalytics' || b === 'salesanalytics')) return true;
  if ((a === 'stockreport' || a === 'stockbalance') && (b === 'stockreport' || b === 'stockbalance')) return true;
  if ((a === 'mastersetting' || a === 'settings') && (b === 'mastersetting' || b === 'settings')) return true;
  if ((a === 'pettycash' || a === 'pettycashform') && (b === 'pettycash' || b === 'pettycashform')) return true;
  if ((a === 'businessoverview' || a === 'business') && (b === 'businessoverview' || b === 'business')) return true;
  return false;
};

/**
 * Check if a user has access to a specific subsystem
 * 
 * @param {Object} user 
 * @param {string} systemId 
 * @returns {boolean}
 */
export const hasSystemAccess = (user, systemId) => {
  if (isUserSuperadmin(user)) return true;

  const userObj = user || getUserFromStorage() || {};
  const userRole = (userObj.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') || localStorage.getItem('currentUserRole') : '') || '').toLowerCase().trim();

  const rawMaster = userObj.master_user_system_page_access;
  const storedMaster = typeof localStorage !== 'undefined' ? localStorage.getItem('master_user_system_page_access') : null;

  // Determine if master_user_system_page_access is explicitly defined on the user object or storage
  const isMasterConfigured = (rawMaster !== undefined && rawMaster !== null) || (storedMaster !== undefined && storedMaster !== null);

  const masterAccessList = [
    ...parseAccessStrings(rawMaster),
    ...parseAccessStrings(storedMaster),
  ];

  // If no custom masterAccessList configured at all (legacy account):
  if (!isMasterConfigured || (masterAccessList.length === 0 && rawMaster === null)) {
    if (userRole === 'admin' || userRole === 'hod') return true;
    if (systemId === 'checklist') return true;
    const legacyPages = [
      ...parseAccessStrings(userObj.page_access),
      ...parseAccessStrings(userObj.pages),
      ...(typeof localStorage !== 'undefined' ? parseAccessStrings(localStorage.getItem('page_access')) : []),
    ].map(normalizePermKey);
    const normSys = normalizePermKey(systemId);
    return legacyPages.some(item => isSystemMatch(item, normSys));
  }

  // When masterAccessList IS configured:
  // User must have at least one valid granted page or blanket system entry for this system
  return masterAccessList.some((rawPerm) => {
    if (typeof rawPerm !== 'string') return false;
    const parts = rawPerm.split('.');
    if (parts.length >= 1) {
      return isSystemMatch(parts[0], systemId);
    }
    return false;
  });
};

/**
 * Universal Permission Evaluator
 * 
 * @param {Object} user - User profile object (falls back to localStorage)
 * @param {string} systemId - System key e.g. 'purchase', 'inventory', 'hr', 'petty-cash', 'checklist'
 * @param {string} pageName - Page or subtab title e.g. 'Indent', 'Purchase Form Entry', 'Joining shop'
 * @returns {{ canView: boolean, canModify: boolean, state: 'modify' | 'view' | 'none', isRestricted: boolean, assignedShops: string[] }}
 */
export const getPagePermission = (user, systemId, pageName) => {
  const userObj = user || getUserFromStorage() || {};
  const userRole = (userObj.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') || localStorage.getItem('currentUserRole') : '') || '').toLowerCase().trim();
  const assignedShops = getUserAssignedShops(userObj);

  // Supreme Global Authority check
  if (isUserSuperadmin(userObj)) {
    return {
      canView: true,
      canModify: true,
      state: 'modify',
      isRestricted: false,
      assignedShops: []
    };
  }

  const normPage = normalizePermKey(pageName);
  const pageAliases = PAGE_ALIASES[normPage] || [normPage];

  // Collect configured master access permissions
  const masterAccessList = [
    ...parseAccessStrings(userObj.master_user_system_page_access),
    ...(typeof localStorage !== 'undefined' ? parseAccessStrings(localStorage.getItem('master_user_system_page_access')) : []),
  ];

  const normSystem = normalizePermKey(systemId);

  // If user has NO master_user_system_page_access list configured at all (legacy account)
  if (masterAccessList.length === 0) {
    // Legacy fallback based on role
    if (userRole === 'hod' || userRole === 'admin') {
      return {
        canView: true,
        canModify: true,
        state: 'modify',
        isRestricted: false,
        assignedShops
      };
    }

    // Normal user legacy fallback
    const legacyPages = [
      ...parseAccessStrings(userObj.page_access),
      ...parseAccessStrings(userObj.pages),
      ...(typeof localStorage !== 'undefined' ? parseAccessStrings(localStorage.getItem('page_access')) : [])
    ].map(normalizePermKey);

    const hasLegacyAccess = pageAliases.some(alias => legacyPages.includes(alias));
    return {
      canView: hasLegacyAccess,
      canModify: hasLegacyAccess && userRole === 'manager',
      state: hasLegacyAccess ? (userRole === 'manager' ? 'modify' : 'view') : 'none',
      isRestricted: hasLegacyAccess && userRole !== 'manager',
      assignedShops
    };
  }

  // Scan masterAccessList for explicit matches
  let foundModify = false;
  let foundView = false;

  for (const rawPerm of masterAccessList) {
    if (typeof rawPerm !== 'string') continue;
    const parts = rawPerm.split('.');
    
    // Format: <system>.<page>.<action> (e.g. purchase.Indent.modify)
    if (parts.length >= 3) {
      const pPage = normalizePermKey(parts[1]);
      const pAction = parts[2].toLowerCase().trim();

      const systemMatches = isSystemMatch(parts[0], systemId);
      const pageMatches = pageAliases.includes(pPage);

      if (systemMatches && pageMatches) {
        if (pAction === 'modify') foundModify = true;
        if (pAction === 'view') foundView = true;
      }
    } else if (parts.length === 2) {
      // Format: <system>.<page>
      const pPage = normalizePermKey(parts[1]);

      const systemMatches = isSystemMatch(parts[0], systemId);
      const pageMatches = pageAliases.includes(pPage);

      if (systemMatches && pageMatches) {
        // Direct assignment without action suffix defaults to view unless user has modify elsewhere
        foundView = true;
      }
    } else if (parts.length === 1) {
      // Subsystem-wide blanket permission (e.g. "business-overview" or "whatsapp")
      if (isSystemMatch(parts[0], systemId)) {
        foundModify = true;
      }
    }
  }

  // Evaluate final state
  if (foundModify) {
    return {
      canView: true,
      canModify: true,
      state: 'modify',
      isRestricted: false,
      assignedShops
    };
  }

  if (foundView) {
    return {
      canView: true,
      canModify: false,
      state: 'view',
      isRestricted: true,
      assignedShops
    };
  }

  // User has explicit master permissions configured, but this specific page is not granted:

  return {
    canView: false,
    canModify: false,
    state: 'none',
    isRestricted: false,
    assignedShops
  };
};

// Convenience boolean helpers
export const canModifyPage = (systemId, pageName, user) => {
  return getPagePermission(user, systemId, pageName).canModify;
};

export const canViewPage = (systemId, pageName, user) => {
  return getPagePermission(user, systemId, pageName).canView;
};

export const isPageRestricted = (systemId, pageName, user) => {
  return getPagePermission(user, systemId, pageName).isRestricted;
};

/**
 * Reusable View-Only Alert Banner Component
 * Displays a styled warning when a user has view-only access to a module.
 */
export const ViewOnlyBanner = ({ 
  message = "You are currently in View-Only mode. Creating, submitting, uploading, editing, or deleting records is restricted.", 
  pageTitle,
  className = "",
  isModifyAllowed = false
}) => {
  const storedRole = (typeof localStorage !== 'undefined' ? (localStorage.getItem('role') || localStorage.getItem('currentUserRole') || '') : '').toLowerCase().trim();
  const isElevated = storedRole === 'superadmin' || storedRole === 'masteradmin' || storedRole === 'admin' || storedRole === 'hod';
  if (isModifyAllowed || isElevated) return null;
  return React.createElement(
    'div',
    { className: `mb-5 p-4 rounded-xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-amber-50/70 to-orange-50/60 shadow-xs flex items-center justify-between gap-3 text-amber-950 ${className}` },
    React.createElement(
      'div',
      { className: 'flex items-center gap-3' },
      React.createElement(
        'div',
        { className: 'w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 flex-shrink-0' },
        React.createElement(Eye, { className: 'w-5 h-5 text-amber-700 animate-pulse' })
      ),
      React.createElement(
        'div',
        null,
        React.createElement(
          'div',
          { className: 'flex items-center gap-2' },
          React.createElement('span', { className: 'text-xs font-black uppercase tracking-wider text-amber-800' }, 'View-Only Access'),
          pageTitle ? React.createElement('span', { className: 'text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900' }, pageTitle) : null
        ),
        React.createElement('p', { className: 'text-xs text-amber-800/90 font-medium mt-0.5 leading-relaxed' }, message)
      )
    ),
    React.createElement(
      'div',
      { className: 'hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100/70 border border-amber-300/60 text-[11px] font-semibold text-amber-800 flex-shrink-0' },
      React.createElement(Lock, { className: 'w-3.5 h-3.5' }),
      React.createElement('span', null, 'Read-Only')
    )
  );
};

/**
 * Scopes a Supabase query so it only fetches data for the user's assigned shop(s).
 * - Superadmin & HOD: Global scope (unfiltered).
 * - Admin, Manager, User: Strictly filtered by assigned shop(s) using .in(shopColumn, assignedShops).
 * - Scoped user with no shop assigned: Returns zero rows to prevent data leakage.
 */
export const scopeQueryToUserShops = (query, shopColumn = 'shop_name', user = null) => {
  const userObj = user || getUserFromStorage() || {};

  // Superadmin and HOD have global multi-shop access across all shops
  if (isUserSuperadmin(userObj)) {
    return query;
  }

  const assignedShops = getUserAssignedShops(userObj);
  if (assignedShops.length > 0) {
    return query.in(shopColumn, assignedShops);
  }

  // Scoped user with no assigned shop: return non-matching dummy value to prevent data leakage
  return query.eq(shopColumn, '__NO_ASSIGNED_SHOP__');
};

export default {
  getPagePermission,
  canModifyPage,
  canViewPage,
  isPageRestricted,
  getUserAssignedShops,
  scopeQueryToUserShops,
  isUserShopScoped,
  isUserSuperadmin,
  hasSystemAccess,
  isSystemMatch,
  parseAccessStrings,
  PAGE_ALIASES,
  ViewOnlyBanner
};
