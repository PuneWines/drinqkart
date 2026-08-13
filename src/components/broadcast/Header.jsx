import React from 'react'
import { useChatStore } from '../../store/useChatStore'
import { Radio, MessageSquare, Smartphone } from 'lucide-react'

export default function Header() {
  const { messageStats, activeDashboardTab, setActiveDashboardTab } = useChatStore()

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

      {/* View Switcher Toggle */}
      <div className="flex items-center bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200/60 shadow-inner">
        <button
          onClick={() => setActiveDashboardTab('broadcast')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeDashboardTab === 'broadcast'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Radio className={`w-4 h-4 ${activeDashboardTab === 'broadcast' ? 'text-green-600' : ''}`} />
          <span className="hidden sm:inline">Broadcast Campaign</span>
          <span className="sm:hidden">Broadcast</span>
        </button>

        <button
          onClick={() => setActiveDashboardTab('whatsapp')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
            activeDashboardTab === 'whatsapp'
              ? 'bg-gradient-to-r from-[#25D366] to-emerald-600 text-white shadow-md shadow-green-500/20'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Mobile View</span>
        </button>
      </div>

      {/* Header Right Stats */}
      <div className="hidden xl:flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="bg-[#f3f6fb] rounded-2xl px-3.5 py-2 text-center min-w-[85px] border border-gray-100">
          <div>
            <h3 className="text-emerald-500 text-base font-bold leading-none mb-0.5">{messageStats.sent}</h3>
            <span className="text-[11px] text-gray-500 font-medium">Sent</span>
          </div>
        </div>

        <div className="bg-[#f3f6fb] rounded-2xl px-3.5 py-2 text-center min-w-[85px] border border-gray-100">
          <div>
            <h3 className="text-emerald-500 text-base font-bold leading-none mb-0.5">{messageStats.delivered}</h3>
            <span className="text-[11px] text-gray-500 font-medium">Delivered</span>
          </div>
        </div>

        <div className="bg-[#f3f6fb] rounded-2xl px-3.5 py-2 text-center min-w-[85px] border border-gray-100">
          <div>
            <h3 className="text-emerald-500 text-base font-bold leading-none mb-0.5">{messageStats.read}</h3>
            <span className="text-[11px] text-gray-500 font-medium">Read</span>
          </div>
        </div>
      </div>
    </header>
  )
}
