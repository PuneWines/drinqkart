"use client"
import React from 'react'
import { ClipboardCheck, Hammer, Wrench, Activity, Users } from 'lucide-react'

const allTabs = [
    { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
    { id: 'work', label: 'Work', icon: Activity },
    { id: 'maintenance', label: 'Maintenance', icon: Hammer },
    { id: 'repair', label: 'Repair', icon: Wrench },
    { id: 'ea', label: 'EA', icon: Users },
]

export default function TaskManagementTabs({ activeTab, setActiveTab }) {
    const tabs = allTabs;

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-xl p-1.5 border border-slate-200/80 shadow-2xs font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center justify-start">
                {/* Navigation Tabs */}
                <div className="w-full lg:w-auto overflow-hidden">
                    <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 shadow-2xs overflow-x-auto no-scrollbar max-w-full items-center gap-1.5">
                        {tabs.map((tab) => {
                            const normalizedActive = (activeTab || '').toLowerCase();
                            const normalizedId = tab.id.toLowerCase();
                            const isActive = normalizedActive === normalizedId || (normalizedActive === 'default' && normalizedId === 'checklist');
                            const Icon = tab.icon;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        h-9 px-4.5 !rounded-lg text-[13px] font-bold font-sans transition-all cursor-pointer whitespace-nowrap flex items-center justify-center gap-2
                                        ${isActive
                                            ? 'bg-white text-indigo-700 shadow-2xs border border-slate-200/60'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent'
                                        }
                                    `}
                                >
                                    <Icon
                                        size={16}
                                        className={isActive ? 'text-indigo-600' : 'text-slate-400'}
                                    />
                                    <span>{tab.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
