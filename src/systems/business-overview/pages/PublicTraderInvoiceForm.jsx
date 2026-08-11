import React from 'react';
import TraderInvoiceForm from '../components/TraderInvoiceForm';
import { FileText } from 'lucide-react';

export default function PublicTraderInvoiceForm() {
  const handleSuccess = () => {
    // Optionally redirect or show a nice thank you card.
    // For now we can alert or rely on the form's own success display.
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 py-8">
      
      {/* Header Info */}
      <div className="w-full max-w-2xl text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-[#2a5298] text-white rounded-2xl shadow-md mb-3">
          <FileText size={28} />
        </div>
        <h1 className="text-xl font-bold tracking-wide text-gray-800">Trader Invoice Portal</h1>
        <p className="text-xs text-gray-500 mt-1">Please fill in the invoice details and provide your digital signature below.</p>
      </div>

      {/* Main Form container */}
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-2">
          <TraderInvoiceForm onSuccess={handleSuccess} isPublic={true} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-[10px] text-gray-400">
        <p>&copy; {new Date().getFullYear()} Drinqkart Retail Operations. All rights reserved.</p>
      </div>

    </div>
  );
}
