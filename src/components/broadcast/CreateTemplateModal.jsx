import React, { useState } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { X } from 'lucide-react'

export default function CreateTemplateModal() {
  const { createTemplateModalOpen, closeCreateTemplateModal, saveNewTemplate } = useChatStore()
  const [newName, setNewName] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!createTemplateModalOpen) return null

  const handleInsertVariable = () => {
    setNewMessage((prev) => `${prev} {{Employee Name}}`)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!newName.trim() || !newMessage.trim()) return

    setIsSaving(true)
    const res = await saveNewTemplate({ name: newName.trim(), message: newMessage.trim() })
    setIsSaving(false)

    if (res.success) {
      setNewName('')
      setNewMessage('')
      closeCreateTemplateModal()
    } else {
      alert(`Failed to save template: ${res.error || 'Unknown error'}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-in fade-in select-none">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 flex flex-col gap-4">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h3 className="text-md font-bold text-gray-900 flex items-center gap-1.5">
            <span>➕</span> Create Custom Template
          </h3>
          <button onClick={closeCreateTemplateModal} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Template Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">Template Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Stock Count Alert"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#25D366] transition-colors"
            />
          </div>

          {/* Dynamic Variables Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">Variables (Click to insert)</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleInsertVariable}
                className="bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-102 flex items-center gap-1.5 cursor-pointer"
              >
                🧩 {"{{Employee Name}}"}
              </button>
            </div>
          </div>

          {/* Template Message */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-gray-700">Template Message</label>
            <textarea
              required
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type template message details here... Use variables to personalize"
              className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#25D366] transition-colors resize-none leading-relaxed font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={closeCreateTemplateModal}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !newName.trim() || !newMessage.trim()}
              className="px-5 py-2 bg-[#25D366] hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-green-500/10 cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
