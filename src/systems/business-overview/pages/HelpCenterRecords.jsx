import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  HelpCircle,
  RefreshCw,
  Search,
  Calendar,
  Store,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';

export default function HelpCenterRecords() {
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Server-side Filter States
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination States
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Dropdown options
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);

  // Toast / inline status update state
  const [updatingId, setUpdatingId] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Fetch unique shops and categories for filter dropdowns
  const fetchFilterOptions = async () => {
    try {
      // Fetch shops from 'shop' table
      const { data: shopData } = await supabase
        .from('shop')
        .select('shop_name')
        .order('shop_name', { ascending: true });
      if (shopData) {
        setShops(shopData.map(s => s.shop_name).filter(Boolean));
      }

      // Fetch categories from 'help_center_option_sources'
      const { data: catData } = await supabase
        .from('help_center_option_sources')
        .select('category')
        .order('id', { ascending: true });
      if (catData) {
        setCategories(catData.map(c => c.category).filter(Boolean));
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

      // Apply server-side Status filter
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      // Apply server-side Search filter across ticket_id, employee, shop, subject, category
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        query = query.or(
          `ticket_id.ilike.${s},employee.ilike.${s},shop.ilike.${s},subject.ilike.${s},category.ilike.${s}`
        );
      }

      // Ordering & Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order('last_updated', { ascending: false })
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
  }, [fromDate, toDate, shopFilter, categoryFilter, statusFilter, search, page]);

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

  // Inline Status Update
  const handleStatusChange = async (ticketId, newStatus) => {
    setUpdatingId(ticketId);
    try {
      const { error } = await supabase
        .from('help_center_records')
        .update({
          status: newStatus,
          last_updated: new Date().toISOString()
        })
        .eq('ticket_id', ticketId);

      if (error) throw error;

      showToast(`Updated ticket ${ticketId} status to "${newStatus}"`);
      setRecords(prev =>
        prev.map(r => (r.ticket_id === ticketId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Error updating status:', err);
      showToast('Failed to update status', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Inline Assigned To Update
  const handleAssignedToChange = async (ticketId, newAssignee) => {
    setUpdatingId(ticketId);
    try {
      const { error } = await supabase
        .from('help_center_records')
        .update({
          assigned_to: newAssignee.trim() || null,
          last_updated: new Date().toISOString()
        })
        .eq('ticket_id', ticketId);

      if (error) throw error;

      setRecords(prev =>
        prev.map(r => (r.ticket_id === ticketId ? { ...r, assigned_to: newAssignee.trim() || null } : r))
      );
    } catch (err) {
      console.error('Error updating assignee:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ["Ticket ID", "Date", "Employee Name", "Shop Name", "Category", "Subject", "Assigned To", "Status", "Last Updated"];
    const rows = records.map(r => [
      `"${r.ticket_id || ''}"`,
      `"${r.date || ''}"`,
      `"${r.employee || ''}"`,
      `"${r.shop || ''}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(r.subject || '').replace(/"/g, '""')}"`,
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
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium text-xs transition-all ${
            toastMsg.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
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
              <h1 className="text-xl font-bold text-slate-900 font-sans">
                Help Center Support Records
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                View, track, and manage employee support tickets with database-level querying
              </p>
            </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search Ticket ID, Employee, Subject, Shop..."
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

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
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
          <div className="font-semibold text-slate-800">
            Total Tickets Found: <span className="text-[#8C6D23] font-bold">{totalCount}</span>
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
                <th className="px-2 py-2 font-bold uppercase tracking-wider text-center w-[85px]">Ticket ID</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider text-center w-[85px]">Date</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider w-[110px]">Employee Name</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider w-[95px]">Shop Name</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider w-[130px]">Category</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider min-w-[150px]">Subject</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider w-[115px]">Assigned To</th>
                <th className="px-2 py-2 font-bold uppercase tracking-wider text-center w-[95px]">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-[#C9A84C]" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Querying Help Center Records...</span>
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <HelpCircle size={32} className="text-slate-300" />
                      <p className="font-medium text-slate-600">No help center records match your filter criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.ticket_id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Ticket ID */}
                    <td className="px-2 py-1.5 text-center font-mono font-bold text-[#8C6D23] whitespace-nowrap">
                      {r.ticket_id}
                    </td>

                    {/* Date */}
                    <td className="px-2 py-1.5 text-center text-slate-700 whitespace-nowrap font-medium text-[11px]">
                      {r.date ? new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </td>

                    {/* Employee Name */}
                    <td className="px-2 py-1.5 font-bold text-slate-900 truncate max-w-[110px]" title={r.employee}>
                      <div className="flex items-center gap-1">
                        <User size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{r.employee}</span>
                      </div>
                    </td>

                    {/* Shop Name */}
                    <td className="px-2 py-1.5 text-slate-700 font-medium truncate max-w-[95px]" title={r.shop || 'ALL'}>
                      <div className="flex items-center gap-1">
                        <Store size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{r.shop || 'ALL'}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-2 py-1.5 text-slate-800 font-semibold truncate max-w-[130px]" title={r.category}>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[10px] truncate max-w-full">
                        {r.category}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="px-2 py-1.5 text-slate-800 font-medium leading-tight">
                      {r.subject}
                    </td>

                    {/* Assigned To (Editable text input) */}
                    <td className="px-1.5 py-1">
                      <input
                        type="text"
                        defaultValue={r.assigned_to || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (r.assigned_to || '')) {
                            handleAssignedToChange(r.ticket_id, e.target.value);
                          }
                        }}
                        placeholder="Unassigned"
                        className="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#C9A84C] bg-slate-50 focus:bg-white"
                      />
                    </td>

                    {/* Status (Editable Select Pill) */}
                    <td className="px-1.5 py-1 text-center">
                      <select
                        value={r.status || 'Open'}
                        disabled={updatingId === r.ticket_id}
                        onChange={(e) => handleStatusChange(r.ticket_id, e.target.value)}
                        className={`w-full px-1.5 py-0.5 text-[10px] font-extrabold rounded-full border cursor-pointer focus:outline-none text-center ${
                          r.status === 'Resolved'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : r.status === 'In Progress'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                  </tr>
                ))
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
    </div>
  );
}
