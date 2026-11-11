import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, HelpCircle, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning', // 'danger' | 'warning' | 'info' | 'success' | 'prompt'
  isPrompt = false,
  promptValue = '',
  promptPlaceholder = '',
  onPromptChange,
  onConfirm,
  onCancel
}) {
  const inputRef = useRef(null);
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    if (isPrompt && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (confirmBtnRef.current) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (!isPrompt || (isPrompt && promptValue !== undefined)) {
          e.preventDefault();
          onConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPrompt, promptValue, onCancel, onConfirm]);

  if (!isOpen) return null;

  const isDanger = type === 'danger' || confirmText?.toLowerCase().includes('delete') || confirmText?.toLowerCase().includes('reject');
  const isSuccess = type === 'success' || confirmText?.toLowerCase().includes('verify');

  const getIcon = () => {
    if (isDanger) return <Trash2 size={22} className="text-rose-600" />;
    if (isSuccess) return <CheckCircle2 size={22} className="text-teal-600" />;
    if (type === 'info') return <HelpCircle size={22} className="text-indigo-600" />;
    return <AlertTriangle size={22} className="text-amber-600" />;
  };

  const getIconBg = () => {
    if (isDanger) return 'bg-rose-50 border-rose-100';
    if (isSuccess) return 'bg-teal-50 border-teal-100';
    if (type === 'info') return 'bg-indigo-50 border-indigo-100';
    return 'bg-amber-50 border-amber-100';
  };

  const getConfirmBtnClasses = () => {
    if (isDanger) {
      return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20';
    }
    if (isSuccess) {
      return 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20';
    }
    return 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20';
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-[2px] flex items-center justify-center p-4 transition-all duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xl max-w-md w-full overflow-hidden transform transition-all font-sans"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-2xl border shrink-0 ${getIconBg()}`}>
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {title || (isDanger ? 'Are you sure?' : 'Confirmation')}
              </h3>
              {message && (
                <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              )}

              {/* Prompt Input field */}
              {isPrompt && (
                <div className="mt-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={promptValue}
                    onChange={(e) => onPromptChange(e.target.value)}
                    placeholder={promptPlaceholder || 'Enter remarks...'}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition font-sans text-slate-800 placeholder-slate-400 bg-slate-50/50"
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors -mr-1 -mt-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer ${getConfirmBtnClasses()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

