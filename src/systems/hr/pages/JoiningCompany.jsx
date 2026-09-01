import { useState, useEffect } from 'react'
import { Building2, Plus, ShieldAlert, CheckCircle, Search, Edit3, Save, X, Calendar, QrCode, Copy, Printer, Lock, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function JoiningCompany({ readOnly = false }) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [alert, setAlert] = useState(null)

  // Modals & Form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    shop_name: '',
    full_name: '',
    gstin: '',
    contact: '',
    email: '',
    address: ''
  })
  const [addQrFile, setAddQrFile] = useState(null)
  const [addQrPreview, setAddQrPreview] = useState(null)

  const [editingCompany, setEditingCompany] = useState(null)
  const [editForm, setEditForm] = useState({
    full_name: '',
    gstin: '',
    contact: '',
    email: '',
    address: ''
  })
  const [editQrFile, setEditQrFile] = useState(null)
  const [editQrPreview, setEditQrPreview] = useState(null)

  const [qrModalShop, setQrModalShop] = useState(null)

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

  const uploadQrCodeFile = async (shopName, file) => {
    if (!file) return null
    try {
      const fileExt = file.name.split('.').pop()
      const cleanName = (shopName || 'shop').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      const fileName = `qr_${cleanName}_${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('customer_feedback_qr_codes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        })

      if (error) {
        console.error('Supabase storage upload error:', error)
        if (error.message?.includes('row-level security policy') || error.statusCode === '42501' || error.status === 400) {
          showAlert('error', 'Storage RLS Policy Error: Please run the provided SQL script in Supabase SQL Editor to grant upload access to `customer_feedback_qr_codes` bucket.')
        } else {
          showAlert('error', 'QR Storage Upload Error: ' + error.message)
        }
        return null
      }

      const { data: urlData } = supabase.storage
        .from('customer_feedback_qr_codes')
        .getPublicUrl(fileName)

      return urlData?.publicUrl || null
    } catch (err) {
      console.error('Failed uploading QR file:', err)
      showAlert('error', 'QR upload error: ' + (err.message || err))
      return null
    }
  }

  const handleOpenAddModal = () => {
    setAddForm({
      shop_name: '',
      full_name: '',
      gstin: '',
      contact: '',
      email: '',
      address: ''
    })
    setAddQrFile(null)
    setAddQrPreview(null)
    setShowAddModal(true)
  }

  const handleAddCompany = async (e) => {
    e.preventDefault()
    if (readOnly) return
    if (!addForm.shop_name.trim()) {
      showAlert('error', 'Shop Name is required')
      return
    }

    try {
      setSaving(true)

      let uploadedQrUrl = null
      if (addQrFile) {
        uploadedQrUrl = await uploadQrCodeFile(addForm.shop_name.trim(), addQrFile)
      }

      const payload = {
        shop_name: addForm.shop_name.trim(),
        full_name: addForm.full_name.trim() || null,
        gstin: addForm.gstin.trim() || null,
        contact: addForm.contact.trim() || null,
        email: addForm.email.trim() || null,
        address: addForm.address.trim() || null,
        qr_link: uploadedQrUrl || null
      }

      const { data, error } = await supabase
        .from('shop')
        .insert([payload])
        .select()

      if (error) throw error

      showAlert('success', 'Shop added successfully!')
      setShowAddModal(false)
      fetchCompanies()
    } catch (err) {
      showAlert('error', 'Failed to add shop: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEditModal = (company) => {
    setEditingCompany(company)
    setEditForm({
      full_name: company.full_name || '',
      gstin: company.gstin || '',
      contact: company.contact || '',
      email: company.email || '',
      address: company.address || ''
    })
    setEditQrFile(null)
    setEditQrPreview(company.qr_link || null)
  }

  const handleUpdateCompany = async (e) => {
    if (e) e.preventDefault()
    if (!editingCompany) return
    setUpdating(true)
    try {
      let uploadedQrUrl = editQrPreview || editingCompany.qr_link || null
      if (editQrFile) {
        uploadedQrUrl = await uploadQrCodeFile(editingCompany.shop_name, editQrFile)
      }

      const payload = {
        full_name: editForm.full_name.trim() || null,
        gstin: editForm.gstin.trim() || null,
        contact: editForm.contact.trim() || null,
        email: editForm.email.trim() || null,
        address: editForm.address.trim() || null,
        qr_link: uploadedQrUrl
      }

      const { error } = await supabase
        .from('shop')
        .update(payload)
        .eq('id', editingCompany.id)

      if (error) throw error

      showAlert('success', `Shop "${editingCompany.shop_name}" updated successfully!`)
      setEditingCompany(null)
      fetchCompanies()
    } catch (err) {
      showAlert('error', 'Failed to update shop: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const filteredCompanies = companies.filter(c => {
    const s = searchTerm.toLowerCase()
    const nameMatch = (c.shop_name || c.company_name || '').toLowerCase().includes(s)
    const fullNameMatch = (c.full_name || '').toLowerCase().includes(s)
    const gstinMatch = (c.gstin || '').toLowerCase().includes(s)
    const contactMatch = (c.contact || '').toLowerCase().includes(s)
    const emailMatch = (c.email || '').toLowerCase().includes(s)
    const addressMatch = (c.address || '').toLowerCase().includes(s)
    return nameMatch || fullNameMatch || gstinMatch || contactMatch || emailMatch || addressMatch
  })

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Alert banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 shadow-lg border text-xs font-bold uppercase tracking-wider animate-fade-in rounded-none ${alert.type === 'success'
            ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
            : 'bg-rose-950 text-rose-100 border-rose-800'
          }`}>
          {alert.type === 'success' ? <CheckCircle size={16} /> : <ShieldAlert size={16} />}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Full-width Header Bar */}
      <div className="bg-white shadow-sm border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-[#d4b457]" />
            Shops Management (Global Table: `shop`)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage global shops, full business profiles, GSTIN, contact details, and customer feedback QR codes.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1C120C] text-[#d4b457] text-xs font-mono font-bold rounded-full border border-[#d4b457]/30 shadow-2xs">
            Total Shops: {companies.length}
          </span>

          {!readOnly && (
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer rounded-none"
            >
              <Plus size={16} />
              <span>Add New Shop</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Full-Width Table View */}
      <div className="bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[580px]">
        {/* Search & Actions Header */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Global Shop Directory ({filteredCompanies.length})
          </span>

          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search by name, GSTIN, contact, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] bg-white text-slate-900 rounded font-medium"
            />
          </div>
        </div>

        {/* Full-width Responsive Table */}
        <div className="flex-1 overflow-x-auto custom-scrollbar">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-[#d4b457] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Building2 size={48} className="opacity-40" />
              <p className="text-sm font-medium">No shops found matching your search</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs min-w-[1200px]">
              <thead>
                <tr className="bg-[#1C120C] text-[#d4b457] uppercase font-serif text-[11px] tracking-wider border-b border-[#1C120C]">
                  <th className="py-3.5 px-4 w-14"># ID</th>
                  <th className="py-3.5 px-4">Shop Name</th>
                  <th className="py-3.5 px-4">Full Name</th>
                  <th className="py-3.5 px-4 min-w-[170px]">GSTIN</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Address</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 text-center">Feedback QR</th>
                  {!readOnly && <th className="py-3.5 px-4 text-center w-24">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCompanies.map((company, index) => {
                  const currentShopName = company.shop_name || company.company_name
                  const formattedDate = company.created_at
                    ? new Date(company.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })
                    : '—'

                  return (
                    <tr key={company.id || index} className="hover:bg-slate-50 transition-colors">
                      {/* # ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-500">{company.id || index + 1}</td>

                      {/* Shop Name */}
                      <td className="py-3 px-4 font-serif font-bold text-slate-950 text-sm">
                        {currentShopName}
                      </td>

                      {/* Full Name */}
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {company.full_name || <span className="text-slate-400 italic">—</span>}
                      </td>

                      {/* GSTIN (Wider Column) */}
                      <td className="py-3 px-4 font-mono uppercase font-bold text-slate-900 min-w-[170px] whitespace-nowrap">
                        {company.gstin ? (
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded text-[11.5px] font-mono tracking-wider shadow-2xs">
                            {company.gstin}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">—</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 font-mono text-slate-800">
                        {company.contact || <span className="text-slate-400 italic">—</span>}
                      </td>

                      {/* Email */}
                      <td className="py-3 px-4 text-slate-700">
                        {company.email || <span className="text-slate-400 italic">—</span>}
                      </td>

                      {/* Address */}
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate" title={company.address || ''}>
                        {company.address || <span className="text-slate-400 italic">—</span>}
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {formattedDate}
                        </span>
                      </td>

                      {/* Feedback QR */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setQrModalShop(company)}
                          className="inline-flex items-center gap-1 bg-slate-100 hover:bg-[#d4b457]/20 border border-slate-200 text-slate-700 hover:text-slate-900 px-2.5 py-1 rounded transition-colors cursor-pointer"
                          title="View Customer Feedback QR"
                        >
                          <QrCode size={13} className="text-[#d4b457]" />
                          <span className="font-bold text-[10px] uppercase">View QR</span>
                        </button>
                      </td>

                      {/* Actions (Edit Button) */}
                      {!readOnly && (
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditModal(company)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 font-bold text-[10.5px] uppercase tracking-wider transition-colors shadow-2xs cursor-pointer rounded"
                          >
                            <Edit3 size={12} />
                            <span>Edit</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- Add Shop Modal --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#1C120C] text-white p-4 border-b border-[#d4b457]/30 flex items-center justify-between">
              <div>
                <span className="text-[#d4b457] uppercase tracking-widest text-[9.5px] font-bold block mb-0.5">
                  Global Table: shop
                </span>
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <Plus size={16} className="text-[#d4b457]" />
                  Add New Shop
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white/60 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleAddCompany} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={addForm.shop_name}
                  onChange={(e) => setAddForm({ ...addForm, shop_name: e.target.value })}
                  placeholder="e.g. Balaji Wines"
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] font-semibold text-slate-900 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  placeholder="e.g. Shree Balaji Traders Pvt Ltd"
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GSTIN (15 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={addForm.gstin}
                    onChange={(e) => setAddForm({ ...addForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full px-3 py-2 text-xs font-mono tracking-wider uppercase border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 font-bold rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={addForm.contact}
                    onChange={(e) => setAddForm({ ...addForm, contact: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="shop@example.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  placeholder="Enter full shop address..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                />
              </div>

              {/* Upload QR Image Section */}
              <div className="bg-slate-50 p-3.5 border border-slate-200 rounded space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Upload size={14} className="text-[#d4b457]" />
                  <span>Customer Feedback QR Image (Upload to bucket: customer_feedback_qr_codes)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setAddQrFile(file)
                        setAddQrPreview(URL.createObjectURL(file))
                      }
                    }}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#1C120C] file:text-[#d4b457] hover:file:bg-black cursor-pointer"
                  />
                  {addQrPreview && (
                    <div className="shrink-0 relative">
                      <img src={addQrPreview} alt="QR Preview" className="w-12 h-12 object-contain border border-slate-300 bg-white p-1 rounded" />
                      <button
                        type="button"
                        onClick={() => {
                          setAddQrFile(null)
                          setAddQrPreview(null)
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !addForm.shop_name.trim()}
                  className="px-5 py-2 bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer rounded disabled:opacity-60"
                >
                  <Plus size={14} />
                  <span>{saving ? 'Creating...' : 'Create Shop'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Edit Shop Modal --- */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#1C120C] text-white p-4 border-b border-[#d4b457]/30 flex items-center justify-between">
              <div>
                <span className="text-[#d4b457] uppercase tracking-widest text-[9.5px] font-bold block mb-0.5">
                  Edit Shop Details
                </span>
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <Edit3 size={16} className="text-[#d4b457]" />
                  {editingCompany.shop_name || editingCompany.company_name}
                </h3>
              </div>
              <button
                onClick={() => setEditingCompany(null)}
                className="text-white/60 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleUpdateCompany} className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Shop Name (Main Key - Locked)</span>
                  <Lock size={12} className="text-slate-400" />
                </label>
                <input
                  type="text"
                  disabled
                  value={editingCompany.shop_name || editingCompany.company_name || ''}
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-100 font-bold text-slate-700 cursor-not-allowed rounded"
                />
                <span className="text-[10px] text-slate-400 italic block mt-0.5">
                  The primary shop name cannot be altered during edit.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  placeholder="e.g. Shree Balaji Traders Pvt Ltd"
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    GSTIN (15 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={editForm.gstin}
                    onChange={(e) => setEditForm({ ...editForm, gstin: e.target.value.toUpperCase() })}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full px-3 py-2 text-xs font-mono tracking-wider uppercase border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 font-bold rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={editForm.contact}
                    onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="shop@example.com"
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Address
                </label>
                <textarea
                  rows={2}
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Enter full shop address..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 focus:ring-1 focus:ring-[#d4b457] focus:border-[#d4b457] text-slate-900 rounded"
                />
              </div>

              {/* Edit / Upload QR Image Section */}
              <div className="bg-slate-50 p-3.5 border border-slate-200 rounded space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Upload size={14} className="text-[#d4b457]" />
                    Customer Feedback QR Image
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Bucket: customer_feedback_qr_codes</span>
                </label>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setEditQrFile(file)
                        setEditQrPreview(URL.createObjectURL(file))
                      }
                    }}
                    className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-[#1C120C] file:text-[#d4b457] hover:file:bg-black cursor-pointer"
                  />

                  {editQrPreview && (
                    <div className="shrink-0 relative">
                      <img
                        src={editQrPreview}
                        alt="QR Code"
                        className="w-14 h-14 object-contain border border-slate-300 bg-white p-1 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditQrFile(null)
                          setEditQrPreview(null)
                        }}
                        className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5"
                        title="Remove current QR code"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 shadow-sm cursor-pointer rounded disabled:opacity-60"
                >
                  <Save size={14} />
                  <span>{updating ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Feedback QR Code Modal --- */}
      {qrModalShop && (
        <div className="fixed inset-0 z-50 bg-[#1A1A1A]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-[#1C120C] text-white px-4 py-3 border-b border-[#d4b457]/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-[#d4b457]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">Feedback QR Code</span>
              </div>
              <button
                onClick={() => setQrModalShop(null)}
                className="text-white/60 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col items-center text-center space-y-4">
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">
                {qrModalShop.shop_name || qrModalShop.company_name}
              </h3>
              
              <div className="p-2 border border-slate-200 rounded-lg bg-white shadow-inner">
                <img
                  src={
                    qrModalShop.qr_link ||
                    `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      window.location.origin + '/feedback?shop=' + (qrModalShop.shop_name || qrModalShop.company_name)
                    )}`
                  }
                  alt="Shop QR"
                  className="w-48 h-48 object-contain"
                />
              </div>

              {/* URL String */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 font-mono text-[10px] text-slate-600 break-all select-all flex items-center justify-between gap-2">
                <span className="truncate">
                  {window.location.origin}/feedback?shop={encodeURIComponent(qrModalShop.shop_name || qrModalShop.company_name)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const link = `${window.location.origin}/feedback?shop=${encodeURIComponent(qrModalShop.shop_name || qrModalShop.company_name)}`;
                    navigator.clipboard.writeText(link);
                    showAlert('success', 'Feedback link copied!');
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold uppercase rounded transition-colors cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    const imageUrl = qrModalShop.qr_link || `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(window.location.origin + '/feedback?shop=' + (qrModalShop.shop_name || qrModalShop.company_name))}`;
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Print QR Code - ${qrModalShop.shop_name || qrModalShop.company_name}</title>
                          <style>
                            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
                            img { width: 350px; height: 350px; }
                            h2 { margin-top: 20px; color: #1a1a1a; }
                            p { font-size: 14px; color: #666; margin-top: 5px; }
                          </style>
                        </head>
                        <body>
                          <img src="${imageUrl}" />
                          <h2>${qrModalShop.shop_name || qrModalShop.company_name}</h2>
                          <p>Scan to Submit Customer Feedback</p>
                          <script>
                            window.onload = function() {
                              window.print();
                              window.close();
                            }
                          </script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#d4b457] hover:bg-[#c3a346] text-slate-900 text-xs font-bold uppercase rounded transition-colors cursor-pointer shadow-sm"
                >
                  <Printer size={13} />
                  <span>Print QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

