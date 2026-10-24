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

// Retrieve assigned shops for a user
export const getUserAssignedShops = (user) => {
  const userObj = user || getUserFromStorage() || {};
  const role = (userObj.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') : '') || '').toLowerCase().trim();
  const username = (userObj.user_name || userObj.username || (typeof localStorage !== 'undefined' ? localStorage.getItem('user-name') : '') || '').toLowerCase().trim();

  // Superadmin and HOD have global authority across all enterprise shops
  if (role === 'superadmin' || role === 'masteradmin' || role === 'hod' || username === 'masteradmin' || username === 'admin') {
    return [];
  }

  const rawAssigned = 
    userObj.assigned_shops ||
    (userObj.shops && userObj.shops !== 'all' ? userObj.shops : null) ||
    userObj.shop_name ||
    userObj.user_access ||
    userObj.shop ||
    (typeof localStorage !== 'undefined' ? (
      localStorage.getItem('assigned_shops') || 
      localStorage.getItem('shop_name') || 
      localStorage.getItem('user_access') ||
      localStorage.getItem('shop')
    ) : null) ||
    [];

  if (Array.isArray(rawAssigned)) {
    return rawAssigned.map(s => String(s).trim()).filter(Boolean);
  }

  if (typeof rawAssigned === 'string') {
    const trimmed = rawAssigned.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map(s => String(s).trim()).filter(Boolean);
      } catch {}
    }
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (trimmed.length > 0 && trimmed.toLowerCase() !== 'all') {
      return [trimmed];
    }
  }

  return [];
};

// Read active user safely from localStorage fallback
export const getUserFromStorage = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('currentUser') || localStorage.getItem('drinqkart_user');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

// Known alias mappings for pages across subsystems
export const PAGE_ALIASES = {
  // Purchase
  'indent': ['indent'],
  'po': ['po', 'purchaseorder', 'purchaseorders'],
  'approval': ['approval', 'approvals'],
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
  'task': ['task', 'alltasks', 'checklisttask', 'tasks', 'assigntask', 'all_task', 'all task'],
  'assigntask': ['assigntask', 'task', 'checklisttask', 'assign_task', 'assign task'],
  'workrecords': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'workdetails': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'scheduledworktasks': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'scheduled': ['workrecords', 'workdetails', 'scheduledworktasks', 'scheduled', 'work_records', 'work records', 'work_details', 'work details'],
  'adminapproval': ['adminapproval', 'approval', 'stage3'],
  'usersmanagement': ['usersmanagement', 'users'],
  'mastersetting': ['mastersetting', 'userandsystemaccess']
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
  const userRole = (userObj.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') : '') || '').toLowerCase().trim();
  const userName = (userObj.user_name || userObj.username || (typeof localStorage !== 'undefined' ? localStorage.getItem('user-name') : '') || '').toLowerCase().trim();
  const empId = String(userObj.employee_id || userObj.emp_code || '').trim();

  const assignedShops = getUserAssignedShops(userObj);

  // 1. SUPREME GLOBAL AUTHORITY: Superadmin / Masteradmin
  // Masteradmin/Superadmin holds full view and modify rights everywhere unconditionally.
  const isSuperadmin =
    userRole === 'superadmin' ||
    userRole === 'masteradmin' ||
    userName === 'masteradmin' ||
    empId === '999';

  if (isSuperadmin) {
    return {
      canView: true,
      canModify: true,
      state: 'modify',
      isRestricted: false,
      assignedShops: []
    };
  }

  // 2. Collect all configured master access permission strings
  const masterAccessList = [
    ...parseAccessStrings(userObj.master_user_system_page_access),
    ...(typeof localStorage !== 'undefined' ? parseAccessStrings(localStorage.getItem('master_user_system_page_access')) : []),
  ];

  const normSystem = normalizePermKey(systemId);
  const normPage = normalizePermKey(pageName);
  const pageAliases = PAGE_ALIASES[normPage] || [normPage];

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

  // 3. Scan masterAccessList for explicit matches
  let foundModify = false;
  let foundView = false;

  for (const rawPerm of masterAccessList) {
    if (typeof rawPerm !== 'string') continue;
    const parts = rawPerm.split('.');
    
    // Format: <system>.<page>.<action> (e.g. purchase.Indent.modify)
    if (parts.length >= 3) {
      const pSys = normalizePermKey(parts[0]);
      const pPage = normalizePermKey(parts[1]);
      const pAction = parts[2].toLowerCase().trim();

      const systemMatches = pSys === normSystem || 
        (normSystem === 'pettycash' && pSys === 'pettycash') ||
        (normSystem === 'mastersetting' && (pSys === 'mastersetting' || pSys === 'settings'));

      const pageMatches = pageAliases.includes(pPage) || pPage.includes(normPage) || normPage.includes(pPage);

      if (systemMatches && pageMatches) {
        if (pAction === 'modify') foundModify = true;
        if (pAction === 'view') foundView = true;
      }
    } else if (parts.length === 2) {
      // Format: <system>.<page>
      const pSys = normalizePermKey(parts[0]);
      const pPage = normalizePermKey(parts[1]);

      const systemMatches = pSys === normSystem;
      const pageMatches = pageAliases.includes(pPage) || pPage.includes(normPage) || normPage.includes(pPage);

      if (systemMatches && pageMatches) {
        // Direct assignment without action suffix defaults to view unless user has modify elsewhere
        foundView = true;
      }
    } else if (parts.length === 1) {
      // Subsystem-wide blanket permission (e.g. "business-overview" or "whatsapp")
      const pItem = normalizePermKey(parts[0]);
      if (pItem === normSystem) {
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

  // User has explicit master permissions configured, but this specific page is not granted
  // HOD global administration fallback for unconfigured modules:
  if (userRole === 'hod') {
    return {
      canView: true,
      canModify: true,
      state: 'modify',
      isRestricted: false,
      assignedShops: []
    };
  }

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
  className = "" 
}) => {
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

export default {
  getPagePermission,
  canModifyPage,
  canViewPage,
  isPageRestricted,
  getUserAssignedShops,
  parseAccessStrings,
  PAGE_ALIASES,
  ViewOnlyBanner
};
