import React, { useState, useEffect, useMemo } from 'react';
import supabase from '../systems/checklist/SupabaseClient';
import { 
  User, Mail, Phone, Shield, Store, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, ClipboardList, 
  Users, Coins, ShoppingCart, ShieldCheck, MessageSquare,
  FileText, Activity, ArrowRight, Check, Pencil, Camera, Upload, X, Loader2
} from 'lucide-react';

const SYSTEM_DETAILS = {
  'checklist': { 
    name: 'Checklist Delegation', 
    desc: 'Manage checklists, delegations, and operational tasks.', 
    icon: ClipboardList,
    color: 'text-slate-800 bg-slate-100/80 border-slate-200 hover:bg-slate-200/60' 
  },
  'hr': { 
    name: 'HR System', 
    desc: 'Employee registry, leaves, payroll, and attendance.', 
    icon: Users,
    color: 'text-slate-800 bg-slate-100/80 border-slate-200 hover:bg-slate-200/60' 
  },
  'inventory': { 
    name: 'Snacks Inventory', 
    desc: 'Daily logs, form entry, and ledger sheets.', 
    icon: Store,
    color: 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/60' 
  },
  'petty-cash': { 
    name: 'Petty Cash', 
    desc: 'Manage expense tally and counter balances.', 
    icon: Coins,
    color: 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100/60' 
  },
  'purchase': { 
    name: 'Purchase System', 
    desc: 'Indent procurement, approvals, POs, and receiving.', 
    icon: ShoppingCart,
    color: 'text-slate-800 bg-slate-100/80 border-slate-200 hover:bg-slate-200/60' 
  },
  'master-setting': { 
    name: 'Master Settings', 
    desc: 'System configuration, shop and counter registries.', 
    icon: ShieldCheck,
    color: 'text-slate-800 bg-slate-100/80 border-slate-200 hover:bg-slate-200/60' 
  },
  'whatsapp': { 
    name: 'WhatsApp Broadcast', 
    desc: 'Compose and dispatch bulk campaigns.', 
    icon: MessageSquare,
    color: 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100/60' 
  }
};

// Helper to parse double-stringified JSON fields from localStorage robustly
const getSystemInfo = (sysKey) => {
  if (SYSTEM_DETAILS[sysKey]) return SYSTEM_DETAILS[sysKey];
  const formattedName = sysKey ? sysKey.split(/[-_.]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'System';
  return {
    name: formattedName,
    desc: `${formattedName} Module`,
    icon: Shield,
    color: 'text-slate-800 bg-slate-100/80 border-slate-200 hover:bg-slate-200/60'
  };
};

// Helper to parse double-stringified JSON or array/comma-separated list fields robustly
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

const formatList = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap(item => typeof item === 'string' ? item.split(',').map(s => s.trim()) : String(item)).filter(Boolean);
  }
  if (typeof raw === 'string') {
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        return formatList(parsed);
      } catch (e) {}
    }
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // States for unified task filters
  const [taskSystemFilter, setTaskSystemFilter] = useState('all'); // 'all' | 'Checklist' | 'Delegation' | 'Work'
  const [taskStatusFilter, setTaskStatusFilter] = useState('all'); // 'all' | 'Today' | 'Overdue' | 'Upcoming'
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [allEmployeesList, setAllEmployeesList] = useState([]);

  // States for profile picture upload modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);

  // States for attendance stats calculation
  const [attendanceStats, setAttendanceStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    miss: 0,
    total: 0,
    percentage: 100
  });

  const extractSystemsAccess = (accessList) => {
    const list = parseAccessList(accessList);
    const extractedSystems = [...new Set(list.map(item => {
      if (typeof item !== 'string') return '';
      // Take all the first words before dot (e.g., "checklist.All Tasks.modify" -> "checklist")
      const firstWord = item.split('.')[0].toLowerCase().trim();
      return firstWord;
    }).filter(Boolean))];

    setPermissions(extractedSystems);
  };

  const openImageModal = () => {
    setSelectedFile(null);
    setPreviewUrl(profile?.profileImage || '');
    setImageUploadError('');
    setImageUploadSuccess(false);
    setIsImageModalOpen(true);
  };

  const closeImageModal = () => {
    if (uploadingImage) return;
    setIsImageModalOpen(false);
    setSelectedFile(null);
    setPreviewUrl('');
    setImageUploadError('');
    setImageUploadSuccess(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageUploadError('Please select a valid image file (JPG, PNG, WEBP, etc.).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageUploadError('File size exceeds 5MB limit. Please select a smaller image.');
      return;
    }

    setImageUploadError('');
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUploadImage = async () => {
    if (!selectedFile || !profile?.userName) return;

    setUploadingImage(true);
    setImageUploadError('');
    setImageUploadSuccess(false);

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const sanitizedName = profile.userName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const fileName = `${sanitizedName}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log(`[ProfilePage] Uploading image to bucket "profiles" with path: ${filePath}`);

      // Upload image to Supabase Storage bucket "profiles"
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('profiles')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) {
        console.error('Supabase storage upload error:', uploadErr);
        throw new Error(uploadErr.message || 'Failed to upload profile picture to bucket "profiles". Please check if bucket "profiles" exists.');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to generate public URL for uploaded profile picture.');
      }

      console.log(`[ProfilePage] Profile image public URL generated: ${publicUrl}`);

      // Update 'users' table in Supabase
      const { error: dbErr } = await supabase
        .from('users')
        .update({ profile_image: publicUrl })
        .or(`user_name.ilike.${profile.userName},username.ilike.${profile.userName},name.ilike.${profile.userName}`);

      if (dbErr) {
        console.warn('[ProfilePage] Database profile_image update notice:', dbErr.message);
      }

      // Update React state
      setProfile(prev => ({ ...prev, profileImage: publicUrl }));

      // Sync local storage keys
      localStorage.setItem('profile_image', publicUrl);
      
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const parsed = JSON.parse(userRaw);
          parsed.profile_image = publicUrl;
          localStorage.setItem('user', JSON.stringify(parsed));
        } catch(e) {}
      }

      const drinqRaw = localStorage.getItem('drinqkart_user');
      if (drinqRaw) {
        try {
          const parsed = JSON.parse(drinqRaw);
          parsed.profile_image = publicUrl;
          localStorage.setItem('drinqkart_user', JSON.stringify(parsed));
        } catch(e) {}
      }

      setImageUploadSuccess(true);
      setTimeout(() => {
        closeImageModal();
      }, 1200);

    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setImageUploadError(err.message || 'An error occurred while uploading profile picture.');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    try {
      // 1. Primary parsing from localStorage.user as per logged-in specification
      let localUser = null;
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          localUser = JSON.parse(userRaw);
        } catch (e) {
          console.warn('Could not parse localStorage.user:', e);
        }
      }

      // Fallback parsers if localStorage.user is not directly present
      if (!localUser) {
        const drinqUserRaw = localStorage.getItem('drinqkart_user');
        if (drinqUserRaw) {
          try { localUser = JSON.parse(drinqUserRaw); } catch (e) {}
        }
      }
      if (!localUser) {
        const cuRaw = localStorage.getItem('currentUser');
        if (cuRaw) {
          try { localUser = JSON.parse(cuRaw); } catch (e) {}
        }
      }

      const userName = localUser?.username || localUser?.name || localUser?.user_name ||
                       localStorage.getItem('user_name') || localStorage.getItem('user-name') || 
                       localStorage.getItem('currentUserName') || 'Guest';

      const email = localUser?.email_id || localUser?.email || localStorage.getItem('email_id') || 'N/A';
      const number = localUser?.number || localUser?.phone || localStorage.getItem('number') || 'N/A';
      const role = localUser?.role || localStorage.getItem('role') || localStorage.getItem('currentUserRole') || 'User';
      const employeeId = localUser?.employee_id || localUser?.id?.toString() || localStorage.getItem('user-id') || 'N/A';
      const profileImage = localUser?.profile_image || localStorage.getItem('profile_image') || '';
      
      const shopAccess = localUser?.shops || localUser?.shop_name || localUser?.user_access || localStorage.getItem('shop_name') || localStorage.getItem('user_access') || 'N/A';
      const counterAccess = localUser?.counter_access || localUser?.counterAccess || parseAccessList(localStorage.getItem('counter_access'));
      
      const accessStrings = localUser?.master_user_system_page_access || parseAccessList(localStorage.getItem('master_user_system_page_access'));

      const userProfile = { 
        userName, 
        email, 
        number, 
        role, 
        shopAccess, 
        counterAccess,
        profileImage, 
        employeeId,
        accessStrings
      };
      setProfile(userProfile);

      // Extract systems permissions (first words of access strings)
      extractSystemsAccess(accessStrings);

      // Fetch database information matching logged in user name
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
      const userRaw = localStorage.getItem('user');
      let localRole = 'User';
      if (userRaw) {
        try { localRole = JSON.parse(userRaw)?.role || localRole; } catch (e) {}
      }
      const currentRole = (profile?.role || localRole || localStorage.getItem('role') || 'User').toLowerCase();
      const isAdmin = currentRole === 'admin' || currentRole === 'masteradmin' || userName.toLowerCase() === 'admin' || userName.toLowerCase() === 'masteradmin';

      // 1. Fetch Users List if Admin to populate employee filter dropdown
      if (isAdmin) {
        supabase.from('users').select('user_name, name').then(({ data: uData }) => {
          if (uData) {
            const list = [...new Set(uData.map(u => u.user_name || u.name).filter(Boolean))];
            setAllEmployeesList(list);
          }
        });
      }

      // Local today date helpers
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Build database queries
      let userQuery = supabase
        .from('users')
        .select('*')
        .or(`user_name.ilike.${userName},username.ilike.${userName},name.ilike.${userName}`)
        .maybeSingle();

      // Checklist tasks query: Admin sees all, User sees assigned
      let checklistQuery = supabase.from('checklist').select('*').is('submission_date', null);
      if (!isAdmin) {
        checklistQuery = checklistQuery.or(`name.ilike.${userName},given_by.ilike.${userName}`);
      }

      // Delegation tasks query: Admin sees all, User sees assigned
      let delegationQuery = supabase.from('delegation').select('*').is('submission_date', null);
      if (!isAdmin) {
        delegationQuery = delegationQuery.or(`name.ilike.${userName},assigned_person.ilike.${userName}`);
      }

      // Work tasks query
      let workQuery = supabase.from('task_assignments').select('*, master_work_tasks(*, shop(shop_name))');
      if (!isAdmin) {
        workQuery = workQuery.ilike('employee_name', `%${userName}%`);
      }

      // Attendance logs query
      let attendanceQuery = supabase.from('hr_management_attendance_logs').select('*').order('attendance_date', { ascending: false });
      if (!isAdmin) {
        attendanceQuery = attendanceQuery.ilike('employee_name', userName);
      }

      const [userDbRes, checklistRes, delegationRes, workRes, attendanceRes] = await Promise.all([
        userQuery,
        checklistQuery,
        delegationQuery,
        workQuery,
        attendanceQuery
      ]);

      if (userDbRes?.data) {
        const dbUser = userDbRes.data;
        setProfile(prev => ({
          ...prev,
          userName: dbUser.user_name || dbUser.username || dbUser.name || prev?.userName,
          email: dbUser.email_id || dbUser.email || prev?.email,
          number: dbUser.number || dbUser.phone || dbUser.mobile || prev?.number,
          role: dbUser.role || prev?.role,
          employeeId: dbUser.employee_id || dbUser.emp_id || dbUser.id?.toString() || prev?.employeeId,
          profileImage: dbUser.profile_image || dbUser.profile_pic || prev?.profileImage,
          shopAccess: dbUser.shop_name || dbUser.user_access || dbUser.user_Access || prev?.shopAccess,
          counterAccess: dbUser.counter_access || dbUser.counterAccess || prev?.counterAccess,
          accessStrings: dbUser.master_user_system_page_access || prev?.accessStrings
        }));

        if (dbUser.master_user_system_page_access) {
          extractSystemsAccess(dbUser.master_user_system_page_access);
        }
      }

      // Helper to check if a task date falls on TODAY
      const isTaskForToday = (taskDateStr, isExtended, nextExtendStr) => {
        const targetStr = (isExtended && nextExtendStr) ? nextExtendStr : taskDateStr;
        if (!targetStr) return false;

        let taskDate;
        if (typeof targetStr === 'string' && targetStr.includes('-') && !targetStr.includes('T') && !targetStr.includes(' ')) {
          const parts = targetStr.split('-');
          taskDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else if (typeof targetStr === 'string' && targetStr.includes('/')) {
          const parts = targetStr.split(' ')[0].split('/');
          if (parts.length === 3) {
            taskDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          } else {
            taskDate = new Date(targetStr);
          }
        } else {
          taskDate = new Date(targetStr);
        }

        if (isNaN(taskDate.getTime())) return false;
        taskDate.setHours(0, 0, 0, 0);

        return taskDate.getTime() === todayStart.getTime();
      };

      // Compile Checklist Tasks for TODAY ONLY
      const checklistTasks = (checklistRes.data || []).filter(t => {
        const isExtended = t.status === 'extend' || t.status === 'extended';
        const dateStr = t.planned_date || t.task_start_date;
        return isTaskForToday(dateStr, isExtended, t.next_extend_date);
      }).map(t => {
        const isExtended = t.status === 'extend' || t.status === 'extended';
        const dateStr = t.next_extend_date || t.planned_date || t.task_start_date;
        const tagInfo = isExtended 
          ? { tag: 'Extended', color: 'bg-purple-100 text-purple-800 border-purple-200' }
          : { tag: 'Today', color: 'bg-amber-100 text-amber-900 border-amber-300' };

        return {
          id: `chk-${t.id || t.task_id}`,
          systemType: 'Checklist',
          description: t.task_description || t.name || 'Checklist Task',
          shop: t.shop_name || t.shop || 'N/A',
          assignedTo: t.name || 'N/A',
          givenBy: t.given_by || 'N/A',
          plannedDate: dateStr,
          dynamicTag: tagInfo.tag,
          tagColor: tagInfo.color
        };
      });

      // Compile Delegation Tasks for TODAY ONLY
      const delegationTasks = (delegationRes.data || []).filter(t => {
        const isExtended = t.status === 'extend' || t.status === 'extended';
        const dateStr = t.planned_date || t.task_start_date;
        return isTaskForToday(dateStr, isExtended, t.next_extend_date);
      }).map(t => {
        const isExtended = t.status === 'extend' || t.status === 'extended';
        const dateStr = t.next_extend_date || t.planned_date || t.task_start_date;
        const tagInfo = isExtended 
          ? { tag: 'Extended', color: 'bg-purple-100 text-purple-800 border-purple-200' }
          : { tag: 'Today', color: 'bg-amber-100 text-amber-900 border-amber-300' };

        return {
          id: `del-${t.id || t.task_id}`,
          systemType: 'Delegation',
          description: t.task_description || t.name || 'Delegation Task',
          shop: t.shop_name || t.shop || 'N/A',
          assignedTo: t.name || t.assigned_person || 'N/A',
          givenBy: t.given_by || 'N/A',
          plannedDate: dateStr,
          dynamicTag: tagInfo.tag,
          tagColor: tagInfo.color
        };
      });

      // Compile Work Tasks for TODAY ONLY
      const workTasks = (workRes.data || []).filter(t => {
        const master = t.master_work_tasks || {};
        const dateStr = t.current_date || t.start_datetime;
        
        // Exclude completed or approved items
        if (t.status === 'Completed' || t.status === 'APPROVED' || t.status === 'SUBMITTED' || t.submission_date) {
          return false;
        }

        // Must be scheduled for Today
        return isTaskForToday(dateStr, false, null);
      }).map(t => {
        const master = t.master_work_tasks || {};
        const shopName = master.shop?.shop_name || t.shop_name || 'N/A';
        const dateStr = t.current_date || t.start_datetime || t.created_at;

        // Calculate dynamic status for Work Tasks (ACTIVE vs UPCOMING)
        let dynamicTag = 'ACTIVE';
        let tagColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';

        if (t.start_datetime) {
          const startDate = new Date(t.start_datetime);
          if (!isNaN(startDate.getTime()) && now < startDate) {
            dynamicTag = 'UPCOMING';
            tagColor = 'bg-indigo-100 text-indigo-900 border-indigo-200';
          }
        }

        return {
          id: `work-${t.id}`,
          systemType: 'Work',
          description: master.task_name || t.task_description || 'Work Task',
          shop: shopName,
          assignedTo: t.employee_name || t.assigned_to || 'N/A',
          givenBy: t.manager_name || 'N/A',
          plannedDate: dateStr,
          dynamicTag,
          tagColor
        };
      });

      const allCompiled = [...checklistTasks, ...delegationTasks, ...workTasks];
      allCompiled.sort((a, b) => new Date(b.plannedDate || 0) - new Date(a.plannedDate || 0));

      setTasks(allCompiled);

      const personalAttendance = attendanceRes.data || [];
      setAttendanceLogs(personalAttendance);

      const totalLogs = personalAttendance.length;
      const presentCount = personalAttendance.filter(log => {
        const status = (log.status || '').toLowerCase();
        return status === 'present' || status === 'late';
      }).length;
      const absentCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'absent').length;
      const lateCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'late').length;
      const missCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'miss').length;
      const attendancePercentage = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 100;

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

  const formattedShops = formatList(profile.shopAccess);
  const formattedCounters = formatList(profile.counterAccess);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 bg-[#f8fafc] min-h-screen font-sans animate-in fade-in duration-300">
      
      {/* 1. Hero Profile Header */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/90 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
        {/* Avatar & Identity Info */}
        <div className="flex flex-col md:flex-row items-center md:items-center gap-6 text-center md:text-left w-full">
          {/* Profile Avatar */}
          <div className="relative shrink-0 group">
            {profile.profileImage ? (
              <img 
                src={profile.profileImage} 
                alt={profile.userName} 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-200 shadow-md ring-2 ring-slate-100"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-3xl sm:text-4xl shadow-md border-2 border-amber-400/40 select-none">
                {profile.userName?.slice(0, 2) || 'U'}
              </div>
            )}
            <span className="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" title="Active Account" />
            
            {/* Pencil edit icon button positioned at LOWER RIGHT corner as a perfect circle */}
            <button
              onClick={openImageModal}
              type="button"
              title="Edit Profile Picture"
              style={{ borderRadius: '50%' }}
              className="absolute -bottom-1 -right-1 w-8 h-8 !rounded-full bg-slate-900 text-amber-400 border-2 border-white shadow-lg hover:bg-slate-800 hover:scale-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer z-10"
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          {/* Typography Hierarchy: Name at the VERY BEGINNING -> All information below it */}
          <div className="flex flex-col gap-2 min-w-0 flex-1">
            {/* 1. Name at the very beginning */}
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
              {profile.userName || 'User Name'}
            </h1>

            {/* 2. Key Badges below name: Role & Employee ID (Full key-value "Employee ID : value") */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-0.5">
              <span className="bg-slate-900 text-amber-400 border border-slate-800 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-md shadow-2xs">
                Role : <span className="capitalize">{profile.role || 'User'}</span>
              </span>
              
              <span className="bg-slate-100 text-slate-900 border border-slate-200 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-md flex items-center gap-1.5 shadow-2xs">
                <Shield className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                Employee ID : <span className="font-mono font-black">{profile.employeeId || 'N/A'}</span>
              </span>

              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-md flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active User
              </span>
            </div>

            {/* 3. Contact Details below badges */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs font-bold text-slate-800 pt-1">
              {profile.email && profile.email !== 'N/A' && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Email : <strong className="font-extrabold text-slate-900">{profile.email}</strong></span>
                </div>
              )}
              {profile.number && profile.number !== 'N/A' && (
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Number : <strong className="font-extrabold text-slate-900">{profile.number}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Shop Access & Counter Access Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shop Access */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2.5 text-slate-950">
              <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-2xs">
                <Store className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Shop Access</h3>
                <span className="text-xs text-slate-600 font-semibold">Assigned shops and locations</span>
              </div>
            </div>
            <span className="text-xs font-black text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
              {formattedShops.length} Shops
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-1">
            {formattedShops.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No shop access assigned</span>
            ) : (
              formattedShops.map((shop, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-900 border border-slate-200/90 rounded-xl text-xs font-extrabold shadow-2xs hover:bg-slate-100 transition-colors"
                >
                  <Store className="w-3.5 h-3.5 text-slate-600" />
                  {shop}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Counter Access */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2.5 text-slate-950">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-xl shadow-2xs">
                <Coins className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Counter Access</h3>
                <span className="text-xs text-slate-600 font-semibold">Accessible cash counters</span>
              </div>
            </div>
            <span className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md shadow-2xs">
              {formattedCounters.length} Counters
            </span>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-1">
            {formattedCounters.length === 0 ? (
              <span className="text-xs text-slate-500 italic">No counter access assigned</span>
            ) : (
              formattedCounters.map((counter, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-950 border border-amber-200 rounded-xl text-xs font-extrabold shadow-2xs hover:bg-amber-100 transition-colors"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-700" />
                  {counter}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3. Accessible Systems List (Extracted from Access Strings) */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-2xs">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Accessible Systems</h3>
              <span className="text-xs text-slate-600 font-semibold">Extracted from master system access permissions</span>
            </div>
          </div>
          <span className="text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md shadow-2xs">
            {permissions.length} Authorized Systems
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 pt-1">
          {permissions.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No system permissions found</span>
          ) : (
            permissions.map(systemKey => {
              const details = getSystemInfo(systemKey);
              const Icon = details.icon;
              return (
                <div 
                  key={systemKey} 
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs ${details.color}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{details.name}</span>
                  <CheckCircle2 className="w-3.5 h-3.5 opacity-60 ml-0.5" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Middle Row: Today's Tasks & Attendance Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        
        {/* Left Side: Unified Active Tasks Directory */}
        <div className="bg-white rounded-[24px] p-6 shadow-xs border border-slate-200/90 flex flex-col gap-4 min-h-[420px]">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-2xs">
                <ClipboardList className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-950 uppercase tracking-wide">Active Tasks Directory</h2>
                <span className="text-xs text-slate-600 font-semibold">
                  {profile?.role?.toLowerCase()?.includes('admin') ? 'Company-Wide Aggregated Tasks' : 'Assigned to Me'}
                </span>
              </div>
            </div>

            {/* Admin Employee Filter Dropdown */}
            {allEmployeesList.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-500">Filter Staff:</span>
                <select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="all">All Employees ({allEmployeesList.length})</option>
                  {allEmployeesList.map(emp => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* KPI Mini-Counters Row (Today's Metrics) */}
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => setTaskStatusFilter(taskStatusFilter === 'Today' || taskStatusFilter === 'Active' ? 'all' : 'Today')}
              type="button"
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                taskStatusFilter === 'Today' || taskStatusFilter === 'Active'
                  ? 'bg-amber-100 border-amber-300 ring-1 ring-amber-400' 
                  : 'bg-amber-50/60 border-amber-200/60 hover:bg-amber-100/50'
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wider text-amber-900">Today / Active</span>
              <strong className="text-base font-black text-amber-950">
                {tasks.filter(t => t.dynamicTag === 'Today' || t.dynamicTag === 'Active').length}
              </strong>
            </button>

            <button
              onClick={() => setTaskStatusFilter(taskStatusFilter === 'Upcoming' ? 'all' : 'Upcoming')}
              type="button"
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                taskStatusFilter === 'Upcoming' 
                  ? 'bg-indigo-100 border-indigo-300 ring-1 ring-indigo-400' 
                  : 'bg-indigo-50/60 border-indigo-200/60 hover:bg-indigo-100/50'
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wider text-indigo-900">Upcoming Today</span>
              <strong className="text-base font-black text-indigo-950">
                {tasks.filter(t => t.dynamicTag === 'Upcoming').length}
              </strong>
            </button>

            <button
              onClick={() => setTaskStatusFilter(taskStatusFilter === 'Extended' ? 'all' : 'Extended')}
              type="button"
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                taskStatusFilter === 'Extended' 
                  ? 'bg-purple-100 border-purple-300 ring-1 ring-purple-400' 
                  : 'bg-purple-50/60 border-purple-200/60 hover:bg-purple-100/50'
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wider text-purple-900">Extended</span>
              <strong className="text-base font-black text-purple-950">
                {tasks.filter(t => t.dynamicTag === 'Extended').length}
              </strong>
            </button>

            <button
              onClick={() => setTaskStatusFilter('all')}
              type="button"
              className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                taskStatusFilter === 'all' 
                  ? 'bg-slate-900 text-amber-400 border-slate-800 ring-1 ring-slate-900' 
                  : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
              }`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wider">Total Today</span>
              <strong className="text-base font-black">{tasks.length}</strong>
            </button>
          </div>

          {/* Sub-system Filter Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
            {[
              { id: 'all', label: 'All Tasks' },
              { id: 'Checklist', label: 'Checklist' },
              { id: 'Delegation', label: 'Delegation' },
              { id: 'Work', label: 'Work Tasks' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTaskSystemFilter(tab.id)}
                type="button"
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  taskSystemFilter === tab.id
                    ? 'bg-slate-900 text-amber-400 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tasks List */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12">
              <span className="w-7 h-7 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin mb-3"></span>
              <span className="text-xs font-bold">Fetching multi-system tasks...</span>
            </div>
          ) : (() => {
            const filtered = tasks.filter(t => {
              if (taskSystemFilter !== 'all' && t.systemType?.toLowerCase() !== taskSystemFilter.toLowerCase()) return false;
              if (taskStatusFilter !== 'all' && t.dynamicTag?.toLowerCase() !== taskStatusFilter.toLowerCase()) return false;
              if (employeeFilter !== 'all') {
                const assigned = (t.assignedTo || '').toLowerCase();
                if (!assigned.includes(employeeFilter.toLowerCase())) return false;
              }
              return true;
            });

            if (filtered.length === 0) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-12 text-center">
                  <FileText className="w-10 h-10 opacity-30 text-amber-500 mb-2 mx-auto" />
                  <strong className="block text-xs text-slate-700 font-extrabold">No active tasks found in directory.</strong>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-[240px] mx-auto font-medium">
                    No active tasks match your selected filter criteria.
                  </p>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[340px] pr-1">
                {filtered.map(task => {
                  const dateDisplay = task.plannedDate 
                    ? new Date(task.plannedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : 'N/A';

                  const systemBadgeColor = 
                    task.systemType === 'Checklist' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                    task.systemType === 'Delegation' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                    'bg-emerald-100 text-emerald-800 border-emerald-200';

                  return (
                    <div 
                      key={task.id}
                      className="flex flex-col gap-1.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 hover:border-slate-300 hover:bg-slate-100/60 transition-all shadow-3xs"
                    >
                      {/* Top Row: System Tag & Dynamic Tag */}
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${systemBadgeColor}`}>
                          {task.systemType}
                        </span>

                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${task.tagColor}`}>
                          {task.dynamicTag}
                        </span>
                      </div>

                      {/* Main Description */}
                      <strong className="text-xs font-black text-slate-900 uppercase tracking-tight leading-snug">
                        {task.description}
                      </strong>

                      {/* Bottom Metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="bg-white border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-extrabold text-slate-700">
                            📍 {task.shop}
                          </span>
                          {task.assignedTo && task.assignedTo !== 'N/A' && (
                            <span>Assigned: <strong className="text-slate-900 font-bold">{task.assignedTo}</strong></span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                          <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Due: {dateDisplay}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
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

      {/* Profile Picture Upload Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Update Profile Picture</h3>
                  <p className="text-xs text-slate-500 font-medium">Select & upload your new profile avatar</p>
                </div>
              </div>
              <button
                onClick={closeImageModal}
                disabled={uploadingImage}
                type="button"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview Box */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Profile Preview" 
                  className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-md mb-3"
                />
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-4xl shadow-md border-4 border-white uppercase select-none mb-3">
                  {profile.userName?.slice(0, 2) || 'U'}
                </div>
              )}
              <span className="text-xs font-bold text-slate-600 text-center max-w-[260px] truncate">
                {selectedFile ? selectedFile.name : profile.profileImage ? 'Current Profile Image' : 'Default Initials Avatar'}
              </span>
            </div>

            {/* Upload Error / Success Alerts */}
            {imageUploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{imageUploadError}</span>
              </div>
            )}

            {imageUploadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Profile picture updated successfully!</span>
              </div>
            )}

            {/* File Input Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                Choose Image File
              </label>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploadingImage}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-slate-900 file:text-amber-400 hover:file:bg-slate-800 text-xs text-slate-600 cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50/50"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={closeImageModal}
                disabled={uploadingImage}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleUploadImage}
                disabled={!selectedFile || uploadingImage}
                className="px-5 py-2.5 bg-slate-900 text-amber-400 font-extrabold text-xs rounded-xl shadow-md hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {uploadingImage ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    Save Profile Picture
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
