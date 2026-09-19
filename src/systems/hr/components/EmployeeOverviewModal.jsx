import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Helper to calculate work hours between two 12h/24h strings
const calculateWorkHours = (inTimeStr, outTimeStr, dateStr, lunchStr = '00:00:00') => {
  if (!inTimeStr || !outTimeStr || inTimeStr === '-' || outTimeStr === '-') return '00:00:00';
  try {
    const parseDateTime = (str) => {
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
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day, h, m, s);
    };

    const inDate = parseDateTime(inTimeStr);
    let outDate = parseDateTime(outTimeStr);
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

const resolvePunchedStore = (att) => {
  if (!att) return null;
  if (att.shop_name && att.shop_name !== '-') return att.shop_name;
  if (att.joining_place && att.joining_place !== '-') return att.joining_place;
  if (att.store_name && att.store_name !== '-') return att.store_name;
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
  const [learningSubmission, setLearningSubmission] = useState(null);
  const [learningLoading, setLearningLoading] = useState(false);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [payrollLoading, setPayrollLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setModalMonth(initialMonth || new Date());
      setActiveTab(initialTab || 'timecard');
    }
  }, [isOpen, initialMonth, initialTab]);

  useEffect(() => {
    if (isOpen && employee) {
      fetchAttendanceData();
    }
  }, [isOpen, employee, modalMonth]);

  useEffect(() => {
    if (isOpen && employee && activeTab === 'learning') {
      fetchLearningData();
    }
    if (isOpen && employee && activeTab === 'payslip') {
      fetchPayrollData();
    }
  }, [isOpen, employee, activeTab]);

  const fetchAttendanceData = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const empIdStr = String(employee.id || employee.employee_id || employee.code || '').trim();
      const empNameStr = String(employee.name || employee.user_name || '').trim();

      const year = modalMonth.getFullYear();
      const monthNum = modalMonth.getMonth() + 1;
      const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthNum, 0).getDate();
      const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      // 1. Fetch attendance from hr_management_attendance_logs and hr_attendance_daily
      const { data: logsData } = await supabase
        .from('hr_management_attendance_logs')
        .select('*')
        .or(`employee_id.eq.${empIdStr},employee_id.eq.${empIdStr.replace(/^0+/, '')}`)
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate)
        .limit(5000);

      const { data: dailyData } = await supabase
        .from('hr_attendance_daily')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .limit(5000);

      const combinedLogs = [
        ...(logsData || []).map(l => ({ ...l, date: l.date || l.attendance_date })),
        ...(dailyData || [])
      ];

      const filteredAtt = combinedLogs.filter(a => {
        const idCol = String(a.employee_id || a.emp_id || '').trim().toLowerCase();
        const nameCol = String(a.employee_name || a.name || a.emp_name || '').trim().toLowerCase();
        const eId = empIdStr.toLowerCase();
        const eName = empNameStr.toLowerCase();

        const idMatches = Boolean(eId && idCol) && (
          idCol === eId ||
          idCol.replace(/^0+/, '') === eId.replace(/^0+/, '') ||
          parseInt(idCol, 10) === parseInt(eId, 10)
        );

        const nameMatches = Boolean(eName && nameCol) && (
          nameCol === eName ||
          nameCol.includes(eName) ||
          eName.includes(nameCol)
        );

        return idMatches || nameMatches;
      });

      setAttendanceLogs(filteredAtt);

      // 2. Fetch rosters
      const { data: rosterData } = await supabase
        .from('hr_management_shift_roster')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (rosterData) {
        const filteredRoster = rosterData.filter(r => {
          const idCol = String(r.employee_id || r.emp_id || '').trim();
          const nameCol = String(r.employee_name || r.name || '').trim().toLowerCase();
          return (empIdStr && idCol === empIdStr) || (empNameStr && nameCol.includes(empNameStr.toLowerCase()));
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
      const empIdStr = String(employee.id || employee.employee_id || employee.code || '').trim();
      const empNameStr = String(employee.name || employee.user_name || '').trim().toLowerCase();

      const { data } = await supabase
        .from('hr_employee_learning_submissions')
        .select('*')
        .order('submission_date', { ascending: false });

      if (data) {
        const found = data.find(s => {
          const sId = String(s.employee_id || s.employee_code || '').trim();
          const sName = String(s.employee_name || '').trim().toLowerCase();
          return (empIdStr && sId === empIdStr) || (empNameStr && sName.includes(empNameStr));
        });
        setLearningSubmission(found || null);
      } else {
        setLearningSubmission(null);
      }
    } catch (err) {
      console.error('Error fetching learning report:', err);
    } finally {
      setLearningLoading(false);
    }
  };

  const fetchPayrollData = async () => {
    if (!employee) return;
    setPayrollLoading(true);
    try {
      const empIdStr = String(employee.id || employee.employee_id || employee.code || '').trim();
      const empNameStr = String(employee.name || employee.user_name || '').trim().toLowerCase();

      const { data } = await supabase
        .from('hr_management_payroll')
        .select('*')
        .order('id', { ascending: false });

      if (data) {
        const filtered = data.filter(r => {
          const idCol = String(r.employee_id || r.employee_code || '').trim();
          const nameCol = String(r.employee_name || r.name || '').trim().toLowerCase();
          return (empIdStr && idCol === empIdStr) || (empNameStr && nameCol.includes(empNameStr));
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

  const empName = employee.name || employee.user_name || employee.candidate_name || 'Employee';
  const empId = employee.id || employee.employee_id || employee.code || 'N/A';
  const avatar = employee.candidate_photo || employee.photo_url;
  const empDesignation = employee.designation || employee.Designation || 'Staff';
  const empStore = employee.joining_place || employee.shop_name || employee.store_name || 'MUMBAI';

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
  let totalLateMins = 0;
  let totalWorkMs = 0;

  for (let d = 1; d <= maxDay; d++) {
    const dateStr = `${pYear}-${String(pMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dateObj = new Date(pYear, pMonthIdx, d);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

    const rEntry = rosterLogs.find(r => r.date === dateStr);
    const hasRoster = !!(rEntry && rEntry.shift_type);
    const shiftName = hasRoster ? rEntry.shift_type : 'Roster Not Available';
    const scheduledStartStr = hasRoster && rEntry.start_time ? rEntry.start_time.substring(0, 5) : '10:00';
    const scheduledEndStr = hasRoster && rEntry.end_time ? rEntry.end_time.substring(0, 5) : '19:30';

    const att = attendanceLogs.find(a => {
      const dVal = (a.date || a.attendance_date || '').toString().trim();
      const dKey = dVal.includes('T') ? dVal.split('T')[0] : dVal.substring(0, 10);
      return dKey === dateStr;
    }) || {};
    const inTime = att.in_time || att.check_in || att.clock_in || att.in_time_ist;
    const outTime = att.out_time || att.check_out || att.clock_out || att.out_time_ist;

    const isRosterWeeklyOff = hasRoster && (
      String(rEntry.shift_type).toLowerCase().includes('weekly off') || 
      String(rEntry.shift_type).toLowerCase() === 'wo' ||
      String(rEntry.shift_type).toLowerCase() === 'weeklyoff'
    );

    let status = att.status;
    const hasPunches = Boolean(inTime || outTime || (att.punch_log && att.punch_log !== '-'));
    const isLate = Boolean((att.late_minutes && att.late_minutes > 0) || (att.late_minute && att.late_minute > 0) || status === 'Late');

    if (hasPunches) {
      status = isLate ? 'Late' : 'Present';
    } else if (!status || status === 'Absent') {
      if (isRosterWeeklyOff) {
        status = 'Weekly Off';
      } else {
        status = 'Absent';
      }
    }

    const lateMins = att.late_minutes || 0;
    const lunchStr = att.standard_lunch || '-';
    const workHrsStr = att.working_hour && att.working_hour !== '-' ? att.working_hour : (inTime && outTime ? calculateWorkHours(inTime, outTime, dateStr, lunchStr) : '00:00:00');

    const [wh, wm, ws] = (workHrsStr || '00:00:00').split(':').map(Number);
    const dayWorkMs = ((wh || 0) * 3600 + (wm || 0) * 60 + (ws || 0)) * 1000;

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
      inTimeFormatted: formatTimeIST(inTime),
      outTimeFormatted: formatTimeIST(outTime),
      lunchStr,
      workHrsStr,
      lateMins,
      status,
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
                      return (
                        <tr key={row.dayNum} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2 text-slate-900 font-bold font-mono">
                            {String(row.dayNum).padStart(2, '0')} {monthNames[pMonthIdx].substring(0, 3)}
                          </td>
                          <td className="px-3 py-2 font-bold text-slate-500">{row.dayName}</td>
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
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {(() => {
                              if (row.status === 'Present') return <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">P</span>;
                              if (row.status === 'Late') return <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">L</span>;
                              if (row.status === 'Half Day') return <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-[10px] font-bold">HD</span>;
                              if (row.status === 'Weekly Off') return <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">WO</span>;
                              if (row.status === 'Day Off') return <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-bold">DO</span>;
                              if (row.status === 'On Leave') return <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-bold">Leave</span>;
                              return <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">A</span>;
                            })()}
                          </td>
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
                const hasPunches = Boolean(row.inTimeFormatted || row.outTimeFormatted);
                return (
                  <div key={row.dayNum} className="rounded-2xl p-3.5 border border-slate-200 bg-white shadow-sm flex flex-col gap-2">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-slate-900">
                          {String(row.dayNum).padStart(2, '0')} {monthNames[pMonthIdx].substring(0, 3)} ({row.dayName})
                        </span>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[10px]">
                          📅 {row.shiftName} ({row.scheduledStartStr} – {row.scheduledEndStr})
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        {row.inTimeFormatted && <span className="text-emerald-700 font-semibold">In: {row.inTimeFormatted}</span>}
                        {row.outTimeFormatted && <span className="text-slate-700 font-semibold">Out: {row.outTimeFormatted}</span>}
                        <span className="font-bold text-slate-900">Total: {row.workHrsStr}</span>
                      </div>
                    </div>

                    {hasPunches ? (
                      <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex relative border border-slate-200">
                        <div className="bg-emerald-500 flex-1 flex items-center justify-center text-white text-[10px] font-bold">MORNING SHIFT</div>
                        <div className="bg-amber-400 px-3 flex items-center justify-center text-slate-900 text-[10px] font-bold">LUNCH</div>
                        <div className="bg-indigo-600 flex-1 flex items-center justify-center text-white text-[10px] font-bold">EVENING SHIFT</div>
                      </div>
                    ) : (
                      <div className="py-2 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <span className="text-xs font-semibold text-red-500">Absent — No Punch Recorded</span>
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
                  const totalCompleted = tasksList.filter(t => t.checked).length;
                  const deptList = ['EXCISE', 'RETAIL', 'SANCKS', 'STOCKS', 'WHOLESALE', 'TECHNICAL', 'IMP RETAIL/RETAIL /SANCKS'];

                  return (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-500 uppercase">Submission Summary</span>
                          <span className="text-sm font-bold text-slate-900 block mt-0.5">
                            {totalCompleted} Tasks Completed • {learningSubmission.shop_name} ({learningSubmission.submission_date})
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
                        const totalDeductions = (Number(payRecord.advance_deduction || payRecord.deduction || 0) + Number(payRecord.breakage_deduction || 0) + Number(payRecord.medical_deduction || 0) + Number(payRecord.rto_deduction || 0) + wayOffAmt);
                        return (
                          <tr key={payRecord.id || `${payRecord.year}-${payRecord.month}`} className="hover:bg-slate-50">
                            <td className="px-3.5 py-2.5 font-bold text-slate-900">{payRecord.month} {payRecord.year}</td>
                            <td className="px-3.5 py-2.5">₹{Number(payRecord.base_salary || payRecord.salary || 0).toLocaleString()}</td>
                            <td className="px-3.5 py-2.5">{payRecord.total_present || payRecord.present_days || payRecord.working_days || 0} Days</td>
                            <td className="px-3.5 py-2.5 text-rose-600">-₹{totalDeductions.toLocaleString()}</td>
                            <td className="px-3.5 py-2.5 text-rose-600 font-semibold">{wayOffAmt > 0 ? `-₹${wayOffAmt.toLocaleString()}` : '-'}</td>
                            <td className="px-3.5 py-2.5 font-bold text-emerald-600">₹{Number(payRecord.net_salary || payRecord.net_payable || 0).toLocaleString()}</td>
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
