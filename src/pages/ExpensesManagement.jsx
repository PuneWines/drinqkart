import React, { useState, useEffect } from 'react';
import { DollarSign, Plus, ShieldAlert, CheckCircle, Search, Trash2, Calendar, Edit3, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ExpensesManagement({ readOnly = false }) {
  const [expenses, setExpenses] = useState([]);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [alert, setAlert] = useState(null);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master_expenses')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      showAlert('error', 'Failed to fetch expenses: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    if (!newExpenseName.trim()) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('master_expenses')
        .insert([{ name: newExpenseName.trim() }]);

      if (error) throw error;

      showAlert('success', `Expense option "${newExpenseName.trim()}" created!`);
      setNewExpenseName('');
      fetchExpenses();
    } catch (err) {
      showAlert('error', 'Failed to create expense option: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateExpense = async (id) => {
    if (readOnly) return;
    if (!editingName.trim()) return;

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('master_expenses')
        .update({ name: editingName.trim() })
        .eq('id', id);

      if (error) throw error;

      showAlert('success', 'Expense option updated!');
      setEditingId(null);
      setEditingName('');
      fetchExpenses();
    } catch (err) {
      showAlert('error', 'Failed to update expense option: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteExpense = async (id, name) => {
    if (readOnly) return;
    if (!window.confirm(`Are you sure you want to delete expense option "${name}"?`)) return;

    try {
      setDeletingId(id);
      const { error } = await supabase
        .from('master_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      showAlert('success', `Expense option "${name}" deleted!`);
      fetchExpenses();
    } catch (err) {
      showAlert('error', 'Failed to delete expense option: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (expense) => {
    if (readOnly) return;
    setEditingId(expense.id);
    setEditingName(expense.name || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const filteredExpenses = expenses.filter((e) =>
    (e.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
            <DollarSign className="text-[#C9A84C] animate-pulse" />
            Expenses Management (Global Table: `master_expenses`)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure system custom expense categories for Petty Cash
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-[#1A1A1A]/10 p-5 space-y-4 shadow-sm">
            <h3 className="text-base font-bold font-serif text-slate-800 border-b border-slate-100 pb-2">Add New Expense Option</h3>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Expense Category Name *
                </label>
                <input
                  type="text"
                  value={newExpenseName}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  disabled={readOnly}
                  placeholder={readOnly ? "Read-only mode" : "e.g. Custom Expense Name"}
                  className="w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:border-[#C9A84C] rounded-none font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
                  required
                />
              </div>

              {!readOnly && (
                <button
                  type="submit"
                  disabled={saving || !newExpenseName.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C9A84C] hover:bg-[#b8973b] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed shadow-sm cursor-pointer rounded-none"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-[#1A1A1A] border-t-transparent animate-spin"></div>
                  ) : (
                    <Plus size={16} />
                  )}
                  Add Expense Option
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Search & List Card */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-[#1A1A1A]/10 p-5 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold font-serif text-slate-800">
                Expense Options List ({filteredExpenses.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search expense options..."
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 focus:outline-none focus:border-[#C9A84C] rounded-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs font-semibold uppercase tracking-wider">Loading options...</span>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-sm">
                No expense options found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4 w-16">Sr No.</th>
                      <th className="py-3 px-4">Expense Category Name</th>
                      <th className="py-3 px-4 w-36">Created On</th>
                      {!readOnly && <th className="py-3 px-4 w-28 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredExpenses.map((expense, idx) => {
                      const isEditing = editingId === expense.id;
                      return (
                        <tr key={expense.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-slate-300 focus:outline-none focus:border-[#C9A84C] rounded-none font-medium"
                                required
                              />
                            ) : (
                              <span className="font-semibold text-slate-800">{expense.name}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            <span className="flex items-center gap-1">
                              <Calendar size={13} />
                              {expense.created_at
                                ? new Date(expense.created_at).toLocaleDateString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                  })
                                : '—'}
                            </span>
                          </td>
                          {!readOnly && (
                            <td className="py-3.5 px-4 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => handleUpdateExpense(expense.id)}
                                    disabled={updating || !editingName.trim()}
                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                    title="Save Change"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={cancelEditing}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => startEditing(expense)}
                                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                    title="Edit Name"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteExpense(expense.id, expense.name)}
                                    disabled={deletingId === expense.id}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                    title="Delete Option"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
