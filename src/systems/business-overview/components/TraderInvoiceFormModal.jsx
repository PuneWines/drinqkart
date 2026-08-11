import React from 'react';
import { X, FileText } from 'lucide-react';
import TraderInvoiceForm from './TraderInvoiceForm';

export default function TraderInvoiceFormModal({ isOpen, onClose, onSuccess }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 my-8">
        
        {/* Header */}
        <div className="bg-[#2a5298] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <h3 className="font-bold text-sm tracking-wide">Trader Invoice Submission Form</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-2 max-h-[80vh] overflow-y-auto">
          <TraderInvoiceForm onSuccess={onSuccess} onCancel={onClose} isPublic={false} />
        </div>

      </div>
    </div>
  );
}
