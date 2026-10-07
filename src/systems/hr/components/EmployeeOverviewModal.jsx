import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

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

// Helper to calculate work hours between two 12h/24h strings
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

const parseDojToYYYYMMDD = (rawDoj) => {
  if (!rawDoj) return null;
  const str = String(rawDoj).trim();
  if (!str || str === '-' || str === 'null' || str === 'undefined') return null;

  if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
    return str.substring(0, 10);
  }

  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (ddmmyyyy) {
    const d = String(ddmmyyyy[1]).padStart(2, '0');
    const m = String(ddmmyyyy[2]).padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${y}-${m}-${d}`;
  }

  try {
    const dObj = new Date(str);
    if (!isNaN(dObj.getTime())) {
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  } catch (e) {}

  return null;
};

const formatTimeIST = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;
  try {
    if (timeStr.includes('AM') || timeStr.includes('PM') || timeStr.includes('am') || timeStr.includes('pm')) {
      return timeStr;
    }
    let dateObj;
    if (timeStr.includes('T')) {
      dateObj = new Date(timeStr);
    } else {
      const parts = timeStr.split(':');
      dateObj = new Date();
      dateObj.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0);
    }
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return timeStr;
  }
};

const HARDWARE_DEVICES = [
  { name: 'MADHURA', serial: 'C26238441B1E342D' },
  { name: 'TLS', serial: 'AMDB25061400335' },
  { name: 'FRIENDS', serial: 'AMDB25061400343' },
  { name: 'BALAJI', serial: 'C262CC13CF202038' },
  { name: 'KUNAL ULWE', serial: 'C2630450C32A2327' },
  { name: 'KUNAL KHARGHAR', serial: 'AMDB25120600859' }
];

const resolvePunchedStore = (att) => {
  if (!att) return null;

  // 1. Check explicit punch_location or punched_location
  if (att.punch_location && att.punch_location !== '-' && att.punch_location.toUpperCase() !== 'MUMBAI') {
    return att.punch_location;
  }
  if (att.punched_location && att.punched_location !== '-' && att.punched_location.toUpperCase() !== 'MUMBAI') {
    return att.punched_location;
  }

  // 2. Check biometric device serial number
  const serial = (att.serial_number || att.serialNo || '').toString().trim();
  if (serial && serial !== '-' && serial !== 'ALL') {
    const matchedDevice = HARDWARE_DEVICES.find(d => d.serial.toLowerCase() === serial.toLowerCase());
    if (matchedDevice) return matchedDevice.name;
  }

  // 3. Check explicit store_name on punch attendance log only if not empty / not placeholder / not fallback
  if (att.store_name && att.store_name !== '-' && att.store_name.trim() !== '' && att.store_name.toUpperCase() !== 'MUMBAI' && att.store_name.toUpperCase() !== 'ALL') {
    return att.store_name.trim();
  }

  return null;
};

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function EmployeeOverviewModal({
  isOpen,
  onClose,
  employee,
  initialMonth = new Date(),
  initialTab = 'timecard'
}) {
  const [modalMonth, setModalMonth] = useState(initialMonth);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);

  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [rosterLogs, setRosterLogs] = useState([]);
  const [holidayLogs, setHolidayLogs] = useState([]);
  const [learningSubmission, setLearningSubmission] = useState(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const [employeeProfile, setEmployeeProfile] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setModalMonth(initialMonth || new Date());
      setActiveTab(initialTab || 'timecard');
    }
  }, [isOpen, initialMonth, initialTab]);

  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      if (!employee) return;
      const empIdStr = String(employee.employee_id || employee.id || employee.code || '').trim();
      const rawDbId = employee.db_id ? String(employee.db_id).trim() : '';
      const empNameStr = String(employee.name || employee.user_name || employee.name_as_per_aadhar || '').trim();

      try {
        let query = supabase.from('hr_management_employees').select('*');
        const orConditions = [];
        if (empIdStr) {
          orConditions.push(`employee_id.eq.${empIdStr}`);
          orConditions.push(`employee_id.eq.${empIdStr.replace(/^0+/, '')}`);
          orConditions.push(`id.eq.${empIdStr}`);
        }
        if (rawDbId) {
          orConditions.push(`id.eq.${rawDbId}`);
          orConditions.push(`employee_id.eq.${rawDbId}`);
        }
        if (empNameStr) {
          orConditions.push(`name_as_per_aadhar.ilike.%${empNameStr}%`);
          orConditions.push(`user_name.ilike.%${empNameStr}%`);
        }

        if (orConditions.length > 0) {
          query = query.or(orConditions.join(','));
        }
        const { data } = await query.limit(1);
        if (data && data.length > 0) {
          setEmployeeProfile({ ...employee, ...data[0] });
        } else {
          setEmployeeProfile(employee);
        }
      } catch (e) {
        setEmployeeProfile(employee);
      }
    };

    if (isOpen && employee) {
      fetchEmployeeDetails();
    }
  }, [isOpen, employee]);

  useEffect(() => {
    if (isOpen && employee) {
      fetchAttendanceData();
    }
  }, [isOpen, employee, modalMonth, employeeProfile]);

  useEffect(() => {
    if (isOpen && employee && activeTab === 'learning') {
      fetchLearningData();
    }
    if (isOpen && employee && activeTab === 'payslip') {
      fetchPayrollData();
    }
  }, [isOpen, employee, activeTab, employeeProfile]);

  const fetchAttendanceData = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const candidateIds = [
        employee.employee_id,
        employee.id,
        employee.code,
        employee.db_id,
        employeeProfile?.employee_id,
        employeeProfile?.id,
        employeeProfile?.code
      ].filter(Boolean).map(v => String(v).trim());

      const uniqueIds = Array.from(new Set(candidateIds));
      const empNameStr = String(employeeProfile?.user_name || employeeProfile?.name_as_per_aadhar || employee.name || employee.user_name || '').trim();

      const year = modalMonth.getFullYear();
      const monthNum = modalMonth.getMonth() + 1;
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // 1. Fetch attendance & holidays
      let logsQuery = supabase
        .from('hr_management_attendance_logs')
        .select('*')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .limit(5000);

      const orClauses = [];
      uniqueIds.forEach(id => {
        orClauses.push(`employee_id.eq.${id}`);
        const stripped = id.replace(/^0+/, '');
        if (stripped && stripped !== id) {
          orClauses.push(`employee_id.eq.${stripped}`);
        }
      });
      if (empNameStr) {
        orClauses.push(`employee_name.ilike.%${empNameStr}%`);
      }

      if (orClauses.length > 0) {
        logsQuery = logsQuery.or(orClauses.join(','));
      }

      const [{ data: logsData }, { data: dbHolidays }] = await Promise.all([
        logsQuery,
        supabase
          .from('holidays')
          .select('*')
          .gte('holiday_date', startDate)
          .lte('holiday_date', endDate)
      ]);

      const combinedLogs = (logsData || []).map(l => ({ ...l, date: l.date || l.attendance_date }));

      const filteredAtt = combinedLogs.filter(a => {
        const idCol = String(a.employee_id || a.emp_id || '').trim().toLowerCase();
        const nameCol = String(a.employee_name || a.name || a.emp_name || '').trim().toLowerCase();
        const eName = empNameStr.toLowerCase();

        const idMatches = uniqueIds.some(candId => {
          const cLower = candId.toLowerCase();
          return idCol === cLower ||
            idCol.replace(/^0+/, '') === cLower.replace(/^0+/, '') ||
            parseInt(idCol, 10) === parseInt(cLower, 10);
        });

        const nameMatches = Boolean(eName && nameCol) && (
          nameCol === eName ||
          nameCol.includes(eName) ||
          eName.includes(nameCol)
        );

        return idMatches || nameMatches;
      });

      setAttendanceLogs(filteredAtt);
      setHolidayLogs(dbHolidays || []);

      // 2. Fetch rosters
      const { data: rosterData } = await supabase
        .from('hr_management_shift_roster')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (rosterData) {
        const filteredRoster = rosterData.filter(r => {
          const idCol = String(r.employee_id || r.emp_id || '').trim().toLowerCase();
          const nameCol = String(r.employee_name || r.name || '').trim().toLowerCase();
          const eName = empNameStr.toLowerCase();

          const idMatches = uniqueIds.some(candId => {
            const cLower = candId.toLowerCase();
            return idCol === cLower ||
              idCol.replace(/^0+/, '') === cLower.replace(/^0+/, '') ||
              parseInt(idCol, 10) === parseInt(cLower, 10);
          });

          const nameMatches = Boolean(eName && nameCol) && (
            nameCol === eName ||
            nameCol.includes(eName) ||
            eName.includes(nameCol)
          );

          return idMatches || nameMatches;
        });
        setRosterLogs(filteredRoster);
      } else {
        setRosterLogs([]);
      }
    } catch (err) {
      console.error('Error fetching attendance in Overview modal:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLearningData = async () => {
    if (!employee) return;
    setLearningLoading(true);
    try {
      const candidateIds = [
        employee.employee_id,
        employee.id,
        employee.code,
        employeeProfile?.employee_id,
        employeeProfile?.id
      ].filter(Boolean).map(v => String(v).trim());

      const empNameStr = String(employeeProfile?.user_name || employeeProfile?.name_as_per_aadhar || employee.name || employee.user_name || '').trim().toLowerCase();

      // Query both potential Supabase table names for learning submissions
      const [{ data: data1 }, { data: data2 }] = await Promise.all([
        supabase.from('hr_learning_submissions').select('*').order('created_at', { ascending: false }),
        supabase.from('hr_employee_learning_submissions').select('*').order('submission_date', { ascending: false })
      ]);

      const allSubmissions = [
        ...(data1 || []).map(s => {
          let tasksArr = [];
          if (typeof s.tasks_data === 'string') {
            try { tasksArr = JSON.parse(s.tasks_data); } catch (e) { tasksArr = []; }
          } else if (Array.isArray(s.tasks_data)) {
            tasksArr = s.tasks_data;
          } else if (Array.isArray(s.tasks)) {
            tasksArr = s.tasks;
          }
          return {
            ...s,
            employee_name: s.employee_name || s.employee,
            tasks: tasksArr
          };
        }),
        ...(data2 || []).map(s => {
          let tasksArr = [];
          if (typeof s.tasks === 'string') {
            try { tasksArr = JSON.parse(s.tasks); } catch (e) { tasksArr = []; }
          } else if (Array.isArray(s.tasks)) {
            tasksArr = s.tasks;
          }
          return {
            ...s,
            tasks: tasksArr
          };
        })
      ];

      if (allSubmissions.length > 0) {
        const found = allSubmissions.find(s => {
          const sId = String(s.employee_id || s.employee_code || '').trim();
          const normSId = sId.replace(/^0+/, '');
          const sName = String(s.employee_name || s.employee || '').trim().toLowerCase();

          const matchId = candidateIds.some(candId => {
            const normCandId = candId.replace(/^0+/, '');
            return candId === sId ||
              (normCandId && normSId && normCandId === normSId) ||
              parseInt(candId, 10) === parseInt(sId, 10);
          });

          const matchName = Boolean(empNameStr && sName && (
            empNameStr === sName ||
            empNameStr.includes(sName) ||
            sName.includes(empNameStr)
          ));

          return matchId || matchName;
        });

        setLearningSubmission(found || null);
      } else {
        setLearningSubmission(null);
      }
    } catch (err) {
      console.error('Error fetching learning report in modal:', err);
    } finally {
      setLearningLoading(false);
    }
  };

  const fetchPayrollData = async () => {
    if (!employee) return;
    setPayrollLoading(true);
    try {
      const candidateIds = [
        employee.employee_id,
        employee.id,
        employee.code,
        employeeProfile?.employee_id,
        employeeProfile?.id
      ].filter(Boolean).map(v => String(v).trim().toLowerCase());

      const empNameStr = String(employeeProfile?.user_name || employeeProfile?.name_as_per_aadhar || employee.name || employee.user_name || '').trim().toLowerCase();

      const { data } = await supabase
        .from('hr_management_payroll')
        .select('*')
        .order('id', { ascending: false });

      if (data) {
        const filtered = data.filter(r => {
          const idCol = String(r.employee_id || r.employee_code || '').trim().toLowerCase();
          const nameCol = String(r.employee_name || r.name || '').trim().toLowerCase();
          const idMatch = candidateIds.some(candId => idCol === candId || idCol.replace(/^0+/, '') === candId.replace(/^0+/, ''));
          const nameMatch = empNameStr && nameCol.includes(empNameStr);
          return idMatch || nameMatch;
        });
        setPayrollRecords(filtered);
      } else {
        setPayrollRecords([]);
      }
    } catch (err) {
      console.error('Error fetching payroll records:', err);
    } finally {
      setPayrollLoading(false);
    }
  };

  if (!isOpen || !employee) return null;

  const activeEmp = employeeProfile || employee;
  const empName = activeEmp?.user_name || activeEmp?.name_as_per_aadhar || activeEmp?.name || activeEmp?.candidate_name || 'Employee';
  const empId = activeEmp?.employee_id || activeEmp?.id || activeEmp?.code || 'N/A';
  const avatar = activeEmp?.candidate_photo || activeEmp?.photo_url;
  const empDesignation = activeEmp?.designation || activeEmp?.Designation || 'Staff';
  const empStore = activeEmp?.joining_place || activeEmp?.shop_name || activeEmp?.store_name || 'MUMBAI';
  const rawDoj = activeEmp?.date_of_joining || activeEmp?.doj || activeEmp?.joining_date;
  const empDojStr = parseDojToYYYYMMDD(rawDoj);

  // Build month day rows
  const pYear = modalMonth.getFullYear();
  const pMonthIdx = modalMonth.getMonth();
  const daysInPMonth = new Date(pYear, pMonthIdx + 1, 0).getDate();

  const todayObj = new Date();
  const isCurrentMonth = pYear === todayObj.getFullYear() && pMonthIdx === todayObj.getMonth();
  const maxDay = isCurrentMonth ? Math.min(todayObj.getDate(), daysInPMonth) : daysInPMonth;

  const dayRows = [];
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalWeeklyOff = 0;
  let totalDayOff = 0;
  let totalHoliday = 0;
  let totalUnpunchedHoliday = 0;
  let totalLateMins = 0;
  let totalWorkMs = 0;
  let workingDaysCount = 0;

  for (let d = 1; d <= maxDay; d++) {
    const dateStr = `${pYear}-${String(pMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(pYear, pMonthIdx, d);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

    const isBeforeJoining = Boolean(empDojStr && dateStr < empDojStr);

    const hEntry = holidayLogs.find(h => (h.holiday_date || '').trim() === dateStr);
    const isHoliday = !!hEntry;
    const holidayName = hEntry ? hEntry.holiday_name : null;

    const rEntry = rosterLogs.find(r => r.date === dateStr);
    const hasRoster = !!(rEntry && rEntry.shift_type);
    const shiftName = isHoliday ? (holidayName || 'Holiday') : hasRoster ? rEntry.shift_type : 'Roster Not Available';
    const scheduledStartStr = hasRoster && rEntry.start_time ? rEntry.start_time.substring(0, 5) : '10:00';
    const scheduledEndStr = hasRoster && rEntry.end_time ? rEntry.end_time.substring(0, 5) : '19:30';

    const att = attendanceLogs.find(a => {
      const dVal = (a.date || a.attendance_date || '').toString().trim();
      const dKey = dVal.includes('T') ? dVal.split('T')[0] : dVal.substring(0, 10);
      return dKey === dateStr;
    }) || {};

    let inTime = att.in_time || att.check_in || att.clock_in || att.in_time_ist;
    let outTime = att.out_time || att.check_out || att.clock_out || att.out_time_ist;

    // If punch_log has actual logs, use exact first and last punch from punch_log
    if (att.punch_log && att.punch_log !== '-') {
      const rawList = att.punch_log
        .split(/\s*\|\s*/)
        .filter(Boolean)
        .map(p => p.trim());
      if (rawList.length > 0) {
        inTime = rawList[0];
        if (rawList.length > 1) {
          outTime = rawList[rawList.length - 1];
        }
      }
    } else if (att.manual_punches && (att.manual_punches.is_manual || att.manual_punches.manual_override)) {
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

    const rShiftLower = String(rEntry?.shift_type || '').toLowerCase();
    const isRosterWeeklyOff = hasRoster && (
      rShiftLower.includes('weekly off') || 
      rShiftLower === 'wo' ||
      rShiftLower === 'weeklyoff'
    );
    const isRosterDayOff = hasRoster && (
      rShiftLower.includes('day off') || 
      rShiftLower === 'do' ||
      rShiftLower === 'dayoff'
    );
    const isRosterHoliday = hasRoster && (
      rShiftLower.includes('holiday') ||
      rShiftLower === 'hd'
    );

    // Compute lunch break duration dynamically from raw punch_log or manual_punches if not stored
    let computedLunchStr = att.standard_lunch || att.lunch_time || att.lunch_duration || att.lunch_hours || att.lunch || '-';
    let rawPunchList = [];
    if (att.punch_log && att.punch_log !== '-') {
      rawPunchList = att.punch_log.split(/\s*\|\s*/).filter(Boolean).map(p => p.trim());
    } else if (att.manual_punches && (att.manual_punches.is_manual || att.manual_punches.manual_override)) {
      const mPunches = att.manual_punches.manual || att.manual_punches;
      rawPunchList = Object.entries(mPunches)
        .filter(([k, v]) => v && typeof v === 'string' && k !== 'is_manual' && k !== 'manual_override' && k !== 'absent')
        .map(([k, v]) => v.trim());
    }

    if (!computedLunchStr || computedLunchStr === '-' || computedLunchStr === '00:00:00') {
      if (rawPunchList.length >= 3) {
        let actualLunchMs = 0;
        for (let i = 1; i < rawPunchList.length - 1; i += 2) {
          const pOut = parseDateTimeHelper(rawPunchList[i], dateStr);
          const pIn = parseDateTimeHelper(rawPunchList[i + 1], dateStr);
          if (pOut && pIn && pIn > pOut) {
            actualLunchMs += (pIn.getTime() - pOut.getTime());
          }
        }
        if (actualLunchMs > 0) {
          const totalSecs = Math.floor(actualLunchMs / 1000);
          const hrs = Math.floor(totalSecs / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          computedLunchStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      }
    }

    const lunchStr = (computedLunchStr && computedLunchStr !== '00:00:00') ? computedLunchStr : '-';

    let workHrsStr = att.working_hour && att.working_hour !== '-' ? att.working_hour : '00:00:00';
    if (inTime && outTime && inTime !== '-' && outTime !== '-') {
      workHrsStr = calculateWorkHours(inTime, outTime, dateStr, lunchStr);
    }

    const [wh, wm, ws] = (workHrsStr || '00:00:00').split(':').map(Number);
    const dayWorkMs = ((wh || 0) * 3600 + (wm || 0) * 60 + (ws || 0)) * 1000;

    // Check if punch is invalid: e.g. single punch around midnight (00:xx) with no work hours and no other logs
    const isSingleMidnightPunch = (rawPunchList.length <= 1 && !outTime && inTime && (inTime.includes('12:') || inTime.includes('00:')) && dayWorkMs === 0);
    const hasValidWorkingPunch = Boolean(
      (inTime && outTime && inTime !== '-' && outTime !== '-' && dayWorkMs > 0) ||
      (rawPunchList.length >= 2 && dayWorkMs > 0) ||
      (att.status && att.status !== 'Absent' && att.status !== 'absent' && !isSingleMidnightPunch && (dayWorkMs > 0 || (inTime && !isSingleMidnightPunch)))
    );

    let status = att.status;
    const isLate = Boolean((att.late_minutes && att.late_minutes > 0) || (att.late_minute && att.late_minute > 0) || status === 'Late');

    const statusLower = String(status || '').toLowerCase().trim();
    const isExplicitWeeklyOff = statusLower === 'weekly off' || statusLower === 'wo' || statusLower === 'weeklyoff' || isRosterWeeklyOff;
    const isExplicitDayOff = statusLower === 'day off' || statusLower === 'do' || statusLower === 'dayoff' || isRosterDayOff;
    const isExplicitOnLeave = statusLower === 'on leave' || statusLower === 'leave';
    const isExplicitHalfDay = statusLower === 'half day' || statusLower === 'hd';
    const isExplicitHoliday = isHoliday || isRosterHoliday || statusLower === 'holiday' || statusLower === 'hd';

    if (isBeforeJoining) {
      status = '—'; // Employee not joined yet
    } else {
      workingDaysCount++;
      if (isExplicitHoliday) {
        totalHoliday++;
        if (hasValidWorkingPunch && !isSingleMidnightPunch) {
          status = isLate ? 'Late' : 'Present';
        } else {
          status = 'HOLIDAY';
          totalUnpunchedHoliday++;
        }
      } else if (hasValidWorkingPunch && !isSingleMidnightPunch) {
        status = isLate ? 'Late' : (isExplicitHalfDay ? 'Half Day' : (status || 'Present'));
      } else if (isExplicitWeeklyOff) {
        status = 'Weekly Off';
      } else if (isExplicitDayOff) {
        status = 'Day Off';
      } else if (isExplicitOnLeave) {
        status = 'On Leave';
      } else if (isExplicitHalfDay) {
        status = 'Half Day';
      } else {
        status = 'Absent';
      }

      const lateMins = att.late_minutes || 0;

      if (status === 'Present' || status === 'Late' || status === 'Half Day') {
        totalPresent++;
        if (lateMins > 0 || status === 'Late') {
          totalLate++;
          totalLateMins += lateMins;
        }
      } else if (status === 'Weekly Off' || status === 'WO') {
        totalWeeklyOff++;
      } else if (status === 'Day Off' || status === 'DO') {
        totalDayOff++;
      } else if (status === 'Absent') {
        totalAbsent++;
      }

      totalWorkMs += dayWorkMs;
    }

    const lateMins = isBeforeJoining ? 0 : (att.late_minutes || 0);

    // Build timeline shift segments dynamically
    let shiftSegments = [];
    if (!isBeforeJoining) {
      if (rawPunchList.length >= 4) {
        // 4 punches: in1 -> out1 (morning), out1 -> in2 (lunch), in2 -> out2 (evening)
        const pIn1 = rawPunchList[0];
        const pOut1 = rawPunchList[1];
        const pIn2 = rawPunchList[2];
        const pOut2 = rawPunchList[3];
        const mHrs = calculateWorkHours(pIn1, pOut1, dateStr, '00:00:00');
        const eHrs = calculateWorkHours(pIn2, pOut2, dateStr, '00:00:00');
        shiftSegments = [
          { label: 'Morning Shift', time: `${formatTimeIST(pIn1)} – ${formatTimeIST(pOut1)}`, duration: mHrs, type: 'morning' },
          { label: 'Lunch Break', time: `${formatTimeIST(pOut1)} – ${formatTimeIST(pIn2)}`, duration: lunchStr, type: 'lunch' },
          { label: 'Evening Shift', time: `${formatTimeIST(pIn2)} – ${formatTimeIST(pOut2)}`, duration: eHrs, type: 'evening' }
        ];
      } else if (rawPunchList.length === 2 || (inTime && outTime && inTime !== '-' && outTime !== '-')) {
        const pIn = rawPunchList[0] || inTime;
        const pOut = rawPunchList[rawPunchList.length - 1] || outTime;
        if (lunchStr && lunchStr !== '-') {
          // Split with lunch
          shiftSegments = [
            { label: 'Work Shift (In)', time: `${formatTimeIST(pIn)}`, duration: '', type: 'morning' },
            { label: 'Lunch', time: lunchStr, duration: lunchStr, type: 'lunch' },
            { label: 'Work Shift (Out)', time: `${formatTimeIST(pOut)}`, duration: workHrsStr, type: 'evening' }
          ];
        } else {
          shiftSegments = [
            { label: 'Full Shift', time: `${formatTimeIST(pIn)} – ${formatTimeIST(pOut)}`, duration: workHrsStr, type: 'full' }
          ];
        }
      } else if (inTime && inTime !== '-' && !isSingleMidnightPunch) {
        shiftSegments = [
          { label: 'Punch In', time: `${formatTimeIST(inTime)}`, duration: 'Pending Out', type: 'pending' }
        ];
      }
    }

    dayRows.push({
      dayNum: d,
      dateStr,
      dayName,
      shiftName: isBeforeJoining ? '—' : shiftName,
      hasRoster,
      scheduledStartStr,
      scheduledEndStr,
      inTimeFormatted: isBeforeJoining ? '-' : formatTimeIST(inTime),
      outTimeFormatted: isBeforeJoining ? '-' : formatTimeIST(outTime),
      lunchStr: isBeforeJoining ? '-' : lunchStr,
      workHrsStr: isBeforeJoining ? '00:00:00' : workHrsStr,
      lateMins: isBeforeJoining ? 0 : lateMins,
      status,
      isBeforeJoining,
      holidayName: holidayName || (isRosterHoliday ? rEntry?.shift_type : null) || 'Company Holiday',
      isHoliday: isBeforeJoining ? false : isExplicitHoliday,
      isWeeklyOff: isBeforeJoining ? false : isExplicitWeeklyOff,
      isDayOff: isBeforeJoining ? false : isExplicitDayOff,
      shiftSegments,
      rawPunchList,
      hasValidWorkingPunch: isBeforeJoining ? false : (hasValidWorkingPunch && !isSingleMidnightPunch),
      attendance: att
    });
  }

  const totalWorkHrsDec = totalWorkMs / (3600 * 1000);
  const avgWorkHrsDec = totalPresent > 0 ? (totalWorkHrsDec / totalPresent).toFixed(1) : '0.0';
  const totalWorkHrsInt = Math.floor(totalWorkHrsDec);
  const totalWorkMinsInt = Math.round((totalWorkHrsDec - totalWorkHrsInt) * 60);
  const totalWorkFormatted = `${totalWorkHrsInt}h ${totalWorkMinsInt}m`;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 pr-14 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 shadow-sm active:scale-95 cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatar ? (
                  <img
                    src={avatar}
                    alt={empName}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-md"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-xl font-bold text-white shadow-md">
                    {empName ? empName.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white tracking-tight">{empName}</h2>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-indigo-200 border border-white/10">
                    ID: {empId}
                  </span>
                  {empDojStr && (
                    <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-[10px] font-medium text-amber-200 border border-amber-400/30 flex items-center gap-1">
                      <span>🗓️ Joined:</span>
                      <span>{(() => {
                        const [y, m, d] = empDojStr.split('-');
                        return `${d} ${monthNames[parseInt(m, 10) - 1]?.substring(0, 3)} ${y}`;
                      })()}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                  {empDesignation} • {empStore}
                </p>
              </div>
            </div>

            {/* Month Picker & View Tabs */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 bg-white/10 border border-white/10 rounded-xl px-1.5 py-1">
                <button
                  onClick={() => setModalMonth(new Date(modalMonth.getFullYear(), modalMonth.getMonth() - 1, 1))}
                  className="p-1 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-white px-2 min-w-[110px] text-center flex items-center justify-center gap-1">
                  {loading && <Loader2 size={12} className="animate-spin text-indigo-300" />}
                  {monthNames[modalMonth.getMonth()]} {modalMonth.getFullYear()}
                </span>
                <button
                  onClick={() => setModalMonth(new Date(modalMonth.getFullYear(), modalMonth.getMonth() + 1, 1))}
                  className="p-1 hover:bg-white/10 text-white rounded-lg transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex bg-white/10 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setActiveTab('timecard')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'timecard' ? 'bg-white text-indigo-950 shadow-md font-bold' : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  📊 Timecard
                </button>
                <button
                  onClick={() => setActiveTab('timeline')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'timeline' ? 'bg-white text-indigo-950 shadow-md font-bold' : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  📈 Timeline
                </button>
                <button
                  onClick={() => setActiveTab('payslip')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'payslip' ? 'bg-white text-indigo-950 shadow-md font-bold' : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  💳 Payslip
                </button>
                <button
                  onClick={() => setActiveTab('learning')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'learning' ? 'bg-white text-indigo-950 shadow-md font-bold' : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  🎓 Learning
                </button>
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-4 pt-4 border-t border-white/10">
            <div className="bg-white/5 rounded-xl p-2 border border-white/5 text-center">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Working Days</p>
              <p className="text-base font-bold text-white mt-0.5">{workingDaysCount}</p>
            </div>
            <div className="bg-cyan-500/10 rounded-xl p-2 border border-cyan-500/20 text-center">
              <p className="text-[10px] font-medium text-cyan-300 uppercase tracking-wider">Payable Days</p>
              <p className="text-base font-bold text-cyan-300 mt-0.5">{totalPresent + totalUnpunchedHoliday + totalWeeklyOff + totalDayOff}</p>
            </div>
            <div className="bg-emerald-500/10 rounded-xl p-2 border border-emerald-500/20 text-center">
              <p className="text-[10px] font-medium text-emerald-300 uppercase tracking-wider">Present</p>
              <p className="text-base font-bold text-emerald-400 mt-0.5">{totalPresent}</p>
            </div>
            <div className="bg-red-500/10 rounded-xl p-2 border border-red-500/20 text-center">
              <p className="text-[10px] font-medium text-red-300 uppercase tracking-wider">Absent</p>
              <p className="text-base font-bold text-red-400 mt-0.5">{totalAbsent}</p>
            </div>
            <div className="bg-amber-500/10 rounded-xl p-2 border border-amber-500/20 text-center">
              <p className="text-[10px] font-medium text-amber-300 uppercase tracking-wider">Late Days</p>
              <p className="text-base font-bold text-amber-400 mt-0.5">{totalLate}</p>
            </div>
            <div className="bg-indigo-500/10 rounded-xl p-2 border border-indigo-500/20 text-center">
              <p className="text-[10px] font-medium text-indigo-300 uppercase tracking-wider">Total Work Hours</p>
              <p className="text-base font-bold text-indigo-300 mt-0.5">{totalWorkFormatted}</p>
            </div>
            <div className="bg-purple-500/10 rounded-xl p-2 border border-purple-500/20 text-center">
              <p className="text-[10px] font-medium text-purple-300 uppercase tracking-wider">Avg Daily Hours</p>
              <p className="text-base font-bold text-purple-300 mt-0.5">{avgWorkHrsDec}h</p>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 size={32} className="animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Loading attendance data...</p>
            </div>
          ) : activeTab === 'timecard' ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Date</th>
                      <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Day</th>
                      <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Roster / Shift</th>
                      <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Punched Location</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">Scheduled</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">In Time</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">Out Time</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">Lunch</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">Work Hours</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">Late</th>
                      <th className="px-3 py-2.5 font-bold text-center uppercase text-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {dayRows.map((row) => {
                      const punchedShopName = resolvePunchedStore(row.attendance);
                      const isWeekendDay = ['Fri', 'Sat', 'Sun'].includes(row.dayName);
                      const isHoliday = row.status === 'HOLIDAY' || row.status === 'Holiday';
                      const hasValidPunches = row.hasValidWorkingPunch;
                      const isAbsentOrLeave = 
                        !row.isBeforeJoining && (
                          !hasValidPunches ||
                          row.status === 'Absent' ||
                          String(row.status || '').toLowerCase() === 'absent' ||
                          row.status === 'On Leave' ||
                          String(row.status || '').toLowerCase().includes('leave') ||
                          row.status === 'Weekly Off' ||
                          row.status === 'WO' ||
                          row.status === 'Day Off' ||
                          row.status === 'DO'
                        );

                      const isWeekendAbsent = !isHoliday && isWeekendDay && isAbsentOrLeave;
                      return (
                        <tr 
                          key={row.dayNum} 
                          className={`transition-colors ${
                            row.isBeforeJoining
                              ? 'bg-slate-50/70 text-slate-400'
                              : isWeekendAbsent 
                              ? 'bg-red-100/70 hover:bg-red-100 border-l-4 border-l-red-500' 
                              : row.status === 'On Leave'
                              ? 'bg-rose-50/80 hover:bg-rose-100/80 border-l-4 border-l-rose-400'
                              : row.status === 'Absent'
                              ? 'bg-red-50/40 hover:bg-red-50/80'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className={`px-3 py-2 font-mono ${row.isBeforeJoining ? 'text-slate-400 font-medium' : 'text-slate-900 font-bold'}`}>
                            {String(row.dayNum).padStart(2, '0')} {monthNames[pMonthIdx].substring(0, 3)}
                          </td>
                          <td className={`px-3 py-2 ${row.isBeforeJoining ? 'text-slate-400' : isWeekendAbsent ? 'text-red-700 font-bold' : row.status === 'Absent' ? 'text-red-900 font-semibold' : 'text-slate-500'}`}>
                            {row.dayName}
                          </td>
                          {row.isBeforeJoining ? (
                            <>
                              <td colSpan={7} className="px-3 py-2 text-center">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-50/80 border border-amber-200/70 text-amber-800 text-[11px] font-medium">
                                  <span>👤</span>
                                  <span>Employee Joined on <strong>{empDojStr ? (() => {
                                    const [y, m, d] = empDojStr.split('-');
                                    return `${d} ${monthNames[parseInt(m, 10) - 1]?.substring(0, 3)} ${y}`;
                                  })() : 'Later Date'}</strong></span>
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-slate-400">-</td>
                              <td className="px-3 py-2 text-center">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-400 text-[10px] font-medium">Not Joined</span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2">
                                {row.hasRoster ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-[10px]">
                                    📅 {row.shiftName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-medium text-[10px]">
                                    Roster Not Available
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {punchedShopName ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-semibold text-[10px]">
                                    📍 {punchedShopName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600 font-mono">
                                {`${row.scheduledStartStr} – ${row.scheduledEndStr}`}
                              </td>
                              {isHoliday && !hasValidPunches ? (
                                <td colSpan={3} className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-100/90 text-purple-900 border border-purple-200 font-bold text-[11px] shadow-2xs">
                                    🏖️ {row.holidayName}
                                  </span>
                                </td>
                              ) : (row.status === 'Weekly Off' || row.status === 'WO') && !hasValidPunches ? (
                                <td colSpan={3} className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-100/90 text-indigo-900 border border-indigo-200 font-bold text-[11px] shadow-2xs">
                                    🌴 Weekly Off
                                  </span>
                                </td>
                              ) : (row.status === 'Day Off' || row.status === 'DO') && !hasValidPunches ? (
                                <td colSpan={3} className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[11px] shadow-2xs">
                                    📅 Day Off
                                  </span>
                                </td>
                              ) : (
                                <>
                                  <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">
                                    {row.inTimeFormatted || '-'}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">
                                    {row.outTimeFormatted || '-'}
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono text-slate-500">{row.lunchStr}</td>
                                </>
                              )}
                              <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">
                                {row.workHrsStr}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">
                                {row.lateMins > 0 ? (
                                  <span className="text-orange-600 font-bold">{row.lateMins}m</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {(() => {
                                  if (isHoliday) return <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">HOLIDAY</span>;
                                  if (row.status === 'Present') return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">P</span>;
                                  if (row.status === 'Late') return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">L</span>;
                                  if (row.status === 'Half Day') return <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-bold">HD</span>;
                                  if (row.status === 'Weekly Off') return <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">WO</span>;
                                  if (row.status === 'Day Off') return <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-bold">DO</span>;
                                  if (row.status === 'On Leave') return <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-bold">Leave</span>;
                                  return <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">A</span>;
                                })()}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === 'timeline' ? (
            <div className="space-y-3">
              {dayRows.map((row) => {
                const isWeekendDay = ['Fri', 'Sat', 'Sun'].includes(row.dayName);
                const isHoliday = row.status === 'HOLIDAY' || row.status === 'Holiday';
                const hasValidPunches = row.hasValidWorkingPunch;
                const isAbsentOrLeave = 
                  !row.isBeforeJoining && (
                    !hasValidPunches ||
                    row.status === 'Absent' ||
                    String(row.status || '').toLowerCase() === 'absent' ||
                    row.status === 'On Leave' ||
                    String(row.status || '').toLowerCase().includes('leave') ||
                    row.status === 'Weekly Off' ||
                    row.status === 'WO' ||
                    row.status === 'Day Off' ||
                    row.status === 'DO'
                  );

                const isWeekendAbsent = !isHoliday && isWeekendDay && isAbsentOrLeave;
                return (
                  <div 
                    key={row.dayNum} 
                    className={`rounded-2xl p-3.5 border transition-colors flex flex-col gap-2.5 ${
                      row.isBeforeJoining
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : row.isHoliday || row.status === 'HOLIDAY'
                        ? 'bg-purple-50/70 border-purple-200 shadow-xs'
                        : row.status === 'Weekly Off' || row.status === 'WO'
                        ? 'bg-indigo-50/60 border-indigo-200 shadow-xs'
                        : row.status === 'Day Off' || row.status === 'DO'
                        ? 'bg-slate-50 border-slate-200 shadow-xs'
                        : isWeekendAbsent 
                        ? 'bg-red-50/90 border-red-300 ring-1 ring-red-400/30 shadow-sm' 
                        : row.status === 'Absent'
                        ? 'bg-red-50/50 border-red-200'
                        : 'bg-white border-slate-200 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold font-mono ${row.isBeforeJoining ? 'text-slate-400' : isWeekendAbsent ? 'text-red-700 font-bold' : 'text-slate-900'}`}>
                          {String(row.dayNum).padStart(2, '0')} {monthNames[pMonthIdx].substring(0, 3)} ({row.dayName})
                        </span>
                        {row.isBeforeJoining ? (
                          <span className="px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-800 font-medium text-[10px]">
                            👤 Employee Joined on {empDojStr ? (() => {
                              const [y, m, d] = empDojStr.split('-');
                              return `${d} ${monthNames[parseInt(m, 10) - 1]?.substring(0, 3)} ${y}`;
                            })() : 'Later Date'}
                          </span>
                        ) : row.isHoliday || row.status === 'HOLIDAY' ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-purple-800 font-bold text-[10px]">
                            🏖️ {row.holidayName}
                          </span>
                        ) : row.status === 'Weekly Off' || row.status === 'WO' ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[10px]">
                            🌴 Weekly Off
                          </span>
                        ) : row.status === 'Day Off' || row.status === 'DO' ? (
                          <span className="px-2 py-0.5 rounded bg-slate-200 border border-slate-300 text-slate-700 font-bold text-[10px]">
                            📅 Day Off
                          </span>
                        ) : row.hasRoster ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-[10px]">
                            📅 {row.shiftName} ({row.scheduledStartStr} – {row.scheduledEndStr})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 font-medium text-[10px]">
                            Roster N/A ({row.scheduledStartStr} – {row.scheduledEndStr})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        {row.inTimeFormatted && row.inTimeFormatted !== '-' && <span className="text-emerald-700 font-semibold">In: {row.inTimeFormatted}</span>}
                        {row.outTimeFormatted && row.outTimeFormatted !== '-' && <span className="text-slate-700 font-semibold">Out: {row.outTimeFormatted}</span>}
                        <span className="font-bold text-slate-900">Total: {row.workHrsStr}</span>
                        {row.lateMins > 0 && <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">Late: {row.lateMins}m</span>}
                      </div>
                    </div>

                    {hasValidPunches && row.shiftSegments && row.shiftSegments.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="h-7 w-full bg-slate-100 rounded-xl overflow-hidden flex relative border border-slate-200 shadow-xs">
                          {row.shiftSegments.map((seg, sIdx) => {
                            if (seg.type === 'lunch') {
                              return (
                                <div key={sIdx} className="bg-amber-400 px-3 flex items-center justify-center text-slate-900 text-[10px] font-bold border-x border-amber-300 shadow-inner">
                                  <span>🥪 {seg.label} ({seg.duration || seg.time})</span>
                                </div>
                              );
                            }
                            if (seg.type === 'morning') {
                              return (
                                <div key={sIdx} className="bg-emerald-600 flex-1 flex items-center justify-center text-white text-[10px] font-bold px-2 truncate">
                                  <span>🌅 {seg.label}: {seg.time} {seg.duration ? `(${seg.duration})` : ''}</span>
                                </div>
                              );
                            }
                            if (seg.type === 'evening') {
                              return (
                                <div key={sIdx} className="bg-indigo-600 flex-1 flex items-center justify-center text-white text-[10px] font-bold px-2 truncate">
                                  <span>🌆 {seg.label}: {seg.time} {seg.duration ? `(${seg.duration})` : ''}</span>
                                </div>
                              );
                            }
                            return (
                              <div key={sIdx} className="bg-emerald-600 flex-1 flex items-center justify-center text-white text-[10px] font-bold px-2 truncate">
                                <span>⏱ {seg.label}: {seg.time} {seg.duration ? `(${seg.duration})` : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                        {row.rawPunchList && row.rawPunchList.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono overflow-x-auto">
                            <span className="font-semibold text-slate-600">Punch Logs:</span>
                            {row.rawPunchList.map((p, pIdx) => (
                              <span key={pIdx} className="bg-slate-200/70 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                                {formatTimeIST(p)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : row.isBeforeJoining ? (
                      <div className="py-2.5 px-4 text-center rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-center gap-2">
                        <span className="text-xs font-semibold text-amber-800">👤 Employee Not Joined Yet</span>
                      </div>
                    ) : row.isHoliday || row.status === 'HOLIDAY' ? (
                      <div className="py-2.5 px-4 text-center rounded-xl bg-purple-100/70 border border-purple-300 flex items-center justify-center gap-2">
                        <span className="text-xs font-bold text-purple-900">🏖️ Holiday: {row.holidayName} (Payable Holiday)</span>
                      </div>
                    ) : row.status === 'Weekly Off' || row.status === 'WO' ? (
                      <div className="py-2.5 px-4 text-center rounded-xl bg-indigo-100/70 border border-indigo-300 flex items-center justify-center gap-2">
                        <span className="text-xs font-bold text-indigo-900">🌴 Weekly Off (Payable Day Off)</span>
                      </div>
                    ) : row.status === 'Day Off' || row.status === 'DO' ? (
                      <div className="py-2.5 px-4 text-center rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center gap-2">
                        <span className="text-xs font-bold text-slate-800">📅 Day Off (Payable Day Off)</span>
                      </div>
                    ) : row.status === 'On Leave' ? (
                      <div className="py-2.5 px-4 text-center rounded-xl bg-sky-100/80 border border-sky-300 flex items-center justify-center gap-2">
                        <span className="text-xs font-bold text-sky-900">✈️ Approved Leave</span>
                      </div>
                    ) : (
                      <div className={`py-2 text-center rounded-xl border border-dashed ${isWeekendAbsent ? 'bg-red-100/70 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                        <span className="text-xs font-semibold text-red-600">Absent — No Punch Recorded</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'learning' ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              {learningLoading ? (
                <div className="py-12 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-indigo-600" />
                  <span className="text-xs font-semibold">Loading learning progress report...</span>
                </div>
              ) : learningSubmission ? (
                (() => {
                  const tasksList = learningSubmission.tasks || [];
                  const totalTasks = tasksList.length || 0;
                  const totalChecked = tasksList.filter(t => t.checked).length;
                  const totalNotOk = tasksList.filter(t => t.checked === false || t.status === 'Not OK' || t.status === 'bad').length;
                  const totalMissing = tasksList.filter(t => t.status === 'Missing' || t.status === 'miss').length;
                  const totalIssues = totalNotOk + totalMissing;
                  const deptList = ['EXCISE', 'RETAIL', 'SANCKS', 'STOCKS', 'WHOLESALE', 'TECHNICAL', 'IMP RETAIL/RETAIL /SANCKS'];

                  return (
                    <div className="space-y-4">
                      {/* Summary Banner with Badges */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Learning Task Checklist Submission</span>
                          <span className="text-sm font-bold text-slate-900 block mt-0.5">
                            {learningSubmission.shop_name || 'Shop Location'} • Submission Date: {learningSubmission.submission_date || '—'}
                          </span>
                        </div>

                        {/* Badges Format */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-500/30 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                            ✅ {totalChecked}/{totalTasks || 53} Checked
                          </span>
                          {totalNotOk > 0 && (
                            <span className="bg-red-50 text-red-600 border border-red-500/30 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                              ❌ {totalNotOk} Not OK
                            </span>
                          )}
                          {totalMissing > 0 && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-500/30 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1">
                              ⚠️ {totalMissing} Missing
                            </span>
                          )}
                          <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg border ${
                            totalIssues === 0 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}>
                            {totalIssues === 0 ? 'All Clear ✓' : `⚠️ ${totalIssues} Issue(s)`}
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#1C120C] text-[#d4b457] text-[10px] uppercase font-serif tracking-wider">
                              <th className="py-2.5 px-2">DEPT</th>
                              <th className="py-2.5 px-2 font-bold">LEVEL 1</th>
                              <th className="py-2.5 px-1 w-8 text-center">✓</th>
                              <th className="py-2.5 px-2 font-bold">LEVEL 2</th>
                              <th className="py-2.5 px-1 w-8 text-center">✓</th>
                              <th className="py-2.5 px-2 font-bold">LEVEL 3</th>
                              <th className="py-2.5 px-1 w-8 text-center">✓</th>
                              <th className="py-2.5 px-2 font-bold">LEVEL 4</th>
                              <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-800">
                            {deptList.map((dept) => {
                              const tasksByLevel = {
                                1: tasksList.filter((t) => t.dept === dept && t.level === 1),
                                2: tasksList.filter((t) => t.dept === dept && t.level === 2),
                                3: tasksList.filter((t) => t.dept === dept && t.level === 3),
                                4: tasksList.filter((t) => t.dept === dept && t.level === 4),
                              };
                              const maxRows = Math.max(
                                tasksByLevel[1].length,
                                tasksByLevel[2].length,
                                tasksByLevel[3].length,
                                tasksByLevel[4].length,
                                1
                              );

                              return Array.from({ length: maxRows }).map((_, rowIdx) => (
                                <tr key={`${dept}-${rowIdx}`} className={rowIdx === 0 ? 'border-t-2 border-slate-200 bg-slate-50/50' : 'hover:bg-slate-50'}>
                                  <td className="py-2 px-2 text-emerald-700 font-bold text-[11px] whitespace-nowrap align-top">
                                    {rowIdx === 0 ? dept : ''}
                                  </td>
                                  {[1, 2, 3, 4].map((lvl) => {
                                    const task = tasksByLevel[lvl][rowIdx];
                                    if (!task) return <React.Fragment key={lvl}><td/><td/></React.Fragment>;
                                    const isChecked = !!task.checked;
                                    return (
                                      <React.Fragment key={lvl}>
                                        <td className={`py-2 px-2 align-top max-w-[180px] ${isChecked ? 'bg-emerald-50/70 border border-emerald-200/80 rounded-sm' : ''}`}>
                                          <p className={`text-xs font-semibold leading-tight ${isChecked ? 'text-emerald-950 font-bold' : 'text-slate-800'}`}>
                                            {task.en}
                                          </p>
                                        </td>
                                        <td className="py-2 px-1 text-center align-top">
                                          <div className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs mx-auto ${isChecked ? 'bg-emerald-600 text-white' : 'bg-red-50 text-red-500 border border-red-200'}`}>
                                            {isChecked ? '✓' : '✕'}
                                          </div>
                                        </td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs font-bold text-slate-700">No Learning Checklist Submitted Yet</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  💳 Employee Payslip & Payroll History
                </h3>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Month / Year</th>
                      <th className="px-3.5 py-2.5">Base Salary</th>
                      <th className="px-3.5 py-2.5">Present Days</th>
                      <th className="px-3.5 py-2.5">Advances / Deductions</th>
                      <th className="px-3.5 py-2.5">Way Off</th>
                      <th className="px-3.5 py-2.5">Net Payable</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {payrollLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Loading payslip history...
                        </td>
                      </tr>
                    ) : payrollRecords && payrollRecords.length > 0 ? (
                      payrollRecords.map((payRecord) => {
                        const wayOffAmt = Number(payRecord.way_off || payRecord.way_off_deduction || 0);
                        const totalDeductions = (Number(payRecord.advance_deduction || payRecord.deduction || 0) + Number(payRecord.breakage_deduction || 0) + Number(payRecord.medical_deduction || 0) + Number(payRecord.rto_deduction || 0));
                        const proratedVal = Number(payRecord.prorated_salary || payRecord.base_salary || payRecord.salary || 0);
                        const seasonalVal = Number(payRecord.seasonal_bonus || 0);
                        const referralVal = Number(payRecord.referral_bonus || 0);
                        const netPayable = Math.max(0, Math.round(proratedVal - totalDeductions + seasonalVal + referralVal + wayOffAmt));
                        return (
                          <tr key={payRecord.id || `${payRecord.year}-${payRecord.month}`} className="hover:bg-slate-50">
                            <td className="px-3.5 py-2.5 font-bold text-slate-900">{payRecord.month} {payRecord.year}</td>
                            <td className="px-3.5 py-2.5">₹{Number(payRecord.base_salary || payRecord.salary || 0).toLocaleString()}</td>
                            <td className="px-3.5 py-2.5">{payRecord.total_present || payRecord.present_days || payRecord.working_days || 0} Days</td>
                            <td className="px-3.5 py-2.5 text-rose-600">-₹{totalDeductions.toLocaleString()}</td>
                            <td className="px-3.5 py-2.5 text-emerald-600 font-semibold">{wayOffAmt > 0 ? `+₹${wayOffAmt.toLocaleString()}` : '-'}</td>
                            <td className="px-3.5 py-2.5 font-bold text-emerald-600">₹{netPayable.toLocaleString()}</td>
                            <td className="px-3.5 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${(payRecord.payout_status || payRecord.status)?.toLowerCase() === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {payRecord.payout_status || payRecord.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No payroll history records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
