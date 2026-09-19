import { supabase } from '../lib/supabase';

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';
const MASTER_MAP_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch';

const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

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

const calculateLateMinutes = (timeStr) => {
    if (!timeStr || timeStr === '-') return 0;
    try {
        const timePart = timeStr.split(' ')[1];
        if (!timePart) return 0;
        const [h, m] = timePart.split(':').map(Number);
        const totalMins = h * 60 + m;
        const threshold = 10 * 60 + 10; // 10:10 AM
        const base = 10 * 60 + 0; // 10:00 AM
        if (totalMins >= threshold) return totalMins - base;
        return 0;
    } catch (e) { return 0; }
};

const formatSecsToHrsMins = (totalSecs) => {
    if (!totalSecs) return '0h 0m';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${hrs}h ${mins}m`;
};

const parseTimeToSeconds = (timeStr) => {
    if (!timeStr || timeStr === '-') return 0;
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 3600 + parts[1] * 60;
    }
    return 0;
};

const clampInTimeTo10AM = (timeStr, dateContext = '') => {
    if (!timeStr || timeStr === '-') return timeStr;
    try {
        let cleanTime = timeStr.toString().trim();
        let timePart = cleanTime.includes(' ') ? cleanTime.split(' ')[1] : cleanTime.includes('T') ? cleanTime.split('T')[1] : cleanTime;
        let [hStr] = timePart.split(':');
        let h = parseInt(hStr, 10);
        if (cleanTime.toUpperCase().includes('PM') && h < 12) h += 12;
        if (cleanTime.toUpperCase().includes('AM') && h === 12) h = 0;
        if (h < 10) {
            const prefix = cleanTime.includes('T') ? cleanTime.split('T')[0] + 'T' : cleanTime.includes(' ') ? cleanTime.split(' ')[0] + ' ' : '';
            return `${prefix}10:00:00`;
        }
        return timeStr;
    } catch (e) {
        return timeStr;
    }
};

const clampOutTimeTo11PM = (timeStr, dateContext = '') => {
    if (!timeStr || timeStr === '-') return timeStr;
    try {
        let cleanTime = timeStr.toString().trim();
        let timePart = cleanTime.includes(' ') ? cleanTime.split(' ')[1] : cleanTime.includes('T') ? cleanTime.split('T')[1] : cleanTime;
        let [hStr, mStr] = timePart.split(':');
        let h = parseInt(hStr, 10);
        let m = parseInt(mStr, 10) || 0;
        if (cleanTime.toUpperCase().includes('PM') && h < 12) h += 12;
        if (cleanTime.toUpperCase().includes('AM') && h === 12) h = 0;
        if (h > 23 || (h === 23 && m > 0)) {
            const prefix = cleanTime.includes('T') ? cleanTime.split('T')[0] + 'T' : cleanTime.includes(' ') ? cleanTime.split(' ')[0] + ' ' : '';
            return `${prefix}23:00:00`;
        }
        return timeStr;
    } catch (e) {
        return timeStr;
    }
};

const calculateWorkHoursFromTimes = (inStr, outStr, dateContext = '') => {
    if (!inStr || !outStr || inStr === '-' || outStr === '-' || inStr === outStr) return '00:00:00';
    try {
        const clampedIn = clampInTimeTo10AM(inStr, dateContext);
        const clampedOut = clampOutTimeTo11PM(outStr, dateContext);

        const parse = (s) => {
            if (!s || s === '-') return null;
            let clean = s.trim();
            if (clean.includes('-') && clean.includes(':')) {
                const d = new Date(clean.replace(/-/g, '/').replace('T', ' '));
                if (!isNaN(d.getTime())) return d;
            }
            let timePart = clean.includes(' ') ? clean.split(' ')[1] : clean.includes('T') ? clean.split('T')[1] : clean;
            let isPM = clean.toUpperCase().includes('PM');
            let isAM = clean.toUpperCase().includes('AM');
            timePart = timePart.replace(/[AP]M/gi, '').trim();
            let [h, m, sec] = timePart.split(':').map(Number);
            if (isPM && h < 12) h += 12;
            if (isAM && h === 12) h = 0;
            const base = dateContext ? new Date(dateContext.replace(/-/g, '/')) : new Date();
            base.setHours(h || 0, m || 0, sec || 0, 0);
            return base;
        };

        const inDate = parse(clampedIn);
        const outDate = parse(clampedOut);
        if (!inDate || !outDate || outDate <= inDate) return '00:00:00';
        const diffMs = outDate - inDate;
        const totalSecs = Math.floor(diffMs / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } catch (e) {
        return '00:00:00';
    }
};

/**
export const syncDeviceLogsToSupabase = async (month, year, device) => {
    const startDay = '01';
    const endDay = getDaysInMonth(month, year);
    const paddedMonth = month.toString().padStart(2, '0');
    const fromDate = `${year}-${paddedMonth}-${startDay}`;
    const toDate = `${year}-${paddedMonth}-${endDay}`;

    const devicesToSync = (device && device.serial && device.serial !== 'ALL') ? [device] : [
        { name: 'BAWDHAN', apiName: 'BAVDHAN', serial: 'C26238441B1E342D' },
        { name: 'HINJEWADI', apiName: 'HINJEWADI', serial: 'AMDB25061400335' },
        { name: 'WAGHOLI', apiName: 'WAGHOLI', serial: 'AMDB25061400343' },
        { name: 'AKOLE', apiName: 'AKOLE', serial: 'C262CC13CF202038' },
        { name: 'MUMBAI', apiName: 'MUMBAI', serial: 'C2630450C32A2327' },
        { name: 'KHARGHAR', apiName: 'KHARGHAR', serial: 'AMDB25120600859' }
    ];

    const { data: hrEmps } = await supabase
        .from('hr_management_employees')
        .select('employee_id, name_as_per_aadhar, joining_place');

    const empMap = {};
    (hrEmps || []).forEach(e => {
        if (e.employee_id) {
            empMap[e.employee_id.toString().trim().toLowerCase()] = {
                name: e.name_as_per_aadhar || 'Unknown',
                store: e.joining_place || ''
            };
        }
    });

    const allPunches = [];

    await Promise.all(devicesToSync.map(async (dev) => {
        try {
            const url = `http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs?APIKey=211616032630&SerialNumber=${dev.serial}&DeviceName=${dev.apiName || dev.name}&FromDate=${fromDate}&ToDate=${toDate}`;
            const res = await fetch(url);
            if (res.ok) {
                const text = await res.text();
                if (text && !text.trim().startsWith('<')) {
                    const raw = JSON.parse(text);
                    if (Array.isArray(raw)) {
                        raw.forEach(p => {
                            if (p.EmployeeCode && p.LogDate) {
                                allPunches.push({ ...p, devName: dev.name, devSerial: dev.serial });
                            }
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Error fetching CAMS logs for ${dev.name}:`, e);
        }
    }));

    if (allPunches.length === 0) return;

    const grouped = {};
    allPunches.forEach(p => {
        const empId = p.EmployeeCode.toString().trim();
        const dateStr = p.LogDate.split(' ')[0];
        const key = `${empId}_${dateStr}`;
        if (!grouped[key]) {
            grouped[key] = { empId, date: dateStr, devName: p.devName, devSerial: p.devSerial, punches: [] };
        }
        grouped[key].punches.push(p.LogDate);
    });

    const formatTimeISTStr = (timeStr) => {
        if (!timeStr) return '-';
        try {
            const d = new Date(timeStr.replace(/-/g, '/'));
            if (isNaN(d.getTime())) return timeStr;
            return new Intl.DateTimeFormat('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }).format(d);
        } catch (e) { return timeStr; }
    };

    const upsertRows = Object.values(grouped).map(item => {
        item.punches.sort((a, b) => new Date(a.replace(/-/g, '/')) - new Date(b.replace(/-/g, '/')));
        const cleanEmpKey = item.empId.toLowerCase();
        const empInfo = empMap[cleanEmpKey] || { name: 'Unknown', store: item.devName };

        const inTimeRaw = item.punches[0];
        const outTimeRaw = item.punches.length > 1 ? item.punches[item.punches.length - 1] : item.punches[0];
        const formattedPunches = item.punches.map(p => formatTimeISTStr(p)).join(' | ');

        let workHoursStr = '00:00:00';
        if (item.punches.length > 1) {
            const d1 = new Date(inTimeRaw.replace(/-/g, '/'));
            const d2 = new Date(outTimeRaw.replace(/-/g, '/'));
            if (!isNaN(d1) && !isNaN(d2) && d2 > d1) {
                const diff = Math.floor((d2 - d1) / 1000);
                const h = Math.floor(diff / 3600);
                const m = Math.floor((diff % 3600) / 60);
                const s = diff % 60;
                workHoursStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
            }
        }

        return {
            employee_id: item.empId,
            employee_name: empInfo.name,
            attendance_date: item.date,
            status: 'Present',
            in_time: inTimeRaw.replace(' ', 'T'),
            out_time: outTimeRaw.replace(' ', 'T'),
            working_hour: workHoursStr,
            punch_log: formattedPunches,
            store_name: empInfo.store || item.devName,
            serial_number: item.devSerial,
            updated_at: new Date().toISOString()
        };
    });

    if (upsertRows.length > 0) {
        for (let i = 0; i < upsertRows.length; i += 100) {
            const batch = upsertRows.slice(i, i + 100);
            await supabase
                .from('hr_management_attendance_logs')
                .upsert(batch, { onConflict: 'employee_id,attendance_date' });
        }
    }
};

/**
 * Fetch logs and metadata, aggregate, and sync/upsert to Supabase
 * @param {number} month - 1-based month (1-12)
 * @param {number} year - year
 * @param {object} device - { name, apiName, serial }
 * @returns {Promise<Array>} the final normalized records upserted to Supabase
 */
export const syncMonthlyAttendanceFromApi = async (month, year, device) => {
    if (year < 2026 || (year === 2026 && month < 4)) {
        return [];
    }

    // Pull raw CAMS biometric device logs across devices and sync to Supabase table
    try {
        await syncDeviceLogsToSupabase(month, year, device);
    } catch (e) {
        console.warn('CAMS biometric sync warning:', e);
    }

    const startDay = '01';
    const endDay = getDaysInMonth(month, year);
    const paddedMonth = month.toString().padStart(2, '0');
    const fromDate = `${year}-${paddedMonth}-${startDay}`;
    const toDate = `${year}-${paddedMonth}-${endDay}`;

    const { data: dbLogs, error: dbError } = await supabase
        .from('hr_management_attendance_logs')
        .select('*')
        .gte('attendance_date', fromDate)
        .lte('attendance_date', toDate);

    if (dbError) {
        console.error('Error fetching daily attendance logs from DB:', dbError);
        throw dbError;
    }

    if (!dbLogs || dbLogs.length === 0) {
        return [];
    }

    // Fetch active employees to map their stores
    const { data: dbEmployees, error: empError } = await supabase
        .from('hr_management_employees')
        .select('employee_id, joining_place');

    if (empError) {
        console.error('Error fetching employees for store map:', empError);
    }
    const empStoreMap = {};
    (dbEmployees || []).forEach(emp => {
        if (emp.employee_id) {
            const rawId = emp.employee_id.toString().trim().toLowerCase();
            const normId = rawId.replace(/^0+/, '');
            empStoreMap[rawId] = emp.joining_place || '';
            if (normId) empStoreMap[normId] = emp.joining_place || '';
        }
    });

    const DEVICES = [
        { name: 'MADHURA', serial: 'C26238441B1E342D' },
        { name: 'TLS', serial: 'AMDB25061400335' },
        { name: 'FRIENDS', serial: 'AMDB25061400343' },
        { name: 'BALAJI', serial: 'C262CC13CF202038' },
        { name: 'KUNAL ULWE', serial: 'C2630450C32A2327' },
        { name: 'KUNAL KHARGHAR', serial: 'AMDB25120600859' }
    ];

    const monthlyAgg = {};
    const totalSundays = getSundaysCount(month, year);
    const totalDaysInMonth = getDaysInMonth(month, year);

    dbLogs.forEach(row => {
        const rawId = row.employee_id;
        if (!rawId) return;

        // Normalize employee ID key (e.g. '107' and '0107' map to same key '107')
        const normIdKey = String(rawId).trim().toLowerCase().replace(/^0+/, '') || String(rawId).trim().toLowerCase();

        let serial = row.serial_number;
        if (!serial || serial === '' || serial === '-') {
            const storeName = row.store_name || empStoreMap[normIdKey] || empStoreMap[rawId.toString().trim().toLowerCase()] || '';
            const matchedDevice = DEVICES.find(d => d.name.toUpperCase() === storeName.toUpperCase());
            if (matchedDevice) {
                serial = matchedDevice.serial;
            }
        }

        if (device && device.serial && device.serial !== 'ALL') {
            if (!serial || serial === '' || serial === '-') return;
            if (serial !== device.serial) return;
        }

        if (!monthlyAgg[normIdKey]) {
            monthlyAgg[normIdKey] = {
                employee_code: rawId,
                employee_name: row.employee_name || 'Unknown',
                designation: row.designation || '-',
                store_name: row.store_name || '-',
                device_id: row.device_id || '-',
                serial_no: device.serial || serial || 'ALL',
                presentDays: 0,
                absentDays: 0,
                punchMissDays: 0,
                lateDays: 0,
                totalWorkSecs: 0,
                totalLunchSecs: 0
            };
        }

        const agg = monthlyAgg[normIdKey];
        if (row.employee_name && row.employee_name !== 'Unknown' && agg.employee_name === 'Unknown') {
            agg.employee_name = row.employee_name;
        }

        // Accumulate statistics with 10 AM, 11 PM, and 5-punch rules
        const status = row.status;
        let punchMiss = row.punch_miss === 'Yes' || row.punch_miss === true;
        let punchLog = row.punch_log || '';
        let punchList = punchLog && punchLog !== '-' ? punchLog.split(/\s*\|\s*/).filter(Boolean) : [];
        let inTime = row.in_time;
        let outTime = row.out_time;

        // Forgotten punch-out rule: Wait until 11:30 PM of that date.
        // If past 11:30 PM (or past date) and no punch-out occurred, assume out_time equal to in_time.
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const isPast1130PM = (now.getHours() * 60 + now.getMinutes()) >= (23 * 60 + 30);
        const isPastDate = row.attendance_date && row.attendance_date < todayStr;
        const isTodayPastCutoff = row.attendance_date === todayStr && isPast1130PM;

        if (punchList.length % 2 === 1 || (!outTime || outTime === '-')) {
            if (inTime && inTime !== '-') {
                if (isPastDate || isTodayPastCutoff) {
                    punchMiss = false;
                    outTime = inTime;
                } else {
                    outTime = '-';
                }
            }
        }

        const map1130PMTo11PM = (t) => {
            if (!t || t === '-') return t;
            try {
                let clean = t.toString().trim();
                let timePart = clean.includes(' ') ? clean.split(' ')[1] : clean.includes('T') ? clean.split('T')[1] : clean;
                let [hStr, mStr] = timePart.split(':');
                let h = parseInt(hStr, 10);
                let m = parseInt(mStr, 10) || 0;
                if (clean.toUpperCase().includes('PM') && h < 12) h += 12;
                if (h === 23 && m >= 30) {
                    const prefix = clean.includes('T') ? clean.split('T')[0] + 'T' : clean.includes(' ') ? clean.split(' ')[0] + ' ' : '';
                    return `${prefix}23:00:00`;
                }
                return t;
            } catch (e) { return t; }
        };

        if (inTime && inTime !== '-') inTime = clampInTimeTo10AM(inTime, row.attendance_date);
        if (outTime && outTime !== '-') outTime = map1130PMTo11PM(outTime);

        let workHoursStr = row.working_hour;
        if (inTime && outTime && inTime !== '-' && outTime !== '-') {
            workHoursStr = calculateWorkHoursFromTimes(inTime, outTime, row.attendance_date);
        }

        if (status === 'Present' || status === 'Late' || status === 'Half Day') {
            agg.presentDays += 1;
        } else if (status === 'Absent') {
            agg.absentDays += 1;
        }

        if (status === 'Late' || (row.late_minute && row.late_minute > 0)) {
            agg.lateDays += 1;
        }

        if (punchMiss) {
            agg.punchMissDays += 1;
        }

        agg.totalWorkSecs += parseTimeToSeconds(workHoursStr);
        agg.totalLunchSecs += parseTimeToSeconds(row.standard_lunch);
    });

    const finalData = Object.values(monthlyAgg).map((agg) => {
        return {
            year: year,
            month: monthNames[month - 1],
            employee_code: agg.employee_code,
            employee_name: agg.employee_name,
            designation: agg.designation,
            store_name: agg.store_name,
            device_id: agg.device_id,
            serial_no: agg.serial_no,
            present_days: agg.presentDays,
            absent_days: agg.absentDays,
            punch_miss: agg.punchMissDays,
            late_days: agg.lateDays,
            total_work_hours: formatSecsToHrsMins(agg.totalWorkSecs),
            total_work_secs: agg.totalWorkSecs,
            total_lunch_time: formatSecsToHrsMins(agg.totalLunchSecs),
            total_lunch_secs: agg.totalLunchSecs,
            holidays: totalSundays
        };
    });

    // 5. Save batch to Supabase
    const monthName = monthNames[month - 1];
    let delQuery = supabase
        .from('hr_management_attendance_monthly')
        .delete()
        .eq('year', year)
        .eq('month', monthName);

    if (device && device.serial && device.serial !== 'ALL') {
        delQuery = delQuery.eq('serial_no', device.serial);
    }
    await delQuery;

    if (finalData.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < finalData.length; i += batchSize) {
            const batch = finalData.slice(i, i + batchSize);
            let { error } = await supabase
                .from('hr_management_attendance_monthly')
                .insert(batch);

            if (error) {
                const { error: upsertErr } = await supabase
                    .from('hr_management_attendance_monthly')
                    .upsert(batch);
                error = upsertErr;
            }

            if (error) {
                console.error('Error batch saving to Supabase:', error);
                throw new Error(`Supabase Save Error: ${error.message}`);
            }
        }
    }

    return finalData;
};

/**
 * Fetch monthly attendance stats directly from Supabase
 * @param {number} month - 1-based month (1-12)
 * @param {number} year - year
 * @param {string} serialNo - device serial number
 * @returns {Promise<Array>} the records stored in Supabase
 */
export const getMonthlyAttendanceFromSupabase = async (month, year, serialNo) => {
    const monthName = monthNames[month - 1];
    let query = supabase
        .from('hr_management_attendance_monthly')
        .select('*')
        .eq('year', year)
        .eq('month', monthName);

    if (serialNo && serialNo !== 'ALL') {
        query = query.eq('serial_no', serialNo);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error reading from Supabase:', error);
        throw error;
    }

    // Map database snake_case columns back to camelCase structures expected by UI
    return (data || []).map((row, idx) => ({
        sNo: idx + 1,
        year: row.year,
        month: row.month,
        employeeCode: row.employee_code,
        employeeName: row.employee_name,
        designation: row.designation,
        storeName: row.store_name,
        deviceId: row.device_id,
        serialNo: row.serial_no,
        presentDays: row.present_days,
        absentDays: row.absent_days,
        punchMiss: row.punch_miss,
        lateDays: row.late_days,
        totalWorkHours: row.total_work_hours,
        totalWorkSecs: row.total_work_secs,
        totalLunchTime: row.total_lunch_time,
        totalLunchSecs: row.total_lunch_secs,
        holidays: row.holidays,
        lastSyncedAt: row.last_synced_at
    }));
};
