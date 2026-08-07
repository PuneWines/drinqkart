import React, { useState } from 'react'
import { useChatStore } from '../../store/useChatStore'
import { X, Calendar, Clock } from 'lucide-react'

export default function ScheduleModal() {
  const { scheduleModalOpen, closeScheduleModal, setScheduledCampaign } = useChatStore()
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')

  if (!scheduleModalOpen) return null

  const handleConfirm = (e) => {
    e.preventDefault()
    if (!scheduleDate || !scheduleTime) return
    setScheduledCampaign({ date: scheduleDate, time: scheduleTime })
    alert(`⏰ Broadcast campaign scheduled for ${scheduleDate} at ${scheduleTime}`)
    closeScheduleModal()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 border border-gray-100">
        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span>⏰</span> Schedule WhatsApp Broadcast
          </h2>
          <button onClick={closeScheduleModal} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Broadcast Date
            </label>
            <input
              type="date"
              required
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#25D366]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" /> Broadcast Time
            </label>
            <input
              type="time"
              required
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#25D366]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeScheduleModal}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-xs hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-xs hover:bg-green-600 transition-colors shadow-md shadow-green-500/20"
            >
              Confirm Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
