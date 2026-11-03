import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, X, Check, Clock, Wallet, Banknote, Stethoscope, Hammer, Loader2,
  Filter, Users, TrendingUp, Database, Plus, Trash2, Pencil, Calendar,
  Building2, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, RefreshCw,
  DollarSign, FileText, CheckCircle2, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { getPagePermission } from '../../../utils/permissionUtils';
import useHrShopScope from '../hooks/useHrShopScope';

const formatStartingMonth = (monthStr) => {
  if (!monthStr) return '-';
  try {
    const [year, month] = monthStr.split('-');
    if (year && month) {
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
  } catch (e) {
    // ignore
  }
  return monthStr;
};

const AdminAdvance = () => {
  const { user: authUser } = useAuth();
  const canModify = getPagePermission(authUser, 'hr', 'Admin Advance').canModify;
  const [searchTerm, setSearchTerm] = useState('');
  const [mainTab, setMainTab] = useState('monthly'); // 'monthly' | 'fixed'
  const [subTab, setSubTab] = useState('pending');   // 'pending' | 'history'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [rawMonthlyPending, setMonthlyPending] = useState([]);
  const [rawMonthlyHistory, setMonthlyHistory] = useState([]);

  const [rawFixedPending, setFixedPending] = useState([]);
  const [rawFixedReceived, setFixedReceived] = useState([]);

  // Shop-based access control + shop filter
  const { allowedSet, isShopAllowed, resolveShopName, shopNames, isScoped } = useHrShopScope();
  const [selectedShop, setSelectedShop] = useState('ALL');
  const scopeList = (list) => list.filter(r => isShopAllowed(r.shopName));
  const monthlyPending = useMemo(() => scopeList(rawMonthlyPending), [rawMonthlyPending, allowedSet]);
  const monthlyHistory = useMemo(() => scopeList(rawMonthlyHistory), [rawMonthlyHistory, allowedSet]);
  const fixedPending = useMemo(() => scopeList(rawFixedPending), [rawFixedPending, allowedSet]);
  const fixedReceived = useMemo(() => scopeList(rawFixedReceived), [rawFixedReceived, allowedSet]);

  const [loading, setLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('Pending');
  const [addModalType, setAddModalType] = useState('Pending');
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState({ amount: '', monthlyDeduction: '', remainingAmount: '', startingMonth: '', reason: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [approvedAmount, setApprovedAmount] = useState('');
  const [approvedMonthlyDeduction, setApprovedMonthlyDeduction] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  const [allEmployeesList, setEmployeesList] = useState([]);
  const employeesList = useMemo(
    () => allEmployeesList.filter(emp => isShopAllowed(emp.joining_company_name)),
    [allEmployeesList, allowedSet]
  );
  const shopOptions = useMemo(
    () => shopNames.filter(isShopAllowed),
    [shopNames, isShopAllowed]
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmpId, setNewEmpId] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDeduction, setNewDeduction] = useState('');
  const [newType, setNewType] = useState('Monthly Advance');
  const [newReason, setNewReason] = useState('');
  const [empSearch, setEmpSearch] = useState('');
  const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
  const getCurrentMonthStr = () => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  };
  const [newStartingMonth, setNewStartingMonth] = useState(getCurrentMonthStr());
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setTableLoading(true);
    try {
      // 1. Fetch active employees to resolve names
      const { data: dbEmployees, error: empError } = await supabase
        .from('hr_management_employees')
        .select('employee_id, name_as_per_aadhar, joining_company_name');

      if (empError) throw empError;
      setEmployeesList(dbEmployees || []);

      const employeeMap = {};
      const employeeShopMap = {};
      (dbEmployees || []).forEach(emp => {
        if (emp.employee_id) {
          const key = emp.employee_id.toLowerCase().trim();
          employeeMap[key] = emp.name_as_per_aadhar;
          employeeShopMap[key] = (emp.joining_company_name || '').trim();
        }
      });

      // 2. Fetch advance requests from Supabase
      const { data: advances, error: advError } = await supabase
        .from('hr_management_advance_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (advError) {
        if (advError.code === '42P01' || advError.message?.includes('relation "advance_requests" does not exist')) {
          setShowSchemaModal(true);
          throw new Error("Table 'advance_requests' does not exist in Supabase.");
        } else {
          throw advError;
        }
      }

      // 3. Fetch payment logs for remaining amount calculation
      let paymentsList = [];
      try {
        const { data: payments, error: payError } = await supabase
          .from('hr_management_advance_payments')
          .select('*')
          .order('created_at', { ascending: false });
        if (!payError && payments) paymentsList = payments;
      } catch (e) {
        console.warn("hr_management_advance_payments not available yet");
      }

      // Group payments by advance_id
      const paymentsGroupedByAdvId = {};
      paymentsList.forEach(p => {
        if (p.advance_id) {
          if (!paymentsGroupedByAdvId[p.advance_id]) paymentsGroupedByAdvId[p.advance_id] = [];
          paymentsGroupedByAdvId[p.advance_id].push(p);
        }
      });

      const allRecords = (advances || []).map((adv) => {
        const empKey = adv.employee_id ? adv.employee_id.toLowerCase().trim() : '';
        const rawRemAmt = adv.remaining_amount !== undefined && adv.remaining_amount !== null
          ? Number(adv.remaining_amount)
          : (adv.approved_amount ? Number(adv.approved_amount) : Number(adv.amount) || 0);

        const remAmt = isNaN(rawRemAmt) ? 0 : rawRemAmt;

        return {
          id: adv.id,
          timestamp: adv.created_at,
          empId: adv.employee_id,
          empName: employeeMap[empKey] || adv.employee_id || 'Unknown',
          shopName: employeeShopMap[empKey] || '',
          amount: adv.amount,
          monthlyDeduction: adv.monthly_deduction,
          reason: adv.reason || '',
          status: adv.status || 'Pending',
          type: adv.type || 'Advance',
          apprAmount: adv.approved_amount || '',
          apprMonthlyDeduction: adv.approved_monthly_deduction || '',
          adminRemarks: adv.admin_remarks || '',
          startingMonth: adv.starting_month || '',
          remainingAmount: remAmt,
          payments: paymentsGroupedByAdvId[adv.id] || []
        };
      });

      const isFixed = (type) => {
        const t = (type || '').toLowerCase();
        return ['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(t);
      };
      const isMonthly = (type) => !isFixed(type);

      // Monthly Advance:
      // Pending = all active monthly advances where remainingAmount > 0 and not rejected
      setMonthlyPending(allRecords.filter(r => isMonthly(r.type) && r.status?.toLowerCase() !== 'rejected' && (r.remainingAmount === undefined || r.remainingAmount === null || r.remainingAmount > 0)));
      // History = settled monthly advances (remainingAmount <= 0) or rejected
      setMonthlyHistory(allRecords.filter(r => isMonthly(r.type) && (r.status?.toLowerCase() === 'rejected' || (r.remainingAmount !== undefined && r.remainingAmount !== null && r.remainingAmount <= 0))));

      // Fixed Advance:
      // Pending = active fixed advances awaiting collection/payment (remainingAmount > 0 and not rejected)
      setFixedPending(allRecords.filter(r => isFixed(r.type) && r.status?.toLowerCase() !== 'rejected' && (r.remainingAmount === undefined || r.remainingAmount === null || r.remainingAmount > 0)));
      // History = settled fixed advances (remainingAmount <= 0) or rejected/received
      setFixedReceived(allRecords.filter(r => isFixed(r.type) && (r.status?.toLowerCase() === 'rejected' || r.status?.toLowerCase() === 'received' || (r.remainingAmount !== undefined && r.remainingAmount !== null && r.remainingAmount <= 0))));

    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to fetch advance requests from Supabase");
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedShop, mainTab, subTab]);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!canModify) return;
    if (!newEmpId) {
      toast.error("Please select an employee");
      return;
    }
    if (!newAmount || Number(newAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const isFixed = newType === 'Fixed Amount';
    const deductionValue = isFixed ? Number(newAmount) : Number(newDeduction);

    if (!isFixed) {
      if (!newDeduction || Number(newDeduction) <= 0) {
        toast.error("Please enter a valid monthly deduction");
        return;
      }
      if (Number(newDeduction) > Number(newAmount)) {
        toast.error("Monthly deduction cannot be greater than the total amount");
        return;
      }
    }

    setIsSubmittingNew(true);
    try {
      const { error } = await supabase
        .from('hr_management_advance_requests')
        .insert({
          employee_id: newEmpId,
          amount: Number(newAmount),
          monthly_deduction: deductionValue,
          type: newType,
          reason: newReason,
          starting_month: newStartingMonth || null,
          status: addModalType
        });

      if (error) throw error;

      toast.success("Advance request created successfully!");
      setShowAddModal(false);
      // Reset form
      setNewEmpId('');
      setNewAmount('');
      setNewDeduction('');
      setNewType('Monthly Advance');
      setNewReason('');
      setNewStartingMonth(getCurrentMonthStr());
      setEmpSearch('');
      setAddModalType('Pending');
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create request: " + err.message);
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!canModify) return;
    if (!window.confirm("Are you sure you want to delete this advance request?")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('hr_management_advance_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Advance request deleted successfully");
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete request: " + err.message);
    }
  };

  const openEditModal = (record) => {
    const effAmount = (record.apprAmount || record.amount || 0);
    const effDeduction = (record.apprMonthlyDeduction || record.monthlyDeduction || 0);
    setEditForm({
      amount: effAmount,
      monthlyDeduction: effDeduction,
      remainingAmount: record.remainingAmount !== undefined && record.remainingAmount !== null ? record.remainingAmount : effAmount,
      startingMonth: record.startingMonth || '',
      reason: record.reason || ''
    });
    setEditRecord(record);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!canModify || !editRecord) return;
    const amount = Number(editForm.amount);
    const deduction = Number(editForm.monthlyDeduction);
    const remaining = Number(editForm.remainingAmount);
    if (!(amount > 0)) return toast.error('Please enter a valid amount');
    if (!(deduction > 0)) return toast.error('Please enter a valid monthly deduction');
    if (deduction > amount) return toast.error('Monthly deduction cannot be greater than the total amount');
    if (remaining < 0 || remaining > amount) return toast.error('Remaining amount must be between 0 and the total amount');

    setIsSavingEdit(true);
    try {
      const updateData = {
        amount,
        monthly_deduction: deduction,
        remaining_amount: remaining,
        starting_month: editForm.startingMonth || null,
        reason: editForm.reason
      };
      // Keep approved values in sync if they were already set (they take display priority)
      if (editRecord.apprAmount) updateData.approved_amount = amount;
      if (editRecord.apprMonthlyDeduction) updateData.approved_monthly_deduction = deduction;

      const { error } = await supabase
        .from('hr_management_advance_requests')
        .update(updateData)
        .eq('id', editRecord.id);
      if (error) throw error;

      toast.success('Advance updated successfully');
      setEditRecord(null);
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update advance: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openReviewModal = (request) => {
    setSelectedRequest(request);
    setApprovedAmount(request.apprAmount || request.amount || '');

    const isFixed = ['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(request.type?.toLowerCase());
    setApprovedMonthlyDeduction(isFixed ? (request.apprAmount || request.amount || '') : (request.apprMonthlyDeduction || request.monthlyDeduction || ''));

    setRemarks(request.adminRemarks || '');
    setReceiveAmount('');
    setShowModal(true);
  };

  const handleAction = async (actionStatus) => {
    if (!canModify) return;
    setSubmitting(true);
    try {
      const isFixed = ['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase());

      const updateData = {
        status: actionStatus,
        admin_remarks: remarks
      };

      if (actionStatus === 'Approved') {
        const apprAmt = approvedAmount ? Number(approvedAmount) : Number(selectedRequest.amount);
        const apprDed = isFixed ? apprAmt : (approvedMonthlyDeduction ? Number(approvedMonthlyDeduction) : Number(selectedRequest.monthlyDeduction));

        if (!isFixed && apprDed > apprAmt) {
          toast.error("Monthly deduction cannot be greater than approved amount");
          setSubmitting(false);
          return;
        }

        updateData.approved_amount = apprAmt;
        updateData.approved_monthly_deduction = apprDed;
        updateData.remaining_amount = apprAmt;
      } else if (actionStatus === 'Received') {
        const currentRemaining = selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null
          ? parseNumber(selectedRequest.remainingAmount)
          : parseNumber(selectedRequest.apprAmount || selectedRequest.amount || 0);

        const recAmt = Number(receiveAmount);
        if (isNaN(recAmt) || recAmt <= 0) {
          toast.error("Please enter a valid receive amount greater than 0");
          setSubmitting(false);
          return;
        }
        if (recAmt > currentRemaining) {
          toast.error(`Received amount cannot exceed remaining amount (₹${currentRemaining.toLocaleString()})`);
          setSubmitting(false);
          return;
        }

        const newRemaining = currentRemaining - recAmt;
        updateData.remaining_amount = newRemaining;

        if (newRemaining <= 0) {
          updateData.status = 'Received';
        } else {
          updateData.status = selectedRequest.status || 'Approved';
        }
        // Insert payment log entry
        try {
          await supabase
            .from('hr_management_advance_payments')
            .insert({
              advance_id: selectedRequest.id,
              employee_id: selectedRequest.empId,
              amount: recAmt,
              remarks: remarks || 'Received partial/full payment'
            });
        } catch (payErr) {
          console.warn("Failed to log payment transaction:", payErr);
        }
      }

      const { error: updateError } = await supabase
        .from('hr_management_advance_requests')
        .update(updateData)
        .eq('id', selectedRequest.id);

      if (updateError) throw updateError;

      toast.success(actionStatus === 'Received' ? 'Payment received successfully!' : `Request ${actionStatus.toLowerCase()} successfully!`);
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Update error:", err);
      toast.error("Failed to update status in Supabase: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredData = () => {
    let list = [];
    if (mainTab === 'monthly') {
      if (subTab === 'history') list = monthlyHistory;
      else list = monthlyPending;
    } else {
      if (subTab === 'history') list = fixedReceived;
      else list = fixedPending;
    }

    if (selectedShop !== 'ALL') {
      list = list.filter(item => resolveShopName(item.shopName).toLowerCase() === selectedShop.toLowerCase());
    }

    return list.filter(item =>
      item.empName?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
      item.empId?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
      item.type?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
      item.adminRemarks?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '') ||
      item.reason?.toString().toLowerCase().includes(searchTerm?.toLowerCase() || '')
    );
  };

  const parseNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    const cleanStr = String(val).replace(/[^0-9.-]+/g, '');
    const num = Number(cleanStr);
    return isNaN(num) ? 0 : num;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Medical Amount': return <Stethoscope size={14} className="text-blue-500 shrink-0" />;
      case 'Brackage': return <Hammer size={14} className="text-orange-500 shrink-0" />;
      default: return <Banknote size={14} className="text-emerald-500 shrink-0" />;
    }
  };

  // KPI Calculations
  const allFilteredData = getFilteredData();
  const totalCount = allFilteredData.length;
  const totalSanctionedSum = allFilteredData.reduce((sum, r) => sum + parseNumber((r.status === 'Approved' || r.status === 'Received') && r.apprAmount ? r.apprAmount : r.amount), 0);
  const totalDeductionSum = allFilteredData.reduce((sum, r) => sum + parseNumber((r.status === 'Approved' || r.status === 'Received') && r.apprMonthlyDeduction ? r.apprMonthlyDeduction : r.monthlyDeduction), 0);
  const totalRemainingSum = allFilteredData.reduce((sum, r) => sum + parseNumber(r.remainingAmount !== undefined && r.remainingAmount !== null ? r.remainingAmount : ((r.status === 'Approved' || r.status === 'Received') && r.apprAmount ? r.apprAmount : r.amount)), 0);

  // Pagination
  const totalPages = Math.ceil(totalCount / pageSize);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedRecords = allFilteredData.slice((activePage - 1) * pageSize, activePage * pageSize);

  return (
    <div className="p-3.5 sm:p-4 md:p-5 bg-slate-50/50 min-h-screen w-full max-w-full overflow-x-hidden text-slate-800 font-sans text-xs">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 font-sans">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Wallet size={18} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
                Admin Advance & Deductions
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                Live Sync
              </span>
            </div>
            <p className="text-slate-500 text-[11px] mt-0.5 font-sans">
              Review, sanction, and manage employee monthly advances and fixed deposit deductions
            </p>
          </div>
        </div>

        {canModify && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchData}
              disabled={loading}
              className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-200 !rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 font-sans"
              title="Refresh requests"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            {/* Create button hidden on Monthly Advance tab; visible only on Fixed Advance tab */}
            {mainTab === 'fixed' && (
              <button
                onClick={() => {
                  setAddModalType('Approved');
                  setNewType('Fixed Amount');
                  setShowAddModal(true);
                }}
                className="h-8 px-3.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs !rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 font-sans"
              >
                <Plus size={14} />
                Add Fixed Advance
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Advances</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users size={13} />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">{totalCount}</span>
            <span className="text-[10px] font-semibold text-slate-500">records</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{mainTab === 'monthly' ? 'Monthly category' : 'Fixed category'}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sanctioned Amount</span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <DollarSign size={13} />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">₹{totalSanctionedSum.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Approved principal sum</p>
        </div>

        {mainTab === 'monthly' ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Recovery</span>
              <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp size={13} />
              </div>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold text-amber-600 font-mono tabular-nums">₹{totalDeductionSum.toLocaleString()}</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Per-month salary deduction</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Settled Sum</span>
              <div className="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <CheckCircle2 size={13} />
              </div>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold text-teal-600 font-mono tabular-nums">
                ₹{Math.max(0, totalSanctionedSum - totalRemainingSum).toLocaleString()}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Recovered / received</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Remaining Balance</span>
            <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Wallet size={13} />
            </div>
          </div>
          <div className="mt-1">
            <span className="text-xl font-bold text-rose-600 font-mono tabular-nums">₹{totalRemainingSum.toLocaleString()}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5 font-medium">Outstanding recovery</p>
        </div>
      </div>

      {/* 3. Navigation Toolbar & Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3 mb-4 shadow-2xs flex flex-col gap-2.5">
        {/* Top Toolbar: Category Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
          {/* Main Segmented Category Pills */}
          <div className="inline-flex p-0.5 bg-slate-100/90 rounded-lg border border-slate-200/70 self-start">
            <button
              type="button"
              onClick={() => {
                setMainTab('monthly');
                setSubTab('pending');
              }}
              className={`h-7 px-3 text-[11px] font-bold !rounded-md transition-all cursor-pointer flex items-center gap-1.5 font-sans ${
                mainTab === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Banknote size={12} className={mainTab === 'monthly' ? 'text-indigo-600' : 'text-slate-400'} />
              <span>Monthly Advance</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                mainTab === 'monthly' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-600'
              }`}>
                {monthlyPending.length + monthlyHistory.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMainTab('fixed');
                setSubTab('pending');
              }}
              className={`h-7 px-3 text-[11px] font-bold !rounded-md transition-all cursor-pointer flex items-center gap-1.5 font-sans ${
                mainTab === 'fixed'
                  ? 'bg-white text-teal-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Wallet size={12} className={mainTab === 'fixed' ? 'text-teal-600' : 'text-slate-400'} />
              <span>Fixed Advance</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                mainTab === 'fixed' ? 'bg-teal-50 text-teal-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {fixedPending.length + fixedReceived.length}
              </span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search employee, ID, reason, type..."
              className="w-full h-8 pl-8 pr-7 bg-slate-50/80 hover:bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 !rounded cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Bottom Toolbar: Status Filter & Shop Filter */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Segment (Pending / History) */}
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setSubTab('pending')}
                className={`h-7 px-3 text-[11px] font-bold !rounded-md transition-all cursor-pointer flex items-center gap-1.5 font-sans ${
                  subTab === 'pending'
                    ? 'bg-white text-orange-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock size={11} />
                <span>Pending</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                  subTab === 'pending' ? 'bg-orange-50 text-orange-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {mainTab === 'monthly' ? monthlyPending.length : fixedPending.length}
                </span>
              </button>

              <button
                onClick={() => setSubTab('history')}
                className={`h-7 px-3 text-[11px] font-bold !rounded-md transition-all cursor-pointer flex items-center gap-1.5 font-sans ${
                  subTab === 'history'
                    ? 'bg-white text-slate-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check size={11} />
                <span>History</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold ${
                  subTab === 'history' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {mainTab === 'monthly' ? monthlyHistory.length : fixedReceived.length}
                </span>
              </button>
            </div>

            {/* Shop Selector */}
            <div className="h-8 flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 px-2.5 rounded-lg text-[11px] transition-colors relative">
              <Building2 size={13} className="text-slate-400 shrink-0" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Shop</span>
              <select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                className="bg-transparent focus:outline-none font-bold text-slate-700 cursor-pointer pr-4 max-w-[150px] truncate"
              >
                <option value="ALL">{isScoped ? 'All My Shops' : 'All Shops'}</option>
                {shopOptions.map(shop => (
                  <option key={shop} value={shop}>{shop}</option>
                ))}
              </select>
              <ChevronDown size={11} className="text-slate-400 absolute right-2 pointer-events-none" />
            </div>

            {/* Reset Filter Button */}
            {(selectedShop !== 'ALL' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedShop('ALL');
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="h-8 px-2.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 !rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-dashed border-slate-200 font-sans"
                title="Reset active filters"
              >
                <RotateCcw size={11} />
                Reset
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-700 font-mono">{allFilteredData.length}</span> matching record{allFilteredData.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* 4. Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[66vh] scrollbar-thin max-w-full">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-[11px] shadow-2xs">
              <tr>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-left whitespace-nowrap">Date</th>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-left min-w-[200px]">Employee</th>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-left whitespace-nowrap">Category</th>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-right whitespace-nowrap">Amount</th>
                {mainTab === 'monthly' && (
                  <th className="px-3.5 py-2.5 font-bold text-slate-600 text-right whitespace-nowrap">Monthly Deduction</th>
                )}
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-right whitespace-nowrap">Remain Amount</th>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-center whitespace-nowrap">Starting Month</th>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-left max-w-xs">Reason</th>
                <th className="px-3.5 py-2.5 font-bold text-slate-600 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-xs">
              {tableLoading ? (
                <tr>
                  <td colSpan={mainTab === 'monthly' ? 9 : 8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="w-7 h-7 text-indigo-600 animate-spin" />
                      <span className="text-xs font-semibold text-slate-700">Loading advance records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={mainTab === 'monthly' ? 9 : 8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-1.5">
                      <Search size={36} className="text-slate-300" />
                      <p className="text-xs font-bold text-slate-700">No advance requests found</p>
                      <p className="text-[11px] text-slate-400">Try adjusting your search query or shop filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((record) => {
                  const isPettyCash = Boolean(record.adminRemarks && record.adminRemarks.toLowerCase().includes('petty cash'));
                  const currentApprAmount = (record.status === 'Approved' || record.status === 'Received') && record.apprAmount ? record.apprAmount : record.amount;
                  const currentApprDeduction = (record.status === 'Approved' || record.status === 'Received') && record.apprMonthlyDeduction ? record.apprMonthlyDeduction : record.monthlyDeduction;
                  const currentRemAmount = record.remainingAmount !== undefined && record.remainingAmount !== null ? record.remainingAmount : currentApprAmount;

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors bg-white">
                      {/* Date */}
                      <td className="px-3.5 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {formatDate(record.timestamp)}
                      </td>

                      {/* Employee */}
                      <td className="px-3.5 py-2">
                        <div className="flex items-center gap-2 min-w-[180px]">
                          <div className="w-6.5 h-6.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {record.empName?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0 flex flex-col">
                            <span className="font-bold text-slate-900 text-xs truncate leading-tight">
                              {record.empName}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5 leading-none">
                              <span className="font-mono text-[11px] text-slate-400">
                                ID: {record.empId}
                              </span>
                              {record.shopName && (
                                <span className="text-[11px] text-slate-400 truncate max-w-[80px]">
                                  • {record.shopName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-3.5 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            mainTab === 'fixed'
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}>
                            {getTypeIcon(record.type)}
                            <span>{record.type}</span>
                          </span>
                          {isPettyCash && (
                            <span className="px-1.5 py-0.5 text-[10px] bg-sky-50 text-sky-700 border border-sky-200 rounded font-semibold whitespace-nowrap">
                              Petty Cash
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-3.5 py-2 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-slate-900 text-xs">
                          ₹{parseNumber(currentApprAmount).toLocaleString()}
                        </span>
                      </td>

                      {/* Monthly Deduction */}
                      {mainTab === 'monthly' && (
                        <td className="px-3.5 py-2 text-right whitespace-nowrap">
                          <span className="font-mono font-semibold text-orange-600 text-xs">
                            ₹{parseNumber(currentApprDeduction).toLocaleString()}
                          </span>
                        </td>
                      )}

                      {/* Remain Amount */}
                      <td className="px-3.5 py-2 text-right whitespace-nowrap">
                        <span className="font-mono font-bold text-emerald-600 text-xs">
                          ₹{parseNumber(currentRemAmount).toLocaleString()}
                        </span>
                      </td>

                      {/* Starting Month */}
                      <td className="px-3.5 py-2 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] text-slate-700 font-semibold">
                          <Calendar size={11} className="text-slate-400" />
                          {formatStartingMonth(record.startingMonth)}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="px-3.5 py-2 text-slate-600 text-[11px] max-w-xs truncate" title={record.reason}>
                        {record.reason || '—'}
                      </td>

                      {/* Action */}
                      <td className="px-3.5 py-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openReviewModal(record)}
                            className={`h-7 px-2.5 text-[11px] font-semibold !rounded-lg transition-colors cursor-pointer flex items-center gap-1 font-sans ${
                              record.status?.toLowerCase() === 'pending'
                                ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/70'
                                : (mainTab === 'fixed' && subTab === 'pending')
                                  ? 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200/70'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70'
                            }`}
                          >
                            {record.status?.toLowerCase() === 'pending' ? 'Review' : (mainTab === 'fixed' && subTab === 'pending') ? 'Receive' : 'Details'}
                          </button>

                          {canModify && mainTab === 'monthly' && (
                            <button
                              onClick={() => openEditModal(record)}
                              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 !rounded-lg transition-colors cursor-pointer border border-slate-200/70"
                              title="Edit Advance"
                            >
                              <Pencil size={13} />
                            </button>
                          )}

                          {canModify && (
                            <button
                              onClick={() => handleDeleteRequest(record.id)}
                              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 !rounded-lg transition-colors cursor-pointer border border-slate-200/70"
                              title="Delete Request"
                            >
                              <Trash2 size={13} />
                            </button>
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

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-2.5 bg-slate-50/90 border-t border-slate-200/80 text-[11px] gap-2.5">
            <div className="text-slate-500 font-medium text-[11px] whitespace-nowrap">
              Showing <span className="font-bold text-slate-800 font-mono">{(activePage - 1) * pageSize + 1}–{Math.min(activePage * pageSize, totalCount)}</span> of <span className="font-bold text-slate-800 font-mono">{totalCount}</span> records
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={activePage === 1}
                onClick={() => setCurrentPage(activePage - 1)}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold !rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 text-[11px] font-sans"
              >
                <ChevronLeft size={13} />
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => page === 1 || page === totalPages || Math.abs(page - activePage) <= 1)
                  .map((page, index, arr) => {
                    const showEllipsis = index > 0 && page - arr[index - 1] > 1;
                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && <span className="text-slate-400 px-0.5 font-mono text-[10px]">...</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`min-w-[28px] h-7 px-1.5 font-mono text-[11px] font-bold !rounded-md border transition-all cursor-pointer flex items-center justify-center ${
                            activePage === page
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>
              <button
                disabled={activePage === totalPages}
                onClick={() => setCurrentPage(activePage + 1)}
                className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold !rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 text-[11px] font-sans"
              >
                Next
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Review / Receive / Details Modal */}
      {showModal && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setShowModal(false)}>
          <div className="bg-white !rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto font-sans" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                <Wallet size={16} className="text-indigo-600" />
                {selectedRequest.status?.toLowerCase() === 'pending' ? 'Review Advance Request' : (mainTab === 'fixed' && subTab === 'pending') ? 'Receive Advance Payment' : 'Advance Request Details'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 !rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 border border-slate-200/80 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Employee</span>
                  <span className="font-bold text-slate-900">{selectedRequest.empName} ({selectedRequest.empId})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Category</span>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    {getTypeIcon(selectedRequest.type)}
                    <span>{selectedRequest.type}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Requested Amount</span>
                  <span className="font-mono font-bold text-indigo-600">₹{parseNumber(selectedRequest.amount).toLocaleString()}</span>
                </div>
                {!['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase()) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Requested Monthly Deduction</span>
                    <span className="font-mono font-bold text-orange-600">₹{parseNumber(selectedRequest.monthlyDeduction).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Current Remaining Amount</span>
                  <span className="font-mono font-bold text-emerald-600">
                    ₹{parseNumber(selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : (selectedRequest.apprAmount || selectedRequest.amount || 0)).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Starting Month</span>
                  <span className="font-semibold text-slate-800">{formatStartingMonth(selectedRequest.startingMonth)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-1">Reason</span>
                  <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                    {selectedRequest.reason || 'No specific reason provided'}
                  </p>
                </div>
                {selectedRequest.adminRemarks && (
                  <div>
                    <span className="text-slate-500 font-medium block mb-1">Source / Voucher Reference</span>
                    <p className="text-[11px] text-indigo-700 bg-indigo-50/70 p-2 rounded-lg border border-indigo-200/60 font-mono font-semibold">
                      {selectedRequest.adminRemarks}
                    </p>
                  </div>
                )}
              </div>

              {selectedRequest.payments && selectedRequest.payments.length > 0 && (
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">Payment Transactions History ({selectedRequest.payments.length})</h4>
                  <div className="divide-y divide-slate-200 max-h-36 overflow-y-auto pr-1">
                    {selectedRequest.payments.map((p, pIdx) => (
                      <div key={pIdx} className="py-2 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-mono font-bold text-slate-800">₹{parseNumber(p.amount).toLocaleString()}</p>
                          <p className="text-[10px] text-slate-500">{p.remarks || 'Partial/Full Payment'}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{formatDate(p.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mainTab === 'fixed' && subTab === 'pending' && selectedRequest.status?.toLowerCase() !== 'pending' && (
                <div className="bg-teal-50/50 p-4 border border-teal-200/80 rounded-xl space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-teal-900">
                        Receive Payment Amount (₹)
                      </label>
                      <span className="text-[11px] font-semibold text-teal-700 font-mono">
                        Max: ₹{parseNumber(selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : (selectedRequest.apprAmount || selectedRequest.amount || 0)).toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : (selectedRequest.apprAmount || selectedRequest.amount || 0)}
                      className={`w-full px-3 py-2 border text-xs rounded-lg focus:outline-none focus:ring-1 font-mono font-semibold ${
                        receiveAmount && Number(receiveAmount) > Number(selectedRequest.remainingAmount !== undefined && selectedRequest.remainingAmount !== null ? selectedRequest.remainingAmount : (selectedRequest.apprAmount || selectedRequest.amount || 0))
                          ? 'border-red-300 focus:ring-red-500 bg-red-50 text-red-700'
                          : 'border-teal-300 focus:ring-teal-500 bg-white text-teal-900'
                      }`}
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                      disabled={submitting}
                      placeholder="Enter amount to receive"
                    />
                  </div>
                </div>
              )}

              {(selectedRequest.status?.toLowerCase() === 'pending' || (selectedRequest.status?.toLowerCase() !== 'pending' && !(mainTab === 'fixed' && subTab === 'pending') && (selectedRequest.status === 'Approved' || selectedRequest.status === 'Received'))) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className={['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase()) ? "col-span-2" : ""}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Amount (₹)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono font-semibold"
                      value={approvedAmount}
                      onChange={(e) => {
                        setApprovedAmount(e.target.value);
                        if (['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase())) {
                          setApprovedMonthlyDeduction(e.target.value);
                        }
                      }}
                      disabled={selectedRequest.status?.toLowerCase() !== 'pending' || submitting}
                      placeholder="Enter amount"
                    />
                  </div>
                  {!['fixed amount', 'fixed advance', 'fixed advanced', 'fix advance', 'medical amount', 'brackage'].includes(selectedRequest.type?.toLowerCase()) && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Deduction (₹)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono font-semibold"
                        value={approvedMonthlyDeduction}
                        onChange={(e) => setApprovedMonthlyDeduction(e.target.value)}
                        disabled={selectedRequest.status?.toLowerCase() !== 'pending' || submitting}
                        placeholder="Enter deduction"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Add approval / collection notes..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={(selectedRequest.status?.toLowerCase() !== 'pending' && !(mainTab === 'fixed' && subTab === 'pending')) || submitting}
                />
              </div>
            </div>

            {canModify && selectedRequest.status?.toLowerCase() === 'pending' && (
              <div className="flex justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50 sticky bottom-0">
                <button
                  onClick={() => handleAction('Rejected')}
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 !rounded-lg transition-colors disabled:opacity-50 cursor-pointer font-sans"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleAction('Approved')}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white !rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs font-sans"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Approve Request
                </button>
              </div>
            )}

            {canModify && mainTab === 'fixed' && subTab === 'pending' && selectedRequest.status?.toLowerCase() !== 'pending' && (
              <div className="flex justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50 sticky bottom-0">
                <button
                  onClick={() => handleAction('Received')}
                  disabled={submitting}
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white !rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs font-sans"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Record Payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Monthly Advance Modal */}
      {editRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setEditRecord(null)}>
          <div className="bg-white !rounded-xl shadow-2xl border border-slate-200 max-w-md w-full max-h-[90vh] overflow-y-auto font-sans" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-sm font-bold text-slate-900 font-sans flex items-center gap-2">
                <Pencil size={15} className="text-indigo-600" />
                Edit Monthly Advance
              </h2>
              <button onClick={() => setEditRecord(null)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 !rounded-lg transition-colors cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5">
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                <span className="font-bold text-slate-900">{editRecord.empName}</span>
                <span className="font-mono text-slate-400 font-semibold">ID: {editRecord.empId}</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Deduction (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editForm.monthlyDeduction}
                  onChange={e => setEditForm(f => ({ ...f, monthlyDeduction: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remaining Amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editForm.remainingAmount}
                  onChange={e => setEditForm(f => ({ ...f, remainingAmount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Month</label>
                <input
                  type="month"
                  value={editForm.startingMonth}
                  onChange={e => setEditForm(f => ({ ...f, startingMonth: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
                <textarea
                  rows={2}
                  value={editForm.reason}
                  onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 !rounded-lg cursor-pointer transition-colors font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-1.5 text-white text-xs font-semibold !rounded-lg flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-2xs transition-colors disabled:opacity-50 font-sans"
                >
                  {isSavingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Request Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={() => setShowAddModal(false)}>
          <div className="bg-white max-w-lg w-full !rounded-xl overflow-hidden shadow-2xl border border-slate-200 font-sans" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 font-sans">
                <Plus size={16} className={addModalType === 'Approved' ? 'text-teal-600' : 'text-indigo-600'} />
                {addModalType === 'Approved' ? 'Record Fixed Advance' : 'New Advance Request'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 !rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRequest}>
              <div className="p-5 space-y-3.5">
                <div className="relative">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Employee <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Type name or employee ID to search..."
                    value={isEmpDropdownOpen ? empSearch : (employeesList.find(emp => emp.employee_id === newEmpId) ? `${employeesList.find(emp => emp.employee_id === newEmpId).name_as_per_aadhar} (${newEmpId})` : empSearch)}
                    onFocus={() => setIsEmpDropdownOpen(true)}
                    onChange={(e) => {
                      setEmpSearch(e.target.value);
                      setIsEmpDropdownOpen(true);
                      setNewEmpId('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                  />
                  <input type="hidden" name="employee_id" required value={newEmpId} />

                  {isEmpDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsEmpDropdownOpen(false)} />
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto text-xs divide-y divide-slate-100">
                        {employeesList.filter(emp => {
                          const searchLower = empSearch.toLowerCase();
                          const nameLower = (emp.name_as_per_aadhar || '').toLowerCase();
                          const idLower = (emp.employee_id || '').toLowerCase();
                          return nameLower.includes(searchLower) || idLower.includes(searchLower);
                        }).length === 0 ? (
                          <div className="px-3 py-2.5 text-slate-400 text-center">No matching employees found</div>
                        ) : (
                          employeesList
                            .filter(emp => {
                              const searchLower = empSearch.toLowerCase();
                              const nameLower = (emp.name_as_per_aadhar || '').toLowerCase();
                              const idLower = (emp.employee_id || '').toLowerCase();
                              return nameLower.includes(searchLower) || idLower.includes(searchLower);
                            })
                            .map(emp => (
                              <div
                                key={emp.employee_id}
                                onClick={() => {
                                  setNewEmpId(emp.employee_id);
                                  setEmpSearch(`${emp.name_as_per_aadhar || 'No Name'} (${emp.employee_id})`);
                                  setIsEmpDropdownOpen(false);
                                }}
                                className="px-3 py-2 hover:bg-indigo-50 text-slate-700 hover:text-indigo-900 font-medium cursor-pointer transition-colors flex items-center justify-between"
                              >
                                <span>{emp.name_as_per_aadhar || 'No Name'}</span>
                                <span className="font-mono text-slate-400 font-semibold">{emp.employee_id}</span>
                              </div>
                            ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Type / Category <span className="text-red-500">*</span></label>
                    <select
                      required
                      value={newType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewType(val);
                        if (val === 'Fixed Amount') {
                          setNewDeduction(newAmount);
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="Monthly Advance">Monthly Advance</option>
                      <option value="Fixed Amount">Fixed Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Starting Month <span className="text-red-500">*</span></label>
                    <input
                      type="month"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-slate-700 cursor-pointer"
                      value={newStartingMonth}
                      onChange={(e) => setNewStartingMonth(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono font-semibold"
                      value={newAmount}
                      onChange={(e) => {
                        setNewAmount(e.target.value);
                        if (newType === 'Fixed Amount') {
                          setNewDeduction(e.target.value);
                        }
                      }}
                      placeholder="Enter amount"
                    />
                  </div>
                  {newType !== 'Fixed Amount' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Monthly Deduction (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono font-semibold"
                        value={newDeduction}
                        onChange={(e) => setNewDeduction(e.target.value)}
                        placeholder="Enter monthly deduction"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason</label>
                  <textarea
                    rows={2}
                    placeholder="Enter reason for advance request..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50 sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 !rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNew}
                  className={`px-4 py-1.5 text-white text-xs font-semibold !rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all disabled:opacity-50 font-sans ${
                    addModalType === 'Approved' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmittingNew ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {addModalType === 'Approved' ? 'Record Fixed Advance' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schema Missing Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white !rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden font-sans">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm font-sans flex items-center gap-2">
                <Database size={16} className="text-indigo-600" />
                Database Table Required
              </h3>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 !rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                The <code>advance_requests</code> table is missing from your Supabase database. Please copy the SQL code below, open your <strong>Supabase SQL Editor</strong>, paste and run it to create the table.
              </p>
              <div className="relative bg-slate-950 rounded-lg p-3.5 mb-4">
                <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48 scrollbar-thin whitespace-pre-wrap">
                  {`CREATE TABLE IF NOT EXISTS hr_management_advance_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    monthly_deduction NUMERIC NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Received')),
    type VARCHAR(100) DEFAULT 'Advance',
    approved_amount NUMERIC,
    approved_monthly_deduction NUMERIC,
    remaining_amount NUMERIC,
    admin_remarks TEXT,
    starting_month VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`}
                </pre>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowSchemaModal(false)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs !rounded-lg transition-colors cursor-pointer font-sans"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAdvance;
