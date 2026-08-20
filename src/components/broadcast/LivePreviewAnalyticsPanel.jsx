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
    <div className="bg-white rounded-2xl p-2.5 shadow-sm border border-gray-100 flex flex-col gap-2 items-center overflow-hidden h-full min-h-0">
      {/* Smartphone Mockup Frame */}
      <div className="w-[200px] h-[300px] bg-gray-900 rounded-[28px] p-2 relative shadow-lg border-4 border-gray-800 shrink-0">
        {/* Notch */}
        <div className="w-16 h-2.5 bg-gray-900 rounded-b-xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 z-20" />

        {/* Screen */}
        <div className="bg-[#efeae2] rounded-[20px] h-full overflow-hidden flex flex-col pt-1.5 relative">
          {/* WhatsApp Header */}
          <div className="bg-[#075E54] text-white p-2 font-semibold text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-[9px] shrink-0">
                DK
              </div>
              <span className="truncate text-[11px]">Drinqkart</span>
            </div>
            <span className="text-[9px] text-emerald-200 shrink-0">Online</span>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-2 flex flex-col justify-end overflow-y-auto bg-[radial-gradient(#0000000a_1px,transparent_1px)] [background-size:10px_10px]">
            <div className="bg-[#dcf8c6] text-gray-900 p-2 rounded-xl rounded-tr-none text-[11px] self-end max-w-[95%] shadow-xs leading-relaxed font-sans border border-emerald-200/60 overflow-hidden">
              {/* Embedded Header Attachment Preview (Single Attachment Mode) */}
              {attachments && attachments.length > 0 && (() => {
                const att = attachments[0]
                const isImage = att.type?.startsWith('image/') || att.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                const isPdf = att.type?.includes('pdf') || att.name.endsWith('.pdf')
                const isExcel = att.type?.includes('excel') || att.name.match(/\.(xlsx|xls|csv)$/i)

                if (isImage) {
                  return (
                    <div className="rounded-lg overflow-hidden border border-emerald-300/70 bg-emerald-900/10 mb-1.5">
                      <div className="h-16 bg-gradient-to-b from-emerald-800/20 to-emerald-900/30 flex flex-col items-center justify-center p-1 text-emerald-900">
                        <span className="text-xl mb-0.5">🖼️</span>
                        <span className="text-[8.5px] font-bold truncate max-w-[140px] text-gray-800">{att.name}</span>
                      </div>
                      <div className="p-1 bg-white/70 flex justify-between items-center text-[8.5px] font-medium text-gray-700">
                        <span className="truncate max-w-[100px]">{att.name}</span>
                        <span className="text-gray-500 font-mono text-[7.5px]">{att.size}</span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div className="bg-white/90 rounded-lg p-1.5 border border-emerald-300/70 flex items-center gap-1.5 shadow-xs mb-1.5">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[8px] font-extrabold shrink-0 ${
                      isPdf ? 'bg-rose-500' : isExcel ? 'bg-emerald-600' : 'bg-blue-500'
                    }`}>
                      {isPdf ? 'PDF' : isExcel ? 'XLS' : 'FILE'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong className="block text-[9.5px] font-bold text-gray-900 truncate leading-tight">{att.name}</strong>
                      <span className="text-[8px] text-gray-500 font-medium block">
                        {att.size}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Template Body Text */}
              <div className="whitespace-pre-wrap text-[10px]">{renderPreviewText()}</div>

              {/* Timestamp & Status */}
              <div className="text-[8px] text-gray-500 text-right mt-1 font-mono">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid */}
      <div className="w-full grid grid-cols-2 gap-2 shrink-0">
        <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
          <h2 className="text-base font-bold text-[#25D366] leading-none mb-0.5">98%</h2>
          <span className="text-[10px] text-gray-500 font-medium">Delivery Rate</span>
        </div>

        <div className="bg-gray-50 rounded-xl p-2 text-center border border-gray-100">
          <h2 className="text-base font-bold text-[#25D366] leading-none mb-0.5">84%</h2>
          <span className="text-[10px] text-gray-500 font-medium">Read Rate</span>
        </div>
      </div>

      {/* Recent Campaigns History */}
      <div className="w-full bg-gray-50 rounded-xl p-2.5 border border-gray-100 flex-1 min-h-0 overflow-y-auto">
        <h3 className="text-[11px] font-bold text-gray-800 mb-1.5 flex items-center gap-1">
          <span>📜</span> Recent Campaigns
        </h3>

        <div className="flex flex-col gap-1.5">
          {broadcastHistory.map((item) => (
            <div
              key={item.id}
              className="p-2 rounded-lg bg-white text-[10px] border-l-2 border-[#25D366] shadow-xs"
            >
              <strong className="block text-gray-900 font-semibold truncate">{item.title}</strong>
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
