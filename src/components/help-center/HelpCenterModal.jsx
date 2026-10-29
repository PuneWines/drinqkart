import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  Send,
  Loader2,
  ClipboardList,
  PlusCircle,
  Clock,
  Store,
  User,
  AlertCircle,
  Save,
  MessageSquare
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function HelpCenterModal({
  isOpen,
  onClose,
  editMode = false,
  initialData = null,
  onSaveSuccess = null,
  onTasksUpdated = null
}) {
  const { user } = useAuth();
  const [optionSources, setOptionSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // Main Tabs: 'tasks' (My Assigned Tasks) | 'create' (Raise Ticket)
  const [activeMainTab, setActiveMainTab] = useState('create');

  // Assigned Tasks State
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskActionStatus, setTaskActionStatus] = useState('Resolved');
  const [taskActionRemark, setTaskActionRemark] = useState('');
  const [submittingTaskAction, setSubmittingTaskAction] = useState(false);
  const [taskActionError, setTaskActionError] = useState(null);
  const [taskActionSuccess, setTaskActionSuccess] = useState(null);

  // Ticket Creation Flow State
  // step: 1 (Select Category) | 2 (Select Issue / Custom Text) | 3 (Confirm Ticket) | 4 (Submitted Success)
  const [step, setStep] = useState(1);
  const [selectedCategoryRow, setSelectedCategoryRow] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState('');
  const [customIssueText, setCustomIssueText] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // User candidate names for assignment matching
  const candidateNames = [
    user?.user_name,
    user?.username,
    user?.name,
    typeof localStorage !== 'undefined' ? localStorage.getItem('user_name') : null,
    typeof localStorage !== 'undefined' ? localStorage.getItem('username') : null,
  ].filter(Boolean).map((n) => String(n).trim().toLowerCase());

  // Fetch help_center_option_sources from Supabase when modal opens
  const fetchOptionSources = async () => {
    setLoadingSources(true);
    try {
      const { data, error } = await supabase
        .from('help_center_option_sources')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('[HelpCenter] Error fetching option sources:', error);
      } else {
        const sources = data || [];
        setOptionSources(sources);

        if (editMode && initialData) {
          const foundCategoryRow = sources.find(
            (s) => s.category?.toLowerCase() === (initialData.category || '').toLowerCase()
          ) || { category: initialData.category || 'General' };

          setSelectedCategoryRow(foundCategoryRow);
          setSelectedIssue(initialData.subject || '');
          setCustomIssueText(initialData.subject || '');
          setDescription(initialData.description || '');
          setStep(1);
        } else {
          resetCreateForm();
        }
      }
    } catch (err) {
      console.error('[HelpCenter] Unexpected error:', err);
      if (!editMode) resetCreateForm();
    } finally {
      setLoadingSources(false);
    }
  };

  // Fetch assigned tasks for logged-in user
  const fetchAssignedTasks = async () => {
    if (!user || candidateNames.length === 0) {
      setAssignedTasks([]);
      return;
    }
    setAssignedLoading(true);
    try {
      const { data, error } = await supabase
        .from('help_center_records')
        .select('*')
        .not('assigned_to', 'is', null)
        .in('status', ['In Progress', 'Hold', 'Open'])
        .order('ticket_id', { ascending: false });

      if (error) throw error;

      const myTasks = (data || []).filter((r) => {
        const assigned = String(r.assigned_to || '').trim().toLowerCase();
        return candidateNames.includes(assigned);
      });

      setAssignedTasks(myTasks);

      // Smart tab selection: if user has open assigned tasks, default to 'tasks' tab
      if (!editMode) {
        if (myTasks.length > 0) {
          setActiveMainTab('tasks');
        } else {
          setActiveMainTab('create');
        }
      }
    } catch (err) {
      console.error('[HelpCenter] Error fetching assigned tasks:', err);
    } finally {
      setAssignedLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOptionSources();
      if (!editMode) {
        fetchAssignedTasks();
        setSelectedTask(null);
        setTaskActionError(null);
        setTaskActionSuccess(null);
      }
    }
  }, [isOpen, editMode]);

  const resetCreateForm = () => {
    setStep(1);
    setSelectedCategoryRow(null);
    setSelectedIssue('');
    setCustomIssueText('');
    setDescription('');
    setSubmitError(null);
    setSubmittedTicket(null);
  };

  const handleSelectCategory = (row) => {
    setSelectedCategoryRow(row);
    setSelectedIssue('');
    setCustomIssueText('');
    setStep(2);
  };

  const handleRemoveCategory = () => {
    setSelectedCategoryRow(null);
    setSelectedIssue('');
    setCustomIssueText('');
    setStep(1);
  };

  const handleSelectIssue = (issueText) => {
    setSelectedIssue(issueText);
    setStep(3);
  };

  const handleRemoveIssue = () => {
    setSelectedIssue('');
    setStep(2);
  };

  const handleBack = () => {
    if (!editMode && activeMainTab === 'tasks' && selectedTask) {
      setSelectedTask(null);
      setTaskActionError(null);
      return;
    }

    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      handleRemoveCategory();
    }
  };

  const isOtherEmployeeIssue =
    selectedCategoryRow?.category &&
    selectedCategoryRow.category.toLowerCase().includes('other employee issue');

  // Submit or Update Ticket in help_center_records table
  const handleSubmitTicket = async () => {
    const finalSubject = isOtherEmployeeIssue
      ? customIssueText.trim()
      : selectedIssue.trim();

    if (!selectedCategoryRow || !finalSubject) return;

    setSubmitting(true);
    setSubmitError(null);

    const userObj = user || {};
    const employeeName = initialData?.employee || userObj.user_name || userObj.username || 'Employee';
    const shopName = initialData?.shop || userObj.shop_name || userObj.user_access || 'ALL';
    const todayStr = new Date().toISOString().split('T')[0];

    const payload = {
      category: selectedCategoryRow.category,
      subject: finalSubject,
      description: description.trim() || null,
      last_updated: new Date().toISOString()
    };

    try {
      if (editMode && initialData?.ticket_id) {
        const { data, error } = await supabase
          .from('help_center_records')
          .update(payload)
          .eq('ticket_id', initialData.ticket_id)
          .select('*')
          .single();

        if (error) throw error;

        setSubmittedTicket(data || { ...initialData, ...payload });
        setStep(4);
        if (onSaveSuccess) onSaveSuccess(data || { ...initialData, ...payload });
      } else {
        const insertPayload = {
          date: todayStr,
          employee: employeeName,
          shop: shopName,
          ...payload,
          assigned_to: null,
          status: 'In Progress'
        };

        const { data, error } = await supabase
          .from('help_center_records')
          .insert([insertPayload])
          .select('*')
          .single();

        if (error) throw error;

        setSubmittedTicket(data || insertPayload);
        setStep(4);
        if (onSaveSuccess) onSaveSuccess(data || insertPayload);
      }
    } catch (err) {
      console.error('[HelpCenter] Error submitting ticket:', err);
      setSubmitError(err.message || 'Failed to save ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Action & Resolve an Assigned Task
  const handleSubmitTaskAction = async () => {
    if (!selectedTask) return;
    if (taskActionStatus === 'Resolved' && !taskActionRemark.trim()) {
      setTaskActionError('Please enter a resolution remark / note describing what was done.');
      return;
    }

    setSubmittingTaskAction(true);
    setTaskActionError(null);

    try {
      const updatePayload = {
        status: taskActionStatus,
        remarks: taskActionRemark.trim() || null,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('help_center_records')
        .update(updatePayload)
        .eq('ticket_id', selectedTask.ticket_id);

      if (error) throw error;

      const isResolved = taskActionStatus === 'Resolved';
      setTaskActionSuccess(
        isResolved
          ? `Ticket #${selectedTask.ticket_id} resolved successfully and moved to completed!`
          : `Ticket #${selectedTask.ticket_id} status updated to "${taskActionStatus}".`
      );

      // Refresh assigned tasks list
      await fetchAssignedTasks();
      if (onTasksUpdated) onTasksUpdated();

      // Return to task list after brief animation
      setTimeout(() => {
        setSelectedTask(null);
        setTaskActionSuccess(null);
      }, 1300);
    } catch (err) {
      console.error('[HelpCenter] Failed to submit task action:', err);
      setTaskActionError(err.message || 'Failed to update ticket.');
    } finally {
      setSubmittingTaskAction(false);
    }
  };

  if (!isOpen) return null;

  // Format today's date banner e.g. "29 OCT 2026"
  const formattedToday = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).toUpperCase();

  // Extract issue pill choices for selected category
  const availableIssues = selectedCategoryRow
    ? [
        selectedCategoryRow.common_issues_1,
        selectedCategoryRow.common_issues_2,
        selectedCategoryRow.common_issues_3
      ].filter(Boolean)
    : [];

  const showBackButton =
    (!editMode && activeMainTab === 'tasks' && selectedTask) ||
    (!editMode && activeMainTab === 'create' && step > 1 && step < 4);

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] bg-[#1C120C]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header Bar */}
          <div className="bg-[#1C120C] text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              {showBackButton && (
                <button
                  onClick={handleBack}
                  className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Go Back"
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#C9A84C] text-[#1C120C] flex items-center justify-center font-bold shadow-xs">
                  <HelpCircle size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide font-sans text-white">
                    Help Center & Support
                  </h3>
                  <span className="text-[10px] text-[#C9A84C] font-mono block leading-none">
                    Drinqkart Support Assistant
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Top Tab Switcher: "My Assigned Tasks" vs "Raise Support Ticket" (hidden in editMode) */}
          {!editMode && (
            <div className="bg-[#140D08] px-4 py-2 flex items-center justify-between border-b border-[#C9A84C]/20 shrink-0">
              <div className="flex items-center gap-2">
                {/* Tab: Assigned Tasks */}
                <button
                  onClick={() => {
                    setActiveMainTab('tasks');
                    setSelectedTask(null);
                    setTaskActionError(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMainTab === 'tasks'
                      ? 'bg-[#C9A84C] text-[#1C120C] shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ClipboardList size={14} />
                  <span>My Assigned Tasks</span>
                  {assignedTasks.length > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                        activeMainTab === 'tasks'
                          ? 'bg-[#1C120C] text-[#C9A84C]'
                          : 'bg-amber-400 text-slate-950 animate-pulse'
                      }`}
                    >
                      {assignedTasks.length}
                    </span>
                  )}
                </button>

                {/* Tab: Raise Ticket */}
                <button
                  onClick={() => {
                    setActiveMainTab('create');
                    setSelectedTask(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeMainTab === 'create'
                      ? 'bg-[#C9A84C] text-[#1C120C] shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <PlusCircle size={14} />
                  <span>Raise Support Ticket</span>
                </button>
              </div>

              {activeMainTab === 'tasks' && assignedTasks.length > 0 && (
                <span className="hidden sm:inline-block text-[11px] text-[#C9A84C] font-medium font-sans">
                  {assignedTasks.length} Pending Task{assignedTasks.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {/* Modal Content Body */}
          <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1 bg-slate-50/50">
            {/* ========================================================================= */}
            {/* VIEW 1: MY ASSIGNED TASKS (ACTION & RESOLVE FLOW)                         */}
            {/* ========================================================================= */}
            {!editMode && activeMainTab === 'tasks' && (
              <div className="space-y-4">
                {assignedLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 size={24} className="animate-spin text-[#C9A84C]" />
                    <span className="text-xs font-semibold uppercase tracking-wider">
                      Checking assigned tasks...
                    </span>
                  </div>
                ) : selectedTask ? (
                  /* SUB-VIEW: Action / Resolve Selected Task */
                  <div className="space-y-4">
                    {/* Back link */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setSelectedTask(null)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        <ArrowLeft size={14} />
                        <span>Back to Task List</span>
                      </button>
                      <span className="font-mono text-xs font-extrabold text-[#C9A84C] bg-[#1C120C] px-2.5 py-1 rounded-full">
                        #{selectedTask.ticket_id}
                      </span>
                    </div>

                    {/* Task Overview Card */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-[#1C120C] text-[11px] font-bold">
                          {selectedTask.category}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          Date: {selectedTask.date ? new Date(selectedTask.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {selectedTask.subject}
                        </h4>
                        {selectedTask.description && (
                          <div className="mt-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                              Problem Description:
                            </span>
                            {selectedTask.description}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                          <Store size={13} className="text-slate-400" />
                          <span>Shop: <strong>{selectedTask.shop || 'ALL'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <User size={13} className="text-slate-400" />
                          <span>Raised by: <strong>{selectedTask.employee || 'Employee'}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action & Resolution Form Card */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <CheckCircle2 size={16} className="text-[#C9A84C]" />
                        <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Submit Action & Update Status
                        </h5>
                      </div>

                      {/* Status Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1.5">
                          Update Status <span className="text-rose-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setTaskActionStatus('Resolved')}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              taskActionStatus === 'Resolved'
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <CheckCircle2 size={15} className={taskActionStatus === 'Resolved' ? 'text-emerald-600' : 'text-slate-400'} />
                            <span>Resolved (Close)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTaskActionStatus('In Progress')}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              taskActionStatus === 'In Progress'
                                ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <Clock size={15} className={taskActionStatus === 'In Progress' ? 'text-blue-600' : 'text-slate-400'} />
                            <span>In Progress</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setTaskActionStatus('Hold')}
                            className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              taskActionStatus === 'Hold'
                                ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20 shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <AlertCircle size={15} className={taskActionStatus === 'Hold' ? 'text-amber-600' : 'text-slate-400'} />
                            <span>On Hold</span>
                          </button>
                        </div>
                      </div>

                      {/* Follow-up Remark / Resolution Note */}
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          {taskActionStatus === 'Resolved' ? (
                            <span>
                              Resolution Remark (What action was taken to resolve?) <span className="text-rose-500">*</span>
                            </span>
                          ) : (
                            <span>Follow-Up Remark / Progress Note</span>
                          )}
                        </label>
                        <textarea
                          rows={3}
                          value={taskActionRemark}
                          onChange={(e) => setTaskActionRemark(e.target.value)}
                          placeholder={
                            taskActionStatus === 'Resolved'
                              ? 'Explain how the issue was fixed, actions taken, or resolution details...'
                              : 'Enter updates, current status notes, or pending requirements...'
                          }
                          className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:outline-none resize-none font-sans"
                        />
                      </div>

                      {/* Status Feedback Banners */}
                      {taskActionError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700 flex items-center gap-2">
                          <AlertCircle size={15} className="shrink-0" />
                          <span>{taskActionError}</span>
                        </div>
                      )}

                      {taskActionSuccess && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                          <span>{taskActionSuccess}</span>
                        </div>
                      )}

                      {/* Submit Button */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedTask(null)}
                          disabled={submittingTaskAction}
                          className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          onClick={handleSubmitTaskAction}
                          disabled={submittingTaskAction}
                          className={`px-5 py-2 rounded-lg font-bold text-xs text-white shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                            taskActionStatus === 'Resolved'
                              ? 'bg-emerald-600 hover:bg-emerald-700'
                              : 'bg-[#1C120C] hover:bg-black text-[#C9A84C]'
                          }`}
                        >
                          {submittingTaskAction ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              <span>Submitting...</span>
                            </>
                          ) : taskActionStatus === 'Resolved' ? (
                            <>
                              <CheckCircle2 size={15} />
                              <span>Submit & Resolve Task</span>
                            </>
                          ) : (
                            <>
                              <Save size={15} />
                              <span>Save Status Update</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : assignedTasks.length === 0 ? (
                  /* Empty state: No assigned tasks */
                  <div className="py-12 px-6 flex flex-col items-center text-center space-y-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-xs">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-slate-900 font-sans">
                        All Caught Up! No Pending Tasks
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        You do not have any open tickets assigned to you right now. When an administrator or team lead assigns you a ticket, it will appear here.
                      </p>
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => setActiveMainTab('create')}
                        className="px-4 py-2 bg-[#1C120C] hover:bg-black text-[#C9A84C] font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <PlusCircle size={14} />
                        <span>Raise a Support Ticket Instead</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Task List View */
                  <div className="space-y-3">
                    <div className="bg-[#C9A84C]/15 text-[#1C120C] px-3.5 py-2.5 rounded-xl border border-[#C9A84C]/30 text-xs font-bold font-sans flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardList size={16} className="text-[#8C6D23]" />
                        <span>Open Tasks Assigned to You ({assignedTasks.length})</span>
                      </div>
                      <span className="text-[11px] font-normal text-slate-600">
                        Click "Take Action" to update & resolve
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
                      {assignedTasks.map((task) => (
                        <div
                          key={task.ticket_id}
                          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-[#C9A84C]/60 hover:shadow-md transition-all space-y-3 group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs bg-[#1C120C] text-[#C9A84C] px-2.5 py-0.5 rounded-full shadow-2xs">
                                #{task.ticket_id}
                              </span>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {task.date ? new Date(task.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </span>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                task.status === 'In Progress'
                                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                                  : task.status === 'Hold'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {task.status || 'In Progress'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D23] block">
                              {task.category}
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 mt-0.5 leading-snug">
                              {task.subject}
                            </h4>
                            {task.description && (
                              <p className="text-[11px] text-slate-600 mt-1 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {task.remarks && (
                            <div className="text-[11px] text-amber-900 bg-amber-50/80 px-2.5 py-1.5 rounded-md border border-amber-200">
                              <span className="font-bold">Latest Note: </span>
                              <span>{task.remarks}</span>
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-3 text-[11px] text-slate-500">
                              <span className="flex items-center gap-1">
                                <Store size={12} className="text-slate-400" />
                                <span>{task.shop || 'ALL'}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <User size={12} className="text-slate-400" />
                                <span>By: {task.employee || 'Employee'}</span>
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setTaskActionStatus('Resolved');
                                setTaskActionRemark(task.remarks || '');
                                setTaskActionError(null);
                                setTaskActionSuccess(null);
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-[#1C120C] text-[#C9A84C] hover:bg-black font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs group-hover:scale-[1.02]"
                            >
                              <CheckCircle2 size={14} />
                              <span>Take Action & Resolve</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* VIEW 2: RAISE SUPPORT TICKET (WIZARD FLOW) OR EDIT MODE                  */}
            {/* ========================================================================= */}
            {(editMode || activeMainTab === 'create') && (
              <>
                {/* Date Banner */}
                <div className="text-center">
                  <span className="inline-block px-3 py-0.5 rounded-full bg-slate-200/80 text-[10px] font-bold text-slate-500 tracking-wider">
                    {formattedToday}
                  </span>
                </div>

                {/* Support Assistant Greeting */}
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-full bg-[#1C120C] text-[#C9A84C] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs border border-[#C9A84C]/30">
                    DS
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3 shadow-2xs max-w-[85%] space-y-1">
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">
                      Hello. Welcome to Drinqkart Support.
                    </p>
                    <p className="text-xs text-slate-600">
                      Please let us know how can we help you today.
                    </p>
                  </div>
                </div>

                {/* Pinned Selection Chips Bar */}
                {(selectedCategoryRow || selectedIssue || (isOtherEmployeeIssue && customIssueText)) && (
                  <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Your Selections:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {/* Category Chip */}
                      {selectedCategoryRow && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1C120C] text-[#C9A84C] rounded-full text-xs font-semibold shadow-xs">
                          <span>{selectedCategoryRow.category}</span>
                          {step < 4 && (
                            <button
                              onClick={handleRemoveCategory}
                              className="hover:text-white transition-colors cursor-pointer"
                              title="Change Category"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Issue Chip */}
                      {(selectedIssue || (isOtherEmployeeIssue && customIssueText)) && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-900 border border-amber-300 rounded-full text-xs font-semibold shadow-2xs">
                          <span>
                            {isOtherEmployeeIssue ? customIssueText : selectedIssue}
                          </span>
                          {step < 4 && (
                            <button
                              onClick={handleRemoveIssue}
                              className="hover:text-red-600 transition-colors cursor-pointer"
                              title="Change Issue"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STAGE 1: Select Category */}
                {step === 1 && (
                  <div className="space-y-3 pt-1">
                    <div className="bg-[#C9A84C]/15 text-[#1C120C] px-3.5 py-2 rounded-xl border border-[#C9A84C]/30 text-xs font-bold font-sans">
                      Please select your help ticket category:
                    </div>

                    {loadingSources ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 size={24} className="animate-spin text-[#C9A84C]" />
                        <span className="text-xs font-semibold uppercase tracking-wider">
                          Loading categories...
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-[50vh] overflow-y-auto custom-scrollbar p-1">
                        {optionSources.map((row) => (
                          <button
                            key={row.id}
                            onClick={() => handleSelectCategory(row)}
                            className="px-3.5 py-2 rounded-full bg-white border border-slate-300 hover:border-[#C9A84C] hover:bg-[#C9A84C]/10 text-slate-800 text-xs font-semibold transition-all shadow-2xs cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {row.category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STAGE 2: Select Issue or Enter Custom Issue */}
                {step === 2 && (
                  <div className="space-y-3 pt-1">
                    {isOtherEmployeeIssue ? (
                      <>
                        <div className="bg-[#C9A84C]/15 text-[#1C120C] px-3.5 py-2 rounded-xl border border-[#C9A84C]/30 text-xs font-bold font-sans">
                          Please enter your issue & description:
                        </div>

                        <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Subject / Title
                            </label>
                            <input
                              type="text"
                              value={customIssueText}
                              onChange={(e) => setCustomIssueText(e.target.value)}
                              placeholder="Brief title of the issue..."
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800 placeholder-slate-400 font-sans"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Description (Optional)
                            </label>
                            <textarea
                              rows={3}
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="Provide any additional details or description..."
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800 placeholder-slate-400 font-sans resize-none"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              disabled={!customIssueText.trim()}
                              onClick={() => setStep(3)}
                              className="px-4 py-2 bg-[#1C120C] hover:bg-black text-[#C9A84C] text-xs font-bold rounded-lg shadow-sm disabled:opacity-40 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>Continue</span>
                              <Send size={12} />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-[#C9A84C]/15 text-[#1C120C] px-3.5 py-2 rounded-xl border border-[#C9A84C]/30 text-xs font-bold font-sans">
                          Please select your issue:
                        </div>

                        <div className="flex flex-wrap gap-2 p-1">
                          {availableIssues.length > 0 ? (
                            availableIssues.map((issue, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelectIssue(issue)}
                                className="px-3.5 py-2 rounded-full bg-white border border-slate-300 hover:border-[#C9A84C] hover:bg-[#C9A84C]/10 text-slate-800 text-xs font-semibold transition-all shadow-2xs cursor-pointer text-left hover:scale-[1.02] active:scale-[0.98]"
                              >
                                {issue}
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">
                              No predefined issues found for this category.
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* STAGE 3: Review & Confirm Ticket */}
                {step === 3 && (
                  <div className="space-y-4 pt-1">
                    <div className="bg-[#C9A84C]/15 text-[#1C120C] px-3.5 py-2 rounded-xl border border-[#C9A84C]/30 text-xs font-bold font-sans">
                      Please review your ticket details:
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Category:</span>
                        <span className="font-bold text-[#1C120C]">
                          {selectedCategoryRow?.category}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Subject / Issue:</span>
                        <span className="font-bold text-[#1C120C]">
                          {isOtherEmployeeIssue ? customIssueText : selectedIssue}
                        </span>
                      </div>

                      {/* Description row */}
                      <div className="flex flex-col text-xs border-b border-slate-100 pb-2 space-y-1">
                        <span className="text-slate-500 font-medium">Description:</span>
                        <textarea
                          rows={2}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="No description provided. Click to add..."
                          className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#C9A84C] bg-slate-50 text-slate-800 resize-none font-sans"
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                        <span className="text-slate-500 font-medium">Employee Name:</span>
                        <span className="font-semibold text-slate-800">
                          {user?.user_name || user?.username || 'Employee'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Shop Location:</span>
                        <span className="font-semibold text-slate-800">
                          {user?.shop_name || user?.user_access || 'ALL'}
                        </span>
                      </div>
                    </div>

                    {submitError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
                        {submitError}
                      </div>
                    )}

                    <div className="flex justify-center pt-2">
                      <button
                        onClick={handleSubmitTicket}
                        disabled={submitting}
                        className="w-full sm:w-auto px-8 py-3 bg-[#1C120C] hover:bg-black text-[#C9A84C] font-bold text-xs uppercase tracking-widest rounded-full shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Submitting Ticket...</span>
                          </>
                        ) : (
                          <>
                            <Send size={16} />
                            <span>Submit Help Ticket</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* STAGE 4: Submission Success */}
                {step === 4 && (
                  <div className="py-6 flex flex-col items-center text-center space-y-4 bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                      <CheckCircle2 size={32} />
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-serif font-bold text-slate-900">
                        Ticket Submitted Successfully!
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                        Your help ticket has been registered in the system. Our support team will review and update you shortly.
                      </p>
                    </div>

                    {submittedTicket?.ticket_id && (
                      <div className="px-4 py-2 bg-slate-100 rounded-lg border border-slate-200 text-xs font-mono font-bold text-[#1C120C]">
                        Ticket ID:{' '}
                        <span className="text-[#C9A84C] font-extrabold">
                          {submittedTicket.ticket_id}
                        </span>
                      </div>
                    )}

                    <button
                      onClick={onClose}
                      className="px-6 py-2.5 bg-[#1C120C] hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
