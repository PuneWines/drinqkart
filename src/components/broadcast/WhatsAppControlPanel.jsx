import React, { useEffect, useState, useRef } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { supabase } from '../../lib/supabase'
import {
  Search,
  UserPlus,
  Send,
  Plus,
  Smile,
  FileText,
  Music,
  X,
  Loader2,
  Check,
  CheckCheck,
  MessageSquare,
  Phone,
  MoreVertical,
  AlertCircle,
  Edit2,
  Image as ImageIcon
} from 'lucide-react'
import EditContactModal from './EditContactModal'

export default function WhatsAppControlPanel() {
  const {
    whatsappConversations,
    selectedConversationId,
    whatsappMessages,
    whatsappSearchQuery,
    setWhatsAppSearchQuery,
    setIsNewContactModalOpen,
    fetchWhatsAppConversations,
    selectWhatsAppConversation,
    fetchWhatsAppMessages,
    sendDirectWhatsAppMessage,
    uploadLiveChatMedia,
  } = useChatStore()

  const [inputText, setInputText] = useState('')
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [attachedFile, setAttachedFile] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('smileys')
  const [isSending, setIsSending] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const messagesEndRef = useRef(null)
  const imageInputRef = useRef(null)
  const docInputRef = useRef(null)
  const audioInputRef = useRef(null)

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

  // 1. Initial Load & Sync on Mount / Select
  useEffect(() => {
    fetchWhatsAppConversations()
    if (selectedConversationId) {
      fetchWhatsAppMessages(selectedConversationId)
    }
  }, [fetchWhatsAppConversations, fetchWhatsAppMessages, selectedConversationId])

  // 2. Auto-scroll to bottom of chat feed when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [whatsappMessages])

  // Filter conversations by search query
  const filteredConversations = whatsappConversations.filter((c) => {
    const contactName = c.whatsapp_contacts?.name || ''
    const phone = c.whatsapp_contacts?.phone_number || c.id
    const search = whatsappSearchQuery.toLowerCase()
    return contactName.toLowerCase().includes(search) || phone.includes(search)
  })

  const activeConversation = whatsappConversations.find(
    (c) => c.id === selectedConversationId
  )
  const activeContact = activeConversation?.whatsapp_contacts

  const handleSelectFile = async (e) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    setShowAttachmentMenu(false)
    setIsUploading(true)

    const publicUrl = await uploadLiveChatMedia(file)
    setIsUploading(false)
    e.target.value = ''

    if (publicUrl) {
      setMediaUrlInput(publicUrl)
      setAttachedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(0)} KB`,
        type: file.type?.startsWith('image/') ? 'Image' : file.type?.startsWith('audio/') ? 'Audio' : 'Document',
        url: publicUrl
      })
    }
  }

  const handleInsertEmoji = (emoji) => {
    setInputText((prev) => prev + emoji)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim() && !mediaUrlInput.trim()) return

    setIsSending(true)
    await sendDirectWhatsAppMessage(inputText, mediaUrlInput || null)
    setInputText('')
    setMediaUrlInput('')
    setAttachedFile(null)
    setShowAttachmentMenu(false)
    setShowEmojiPicker(false)
    setIsSending(false)
  }

  // Format timestamps nicely (e.g. "10:42 AM", "Yesterday", "12/08/26")
  const formatMessageTime = (dateString) => {
    if (!dateString) return ''
    const d = new Date(dateString)
    if (isNaN(d.getTime())) return ''

    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    }

    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Helper to check if string is automated caption
  const isHumanCaption = (content, mediaUrl) => {
    if (!content) return false
    if (content === mediaUrl) return false
    if (content.startsWith('false_') || content.startsWith('true_')) return false
    if (/\.(jpeg|jpg|png|gif|mp4|webm|pdf|doc|docx|xls|xlsx)$/i.test(content)) return false
    return true
  }

  // Smart Media Renderer (Handles Image, Video, Audio, Document PDF)
  const renderMediaElement = (msg) => {
    const url = msg.media_url || (msg.message_type === 'media' ? msg.content : null)
    if (!url) return null

    const lowerUrl = String(url).toLowerCase()

    if (/\.(mp4|webm|mov|ogg)$/i.test(lowerUrl)) {
      return (
        <div className="mb-1.5 rounded-xl overflow-hidden bg-black/10">
          <video src={url} controls className="max-w-full max-h-60 rounded-xl" />
        </div>
      )
    }

    if (/\.(mp3|wav|m4a|aac|opus)$/i.test(lowerUrl) || msg.message_type === 'audio') {
      return (
        <div className="mb-1.5 p-2 bg-emerald-50/50 rounded-xl border border-emerald-100">
          <audio src={url} controls className="w-full h-8" />
        </div>
      )
    }

    if (/\.(pdf|doc|docx|xls|xlsx|txt|csv)$/i.test(lowerUrl)) {
      const fileName = url.split('/').pop().split('?')[0] || 'Document'
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-1.5 p-2.5 bg-gray-50 hover:bg-emerald-50 rounded-xl border border-gray-200 flex items-center gap-2 text-emerald-700 transition-colors block"
        >
          <FileText className="w-5 h-5 shrink-0" />
          <span className="font-semibold truncate text-xs">{fileName}</span>
        </a>
      )
    }

    return (
      <div className="mb-1.5 rounded-xl overflow-hidden bg-gray-100">
        <img
          src={url}
          alt="WhatsApp Media"
          className="max-w-full max-h-64 object-cover rounded-xl hover:opacity-95 transition-opacity cursor-pointer"
          onClick={() => window.open(url, '_blank')}
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />
      </div>
    )
  }

  const renderConversationPreview = (lastText) => {
    if (!lastText) return <span className="italic text-gray-400">No messages</span>
    if (isHumanCaption(lastText, null)) {
      return <span>{lastText}</span>
    }
    return <span className="italic text-emerald-600 font-medium">[Media Attachment]</span>
  }

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row h-full min-h-0 overflow-hidden">
      {/* ======================================================== */}
      {/* LEFT SIDEBAR: CONVERSATIONS LIST                          */}
      {/* ======================================================== */}
      <div className="w-full md:w-72 lg:w-80 border-r border-gray-100 flex flex-col h-full bg-white shrink-0 min-h-0">
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <span>💬</span> WhatsApp Live Chats
          </h2>

          <button
            onClick={() => setIsNewContactModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-[#25D366] hover:bg-green-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            title="Start new WhatsApp Chat"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ New Chat</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-gray-100 bg-gray-50/50">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search chat or phone..."
              value={whatsappSearchQuery}
              onChange={(e) => setWhatsAppSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500 transition-colors shadow-2xs"
            />
          </div>
        </div>

        {/* Conversations Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-emerald-500" />
              <p className="text-xs font-medium">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const contact = conv.whatsapp_contacts
              const displayName = contact?.name || contact?.phone_number || conv.id.split('@')[0]
              const isSelected = conv.id === selectedConversationId
              const hasUnread = conv.unread_count > 0

              return (
                <div
                  key={conv.id}
                  onClick={() => selectWhatsAppConversation(conv.id)}
                  className={`p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-emerald-50/60 ${isSelected ? 'bg-emerald-50/90 border-l-4 border-[#25D366]' : ''
                    }`}
                >
                  {/* Avatar */}
                  {contact?.avatar_url ? (
                    <img
                      src={contact.avatar_url}
                      alt={displayName}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-gray-900 truncate">
                        {displayName}
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium shrink-0">
                        {formatMessageTime(conv.last_message_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500 truncate max-w-[180px]">
                        {renderConversationPreview(conv.last_message_text)}
                      </div>
                      {hasUnread && (
                        <span className="ml-2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-sm">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT MAIN VIEW: ACTIVE CHAT FEED & COMPOSER             */}
      {/* ======================================================== */}
      {selectedConversationId ? (
        <div className="flex-1 flex flex-col h-full min-h-0 bg-[#efeae2]/30 relative overflow-hidden">
          {/* Chat Header */}
          <div className="p-3.5 bg-white border-b border-gray-100 flex items-center justify-between shadow-xs z-10">
            <div className="flex items-center gap-3">
              {activeContact?.avatar_url ? (
                <img
                  src={activeContact.avatar_url}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center text-sm">
                  {(activeContact?.name || selectedConversationId).charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {activeContact?.name || selectedConversationId.split('@')[0]}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  +{activeContact?.phone_number || selectedConversationId.split('@')[0]}
                </p>
              </div>
            </div>

            <div className="flex items-center">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Contact</span>
              </button>
            </div>
          </div>

          {/* Messages Scroll Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {whatsappMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-gray-400">
                <div>
                  <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30 text-emerald-500" />
                  <p className="text-xs font-medium">No messages yet. Send a message to start!</p>
                </div>
              </div>
            ) : (
              whatsappMessages.map((msg) => {
                const isMe = msg.from_me
                const showCaption = isHumanCaption(msg.content, msg.media_url)

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] sm:max-w-[65%] px-3.5 py-2 rounded-2xl shadow-xs text-xs relative ${isMe
                          ? 'bg-gradient-to-r from-[#25D366] to-emerald-600 text-white rounded-tr-none'
                          : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
                        }`}
                    >
                      {/* Smart Media Component (Video/GIF, Audio, Document, Image) */}
                      {renderMediaElement(msg)}

                      {/* Human Message Content / Caption */}
                      {showCaption && (
                        <p className="leading-relaxed whitespace-pre-wrap break-words font-medium">
                          {msg.content}
                        </p>
                      )}

                      {/* Message Footer (Time & Read Status Ticks) */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${isMe ? 'text-emerald-100' : 'text-gray-400'
                          }`}
                      >
                        <span>{formatMessageTime(msg.timestamp)}</span>

                        {isMe && (
                          <span className="ml-1">
                            {msg.status === 'failed' ? (
                              <span title="Delivery failed (SafeMode Volume Cap or invalid number)">
                                <AlertCircle className="w-3.5 h-3.5 text-red-300 inline" />
                              </span>
                            ) : msg.status === 'seen' || msg.ack_code === 3 ? (
                              <CheckCheck className="w-3.5 h-3.5 text-cyan-300 inline" />
                            ) : msg.status === 'reached' || msg.ack_code === 2 ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white/80 inline" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-white/70 inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Bar */}
          <div className="p-3 bg-white border-t border-gray-100 relative">
            {/* Attachment Menu Popup */}
            {showAttachmentMenu && (
              <div className="absolute bottom-16 left-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-xl flex flex-col gap-2 z-30 animate-in fade-in slide-in-from-bottom-2 min-w-[200px]">
                <span className="text-[11px] font-bold text-gray-500 px-2 uppercase tracking-wider">Attach File</span>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-semibold text-xs transition-all cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block leading-tight">Photos & Videos</strong>
                    <span className="text-[10px] text-gray-400 font-normal">Images, Videos, GIFs</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-semibold text-xs transition-all cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block leading-tight">Document</strong>
                    <span className="text-[10px] text-gray-400 font-normal">PDF, DOC, XLS, TXT</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 text-gray-700 hover:text-amber-700 font-semibold text-xs transition-all cursor-pointer text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Music className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="block leading-tight">Audio / Voice</strong>
                    <span className="text-[10px] text-gray-400 font-normal">MP3, WAV, Voice note</span>
                  </div>
                </button>
              </div>
            )}

            {/* Hidden Native File Inputs */}
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*,video/*"
              onChange={handleSelectFile}
              className="hidden"
            />
            <input
              type="file"
              ref={docInputRef}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleSelectFile}
              className="hidden"
            />
            <input
              type="file"
              ref={audioInputRef}
              accept="audio/*"
              onChange={handleSelectFile}
              className="hidden"
            />

            {/* Emoji Picker Popup */}
            {showEmojiPicker && (
              <div className="absolute bottom-16 left-12 bg-white border border-gray-200 rounded-2xl p-3 shadow-xl z-30 animate-in fade-in slide-in-from-bottom-2 w-72 sm:w-80 flex flex-col gap-2">
                <div className="flex justify-between items-center pb-1.5 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-800">Select Emoji</span>
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(false)}
                    className="text-gray-400 hover:text-gray-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Category Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-100 pb-1 overflow-x-auto">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveEmojiCategory(cat.id)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap ${activeEmojiCategory === cat.id
                          ? 'bg-emerald-100 text-emerald-800 font-bold'
                          : 'text-gray-500 hover:bg-gray-100'
                        }`}
                    >
                      <span>{cat.icon}</span>
                    </button>
                  ))}
                </div>

                {/* Emoji Grid */}
                <div className="grid grid-cols-7 gap-1 max-h-36 overflow-y-auto p-1">
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

            {/* Uploading Progress Indicator */}
            {isUploading && (
              <div className="mb-2 p-2.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 text-xs font-semibold flex items-center gap-2 animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Uploading media to Supabase storage...</span>
              </div>
            )}

            {/* Attached File Preview Card */}
            {attachedFile && !isUploading && (
              <div className="mb-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base">📎</span>
                  <div className="min-w-0">
                    <strong className="block text-xs text-gray-800 truncate" title={attachedFile.name}>
                      {attachedFile.name}
                    </strong>
                    <span className="text-[10px] text-gray-500">{attachedFile.type} • {attachedFile.size}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedFile(null)
                    setMediaUrlInput('')
                  }}
                  className="text-gray-400 hover:text-rose-500 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Input Form Bar */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
              {/* Attachment '+' Button */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentMenu(!showAttachmentMenu)
                  setShowEmojiPicker(false)
                }}
                className={`p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors ${showAttachmentMenu ? 'bg-emerald-100 text-emerald-700' : ''
                  }`}
                title="Attach Media or File"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Emoji Button */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker)
                  setShowAttachmentMenu(false)
                }}
                className={`p-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors ${showEmojiPicker ? 'bg-emerald-100 text-emerald-700' : ''
                  }`}
                title="Add Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Message Input Box */}
              <input
                type="text"
                placeholder="Type a WhatsApp message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-100 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isSending || isUploading || (!inputText.trim() && !mediaUrlInput.trim())}
                className="p-2.5 bg-gradient-to-r from-[#25D366] to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-md shadow-green-500/20 disabled:opacity-40 transition-all flex items-center justify-center cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50 text-center p-8">
          <div>
            <MessageSquare className="w-16 h-16 text-emerald-500/30 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800 mb-1">Select a Conversation</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Choose a chat from the sidebar or click "+ New Chat" to start a live 1:1 WhatsApp conversation.
            </p>
          </div>
        </div>
      )}

      {/* Edit Contact Name Modal */}
      <EditContactModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        contact={
          activeContact || {
            id: selectedConversationId,
            phone_number: selectedConversationId?.split('@')[0],
            name: selectedConversationId?.split('@')[0],
          }
        }
      />
    </div>
  )
}
