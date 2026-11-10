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
                        {/* Date Range: separate Start / End date */}
                        {isAdmin && (
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start Date</span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        max={endDate || getTodayDate()}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            setStartDate(v)
                                            if (v && endDate && v <= endDate && onDateRangeChange) onDateRangeChange(v, endDate)
                                        }}
                                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs sm:text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                                <label className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">End Date</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        min={startDate}
                                        max={getTodayDate()}
                                        onChange={(e) => {
                                            const v = e.target.value
                                            setEndDate(v)
                                            if (v && startDate && startDate <= v && onDateRangeChange) onDateRangeChange(startDate, v)
                                        }}
                                        className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs sm:text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                                {(startDate || endDate) && (
                                    <button
                                        type="button"
                                        onClick={clearDateRange}
                                        className="h-9 w-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-500 hover:bg-slate-50"
                                        title="Clear date range"
                                    >
                                        <X size={14} />
                                    </button>
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
