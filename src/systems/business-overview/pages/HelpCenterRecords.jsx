import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import HelpCenterModal from '../../../components/help-center/HelpCenterModal';
import {
  HelpCircle,
  RefreshCw,
  Search,
  Store,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Save,
  CheckSquare,
  Square,
  Lock,
  Edit,
  Trash2,
  X
} from 'lucide-react';

export default function HelpCenterRecords({ activeTab: propActiveTab = 'all' }) {
  const { user } = useAuth();
  const userObj = user || {};

  const activeTab = propActiveTab;

  // Permission calculation
  const isMasterAdmin =
    (userObj.username || userObj.user_name || '').toLowerCase() === 'masteradmin' ||
    (userObj.role || '').toLowerCase() === 'admin' ||
    (userObj.role || '').toLowerCase() === 'masteradmin';

  let accessKeys = [];
  if (userObj.master_user_system_page_access) {
    let raw = userObj.master_user_system_page_access;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { raw = []; }
    }
    if (Array.isArray(raw)) accessKeys = raw;
    else if (raw && typeof raw === 'object') accessKeys = Object.keys(raw);
  }

  const isModifyAllowed =
    isMasterAdmin ||
    accessKeys.includes('business-overview.Help Center.modify') ||
    accessKeys.includes('Help Center.modify');

  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Edit Modal / Row state
  const [editingRecord, setEditingRecord] = useState(null);
  const [followUpRecord, setFollowUpRecord] = useState(null);
  const [followUpRemarks, setFollowUpRemarks] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('In Progress');
  const [followUpAssignedTo, setFollowUpAssignedTo] = useState('');
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Server-side Filter States
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Dropdown options
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Toast / inline status update state
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch unique shops, categories, and users for dropdowns
  const fetchFilterOptions = async () => {
    try {
      const { data: shopData } = await supabase
        .from('shop')
        .select('shop_name')
        .order('shop_name', { ascending: true });
      if (shopData) {
        setShops(shopData.map(s => s.shop_name).filter(Boolean));
      }

      const { data: catData } = await supabase
        .from('help_center_option_sources')
        .select('category')
        .order('id', { ascending: true });
      if (catData) {
        setCategories(catData.map(c => c.category).filter(Boolean));
      }

      const { data: userData } = await supabase
        .from('users')
        .select('user_name, shop_name')
        .not('user_name', 'is', null)
        .order('user_name', { ascending: true });
      if (userData) {
        setUsersList(userData.filter(u => u.user_name && u.user_name.trim() !== ''));
      }
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  // Fetch help_center_records with server-side filtering and pagination
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('help_center_records')
        .select('*', { count: 'exact' });

      // Tab filtering logic
      if (activeTab === 'completed') {
        query = query.eq('status', 'Resolved');
      } else if (activeTab === 'follow-up') {
        query = query.in('status', ['Hold', 'In Progress', 'Open']);
      } else {
        // 'all' tab - apply UI statusFilter if user selected any specific status dropdown
        if (statusFilter) {
          query = query.eq('status', statusFilter);
        }
      }

      // Apply server-side Date Range filter
      if (fromDate) {
        query = query.gte('date', fromDate);
      }
      if (toDate) {
        query = query.lte('date', toDate);
      }

      // Apply server-side Shop filter
      if (shopFilter) {
        query = query.eq('shop', shopFilter);
      }

      // Apply server-side Category filter
      if (categoryFilter) {
        query = query.eq('category', categoryFilter);
      }

      // Apply server-side Assigned To filter
      if (assignedToFilter) {
        query = query.eq('assigned_to', assignedToFilter);
      }

      // Apply server-side Search filter across ticket_id, employee, shop, subject, category, assigned_to
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(
          `ticket_id.ilike.${s},employee.ilike.${s},shop.ilike.${s},subject.ilike.${s},category.ilike.${s},assigned_to.ilike.${s}`
        );
      }

      // Ordering & Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order('ticket_id', { ascending: true })
        .range(from, to);

      const { data, count, error } = await query;

      if (error) throw error;

      setRecords(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching help center records:', err);
      showToast('Error loading records', 'error');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, shopFilter, categoryFilter, statusFilter, search, page, activeTab]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset page to 1 when filters change
  const handleFilterChange = (setter, val) => {
    setter(val);
    setPage(1);
  };

  // Open Edit Modal
  const handleOpenEdit = (r) => {
    if (activeTab === 'completed') return;
    setEditingRecord(r);
  };

  // Delete Record
  const handleDeleteRecord = async (ticketId) => {
    if (activeTab === 'completed') return;
    if (!window.confirm(`Are you sure you want to delete ticket ${ticketId}?`)) return;

    setDeletingId(ticketId);
    try {
      const { error } = await supabase
        .from('help_center_records')
        .delete()
        .eq('ticket_id', ticketId);

      if (error) throw error;

      showToast(`Deleted ticket ${ticketId}`);
      fetchRecords();
    } catch (err) {
      console.error('Error deleting ticket:', err);
      showToast('Failed to delete ticket', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ["Ticket ID", "Date", "Employee Name", "Shop Name", "Category", "Subject", "Description", "Assigned To", "Status", "Last Updated"];
    const rows = records.map(r => [
      `"${r.ticket_id || ''}"`,
      `"${r.date || ''}"`,
      `"${r.employee || ''}"`,
      `"${r.shop || ''}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(r.subject || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${r.assigned_to || ''}"`,
      `"${r.status || ''}"`,
      `"${r.last_updated || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `help_center_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen space-y-5 font-sans">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium text-xs transition-all ${toastMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
            }`}
        >
          {toastMsg.msg}
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[#C9A84C]/15 text-[#8C6D23]">
              <HelpCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 font-sans">
                  Help Center Support Records
                </h1>
                <span className="px-2.5 py-0.5 bg-[#C9A84C]/20 text-[#8C6D23] font-bold text-xs rounded-full border border-[#C9A84C]/40 capitalize">
                  {activeTab === 'follow-up' ? 'Follow-Up Tickets' : activeTab === 'completed' ? 'Completed Tickets' : 'All Tickets'}
                </span>
                {!isModifyAllowed && (
                  <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Lock size={12} className="text-amber-600" /> View Only Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                View, track, and manage employee support tickets with database-level querying
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <Link
              to="/systems/business-overview/help-center/all"
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'all'
                  ? 'bg-[#2C1D11] text-[#C9A84C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
              All Tickets
            </Link>
            <Link
              to="/systems/business-overview/help-center/follow-up"
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'follow-up'
                  ? 'bg-[#2C1D11] text-[#C9A84C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
              Follow-Up
            </Link>
            <Link
              to="/systems/business-overview/help-center/completed"
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'completed'
                  ? 'bg-[#2C1D11] text-[#C9A84C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
            >
              Completed
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Export filtered records to CSV"
          >
            <FileSpreadsheet size={15} />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchRecords}
            disabled={loading}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Database Query Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
          <Filter size={14} className="text-[#C9A84C]" />
          <span>Server Database Query Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search Ticket ID, Employee, Assigned To, Subject, Shop..."
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800"
            />
          </div>

          {/* Shop Filter */}
          <div>
            <select
              value={shopFilter}
              onChange={(e) => handleFilterChange(setShopFilter, e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800"
            >
              <option value="">All Shops</option>
              {shops.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => handleFilterChange(setCategoryFilter, e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800 truncate"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Assigned To Filter */}
          <div>
            <select
              value={assignedToFilter}
              onChange={(e) => handleFilterChange(setAssignedToFilter, e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800 truncate font-medium"
            >
              <option value="">All Assignees</option>
              {Array.from(new Set(usersList.map((u) => u.user_name).filter(Boolean))).map((uName) => (
                <option key={uName} value={uName}>{uName}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={activeTab === 'completed' ? 'Resolved' : activeTab === 'follow-up' ? statusFilter || '' : statusFilter}
              disabled={activeTab !== 'all'}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className={`w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] font-medium ${activeTab !== 'all' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-800'
                }`}
            >
              {activeTab === 'all' && <option value="">All Statuses</option>}
              {activeTab === 'follow-up' && <option value="">Hold & In Progress</option>}
              {activeTab === 'completed' && <option value="Resolved">Resolved</option>}
              <option value="Hold">Hold</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>

          {/* From & To Date Range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleFilterChange(setFromDate, e.target.value)}
              className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white"
              title="From Date"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => handleFilterChange(setToDate, e.target.value)}
              className="w-1/2 px-2 py-1.5 border border-slate-300 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white"
              title="To Date"
            />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-800">
              Total Tickets Found: <span className="text-[#8C6D23] font-bold">{totalCount}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Page <strong className="text-slate-900">{page}</strong> of <strong className="text-slate-900">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages || loading}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-full text-xs divide-y divide-slate-200 border-collapse">
            <thead className="bg-[#1C120C] text-white font-sans text-left">
              <tr>
                {/* Actions Column (1st Column) - Allowed on 'all' and 'follow-up' tabs */}
                {isModifyAllowed && (activeTab === 'all' || activeTab === 'follow-up') && (
                  <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-center w-[85px]">Actions</th>
                )}

                <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-center w-[95px]">Ticket ID</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-center w-[95px]">Date</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider w-[140px]">Employee Name</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider w-[120px]">Shop Name</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider w-[160px] whitespace-nowrap">Category</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider w-[220px]">Subject & Details</th>

                {/* Assigned To, Status and Remarks on All Tabs */}
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider w-[140px]">Assigned To</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider text-center w-[110px]">Status</th>
                <th className="px-3 py-2.5 font-bold uppercase tracking-wider min-w-[220px]">Remarks</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white text-xs">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-[#C9A84C]" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Querying Help Center Records...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <HelpCircle size={32} className="text-slate-300" />
                      <p className="font-medium text-slate-600">No help center records match your filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  return (
                    <tr
                      key={r.ticket_id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Actions Column (1st Column) */}
                      {isModifyAllowed && (activeTab === 'all' || activeTab === 'follow-up') && (
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {activeTab === 'follow-up' ? (
                              <button
                                onClick={() => {
                                  setFollowUpRecord(r);
                                  setFollowUpRemarks(r.remarks || r.description || '');
                                  setFollowUpStatus(r.status || 'In Progress');
                                  setFollowUpAssignedTo(r.assigned_to || '');
                                }}
                                className="px-2.5 py-1 rounded bg-[#1C120C] text-[#C9A84C] hover:bg-black font-bold text-xs shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                                title="View & Process Follow-Up"
                              >
                                <span>Action</span>
                              </button>
                            ) : r.status === 'Resolved' ? (
                              <button
                                disabled
                                className="p-1.5 rounded bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                                title="Resolved tickets cannot be edited"
                              >
                                <Edit size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenEdit(r)}
                                className="p-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                                title="Edit Ticket"
                              >
                                <Edit size={14} />
                              </button>
                            )}

                            {activeTab === 'all' && (
                              <button
                                onClick={() => handleDeleteRecord(r.ticket_id)}
                                disabled={deletingId === r.ticket_id}
                                className="p-1.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                                title="Delete Ticket"
                              >
                                {deletingId === r.ticket_id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Ticket ID */}
                      <td className="px-3 py-2 text-center font-mono font-bold text-[#8C6D23] whitespace-nowrap text-xs">
                        {r.ticket_id}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2 text-center text-slate-700 whitespace-nowrap font-medium text-xs">
                        {r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* Employee Name */}
                      <td className="px-3 py-2 font-bold text-slate-900 truncate max-w-[140px]" title={r.employee}>
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{r.employee}</span>
                        </div>
                      </td>

                      {/* Shop Name */}
                      <td className="px-3 py-2 text-slate-700 font-medium truncate max-w-[120px]" title={r.shop || 'ALL'}>
                        <div className="flex items-center gap-1.5">
                          <Store size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate">{r.shop || 'ALL'}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3 py-2 text-slate-800 font-semibold" title={r.category}>
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 whitespace-nowrap">
                          {r.category}
                        </span>
                      </td>

                      {/* Subject & Details */}
                      <td className="px-3 py-2 text-slate-800 font-medium leading-normal">
                        <div>
                          <div className="font-semibold text-slate-900">{r.subject}</div>
                          {r.description && (
                            <div className="text-[11px] text-slate-500 mt-0.5">{r.description}</div>
                          )}
                        </div>
                      </td>

                      {/* Assigned To column */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.assigned_to ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-2xs">
                            <User size={12} className="text-amber-700 shrink-0" />
                            <span>{r.assigned_to}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Unassigned</span>
                        )}
                      </td>

                      {/* Status column */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-extrabold rounded-full border shadow-2xs ${r.status === 'Resolved'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : r.status === 'In Progress'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                        >
                          {r.status || 'Hold'}
                        </span>
                      </td>

                      {/* Remarks column */}
                      <td className="px-3 py-2 text-slate-700 leading-snug">
                        {r.remarks ? (
                          <div className="text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-2 max-w-[280px]" title={r.remarks}>
                            {r.remarks}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">No remarks saved</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <div>
            Showing <strong className="text-slate-900">{records.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to <strong className="text-slate-900">{Math.min(page * pageSize, totalCount)}</strong> of <strong className="text-slate-900">{totalCount}</strong> entries
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Help Center Interactive Modal for Editing */}
      <HelpCenterModal
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        editMode={true}
        initialData={editingRecord}
        onSaveSuccess={(updatedRecord) => {
          showToast(`Successfully updated ticket ${updatedRecord.ticket_id}`);
          setEditingRecord(null);
          fetchRecords();
        }}
      />

      {/* Follow-Up Details & Status Update Modal */}
      {followUpRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn font-sans">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Header */}
            <div className="bg-[#1C120C] text-white px-5 py-4 flex items-center justify-between border-b border-[#C9A84C]/30">
              <div className="flex items-center gap-2">
                <HelpCircle size={20} className="text-[#C9A84C]" />
                <div>
                  <h3 className="font-bold text-sm text-[#C9A84C] tracking-wide uppercase">
                    Follow-Up Action Details
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    Ticket ID: #{followUpRecord.ticket_id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFollowUpRecord(null)}
                className="p-1 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto text-xs text-slate-700">
              {/* Details Summary Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Date</span>
                    <span className="font-bold text-slate-800">
                      {followUpRecord.date ? new Date(followUpRecord.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Shop Name</span>
                    <span className="font-bold text-slate-800">{followUpRecord.shop || 'ALL'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Employee</span>
                    <span className="font-semibold text-slate-800">{followUpRecord.employee || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Assigned To</span>
                    <span className="font-semibold text-[#8C6D23]">{followUpRecord.assigned_to || 'Unassigned'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Category & Subject</span>
                  <div className="font-bold text-slate-900 mt-0.5">{followUpRecord.category} &bull; {followUpRecord.subject}</div>
                </div>

                {followUpRecord.description && (
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Description</span>
                    <p className="text-slate-600 bg-white p-2 rounded border border-slate-200 mt-0.5 text-xs">
                      {followUpRecord.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Assign To User Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Assign To User
                </label>
                <select
                  value={followUpAssignedTo}
                  onChange={(e) => setFollowUpAssignedTo(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:outline-none cursor-pointer"
                >
                  <option value="">Select User Assignee</option>
                  {(() => {
                    const cleanStr = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const ticketShopClean = cleanStr(followUpRecord.shop);

                    const filtered = usersList.filter((u) => {
                      if (!u.user_name || !u.user_name.trim()) return false;
                      if (!followUpRecord.shop || followUpRecord.shop === 'ALL' || !ticketShopClean) return true;
                      if (!u.shop_name) return false;
                      const userShopClean = cleanStr(u.shop_name);
                      return userShopClean.includes(ticketShopClean) || ticketShopClean.includes(userShopClean);
                    });

                    const displayList = filtered.length > 0 ? filtered : usersList;
                    const uniqueUserNames = Array.from(
                      new Set(displayList.map((u) => u.user_name).filter(Boolean))
                    );

                    return uniqueUserNames.map((uName) => (
                      <option key={uName} value={uName}>
                        {uName}
                      </option>
                    ));
                  })()}
                </select>
              </div>

              {/* Status Update Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Update Ticket Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={followUpStatus}
                  onChange={(e) => setFollowUpStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:outline-none cursor-pointer"
                >
                  <option value="In Progress">In Progress (Keep in Follow-Up)</option>
                  <option value="Hold">Hold</option>
                  <option value="Resolved">Resolved (Complete & Move to Completed Page)</option>
                </select>
              </div>

              {/* Remarks Field */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Follow-Up Remark / Update Notes
                </label>
                <textarea
                  rows={3}
                  value={followUpRemarks}
                  onChange={(e) => setFollowUpRemarks(e.target.value)}
                  placeholder="Enter follow-up remarks, actions taken, or resolution note..."
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setFollowUpRecord(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                disabled={updatingFollowUp}
                onClick={async () => {
                  setUpdatingFollowUp(true);
                  try {
                    const updatePayload = {
                      status: followUpStatus,
                      assigned_to: followUpAssignedTo || null,
                      remarks: followUpRemarks,
                      last_updated: new Date().toISOString()
                    };
                    const { error } = await supabase
                      .from('help_center_records')
                      .update(updatePayload)
                      .eq('ticket_id', followUpRecord.ticket_id);

                    if (error) throw error;

                    showToast(
                      followUpStatus === 'Resolved'
                        ? `Ticket #${followUpRecord.ticket_id} marked as Resolved & process completed!`
                        : `Ticket #${followUpRecord.ticket_id} updated successfully.`
                    );
                    setFollowUpRecord(null);
                    fetchRecords();
                  } catch (err) {
                    console.error('Failed to update follow-up record:', err);
                    showToast('Failed to update ticket record', 'error');
                  } finally {
                    setUpdatingFollowUp(false);
                  }
                }}
                className="px-5 py-2 rounded-lg bg-[#1C120C] text-[#C9A84C] hover:bg-black font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {updatingFollowUp ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                <span>{followUpStatus === 'Resolved' ? 'Complete Process (Resolve)' : 'Save Updates'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
