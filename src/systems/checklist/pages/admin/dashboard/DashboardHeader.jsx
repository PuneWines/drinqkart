"use client"

import { useState, useEffect } from "react"
import { getTotalUsersCountApi } from "../../../redux/api/dashboardApi"
import { ClipboardCheck, Users, Calendar, ChevronDown, X } from "lucide-react"

export default function DashboardHeader({
    dashboardType,
    setDashboardType,
    dashboardStaffFilter,
    setDashboardStaffFilter,
    availableStaff = [],
    userRole,
    username,
    shopFilter,
    setShopFilter,
    availableShops = [],
    isLoadingMore,
    onDateRangeChange,
    mainTab,
    dateRange
}) {
    const [totalUsersCount, setTotalUsersCount] = useState(0)
    const [showDateRangePicker, setShowDateRangePicker] = useState(false)
    const [startDate, setStartDate] = useState(dateRange?.startDate || "")
    const [endDate, setEndDate] = useState(dateRange?.endDate || "")

    useEffect(() => {
        if (dateRange?.startDate && dateRange?.endDate) {
            setStartDate(dateRange.startDate);
            setEndDate(dateRange.endDate);
        } else {
            setStartDate("");
            setEndDate("");
        }
    }, [dateRange]);

    const normalizedRole = (userRole || "").toLowerCase();
    const isSuperAdmin = normalizedRole === "superadmin" || normalizedRole === "super_admin" || normalizedRole === "masteradmin";
    const isHOD = normalizedRole === "hod";
    const isAdmin = normalizedRole === "admin" || normalizedRole === "manager" || isHOD || isSuperAdmin;

    // Fetch total users count
    useEffect(() => {
        const fetchTotalUsers = async () => {
            try {
                const count = await getTotalUsersCountApi(shopFilter)
                setTotalUsersCount(count)
            } catch (error) {
                console.error('Error fetching total users count:', error)
            }
        }

        fetchTotalUsers()
    }, [shopFilter])

    // Apply date range filter
    const applyDateRange = () => {
        if (startDate && endDate && onDateRangeChange) {
            onDateRangeChange(startDate, endDate)
            setShowDateRangePicker(false)
        }
    }

    // Clear date range filter
    const clearDateRange = () => {
        setStartDate("")
        setEndDate("")
        if (onDateRangeChange) {
            onDateRangeChange(null, null)
        }
        setShowDateRangePicker(false)
    }

    // Get today's date in YYYY-MM-DD format for max date
    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0]
    }

    return (
        <div className="flex flex-col gap-3.5 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                {/* Left: Title & Users Badge */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                        <ClipboardCheck size={20} className="stroke-[2.5]" />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-sans">
                            Dashboard
                        </h1>
                        {isAdmin && (mainTab === "default" || mainTab === "work") && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs sm:text-[13px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-sans shadow-2xs">
                                <Users size={14} className="text-indigo-600" />
                                <span className="text-slate-500">{shopFilter !== "all" ? `Users in ${shopFilter}:` : "Total Users:"}</span>
                                <span className="font-mono font-bold text-indigo-700 text-sm">{totalUsersCount}</span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Filters Toolbar (Desktop) */}
                {(mainTab === "default" || mainTab === "work") && (
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Date Range Picker */}
                        {isAdmin && (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowDateRangePicker(!showDateRangePicker)}
                                    className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-[13px] font-medium border border-slate-200 !rounded-lg shadow-2xs transition-all cursor-pointer flex items-center gap-2 font-sans"
                                >
                                    <Calendar size={14} className="text-slate-400" />
                                    <span>
                                        {startDate && endDate ? `${startDate} to ${endDate}` : "Date Range"}
                                    </span>
                                    {startDate && endDate && (
                                        <span
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearDateRange();
                                            }}
                                            className="hover:text-red-500 p-0.5 ml-0.5"
                                            title="Clear date range"
                                        >
                                            <X size={13} />
                                        </span>
                                    )}
                                    <ChevronDown size={14} className="text-slate-400 ml-0.5" />
                                </button>

                                {showDateRangePicker && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowDateRangePicker(false)}
                                        />
                                        <div className="absolute top-full right-0 sm:left-0 sm:right-auto mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-4 w-76 sm:w-84 font-sans">
                                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                                                <h3 className="text-xs sm:text-[13px] font-bold text-slate-800 uppercase tracking-wider">
                                                    Select Date Range
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDateRangePicker(false)}
                                                    className="text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    <X size={15} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 my-3">
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                                        From Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => setStartDate(e.target.value)}
                                                        max={endDate || getTodayDate()}
                                                        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs sm:text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
                                                        To Date
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => setEndDate(e.target.value)}
                                                        min={startDate}
                                                        max={getTodayDate()}
                                                        className="h-9 w-full rounded-lg border border-slate-200 px-2.5 text-xs sm:text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                                                <button
                                                    type="button"
                                                    onClick={clearDateRange}
                                                    className="h-9 flex-1 py-1.5 px-3 !rounded-lg text-xs sm:text-[13px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={applyDateRange}
                                                    disabled={!startDate || !endDate}
                                                    className="h-9 flex-1 py-1.5 px-3 !rounded-lg text-xs sm:text-[13px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    Apply Filter
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* View Type Toggle (Checklist / Delegation) */}
                        {mainTab === "default" && (
                            <div className="relative">
                                <select
                                    value={dashboardType}
                                    onChange={(e) => setDashboardType(e.target.value)}
                                    className="h-9 pl-3.5 pr-8 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-[13px] font-medium border border-slate-200 !rounded-lg shadow-2xs appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                                >
                                    <option value="checklist">Checklist</option>
                                    <option value="delegation">Delegation</option>
                                </select>
                                <ChevronDown size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        )}

                        {/* Shop Filter */}
                        {(dashboardType === "checklist" || dashboardType === "delegation" || dashboardType === "work") && isAdmin && (
                            <div className="relative">
                                <select
                                    value={shopFilter}
                                    onChange={(e) => setShopFilter(e.target.value)}
                                    className="h-9 pl-3.5 pr-8 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-[13px] font-medium border border-slate-200 !rounded-lg shadow-2xs appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans max-w-[180px]"
                                >
                                    <option value="all">All Shops</option>
                                    {availableShops.map((shop) => (
                                        <option key={shop} value={shop}>
                                            {shop}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        )}

                        {/* Staff Filter */}
                        <div className="relative">
                            {isAdmin || isHOD ? (
                                <>
                                    <select
                                        value={dashboardStaffFilter}
                                        onChange={(e) => setDashboardStaffFilter(e.target.value)}
                                        className="h-9 pl-3.5 pr-8 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-[13px] font-medium border border-slate-200 !rounded-lg shadow-2xs appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans max-w-[200px]"
                                    >
                                        <option value="all">All Staff Members</option>
                                        {availableStaff.map((staffName) => (
                                            <option key={staffName} value={staffName}>
                                                {staffName}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </>
                            ) : (
                                <select
                                    value={username || ""}
                                    disabled={true}
                                    className="h-9 pl-3.5 pr-7 bg-slate-50 text-slate-500 text-xs sm:text-[13px] font-medium border border-slate-200 !rounded-lg cursor-not-allowed appearance-none font-sans"
                                >
                                    <option value={username || ""}>{username || "Current User"}</option>
                                </select>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
