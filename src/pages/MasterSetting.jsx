import React, { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Eye,
  EyeOff,
  Edit3,
  Save,
  X,
  ShieldCheck,
  RefreshCw,
  Code,
  Key,
  UserCheck,
  Plus,
  Trash2,
  UserPlus,
  Building,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import JoiningCompany from '../systems/hr/pages/JoiningCompany';
import PurchaseSettings from '../systems/purchase/pages/Settings';
import CounterManagement from './CounterManagement';
import ExpensesManagement from './ExpensesManagement';

// Systems and standard page modules in Drinqkart Master App
const AVAILABLE_SYSTEMS = [
  {
    id: 'checklist',
    name: 'Checklist Delegation',
    sections: [
      {
        title: 'CHECKLIST DELEGATION MODULES',
        pages: ['Dashboard', 'Announcements', 'Quick Task', 'Assign Task', 'Work Records', 'Delegation', 'Task', 'Calendar', 'Holiday List', 'Working Day Calendar', 'Admin Approval', 'Users Management', 'Settings']
      }
    ]
  },
  {
    id: 'hr',
    name: 'HR System',
    sections: [
      {
        title: 'HR SYSTEM MODULES',
        pages: ['Dashboard', 'Employees', 'Joining shop', 'Leave Management', 'Daily Attendance', 'Payroll', 'Roster', 'Admin advanced']
      }
    ]
  },
  {
    id: 'inventory',
    name: 'SNACKS INVENTRY',
    sections: [
      {
        title: 'DAILY ENTRY DASHBOARD & FORMS',
        pages: [
          'Daily Entry Dashboard Logs',
          'Purchase Form Entry',
          'Closing Stock Form Entry',
          'Cash Tally Form Entry'
        ]
      },
      {
        title: 'STOCK LEDGER & AUDITS',
        pages: [
          'Table View',
          'Reports & Charts',
          'Purchase Items',
          'Sales History',
          'Current Stock Details',
          'Manager Report'
        ]
      },
      {
        title: 'MASTER CATALOG DIRECTORY',
        pages: [
          'Master Items',
          'Vendors Directory'
        ]
      },
      {
        title: 'USER MANAGEMENT',
        pages: [
          'Users Management'
        ]
      }
    ]
  },
  {
    id: 'petty-cash',
    name: 'Petty Cash',
    sections: [
      {
        title: 'PETTY CASH MODULES',
        pages: ['Form Entry', 'Cash Tally Counter', 'Financial Reports', 'Bank Audit']
      }
    ]
  },
  {
    id: 'purchase',
    name: 'Purchase System',
    sections: [
      {
        title: 'OVERVIEW',
        pages: ['Dashboard']
      },
      {
        title: 'PROCUREMENT',
        pages: ['Indent', 'Approval', 'PO', 'PO History', 'Orders Pipeline']
      },
      {
        title: 'VERIFICATION',
        pages: ['Trader', 'Transporter', 'Receiving']
      },
      {
        title: 'ADMIN',
        pages: ['Settings']
      }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Broadcast'
  },
  {
    id: 'business-overview',
    name: 'Business overview',
    sections: [
      {
        title: 'BUSINESS OVERVIEW MODULES',
        pages: ['Feedback', 'Trader Invoices']
      }
    ]
  }
];

export default function MasterSetting() {
  const { user: currentUserObj, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const [availableShops, setAvailableShops] = useState([]);
  const [availableCounters, setAvailableCounters] = useState([]);

  // Modal / Editing state
  const [editingUser, setEditingUser] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [shopNameInput, setShopNameInput] = useState('');
  const [counterAccessInput, setCounterAccessInput] = useState([]);
  const [accessPermissions, setAccessPermissions] = useState({});
  const [jsonMode, setJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('[]');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick Shop Edit State
  const [editingShopUser, setEditingShopUser] = useState(null);
  const [quickShopInput, setQuickShopInput] = useState('');
  const [savingShop, setSavingShop] = useState(false);

  const handleOpenQuickShopEdit = (user) => {
    setEditingShopUser(user);
    setQuickShopInput(user.shop_name || '');
  };

  const handleSaveQuickShop = async () => {
    if (!editingShopUser) return;
    setSavingShop(true);
    const shopVal = quickShopInput.trim() || null;
    try {
      const { error } = await supabase
        .from('users')
        .update({
          shop_name: shopVal,
          user_access: shopVal
        })
        .eq('id', editingShopUser.id);

      if (error) {
        showToast(`Failed to update shop name: ${error.message}`, 'error');
      } else {
        showToast(`Shop name updated for ${editingShopUser.user_name || editingShopUser.username}!`, 'success');
        setEditingShopUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error('Shop update error:', err);
      showToast('Unexpected error updating shop name', 'error');
    } finally {
      setSavingShop(false);
    }
  };

  // Add User State
  const [showAddModal, setShowAddModal] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [empSearchInput, setEmpSearchInput] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [empStatus, setEmpStatus] = useState(null); // null | 'already_user' | 'not_found' | 'ready'
  const [existingUserInfo, setExistingUserInfo] = useState(null);

  const [newUserForm, setNewUserForm] = useState({
    employee_id: '',
    username: '',
    password: '',
    role: 'user',
    email: '',
    shopName: '',
    can_self_assign: false,
    systemPreset: 'purchase', // 'all', 'purchase', 'checklist', 'hr', 'inventory', 'petty-cash'
    counterAccess: []
  });

  // Filter employees from hr_management_employees who are NOT present in the users table
  const unassignedEmployees = useMemo(() => {
    const existingUserEmpIds = new Set(
      users
        .map((u) => u.employee_id?.toString().trim().toLowerCase())
        .filter(Boolean)
    );

    return employeesList.filter((emp) => {
      const empId = emp.employee_id?.toString().trim().toLowerCase();
      return empId && !existingUserEmpIds.has(empId);
    });
  }, [employeesList, users]);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch employees list from hr_management_employees table
  const fetchEmployeesList = async () => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await supabase
        .from('hr_management_employees')
        .select('*')
        .order('name_as_per_aadhar', { ascending: true });

      if (!error && data) {
        setEmployeesList(data);
      }
    } catch (err) {
      console.error('Error fetching hr_management_employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Open Add User Modal and load employee directory
  const openAddUserModal = () => {
    setEmpSearchInput('');
    setSelectedEmployee(null);
    setEmpStatus(null);
    setExistingUserInfo(null);
    setNewUserForm({
      employee_id: '',
      username: '',
      password: '',
      role: 'user',
      email: '',
      shopName: '',
      can_self_assign: false,
      systemPreset: 'purchase',
      counterAccess: []
    });
    setShowAddModal(true);
    fetchEmployeesList();
  };

  // Verify entered Employee ID against users table and hr_management_employees table
  const handleVerifyEmployeeId = (targetEmpId) => {
    const idToTest = (targetEmpId || empSearchInput).toString().trim();
    if (!idToTest) {
      setEmpStatus(null);
      setSelectedEmployee(null);
      setExistingUserInfo(null);
      return;
    }

    const cleanId = idToTest.toLowerCase();

    // 1. Check if employee_id already exists in users table
    const existingUser = users.find(
      (u) => u.employee_id && u.employee_id.toString().trim().toLowerCase() === cleanId
    );

    if (existingUser) {
      setEmpStatus('already_user');
      setExistingUserInfo(existingUser);
      setSelectedEmployee(null);
      return;
    }

    // 2. Check if employee_id exists in hr_management_employees table
    const foundEmp = employeesList.find(
      (e) => e.employee_id && e.employee_id.toString().trim().toLowerCase() === cleanId
    );

    if (foundEmp) {
      setEmpStatus('ready');
      setSelectedEmployee(foundEmp);
      setExistingUserInfo(null);
      setNewUserForm((prev) => ({
        ...prev,
        employee_id: foundEmp.employee_id,
        username: foundEmp.name_as_per_aadhar || foundEmp.employee_id,
        email: foundEmp.candidate_email || '',
        shopName: foundEmp.joining_company_name || ''
      }));
    } else {
      setEmpStatus('not_found');
      setSelectedEmployee(null);
      setExistingUserInfo(null);
    }
  };

  const handleCreateUser = async (e) => {
    if (e) e.preventDefault();

    if (empStatus === 'already_user') {
      showToast(`User already exists for Employee ID: ${newUserForm.employee_id || empSearchInput}`, 'error');
      return;
    }

    const targetEmpId = newUserForm.employee_id || selectedEmployee?.employee_id;
    if (!targetEmpId) {
      showToast('Please search and verify a valid Employee ID first', 'error');
      return;
    }

    if (!newUserForm.username.trim() || !newUserForm.password.trim()) {
      showToast('Username and password are required', 'error');
      return;
    }

    setSaving(true);

    let initialPerms = [];
    if (newUserForm.systemPreset === 'all') {
      AVAILABLE_SYSTEMS.forEach(sys => {
        const pages = sys.sections ? sys.sections.flatMap(s => s.pages) : (sys.pages || []);
        pages.forEach(p => initialPerms.push(`${sys.id}.${p}.modify`));
      });
    } else if (newUserForm.systemPreset) {
      const sys = AVAILABLE_SYSTEMS.find(s => s.id === newUserForm.systemPreset);
      if (sys) {
        const pages = sys.sections ? sys.sections.flatMap(s => s.pages) : (sys.pages || []);
        pages.forEach(p => initialPerms.push(`${sys.id}.${p}.modify`));
      }
    }

    try {
      const targetShop = newUserForm.shopName.trim() || selectedEmployee?.joining_company_name || null;
      const payload = {
        employee_id: targetEmpId,
        user_name: newUserForm.username.trim(),
        username: newUserForm.username.trim(),
        password: newUserForm.password.trim(),
        role: newUserForm.role || 'user',
        email_id: newUserForm.email.trim() || selectedEmployee?.candidate_email || null,
        number: selectedEmployee?.mobile_no ? parseInt(selectedEmployee.mobile_no) : null,
        Designation: selectedEmployee?.designation || null,
        shop_name: targetShop,
        user_access: targetShop,
        can_self_assign: Boolean(newUserForm.can_self_assign),
        status: 'active',
        master_user_system_page_access: initialPerms,
        counter_access: newUserForm.counterAccess || [],
        HR_SYSTEM_employee_details: selectedEmployee || null
      };

      const { data, error } = await supabase
        .from('users')
        .insert([payload])
        .select()
        .single();

      if (error) {
        showToast(`Failed to create user: ${error.message}`, 'error');
      } else {
        showToast(`User ${newUserForm.username} created successfully!`, 'success');
        setShowAddModal(false);
        fetchUsers();
      }
    } catch (err) {
      console.error('Create user error:', err);
      showToast('Unexpected error during user creation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        showToast(`Failed to delete user: ${error.message}`, 'error');
      } else {
        showToast(`User ${username} deleted successfully`, 'success');
        fetchUsers();
      }
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Unexpected error during deletion', 'error');
    }
  };

  // Fetch users on load
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('user_name', { ascending: true });

      if (error) {
        console.error('Error fetching users:', error);
        showToast(`Error fetching users: ${error.message}`, 'error');
      } else {
        setUsers(data || []);
      }
    } catch (err) {
      console.error('Exception fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch shops from database table
  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shop')
        .select('shop_name')
        .order('shop_name', { ascending: true });
      if (!error && data) {
        const names = data.map(s => s.shop_name).filter(Boolean);
        setAvailableShops(names);
      }
    } catch (err) {
      console.error('Exception fetching shops:', err);
    }
  };

  const fetchCounters = async () => {
    try {
      const { data, error } = await supabase
        .from('master_counter')
        .select('name')
        .order('name', { ascending: true });
      if (!error && data) {
        setAvailableCounters(data.map(c => c.name));
      }
    } catch (err) {
      console.error('Exception fetching counters:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchShops();
    fetchCounters();
  }, []);

  const selectedShopsList = shopNameInput
    ? shopNameInput.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const handleToggleShop = (shopName) => {
    let updated;
    if (selectedShopsList.includes(shopName)) {
      updated = selectedShopsList.filter(s => s !== shopName);
    } else {
      updated = [...selectedShopsList, shopName];
    }
    setShopNameInput(updated.join(', '));
  };

  const handleSelectAllShops = () => {
    if (selectedShopsList.length === availableShops.length) {
      setShopNameInput('');
    } else {
      setShopNameInput(availableShops.join(', '));
    }
  };

  const selectedNewUserShopsList = newUserForm.shopName
    ? newUserForm.shopName.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const handleToggleNewUserShop = (shopName) => {
    let updated;
    if (selectedNewUserShopsList.includes(shopName)) {
      updated = selectedNewUserShopsList.filter(s => s !== shopName);
    } else {
      updated = [...selectedNewUserShopsList, shopName];
    }
    setNewUserForm({ ...newUserForm, shopName: updated.join(', ') });
  };

  const togglePasswordVisibility = (userId) => {
    setShowPassword((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Open Edit User Modal
  const handleOpenEdit = (user) => {
    setEditingUser({
      ...user,
      can_self_assign: Boolean(user.can_self_assign)
    });
    setPasswordInput(user.password || '');
    setShopNameInput(user.shop_name || '');
    setCounterAccessInput(user.counter_access || []);

    // Parse master_user_system_page_access
    let permObj = {};
    const rawVal = user.master_user_system_page_access;
    let parsed = rawVal;

    if (typeof rawVal === 'string') {
      try {
        parsed = JSON.parse(rawVal);
      } catch (e) {
        parsed = [];
      }
    }

    if (Array.isArray(parsed)) {
      parsed.forEach((item) => {
        if (typeof item === 'string') {
          let normalizedItem = item.replace(/^petty_cash\./, 'petty-cash.');
          if (normalizedItem.includes('.bank audit.')) {
            normalizedItem = normalizedItem.replace('.bank audit.', '.Bank Audit.');
          }
          permObj[normalizedItem] = normalizedItem;
        }
      });
    } else if (parsed && typeof parsed === 'object') {
      Object.keys(parsed).forEach((item) => {
        let normalizedItem = item.replace(/^petty_cash\./, 'petty-cash.');
        if (normalizedItem.includes('.bank audit.')) {
          normalizedItem = normalizedItem.replace('.bank audit.', '.Bank Audit.');
        }
        permObj[normalizedItem] = normalizedItem;
      });
    } else if (Array.isArray(user.page_access)) {
      user.page_access.forEach((p) => {
        const key = `checklist.${p}.modify`;
        permObj[key] = key;
      });
    }

    setAccessPermissions(permObj);
    const initialArray = Object.keys(permObj);
    setRawJsonText(JSON.stringify(initialArray, null, 2));
    setJsonMode(false);
    setJsonError('');
  };

  // Permission Key Helpers
  const getPageLevel = (systemId, pageName) => {
    if (accessPermissions[`${systemId}.${pageName}.modify`]) return 'modify';
    if (accessPermissions[`${systemId}.${pageName}.view`]) return 'view';
    return 'none';
  };

  const setPageLevel = (systemId, pageName, level) => {
    const viewKey = `${systemId}.${pageName}.view`;
    const modifyKey = `${systemId}.${pageName}.modify`;
    const updated = { ...accessPermissions };

    delete updated[viewKey];
    delete updated[modifyKey];

    if (level === 'view') {
      updated[viewKey] = viewKey;
    } else if (level === 'modify') {
      updated[modifyKey] = modifyKey;
    }

    setAccessPermissions(updated);
    setRawJsonText(JSON.stringify(Object.keys(updated), null, 2));
  };

  const setSystemLevel = (system, level) => {
    const allPages = [];
    if (system.sections) {
      system.sections.forEach(sec => allPages.push(...sec.pages));
    } else if (system.pages) {
      allPages.push(...system.pages);
    }
    const updated = { ...accessPermissions };
    allPages.forEach(pg => {
      const viewKey = `${system.id}.${pg}.view`;
      const modifyKey = `${system.id}.${pg}.modify`;
      delete updated[viewKey];
      delete updated[modifyKey];
      if (level === 'view') {
        updated[viewKey] = viewKey;
      } else if (level === 'modify') {
        updated[modifyKey] = modifyKey;
      }
    });
    setAccessPermissions(updated);
    setRawJsonText(JSON.stringify(Object.keys(updated), null, 2));
  };

  const handleJsonChange = (val) => {
    setRawJsonText(val);
    try {
      const parsed = JSON.parse(val);
      let updated = {};
      if (Array.isArray(parsed)) {
        parsed.forEach((k) => { updated[k] = k; });
      } else if (parsed && typeof parsed === 'object') {
        updated = { ...parsed };
      }
      setAccessPermissions(updated);
      setJsonError('');
    } catch (err) {
      setJsonError('Invalid JSON format');
    }
  };

  // Save changes to database
  const handleSaveUser = async () => {
    if (!editingUser) return;
    setSaving(true);

    const finalAccess = Object.keys(accessPermissions);

    const shopVal = shopNameInput.trim() || null;
    try {
      const { error } = await supabase
        .from('users')
        .update({
          password: passwordInput,
          shop_name: shopVal,
          user_access: shopVal,
          can_self_assign: Boolean(editingUser.can_self_assign),
          master_user_system_page_access: finalAccess,
          counter_access: counterAccessInput
        })
        .eq('id', editingUser.id);

      if (error) {
        showToast(`Failed to update user: ${error.message}`, 'error');
      } else {
        showToast(`User ${editingUser.user_name || editingUser.username} updated successfully!`, 'success');
        
        const isCurrentLoggedIn = currentUserObj && (
          currentUserObj.id === editingUser.id || 
          (currentUserObj.user_name || currentUserObj.username) === (editingUser.user_name || editingUser.username)
        );
        if (isCurrentLoggedIn && refreshUser) {
          await refreshUser();
        }

        setEditingUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error('Update error:', err);
      showToast('Unexpected error during update', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const name = (u.user_name || u.username || '').toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const location = useLocation();

  // Sub-route: Purchase Settings
  if (
    location.pathname.includes('/purchase-settings') ||
    location.pathname.includes('/purchase-setting') ||
    location.pathname.endsWith('/settings')
  ) {
    return <PurchaseSettings />;
  }

  // Sub-route: Shop (Joining Company)
  if (location.pathname.includes('/Shop') || location.pathname.toLowerCase().includes('/shop')) {
    return <JoiningCompany />;
  }

  // Sub-route: Counter
  if (location.pathname.includes('/Counter') || location.pathname.toLowerCase().includes('/counter')) {
    return <CounterManagement />;
  }

  // Sub-route: Expenses
  if (location.pathname.includes('/Expenses') || location.pathname.toLowerCase().includes('/expenses')) {
    return <ExpensesManagement />;
  }

  return (
    <div className="p-3 bg-[#FAFAFA] min-h-screen text-[#1A1A1A] font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded border text-xs font-bold uppercase tracking-wider shadow-xl transition-all ${toastMessage.type === 'error'
            ? 'bg-red-950 text-red-100 border-red-800'
            : 'bg-[#1A1A1A] text-[#C9A84C] border-[#C9A84C]'
            }`}
        >
          {toastMessage.msg}
        </div>
      )}

      {/* Header Banner - Drinqkart Home Styling */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 bg-white p-4 rounded-none border-[0.5px] border-[#1A1A1A]/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-serif text-[#1A1A1A] font-bold tracking-wide">
            Master Settings & System Access
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1A1A1A] text-[#C9A84C] text-xs font-bold font-mono rounded-full border border-[#C9A84C]/30 shadow-sm">
            Total Users: {users.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddUserModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] rounded-none text-xs font-bold uppercase tracking-widest transition-colors shadow-sm cursor-pointer"
          >
            <UserPlus size={14} />
            <span>Add User</span>
          </button>

          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#C9A84C] rounded-none text-xs font-bold uppercase tracking-widest transition-colors border border-[#C9A84C]/30 shadow-sm cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Filter & Count Summary */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by username..."
            className="w-full pl-10 pr-4 py-3 bg-white border-[0.5px] border-[#1A1A1A]/20 text-xs text-[#1A1A1A] placeholder-[#1A1A1A]/40 focus:outline-none focus:border-[#C9A84C] transition-colors shadow-inner font-medium"
          />
        </div>
        <div className="text-xs font-bold text-[#1A1A1A]/70 px-1 font-mono">
          Showing <span className="text-[#C9A84C] font-extrabold">{filteredUsers.length}</span> of <span className="text-[#1A1A1A] font-extrabold">{users.length}</span> users
        </div>
      </div>

      {/* Users Table with Actions in Column 1 */}
      <div className="bg-white border-[0.5px] border-[#1A1A1A]/10 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[75vh] custom-scrollbar">
          <table className="w-full min-w-[1500px] text-left border-collapse text-xs relative">
            <thead className="sticky top-0 z-10 bg-[#1A1A1A]">
              <tr className="bg-[#1A1A1A] border-b border-[#1A1A1A] uppercase font-serif text-[#C9A84C] tracking-[0.15em] text-[10.5px]">
                <th className="py-4 px-4 w-28">Actions</th>
                <th className="py-4 px-4">User Name</th>
                <th className="py-4 px-4">Role</th>
                <th className="py-4 px-4">Shop Name</th>
                <th className="py-4 px-4">Password</th>
                <th className="py-4 px-4">Master System Page Access</th>
                <th className="py-4 px-4">MASTER SYSTEM COUNTER ACCESS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/10">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#1A1A1A]/50">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-[#C9A84C]" />
                    <span className="uppercase tracking-widest text-xs font-bold">Loading User Directory...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#1A1A1A]/50 font-serif">
                    No users found matching your search term.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const name = u.user_name || u.username || 'N/A';
                  const isPassVisible = !!showPassword[u.id];

                  // Parse master access tags
                  let accessKeys = [];
                  if (u.master_user_system_page_access) {
                    let raw = u.master_user_system_page_access;
                    if (typeof raw === 'string') {
                      try { raw = JSON.parse(raw); } catch (e) { raw = []; }
                    }
                    if (Array.isArray(raw)) {
                      accessKeys = raw;
                    } else if (raw && typeof raw === 'object') {
                      accessKeys = Object.keys(raw);
                    }
                  }

                  return (
                    <tr key={u.id} className="hover:bg-[#FAFAFA] transition-colors">
                      {/* Column 1: Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="px-3 py-1 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] font-bold text-[10.5px] uppercase tracking-wider transition-colors inline-flex items-center gap-1 shadow-xs cursor-pointer"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>

                        </div>
                      </td>

                      {/* Column 2: User Name */}
                      <td className="py-3.5 px-4 font-semibold text-[#1A1A1A]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-[#1A1A1A] text-[#C9A84C] border border-[#C9A84C]/30 flex items-center justify-center font-bold text-[10px] uppercase">
                            {name.slice(0, 2)}
                          </div>
                          <span className="font-serif text-sm">{name}</span>
                        </div>
                      </td>

                      {/* Column 3: Role & Self-Assign Status */}
                      <td className="py-3.5 px-4 capitalize font-medium text-[#1A1A1A]/70">
                        <div className="flex flex-col gap-1 items-start">
                          <span className="px-2.5 py-0.5 bg-[#FAFAFA] border border-[#1A1A1A]/15 rounded text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">
                            {u.role || 'user'}
                          </span>
                          {u.can_self_assign ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded text-[9px] font-bold uppercase tracking-wider">
                              Self Assign: Enabled
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-200 rounded text-[9px] font-bold uppercase tracking-wider">
                              Self Assign: Disabled
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: Shop Name with Edit Button */}
                      <td className="py-3.5 px-4 font-sans text-xs">
                        <div className="flex items-center justify-between gap-2 min-w-[180px] max-w-[240px]">
                          <div className="flex flex-wrap gap-1 max-w-[170px]">
                            {u.shop_name ? (
                              u.shop_name.split(',').map((s, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-[#1A1A1A]/5 text-[#1A1A1A] border border-[#1A1A1A]/10 rounded text-[10px] font-medium font-mono truncate max-w-[150px]"
                                  title={s.trim()}
                                >
                                  {s.trim()}
                                </span>
                              ))
                            ) : (
                              <span className="text-[#1A1A1A]/40 italic text-[11px]">No Shop</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenQuickShopEdit(u)}
                            className="px-2.5 py-1 bg-[#C9A84C]/15 hover:bg-[#C9A84C] text-[#1A1A1A] border border-[#C9A84C]/40 hover:border-[#C9A84C] font-bold text-[10px] uppercase tracking-wider transition-all inline-flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                            title="Edit Shop Name for user"
                          >
                            <Edit3 size={11} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>



                      {/* Column 5: Password */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-[#1A1A1A] font-medium">
                            {isPassVisible ? u.password : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="text-[#1A1A1A]/40 hover:text-[#C9A84C] p-1 transition-colors"
                            title={isPassVisible ? 'Hide Password' : 'Show Password'}
                          >
                            {isPassVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </td>

                      {/* Column 6: Master System Page Access */}
                      <td className="py-3.5 px-4 max-w-md">
                        {accessKeys.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {accessKeys.map((key) => {
                              const isModify = key.endsWith('.modify');
                              return (
                                <span
                                  key={key}
                                  className={`px-2 py-0.5 border rounded text-[10px] font-mono font-medium ${isModify
                                    ? 'bg-[#C9A84C]/15 text-[#1A1A1A] border-[#C9A84C]/40 font-bold'
                                    : 'bg-[#1A1A1A]/5 text-[#1A1A1A] border-[#1A1A1A]/10'
                                    }`}
                                >
                                  {key}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[#1A1A1A]/40 italic text-[11px]">
                            No permissions configured
                          </span>
                        )}
                      </td>

                      {/* Column 7: Master System Counter Access */}
                      <td className="py-3.5 px-4 font-sans text-xs">
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
                          {u.counter_access && Array.isArray(u.counter_access) && u.counter_access.length > 0 ? (
                            u.counter_access.map((counter, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-[#C9A84C]/15 text-[#1A1A1A] border border-[#C9A84C]/45 rounded text-[10px] font-semibold tracking-wider font-sans truncate"
                                title={counter}
                              >
                                {counter}
                              </span>
                            ))
                          ) : (
                            <span className="text-[#1A1A1A]/40 italic text-[11px]">No Counter Access</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Edit User Modal --- */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-none border border-[#1A1A1A]/20 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-5 pt-3 pb-2 border-b border-[#1A1A1A]/10 flex items-center justify-between bg-[#FAFAFA]">
              <div>
                <span className="text-[#C9A84C] uppercase tracking-[0.25em] text-[9.5px] font-bold block mb-1">
                  Access Management
                </span>
                <h3 className="text-xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  <UserCheck size={20} className="text-[#C9A84C]" />
                  Edit User Access: {editingUser.user_name || editingUser.username}
                </h3>
              </div>

              <button
                onClick={() => setEditingUser(null)}
                className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] p-2 rounded hover:bg-[#1A1A1A]/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {/* Credentials Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#FAFAFA] p-5 rounded-none border border-[#1A1A1A]/10">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/60 mb-1.5">
                    User Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={editingUser.user_name || editingUser.username || ''}
                    className="w-full bg-[#1A1A1A]/5 border border-[#1A1A1A]/10 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-semibold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/60 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter user password"
                      className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-mono font-medium focus:outline-none focus:border-[#C9A84C]"
                    />
                    <Key size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/30 pointer-events-none" />
                  </div>
                </div>

                <div className="sm:col-span-2 pt-2 border-t border-[#1A1A1A]/10 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="editUserCanSelfAssign"
                    checked={Boolean(editingUser.can_self_assign)}
                    onChange={(e) => setEditingUser({ ...editingUser, can_self_assign: e.target.checked })}
                    className="w-4 h-4 text-[#C9A84C] accent-[#C9A84C] rounded cursor-pointer"
                  />
                  <label htmlFor="editUserCanSelfAssign" className="text-xs font-bold text-[#1A1A1A] cursor-pointer flex flex-col">
                    <span>Allow Self Assignment (can_self_assign)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Enables user to self-assign tasks and checklist items in the application.
                    </span>
                  </label>
                </div>
              </div>

              {/* Permission Management */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-900">
                      master_user_system_page_access
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Set permission level per page: <code className="font-mono text-[#8C6D23] font-bold">.view</code> or <code className="font-mono text-[#8C6D23] font-bold">.modify</code>
                    </p>
                  </div>
                </div>

                {/* Interactive UI - Distinct System Cards, Section Banners & Page Rows */}
                <div className="space-y-2 bg-slate-50/50  rounded-xl">
                  {AVAILABLE_SYSTEMS.map((sys) => {
                    const sectionsToRender = sys.sections || [{ title: null, pages: sys.pages || [] }];

                    return (
                      <div
                        key={sys.id}
                        className="bg-white rounded-xl border-1 border-slate-200 shadow-sm overflow-hidden transition-all hover:border-[#C9A84C]/50"
                      >
                        {/* SYSTEM HEADER BAR - Prominent Dark Card Header */}
                        <div className="bg-[#1C120C] text-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C9A84C]/30">
                          <div className="flex items-center gap-3">
                            <span className="w-3 h-3 rounded-full bg-[#C9A84C] shrink-0" />
                            <div>
                              <h4 className="text-sm font-bold tracking-wide text-white uppercase font-serif">
                                {sys.name}
                              </h4>
                              <span className="text-[10px] font-mono text-[#C9A84C] font-semibold tracking-wider">
                                System ID: {sys.id}
                              </span>
                            </div>
                          </div>


                        </div>

                        {/* SYSTEM CONTENT (SECTIONS & PAGES) */}
                        <div className="p-5 space-y-6 bg-slate-50/40">
                          {sys.id === 'whatsapp' ? (
                            <div className="flex items-center justify-between p-4 bg-white border border-[#C9A84C]/40 rounded-xl shadow-xs">
                              <div className="flex flex-col gap-1 pr-4">
                                <span className="text-xs font-bold text-[#1C120C] uppercase tracking-wider font-serif">
                                  System Access Toggle
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  Enable or disable this user's permission to view the WhatsApp Broadcast system.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...accessPermissions };
                                  if (updated['whatsapp']) {
                                    delete updated['whatsapp'];
                                  } else {
                                    updated['whatsapp'] = 'whatsapp';
                                  }
                                  setAccessPermissions(updated);
                                  setRawJsonText(JSON.stringify(Object.keys(updated), null, 2));
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  accessPermissions['whatsapp'] ? 'bg-[#C9A84C]' : 'bg-slate-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    accessPermissions['whatsapp'] ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Shop Access Section inside Checklist Delegation */}
                              {sys.id === 'checklist' && (
                                <>
                                  <div className="p-4 bg-white border border-[#C9A84C]/40 rounded-xl shadow-xs space-y-3">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-xs font-bold uppercase tracking-wider text-[#1C120C] font-serif flex items-center gap-2">
                                        <Building size={16} className="text-[#C9A84C]" />
                                        Shop Access (<code className="font-mono text-[#8C6D23] lowercase">shop_name</code>)
                                      </label>
                                      {availableShops.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={handleSelectAllShops}
                                          className="text-[10px] font-bold text-[#C9A84C] hover:underline uppercase tracking-wider cursor-pointer"
                                        >
                                          {selectedShopsList.length === availableShops.length ? 'Deselect All' : 'Select All Shops'}
                                        </button>
                                      )}
                                    </div>

                                    <p className="text-[11px] text-slate-500 font-medium">
                                      Select assigned shop locations from the database <code className="font-mono font-bold text-[#1C120C]">shop</code> table:
                                    </p>

                                    {/* Dynamic Shop Badges / Checkboxes from 'shop' table */}
                                    {availableShops.length > 0 ? (
                                      <div className="flex flex-wrap gap-2 py-1 max-h-36 overflow-y-auto custom-scrollbar bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        {availableShops.map((shop) => {
                                          const isSelected = selectedShopsList.includes(shop);
                                          return (
                                            <button
                                              key={shop}
                                              type="button"
                                              onClick={() => handleToggleShop(shop)}
                                              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${isSelected
                                                  ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-xs'
                                                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#C9A84C]/60 hover:bg-slate-100'
                                                }`}
                                            >
                                              <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-[#C9A84C] text-[#1C120C] border-[#C9A84C]' : 'border-slate-400 bg-white'
                                                }`}>
                                                {isSelected && '✓'}
                                              </span>
                                              <span>{shop}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-slate-400 italic">Loading options from shop table...</div>
                                    )}

                                    {/* Comma-Separated Text Input */}
                                    <div className="pt-1">
                                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                        Assigned Shop Locations (Comma-separated text)
                                      </label>
                                      <input
                                        type="text"
                                        value={shopNameInput}
                                        onChange={(e) => setShopNameInput(e.target.value)}
                                        placeholder="e.g. BALAJI, FRIENDS, KUNAL ULWE"
                                        className="w-full bg-slate-50 border border-slate-300 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-mono font-bold focus:outline-none focus:border-[#C9A84C] focus:bg-white rounded-md transition-colors shadow-inner"
                                      />
                                    </div>
                                  </div>

                                  {/* Counter Access Section */}
                                  <div className="p-4 bg-white border border-[#C9A84C]/40 rounded-xl shadow-xs space-y-3 mt-4">
                                    <div className="flex items-center justify-between">
                                      <label className="block text-xs font-bold uppercase tracking-wider text-[#1C120C] font-serif flex items-center gap-2">
                                        <Lock size={16} className="text-[#C9A84C]" />
                                        Counter Access (<code className="font-mono text-[#8C6D23] lowercase">counter_access</code>)
                                      </label>
                                      {availableCounters.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (counterAccessInput.length === availableCounters.length) {
                                              setCounterAccessInput([]);
                                            } else {
                                              setCounterAccessInput([...availableCounters]);
                                            }
                                          }}
                                          className="text-[10px] font-bold text-[#C9A84C] hover:underline uppercase tracking-wider cursor-pointer"
                                        >
                                          {counterAccessInput.length === availableCounters.length ? 'Deselect All' : 'Select All Counters'}
                                        </button>
                                      )}
                                    </div>

                                    <p className="text-[11px] text-slate-500 font-medium">
                                      Select assigned counters from the database <code className="font-mono font-bold text-[#1C120C]">master_counter</code> table:
                                    </p>

                                    {/* Dynamic Counter Badges / Checkboxes from 'master_counter' table */}
                                    {availableCounters.length > 0 ? (
                                      <div className="flex flex-wrap gap-2 py-1 max-h-36 overflow-y-auto custom-scrollbar bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        {availableCounters.map((counter) => {
                                          const isSelected = counterAccessInput.includes(counter);
                                          return (
                                            <button
                                              key={counter}
                                              type="button"
                                              onClick={() => {
                                                if (isSelected) {
                                                  setCounterAccessInput(counterAccessInput.filter(c => c !== counter));
                                                } else {
                                                  setCounterAccessInput([...counterAccessInput, counter]);
                                                }
                                              }}
                                              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${isSelected
                                                  ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-xs'
                                                  : 'bg-white text-slate-700 border-slate-300 hover:border-[#C9A84C]/60 hover:bg-slate-100'
                                                }`}
                                            >
                                              <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-[#C9A84C] text-[#1C120C] border-[#C9A84C]' : 'border-slate-400 bg-white'
                                                }`}>
                                                {isSelected && '✓'}
                                              </span>
                                              <span>{counter}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-slate-400 italic">Loading options from master_counter table...</div>
                                    )}
                                  </div>
                                </>
                              )}

                              {sectionsToRender.map((sec, secIdx) => (
                                <div key={secIdx} className="space-y-3">
                                  {/* SECTION HEADER - Highlighted Category Banner */}
                                  {sec.title && (
                                    <div className="flex items-center gap-2 border-l-4 border-[#C9A84C] bg-[#C9A84C]/10 px-3.5 py-2 rounded-r-lg">
                                      <span className="text-xs font-black text-[#1C120C] uppercase tracking-widest font-sans">
                                        {sec.title}
                                      </span>
                                    </div>
                                  )}

                                  {/* PAGE ROWS */}
                                  <div className="space-y-2 pl-0 sm:pl-2">
                                    {sec.pages.map((pg) => {
                                      const currentLevel = getPageLevel(sys.id, pg);

                                      return (
                                        <div
                                          key={pg}
                                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 pl-3.5 bg-white border border-slate-200 rounded-lg hover:border-[#C9A84C] h transition-all"
                                        >
                                          {/* Page Title & Bullet */}
                                          <div className="flex items-center gap-3 min-w-0">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${currentLevel === 'modify'
                                              ? 'bg-[#C9A84C] ring-2 ring-[#C9A84C]/30'
                                              : currentLevel === 'view'
                                                ? 'bg-slate-900'
                                                : 'bg-slate-300'
                                              }`} />
                                            <span className="text-xs font-bold text-slate-800 tracking-tight font-serif truncate">
                                              {pg}
                                            </span>
                                          </div>

                                          {/* Page Level Access Toggle Buttons */}
                                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 shrink-0 self-end sm:self-auto">
                                            {/* None Button */}
                                            <button
                                              type="button"
                                              onClick={() => setPageLevel(sys.id, pg, 'none')}
                                              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${currentLevel === 'none'
                                                ? 'bg-slate-300 text-slate-800 font-extrabold shadow-xs'
                                                : 'text-slate-500 hover:text-slate-900'
                                                }`}
                                            >
                                              None
                                            </button>

                                            {/* View Button */}
                                            <button
                                              type="button"
                                              onClick={() => setPageLevel(sys.id, pg, 'view')}
                                              className={`px-3 py-1 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${currentLevel === 'view'
                                                ? 'bg-[#1C120C] text-white font-extrabold shadow-sm'
                                                : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
                                                }`}
                                            >
                                              .view
                                            </button>

                                            {/* Modify Button */}
                                            <button
                                              type="button"
                                              onClick={() => setPageLevel(sys.id, pg, 'modify')}
                                              className={`px-3 py-1 text-[10px] font-mono font-bold rounded transition-all cursor-pointer ${currentLevel === 'modify'
                                                ? 'bg-[#C9A84C] text-[#1C120C] font-black shadow-sm'
                                                : 'text-slate-600 hover:text-slate-900'
                                                }`}
                                            >
                                              .modify
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-2 border-t border-[#1A1A1A]/10 bg-[#FAFAFA] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-5 py-2.5 bg-white hover:bg-gray-100 text-[#1A1A1A] border border-[#1A1A1A]/20 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUser}
                disabled={saving}
                className="px-6 py-2.5 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-sm"
              >
                <Save size={14} />
                <span>{saving ? 'Saving...' : 'Save User Access'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* --- Add New User Modal --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-none border border-[#1A1A1A]/20 shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-5 pt-4 pb-3 border-b border-[#1A1A1A]/10 flex items-center justify-between bg-[#FAFAFA] shrink-0">
              <div>
                <span className="text-[#C9A84C] uppercase tracking-[0.25em] text-[9.5px] font-bold block mb-1">
                  Master User Management
                </span>
                <h3 className="text-lg font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  <UserPlus size={18} className="text-[#C9A84C]" />
                  Add User from Employee Directory
                </h3>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] p-2 rounded hover:bg-[#1A1A1A]/5 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleCreateUser} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {/* Step 1: Employee ID Search & Selection */}
              <div className="bg-slate-50 p-4 border border-slate-200 space-y-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A]">
                  1. Select or Enter Employee ID *
                </label>

                {/* Dropdown Select from Employee Table (Unassigned Employees Only) */}
                <div className="flex gap-2">
                  <select
                    value={empSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmpSearchInput(val);
                      handleVerifyEmployeeId(val);
                    }}
                    className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option value="">
                      {loadingEmployees
                        ? '-- Loading Employees... --'
                        : unassignedEmployees.length > 0
                          ? `-- Choose Employee Not Yet Created as User (${unassignedEmployees.length} Available) --`
                          : '-- All Employees Already Have User Accounts --'}
                    </option>
                    {unassignedEmployees.map((emp) => (
                      <option key={emp.id} value={emp.employee_id}>
                        {emp.employee_id} - {emp.name_as_per_aadhar} ({emp.designation || 'No Designation'}) - {emp.joining_company_name || 'No Shop'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">- OR TYPE EMPLOYEE ID MANUALLY -</div>

                {/* Manual Input Search */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={empSearchInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmpSearchInput(val);
                      handleVerifyEmployeeId(val);
                    }}
                    placeholder="Enter Employee ID (e.g. EMP-001)"
                    className="flex-1 bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2 text-xs font-mono font-semibold focus:outline-none focus:border-[#C9A84C]"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyEmployeeId(empSearchInput)}
                    className="px-3.5 py-2 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#C9A84C] text-xs font-bold uppercase tracking-wider transition-colors shrink-0 cursor-pointer"
                  >
                    Verify ID
                  </button>
                </div>
              </div>

              {/* Status Verification Feedback */}
              {empStatus === 'already_user' && existingUserInfo && (
                <div className="bg-amber-50 border border-amber-300 p-4 flex items-start gap-3 rounded-none">
                  <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Already Registered as User!</h4>
                    <p className="text-xs text-amber-800 mt-1">
                      Employee ID <span className="font-bold">{empSearchInput}</span> is already assigned to active user account{' '}
                      <span className="font-bold text-amber-950">{existingUserInfo.user_name || existingUserInfo.username}</span> (Role:{' '}
                      <span className="font-bold">{existingUserInfo.role || 'user'}</span>).
                    </p>
                  </div>
                </div>
              )}

              {empStatus === 'not_found' && (
                <div className="bg-red-50 border border-red-300 p-4 flex items-start gap-3 rounded-none">
                  <X size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">Employee Not Found</h4>
                    <p className="text-xs text-red-800 mt-1">
                      No matching employee found with Employee ID <span className="font-bold">{empSearchInput}</span> in employee records. Please verify the ID or register the employee first.
                    </p>
                  </div>
                </div>
              )}

              {/* Employee Summary Card */}
              {empStatus === 'ready' && selectedEmployee && (
                <div className="bg-emerald-50/80 border border-emerald-300 p-4 rounded-none space-y-3 shadow-sm">
                  <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      Employee Verified Details
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded border border-emerald-300">
                      Employee Log IN: {selectedEmployee.employee_id}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Photo */}
                    <div className="shrink-0">
                      {selectedEmployee.candidate_photo ? (
                        <img
                          src={selectedEmployee.candidate_photo}
                          alt={selectedEmployee.name_as_per_aadhar}
                          className="w-16 h-16 object-cover rounded-full border-2 border-emerald-400 shadow-sm"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-emerald-200 text-emerald-800 rounded-full flex items-center justify-center font-bold text-xl border-2 border-emerald-400 shadow-sm">
                          {selectedEmployee.name_as_per_aadhar?.charAt(0) || 'E'}
                        </div>
                      )}
                    </div>

                    {/* Grid of Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs flex-1 w-full">
                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Employee Name</span>
                        <span className="font-bold text-slate-900">{selectedEmployee.name_as_per_aadhar}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Joining Shop Name</span>
                        <span className="font-bold text-slate-900">{selectedEmployee.joining_company_name || '—'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Mobile No</span>
                        <span className="font-semibold text-slate-800">{selectedEmployee.mobile_no || '—'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Email Address</span>
                        <span className="font-semibold text-slate-800">{selectedEmployee.candidate_email || '—'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Designation</span>
                        <span className="font-semibold text-slate-800">{selectedEmployee.designation || '—'}</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Attendance Mode & Status</span>
                        <span className="font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[11px]">
                          {selectedEmployee.mode_of_attendance || 'Biometric'} ({selectedEmployee.status || 'Active'})
                        </span>
                      </div>

                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase block">Checklist Task Details</span>
                        <span className="font-medium text-slate-700 text-[11px] block bg-white/80 p-1.5 rounded border border-emerald-200 mt-0.5">
                          {selectedEmployee.HR_SYSTEM_employee_data?.checklist_details ||
                            selectedEmployee.HR_SYSTEM_employee_data?.task_details ||
                            `Active Employee Profile (${selectedEmployee.joining_company_name || 'All Shops Access'})`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Set User Password & Credentials */}
              <div className={`space-y-4 ${empStatus === 'ready' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                <div className="border-t border-[#1A1A1A]/10 pt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1A1A1A] block mb-3">
                    2. User Account & Password Credentials
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5">
                    User Name / Login ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5 flex items-center justify-between">
                    <span>Set Login Password *</span>
                    <Lock size={12} className="text-[#C9A84C]" />
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                    placeholder="Enter password for user login"
                    className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-mono font-semibold focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5">
                      User Role
                    </label>
                    <select
                      value={newUserForm.role}
                      onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                      className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option value="user">User / Operator</option>
                      <option value="admin">Admin</option>
                      <option value="HOD">HOD</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5">
                      Initial System Access
                    </label>
                    <select
                      value={newUserForm.systemPreset}
                      onChange={(e) => setNewUserForm({ ...newUserForm, systemPreset: e.target.value })}
                      className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3 py-2 text-xs font-semibold focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option value="purchase">Purchase System Only</option>
                      <option value="checklist">Checklist System Only</option>
                      <option value="hr">HR System Only</option>
                      <option value="inventory">Inventory System Only</option>
                      <option value="petty-cash">Petty Cash Only</option>
                      <option value="business-overview">Business Overview Only</option>
                      <option value="all">Full Access (All Systems)</option>
                      <option value="">Custom Access (Configure Later)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-3 border border-slate-200">
                  <input
                    type="checkbox"
                    id="newUserCanSelfAssign"
                    checked={Boolean(newUserForm.can_self_assign)}
                    onChange={(e) => setNewUserForm({ ...newUserForm, can_self_assign: e.target.checked })}
                    className="w-4 h-4 text-[#C9A84C] accent-[#C9A84C] rounded cursor-pointer"
                  />
                  <label htmlFor="newUserCanSelfAssign" className="text-xs font-bold text-[#1A1A1A] cursor-pointer flex flex-col">
                    <span>Allow Self Assignment (can_self_assign)</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Enables user to self-assign tasks and checklist items in the application.
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5 flex items-center justify-between">
                    <span>Shop Access (shop_name)</span>
                    {availableShops.length > 0 && (
                      <span className="text-[9px] font-mono text-[#C9A84C] font-bold">
                        {availableShops.length} Shops Loaded
                      </span>
                    )}
                  </label>
                  {availableShops.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2 max-h-28 overflow-y-auto custom-scrollbar bg-slate-50 p-2.5 rounded border border-slate-200">
                      {availableShops.map((shop) => {
                        const isSelected = selectedNewUserShopsList.includes(shop);
                        return (
                          <button
                            key={shop}
                            type="button"
                            onClick={() => handleToggleNewUserShop(shop)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${isSelected
                                ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-[#C9A84C]'
                              }`}
                          >
                            <span className={`w-3 h-3 rounded-xs border flex items-center justify-center text-[9px] font-bold ${isSelected ? 'bg-[#C9A84C] text-[#1C120C] border-[#C9A84C]' : 'border-slate-400 bg-white'
                              }`}>
                              {isSelected && '✓'}
                            </span>
                            <span>{shop}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input
                    type="text"
                    value={newUserForm.shopName}
                    onChange={(e) => setNewUserForm({ ...newUserForm, shopName: e.target.value })}
                    placeholder="e.g. BALAJI, FRIENDS, KUNAL ULWE"
                    className="w-full bg-white border border-[#1A1A1A]/20 text-[#1A1A1A] px-3.5 py-2.5 text-xs font-mono font-medium focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>

                {/* Counter Access Section */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-[#1A1A1A]/70 mb-1.5 flex items-center justify-between">
                    <span>Counter Access (counter_access)</span>
                    {availableCounters.length > 0 && (
                      <span className="text-[9px] font-mono text-[#C9A84C] font-bold">
                        {availableCounters.length} Counters Loaded
                      </span>
                    )}
                  </label>
                  {availableCounters.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mb-2 max-h-28 overflow-y-auto custom-scrollbar bg-slate-50 p-2.5 rounded border border-slate-200">
                      {availableCounters.map((counter) => {
                        const isSelected = (newUserForm.counterAccess || []).includes(counter);
                        return (
                          <button
                            key={counter}
                            type="button"
                            onClick={() => {
                              const currentList = newUserForm.counterAccess || [];
                              const updated = currentList.includes(counter)
                                ? currentList.filter(c => c !== counter)
                                : [...currentList, counter];
                              setNewUserForm({ ...newUserForm, counterAccess: updated });
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer border ${isSelected
                                ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-[#C9A84C]'
                              }`}
                          >
                            <span className={`w-3 h-3 rounded-xs border flex items-center justify-center text-[9px] font-bold ${isSelected ? 'bg-[#C9A84C] text-[#1C120C] border-[#C9A84C]' : 'border-slate-400 bg-white'
                              }`}>
                              {isSelected && '✓'}
                            </span>
                            <span>{counter}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">Loading options from master_counter table...</div>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-[#1A1A1A]/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white hover:bg-gray-100 text-[#1A1A1A] border border-[#1A1A1A]/20 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || empStatus !== 'ready'}
                  className={`px-5 py-2 text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 shadow-sm ${empStatus === 'ready'
                      ? 'bg-[#C9A84C] hover:bg-[#b8973b] cursor-pointer'
                      : 'bg-slate-300 opacity-60 cursor-not-allowed text-slate-600'
                    }`}
                >
                  <Plus size={14} />
                  <span>{saving ? 'Creating...' : 'Create User Account'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* --- Quick Edit Shop Name Modal --- */}
      {editingShopUser && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-none border border-[#1A1A1A]/20 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#FAFAFA] border-b border-[#1A1A1A]/10 flex items-center justify-between">
              <div>
                <span className="text-[#C9A84C] uppercase tracking-[0.2em] text-[9.5px] font-bold block mb-0.5">
                  Shop Name Assignment
                </span>
                <h3 className="text-base font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Building size={16} className="text-[#C9A84C]" />
                  Edit Shop Name: {editingShopUser.user_name || editingShopUser.username}
                </h3>
              </div>
              <button
                onClick={() => setEditingShopUser(null)}
                className="text-[#1A1A1A]/40 hover:text-[#1A1A1A] p-1.5 rounded hover:bg-[#1A1A1A]/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                    Select Available Shop Locations
                  </label>
                  {availableShops.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const currentList = quickShopInput ? quickShopInput.split(',').map(s => s.trim()).filter(Boolean) : [];
                        if (currentList.length === availableShops.length) {
                          setQuickShopInput('');
                        } else {
                          setQuickShopInput(availableShops.join(', '));
                        }
                      }}
                      className="text-[10px] font-bold text-[#C9A84C] hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      {quickShopInput.split(',').map(s => s.trim()).filter(Boolean).length === availableShops.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {availableShops.length > 0 ? (
                  <div className="flex flex-wrap gap-2 py-2 max-h-44 overflow-y-auto custom-scrollbar bg-slate-50 p-3 rounded border border-slate-200">
                    {availableShops.map((shop) => {
                      const selectedList = quickShopInput ? quickShopInput.split(',').map(s => s.trim()).filter(Boolean) : [];
                      const isSelected = selectedList.includes(shop);
                      return (
                        <button
                          key={shop}
                          type="button"
                          onClick={() => {
                            let updated;
                            if (isSelected) {
                              updated = selectedList.filter(s => s !== shop);
                            } else {
                              updated = [...selectedList, shop];
                            }
                            setQuickShopInput(updated.join(', '));
                          }}
                          className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-[#C9A84C]'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-[#C9A84C] text-[#1C120C] border-[#C9A84C]' : 'border-slate-400 bg-white'}`}>
                            {isSelected && '✓'}
                          </span>
                          <span>{shop}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No shops found in database `shop` table.</div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Shop Name (Comma-separated text)
                </label>
                <input
                  type="text"
                  value={quickShopInput}
                  onChange={(e) => setQuickShopInput(e.target.value)}
                  placeholder="e.g. BALAJI, FRIENDS, KUNAL ULWE"
                  className="w-full bg-slate-50 border border-slate-300 text-[#1A1A1A] px-3.5 py-2 text-xs font-mono font-bold focus:outline-none focus:border-[#C9A84C] rounded shadow-inner"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#FAFAFA] border-t border-[#1A1A1A]/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingShopUser(null)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-[#1A1A1A] border border-[#1A1A1A]/20 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickShop}
                disabled={savingShop}
                className="px-5 py-2 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Save size={14} />
                <span>{savingShop ? 'Saving...' : 'Save Shop Name'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
