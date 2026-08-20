import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  Send,
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function HelpCenterModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [optionSources, setOptionSources] = useState([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // Flow State
  // step: 1 (Select Category) | 2 (Select Issue / Custom Text) | 3 (Confirm Ticket) | 4 (Submitted Success)
  const [step, setStep] = useState(1);
  const [selectedCategoryRow, setSelectedCategoryRow] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState('');
  const [customIssueText, setCustomIssueText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Fetch help_center_option_sources from Supabase when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOptionSources();
      resetForm();
    }
  }, [isOpen]);

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
        setOptionSources(data || []);
      }
    } catch (err) {
      console.error('[HelpCenter] Unexpected error:', err);
    } finally {
      setLoadingSources(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedCategoryRow(null);
    setSelectedIssue('');
    setCustomIssueText('');
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
    if (step === 3) {
      setStep(2);
    } else if (step === 2) {
      handleRemoveCategory();
    }
  };

  const isOtherEmployeeIssue =
    selectedCategoryRow?.category &&
    selectedCategoryRow.category.toLowerCase().includes('other employee issue');

  // Submit Ticket to help_center_records table
  const handleSubmitTicket = async () => {
    const finalSubject = isOtherEmployeeIssue
      ? customIssueText.trim()
      : selectedIssue.trim();

    if (!selectedCategoryRow || !finalSubject) return;

    setSubmitting(true);
    setSubmitError(null);

    const userObj = user || {};
    const employeeName = userObj.user_name || userObj.username || 'Employee';
    const shopName = userObj.shop_name || userObj.user_access || "ALL";
    const todayStr = new Date().toISOString().split('T')[0];

    const payload = {
      date: todayStr,
      employee: employeeName,
      shop: shopName,
      category: selectedCategoryRow.category,
      subject: finalSubject,
      assigned_to: null,
      status: 'In Progress',
      last_updated: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('help_center_records')
        .insert([payload])
        .select('*')
        .single();

      if (error) throw error;

      setSubmittedTicket(data || payload);
      setStep(4);
    } catch (err) {
      console.error('[HelpCenter] Error submitting ticket:', err);
      setSubmitError(err.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Format today's date banner e.g. "20 AUG 2026"
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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-[#1C120C]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header Bar */}
          <div className="bg-[#1C120C] text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              {step > 1 && step < 4 && (
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

          {/* Chat / Support Content Body */}
          <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1 bg-slate-50/50">
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
                    <span className="text-xs font-semibold uppercase tracking-wider">Loading categories...</span>
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
                      Please enter your issue:
                    </div>

                    <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                      <textarea
                        rows={4}
                        value={customIssueText}
                        onChange={(e) => setCustomIssueText(e.target.value)}
                        placeholder="Describe the issue you are facing in detail..."
                        className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#C9A84C] bg-white text-slate-800 placeholder-slate-400 font-sans resize-none"
                      />

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
                            className="px-3.5 py-2 rounded-full bg-white border border-slate-300 hover:border-[#C9A84C] hover:bg-[#C9A84C]/10 text-slate-800 text-xs font-semibold transition-all shadow-2xs cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {issue}
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 italic py-2">
                          No pre-defined options for this category. Please click Continue or select another.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STAGE 3: Ticket Confirmation */}
            {step === 3 && (
              <div className="space-y-4 pt-1">
                <div className="bg-[#C9A84C]/15 text-[#1C120C] px-3.5 py-2 rounded-xl border border-[#C9A84C]/30 text-xs font-bold font-sans text-center">
                  Kindly confirm to raise your ticket
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Category:</span>
                    <span className="font-bold text-[#1C120C]">{selectedCategoryRow?.category}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                    <span className="text-slate-500 font-medium">Subject / Issue:</span>
                    <span className="font-bold text-[#1C120C]">
                      {isOtherEmployeeIssue ? customIssueText : selectedIssue}
                    </span>
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
                      {user?.shop_name || user?.user_access || "ALL"}
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
                    Ticket ID: <span className="text-[#C9A84C] font-extrabold">{submittedTicket.ticket_id}</span>
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
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
