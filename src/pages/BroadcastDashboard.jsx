import React, { useEffect } from 'react'
import { useChatStore } from '../store/useChatStore'
import Header from '../components/broadcast/Header'
import ShopEmployeePanel from '../components/broadcast/ShopEmployeePanel'
import MessageComposerPanel from '../components/broadcast/MessageComposerPanel'
import LivePreviewAnalyticsPanel from '../components/broadcast/LivePreviewAnalyticsPanel'
import WhatsAppControlPanel from '../components/broadcast/WhatsAppControlPanel'
import TemplatesModal from '../components/broadcast/TemplatesModal'
import ScheduleModal from '../components/broadcast/ScheduleModal'
import HistoryModal from '../components/broadcast/HistoryModal'
import CreateTemplateModal from '../components/broadcast/CreateTemplateModal'
import NewContactModal from '../components/broadcast/NewContactModal'

export default function BroadcastDashboard() {
  const {
    loadShopsAndEmployees,
    fetchTemplates,
    fetchBroadcastHistory,
    fetchMessageStats,
    activeDashboardTab,
  } = useChatStore()

  useEffect(() => {
    loadShopsAndEmployees()
    fetchTemplates()
    fetchBroadcastHistory()
    fetchMessageStats()
    useChatStore.getState().fetchWhatsAppConversations()
    useChatStore.getState().initGlobalWhatsAppRealtime()
  }, [loadShopsAndEmployees, fetchTemplates, fetchBroadcastHistory, fetchMessageStats])

  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col bg-[#f3f6fb] overflow-y-auto lg:overflow-hidden select-none">
      {/* Top Navigation Header with View Toggle */}
      <Header />

      {/* Main Content Area */}
      <main className="flex-1 p-3 sm:p-5 overflow-y-auto lg:overflow-hidden flex flex-col">
        {activeDashboardTab === 'broadcast' ? (
          <div className="w-full h-full grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr_340px] gap-4 sm:gap-5 overflow-y-auto lg:overflow-hidden">
            {/* Left Column: Target Shops & Employees Selector */}
            <ShopEmployeePanel />

            {/* Center Column: Message Composer & Attachments */}
            <MessageComposerPanel />

            {/* Right Column: Live WhatsApp Smartphone Preview & Campaign Analytics */}
            <div className="hidden xl:block h-full overflow-hidden">
              <LivePreviewAnalyticsPanel />
            </div>
          </div>
        ) : (
          <div className="w-full h-full overflow-hidden flex flex-col">
            <WhatsAppControlPanel />
          </div>
        )}
      </main>

      {/* Modals & Dialogs */}
      <TemplatesModal />
      <ScheduleModal />
      <HistoryModal />
      <CreateTemplateModal />
      <NewContactModal />
    </div>
  )
}
