import React, { useState, useEffect } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { User, Phone, Lock, Save, X } from 'lucide-react'

export default function EditContactModal({ isOpen, onClose, contact }) {
  const { updateWhatsAppContactName } = useChatStore()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (contact) {
      setName(contact.name || '')
    }
  }, [contact])

  if (!isOpen || !contact) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    try {
      await updateWhatsAppContactName(contact.id, name.trim())
      onClose()
    } catch (err) {
      console.error('Failed to update contact name:', err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Edit Contact Name</h3>
            <p className="text-xs text-gray-500 font-medium">Update how this contact displays across WhatsApp</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Read-Only Phone Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>WhatsApp Number (Locked)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={`+${contact.phone_number || contact.id?.split('@')[0]}`}
                disabled
                className="w-full pl-3.5 pr-10 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 cursor-not-allowed outline-none"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Phone numbers cannot be edited to maintain chat history</p>
          </div>

          {/* Editable Name Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Saved Display Name</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-medium text-gray-900 outline-none transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Name'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
