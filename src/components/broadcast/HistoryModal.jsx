import React from 'react'
import { useChatStore } from '../../store/useChatStore'
import { X, CheckCircle2, FileText } from 'lucide-react'

export default function HistoryModal() {
  const { historyModalOpen, closeHistoryModal, broadcastHistory } = useChatStore()

  if (!historyModalOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl flex flex-col gap-4 border border-gray-100 max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>📜</span> Campaign Message History Log
          </h2>
          <button onClick={closeHistoryModal} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 border border-gray-200 rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-50 text-emerald-900 font-bold border-b border-emerald-100">
                <th className="p-3">Campaign Title</th>
                <th className="p-3">Shop Target</th>
                <th className="p-3">Sent Count</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {broadcastHistory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="p-3 font-semibold text-gray-900">{item.title}</td>
                  <td className="p-3 text-gray-600 font-medium">{item.shopName}</td>
                  <td className="p-3 text-gray-800 font-bold">{item.sentCount} Recipient(s)</td>
                  <td className="p-3 text-gray-500">{item.date}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> {item.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-500">
                    {item.files && item.files.length > 0 ? (
                      <div className="flex flex-col gap-1 max-w-[150px]">
                        {item.files.map((fileUrl, index) => {
                          const fileName = fileUrl.split('/').pop()?.split('_').slice(1).join('_') || fileUrl.split('/').pop() || `File ${index + 1}`;
                          return (
                            <a
                              key={index}
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sky-600 font-semibold hover:underline truncate hover:text-sky-800 transition-colors"
                              title={fileName}
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" /> {fileName}
                            </a>
                          )
                        })}
                      </div>
                    ) : (
                      'None'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
