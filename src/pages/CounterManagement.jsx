import React, { useState, useEffect } from 'react';
import { Hash, Plus, ShieldAlert, CheckCircle, Search, Trash2, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CounterManagement() {
  const [counters, setCounters] = useState([]);
  const [newCounterName, setNewCounterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    fetchCounters();
  }, []);

  const fetchCounters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master_counter')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setCounters(data || []);
    } catch (err) {
      showAlert('error', 'Failed to fetch counters: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddCounter = async (e) => {
    e.preventDefault();
    const trimmedName = newCounterName.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('master_counter')
        .insert([{ name: trimmedName }])
        .select();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('This counter name already exists.');
        }
        throw error;
      }

      setCounters((prev) => [...prev, ...data].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setNewCounterName('');
      showAlert('success', 'Counter added successfully!');
    } catch (err) {
      showAlert('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCounter = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete counter "${name}"?`)) return;
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('master_counter')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showAlert('success', `Counter "${name}" deleted successfully!`);
      fetchCounters();
    } catch (err) {
      showAlert('error', 'Failed to delete counter: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredCounters = counters.filter((c) =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 bg-[#FAFAFA] min-h-screen text-[#1A1A1A]">
      {/* Alert banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 shadow-lg border text-sm animate-fade-in ${alert.type === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
          {alert.type === 'success' ? <CheckCircle size={18} /> : <ShieldAlert size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2 bg-white p-5 border-[0.5px] border-[#1A1A1A]/10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-800 flex items-center gap-2">
            <Hash className="text-[#C9A84C] animate-pulse" />
            Counters Management (Global Table: `master_counter`)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure system counter names
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-[#1A1A1A]/10 p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-bold font-serif text-slate-800 border-b border-slate-100 pb-2">Add New Counter</h3>
            <form onSubmit={handleAddCounter} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Counter Name *
                </label>
                <input
                  type="text"
                  value={newCounterName}
                  onChange={(e) => setNewCounterName(e.target.value)}
                  placeholder="e.g. COUNTER-4"
                  className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:border-[#C9A84C] rounded-none font-mono"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !newCounterName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed shadow-sm cursor-pointer rounded-none"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-[#1A1A1A] border-t-transparent animate-spin"></div>
                ) : (
                  <Plus size={16} />
                )}
                Add Counter
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List Card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#1A1A1A]/10 overflow-hidden flex flex-col h-[520px] shadow-sm">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
              <span className="text-sm font-bold font-serif text-slate-700">Global Counter Directory ({filteredCounters.length})</span>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search Counter..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-[#C9A84C] bg-white rounded-none"
                />
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredCounters.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Hash size={48} className="opacity-40" />
                  <p className="text-sm font-serif">No Counter found</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4"># ID</th>
                      <th className="py-3 px-4">Counter Name</th>
                      <th className="py-3 px-4">Created At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredCounters.map((counter, index) => {
                      const formattedDate = counter.created_at
                        ? new Date(counter.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                        : '—';

                      return (
                        <tr key={counter.id || index} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-400 font-bold">{counter.id || index + 1}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            {counter.name}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              {formattedDate}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteCounter(counter.id, counter.name)}
                              disabled={deletingId === counter.id}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] uppercase tracking-wider border border-red-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Delete Counter"
                            >
                              <Trash2 size={12} />
                              <span>{deletingId === counter.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
