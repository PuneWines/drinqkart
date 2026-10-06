import React, { useEffect, useState } from 'react';
import EmployeeOverviewModal from '../components/EmployeeOverviewModal';
import { Search, Download, Filter, RefreshCw, Loader2, Database, Calendar, Users, Clock, TrendingUp, User, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getMonthlyAttendanceFromSupabase, syncMonthlyAttendanceFromApi } from '../services/attendanceSync';
import { supabase } from '../lib/supabase';

const DEVICES = [
    { name: 'MADHURA', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
    { name: 'TLS', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
    { name: 'FRIENDS', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
    { name: 'BALAJI', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
    { name: 'KUNAL ULWE', apiName: 'MUMBAI', serial: 'C2630450C32A2327' },
    { name: 'KUNAL KHARGHAR', apiName: 'KHARGHAR', serial: 'AMDB25120600859' }
];

const ALL_DEVICES_OPTION = { name: 'ALL DEVICES', apiName: 'ALL', serial: 'ALL' };

const formatSecsToHrsMins = (totalSecs) => {
    if (!totalSecs) return '0h 0m';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins}m`;
};

const AttendanceMonthly = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedDevice, setSelectedDevice] = useState(ALL_DEVICES_OPTION);
    const [attendanceData, setAttendanceData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState(null);
    const [lastSynced, setLastSynced] = useState(null);
    const [employeesData, setEmployeesData] = useState([]);
    const [matchFilter, setMatchFilter] = useState('ALL'); // 'ALL', 'MATCHED', 'UNMATCHED'
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'HAS_PRESENT', 'HAS_ABSENT', 'HAS_LATE', 'ALL_ABSENT'
    const [currentPage, setCurrentPage] = useState(1);

    // Modal State
    const [selectedEmployeeModal, setSelectedEmployeeModal] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedMonth, selectedYear, selectedDevice, matchFilter, statusFilter]);

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

const parseDateTimeHelper = (str, dateStr = '') => {
    if (!str || str === '-') return null;
    if (str.includes('T')) return new Date(str);
    const match = str.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)?/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = match[3] ? parseInt(match[3], 10) : 0;
    const ampm = match[4];
    if (ampm) {
        if (ampm.toUpperCase() === 'PM' && h < 12) h += 12;
        if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
    }
    const dateParts = dateStr ? dateStr.split('-').map(Number) : [];
    const year = dateParts[0] || new Date().getFullYear();
    const month = dateParts[1] ? dateParts[1] - 1 : new Date().getMonth();
    const day = dateParts[2] || new Date().getDate();
    return new Date(year, month, day, h, m, s);
};

const calculateWorkHours = (inTimeStr, outTimeStr, dateStr, lunchStr = '00:00:00') => {
    if (!inTimeStr || !outTimeStr || inTimeStr === '-' || outTimeStr === '-') return '00:00:00';
    try {
        const inDate = parseDateTimeHelper(inTimeStr, dateStr);
        let outDate = parseDateTimeHelper(outTimeStr, dateStr);
        if (!inDate || !outDate) return '00:00:00';
        if (outDate < inDate) outDate = new Date(outDate.getTime() + 24 * 3600 * 1000);

        let diffMs = outDate.getTime() - inDate.getTime();
        if (lunchStr && lunchStr !== '-') {
            const [lh, lm, ls] = lunchStr.split(':').map(Number);
            const lunchMs = ((lh || 0) * 3600 + (lm || 0) * 60 + (ls || 0)) * 1000;
            diffMs = Math.max(0, diffMs - lunchMs);
        }

        const totalSeconds = Math.floor(diffMs / 1000);
        const hrs = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } catch (e) {
        return '00:00:00';
    }
};

    const fetchAttendanceData = async (forceSync = false) => {
        setLoading(true);
        setError(null);

        try {
            if (selectedYear < 2026 || (selectedYear === 2026 && selectedMonth < 4)) {
                setAttendanceData([]);
                setLastSynced(null);
                setLoading(false);
                return;
            }

            const monthStr = String(selectedMonth).padStart(2, '0');
            const startDateStr = `${selectedYear}-${monthStr}-01`;
            const totalDaysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const endDateStr = `${selectedYear}-${monthStr}-${String(totalDaysInMonth).padStart(2, '0')}`;

            // 1. Paginated fetch from hr_management_attendance_logs
            let monthLogs = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                let query = supabase
                    .from('hr_management_attendance_logs')
                    .select('*')
                    .gte('attendance_date', startDateStr)
                    .lte('attendance_date', endDateStr)
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (selectedDevice.serial !== 'ALL') {
                    query = query.eq('serial_number', selectedDevice.serial);
                }

                const { data, error: fetchErr } = await query;
                if (fetchErr) throw fetchErr;

                if (data && data.length > 0) {
                    monthLogs = [...monthLogs, ...data];
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }

            // 2. Fetch shift roster data for the month & holidays from public.holidays
            const [{ data: rosterData }, { data: dbHolidays }] = await Promise.all([
                supabase
                    .from('hr_management_shift_roster')
                    .select('*')
                    .gte('date', startDateStr)
                    .lte('date', endDateStr),
                supabase
                    .from('holidays')
                    .select('*')
                    .gte('holiday_date', startDateStr)
                    .lte('holiday_date', endDateStr)
            ]);

            const holidayMap = {};
            (dbHolidays || []).forEach(h => {
                if (h.holiday_date) {
                    holidayMap[h.holiday_date.trim()] = h.holiday_name || 'Holiday';
                }
            });

            // Determine elapsed days in month (if current month, up to today)
            const now = new Date();
            const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === (now.getMonth() + 1);
            const elapsedDays = isCurrentMonth ? Math.min(now.getDate(), totalDaysInMonth) : totalDaysInMonth;

            // 3. Group attendance logs by employee_id
            const logsByEmpId = new Map();
            monthLogs.forEach(log => {
                const rawId = (log.employee_id || '').toString().trim();
                const cleanId = rawId.toLowerCase().replace(/^0+/, '') || rawId;
                if (!logsByEmpId.has(cleanId)) {
                    logsByEmpId.set(cleanId, []);
                }
                logsByEmpId.get(cleanId).push(log);
            });

            // 4. Aggregate monthly stats for each employee
            const aggregatedList = [];
            logsByEmpId.forEach((empLogs, empKey) => {
                const firstLog = empLogs[0] || {};
                const empId = firstLog.employee_id || empKey;
                const empName = firstLog.employee_name || 'Employee';
                const designation = firstLog.designation || '-';
                const storeName = firstLog.store_name || '-';
                const deviceId = firstLog.device_id || '-';
                const serialNo = firstLog.serial_number || '-';

                let presentCount = 0;
                let lateCount = 0;
                let weeklyOffCount = 0;
                let dayOffCount = 0;
                let unpunchedHolidayCount = 0;
                let holidayCount = 0;
                let totalWorkSecs = 0;
                let totalLunchSecs = 0;

                // Process each day of the elapsed month
                for (let d = 1; d <= elapsedDays; d++) {
                    const dateStr = `${selectedYear}-${monthStr}-${String(d).padStart(2, '0')}`;
                    const att = empLogs.find(a => {
                        const aDate = (a.attendance_date || a.date || '').toString().trim();
                        const key = aDate.includes('T') ? aDate.split('T')[0] : aDate.substring(0, 10);
                        return key === dateStr;
                    });

                    const rEntry = (rosterData || []).find(r => {
                        const rEmpId = (r.employee_id || '').toString().trim().toLowerCase().replace(/^0+/, '');
                        return rEmpId === empKey && r.date === dateStr;
                    });

                    const hasRoster = !!(rEntry && rEntry.shift_type);
                    const isRosterWeeklyOff = hasRoster && (
                        String(rEntry.shift_type).toLowerCase().includes('weekly off') ||
                        String(rEntry.shift_type).toLowerCase() === 'wo' ||
                        String(rEntry.shift_type).toLowerCase() === 'weeklyoff'
                    );

                    let inTime = att?.in_time;
                    let outTime = att?.out_time;

                    if (att?.punch_log && att.punch_log !== '-') {
                        const rawList = att.punch_log.split(/\s*\|\s*/).filter(Boolean).map(p => p.trim());
                        if (rawList.length > 0) {
                            inTime = rawList[0];
                            if (rawList.length > 1) {
                                outTime = rawList[rawList.length - 1];
                            }
                        }
                    } else if (att?.manual_punches && (att.manual_punches.is_manual || att.manual_punches.manual_override)) {
                        const mPunches = att.manual_punches.manual || att.manual_punches;
                        const mList = Object.entries(mPunches)
                            .filter(([k, v]) => v && typeof v === 'string' && k !== 'is_manual' && k !== 'manual_override' && k !== 'absent')
                            .map(([k, v]) => v.trim());
                        if (mList.length > 0) {
                            inTime = mList[0];
                            if (mList.length > 1) {
                                outTime = mList[mList.length - 1];
                            }
                        }
                    }

                    let status = att?.status;
                    const hasPunches = Boolean(inTime || outTime || (att?.punch_log && att.punch_log !== '-'));
                    const isLate = Boolean((att?.late_minutes && att.late_minutes > 0) || (att?.late_minute && att.late_minute > 0) || status === 'Late');
                    const isHoliday = !!holidayMap[dateStr];

                    if (isHoliday) {
                        holidayCount++;
                        if (hasPunches) {
                            status = isLate ? 'Late' : 'Present';
                            presentCount++;
                            if (isLate) lateCount++;
                        } else {
                            status = 'HOLIDAY';
                            unpunchedHolidayCount++;
                        }
                    } else if (hasPunches) {
                        status = isLate ? 'Late' : 'Present';
                        presentCount++;
                        if (isLate || status === 'Late') lateCount++;
                    } else if (!status || status === 'Absent') {
                        if (isRosterWeeklyOff) {
                            status = 'Weekly Off';
                            weeklyOffCount++;
                        } else {
                            status = 'Absent';
                        }
                    } else if (status === 'Weekly Off' || status === 'WO') {
                        weeklyOffCount++;
                    } else if (status === 'Day Off' || status === 'DO') {
                        dayOffCount++;
                    }

                    // Compute lunch time
                    let computedLunchStr = att?.standard_lunch || att?.lunch_time || att?.lunch_duration || att?.lunch || '-';
                    if (!computedLunchStr || computedLunchStr === '-' || computedLunchStr === '00:00:00') {
                        if (att?.punch_log && att.punch_log !== '-') {
                            const rawPunches = att.punch_log.split(/\s*\|\s*/).filter(Boolean).map(p => p.trim());
                            if (rawPunches.length >= 3) {
                                let actualLunchMs = 0;
                                for (let i = 1; i < rawPunches.length - 1; i += 2) {
                                    const pOut = parseDateTimeHelper(rawPunches[i], dateStr);
                                    const pIn = parseDateTimeHelper(rawPunches[i + 1], dateStr);
                                    if (pOut && pIn && pIn > pOut) {
                                        actualLunchMs += (pIn.getTime() - pOut.getTime());
                                    }
                                }
                                if (actualLunchMs > 0) {
                                    const totalSec = Math.floor(actualLunchMs / 1000);
                                    const hrs = Math.floor(totalSec / 3600);
                                    const mins = Math.floor((totalSec % 3600) / 60);
                                    const secs = totalSec % 60;
                                    computedLunchStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                                }
                            }
                        }
                    }

                    const lunchStr = (computedLunchStr && computedLunchStr !== '00:00:00') ? computedLunchStr : '-';
                    if (lunchStr !== '-') {
                        const [lh, lm, ls] = lunchStr.split(':').map(Number);
                        totalLunchSecs += ((lh || 0) * 3600 + (lm || 0) * 60 + (ls || 0));
                    }

                    let workHrsStr = att?.working_hour && att.working_hour !== '-' ? att.working_hour : '00:00:00';
                    if (inTime && outTime && inTime !== '-' && outTime !== '-') {
                        workHrsStr = calculateWorkHours(inTime, outTime, dateStr, lunchStr);
                    }
                    const [wh, wm, ws] = (workHrsStr || '00:00:00').split(':').map(Number);
                    const dayWorkSec = (wh || 0) * 3600 + (wm || 0) * 60 + (ws || 0);

                    totalWorkSecs += dayWorkSec;
                }

                const absentCount = Math.max(0, elapsedDays - presentCount - unpunchedHolidayCount - weeklyOffCount - dayOffCount);

                aggregatedList.push({
                    month: monthNames[selectedMonth - 1],
                    year: selectedYear,
                    employeeCode: empId,
                    employeeName: empName,
                    designation: designation,
                    storeName: storeName,
                    deviceId: deviceId,
                    serialNo: serialNo,
                    presentDays: presentCount,
                    absentDays: absentCount,
                    lateDays: lateCount,
                    weeklyOffDays: weeklyOffCount,
                    dayOffDays: dayOffCount,
                    unpunchedHolidayDays: unpunchedHolidayCount,
                    holidayDays: holidayCount,
                    totalWorkSecs: totalWorkSecs,
                    totalLunchSecs: totalLunchSecs,
                    totalWorkHours: formatSecsToHrsMins(totalWorkSecs),
                    totalLunchTime: formatSecsToHrsMins(totalLunchSecs)
                });
            });

            // Sort alphabetically by employeeName
            aggregatedList.sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''));

            setAttendanceData(aggregatedList);
            setLastSynced(new Date().toISOString());
        } catch (err) {
            console.error('Error fetching attendance data:', err);
            setError(err.message);
            setAttendanceData([]);
            setLastSynced(null);
        } finally {
            setLoading(false);
            setSyncing(false);
        }
    };

    const [inactiveEmpIds, setInactiveEmpIds] = useState(new Set());
    const [inactiveEmpNames, setInactiveEmpNames] = useState(new Set());

    const fetchEmployeesTable = async () => {
        try {
            let allEmployeesData = [];
            let page = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .from('hr_management_employees')
                    .select('*')
                    .range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allEmployeesData = [...allEmployeesData, ...data];
                    if (data.length < pageSize) {
                        hasMore = false;
                    } else {
                        page++;
                    }
                } else {
                    hasMore = false;
                }
            }

            setEmployeesData(allEmployeesData);

            // Fetch users table to build inactive sets
            const { data: usersData } = await supabase.from('users').select('*');
            const inactIds = new Set();
            const inactNames = new Set();
            (usersData || []).forEach(u => {
                const rawStatus = u.status ?? u.is_active ?? 'active';
                const isInactive =
                    rawStatus === false ||
                    rawStatus === 0 ||
                    ['inactive', 'resigned', 'terminated', 'left', 'disabled', 'false', '0'].includes(String(rawStatus).toLowerCase().trim());

                if (isInactive) {
                    const empId = (u.employee_id || '').toString().trim().toLowerCase();
                    const uname = (u.user_name || u.username || u.emp_name || '').toString().trim().toLowerCase();
                    if (empId) inactIds.add(empId);
                    if (uname) inactNames.add(uname);
                }
            });
            setInactiveEmpIds(inactIds);
            setInactiveEmpNames(inactNames);
        } catch (error) {
            console.error('Error fetching employees table:', error);
        }
    };

    const getDaysInMonth = (month, year) => {
        return new Date(year, month, 0).getDate();
    };

    const getSundaysCount = (month, year) => {
        let count = 0;
        const days = new Date(year, month, 0).getDate();
        for (let i = 1; i <= days; i++) {
            if (new Date(year, month - 1, i).getDay() === 0) count++;
        }
        return count;
    };

    useEffect(() => {
        fetchEmployeesTable();
    }, []);

    useEffect(() => {
        fetchAttendanceData();
    }, [selectedMonth, selectedYear, selectedDevice]);

    const isEmployeeInTable = (employeeCode) => {
        if (!employeeCode) return false;
        const cleanId = employeeCode.toString().trim().toLowerCase();
        return employeesData.some(emp => {
            const empId = emp.id?.toString().trim().toLowerCase();
            const empEmployeeId = emp.employee_id?.toString().trim().toLowerCase();
            return empId === cleanId || empEmployeeId === cleanId;
        });
    };

    const filteredData = (() => {
        const isEmpInactive = (id, name) => {
            const cleanId = (id || '').toString().trim().toLowerCase();
            const cleanName = (name || '').toString().trim().toLowerCase();
            if (cleanId && inactiveEmpIds.has(cleanId)) return true;
            if (cleanName && inactiveEmpNames.has(cleanName)) return true;
            return false;
        };

        // 1. Get monthly records from attendanceData that match Search, Month, and Year filters
        const baseList = attendanceData
            .map(item => {
                const empProfile = employeesData.find(e =>
                    (e.employee_id && String(e.employee_id).toLowerCase().trim() === String(item.employeeCode).toLowerCase().trim()) ||
                    (e.id && String(e.id).toLowerCase().trim() === String(item.employeeCode).toLowerCase().trim())
                );
                return {
                    ...item,
                    employeeName: empProfile ? (empProfile.user_name || empProfile.name_as_per_aadhar || item.employeeName) : item.employeeName,
                    designation: (empProfile && empProfile.designation) ? empProfile.designation : item.designation,
                    storeName: (empProfile && (empProfile.joining_place || empProfile.store_name)) ? (empProfile.joining_place || empProfile.store_name) : item.storeName
                };
            })
            .filter(item => {
                if (isEmpInactive(item.employeeCode, item.employeeName)) return false;

                const matchesSearch =
                    (item.employeeName?.toString().toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                    (item.employeeCode?.toString().toLowerCase() || '').includes(searchTerm.toLowerCase());

                const matchesMonth = selectedMonth ? item.month === monthNames[selectedMonth - 1] : true;
                const matchesYear = selectedYear ? item.year?.toString() === selectedYear.toString() : true;

                const isMatched = isEmployeeInTable(item.employeeCode);

                let matchesFilterMode = true;
                if (matchFilter === 'MATCHED') {
                    matchesFilterMode = isMatched;
                } else if (matchFilter === 'UNMATCHED') {
                    matchesFilterMode = !isMatched;
                }

                return matchesSearch && matchesMonth && matchesYear && matchesFilterMode;
            });

        // 2. If showing verified or all (matchFilter is not UNMATCHED), append remaining employees from employees table
        if (matchFilter !== 'UNMATCHED') {
            const hasAttendance = (empId) => {
                return attendanceData.some(item => item.employeeCode === empId);
            };

            const remaining = employeesData
                .filter(emp => {
                    const name = emp.user_name || emp.name_as_per_aadhar || '';
                    const id = emp.employee_id || emp.id || '';

                    if (isEmpInactive(id, name)) return false;

                    // Exclude if already in attendanceData (meaning they have monthly records)
                    if (hasAttendance(id)) return false;

                    // Apply search filter
                    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        id.toString().toLowerCase().includes(searchTerm.toLowerCase());

                    return matchesSearch;
                })
                .map(emp => ({
                    year: selectedYear,
                    month: monthNames[selectedMonth - 1],
                    employeeCode: emp.employee_id || emp.id,
                    employeeName: emp.user_name || emp.name_as_per_aadhar || 'Employee',
                    designation: emp.designation || '-',
                    storeName: emp.joining_place || '-',
                    deviceId: '-',
                    serialNo: '-',
                    presentDays: 0,
                    absentDays: getDaysInMonth(selectedMonth, selectedYear),
                    punchMiss: 0,
                    holidays: getSundaysCount(selectedMonth, selectedYear),
                    lateDays: 0,
                    totalWorkHours: '0h 0m',
                    totalWorkSecs: 0,
                    totalLunchTime: '0h 0m',
                    totalLunchSecs: 0,
                    isRemaining: true
                }));

            return [...baseList, ...remaining];
        }

        return baseList;
    })();

    // Apply monthly status filter
    const statusFilteredData = (() => {
        if (statusFilter === 'ALL') return filteredData;
        return filteredData.filter(item => {
            const present = parseInt(item.presentDays) || 0;
            const absent = parseInt(item.absentDays) || 0;
            const late = parseInt(item.lateDays) || 0;
            if (statusFilter === 'HAS_PRESENT') return present > 0;
            if (statusFilter === 'HAS_ABSENT') return absent > 0;
            if (statusFilter === 'HAS_LATE') return late > 0;
            if (statusFilter === 'ALL_ABSENT') return present === 0 && absent > 0;
            return true;
        });
    })();

    const pageSize = 15;
    const totalPages = Math.ceil(statusFilteredData.length / pageSize);
    const activePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedData = statusFilteredData.slice((activePage - 1) * pageSize, activePage * pageSize);

    const downloadExcel = () => {
        const dataToExport = statusFilteredData.map((item, idx) => ({
            'S.No.': idx + 1,
            'Month/Year': `${item.month} ${item.year}`,
            'Employee Code': item.employeeCode,
            'Employee Name': item.employeeName,
            'Designation': item.designation,
            'Store Name': item.storeName,
            'Device ID': item.deviceId,
            'Serial NO': item.serialNo,
            'Payable Days': (item.presentDays || 0) + (item.unpunchedHolidayDays || 0) + (item.weeklyOffDays || 0) + (item.dayOffDays || 0),
            'Present': item.presentDays,
            'Weekly Off': item.weeklyOffDays || 0,
            'Day Off': item.dayOffDays || 0,
            'Absent': item.absentDays,
            'Late Days': item.lateDays,
            'Avg Work Hours': item.presentDays > 0 ? formatSecsToHrsMins((item.totalWorkSecs || 0) / item.presentDays) : '0h 0m',
            'Avg Lunch Time': item.presentDays > 0 ? formatSecsToHrsMins((item.totalLunchSecs || 0) / item.presentDays) : '0h 0m'
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Monthly Attendance");
        XLSX.writeFile(workbook, `attendance_${selectedMonth}_${selectedYear}${selectedDevice.serial === 'ALL' ? '_all_devices' : ''}.xlsx`);
    };

    // Summary stats for all devices
    const totalEmployees = new Set(attendanceData.map(d => d.employeeCode)).size;
    const totalPresent = attendanceData.reduce((sum, d) => sum + (parseInt(d.presentDays) || 0), 0);
    const totalAbsent = attendanceData.reduce((sum, d) => sum + (parseInt(d.absentDays) || 0), 0);
    const totalLate = attendanceData.reduce((sum, d) => sum + (parseInt(d.lateDays) || 0), 0);

    return (
        <div className="p-3">
            {/* Header - Compact */}
            <div className="flex justify-between items-center mb-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Calendar size={18} />
                        Monthly Attendance
                    </h1>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                        Track and manage employee attendance records
                    </p>
                </div>
                <div className="flex gap-2">
                    {lastSynced && (
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
                            <Database size={10} className="text-gray-400" />
                            <span className="text-[10px] text-gray-500">
                                Synced: {new Date(lastSynced).toLocaleString('en-IN')}
                            </span>
                        </div>
                    )}
                    <div className="relative">
                        <select
                            value={matchFilter}
                            onChange={(e) => setMatchFilter(e.target.value)}
                            className={`flex h-10 appearance-none items-center gap-1.5 pl-3 pr-8 py-1.5 font-semibold text-xs border rounded-md cursor-pointer transition-all focus:outline-none ${matchFilter === 'ALL'
                                    ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                                    : matchFilter === 'MATCHED'
                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                }`}
                        >
                            <option value="ALL">All Employees</option>
                            <option value="MATCHED">Matched Only</option>
                            <option value="UNMATCHED">Unmatched Only</option>
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            <ChevronDown size={12} className={
                                matchFilter === 'ALL'
                                    ? 'text-blue-700'
                                    : matchFilter === 'MATCHED'
                                        ? 'text-emerald-700'
                                        : 'text-amber-700'
                            } />
                        </div>
                    </div>

                    <button
                        onClick={downloadExcel}
                        disabled={statusFilteredData.length === 0}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-medium text-xs transition-colors ${statusFilteredData.length === 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700'
                            }`}
                    >
                        <Download size={12} />
                        Export
                    </button>
                </div>
            </div>

            {/* Filter Section - Compact */}
            <div className="bg-white  p-2 mb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Search Employee</label>
                        <div className="relative">
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                className="w-full pl-7 pr-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Device</label>
                        <div className="relative">
                            <select
                                value={selectedDevice.name}
                                onChange={(e) => {
                                    const selected = e.target.value;
                                    if (selected === 'ALL DEVICES') {
                                        setSelectedDevice(ALL_DEVICES_OPTION);
                                    } else {
                                        const device = DEVICES.find(d => d.name === selected);
                                        if (device) setSelectedDevice(device);
                                    }
                                }}
                                className="w-full appearance-none pl-2 pr-6 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                            >
                                <option value="ALL DEVICES">📊 All Devices</option>
                                {DEVICES.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                            <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                        >
                            {monthNames.map((m, idx) => (
                                <option key={m} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    {/* Status Filter Dropdown */}
                    <div>
                        <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white cursor-pointer font-medium"
                        >
                            <option value="ALL">All</option>
                            <option value="HAS_PRESENT">✓ Has Present</option>
                            <option value="HAS_ABSENT">✗ Has Absent</option>
                            <option value="HAS_LATE">⏱ Has Late</option>
                            <option value="ALL_ABSENT">⛔ Fully Absent</option>
                        </select>
                    </div>
                </div>
            </div>


            {/* Table - Fixed Height & Width Container */}
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden flex flex-col h-[calc(88vh-220px)] min-h-[500px] shadow-sm">
                <div className="overflow-x-auto overflow-y-auto flex-1 scrollbar-thin">
                    <table className="w-full min-w-[1100px] text-xs relative border-collapse">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-12 min-w-[48px] z-10">#</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-28 min-w-[100px] z-10">Month/Year</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-28 min-w-[100px] z-10">Employee Id</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-48 min-w-[180px] z-10">Employee Name</th>

                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-32 min-w-[120px] z-10">Store</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-28 min-w-[100px] z-10">Device ID</th>
                                <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-36 min-w-[130px] z-10">Serial No</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-20 min-w-[70px] z-10" title="Present Days + Weekly Off + Day Off">Payable</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-16 min-w-[60px] z-10">Present</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-14 min-w-[50px] z-10">WO</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-14 min-w-[50px] z-10">DO</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-16 min-w-[60px] z-10">Absent</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-14 min-w-[50px] z-10">Late</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-24 min-w-[90px] z-10">Avg Work Hrs</th>
                                <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-24 min-w-[90px] z-10">Avg Lunch Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="15" className="text-center py-24 h-[400px]">
                                        <div className="flex items-center justify-center gap-1.5 text-gray-500 text-xs">
                                            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                            Loading...
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan="15" className="text-center py-24 h-[400px]">
                                        <p className="text-red-600 text-xs mb-2">{error}</p>
                                        <button
                                            onClick={() => fetchAttendanceData()}
                                            className="px-3 py-1 bg-indigo-600 text-white rounded text-xs"
                                        >
                                            Retry
                                        </button>
                                    </td>
                                </tr>
                            ) : paginatedData.length > 0 ? (
                                paginatedData.map((item, index) => {
                                    const isInEmployeesTable = isEmployeeInTable(item.employeeCode);
                                    const actualIndex = (activePage - 1) * pageSize + index;
                                    const employeeProfile = employeesData.find(e => e.employee_id === item.employeeCode || e.id === item.employeeCode);
                                    const candidatePhoto = employeeProfile?.candidate_photo;
                                    const payableDays = (item.presentDays || 0) + (item.unpunchedHolidayDays || 0) + (item.weeklyOffDays || 0) + (item.dayOffDays || 0);
                                    return (
                                        <tr
                                            key={index}
                                            className={`transition-colors h-11 ${item.isRemaining ? 'bg-blue-100 hover:bg-blue-200' : isInEmployeesTable ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50 bg-white'}`}
                                        >
                                            <td className="px-2 py-1.5 text-[10px] text-gray-500">{actualIndex + 1}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-medium text-gray-700">{item.month} {item.year}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-mono font-medium text-gray-900">{item.employeeCode}</td>
                                            <td className="px-2 py-1.5">
                                                <div 
                                                    onClick={() => setSelectedEmployeeModal({
                                                        id: item.employeeCode,
                                                        employee_id: item.employeeCode,
                                                        name: item.employeeName,
                                                        candidate_photo: candidatePhoto,
                                                        designation: item.designation,
                                                        joining_place: item.storeName
                                                    })}
                                                    className="flex items-center gap-1.5 cursor-pointer hover:opacity-85 transition-opacity"
                                                    title="Click to view full employee attendance profile"
                                                >
                                                    {candidatePhoto ? (
                                                        <img
                                                            src={candidatePhoto}
                                                            alt={item.employeeName}
                                                            className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${item.isRemaining ? 'bg-blue-200 text-blue-800' : isInEmployeesTable ? 'bg-blue-100 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                                            {item.employeeName?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-[11px] font-medium text-gray-900 block hover:text-indigo-600 hover:underline">{item.employeeName}</span>
                                                        {isInEmployeesTable ? (
                                                            <span className="text-[8px] text-blue-600 font-medium block">✓ Matched</span>
                                                        ) : (
                                                            <span className="text-[8px] text-amber-600 font-medium block">⚠️ Unmatched</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-2 py-1.5 text-[10px] text-gray-600">{item.storeName || '-'}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-mono text-gray-500">{item.deviceId || '-'}</td>
                                            <td className="px-2 py-1.5 text-[10px] font-mono text-gray-500">{item.serialNo || '-'}</td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="inline-flex px-1.5 py-0.5 bg-cyan-100 text-cyan-800 rounded text-[10px] font-bold" title="Payable Days (Present + WO + DO)">
                                                    {payableDays}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className="inline-flex px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
                                                    {item.presentDays}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-[10px] text-indigo-600 font-semibold">{item.weeklyOffDays || 0}</td>
                                            <td className="px-2 py-1.5 text-center text-[10px] text-purple-600 font-semibold">{item.dayOffDays || 0}</td>
                                            <td className="px-2 py-1.5 text-center">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${item.absentDays > 0 ? 'bg-red-100 text-red-700 font-bold' : 'text-slate-400 font-medium'}`}>
                                                    {item.absentDays}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-[10px] text-orange-600 font-medium">{item.lateDays || 0}</td>
                                            <td className="px-2 py-1.5 text-center text-[10px] font-semibold text-gray-700">
                                                {formatSecsToHrsMins(item.presentDays > 0 ? (item.totalWorkSecs || 0) / item.presentDays : 0)}
                                            </td>
                                            <td className="px-2 py-1.5 text-center text-[10px] font-semibold text-blue-600">
                                                {formatSecsToHrsMins(item.presentDays > 0 ? (item.totalLunchSecs || 0) / item.presentDays : 0)}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="15" className="text-center py-24 h-[400px]">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <Search size={28} className="mb-2" />
                                            <p className="text-xs font-medium">No records found</p>
                                            <p className="text-[10px] mt-0.5">Adjust filters or sync data</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                        <div className="text-gray-500">
                            Showing <span className="font-semibold">{(activePage - 1) * pageSize + 1}</span> to <span className="font-semibold">{Math.min(activePage * pageSize, filteredData.length)}</span> of <span className="font-semibold">{filteredData.length}</span> employees
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={activePage === 1}
                                onClick={() => setCurrentPage(activePage - 1)}
                                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium rounded shadow-sm"
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => page === 1 || page === totalPages || Math.abs(page - activePage) <= 1)
                                    .map((page, index, arr) => {
                                        const showEllipsis = index > 0 && page - arr[index - 1] > 1;
                                        return (
                                            <React.Fragment key={page}>
                                                {showEllipsis && <span className="text-gray-400 px-1">...</span>}
                                                <button
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-7 h-7 flex items-center justify-center font-medium rounded transition-colors ${activePage === page
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-700'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            </React.Fragment>
                                        );
                                    })}
                            </div>
                            <button
                                disabled={activePage === totalPages}
                                onClick={() => setCurrentPage(activePage + 1)}
                                className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium rounded shadow-sm"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {/* Employee Overview Modal */}
            {selectedEmployeeModal && (
                <EmployeeOverviewModal
                    isOpen={!!selectedEmployeeModal}
                    onClose={() => setSelectedEmployeeModal(null)}
                    employee={selectedEmployeeModal}
                    initialMonth={new Date(selectedYear, selectedMonth - 1, 1)}
                    initialTab="timecard"
                />
            )}
        </div>
    );
};

export default AttendanceMonthly;