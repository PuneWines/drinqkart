import React, { useEffect, useState, useRef } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { supabase } from '../../lib/supabase'
import {
  Search,
  UserPlus,
  Send,
  Paperclip,
  Check,
  CheckCheck,
  MessageSquare,
  Phone,
  MoreVertical,
  Smile,
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
  } = useChatStore()

  const [inputText, setInputText] = useState('')
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [showMediaInput, setShowMediaInput] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const messagesEndRef = useRef(null)

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

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputText.trim() && !mediaUrlInput.trim()) return

    setIsSending(true)
    await sendDirectWhatsAppMessage(inputText, mediaUrlInput || null)
    setInputText('')
    setMediaUrlInput('')
    setShowMediaInput(false)
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

  // Helper to render media (Images, Videos/GIFs, Audio, Documents)
  const renderMediaElement = (msg) => {
    if (!msg.media_url) return null

    const url = msg.media_url.toLowerCase()
    const type = (msg.message_type || '').toLowerCase()

    const isVideo =
      type === 'video' ||
      type === 'gif' ||
      url.endsWith('.mp4') ||
      url.endsWith('.webm') ||
      url.endsWith('.mov') ||
      url.includes('.mp4?')

    const isAudio =
      type === 'audio' ||
      type === 'ptt' ||
      url.endsWith('.mp3') ||
      url.endsWith('.wav') ||
      url.endsWith('.ogg') ||
      url.endsWith('.m4a')

    const isDoc =
      type === 'document' ||
      url.endsWith('.pdf') ||
      url.endsWith('.doc') ||
      url.endsWith('.docx')

    if (isVideo) {
      return (
        <div className="mb-2 overflow-hidden rounded-xl bg-black/10">
          <video
            src={msg.media_url}
            controls
            preload="metadata"
            className="max-h-64 w-full rounded-xl object-cover"
          />
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="mb-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
          <audio src={msg.media_url} controls className="w-full h-8" />
        </div>
      )
    }

    if (isDoc) {
      const fileName = msg.media_url.split('/').pop() || 'Document'
      return (
        <div className="mb-2 p-2.5 bg-gray-100/80 rounded-xl border border-gray-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 truncate">
            <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-semibold text-gray-700 truncate">{fileName}</span>
          </div>
          <a
            href={msg.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-bold text-emerald-600 hover:underline shrink-0"
          >
            Download
          </a>
        </div>
      )
    }

    // Default to Image
    return (
      <div className="mb-2 overflow-hidden rounded-xl">
        <img
          src={msg.media_url}
          alt="Media content"
          className="max-h-64 w-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none'
          }}
        />
      </div>
    )
  }

  // Helper to check if text content is a real human caption (not internal false_...mp4 string)
  const isHumanCaption = (content, mediaUrl) => {
    if (!content || !content.trim()) return false
    const str = content.trim()
    if (str === mediaUrl) return false
    if (str.startsWith('false_') || str.startsWith('true_')) return false
    return true
  }

  // Helper to render conversation list preview snippet (Media icon vs text content)
  const renderConversationPreview = (lastText) => {
    if (!lastText || !lastText.trim()) return 'No messages'
    const str = lastText.trim()

    const isAutoFilename =
      str.startsWith('false_') ||
      str.startsWith('true_') ||
      (str.match(/\.(jpeg|jpg|png|gif|mp4|webm|pdf|doc)$/i) && !str.includes(' '))
    const isMediaTag = str.startsWith('[') && str.endsWith(']')

    if (isAutoFilename || isMediaTag || str.toLowerCase() === 'media') {
      return (
        <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
          <ImageIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span>Media</span>
        </span>
      )
    }

    return str
  }

  return (
    <div className="flex-1 h-full bg-white rounded-3xl shadow-sm border border-gray-100 flex overflow-hidden">
      {/* ======================================================== */}
      {/* LEFT SIDEBAR: CONVERSATION LIST                          */}
      {/* ======================================================== */}
      <div className="w-full md:w-80 lg:w-96 border-r border-gray-100 flex flex-col bg-gray-50/50 shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              WhatsApp Chats
            </h2>
            <button
              onClick={() => setIsNewContactModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-xs font-bold rounded-xl transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search chat or phone..."
              value={whatsappSearchQuery}
              onChange={(e) => setWhatsAppSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100/60">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-medium">No conversations found</p>
              <button
                onClick={() => setIsNewContactModalOpen(true)}
                className="mt-3 text-xs text-emerald-600 font-bold hover:underline"
              >
                + Start a new chat
              </button>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConversationId
              const contact = conv.whatsapp_contacts
              const displayName = contact?.name || contact?.phone_number || conv.id.split('@')[0]
              const hasUnread = conv.unread_count > 0

              return (
                <div
                  key={conv.id}
                  onClick={() => selectWhatsAppConversation(conv.id)}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/80 border-l-4 border-emerald-500'
                      : 'hover:bg-gray-100/60'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {contact?.avatar_url ? (
                      <img
                        src={contact.avatar_url}
                        alt={displayName}
                        className="w-11 h-11 rounded-full object-cover shadow-sm"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Details */}
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
        <div className="flex-1 flex flex-col h-full bg-[#efeae2]/30 relative">
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
                      className={`max-w-[75%] sm:max-w-[65%] px-3.5 py-2 rounded-2xl shadow-xs text-xs relative ${
                        isMe
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
                        className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                          isMe ? 'text-emerald-100' : 'text-gray-400'
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
          <div className="p-3 bg-white border-t border-gray-100">
            {showMediaInput && (
              <div className="mb-2 p-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  placeholder="Paste Media/Image URL..."
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none"
                />
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                className={`p-2.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors ${
                  showMediaInput ? 'bg-emerald-50 text-emerald-600' : ''
                }`}
                title="Attach Media URL"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                placeholder="Type a WhatsApp message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-100 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl text-xs font-medium outline-none transition-all"
              />

              <button
                type="submit"
                disabled={isSending || (!inputText.trim() && !mediaUrlInput.trim())}
                className="p-2.5 bg-gradient-to-r from-[#25D366] to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl shadow-md shadow-green-500/20 disabled:opacity-40 transition-all flex items-center justify-center"
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
