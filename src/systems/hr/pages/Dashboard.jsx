import { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX, Briefcase, Calendar, TrendingUp, Award, PieChart, Filter, Search, AlertCircle, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
    // Employee stats
    const [totalEmployee, setTotalEmployee] = useState(0)
    const [activeEmployee, setActiveEmployee] = useState(0)
    const [leftEmployee, setLeftEmployee] = useState(0)
    const [inactiveEmployee, setInactiveEmployee] = useState(0)
    const [leaveThisMonth, setLeaveThisMonth] = useState(0)

    // Attendance stats for today
    const [todayAttendance, setTodayAttendance] = useState({
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        totalPresent: 0,
        totalAbsent: 0
    })

    const [loading, setLoading] = useState(true)
    const [recentEmployees, setRecentEmployees] = useState([])
    const [statusDistribution, setStatusDistribution] = useState([])
    const [todayDate, setTodayDate] = useState('')

    // States for unified detailed employees modal and lists
    const [presentEmployeesList, setPresentEmployeesList] = useState([])
    const [absentEmployeesList, setAbsentEmployeesList] = useState([])
    const [lateEmployeesList, setLateEmployeesList] = useState([])
    const [halfDayEmployeesList, setHalfDayEmployeesList] = useState([])
    const [detailModal, setDetailModal] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        employees: [],
        type: 'Present'
    })

    // Fetch employees and calculate stats
    useEffect(() => {
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        setTodayDate(`${yyyy}-${mm}-${dd}`)

        fetchEmployees()
        fetchTodayAttendance()
    }, [])

    const fetchEmployees = async () => {
        try {
            setLoading(true)

            // Fetch directly from hr_management_employees table
            const { data: hrData, error } = await supabase
                .from('hr_management_employees')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            const mappedList = hrData || []

            // Calculate statistics
            const total = mappedList.length
            const active = mappedList.filter(emp => (emp.status || '').toLowerCase() === 'active').length
            const inactive = mappedList.filter(emp => (emp.status || '').toLowerCase() === 'inactive').length
            const left = mappedList.filter(emp => (emp.status || '').toLowerCase() === 'left').length

            // Calculate left this month
            const currentDate = new Date()
            const currentMonth = currentDate.getMonth()
            const currentYear = currentDate.getFullYear()

            const leftThisMonth = mappedList.filter(emp => {
                if ((emp.status || '').toLowerCase() !== 'left') return false
                const leftDate = new Date(emp.updated_at || emp.created_at)
                return leftDate.getMonth() === currentMonth && leftDate.getFullYear() === currentYear
            }).length

            setTotalEmployee(total)
            setActiveEmployee(active)
            setInactiveEmployee(inactive)
            setLeftEmployee(left)
            setLeaveThisMonth(leftThisMonth)

            // Get recent employees (last 5)
            const recent = mappedList.slice(0, 5)
            setRecentEmployees(recent)

            // Calculate status distribution for pie chart
            const statusData = [
                {
                    name: 'Active',
                    count: active,
                    percentage: total ? Math.round((active / total) * 100) : 0,
                    color: '#10b981',
                    bgColor: 'bg-green-100',
                    badgeColor: 'bg-green-100 text-green-700',
                    textColor: 'text-green-600'
                },
                {
                    name: 'Inactive',
                    count: inactive,
                    percentage: total ? Math.round((inactive / total) * 100) : 0,
                    color: '#f59e0b',
                    bgColor: 'bg-amber-100',
                    badgeColor: 'bg-amber-100 text-amber-700',
                    textColor: 'text-amber-600'
                },
                {
                    name: 'Left',
                    count: left,
                    percentage: total ? Math.round((left / total) * 100) : 0,
                    color: '#ef4444',
                    bgColor: 'bg-red-100',
                    badgeColor: 'bg-red-100 text-red-700',
                    textColor: 'text-red-600'
                }
            ]
            setStatusDistribution(statusData)

        } catch (error) {
            console.error('Error fetching employees:', error)
        } finally {
            setLoading(false)
        }
    }

    // Fetch today's attendance statistics from hr_management_attendance_logs and categorize employees
    const fetchTodayAttendance = async () => {
        try {
            const today = new Date()
            const yyyy = today.getFullYear()
            const mm = String(today.getMonth() + 1).padStart(2, '0')
            const dd = String(today.getDate()).padStart(2, '0')
            const todayStr = `${yyyy}-${mm}-${dd}`

            // 1. Fetch active employees list from hr_management_employees table
            const activeEmployeesMap = new Map()

            const { data: hrData } = await supabase
                .from('hr_management_employees')
                .select('employee_id, name_as_per_aadhar, designation, joining_place, status')

            if (hrData) {
                hrData.forEach(emp => {
                    const statusLower = (emp.status || '').toLowerCase()
                    if (emp.employee_id && (statusLower === 'active' || statusLower === '')) {
                        const cleanId = emp.employee_id.toString().trim()
                        if (!activeEmployeesMap.has(cleanId)) {
                            activeEmployeesMap.set(cleanId, {
                                employee_id: cleanId,
                                name_as_per_aadhar: emp.name_as_per_aadhar || 'Employee',
                                designation: emp.designation || '',
                                joining_place: emp.joining_place || ''
                            })
                        }
                    }
                })
            }

            // 2. Fetch today's attendance logs from hr_management_attendance_logs
            const { data: attendanceLogs, error: attError } = await supabase
                .from('hr_management_attendance_logs')
                .select('*')
                .eq('attendance_date', todayStr)

            if (attError) throw attError

            const logsMap = new Map()
            attendanceLogs?.forEach(log => {
                if (log.employee_id) {
                    logsMap.set(log.employee_id.toString().trim(), log)
                }
            })

            const presentList = []
            const lateList = []
            const absentList = []
            const halfDayList = []
            const processedEmpIds = new Set()

            // Process all active employees
            activeEmployeesMap.forEach((emp, empId) => {
                processedEmpIds.add(empId)
                const log = logsMap.get(empId)
                if (log) {
                    const status = log.status || (log.half_day ? 'Half Day' : log.is_late ? 'Late' : 'Present')
                    const empWithLog = {
                        ...emp,
                        name_as_per_aadhar: log.employee_name || emp.name_as_per_aadhar,
                        designation: log.designation || emp.designation,
                        joining_place: log.store_name || emp.joining_place,
                        in_time: log.in_time,
                        out_time: log.out_time,
                        late_minute: log.late_minute || 0,
                        status
                    }

                    if (status === 'Late' || log.is_late) {
                        lateList.push(empWithLog)
                    } else if (status === 'Half Day' || log.half_day) {
                        halfDayList.push(empWithLog)
                    } else if (status === 'Absent') {
                        absentList.push(empWithLog)
                    } else {
                        presentList.push(empWithLog)
                    }
                } else {
                    const empAbsent = {
                        ...emp,
                        status: 'Absent',
                        in_time: null,
                        out_time: null,
                        late_minute: null
                    }
                    absentList.push(empAbsent)
                }
            })

            // Process any additional logs from hr_management_attendance_logs not in active employees list
            attendanceLogs?.forEach(log => {
                const logEmpId = log.employee_id ? log.employee_id.toString().trim() : null
                if (logEmpId && !processedEmpIds.has(logEmpId)) {
                    processedEmpIds.add(logEmpId)
                    const status = log.status || (log.half_day ? 'Half Day' : log.is_late ? 'Late' : 'Present')
                    const empFromLog = {
                        employee_id: logEmpId,
                        name_as_per_aadhar: log.employee_name || `Employee ${logEmpId}`,
                        designation: log.designation || '',
                        joining_place: log.store_name || '',
                        in_time: log.in_time,
                        out_time: log.out_time,
                        late_minute: log.late_minute || 0,
                        status
                    }

                    if (status === 'Late' || log.is_late) {
                        lateList.push(empFromLog)
                    } else if (status === 'Half Day' || log.half_day) {
                        halfDayList.push(empFromLog)
                    } else if (status === 'Absent') {
                        absentList.push(empFromLog)
                    } else {
                        presentList.push(empFromLog)
                    }
                }
            })

            setPresentEmployeesList(presentList)
            setLateEmployeesList(lateList)
            setAbsentEmployeesList(absentList)
            setHalfDayEmployeesList(halfDayList)

            setTodayAttendance({
                present: presentList.length + lateList.length,
                late: lateList.length,
                absent: absentList.length,
                halfDay: halfDayList.length,
                totalPresent: presentList.length + lateList.length,
                totalAbsent: absentList.length
            })

        } catch (error) {
            console.error('Error fetching today\'s attendance:', error)
        }
    }

    const handleCardClick = (type) => {
        let title = ''
        let subtitle = ''
        let employeesList = []

        switch (type) {
            case 'Present':
                title = 'Present Employees'
                subtitle = `Employees who marked attendance for ${todayDate}`
                employeesList = [...presentEmployeesList, ...lateEmployeesList]
                break
            case 'Late':
                title = 'Late Arrivals'
                subtitle = `Employees who clocked in after 10:10 AM IST for ${todayDate}`
                employeesList = lateEmployeesList
                break
            case 'Absent':
                title = 'Absent Employees'
                subtitle = `Active employees who have no attendance record or are marked absent for ${todayDate}`
                employeesList = absentEmployeesList
                break
            case 'Half Day':
                title = 'Half Day Employees'
                subtitle = `Employees marked on half day for ${todayDate}`
                employeesList = halfDayEmployeesList
                break
            default:
                return
        }

        setDetailModal({
            isOpen: true,
            title,
            subtitle,
            employees: employeesList,
            type
        })
    }

    // Refresh attendance data (can be called after sync)
    const refreshAttendance = async () => {
        await fetchTodayAttendance()
        await fetchEmployees()
    }

    const formatTimeIST = (timeStr) => {
        if (!timeStr) return '-'
        try {
            let formatted = timeStr.trim();
            if (formatted.includes('T')) {
                const date = new Date(formatted);
                if (!isNaN(date.getTime())) {
                    return new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Kolkata',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }).format(date);
                }
            } else if (formatted.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                const [hStr, mStr] = formatted.split(':');
                const h = parseInt(hStr, 10);
                const ampm = h >= 12 ? 'PM' : 'AM';
                const displayH = h % 12 === 0 ? 12 : h % 12;
                return `${displayH}:${mStr} ${ampm}`;
            }
            return timeStr;
        } catch (e) {
            return timeStr;
        }
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffTime = Math.abs(now - date)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        if (diffDays < 7) return `${diffDays} days ago`
        if (diffDays < 30) return `${Math.floor(diffDays / 7)} week ago`
        return `${Math.floor(diffDays / 30)} months ago`
    }

    // Calculate pie chart segments
    const getPieChartGradient = () => {
        const activePercent = statusDistribution[0]?.percentage || 0
        const inactivePercent = statusDistribution[1]?.percentage || 0
        const leftPercent = statusDistribution[2]?.percentage || 0

        if (activePercent === 0 && inactivePercent === 0 && leftPercent === 0) {
            return 'conic-gradient(#e5e7eb 0deg 360deg)'
        }

        let currentAngle = 0
        const segments = []

        if (activePercent > 0) {
            const activeDeg = (activePercent / 100) * 360
            segments.push(`#10b981 ${currentAngle}deg ${currentAngle + activeDeg}deg`)
            currentAngle += activeDeg
        }

        if (inactivePercent > 0) {
            const inactiveDeg = (inactivePercent / 100) * 360
            segments.push(`#f59e0b ${currentAngle}deg ${currentAngle + inactiveDeg}deg`)
            currentAngle += inactiveDeg
        }

        if (leftPercent > 0) {
            const leftDeg = (leftPercent / 100) * 360
            segments.push(`#ef4444 ${currentAngle}deg ${currentAngle + leftDeg}deg`)
            currentAngle += leftDeg
        }

        return `conic-gradient(${segments.join(', ')})`
    }

    // Attendance rate calculation
    const attendanceRate = activeEmployee > 0
        ? Math.round(((todayAttendance.present) / activeEmployee) * 100)
        : 0;

    // Current time display
    const [currentTime, setCurrentTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const timeString = currentTime.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
    });

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    })();

    // SVG Donut chart helper
    const DonutChart = ({ data, size = 180 }) => {
        const cx = size / 2, cy = size / 2, r = (size / 2) - 16;
        const circumference = 2 * Math.PI * r;
        let cumulativePercent = 0;
        const total = data.reduce((s, d) => s + d.count, 0);

        return (
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
                {/* Background circle */}
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="20" />
                {data.map((segment, i) => {
                    const pct = total > 0 ? segment.count / total : 0;
                    const dashLen = circumference * pct;
                    const dashGap = circumference - dashLen;
                    const offset = circumference * (1 - cumulativePercent) + circumference * 0.25;
                    cumulativePercent += pct;
                    return (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="20"
                            strokeDasharray={`${dashLen} ${dashGap}`}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="transition-all duration-700 ease-out"
                            style={{ transformOrigin: `${cx}px ${cy}px` }}
                        />
                    );
                })}
                {/* Center text */}
                <text x={cx} y={cy - 8} textAnchor="middle" className="fill-slate-900 text-2xl font-bold" style={{ fontSize: '28px', fontWeight: 700 }}>
                    {total}
                </text>
                <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '12px' }}>
                    Total
                </text>
            </svg>
        );
    };

    return (
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
            {/* Premium Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <p className="text-sm font-medium text-indigo-600 mb-1">{greeting} 👋</p>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                        HR Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Real-time workforce overview &bull; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-sm font-semibold text-slate-700">{timeString} IST</span>
                    </div>
                    <button
                        onClick={refreshAttendance}
                        className="group flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 active:scale-95"
                    >
                        <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">Loading dashboard data...</p>
                </div>
            ) : (
                <>
                    {/* ── Today's Attendance Stat Cards ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {/* Present */}
                        <div
                            onClick={() => handleCardClick('Present')}
                            className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer hover:shadow-lg hover:shadow-green-100/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-green-400 to-emerald-500 rounded-l-2xl" />
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Present</p>
                                    <p className="text-3xl font-extrabold text-slate-900">{todayAttendance.present}</p>
                                    <p className="text-xs text-slate-400 font-medium">{presentEmployeesList.length} on-time, {lateEmployeesList.length} late</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md shadow-green-200 group-hover:scale-110 transition-transform">
                                    <UserCheck size={20} className="text-white" />
                                </div>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${attendanceRate}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-green-600">{attendanceRate}%</span>
                            </div>
                        </div>

                        {/* Late */}
                        <div
                            onClick={() => handleCardClick('Late')}
                            className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer hover:shadow-lg hover:shadow-amber-100/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500 rounded-l-2xl" />
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Late Arrivals</p>
                                    <p className="text-3xl font-extrabold text-slate-900">{todayAttendance.late}</p>
                                    <p className="text-xs text-slate-400 font-medium">After 10:10 AM</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-200 group-hover:scale-110 transition-transform">
                                    <Clock size={20} className="text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Absent */}
                        <div
                            onClick={() => handleCardClick('Absent')}
                            className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer hover:shadow-lg hover:shadow-red-100/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-400 to-red-500 rounded-l-2xl" />
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Absent</p>
                                    <p className="text-3xl font-extrabold text-slate-900">{todayAttendance.absent}</p>
                                    <p className="text-xs text-slate-400 font-medium">No log today</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-md shadow-red-200 group-hover:scale-110 transition-transform">
                                    <UserX size={20} className="text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Half Day */}
                        <div
                            onClick={() => handleCardClick('Half Day')}
                            className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer hover:shadow-lg hover:shadow-yellow-100/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-l-2xl" />
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Half Day</p>
                                    <p className="text-3xl font-extrabold text-slate-900">{todayAttendance.halfDay}</p>
                                    <p className="text-xs text-slate-400 font-medium">Half day marked</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-200 group-hover:scale-110 transition-transform">
                                    <AlertCircle size={20} className="text-white" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Charts & Activity Section ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Employee Status Distribution */}
                        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Employee Status</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Distribution across workforce</p>
                                </div>
                                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <PieChart size={18} className="text-indigo-500" />
                                </div>
                            </div>

                            {totalEmployee > 0 ? (
                                <div className="flex flex-col lg:flex-row items-center gap-8">
                                    {/* SVG Donut */}
                                    <div className="relative">
                                        <DonutChart data={statusDistribution} size={180} />
                                    </div>

                                    {/* Legend */}
                                    <div className="flex-1 space-y-2 w-full">
                                        {statusDistribution.map((status) => (
                                            <div key={status.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                                                    <span className="text-sm font-medium text-slate-700">{status.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-slate-900">{status.count}</span>
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${status.badgeColor}`}>
                                                        {status.percentage}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Users size={36} className="text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-400 font-medium">No employee data available</p>
                                </div>
                            )}

                            {/* Quick Stats Row */}
                            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Active Rate', value: `${totalEmployee ? Math.round((activeEmployee / totalEmployee) * 100) : 0}%`, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                    { label: 'Inactive Rate', value: `${totalEmployee ? Math.round((inactiveEmployee / totalEmployee) * 100) : 0}%`, color: 'text-amber-600', bg: 'bg-amber-50' },
                                    { label: 'Retention', value: `${totalEmployee ? Math.round(((totalEmployee - leftEmployee) / totalEmployee) * 100) : 0}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
                                ].map((stat) => (
                                    <div key={stat.label} className={`text-center p-3 rounded-xl ${stat.bg}`}>
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                                        <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activities */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Recent Joinings</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Latest additions</p>
                                </div>
                                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                                    <Calendar size={18} className="text-violet-500" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                {recentEmployees.length > 0 ? (
                                    recentEmployees.map((emp, i) => (
                                        <div key={emp.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                                {emp.name_as_per_aadhar?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-slate-800 truncate">{emp.name_as_per_aadhar}</p>
                                                <p className="text-[11px] text-slate-400">{emp.designation || 'Employee'}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' :
                                                    emp.status === 'Inactive' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                    {emp.status}
                                                </span>
                                                <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(emp.date_of_joining)}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10">
                                        <Users size={28} className="text-slate-300 mx-auto mb-2" />
                                        <p className="text-slate-400 text-sm">No recent joinings</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Bottom Highlight Cards ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="relative bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-700 rounded-2xl shadow-xl shadow-indigo-200/50 p-6 text-white overflow-hidden">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-lg" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <TrendingUp size={22} />
                                    </div>
                                    <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">This Year</span>
                                </div>
                                <p className="text-4xl font-extrabold">{totalEmployee}</p>
                                <p className="text-sm opacity-80 mt-1 font-medium">Total Employees</p>
                                <div className="mt-4 pt-3 border-t border-white/20">
                                    <p className="text-xs opacity-70 font-medium">+{activeEmployee} currently active</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 rounded-2xl shadow-xl shadow-emerald-200/50 p-6 text-white overflow-hidden">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-lg" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <Award size={22} />
                                    </div>
                                    <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">Current</span>
                                </div>
                                <p className="text-4xl font-extrabold">{activeEmployee}</p>
                                <p className="text-sm opacity-80 mt-1 font-medium">Active Employees</p>
                                <div className="mt-4 pt-3 border-t border-white/20">
                                    <p className="text-xs opacity-70 font-medium">{totalEmployee ? Math.round((activeEmployee / totalEmployee) * 100) : 0}% of workforce</p>
                                </div>
                            </div>
                        </div>

                        <div className="relative bg-gradient-to-br from-rose-500 via-red-500 to-red-700 rounded-2xl shadow-xl shadow-red-200/50 p-6 text-white overflow-hidden">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                            <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white/5 rounded-full blur-lg" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                        <UserX size={22} />
                                    </div>
                                    <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">Today</span>
                                </div>
                                <p className="text-4xl font-extrabold">{todayAttendance.absent}</p>
                                <p className="text-sm opacity-80 mt-1 font-medium">Absent Today</p>
                                <div className="mt-4 pt-3 border-t border-white/20">
                                    <p className="text-xs opacity-70 font-medium">
                                        {(() => {
                                            const totalActive = activeEmployee || 1;
                                            return `${Math.round((todayAttendance.absent / totalActive) * 100)}% of active employees`
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── Detail Modal ── */}
            {detailModal.isOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailModal({ ...detailModal, isOpen: false })}>
                    <div className="bg-white max-w-4xl w-full max-h-[85vh] shadow-2xl rounded-2xl overflow-hidden border border-slate-100 flex flex-col" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    {(() => {
                                        const iconMap = {
                                            'Present': <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><UserCheck size={18} className="text-green-600" /></div>,
                                            'Late': <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><Clock size={18} className="text-orange-600" /></div>,
                                            'Absent': <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><UserX size={18} className="text-red-600" /></div>,
                                            'Half Day': <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center"><AlertCircle size={18} className="text-yellow-600" /></div>,
                                        };
                                        return iconMap[detailModal.type] || iconMap['Present'];
                                    })()}
                                    <div>
                                        {detailModal.title}
                                        <span className="text-sm font-normal text-slate-400 ml-2">
                                            ({detailModal.employees.length})
                                        </span>
                                    </div>
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 ml-10">
                                    {detailModal.subtitle}
                                </p>
                            </div>
                            <button
                                onClick={() => setDetailModal({ ...detailModal, isOpen: false })}
                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 flex-1 overflow-y-auto min-h-0">
                            {detailModal.employees.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Users size={28} className="text-slate-400" />
                                    </div>
                                    <p className="text-lg font-semibold text-slate-700">No employees to show</p>
                                    <p className="text-sm text-slate-400 mt-1">No records matching this category today.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-100">
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">#</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Employee ID</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Name</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Designation</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Store</th>
                                                <th className="text-left px-4 py-3 font-semibold text-slate-500 text-[11px] uppercase tracking-wider">Details</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {detailModal.employees.map((emp, index) => (
                                                <tr
                                                    key={emp.employee_id}
                                                    className={(() => {
                                                        switch (detailModal.type) {
                                                            case 'Present': return 'hover:bg-green-50/50 transition-colors';
                                                            case 'Late': return 'hover:bg-orange-50/50 transition-colors';
                                                            case 'Absent': return 'hover:bg-red-50/50 transition-colors';
                                                            case 'Half Day': return 'hover:bg-yellow-50/50 transition-colors';
                                                            default: return 'hover:bg-slate-50 transition-colors';
                                                        }
                                                    })()}
                                                >
                                                    <td className="px-4 py-3 text-slate-400 text-xs">{index + 1}</td>
                                                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{emp.employee_id}</td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{emp.name_as_per_aadhar}</td>
                                                    <td className="px-4 py-3 text-slate-500">{emp.designation || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-500">{emp.joining_place || '-'}</td>
                                                    <td className="px-4 py-3">
                                                        {(() => {
                                                            const currentStatus = emp.status || detailModal.type;
                                                            if (currentStatus === 'Late') {
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                                                                            <Clock size={12} />
                                                                            Late ({emp.late_minute || 0}m)
                                                                        </span>
                                                                        {emp.in_time && (
                                                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                                In: {formatTimeIST(emp.in_time)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            } else if (currentStatus === 'Present') {
                                                                return (
                                                                    <div className="flex flex-col">
                                                                        <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                                                                            <UserCheck size={12} /> Present
                                                                        </span>
                                                                        {emp.in_time && (
                                                                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                                                In: {formatTimeIST(emp.in_time)}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            } else if (currentStatus === 'Half Day') {
                                                                return (
                                                                    <span className="text-xs text-yellow-600 font-semibold flex items-center gap-1">
                                                                        <AlertCircle size={12} /> Half Day
                                                                    </span>
                                                                );
                                                            } else {
                                                                return (
                                                                    <span className="text-xs text-red-500 font-semibold flex items-center gap-1">
                                                                        <UserX size={12} /> Absent
                                                                    </span>
                                                                );
                                                            }
                                                        })()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-between items-center px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                            <p className="text-xs text-slate-400 font-medium">
                                Active employees: <span className="font-bold text-slate-600">{activeEmployee}</span>
                            </p>
                            <button
                                onClick={() => setDetailModal({ ...detailModal, isOpen: false })}
                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}