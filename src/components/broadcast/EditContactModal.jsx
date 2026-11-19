import React, { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { User, Phone, Save, X, Camera, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import WhatsAppContactAvatar from './WhatsAppContactAvatar'

export default function EditContactModal({ isOpen, onClose, contact }) {
  const { updateWhatsAppContact, uploadLiveChatMedia } = useChatStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (contact) {
      setName(contact.name || '')
      const rawPhone = contact.phone_number || contact.id?.split('@')[0] || ''
      setPhone(rawPhone)
      setAvatarUrl(contact.avatar_url || '')
    }
  }, [contact])

  if (!isOpen || !contact) return null

  const handleAvatarFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const url = await uploadLiveChatMedia(file)
      if (url) {
        setAvatarUrl(url)
      }
    } catch (err) {
      console.error('Failed to upload contact avatar:', err)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarUrl('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSaving(true)
    try {
      await updateWhatsAppContact(contact.id, {
        name: name.trim(),
        phone_number: phone.trim(),
        avatar_url: avatarUrl || null,
      })
      onClose()
    } catch (err) {
      console.error('Failed to update contact:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const displayName = name.trim() || phone || 'User'

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Contact Profile</h3>
            <p className="text-xs text-gray-500 font-medium">Preview photo and update contact name & phone</p>
          </div>
        </div>

        {/* Profile Picture Preview & Upload */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden shadow-md border-3 border-emerald-500/20 bg-gray-100 flex items-center justify-center">
              {isUploading ? (
                <div className="flex flex-col items-center justify-center gap-1 text-emerald-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-[10px] font-semibold">Uploading...</span>
                </div>
              ) : (
                <WhatsAppContactAvatar
                  avatarUrl={avatarUrl}
                  name={name || displayName}
                  phoneNumber={phone}
                  size="xl"
                  className="w-full h-full"
                />
              )}
            </div>

            {/* Camera / Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Change Profile Photo"
              className="absolute bottom-0 right-0 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg border-2 border-white transition-all cursor-pointer hover:scale-110 active:scale-95"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFileSelect}
              className="hidden"
            />
          </div>

          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="mt-2 text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-medium transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove Photo</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Editable Display Name Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-600" />
              <span>Contact Name</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Himalay Puri"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-medium text-gray-900 outline-none transition-all"
            />
          </div>

          {/* Editable WhatsApp Phone Number Field */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Number</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. 919527355515"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-xs font-medium text-gray-900 outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Include country code (e.g. 91 for India)</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
