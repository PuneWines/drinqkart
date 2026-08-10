import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../lib/supabase';
import {
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  X,
  Calendar,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerFeedback() {
  const { user } = useAuth();
  
  // Data State
  const [feedbacks, setFeedbacks] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStore, setSelectedStore] = useState('');

  // Modal / Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formValues, setFormValues] = useState({
    feedback_date: new Date().toISOString().split('T')[0],
    store_name: '',
    customer_name: '',
    contact_no: '',
    preferred_brand: 'Yes / हाँ',
    beer_chilled: 'Yes / हाँ',
    staff_behaviour: 'Excellent',
    suggestion_improvement: '',
  });

  // Access Control: Determine if user can add, edit, or delete
  const { canView, canModify } = useMemo(() => {
    if (!user) return { canView: false, canModify: false };
    const isMasterAdmin = (user.user_name || user.username || '').toLowerCase() === 'masteradmin';
    const userRole = (user.role || '').toLowerCase();
    
    // Master admin and system administrators have full edit rights
    if (isMasterAdmin || userRole === 'admin') {
      return { canView: true, canModify: true };
    }

    const parseList = (r) => {
      if (!r) return [];
      let cur = r;
      while (typeof cur === 'string') {
        try {
          const t = JSON.parse(cur);
          if (t === cur) break;
          cur = t;
        } catch { break; }
      }
      if (Array.isArray(cur)) return cur;
      if (cur && typeof cur === 'object') return Object.keys(cur);
      return [];
    };

    const rawObj = user.master_user_system_page_access;
    const rawStorage = localStorage.getItem('master_user_system_page_access');
    const masterAccessList = [...parseList(rawObj), ...parseList(rawStorage)];

    const hasView = masterAccessList.some(item => {
      if (typeof item !== 'string') return false;
      const itemLower = item.toLowerCase().trim();
      return (
        itemLower === 'business-overview.feedback.view' ||
        itemLower === 'business-overview.feedback.modify' ||
        itemLower === 'business-overview'
      );
    });

    const hasModify = masterAccessList.some(item => {
      if (typeof item !== 'string') return false;
      const itemLower = item.toLowerCase().trim();
      return (
        itemLower === 'business-overview.feedback.modify' ||
        itemLower === 'business-overview'
      );
    });

    return { canView: hasView, canModify: hasModify };
  }, [user]);

  // Fetch feedback records from Supabase
  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bis_overview_customer_feedback')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (err) {
      console.error('Error fetching feedbacks:', err);
      toast.error('Failed to load feedback records.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch shop list for store dropdown selection
  const fetchShops = async () => {
    try {
      const { data, error } = await supabase
        .from('shop')
        .select('shop_name')
        .order('shop_name', { ascending: true });

      if (error) throw error;
      const names = data.map((s) => s.shop_name).filter(Boolean);
      setShops(names);
    } catch (err) {
      console.error('Error fetching shops:', err);
    }
  };

  useEffect(() => {
    fetchFeedbacks();
    fetchShops();
  }, []);

  // Filter feedbacks client-side based on top filter bar inputs
  const filteredFeedbacks = useMemo(() => {
    return feedbacks.filter((row) => {
      // 1. Search Query (Name, Contact, Complaint ID)
      const matchesSearch =
        !searchQuery.trim() ||
        (row.customer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (row.contact_no || '').includes(searchQuery) ||
        (row.complaint_id || '').toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Date Filter
      const matchesDate = !selectedDate || row.feedback_date === selectedDate;

      // 3. Store Filter
      const matchesStore = !selectedStore || row.store_name === selectedStore;

      return matchesSearch && matchesDate && matchesStore;
    });
  }, [feedbacks, searchQuery, selectedDate, selectedStore]);

  // Form handlers
  const handleOpenAdd = () => {
    setEditingRow(null);
    setFormValues({
      feedback_date: new Date().toISOString().split('T')[0],
      store_name: shops[0] || '',
      customer_name: '',
      contact_no: '',
      preferred_brand: 'Yes / हाँ',
      beer_chilled: 'Yes / हाँ',
      staff_behaviour: 'Excellent',
      suggestion_improvement: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (row) => {
    setEditingRow(row);
    setFormValues({
      feedback_date: row.feedback_date || '',
      store_name: row.store_name || '',
      customer_name: row.customer_name || '',
      contact_no: row.contact_no || '',
      preferred_brand: row.preferred_brand || 'Yes / हाँ',
      beer_chilled: row.beer_chilled || 'Yes / हाँ',
      staff_behaviour: row.staff_behaviour || 'Excellent',
      suggestion_improvement: row.suggestion_improvement || '',
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

  const handleContactChange = (e) => {
    // Restrict input to numeric digits only
    const cleanValue = e.target.value.replace(/\D/g, '');
    setFormValues((prev) => ({
      ...prev,
      contact_no: cleanValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValues.store_name) {
      toast.error('Please select a store.');
      return;
    }
    if (!formValues.customer_name.trim()) {
      toast.error('Please enter customer name.');
      return;
    }
    if (!formValues.contact_no.trim()) {
      toast.error('Please enter a contact number.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      // Planned assign complaint window is exactly 30 minutes from the record timestamp
      const plannedDate = new Date(now.getTime() + 30 * 60 * 1000);

      const payload = {
        feedback_date: formValues.feedback_date,
        store_name: formValues.store_name,
        customer_name: formValues.customer_name.trim(),
        contact_no: formValues.contact_no.trim(),
        preferred_brand: formValues.preferred_brand,
        beer_chilled: formValues.beer_chilled,
        staff_behaviour: formValues.staff_behaviour,
        suggestion_improvement: formValues.suggestion_improvement.trim(),
        timestamp: now.toISOString(),
        planned_assign_complaint: plannedDate.toISOString(),
      };

      if (editingRow) {
        // Edit Row
        const { error } = await supabase
          .from('bis_overview_customer_feedback')
          .update(payload)
          .eq('id', editingRow.id);

        if (error) throw error;
        toast.success('Feedback record updated successfully!');
      } else {
        // Add Row
        const { error } = await supabase
          .from('bis_overview_customer_feedback')
          .insert([payload]);

        if (error) throw error;
        toast.success('Feedback record added successfully!');
      }

      setIsModalOpen(false);
      fetchFeedbacks();
    } catch (err) {
      console.error('Error submitting form:', err);
      toast.error(err.message || 'An error occurred during submission.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Are you sure you want to delete complaint ${row.complaint_id}? This will also delete any assignment or resolution details linked to it.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bis_overview_customer_feedback')
        .delete()
        .eq('id', row.id);

      if (error) throw error;
      toast.success(`Complaint ${row.complaint_id} deleted successfully.`);
      fetchFeedbacks();
    } catch (err) {
      console.error('Error deleting record:', err);
      toast.error('Failed to delete complaint record.');
    }
  };

  return (
    <div className="p-4 bg-[#FAFAFA] min-h-screen text-[#1A1A1A] font-sans flex flex-col gap-4">
      {/* 1. Header & Top Control Bar */}
      <div className="bg-white p-4 border-[0.5px] border-[#1A1A1A]/10 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Left Side Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search bar */}
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

          {/* Refresh Button & Records count */}
          <button
            onClick={fetchFeedbacks}
            disabled={loading}
            title="Refresh Feedbacks"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <span className="text-xs text-slate-500 font-medium font-mono shrink-0">
            {filteredFeedbacks.length} records
          </span>
        </div>

        {/* Right Side: Add Button (Visible to both view and modify) */}
        {canView && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1c120c] font-bold text-xs uppercase tracking-wider rounded-md transition-colors shadow-xs cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Add Feedback</span>
          </button>
        )}
      </div>

      {/* 2. Main Data Table */}
      <div className="bg-white border-[0.5px] border-[#1A1A1A]/10 shadow-xs overflow-hidden flex-1 flex flex-col rounded-md">
        <div className="overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1A1A1A] border-b border-[#1A1A1A] text-[#C9A84C] uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[100px]">Feedback Date</th>
                <th className="py-3 px-3 min-w-[100px]">Complaint ID</th>
                <th className="py-3 px-3 min-w-[120px]">Store Name</th>
                <th className="py-3 px-3 min-w-[140px]">Customer Name / ग्राहक नाम</th>
                <th className="py-3 px-3 min-w-[110px]">Contact No / मोबाइल नंबर</th>
                <th className="py-3 px-3 min-w-[140px]">Preferred Brand? (पसंद के अनुसार ब्रांड?)</th>
                <th className="py-3 px-3 min-w-[130px]">Beer Chilled? (बीयर पर्याप्त ठंडी थी?)</th>
                <th className="py-3 px-3 min-w-[110px]">Staff Behaviour</th>
                <th className="py-3 px-3 min-w-[200px]">Suggestion / Improvement (सुझाव / सुधार)</th>
                {canModify && <th className="py-3 px-3 w-20 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={canModify ? 11 : 10} className="py-16 text-center text-slate-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-[#C9A84C]" />
                    <span className="font-medium">Loading feedback records...</span>
                  </td>
                </tr>
              ) : filteredFeedbacks.length === 0 ? (
                <tr>
                  <td colSpan={canModify ? 11 : 10} className="py-16 text-center text-slate-400 font-medium">
                    No customer feedback records found.
                  </td>
                </tr>
              ) : (
                filteredFeedbacks.map((row, idx) => {
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-3.5 px-3 font-medium whitespace-nowrap">
                        {row.feedback_date ? new Date(row.feedback_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#8C6D23] font-mono">
                        {row.complaint_id || '—'}
                      </td>
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
                        {row.suggestion_improvement || <span className="text-slate-300 italic">No suggestion</span>}
                      </td>
                      {canModify && (
                        <td className="py-3.5 px-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenEdit(row)}
                              className="p-1 text-slate-400 hover:text-[#C9A84C] transition-colors rounded hover:bg-slate-100"
                              title="Edit Record"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded hover:bg-slate-100"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 border-t border-[#1A1A1A]/10 text-center shrink-0">
          <p className="text-[10px] text-gray-400 font-sans">Powered by <span className="font-bold text-[#8C6D23]">Botivate</span></p>
        </div>
      </div>

      {/* 3. Single-View Add/Edit Feedback Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#1C120C] text-white px-5 py-4 flex items-center justify-between border-b border-[#C9A84C]/30">
              <h3 className="text-sm font-bold tracking-wider uppercase font-serif text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-[#C9A84C]" />
                {editingRow ? 'Edit Customer Feedback' : 'Add Customer Feedback'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto max-h-[80vh] space-y-4 custom-scrollbar">
              {/* Row 1: Select Store */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Select Store / दुकान चुनें *
                </label>
                <select
                  name="store_name"
                  value={formValues.store_name}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md"
                >
                  <option value="" disabled>-- Select Store --</option>
                  {shops.map((shop) => (
                    <option key={shop} value={shop}>
                      {shop}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 2: Customer Name */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Customer Name / ग्राहक नाम *
                </label>
                <input
                  type="text"
                  name="customer_name"
                  value={formValues.customer_name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter customer name"
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md placeholder-slate-400"
                />
              </div>

              {/* Row 3: Contact No */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Contact No / मोबाइल नंबर *
                </label>
                <input
                  type="text"
                  name="contact_no"
                  value={formValues.contact_no}
                  onChange={handleContactChange}
                  required
                  maxLength={15}
                  placeholder="Enter mobile number"
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-[#C9A84C] rounded-md placeholder-slate-400"
                />
              </div>

              {/* Row 4: Feedback Date */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Feedback Date *
                </label>
                <input
                  type="date"
                  name="feedback_date"
                  value={formValues.feedback_date}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-white border border-slate-300 text-slate-800 px-3.5 py-2 text-xs focus:outline-none focus:border-[#C9A84C] rounded-md"
                />
              </div>

              {/* Row 5: Preferred Brand */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Did You Receive Your Preferred Brand? (क्या आपको आपकी पसंद के अनुसार ब्रांड दिया गया?) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, preferred_brand: 'Yes / हाँ' }))}
                    className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                      formValues.preferred_brand === 'Yes / हाँ'
                        ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Yes / हाँ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, preferred_brand: 'No / नहीं' }))}
                    className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                      formValues.preferred_brand === 'No / नहीं'
                        ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    No / नहीं
                  </button>
                </div>
              </div>

              {/* Row 6: Beer Chilled */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Was the beer chilled enough? (क्या बीयर आपके लिए पर्याप्त ठंडी थी?) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, beer_chilled: 'Yes / हाँ' }))}
                    className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                      formValues.beer_chilled === 'Yes / हाँ'
                        ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Yes / हाँ
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormValues((prev) => ({ ...prev, beer_chilled: 'No / नहीं' }))}
                    className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                      formValues.beer_chilled === 'No / नहीं'
                        ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    No / नहीं
                  </button>
                </div>
              </div>

              {/* Row 7: Staff Behaviour */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Staff Behaviour / स्टाफ का व्यवहार *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Excellent', 'Good', 'Average', 'Poor'].map((beh) => {
                    const isSelected = formValues.staff_behaviour === beh;
                    return (
                      <button
                        key={beh}
                        type="button"
                        onClick={() => setFormValues((prev) => ({ ...prev, staff_behaviour: beh }))}
                        className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C]'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {beh}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 8: Suggestions */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Suggestion / Improvement (सुझाव / सुधार)
                </label>
                <textarea
                  name="suggestion_improvement"
                  value={formValues.suggestion_improvement}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Enter your suggestion..."
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
                  disabled={submitting}
                  className="px-6 py-2 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1c120c] text-xs font-bold uppercase tracking-wider rounded-md transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingRow ? 'Save Changes' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
