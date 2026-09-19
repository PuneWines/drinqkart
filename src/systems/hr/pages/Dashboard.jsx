import { useState, useEffect } from 'react'
import { Users, UserCheck, Clock, UserX, UserMinus, Briefcase, Calendar, TrendingUp, Award, PieChart, Filter, Search, AlertCircle, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../../../context/AuthContext'

// Location ↔ Shop mappings
// const LOCATION_TO_SHOP_MAP = {
//     'BAVDHAN': 'MADHURA',
//     'BAWDHAN': 'MADHURA',
//     'HINJEWADI': 'VISHAL',
//     'WAGHOLI': 'FRIENDS',
//     'AKOLE': 'BALAJI',
//     'MUMBAI': 'KUNAL',
//     'ULWE': 'KUNAL ULWE',
//     'MUMBAI ULWE': 'KUNAL ULWE',
//     'KHARGHAR': 'KUNAL KHARGHAR'
// };

const LOCATION_TO_SHOP_MAP = {
    'BAVDHAN': 'MADHURA',
    'BAWDHAN': 'MADHURA',
    'HINJEWADI': 'TLS',
    'HINJHWADI': 'TLS',
    'VISHAL': 'TLS',
    'WAGHOLI': 'FRIENDS',
    'AKOLE': 'BALAJI',
    'MUMBAI': 'KUNAL ULWE',
    'ULWE': 'KUNAL ULWE',
    'ULWE NAVI MUMBAI': 'KUNAL ULWE',
    'NAVI MUMBAI': 'KUNAL ULWE',
    'MUMBAI ULWE': 'KUNAL ULWE',
    'KHARGHAR': 'KUNAL KHARGHAR'
};

const SHOP_TO_LOCATION_MAP = {
    'MADHURA': 'BAVDHAN',
    'TLS': 'HINJEWADI',
    'FRIENDS': 'WAGHOLI',
    'BALAJI': 'AKOLE',
    'KUNAL ULWE': 'ULWE',
    'KUNAL KHARGHAR': 'KHARGHAR'
};
// const SHOP_TO_LOCATION_MAP = {
//     'MADHURA': 'BAVDHAN',
//     'BAWDHAN': 'BAVDHAN',
//     'VISHAL': 'HINJEWADI',
//     'FRIENDS': 'WAGHOLI',
//     'BALAJI': 'AKOLE',
//     'KUNAL': 'MUMBAI',
//     'KUNAL ULWE': 'MUMBAI ULWE',
//     'KUNAL KHARGHAR': 'KHARGHAR'
// };

export default function Dashboard() {
    const { user: currentUserObj } = useAuth();

    // Helper: Determine if current logged-in user is unrestricted admin
    const checkIsUnrestrictedAdmin = (u) => {
        if (!u) return false;
        const uName = (u.user_name || u.username || '').trim().toLowerCase();
        if (uName === 'masteradmin') return true;
        const role = (u.role || '').trim().toLowerCase();
        if (role === 'admin') return true;
        return false;
    };

    const isUnrestrictedAdmin = checkIsUnrestrictedAdmin(currentUserObj);

    // Helper: Extract user's authorized shops & locations (Set of uppercase shop names/locations)
    const getUserAuthorizedStores = () => {
        if (isUnrestrictedAdmin) return null; // Null means unrestricted/all stores
        const accessParts = [
            currentUserObj?.shop_name,
            currentUserObj?.user_access,
            localStorage.getItem('shop_name'),
            localStorage.getItem('user_access')
        ].filter(Boolean);

        const rawAccess = accessParts.join(',');
        if (!rawAccess || !rawAccess.trim()) return null;
        const trimmed = rawAccess.toLowerCase().trim();
        if (trimmed === 'all' || trimmed.includes('admin')) return null;

        const shops = new Set();
        const parts = rawAccess.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        parts.forEach(p => {
            if (p !== 'ALL' && p !== 'NO SHOP') {
                shops.add(p);
                const mappedShop = LOCATION_TO_SHOP_MAP[p];
                if (mappedShop) shops.add(mappedShop.toUpperCase());
                const mappedLoc = SHOP_TO_LOCATION_MAP[p];
                if (mappedLoc) shops.add(mappedLoc.toUpperCase());

                // Exact synonym mappings for shops/locations
                if (p === 'KUNAL ULWE' || p === 'ULWE' || p === 'MUMBAI ULWE' || p === 'MUMBAI') {
                    shops.add('KUNAL ULWE');
                    shops.add('ULWE');
                    shops.add('MUMBAI');
                } else if (p === 'KUNAL KHARGHAR' || p === 'KHARGHAR') {
                    shops.add('KUNAL KHARGHAR');
                    shops.add('KHARGHAR');
                } else if (p === 'MADHURA' || p === 'BAVDHAN' || p === 'BAWDHAN') {
                    shops.add('MADHURA');
                    shops.add('BAVDHAN');
                } else if (p === 'FRIENDS' || p === 'WAGHOLI') {
                    shops.add('FRIENDS');
                    shops.add('WAGHOLI');
                } else if (p === 'BALAJI' || p === 'AKOLE') {
                    shops.add('BALAJI');
                    shops.add('AKOLE');
                } else if (p === 'TLS' || p === 'VISHAL' || p === 'HINJEWADI') {
                    shops.add('TLS');
                    shops.add('VISHAL');
                    shops.add('HINJEWADI');
                }
            }
        });
        return shops.size > 0 ? shops : null;
    };

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
    const [allStoresList, setAllStoresList] = useState([])
    const [presentEmployeesList, setPresentEmployeesList] = useState([])
    const [absentEmployeesList, setAbsentEmployeesList] = useState([])
    const [inactiveEmployeesList, setInactiveEmployeesList] = useState([])
    const [lateEmployeesList, setLateEmployeesList] = useState([])
    const [halfDayEmployeesList, setHalfDayEmployeesList] = useState([])
    // Modal filter states (search by name/id and filter by store)
    const [modalSearchTerm, setModalSearchTerm] = useState('')
    const [modalSelectedStore, setModalSelectedStore] = useState('ALL')

    const [detailModal, setDetailModal] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        employees: [],
        type: 'Present'
    })

    // Centralized Data Fetch Routine (Single Source of Truth)
    const fetchDashboardData = async () => {
        try {
            setLoading(true)
            const today = new Date()
            const yyyy = today.getFullYear()
            const mm = String(today.getMonth() + 1).padStart(2, '0')
            const dd = String(today.getDate()).padStart(2, '0')
            const todayStr = `${yyyy}-${mm}-${dd}`
            setTodayDate(todayStr)

            const authShops = getUserAuthorizedStores();

            // 1. Fetch all employee records from hr_management_employees
            let hrQuery = supabase
                .from('hr_management_employees')
                .select('*')
                .order('created_at', { ascending: false });

            const { data: hrData, error: hrError } = await hrQuery;

            if (hrError) throw hrError

            // 2. Fetch users table to cross-reference status set by Master Settings
            const { data: usersData } = await supabase
                .from('users')
                .select('*')

            const inactiveUsersMap = new Map()
            usersData?.forEach(u => {
                const uStatus = String(u.status || '').trim().toLowerCase()
                if (uStatus === 'inactive') {
                    const empId = u.employee_id ? String(u.employee_id).trim().toLowerCase() : ''
                    const numId = parseInt(empId, 10)
                    const uname = String(u.user_name || u.username || '').trim().toLowerCase()
                    const num = String(u.number || u.mobile || u.phone || '').trim().toLowerCase()

                    if (empId) inactiveUsersMap.set(empId, u)
                    if (!isNaN(numId)) inactiveUsersMap.set(String(numId), u)
                    if (uname) inactiveUsersMap.set(`name-${uname}`, u)
                    if (num) inactiveUsersMap.set(`num-${num}`, u)
                }
            })

            // Normalize all employee records and compute status
            let mappedList = (hrData || []).map((emp, index) => {
                const cleanId = emp.employee_id ? String(emp.employee_id).trim() : ''
                const empName = emp.name_as_per_aadhar ? String(emp.name_as_per_aadhar).trim() : ''
                const empMobile = (emp.candidate_mobile || emp.mobile_no || emp.mobile || '').toString().trim()
                const empStore = (emp.joining_place || emp.store_name || emp.shop_name || '').toString().trim()

                let isUserInactive = false;
                const numId = parseInt(cleanId, 10);
                if (cleanId && inactiveUsersMap.has(cleanId.toLowerCase())) {
                    isUserInactive = true;
                } else if (!isNaN(numId) && inactiveUsersMap.has(String(numId))) {
                    isUserInactive = true;
                } else if (empName && inactiveUsersMap.has(`name-${empName.toLowerCase()}`)) {
                    isUserInactive = true;
                } else if (empMobile && inactiveUsersMap.has(`num-${empMobile.toLowerCase()}`)) {
                    isUserInactive = true;
                }

                let finalStatus = 'Active';
                if (isUserInactive) {
                    finalStatus = 'Inactive';
                } else if (String(emp.status || '').trim().toLowerCase() === 'left') {
                    finalStatus = 'Left';
                }

                return {
                    ...emp,
                    employee_id: cleanId || '-',
                    name_as_per_aadhar: emp.name_as_per_aadhar || 'Employee',
                    designation: emp.designation || '',
                    joining_place: empStore,
                    status: finalStatus
                }
            })

            // Shop authorization filter: apply when non-admin user has specific assigned shops
            if (authShops && authShops.size > 0 && !isUnrestrictedAdmin) {
                mappedList = mappedList.filter(emp => {
                    const compUpper = (emp.joining_company_name || '').toString().trim().toUpperCase();
                    const placeUpper = (emp.joining_place || '').toString().trim().toUpperCase();
                    const transUpper = (emp.transferred_shop || '').toString().trim().toUpperCase();
                    const storeUpper = (emp.store_name || emp.shop_name || '').toString().trim().toUpperCase();

                    return (
                        authShops.has(compUpper) ||
                        authShops.has(placeUpper) ||
                        authShops.has(transUpper) ||
                        authShops.has(storeUpper)
                    );
                });
            }

            // Calculate Employee Statistics
            const total = mappedList.length
            const activeList = mappedList.filter(emp => (emp.status || '').toLowerCase() === 'active')
            const inactiveList = mappedList.filter(emp => {
                const s = String(emp.status || '').trim().toLowerCase()
                return s === 'inactive' || (s !== 'active' && s !== 'left')
            })
            const leftList = mappedList.filter(emp => (emp.status || '').toLowerCase() === 'left')

            const active = activeList.length
            const inactive = inactiveList.length
            const left = leftList.length

            const currentDate = new Date()
            const currentMonth = currentDate.getMonth()
            const currentYear = currentDate.getFullYear()

            const leftThisMonth = leftList.filter(emp => {
                const leftDate = new Date(emp.updated_at || emp.created_at)
                return leftDate.getMonth() === currentMonth && leftDate.getFullYear() === currentYear
            }).length

            setTotalEmployee(total)
            setActiveEmployee(active)
            setInactiveEmployee(inactive)
            setLeftEmployee(left)
            setLeaveThisMonth(leftThisMonth)
            setInactiveEmployeesList(inactiveList)

            // Recent employees (last 5)
            setRecentEmployees(mappedList.slice(0, 5))

            // Pie chart status distribution
            setStatusDistribution([
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
            ])

            // Build active employees map for attendance log matching
            const activeEmployeesMap = new Map()
            const masterStores = new Set()
            mappedList.forEach((emp, index) => {
                if (emp.joining_place) masterStores.add(emp.joining_place)
                if (emp.status === 'Active') {
                    const cleanId = emp.employee_id !== '-' ? emp.employee_id : `no-id-${index}`
                    activeEmployeesMap.set(cleanId.toLowerCase(), emp)
                    if (emp.name_as_per_aadhar) {
                        activeEmployeesMap.set(`name-${String(emp.name_as_per_aadhar).trim().toLowerCase()}`, emp)
                    }
                }
            })

            // 3. Fetch today's attendance logs
            const { data: attendanceLogs, error: attError } = await supabase
                .from('hr_management_attendance_logs')
                .select('*')
                .eq('attendance_date', todayStr)

            if (attError) throw attError

            const logsMap = new Map()
            attendanceLogs?.forEach(log => {
                if (log.employee_id) {
                    const cleanLogId = String(log.employee_id).trim().toLowerCase()
                    logsMap.set(cleanLogId, log)
                    const numId = parseInt(cleanLogId, 10)
                    if (!isNaN(numId)) logsMap.set(String(numId), log)
                }
                if (log.employee_name) {
                    logsMap.set(`name-${String(log.employee_name).trim().toLowerCase()}`, log)
                }
            })

            const presentList = []
            const lateList = []
            const absentList = []
            const halfDayList = []
            const processedEmpIds = new Set()

            // Categorize active employees against attendance logs
            activeList.forEach((emp, index) => {
                const cleanId = emp.employee_id !== '-' ? String(emp.employee_id).trim() : `no-id-${index}`
                const empIdKey = cleanId.toLowerCase()
                processedEmpIds.add(empIdKey)
                const numId = parseInt(cleanId, 10)
                const empName = emp.name_as_per_aadhar ? String(emp.name_as_per_aadhar).trim().toLowerCase() : ''
                const log = logsMap.get(empIdKey) || (!isNaN(numId) ? logsMap.get(String(numId)) : null) || (empName ? logsMap.get(`name-${empName}`) : null)
                if (log) {
                    const logStoreRaw = (log.store_name || log.joining_place || log.shop_name || '').toString().trim().toUpperCase();
                    const logStoreMapped = LOCATION_TO_SHOP_MAP[logStoreRaw] || logStoreRaw;
                    const isLogStoreAuth = !authShops || authShops.size === 0 || isUnrestrictedAdmin || authShops.has(logStoreRaw) || authShops.has(logStoreMapped);

                    if (isLogStoreAuth) {
                        const status = log.status || (log.half_day ? 'Half Day' : log.is_late ? 'Late' : 'Present')
                        
                        const isBefore9AM = (timeStr) => {
                            if (!timeStr || timeStr === '-') return false;
                            try {
                                const clean = timeStr.trim();
                                if (clean.includes('T') || (clean.includes('-') && clean.includes(' '))) {
                                    const dateObj = new Date(clean.includes(' ') && !clean.includes('T') ? clean.replace(' ', 'T') : clean);
                                    if (!isNaN(dateObj.getTime())) {
                                        const parts = new Intl.DateTimeFormat('en-US', {
                                            timeZone: 'Asia/Kolkata',
                                            hour: 'numeric',
                                            hour12: false
                                        }).formatToParts(dateObj);
                                        const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
                                        return h < 9;
                                    }
                                }
                                const upper = clean.toUpperCase();
                                const isAM = upper.endsWith('AM');
                                const isPM = upper.endsWith('PM');
                                let timePart = upper;
                                if (isAM || isPM) timePart = upper.slice(0, -2).trim();
                                if (timePart.includes(' ')) timePart = timePart.split(' ')[1] || timePart;
                                const [hStr] = timePart.split(':');
                                let h = parseInt(hStr, 10);
                                if (isNaN(h)) return false;
                                if (isAM && h === 12) h = 0;
                                if (isPM && h < 12) h += 12;
                                return h < 9;
                            } catch (e) {
                                return false;
                            }
                        };

                        let effectiveInTime = log.in_time;
                        if (effectiveInTime && isBefore9AM(effectiveInTime)) {
                            effectiveInTime = null;
                        }

                        if (!effectiveInTime || effectiveInTime === '-') {
                            if (log.punch_log && log.punch_log !== '-') {
                                const validPunches = log.punch_log.split('|').map(p => p.trim()).filter(p => p && !isBefore9AM(p));
                                if (validPunches.length > 0) effectiveInTime = validPunches[0];
                            } else if (log.manual_punches && typeof log.manual_punches === 'object') {
                                const activePunches = [
                                    log.manual_punches["1"] || log.manual_punches.manual?.["1"],
                                    log.manual_punches["2"] || log.manual_punches.manual?.["2"],
                                    log.manual_punches["3"] || log.manual_punches.manual?.["3"],
                                    log.manual_punches["4"] || log.manual_punches.manual?.["4"],
                                    log.manual_punches["5"] || log.manual_punches.manual?.["5"]
                                ].filter(p => p && !isBefore9AM(p));
                                if (activePunches.length > 0) effectiveInTime = activePunches[0];
                            }
                        }

                        const calculateLateFromInTime = (timeVal) => {
                            if (!timeVal || timeVal === '-') return 0;
                            try {
                                const clean = timeVal.trim();
                                let h = 0, m = 0;
                                if (clean.includes('T') || (clean.includes('-') && clean.includes(' '))) {
                                    const dateObj = new Date(clean.includes(' ') && !clean.includes('T') ? clean.replace(' ', 'T') : clean);
                                    if (!isNaN(dateObj.getTime())) {
                                        const parts = new Intl.DateTimeFormat('en-US', {
                                            timeZone: 'Asia/Kolkata',
                                            hour: 'numeric',
                                            minute: 'numeric',
                                            hour12: false
                                        }).formatToParts(dateObj);
                                        h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
                                        m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
                                    }
                                } else {
                                    const upper = clean.toUpperCase();
                                    const isAM = upper.endsWith('AM');
                                    const isPM = upper.endsWith('PM');
                                    let timePart = upper;
                                    if (isAM || isPM) timePart = upper.slice(0, -2).trim();
                                    if (timePart.includes(' ')) timePart = timePart.split(' ')[1] || timePart;
                                    const [hStr, mStr] = timePart.split(':');
                                    h = parseInt(hStr, 10);
                                    m = parseInt(mStr, 10) || 0;
                                    if (isAM && h === 12) h = 0;
                                    if (isPM && h < 12) h += 12;
                                }
                                const totalMins = h * 60 + m;
                                const graceThreshold = 10 * 60 + 10; // 10:10 AM
                                const officialStart = 10 * 60;      // 10:00 AM
                                return totalMins >= graceThreshold ? (totalMins - officialStart) : 0;
                            } catch (e) {
                                return 0;
                            }
                        };

                        let effectiveStatus = status;
                        let effectiveLateMins = log.late_minute || 0;

                        if (!effectiveInTime || effectiveInTime === '-') {
                            effectiveStatus = 'Absent';
                        } else {
                            const calculatedLate = calculateLateFromInTime(effectiveInTime);
                            if (calculatedLate > 0) {
                                effectiveStatus = 'Late';
                                effectiveLateMins = calculatedLate;
                            }
                        }

                        const empWithLog = {
                            ...emp,
                            name_as_per_aadhar: log.employee_name || emp.name_as_per_aadhar,
                            designation: log.designation || emp.designation,
                            joining_place: (log.store_name && log.store_name.trim()) ? log.store_name : emp.joining_place,
                            in_time: effectiveInTime,
                            out_time: log.out_time,
                            late_minute: effectiveLateMins,
                            status: effectiveStatus
                        }

                        if (effectiveStatus === 'Absent') {
                            absentList.push(empWithLog)
                        } else if (effectiveStatus === 'Late' || log.is_late) {
                            lateList.push(empWithLog)
                        } else if (effectiveStatus === 'Half Day' || log.half_day) {
                            halfDayList.push(empWithLog)
                        } else {
                            presentList.push(empWithLog)
                        }
                    }
                } else {
                    const empStoreRaw = (emp.joining_place || emp.store_name || '').toString().trim().toUpperCase();
                    const empStoreMapped = LOCATION_TO_SHOP_MAP[empStoreRaw] || empStoreRaw;
                    const isEmpStoreAuth = !authShops || authShops.size === 0 || isUnrestrictedAdmin || authShops.has(empStoreRaw) || authShops.has(empStoreMapped);

                    if (isEmpStoreAuth) {
                        absentList.push({
                            ...emp,
                            status: 'Absent',
                            in_time: null,
                            out_time: null,
                            late_minute: null
                        })
                    }
                }
            })

            // Process any additional logs from hr_management_attendance_logs not in active map
            attendanceLogs?.forEach(log => {
                const logEmpId = log.employee_id ? String(log.employee_id).trim() : null
                const logEmpName = log.employee_name ? String(log.employee_name).trim().toLowerCase() : ''
                const logStore = (log.store_name || log.joining_place || log.shop_name || '').toString().trim().toUpperCase();
                
                // Exclude if already processed, if user/employee is inactive, or if store is not authorized for current user
                const isLogInactive = (logEmpId && inactiveUsersMap.has(logEmpId.toLowerCase())) || (logEmpName && inactiveUsersMap.has(`name-${logEmpName}`));
                
                let isStoreAuth = true;
                if (authShops && authShops.size > 0 && !isUnrestrictedAdmin) {
                    isStoreAuth = Boolean(logStore && authShops.has(logStore));
                }
                
                if (logEmpId && !processedEmpIds.has(logEmpId.toLowerCase()) && !isLogInactive && isStoreAuth) {
                    processedEmpIds.add(logEmpId.toLowerCase())
                    const status = log.status || (log.half_day ? 'Half Day' : log.is_late ? 'Late' : 'Present')
                    
                    const isBefore9AM = (timeStr) => {
                        if (!timeStr || timeStr === '-') return false;
                        try {
                            const clean = timeStr.trim();
                            if (clean.includes('T') || (clean.includes('-') && clean.includes(' '))) {
                                const dateObj = new Date(clean.includes(' ') && !clean.includes('T') ? clean.replace(' ', 'T') : clean);
                                if (!isNaN(dateObj.getTime())) {
                                    const parts = new Intl.DateTimeFormat('en-US', {
                                        timeZone: 'Asia/Kolkata',
                                        hour: 'numeric',
                                        hour12: false
                                    }).formatToParts(dateObj);
                                    const h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
                                    return h < 9;
                                }
                            }
                            const upper = clean.toUpperCase();
                            const isAM = upper.endsWith('AM');
                            const isPM = upper.endsWith('PM');
                            let timePart = upper;
                            if (isAM || isPM) timePart = upper.slice(0, -2).trim();
                            if (timePart.includes(' ')) timePart = timePart.split(' ')[1] || timePart;
                            const [hStr] = timePart.split(':');
                            let h = parseInt(hStr, 10);
                            if (isNaN(h)) return false;
                            if (isAM && h === 12) h = 0;
                            if (isPM && h < 12) h += 12;
                            return h < 9;
                        } catch (e) {
                            return false;
                        }
                    };

                    let effectiveInTime = log.in_time;
                    if (effectiveInTime && isBefore9AM(effectiveInTime)) {
                        effectiveInTime = null;
                    }

                    if (!effectiveInTime || effectiveInTime === '-') {
                        if (log.punch_log && log.punch_log !== '-') {
                            const validPunches = log.punch_log.split('|').map(p => p.trim()).filter(p => p && !isBefore9AM(p));
                            if (validPunches.length > 0) effectiveInTime = validPunches[0];
                        } else if (log.manual_punches && typeof log.manual_punches === 'object') {
                            const activePunches = [
                                log.manual_punches["1"] || log.manual_punches.manual?.["1"],
                                log.manual_punches["2"] || log.manual_punches.manual?.["2"],
                                log.manual_punches["3"] || log.manual_punches.manual?.["3"],
                                log.manual_punches["4"] || log.manual_punches.manual?.["4"],
                                log.manual_punches["5"] || log.manual_punches.manual?.["5"]
                            ].filter(p => p && !isBefore9AM(p));
                            if (activePunches.length > 0) effectiveInTime = activePunches[0];
                        }
                    }

                    const calculateLateFromInTime = (timeVal) => {
                        if (!timeVal || timeVal === '-') return 0;
                        try {
                            const clean = timeVal.trim();
                            let h = 0, m = 0;
                            if (clean.includes('T') || (clean.includes('-') && clean.includes(' '))) {
                                const dateObj = new Date(clean.includes(' ') && !clean.includes('T') ? clean.replace(' ', 'T') : clean);
                                if (!isNaN(dateObj.getTime())) {
                                    const parts = new Intl.DateTimeFormat('en-US', {
                                        timeZone: 'Asia/Kolkata',
                                        hour: 'numeric',
                                        minute: 'numeric',
                                        hour12: false
                                    }).formatToParts(dateObj);
                                    h = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
                                    m = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
                                }
                            } else {
                                const upper = clean.toUpperCase();
                                const isAM = upper.endsWith('AM');
                                const isPM = upper.endsWith('PM');
                                let timePart = upper;
                                if (isAM || isPM) timePart = upper.slice(0, -2).trim();
                                if (timePart.includes(' ')) timePart = timePart.split(' ')[1] || timePart;
                                const [hStr, mStr] = timePart.split(':');
                                h = parseInt(hStr, 10);
                                m = parseInt(mStr, 10) || 0;
                                if (isAM && h === 12) h = 0;
                                if (isPM && h < 12) h += 12;
                            }
                            const totalMins = h * 60 + m;
                            const graceThreshold = 10 * 60 + 10; // 10:10 AM
                            const officialStart = 10 * 60;      // 10:00 AM
                            return totalMins >= graceThreshold ? (totalMins - officialStart) : 0;
                        } catch (e) {
                            return 0;
                        }
                    };

                    let effectiveStatus = status;
                    let effectiveLateMins = log.late_minute || 0;

                    if (!effectiveInTime || effectiveInTime === '-') {
                        effectiveStatus = 'Absent';
                    } else {
                        const calculatedLate = calculateLateFromInTime(effectiveInTime);
                        if (calculatedLate > 0) {
                            effectiveStatus = 'Late';
                            effectiveLateMins = calculatedLate;
                        }
                    }

                    const empFromLog = {
                        employee_id: logEmpId,
                        name_as_per_aadhar: log.employee_name || `Employee ${logEmpId}`,
                        designation: log.designation || '',
                        joining_place: log.store_name || '',
                        in_time: effectiveInTime,
                        out_time: log.out_time,
                        late_minute: effectiveLateMins,
                        status: effectiveStatus
                    }

                    if (effectiveStatus === 'Absent') {
                        absentList.push(empFromLog)
                    } else if (effectiveStatus === 'Late' || log.is_late) {
                        lateList.push(empFromLog)
                    } else if (effectiveStatus === 'Half Day' || log.half_day) {
                        halfDayList.push(empFromLog)
                    } else {
                        presentList.push(empFromLog)
                    }
                }
            })

            // Fetch shops from shop table as well to guarantee all store locations are listed
            try {
                const { data: shopsData } = await supabase.from('shop').select('shop_name')
                if (shopsData) {
                    shopsData.forEach(s => {
                        if (s.shop_name && s.shop_name.trim()) masterStores.add(s.shop_name.trim())
                    })
                }
            } catch (e) {
                console.error('Error fetching shop table:', e)
            }

            const defaultMasterShops = ['AKOLE', 'BALAJI', 'BAVDHAN', 'FRIENDS', 'HINJEWADI', 'KHARGHAR', 'MADHURA', 'MUMBAI', 'OFFICE', 'TLS', 'WAGHOLI']
            defaultMasterShops.forEach(s => masterStores.add(s))

            setAllStoresList(Array.from(masterStores).sort())
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
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchDashboardData()
    }, [currentUserObj])

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
            case 'Inactive':
                title = 'Inactive Employees'
                subtitle = `Employees currently with Inactive status`
                employeesList = inactiveEmployeesList
                break
            default:
                return
        }

        setModalSearchTerm('')
        setModalSelectedStore('ALL')

        setDetailModal({
            isOpen: true,
            title,
            subtitle,
            employees: employeesList,
            type
        })
    }

    // Refresh attendance data (can be called after sync or manual click)
    const refreshAttendance = async () => {
        await fetchDashboardData()
    }

    const formatTimeIST = (timeStr) => {
        if (!timeStr || timeStr === '-') return '-'
        try {
            let formatted = timeStr.trim();
            if (formatted.includes('T') || formatted.includes(' ')) {
                const date = new Date(formatted.includes(' ') && !formatted.includes('T') ? formatted.replace(' ', 'T') : formatted);
                if (!isNaN(date.getTime())) {
                    return new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Kolkata',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                    }).format(date);
                }
            }
            const clean = formatted.toUpperCase();
            if (clean.endsWith('AM') || clean.endsWith('PM')) {
                return formatted;
            }
            if (formatted.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
                const [hStr, mStr] = formatted.split(':');
                let h = parseInt(hStr, 10);
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
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
                                    <p className="text-xs text-slate-400 font-medium">Active emps absent</p>
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

                        {/* Inactive Employees */}
                        <div
                            onClick={() => handleCardClick('Inactive')}
                            className="group relative bg-white rounded-2xl border border-slate-200/80 p-5 cursor-pointer hover:shadow-lg hover:shadow-amber-100/50 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                        >
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-400 to-amber-500 rounded-l-2xl" />
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Inactive</p>
                                    <p className="text-3xl font-extrabold text-slate-900">{inactiveEmployee}</p>
                                    <p className="text-xs text-slate-400 font-medium">Inactive status</p>
                                </div>
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-400 to-amber-500 flex items-center justify-center shadow-md shadow-slate-200 group-hover:scale-110 transition-transform">
                                    <UserMinus size={20} className="text-white" />
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
                                            'Inactive': <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><UserMinus size={18} className="text-amber-600" /></div>,
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

                        {/* Modal Filter Toolbar */}
                        {(() => {
                            // Exact mapping requested by user:
                            // Dropdown displays Location -> Internal filter maps to Shop Name
                            const locationToShopMap = {
                                'BAVDHAN': 'MADHURA',
                                'BAWDHAN': 'MADHURA',
                                'HINJEWADI': 'VISHAL',
                                'WAGHOLI': 'FRIENDS',
                                'AKOLE': 'BALAJI',
                                'MUMBAI': 'KUNAL',
                                'ULWE': 'KUNAL ULWE',
                                'KUNAL ULWE': 'KUNAL ULWE',
                                'KHARGHAR': 'KUNAL KHARGHAR'
                            };

                            // Reverse lookup: Shop Name -> Location
                            const shopToLocationMap = {
                                'MADHURA': 'BAVDHAN',
                                'VISHAL': 'HINJEWADI',
                                'FRIENDS': 'WAGHOLI',
                                'BALAJI': 'AKOLE',
                                'KUNAL': 'MUMBAI',
                                'KUNAL ULWE': 'ULWE',
                                'KUNAL KHARGHAR': 'KHARGHAR'
                            };

                            // Standard location options to display in the dropdown
                            const dropDownLocations = ['AKOLE', 'BAVDHAN', 'HINJEWADI', 'KHARGHAR', 'MUMBAI', 'WAGHOLI'];

                            const isEmpInLocation = (empStoreRaw, locUpper) => {
                                const targetShopUpper = (locationToShopMap[locUpper] || locUpper).toUpperCase();
                                if (empStoreRaw === targetShopUpper || empStoreRaw === locUpper) return true;
                                if (locUpper === 'BAVDHAN' && (empStoreRaw === 'BAWDHAN' || empStoreRaw === 'MADHURA')) return true;
                                if ((locUpper === 'ULWE' || locUpper === 'MUMBAI') && (empStoreRaw === 'KUNAL ULWE' || empStoreRaw === 'MUMBAI ULWE' || empStoreRaw === 'ULWE' || empStoreRaw === 'KUNAL')) return true;
                                if (locUpper === 'KHARGHAR' && empStoreRaw === 'KUNAL KHARGHAR') return true;
                                if (locUpper === 'HINJEWADI' && (empStoreRaw === 'TLS' || empStoreRaw === 'VISHAL')) return true;
                                if (locUpper === 'WAGHOLI' && empStoreRaw === 'FRIENDS') return true;
                                if (locUpper === 'AKOLE' && empStoreRaw === 'BALAJI') return true;
                                return false;
                            };

                            const filteredModalEmps = detailModal.employees.filter(emp => {
                                const nameOrId = `${emp.name_as_per_aadhar || ''} ${emp.employee_id || ''}`.toLowerCase();
                                const matchesSearch = !modalSearchTerm || nameOrId.includes(modalSearchTerm.toLowerCase());
                                const empStoreRaw = (emp.joining_place || emp.store_name || emp.shop_name || '').toString().trim().toUpperCase();

                                let matchesStore = true;
                                if (modalSelectedStore !== 'ALL') {
                                    const selectedLocationUpper = modalSelectedStore.trim().toUpperCase();
                                    matchesStore = isEmpInLocation(empStoreRaw, selectedLocationUpper);
                                }
                                return matchesSearch && matchesStore;
                            });

                            // Filter location options by user permissions if restricted
                            const authStores = getUserAuthorizedStores();
                            const availableLocations = dropDownLocations.filter(loc => {
                                if (!authStores) return true;
                                const mappedShop = (LOCATION_TO_SHOP_MAP[loc] || loc).toUpperCase();
                                return authStores.has(loc.toUpperCase()) || authStores.has(mappedShop);
                            });

                            // Helper function to get count of employees for a specific location/store option
                            const getStoreEmpCount = (locationName) => {
                                if (locationName === 'ALL') return detailModal.employees.length;
                                const selectedLocationUpper = locationName.trim().toUpperCase();
                                return detailModal.employees.filter(emp => {
                                    const empStoreRaw = (emp.joining_place || emp.store_name || emp.shop_name || '').toString().trim().toUpperCase();
                                    return isEmpInLocation(empStoreRaw, selectedLocationUpper);
                                }).length;
                            };

                            return (
                                <>
                                    <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                            <div className="relative w-full max-w-xs">
                                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by name or ID..."
                                                    value={modalSearchTerm}
                                                    onChange={(e) => setModalSearchTerm(e.target.value)}
                                                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                                <Filter size={12} className="text-slate-400" /> Store:
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={modalSelectedStore}
                                                    onChange={(e) => setModalSelectedStore(e.target.value)}
                                                    className="appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    <option value="ALL">
                                                        {isUnrestrictedAdmin ? `All Stores (${getStoreEmpCount('ALL')})` : `Authorized Stores (${getStoreEmpCount('ALL')})`}
                                                    </option>
                                                    {availableLocations.map(locationName => (
                                                        <option key={locationName} value={locationName}>
                                                            {locationName} ({getStoreEmpCount(locationName)})
                                                        </option>
                                                    ))}
                                                </select>
                                                <Filter size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Modal Body */}
                                    <div className="p-5 flex-1 overflow-y-auto min-h-0">
                                        {filteredModalEmps.length === 0 ? (
                                            <div className="text-center py-16">
                                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                                    <Users size={28} className="text-slate-400" />
                                                </div>
                                                <p className="text-lg font-semibold text-slate-700">No matching employees</p>
                                                <p className="text-sm text-slate-400 mt-1">No records match your search or store filter.</p>
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
                                                        {filteredModalEmps.map((emp, index) => (
                                                            <tr
                                                                key={emp.employee_id ? `${emp.employee_id}-${index}` : `emp-${index}`}
                                                                className={(() => {
                                                                    switch (detailModal.type) {
                                                                        case 'Present': return 'hover:bg-green-50/50 transition-colors';
                                                                        case 'Late': return 'hover:bg-orange-50/50 transition-colors';
                                                                        case 'Absent': return 'hover:bg-red-50/50 transition-colors';
                                                                        case 'Half Day': return 'hover:bg-yellow-50/50 transition-colors';
                                                                        case 'Inactive': return 'hover:bg-amber-50/50 transition-colors';
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
                                                                        const currentStatus = (emp.status || detailModal.type).toString();
                                                                        if (detailModal.type === 'Inactive' || currentStatus.toLowerCase() === 'inactive') {
                                                                            return (
                                                                                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                                                                    <UserMinus size={12} /> Inactive
                                                                                </span>
                                                                            );
                                                                        } else if (currentStatus === 'Late') {
                                                                            return (
                                                                                <div className="flex flex-col">
                                                                                    <span className="text-xs text-orange-600 font-semibold flex items-center gap-1">
                                                                                        <Clock size={12} />
                                                                                        Late ({emp.late_minute || 0}m)
                                                                                    </span>
                                                                                    {emp.in_time && formatTimeIST(emp.in_time) !== '-' && (
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
                                                                                    {emp.in_time && formatTimeIST(emp.in_time) !== '-' && (
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
                                </>
                            );
                        })()}

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