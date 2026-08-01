import { useState, useEffect } from 'react'
import { Building2, Plus, ShieldAlert, CheckCircle, Search, Edit3, Save, X, Trash2, Calendar, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function JoiningCompany() {
  const [companies, setCompanies] = useState([])
  const [newCompanyName, setNewCompanyName] = useState('')
  const [givenByInput, setGivenByInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [alert, setAlert] = useState(null)

  // Editing state
  const [editingCompanyId, setEditingCompanyId] = useState(null)
  const [editingShopName, setEditingShopName] = useState('')
  const [editingGivenBy, setEditingGivenBy] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchCompanies()
  }, [])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('shop')
        .select('*')
        .order('shop_name', { ascending: true })

      if (error) throw error
      setCompanies(data || [])
    } catch (err) {
      showAlert('error', 'Failed to fetch shops: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const showAlert = (type, message) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }

  const handleAddCompany = async (e) => {
    e.preventDefault()
    const trimmedName = newCompanyName.trim()
    if (!trimmedName) return

    setSaving(true)
    try {
      const payload = {
        shop_name: trimmedName,
        given_by: givenByInput.trim() || null
      }

      const { data, error } = await supabase
        .from('shop')
        .insert([payload])
        .select()

      if (error) {
        if (error.code === '23505') { // Unique constraint violation on departments_name_key (shop_name)
          throw new Error('This shop name already exists.')
        }
        throw error
      }

      setCompanies(prev => [...prev, ...data].sort((a, b) => (a.shop_name || '').localeCompare(b.shop_name || '')))
      setNewCompanyName('')
      setGivenByInput('')
      showAlert('success', 'Shop added successfully!')
    } catch (err) {
      showAlert('error', err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateCompany = async (id) => {
    const trimmed = editingShopName.trim()
    if (!trimmed) return
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('shop')
        .update({
          shop_name: trimmed,
          given_by: editingGivenBy.trim() || null
        })
        .eq('id', id)

      if (error) throw error

      showAlert('success', 'Shop updated successfully!')
      setEditingCompanyId(null)
      fetchCompanies()
    } catch (err) {
      showAlert('error', 'Failed to update shop: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const handleDeleteCompany = async (id, shopName) => {
    if (!window.confirm(`Are you sure you want to delete shop "${shopName}"?`)) return
    try {
      const { error } = await supabase
        .from('shop')
        .delete()
        .eq('id', id)

      if (error) throw error

      showAlert('success', `Shop "${shopName}" deleted successfully!`)
      fetchCompanies()
    } catch (err) {
      showAlert('error', 'Failed to delete shop: ' + err.message)
    }
  }

  const filteredCompanies = companies.filter(c => {
    const nameMatch = (c.shop_name || c.company_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    const givenMatch = (c.given_by || '').toLowerCase().includes(searchTerm.toLowerCase())
    return nameMatch || givenMatch
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-indigo-600 animate-pulse" />
            Shops Management (Global Table: `shop`)
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure global shop names
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-md border border-slate-100 p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-800">Add New Shop</h3>
            <form onSubmit={handleAddCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                  Shop Name *
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Balaji Wines"
                  className="w-full px-3 py-2 text-sm border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 rounded"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !newCompanyName.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#d4b457] hover:bg-[#c3a346] text-slate-900 text-sm font-semibold transition-colors disabled:cursor-not-allowed shadow-md cursor-pointer rounded"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent animate-spin"></div>
                ) : (
                  <Plus size={16} />
                )}
                Add Shop
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: List Card */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-md border border-slate-100 overflow-hidden flex flex-col h-[520px]">
            {/* Search Header */}
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50/50">
              <span className="text-sm font-bold text-slate-700">Global Shop Directory ({filteredCompanies.length})</span>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search Shop..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white rounded"
                />
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Building2 size={48} className="opacity-40" />
                  <p className="text-sm">No Shop found</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase bg-slate-50/50">
                      <th className="py-3 px-4"># ID</th>
                      <th className="py-3 px-4">Shop Name</th>
                      <th className="py-3 px-4">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {filteredCompanies.map((company, index) => {
                      const currentShopName = company.shop_name || company.company_name;
                      const formattedDate = company.created_at
                        ? new Date(company.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                        : '—';

                      return (
                        <tr key={company.id || index} className="hover:bg-slate-50/30 transition-colors">
                          <td className="py-3.5 px-4 text-xs font-mono text-slate-400 font-bold">{company.id || index + 1}</td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            <span className="font-bold text-slate-900">{currentShopName}</span>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" />
                              {formattedDate}
                            </span>
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
  )
}
