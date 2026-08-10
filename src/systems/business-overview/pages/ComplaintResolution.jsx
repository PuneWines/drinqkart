import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
  Search,
  RefreshCw,
  X,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ComplaintResolution() {
  const { user } = useAuth();

  // Active Tab: 'pending' or 'history'
  const [activeTab, setActiveTab] = useState('pending');

  // Database Data
  const [feedbacks, setFeedbacks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [resolutions, setResolutions] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [shops, setShops] = useState([]);

  // UI / Loading
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [formValues, setFormValues] = useState({
    status: 'Solved', // 'Solved' or 'Not Solved'
    resolved_by: '',
    resolved_date: new Date().toISOString().split('T')[0],
    resolution_summary: '',
  });

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [feedbacksRes, assignmentsRes, resolutionsRes, usersRes, shopsRes] = await Promise.all([
        supabase.from('bis_overview_customer_feedback').select('*').order('timestamp', { ascending: false }),
        supabase.from('bis_overview_assign_complaint').select('*').order('timestamp', { ascending: false }),
        supabase.from('bis_overview_complaint_resolution').select('*').order('timestamp', { ascending: false }),
        supabase.from('users').select('user_name, shop_name').order('user_name', { ascending: true }),
        supabase.from('shop').select('shop_name').order('shop_name', { ascending: true }),
      ]);

      if (feedbacksRes.error) throw feedbacksRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (resolutionsRes.error) throw resolutionsRes.error;
      if (usersRes.error) throw usersRes.error;
      if (shopsRes.error) throw shopsRes.error;

      setFeedbacks(feedbacksRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setResolutions(resolutionsRes.data || []);
      setUsersList(usersRes.data || []);
      setShops(shopsRes.data.map((s) => s.shop_name).filter(Boolean));
    } catch (err) {
      console.error('Error fetching resolution page data:', err);
      toast.error('Failed to load resolution data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute Pending and History lists based on DB rules
  const { pendingList, historyList } = useMemo(() => {
    const pending = [];
    const history = [];

    // Pending: Any assignment that does not have a resolution record, OR
    // has a resolution record whose status is "Not Solved".
    assignments.forEach((assign) => {
      const feedbackMatch = feedbacks.find((f) => f.complaint_id === assign.complaint_id) || {};
      const resolutionMatch = resolutions.find((r) => r.complaint_id === assign.complaint_id);

      if (!resolutionMatch || (resolutionMatch.status || '').toLowerCase().trim() === 'not solved') {
        pending.push({
          ...feedbackMatch,
          ...assign,
          resolution_summary: resolutionMatch ? resolutionMatch.resolution_summary : '',
          status: resolutionMatch ? resolutionMatch.status : 'Not Solved',
          resolution_id: resolutionMatch ? resolutionMatch.id : null,
        });
      }
    });

    // History: Any resolution record where status is "Solved".
    resolutions.forEach((res) => {
      if ((res.status || '').toLowerCase().trim() === 'solved') {
        const assignMatch = assignments.find((a) => a.complaint_id === res.complaint_id) || {};
        const feedbackMatch = feedbacks.find((f) => f.complaint_id === res.complaint_id) || {};

        history.push({
          ...feedbackMatch,
          ...assignMatch,
          ...res,
        });
      }
    });

    return { pendingList: pending, historyList: history };
  }, [feedbacks, assignments, resolutions]);

  // Client-side filtering
  const filterList = (list) => {
    return list.filter((row) => {
      const matchesSearch =
        !searchQuery.trim() ||
        (row.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.contact_no || '').includes(searchQuery) ||
        (row.complaint_id || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDate = !selectedDate || row.feedback_date === selectedDate;
      const matchesStore = !selectedStore || row.store_name === selectedStore;

      return matchesSearch && matchesDate && matchesStore;
    });
  };

  const filteredPending = useMemo(() => filterList(pendingList), [pendingList, searchQuery, selectedDate, selectedStore]);
  const filteredHistory = useMemo(() => filterList(historyList), [historyList, searchQuery, selectedDate, selectedStore]);

  // Get eligible resolvers matched with complaint's store location
  const eligibleResolvers = useMemo(() => {
    if (!selectedRow) return [];
    const store = (selectedRow.store_name || '').trim().toLowerCase();

    return usersList.filter((u) => {
      const uShops = (u.shop_name || '')
        .split(',')
        .map((s) => s.trim().toLowerCase());
      return uShops.includes(store);
    });
  }, [selectedRow, usersList]);

  // Form actions
  const handleOpenResolve = (row) => {
    setSelectedRow(row);
    setFormValues({
      status: row.status === 'Not Solved' ? 'Not Solved' : 'Solved',
      resolved_by: '',
      resolved_date: new Date().toISOString().split('T')[0],
      resolution_summary: row.resolution_summary || '',
    });
    setIsModalOpen(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitResolve = async (e) => {
    e.preventDefault();
    if (formValues.status === 'Solved' && !formValues.resolved_by) {
      toast.error('Please select resolver name.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      const hasExistingRes = selectedRow.resolution_id !== null;

      const payload = {
        complaint_id: selectedRow.complaint_id,
        status: formValues.status,
        resolution_summary: formValues.resolution_summary.trim(),
        resolved_by: formValues.status === 'Solved' ? formValues.resolved_by : null,
        resolve_date: formValues.status === 'Solved' ? formValues.resolved_date : null,
        timestamp: now.toISOString(),
      };

      if (hasExistingRes) {
        // Update existing "Not Solved" record
        const { error } = await supabase
          .from('bis_overview_complaint_resolution')
          .update(payload)
          .eq('id', selectedRow.resolution_id);

        if (error) throw error;
      } else {
        // Insert new resolution record
        const { error } = await supabase
          .from('bis_overview_complaint_resolution')
          .insert([payload]);

        if (error) throw error;
      }

      toast.success(
        formValues.status === 'Solved'
          ? 'Complaint resolved successfully!'
          : 'Complaint status updated as Not Solved.'
      );
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error submitting resolution:', err);
      toast.error(err.message || 'Failed to submit resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatISO = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      return d.toISOString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="p-4 bg-[#FAFAFA] min-h-screen text-[#1A1A1A] font-sans flex flex-col gap-4">
      {/* 1. Filter Bar */}
      <div className="bg-white p-4 border-[0.5px] border-[#1A1A1A]/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, contact, ID..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-[#1A1A1A]/20 rounded-md text-xs text-[#1A1A1A] placeholder-[#1A1A1A]/40 focus:outline-none focus:border-[#C9A84C] transition-colors"
            />
          </div>

          {/* Date filter */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-[#1A1A1A]/20 rounded-md text-xs px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#C9A84C] min-w-[130px]"
            />
          </div>

          {/* Store select */}
          <div>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="bg-white border border-[#1A1A1A]/20 rounded-md text-xs px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#C9A84C] cursor-pointer"
            >
              <option value="">All Stores</option>
              {shops.map((shop) => (
                <option key={shop} value={shop}>
                  {shop}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* 2. Tabs selection */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('pending');
            setSearchQuery('');
          }}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'border-[#C9A84C] text-[#C9A84C] font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Pending ({pendingList.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('history');
            setSearchQuery('');
          }}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-[#C9A84C] text-[#C9A84C] font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          History ({historyList.length})
        </button>
      </div>

      {/* 3. Main Tables */}
      <div className="bg-white border-[0.5px] border-[#1A1A1A]/10 shadow-xs overflow-hidden flex-1 flex flex-col rounded-md">
        <div className="overflow-x-auto custom-scrollbar flex-1">
          {activeTab === 'pending' ? (
            /* Pending Tab */
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#1A1A1A] text-[#C9A84C] uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-24 text-center">Action</th>
                  <th className="py-3 px-3 min-w-[100px]">Feedback Date</th>
                  <th className="py-3 px-3 min-w-[100px]">Complaint ID</th>
                  <th className="py-3 px-3 min-w-[120px]">Store Name</th>
                  <th className="py-3 px-3 min-w-[140px]">Customer Name / ग्राहक नाम</th>
                  <th className="py-3 px-3 min-w-[110px]">Contact No / मोबाइल नंबर</th>
                  <th className="py-3 px-3 min-w-[130px]">Preferred Brand?</th>
                  <th className="py-3 px-3 min-w-[120px]">Beer Chilled?</th>
                  <th className="py-3 px-3 min-w-[110px]">Staff Behaviour</th>
                  <th className="py-3 px-3 min-w-[200px]">Suggestion</th>
                  <th className="py-3 px-3 min-w-[130px]">Assigned To</th>
                  <th className="py-3 px-3 min-w-[110px]">Assigned Date</th>
                  <th className="py-3 px-3 min-w-[180px]">Remarks</th>
                  <th className="py-3 px-3 min-w-[200px]">Resolution Summary</th>
                  <th className="py-3 px-3 min-w-[220px]">Planned</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={17} className="py-16 text-center text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#C9A84C]" />
                      <span className="font-medium">Loading pending complaints...</span>
                    </td>
                  </tr>
                ) : filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="py-16 text-center text-slate-400 font-medium">
                      No complaints pending resolution.
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((row, idx) => {
                    return (
                      <tr key={row.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleOpenResolve(row)}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] uppercase rounded-md tracking-wider transition-colors shadow-xs cursor-pointer"
                          >
                            Resolve
                          </button>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.feedback_date ? new Date(row.feedback_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#8C6D23] font-mono">{row.complaint_id || '—'}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">{row.store_name || '—'}</td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800">{row.customer_name || '—'}</td>
                        <td className="py-3.5 px-3 font-mono text-slate-600">{row.contact_no || '—'}</td>
                        <td className="py-3.5 px-3">{row.preferred_brand || '—'}</td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.beer_chilled?.includes('Yes') 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {row.beer_chilled || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.staff_behaviour === 'Excellent' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            row.staff_behaviour === 'Good' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            row.staff_behaviour === 'Average' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {row.staff_behaviour || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate" title={row.suggestion_improvement}>
                          {row.suggestion_improvement || '—'}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-700">{row.assigned_to || '—'}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.assigned_date ? new Date(row.assigned_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate" title={row.remarks}>
                          {row.remarks || '—'}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate font-medium text-slate-700" title={row.resolution_summary}>
                          {row.resolution_summary || <span className="text-slate-300 italic">No summary yet</span>}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatISO(row.planned_complaint_resolution)}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* History Tab */
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#1A1A1A] border-b border-[#1A1A1A] text-[#C9A84C] uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 min-w-[100px]">Feedback Date</th>
                  <th className="py-3 px-3 min-w-[100px]">Complaint ID</th>
                  <th className="py-3 px-3 min-w-[120px]">Store Name</th>
                  <th className="py-3 px-3 min-w-[140px]">Customer Name / ग्राहक नाम</th>
                  <th className="py-3 px-3 min-w-[110px]">Contact No / मोबाइल नंबर</th>
                  <th className="py-3 px-3 min-w-[130px]">Preferred Brand?</th>
                  <th className="py-3 px-3 min-w-[120px]">Beer Chilled?</th>
                  <th className="py-3 px-3 min-w-[110px]">Staff Behaviour</th>
                  <th className="py-3 px-3 min-w-[200px]">Suggestion</th>
                  <th className="py-3 px-3 min-w-[130px]">Assigned To</th>
                  <th className="py-3 px-3 min-w-[110px]">Assigned Date</th>
                  <th className="py-3 px-3 min-w-[180px]">Remarks</th>
                  <th className="py-3 px-3 min-w-[200px]">Resolution Summary</th>
                  <th className="py-3 px-3 min-w-[220px]">Planned</th>
                  <th className="py-3 px-3 min-w-[220px]">Actual</th>
                  <th className="py-3 px-3 min-w-[130px]">Resolved By</th>
                  <th className="py-3 px-3 min-w-[110px]">Resolved Date</th>
                  <th className="py-3 px-3 min-w-[110px] text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={19} className="py-16 text-center text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#C9A84C]" />
                      <span className="font-medium">Loading history records...</span>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="py-16 text-center text-slate-400 font-medium">
                      No resolved records found in history.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((row, idx) => {
                    return (
                      <tr key={row.id || idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.feedback_date ? new Date(row.feedback_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-[#8C6D23] font-mono">{row.complaint_id || '—'}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">{row.store_name || '—'}</td>
                        <td className="py-3.5 px-3 font-semibold text-slate-800">{row.customer_name || '—'}</td>
                        <td className="py-3.5 px-3 font-mono text-slate-600">{row.contact_no || '—'}</td>
                        <td className="py-3.5 px-3">{row.preferred_brand || '—'}</td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.beer_chilled?.includes('Yes') 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {row.beer_chilled || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.staff_behaviour === 'Excellent' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            row.staff_behaviour === 'Good' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            row.staff_behaviour === 'Average' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                            'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {row.staff_behaviour || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate" title={row.suggestion_improvement}>
                          {row.suggestion_improvement || '—'}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-700">{row.assigned_to || '—'}</td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.assigned_date ? new Date(row.assigned_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate" title={row.remarks}>
                          {row.remarks || '—'}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate font-medium text-slate-700" title={row.resolution_summary}>
                          {row.resolution_summary || '—'}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatISO(row.planned_complaint_resolution)}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatISO(row.timestamp)}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-700">
                          {row.resolved_by || '—'}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.resolve_date ? new Date(row.resolve_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="p-3 bg-slate-50 border-t border-[#1A1A1A]/10 text-center shrink-0">
          <p className="text-[10px] text-gray-400 font-sans">Powered by <span className="font-bold text-[#8C6D23]">Botivate</span></p>
        </div>
      </div>

      {/* 4. Resolve Complaint Modal */}
      {isModalOpen && selectedRow && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#1C120C] text-white px-5 py-4 flex items-center justify-between border-b border-[#C9A84C]/30">
              <h3 className="text-sm font-bold tracking-wider uppercase font-serif text-white flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#C9A84C]" />
                Resolve Complaint
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitResolve} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
              {/* Summary Card */}
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-emerald-950 text-sm font-mono">
                  {selectedRow.complaint_id}
                </div>
                <div className="text-slate-700">
                  <span className="font-semibold">{selectedRow.customer_name}</span> | Assigned to: <span className="font-medium">{selectedRow.assigned_to || '—'}</span>
                </div>
                <div className="text-slate-500">
                  Store: <span className="font-medium text-slate-700">{selectedRow.store_name}</span>
                </div>
                <div className="text-slate-500 font-mono text-[10px] pt-0.5">
                  Planned 1: {formatISO(selectedRow.planned_complaint_resolution)}
                </div>
              </div>

              {/* Status Toggle (Solved / Not Solved) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Status *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, status: 'Solved' }))}
                    className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                      formValues.status === 'Solved'
                        ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Solved
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, status: 'Not Solved' }))}
                    className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                      formValues.status === 'Not Solved'
                        ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Not Solved
                  </button>
                </div>
              </div>

              {/* Conditional Form Inputs */}
              {formValues.status === 'Solved' ? (
                <>
                  {/* Resolved By dropdown */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Resolved By *
                    </label>
                    <select
                      name="resolved_by"
                      value={formValues.resolved_by}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md cursor-pointer"
                    >
                      <option value="" disabled>-- Select Resolver --</option>
                      {eligibleResolvers.map((rOpt) => {
                        const dispName = rOpt.user_name;
                        return (
                          <option key={dispName} value={dispName}>
                            {dispName}
                          </option>
                        );
                      })}
                    </select>
                    {eligibleResolvers.length === 0 && (
                      <p className="text-[10px] text-rose-500 font-medium mt-1">
                        No users found matching store location: "{selectedRow.store_name}"
                      </p>
                    )}
                  </div>

                  {/* Resolve Date picker */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Resolve Date *
                    </label>
                    <input
                      type="date"
                      name="resolved_date"
                      value={formValues.resolved_date}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md"
                    />
                  </div>
                </>
              ) : null}

              {/* Resolution Summary (always shown) */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Resolution Summary *
                </label>
                <textarea
                  name="resolution_summary"
                  value={formValues.resolution_summary}
                  onChange={handleInputChange}
                  required
                  rows={3}
                  placeholder="Enter resolution summary..."
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md placeholder-slate-400"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (formValues.status === 'Solved' && eligibleResolvers.length === 0)}
                  className="px-6 py-2 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1c120c] text-xs font-bold uppercase tracking-wider rounded-md transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={14} />
                  <span>{submitting ? 'Saving...' : 'Complete'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
