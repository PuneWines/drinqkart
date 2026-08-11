import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function FeedbackPortal() {
  const [searchParams] = useSearchParams();
  const shopParam = searchParams.get('shop');
  const rawShopParam = shopParam ? shopParam.replace(/-/g, ' ') : null;

  // Page States
  const [resolvedShopName, setResolvedShopName] = useState('');
  const [loadingShop, setLoadingShop] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields State
  const [formValues, setFormValues] = useState({
    customer_name: '',
    contact_no: '',
    feedback_date: new Date().toISOString().split('T')[0],
    preferred_brand: 'Yes / हाँ',
    beer_chilled: 'Yes / हाँ',
    staff_behaviour: 'Excellent',
    suggestion_improvement: '',
  });

  // Fetch shop names to match the short query parameter with the full store name
  useEffect(() => {
    const resolveStoreName = async () => {
      if (!rawShopParam) {
        setLoadingShop(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('shop')
          .select('shop_name');

        if (error) throw error;

        // Perform case-insensitive match (e.g. "MADHURA" matches "Madhura Snack")
        const paramLower = rawShopParam.trim().toLowerCase();
        const matched = data.find((s) => {
          const nameLower = (s.shop_name || '').toLowerCase();
          return nameLower.includes(paramLower) || paramLower.includes(nameLower);
        });

        if (matched) {
          setResolvedShopName(matched.shop_name);
        } else {
          // Fallback to exact parameter spelling if no match is found in DB
          setResolvedShopName(rawShopParam);
        }
      } catch (err) {
        console.error('Error resolving store name:', err);
        setResolvedShopName(rawShopParam);
      } finally {
        setLoadingShop(false);
      }
    };

    resolveStoreName();
  }, [rawShopParam]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleContactChange = (e) => {
    const cleanValue = e.target.value.replace(/\D/g, '');
    setFormValues((prev) => ({
      ...prev,
      contact_no: cleanValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resolvedShopName) {
      toast.error('Invalid shop location.');
      return;
    }
    if (!formValues.customer_name.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    if (!formValues.contact_no.trim()) {
      toast.error('Please enter your contact number.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date();
      // Planned assign complaint window is exactly 30 minutes from timestamp
      const plannedDate = new Date(now.getTime() + 30 * 60 * 1000);

      const payload = {
        feedback_date: formValues.feedback_date,
        store_name: resolvedShopName,
        customer_name: formValues.customer_name.trim(),
        contact_no: formValues.contact_no.trim(),
        preferred_brand: formValues.preferred_brand,
        beer_chilled: formValues.beer_chilled,
        staff_behaviour: formValues.staff_behaviour,
        suggestion_improvement: formValues.suggestion_improvement.trim(),
        timestamp: now.toISOString(),
        planned_assign_complaint: plannedDate.toISOString(),
      };

      const { error } = await supabase
        .from('bis_overview_customer_feedback')
        .insert([payload]);

      if (error) throw error;

      setSubmitted(true);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      toast.error(err.message || 'An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingShop) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Loading Feedback Form...</p>
        </div>
      </div>
    );
  }

  if (!rawShopParam) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 p-6 max-w-sm w-full text-center rounded-lg shadow-sm">
          <AlertCircle size={40} className="text-rose-500 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Invalid Store URL</h2>
          <p className="text-xs text-slate-500 mt-2">
            Please scan the QR code located physically at the wine shop counter to submit your feedback.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-[#C9A84C]/30 p-8 max-w-sm w-full text-center rounded-lg shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide font-serif">Thank You! / धन्यवाद!</h2>
          <p className="text-xs text-slate-600 mt-2 font-medium">
            Your feedback has been submitted successfully for <span className="font-bold text-[#8C6D23]">{resolvedShopName}</span>.
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            We value your business and hope to see you again soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 pb-12 font-sans text-slate-800">
      <Toaster position="top-center" />
      
      {/* Container Card */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 max-w-md w-full overflow-hidden mt-4">
        {/* Header Block */}
        <div className="bg-[#1C120C] text-white px-5 py-4 border-b border-[#C9A84C]/30 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <MessageSquare size={18} className="text-[#C9A84C]" />
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">
              Customer Feedback Form
            </h1>
          </div>
          <p className="text-xs text-[#C9A84C] font-semibold tracking-wide mt-1">
            Store: {resolvedShopName}
          </p>
        </div>

        {/* Single Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Customer Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Customer Name / ग्राहक नाम *
            </label>
            <input
              type="text"
              name="customer_name"
              value={formValues.customer_name}
              onChange={handleInputChange}
              required
              placeholder="Enter your name"
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 px-3 py-2 text-xs focus:outline-none focus:border-[#C9A84C] focus:bg-white rounded-md transition-all placeholder-slate-400"
            />
          </div>

          {/* Contact No */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
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
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#C9A84C] focus:bg-white rounded-md transition-all placeholder-slate-400"
            />
          </div>

          {/* Feedback Date */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Feedback Date
            </label>
            <input
              type="date"
              name="feedback_date"
              value={formValues.feedback_date}
              onChange={handleInputChange}
              required
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 px-3 py-2 text-xs focus:outline-none focus:border-[#C9A84C] focus:bg-white rounded-md transition-all"
            />
          </div>

          {/* Preferred Brand Button Toggles */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Did You Receive Your Preferred Brand? <span className="block text-[9.5px] font-medium text-slate-400 mt-0.5 normal-case font-normal">(क्या आपको आपकी पसंद के अनुसार ब्रांड दिया गया?) *</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormValues((prev) => ({ ...prev, preferred_brand: 'Yes / हाँ' }))}
                className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                  formValues.preferred_brand === 'Yes / हाँ'
                    ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-sm'
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
                    ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                No / नहीं
              </button>
            </div>
          </div>

          {/* Beer Chilled Button Toggles */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              Was the beer chilled enough? <span className="block text-[9.5px] font-medium text-slate-400 mt-0.5 normal-case font-normal">(क्या बीयर आपके लिए पर्याप्त ठंडी थी?) *</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormValues((prev) => ({ ...prev, beer_chilled: 'Yes / हाँ' }))}
                className={`py-2 text-xs font-bold border rounded-md transition-all cursor-pointer ${
                  formValues.beer_chilled === 'Yes / हाँ'
                    ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-sm'
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
                    ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-sm'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                No / नहीं
              </button>
            </div>
          </div>

          {/* Staff Behaviour Buttons */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
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
                        ? 'bg-[#1C120C] text-[#C9A84C] border-[#C9A84C] shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {beh}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suggestions */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Suggestion / Improvement <span className="block text-[9.5px] font-medium text-slate-400 mt-0.5 normal-case font-normal">(सुझाव / सुधार)</span>
            </label>
            <textarea
              name="suggestion_improvement"
              value={formValues.suggestion_improvement}
              onChange={handleInputChange}
              rows={3}
              placeholder="Enter your suggestion..."
              className="w-full bg-slate-50 border border-slate-300 text-slate-800 px-3 py-2 text-xs focus:outline-none focus:border-[#C9A84C] focus:bg-white rounded-md transition-all placeholder-slate-400 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1c120c] font-bold text-xs uppercase tracking-wider rounded-md transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback / सबमिट करें'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Botivate Brand Attribution */}
      <p className="text-[10px] text-slate-400 mt-6 text-center select-none">
        Powered by <a href="https://www.botivate.in" target="_blank" rel="noopener noreferrer" className="font-bold text-[#8C6D23] hover:underline">Botivate</a>
      </p>
    </div>
  );
}
