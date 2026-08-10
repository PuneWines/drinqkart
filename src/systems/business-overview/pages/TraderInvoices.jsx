import React from 'react';
import { FileText } from 'lucide-react';

export default function TraderInvoices() {
  return (
    <div className="p-6 bg-white border border-[#C9A84C]/20 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[#C9A84C] text-[#1c120c] rounded-lg">
          <FileText size={20} />
        </div>
        <h1 className="text-xl font-bold tracking-wide font-serif text-[#1A1A1A]">Trader Invoices</h1>
      </div>
      <p className="text-sm text-gray-500">This page will manage and display trader invoices.</p>
    </div>
  );
}
