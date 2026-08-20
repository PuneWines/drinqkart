import React, { useState, useRef } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { FileText, Smile, Puzzle, Clock, History, Paperclip, Trash2, Send, Plus, X, ChevronDown, Check } from 'lucide-react'

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '☺️', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
      '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒',
      '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢',
      '😭', '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
      '😰', '😥', '😓', '🫣', '🤗', '🫡', '🤔', '🤭', '🤫', '🫠', '🤥', '😶',
      '😐', '😑', '😬', '🫨', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴'
    ]
  },
  {
    id: 'gestures',
    name: 'Gestures & Body',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '🖕', '👇', '☝️', '🫵', '✊', '👊', '🤛', '🤜', '👏', '🙌',
      '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '🦶', '👂',
      '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋'
    ]
  },
  {
    id: 'business',
    name: 'Work & Business',
    icon: '💼',
    emojis: [
      '💼', '🏬', '🏪', '🏫', '🏦', '🏨', '🏢', '🏗️', '📦', '📊', '📈', '📉',
      '📄', '📃', '📑', '📜', '📋', '📅', '📆', '🗓️', '📇', '📱', '📲', '☎️',
      '📞', '📟', '📠', '🔋', '🔌', '💻', '🖥️', '🖨️', '⌨️', '💰', '💴', '💵',
      '💶', '💷', '💸', '💳', '🧾', '✉️', '📧', '📨', '📩', '🏷️', '🔖', '📌'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drinks',
    icon: '🍷',
    emojis: [
      '🍷', '🍺', '🍻', '🥂', '🍾', '🍹', '🍸', '🥃', '🥤', '🧃', '🧋', '☕',
      '🍵', '🍼', '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🥚', '🍳', '🧇', '🥞',
      '🧈', '🍞', '🥐', '🥖', '🥨', '🧀', '🥗', '🥣', '🍚', '🍜', '🍝', '🍣',
      '🍱', '🥟', '🍤', '🍙', '🍘', '🍥', '🍡', '🍢', '🍧', '🍨', '🍦', '🥧'
    ]
  },
  {
    id: 'alerts',
    name: 'Alerts & Celebration',
    icon: '🚨',
    emojis: [
      '🚨', '📢', '🔔', '🔕', '🎉', '🎊', '✨', '🔥', '💥', '💯', '⭐️', '🌟',
      '☀️', '🌈', '⚡️', '💣', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🎁', '🎈',
      '✅', '❌', '⚠️', '⛔️', '🛑', '⭕️', '❓', '❗', '🅰️', '🅱️', 'ℹ️', '🔝'
    ]
  }
]

export default function MessageComposerPanel() {
  const {
    composerText,
    setComposerText,
    insertVariable,
    attachments,
    removeAttachment,
    addAttachment,
    selectedShopIds,
    selectedEmployeeIds,
    templates,
    openTemplatesModal,
    openScheduleModal,
    openHistoryModal,
    openCreateTemplateModal,
    deleteTemplate,
    scheduledCampaign,
    clearScheduledCampaign,
    sendDashboardBroadcast,
  } = useChatStore()

  const [activePopup, setActivePopup] = useState(null)
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys')
  const fileInputRef = useRef(null)

  const togglePopup = (name) => {
    setActivePopup((prev) => (prev === name ? null : name))
  }

  const handleFileUpload = (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    addAttachment(files[0])
    e.target.value = ''
  }

  const handleSelectTemplate = (content) => {
    setComposerText(content)
    setActivePopup(null)
  }

  const handleInsertEmoji = (emoji) => {
    insertVariable(emoji)
  }

  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    setSending(true)
    try {
      await sendDashboardBroadcast()
      alert('🎉 WhatsApp Broadcast Campaign sent successfully!')
    } catch (err) {
      console.error(err)
      alert('⚠️ Error sending broadcast: ' + (err.message || 'Unknown error'))
    } finally {
      setSending(false)
    }
  }

  const activeShopCount = selectedShopIds.length
  const activeEmpCount = selectedEmployeeIds.length
  const attachmentCount = attachments.length

  return (
    <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-xs border border-gray-100 flex flex-col gap-2.5 overflow-hidden h-full min-h-0">
      {/* Toolbar Row */}
      <div className="relative flex justify-between items-center flex-wrap gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* Templates Button */}
          <button
            onClick={() => togglePopup('templates')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all ${activePopup === 'templates'
              ? 'bg-[#25D366] text-white shadow-sm'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Templates
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Emoji Button */}
          <button
            onClick={() => togglePopup('emoji')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all ${activePopup === 'emoji'
              ? 'bg-[#25D366] text-white shadow-sm'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Emoji
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Variables Button */}
          <button
            onClick={() => togglePopup('variables')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all ${activePopup === 'variables'
              ? 'bg-[#25D366] text-white shadow-sm'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            <Puzzle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Variables
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Schedule Button */}
          <button
            onClick={openScheduleModal}
            className={`flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-semibold transition-all ${scheduledCampaign
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
            {scheduledCampaign ? `Scheduled (${scheduledCampaign.date})` : 'Schedule'}
          </button>
        </div>

        {/* History Button */}
        <button
          onClick={openHistoryModal}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-xl sm:rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] sm:text-xs font-semibold transition-colors ml-auto"
        >
          <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> History
        </button>

        {/* Dynamic Popover Dropdowns */}
        {activePopup === 'variables' && (
          <div className="w-full bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3 shadow-md flex items-center justify-between flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-emerald-900 mr-1">🧩 Dynamic Variables:</span>
              {['{{Employee Name}}'].map((variable) => (
                <button
                  key={variable}
                  onClick={() => insertVariable(variable)}
                  className="bg-white hover:bg-emerald-600 hover:text-white text-emerald-800 px-3 py-1 rounded-full text-xs font-semibold transition-colors shadow-2xs border border-emerald-200"
                >
                  {variable}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActivePopup(null)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activePopup === 'templates' && (
          <div className="w-full bg-white border border-gray-200 rounded-2xl p-3 shadow-xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 max-h-60 overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                📋 Select Message Template:
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActivePopup(null)
                    openCreateTemplateModal()
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-lg text-[10px] flex items-center gap-1 transition-colors border border-emerald-200 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add New Template
                </button>
                <button onClick={() => setActivePopup(null)} className="text-gray-400 hover:text-gray-600 p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(templates || []).map((tpl) => (
                <div key={tpl.id} className="relative group cursor-pointer">
                  <button
                    onClick={() => handleSelectTemplate(tpl.content)}
                    className="w-full p-2.5 pr-8 rounded-xl border border-gray-200 hover:border-[#25D366] bg-gray-50 hover:bg-emerald-50 text-left transition-all text-xs"
                  >
                    <strong className="block font-bold text-gray-900 group-hover:text-emerald-700 truncate">
                      {tpl.name}
                    </strong>
                    <span className="text-[10px] text-gray-500 line-clamp-1">{tpl.content}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (window.confirm(`⚠️ Are you sure you want to delete the template "${tpl.name}"?`)) {
                        deleteTemplate(tpl.id);
                      }
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-rose-500 transition-colors p-1"
                    title="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-1 text-center border-t border-gray-100">
              <button
                onClick={() => {
                  setActivePopup(null)
                  openTemplatesModal()
                }}
                className="text-xs text-emerald-600 font-semibold hover:underline"
              >
                View Full Templates Catalog →
              </button>
            </div>
          </div>
        )}

        {activePopup === 'emoji' && (
          <div className="w-full bg-white border border-gray-200 rounded-2xl p-3 shadow-xl flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center pb-1.5 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                😊 Select Emoji (Click to insert):
              </span>
              <button onClick={() => setActivePopup(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-100 pb-1 overflow-x-auto">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveEmojiCategory(cat.id)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${
                    activeEmojiCategory === cat.id
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Emoji Grid */}
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-1 max-h-36 overflow-y-auto p-1">
              {(EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory)?.emojis || []).map((emoji, idx) => (
                <button
                  key={`${emoji}-${idx}`}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="text-lg p-1 rounded-lg hover:bg-emerald-100 hover:scale-125 transition-transform text-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scheduled Campaign Active Banner */}
      {scheduledCampaign && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3.5 py-2 text-xs flex justify-between items-center">
          <span className="font-semibold flex items-center gap-1.5">
            <span>⏰</span> Scheduled for: <strong>{scheduledCampaign.date}</strong> at <strong>{scheduledCampaign.time}</strong>
          </span>
          <button
            onClick={clearScheduledCampaign}
            className="text-amber-700 hover:text-rose-600 font-bold text-xs hover:underline flex items-center gap-1"
          >
            Clear Schedule <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Message Composer Area */}
      <div className="flex-1 flex flex-col gap-2.5 sm:gap-3 min-h-0">
        {/* Default Quick Variable Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {['{{Employee Name}}'].map((variable) => (
            <button
              key={variable}
              onClick={() => insertVariable(variable)}
              className="bg-sky-100 hover:bg-sky-200 text-sky-700 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-colors shadow-xs"
            >
              {variable}
            </button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          value={composerText}
          onChange={(e) => setComposerText(e.target.value)}
          placeholder="Type your WhatsApp broadcast message here..."
          className="w-full flex-1 p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#25D366] text-xs sm:text-sm text-gray-800 leading-relaxed resize-none bg-[#fcfcfc] min-h-[60px] sm:min-h-[80px] font-sans"
        />

        {/* Attachment Section */}
        <div className="bg-gray-50 rounded-xl p-2 sm:p-2.5 border-2 border-dashed border-emerald-100 shrink-0">
          <div className="flex justify-between items-center mb-1.5">
            <strong className="text-[10px] sm:text-[11px] font-bold text-gray-800 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-emerald-600" /> Attachment ({attachments.length})
            </strong>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] sm:text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="w-20 sm:w-28 min-w-[80px] sm:min-w-[112px] bg-white rounded-xl p-2 shadow-xs border border-gray-100 flex flex-col justify-between group relative shrink-0"
              >
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute top-1 right-1 text-gray-400 hover:text-rose-500 transition-colors p-0.5"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <div className="text-xl sm:text-2xl mb-1">{att.icon}</div>
                <div>
                  <strong className="block text-[9px] sm:text-[10px] font-bold text-gray-800 truncate" title={att.name}>
                    {att.name}
                  </strong>
                  <p className="text-[8px] sm:text-[9px] text-gray-400 mt-0.5">{att.size}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Send Bar */}
      <div className="bg-gray-900 text-white rounded-xl px-3 sm:px-4 py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-lg shrink-0">
        <div className="min-w-0 flex-1">
          <strong className="block text-xs font-bold tracking-tight text-white truncate">
            {activeShopCount} {activeShopCount === 1 ? 'Shop' : 'Shops'} • {activeEmpCount} {activeEmpCount === 1 ? 'Employee' : 'Employees'} • {attachmentCount} {attachmentCount === 1 ? 'Attachment' : 'Attachments'}
          </strong>
          <span className="text-[9px] sm:text-[10px] text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {scheduledCampaign ? `Scheduled for ${scheduledCampaign.date}` : 'Ready for Broadcast'}
          </span>
        </div>

        <button
          onClick={handleSend}
          disabled={activeEmpCount === 0 || (!composerText.trim() && attachmentCount === 0) || sending}
          className="bg-[#25D366] hover:bg-green-600 disabled:opacity-50 text-white font-bold px-3.5 sm:px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-green-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0 self-stretch sm:self-auto justify-center"
        >
          <span className="text-sm leading-none">{sending ? '⏳' : '🟢'}</span>
          {sending ? 'Sending...' : scheduledCampaign ? 'Set Scheduled Broadcast' : 'Send WhatsApp Broadcast'}
        </button>
      </div>
    </div>
  )
}
