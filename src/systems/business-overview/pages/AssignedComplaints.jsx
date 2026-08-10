import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
  Search,
  RefreshCw,
  X,
  Calendar,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssignedComplaints() {
  const { user } = useAuth();

  // Active Tab: 'pending' or 'history'
  const [activeTab, setActiveTab] = useState('pending');

  // Raw Database Data
  const [feedbacks, setFeedbacks] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [shops, setShops] = useState([]);

  // Loading / UI States
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter Values
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  // Complete Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [formValues, setFormValues] = useState({
    assigned_to: '',
    assigned_date: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all feedbacks
      const feedbacksRes = await supabase
        .from('bis_overview_customer_feedback')
        .select('*')
        .order('timestamp', { ascending: false });

      if (feedbacksRes.error) throw feedbacksRes.error;

      // 2. Fetch all assignments
      const assignmentsRes = await supabase
        .from('bis_overview_assign_complaint')
        .select('*')
        .order('timestamp', { ascending: false });

      if (assignmentsRes.error) throw assignmentsRes.error;

      // 3. Fetch all users (for assignment dropdown options)
      const usersRes = await supabase
        .from('users')
        .select('user_name, shop_name')
        .order('user_name', { ascending: true });

      if (usersRes.error) throw usersRes.error;

      // 4. Fetch all shops (for top filters)
      const shopsRes = await supabase
        .from('shop')
        .select('shop_name')
        .order('shop_name', { ascending: true });

      if (shopsRes.error) throw shopsRes.error;

      setFeedbacks(feedbacksRes.data || []);
      setAssignments(assignmentsRes.data || []);
      setUsersList(usersRes.data || []);
      setShops(shopsRes.data.map((s) => s.shop_name).filter(Boolean));
    } catch (err) {
      console.error('Error fetching assigned page data:', err);
      toast.error('Failed to load page data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Set up mapped items
  const { pendingList, historyList } = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.complaint_id));

    // Pending: Feedback exists, but NO assignment row exists
    const pending = feedbacks.filter((f) => f.complaint_id && !assignedIds.has(f.complaint_id));

    // History: Assignment row exists. Join with Feedback details.
    const history = assignments.map((a) => {
      const matchFeedback = feedbacks.find((f) => f.complaint_id === a.complaint_id) || {};
      return {
        ...matchFeedback, // original feedback details (feedback_date, store_name, customer_name, contact_no, planned_assign_complaint)
        ...a,              // assignment details (assigned_to, assigned_date, remarks, planned_complaint_resolution, actual timestamp)
      };
    });

    return { pendingList: pending, historyList: history };
  }, [feedbacks, assignments]);

  // Client-side filtering
  const filterList = (list, isHistoryTab) => {
    return list.filter((row) => {
      // 1. Search Query (Name, Contact, Complaint ID)
      const matchesSearch =
        !searchQuery.trim() ||
        (row.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.contact_no || '').includes(searchQuery) ||
        (row.complaint_id || '').toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Date Filter
      // For pending tab, matches feedback_date. For history tab, matches feedback_date as well.
      const matchesDate = !selectedDate || row.feedback_date === selectedDate;

      // 3. Store Filter
      const matchesStore = !selectedStore || row.store_name === selectedStore;

      return matchesSearch && matchesDate && matchesStore;
    });
  };

  const filteredPending = useMemo(() => filterList(pendingList, false), [pendingList, searchQuery, selectedDate, selectedStore]);
  const filteredHistory = useMemo(() => filterList(historyList, true), [historyList, searchQuery, selectedDate, selectedStore]);

  // Find candidate assignees for the complete form modal
  const eligibleAssignees = useMemo(() => {
    if (!selectedComplaint) return [];
    const store = (selectedComplaint.store_name || '').trim().toLowerCase();

    return usersList.filter((u) => {
      const uShops = (u.shop_name || '')
        .split(',')
        .map((s) => s.trim().toLowerCase());
      return uShops.includes(store);
    });
  }, [selectedComplaint, usersList]);

  // Handlers
  const handleOpenComplete = (row) => {
    setSelectedComplaint(row);
    setFormValues({
      assigned_to: '',
      assigned_date: new Date().toISOString().split('T')[0],
      remarks: '',
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

  const handleSubmitComplete = async (e) => {
    e.preventDefault();
    if (!formValues.assigned_to) {
      toast.error('Please select an assignee.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      // plannedComplaintResolution = timestamp + 30 minutes
      const plannedResolution = new Date(now.getTime() + 30 * 60 * 1000);

      const payload = {
        complaint_id: selectedComplaint.complaint_id,
        assigned_to: formValues.assigned_to,
        assigned_date: formValues.assigned_date,
        remarks: formValues.remarks.trim(),
        planned_complaint_resolution: plannedResolution.toISOString(),
        timestamp: now.toISOString(),
      };

      const { error } = await supabase
        .from('bis_overview_assign_complaint')
        .insert([payload]);

      if (error) throw error;

      toast.success('Complaint task assigned successfully!');
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error submitting assignment:', err);
      toast.error(err.message || 'Failed to submit assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to format date strictly to ISO string "2026-05-18T11:55:43.000Z"
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
      {/* 1. Top Control Bar */}
      <div className="bg-white p-4 border-[0.5px] border-[#1A1A1A]/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter inputs */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
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

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-[#1A1A1A]/20 rounded-md text-xs px-3 py-2 text-[#1A1A1A] focus:outline-none focus:border-[#C9A84C] min-w-[130px]"
            />
          </div>

          {/* Store Selection */}
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

          {/* Refresh Button */}
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

      {/* 2. Pending / History Tabs */}
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

      {/* 3. Main Data Tables */}
      <div className="bg-white border-[0.5px] border-[#1A1A1A]/10 shadow-xs overflow-hidden flex-1 flex flex-col rounded-md">
        <div className="overflow-x-auto custom-scrollbar flex-1">
          {activeTab === 'pending' ? (
            /* Pending Tab Table */
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
                  <th className="py-3 px-3 min-w-[220px]">Planned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#C9A84C]" />
                      <span className="font-medium">Loading pending complaints...</span>
                    </td>
                  </tr>
                ) : filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-slate-400 font-medium">
                      No pending complaints to assign.
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((row, idx) => {
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-3 text-center">
                          <button
                            onClick={() => handleOpenComplete(row)}
                            className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white font-bold text-[10px] uppercase rounded-md tracking-wider transition-colors shadow-xs cursor-pointer"
                          >
                            Complete
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
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatISO(row.planned_assign_complaint)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* History Tab Table */
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
                  <th className="py-3 px-3 min-w-[220px]">Planned</th>
                  <th className="py-3 px-3 min-w-[220px]">Actual</th>
                  <th className="py-3 px-3 min-w-[130px]">Assigned To</th>
                  <th className="py-3 px-3 min-w-[110px]">Assigned Date</th>
                  <th className="py-3 px-3 min-w-[180px]">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={15} className="py-16 text-center text-slate-400">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#C9A84C]" />
                      <span className="font-medium">Loading history records...</span>
                    </td>
                  </tr>
                ) : filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-16 text-center text-slate-400 font-medium">
                      No assignments found in history.
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
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatISO(row.planned_assign_complaint)}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-slate-500">
                          {formatISO(row.timestamp)}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-700">
                          {row.assigned_to || '—'}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {row.assigned_date ? new Date(row.assigned_date).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="py-3.5 px-3 max-w-xs truncate" title={row.remarks}>
                          {row.remarks || '—'}
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

      {/* 4. Complete Task Modal */}
      {isModalOpen && selectedComplaint && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#1C120C] text-white px-5 py-4 flex items-center justify-between border-b border-[#C9A84C]/30">
              <h3 className="text-sm font-bold tracking-wider uppercase font-serif text-white flex items-center gap-2">
                <UserCheck size={16} className="text-[#C9A84C]" />
                Complete Task
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitComplete} className="p-5 space-y-4">
              {/* Summary details card */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-amber-900 text-sm font-mono">
                  {selectedComplaint.complaint_id}
                </div>
                <div className="text-slate-700">
                  <span className="font-medium">{selectedComplaint.customer_name}</span> | {selectedComplaint.contact_no}
                </div>
                <div className="text-slate-500">
                  Store: <span className="font-medium text-slate-700">{selectedComplaint.store_name}</span>
                </div>
                <div className="text-slate-500 font-mono text-[10px] pt-0.5">
                  Planned: {formatISO(selectedComplaint.planned_assign_complaint)}
                </div>
              </div>

              {/* Form Input: Assigned To */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Assigned To *
                </label>
                <select
                  name="assigned_to"
                  value={formValues.assigned_to}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md cursor-pointer"
                >
                  <option value="" disabled>-- Select Assignee --</option>
                  {eligibleAssignees.map((userOpt) => {
                    const dispName = userOpt.user_name || userOpt.username;
                    return (
                      <option key={dispName} value={dispName}>
                        {dispName}
                      </option>
                    );
                  })}
                </select>
                {eligibleAssignees.length === 0 && (
                  <p className="text-[10px] text-rose-500 font-medium mt-1">
                    No users found matching store location: "{selectedComplaint.store_name}"
                  </p>
                )}
              </div>

              {/* Form Input: Assign Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Assign Date *
                </label>
                <input
                  type="date"
                  name="assigned_date"
                  value={formValues.assigned_date}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md"
                />
              </div>

              {/* Form Input: Remarks */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={formValues.remarks}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Enter resolution remarks..."
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md placeholder-slate-400"
                />
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || eligibleAssignees.length === 0}
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
