import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = 'https://yxtvvjijtraobzaqdevz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const JOINING_API_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=JOINING&action=fetch';
const MASTER_MAP_URL = 'https://script.google.com/macros/s/AKfycbyGp3onARkG7QfXKSZ22J6PokX-rYEYjOd-loijl7CqfnmDev_-aukiXp1vZ7yToJKQ/exec?sheet=MASTER&action=fetch';

// Health Check
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Raw Attendance Payload Inspector</title></head>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>🔍 Raw Attendance Payload Server (Running on port 5050)</h2>
        <p>Use the following endpoints to examine completely unaltered raw payloads:</p>
        <ul>
          <li><a href="/raw/attendance-logs?employee_id=4016">/raw/attendance-logs?employee_id=4016</a> - Raw Supabase Attendance Logs</li>
          <li><a href="/raw/employees?employee_id=4016">/raw/employees?employee_id=4016</a> - Raw Supabase Employee Records</li>
          <li><a href="/raw/device-api?serial=AMDB25061400343&deviceName=WAGHOLI">/raw/device-api?serial=AMDB25061400343&deviceName=WAGHOLI</a> - Raw Biometric CAMS API</li>
          <li><a href="/raw/joining-sheet">/raw/joining-sheet</a> - Raw Google Joining Sheet</li>
          <li><a href="/raw/master-sheet">/raw/master-sheet</a> - Raw Google Master Device Mapping</li>
          <li><a href="/raw/all?employee_id=4016">/raw/all?employee_id=4016</a> - <b>COMBINED RAW PAYLOAD FOR EMPLOYEE</b></li>
        </ul>
      </body>
    </html>
  `);
});

// 1. Raw Supabase attendance logs
app.get('/raw/attendance-logs', async (req, res) => {
  try {
    const { employee_id, date } = req.query;
    let query = supabase.from('hr_management_attendance_logs').select('*');
    if (employee_id) query = query.eq('employee_id', employee_id.toString().trim());
    if (date) query = query.eq('attendance_date', date);
    query = query.order('created_at', { ascending: false }).limit(50);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error });

    if ((!data || data.length === 0) && employee_id && date) {
      const { data: empData } = await supabase.from('hr_management_employees').select('*').eq('employee_id', employee_id.toString().trim());
      const emp = empData?.[0];
      return res.json([{
        employee_id: employee_id.toString().trim(),
        employee_name: emp ? (emp.user_name || emp.name_as_per_aadhar || 'Unknown') : 'Unknown',
        attendance_date: date,
        status: 'Absent',
        in_time: '-',
        out_time: '-',
        working_hour: '00:00:00',
        punch_log: '-',
        store_name: emp ? (emp.joining_place || emp.shop_name || '-') : '-',
        is_fallback_generated: true
      }]);
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Raw Supabase employee profile
app.get('/raw/employees', async (req, res) => {
  try {
    const { employee_id } = req.query;
    let query = supabase.from('hr_management_employees').select('*');
    if (employee_id) query = query.eq('employee_id', employee_id.toString().trim());
    const { data, error } = await query;
    if (error) return res.status(500).json({ error });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Raw CAMS Biometric device API
app.get('/raw/device-api', async (req, res) => {
  try {
    const { serial = 'AMDB25061400343', deviceName = 'WAGHOLI', fromDate = '2026-09-12', toDate = '2026-09-12' } = req.query;
    const url = `http://103.195.203.77:15167/api/v2/WebAPI/GetDeviceLogs?APIKey=211616032630&SerialNumber=${serial}&DeviceName=${deviceName}&FromDate=${fromDate}&ToDate=${toDate}`;
    const response = await fetch(url);
    const text = await response.text();
    try {
      res.json(JSON.parse(text));
    } catch (e) {
      res.send(text);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Raw Google Joining Sheet
app.get('/raw/joining-sheet', async (req, res) => {
  try {
    const response = await fetch(JOINING_API_URL);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Raw Google Master Device Sheet
app.get('/raw/master-sheet', async (req, res) => {
  try {
    const response = await fetch(MASTER_MAP_URL);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Combined Raw Summary for an Employee
app.get('/raw/all', async (req, res) => {
  try {
    const employeeId = (req.query.employee_id || '4016').toString().trim();
    const date = req.query.date || '2026-09-12';

    const [empRes, logsRes] = await Promise.all([
      supabase.from('hr_management_employees').select('*').eq('employee_id', employeeId),
      supabase.from('hr_management_attendance_logs').select('*').eq('employee_id', employeeId).eq('attendance_date', date)
    ]);

    let rawLogs = logsRes.data || [];
    if (rawLogs.length === 0) {
      const emp = empRes.data?.[0];
      rawLogs = [{
        employee_id: employeeId,
        employee_name: emp ? (emp.user_name || emp.name_as_per_aadhar || 'Unknown') : 'Unknown',
        attendance_date: date,
        status: 'Absent',
        in_time: '-',
        out_time: '-',
        working_hour: '00:00:00',
        punch_log: '-',
        store_name: emp ? (emp.joining_place || emp.shop_name || '-') : '-',
        is_fallback_generated: true
      }];
    }

    res.json({
      timestamp: new Date().toISOString(),
      requested_employee_id: employeeId,
      requested_date: date,
      raw_employee_profile: empRes.data || empRes.error,
      raw_attendance_logs: rawLogs
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 5050;
app.listen(PORT, () => {
  console.log(`🚀 Raw Temp Server running at http://localhost:${PORT}`);
});
