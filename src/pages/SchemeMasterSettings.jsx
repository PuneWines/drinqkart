import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Briefcase,
  Tag,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export const SCHEME_TRADERS_KEY = 'drinqkart_scheme_traders_v1';
export const SCHEME_COMPANIES_KEY = 'drinqkart_scheme_companies_v1';
export const SCHEME_BRANDS_KEY = 'drinqkart_scheme_brands_v1';

export default function SchemeMasterSettings({ readOnly = false }) {
  const [activeTab, setActiveTab] = useState('traders'); // 'traders' | 'companies' | 'brands'
  const [traders, setTraders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [alert, setAlert] = useState(null);

  // Form State - only Name is needed for all entries!
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formName, setFormName] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      // 1. Fetch Traders from database
      try {
        const { data, error } = await supabase
          .from('scheme_traders')
          .select('id, name')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setTraders(data);
          localStorage.setItem(SCHEME_TRADERS_KEY, JSON.stringify(data));
        } else {
          const cached = localStorage.getItem(SCHEME_TRADERS_KEY);
          if (cached) {
            try {
              setTraders(JSON.parse(cached));
            } catch (_) {
              setTraders([]);
            }
          } else {
            setTraders([]);
          }
        }
      } catch (_) {
        setTraders([]);
      }

      // 2. Fetch Companies from database
      try {
        const { data, error } = await supabase
          .from('scheme_companies')
          .select('id, name')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setCompanies(data);
          localStorage.setItem(SCHEME_COMPANIES_KEY, JSON.stringify(data));
        } else {
          const cached = localStorage.getItem(SCHEME_COMPANIES_KEY);
          if (cached) {
            try {
              setCompanies(JSON.parse(cached));
            } catch (_) {
              setCompanies([]);
            }
          } else {
            setCompanies([]);
          }
        }
      } catch (_) {
        setCompanies([]);
      }

      // 3. Fetch Brands from database
      try {
        const { data, error } = await supabase
          .from('scheme_brands')
          .select('id, name')
          .order('name', { ascending: true });
        if (!error && Array.isArray(data)) {
          setBrands(data);
          localStorage.setItem(SCHEME_BRANDS_KEY, JSON.stringify(data));
        } else {
          const cached = localStorage.getItem(SCHEME_BRANDS_KEY);
          if (cached) {
            try {
              setBrands(JSON.parse(cached));
            } catch (_) {
              setBrands([]);
            }
          } else {
            setBrands([]);
          }
        }
      } catch (_) {
        setBrands([]);
      }
    } catch (err) {
      console.warn('Error loading scheme master:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      const currentItems =
        activeTab === 'traders'
          ? traders
          : activeTab === 'companies'
          ? companies
          : brands;
      const setItems =
        activeTab === 'traders'
          ? setTraders
          : activeTab === 'companies'
          ? setCompanies
          : setBrands;
      const storageKey =
        activeTab === 'traders'
          ? SCHEME_TRADERS_KEY
          : activeTab === 'companies'
          ? SCHEME_COMPANIES_KEY
          : SCHEME_BRANDS_KEY;
      const tableName =
        activeTab === 'traders'
          ? 'scheme_traders'
          : activeTab === 'companies'
          ? 'scheme_companies'
          : 'scheme_brands';
      const entityLabel =
        activeTab === 'traders'
          ? 'Trader'
          : activeTab === 'companies'
          ? 'Company'
          : 'Brand';

      if (editingItem) {
        // Update existing item
        const updated = currentItems.map((item) =>
          item.id === editingItem.id ? { ...item, name: trimmedName } : item
        );
        setItems(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        try {
          await supabase
            .from(tableName)
            .update({ name: trimmedName, updated_at: new Date().toISOString() })
            .eq('id', editingItem.id);
        } catch (_) {}
        showAlert('success', `${entityLabel} "${trimmedName}" updated.`);
      } else {
        // Add new item
        if (currentItems.some((item) => item.name.toLowerCase() === trimmedName.toLowerCase())) {
          throw new Error(`${entityLabel} "${trimmedName}" already exists.`);
        }
        let createdId = `${activeTab[0]}_${Date.now()}`;
        try {
          const { data: inserted, error: insertErr } = await supabase
            .from(tableName)
            .insert([{ name: trimmedName }])
            .select('id, name')
            .single();
          if (!insertErr && inserted?.id) {
            createdId = inserted.id;
          }
        } catch (_) {}
        const newItem = {
          id: createdId,
          name: trimmedName,
        };
        const updated = [...currentItems, newItem].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setItems(updated);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        showAlert('success', `${entityLabel} "${trimmedName}" added.`);
      }

      setIsModalOpen(false);
    } catch (err) {
      showAlert('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const entityLabel =
      activeTab === 'traders'
        ? 'Trader'
        : activeTab === 'companies'
        ? 'Company'
        : 'Brand';
    if (!window.confirm(`Are you sure you want to delete ${entityLabel.toLowerCase()} "${item.name}"?`)) return;

    try {
      if (activeTab === 'traders') {
        const updated = traders.filter((t) => t.id !== item.id);
        setTraders(updated);
        localStorage.setItem(SCHEME_TRADERS_KEY, JSON.stringify(updated));
        try {
          await supabase.from('scheme_traders').delete().eq('id', item.id);
        } catch (_) {
          try {
            await supabase.from('scheme_traders').delete().eq('name', item.name);
          } catch (_) {}
        }
      } else if (activeTab === 'companies') {
        const updated = companies.filter((c) => c.id !== item.id);
        setCompanies(updated);
        localStorage.setItem(SCHEME_COMPANIES_KEY, JSON.stringify(updated));
        try {
          await supabase.from('scheme_companies').delete().eq('id', item.id);
        } catch (_) {
          try {
            await supabase.from('scheme_companies').delete().eq('name', item.name);
          } catch (_) {}
        }
      } else if (activeTab === 'brands') {
        const updated = brands.filter((b) => b.id !== item.id);
        setBrands(updated);
        localStorage.setItem(SCHEME_BRANDS_KEY, JSON.stringify(updated));
        try {
          await supabase.from('scheme_brands').delete().eq('id', item.id);
        } catch (_) {
          try {
            await supabase.from('scheme_brands').delete().eq('name', item.name);
          } catch (_) {}
        }
      }
      showAlert('success', `"${item.name}" deleted successfully.`);
    } catch (err) {
      showAlert('error', 'Failed to delete: ' + err.message);
    }
  };

  // Filtered List based on search and active tab
  const currentList = useMemo(() => {
    let list = [];
    if (activeTab === 'traders') list = traders;
    if (activeTab === 'companies') list = companies;
    if (activeTab === 'brands') list = brands;

    if (!searchTerm.trim()) return list;
    const q = searchTerm.toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [activeTab, traders, companies, brands, searchTerm]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 bg-slate-50 min-h-screen text-slate-900 font-sans">
      {/* Toast Alert */}
      {alert && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-sm font-semibold transition-all ${
            alert.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          {alert.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Header Banner - Drinqkart Master Setting Styling */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#C9A84C]/15 text-[#8C6D23] rounded-xl border border-[#C9A84C]/30 text-lg">
              🍾
            </span>
            <h1 className="text-xl md:text-2xl font-bold font-serif text-slate-900 tracking-tight">
              Scheme Parties Master
            </h1>
          </div>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Manage the Traders, Companies, and Brands available in Scheme Discussions.
          </p>
        </div>

        {/* Stats Badges & Add Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <Briefcase size={14} className="text-[#C9A84C]" />
            <span>{traders.length} Traders</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <Building2 size={14} className="text-[#C9A84C]" />
            <span>{companies.length} Companies</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <Tag size={14} className="text-[#C9A84C]" />
            <span>{brands.length} Brands</span>
          </div>

          {!readOnly && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-4 py-2 bg-[#C9A84C] hover:bg-[#b0913b] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>
                Add {activeTab === 'traders' ? 'Trader' : activeTab === 'companies' ? 'Company' : 'Brand'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs Selection Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => {
            setActiveTab('traders');
            setSearchTerm('');
          }}
          className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'traders'
              ? 'bg-charcoal text-[#C9A84C] shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Briefcase size={16} />
          <span>Traders ({traders.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('companies');
            setSearchTerm('');
          }}
          className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'companies'
              ? 'bg-charcoal text-[#C9A84C] shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Building2 size={16} />
          <span>Companies ({companies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('brands');
            setSearchTerm('');
          }}
          className={`px-4 py-2 text-xs md:text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'brands'
              ? 'bg-charcoal text-[#C9A84C] shadow-xs'
              : 'text-slate-600 hover:bg-slate-200/60'
          }`}
        >
          <Tag size={16} />
          <span>Brands ({brands.length})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-9 pr-3 py-2 text-xs md:text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-[#C9A84C] focus:ring-1 focus:ring-[#C9A84C] outline-none transition-all"
          />
        </div>

        <span className="text-xs text-slate-500 font-mono">
          Showing {currentList.length} {activeTab}
        </span>
      </div>

      {/* Table / List View */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <RefreshCw className="animate-spin mx-auto mb-2 text-[#C9A84C]" size={28} />
          <p className="text-sm font-medium">Loading scheme options...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-dashed border-slate-300">
          <p className="text-base font-bold text-slate-700">No {activeTab} found</p>
          <p className="text-xs text-slate-400 mt-1">
            Click "Add {activeTab === 'traders' ? 'Trader' : activeTab === 'companies' ? 'Company' : 'Brand'}" to create your first entry.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                <th className="py-3 px-4 w-16">#</th>
                <th className="py-3 px-4">
                  {activeTab === 'traders' ? 'Trader Name' : activeTab === 'companies' ? 'Company Name' : 'Brand Name'}
                </th>
                {!readOnly && <th className="py-3 px-4 text-right w-28">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentList.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-slate-100 rounded-lg text-slate-600 text-xs">
                        {activeTab === 'traders' ? '🤝' : activeTab === 'companies' ? '🏢' : '🍾'}
                      </span>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  {!readOnly && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                          className="p-1.5 text-[#8C6D23] hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 rounded-lg cursor-pointer transition-all"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          title="Delete"
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-all"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal - Clean & uniform for all 3 entities */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold font-serif text-slate-900">
                {editingItem
                  ? `Edit ${activeTab === 'traders' ? 'Trader' : activeTab === 'companies' ? 'Company' : 'Brand'}`
                  : `New ${activeTab === 'traders' ? 'Trader' : activeTab === 'companies' ? 'Company' : 'Brand'}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {activeTab === 'traders'
                    ? 'Trader Name'
                    : activeTab === 'companies'
                    ? 'Company Name'
                    : 'Brand Name'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`Enter ${activeTab === 'traders' ? 'trader' : activeTab === 'companies' ? 'company' : 'brand'} name...`}
                  className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white outline-none focus:border-[#C9A84C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#C9A84C] hover:bg-[#b0913b] text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Save size={15} />
                  <span>{saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
