import React from 'react'
import { useChatStore } from '../../store/useChatStore'

export default function LivePreviewAnalyticsPanel() {
  const { composerText, broadcastHistory, selectedEmployeeIds, shops, attachments } = useChatStore()

  // Find sample selected employee for preview
  const firstSelectedEmp = (shops || [])
    .flatMap((s) => s.employees)
    .find((e) => selectedEmployeeIds.includes(e.id)) || { name: 'Rahul', role: 'Manager' }

  const firstSelectedShop = (shops || [])
    .find((s) => s.employees.some((e) => e.id === firstSelectedEmp.id)) || { name: 'KUNAL ULWE' }

  // Dynamic preview replacement
  const renderPreviewText = () => {
    if (!composerText) return 'Message preview will appear here...'
    return composerText
      .replace(/\{\{Employee Name\}\}/g, firstSelectedEmp.name)
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4 items-center overflow-y-auto h-full">
      {/* Smartphone Mockup Frame */}
      <div className="w-[260px] h-[480px] bg-gray-900 rounded-[36px] p-3.5 relative shadow-xl border-4 border-gray-800 shrink-0">
        {/* Notch */}
        <div className="w-24 h-4 bg-gray-900 rounded-b-xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 z-20" />

        {/* Screen */}
        <div className="bg-[#efeae2] rounded-[26px] h-full overflow-hidden flex flex-col pt-3 relative">
          {/* WhatsApp Header */}
          <div className="bg-[#075E54] text-white p-3 font-semibold text-xs flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-[10px]">
                KW
              </div>
              <span className="truncate">Kunal Wines Admin</span>
            </div>
            <span className="text-[10px] text-emerald-200">Online</span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-3 flex flex-col justify-end overflow-y-auto bg-[radial-gradient(#0000000a_1px,transparent_1px)] [background-size:12px_12px]">
            <div className="bg-[#dcf8c6] text-gray-900 p-2.5 rounded-xl rounded-tr-none text-xs self-end max-w-[95%] shadow-xs leading-relaxed font-sans border border-emerald-200/60 overflow-hidden">
              {/* Embedded Header Attachment Preview (Single Attachment Mode) */}
              {attachments && attachments.length > 0 && (() => {
                const att = attachments[0]
                const isImage = att.type?.startsWith('image/') || att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                const isPdf = att.type?.includes('pdf') || att.name.endsWith('.pdf')
                const isExcel = att.type?.includes('excel') || att.name.match(/\.(xlsx|xls|csv)$/i)

                if (isImage) {
                  return (
                    <div className="rounded-lg overflow-hidden border border-emerald-300/70 bg-emerald-900/10 mb-2">
                      <div className="h-24 bg-gradient-to-b from-emerald-800/20 to-emerald-900/30 flex flex-col items-center justify-center p-2 text-emerald-900">
                        <span className="text-2xl mb-0.5">🖼️</span>
                        <span className="text-[9.5px] font-bold truncate max-w-[170px] text-gray-800">{att.name}</span>
                      </div>
                      <div className="p-1.5 bg-white/70 flex justify-between items-center text-[9.5px] font-medium text-gray-700">
                        <span className="truncate max-w-[130px]">{att.name}</span>
                        <span className="text-gray-500 font-mono text-[8.5px]">{att.size}</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="bg-white/90 rounded-lg p-2 border border-emerald-300/70 flex items-center gap-2 shadow-xs mb-2">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center text-white text-[9px] font-extrabold shrink-0 ${
                      isPdf ? 'bg-rose-500' : isExcel ? 'bg-emerald-600' : 'bg-blue-500'
                    }`}>
                      {isPdf ? 'PDF' : isExcel ? 'XLS' : 'FILE'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-[10.5px] font-bold text-gray-900 truncate leading-tight">{att.name}</strong>
                      <span className="text-[9px] text-gray-500 font-medium block">
                        {att.size} • {isPdf ? 'PDF Document' : isExcel ? 'Spreadsheet' : 'Attachment'}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Template Body Text */}
              <div className="whitespace-pre-wrap">{renderPreviewText()}</div>

              {/* Timestamp & Status */}
              <div className="text-[9px] text-gray-500 text-right mt-1 font-mono">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="w-full grid grid-cols-2 gap-3 shrink-0">
        <div className="bg-gray-50 rounded-2xl p-3.5 text-center border border-gray-100">
          <h2 className="text-xl font-bold text-[#25D366] leading-none mb-1">98%</h2>
          <span className="text-xs text-gray-500 font-medium">Delivery Rate</span>
        </div>

        <div className="bg-gray-50 rounded-2xl p-3.5 text-center border border-gray-100">
          <h2 className="text-xl font-bold text-[#25D366] leading-none mb-1">84%</h2>
          <span className="text-xs text-gray-500 font-medium">Read Rate</span>
        </div>
      </div>

      {/* Recent Campaigns History */}
      <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100 flex-1 min-h-[160px] overflow-y-auto">
        <h3 className="text-xs font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
          <span>📜</span> Recent Campaigns
        </h3>

        <div className="flex flex-col gap-2">
          {broadcastHistory.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-white text-xs border-l-4 border-[#25D366] shadow-xs hover:shadow-sm transition-shadow"
            >
              <strong className="block text-gray-900 font-semibold">{item.title}</strong>
              <small className="text-gray-500 font-medium">
                {item.date} • {item.sentCount} Sent
              </small>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
