import React from 'react'
import { useChatStore } from '../../store/useChatStore'
import { X, Check, Plus, Trash2 } from 'lucide-react'

export default function TemplatesModal() {
  const { 
    templatesModalOpen, 
    closeTemplatesModal, 
    templates, 
    setComposerText, 
    deleteTemplate, 
    openCreateTemplateModal 
  } = useChatStore()

  if (!templatesModalOpen) return null

  const handleSelect = (content) => {
    setComposerText(content)
    closeTemplatesModal()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none">
      {/* Templates Catalog Modal */}
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4 border border-gray-100 max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📋</span> WhatsApp Message Templates
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreateTemplateModal()}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Template
            </button>
            <button onClick={closeTemplatesModal} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex flex-col gap-3 pr-1">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-medium text-xs">
              No templates saved yet. Click "+ New Template" to add one!
            </div>
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => handleSelect(tpl.content)}
                className="p-4 rounded-2xl border border-gray-200 hover:border-[#25D366] bg-gray-50/50 hover:bg-emerald-50/30 cursor-pointer transition-all flex justify-between items-start group"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <h3 className="text-sm font-bold text-gray-900 group-hover:text-emerald-700 truncate">{tpl.name}</h3>
                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-line line-clamp-3 leading-relaxed">
                    {tpl.content}
                  </p>
                  <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                    Category: {tpl.category || 'General'}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (window.confirm(`⚠️ Are you sure you want to delete the template "${tpl.name}"?`)) {
                        deleteTemplate(tpl.id);
                      }
                    }}
                    className="text-gray-400 hover:text-rose-500 p-2 rounded-xl transition-colors bg-gray-100 hover:bg-rose-50 cursor-pointer"
                    title="Delete Template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button className="bg-[#25D366] text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
