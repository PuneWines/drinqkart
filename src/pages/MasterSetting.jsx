import React, { useEffect, useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// Systems and standard page modules in Drinqkart Master App
const AVAILABLE_SYSTEMS = [
  {
    id: 'checklist',
    name: 'Checklist Delegation',
    pages: ['Dashboard', 'Announcements', 'Quick Task', 'Assign Task', 'Work Records', 'Delegation', 'Task', 'Calendar', 'Holiday List', 'Working Day Calendar', 'Admin Approval', 'Settings']
  },
  {
    id: 'hr',
    name: 'HR System',
    pages: ['Dashboard', 'Employees', 'Joining shop', 'Leave Management', 'Daily Attendance', 'Payroll', 'Roster', 'Admin advanced']
  },
  {
    id: 'inventory',
    name: 'Inventory System',
    pages: ['Dashboard', 'Form Entry', 'Stock Ledger', 'Master Items', 'Users Management']
  },
  {
    id: 'petty-cash',
    name: 'Petty Cash',
    pages: ['Dashboard', 'Form Entry', 'Counter 1', 'Counter 2', 'Counter 3', 'Financial Reports']
  },
  {
    id: 'purchase',
    name: 'Purchase System',
    pages: ['Dashboard', 'Indent', 'Approval', 'PO', 'PO History', 'Orders Pipeline', 'Trader', 'Transporter', 'Receiving', 'Settings']
  }
];

export default function MasterSetting() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState({});
  const [toastMessage, setToastMessage] = useState(null);

  // Modal / Editing state
  const [editingUser, setEditingUser] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [accessPermissions, setAccessPermissions] = useState({});
  const [jsonMode, setJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('[]');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg, type = 'info') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3000);
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

  useEffect(() => {
    fetchUsers();
  }, []);

  const togglePasswordVisibility = (userId) => {
    setShowPassword((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Open Edit User Modal
  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setPasswordInput(user.password || '');

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
          permObj[item] = item;
        }
      });
    } else if (parsed && typeof parsed === 'object') {
      permObj = { ...parsed };
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

    let finalAccess = Object.keys(accessPermissions);
    if (jsonMode) {
      try {
        const parsed = JSON.parse(rawJsonText);
        finalAccess = Array.isArray(parsed) ? parsed : Object.keys(parsed);
      } catch (err) {
        showToast('Please fix JSON formatting error before saving', 'error');
        setSaving(false);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({
          password: passwordInput,
          master_user_system_page_access: finalAccess
        })
        .eq('id', editingUser.id);

      if (error) {
        showToast(`Failed to update user: ${error.message}`, 'error');
      } else {
        showToast(`User ${editingUser.user_name || editingUser.username} updated successfully!`, 'success');
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

  return (
    <div className="p-3 bg-[#FAFAFA] min-h-screen text-[#1A1A1A] font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded border text-xs font-bold uppercase tracking-wider shadow-xl transition-all ${
            toastMessage.type === 'error'
              ? 'bg-red-950 text-red-100 border-red-800'
              : 'bg-[#1A1A1A] text-[#C9A84C] border-[#C9A84C]'
          }`}
        >
          {toastMessage.msg}
        </div>
      )}

      {/* Header Banner - Drinqkart Home Styling */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 bg-white p-2 rounded-none border-[0.5px] border-[#1A1A1A]/10 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div>
        
          <h1 className="text-2xl font-serif text-[#1A1A1A] font-bold tracking-wide">
            Master Settings & System Access
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-[#C9A84C] rounded-none text-xs font-bold uppercase tracking-widest transition-colors border border-[#C9A84C]/30 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-2 relative max-w-md">
        <Search size={16} className="absolute  left-3.5 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by username..."
          className="w-full pl-10 pr-4 py-3 bg-white border-[0.5px] border-[#1A1A1A]/20 text-xs text-[#1A1A1A] placeholder-[#1A1A1A]/40 focus:outline-none focus:border-[#C9A84C] transition-colors shadow-inner font-medium"
        />
      </div>

      {/* Users Table with Actions in Column 1 */}
      <div className="bg-white border-[0.5px] border-[#1A1A1A]/10 shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[75vh] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs relative">
            <thead className="sticky top-0 z-10 bg-[#1A1A1A]">
              <tr className="bg-[#1A1A1A] border-b border-[#1A1A1A] uppercase font-serif text-[#C9A84C] tracking-[0.15em] text-[10.5px]">
                <th className="py-4 px-4 w-28">Actions</th>
                <th className="py-4 px-4">User Name</th>
                <th className="py-4 px-4">Role</th>
                <th className="py-4 px-4">Password</th>
                <th className="py-4 px-4">Master System Page Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]/10">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#1A1A1A]/50">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-[#C9A84C]" />
                    <span className="uppercase tracking-widest text-xs font-bold">Loading User Directory...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#1A1A1A]/50 font-serif">
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
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="px-3.5 py-1.5 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] font-bold text-[10.5px] uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 shadow-sm"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
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

                      {/* Column 3: Role */}
                      <td className="py-3.5 px-4 capitalize font-medium text-[#1A1A1A]/70">
                        <span className="px-2.5 py-1 bg-[#FAFAFA] border border-[#1A1A1A]/15 rounded text-[10px] font-bold uppercase tracking-wider text-[#1A1A1A]">
                          {u.role || 'user'}
                        </span>
                      </td>

                      {/* Column 4: Password */}
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

                      {/* Column 5: Master System Page Access */}
                      <td className="py-3.5 px-4 max-w-md">
                        {accessKeys.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                            {accessKeys.map((key) => {
                              const isModify = key.endsWith('.modify');
                              return (
                                <span
                                  key={key}
                                  className={`px-2 py-0.5 border rounded text-[10px] font-mono font-medium ${
                                    isModify
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
            <div className="p-6 border-b border-[#1A1A1A]/10 flex items-center justify-between bg-[#FAFAFA]">
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
              </div>

              {/* Permission Mode Switch */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">
                      master_user_system_page_access
                    </h4>
                    <p className="text-[11px] text-[#1A1A1A]/60 mt-0.5">
                      Set permission level per page: <code className="font-mono text-[#C9A84C] font-bold">.view</code> or <code className="font-mono text-[#C9A84C] font-bold">.modify</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-[#FAFAFA] p-1 border border-[#1A1A1A]/10">
                    <button
                      type="button"
                      onClick={() => setJsonMode(false)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${!jsonMode ? 'bg-[#1A1A1A] text-[#C9A84C] shadow-sm' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'}`}
                    >
                      Interactive UI
                    </button>
                    <button
                      type="button"
                      onClick={() => setJsonMode(true)}
                      className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${jsonMode ? 'bg-[#1A1A1A] text-[#C9A84C] shadow-sm' : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'}`}
                    >
                      <Code size={13} />
                      <span>JSON Editor</span>
                    </button>
                  </div>
                </div>

                {!jsonMode ? (
                  /* Interactive UI - One Row Per Page */
                  <div className="space-y-6 border border-[#1A1A1A]/10 p-5 bg-white">
                    {AVAILABLE_SYSTEMS.map((sys) => (
                      <div key={sys.id} className="space-y-3 border-b border-[#1A1A1A]/10 pb-5 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-serif font-bold text-[#1A1A1A] uppercase tracking-wider bg-[#FAFAFA] border border-[#1A1A1A]/10 px-3 py-1">
                            {sys.name} (<span className="font-mono text-[#C9A84C] font-bold">{sys.id}</span>)
                          </span>
                        </div>

                        {/* One Row Per Page List */}
                        <div className="space-y-2 pt-1">
                          {sys.pages.map((pg) => {
                            const currentLevel = getPageLevel(sys.id, pg);

                            return (
                              <div
                                key={pg}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[#FAFAFA] border border-[#1A1A1A]/10 hover:border-[#C9A84C]/40 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] shrink-0" />
                                  <span className="text-xs font-serif font-bold text-[#1A1A1A] truncate">
                                    {pg}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 bg-white p-1 border border-[#1A1A1A]/10 shadow-xs shrink-0">
                                  {/* None Button */}
                                  <button
                                    type="button"
                                    onClick={() => setPageLevel(sys.id, pg, 'none')}
                                    className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                                      currentLevel === 'none'
                                        ? 'bg-[#1A1A1A]/10 text-[#1A1A1A] font-bold border border-[#1A1A1A]/20'
                                        : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
                                    }`}
                                  >
                                    None
                                  </button>

                                  {/* View Button */}
                                  <button
                                    type="button"
                                    onClick={() => setPageLevel(sys.id, pg, 'view')}
                                    className={`px-3 py-1 text-[10px] font-mono font-bold transition-all ${
                                      currentLevel === 'view'
                                        ? 'bg-[#1A1A1A] text-white font-bold shadow-sm'
                                        : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
                                    }`}
                                  >
                                    .view
                                  </button>

                                  {/* Modify Button */}
                                  <button
                                    type="button"
                                    onClick={() => setPageLevel(sys.id, pg, 'modify')}
                                    className={`px-3 py-1 text-[10px] font-mono font-bold transition-all ${
                                      currentLevel === 'modify'
                                        ? 'bg-[#C9A84C] text-[#1A1A1A] font-bold shadow-sm'
                                        : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A]'
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
                  </div>
                ) : (
                  /* JSON Editor */
                  <div className="space-y-2">
                    <textarea
                      rows={14}
                      value={rawJsonText}
                      onChange={(e) => handleJsonChange(e.target.value)}
                      className="w-full bg-[#1A1A1A] text-[#C9A84C] font-mono text-xs p-4 focus:outline-none border border-[#C9A84C]/30 shadow-inner"
                    />
                    {jsonError && (
                      <p className="text-xs text-red-600 font-bold uppercase tracking-wider">{jsonError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-[#1A1A1A]/10 bg-[#FAFAFA] flex items-center justify-end gap-3">
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
    </div>
  );
}
