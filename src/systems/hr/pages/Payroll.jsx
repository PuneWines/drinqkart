import React, { useState, useEffect } from 'react';
import { Search, Loader2, Download, Calendar, Save, Users, DollarSign, TrendingUp, HelpCircle, Database, X, ChevronDown, Pencil, RefreshCw, CheckCircle2, Check, Columns, Bookmark, PauseCircle, Printer, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const Payroll = () => {
    const [activeTab, setActiveTab] = useState('salary');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [salaryData, setSalaryData] = useState({ headers: [], rows: [] });
    const [historyData, setHistoryData] = useState({ headers: [], rows: [] });
    const [holdData, setHoldData] = useState({ headers: [], rows: [] });
    const [hiddenColumns, setHiddenColumns] = useState(new Set(['RTO', 'Refferal Bonus', 'Seasonal Bonus']));
    const [showColumnDropdown, setShowColumnDropdown] = useState(false);
    const [selectedPayslip, setSelectedPayslip] = useState(null);
    const [sortOrder, setSortOrder] = useState('ASC');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isSubmittingPayments, setIsSubmittingPayments] = useState(false);
    const [isSavingToDB, setIsSavingToDB] = useState(false);
    const [showSchemaModal, setShowSchemaModal] = useState(false);
    const [selectedShop, setSelectedShop] = useState('ALL');
    const [shopsList, setShopsList] = useState([]);
    const [shopFullNameMap, setShopFullNameMap] = useState({});
    const [showMarkAsPaidModal, setShowMarkAsPaidModal] = useState(false);
    const [pendingPaidRows, setPendingPaidRows] = useState([]);
    const [modalShopSelection, setModalShopSelection] = useState('');
    const [advanceMapState, setAdvanceMapState] = useState({});

    const PAYROLL_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1QHKttecIhZwoyh8-xo_wzqHgxIuFr9Tci8L803T1q0nKkjA1w26soUXSffkMY4E0sQ/exec';
    const SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Helper to parse date strings nicely
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return dateStr;
        }
    };

    // Helper to parse Google Sheets date/timestamps
    const parseTimestampToMonthYear = (ts) => {
        if (!ts) return { month: null, year: null };
        try {
            // First check if it matches YYYY-MM
            if (/^\d{4}-\d{2}$/.test(ts.toString().trim())) {
                const parts = ts.toString().split('-');
                return { month: parseInt(parts[1], 10), year: parseInt(parts[0], 10) };
            }
            // Check if it's a date string
            const d = new Date(ts);
            if (!isNaN(d.getTime())) {
                return { month: d.getMonth() + 1, year: d.getFullYear() };
            }
            // Split by common separators
            const parts = ts.toString().split(/[\/\-\s]/);
            if (parts.length >= 2) {
                let year = parseInt(parts[0], 10);
                let month = parseInt(parts[1], 10);
                if (year < 100) { // e.g. YY-MM-DD
                    year = 2000 + year;
                }
                if (year < 1000 && parts.length >= 3) {
                    year = parseInt(parts[2], 10);
                    month = parseInt(parts[1], 10);
                }
                return { month, year };
            }
        } catch (e) {
            // ignore
        }
        return { month: null, year: null };
    };

    // Helper to calculate advance/fix advance deduction for target period
    const getAdvanceDeductionForPeriod = (adv, targetYear, targetMonth) => {
        const apprAmount = Number(adv.approved_amount) || Number(adv.amount) || 0;
        const apprMonthlyDeduction = Number(adv.approved_monthly_deduction) || Number(adv.monthly_deduction) || 0;
        const currentRemaining = adv.remaining_amount !== null && adv.remaining_amount !== undefined
            ? Number(adv.remaining_amount)
            : apprAmount;

        if (apprAmount <= 0 || apprMonthlyDeduction <= 0 || currentRemaining <= 0) {
            return { remaining: currentRemaining, deduction: 0 };
        }

        const dateSource = adv.starting_month || adv.created_at;
        const dateInfo = parseTimestampToMonthYear(dateSource);
        if (!dateInfo.month || !dateInfo.year) return { remaining: currentRemaining, deduction: 0 };

        // Calculate months difference
        const startMonthsSinceEpoch = dateInfo.year * 12 + (dateInfo.month - 1);
        const targetMonthsSinceEpoch = targetYear * 12 + (targetMonth - 1);
        const monthsActive = targetMonthsSinceEpoch - startMonthsSinceEpoch;

        if (monthsActive < 0) {
            // Deduction hasn't started yet
            return { remaining: currentRemaining, deduction: 0 };
        }

        // Deduction for this month is the minimum of monthly deduction and remaining balance
        const currentDeduction = Math.min(apprMonthlyDeduction, currentRemaining);
        return { remaining: currentRemaining, deduction: currentDeduction };
    };

    const fetchShops = async () => {
        try {
            const { data } = await supabase.from('shop').select('shop_name, full_name').order('shop_name', { ascending: true });
            if (data) {
                setShopsList(data.map(s => s.shop_name));
                // Build a map: short name -> full name for payslip display
                const map = {};
                data.forEach(s => {
                    if (s.shop_name) {
                        map[s.shop_name] = s.full_name || s.shop_name;
                    }
                });
                setShopFullNameMap(map);
            }
        } catch (e) {
            console.error("Error fetching shops:", e);
        }
    };

    useEffect(() => {
        fetchShops();
    }, []);

    // Fetch dynamic payroll data from Supabase and Google Sheet advances
    const fetchPayrollData = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch employees from Supabase
            const { data: dbEmployees, error: empError } = await supabase
                .from('hr_management_employees')
                .select('employee_id, name_as_per_aadhar, date_of_joining, salary, status, mobile_no, current_account_no, ifsc_code, beneficiary_name, joining_company_name');

            if (empError) throw empError;

            const activeEmployees = (dbEmployees || []).filter(emp => {
                if (!emp.status) return true;
                return emp.status.toLowerCase() === 'active';
            });

            // 2. Fetch daily logs for the month to find matched and unmatched employee stats
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const totalDays = 30; // Every employee has fixed monthly Total days = 30
            const startDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
            const endDateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

            const { data: dbLogs, error: logsError } = await supabase
                .from('hr_management_attendance_logs')
                .select('employee_id, employee_name, status, attendance_date')
                .gte('attendance_date', startDateStr)
                .lte('attendance_date', endDateStr)
                .limit(10000);

            if (logsError) throw logsError;

            const getLocalDayOfWeek = (dateStr) => {
                if (!dateStr) return -1;
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    const year = parseInt(parts[0], 10);
                    const month = parseInt(parts[1], 10) - 1;
                    const day = parseInt(parts[2], 10);
                    return new Date(year, month, day).getDay();
                }
                return new Date(dateStr).getDay();
            };

            const attendanceMap = {};
            const unmatchedMap = {};
            const verifiedIds = new Set((dbEmployees || []).map(e => e.employee_id?.toString().trim().toLowerCase()));

            (dbLogs || []).forEach(log => {
                const empId = log.employee_id?.toString().trim();
                if (!empId) return;

                const empIdLower = empId.toLowerCase();
                const status = log.status?.toString().trim().toLowerCase() || '';
                const isPresent = status === 'present' || status === 'late' || status === 'half day' || status === 'weekly off' || status === 'day off' || status === 'wo' || status === 'do';

                const dayOfWeek = getLocalDayOfWeek(log.attendance_date);
                const isFriday = dayOfWeek === 5;
                const isSaturday = dayOfWeek === 6;
                const isSunday = dayOfWeek === 0;

                if (verifiedIds.has(empIdLower)) {
                    if (!attendanceMap[empIdLower]) {
                        attendanceMap[empIdLower] = { present: 0, absent: 0, hasFriday: false, hasSaturday: false, hasSunday: false };
                    }
                    if (isPresent) {
                        attendanceMap[empIdLower].present++;
                        if (isFriday) attendanceMap[empIdLower].hasFriday = true;
                        if (isSaturday) attendanceMap[empIdLower].hasSaturday = true;
                        if (isSunday) attendanceMap[empIdLower].hasSunday = true;
                    } else if (status === 'absent') {
                        attendanceMap[empIdLower].absent++;
                    }
                } else {
                    if (!unmatchedMap[empId]) {
                        unmatchedMap[empId] = {
                            id: empId,
                            name: log.employee_name || 'Unmatched Employee',
                            present: 0,
                            absent: 0,
                            hasFriday: false,
                            hasSaturday: false,
                            hasSunday: false
                        };
                    }
                    if (isPresent) {
                        unmatchedMap[empId].present++;
                        if (isFriday) unmatchedMap[empId].hasFriday = true;
                        if (isSaturday) unmatchedMap[empId].hasSaturday = true;
                        if (isSunday) unmatchedMap[empId].hasSunday = true;
                    } else if (status === 'absent') {
                        unmatchedMap[empId].absent++;
                    }
                }
            });

            // 3. Fetch advances from Supabase advance_requests table
            const advanceMap = {};
            try {
                const { data: dbAdvances, error: advError } = await supabase
                    .from('hr_management_advance_requests')
                    .select('id, employee_id, status, type, created_at, starting_month, amount, monthly_deduction, approved_amount, approved_monthly_deduction, remaining_amount');

                if (advError) throw advError;

                (dbAdvances || []).forEach(adv => {
                    const empId = adv.employee_id?.toString().trim().toLowerCase();
                    const status = adv.status?.toString().trim().toLowerCase();
                    if (!empId || (status !== 'approved' && status !== 'received')) return;

                    const type = adv.type?.toString().trim().toLowerCase();

                    if (!advanceMap[empId]) {
                        advanceMap[empId] = {
                            advanceDeduction: 0,
                            fixedAdvanceAmount: 0,
                            fixedAdvanceDeduction: 0,
                            advancesList: []
                        };
                    }

                    const { deduction } = getAdvanceDeductionForPeriod(adv, selectedYear, selectedMonth);

                    if (type === 'advance' || type === 'monthly advance') {
                        advanceMap[empId].advanceDeduction += deduction;
                        advanceMap[empId].advancesList.push({ adv, deduction });
                    } else if (type === 'fix advance' || type === 'fixed advance' || type === 'medical amount' || type === 'fixed advanced' || type === 'fixed amount') {
                        const apprAmount = Number(adv.approved_amount) || Number(adv.amount) || 0;
                        advanceMap[empId].fixedAdvanceAmount += apprAmount;
                        advanceMap[empId].fixedAdvanceDeduction += deduction;
                    }
                });
                setAdvanceMapState(advanceMap);
            } catch (e) {
                console.error("Failed to load advances from Supabase:", e);
            }

            // 3a. Fetch approved payable leaves from Supabase hr_management_leaves table
            const payableLeavesMap = {};
            try {
                const { data: dbLeaves, error: leavesError } = await supabase
                    .from('hr_management_leaves')
                    .select('employee_id, from_date, to_date, leave_type, is_payable, status')
                    .eq('status', 'Approved')
                    .gte('to_date', startDateStr)
                    .lte('from_date', endDateStr);

                if (!leavesError && dbLeaves) {
                    dbLeaves.forEach(leave => {
                        const empId = leave.employee_id?.toString().trim().toLowerCase();
                        if (!empId) return;

                        const isPayable = leave.is_payable === 'Payable' || leave.leave_type === 'Sick Leave';
                        if (!isPayable) return;

                        // Calculate overlapping days within the selected month
                        const leaveFrom = new Date(leave.from_date);
                        const leaveTo = new Date(leave.to_date);
                        const monthStart = new Date(startDateStr);
                        const monthEnd = new Date(endDateStr);

                        const overlapStart = leaveFrom > monthStart ? leaveFrom : monthStart;
                        const overlapEnd = leaveTo < monthEnd ? leaveTo : monthEnd;

                        if (overlapEnd >= overlapStart) {
                            const diffDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;
                            payableLeavesMap[empId] = (payableLeavesMap[empId] || 0) + diffDays;
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to load approved leaves from Supabase:", e);
            }

            // 3b. Fetch saved payroll overrides from Supabase
            const payrollMap = {};
            try {
                const monthStr = monthNames[selectedMonth - 1];
                const { data: dbPayroll, error: payrollError } = await supabase
                    .from('hr_management_payroll')
                    .select('*')
                    .eq('year', selectedYear)
                    .eq('month', monthStr);

                if (payrollError) throw payrollError;

                (dbPayroll || []).forEach(record => {
                    const code = record.employee_id?.toString().trim().toLowerCase();
                    if (code) {
                        payrollMap[code] = record;
                    }
                });
            } catch (e) {
                console.error("Failed to load saved payroll records from Supabase:", e);
            }


            // 4. Build data rows
            const headers = [
                'Name',
                'Salary',
                'Total days',
                'Attendance',
                'Extra Days',
                'Monthly Advance',
                'Fixed Advance',
                'Brakeges',
                'Medical',
                'RTO',
                'Basic salary (Prorated)',
                'Seasonal Bonus',
                'Refferal Bonus',
                'Way Off',
                'Final Salary',
                'Action'
            ];

            const verifiedRows = activeEmployees.map(emp => {
                const empId = emp.employee_id?.toString().trim() || '-';
                const name = emp.name_as_per_aadhar || '-';
                const doj = emp.date_of_joining ? formatDate(emp.date_of_joining) : '-';
                const salary = Number(emp.salary) || 0;

                const empIdLower = empId.toLowerCase();
                const att = attendanceMap[empIdLower] || { present: 0, absent: 0, hasFriday: false, hasSaturday: false, hasSunday: false };
                const originalPresent = att.present;
                const extraDays = (att.hasFriday && att.hasSaturday && att.hasSunday) ? 2 : 0;

                // Load saved overrides
                const savedPayroll = payrollMap[empIdLower];
                const breakageDeduction = savedPayroll ? (Number(savedPayroll.breakage_deduction) || 0) : 0;
                const medicalDeduction = savedPayroll ? (Number(savedPayroll.medical_deduction) || 0) : 0;
                const rtoDeduction = savedPayroll ? (Number(savedPayroll.rto_deduction) || 0) : 0;
                const seasonalBonus = savedPayroll ? (Number(savedPayroll.seasonal_bonus) || 0) : 0;
                const referralBonus = savedPayroll ? (Number(savedPayroll.referral_bonus) || 0) : 0;
                const wayOff = savedPayroll ? (Number(savedPayroll.way_off) || Number(savedPayroll.way_off_deduction) || 0) : 0;

                const present = originalPresent + (payableLeavesMap[empIdLower] || 0);

                const adv = advanceMap[empIdLower] || { advanceDeduction: 0, fixedAdvanceAmount: 0, fixedAdvanceDeduction: 0 };
                const advDeduction = adv.advanceDeduction;
                const fixedAdvBalance = adv.fixedAdvanceAmount || (savedPayroll ? Number(savedPayroll.fixed_advance) || 0 : 0);

                const dailyRate = totalDays > 0 ? salary / totalDays : 0;
                const calculatedProrated = dailyRate * (present + extraDays);
                const proratedSalary = (savedPayroll && savedPayroll.prorated_salary !== null && savedPayroll.prorated_salary !== undefined)
                    ? Number(savedPayroll.prorated_salary)
                    : calculatedProrated;
                const netSalary = Math.round(Math.max(0, proratedSalary - breakageDeduction - medicalDeduction - rtoDeduction + seasonalBonus + referralBonus - advDeduction + wayOff));

                return [
                    empId,                     // 0: Emp ID
                    name,                      // 1: Name
                    salary,                    // 2: Basic salary
                    totalDays,                 // 3: Total days
                    present,                   // 4: Attendance
                    extraDays,                 // 5: Extra 2 days
                    advDeduction,              // 6: Monthly Advance
                    fixedAdvBalance,           // 7: Fixed Advance (NON-EDITABLE)
                    breakageDeduction,         // 8: Brakeges
                    medicalDeduction,          // 9: Medical
                    rtoDeduction,              // 10: RTO
                    proratedSalary,            // 11: Basic salary (Prorated)
                    seasonalBonus,             // 12: Seasonal Bonus
                    referralBonus,             // 13: Refferal Bonus
                    wayOff,                    // 14: Way Off
                    netSalary,                 // 15: Final Salary
                    savedPayroll ? !!savedPayroll.is_verified : false, // 16: isVerified
                    doj,                       // 17: Date of joining
                    originalPresent,           // 18: originalPresent
                    extraDays,                 // 19: originalExtra
                    emp.mobile_no || '',       // 20: mobile_no
                    emp.current_account_no || '', // 21: current_account_no
                    emp.ifsc_code || '',       // 22: ifsc_code
                    emp.beneficiary_name || '', // 23: beneficiary_name
                    emp.joining_company_name || '' // 24: shop_name
                ];
            });

            const unmatchedRows = Object.values(unmatchedMap).map(emp => {
                const empIdLower = emp.id.toLowerCase();
                const savedPayroll = payrollMap[empIdLower];

                const breakageDeduction = savedPayroll ? (Number(savedPayroll.breakage_deduction) || 0) : 0;
                const medicalDeduction = savedPayroll ? (Number(savedPayroll.medical_deduction) || 0) : 0;
                const rtoDeduction = savedPayroll ? (Number(savedPayroll.rto_deduction) || 0) : 0;
                const seasonalBonus = savedPayroll ? (Number(savedPayroll.seasonal_bonus) || 0) : 0;
                const referralBonus = savedPayroll ? (Number(savedPayroll.referral_bonus) || 0) : 0;
                const wayOff = savedPayroll ? (Number(savedPayroll.way_off) || Number(savedPayroll.way_off_deduction) || 0) : 0;

                const present = emp.present + (payableLeavesMap[empIdLower] || 0);
                const extraDays = (emp.hasFriday && emp.hasSaturday && emp.hasSunday) ? 2 : 0;
                const salary = 0;

                const adv = advanceMap[empIdLower] || { advanceDeduction: 0, fixedAdvanceAmount: 0, fixedAdvanceDeduction: 0 };
                const advDeduction = adv.advanceDeduction;
                const fixedAdvBalance = adv.fixedAdvanceAmount || (savedPayroll ? Number(savedPayroll.fixed_advance) || 0 : 0);

                const savedProrated = savedPayroll ? Number(savedPayroll.prorated_salary) : null;
                const proratedSalary = (savedProrated !== null && savedProrated !== undefined && savedPayroll) ? savedProrated : 0;
                const netSalary = Math.round(Math.max(0, proratedSalary - breakageDeduction - medicalDeduction - rtoDeduction + seasonalBonus + referralBonus - advDeduction + wayOff));

                return [
                    emp.id,                    // 0: Emp ID
                    emp.name,                  // 1: Name
                    salary,                    // 2: Basic salary
                    totalDays,                 // 3: Total days
                    present,                   // 4: Attendance
                    extraDays,                 // 5: Extra 2 days
                    advDeduction,              // 6: Monthly Advance
                    fixedAdvBalance,           // 7: Fixed Advance (NON-EDITABLE)
                    breakageDeduction,         // 8: Brakeges
                    medicalDeduction,          // 9: Medical
                    rtoDeduction,              // 10: RTO
                    proratedSalary,            // 11: Basic salary (Prorated)
                    seasonalBonus,             // 12: Seasonal Bonus
                    referralBonus,             // 13: Refferal Bonus
                    wayOff,                    // 14: Way Off
                    netSalary,                 // 15: Final Salary
                    savedPayroll ? !!savedPayroll.is_verified : false, // 16: isVerified
                    '-',                       // 17: Date of joining
                    emp.present,               // 18: originalPresent
                    emp.extra,                 // 19: originalExtra
                    '',                        // 20: mobile_no
                    '',                        // 21: current_account_no
                    '',                        // 22: ifsc_code
                    '',                        // 23: beneficiary_name
                    ''                         // 24: shop_name
                ];
            });

            // Filter active unpaid rows for Salary Sheet and hold rows for Hold Tab
            const activeSalaryVerifiedRows = verifiedRows.filter(r => {
                const rec = payrollMap[r[0]?.toString().toLowerCase().trim()];
                const statusLower = rec?.status?.toString().toLowerCase().trim();
                return !rec || (!rec.is_verified && !rec.is_hold && statusLower !== 'hold');
            });
            const activeSalaryUnmatchedRows = unmatchedRows.filter(r => {
                const rec = payrollMap[r[0]?.toString().toLowerCase().trim()];
                const statusLower = rec?.status?.toString().toLowerCase().trim();
                return !rec || (!rec.is_verified && !rec.is_hold && statusLower !== 'hold');
            });

            const holdVerifiedRows = verifiedRows.filter(r => {
                const rec = payrollMap[r[0]?.toString().toLowerCase().trim()];
                const statusLower = rec?.status?.toString().toLowerCase().trim();
                return rec && !rec.is_verified && (rec.is_hold || statusLower === 'hold');
            });
            const holdUnmatchedRows = unmatchedRows.filter(r => {
                const rec = payrollMap[r[0]?.toString().toLowerCase().trim()];
                const statusLower = rec?.status?.toString().toLowerCase().trim();
                return rec && !rec.is_verified && (rec.is_hold || statusLower === 'hold');
            });

            const allSalaryRows = [...activeSalaryVerifiedRows, ...activeSalaryUnmatchedRows];
            const allHoldRows = [...holdVerifiedRows, ...holdUnmatchedRows];

            const salaryHeaders = headers.filter(h => h !== 'Action');
            setSalaryData({ headers: salaryHeaders, rows: allSalaryRows });
            setHoldData({ headers: salaryHeaders, rows: allHoldRows });
        } catch (err) {
            setError("Failed to fetch payroll: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch payout history from Supabase hr_management_payroll table
    const fetchHistoryData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: dbPayroll, error: payrollError } = await supabase
                .from('hr_management_payroll')
                .select('*')
                .eq('year', selectedYear)
                .eq('month', monthNames[selectedMonth - 1])
                .eq('is_verified', true)
                .order('created_at', { ascending: false });

            if (payrollError) throw payrollError;

            // Fetch employee names and shop to map employee_id
            const { data: dbEmp } = await supabase
                .from('hr_management_employees')
                .select('employee_id, name_as_per_aadhar, joining_company_name');

            const empNameMap = {};
            const empShopMap = {};
            (dbEmp || []).forEach(e => {
                if (e.employee_id) {
                    const key = e.employee_id.trim().toLowerCase();
                    empNameMap[key] = e.name_as_per_aadhar;
                    empShopMap[key] = e.joining_company_name;
                }
            });

            const headers = [
                'Emp ID',
                'Name',
                'Month',
                'Year',
                'Salary',
                'Total Days',
                'Present',
                'Extra Days',
                'Monthly Advance',
                'Fixed Advance',
                'Breakage',
                'Medical',
                'RTO',
                'Prorated Salary',
                'Seasonal Bonus',
                'Referral Bonus',
                'Way Off',
                'Net Salary',
                'Saved Date',
                'Action'
            ];

            const rows = (dbPayroll || []).map(r => {
                const empKey = r.employee_id?.trim().toLowerCase();
                return [
                    r.employee_id,
                    empNameMap[empKey] || r.employee_id,
                    r.month,
                    r.year,
                    r.salary,
                    r.total_month_days,
                    r.total_present,
                    r.extra_days,
                    r.advance_deduction,
                    r.fixed_advance || 0,
                    r.breakage_deduction,
                    r.medical_deduction,
                    r.rto_deduction,
                    r.prorated_salary,
                    r.seasonal_bonus,
                    r.referral_bonus,
                    r.way_off || r.way_off_deduction || 0,
                    r.net_salary,
                    formatDate(r.created_at),
                    {
                        type: 'action',
                        empId: r.employee_id,
                        name: empNameMap[empKey] || r.employee_id,
                        month: r.month,
                        year: r.year,
                        salary: r.salary,
                        totalDays: r.total_month_days,
                        present: r.total_present,
                        extraDays: r.extra_days,
                        advance: r.advance_deduction,
                        fixedAdv: r.fixed_advance || 0,
                        breakage: r.breakage_deduction,
                        medical: r.medical_deduction,
                        rto: r.rto_deduction,
                        prorated: r.prorated_salary,
                        seasonal: r.seasonal_bonus,
                        referral: r.referral_bonus,
                        wayOff: r.way_off || r.way_off_deduction || 0,
                        netSalary: r.net_salary,
                        shopName: r.shop_name || empShopMap[empKey] || ''
                    },
                    r.shop_name || empShopMap[empKey] || '' // 20: shop_name
                ];
            });

            setHistoryData({ headers, rows });
        } catch (err) {
            setError("Failed to fetch history records: " + err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setCurrentPage(1);
        setSelectedEmpIds(new Set());
        if (activeTab === 'salary' || activeTab === 'hold') {
            fetchPayrollData();
        } else {
            fetchHistoryData();
        }
    }, [activeTab, selectedMonth, selectedYear, searchTerm]);



    // 1. Update Employee Records: Only updates values in hr_management_employees & draft payroll without sending to payment history or generating payroll
    const handleSavePayrollToDB = async (singleRow = null) => {
        const rowsToProcess = singleRow
            ? [singleRow]
            : (salaryData.rows.filter(row => selectedEmpIds.has(row[0]?.toString())).length > 0
                ? salaryData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()))
                : salaryData.rows);

        if (!rowsToProcess || rowsToProcess.length === 0) {
            toast.error("No payroll records to save.");
            return;
        }

        setIsSavingToDB(true);
        try {
            let updatedCount = 0;
            const monthStr = monthNames[selectedMonth - 1];

            for (const row of rowsToProcess) {
                const empId = row[0]?.toString() || '';
                const basicSalary = Number(row[2]) || 0;
                if (!empId || empId === '-') continue;

                // Update basic salary in hr_management_employees
                await supabase
                    .from('hr_management_employees')
                    .update({ salary: basicSalary })
                    .eq('employee_id', empId);

                // Save draft parameters into hr_management_payroll without sending to payment history (is_verified: false)
                const draftRecord = {
                    employee_id: empId,
                    year: Number(selectedYear),
                    month: monthStr,
                    total_month_days: Number(row[3]) || 0,
                    total_present: Number(row[4]) || 0,
                    extra_days: Number(row[5]) || 0,
                    salary: Number(row[2]) || 0,
                    advance_deduction: Number(row[6]) || 0,
                    fixed_advance_amount: Number(row[7]) || 0,
                    breakage_deduction: Number(row[8]) || 0,
                    medical_deduction: Number(row[9]) || 0,
                    rto_deduction: Number(row[10]) || 0,
                    prorated_salary: Number(row[11]) || 0,
                    seasonal_bonus: Number(row[12]) || 0,
                    referral_bonus: Number(row[13]) || 0,
                    way_off: Number(row[14]) || 0,
                    way_off_deduction: Number(row[14]) || 0,
                    net_salary: Number(row[15]) || 0,
                    is_verified: false
                };

                const { error: draftErr } = await supabase
                    .from('hr_management_payroll')
                    .upsert(draftRecord, { onConflict: 'employee_id,year,month' });

                if (draftErr) {
                    console.error(`Failed to save draft for employee ${empId}:`, draftErr);
                    throw draftErr;
                }

                updatedCount++;
            }

            toast.success(`Successfully saved employee record for ${updatedCount} employee(s)!`);
            setSelectedEmpIds(new Set());
            fetchPayrollData();
        } catch (e) {
            console.error(e);
            toast.error(`Failed to update employee records: ${e.message}`);
        } finally {
            setIsSavingToDB(false);
        }
    };

    // 2. Mark as Paid: Prompts for shop selection in a single modal, then generates payroll with chosen shop_name
    const handleMarkAsPaid = async (singleRow = null) => {
        const sourceData = activeTab === 'hold' ? holdData : salaryData;
        const rowsToProcess = singleRow
            ? [singleRow]
            : (sourceData.rows.filter(row => selectedEmpIds.has(row[0]?.toString())).length > 0
                ? sourceData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()))
                : sourceData.rows);

        if (!rowsToProcess || rowsToProcess.length === 0) {
            toast.error("No payroll records to mark as paid.");
            return;
        }

        setPendingPaidRows(rowsToProcess);
        setModalShopSelection(shopsList[0] || '');
        setShowMarkAsPaidModal(true);
    };

    const confirmMarkAsPaidWithShop = async () => {
        if (!pendingPaidRows || pendingPaidRows.length === 0) return;
        const chosenShop = modalShopSelection?.trim() || '';

        setIsSavingToDB(true);
        try {
            const monthStr = monthNames[selectedMonth - 1];

            const payrollRecords = pendingPaidRows.map(row => ({
                employee_id: row[0]?.toString() || '',
                year: Number(selectedYear),
                month: monthStr,
                total_month_days: Number(row[3]) || 0,
                total_present: Number(row[4]) || 0,
                extra_days: Number(row[5]) || 0,
                salary: Number(row[2]) || 0,
                advance_deduction: Number(row[6]) || 0,
                fixed_advance_amount: Number(row[7]) || 0,
                breakage_deduction: Number(row[8]) || 0,
                medical_deduction: Number(row[9]) || 0,
                rto_deduction: Number(row[10]) || 0,
                prorated_salary: Number(row[11]) || 0,
                seasonal_bonus: Number(row[12]) || 0,
                referral_bonus: Number(row[13]) || 0,
                way_off: Number(row[14]) || 0,
                way_off_deduction: Number(row[14]) || 0,
                net_salary: Number(row[15]) || 0,
                shop_name: chosenShop,
                is_verified: true,
                is_hold: false,
                status: 'paid'
            }));

            const { error } = await supabase
                .from('hr_management_payroll')
                .upsert(payrollRecords, { onConflict: 'employee_id,year,month' });

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
                    toast.error("Database table 'hr_management_payroll' does not exist.");
                    setShowSchemaModal(true);
                } else if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist')) {
                    toast.error("Database table 'hr_management_payroll' is missing some columns.");
                    setShowSchemaModal(true);
                } else {
                    throw error;
                }
            } else {
                // Update remaining_amount in hr_management_advance_requests for deducted advances
                for (const row of pendingPaidRows) {
                    const empIdLower = row[0]?.toString().toLowerCase().trim();
                    const advInfo = advanceMapState[empIdLower];
                    if (advInfo && advInfo.advancesList && advInfo.advancesList.length > 0) {
                        for (const { adv, deduction } of advInfo.advancesList) {
                            if (deduction > 0 && adv.id) {
                                const currentRem = adv.remaining_amount !== null && adv.remaining_amount !== undefined
                                    ? Number(adv.remaining_amount)
                                    : (Number(adv.approved_amount) || Number(adv.amount) || 0);
                                const newRem = Math.max(0, currentRem - deduction);
                                const updatePayload = { remaining_amount: newRem };
                                if (newRem === 0) {
                                    updatePayload.status = 'Received';
                                }
                                await supabase
                                    .from('hr_management_advance_requests')
                                    .update(updatePayload)
                                    .eq('id', adv.id);
                            }
                        }
                    }
                }
                toast.success(`Successfully marked ${payrollRecords.length} record(s) as Paid & generated payroll!`);
                setSelectedEmpIds(new Set());
                fetchPayrollData();
            }
        } catch (e) {
            console.error(e);
            toast.error(`Failed to mark as paid: ${e.message}`);
        } finally {
            setIsSavingToDB(false);
            setShowMarkAsPaidModal(false);
            setPendingPaidRows([]);
        }
    };

    // 3. Mark as Hold: Sends selected employee data row to Hold tab
    const handleMarkAsHold = async (singleRow = null) => {
        const sourceData = activeTab === 'hold' ? holdData : salaryData;
        const rowsToProcess = singleRow
            ? [singleRow]
            : (sourceData.rows.filter(row => selectedEmpIds.has(row[0]?.toString())).length > 0
                ? sourceData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()))
                : sourceData.rows);

        if (!rowsToProcess || rowsToProcess.length === 0) {
            toast.error("No payroll records selected to mark as hold.");
            return;
        }

        if (!window.confirm(`Mark ${rowsToProcess.length} employee record(s) as Hold?`)) return;

        setIsSavingToDB(true);
        try {
            const monthStr = monthNames[selectedMonth - 1];

            const payrollRecords = rowsToProcess.map(row => ({
                employee_id: row[0]?.toString() || '',
                year: Number(selectedYear),
                month: monthStr,
                total_month_days: Number(row[3]) || 0,
                total_present: Number(row[4]) || 0,
                extra_days: Number(row[5]) || 0,
                salary: Number(row[2]) || 0,
                advance_deduction: Number(row[6]) || 0,
                fixed_advance: Number(row[7]) || 0,
                fixed_advance_amount: Number(row[7]) || 0,
                breakage_deduction: Number(row[8]) || 0,
                medical_deduction: Number(row[9]) || 0,
                rto_deduction: Number(row[10]) || 0,
                prorated_salary: Number(row[11]) || 0,
                seasonal_bonus: Number(row[12]) || 0,
                referral_bonus: Number(row[13]) || 0,
                way_off: Number(row[14]) || 0,
                way_off_deduction: Number(row[14]) || 0,
                net_salary: Number(row[15]) || 0,
                is_verified: false,
                is_hold: true,
                status: 'hold'
            }));

            const { error } = await supabase
                .from('hr_management_payroll')
                .upsert(payrollRecords, { onConflict: 'employee_id,year,month' });

            if (error) {
                console.error("Supabase upsert error in hold:", error);
                throw error;
            }

            toast.success(`Successfully marked ${payrollRecords.length} record(s) as Hold!`);
            setSelectedEmpIds(new Set());
            fetchPayrollData();
        } catch (e) {
            console.error(e);
            toast.error(`Failed to mark as hold: ${e.message}`);
        } finally {
            setIsSavingToDB(false);
        }
    };

    // 4. Unhold: Moves held records back to active Salary Sheet
    const handleUnhold = async (singleRow = null) => {
        const rowsToProcess = singleRow
            ? [singleRow]
            : (holdData.rows.filter(row => selectedEmpIds.has(row[0]?.toString())).length > 0
                ? holdData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()))
                : holdData.rows);

        if (!rowsToProcess || rowsToProcess.length === 0) {
            toast.error("No payroll records selected to unhold.");
            return;
        }

        setIsSavingToDB(true);
        try {
            const monthStr = monthNames[selectedMonth - 1];

            for (const row of rowsToProcess) {
                const empId = row[0]?.toString() || '';
                if (!empId || empId === '-') continue;

                await supabase
                    .from('hr_management_payroll')
                    .update({ is_hold: false, status: 'pending' })
                    .eq('employee_id', empId)
                    .eq('year', Number(selectedYear))
                    .eq('month', monthStr);
            }

            toast.success(`Successfully un-held ${rowsToProcess.length} record(s) and restored to Salary Sheet!`);
            setSelectedEmpIds(new Set());
            fetchPayrollData();
        } catch (e) {
            console.error(e);
            toast.error(`Failed to unhold record(s): ${e.message}`);
        } finally {
            setIsSavingToDB(false);
        }
    };

    // Export current view table to Excel
    const handleExportExcel = () => {
        const data = activeTab === 'salary' ? salaryData : historyData;
        if (!data || !data.rows.length) {
            toast.error("No data to export.");
            return;
        }

        const selectedRows = data.rows.filter(row => selectedEmpIds.has(row[0]?.toString()));
        const targetRows = selectedRows.length > 0 ? selectedRows : data.rows;

        const cleanRows = activeTab === 'salary'
            ? targetRows.map(row => row.slice(1, data.headers.length + 1))
            : targetRows;

        const ws = XLSX.utils.aoa_to_sheet([data.headers, ...cleanRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeTab === 'salary' ? 'Salary Sheet' : 'Payout History');

        const fileName = activeTab === 'salary'
            ? `payroll_salary_sheet_${selectedYear}_${selectedMonth}.xlsx`
            : `payroll_history_${new Date().toISOString().split('T')[0]}.xlsx`;

        XLSX.writeFile(wb, fileName);
        toast.success("Excel exported successfully!");
    };

    // Export bank transfer details as CSV matching specified template
    const handleExportBankCSV = () => {
        if (!salaryData?.rows?.length) {
            toast.error("No payroll data to export.");
            return;
        }

        const selectedRows = salaryData.rows.filter(row => selectedEmpIds.has(row[0]?.toString()));
        const targetRows = selectedRows.length > 0 ? selectedRows : salaryData.rows;

        const headers = [
            'Client_Code', 'Product_Code', 'Payment_Type', 'Payment_Ref_No.', 'Payment_Date', 'Instrument Date',
            'Dr_Ac_No', 'Amount', 'Bank_Code_Indicator', 'Beneficiary_Code', 'Beneficiary_Name', 'Beneficiary_Bank',
            'Beneficiary_Branch / IFSC Code', 'Beneficiary_Acc_No', 'Location', 'Print_Location', 'Instrument_Number',
            'Ben_Add1', 'Ben_Add2', 'Ben_Add3', 'Ben_Add4', 'Beneficiary_Email', 'Beneficiary_Mobile',
            'Debit_Narration', 'Credit_Narration', 'Payment Details 1', 'Payment Details 2', 'Payment Details 3',
            'Payment Details 4', 'Enrichment_1', 'Enrichment_2', 'Enrichment_3', 'Enrichment_4', 'Enrichment_5',
            'Enrichment_6', 'Enrichment_7', 'Enrichment_8', 'Enrichment_9', 'Enrichment_10', 'Enrichment_11',
            'Enrichment_12', 'Enrichment_13', 'Enrichment_14', 'Enrichment_15', 'Enrichment_16', 'Enrichment_17',
            'Enrichment_18', 'Enrichment_19', 'Enrichment_20'
        ];

        const csvLines = [headers.join(',')];

        targetRows.forEach(row => {
            const amount = row[15] || 0;
            const beneficiaryName = row[23] || row[1] || '';
            const ifscCode = row[22] || '';
            const accNo = row[21] || '';
            const mobileNo = row[20] || '';
            const debitNarration = `${beneficiaryName} Salary`;

            // Build output line matching columns array index sequence
            const line = Array(headers.length).fill('');
            line[7] = amount;                                                             // Amount (column 8)
            line[10] = beneficiaryName ? `"${beneficiaryName.replace(/"/g, '""')}"` : ''; // Beneficiary_Name (column 11)
            line[12] = ifscCode ? `"${ifscCode.replace(/"/g, '""')}"` : '';               // Beneficiary_Branch / IFSC Code (column 13)
            line[13] = accNo ? `"${accNo.replace(/"/g, '""')}"` : '';                     // Beneficiary_Acc_No (column 14)
            line[22] = mobileNo ? `"${mobileNo.replace(/"/g, '""')}"` : '';               // Beneficiary_Mobile (column 23)
            line[23] = debitNarration ? `"${debitNarration.replace(/"/g, '""')}"` : '';   // Debit_Narration (column 24)

            csvLines.push(line.join(','));
        });

        // Generate download
        const blob = new Blob([csvLines.join("\r\n")], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `payroll_bank_transfer_${selectedYear}_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Bank CSV exported successfully!");
    };

    // Filter and dynamically sort rows based on search input, selected shop, and sortOrder state
    const getSortedAndFilteredRows = (data) => {
        if (!data || !data.rows) return [];

        let filtered = data.rows.filter(row => {
            const matchesSearch = row.some(cell => cell && typeof cell !== 'object' && cell.toString().toLowerCase().includes(searchTerm.toLowerCase()));
            const shopVal = activeTab === 'history' ? (row[20] || '') : (row[24] || '');
            const matchesShop = selectedShop === 'ALL' || !selectedShop || shopVal.toString().trim().toLowerCase() === selectedShop.trim().toLowerCase();
            return matchesSearch && matchesShop;
        });

        if (activeTab === 'salary' && sortOrder !== 'DEFAULT') {
            filtered = [...filtered].sort((a, b) => {
                const idA = (a[0] || '').toString().trim();
                const idB = (b[0] || '').toString().trim();
                const comparison = idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
                return sortOrder === 'ASC' ? comparison : -comparison;
            });
        }
        return filtered;
    };

    // Calculate Summary Totals based on filtered rows
    const currentDataSet = activeTab === 'salary' ? salaryData : activeTab === 'hold' ? holdData : historyData;
    const filteredRowsForSummary = getSortedAndFilteredRows(currentDataSet);
    const totalEmployeesCount = filteredRowsForSummary.length;
    const totalBaseSalarySum = filteredRowsForSummary.reduce((sum, row) => sum + (Number(row[2]) || 0), 0);
    const totalNetPayableSum = filteredRowsForSummary.reduce((sum, row) => sum + (Number(row[15]) || 0), 0);
    const totalDeductionsSum = filteredRowsForSummary.reduce((sum, row) => sum + (Number(row[6]) || 0) + (Number(row[8]) || 0) + (Number(row[9]) || 0) + (Number(row[10]) || 0) + (Number(row[14]) || 0), 0);

    // Pagination variables
    const pageSize = 15;
    const currentData = currentDataSet;
    const filteredRows = getSortedAndFilteredRows(currentData);
    const totalPages = Math.ceil(filteredRows.length / pageSize);
    const activePage = Math.min(currentPage, Math.max(1, totalPages));
    const paginatedRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);

    const renderPagination = () => {
        if (totalPages <= 1) return null;
        return (
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                <div className="text-gray-500">
                    Showing <span className="font-semibold">{(activePage - 1) * pageSize + 1}</span> to <span className="font-semibold">{Math.min(activePage * pageSize, filteredRows.length)}</span> of <span className="font-semibold">{filteredRows.length}</span> records
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={activePage === 1}
                        onClick={() => setCurrentPage(activePage - 1)}
                        className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold rounded shadow-sm cursor-pointer"
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
                                            className={`px-2.5 py-1.5 font-semibold rounded border transition-all cursor-pointer ${activePage === page
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
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
                        className="px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold rounded shadow-sm cursor-pointer"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

    const handleManualInputChange = (empId, colIndex, val) => {
        const numVal = val === '' ? 0 : Number(val);
        const empIdLower = empId?.toString().toLowerCase();

        const updateState = prev => {
            const updatedRows = prev.rows.map(r => {
                if (r[0]?.toString().toLowerCase() === empIdLower) {
                    const newRow = [...r];
                    newRow[colIndex] = numVal;

                    if (colIndex === 5) {
                        // Recalculate Prorated Salary when Extra Days changes
                        const salary = Number(newRow[2]) || 0;
                        const totalDays = Number(newRow[3]) || 30;
                        const present = Number(newRow[4]) || 0;
                        const extraDays = numVal;
                        const dailyRate = totalDays > 0 ? salary / totalDays : 0;
                        newRow[11] = Math.round(dailyRate * (present + extraDays));
                    }

                    // Recalculate Final Salary
                    // Index 11: prorated salary, Index 12: seasonal bonus, Index 13: referral bonus
                    // Index 6: monthly advance, Index 8: breakage, Index 9: medical, Index 10: RTO, Index 14: way off
                    const prorated = Number(newRow[11]) || 0;
                    const seasonal = Number(newRow[12]) || 0;
                    const referral = Number(newRow[13]) || 0;
                    const advance = Number(newRow[6]) || 0;
                    const breakage = Number(newRow[8]) || 0;
                    const medical = Number(newRow[9]) || 0;
                    const rto = Number(newRow[10]) || 0;
                    const wayOff = Number(newRow[14]) || 0;

                    newRow[15] = Math.round(Math.max(0, prorated - breakage - medical - rto + seasonal + referral - advance + wayOff));
                    return newRow;
                }
                return r;
            });
            return { ...prev, rows: updatedRows };
        };

        if (activeTab === 'hold') {
            setHoldData(updateState);
        } else {
            setSalaryData(updateState);
        }
    };

    return (
        <div className="p-8 pt-4 w-full max-w-full overflow-x-hidden">
            {/* Header Area */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <DollarSign size={24} className="text-indigo-600" />
                        Payroll Management
                    </h1>
                    <p className="text-gray-500 text-xs mt-0.5">
                        Dynamic payroll generated directly from employees table and attendance monthly database logs
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search records..."
                            className="pl-9 pr-3 py-1.5 border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-60 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Column Checklist Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnDropdown(prev => !prev)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-slate-700 font-semibold text-xs hover:bg-gray-50 transition-colors rounded shadow-xs cursor-pointer"
                        >
                            <Columns size={14} className="text-gray-500" />
                            Select Columns
                            <ChevronDown size={12} className="text-gray-400" />
                        </button>
                        {showColumnDropdown && (
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Toggle Columns</span>
                                    <button
                                        onClick={() => setHiddenColumns(new Set())}
                                        className="text-[10px] text-indigo-600 font-bold hover:underline"
                                    >
                                        Select All
                                    </button>
                                </div>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1.5">
                                    {(activeTab === 'salary' ? salaryData.headers : activeTab === 'hold' ? holdData.headers : historyData.headers).map(col => {
                                        const isHidden = hiddenColumns.has(col);
                                        return (
                                            <label key={col} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={!isHidden}
                                                    onChange={(e) => {
                                                        const next = new Set(hiddenColumns);
                                                        if (e.target.checked) next.delete(col);
                                                        else next.add(col);
                                                        setHiddenColumns(next);
                                                    }}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                />
                                                <span>{col}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {(activeTab === 'salary' || activeTab === 'hold') && (
                        <div className="relative">
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-1.5 border border-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold text-slate-700 rounded cursor-pointer"
                            >
                                <option value="ASC">Sort: ID Ascending</option>
                                <option value="DESC">Sort: ID Descending</option>
                                <option value="DEFAULT">Sort: Default</option>
                            </select>
                            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        </div>
                    )}
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium text-xs transition-colors rounded shadow-sm cursor-pointer"
                    >
                        <Download size={14} />
                        Export Excel
                    </button>
                    {(activeTab === 'salary' || activeTab === 'hold') && (
                        <button
                            onClick={handleExportBankCSV}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-xs transition-colors rounded shadow-sm cursor-pointer"
                        >
                            <Download size={14} />
                            Export Bank CSV
                        </button>
                    )}
                    {(activeTab === 'salary' || activeTab === 'hold') && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchPayrollData}
                                disabled={loading}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors rounded disabled:opacity-50 shadow-sm cursor-pointer"
                            >
                                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                                {loading ? 'Refreshing...' : 'Refresh'}
                            </button>
                            {activeTab === 'hold' && (
                                <button
                                    onClick={() => handleUnhold()}
                                    disabled={isSavingToDB || !holdData?.rows?.length}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs transition-colors rounded disabled:opacity-50 shadow-sm cursor-pointer"
                                    title="Move held records back to active Salary Sheet"
                                >
                                    {isSavingToDB ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    Unhold Selected
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Stats Panels */}
            {(activeTab === 'salary' || activeTab === 'hold') && !loading && currentDataSet.rows?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Active Employees</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">{totalEmployeesCount}</p>
                            </div>
                            <div className="p-2 bg-indigo-50 rounded">
                                <Users size={16} className="text-indigo-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total Base Salary</p>
                                <p className="text-xl font-bold text-slate-800 mt-1">₹{totalBaseSalarySum.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-blue-50 rounded">
                                <DollarSign size={16} className="text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Advance Deductions</p>
                                <p className="text-xl font-bold text-orange-600 mt-1">₹{totalDeductionsSum.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-orange-50 rounded">
                                <TrendingUp size={16} className="text-orange-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border-b border-l border-gray-200 p-4 ">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Total Net Payable</p>
                                <p className="text-xl font-bold text-green-600 mt-1">₹{totalNetPayableSum.toLocaleString()}</p>
                            </div>
                            <div className="p-2 bg-green-50 rounded">
                                <DollarSign size={16} className="text-green-600" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs & Date Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-gray-200 mb-5">
                <div className="flex gap-4">
                    <button
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all ${activeTab === 'salary'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('salary')}
                    >
                        Salary Sheet
                    </button>
                    <button
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all ${activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('history')}
                    >
                        Payment History
                    </button>
                    <button
                        className={`pb-2.5 px-1 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${activeTab === 'hold'
                            ? 'border-amber-500 text-amber-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        onClick={() => setActiveTab('hold')}
                    >
                        <Bookmark size={14} className={holdData.rows?.length > 0 ? "text-amber-500 fill-amber-500" : ""} />
                        Hold Tab {holdData.rows?.length > 0 && `(${holdData.rows.length})`}
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pb-2">
                    <div className="flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded shadow-2xs">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Shop:</span>
                        <select
                            value={selectedShop}
                            onChange={(e) => {
                                setSelectedShop(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer max-w-[150px] truncate"
                        >
                            <option value="ALL">All Shops</option>
                            {shopsList.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    {(activeTab === 'salary' || activeTab === 'hold') && (
                        <>
                            <div className="flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Month:</span>
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                                    className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
                                >
                                    {monthNames.map((m, idx) => (
                                        <option key={m} value={idx + 1}>{m}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-1 bg-white border border-gray-200 px-2.5 py-1 rounded shadow-2xs">
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Year:</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="text-xs bg-transparent focus:outline-none font-semibold text-slate-800 cursor-pointer"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Dynamic Grid / Table */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-xs">Loading payroll and attendance details...</span>
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 p-6 text-center rounded">
                    <p className="text-red-600 text-xs mb-3">{error}</p>
                    <button
                        onClick={() => activeTab === 'salary' ? fetchPayrollData() : fetchHistoryData()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors font-medium"
                    >
                        Retry
                    </button>
                </div>
            ) : (
                <div className="bg-white border border-gray-200  overflow-hidden max-w-full">
                    {(activeTab === 'salary' || activeTab === 'hold') && selectedEmpIds.size > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center">
                                    <Pencil size={12} className="animate-pulse" />
                                </div>
                                <span className="text-xs font-semibold text-indigo-900">
                                    {selectedEmpIds.size} row(s) selected
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                {activeTab === 'salary' && (
                                    <button
                                        onClick={() => handleSavePayrollToDB()}
                                        disabled={isSavingToDB}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors rounded shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {isSavingToDB ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                        Update Record
                                    </button>
                                )}
                                {activeTab === 'hold' && (
                                    <button
                                        onClick={() => handleUnhold()}
                                        disabled={isSavingToDB}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs transition-colors rounded shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {isSavingToDB ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                        Unhold
                                    </button>
                                )}
                                {activeTab !== 'hold' && (
                                    <button
                                        onClick={() => handleMarkAsHold()}
                                        disabled={isSavingToDB}
                                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-colors rounded shadow-sm cursor-pointer disabled:opacity-50"
                                    >
                                        {isSavingToDB ? <Loader2 size={12} className="animate-spin" /> : <Bookmark size={12} />}
                                        Mark as Hold
                                    </button>
                                )}
                                <button
                                    onClick={() => handleMarkAsPaid()}
                                    disabled={isSavingToDB}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors rounded shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingToDB ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                    Mark as Paid
                                </button>
                                <button
                                    onClick={() => setSelectedEmpIds(new Set())}
                                    className="text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer ml-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="overflow-x-auto max-h-[61vh] scrollbar-thin max-w-full">
                        <table className="w-full min-w-[1400px] text-xs text-left border-collapse">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    {(activeTab === 'salary' || activeTab === 'hold') && (
                                        <th className="px-4 py-2.5 font-semibold text-gray-600 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={paginatedRows.length > 0 && paginatedRows.every(row => selectedEmpIds.has(row[0]?.toString()))}
                                                onChange={(e) => {
                                                    const newSelected = new Set(selectedEmpIds);
                                                    paginatedRows.forEach(row => {
                                                        const id = row[0]?.toString();
                                                        if (id) {
                                                            if (e.target.checked) {
                                                                newSelected.add(id);
                                                            } else {
                                                                newSelected.delete(id);
                                                            }
                                                        }
                                                    });
                                                    setSelectedEmpIds(newSelected);
                                                }}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </th>
                                    )}
                                    <th className="px-4 py-2.5 font-semibold text-gray-600 w-12 text-center">S.no</th>
                                    {(activeTab === 'salary' ? salaryData.headers : activeTab === 'hold' ? holdData.headers : historyData.headers)
                                        .filter(header => !hiddenColumns.has(header))
                                        .map((header, idx) => (
                                            <th key={idx} className="px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap text-center">
                                                {header}
                                            </th>
                                        ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-medium">
                                {paginatedRows.map((row, idx) => {
                                    const headersList = activeTab === 'salary' ? salaryData.headers : activeTab === 'hold' ? holdData.headers : historyData.headers;
                                    const cleanRow = row.slice(0, headersList.length);
                                    const isVerified = (activeTab === 'salary' || activeTab === 'hold') ? row[15] !== false : true;
                                    const cellsToRender = (activeTab === 'salary' || activeTab === 'hold')
                                        ? headersList.map((header, j) => ({ header, cell: row[j + 1] }))
                                        : cleanRow.map((cell, j) => ({ header: headersList[j], cell }));

                                    return (
                                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                            {(activeTab === 'salary' || activeTab === 'hold') && (
                                                <td className="px-4 py-2.5 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEmpIds.has(row[0]?.toString())}
                                                        onChange={(e) => {
                                                            const newSelected = new Set(selectedEmpIds);
                                                            const id = row[0]?.toString();
                                                            if (id) {
                                                                if (e.target.checked) {
                                                                    newSelected.add(id);
                                                                } else {
                                                                    newSelected.delete(id);
                                                                }
                                                            }
                                                            setSelectedEmpIds(newSelected);
                                                        }}
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-2.5 text-center text-gray-400 font-mono border-r border-gray-100">{(activePage - 1) * pageSize + idx + 1}</td>
                                            {cellsToRender
                                                .filter(({ header }) => !hiddenColumns.has(header))
                                                .map(({ header, cell }, j) => {
                                                    const headerName = header?.toLowerCase() || '';

                                                    // Highlight cells based on their data type
                                                    let cellClass = "px-4 py-2.5 text-slate-700 font-sans text-center";
                                                    let content = cell;

                                                    const isCurrency = headerName === 'salary' ||
                                                        headerName === 'basic salary' ||
                                                        headerName === 'basic salary (prorated)' ||
                                                        headerName === 'advance' ||
                                                        headerName === 'monthly advance' ||
                                                        headerName === 'fixed advance' ||
                                                        headerName === 'fix advance' ||
                                                        headerName === 'brakeges' ||
                                                        headerName === 'medical' ||
                                                        headerName === 'rto' ||
                                                        headerName === 'way off' ||
                                                        headerName === 'seasonal bonus' ||
                                                        headerName === 'refferal bonus';

                                                    if (headerName === 'emp id' || headerName.includes('id')) {
                                                        cellClass = "px-4 py-2.5 font-mono text-gray-500 font-medium text-center border-r border-gray-100";
                                                    } else if (headerName === 'final salary') {
                                                        cellClass = "px-4 py-2.5 text-green-600 font-bold font-mono text-right";
                                                        content = `₹${Math.round(Number(cell) || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                                                    } else if (isCurrency) {
                                                        cellClass = "px-4 py-2.5 font-mono text-slate-600 text-right";
                                                        content = cell > 0 ? `₹${Number(cell).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}` : '-';
                                                    } else if (headerName === 'attendance' || headerName === 'extra days' || headerName === 'extra 2 days') {
                                                        cellClass = "px-4 py-2.5 text-indigo-600 font-bold text-center";
                                                    } else if (headerName === 'total days') {
                                                        cellClass = "px-4 py-2.5 text-center text-slate-500 font-mono";
                                                    }

                                                    if (headerName === 'name') {
                                                        cellClass = "px-4 py-2.5 text-slate-700 font-sans text-left";
                                                        content = (
                                                            <div className="flex flex-col">
                                                                <span>{cell}</span>
                                                                {!isVerified && (
                                                                    <span className="text-[9px] text-amber-600 font-semibold block mt-0.5">⚠️ Unverified</span>
                                                                )}
                                                            </div>
                                                        );
                                                    } else if (headerName === 'extra days' || headerName === 'extra 2 days') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '0' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 5, e.target.value)}
                                                                className="w-16 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-center font-bold text-xs bg-white text-indigo-600 disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'monthly advance') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 6, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'fixed advance') {
                                                        cellClass = "px-4 py-2.5 font-mono text-slate-600 text-right";
                                                        content = cell > 0 ? `₹${Number(cell).toLocaleString()}` : '-';
                                                    } else if (headerName === 'brakeges') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 8, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'medical') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 9, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'rto') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 10, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'basic salary (prorated)') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 11, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'seasonal bonus') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 12, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'refferal bonus') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 13, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'way off') {
                                                        cellClass = "px-4 py-2.5 text-center";
                                                        content = (
                                                            <input
                                                                type="number"
                                                                disabled={!selectedEmpIds.has(row[0]?.toString())}
                                                                value={cell === 0 ? '' : cell}
                                                                placeholder="0"
                                                                onChange={(e) => handleManualInputChange(row[0], 14, e.target.value)}
                                                                className="w-24 px-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded text-right font-mono text-xs bg-white text-slate-700 font-semibold disabled:opacity-50 disabled:bg-gray-50"
                                                            />
                                                        );
                                                    } else if (headerName === 'action') {
                                                        cellClass = "px-4 py-2.5 text-center whitespace-nowrap";
                                                        if (typeof cell === 'object' && cell !== null && cell.type === 'action') {
                                                            content = (
                                                                <button
                                                                    onClick={() => setSelectedPayslip(cell)}
                                                                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] rounded transition-colors flex items-center gap-1.5 mx-auto cursor-pointer shadow-2xs"
                                                                >
                                                                    <FileText size={12} />
                                                                    View PDF
                                                                </button>
                                                            );
                                                        } else {
                                                            content = (
                                                                <div className="flex items-center justify-center gap-1.5 hide">
                                                                    {/* {activeTab === 'salary' && (
                                                                    <button
                                                                        onClick={() => handleSavePayrollToDB(row)}
                                                                        disabled={isSavingToDB}
                                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] rounded border border-indigo-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                        title="Update basic salary & employee record"
                                                                    >
                                                                        <Save size={11} />
                                                                        Save
                                                                    </button>
                                                                )} */}
                                                                    {activeTab === 'hold' && (
                                                                        <button
                                                                            onClick={() => handleUnhold(row)}
                                                                            disabled={isSavingToDB}
                                                                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] rounded border border-slate-300 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                            title="Move held record back to active Salary Sheet"
                                                                        >
                                                                            <RefreshCw size={11} />
                                                                            Unhold
                                                                        </button>
                                                                    )}
                                                                    {/* {activeTab !== 'hold' && (
                                                                    <button
                                                                        onClick={() => handleMarkAsHold(row)}
                                                                        disabled={isSavingToDB}
                                                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[11px] rounded border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                                                        title="Send record to Hold Tab"
                                                                    >
                                                                        <Bookmark size={11} />
                                                                        Hold
                                                                    </button>
                                                                )} */}
                                                                    {/* <button
                                                                    onClick={() => handleMarkAsPaid(row)}
                                                                    disabled={isSavingToDB}
                                                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded transition-colors flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-50"
                                                                    title="Mark as Paid & Generate Payroll"
                                                                >
                                                                    <CheckCircle2 size={11} />
                                                                    Mark as Paid
                                                                </button> */}
                                                                </div>
                                                            );
                                                        }
                                                    }

                                                    return (
                                                        <td key={j} className={cellClass}>
                                                            {content}
                                                        </td>
                                                    );
                                                })}
                                        </tr>
                                    );
                                })}

                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={20} className="text-center py-12 bg-gray-50/50">
                                            <div className="flex flex-col items-center justify-center text-gray-400 gap-1.5">
                                                <HelpCircle size={32} />
                                                <p className="font-semibold text-gray-600 text-xs">No payroll records found</p>
                                                <p className="text-[10px] text-gray-400">Try matching by name, id or checking your database tables</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {renderPagination()}
                </div>
            )}

            {showSchemaModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-lg w-full overflow-hidden transition-all transform scale-100">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <Database size={16} className="text-indigo-600" />
                                Database Table Required
                            </h3>
                            <button
                                onClick={() => setShowSchemaModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-5">
                            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                                The <code>payroll</code> table or its columns are missing from your Supabase database. Please copy the SQL code below, open your <strong>Supabase SQL Editor</strong>, paste and run it to create the table or migrate its columns.
                            </p>
                            <div className="relative bg-slate-950 rounded-lg p-3.5 mb-4">
                                <pre className="text-[10px] text-emerald-400 font-mono overflow-x-auto max-h-48 scrollbar-thin whitespace-pre-wrap">
                                    {`CREATE TABLE IF NOT EXISTS hr_management_payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    year INTEGER NOT NULL,
    month VARCHAR(50) NOT NULL,
    total_month_days INTEGER DEFAULT 0,
    total_present INTEGER DEFAULT 0,
    extra_days INTEGER DEFAULT 0,
    salary NUMERIC DEFAULT 0,
    advance_deduction NUMERIC DEFAULT 0,
    breakage_deduction NUMERIC DEFAULT 0,
    medical_deduction NUMERIC DEFAULT 0,
    rto_deduction NUMERIC DEFAULT 0,
    prorated_salary NUMERIC DEFAULT 0,
    seasonal_bonus NUMERIC DEFAULT 0,
    referral_bonus NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (employee_id, year, month)
);

-- For existing hr_management_payroll tables without unique constraint:
ALTER TABLE hr_management_payroll 
ADD CONSTRAINT hr_management_payroll_emp_year_month_key 
UNIQUE (employee_id, year, month);`}
                                </pre>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`ALTER TABLE hr_management_payroll ADD CONSTRAINT hr_management_payroll_emp_year_month_key UNIQUE (employee_id, year, month);`);
                                        toast.success("SQL copied to clipboard!");
                                    }}
                                    className="absolute top-2 right-2 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] text-gray-300 rounded font-medium transition-colors cursor-pointer"
                                >
                                    Copy SQL
                                </button>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowSchemaModal(false)}
                                    className="px-3.5 py-1.5 border border-gray-200 rounded text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payslip PDF Modal */}
            {selectedPayslip && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header Actions */}
                        <div className="flex items-center justify-between px-6 py-3 bg-slate-100 border-b border-slate-200 print:hidden shrink-0">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-700">Payslip Preview</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const printContent = document.getElementById('printable-payslip');
                                        if (printContent) {
                                            const win = window.open('', '_blank');
                                            win.document.write(`
                                                <!DOCTYPE html>
                                                <html>
                                                    <head>
                                                        <title>Payslip - ${selectedPayslip.name}</title>
                                                        <script src="https://cdn.tailwindcss.com"></script>
                                                        <style>
                                                            @page { size: auto; margin: 15mm; }
                                                            * {
                                                                -webkit-print-color-adjust: exact !important;
                                                                print-color-adjust: exact !important;
                                                                color-adjust: exact !important;
                                                            }
                                                            body { font-family: ui-sans-serif, system-ui, sans-serif; background: white !important; }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        <div className="max-w-3xl mx-auto p-4">
                                                            ${printContent.innerHTML}
                                                        </div>
                                                        <script>
                                                            setTimeout(() => {
                                                                window.print();
                                                                window.close();
                                                            }, 600);
                                                        </script>
                                                    </body>
                                                </html>
                                            `);
                                            win.document.close();
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                >
                                    <Printer size={14} />
                                    Print
                                </button>
                                <button
                                    onClick={() => {
                                        const printContent = document.getElementById('printable-payslip');
                                        if (printContent) {
                                            const win = window.open('', '_blank');
                                            win.document.write(`
                                                <!DOCTYPE html>
                                                <html>
                                                    <head>
                                                        <title>Payslip_${selectedPayslip.name}_${selectedPayslip.month}_${selectedPayslip.year}</title>
                                                        <script src="https://cdn.tailwindcss.com"></script>
                                                        <style>
                                                            @page { size: auto; margin: 15mm; }
                                                            * {
                                                                -webkit-print-color-adjust: exact !important;
                                                                print-color-adjust: exact !important;
                                                                color-adjust: exact !important;
                                                            }
                                                            body { font-family: ui-sans-serif, system-ui, sans-serif; background: white !important; }
                                                        </style>
                                                    </head>
                                                    <body>
                                                        <div className="max-w-3xl mx-auto p-4">
                                                            ${printContent.innerHTML}
                                                        </div>
                                                        <script>
                                                            setTimeout(() => {
                                                                window.print();
                                                                window.close();
                                                            }, 600);
                                                        </script>
                                                    </body>
                                                </html>
                                            `);
                                            win.document.close();
                                        }
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                                >
                                    <Download size={14} />
                                    Download PDF
                                </button>
                                <button
                                    onClick={() => setSelectedPayslip(null)}
                                    className="p-1.5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Printable Payslip Card with Scroll */}
                        <div className="p-8 font-sans text-slate-800 bg-white overflow-y-auto custom-scrollbar flex-1" id="printable-payslip">
                            {/* 1. Header Banner */}
                            <div className="bg-[#1e3a8a] text-white p-6 rounded-xl flex justify-between items-center mb-6">
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight">{selectedPayslip.shopName ? (shopFullNameMap[selectedPayslip.shopName] || selectedPayslip.shopName) : 'DRINQKART'}</h1>
                                    <p className="text-xs text-blue-200 font-semibold mt-0.5">Employee Payslip — Confidential</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300 block">PAY PERIOD</span>
                                    <span className="text-lg font-black">{selectedPayslip.month} {selectedPayslip.year}</span>
                                </div>
                            </div>

                            {/* 2. Employee Details Card */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-wrap justify-between items-center gap-4 mb-6">
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Employee Name</span>
                                    <span className="text-sm font-black text-slate-900">{selectedPayslip.name}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Employee Code</span>
                                    <span className="text-sm font-mono font-bold text-slate-800">{selectedPayslip.empId}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">Status</span>
                                    <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 uppercase">
                                        PAID
                                    </span>
                                </div>
                            </div>

                            {/* 3. Salary Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl">
                                    <span className="text-[11px] font-extrabold text-slate-600 block">Contracted Monthly Salary</span>
                                    <span className="text-2xl font-black text-blue-900 mt-1 block">
                                        ₹{(Number(selectedPayslip.salary) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium block mt-1">As per employee record - 30 calendar days</span>
                                </div>
                                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl">
                                    <span className="text-[11px] font-extrabold text-emerald-800 block">Earned Basic Salary</span>
                                    <span className="text-2xl font-black text-emerald-700 mt-1 block">
                                        ₹{(Number(selectedPayslip.prorated) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-[10px] text-emerald-600 font-medium block mt-1">
                                        For {selectedPayslip.present} present days @ ₹{selectedPayslip.salary > 0 ? (selectedPayslip.salary / 30).toFixed(2) : '0.00'}/day
                                    </span>
                                </div>
                            </div>

                            {/* 4. Attendance Summary */}
                            <div className="mb-6">
                                <span className="text-xs font-black uppercase tracking-wider text-slate-600 mb-2 block">
                                    ATTENDANCE SUMMARY — {selectedPayslip.month} {selectedPayslip.year} (30 days)
                                </span>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                                        <span className="text-lg font-black text-slate-900 block">{selectedPayslip.totalDays}</span>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Payable Days</span>
                                    </div>
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                                        <span className="text-lg font-black text-emerald-700 block">{selectedPayslip.present}</span>
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">Present</span>
                                    </div>
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                                        <span className="text-lg font-black text-rose-700 block">{Math.max(0, 30 - selectedPayslip.present)}</span>
                                        <span className="text-[10px] font-bold text-rose-600 uppercase">Absent</span>
                                    </div>
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                                        <span className="text-lg font-black text-amber-700 block">0</span>
                                        <span className="text-[10px] font-bold text-amber-600 uppercase">On Leave</span>
                                    </div>
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-center">
                                        <span className="text-lg font-black text-purple-700 block">{selectedPayslip.extraDays || 0}</span>
                                        <span className="text-[10px] font-bold text-purple-600 uppercase">Extra Days</span>
                                    </div>
                                    <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
                                        <span className="text-lg font-black text-indigo-700 block">0</span>
                                        <span className="text-[10px] font-bold text-indigo-600 uppercase">Holiday</span>
                                    </div>
                                </div>
                            </div>

                            {/* 5. Earnings & Deductions Tables */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                                {/* EARNINGS */}
                                <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 block border-b pb-2 mb-3">EARNINGS</span>
                                        <div className="flex justify-between items-center py-1 text-xs">
                                            <span className="text-slate-600 font-medium">Earned Basic ({selectedPayslip.present} present days)</span>
                                            <span className="font-bold text-slate-900">₹{(Number(selectedPayslip.prorated) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        {(Number(selectedPayslip.seasonal) > 0 || Number(selectedPayslip.referral) > 0) && (
                                            <div className="flex justify-between items-center py-1 text-xs">
                                                <span className="text-slate-600 font-medium">Bonuses (Seasonal/Referral)</span>
                                                <span className="font-bold text-slate-900">₹{((Number(selectedPayslip.seasonal) || 0) + (Number(selectedPayslip.referral) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-3 font-bold text-xs">
                                        <span className="text-slate-900 uppercase">Gross Salary</span>
                                        <span className="text-emerald-600 text-sm font-black">
                                            ₹{((Number(selectedPayslip.prorated) || 0) + (Number(selectedPayslip.seasonal) || 0) + (Number(selectedPayslip.referral) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>

                                {/* DEDUCTIONS */}
                                <div className="border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 block border-b pb-2 mb-3">DEDUCTIONS</span>
                                        {Number(selectedPayslip.fixedAdv) > 0 && (
                                            <div className="flex justify-between items-center py-1 text-xs">
                                                <span className="text-slate-600 font-medium">Fixed Advance Balance</span>
                                                <span className="font-mono text-slate-700">₹{(Number(selectedPayslip.fixedAdv) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center py-1 text-xs">
                                            <span className="text-slate-600 font-medium">Monthly Advance Deduction</span>
                                            <span className="font-mono text-rose-600">-₹{(Number(selectedPayslip.advance) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                        {Number(selectedPayslip.breakage) > 0 && (
                                            <div className="flex justify-between items-center py-1 text-xs">
                                                <span className="text-slate-600 font-medium">Breakage Deduction</span>
                                                <span className="font-mono text-rose-600">-₹{(Number(selectedPayslip.breakage) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {Number(selectedPayslip.medical) > 0 && (
                                            <div className="flex justify-between items-center py-1 text-xs">
                                                <span className="text-slate-600 font-medium">Medical Deduction</span>
                                                <span className="font-mono text-rose-600">-₹{(Number(selectedPayslip.medical) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {Number(selectedPayslip.rto) > 0 && (
                                            <div className="flex justify-between items-center py-1 text-xs">
                                                <span className="text-slate-600 font-medium">RTO Deduction</span>
                                                <span className="font-mono text-rose-600">-₹{(Number(selectedPayslip.rto) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                        {Number(selectedPayslip.wayOff) > 0 && (
                                            <div className="flex justify-between items-center py-1 text-xs">
                                                <span className="text-slate-600 font-medium">Way Off</span>
                                                <span className="font-mono text-rose-600">-₹{(Number(selectedPayslip.wayOff) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center pt-3 border-t border-slate-200 mt-3 font-bold text-xs">
                                        <span className="text-slate-900 uppercase">Total Deductions</span>
                                        <span className="text-rose-600 text-sm font-black">
                                            -₹{((Number(selectedPayslip.advance) || 0) + (Number(selectedPayslip.breakage) || 0) + (Number(selectedPayslip.medical) || 0) + (Number(selectedPayslip.rto) || 0) + (Number(selectedPayslip.wayOff) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Net Salary Banner */}
                            <div className="bg-[#1e3a8a] text-white p-5 rounded-xl flex justify-between items-center">
                                <div>
                                    <span className="text-sm font-black block">Net Salary (Take Home)</span>
                                    <span className="text-[11px] text-blue-200 block mt-0.5">
                                        Gross ₹{((Number(selectedPayslip.prorated) || 0) + (Number(selectedPayslip.seasonal) || 0) + (Number(selectedPayslip.referral) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} &nbsp; Deductions ₹{((Number(selectedPayslip.advance) || 0) + (Number(selectedPayslip.breakage) || 0) + (Number(selectedPayslip.medical) || 0) + (Number(selectedPayslip.rto) || 0) + (Number(selectedPayslip.wayOff) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <span className="text-3xl font-black tracking-tight text-white">
                                    ₹{(Number(selectedPayslip.netSalary) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            {/* Footer Notes */}
                            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                                <span>Generated on: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                <span>This is a system-generated payslip. No signature required.</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mark as Paid Shop Selection Modal */}
            {showMarkAsPaidModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
                        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-emerald-600" />
                                Select Shop for Payment Generation
                            </h3>
                            <button
                                onClick={() => {
                                    setShowMarkAsPaidModal(false);
                                    setPendingPaidRows([]);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-xs text-slate-600 mb-4 font-medium">
                                You are about to mark <span className="font-bold text-slate-900">{pendingPaidRows.length} employee record(s)</span> as Paid. Select the Shop Name to assign to all selected employees:
                            </p>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Shop Name</label>
                            <select
                                value={modalShopSelection}
                                onChange={(e) => setModalShopSelection(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer mb-6"
                            >
                                {shopsList.length === 0 ? (
                                    <option value="DRINQKART">DRINQKART</option>
                                ) : (
                                    shopsList.map(s => (
                                        <option key={s} value={s}>{shopFullNameMap[s] || s}</option>
                                    ))
                                )}
                            </select>
                            <div className="flex justify-end items-center gap-3">
                                <button
                                    onClick={() => {
                                        setShowMarkAsPaidModal(false);
                                        setPendingPaidRows([]);
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmMarkAsPaidWithShop}
                                    disabled={isSavingToDB}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {isSavingToDB ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    Confirm & Generate Paid
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payroll;