import React from 'react'
import { useChatStore } from '../../store/useChatStore'

export default function Header() {
  const { messageStats } = useChatStore()

  return (
    <header className="min-h-[64px] sm:h-20 bg-white flex items-center justify-between px-3.5 sm:px-7 py-2.5 sm:py-0 shadow-sm z-10 select-none border-b border-gray-100 gap-2 shrink-0">
      {/* Logo Area */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0 flex-1">
        <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#25D366] to-green-600 flex items-center justify-center text-white text-lg sm:text-2xl font-bold shadow-md shadow-green-500/20 shrink-0">
          W
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-snug truncate sm:whitespace-normal">
            WhatsApp Broadcast Dashboard
          </h1>
          <p className="text-[11px] sm:text-sm text-gray-500 font-medium truncate sm:whitespace-normal">
            Send messages, reports & updates to all shops instantly
          </p>
        </div>
      </div>

      {/* Header Right */}
      <div className="flex items-center gap-2 sm:gap-5 shrink-0">
        <div className="hidden md:flex bg-[#f3f6fb] rounded-2xl px-4 py-2.5 text-center min-w-[95px] border border-gray-100">
          <div>
            <h3 className="text-emerald-500 text-lg font-bold leading-none mb-1">{messageStats.sent}</h3>
            <span className="text-xs text-gray-500 font-medium">Sent</span>
          </div>
        </div>

        <div className="hidden md:flex bg-[#f3f6fb] rounded-2xl px-4 py-2.5 text-center min-w-[95px] border border-gray-100">
          <div>
            <h3 className="text-emerald-500 text-lg font-bold leading-none mb-1">{messageStats.delivered}</h3>
            <span className="text-xs text-gray-500 font-medium">Delivered</span>
          </div>
        </div>

        <div className="hidden md:flex bg-[#f3f6fb] rounded-2xl px-4 py-2.5 text-center min-w-[95px] border border-gray-100">
          <div>
            <h3 className="text-emerald-500 text-lg font-bold leading-none mb-1">{messageStats.read}</h3>
            <span className="text-xs text-gray-500 font-medium">Read</span>
          </div>
        </div>
      </div>
    </header>
  )
}
