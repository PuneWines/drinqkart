import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  FileText, Plus, RefreshCw, Search, FileImage, ShieldAlert, CheckSquare, Calendar, Store, User
} from 'lucide-react';
import TraderInvoiceFormModal from '../components/TraderInvoiceFormModal';

const fmt = (n) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function TraderInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [shops, setShops] = useState([]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bis_overview_trader_invoices')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);

      // Derive unique shops from data to populate dropdown filter if needed
      const uniqueShops = Array.from(new Set((data || []).map(item => item.shop_name).filter(Boolean)));
      setShops(uniqueShops);
    } catch (err) {
      console.error('Error fetching trader invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    fetchInvoices();
  };

  // Client-side filtering
  const filteredInvoices = invoices.filter(item => {
    const q = search.toLowerCase();
    const matchesSearch = 
      !search.trim() ||
      (item.trader_name_or_area || '').toLowerCase().includes(q) ||
      (item.invoice_number || '').toLowerCase().includes(q) ||
      (item.tp_number || '').toLowerCase().includes(q) ||
      (item.salesman_name || '').toLowerCase().includes(q) ||
      (item.handed_over_to || '').toLowerCase().includes(q);

    const matchesShop = !shopFilter || item.shop_name === shopFilter;
    const matchesFromDate = !fromDate || (item.invoice_date && item.invoice_date >= fromDate);
    const matchesToDate = !toDate || (item.invoice_date && item.invoice_date <= toDate);

    return matchesSearch && matchesShop && matchesFromDate && matchesToDate;
  });

  const clearFilters = () => {
    setSearch('');
    setShopFilter('');
    setFromDate('');
    setToDate('');
  };

  const hasActiveFilters = Boolean(search || shopFilter || fromDate || toDate);

  return (
    <div className="space-y-5 p-4 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-gray-200 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#2a5298]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#2a5298] text-white rounded-xl shadow-md">
            <FileText size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-gray-800">Trader Invoices</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage and display trader invoices submitted via QR code or dashboard portal.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchInvoices}
            title="Refresh list"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-all text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
            <span>Refresh</span>
          </button>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2a5298] text-white rounded-lg text-xs font-bold hover:bg-[#1e3d70] transition-all shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Fill Invoice Form</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          
          {/* From Date */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">From:</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2a5298] bg-white text-gray-700 font-medium"
            />
          </div>

          {/* To Date */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">To:</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2a5298] bg-white text-gray-700 font-medium"
            />
          </div>

          {/* Shop select filter */}
          <div className="flex items-center gap-2">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Shop:</label>
            <select
              value={shopFilter}
              onChange={e => setShopFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2a5298] bg-white text-gray-700 font-medium max-w-[160px]"
            >
              <option value="">All Shops</option>
              {shops.map(sName => (
                <option key={sName} value={sName}>{sName}</option>
              ))}
            </select>
          </div>

          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search by Trader, Invoice No, Salesman..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2a5298] font-medium text-gray-700"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all font-semibold border border-red-200 cursor-pointer"
            >
              Clear Filters
            </button>
          )}

        </div>
      </div>

      {/* Main Table view */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2 text-sm text-gray-500">
          <FileText className="text-[#2a5298]" size={16} />
          <span className="font-semibold text-xs tracking-wider uppercase">
            {loading ? 'Loading...' : `${filteredInvoices.length} invoice record${filteredInvoices.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#2a5298] text-white">
              <tr>
                {['#', 'Trader/Area', 'Shop', 'Invoice No/Date', 'TP No/Date', 'Salesman', 'Amount', 'Delivery', 'Handed To', 'Photo', 'Signature'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-[#2a5298] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Loading invoices...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-16 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert size={36} className="text-gray-300" />
                      <p className="font-semibold text-gray-600">No records found</p>
                      {hasActiveFilters && <p className="text-xs text-gray-400">Adjust your filter options</p>}
                    </div>
                  </td>
                </tr>
              )}

              {!loading && filteredInvoices.map((item, idx) => (
                <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs font-medium">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{item.trader_name_or_area || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200 font-bold uppercase">
                      {item.shop_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    <div className="font-mono font-semibold text-[#2a5298]">{item.invoice_number || '—'}</div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    <div className="font-mono text-slate-600">{item.tp_number || '—'}</div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {item.tp_date ? new Date(item.tp_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap">{item.salesman_name || '—'}</td>
                  <td className="px-4 py-3 text-emerald-700 font-bold whitespace-nowrap">{fmt(item.bill_amount)}</td>
                  <td className="px-4 py-3 text-gray-600 font-semibold whitespace-nowrap text-xs lowercase">
                    {item.delivered_at || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium whitespace-nowrap">{item.handed_over_to || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.photo ? (
                      <a
                        href={item.photo}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-all"
                      >
                        <FileImage size={12} />
                        <span>View Photo</span>
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {item.digital_signature ? (
                      <a
                        href={item.digital_signature}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-all border border-amber-200/50"
                      >
                        <CheckSquare size={12} />
                        <span>View Sign</span>
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Trader Invoice Modal wrapper */}
      <TraderInvoiceFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSaveSuccess}
      />

    </div>
  );
}
