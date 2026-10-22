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

// Default Fallback Lists
export const DEFAULT_SCHEME_TRADERS = [
  'GAYATRI ENTERPRISES',
  'WINE ENTERPRISES PVT LTD',
  'MILLINNIUM SPIRITS PVT LTD',
  'VINTAGE SPIRITS',
  'K.S.N. IRANI & CO.',
  'MML SPIRITS PRIVATE LIMITED',
  'VC TRADERS',
];

export const DEFAULT_SCHEME_COMPANIES = [
  'SEAGRAM/PERNOD RICARD',
  'BACARDI',
  'RADICO KHAITAN',
  'ACE BEVERAGEZ',
  'MONICA ALCO BEV',
  'MEHER DISTILLERIES',
  '12TH MAN BREWING',
  'Comte de Grasse',
];

export const DEFAULT_SCHEME_BRANDS = [
  { name: 'Royal Stag', company: 'SEAGRAM/PERNOD RICARD' },
  { name: 'Blenders Pride', company: 'SEAGRAM/PERNOD RICARD' },
  { name: 'Jameson', company: 'SEAGRAM/PERNOD RICARD' },
  { name: "Ballantine's", company: 'SEAGRAM/PERNOD RICARD' },
  { name: 'Chivas Regal', company: 'SEAGRAM/PERNOD RICARD' },
  { name: 'Bacardi Carta Blanca', company: 'BACARDI' },
  { name: 'Magic Moments', company: 'RADICO KHAITAN' },
  { name: 'Corona', company: '12TH MAN BREWING' },
  { name: 'Budweiser', company: '12TH MAN BREWING' },
];

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

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formName, setFormName] = useState('');
  const [formCompany, setFormCompany] = useState('');

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
      // 1. Fetch Traders
      let tList = [];
      try {
        const { data, error } = await supabase
          .from('scheme_traders')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          tList = data;
        }
      } catch (_) {}

      if (tList.length === 0) {
        const cached = localStorage.getItem(SCHEME_TRADERS_KEY);
        if (cached) {
          try {
            tList = JSON.parse(cached);
          } catch (_) {}
        }
        if (tList.length === 0) {
          tList = DEFAULT_SCHEME_TRADERS.map((name, i) => ({
            id: `t_${i + 1}`,
            name,
          }));
        }
      }
      setTraders(tList);
      localStorage.setItem(SCHEME_TRADERS_KEY, JSON.stringify(tList));

      // 2. Fetch Companies
      let cList = [];
      try {
        const { data, error } = await supabase
          .from('scheme_companies')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          cList = data;
        }
      } catch (_) {}

      if (cList.length === 0) {
        const cached = localStorage.getItem(SCHEME_COMPANIES_KEY);
        if (cached) {
          try {
            cList = JSON.parse(cached);
          } catch (_) {}
        }
        if (cList.length === 0) {
          cList = DEFAULT_SCHEME_COMPANIES.map((name, i) => ({
            id: `c_${i + 1}`,
            name,
          }));
        }
      }
      setCompanies(cList);
      localStorage.setItem(SCHEME_COMPANIES_KEY, JSON.stringify(cList));

      // 3. Fetch Brands
      let bList = [];
      try {
        const { data, error } = await supabase
          .from('scheme_brands')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          bList = data;
        }
      } catch (_) {}

      if (bList.length === 0) {
        const cached = localStorage.getItem(SCHEME_BRANDS_KEY);
        if (cached) {
          try {
            bList = JSON.parse(cached);
          } catch (_) {}
        }
        if (bList.length === 0) {
          bList = DEFAULT_SCHEME_BRANDS.map((item, i) => ({
            id: `b_${i + 1}`,
            name: item.name,
            company_name: item.company,
          }));
        }
      }
      setBrands(bList);
      localStorage.setItem(SCHEME_BRANDS_KEY, JSON.stringify(bList));
    } catch (err) {
      console.warn('Error loading scheme master:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCompany(companies[0]?.name || '');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormName(item.name || '');
    setFormCompany(item.company_name || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) return;

    setSaving(true);
    try {
      if (activeTab === 'traders') {
        const table = 'scheme_traders';
        if (editingItem) {
          const updated = traders.map((t) =>
            t.id === editingItem.id ? { ...t, name: trimmedName } : t
          );
          setTraders(updated);
          localStorage.setItem(SCHEME_TRADERS_KEY, JSON.stringify(updated));
          try {
            await supabase
              .from(table)
              .update({ name: trimmedName, updated_at: new Date().toISOString() })
              .eq('id', editingItem.id);
          } catch (_) {}
          showAlert('success', `Trader "${trimmedName}" updated.`);
        } else {
          if (traders.some((t) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
            throw new Error(`Trader "${trimmedName}" already exists.`);
          }
          const newItem = {
            id: `t_${Date.now()}`,
            name: trimmedName,
          };
          const updated = [...traders, newItem].sort((a, b) => a.name.localeCompare(b.name));
          setTraders(updated);
          localStorage.setItem(SCHEME_TRADERS_KEY, JSON.stringify(updated));
          try {
            await supabase.from(table).insert([{ name: trimmedName }]);
          } catch (_) {}
          showAlert('success', `Trader "${trimmedName}" added.`);
        }
      } else if (activeTab === 'companies') {
        const table = 'scheme_companies';
        if (editingItem) {
          const updated = companies.map((c) =>
            c.id === editingItem.id ? { ...c, name: trimmedName } : c
          );
          setCompanies(updated);
          localStorage.setItem(SCHEME_COMPANIES_KEY, JSON.stringify(updated));
          try {
            await supabase
              .from(table)
              .update({ name: trimmedName, updated_at: new Date().toISOString() })
              .eq('id', editingItem.id);
          } catch (_) {}
          showAlert('success', `Company "${trimmedName}" updated.`);
        } else {
          if (companies.some((c) => c.name.toLowerCase() === trimmedName.toLowerCase())) {
            throw new Error(`Company "${trimmedName}" already exists.`);
          }
          const newItem = {
            id: `c_${Date.now()}`,
            name: trimmedName,
          };
          const updated = [...companies, newItem].sort((a, b) => a.name.localeCompare(b.name));
          setCompanies(updated);
          localStorage.setItem(SCHEME_COMPANIES_KEY, JSON.stringify(updated));
          try {
            await supabase.from(table).insert([{ name: trimmedName }]);
          } catch (_) {}
          showAlert('success', `Company "${trimmedName}" added.`);
        }
      } else if (activeTab === 'brands') {
        const table = 'scheme_brands';
        const finalCompany = formCompany.trim() || null;
        if (editingItem) {
          const updated = brands.map((b) =>
            b.id === editingItem.id
              ? { ...b, name: trimmedName, company_name: finalCompany }
              : b
          );
          setBrands(updated);
          localStorage.setItem(SCHEME_BRANDS_KEY, JSON.stringify(updated));
          try {
            await supabase
              .from(table)
              .update({
                name: trimmedName,
                company_name: finalCompany,
                updated_at: new Date().toISOString(),
              })
              .eq('id', editingItem.id);
          } catch (_) {}
          showAlert('success', `Brand "${trimmedName}" updated.`);
        } else {
          if (brands.some((b) => b.name.toLowerCase() === trimmedName.toLowerCase())) {
            throw new Error(`Brand "${trimmedName}" already exists.`);
          }
          const newItem = {
            id: `b_${Date.now()}`,
            name: trimmedName,
            company_name: finalCompany,
          };
          const updated = [...brands, newItem].sort((a, b) => a.name.localeCompare(b.name));
          setBrands(updated);
          localStorage.setItem(SCHEME_BRANDS_KEY, JSON.stringify(updated));
          try {
            await supabase
              .from(table)
              .insert([{ name: trimmedName, company_name: finalCompany }]);
          } catch (_) {}
          showAlert('success', `Brand "${trimmedName}" added.`);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      showAlert('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      if (activeTab === 'traders') {
        const updated = traders.filter((t) => t.id !== item.id);
        setTraders(updated);
        localStorage.setItem(SCHEME_TRADERS_KEY, JSON.stringify(updated));
        try {
          await supabase.from('scheme_traders').delete().eq('id', item.id);
        } catch (_) {}
      } else if (activeTab === 'companies') {
        const updated = companies.filter((c) => c.id !== item.id);
        setCompanies(updated);
        localStorage.setItem(SCHEME_COMPANIES_KEY, JSON.stringify(updated));
        try {
          await supabase.from('scheme_companies').delete().eq('id', item.id);
        } catch (_) {}
      } else if (activeTab === 'brands') {
        const updated = brands.filter((b) => b.id !== item.id);
        setBrands(updated);
        localStorage.setItem(SCHEME_BRANDS_KEY, JSON.stringify(updated));
        try {
          await supabase.from('scheme_brands').delete().eq('id', item.id);
        } catch (_) {}
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
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.company_name && item.company_name.toLowerCase().includes(q))
    );
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
              ? 'bg-[#1A1A1A] text-[#C9A84C] shadow-xs'
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
              ? 'bg-[#1A1A1A] text-[#C9A84C] shadow-xs'
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
              ? 'bg-[#1A1A1A] text-[#C9A84C] shadow-xs'
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
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Name</th>
                {activeTab === 'brands' && <th className="py-3 px-4">Associated Company</th>}
                {!readOnly && <th className="py-3 px-4 text-right">Actions</th>}
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
                  {activeTab === 'brands' && (
                    <td className="py-3 px-4 text-slate-600">
                      {item.company_name ? (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium">
                          {item.company_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                  )}
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

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-scale-up space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold font-serif text-slate-900">
                {editingItem ? `Edit ${activeTab.slice(0, -1)}` : `New ${activeTab.slice(0, -1)}`}
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
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`Enter ${activeTab.slice(0, -1)} name...`}
                  className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:bg-white outline-none focus:border-[#C9A84C]"
                />
              </div>

              {activeTab === 'brands' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Associated Company (Optional)
                  </label>
                  <select
                    value={formCompany}
                    onChange={(e) => setFormCompany(e.target.value)}
                    className="w-full text-xs md:text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 outline-none focus:border-[#C9A84C]"
                  >
                    <option value="">-- None / Standalone Brand --</option>
                    {companies.map((c) => (
                      <option key={c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
