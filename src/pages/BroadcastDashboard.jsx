import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore'
import Header from '../components/broadcast/Header'
import ShopEmployeePanel from '../components/broadcast/ShopEmployeePanel'
import MessageComposerPanel from '../components/broadcast/MessageComposerPanel'
import LivePreviewAnalyticsPanel from '../components/broadcast/LivePreviewAnalyticsPanel'
import TemplatesModal from '../components/broadcast/TemplatesModal'
import ScheduleModal from '../components/broadcast/ScheduleModal'
import HistoryModal from '../components/broadcast/HistoryModal'
import CreateTemplateModal from '../components/broadcast/CreateTemplateModal'

export default function BroadcastDashboard() {
  const { loadShopsAndEmployees, fetchTemplates, fetchBroadcastHistory, fetchMessageStats } = useChatStore()

  useEffect(() => {
    loadShopsAndEmployees()
    fetchTemplates()
    fetchBroadcastHistory()
    fetchMessageStats()
  }, [loadShopsAndEmployees, fetchTemplates, fetchBroadcastHistory, fetchMessageStats])
  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-[#f3f6fb] overflow-y-auto lg:overflow-hidden select-none">
      {/* Top Navigation Header */}
      <Header />

      {/* Main 3-Column Landscape Dashboard Layout */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr_340px] gap-4 sm:gap-5 p-3 sm:p-5 overflow-y-auto lg:overflow-hidden">
        {/* Left Column: Target Shops & Employees Selector */}
        <ShopEmployeePanel />

        {/* Center Column: Message Composer & Attachments */}
        <MessageComposerPanel />

        {/* Right Column: Live WhatsApp Smartphone Preview & Campaign Analytics */}
        <div className="hidden xl:block h-full overflow-hidden">
          <LivePreviewAnalyticsPanel />
        </div>
      </main>

      {/* Modals & Dialogs */}
      <TemplatesModal />
      <ScheduleModal />
      <HistoryModal />
      <CreateTemplateModal />
    </div>
  )
}
