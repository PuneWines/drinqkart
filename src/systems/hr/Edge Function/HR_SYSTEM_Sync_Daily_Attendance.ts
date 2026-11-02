import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------------------------------------------------------
// Constants & Endpoints
// ---------------------------------------------------------------------------
const BIOMETRIC_API_KEY = "211616032630"; // Company-wide master API key
const DEVICE_LOG_API_BASE = "http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs";

const JOINING_API_URL =
  "https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch";
const MASTER_MAP_URL =
  "https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch";

// ---------------------------------------------------------------------------
// Dynamic Biometric Device Model from `shop` table
// ---------------------------------------------------------------------------
interface BiometricDevice {
  name: string;
  serial: string;
  apiName: string;
}

// ---------------------------------------------------------------------------
// Date / Time helpers
// ---------------------------------------------------------------------------

function formatToISTISOString(timeStr: string | null | undefined): string | null {
  if (!timeStr || timeStr === "-") return null;

  let formatted = timeStr.trim().replace(" ", "T");
  if (formatted.includes("+")) formatted = formatted.split("+")[0];
  else if (formatted.endsWith("Z")) formatted = formatted.slice(0, -1);

  const timeParts = formatted.split("T")[1] || "";
  if (timeParts.split(":").length === 2) formatted = formatted + ":00";
  return formatted;
}

function parseISTToDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === "-") return null;
  try {
    let clean = dateStr;
    if (clean.includes("+")) clean = clean.split("+")[0];
    else if (clean.endsWith("Z")) clean = clean.slice(0, -1);

    let formatted = clean.trim().replace(" ", "T");
    const timeParts = formatted.split("T")[1] || "";
    if (timeParts.split(":").length === 2) formatted = formatted + ":00";
    formatted = formatted + "+05:30";

    const d = new Date(formatted);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatTimeIST(dateStr: string | null | undefined): string {
  if (!dateStr || dateStr === "-") return "-";
  try {
    const d = parseISTToDate(dateStr);
    if (!d) return dateStr;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return dateStr;
  }
}

function getTodayIST(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function convert12hTo24h(time12h: string): string {
  if (!time12h || time12h === "-") return "";
  try {
    const cleanStr = time12h.trim().replace(/\u202f|\u00a0/g, " ").replace(/\s+/g, " ");
    const parts = cleanStr.split(" ");
    if (parts.length < 2) return "";
    const timeParts = parts[0].split(":");
    let hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    const ampm = parts[1].toUpperCase();

    if (ampm === "PM" && hour < 12) {
      hour += 12;
    } else if (ampm === "AM" && hour === 12) {
      hour = 0;
    }

    const hh = hour.toString().padStart(2, "0");
    const mm = minute.toString().padStart(2, "0");
    return `${hh}:${mm}`;
  } catch {
    return "";
  }
}

function convert24hTo12h(time24: string): string {
  if (!time24 || time24 === "-") return "";
  try {
    const trimmed = time24.trim();
    if (trimmed.toLowerCase().includes("am") || trimmed.toLowerCase().includes("pm")) {
      return trimmed.replace(/\s+/g, " ");
    }
    const parts = trimmed.split(":");
    if (parts.length < 2) return trimmed;
    let hour = parseInt(parts[0], 10);
    const minute = parseInt(parts[1], 10);
    if (isNaN(hour) || isNaN(minute)) return trimmed;
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const mm = minute.toString().padStart(2, "0");
    return `${hour}:${mm} ${ampm}`;
  } catch {
    return time24;
  }
}

function calculateHoursMins(diffMs: number): string {
  if (!diffMs || isNaN(diffMs) || diffMs <= 0) return "00:00:00";
  const totalSecs = Math.floor(diffMs / 1000);
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function calculateWorkHours(logs: string[]): string {
  if (!logs || logs.length < 2) return "00:00:00";

  let totalMs = 0;
  for (let i = 0; i + 1 < logs.length; i += 2) {
    const inDate = parseISTToDate(logs[i]);
    const outDate = parseISTToDate(logs[i + 1]);
    if (inDate && outDate && outDate.getTime() > inDate.getTime()) {
      totalMs += outDate.getTime() - inDate.getTime();
    }
  }
  return calculateHoursMins(totalMs);
}

function calculateLateMinutes(inStr: string, shift?: ShiftRosterEntry | null): number {
  if (!inStr || inStr === "-") return 0;
  try {
    const inDate = parseISTToDate(inStr);
    if (!inDate) return 0;

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(inDate);

    const hour = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
    const totalMinutes = hour * 60 + minute;

    let officialStart = 10 * 60;
    let graceThreshold = 10 * 60 + 10;

    if (shift?.start_time) {
      const [shiftH, shiftM] = shift.start_time.split(":").map(Number);
      officialStart = shiftH * 60 + shiftM;
      graceThreshold = officialStart + 10;
    }

    return totalMinutes >= graceThreshold ? totalMinutes - officialStart : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Roster & Sheet Interfaces
// ---------------------------------------------------------------------------
interface ShiftRosterEntry {
  id: number;
  employee_id: string;
  date: string;
  shift_type: string;
  start_time: string | null;
  end_time: string | null;
  remark: string | null;
}

interface JoiningEntry {
  id: string;
  name: string;
  designation: string;
  store: string;
}

async function fetchJoiningData(): Promise<JoiningEntry[]> {
  try {
    const res = await fetch(JOINING_API_URL);
    const result = await res.json();
    if (!result.success) return [];

    const rawRows: unknown[][] = result.data ?? result;
    const headers: unknown[] = rawRows[5];
    const dataRows: unknown[][] = rawRows.slice(6);

    const getIdx = (name: string) =>
      headers.findIndex((h) => h && h.toString().trim().toLowerCase() === name.toLowerCase());

    const empIdIdx = getIdx("Employee ID");
    const nameIdx = getIdx("Name As Per Aadhar");
    const desIdx = getIdx("Designation");
    const storeIdx = getIdx("Joining Place");

    return dataRows
      .map((r) => ({
        id: r[empIdIdx]?.toString().trim() ?? "",
        name: r[nameIdx]?.toString().trim() ?? "",
        designation: r[desIdx]?.toString().trim() ?? "",
        store: r[storeIdx]?.toString().trim() ?? "",
      }))
      .filter((h) => h.id);
  } catch {
    return [];
  }
}

interface DeviceMapEntry {
  userId: string;
  name: string;
  deviceId: string;
  serialNo: string;
  storeName: string;
}

async function fetchDeviceMapping(): Promise<DeviceMapEntry[]> {
  try {
    const res = await fetch(MASTER_MAP_URL);
    const result = await res.json();
    if (!result.success) return [];

    const rows: unknown[][] = result.data.slice(1);
    return rows.map((r) => ({
      userId: r[5]?.toString().trim() ?? "",
      name: r[6]?.toString().trim() ?? "",
      deviceId: r[7]?.toString().trim() ?? "",
      serialNo: r[8]?.toString().trim() ?? "",
      storeName: r[9]?.toString().trim() ?? "",
    }));
  } catch {
    return [];
  }
}

interface RawLog {
  EmployeeCode: string;
  LogDate: string;
  SerialNumber: string;
  _DeviceName: string;
}

async function fetchRawLogsForDevice(
  device: BiometricDevice,
  fromDate: string,
  toDate: string
): Promise<RawLog[]> {
  const url =
    `${DEVICE_LOG_API_BASE}` +
    `?APIKey=${BIOMETRIC_API_KEY}` +
    `&SerialNumber=${encodeURIComponent(device.serial)}` +
    `&DeviceName=${encodeURIComponent(device.apiName)}` +
    `&FromDate=${fromDate}` +
    `&ToDate=${toDate}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[sync-attendance] Device ${device.name} (${device.serial}) returned HTTP ${res.status}`);
    return [];
  }
  const logs = await res.json();
  return Array.isArray(logs)
    ? logs.map((l: RawLog) => ({ ...l, _DeviceName: device.name }))
    : [];
}

// ---------------------------------------------------------------------------
// Aggregation logic
// ---------------------------------------------------------------------------
interface AggregatedRecord {
  EmployeeID: string;
  EmployeeName: string;
  Date: string;
  Day: string;
  IsWorkingDay: string;
  InTime: string;
  OutTime: string;
  StandardLunch: string;
  WasteTime: string;
  PunchLog: string;
  PunchLogStatus: string;
  StoreName: string;
  DeviceID: string;
  Designation: string;
  SerialNumber: string;
  AssignedSerial: string;
  Status: string;
  WorkingHour: string;
  Overtime: string;
  LateMinute: number;
  PunchMiss: string;
  PunchMissMsg: string;
  RawLogs: string[];
  ShiftType: string | null;
}

function aggregateLogs(
  filteredLogs: RawLog[],
  joiningData: JoiningEntry[],
  deviceMapping: DeviceMapEntry[],
  rosterList: ShiftRosterEntry[],
  fromDate: string,
  toDate: string,
  configuredDevices: BiometricDevice[]
): AggregatedRecord[] {
  filteredLogs.sort((a, b) => new Date(a.LogDate).getTime() - new Date(b.LogDate).getTime());

  const grouped: Record<
    string,
    { EmployeeCode: string; Date: string; SerialNumber: string; SourceDeviceName: string; logs: string[] }
  > = {};

  for (const log of filteredLogs) {
    if (!log.EmployeeCode || !log.LogDate) continue;
    const dateStr = log.LogDate.split(" ")[0];
    const key = `${log.EmployeeCode}_${dateStr}`;

    if (!grouped[key]) {
      grouped[key] = {
        EmployeeCode: log.EmployeeCode.toString().trim(),
        Date: dateStr,
        SerialNumber: log.SerialNumber,
        SourceDeviceName: log._DeviceName,
        logs: [],
      };
    }
    grouped[key].logs.push(log.LogDate);
  }

  const start = new Date(fromDate + "T00:00:00+05:30");
  const end = new Date(toDate + "T00:00:00+05:30");
  const datesInRange: string[] = [];
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    datesInRange.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  datesInRange.forEach((dateStr) => {
    const shiftsForDate = rosterList.filter((r) => r.date === dateStr);
    shiftsForDate.forEach((shift) => {
      const empId = shift.employee_id.toString().trim();
      const key = `${empId}_${dateStr}`;
      if (!grouped[key]) {
        let dMap = deviceMapping.find(
          (m) => m.userId && m.userId.toString().toLowerCase() === empId.toLowerCase()
        );
        if (!dMap) {
          const empMeta = joiningData.find(
            (e) => (e.id && e.id.toLowerCase() === empId.toLowerCase()) ||
              (e.name && e.name.toLowerCase() === empId.toLowerCase())
          );
          if (empMeta) {
            const entryName = empMeta.name.trim().toLowerCase();
            dMap = deviceMapping.find((m) => m.name?.toLowerCase() === entryName);
          }
        }
        grouped[key] = {
          EmployeeCode: empId,
          Date: dateStr,
          SerialNumber: dMap ? dMap.serialNo : "-",
          SourceDeviceName: dMap ? dMap.storeName : "-",
          logs: [],
        };
      }
    });
  });

  return Object.values(grouped).map((group) => {
    const logs = group.logs;
    const code = group.EmployeeCode.toString().trim();
    const serial = group.SerialNumber ? group.SerialNumber.toString().trim() : "";
    const isNumeric = !isNaN(Number(code)) && code !== "";

    const empMeta = joiningData.find(
      (e) =>
        (e.id && e.id.toLowerCase() === code.toLowerCase()) ||
        (e.name && e.name.toLowerCase() === code.toLowerCase())
    );

    let dMap = deviceMapping.find(
      (m) => m.userId && m.userId.toString().toLowerCase() === code.toLowerCase()
    );
    if (!dMap) {
      const entryName = (empMeta?.name ?? code).toString().trim().toLowerCase();
      dMap = deviceMapping.find((m) => m.name && m.name.toString().toLowerCase() === entryName);
    }

    const displayName = dMap ? dMap.name : (empMeta ? empMeta.name : (isNumeric ? "Unknown" : code));
    const displayCode = dMap ? dMap.userId : (empMeta ? empMeta.id : (isNumeric ? code : "Unknown"));

    // Matches against dynamic shop devices
    const matchedPunchDevice = configuredDevices.find(
      (d) => d.serial && d.serial.toString().trim().toLowerCase() === serial.toLowerCase()
    );
    const displayStore = matchedPunchDevice
      ? matchedPunchDevice.name
      : (group.SourceDeviceName && group.SourceDeviceName !== "ALL DEVICES"
          ? group.SourceDeviceName
          : (dMap ? dMap.storeName : (empMeta ? empMeta.store : "-")));

    const displayDeviceId = dMap ? dMap.deviceId : "-";
    const displayAssignedSerial = serial || (dMap ? dMap.serialNo : "-");

    const shift = rosterList.find(
      (s) =>
        (s.employee_id.toString().trim().toLowerCase() === code.toLowerCase() ||
         s.employee_id.toString().trim().toLowerCase() === displayCode.toLowerCase()) &&
        s.date === group.Date
    ) ?? null;

    let morningPunchThreshold = 15;
    if (shift?.start_time && shift?.end_time) {
      const startHour = parseInt(shift.start_time.split(":")[0], 10);
      const endHour = parseInt(shift.end_time.split(":")[0], 10);
      morningPunchThreshold = Math.floor((startHour + endHour) / 2);
    }

    let inTime = "-";
    let outTime = "-";
    let punchMiss = "No";
    let punchMissMsg = "";

    if (logs.length === 1) {
      const punchTime = logs[0];
      const timePart = punchTime.split(" ")[1] || "";
      const hours = parseInt(timePart.split(":")[0]) || 0;
      punchMiss = "Yes";
      if (hours >= morningPunchThreshold) {
        outTime = punchTime;
        punchMissMsg = "Morning Punch Miss";
      } else {
        inTime = punchTime;
        punchMissMsg = "Evening Punch Miss";
      }
    } else if (logs.length > 1) {
      inTime = logs[0];
      outTime = logs[logs.length - 1];
    }

    const lateMins = calculateLateMinutes(inTime, shift);
    const workHrs = (punchMiss === "Yes" || logs.length === 0) ? "00:00:00" : calculateWorkHours(logs);

    let actualLunchMs = 0;
    if (logs.length > 2) {
      for (let i = 1; i < logs.length - 1; i += 2) {
        const lOut = parseISTToDate(logs[i]);
        const lIn = parseISTToDate(logs[i + 1]);
        if (lOut && lIn) actualLunchMs += Math.max(0, lIn.getTime() - lOut.getTime());
      }
    }

    const standardLunchMs = 2.5 * 3600 * 1000;
    const wasteTimeMs = Math.max(0, actualLunchMs - standardLunchMs);
    const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

    const dateObj = parseISTToDate(group.Date + "T00:00:00");
    const dayName = dateObj
      ? new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "Asia/Kolkata" }).format(dateObj)
      : "";

    let status = "Absent";
    if (logs.length > 0) {
      status = lateMins > 0 ? "Late" : "Present";
    }

    const punchLogStr = logs.map((l) => formatTimeIST(l)).join(" | ");

    let punchLogStatus = "Bahar";
    if (logs.length > 0) {
      if (logs.length % 2 === 1) {
        if (logs.length === 1) {
          const timePart = logs[0].split(" ")[1] || "";
          const hours = parseInt(timePart.split(":")[0]) || 0;
          punchLogStatus = hours >= morningPunchThreshold ? "Bahar" : "Andar";
        } else {
          punchLogStatus = "Andar";
        }
      } else {
        punchLogStatus = "Bahar";
      }
    }

    return {
      EmployeeID: displayCode,
      EmployeeName: displayName,
      Date: group.Date,
      Day: dayName,
      IsWorkingDay: "Yes",
      InTime: inTime,
      OutTime: outTime,
      StandardLunch: calculateHoursMins(displayLunchMs),
      WasteTime: calculateHoursMins(wasteTimeMs),
      PunchLog: punchLogStr,
      PunchLogStatus: punchLogStatus,
      StoreName: displayStore,
      DeviceID: displayDeviceId,
      Designation: empMeta ? empMeta.designation : "-",
      SerialNumber: serial,
      AssignedSerial: displayAssignedSerial,
      Status: status,
      WorkingHour: workHrs,
      Overtime: "0h 0m",
      LateMinute: lateMins,
      PunchMiss: punchMiss,
      PunchMissMsg: punchMissMsg,
      RawLogs: logs,
      ShiftType: shift?.shift_type ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------
async function saveAttendanceToDB(
  supabase: ReturnType<typeof createClient>,
  aggregatedData: AggregatedRecord[],
  rosterList: ShiftRosterEntry[]
): Promise<unknown[]> {
  if (!aggregatedData.length) return [];

  const dates = [...new Set(aggregatedData.map((item) => item.Date))];
  let existingLogs: any[] = [];
  if (dates.length > 0) {
    const { data } = await supabase
      .from("hr_management_attendance_logs")
      .select("*")
      .in("attendance_date", dates);
    existingLogs = data || [];
  }

  const rows = aggregatedData.map((item) => {
    const existing = existingLogs.find(
      (r) => r.employee_id === item.EmployeeID && r.attendance_date === item.Date
    );

    const apiPunches: Record<string, string> = {};
    item.RawLogs.forEach((logStr, idx) => {
      if (idx < 5) {
        try {
          const formatted = formatTimeIST(logStr);
          apiPunches[(idx + 1).toString()] = formatted !== "-" ? formatted : logStr.split(" ")[1]?.substring(0, 5) ?? "";
        } catch { /* ignore */ }
      }
    });

    let manualSection: Record<string, any> = {};
    if (existing?.manual_punches) {
      const existingMP = existing.manual_punches;
      if (existingMP.manual && typeof existingMP.manual === "object") {
        manualSection = { ...existingMP.manual };
      } else {
        const isOldManual =
          existingMP.is_manual === true ||
          existingMP.manual_override === true ||
          existingMP.absent === true;
        if (isOldManual) {
          ["1", "2", "3", "4", "5"].forEach((k) => {
            if (existingMP[k]) manualSection[k] = existingMP[k];
          });
          if (existingMP.absent) manualSection.absent = true;
          if (existingMP.is_manual) manualSection.is_manual = existingMP.is_manual;
          if (existingMP.manual_override) manualSection.manual_override = existingMP.manual_override;
        }
      }
    }

    const isManualOverride =
      manualSection.is_manual === true || manualSection.manual_override === true;

    const apiTimes24 = item.RawLogs.map(logStr => logStr.split(" ")[1]?.substring(0, 5)).filter(Boolean);

    const manualTimes24: string[] = [];
    ["1", "2", "3", "4", "5"].forEach(key => {
      const val = manualSection[key];
      if (val && val !== '') {
        const t24 = convert12hTo24h(val);
        if (t24) manualTimes24.push(t24);
      }
    });

    const combinedTimes24 = [...new Set([...apiTimes24, ...manualTimes24])];
    combinedTimes24.sort();

    const combinedLogDates = combinedTimes24.map(t => `${item.Date} ${t}:00`);

    const shift = rosterList.find(
      (s) =>
        (s.employee_id.toString().trim().toLowerCase() === item.EmployeeID.toLowerCase()) &&
        s.date === item.Date
    ) ?? null;

    let morningPunchThreshold = 15;
    if (shift?.start_time && shift?.end_time) {
      const startHour = parseInt(shift.start_time.split(":")[0], 10);
      const endHour = parseInt(shift.end_time.split(":")[0], 10);
      morningPunchThreshold = Math.floor((startHour + endHour) / 2);
    }

    let inTime = "-";
    let outTime = "-";
    let punchMiss = "No";
    let punchMissMsg = "";

    if (combinedLogDates.length === 1) {
      const punchTime = combinedLogDates[0];
      const timePart = punchTime.split(" ")[1] || "";
      const hours = parseInt(timePart.split(":")[0]) || 0;
      punchMiss = "Yes";
      if (hours >= morningPunchThreshold) {
        outTime = punchTime;
        punchMissMsg = "Morning Punch Miss";
      } else {
        inTime = punchTime;
        punchMissMsg = "Evening Punch Miss";
      }
    } else if (combinedLogDates.length > 1) {
      inTime = combinedLogDates[0];
      outTime = combinedLogDates[combinedLogDates.length - 1];
    }

    const lateMins = calculateLateMinutes(inTime, shift);
    const workHrs = (punchMiss === "Yes" || combinedLogDates.length === 0) ? "00:00:00" : calculateWorkHours(combinedLogDates);

    let actualLunchMs = 0;
    if (combinedLogDates.length > 2) {
      for (let i = 1; i < combinedLogDates.length - 1; i += 2) {
        const lOut = parseISTToDate(combinedLogDates[i]);
        const lIn = parseISTToDate(combinedLogDates[i + 1]);
        if (lOut && lIn) actualLunchMs += Math.max(0, lIn.getTime() - lOut.getTime());
      }
    }

    const standardLunchMs = 2.5 * 3600 * 1000;
    const wasteTimeMs = Math.max(0, actualLunchMs - standardLunchMs);
    const displayLunchMs = Math.min(actualLunchMs, standardLunchMs);

    let status = "Absent";
    if (combinedLogDates.length > 0) {
      status = lateMins > 0 ? "Late" : "Present";
    }

    if (manualSection.absent === true || (isManualOverride && existing?.status === "Absent")) {
      status = "Absent";
    } else if (isManualOverride && existing?.status === "Half Day") {
      status = "Half Day";
    }

    const punchLogStr = combinedTimes24.map(t24 => convert24hTo12h(t24)).join(" | ");

    let punchLogStatus = "Bahar";
    if (combinedLogDates.length > 0) {
      if (combinedLogDates.length % 2 === 1) {
        if (combinedLogDates.length === 1) {
          const timePart = combinedLogDates[0].split(" ")[1] || "";
          const hours = parseInt(timePart.split(":")[0]) || 0;
          punchLogStatus = hours >= morningPunchThreshold ? "Bahar" : "Andar";
        } else {
          punchLogStatus = "Andar";
        }
      } else {
        punchLogStatus = "Bahar";
      }
    }

    const manualPunches: Record<string, any> = {};
    if (Object.keys(manualSection).length > 0) manualPunches.manual = manualSection;
    if (Object.keys(apiPunches).length > 0) manualPunches.api = apiPunches;

    return {
      employee_id: item.EmployeeID,
      employee_name: item.EmployeeName,
      attendance_date: item.Date,
      day: item.Day,
      designation: item.Designation,
      store_name: item.StoreName,
      device_id: item.DeviceID,
      serial_number: item.SerialNumber || item.AssignedSerial,
      in_time: formatToISTISOString(inTime),
      out_time: formatToISTISOString(outTime),
      working_hour: workHrs,
      overtime: item.Overtime,
      late_minute: lateMins,
      status: status,
      standard_lunch: calculateHoursMins(displayLunchMs),
      waste_time: calculateHoursMins(wasteTimeMs),
      punch_log: punchLogStr,
      punch_log_status: punchLogStatus,
      punch_miss: punchMiss,
      punch_miss_msg: punchMissMsg,
      manual_punches: manualPunches,
      is_late: lateMins > 0,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from("hr_management_attendance_logs")
    .upsert(rows, { onConflict: "employee_id,attendance_date", ignoreDuplicates: false })
    .select();

  if (error) throw error;

  console.log(`[sync-attendance] UPSERT complete: ${data?.length ?? 0} rows affected`);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Edge Function entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    let fromDate: string | undefined;
    let toDate: string | undefined;
    let deviceFilter = "ALL";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        fromDate = body.fromDate;
        toDate = body.toDate;
        deviceFilter = body.device ?? "ALL";
      } catch { /* empty body */ }
    } else {
      const url = new URL(req.url);
      fromDate = url.searchParams.get("fromDate") ?? undefined;
      toDate = url.searchParams.get("toDate") ?? undefined;
      deviceFilter = url.searchParams.get("device") ?? "ALL";
    }

    const todayIST = getTodayIST();
    fromDate = fromDate ?? todayIST;
    toDate = toDate ?? todayIST;

    console.log(`[sync-attendance] Syncing ${fromDate} → ${toDate} (device filter: ${deviceFilter})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Fetch active shops with configured device_serial from `shop` table
    const [joiningData, deviceMapping, rosterResult, shopDevicesResult] = await Promise.all([
      fetchJoiningData(),
      fetchDeviceMapping(),
      supabaseClient
        .from("hr_management_shift_roster")
        .select("*")
        .gte("date", fromDate!)
        .lte("date", toDate!),
      supabaseClient
        .from("shop")
        .select("shop_name, device_serial, api_name")
        .not("device_serial", "is", null)
        .neq("device_serial", ""),
    ]);

    const rosterList: ShiftRosterEntry[] = rosterResult.data || [];

    // Map shop records to devices
    const configuredDevices: BiometricDevice[] = (shopDevicesResult.data || []).map((s: any) => ({
      name: s.shop_name,
      serial: s.device_serial.toString().trim(),
      apiName: s.api_name ? s.api_name.toString().trim() : s.shop_name,
    }));

    console.log(
      `[sync-attendance] Joining: ${joiningData.length}, DeviceMap: ${deviceMapping.length}, Roster: ${rosterList.length}, Dynamic Devices: ${configuredDevices.length}`
    );

    if (configuredDevices.length === 0) {
      console.warn("[sync-attendance] Warning: No shops found with device_serial configured.");
    }

    // Filter devices
    const devicesToQuery =
      deviceFilter.toUpperCase() === "ALL"
        ? configuredDevices
        : configuredDevices.filter(
            (d) =>
              d.name.toUpperCase() === deviceFilter.toUpperCase() ||
              d.serial.toUpperCase() === deviceFilter.toUpperCase()
          );

    // Fetch logs from biometric hardware
    const rawLogResponses = await Promise.all(
      devicesToQuery.map((device) =>
        fetchRawLogsForDevice(device, fromDate!, toDate!).catch((e) => {
          console.error(`[sync-attendance] Failed for ${device.name}:`, e);
          return [] as RawLog[];
        })
      )
    );

    const rawLogsData: RawLog[] = rawLogResponses.flat();
    console.log(`[sync-attendance] Raw logs fetched: ${rawLogsData.length}`);

    const filteredLogs = rawLogsData.filter((log) => {
      if (!log.LogDate) return false;
      const logDateStr = log.LogDate.split(" ")[0];
      return logDateStr >= fromDate! && logDateStr <= toDate!;
    });

    // Aggregate with dynamic device store mapping
    const aggregatedData = aggregateLogs(
      filteredLogs,
      joiningData,
      deviceMapping,
      rosterList,
      fromDate!,
      toDate!,
      configuredDevices
    );

    if (aggregatedData.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No logs or roster assignments in range.", inserted: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const upsertedRows = await saveAttendanceToDB(supabaseClient, aggregatedData, rosterList);

    return new Response(
      JSON.stringify({
        success: true,
        fromDate,
        toDate,
        devicesCount: devicesToQuery.length,
        rawLogs: rawLogsData.length,
        filteredLogs: filteredLogs.length,
        aggregated: aggregatedData.length,
        inserted: upsertedRows.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (err) {
    console.error("[sync-attendance] Fatal error:", err);
    return new Response(
      JSON.stringify({ success: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
