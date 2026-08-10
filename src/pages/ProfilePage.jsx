import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../systems/checklist/SupabaseClient';
import { 
  User, Mail, Phone, Shield, Store, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, ClipboardList, 
  Users, Coins, ShoppingCart, ShieldCheck, MessageSquare,
  FileText, Activity, ArrowRight, Check
} from 'lucide-react';

const SYSTEM_DETAILS = {
  'checklist': { 
    name: 'Checklist Delegation', 
    desc: 'Manage checklists, delegations, and operational tasks.', 
    icon: ClipboardList,
    color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100/30' 
  },
  'hr': { 
    name: 'HR System', 
    desc: 'Employee registry, leaves, payroll, and attendance.', 
    icon: Users,
    color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100/30' 
  },
  'inventory': { 
    name: 'Snacks Inventory', 
    desc: 'Daily logs, form entry, and ledger sheets.', 
    icon: Store,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/30' 
  },
  'petty-cash': { 
    name: 'Petty Cash', 
    desc: 'Manage expense tally and counter balances.', 
    icon: Coins,
    color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100/30' 
  },
  'purchase': { 
    name: 'Purchase System', 
    desc: 'Indent procurement, approvals, POs, and receiving.', 
    icon: ShoppingCart,
    color: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100/30' 
  },
  'master-setting': { 
    name: 'Master Settings', 
    desc: 'System configuration, shop and counter registries.', 
    icon: ShieldCheck,
    color: 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100/30' 
  },
  'whatsapp': { 
    name: 'WhatsApp Broadcast', 
    desc: 'Compose and dispatch bulk campaigns.', 
    icon: MessageSquare,
    color: 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100/30' 
  }
};

// Helper to parse double-stringified JSON fields from localStorage robustly
const parseAccessList = (raw) => {
  if (!raw) return [];
  let current = raw;
  while (typeof current === 'string') {
    try {
      const temp = JSON.parse(current);
      if (temp === current) break;
      current = temp;
    } catch (e) {
      break;
    }
  }
  if (Array.isArray(current)) return current;
  if (current && typeof current === 'object') return Object.keys(current);
  return [];
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for attendance stats calculation
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    miss: 0,
    total: 0,
    percentage: 100
  });

  useEffect(() => {
    try {
      console.log('🔍 [ProfilePage] Diagnostic info. LocalStorage dump:');
      console.log({
        'user-name': localStorage.getItem('user-name'),
        'user_name': localStorage.getItem('user_name'),
        'currentUserName': localStorage.getItem('currentUserName'),
        'drinqkart_user': localStorage.getItem('drinqkart_user'),
        'master_user_system_page_access': localStorage.getItem('master_user_system_page_access')
      });

      // 1. Get user profile details from localStorage (using multi-key fallback parsing)
      const userName = localStorage.getItem('user_name') || 
                       localStorage.getItem('user-name') || 
                       localStorage.getItem('currentUserName') || 
                       'Guest';

      const email = localStorage.getItem('email_id') || '';
      const phone = localStorage.getItem('number') || '';
      const designation = localStorage.getItem('designation') || '';
      const role = localStorage.getItem('role') || localStorage.getItem('currentUserRole') || 'User';
      const shopAccess = localStorage.getItem('shop_name') || localStorage.getItem('user_access') || 'N/A';
      const profileImage = localStorage.getItem('profile_image') || '';
      const employeeId = localStorage.getItem('user-id') || 'N/A';

      let emailVal = email;
      let phoneVal = phone;
      let designationVal = designation;
      let employeeIdVal = employeeId;
      let profileImageVal = profileImage;

      // Try parsing drinqkart_user object
      const du = localStorage.getItem('drinqkart_user');
      if (du) {
        try {
          const parsed = JSON.parse(du);
          if (parsed) {
            if (!emailVal || emailVal === 'N/A') emailVal = parsed.email_id || '';
            if (!phoneVal || phoneVal === 'N/A') phoneVal = parsed.number || '';
            if (!designationVal || designationVal === 'Staff') designationVal = parsed.designation || '';
            if (!employeeIdVal || employeeIdVal === 'N/A') employeeIdVal = parsed.employee_id || parsed.id?.toString() || '';
            if (!profileImageVal) profileImageVal = parsed.profile_image || '';
          }
        } catch (e) {}
      }

      // Try parsing currentUser object
      const cu = localStorage.getItem('currentUser');
      if (cu) {
        try {
          const parsed = JSON.parse(cu);
          if (parsed) {
            if (!emailVal || emailVal === 'N/A') emailVal = parsed.email || '';
            if (!phoneVal || phoneVal === 'N/A') phoneVal = parsed.phone || '';
          }
        } catch (e) {}
      }

      const userProfile = { 
        userName, 
        email: emailVal || 'N/A', 
        phone: phoneVal || 'N/A', 
        designation: designationVal || 'Staff', 
        role, 
        shopAccess, 
        profileImage: profileImageVal, 
        employeeId: employeeIdVal 
      };
      setProfile(userProfile);

      // Parse system permissions robustly to prevent runtime .map type errors
      const masterPermissions = parseAccessList(localStorage.getItem('master_user_system_page_access'));
      
      const extractedSystems = [...new Set(masterPermissions.map(item => {
        if (typeof item !== 'string') return '';
        const systemKey = item.split('.')[0].toLowerCase().trim();
        return systemKey;
      }).filter(s => !!SYSTEM_DETAILS[s]))];
      
      setPermissions(extractedSystems);

      // Fetch database information
      fetchDatabaseData(userName);
    } catch (e) {
      console.error('Error loading profile from localStorage:', e);
      setError(`Storage parsing error: ${e.message}`);
      setLoading(false);
    }
  }, []);

  const fetchDatabaseData = async (userName) => {
    setLoading(true);
    try {
      console.log(`[ProfilePage] Querying Supabase for user: "${userName}"`);
      // Fetch checklist, delegation, maintenance, work tasks, and attendance logs matching the user
      const [checklistRes, delegationRes, maintenanceRes, workRes, attendanceRes] = await Promise.all([
        supabase.from('checklist').select('*').eq('name', userName).is('submission_date', null),
        supabase.from('delegation').select('*').eq('name', userName).is('submission_date', null),
        supabase.from('maintenance_tasks').select('*').eq('name', userName).is('submission_date', null),
        supabase.from('task_assignments').select('*, master_work_tasks(*, shop(shop_name))').ilike('employee_name', `%${userName}%`),
        supabase.from('hr_management_attendance_logs').select('*').ilike('employee_name', userName).order('attendance_date', { ascending: false })
      ]);

      console.log('Checklist data count:', checklistRes.data?.length || 0);
      console.log('Delegation data count:', delegationRes.data?.length || 0);
      console.log('Maintenance data count:', maintenanceRes.data?.length || 0);
      console.log('Work assignments count:', workRes.data?.length || 0);
      console.log('Attendance logs count:', attendanceRes.data?.length || 0);

      // Compile checklist tasks
      const checklistTasks = (checklistRes.data || []).map(t => ({
        id: `chk-${t.task_id || t.id}`,
        type: 'Checklist',
        description: t.task_description,
        shop: t.shop_name || t.shop || 'N/A',
        plannedDate: t.task_start_date || t.created_at,
        status: t.submission_date ? (t.admin_done ? 'Approved' : 'Submitted') : 'Pending',
        givenBy: t.given_by || 'N/A'
      }));

      // Compile delegation tasks
      const delegationTasks = (delegationRes.data || []).map(t => ({
        id: `del-${t.task_id || t.id}`,
        type: 'Delegation',
        description: t.task_description,
        shop: t.shop_name || t.shop || 'N/A',
        plannedDate: t.task_start_date || t.created_at,
        status: t.submission_date ? 'Submitted' : 'Pending',
        givenBy: t.given_by || 'N/A'
      }));

      // Compile maintenance tasks
      const maintenanceTasks = (maintenanceRes.data || []).map(t => ({
        id: `maint-${t.id}`,
        type: 'Maintenance',
        description: t.task_description || `${t.machine_name} - ${t.part_name}`,
        shop: t.shop_name || 'N/A',
        plannedDate: t.planned_date,
        status: t.submission_date ? 'Submitted' : 'Pending',
        givenBy: t.given_by || 'N/A'
      }));

      // Compile work assignments
      const workTasks = (workRes.data || []).map(t => {
        const master = t.master_work_tasks || {};
        const shopName = master.shop?.shop_name || "N/A";
        return {
          id: `work-${t.id}`,
          type: 'Work',
          description: master.task_name || 'N/A',
          shop: shopName,
          plannedDate: t.start_datetime,
          status: t.status || 'Pending',
          givenBy: t.manager_name || 'N/A'
        };
      });

      // Filter work assignments to exclude completed ones
      const activeWorkTasks = workTasks.filter(t => t.status !== 'Completed');

      const compiledTasks = [
        ...checklistTasks,
        ...delegationTasks,
        ...maintenanceTasks,
        ...activeWorkTasks
      ];

      // Sort tasks by plannedDate descending
      compiledTasks.sort((a, b) => new Date(b.plannedDate) - new Date(a.plannedDate));
      setTasks(compiledTasks);

      const personalAttendance = attendanceRes.data || [];
      setAttendanceLogs(personalAttendance);

      // Compute user's personal attendance health statistics
      const totalLogs = personalAttendance.length;
      const presentCount = personalAttendance.filter(log => {
        const status = (log.status || '').toLowerCase();
        return status === 'present' || status === 'late';
      }).length;
      const absentCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'absent').length;
      const lateCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'late').length;
      const missCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'miss').length;

      const attendancePercentage = totalLogs > 0 
        ? Math.round((presentCount / totalLogs) * 100) 
        : 100;

      setAttendanceStats({
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        miss: missCount,
        total: totalLogs,
        percentage: attendancePercentage
      });

    } catch (err) {
      console.error('Error fetching user database data:', err);
      setError(`Database loading error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 shadow-sm">
          <AlertCircle className="w-12 h-12 mx-auto text-rose-500 mb-4 animate-bounce" />
          <h2 className="text-lg font-bold text-rose-900">Profile Loading Interrupted</h2>
          <p className="text-xs text-rose-700 mt-2 font-medium bg-white/50 py-3 px-4 rounded-xl border border-rose-100 max-w-md mx-auto font-mono text-left break-words">
            {error}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-rose-600 text-white rounded-full text-xs font-bold hover:bg-rose-700 shadow-sm"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 bg-[#f3f6fb] min-h-screen font-sans animate-in fade-in duration-300">
      
      {/* 1. Profile Info Card (Matching Header in Image) */}
      <div className="bg-white rounded-[24px] shadow-xs border border-gray-100 overflow-hidden relative">
        {/* Blue Banner background */}
        <div className="h-16 bg-gradient-to-r from-blue-500 to-cyan-500 w-full" />
        
        {/* User main info overlapping */}
        <div className="px-8 pb-5 pt-4 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {profile.profileImage ? (
              <img 
                src={profile.profileImage} 
                alt={profile.userName} 
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md -mt-12 shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 to-cyan-500 text-white flex items-center justify-center font-black text-3xl shadow-lg border-4 border-white uppercase select-none -mt-12 shrink-0">
                {profile.userName.slice(0, 2)}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">{profile.userName}</h1>
              <p className="text-blue-600 font-bold text-xs mt-0.5">{profile.designation}</p>
            </div>
          </div>

          <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[10px] font-black uppercase tracking-wider px-3.5 py-1 rounded-full shrink-0">
            active
          </span>
        </div>

        {/* Info Grid (5 boxes at bottom of header card - including Role and Shop Access) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-8 pb-6 pt-1">
          {/* Employee ID */}
          <div className="bg-blue-50/30 border border-blue-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-xl shrink-0">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Employee ID</span>
              <strong className="text-xs font-bold text-gray-800 truncate block">{profile.employeeId}</strong>
            </div>
          </div>

          {/* Role */}
          <div className="bg-blue-50/30 border border-blue-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-xl shrink-0">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Role</span>
              <strong className="text-xs font-bold text-gray-800 truncate block capitalize">{profile.role}</strong>
            </div>
          </div>

          {/* Email */}
          <div className="bg-blue-50/30 border border-blue-50 rounded-2xl p-4 flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-xl shrink-0">
              <Mail className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Email</span>
              <strong className="text-xs font-bold text-gray-800 truncate block" title={profile.email}>{profile.email}</strong>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-blue-50/30 border border-blue-50 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-xl shrink-0">
              <Phone className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Contact</span>
              <strong className="text-xs font-bold text-gray-800 truncate block">{profile.phone || 'N/A'}</strong>
            </div>
          </div>

          {/* Shop Access */}
          <div className="bg-blue-50/30 border border-blue-50 rounded-2xl p-4 flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-blue-100/50 text-blue-600 rounded-xl shrink-0">
              <Store className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Shop Access</span>
              <strong className="text-xs font-bold text-gray-800 truncate block" title={profile.shopAccess}>{profile.shopAccess}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Systems Access Row (Tags list at the top) */}
      <div className="bg-white rounded-[20px] p-4 shadow-xs border border-gray-100 flex flex-wrap items-center gap-3">
        <span className="text-xs font-black uppercase text-gray-500 tracking-wider flex items-center gap-1.5 shrink-0 select-none">
          <Shield className="w-4 h-4 text-purple-600" /> Authorized Systems:
        </span>
        {permissions.length === 0 ? (
          <span className="text-xs text-gray-400">None</span>
        ) : (
          permissions.map(systemId => {
            const details = SYSTEM_DETAILS[systemId];
            if (!details) return null;
            const Icon = details.icon;
            return (
              <span 
                key={systemId} 
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-default ${details.color}`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {details.name}
              </span>
            );
          })
        )}
      </div>

      {/* 3. Middle Row: Today's Tasks & Attendance Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Side: Active Tasks */}
        <div className="bg-white rounded-[24px] p-6 shadow-xs border border-gray-100 flex flex-col gap-4 min-h-[380px]">
          <div className="flex justify-between items-center pb-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Active Tasks Directory</h2>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                {tasks.length}
              </span>
            </div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">Assigned to Me</span>
          </div>

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <span className="w-6 h-6 rounded-full border-2 border-purple-100 border-t-purple-600 animate-spin mb-3"></span>
              <span className="text-[10px] font-bold">Fetching tasks...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12 text-center">
              <FileText className="w-10 h-10 opacity-30 text-purple-400 mb-2.5 mx-auto" />
              <strong className="block text-xs text-gray-700">No active tasks assigned to you.</strong>
              <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                When new checklists, delegations or maintenance items are registered for you, they will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[320px] pr-1">
              {tasks.map(task => {
                const isPending = task.status === 'Pending';
                const dateStr = task.plannedDate 
                  ? new Date(task.plannedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                  : '';
                return (
                  <div 
                    key={task.id}
                    className="flex justify-between items-center bg-[#f9fafb] border border-gray-100 rounded-2xl p-4 hover:border-blue-200 transition-all border-l-4 border-l-amber-500"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-xl shadow-2xs text-amber-500 shrink-0">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="block text-xs font-bold text-gray-900 tracking-tight uppercase leading-snug">{task.description}</strong>
                        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                          {task.shop} • <span className="text-emerald-600 font-bold">{task.givenBy}</span> • {dateStr}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-md shrink-0 ${
                      isPending 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Personal Attendance Health Card */}
        <div className="bg-white rounded-[24px] p-6 shadow-xs border border-gray-100 flex flex-col justify-between min-h-[380px]">
          <div className="flex justify-between items-center pb-2 border-b border-gray-50">
            <div>
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-blue-500" />
                <span>My Attendance Health</span>
              </h2>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mt-0.5">Individual Logs Performance</span>
            </div>
            <span className="bg-gray-100 text-gray-500 text-[8px] font-black uppercase px-2 py-0.5 rounded tracking-widest border border-gray-200">
              Overview
            </span>
          </div>

          {/* Circular Gauge based on User's personal logs */}
          <div className="flex flex-col items-center justify-center my-4 relative">
            <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  className="text-gray-100 stroke-current"
                  strokeWidth="8"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                />
                <circle
                  className="text-emerald-500 stroke-current transition-all duration-700 ease-in-out"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * attendanceStats.percentage) / 100}
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-gray-900 tracking-tight">{attendanceStats.percentage}%</span>
                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mt-0.5">Attendance Rate</span>
              </div>
            </div>
            <span className="text-[10px] text-gray-500 font-semibold mt-3">
              Total Days Logged: <strong>{attendanceStats.total}</strong>
            </span>
          </div>

          {/* Mini split stats grid */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-4">
              {/* Present Count */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 text-center flex flex-col justify-center">
                <span className="text-[9px] uppercase font-black text-emerald-600 tracking-wider flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> Days Present
                </span>
                <strong className="block text-2xl font-black text-emerald-700 mt-1">{attendanceStats.present}</strong>
              </div>
              {/* Absent Count */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-3 text-center flex flex-col justify-center">
                <span className="text-[9px] uppercase font-black text-rose-600 tracking-wider flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Days Absent
                </span>
                <strong className="block text-2xl font-black text-rose-700 mt-1">{attendanceStats.absent}</strong>
              </div>
            </div>

            {/* Total logs footer bar */}
            <div className="bg-blue-50/30 border border-blue-50 rounded-xl p-3 flex justify-between items-center">
              <span className="text-[10px] font-bold text-blue-700 flex items-center gap-2">
                <Users className="w-4 h-4" /> Total Attendance Logs
              </span>
              <strong className="text-sm font-black text-blue-700">{attendanceStats.total}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: My Attendance Logs */}
      <div className="bg-white rounded-[24px] p-6 shadow-xs border border-gray-100 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-gray-50">
          <div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight">My Attendance Logs</h2>
            <span className="text-[10px] text-gray-400 mt-0.5 block font-medium">Showing daily biometric clock logs history</span>
          </div>
          <div className="bg-blue-50 text-blue-600 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 select-none shadow-3xs">
            <Store className="w-3.5 h-3.5 text-blue-500" /> {profile.shopAccess?.split(',')[0]}
          </div>
        </div>

        {/* Table Container for Daily logs */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <span className="w-8 h-8 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mb-4"></span>
            <span className="text-xs font-semibold">Generating Attendance Logs...</span>
          </div>
        ) : attendanceLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-center">
            <Activity className="w-10 h-10 mx-auto opacity-35 text-blue-400 mb-2.5" />
            <strong className="block text-xs text-gray-700">No biometric clock logs found.</strong>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
              When biometric scans are synced from the devices, your personal check-ins will register here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-2xl max-h-[360px] overflow-y-auto pr-1">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="bg-slate-50 text-gray-400 font-extrabold uppercase text-[9px] tracking-wider border-b border-gray-100">
                  <th className="p-4 pl-6">Date</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">IN Time</th>
                  <th className="p-4 text-center">OUT Time</th>
                  <th className="p-4 text-center">Working Hours</th>
                  <th className="p-4 pr-6">Store</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendanceLogs.map((log, index) => {
                  const dateObj = new Date(log.attendance_date);
                  const displayDate = !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })
                    : log.attendance_date;

                  const formatTime = (timeStr) => {
                    if (!timeStr || timeStr === '-') return '-';
                    try {
                      const date = new Date(timeStr);
                      return isNaN(date.getTime()) 
                        ? timeStr 
                        : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    } catch (e) { return timeStr; }
                  };

                  const isAbsent = log.status?.toLowerCase() === 'absent';
                  const isLate = log.status?.toLowerCase() === 'late';

                  return (
                    <tr key={log.id || index} className="hover:bg-slate-50/50 transition-colors">
                      {/* Date */}
                      <td className="p-4 pl-6">
                        <strong className="block text-xs font-bold text-gray-900 tracking-tight">{displayDate}</strong>
                      </td>
                      
                      {/* Status badge */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full shadow-3xs ${
                          isAbsent 
                            ? 'bg-rose-50 text-rose-600 border border-rose-200' 
                            : isLate 
                              ? 'bg-amber-50 text-amber-600 border border-amber-200' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        }`}>
                          {isAbsent ? (
                            <XCircle className="w-2.5 h-2.5" />
                          ) : isLate ? (
                            <AlertCircle className="w-2.5 h-2.5" />
                          ) : (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          )}
                          {log.status || 'Present'}
                        </span>
                      </td>
                      
                      {/* Clock In */}
                      <td className="p-4 text-center font-mono text-[11px] font-extrabold text-blue-600">
                        {formatTime(log.in_time)}
                      </td>
                      
                      {/* Clock Out */}
                      <td className="p-4 text-center font-mono text-[11px] font-extrabold text-blue-600">
                        {formatTime(log.out_time)}
                      </td>
                      
                      {/* Working Hours */}
                      <td className="p-4 text-center font-extrabold text-gray-950 font-mono">
                        {log.working_hour || '-'}
                      </td>
                      
                      {/* Store Location */}
                      <td className="p-4 pr-6">
                        <span className="inline-block text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg shadow-3xs">
                          {log.shop_name || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
