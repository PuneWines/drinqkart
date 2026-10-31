import {
  ClipboardList,
  Users,
  Store,
  Coins,
  ShoppingCart,
  ShieldCheck,
  MessageSquare,
  BarChart3,
  FileSpreadsheet,
  TrendingUp,
} from 'lucide-react';
import { isUserSuperadmin, hasSystemAccess } from '../utils/permissionUtils';

export const systems = [
  {
    id: 'checklist',
    label: 'Checklist Delegation',
    base: '/dashboard',
    icon: ClipboardList,
    subtabs: [
      { label: 'Dashboard', to: '/dashboard/admin' },
      { label: 'Announcements', to: '/dashboard/notifications' },
      { label: 'Quick Task', to: '/dashboard/quick-task' },
      { label: 'Assign Task', to: '/dashboard/assign-task' },
      { label: 'Work Records', to: '/dashboard/work-details' },
      { label: 'Delegation', to: '/dashboard/delegation' },
      { label: 'All Tasks', to: '/dashboard/task' },
      { label: 'Calendar', to: '/dashboard/calendar' },
      { label: 'Holiday List', to: '/dashboard/holiday-list' },
      { label: 'Working Day Calendar', to: '/dashboard/working-day-calendar' },
      { label: 'MIS Report', to: '/dashboard/mis-report' },
      { label: 'Admin Approval', to: '/dashboard/admin-approval' },
      { label: 'Settings', to: '/dashboard/setting' }
    ]
  },
  {
    id: 'hr',
    label: 'HR System',
    base: '/systems/hr',
    icon: Users,
    subtabs: [
      { label: 'Dashboard', to: '/systems/hr' },
      { label: 'Employees', to: '/systems/hr/employees' },
      { label: 'Employee Learning', to: '/systems/hr/employee-learning' },
      // { label: 'Joining shop', to: '/systems/hr/joining-shop' },
      { label: 'Leave Management', to: '/systems/hr/leave' },
      { label: 'Holiday', to: '/systems/hr/holiday' },
      {
        label: 'Attendance',
        to: '/systems/hr/attendance/daily',
        children: [
          { label: 'Daily Attendance', to: '/systems/hr/attendance/daily' },
          { label: 'Monthly Attendance', to: '/systems/hr/attendance/monthly' }
        ]
      },
      { label: 'Payroll', to: '/systems/hr/payroll' },
      { label: 'Roster', to: '/systems/hr/roaster' },
      { label: 'Admin advanced', to: '/systems/hr/admin-advance' },
    ]
  },
  {
    id: 'inventory',
    label: 'SNACKS INVENTRY',
    base: '/systems/inventory',
    icon: Store,
    subtabs: [
      { label: 'Daily Entry Dashboard Logs', to: '/systems/inventory?page=entry' },
      { label: 'Form Entry', to: '/systems/inventory?page=form_entry' },
      { label: 'Stock Ledger', to: '/systems/inventory?page=ledger' },
      { label: 'Master Items', to: '/systems/inventory?page=master' },
      // { label: 'Users Management', to: '/systems/inventory?page=users' },
    ]
  },
  {
    id: 'petty-cash',
    label: 'Petty Cash',
    base: '/systems/petty-cash',
    icon: Coins,
    subtabs: [
      { label: 'Petty Cash Form Entry', to: '/systems/petty-cash?page=petty-cash' },
      { label: 'Cash Tally Counter', to: '/systems/petty-cash?page=cash-tally-counter' },
      { label: 'Bank Audit', to: '/systems/petty-cash?page=bank-audit' },
      { label: 'Financial Reports', to: '/systems/petty-cash?page=reports' },
    ]
  },
  {
    id: 'purchase',
    label: 'Purchase System',
    base: '/systems/purchase',
    icon: ShoppingCart,
    subtabs: [
      { type: 'header', label: 'OVERVIEW' },
      { label: 'Dashboard', to: '/systems/purchase' },
      { label: 'Purchase Report', to: '/systems/purchase/purchase-report' },
      { type: 'header', label: 'PROCUREMENT' },
      { label: 'Indent', to: '/systems/purchase/indent' },
      { label: 'Approval', to: '/systems/purchase/approval' },
      { label: 'PO', to: '/systems/purchase/po' },
      { label: 'PO History', to: '/systems/purchase/po-history' },
      { label: 'Orders Pipeline', to: '/systems/purchase/orders-pipeline' },
      { type: 'header', label: 'VERIFICATION' },
      { label: 'Trader', to: '/systems/purchase/trader-verification' },
      { label: 'Transporter', to: '/systems/purchase/transporter-verification' },
      { label: 'Receiving', to: '/systems/purchase/receiving' },
      { label: 'Settings', to: '/systems/purchase/settings' },
    ]
  },
  {
    id: 'master-setting',
    label: 'Master Setting',
    base: '/systems/master-setting',
    icon: ShieldCheck,
    subtabs: [
      { label: 'User & System Access', to: '/systems/master-setting' },
      { label: 'Shop', to: '/systems/master-setting/Shop' },
      { label: 'Counter', to: '/systems/master-setting/Counter' },
      { label: 'Expenses', to: '/systems/master-setting/Expenses' },
      { label: 'Shop Visit Checklist', to: '/systems/master-setting/shop-visit' },
      { label: 'Scheme Master', to: '/systems/master-setting/scheme-master' },
    ]
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp Broadcast',
    base: '/systems/whatsapp',
    icon: MessageSquare,
    subtabs: [
      { label: 'Dashboard', to: '/systems/whatsapp' },
    ]
  },
  {
    id: 'business-overview',
    label: 'Business overview',
    base: '/systems/business-overview',
    icon: BarChart3,
    subtabs: [
      { label: 'Scheme Discussions', to: '/systems/business-overview/scheme-discussions' },
      {
        label: 'Feedback',
        to: '/systems/business-overview/feedback/customer',
        children: [
          { label: 'Customer Feedback', to: '/systems/business-overview/feedback/customer' },
          { label: 'Assigned Complaints', to: '/systems/business-overview/feedback/assigned' },
          { label: 'Complaint Resolution', to: '/systems/business-overview/feedback/resolution' }
        ]
      },
      { label: 'Trader Invoices', to: '/systems/business-overview/trader-invoices' },
      { label: 'Shop Visit', to: '/systems/business-overview/shop-visit' },
      {
        label: 'Help Center',
        to: '/systems/business-overview/help-center/all',
        children: [
          { label: 'All Tickets', to: '/systems/business-overview/help-center/all' },
          { label: 'Follow-Up', to: '/systems/business-overview/help-center/follow-up' },
          { label: 'Completed', to: '/systems/business-overview/help-center/completed' }
        ]
      },
      {
        label: 'Gift Stock',
        to: '/systems/business-overview/gift-stock/dashboard',
        children: [
          { label: 'Dashboard', to: '/systems/business-overview/gift-stock/dashboard' },
          { label: 'Stock In', to: '/systems/business-overview/gift-stock/stock-in' },
          { label: 'Stock Out', to: '/systems/business-overview/gift-stock/stock-out' },
          { label: 'Current Stock', to: '/systems/business-overview/gift-stock/current-stock' },
          { label: 'Item Master', to: '/systems/business-overview/gift-stock/item-master' },
          { label: 'Trader Master', to: '/systems/business-overview/gift-stock/trader-master' }
        ]
      },
      {
        label: 'Document Manager',
        to: '/systems/business-overview/document-manager/dashboard',
        children: [
          { label: 'Dashboard', to: '/systems/business-overview/document-manager/dashboard' },
          { label: 'All Documents', to: '/systems/business-overview/document-manager/all-documents' },
          { label: 'Add Document', to: '/systems/business-overview/document-manager/add-document' },
          { label: 'Renewal Tracker', to: '/systems/business-overview/document-manager/renewal-tracker' },
          { label: 'Shared History', to: '/systems/business-overview/document-manager/shared-history' },
          { label: 'Masters & Setup', to: '/systems/business-overview/document-manager/masters' }
        ]
      }
    ]
  },
  {
    id: 'sale-analytics',
    label: 'Sale Analytics',
    base: '/systems/sales-analytics',
    icon: TrendingUp,
    subtabs: [
      { label: 'Dashboard', to: '/systems/sales-analytics' }
    ]
  },
  {
    id: 'stock-report',
    label: 'Stock / Report',
    base: '/systems/stock-report',
    icon: FileSpreadsheet,
    subtabs: [
      { label: 'Stock Balance Sheet', to: '/systems/stock-report' },
      { label: 'Valuation Report', to: '/systems/stock-report/valuation' },
      { label: 'Current Stock', to: '/systems/stock-report/current' },
      { label: 'Stock Report', to: '/systems/stock-report/report' },
      { label: 'Not Sold Stock', to: '/systems/stock-report/not-sold' },
      { label: 'Req Stock Report', to: '/systems/stock-report/req-stock' },
      { label: 'BIO order dashboard', to: '/systems/stock-report/bio-order' }
    ]
  }
];

export const parseMasterAccessList = (raw) => {
  if (!raw) return [];
  let current = raw;
  while (typeof current === 'string') {
    try {
      const temp = JSON.parse(current);
      if (temp === current) break;
      current = temp;
    } catch (e) {
      break;
    }
  }
  if (Array.isArray(current)) return current;
  if (current && typeof current === 'object') return Object.keys(current);
  if (typeof current === 'string' && current.trim().length > 0) {
    if (current.includes(',')) {
      return current.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [current.trim()];
  }
  return [];
};

export const getVisibleSystems = (user) => {
  const userObj = user || {};
  let currentUserStored = null;
  try {
    const rawUser = localStorage.getItem('currentUser');
    if (rawUser) {
      currentUserStored = JSON.parse(rawUser);
    }
  } catch (e) { }

  const mergedUser = {
    ...currentUserStored,
    ...userObj,
    role: userObj.role || currentUserStored?.role || (typeof localStorage !== 'undefined' ? localStorage.getItem('role') || localStorage.getItem('currentUserRole') : ''),
    user_name: userObj.user_name || userObj.username || currentUserStored?.user_name || currentUserStored?.username || (typeof localStorage !== 'undefined' ? localStorage.getItem('user-name') || localStorage.getItem('currentUserName') : ''),
    master_user_system_page_access: userObj.master_user_system_page_access ?? currentUserStored?.master_user_system_page_access ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('master_user_system_page_access') : null)
  };

  // Supreme Apex Authority: Superadmin has unconditional full access to all systems and pages
  if (isUserSuperadmin(mergedUser)) {
    return systems;
  }

  const primaryMasterAccess = [
    ...parseMasterAccessList(mergedUser.master_user_system_page_access),
    ...parseMasterAccessList(currentUserStored?.master_user_system_page_access),
    ...parseMasterAccessList(typeof localStorage !== 'undefined' ? localStorage.getItem('master_user_system_page_access') : null)
  ];

  const legacyAccess = [
    ...parseMasterAccessList(mergedUser.page_access),
    ...parseMasterAccessList(mergedUser.pages),
    ...parseMasterAccessList(currentUserStored?.page_access),
    ...parseMasterAccessList(currentUserStored?.pages),
    ...parseMasterAccessList(typeof localStorage !== 'undefined' ? localStorage.getItem('page_access') : null)
  ];

  const masterAccessList = primaryMasterAccess.length > 0 ? primaryMasterAccess : legacyAccess;
  const userRole = (mergedUser.role || '').toLowerCase().trim();

  const isSubtabAllowed = (systemId, sub) => {
    // If no custom masterAccessList is configured, Admin and HOD have full default access
    if (masterAccessList.length === 0 && (userRole === 'admin' || userRole === 'hod')) {
      return true;
    }

    // Baseline checklist pages for unconfigured users
    if (masterAccessList.length === 0 && systemId === 'checklist' && (sub.label === 'Dashboard' || sub.label === 'Announcements' || sub.label === 'Task' || sub.label === 'All Tasks')) {
      return true;
    }

    if (systemId === 'whatsapp') {
      return masterAccessList.some(item => typeof item === 'string' && item.toLowerCase().trim() === 'whatsapp');
    }
    if (systemId === 'business-overview') {
      const hasFullAccess = masterAccessList.some(item => typeof item === 'string' && item.toLowerCase().trim() === 'business-overview');
      if (hasFullAccess) return true;
    }
    if (systemId === 'sale-analytics' || systemId === 'sale_analytics') {
      const hasFullAccess = masterAccessList.some(item => typeof item === 'string' && (item.toLowerCase().trim() === 'sale-analytics' || item.toLowerCase().trim() === 'sales-analytics' || item.toLowerCase().trim() === 'sale_analytics' || item.toLowerCase().trim() === 'sales_analytics'));
      if (hasFullAccess) return true;
    }
    if (systemId === 'stock-report' || systemId === 'stock_report') {
      const hasFullAccess = masterAccessList.some(item => typeof item === 'string' && (item.toLowerCase().trim() === 'stock-report' || item.toLowerCase().trim() === 'stock_report'));
      if (hasFullAccess) return true;
    }
    if (sub.type === 'header') return true;

    if (systemId === 'petty-cash' && sub.label === 'Financial Reports') {
      if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'masteradmin') {
        return false;
      }
    }

    if (systemId === 'business-overview') {
      const isDirectEntryRole = userRole === 'user' || userRole === 'manager' || userRole === 'employee';
      if (isDirectEntryRole && sub.to && sub.to.includes('/gift-stock/')) {
        if (['Dashboard', 'Current Stock', 'Item Master', 'Trader Master'].includes(sub.label)) {
          return false;
        }
      }
    }

    if (masterAccessList.length > 0) {
      const labelsToCheck = [sub.label];
      if (sub.label === 'All Tasks') labelsToCheck.push('Task');
      if (sub.label === 'Work Records') labelsToCheck.push('Work Details');
      if (sub.label === 'Work Details') labelsToCheck.push('Work Records');
      if (sub.label === 'User & System Access') labelsToCheck.push('Master Setting');
      if (sub.label === 'Petty Cash Form Entry') labelsToCheck.push('Form Entry', 'Petty Cash Form Entry', 'Petty Cash Form', 'Petty Cash');
      if (sub.label === 'Bank Audit') labelsToCheck.push('Bank Audit', 'bank audit', 'bank-audit', 'bankaudit');
      if (sub.label === 'Cash Tally Counter') labelsToCheck.push('Cash Tally Counter', 'Cash Tally', 'Counter', 'Cash Tally - Counter 1', 'Cash Tally - Counter 2', 'Cash Tally - Counter 3');
      if (sub.label === 'Financial Reports') labelsToCheck.push('Financial Reports', 'Reports', 'financialreports');
      // business-overview: Feedback, Help Center and Gift Stock pages are granted individually by their own label
      if (systemId === 'business-overview') {
        if (sub.to && sub.to.includes('/gift-stock/')) {
          labelsToCheck.push('Gift Stock', 'gift-stock', 'gift_stock', 'Gift stock');
        }
      }
      if (systemId === 'checklist') {
        if (sub.label === 'Holiday List' || sub.label === 'Working Day Calendar') {
          labelsToCheck.push('Holiday');
        }
      }
      if (systemId === 'inventory') {
        if (sub.label === 'Daily Entry Dashboard Logs' || sub.label === 'Dashboard') {
          labelsToCheck.push('Daily Entry Dashboard Logs', 'Dashboard');
        }
        if (sub.label === 'Form Entry') {
          labelsToCheck.push('Purchase Form Entry', 'Closing Stock Form Entry', 'Cash Tally Form Entry', 'Form Entry');
        }
        if (sub.label === 'Stock Ledger') {
          labelsToCheck.push('Stock Ledger', 'Table View', 'Reports & Charts', 'Purchase Items', 'Sales History', 'Current Stock Details', 'Manager Report');
        }
      }
      if (systemId === 'master-setting' || systemId === 'master_setting') {
        if (sub.label === 'Shop') {
          labelsToCheck.push('Shop', 'Shops', 'Joining shop');
        }
        if (sub.label === 'Counter') {
          labelsToCheck.push('Counter', 'Counters');
        }
        if (sub.label === 'Expenses') {
          labelsToCheck.push('Expenses', 'Expense Categories');
        }
        if (sub.label === 'Shop Visit Checklist') {
          labelsToCheck.push('Shop Visit Checklist', 'Shop Visit', 'shop-visit', 'Master Setting');
        }
        if (sub.label === 'Scheme Master') {
          labelsToCheck.push('Scheme Master', 'Scheme Discussions', 'Scheme Parties', 'Master Setting');
        }
        if (sub.label === 'User & System Access') {
          labelsToCheck.push('User & System Access', 'Master Setting', 'User Access');
        }
      }
      if (systemId === 'business-overview') {
        if (sub.label === 'Scheme Discussions') {
          labelsToCheck.push('Scheme Discussions', 'Scheme Discussion', 'scheme-discussions', 'scheme_discussions', 'Business overview');
        }
        if (sub.label === 'Document Manager') {
          labelsToCheck.push('Document Manager', 'Document manager', 'document-manager', 'document_manager', 'Business overview');
        }
        if (['Dashboard', 'All Documents', 'Add Document', 'Renewal Tracker', 'Shared History', 'Masters & Setup'].includes(sub.label)) {
          labelsToCheck.push(sub.label, 'Document Manager', 'Document manager', 'document-manager', 'document_manager', 'Business overview');
        }
      }
      if (systemId === 'sale-analytics' || systemId === 'sale_analytics') {
        labelsToCheck.push('Sale Analytics', 'Dashboard', 'Stock Balance', 'Sales Analytics', 'Stock Balance Dashboard');
      }
      if (systemId === 'stock-report' || systemId === 'stock_report' || systemId === 'stock-balance') {
        labelsToCheck.push('Stock / Report', 'Stock Balance Sheet', 'Stock Balance', 'Stock Report', 'Sheet', 'Not Sold Stock', 'Req Stock Report', 'Valuation Report', 'Current Stock', 'BIO order dashboard');
      }

      const hasMasterPerm = labelsToCheck.some((lbl) => {
        const sysUnderscore = systemId.replace('-', '_');
        const viewKey = `${systemId}.${lbl}.view`.toLowerCase();
        const modifyKey = `${systemId}.${lbl}.modify`.toLowerCase();
        const directKey = `${systemId}.${lbl}`.toLowerCase();
        const viewKeyUnderscore = `${sysUnderscore}.${lbl}.view`.toLowerCase();
        const modifyKeyUnderscore = `${sysUnderscore}.${lbl}.modify`.toLowerCase();
        const directKeyUnderscore = `${sysUnderscore}.${lbl}`.toLowerCase();
        const delViewKey = `checklist_delegation.${lbl}.view`.toLowerCase();
        const delModifyKey = `checklist_delegation.${lbl}.modify`.toLowerCase();
        const delDirectKey = `checklist_delegation.${lbl}`.toLowerCase();
        const lblLower = lbl.toLowerCase().trim();

        return masterAccessList.some((item) => {
          if (typeof item !== 'string') return false;
          const itemLower = item.toLowerCase().trim();
          if (
            itemLower === viewKey || itemLower === modifyKey || itemLower === directKey ||
            itemLower === viewKeyUnderscore || itemLower === modifyKeyUnderscore || itemLower === directKeyUnderscore ||
            itemLower === delViewKey || itemLower === delModifyKey || itemLower === delDirectKey ||
            itemLower === lblLower
          ) {
            return true;
          }
          if (
            itemLower.startsWith(`${systemId}.`) ||
            itemLower.startsWith(`${sysUnderscore}.`) ||
            (systemId === 'checklist' && itemLower.startsWith('checklist_delegation.'))
          ) {
            const parts = itemLower.split('.');
            if (parts.length >= 2) {
              const subPart = parts[1].toLowerCase().trim();
              if (subPart === lblLower || subPart.replace(/[-_]/g, ' ') === lblLower.replace(/[-_]/g, ' ')) {
                return true;
              }
            }
          }
          return false;
        });
      });

      // For masterAccessList, return explicit boolean result (do NOT fallback to legacy if masterAccessList is set)
      return hasMasterPerm;
    }

    if (userRole === 'admin') return true;

    const legacyPageAccess = parseMasterAccessList(userObj.page_access);
    if (legacyPageAccess.length > 0) {
      if (systemId === 'inventory') {
        if (sub.label === 'Daily Entry Dashboard Logs' || sub.label === 'Dashboard') {
          return legacyPageAccess.includes('entry_dashboard') || legacyPageAccess.includes('Dashboard') || legacyPageAccess.includes('Daily Entry Dashboard Logs');
        }
        if (sub.label === 'Form Entry') {
          return legacyPageAccess.includes('entry_purchases') || legacyPageAccess.includes('entry_closing') || legacyPageAccess.includes('entry_cashtally') || legacyPageAccess.includes('Form Entry');
        }
        if (sub.label === 'Stock Ledger') {
          return legacyPageAccess.includes('ledger_table') || legacyPageAccess.includes('Stock Ledger');
        }
        if (sub.label === 'Master Items') {
          return legacyPageAccess.includes('master_items') || legacyPageAccess.includes('Master Items');
        }
        if (sub.label === 'Users Management') {
          return legacyPageAccess.includes('users_management') || legacyPageAccess.includes('Users Management');
        }
      }
      if (systemId === 'business-overview' && sub.to && sub.to.includes('/gift-stock/')) {
        return legacyPageAccess.some((p) => {
          if (typeof p !== 'string') return false;
          const pLower = p.toLowerCase().trim();
          return pLower === 'gift stock' || pLower === 'gift-stock' || pLower === 'gift_stock' || pLower === sub.label.toLowerCase();
        });
      }
      return legacyPageAccess.some((p) => {
        if (typeof p !== 'string') return false;
        const pLower = p.toLowerCase().trim();
        return sub.label.toLowerCase() === pLower;
      });
    }

    return false;
  };

  return systems.map((system) => {
    // Centralized check: if user has no access to this system at all, completely hide it
    if (!hasSystemAccess(mergedUser, system.id)) {
      return null;
    }

    const allowedSubtabs = system.subtabs.map((sub) => {
      if (sub.children) {
        const allowedChildren = sub.children.filter((child) => isSubtabAllowed(system.id, child));
        if (allowedChildren.length === 0 && !isSubtabAllowed(system.id, sub)) return null;
        // Point the parent link at the first child the user can open
        return { ...sub, to: allowedChildren[0]?.to || sub.to, children: allowedChildren };
      }
      return isSubtabAllowed(system.id, sub) ? sub : null;
    }).filter(Boolean);
    return { ...system, subtabs: allowedSubtabs };
  }).filter((system) => system && system.subtabs.some((s) => s.type !== 'header'));
};

export const getActiveSystem = (visibleSystems, pathname) => {
  if (!visibleSystems || visibleSystems.length === 0) return null;
  // Match the longest matching base URL first so specific sub-routes (e.g. stock-balance) match before general ones
  const matches = visibleSystems.filter((s) => pathname.startsWith(s.base));
  if (matches.length > 0) {
    return matches.sort((a, b) => b.base.length - a.base.length)[0];
  }
  const allMatches = systems.filter((s) => pathname && pathname.startsWith(s.base));
  if (allMatches.length > 0) {
    return allMatches.sort((a, b) => b.base.length - a.base.length)[0];
  }
  return visibleSystems[0];
};
