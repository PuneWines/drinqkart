import {
  ClipboardList,
  Users,
  Store,
  Coins,
  ShoppingCart,
  ShieldCheck,
} from 'lucide-react';

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
      { label: 'Admin Approval', to: '/dashboard/admin-approval' }
      
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
      { label: 'Joining shop', to: '/systems/hr/joining-shop' },
      { label: 'Leave Management', to: '/systems/hr/leave' },
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
      { label: 'Dashboard', to: '/systems/petty-cash?page=dashboard' },
      { label: 'Petty Cash Form Entry', to: '/systems/petty-cash?page=petty-cash' },
      { label: 'Cash Tally Counter 1', to: '/systems/petty-cash?page=cash-tally-1' },
      { label: 'Cash Tally Counter 2', to: '/systems/petty-cash?page=cash-tally-2' },
      { label: 'Cash Tally Counter 3', to: '/systems/petty-cash?page=cash-tally-3' },
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
      { type: 'header', label: 'ADMIN' },
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
  return [];
};

export const getVisibleSystems = (user) => {
  const userObj = user || {};
  const isMasterAdmin = (userObj.user_name || userObj.username || '').toLowerCase() === 'masteradmin';
  const userRole = (userObj.role || '').toLowerCase();

  const masterAccessList = [
    ...parseMasterAccessList(userObj.master_user_system_page_access),
    ...parseMasterAccessList(localStorage.getItem('master_user_system_page_access'))
  ];

  const isSubtabAllowed = (systemId, sub) => {
    if (sub.type === 'header') return true;

    // For non-checklist systems, masteradmin maintains full access by default
    if (systemId !== 'checklist' && isMasterAdmin) return true;

    if (masterAccessList.length > 0) {
      const labelsToCheck = [sub.label];
      if (sub.label === 'All Tasks') labelsToCheck.push('Task');
      if (sub.label === 'Work Records') labelsToCheck.push('Work Details');
      if (sub.label === 'Work Details') labelsToCheck.push('Work Records');
      if (sub.label === 'User & System Access') labelsToCheck.push('Master Setting');
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

      const hasMasterPerm = labelsToCheck.some((lbl) => {
        const viewKey = `${systemId}.${lbl}.view`.toLowerCase();
        const modifyKey = `${systemId}.${lbl}.modify`.toLowerCase();
        const directKey = `${systemId}.${lbl}`.toLowerCase();
        const delViewKey = `checklist_delegation.${lbl}.view`.toLowerCase();
        const delModifyKey = `checklist_delegation.${lbl}.modify`.toLowerCase();
        const delDirectKey = `checklist_delegation.${lbl}`.toLowerCase();
        const lblLower = lbl.toLowerCase().trim();

        return masterAccessList.some((item) => {
          if (typeof item !== 'string') return false;
          const itemLower = item.toLowerCase().trim();
          if (
            itemLower === viewKey || itemLower === modifyKey || itemLower === directKey ||
            itemLower === delViewKey || itemLower === delModifyKey || itemLower === delDirectKey ||
            itemLower === lblLower
          ) {
            return true;
          }
          if (itemLower.startsWith(`${systemId}.`) || (systemId === 'checklist' && itemLower.startsWith('checklist_delegation.'))) {
            const parts = itemLower.split('.');
            if (parts.length >= 2 && parts[1].trim() === lblLower) {
              return true;
            }
          }
          return false;
        });
      });

      // For masterAccessList, return explicit boolean result (do NOT fallback to legacy if masterAccessList is set)
      return hasMasterPerm;
    }

    // Admin role users must NOT bypass assigned pages for checklist system
    if (systemId !== 'checklist' && userRole === 'admin') return true;

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
      return legacyPageAccess.some((p) => {
        if (typeof p !== 'string') return false;
        const pLower = p.toLowerCase().trim();
        return sub.label.toLowerCase() === pLower;
      });
    }

    return false;
  };

  return systems.map((system) => {
    const allowedSubtabs = system.subtabs.map((sub) => {
      if (sub.children) {
        const allowedChildren = sub.children.filter((child) => isSubtabAllowed(system.id, child));
        if (allowedChildren.length === 0 && !isSubtabAllowed(system.id, sub)) return null;
        return { ...sub, children: allowedChildren };
      }
      return isSubtabAllowed(system.id, sub) ? sub : null;
    }).filter(Boolean);
    return { ...system, subtabs: allowedSubtabs };
  }).filter((system) => system.subtabs.some((s) => s.type !== 'header'));
};

export const getActiveSystem = (visibleSystems, pathname) => {
  if (!visibleSystems || visibleSystems.length === 0) return null;
  return visibleSystems.find((s) => pathname.startsWith(s.base)) || visibleSystems[0];
};
