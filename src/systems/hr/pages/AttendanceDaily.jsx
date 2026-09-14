import React, { useEffect, useState, useCallback } from 'react';
import { Search, Download, Calendar, Loader2, CheckCircle, X, Clock, Pencil, Filter, Users, User, Clock as ClockIcon, TrendingUp, Database, RefreshCw, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Plus, ChevronDown, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const DEVICES = [
  { name: 'ALL DEVICES', serial: 'ALL', apiName: 'ALL' },
  { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
  { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
  { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
  { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
  { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' },
  { name: 'KHARGHAR', apiName: 'KHARGHAR', serial: 'AMDB25120600859' }
];

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';

// Resolve store location from punch attendance log device serial or device_id
const resolvePunchedStore = (attendance, deviceMapping = []) => {
  if (!attendance) return null;
  const serial = (attendance.serial_number || attendance.serialNo || '').toString().trim();

  if (serial && serial !== '-' && serial !== 'ALL') {
    const matchedDevice = DEVICES.find(d => d.serial && d.serial.toString().trim().toLowerCase() === serial.toLowerCase());
    if (matchedDevice && matchedDevice.name !== 'ALL DEVICES') {
      return matchedDevice.name;
    }
    if (deviceMapping && deviceMapping.length > 0) {
      const matchedMapping = deviceMapping.find(m => m.serialNo && m.serialNo.toString().trim().toLowerCase() === serial.toLowerCase());
      if (matchedMapping && matchedMapping.storeName) {
        return matchedMapping.storeName;
      }
    }
  }

  if (attendance.store_name && attendance.store_name !== '-') {
    return attendance.store_name.toString().trim();
  }

  return null;
};


// IST Timezone offset (UTC+5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

// Format to ISO string in its original timezone (no offset)
const formatToISTISOString = (timeStr) => {
  if (!timeStr || timeStr === '-') return null;
  if (timeStr instanceof Date) {
    const tzoffset = timeStr.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(timeStr.getTime() - tzoffset)).toISOString().slice(0, -1);
    return localISOTime;
  }

  let formatted = timeStr.trim().replace(' ', 'T');
  if (formatted.includes('+')) {
    formatted = formatted.split('+')[0];
  } else if (formatted.endsWith('Z')) {
    formatted = formatted.slice(0, -1);
  }

  const timeParts = formatted.split('T')[1] || '';
  if (timeParts.split(':').length === 2) {
    formatted = formatted + ':00';
  }
  return formatted;
};

// Parse a date-time string assuming it represents a time in IST
const parseISTToDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return null;
  try {
    let cleanStr = dateStr;
    if (cleanStr.includes('+')) {
      cleanStr = cleanStr.split('+')[0];
    } else if (cleanStr.endsWith('Z')) {
      cleanStr = cleanStr.slice(0, -1);
    }

    let formatted = cleanStr.trim().replace(' ', 'T');
    const timeParts = formatted.split('T')[1] || '';
    if (timeParts.split(':').length === 2) {
      formatted = formatted + ':00';
    }
    formatted = formatted + '+05:30';
    const d = new Date(formatted);
    if (!isNaN(d.getTime())) return d;
    return null;
  } catch (e) {
    return null;
  }
};

// Convert UTC to IST
const convertUTCToIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  const d = parseISTToDate(utcDateStr);
  return d || utcDateStr;
};

// Format time in IST
const formatTimeIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return utcDateStr;
  }
};

// Convert 12h time string (e.g., '10:00 AM') to 24h format (e.g., '10:00')
const convert12hTo24h = (time12h) => {
  if (!time12h || time12h === '-') return "";
  try {
    const cleanStr = time12h.trim().replace(/\u202f|\u00a0/g, ' ').replace(/\s+/g, ' ');
    const parts = cleanStr.split(' ');
    if (parts.length < 2) return "";
    const timeParts = parts[0].split(':');
    let hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const ampm = parts[1].toUpperCase();

    if (ampm === 'PM' && hour < 12) {
      hour += 12;
    } else if (ampm === 'AM' && hour === 12) {
      hour = 0;
    }

    const hh = hour.toString().padStart(2, '0');
    const mm = minute.toString().padStart(2, '0');
    return `${hh}:${mm}`;
  } catch (e) {
    return "";
  }
};

// Convert 24h time string (e.g., '14:00') to 12h AM/PM format (e.g., '2:00 PM')
const convert24hTo12h = (time24) => {
  if (!time24 || time24 === '-') return "";
  try {
    const trimmed = time24.trim();
    if (trimmed.toLowerCase().includes('am') || trimmed.toLowerCase().includes('pm')) {
      return trimmed.replace(/\s+/g, ' ');
    }
    const parts = trimmed.split(':');
    if (parts.length < 2) return trimmed;
    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (isNaN(hour) || isNaN(minute)) return trimmed;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const mm = minute.toString().padStart(2, '0');
    return `${hour}:${mm} ${ampm}`;
  } catch (e) {
    return time24;
  }
};

// Format full date-time in IST
const formatDateTimeIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(d);

    const getVal = (type) => parts.find(p => p.type === type).value;
    return `${getVal('year')}-${getVal('month')}-${getVal('day')} ${getVal('hour')}:${getVal('minute')}:${getVal('second')}`;
  } catch (e) {
    return utcDateStr;
  }
};

// Format date for display (without time)
const formatDateIST = (utcDateStr) => {
  if (!utcDateStr || utcDateStr === '-') return '-';
  try {
    const d = parseISTToDate(utcDateStr);
    if (!d) return utcDateStr;

    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);

    const getVal = (type) => parts.find(p => p.type === type).value;
    return `${getVal('year')}-${getVal('month')}-${getVal('day')}`;
  } catch (e) {
    return utcDateStr;
  }
};

// Status colors and labels - compact version
const STATUS_CONFIG = {
  'Present': { color: 'bg-green-100 text-green-700', label: 'P', fullLabel: 'Present', bgColor: 'bg-green-200/60' },
  'Late': { color: 'bg-orange-100 text-orange-700', label: 'L', fullLabel: 'Late', bgColor: 'bg-orange-200/60' },
  'Absent': { color: 'bg-red-100 text-red-700', label: 'A', fullLabel: 'Absent', bgColor: 'bg-red-200/40' },
  'Half Day': { color: 'bg-yellow-100 text-yellow-700', label: 'H', fullLabel: 'Half Day', bgColor: 'bg-yellow-200/60' },
  'Holiday': { color: 'bg-purple-100 text-purple-700', label: 'Hol', fullLabel: 'Holiday', bgColor: 'bg-purple-200' },
  'Weekly Off': { color: 'bg-indigo-100 text-indigo-700', label: 'WO', fullLabel: 'Weekly Off', bgColor: 'bg-indigo-100/60' },
  'Day Off': { color: 'bg-gray-100 text-gray-700', label: 'DO', fullLabel: 'Day Off', bgColor: 'bg-gray-200' },
  'On Leave': { color: 'bg-blue-100 text-blue-700', label: 'Lv', fullLabel: 'On Leave', bgColor: 'bg-blue-200' },
  'Future': { color: 'bg-transparent border-transparent', label: '-', fullLabel: '', bgColor: 'bg-transparent' }
};

const AttendanceDaily = () => {
  const getLocalDateString = (date = new Date()) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayDate = getLocalDateString();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(DEVICES[0]);
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [attendanceData, setAttendanceData] = useState([]);
  const [viewMode, setViewMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [employeesData, setEmployeesData] = useState([]); // Store employees table data
  const [matchFilter, setMatchFilter] = useState('ALL'); // 'ALL', 'MATCHED', 'UNMATCHED'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'Present', 'Late', 'Absent', 'Half Day'
  const [currentPage, setCurrentPage] = useState(1);
  const [rosterData, setRosterData] = useState([]); // Store shift_roster data

  // Reset page to 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStore, matchFilter, statusFilter, selectedDate]);

  const handleDateChange = (dateStr) => {
    if (!dateStr) return;
    setSelectedDate(dateStr);
    const newDateObj = new Date(dateStr);
    if (!isNaN(newDateObj.getTime())) {
      if (newDateObj.getMonth() !== currentMonth.getMonth() || newDateObj.getFullYear() !== currentMonth.getFullYear()) {
        setCurrentMonth(newDateObj);
      }
    }
  };
  const [employees, setEmployees] = useState([]);
  const [rawLogs, setRawLogs] = useState([]);
  const [joiningData, setJoiningData] = useState([]);
  const [deviceMapping, setDeviceMapping] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [tempStatus, setTempStatus] = useState('');
  const [tempInTime, setTempInTime] = useState('');
  const [tempOutTime, setTempOutTime] = useState('');
  const [tempManualPunches, setTempManualPunches] = useState({ "1": "", "2": "", "3": "", "4": "", "5": "", "6": "" });
  const [newPunchTime, setNewPunchTime] = useState('');
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Preview Window State (Profile Avatar Click Overview Modal)
  const [previewModal, setPreviewModal] = useState({
    isOpen: false,
    employee: null,
    month: new Date(),
    tab: 'timecard', // 'timecard' or 'timeline'
    loading: false
  });

  const openPreviewWindow = (employee) => {
    setPreviewModal({
      isOpen: true,
      employee,
      month: new Date(currentMonth),
      tab: 'timecard',
      loading: false
    });
  };

  // Manual attendance marking state
  const [isMarkModalOpen, setIsMarkModalOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [markEmployeeId, setMarkEmployeeId] = useState('');
  const [markStatus, setMarkStatus] = useState('Present');
  const [markInTime, setMarkInTime] = useState('');
  const [markOutTime, setMarkOutTime] = useState('');
  const [markEmployeeSearch, setMarkEmployeeSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [leavesData, setLeavesData] = useState([]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.employee-select-container')) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await Promise.all([
        fetchEmployeesTable(),
        fetchRosterData(null, selectedDate),
        fetchLeavesData(),
        syncDeviceLogs()
      ]);
    } catch (err) {
      console.error('Error refreshing data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch employees from hr_management_employees table
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
      return allEmployeesData;
    } catch (error) {
      console.error('Error fetching hr_management_employees table:', error);
      return [];
    }
  };

  // Check if employee exists in employees table
  const isEmployeeInTable = (employeeId) => {
    if (!employeeId) return false;
    const cleanId = employeeId.toString().trim().toLowerCase();
    return employeesData.some(emp => {
      const empId = emp.id?.toString().trim().toLowerCase();
      const empEmployeeId = emp.employee_id?.toString().trim().toLowerCase();
      return empId === cleanId || empEmployeeId === cleanId;
    });
  };

  // Fetch roster data from shift_roster table
  const fetchRosterData = async (employeeId, dateStr) => {
    try {
      const parsedDate = dateStr ? new Date(dateStr) : currentMonth;
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const startDayStr = `${year}-${month}-01`;
      const lastDay = new Date(year, parsedDate.getMonth() + 1, 0).getDate();
      const endDayStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('hr_management_shift_roster')
        .select('*')
        .gte('date', startDayStr)
        .lte('date', endDayStr);

      if (error) throw error;
      setRosterData(data || []);
    } catch (error) {
      console.error('Error fetching roster data:', error);
    }
  };

  // Get roster for an employee on a specific date
  const getEmployeeRoster = (employeeId, date) => {
    if (!rosterData || rosterData.length === 0) return null;
    return rosterData.find(r =>
      (r.employee_id?.toString().toLowerCase() === employeeId?.toString().toLowerCase()) &&
      (r.date === date)
    );
  };

  // Fetch leaves from hr_management_leaves
  const fetchLeavesData = async () => {
    try {
      const { data, error } = await supabase
        .from('hr_management_leaves')
        .select('*');
      if (!error && data) {
        setLeavesData(data);
      }
    } catch (e) {
      console.warn('Could not fetch leaves data:', e);
    }
  };

  // Helper to find leave info or reason for an absent streak
  const getLeaveInfoForStreak = (employeeId, startFullDate, endFullDate, streak = []) => {
    // 1. Check leave applications from hr_management_leaves table
    if (leavesData && leavesData.length > 0) {
      const cleanId = employeeId?.toString().trim().toLowerCase();

      const matched = leavesData.find(l => {
        const lEmpId = (l.employee_id || l.employeeId)?.toString().trim().toLowerCase();
        if (lEmpId !== cleanId) return false;
        const from = l.from_date || l.fromDate;
        const to = l.to_date || l.toDate;
        if (!from || !to) return false;
        return from <= endFullDate && to >= startFullDate;
      });

      if (matched && (matched.reason || matched.remarks || matched.leave_type || matched.leaveType)) {
        return {
          reason: matched.reason || matched.remarks || null,
          leaveType: matched.leave_type || matched.leaveType || null
        };
      }
    }

    // 2. Check individual attendance records within the streak for reasons or remarks
    if (streak && streak.length > 0) {
      for (const item of streak) {
        const att = item.attendance;
        if (att) {
          const reason = att.reason || att.remarks || att.notes || att.note || att.punchMissReason;
          if (reason) {
            return {
              reason: reason,
              leaveType: att.leave_type || att.status || null
            };
          }
        }
      }
    }

    return { reason: null, leaveType: null };
  };

  // Format short date (e.g. "5 Jun")
  const formatDateRangeDisplay = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthShort = shortMonths[parseInt(m, 10) - 1] || '';
      return `${parseInt(d, 10)} ${monthShort}`;
    } catch (e) {
      return dateStr;
    }
  };

  const formatTime12h = (dateStr) => {
    if (!dateStr || dateStr === '-') return '-';
    try {
      if (dateStr.includes('AM') || dateStr.includes('PM')) {
        return dateStr;
      }
      return formatTimeIST(dateStr);
    } catch (e) {
      return dateStr;
    }
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const istDate = convertUTCToIST(dateStr);
      if (istDate === '-' || typeof istDate === 'string') return dateStr;
      return istDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const calculateHoursMins = (diffMs) => {
    if (!diffMs || isNaN(diffMs) || diffMs <= 0) return '00:00:00';
    const totalSecs = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper to check if a time is before 9:00 AM (09:00 IST)
  const isBefore9AM = (timeStr) => {
    if (!timeStr || timeStr === '-') return false;
    try {
      const d = parseISTToDate(timeStr);
      if (!d) {
        // Fallback for simple time strings like "08:30 AM"
        const clean = timeStr.trim().toUpperCase();
        const isAM = clean.endsWith('AM');
        const isPM = clean.endsWith('PM');
        let timePart = clean;
        if (isAM || isPM) timePart = clean.slice(0, -2).trim();
        const [hStr] = timePart.split(':');
        let h = parseInt(hStr, 10);
        if (isAM && h === 12) h = 0;
        if (isPM && h < 12) h += 12;
        return h < 9;
      }
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).formatToParts(d);
      const getVal = (type) => parts.find(p => p.type === type)?.value;
      const h = parseInt(getVal('hour'), 10);
      return h < 9;
    } catch (e) {
      return false;
    }
  };

  // Clamps In-Time: No longer force-clamping to 10:00 AM; returns as-is if after 9:00 AM
  const clampInTimeTo10AM = (timeStr, dateContext = '') => {
    if (!timeStr || timeStr === '-') return timeStr;
    if (isBefore9AM(timeStr)) return '-';
    return timeStr;
  };

  // Helper to map any log between 11:30 PM and 11:59 PM to 11:00 PM
  const map1130PMTo11PM = (timeStr) => {
    if (!timeStr || timeStr === '-') return timeStr;
    try {
      const d = parseISTToDate(timeStr);
      if (!d) {
        const clean = timeStr.trim().toUpperCase();
        const isPM = clean.endsWith('PM');
        let timePart = clean;
        if (isPM || clean.endsWith('AM')) timePart = clean.slice(0, -2).trim();
        const [hStr, mStr] = timePart.split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10) || 0;
        if (isPM && h < 12) h += 12;
        if (h === 23 && m >= 30) {
          return '11:00 PM';
        }
        return timeStr;
      }
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).formatToParts(d);
      const getVal = (type) => parts.find(p => p.type === type)?.value;
      const h = parseInt(getVal('hour'), 10);
      const m = parseInt(getVal('minute'), 10);
      if (h === 23 && m >= 30) {
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T23:00:00`;
      }
      return timeStr;
    } catch (e) {
      return timeStr;
    }
  };

  // Clamps Out-Time to 11:00 PM (23:00) if it is between 11:30 PM and 11:59 PM or after
  const clampOutTimeTo11PM = (timeStr, dateContext = '') => {
    if (!timeStr || timeStr === '-') return timeStr;
    return map1130PMTo11PM(timeStr);
  };

  // Normalizes attendance record: Filters pre-9 AM punches and assigns first valid punch (>= 9 AM) as 1st Punch In
  const normalizeAttendanceRecord = (record) => {
    if (!record) return record;
    let modified = { ...record };

    // Parse punch log if present
    let punchList = [];
    if (modified.punch_log && modified.punch_log !== '-') {
      punchList = modified.punch_log
        .split(/\s*\|\s*/)
        .filter(Boolean)
        .map(p => map1130PMTo11PM(p));
    }

    // Filter valid day punches (>= 9:00 AM) - logs between 12 AM to 9 AM are invalid
    const validDayPunches = punchList.filter(p => !isBefore9AM(p));

    // When punch between 12 AM and 9 AM is invalid, assign the first valid punch (>= 9 AM) as 1st Punch In
    if (validDayPunches.length > 0) {
      const firstDayPunch = validDayPunches[0];
      if (modified.attendance_date) {
        const clean = firstDayPunch.trim().toUpperCase();
        const isPM = clean.endsWith('PM');
        const isAM = clean.endsWith('AM');
        let timePart = clean;
        if (isPM || isAM) timePart = clean.slice(0, -2).trim();
        const [hStr, mStr] = timePart.split(':');
        let h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10) || 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        const formattedH = String(h).padStart(2, '0');
        const formattedM = String(m).padStart(2, '0');
        modified.in_time = `${modified.attendance_date}T${formattedH}:${formattedM}:00`;
      }
      if (modified.status === 'Absent' || !modified.status) {
        modified.status = 'Present';
      }
    } else if (modified.in_time && modified.in_time !== '-') {
      if (isBefore9AM(modified.in_time)) {
        modified.in_time = '-';
        modified.status = 'Absent';
      } else if (modified.status === 'Absent' || !modified.status) {
        modified.status = 'Present';
      }
    }

    // If employee forgot to punch out (missing out_time or odd punches):
    // Wait until 11:30 PM of that date. If past 11:30 PM or past date and employee did not punch out,
    // set punch out time to their last valid punch (or in_time if only 1 punch existed).
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isPast1130PM = currentMins >= (23 * 60 + 30);
    const isPastDate = modified.attendance_date && modified.attendance_date < todayStr;
    const isTodayPastCutoff = modified.attendance_date === todayStr && isPast1130PM;

    if (!modified.out_time || modified.out_time === '-' || modified.out_time === modified.in_time || validDayPunches.length % 2 === 1) {
      if (modified.in_time && modified.in_time !== '-') {
        if (isPastDate || isTodayPastCutoff) {
          // If multiple punches exist for the day, use the last valid punch as out_time; otherwise fallback to in_time
          if (validDayPunches.length > 1 && modified.attendance_date) {
            const lastPunch = validDayPunches[validDayPunches.length - 1];
            const clean = lastPunch.trim().toUpperCase();
            const isPM = clean.endsWith('PM');
            const isAM = clean.endsWith('AM');
            let timePart = clean;
            if (isPM || isAM) timePart = clean.slice(0, -2).trim();
            const [hStr, mStr] = timePart.split(':');
            let h = parseInt(hStr, 10);
            const m = parseInt(mStr, 10) || 0;
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
            const formattedH = String(h).padStart(2, '0');
            const formattedM = String(m).padStart(2, '0');
            modified.out_time = `${modified.attendance_date}T${formattedH}:${formattedM}:00`;
          } else {
            modified.out_time = modified.in_time;
          }
          modified.punch_miss = 'No';
        } else {
          // Still waiting before 11:30 PM today: keep out_time pending (-)
          modified.out_time = '-';
        }
      }
    }

    // 3. Clamp out_time to 11:00 PM if after 11:00 PM
    if (modified.out_time && modified.out_time !== '-') {
      const clampedOut = clampOutTimeTo11PM(modified.out_time);
      if (clampedOut !== modified.out_time) {
        modified.out_time = clampedOut;
      }
    }

    // Recompute working hours with exact punch times (deducting lunch duration if present)
    if (modified.in_time && modified.out_time && modified.in_time !== '-' && modified.out_time !== '-') {
      modified.working_hour = calculateWorkHours(modified.in_time, modified.out_time, modified.attendance_date, modified.standard_lunch);
    }

    return modified;
  };

  const parseDurationMs = (durStr) => {
    if (!durStr || durStr === '-') return 0;
    try {
      const parts = durStr.trim().split(':').map(Number);
      if (parts.length === 3) {
        return ((parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)) * 1000;
      } else if (parts.length === 2) {
        return ((parts[0] || 0) * 3600 + (parts[1] || 0) * 60) * 1000;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  const calculateWorkHours = (inStr, outStr, dateContext = '', lunchStr = '-') => {
    if (!inStr || !outStr || inStr === '-' || outStr === '-' || inStr === outStr) return '00:00:00';
    if (isBefore9AM(inStr)) return '00:00:00';
    try {
      const clampedOut = clampOutTimeTo11PM(outStr, dateContext);
      const inDate = parseISTToDate(inStr);
      const outDate = parseISTToDate(clampedOut);
      if (!inDate || !outDate || outDate <= inDate) return '00:00:00';
      
      let totalMs = outDate - inDate;
      const lunchMs = parseDurationMs(lunchStr);
      const netWorkMs = Math.max(0, totalMs - lunchMs);
      return calculateHoursMins(netWorkMs);
    } catch (e) {
      return '00:00:00';
    }
  };

  const calculateLateMinutes = (inStr, dateContext = '', shift = null) => {
    if (!inStr || inStr === '-') return 0;
    try {
      const inDate = parseISTToDate(inStr);
      if (!inDate) return 0;

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(inDate);

      const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
      const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
      const totalMinutes = hour * 60 + minute;

      let officialStartTime = 10 * 60 + 0;
      let graceTimeThreshold = 10 * 60 + 10;

      if (shift?.start_time) {
        const [shiftH, shiftM] = shift.start_time.split(':').map(Number);
        officialStartTime = shiftH * 60 + shiftM;
        graceTimeThreshold = officialStartTime + 10;
      }

      if (totalMinutes >= graceTimeThreshold) {
        return totalMinutes - officialStartTime;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  // Save attendance to Supabase using UPSERT
  const saveAttendanceToDB = async (aggregatedData) => {
    if (!aggregatedData || aggregatedData.length === 0) return [];

    try {
      const dates = [...new Set(aggregatedData.map(item => item.Date))];

      // Fetch existing logs for these dates to preserve manual_punches
      const { data: existingLogs } = await supabase
        .from('hr_management_attendance_logs')
        .select('*')
        .in('attendance_date', dates);

      const rows = aggregatedData.map(item => {
        const existing = existingLogs?.find(
          r => String(r.employee_id).trim() === String(item.EmployeeID).trim() && r.attendance_date === item.Date
        );

        if (existing && existing.manual_punches && (existing.manual_punches.is_manual === true || existing.manual_punches.manual_override === true)) {
          return {
            employee_id: existing.employee_id,
            employee_name: existing.employee_name,
            attendance_date: existing.attendance_date,
            day: existing.day,
            designation: existing.designation,
            store_name: existing.store_name,
            device_id: existing.device_id,
            serial_number: existing.serial_number,
            in_time: existing.in_time,
            out_time: existing.out_time,
            working_hour: existing.working_hour,
            overtime: existing.overtime,
            late_minute: existing.late_minute,
            status: existing.status,
            standard_lunch: existing.standard_lunch,
            waste_time: existing.waste_time,
            punch_log: item.PunchLog, // update to latest API logs
            punch_log_status: item.PunchLogStatus, // update to latest API logs
            punch_miss: existing.punch_miss,
            punch_miss_msg: existing.punch_miss_msg,
            manual_punches: existing.manual_punches,
            updated_at: new Date()
          };
        }

        const apiManualPunches = {
          "1": "",
          "2": "",
          "3": "",
          "4": "",
          "5": ""
        };
        if (item.RawLogs) {
          item.RawLogs.forEach((logStr, idx) => {
            if (idx < 5) {
              try {
                const timePart = logStr.split(' ')[1] || '';
                apiManualPunches[(idx + 1).toString()] = timePart.substring(0, 5);
              } catch (e) {
                // ignore
              }
            }
          });
        }

        return {
          employee_id: item.EmployeeID,
          employee_name: item.EmployeeName,
          attendance_date: item.Date,
          day: item.Day,
          designation: item.Designation,
          store_name: item.StoreName,
          device_id: item.DeviceID,
          serial_number: item.AssignedSerial || item.SerialNumber,
          in_time: formatToISTISOString(item.InTime),
          out_time: formatToISTISOString(item.OutTime),
          working_hour: item.WorkingHour,
          overtime: item.Overtime,
          late_minute: item.LateMinute,
          status: item.Status,
          standard_lunch: item.StandardLunch,
          waste_time: item.WasteTime,
          punch_log: item.PunchLog,
          punch_log_status: item.PunchLogStatus,
          punch_miss: item.PunchMiss,
          punch_miss_msg: item.PunchMissMsg,
          manual_punches: apiManualPunches,
          updated_at: new Date()
        };
      });

      const { data, error } = await supabase
        .from('hr_management_attendance_logs')
        .upsert(rows, {
          onConflict: 'employee_id,attendance_date',
          ignoreDuplicates: false
        })
        .select();

      if (error) throw error;

      console.log(`UPSERT complete: ${data?.length || 0} rows affected`);
      return data || [];
    } catch (err) {
      console.error('Error saving to Supabase:', err);
      throw err;
    }
  };

  // Sync only changed rows to Google Sheet
  const syncToMachineDataSheet = async (changedRows) => {
    if (!changedRows || changedRows.length === 0) return;

    setSyncing(true);
    setSyncProgress(0);
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz009j6fH3ADRbVJYJGt2QnXu6si3isPR3CHvtv06W7DOEret6CEiJWc_PbDcKY5SSs/exec';
    const SPECIFIED_SPREADSHEET_ID = '1lg8cvRaYHpnR75bWxHoh-a30-gGL94-_WAnE7Zue6r8';

    let successCount = 0;
    let failCount = 0;
    const batchSize = 5;

    for (let i = 0; i < changedRows.length; i += batchSize) {
      const batch = changedRows.slice(i, i + batchSize);

      await Promise.all(batch.map(async (item) => {
        const formatTimeForSheet = (time) => {
          if (!time) return '-';
          return formatTimeIST(time);
        };

        const rowData = [
          item.employee_id || item.EmployeeID || '-',
          item.employee_name || item.EmployeeName || '-',
          item.attendance_date || item.Date || '-',
          formatTimeForSheet(item.in_time || item.InTime),
          formatTimeForSheet(item.out_time || item.OutTime),
          item.working_hour || item.WorkingHour || '-',
          item.store_name || item.StoreName || '-'
        ];

        try {
          const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              sheetName: 'Formatted_Attendance',
              spreadsheetId: SPECIFIED_SPREADSHEET_ID,
              action: 'insert',
              rowData: JSON.stringify(rowData)
            })
          });
          const text = await response.text();
          let result = {};
          try {
            result = JSON.parse(text);
          } catch (jsonErr) {
            console.warn('Google Apps Script returned non-JSON response:', text.substring(0, 100));
          }
          if (result.success) successCount++;
          else failCount++;
        } catch (err) {
          console.error('Sync failed for row:', item, err);
          failCount++;
        }
      }));

      setSyncProgress(Math.round((Math.min(i + batchSize, changedRows.length) / changedRows.length) * 100));
    }

    setSyncing(false);
    if (successCount > 0) {
      console.log(`Synced ${successCount} changed records to Formatted_Attendance Sheet. ${failCount} failed.`);
    }
  };

  // Fetch attendance from Supabase
  const fetchAttendanceFromDB = async (targetMonth = currentMonth) => {
    setLoading(true);
    try {
      const startOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
      const endOfMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

      const startDateStr = getLocalDateString(startOfMonth);
      const endDateStr = getLocalDateString(endOfMonth);

      // Paginated fetch for month data to bypass server-side 1000 row limits
      let monthData = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('hr_management_attendance_logs')
          .select('*')
          .gte('attendance_date', startDateStr)
          .lte('attendance_date', endDateStr)
          .order('attendance_date', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          monthData = [...monthData, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      // Fetch today's data
      const { data: todayDataRaw, error: todayError } = await supabase
        .from('hr_management_attendance_logs')
        .select('*')
        .eq('attendance_date', todayDate)
        .order('employee_name', { ascending: true });

      if (todayError) throw todayError;
      const todayData = todayDataRaw || [];

      const withoutToday = monthData.filter(r => r.attendance_date !== todayDate);
      const mergedRaw = [...withoutToday, ...todayData];
      const merged = mergedRaw.map(normalizeAttendanceRecord);

      console.log('🔍 [fetchAttendanceFromDB] Debugging Info:', {
        todayDate,
        startDateStr,
        endDateStr,
        monthDataLength: monthData.length,
        todayDataLength: todayData.length,
        withoutTodayLength: withoutToday.length,
        mergedLength: merged.length,
        recordsOnJune28: merged.filter(r => r.attendance_date === '2026-06-28')
      });

      setAttendanceData(merged);

      const uniqueEmployees = [
        ...new Map(
          merged.map(item => [item.employee_id, {
            id: item.employee_id,
            name: item.employee_name,
            designation: item.designation,
            store_name: item.store_name
          }])
        ).values()
      ];

      setEmployees(uniqueEmployees);

      // Fetch roster data for the selected month
      await fetchRosterData(null, startDateStr);
      await fetchLeavesData();

      console.log(`Loaded ${merged.length} records (month: ${withoutToday.length} + today: ${todayData.length})`);
    } catch (err) {
      console.error('Error fetching from Supabase:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      // 1. Fetch all employees from the 'hr_management_employees' table (matched employees)
      let dbEmployees = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('hr_management_employees')
          .select('employee_id, name_as_per_aadhar, designation, joining_company_name, joining_place')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          dbEmployees = [...dbEmployees, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      const verifiedIds = new Set(dbEmployees.map(emp => emp.employee_id?.toString().trim().toLowerCase()).filter(Boolean));

      // 2. Fetch unique employees from the 'attendance_logs' table (for unmatched employees)
      let allLogs = [];
      page = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('hr_management_attendance_logs')
          .select('employee_id, employee_name, designation, store_name')
          .not('employee_id', 'is', null)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allLogs = [...allLogs, ...data];
          if (data.length < pageSize) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          hasMore = false;
        }
      }

      const logEmployeesMap = new Map();
      allLogs.forEach(log => {
        const empId = log.employee_id?.toString().trim();
        if (empId) {
          logEmployeesMap.set(empId.toLowerCase(), {
            employee_id: empId,
            employee_name: log.employee_name,
            designation: log.designation,
            store_name: log.store_name
          });
        }
      });

      const unmatchedEmployees = [];
      for (const [key, logEmp] of logEmployeesMap.entries()) {
        if (!verifiedIds.has(key)) {
          unmatchedEmployees.push({
            employee_id: logEmp.employee_id,
            employee_name: logEmp.employee_name || 'Unmatched Employee',
            designation: logEmp.designation || '-',
            store_name: logEmp.store_name || '-',
            is_matched: false
          });
        }
      }

      const matchedEmployees = dbEmployees.map(emp => ({
        employee_id: emp.employee_id,
        employee_name: emp.user_name || emp.name_as_per_aadhar || 'No Name',
        designation: emp.Designation || emp.designation || '-',
        store_name: emp.shop_name || emp.joining_place || '-',
        is_matched: true
      }));

      const combinedEmployees = [...matchedEmployees, ...unmatchedEmployees];
      setAllEmployees(combinedEmployees);

    } catch (err) {
      console.error('Error fetching attendance employees:', err);
    }
  };

  useEffect(() => {
    if (isMarkModalOpen) {
      fetchAllEmployees();
    }
  }, [isMarkModalOpen]);

  useEffect(() => {
    if (isMarkModalOpen) {
      setMarkEmployeeId('');
      setMarkStatus('Present');
      setMarkInTime(`${selectedDate}T10:00`);
      setMarkOutTime(`${selectedDate}T18:00`);
      setMarkEmployeeSearch('');
      setIsDropdownOpen(false);
    }
  }, [isMarkModalOpen, selectedDate]);

  const handleMarkSubmit = async (e) => {
    e.preventDefault();
    if (!markEmployeeId) {
      alert('Please select an employee');
      return;
    }

    try {
      let manualPunches = null;
      if (markStatus !== 'Absent') {
        const getHM = (timeStr) => {
          if (!timeStr) return '';
          const parts = timeStr.split('T');
          const timePart = parts[1] || parts[0];
          return timePart.substring(0, 5); // Ensure HH:MM format
        };
        manualPunches = {
          "1": getHM(markInTime) ? convert24hTo12h(getHM(markInTime)) : "",
          "2": getHM(markOutTime) ? convert24hTo12h(getHM(markOutTime)) : "",
          "3": "",
          "4": "",
          "5": "",
          "6": ""
        };
      } else {
        manualPunches = {
          "absent": true
        };
      }

      await updateAttendanceStatus(
        markEmployeeId,
        selectedDate,
        markStatus,
        markStatus === 'Absent' ? null : markInTime,
        markStatus === 'Absent' ? null : markOutTime,
        manualPunches
      );
      setIsMarkModalOpen(false);
    } catch (err) {
      console.error('Error marking attendance:', err);
    }
  };

  // Sync device logs helper for custom date range
  const syncLogsForRange = async (queryStart, queryEnd, targetMonth = currentMonth) => {
    setLoading(true);
    setError(null);

    try {
      let currentJoining = joiningData;
      if (joiningData.length === 0) {
        try {
          const jResponse = await fetch(JOINING_API_URL);
          if (jResponse.ok) {
            const jText = await jResponse.text();
            if (jText && !jText.trim().startsWith('<')) {
              const jResult = JSON.parse(jText);
              if (jResult && jResult.success) {
                const rawRows = jResult.data || jResult;
                const headers = rawRows[5] || [];
                const dataRows = rawRows.slice(6);

                const getIdx = (name) => headers.findIndex(h => h && h.toString().trim().toLowerCase() === name.toLowerCase());
                const empIdIdx = getIdx('Employee ID');
                const nameIdx = getIdx('Name As Per Aadhar');
                const desIdx = getIdx('Designation');
                const storeIdx = getIdx('Joining Place');

                currentJoining = dataRows.map(r => ({
                  id: r[empIdIdx]?.toString().trim(),
                  name: r[nameIdx]?.toString().trim(),
                  designation: r[getIdx('Designation')]?.toString().trim() || r[desIdx]?.toString().trim(),
                  store: r[getIdx('Joining Place')]?.toString().trim() || r[storeIdx]?.toString().trim()
                })).filter(h => h.id);
                setJoiningData(currentJoining);
              }
            }
          }
        } catch (e) {
          console.warn('Could not fetch joining sheet:', e);
        }
      }

      const MASTER_MAP_URL = `https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch`;
      try {
        const dmResponse = await fetch(MASTER_MAP_URL);
        if (dmResponse.ok) {
          const dmText = await dmResponse.text();
          if (dmText && !dmText.trim().startsWith('<')) {
            const dmResult = JSON.parse(dmText);
            if (dmResult && dmResult.success) {
              const rows = dmResult.data.slice(1);
              const currentMapping = rows.map(r => ({
                userId: r[5]?.toString().trim(),
                name: r[6]?.toString().trim(),
                deviceId: r[7]?.toString().trim(),
                serialNo: r[8]?.toString().trim(),
                storeName: r[9]?.toString().trim()
              }));
              setDeviceMapping(currentMapping);
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch master map sheet:', e);
      }

      let rawLogsData = [];
      const DEVICE_LOG_API_BASE = 'http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs';
      if (selectedDevice.name === 'ALL DEVICES') {
        const otherDevices = DEVICES.filter(d => d.name !== 'ALL DEVICES');
        const allResponses = await Promise.all(
          otherDevices.map(async (device) => {
            try {
              const url = `${DEVICE_LOG_API_BASE}?APIKey=211616032630&SerialNumber=${device.serial}&DeviceName=${device.apiName}&FromDate=${queryStart}&ToDate=${queryEnd}`;
              const res = await fetch(url);
              if (!res.ok) return [];
              const text = await res.text();
              if (!text || text.trim().startsWith('<')) return [];
              const logs = JSON.parse(text);
              return Array.isArray(logs) ? logs.map(l => ({ ...l, _DeviceName: device.name })) : [];
            } catch (e) {
              console.error(`Error fetching for ${device.name}:`, e);
              return [];
            }
          })
        );
        rawLogsData = allResponses.flat();
      } else {
        try {
          const API_URL = `${DEVICE_LOG_API_BASE}?APIKey=211616032630&SerialNumber=${selectedDevice.serial}&DeviceName=${selectedDevice.apiName}&FromDate=${queryStart}&ToDate=${queryEnd}`;
          const response = await fetch(API_URL);
          if (response.ok) {
            const text = await response.text();
            if (text && !text.trim().startsWith('<')) {
              const data = JSON.parse(text);
              rawLogsData = Array.isArray(data) ? data.map(l => ({ ...l, _DeviceName: selectedDevice.name })) : [];
            }
          }
        } catch (e) {
          console.error('Error fetching device logs:', e);
        }
      }

      if (!rawLogsData || rawLogsData.length === 0) {
        await fetchAttendanceFromDB(targetMonth);
        setLoading(false);
        return;
      }

      const filteredLogs = rawLogsData.filter(log => {
        if (!log.LogDate) return false;
        const logDateStr = log.LogDate.split(' ')[0];
        return logDateStr >= queryStart && logDateStr <= queryEnd;
      });

      filteredLogs.sort((a, b) => new Date(a.LogDate) - new Date(b.LogDate));

      const grouped = {};
      filteredLogs.forEach(log => {
        if (!log.EmployeeCode || !log.LogDate) return;
        const dateStr = log.LogDate.split(' ')[0];
        const key = `${log.EmployeeCode}_${dateStr}`;

        if (!grouped[key]) {
          grouped[key] = {
            EmployeeCode: log.EmployeeCode.toString().trim(),
            Date: dateStr,
            SerialNumber: log.SerialNumber,
            SourceDeviceName: log._DeviceName,
            logs: []
          };
        }
        grouped[key].logs.push(log.LogDate);
      });

      const aggregatedData = Object.values(grouped).map(group => {
        const logs = group.logs;
        let inTime = '-';
        let outTime = '-';
        let punchMiss = 'No';
        let punchMissMsg = '';

        if (logs.length === 1) {
          const punchTime = logs[0];
          const timePart = punchTime.split(' ')[1] || '';
          const hours = parseInt(timePart.split(':')[0]) || 0;

          punchMiss = 'Yes';
          if (hours >= 15) {
            outTime = punchTime;
            punchMissMsg = 'Morning Punch Miss';
          } else {
            inTime = punchTime;
            punchMissMsg = 'Evening Punch Miss';
          }
        } else {
          inTime = logs[0];
          outTime = logs[logs.length - 1];
        }

        const serial = group.SerialNumber.toString().trim();
        const code = group.EmployeeCode.toString().trim();
        const isNumeric = !isNaN(code) && code !== '';

        const empMeta = currentJoining.find(e =>
          (e.id && e.id.toLowerCase() === code.toLowerCase()) ||
          (e.name && e.name.toLowerCase() === code.toLowerCase())
        );

        let dMap = currentMapping.find(m => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase());

        if (!dMap) {
          const entryName = (empMeta?.name || code).toString().trim().toLowerCase();
          dMap = currentMapping.find(m => m.name && m.name.toString().toLowerCase() === entryName);
        }

        const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : (isNumeric ? 'Unknown' : code));
        const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : (isNumeric ? code : 'Unknown'));
        
        // Preserve actual hardware punch device store and serial number
        const matchedPunchDevice = DEVICES.find(d => d.serial && d.serial.toString().trim().toLowerCase() === serial.toLowerCase());
        const displayStore = matchedPunchDevice ? matchedPunchDevice.name : (group.SourceDeviceName && group.SourceDeviceName !== 'ALL DEVICES' ? group.SourceDeviceName : (dMap ? dMap.storeName : (empMeta ? empMeta.store : '-')));
        const displayDeviceId = dMap ? dMap.deviceId : '-';
        const displayAssignedSerial = serial || (dMap ? dMap.serialNo : '-');

        const lateMins = calculateLateMinutes(inTime);
        const workHrs = punchMiss === 'Yes' ? '00:00:00' : calculateWorkHours(inTime, outTime);

        let actualLunchMs = 0;
        if (logs.length > 2) {
          for (let i = 1; i < logs.length - 1; i += 2) {
            const lOut = parseISTToDate(logs[i]);
            const lIn = parseISTToDate(logs[i + 1]);
            if (lOut && lIn) {
              actualLunchMs += Math.max(0, lIn - lOut);
            }
          }
        }

        const standardLunchMs = 2.5 * 3600 * 1000;
        const wasteTimeMs = Math.max(0, actualLunchMs - standardLunchMs);
        const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

        const dateObj = parseISTToDate(group.Date);
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);

        let status = 'Present';
        if (lateMins > 0) status = 'Late';

        const punchLogStr = logs.map(l => formatTimeIST(l)).join(' | ');

        let punchLogStatus = 'Bahar';
        if (logs.length > 0) {
          if (logs.length % 2 === 1) {
            if (logs.length === 1) {
              const punchTime = logs[0];
              const timePart = punchTime.split(' ')[1] || '';
              const hours = parseInt(timePart.split(':')[0]) || 0;
              punchLogStatus = hours >= 15 ? 'Bahar' : 'Andar';
            } else {
              punchLogStatus = 'Andar';
            }
          } else {
            punchLogStatus = 'Bahar';
          }
        }

        return {
          EmployeeID: displayCode,
          EmployeeName: displayName,
          Date: group.Date,
          Day: dayName,
          IsWorkingDay: 'Yes',
          InTime: inTime,
          StandardLunch: calculateHoursMins(displayLunchMs),
          WasteTime: calculateHoursMins(wasteTimeMs),
          OutTime: outTime,
          PunchLog: punchLogStr,
          PunchLogStatus: punchLogStatus,
          StoreName: displayStore,
          DeviceID: displayDeviceId,
          Designation: empMeta ? empMeta.designation : '-',
          SerialNumber: serial,
          AssignedSerial: displayAssignedSerial,
          Status: status,
          WorkingHour: workHrs,
          Overtime: '0h 0m',
          LateMinute: lateMins,
          PunchMiss: punchMiss,
          PunchMissMsg: punchMissMsg,
          RawLogs: logs
        };
      });

      const changedRows = await saveAttendanceToDB(aggregatedData);

      if (changedRows && changedRows.length > 0) {
        await syncToMachineDataSheet(changedRows);
      }

      await fetchAttendanceFromDB(targetMonth);
    } catch (error) {
      console.error('Error syncing device logs:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Sync device logs
  const syncDeviceLogs = async () => {
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDateStr = getLocalDateString(startOfMonth);
    const endDateStr = getLocalDateString(endOfMonth);
    await syncLogsForRange(startDateStr, endDateStr, currentMonth);
  };

  // Sync only today's logs
  const syncTodayLogs = async () => {
    const today = new Date();
    if (today.getMonth() !== currentMonth.getMonth() || today.getFullYear() !== currentMonth.getFullYear()) {
      setCurrentMonth(today);
    }
    setSelectedDate(todayDate);
    await fetchAttendanceFromDB(today);
  };

  // Helper to compute metrics from manual punches
  // shift: optional shift_roster entry { start_time, end_time, shift_type }
  const calculateMetricsFromManualPunches = (punches, dateStr, shift = null) => {
    const convertTo24h = (v) => {
      if (!v) return "";
      const s = v.toString().trim();
      if (s.toLowerCase().includes('am') || s.toLowerCase().includes('pm')) {
        return convert12hTo24h(s);
      }
      return s;
    };

    const time1 = convertTo24h(punches["1"]);
    const time2 = convertTo24h(punches["2"]);
    const time3 = convertTo24h(punches["3"]);
    const time4 = convertTo24h(punches["4"]);
    const time5 = convertTo24h(punches["5"]);
    const time6 = convertTo24h(punches["6"]);

    let activeTimes = [time1, time2, time3, time4, time5, time6].filter(Boolean);

    if (activeTimes.length === 0) {
      return {
        in_time: null,
        out_time: null,
        punch_log: "-",
        punch_log_status: "Bahar",
        punch_miss: "No",
        punch_miss_msg: "",
        working_hour: "00:00:00",
        late_minute: 0,
        status: null
      };
    }

    // Sort chronologically
    activeTimes.sort();

    // ── RULE 1: If user punches before shift start_time (or default 10:00 AM), clamp to official shift start ──
    let officialStartHHMM = "10:00";
    if (shift?.start_time) {
      const parts = shift.start_time.split(':');
      officialStartHHMM = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }

    if (activeTimes[0] < officialStartHHMM) {
      activeTimes[0] = officialStartHHMM;
    }

    // ── RULE 3: After 5th punch, assume 6th OUT punch is 11:00 PM (23:00) ──
    if (activeTimes.length === 5) {
      activeTimes.push("23:00");
    }

    // ── RULE 2: Set last punch (Out-Time) to 11:00 PM (23:00) even if punched after 11 PM ──
    if (activeTimes.length > 1) {
      const lastIdx = activeTimes.length - 1;
      if (activeTimes[lastIdx] > "23:00") {
        activeTimes[lastIdx] = "23:00";
      }
    }

    const formatDateTime = (timeVal) => {
      return `${dateStr}T${timeVal}:00`;
    };

    const in_time = formatDateTime(activeTimes[0]);
    const out_time = activeTimes.length > 1 ? formatDateTime(activeTimes[activeTimes.length - 1]) : null;

    const formatTime12hLocal = (timeVal) => {
      try {
        const [hStr, mStr] = timeVal.split(":");
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        const ampm = h >= 12 ? "PM" : "AM";
        const displayH = h % 12 === 0 ? 12 : h % 12;
        const displayM = m.toString().padStart(2, "0");
        return `${displayH}:${displayM} ${ampm}`;
      } catch (e) {
        return timeVal;
      }
    };

    const punch_log = activeTimes.map(formatTime12hLocal).join(" | ");

    // ── Late calculation ──────────────────────────────────────────────────
    // If a shift is assigned for this employee on this date, use the shift
    // start_time + 10-minute grace window. Otherwise fall back to 10:10 default.
    let late_minute = 0;
    try {
      const inDate = parseISTToDate(in_time);
      if (inDate) {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false
        }).formatToParts(inDate);
        const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
        const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
        const totalMinutes = hour * 60 + minute;

        let officialStart = 10 * 60;       // 10:00 default
        let graceThreshold = 10 * 60 + 10;  // 10:10 default

        if (shift?.start_time) {
          const [shiftH, shiftM] = shift.start_time.split(':').map(Number);
          officialStart = shiftH * 60 + shiftM;
          graceThreshold = officialStart + 10;
        }

        late_minute = totalMinutes >= graceThreshold ? totalMinutes - officialStart : 0;
      }
    } catch (e) {
      late_minute = 0;
    }

    const working_hour = out_time ? calculateWorkHours(in_time, out_time, dateStr) : "00:00:00";

    const punch_miss = activeTimes.length === 1 ? "Yes" : "No";
    let punch_miss_msg = "";
    if (activeTimes.length === 1) {
      const hours = parseInt(activeTimes[0].split(":")[0], 10);
      punch_miss_msg = hours >= 15 ? "Morning Punch Miss" : "Evening Punch Miss";
    }

    const punch_log_status = activeTimes.length % 2 === 1 ? "Andar" : "Bahar";

    // At least one punch → status is Present or Late (never Absent)
    const status = late_minute > 0 ? "Late" : "Present";

    return {
      in_time,
      out_time,
      punch_log,
      punch_log_status,
      punch_miss,
      punch_miss_msg,
      working_hour,
      late_minute,
      status
    };
  };

  // Update attendance status
  const updateAttendanceStatus = async (employeeId, date, newStatus, inTime, outTime, manualPunches) => {
    try {
      const existingRecord = attendanceData.find(
        a => a.employee_id === employeeId && a.attendance_date === date
      );

      const updateData = {
        status: newStatus,
        updated_at: new Date()
      };

      if (manualPunches) {
        let existingApi = {};
        if (existingRecord?.manual_punches) {
          if (existingRecord.manual_punches.api && typeof existingRecord.manual_punches.api === 'object') {
            existingApi = existingRecord.manual_punches.api;
          }
        }

        const finalManualPunches = {
          api: existingApi,
          manual: {
            is_manual: true,
            manual_override: true
          },
          is_manual: true,
          manual_override: true
        };

        const manualKeys = Object.keys(manualPunches).filter(k =>
          k !== 'is_manual' &&
          k !== 'manual_override' &&
          k !== 'absent' &&
          k !== 'api' &&
          k !== 'manual'
        );

        if (manualPunches.absent) {
          finalManualPunches.manual.absent = true;
        } else {
          manualKeys.forEach(key => {
            const val = manualPunches[key];
            if (val !== undefined && val !== null && val !== '') {
              finalManualPunches.manual[key] = val;
            }
          });
        }

        // ── Fetch shift roster for this employee on this date ─────────────
        // Used to calculate late minutes correctly against the assigned shift.
        let shiftEntry = null;
        try {
          const { data: shiftRows } = await supabase
            .from('hr_management_shift_roster')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('date', date)
            .maybeSingle();
          shiftEntry = shiftRows || null;
        } catch (shiftErr) {
          console.warn('Could not fetch shift roster for manual punch calculation:', shiftErr);
        }

        const metrics = calculateMetricsFromManualPunches(finalManualPunches.manual, date, shiftEntry);
        updateData.manual_punches = finalManualPunches;
        updateData.in_time = metrics.in_time;
        updateData.out_time = metrics.out_time;
        updateData.punch_miss = metrics.punch_miss;
        updateData.punch_miss_msg = metrics.punch_miss_msg;
        updateData.working_hour = metrics.working_hour;
        updateData.late_minute = metrics.late_minute;
        updateData.is_late = metrics.late_minute > 0;

        // ── Status resolution ─────────────────────────────────────────────
        // If marked as Absent manually → keep Absent.
        // If at least one manual punch exists → honour computed Present/Late.
        // Otherwise keep the newStatus passed by the caller.
        if (manualPunches.absent) {
          updateData.status = 'Absent';
        } else if (metrics.status) {
          updateData.status = metrics.status; // 'Present' or 'Late'
        }

        if (!existingRecord) {
          updateData.punch_log = "-";
          updateData.punch_log_status = "Bahar";
        }
      } else {
        const clampedIn = inTime ? clampInTimeTo10AM(inTime, date) : null;
        const clampedOut = outTime ? clampOutTimeTo11PM(outTime, date) : null;
        if (inTime !== undefined) {
          updateData.in_time = clampedIn ? formatToISTISOString(clampedIn) : null;
        }
        if (outTime !== undefined) {
          updateData.out_time = clampedOut ? formatToISTISOString(clampedOut) : null;
        }

        if (clampedIn || clampedOut) {
          if (clampedIn && clampedOut && clampedIn !== '-' && clampedOut !== '-') {
            updateData.working_hour = calculateWorkHours(clampedIn, clampedOut, date);
            updateData.late_minute = calculateLateMinutes(clampedIn, date, shiftEntry);
          }
        }
      }

      let result;
      if (existingRecord) {
        const { data, error } = await supabase
          .from('hr_management_attendance_logs')
          .update(updateData)
          .eq('employee_id', employeeId)
          .eq('attendance_date', date)
          .select();

        if (error) throw error;
        result = data;
      } else {
        const employee = allEmployees.find(
          e => e.employee_id === employeeId
        );
        const matchedDevice = DEVICES.find(
          d => d.name.toUpperCase() === (employee?.store_name || '').toUpperCase()
        );
        const serialNo = matchedDevice ? matchedDevice.serial : '-';
        const deviceId = matchedDevice ? matchedDevice.name : '-';

        const { data, error } = await supabase
          .from('hr_management_attendance_logs')
          .insert({
            employee_id: employeeId,
            employee_name: employee?.employee_name || '',
            designation: employee?.designation || '',
            store_name: employee?.store_name || '',
            serial_number: serialNo,
            device_id: deviceId,
            attendance_date: date,
            status: newStatus,
            ...updateData
          })
          .select();

        if (error) throw error;
        result = data;
      }

      await fetchAttendanceFromDB();

      const changedRow = result?.map(r => ({
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        attendance_date: r.attendance_date,
        in_time: r.in_time,
        out_time: r.out_time,
        working_hour: r.working_hour,
        store_name: r.store_name
      }));

      if (changedRow) {
        await syncToMachineDataSheet(changedRow);
      }

      setEditingCell(null);
      setSelectedEmployee(null);
      setIsSlidePanelOpen(false);
      alert('Attendance updated successfully!');
    } catch (err) {
      console.error('Update failed:', err);
      alert('Error updating attendance: ' + err.message);
    }
  };

  // Handle employee selection for slide panel
  const handleEmployeeSelect = (employee, date, status, inTime, outTime) => {
    const fullRecord = attendanceData.find(
      a => a.employee_id === employee.id && a.attendance_date === date
    );

    // Get roster data for this employee on this date
    const roster = getEmployeeRoster(employee.id, date);

    setSelectedEmployee({
      ...employee,
      date: date,
      attendance: {
        status: status,
        in_time: inTime,
        out_time: outTime,
        ...fullRecord
      },
      roster: roster
    });

    setTempStatus(status);

    const formatInputVal = (t) => {
      if (!t || t === '-') return '';
      try {
        const d = parseISTToDate(t);
        if (!d) return '';

        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).formatToParts(d);

        const getVal = (type) => parts.find(p => p.type === type).value;
        let hour = getVal('hour');
        if (hour === '24') hour = '00';
        return `${getVal('year')}-${getVal('month')}-${getVal('day')}T${hour}:${getVal('minute')}`;
      } catch (e) {
        return '';
      }
    };

    setTempInTime(formatInputVal(inTime) || `${date}T10:00`);
    setTempOutTime(formatInputVal(outTime) || `${date}T18:00`);

    // Populate manual punches state
    let punchesObj = {};
    if (fullRecord?.manual_punches) {
      if (fullRecord.manual_punches.manual && typeof fullRecord.manual_punches.manual === 'object') {
        punchesObj = fullRecord.manual_punches.manual;
      } else {
        punchesObj = fullRecord.manual_punches;
      }
    }
    const activePunches = Object.values(punchesObj).filter(v => v && v !== '' && typeof v === 'string');

    // If no manual punches exist, check if we can populate from punch_log
    if (activePunches.length === 0 && fullRecord?.punch_log && fullRecord.punch_log !== '-') {
      const parsedPunches = fullRecord.punch_log.split('|').map(p => convert12hTo24h(p)).filter(Boolean);
      punchesObj = {};
      parsedPunches.forEach((p, idx) => {
        if (idx < 6) {
          punchesObj[(idx + 1).toString()] = p;
        }
      });
      // If 5 punches present, assume 6th punch is 23:00 (11:00 PM)
      if (parsedPunches.length === 5 && !punchesObj["6"]) {
        punchesObj["6"] = "23:00";
      }
    }

    const parsePunchTo24h = (val) => {
      if (!val) return "";
      const s = val.toString().trim();
      if (s.toLowerCase().includes('am') || s.toLowerCase().includes('pm')) {
        return convert12hTo24h(s);
      }
      return s;
    };

    setTempManualPunches({
      "1": parsePunchTo24h(punchesObj["1"]),
      "2": parsePunchTo24h(punchesObj["2"]),
      "3": parsePunchTo24h(punchesObj["3"]),
      "4": parsePunchTo24h(punchesObj["4"]),
      "5": parsePunchTo24h(punchesObj["5"]),
      "6": parsePunchTo24h(punchesObj["6"])
    });

    setNewPunchTime('');
    setIsSlidePanelOpen(true);
  };

  // Add a manual punch, sort it chronologically, and sync in/out times
  const handleAddPunch = () => {
    if (!newPunchTime) return;

    const existing = Object.values(tempManualPunches).filter(Boolean);
    if (existing.includes(newPunchTime)) {
      alert('This punch time already exists!');
      return;
    }

    const updatedList = [...existing, newPunchTime].sort();
    const newPunchesObj = {
      "1": updatedList[0] || "",
      "2": updatedList[1] || "",
      "3": updatedList[2] || "",
      "4": updatedList[3] || "",
      "5": updatedList[4] || "",
      "6": updatedList[5] || ""
    };

    setTempManualPunches(newPunchesObj);
    setNewPunchTime('');

    if (updatedList.length > 0) {
      setTempInTime(`${selectedEmployee.date}T${updatedList[0]}`);
      if (updatedList.length > 1) {
        setTempOutTime(`${selectedEmployee.date}T${updatedList[updatedList.length - 1]}`);
      } else {
        setTempOutTime('');
      }
    }
  };

  // Remove a manual punch, re-sort remaining chronologically, and sync in/out times
  const handleDeletePunch = (timeToDelete) => {
    const remainingList = Object.values(tempManualPunches)
      .filter(Boolean)
      .filter(t => t !== timeToDelete)
      .sort();

    const newPunchesObj = {
      "1": remainingList[0] || "",
      "2": remainingList[1] || "",
      "3": remainingList[2] || "",
      "4": remainingList[3] || "",
      "5": remainingList[4] || "",
      "6": remainingList[5] || ""
    };

    setTempManualPunches(newPunchesObj);

    if (remainingList.length > 0) {
      setTempInTime(`${selectedEmployee.date}T${remainingList[0]}`);
      if (remainingList.length > 1) {
        setTempOutTime(`${selectedEmployee.date}T${remainingList[remainingList.length - 1]}`);
      } else {
        setTempOutTime('');
      }
    } else {
      setTempInTime('');
      setTempOutTime('');
    }
  };

  // Sync Clock In input change to manual punch logs list (replaces earliest punch)
  const handleClockInChange = (val) => {
    setTempInTime(val);
    if (!val) return;
    const timePart = val.split('T')[1]?.substring(0, 5);
    if (!timePart) return;

    const existing = Object.values(tempManualPunches).filter(Boolean).sort();
    let updatedList = [];
    if (existing.length === 0) {
      updatedList = [timePart];
    } else {
      updatedList = [timePart, ...existing.slice(1)].sort();
    }

    const newPunchesObj = {
      "1": updatedList[0] || "",
      "2": updatedList[1] || "",
      "3": updatedList[2] || "",
      "4": updatedList[3] || "",
      "5": updatedList[4] || "",
      "6": updatedList[5] || ""
    };
    setTempManualPunches(newPunchesObj);
  };

  // Sync Clock Out input change to manual punch logs list (replaces latest punch)
  const handleClockOutChange = (val) => {
    setTempOutTime(val);
    if (!val) return;
    const timePart = val.split('T')[1]?.substring(0, 5);
    if (!timePart) return;

    const existing = Object.values(tempManualPunches).filter(Boolean).sort();
    let updatedList = [];
    if (existing.length <= 1) {
      updatedList = [...existing, timePart].sort();
    } else {
      updatedList = [...existing.slice(0, existing.length - 1), timePart].sort();
    }

    const newPunchesObj = {
      "1": updatedList[0] || "",
      "2": updatedList[1] || "",
      "3": updatedList[2] || "",
      "4": updatedList[3] || "",
      "5": updatedList[4] || "",
      "6": updatedList[5] || ""
    };
    setTempManualPunches(newPunchesObj);
  };

  // Handle save from slide panel
  const handleSaveFromSlidePanel = async () => {
    if (!selectedEmployee) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const formattedPunches = {
        "1": tempManualPunches["1"] ? convert24hTo12h(tempManualPunches["1"]) : "",
        "2": tempManualPunches["2"] ? convert24hTo12h(tempManualPunches["2"]) : "",
        "3": tempManualPunches["3"] ? convert24hTo12h(tempManualPunches["3"]) : "",
        "4": tempManualPunches["4"] ? convert24hTo12h(tempManualPunches["4"]) : "",
        "5": tempManualPunches["5"] ? convert24hTo12h(tempManualPunches["5"]) : "",
        "6": tempManualPunches["6"] ? convert24hTo12h(tempManualPunches["6"]) : "",
        is_manual: true
      };

      await updateAttendanceStatus(
        selectedEmployee.id,
        selectedEmployee.date,
        tempStatus,
        tempInTime,
        tempOutTime,
        formattedPunches
      );
    } catch (err) {
      setSaveError(err?.message || 'Failed to save attendance. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Get days in month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currentDate = new Date(year, month, i);
      days.push({
        date: i,
        dayOfWeek: currentDate.getDay(),
        fullDate: getLocalDateString(currentDate),
        isWeekend: currentDate.getDay() === 0 || currentDate.getDay() === 6
      });
    }

    return days;
  };

  // Get attendance status for an employee on a specific date
  const getAttendanceForDate = (employeeId, date) => {
    if (!employeeId || !date) return { status: 'Absent', in_time: '-', out_time: '-' };
    const empIdClean = String(employeeId).trim();
    const record = attendanceData.find(
      a => a.employee_id && String(a.employee_id).trim() === empIdClean && a.attendance_date === date
    );
    if (record) {
      return record;
    }
    if (date > todayDate) {
      return { status: 'Future', in_time: '-', out_time: '-' };
    }
    return { status: 'Absent', in_time: '-', out_time: '-' };
  };

  // Change month
  const changeMonth = (delta) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1);
    setCurrentMonth(nextMonth);

    const currentSelected = new Date(selectedDate);
    const day = currentSelected.getDate();
    const lastDayOfNext = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(day, lastDayOfNext);
    const nextDate = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay);

    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  // Shop Name -> Location Mapping
  const SHOP_NAME_TO_LOCATION = {
    'MADHURA': 'BAVDHAN',
    'VISHAL': 'HINJEWADI',
    'FRIENDS': 'WAGHOLI',
    'BALAJI': 'AKOLE',
    'KUNAL': 'MUMBAI',
    'KUNAL KHARGHAR': 'KHARGHAR'
  };

  const shops = Object.keys(SHOP_NAME_TO_LOCATION);

  // Helper to map shop name to location
  const getMappedLocation = (shopName) => {
    if (!shopName) return '';
    const cleanName = shopName.trim().toUpperCase();
    return SHOP_NAME_TO_LOCATION[cleanName] || cleanName;
  };

  // Filter employees
  const filteredEmployees = (() => {
    // 1. Get employees with logs (matched or unmatched)
    const baseList = employees
      .map(emp => {
        const empProfile = employeesData.find(e =>
          (e.employee_id && String(e.employee_id) === String(emp.id)) ||
          (e.id && String(e.id) === String(emp.id))
        );
        return {
          ...emp,
          name: empProfile ? (empProfile.user_name || empProfile.name_as_per_aadhar || emp.name) : emp.name
        };
      })
      .filter(emp => {
        const matchesSearch = emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          emp.id?.toLowerCase().includes(searchTerm.toLowerCase());

        const targetLocation = getMappedLocation(selectedStore);

        const punchedLoc = (resolvePunchedStore(emp) || '').trim().toUpperCase();
        const assignedLoc = (emp.store_name || '').trim().toUpperCase();

        // Normalize BAWDHAN / BAVDHAN spelling variations if present
        const normalizeLoc = (loc) => loc.replace('BAWDHAN', 'BAVDHAN');

        const normTargetLoc = normalizeLoc(targetLocation);
        const normPunchedLoc = normalizeLoc(punchedLoc);
        const normAssignedLoc = normalizeLoc(assignedLoc);

        const matchesStore = selectedStore === 'ALL' ||
          normAssignedLoc.includes(normTargetLoc) ||
          normPunchedLoc.includes(normTargetLoc);

        const isMatched = isEmployeeInTable(emp.id);

        let matchesFilterMode = true;
        if (matchFilter === 'MATCHED') {
          matchesFilterMode = isMatched;
        } else if (matchFilter === 'UNMATCHED') {
          matchesFilterMode = !isMatched;
        }

        // Status filter: check today's attendance status for daily view
        let matchesStatus = true;
        if (statusFilter !== 'ALL') {
          const att = getAttendanceForDate(emp.id, selectedDate);
          const empStatus = att?.status || 'Absent';
          if (statusFilter === 'Present') {
            matchesStatus = empStatus === 'Present' || empStatus === 'Late';
          } else {
            matchesStatus = empStatus === statusFilter;
          }
        }

        return matchesSearch && matchesStore && matchesFilterMode && matchesStatus;
      });

    // 2. If showing verified or all (matchFilter is not UNMATCHED), append remaining employees from users table
    if (matchFilter !== 'UNMATCHED') {
      const hasAttendance = (empId) => {
        return employees.some(e => String(e.id) === String(empId));
      };

      const remaining = employeesData
        .filter(emp => {
          const empId = emp.employee_id || emp.id;
          // Exclude if already in employees list (meaning they have logs)
          if (hasAttendance(empId)) return false;

          // Remaining employees (no log) are always 'Absent'
          if (statusFilter !== 'ALL' && statusFilter !== 'Absent') return false;

          // Apply search term and store filters
          const name = emp.user_name || emp.name_as_per_aadhar || '';
          const id = empId ? String(empId) : '';
          const store = emp.shop_name || emp.joining_place || '';

          const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            id.toLowerCase().includes(searchTerm.toLowerCase());
          const matchesStore = selectedStore === 'ALL' || store === selectedStore;

          return matchesSearch && matchesStore;
        })
        .map(emp => ({
          id: emp.employee_id || emp.id,
          name: emp.user_name || emp.name_as_per_aadhar || 'No Name',
          designation: emp.Designation || emp.designation || '-',
          store_name: emp.shop_name || emp.joining_place || '-',
          isRemaining: true
        }));

      return [...baseList, ...remaining];
    }

    return baseList;
  })();

  const pageSize = 15;
  const totalPages = Math.ceil(filteredEmployees.length / pageSize);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedEmployees = filteredEmployees.slice((activePage - 1) * pageSize, activePage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedStore, currentMonth]);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs">
        <div className="text-gray-500">
          Showing <span className="font-semibold">{(activePage - 1) * pageSize + 1}</span> to <span className="font-semibold">{Math.min(activePage * pageSize, filteredEmployees.length)}</span> of <span className="font-semibold">{filteredEmployees.length}</span> employees
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
    );
  };

  const days = getDaysInMonth(currentMonth);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  useEffect(() => {
    fetchEmployeesTable(); // Fetch employees table on component mount
  }, []);

  useEffect(() => {
    if (viewMode === 'daily') {
      fetchRosterData(null, selectedDate);
    }
  }, [selectedDate, viewMode]);

  useEffect(() => {
    fetchAttendanceFromDB();
    syncDeviceLogs();
  }, [currentMonth]);

  // Fetch logs from Supabase on load / date change
  useEffect(() => {
    if (viewMode === 'daily' && selectedDate) {
      const autoFetch = async () => {
        try {
          console.log(`[Auto Fetch] Fetching logs for ${selectedDate}...`);
          await fetchAttendanceFromDB(currentMonth);
        } catch (err) {
          console.error('[Auto Fetch] Failed:', err);
        }
      };
      autoFetch();
    }
  }, [selectedDate, viewMode]);

  // Download Excel
  const downloadExcel = () => {
    const exportData = [];

    if (viewMode === 'daily') {
      filteredEmployees.forEach(employee => {
        const attendance = getAttendanceForDate(employee.id, selectedDate);
        const roster = getEmployeeRoster(employee.id, selectedDate);
        const empProfile = employeesData.find(e => e.employee_id === employee.id || e.id === employee.id);
        const assignedStore = empProfile?.joining_place || employee.store_name || '-';
        const punchedStore = resolvePunchedStore(attendance, deviceMapping) || '-';
        const dateObj = new Date(selectedDate);
        exportData.push({
          'Employee ID': employee.id,
          'Employee Name': employee.name,
          'Designation': employee.designation,
          'Assigned Store': assignedStore,
          'Punched Store': punchedStore,
          'Date': selectedDate,
          'Day': dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
          'Status': attendance.status === 'Future' ? '' : attendance.status,
          'IN Time': formatTimeIST(attendance.in_time),
          'OUT Time': formatTimeIST(attendance.out_time),
          'Working Hours': attendance.working_hour || '-',
          'Late Minutes': attendance.late_minute || 0,
          'Standard Lunch': attendance.standard_lunch || '-',
          'Waste Time': attendance.waste_time || '-',
          'Punch Log': attendance.punch_log || '-',
          'Roster Shift': roster?.shift_type || 'Not Assigned',
          'Roster Start Time': roster?.start_time || '-',
          'Roster End Time': roster?.end_time || '-'
        });
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Daily_Attendance_${selectedDate}`);
      XLSX.writeFile(workbook, `attendance_daily_${selectedDate}.xlsx`);
    } else {
      filteredEmployees.forEach(employee => {
        days.forEach(day => {
          const attendance = getAttendanceForDate(employee.id, day.fullDate);
          const roster = getEmployeeRoster(employee.id, day.fullDate);
          const empProfile = employeesData.find(e => e.employee_id === employee.id || e.id === employee.id);
          const assignedStore = empProfile?.joining_place || employee.store_name || '-';
          const punchedStore = resolvePunchedStore(attendance, deviceMapping) || '-';
          exportData.push({
            'Employee ID': employee.id,
            'Employee Name': employee.name,
            'Designation': employee.designation,
            'Assigned Store': assignedStore,
            'Punched Store': punchedStore,
            'Date': day.fullDate,
            'Day': new Date(day.fullDate).toLocaleDateString('en-US', { weekday: 'long' }),
            'Status': attendance.status === 'Future' ? '' : attendance.status,
            'IN Time': formatTimeIST(attendance.in_time),
            'OUT Time': formatTimeIST(attendance.out_time),
            'Working Hours': attendance.working_hour || '-',
            'Late Minutes': attendance.late_minute || 0,
            'Roster Shift': roster?.shift_type || 'Not Assigned',
            'Roster Start Time': roster?.start_time || '-',
            'Roster End Time': roster?.end_time || '-'
          });
        });
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Attendance_${monthNames[currentMonth.getMonth()]}_${currentMonth.getFullYear()}`);
      XLSX.writeFile(workbook, `attendance_${currentMonth.getFullYear()}_${currentMonth.getMonth() + 1}.xlsx`);
    }
  };

  return (
    <div className="p-3">
      {/* Header - Compact */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Calendar size={18} />
            {viewMode === 'calendar' ? 'Daily Attendance Calendar' : 'Daily Attendance Sheet'}
          </h1>

        </div>
        <div className="flex gap-2">
          {syncing && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-md">
              <Loader2 size={10} className="text-indigo-600 animate-spin" />
              <span className="text-[10px] text-indigo-600 font-medium">
                {syncProgress}%
              </span>
            </div>
          )}
          <button
            onClick={downloadExcel}
            disabled={filteredEmployees.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-medium text-xs transition-colors ${filteredEmployees.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
              }`}
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>

      {/* View Toggle - Compact */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-3 border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-0.5 rounded-md">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-4 py-1 text-xs font-medium rounded transition-all ${viewMode === 'daily'
                ? 'bg-white text-indigo-600 '
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Clock size={12} />
              Daily
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 h-10 py-1 text-xs font-medium rounded transition-all ${viewMode === 'calendar'
                ? 'bg-white text-indigo-600 '
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <Calendar size={12} />
              Monthly
            </button>
          </div>

          <button
            onClick={() => setIsMarkModalOpen(true)}
            className="flex h-10 items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Plus size={12} />
            Mark Attendance
          </button>

          <div className="relative">
            <select
              value={matchFilter}
              onChange={(e) => setMatchFilter(e.target.value)}
              className={`flex h-10 appearance-none items-center gap-1.5 pl-3 pr-8 py-1.5 font-semibold text-xs border rounded-md cursor-pointer transition-all focus:outline-none ${matchFilter === 'ALL'
                ? 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
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
                  ? 'text-gray-700'
                  : matchFilter === 'MATCHED'
                    ? 'text-emerald-700'
                    : 'text-amber-700'
              } />
            </div>
          </div>
        </div>

        {viewMode === 'daily' && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleRefresh}
              disabled={loading}
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-gray-700 hover:bg-gray-50 transition-all active:scale-95 text-xs font-semibold rounded border border-gray-200 mr-2 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>
        )}
      </div>



      {/* Filter Section - Compact */}
      <div className="bg-white rounded-md p-2 mb-3">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Search Employee</label>
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Filter by Location</label>
            <div className="relative">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full appearance-none pl-2 pr-6 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-gray-700"
              >
                <option value="ALL">All Locations</option>
                {shops.map(shop => (
                  <option key={shop} value={shop}>{shop}</option>
                ))}
              </select>
              <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Status Filter Dropdown */}
          <div className="min-w-[140px]">
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Filter by Status</label>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none pl-2 pr-6 py-1 border border-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs bg-white font-medium text-gray-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="Present">✓ Present</option>
                <option value="Late">⏱ Late</option>
                <option value="Absent">✗ Absent</option>
                <option value="Half Day">◑ Half Day</option>
              </select>
              <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Month</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeMonth(-1)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-semibold text-gray-800 min-w-[140px] text-center">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <button
                onClick={() => changeMonth(1)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        /* Calendar View - Compact */
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[calc(88vh-220px)] scrollbar-thin">
            <table className="w-full text-xs relative border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                <tr>
                  <th className="sticky top-0 left-0 bg-gray-50 px-2 py-1.5 font-medium text-gray-600 text-[10px] z-30 min-w-[80px] border-">
                    Employee
                  </th>
                  {days.map((day, idx) => (
                    <th key={idx} className={`sticky top-0 bg-gray-50 px-0.5 py-1.5 font-medium text-center text-[10px] min-w-[32px] ${day.isWeekend ? 'bg-red-50' : ''} z-10`}>
                      <div className="font-semibold text-gray-700">{day.date}</div>
                      <div className="text-gray-400 text-[8px] mt-0.5">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.dayOfWeek]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={days.length + 2} className="text-center py-6">
                      <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        Loading...
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={days.length + 2} className="text-center py-6">
                      <p className="text-red-600 text-xs mb-2">{error}</p>
                      <button
                        onClick={syncDeviceLogs}
                        className="px-3 py-1 bg-indigo-600 text-white rounded text-xs"
                      >
                        Retry
                      </button>
                    </td>
                  </tr>
                ) : paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((employee, empIdx) => {
                    let presentCount = 0, lateCount = 0, absentCount = 0, halfDayCount = 0;
                    const isInEmployeesTable = isEmployeeInTable(employee.id);
                    const employeeProfile = employeesData.find(e => e.employee_id === employee.id || e.id === employee.id);
                    const candidatePhoto = employeeProfile?.candidate_photo || employee.candidate_photo;
                    const employeeRoster = getEmployeeRoster(employee.id, selectedDate);

                    return (
                      <tr
                        key={employee.id}
                        className="transition-colors hover:bg-gray-50 bg-white"
                      >
                        <td className="sticky left-0 px-2 py-1.5 border-r z-10 bg-white">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="relative flex-shrink-0 cursor-pointer group"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPreviewWindow(employee);
                              }}
                              title="Click to view employee overview, timecard & timeline"
                            >
                              {candidatePhoto ? (
                                <img
                                  src={candidatePhoto}
                                  alt={employee.name}
                                  className="w-6 h-6 rounded-full object-cover border border-gray-200 flex-shrink-0 group-hover:ring-2 group-hover:ring-indigo-500 transition-all shadow-sm"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 bg-indigo-50 text-indigo-600 group-hover:ring-2 group-hover:ring-indigo-500 transition-all shadow-sm">
                                  {employee.name ? employee.name.charAt(0).toUpperCase() : '?'}
                                </div>
                              )}
                              {employeeRoster && (
                                <span
                                  className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white flex items-center justify-center text-[7px] text-white font-bold leading-none select-none shadow-sm cursor-help animate-pulse"
                                  title={`Shift Assigned: ${employeeRoster.shift_type} (${employeeRoster.start_time?.substring(0, 5)} - ${employeeRoster.end_time?.substring(0, 5)})`}
                                >
                                  S
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-900">{employee.name}</p>
                              <div className="flex items-center gap-1">
                                <p className="text-[9px] text-gray-500">{employee.id}</p>
                                {employeeRoster && employeeRoster.shift_type ? (
                                  <span
                                    className="inline-flex items-center px-1 rounded bg-indigo-50 border border-indigo-100 text-[8px] font-semibold text-indigo-700 leading-none py-0.5 cursor-help"
                                    title={`Shift Assigned: ${employeeRoster.shift_type} (${employeeRoster.start_time?.substring(0, 5) || '10:00'} - ${employeeRoster.end_time?.substring(0, 5) || '19:30'})`}
                                  >
                                    📅 {employeeRoster.shift_type?.substring(0, 12)}
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-1 rounded bg-gray-50 border border-gray-200 text-[8px] font-medium text-gray-500 leading-none py-0.5"
                                    title="No roster assigned. Fallback schedule 10:00 AM - 7:30 PM applied."
                                  >
                                    Roster Not Available
                                  </span>
                                )}
                              </div>
                              {isInEmployeesTable ? (
                                <span className="text-[8px] text-blue-600 font-medium block">✓ Matched</span>
                              ) : (
                                <span className="text-[8px] text-amber-600 font-medium block">⚠️ Unmatched</span>
                              )}
                            </div>
                          </div>
                        </td>
                        {(() => {
                          // Segment days into single cells or merged streaks (for 3+ consecutive absent days)
                          const segments = [];
                          let i = 0;
                          while (i < days.length) {
                            const d = days[i];
                            const att = getAttendanceForDate(employee.id, d.fullDate);
                            const st = att.status || 'Absent';

                            if (st === 'Absent' || st === 'On Leave') {
                              let j = i;
                              const streak = [];
                              while (j < days.length) {
                                const nextAtt = getAttendanceForDate(employee.id, days[j].fullDate);
                                const nextSt = nextAtt.status || 'Absent';
                                if (nextSt === 'Absent' || nextSt === 'On Leave') {
                                  streak.push({ day: days[j], idx: j, attendance: nextAtt, status: nextSt });
                                  j++;
                                } else {
                                  break;
                                }
                              }

                              if (streak.length >= 3) {
                                segments.push({
                                  type: 'merged_absent',
                                  colSpan: streak.length,
                                  startIndex: i,
                                  streak: streak,
                                  startDay: streak[0].day,
                                  endDay: streak[streak.length - 1].day
                                });
                                i = j;
                              } else {
                                streak.forEach(item => {
                                  segments.push({
                                    type: 'single',
                                    colSpan: 1,
                                    day: item.day,
                                    idx: item.idx,
                                    attendance: item.attendance,
                                    status: item.status
                                  });
                                });
                                i = j;
                              }
                            } else {
                              segments.push({
                                type: 'single',
                                colSpan: 1,
                                day: d,
                                idx: i,
                                attendance: att,
                                status: st
                              });
                              i++;
                            }
                          }

                          return segments.map((seg, sIdx) => {
                            if (seg.type === 'merged_absent') {
                              const leaveInfo = getLeaveInfoForStreak(employee.id, seg.startDay.fullDate, seg.endDay.fullDate, seg.streak);
                              absentCount += seg.colSpan;

                              const isTopRow = empIdx < 2;
                              const isLeftCol = seg.startIndex <= 2;
                              const isRightCol = (seg.startIndex + seg.colSpan) >= (days.length - 2);

                              const horizontalPosClass = isLeftCol
                                ? 'left-0'
                                : isRightCol
                                  ? 'right-0'
                                  : 'left-1/2 -translate-x-1/2';

                              const verticalPosClass = isTopRow
                                ? 'top-full mt-2 origin-top'
                                : 'bottom-full mb-2 origin-bottom';

                              const arrowClass = isTopRow
                                ? `bottom-full ${isLeftCol ? 'left-4' : isRightCol ? 'right-4' : 'left-1/2 -translate-x-1/2'} -mb-1 border-4 border-transparent border-b-slate-900/95`
                                : `top-full ${isLeftCol ? 'left-4' : isRightCol ? 'right-4' : 'left-1/2 -translate-x-1/2'} -mt-1 border-4 border-transparent border-t-slate-900/95`;

                              return (
                                <td
                                  key={`seg-${employee.id}-${seg.startDay.fullDate}`}
                                  colSpan={seg.colSpan}
                                  className="px-0.5 py-1 text-center relative"
                                  onClick={() => handleEmployeeSelect(employee, seg.startDay.fullDate, 'Absent', null, null)}
                                >
                                  <div className="relative group/leave mx-auto w-full flex items-center justify-center">
                                    <div className="w-full h-6 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-rose-100 via-rose-50 to-rose-100 border border-rose-300 text-rose-700 shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all duration-150 hover:bg-rose-200 hover:border-rose-400 hover:shadow-sm">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 animate-pulse"></span>
                                      <span className="text-[9px] font-bold tracking-tight whitespace-nowrap">
                                        Leave ({seg.colSpan}d)
                                      </span>
                                    </div>

                                    {/* Hover Tooltip Popover */}
                                    <div className={`absolute ${verticalPosClass} ${horizontalPosClass} w-64 p-2.5 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-slate-700/80 opacity-0 invisible group-hover/leave:opacity-100 group-hover/leave:visible transition-all duration-200 pointer-events-none z-50 text-left scale-95 group-hover/leave:scale-100`}>
                                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-700/80">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                          Continuous Absence
                                        </div>
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono">
                                          {seg.colSpan} Days
                                        </span>
                                      </div>

                                      <div className="space-y-1 text-xs">
                                        <div className="flex items-center gap-1.5 text-slate-200">
                                          <Calendar size={12} className="text-rose-400 shrink-0" />
                                          <span className="font-semibold text-slate-100 text-[11px]">
                                            Leave: {formatDateRangeDisplay(seg.startDay.fullDate)} to {formatDateRangeDisplay(seg.endDay.fullDate)}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-slate-300">
                                          <span className="text-slate-400">Total Duration:</span>
                                          <span className="font-semibold text-rose-300">{seg.colSpan} Days</span>
                                        </div>

                                        <div className="pt-1 border-t border-slate-800 text-[11px]">
                                          <span className="text-slate-400 font-medium">Reason: </span>
                                          <span className={`font-medium ${leaveInfo.reason ? 'text-amber-200' : 'text-slate-400 italic'}`}>
                                            {leaveInfo.reason || 'Not specified (Absent streak)'}
                                          </span>
                                          {leaveInfo.leaveType && (
                                            <div className="mt-1 inline-block px-1.5 py-0.5 rounded text-[8px] bg-slate-800 text-indigo-300 border border-slate-700 font-medium">
                                              {leaveInfo.leaveType}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Tooltip arrow */}
                                      <div className={`absolute ${arrowClass}`}></div>
                                    </div>
                                  </div>
                                </td>
                              );
                            }

                            // Single cell rendering
                            const { day, idx, attendance, status } = seg;
                            const config = STATUS_CONFIG[status] || STATUS_CONFIG['Absent'];

                            if (status === 'Present') presentCount++;
                            else if (status === 'Late') lateCount++;
                            else if (status === 'Absent' || status === 'On Leave') absentCount++;
                            else if (status === 'Half Day') halfDayCount++;

                            return (
                              <td
                                key={idx}
                                className={`px-0.5 py-1 text-center cursor-pointer transition-all hover:opacity-80 relative ${day.isWeekend ? 'bg-gray-50' : ''}`}
                                onClick={() => handleEmployeeSelect(employee, day.fullDate, status, attendance.in_time, attendance.out_time)}
                              >
                                <div className="relative inline-block">
                                  <div className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${config.color} font-medium text-[10px] transition-transform hover:scale-105`}>
                                    {config.label}
                                  </div>
                                  {(() => {
                                    if (!attendance?.manual_punches) return null;
                                    const punches = attendance.manual_punches.manual && typeof attendance.manual_punches.manual === 'object'
                                      ? attendance.manual_punches.manual
                                      : attendance.manual_punches;
                                    const hasManual = Object.values(punches).some(v => v && v !== '' && typeof v === 'string');
                                    return hasManual ? (
                                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-purple-500 rounded-full border border-white" title="Manual punch log" />
                                    ) : null;
                                  })()}
                                  {(() => {
                                    const dayRoster = getEmployeeRoster(employee.id, day.fullDate);
                                    return dayRoster ? (
                                      <span
                                        className="absolute -bottom-0.5 -left-0.5 w-1.5 h-1.5 bg-indigo-600 rounded-full border border-white cursor-help"
                                        title={`Shift: ${dayRoster.shift_type} (${dayRoster.start_time?.substring(0, 5)} - ${dayRoster.end_time?.substring(0, 5)})`}
                                      />
                                    ) : null;
                                  })()}
                                </div>
                                {attendance.late_minute > 0 && (
                                  <div className="text-[8px] text-gray-400 mt-0.5">
                                    {attendance.late_minute}m
                                  </div>
                                )}
                              </td>
                            );
                          });
                        })()}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={days.length + 2} className="text-center py-8">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Users size={32} className="mb-2" />
                        <p className="text-xs font-medium">No employees found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {renderPagination()}
        </div>
      ) : (
        /* Daily List View - Compact */
        <>
          <div className="bg-white rounded-md overflow-hidden shadow-sm">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(89vh-220px)] scrollbar-thin">
              <table className="w-full text-xs relative border-collapse">
                <thead className=" border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[40px] z-10">#</th>
                    <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[10vw] z-10">Employee</th>
                    <th className="sticky top-0 bg-gray-50 text-left px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[100px] z-10">Location</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[80px] z-10">Status</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[90px] z-10">In Time (IST)</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[90px] z-10">Out Time (IST)</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[180px] z-10">Manual Log & Punch Log</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[120px] z-10">Lunch Hours</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[70px] z-10">Hours</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[60px] z-10">Late</th>
                    <th className="sticky top-0 bg-gray-50 text-center px-2 py-1.5 font-medium text-gray-600 text-[10px] w-[50px] z-10">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="text-center py-6">
                        <div className="flex items-center justify-center gap-1 text-gray-500 text-xs">
                          <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                          Loading...
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={11} className="text-center py-6">
                        <p className="text-red-600 text-xs mb-2">{error}</p>
                        <button onClick={syncDeviceLogs} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs">Retry</button>
                      </td>
                    </tr>
                  ) : paginatedEmployees.length > 0 ? (
                    paginatedEmployees.map((employee, idx) => {
                      const attendance = getAttendanceForDate(employee.id, selectedDate);
                      let status = attendance.status || 'Absent';
                      const config = STATUS_CONFIG[status] || STATUS_CONFIG['Absent'];
                      const isInEmployeesTable = isEmployeeInTable(employee.id);

                      // Get punch_log as it is from database - DO NOT modify or append manual punches
                      let punchLogText = attendance.punch_log || '-';

                      // Format manual and api punches
                      let manualPunchesDisplay = '-';
                      let apiPunchesDisplay = '-';

                      // Helper to parse times in "10:05 AM" or "10:05" formats into minutes for sorting
                      const parseToMinutes = (tStr) => {
                        try {
                          const clean = tStr.trim().toUpperCase();
                          const isPM = clean.endsWith('PM');
                          const isAM = clean.endsWith('AM');
                          let timePart = clean;
                          if (isPM || isAM) {
                            timePart = clean.slice(0, -2).trim();
                          }
                          const [hStr, mStr] = timePart.split(':');
                          let h = parseInt(hStr, 10);
                          const m = parseInt(mStr, 10) || 0;
                          if (isPM && h < 12) h += 12;
                          if (isAM && h === 12) h = 0;
                          return h * 60 + m;
                        } catch (e) {
                          return 0;
                        }
                      };

                      if (attendance?.manual_punches) {
                        const punchesObj = attendance.manual_punches;

                        if (punchesObj.manual || punchesObj.api) {
                          // New structure
                          if (punchesObj.manual && typeof punchesObj.manual === 'object') {
                            const rawManual = Object.values(punchesObj.manual)
                              .filter(value => value && value !== '' && typeof value === 'string');
                            if (rawManual.length > 0) {
                              const sortedManual = [...rawManual].sort((a, b) => parseToMinutes(a) - parseToMinutes(b));
                              manualPunchesDisplay = sortedManual.join(' | ');
                            }
                          }

                          if (punchesObj.api && typeof punchesObj.api === 'object') {
                            const rawApi = Object.values(punchesObj.api)
                              .filter(value => value && value !== '' && typeof value === 'string');
                            if (rawApi.length > 0) {
                              const sortedApi = [...rawApi].sort((a, b) => parseToMinutes(a) - parseToMinutes(b));
                              apiPunchesDisplay = sortedApi.join(' | ');
                            }
                          }
                        } else {
                          // Old structure: direct keys
                          const rawManual = ["1", "2", "3", "4", "5", "6"]
                            .map(key => punchesObj[key])
                            .filter(value => value && value !== '' && typeof value === 'string');
                          if (rawManual.length > 0) {
                            const sortedManual = [...rawManual].sort((a, b) => parseToMinutes(a) - parseToMinutes(b));
                            manualPunchesDisplay = sortedManual.join(' | ');
                          }
                        }
                      }

                      // Function to render colored punch logs (pre-9 AM invalid punches are filtered out completely)
                      const renderColoredPunches = (punchLogStr) => {
                        if (!punchLogStr || punchLogStr === '-') {
                          return <span className="text-gray-500 font-medium">-</span>;
                        }

                        // Split by ' | ' or '|' separator and filter out pre-9 AM punches completely
                        const punches = punchLogStr
                          .split(/\s*\|\s*/)
                          .map(p => p.trim())
                          .filter(p => Boolean(p) && !isBefore9AM(p));

                        if (punches.length === 0) {
                          return <span className="text-gray-500 font-medium">-</span>;
                        }

                        return (
                          <div className="flex flex-wrap items-center justify-center gap-0.5">
                            {punches.map((punch, index) => {
                              const isEven = index % 2 === 0;
                              const colorClass = isEven ? 'text-green-600' : 'text-red-600';
                              const titleText = isEven ? 'Check-In Punch' : 'Check-Out Punch';

                              return (
                                <span
                                  key={index}
                                  className={`${colorClass} bg-gray-50 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold`}
                                  title={titleText}
                                >
                                  {punch}
                                  {index < punches.length - 1 && (
                                    <span className="text-gray-400 mx-0.5 font-normal inline-block">|</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        );
                      };

                      const employeeProfile = employeesData.find(e => e.employee_id === employee.id);
                      const candidatePhoto = employeeProfile?.candidate_photo || employee.candidate_photo;
                      const employeeRoster = getEmployeeRoster(employee.id, selectedDate);

                      let totalPunches = 0;
                      if (attendance?.manual_punches) {
                        const punchesObj = attendance.manual_punches;
                        if (punchesObj.manual || punchesObj.api) {
                          const manualCount = punchesObj.manual ? Object.values(punchesObj.manual).filter(v => v && v !== '' && typeof v === 'string').length : 0;
                          const apiCount = punchesObj.api ? Object.values(punchesObj.api).filter(v => v && v !== '' && typeof v === 'string').length : 0;
                          totalPunches = manualCount + apiCount;
                        } else {
                          const oldManualCount = ["1", "2", "3", "4", "5", "6"]
                            .map(key => punchesObj[key])
                            .filter(v => v && v !== '' && typeof v === 'string').length;
                          totalPunches = oldManualCount;
                        }
                      }

                      return (
                        <tr
                          key={employee.id}
                          className="transition-colors hover:bg-gray-50 bg-white"
                        >
                          <td className="px-2 py-1.5 text-[10px] text-gray-500 font-medium">{(activePage - 1) * pageSize + idx + 1}</td>
                          <td className="px-2 py-1.5 pl-0">
                            <div className="flex items-center justify-between w-full gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="relative flex-shrink-0 cursor-pointer group"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPreviewWindow(employee);
                                  }}
                                  title="Click to view employee overview, timecard & timeline"
                                >
                                  {candidatePhoto ? (
                                    <img
                                      src={candidatePhoto}
                                      alt={employee.name}
                                      className="w-7 h-7 rounded-full object-cover border border-gray-200 flex-shrink-0 group-hover:ring-2 group-hover:ring-indigo-500 transition-all shadow-sm"
                                    />
                                  ) : (
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 bg-indigo-50 text-indigo-600 group-hover:ring-2 group-hover:ring-indigo-500 transition-all shadow-sm">
                                      {employee.name ? employee.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                  )}
                                  {employeeRoster && (
                                    <span
                                      className="absolute -top-1 -left-1 w-3 h-3 bg-indigo-600 rounded-full border border-white flex items-center justify-center text-[7px] text-white font-bold leading-none select-none shadow-sm cursor-help animate-pulse"
                                      title={`Shift Assigned: ${employeeRoster.shift_type} (${employeeRoster.start_time?.substring(0, 5)} - ${employeeRoster.end_time?.substring(0, 5)})`}
                                    >
                                      S
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-900">{employee.name}</p>
                                  <div className="flex items-center gap-1">
                                    <p className="text-[9px] text-gray-500">{employee.id}</p>
                                    {employeeRoster && employeeRoster.shift_type ? (
                                      <span
                                        className="inline-flex items-center px-1 rounded bg-indigo-50 border border-indigo-100 text-[8px] font-semibold text-indigo-700 leading-none py-0.5 cursor-help"
                                        title={`Shift Assigned: ${employeeRoster.shift_type} (${employeeRoster.start_time?.substring(0, 5) || '10:00'} - ${employeeRoster.end_time?.substring(0, 5) || '19:30'})`}
                                      >
                                        📅 {employeeRoster.shift_type?.substring(0, 12)}
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center px-1 rounded bg-gray-50 border border-gray-200 text-[8px] font-medium text-gray-500 leading-none py-0.5"
                                        title="No roster assigned. Fallback schedule 10:00 AM - 7:30 PM applied."
                                      >
                                        Roster Not Available
                                      </span>
                                    )}
                                  </div>
                                  {isInEmployeesTable ? (
                                    <span className="text-[8px] text-emerald-600 font-medium block">✓ Matched</span>
                                  ) : (
                                    <span className="text-[8px] text-amber-600 font-medium block">⚠️ Unmatched</span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 mr-1 ${totalPunches % 2 === 1 ? 'bg-green-500' : 'bg-red-500'}`}
                                title={`${totalPunches} punch(es)`}
                              />
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-[10px] text-gray-600">
                            {(() => {
                              const rawAssigned = employeeProfile?.joining_place || employee.store_name || '-';
                              const assignedStore = rawAssigned.toString().trim();
                              const rawPunched = resolvePunchedStore(attendance, deviceMapping) || '';
                              const punchedStore = rawPunched.toString().trim();
                              const isDifferent = punchedStore && assignedStore !== '-' && punchedStore.toLowerCase() !== assignedStore.toLowerCase();

                              if (punchedStore) {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-gray-900">
                                      {assignedStore}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded leading-none w-fit" title={`Punched from biometric device at ${punchedStore} (Serial: ${attendance.serial_number || 'N/A'})`}>
                                      📍 Punched: {punchedStore}
                                    </span>
                                  </div>
                                );
                              }
                              return <span className="font-medium text-gray-700">{assignedStore !== '-' ? assignedStore : '-'}</span>;
                            })()}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-medium ${config.color} ${config.bgColor}`}>
                              {config.fullLabel}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-mono">
                            {attendance.in_time ? formatTimeIST(attendance.in_time) : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-mono">
                            {attendance.out_time ? formatTimeIST(attendance.out_time) : '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center max-w-[200px]">
                            {apiPunchesDisplay === '-' && manualPunchesDisplay === '-' ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <div className="flex flex-col gap-1 items-center justify-center">
                                {apiPunchesDisplay !== '-' && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] font-bold text-gray-500 bg-gray-100 px-1 py-0.5 rounded leading-none">API</span>
                                    {renderColoredPunches(apiPunchesDisplay)}
                                  </div>
                                )}
                                {manualPunchesDisplay !== '-' && (
                                  <div className="flex items-center gap-1">
                                    <span className="text-[8px] font-bold text-purple-700 bg-purple-50 px-1 py-0.5 rounded leading-none">MNL</span>
                                    {renderColoredPunches(manualPunchesDisplay)}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-mono">
                            {attendance.standard_lunch || '-'}
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] font-semibold">{attendance.working_hour || '-'}</td>
                          <td className="px-2 py-1.5 text-center text-[10px]">
                            {(() => {
                              const liveLate = attendance.in_time ? calculateLateMinutes(attendance.in_time, selectedDate, employeeRoster) : (attendance.late_minute || 0);
                              return liveLate > 0 ? (
                                <span className="text-orange-600 font-semibold">{liveLate}m</span>
                              ) : '-';
                            })()}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => handleEmployeeSelect(employee, selectedDate, status, attendance.in_time, attendance.out_time)}
                              className="p-1 hover:bg-indigo-50 text-indigo-600 rounded transition-colors"
                            >
                              <Pencil size={10} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={11} className="text-center py-8">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Users size={32} className="mb-2" />
                          <p className="text-xs font-medium">No employees found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {renderPagination()}
          </div>

        </>
      )}

      {/* Slide Panel - Right to Left */}
      <div className={`fixed inset-0 overflow-hidden z-50 ${isSlidePanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* Overlay */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${isSlidePanelOpen ? 'opacity-50' : 'opacity-0'}`}
          onClick={() => {
            setIsSlidePanelOpen(false);
            setSelectedEmployee(null);
          }}
        />

        {/* Slide Panel */}
        <div className={`absolute inset-y-0 right-0 max-w-6xl w-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${isSlidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedEmployee && (
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gray-50 text-gray-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                    {selectedEmployee.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-base text-gray-900">{selectedEmployee.name}</h3>
                    <p className="text-xs text-gray-500">ID: {selectedEmployee.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsSlidePanelOpen(false);
                    setSelectedEmployee(null);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto bg-slate-50/50">
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4 pb-2 border-b border-gray-100">
                      Attendance Details
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* Department */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{selectedEmployee.designation || '--'}</option>
                        </select>
                      </div>

                      {/* Employees */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={selectedEmployee.name}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed"
                          disabled
                        />
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Location</label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{selectedEmployee.attendance?.store_name || selectedEmployee.store_name || 'Worksuite'}</option>
                        </select>
                      </div>


                      {/* Year */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Year <span className="text-red-500">*</span></label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{new Date(selectedEmployee.date).getFullYear()}</option>
                        </select>
                      </div>

                      {/* Month */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Month <span className="text-red-500">*</span></label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-gray-50 text-gray-500 cursor-not-allowed" disabled>
                          <option>{new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(selectedEmployee.date))}</option>
                        </select>
                      </div>

                      {/* Status select - custom editable field */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Attendance Status <span className="text-red-500">*</span></label>
                        <select
                          value={tempStatus}
                          onChange={(e) => setTempStatus(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-gray-800 font-medium"
                        >
                          {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                            <option key={key} value={key}>{config.fullLabel}</option>
                          ))}
                        </select>
                      </div>

                      {/* Clock In */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Clock In (IST) <span className="text-red-500">*</span></label>
                        <input
                          type="datetime-local"
                          value={tempInTime}
                          onChange={(e) => handleClockInChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>

                      {/* Clock Out */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Clock Out (IST)</label>
                        <input
                          type="datetime-local"
                          value={tempOutTime}
                          onChange={(e) => handleClockOutChange(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                      </div>

                      {/* Manual Attendance Logs */}
                      <div className="md:col-span-2 lg:col-span-3 border-t border-gray-100 pt-4 mt-2">
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                          Add Manual Punch Logs (HH:MM)
                        </h4>
                        {/* List of current sorted punches as tags */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {Object.values(tempManualPunches).filter(Boolean).length === 0 ? (
                            <p className="text-xs text-gray-400 italic">No manual punches added yet.</p>
                          ) : (
                            Object.values(tempManualPunches).filter(Boolean).map((time, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-xs font-semibold font-mono">
                                <span>{time}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePunch(time)}
                                  className="text-indigo-400 hover:text-indigo-600 focus:outline-none transition-colors"
                                  title="Remove Punch"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Single input & Add button */}
                        <div className="flex items-center gap-2 max-w-[240px]">
                          <input
                            type="time"
                            value={newPunchTime}
                            onChange={(e) => setNewPunchTime(e.target.value)}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white w-full"
                          />
                          <button
                            type="button"
                            onClick={handleAddPunch}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-all whitespace-nowrap active:scale-95 shadow-sm"
                          >
                            Add Punch
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          💡 Tip: Added punches are automatically sorted. The earliest punch will be the Clock In and the latest will be the Clock Out.
                        </p>
                      </div>


                      {/* Half Day (Yes/No radio) */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Half Day</label>
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="halfDayRadio"
                              checked={tempStatus === 'Half Day'}
                              onChange={() => setTempStatus('Half Day')}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input
                              type="radio"
                              name="halfDayRadio"
                              checked={tempStatus !== 'Half Day'}
                              onChange={() => {
                                if (tempStatus === 'Half Day') setTempStatus('Present');
                              }}
                              className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>

                      {/* Working From */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Working From <span className="text-red-500">*</span></label>
                        <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                          <option>Office</option>
                          <option>Home</option>
                        </select>
                      </div>

                      {/* Attendance Overwrite Checkbox */}
                      <div className="lg:col-span-3 flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="attendanceOverwrite"
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="attendanceOverwrite" className="text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-1">
                          Attendance Overwrite
                          <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center cursor-help" title="Overwrite automatically calculated logs?">?</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Roster Information Section removed since shift roster is not implemented yet */}

                  {/* Punch Details and Raw Logs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Calculated Metrics</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Working Hours</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.working_hour || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Overtime</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.overtime || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Late Minutes</span>
                          <span className="font-semibold text-orange-600">{selectedEmployee.attendance?.late_minute || 0}m</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Standard Lunch</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.standard_lunch || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-dashed border-gray-200">
                          <span className="text-gray-500">Waste Time</span>
                          <span className="font-semibold text-gray-800">{selectedEmployee.attendance?.waste_time || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500">Device Serial</span>
                          <span className="font-mono text-xs text-gray-800">{selectedEmployee.attendance?.serial_number || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-4">
                      {/* Punch Logs Section */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Punch Logs (IST)</h4>
                        {selectedEmployee.attendance?.punch_log ? (
                          <div className="bg-white rounded p-3 border border-gray-200 h-[120px] overflow-y-auto">
                            <p className="text-xs font-mono text-gray-700 whitespace-pre-line leading-relaxed">
                              {selectedEmployee.attendance.punch_log}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white rounded p-3 border border-gray-200 h-[120px] flex items-center justify-center text-gray-400 text-xs">
                            No punch logs recorded
                          </div>
                        )}
                      </div>

                      {/* Manual Punches Section */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Manual Punches (Database)</h4>
                        {(() => {
                          const punchesObj = selectedEmployee.attendance?.manual_punches;
                          if (!punchesObj) {
                            return (
                              <div className="bg-white rounded p-3 border border-gray-200 flex items-center justify-center text-gray-400 text-xs h-[80px]">
                                No manual punches recorded
                              </div>
                            );
                          }

                          // Extract actual punches
                          const punches = punchesObj.manual && typeof punchesObj.manual === 'object'
                            ? punchesObj.manual
                            : punchesObj;

                          const activePunches = Object.entries(punches)
                            .filter(([key, val]) => val && val !== '' && typeof val === 'string' && key !== 'is_manual')
                            .sort((a, b) => a[1].localeCompare(b[1]));

                          if (activePunches.length === 0) {
                            return (
                              <div className="bg-white rounded p-3 border border-gray-200 flex items-center justify-center text-gray-400 text-xs h-[80px]">
                                No manual punches recorded
                              </div>
                            );
                          }

                          return (
                            <div className="bg-white rounded p-3 border border-gray-200 overflow-y-auto max-h-[120px] flex flex-wrap gap-2">
                              {activePunches.map(([key, time]) => (
                                <span key={key} className="inline-flex items-center px-2 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-md text-xs font-mono font-medium">
                                  Punch {key}: {time}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t bg-gray-50">
                {/* Inline save error */}
                {saveError && (
                  <div className="flex items-start gap-2 px-4 pt-3 pb-0">
                    <X size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600 font-medium leading-snug">{saveError}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2 p-4">
                  <button
                    onClick={() => {
                      setIsSlidePanelOpen(false);
                      setSelectedEmployee(null);
                      setSaveError(null);
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFromSlidePanel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded font-semibold flex items-center gap-1.5 transition-colors shadow-sm min-w-[80px] justify-center"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw Punches Section - Compact */}
      {rawLogs.length > 0 && (
        <div className="mt-3">
          <details className="bg-white rounded-md border border-gray-200">
            <summary className="px-2 py-1.5 cursor-pointer hover:bg-gray-50 text-xs font-medium text-gray-700">
              Raw Punch Logs (IST) ({rawLogs.length})
            </summary>
            <div className="overflow-x-auto p-2 border-t">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Date</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Day</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Time (IST)</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Employee</th>
                    <th className="text-left px-2 py-1 text-[10px] text-gray-600">Store</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rawLogs.slice(0, 50).map((log, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-2 py-1 text-[10px] text-gray-700">{log.date}</td>
                      <td className="px-2 py-1 text-[10px] text-gray-500">{log.day}</td>
                      <td className="px-2 py-1 text-[10px] font-mono font-medium text-indigo-600">{log.time}</td>
                      <td className="px-2 py-1 text-[10px] text-gray-900">{log.employeeName}</td>
                      <td className="px-2 py-1 text-[10px] text-gray-600">{log.storeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Mark Attendance Modal Popup */}
      {isMarkModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsMarkModalOpen(false)}>
          <div className="bg-white max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-fade-in text-gray-900 " onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <ClockIcon size={16} className="text-indigo-600" />
                Mark Attendance Manually
              </h3>
              <button
                onClick={() => setIsMarkModalOpen(false)}
                className="p-1 hover:bg-gray-200 text-gray-400 hover:text-gray-600 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleMarkSubmit} className="p-5 space-y-4">
              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Date</label>
                <input
                  type="text"
                  value={selectedDate}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 font-bold text-slate-600 cursor-not-allowed font-mono"
                  readOnly
                />
              </div>

              {/* Employee Selection */}
              <div className="employee-select-container relative">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Employee <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search by name or ID..."
                    value={markEmployeeSearch}
                    onChange={(e) => {
                      setMarkEmployeeSearch(e.target.value);
                      setIsDropdownOpen(true);
                      if (markEmployeeId) {
                        setMarkEmployeeId('');
                      }
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 pr-8"
                    required={!markEmployeeId}
                  />
                  {markEmployeeSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setMarkEmployeeSearch('');
                        setMarkEmployeeId('');
                        setIsDropdownOpen(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <input
                  type="hidden"
                  value={markEmployeeId}
                  required
                />

                {isDropdownOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {(() => {
                      const filtered = allEmployees.filter(emp => {
                        const q = markEmployeeSearch.toLowerCase().trim();
                        if (!q) return true;
                        return (
                          emp.employee_id?.toString().toLowerCase().includes(q) ||
                          emp.employee_name?.toString().toLowerCase().includes(q)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="px-3 py-2 text-xs text-gray-500 italic text-center">
                            No matching employees found
                          </div>
                        );
                      }

                      return filtered.map(emp => (
                        <button
                          key={emp.employee_id}
                          type="button"
                          onClick={() => {
                            setMarkEmployeeId(emp.employee_id);
                            setMarkEmployeeSearch(`(${emp.employee_id}) ${emp.employee_name}`);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 transition-colors flex flex-col ${markEmployeeId === emp.employee_id ? 'bg-indigo-50 font-semibold' : ''
                            }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-gray-900 font-medium">{emp.employee_name}</span>
                            <span className={`text-[9px] px-1 rounded font-semibold ${emp.is_matched ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                              }`}>
                              {emp.is_matched ? 'Matched' : 'Unmatched'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500">ID: {emp.employee_id}</span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Status</label>
                <div className="flex gap-4 mt-2">
                  {['Present', 'Late', 'Absent', 'Half Day'].map((st) => (
                    <label key={st} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="markStatus"
                        value={st}
                        checked={markStatus === st}
                        onChange={() => setMarkStatus(st)}
                        className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* In & Out Times */}
              {markStatus !== 'Absent' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">In Time (IST)</label>
                    <input
                      type="datetime-local"
                      value={markInTime}
                      onChange={(e) => setMarkInTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Out Time (IST)</label>
                    <input
                      type="datetime-local"
                      value={markOutTime}
                      onChange={(e) => setMarkOutTime(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-gray-900"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 pt-10">
                <button
                  type="button"
                  onClick={() => setIsMarkModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  Save Attendance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Employee Attendance Overview Preview Window Modal */}
      {previewModal.isOpen && previewModal.employee && (() => {
        const emp = previewModal.employee;
        const empProfile = employeesData.find(e => e.employee_id === emp.id || e.id === emp.id);
        const avatar = empProfile?.candidate_photo || emp.candidate_photo;
        const empDesignation = empProfile?.designation || emp.designation || '-';
        const empStore = empProfile?.joining_place || emp.store_name || '-';

        // Selected month dates
        const pMonth = previewModal.month;
        const pYear = pMonth.getFullYear();
        const pMonthIdx = pMonth.getMonth();
        const daysInPMonth = new Date(pYear, pMonthIdx + 1, 0).getDate();

        const todayObj = new Date();
        const isCurrentMonth = pYear === todayObj.getFullYear() && pMonthIdx === todayObj.getMonth();
        const maxDay = isCurrentMonth ? Math.min(todayObj.getDate(), daysInPMonth) : daysInPMonth;

        // Build list of days for selected month up to maxDay
        const dayRows = [];
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalLate = 0;
        let totalLateMins = 0;
        let totalWorkMs = 0;
        let totalLunchMs = 0;

        for (let d = 1; d <= maxDay; d++) {
          const dateStr = `${pYear}-${String(pMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const dateObj = new Date(pYear, pMonthIdx, d);
          const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

          // Date-specific roster lookup
          const rEntry = getEmployeeRoster(emp.id, dateStr);
          const hasRoster = !!(rEntry && rEntry.shift_type);
          const shiftName = hasRoster ? rEntry.shift_type : 'Roster Not Available';

          // Scheduled start/end
          let scheduledStartStr = '10:00';
          let scheduledEndStr = '19:30';
          if (hasRoster && rEntry.start_time) {
            scheduledStartStr = rEntry.start_time.substring(0, 5);
          }
          if (hasRoster && rEntry.end_time) {
            scheduledEndStr = rEntry.end_time.substring(0, 5);
          }

          // Attendance record & Leave status check
          const att = getAttendanceForDate(emp.id, dateStr);
          const inTime = att.in_time;
          const outTime = att.out_time;

          const empLeaveInfo = getLeaveInfoForStreak(emp.id, dateStr, dateStr);
          const isOnLeaveInTable = !!(empLeaveInfo && (empLeaveInfo.reason || empLeaveInfo.leaveType));

          // Compute late minutes against date-specific roster
          const lateMins = inTime ? calculateLateMinutes(inTime, dateStr, rEntry) : 0;

          let status = att.status;
          if (!status || status === 'Absent') {
            if (!inTime || inTime === '-') {
              if (isOnLeaveInTable) {
                status = 'On Leave';
              } else {
                status = 'Absent';
              }
            } else {
              status = lateMins > 0 ? 'Late' : 'Present';
            }
          }

          // Lunch duration
          const lunchStr = att.standard_lunch || '-';

          // Compute working hours (deducting lunch duration)
          const workHrsStr = att.working_hour && att.working_hour !== '-' ? att.working_hour : (inTime && outTime ? calculateWorkHours(inTime, outTime, dateStr, lunchStr) : '00:00:00');
          const [wh, wm, ws] = (workHrsStr || '00:00:00').split(':').map(Number);
          const dayWorkMs = ((wh || 0) * 3600 + (wm || 0) * 60 + (ws || 0)) * 1000;

          // Parse timestamps for timeline visualization
          let inTimeFormatted = inTime ? formatTimeIST(inTime) : null;
          let outTimeFormatted = outTime ? formatTimeIST(outTime) : null;

          // Stats counters
          if (status === 'Present' || status === 'Late') {
            totalPresent++;
            if (lateMins > 0 || status === 'Late') {
              totalLate++;
              totalLateMins += lateMins;
            }
          } else if (status === 'Absent') {
            totalAbsent++;
          }

          totalWorkMs += dayWorkMs;

          dayRows.push({
            dayNum: d,
            dateStr,
            dayName,
            shiftName,
            hasRoster,
            scheduledStartStr,
            scheduledEndStr,
            inTimeFormatted,
            outTimeFormatted,
            inTime,
            outTime,
            lunchStr,
            workHrsStr,
            dayWorkMs,
            lateMins,
            status,
            attendance: att,
            rEntry
          });
        }

        const totalWorkHrsDec = totalWorkMs / (3600 * 1000);
        const avgWorkHrsDec = totalPresent > 0 ? (totalWorkHrsDec / totalPresent).toFixed(1) : '0.0';

        // Format total work hours string
        const totalWorkHrsInt = Math.floor(totalWorkHrsDec);
        const totalWorkMinsInt = Math.round((totalWorkHrsDec - totalWorkHrsInt) * 60);
        const totalWorkFormatted = `${totalWorkHrsInt}h ${totalWorkMinsInt}m`;

        return (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewModal({ ...previewModal, isOpen: false })}
          >
            <div
              className="bg-white max-w-5xl w-full rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header & Employee Overview */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 pr-14 relative">
                <button
                  onClick={() => setPreviewModal({ ...previewModal, isOpen: false })}
                  className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/10 shadow-sm active:scale-95"
                  title="Close preview"
                >
                  <X size={18} />
                </button>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={emp.name}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-white/20 shadow-md"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-xl font-bold text-white shadow-md">
                          {emp.name ? emp.name.charAt(0).toUpperCase() : '?'}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white tracking-tight">{emp.name}</h2>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono text-indigo-200 border border-white/10">
                          ID: {emp.id}
                        </span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                        {empDesignation} • {empStore}
                      </p>

                      {/* Current Roster Info */}
                      <div className="flex items-center gap-2 mt-2">
                        {(() => {
                          const todayRoster = getEmployeeRoster(emp.id, selectedDate);
                          if (todayRoster && todayRoster.shift_type) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[11px] font-semibold">
                                📅 {todayRoster.shift_type} ({todayRoster.start_time?.substring(0, 5) || '10:00'} – {todayRoster.end_time?.substring(0, 5) || '19:30'})
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-medium">
                              Roster Not Available (10:00 AM – 7:30 PM Fallback)
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Month Selection & View Tab Switcher */}
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Month Picker */}
                    <div className="flex items-center gap-1 bg-white/10 border border-white/10 rounded-xl px-1.5 py-1">
                      <button
                        onClick={() => {
                          const newM = new Date(previewModal.month);
                          newM.setMonth(newM.getMonth() - 1);
                          setPreviewModal({ ...previewModal, month: newM });
                        }}
                        className="p-1 hover:bg-white/10 text-white rounded-lg transition-colors"
                        title="Previous Month"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs font-semibold text-white px-2 min-w-[110px] text-center">
                        {monthNames[previewModal.month.getMonth()]} {previewModal.month.getFullYear()}
                      </span>
                      <button
                        onClick={() => {
                          const newM = new Date(previewModal.month);
                          newM.setMonth(newM.getMonth() + 1);
                          setPreviewModal({ ...previewModal, month: newM });
                        }}
                        className="p-1 hover:bg-white/10 text-white rounded-lg transition-colors"
                        title="Next Month"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* View Mode Toggle: Timecard vs Timeline */}
                    <div className="flex bg-white/10 p-1 rounded-xl border border-white/10">
                      <button
                        onClick={() => setPreviewModal({ ...previewModal, tab: 'timecard' })}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${previewModal.tab === 'timecard'
                          ? 'bg-white text-indigo-950 shadow-md font-bold'
                          : 'text-indigo-200 hover:text-white'
                          }`}
                      >
                        📊 Timecard
                      </button>
                      <button
                        onClick={() => setPreviewModal({ ...previewModal, tab: 'timeline' })}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${previewModal.tab === 'timeline'
                          ? 'bg-white text-indigo-950 shadow-md font-bold'
                          : 'text-indigo-200 hover:text-white'
                          }`}
                      >
                        📈 Timeline
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-4 pt-4 border-t border-white/10">
                  <div className="bg-white/5 rounded-xl p-2 border border-white/5 text-center">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Working Days</p>
                    <p className="text-base font-bold text-white mt-0.5">{dayRows.length}</p>
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
                    <p className="text-[10px] font-medium text-amber-300 uppercase tracking-wider">Late Days / Mins</p>
                    <p className="text-base font-bold text-amber-400 mt-0.5">{totalLate} <span className="text-xs font-normal">({totalLateMins}m)</span></p>
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

              {/* Modal Body Content */}
              <div className="flex-1 overflow-y-auto p-5 bg-slate-50 min-h-0">
                {previewModal.tab === 'timecard' ? (
                  /* PAGE 1: TIMECARD VIEW */
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Date</th>
                            <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Day</th>
                            <th className="px-3 py-2.5 font-bold text-left uppercase text-[10px]">Roster / Shift</th>
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
                            const isAbsent = row.status === 'Absent';
                            const isOnLeave = row.status === 'On Leave';
                            const isWeekendDay = ['Fri', 'Sat', 'Sun'].includes(row.dayName);
                            // Highlight ONLY if Friday, Saturday, or Sunday AND absent/on leave
                            const isWeekendAbsentOrLeave = isWeekendDay && (isAbsent || isOnLeave);

                            return (
                              <tr
                                key={row.dayNum}
                                className={`transition-colors ${
                                  isWeekendAbsentOrLeave
                                    ? 'bg-red-100/80 hover:bg-red-200/80 border-l-4 border-l-red-500'
                                    : 'hover:bg-slate-50/80'
                                }`}
                              >
                                <td className="px-3 py-2 text-slate-900 font-bold font-mono">
                                  {String(row.dayNum).padStart(2, '0')} {monthNames[pMonthIdx].substring(0, 3)}
                                </td>
                                <td className={`px-3 py-2 font-bold ${isWeekendAbsentOrLeave ? 'text-red-700' : 'text-slate-500'}`}>
                                  {row.dayName}
                                </td>
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
                              <td className="px-3 py-2 text-center text-slate-600 font-mono">
                                {row.scheduledStartStr} – {row.scheduledEndStr}
                              </td>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">
                                {row.inTimeFormatted || '-'}
                              </td>
                              <td className="px-3 py-2 text-center font-mono font-semibold text-slate-800">
                                {row.outTimeFormatted || '-'}
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-slate-500">{row.lunchStr}</td>
                              <td className="px-3 py-2 text-center font-mono font-bold text-slate-800">
                                {row.workHrsStr}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">
                                {row.lateMins > 0 ? (
                                  <span className="text-orange-600 font-bold">{row.lateMins}m</span>
                                ) : (
                                  <span className="text-slate-400">0m</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {(() => {
                                  if (row.status === 'Present') return <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">Present</span>;
                                  if (row.status === 'Late') return <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">Late</span>;
                                  if (row.status === 'Half Day') return <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 text-[10px] font-bold">Half Day</span>;
                                  if (row.status === 'Weekly Off') return <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">Weekly Off</span>;
                                  if (row.status === 'On Leave') return <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">On Leave</span>;
                                  return <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">Absent</span>;
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* PAGE 2: TIMELINE VIEW (Visual Work Progress & Segment Graphs) */
                  <div className="space-y-3">
                    {dayRows.map((row) => {
                      const hasPunches = row.inTimeFormatted || row.outTimeFormatted;
                      const isAbsent = row.status === 'Absent';
                      const isOnLeave = row.status === 'On Leave';
                      const isWeekendDay = ['Fri', 'Sat', 'Sun'].includes(row.dayName);
                      const isWeekendAbsentOrLeave = isWeekendDay && (isAbsent || isOnLeave);

                      return (
                        <div
                          key={row.dayNum}
                          className={`rounded-2xl p-3.5 border shadow-sm flex flex-col gap-2 ${
                            isWeekendAbsentOrLeave
                              ? 'bg-red-50/80 border-red-300 ring-1 ring-red-400/30'
                              : 'bg-white border-slate-200/80'
                          }`}
                        >
                          <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold font-mono ${isWeekendAbsentOrLeave ? 'text-red-700' : 'text-slate-900'}`}>
                                {String(row.dayNum).padStart(2, '0')} {monthNames[pMonthIdx].substring(0, 3)} ({row.dayName})
                              </span>
                              {row.hasRoster ? (
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
                              {row.inTimeFormatted && <span className="text-emerald-700 font-semibold">In: {row.inTimeFormatted}</span>}
                              {row.outTimeFormatted && <span className="text-slate-700 font-semibold">Out: {row.outTimeFormatted}</span>}
                              {!row.outTimeFormatted && row.inTimeFormatted && (
                                <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                  ⚠️ Missing Punch Out
                                </span>
                              )}
                              <span className="font-bold text-slate-900">Total: {row.workHrsStr}</span>
                              {row.lateMins > 0 && <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">Late by {row.lateMins}m</span>}
                            </div>
                          </div>

                          {/* Visual Horizontal Timeline Bar */}
                          {hasPunches ? (
                            <div className="pt-1">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                                <span>Scheduled Start ({row.scheduledStartStr})</span>
                                <span>Lunch Break ({row.lunchStr})</span>
                                <span>Scheduled End ({row.scheduledEndStr})</span>
                              </div>
                              <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex relative border border-slate-200">
                                {/* Segment 1: Work Before Lunch */}
                                <div className="bg-emerald-500 flex-1 flex items-center justify-center text-white text-[10px] font-bold tracking-wider shadow-inner">
                                  WORK HOURS
                                </div>
                                {/* Segment 2: Lunch Break */}
                                <div className="bg-amber-400 px-3 flex items-center justify-center text-slate-900 text-[10px] font-bold border-x border-amber-300">
                                  LUNCH
                                </div>
                                {/* Segment 3: Work After Lunch or Incomplete */}
                                {row.outTimeFormatted ? (
                                  <div className="bg-indigo-600 flex-1 flex items-center justify-center text-white text-[10px] font-bold tracking-wider shadow-inner">
                                    WORK HOURS
                                  </div>
                                ) : (
                                  <div className="bg-amber-500/30 border-l border-dashed border-amber-400 flex-1 flex items-center justify-center text-amber-900 text-[10px] font-semibold animate-pulse">
                                    INCOMPLETE (Punch Out Missing)
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className={`py-2 text-center rounded-xl border border-dashed ${isWeekendAbsentOrLeave ? 'bg-red-100/70 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
                              <span className="text-xs font-semibold text-red-500">Absent — No Punch Recorded</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AttendanceDaily;