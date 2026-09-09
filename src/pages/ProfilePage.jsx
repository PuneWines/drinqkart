import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import supabase from '../systems/checklist/SupabaseClient';
import { systems } from '../layout/systemsConfig';
import AddTutorialVideoModal from '../components/AddTutorialVideoModal';
import { 
  User, Mail, Phone, Shield, Store, Calendar, Clock, 
  CheckCircle2, XCircle, AlertCircle, ClipboardList, 
  Users, Coins, ShoppingCart, ShieldCheck, MessageSquare,
  FileText, Activity, ArrowRight, Check, Pencil, Camera, Upload, X, Loader2,
  Video, Play, ChevronRight, Info, Sparkles, Plus, PlayCircle, Trash2
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

  // Toggle mode inside Profile Page div: 'overview' | 'training'
  const [profileMode, setProfileMode] = useState('overview');

  // Selected main system page for Training/Tutorial Videos
  const [selectedSystem, setSelectedSystem] = useState(systems[0]);

  // Sync mode and selected system with URL parameters
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlMode = searchParams.get('mode') || searchParams.get('tab');
  const urlSys = searchParams.get('sys');

  useEffect(() => {
    if (urlMode === 'training') {
      setProfileMode('training');
    } else {
      setProfileMode('overview');
    }
  }, [urlMode]);

  useEffect(() => {
    if (urlSys) {
      const match = systems.find(s => s.id === urlSys);
      if (match) setSelectedSystem(match);
    }
  }, [urlSys]);

  const handleModeToggle = (mode) => {
    setProfileMode(mode);
    if (mode === 'training') {
      navigate(`/systems/profile?mode=training&sys=${selectedSystem.id}`, { replace: true });
    } else {
      navigate('/systems/profile', { replace: true });
    }
  };
  const [videosList, setVideosList] = useState([]);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);

  // States for unified task filters
  const [taskSystemFilter, setTaskSystemFilter] = useState('Checklist');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [allEmployeesList, setAllEmployeesList] = useState([]);

  // States for profile picture upload modal
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [imageUploadSuccess, setImageUploadSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);

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

      let bucket = 'profiles';
      let { data: uploadData, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(filePath, selectedFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) {
        bucket = 'checklist';
        const fallbackRes = await supabase.storage
          .from(bucket)
          .upload(filePath, selectedFile, { cacheControl: '3600', upsert: true });
        uploadData = fallbackRes.data;
        uploadErr = fallbackRes.error;
      }

      if (uploadErr) {
        throw new Error(uploadErr.message || 'Failed to upload profile picture.');
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to generate public URL for uploaded profile picture.');
      }

      await supabase
        .from('users')
        .update({ profile_image: publicUrl })
        .ilike('user_name', profile.userName);

      setProfile(prev => ({ ...prev, profileImage: publicUrl }));
      setImageError(false);
      localStorage.setItem('profile_image', publicUrl);
      
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const parsed = JSON.parse(userRaw);
          parsed.profile_image = publicUrl;
          localStorage.setItem('user', JSON.stringify(parsed));
        } catch(e) {}
      }

      setImageUploadSuccess(true);
      setTimeout(() => { closeImageModal(); }, 1200);

    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setImageUploadError(err.message || 'An error occurred while uploading profile picture.');
    } finally {
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    try {
      let localUser = null;
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try { localUser = JSON.parse(userRaw); } catch (e) {}
      }
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
      extractSystemsAccess(accessStrings);
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

      if (isAdmin) {
        supabase.from('users').select('user_name').then(({ data: uData }) => {
          if (uData) {
            const list = [...new Set(uData.map(u => u.user_name).filter(Boolean))];
            setAllEmployeesList(list);
          }
        });
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      let userQuery = supabase.from('users').select('*').ilike('user_name', userName).maybeSingle();
      let checklistQuery = supabase.from('checklist').select('*').is('submission_date', null);
      if (!isAdmin) checklistQuery = checklistQuery.or(`name.ilike.${userName},given_by.ilike.${userName}`);

      let delegationQuery = supabase.from('delegation').select('*').is('submission_date', null);
      if (!isAdmin) delegationQuery = delegationQuery.or(`name.ilike.${userName},assigned_person.ilike.${userName}`);

      let workQuery = supabase.from('work_task_new').select('*, task_assignments:assignment_id(id, manager_name, master_work_tasks:task_id(id, proof_required))').eq('current_date', todayStr).is('submission_date', null);
      if (!isAdmin) workQuery = workQuery.ilike('name', `%${userName}%`);

      let attendanceQuery = supabase.from('hr_management_attendance_logs').select('*').order('attendance_date', { ascending: false });
      if (!isAdmin) attendanceQuery = attendanceQuery.ilike('employee_name', userName);

      const [userDbRes, checklistRes, delegationRes, workRes, attendanceRes] = await Promise.all([
        userQuery, checklistQuery, delegationQuery, workQuery, attendanceQuery
      ]);

      if (userDbRes?.data) {
        const dbUser = userDbRes.data;
        const fetchedImage = dbUser.profile_image || dbUser.profile_pic || dbUser.image_url || '';
        if (fetchedImage) localStorage.setItem('profile_image', fetchedImage);
        setProfile(prev => ({
          ...prev,
          userName: dbUser.user_name || dbUser.username || dbUser.name || prev?.userName,
          email: dbUser.email_id || dbUser.email || prev?.email,
          number: dbUser.number || dbUser.phone || dbUser.mobile || prev?.number,
          role: dbUser.role || prev?.role,
          employeeId: dbUser.employee_id || dbUser.emp_id || dbUser.id?.toString() || prev?.employeeId,
          profileImage: fetchedImage || prev?.profileImage,
          shopAccess: dbUser.shop_name || dbUser.user_access || dbUser.user_Access || prev?.shopAccess,
          counterAccess: dbUser.counter_access || dbUser.counterAccess || prev?.counterAccess,
          accessStrings: dbUser.master_user_system_page_access || prev?.accessStrings
        }));

        if (dbUser.master_user_system_page_access) {
          extractSystemsAccess(dbUser.master_user_system_page_access);
        }
      }

      const parseTaskDate = (str) => {
        if (!str) return null;
        try {
          if (typeof str === 'string' && str.includes('-') && !str.includes('T') && !str.includes(' ')) {
            const parts = str.split('-');
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
          }
          const d = new Date(str);
          if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
        } catch (e) {}
        return null;
      };

      const checklistTasks = (checklistRes.data || []).map(t => {
        const isExtended = t.status === 'extend' || t.status === 'extended';
        const dateStr = (isExtended && t.next_extend_date) ? t.next_extend_date : (t.planned_date || t.task_start_date);
        const taskDate = parseTaskDate(dateStr);
        let dynamicTag = null, tagColor = '';
        if (isExtended && taskDate && taskDate >= todayStart) {
          dynamicTag = 'Extended'; tagColor = 'bg-purple-100 text-purple-800 border-purple-200';
        } else if (taskDate && taskDate < todayStart) {
          dynamicTag = 'Overdue'; tagColor = 'bg-rose-100 text-rose-800 border-rose-200';
        } else if (taskDate && taskDate.getTime() === todayStart.getTime()) {
          dynamicTag = 'Today'; tagColor = 'bg-amber-100 text-amber-900 border-amber-300';
        }
        if (!dynamicTag) return null;
        return {
          id: `chk-${t.id || t.task_id}`, systemType: 'Checklist', description: t.task_description || t.name || 'Checklist Task',
          shop: t.shop_name || t.shop || 'N/A', assignedTo: t.name || 'N/A', givenBy: t.given_by || 'N/A', plannedDate: dateStr, dynamicTag, tagColor
        };
      }).filter(Boolean);

      const delegationTasks = (delegationRes.data || []).map(t => {
        const isExtended = t.status === 'extend' || t.status === 'extended';
        const dateStr = (isExtended && t.next_extend_date) ? t.next_extend_date : (t.planned_date || t.task_start_date);
        const taskDate = parseTaskDate(dateStr);
        let dynamicTag = null, tagColor = '';
        if (isExtended && taskDate && taskDate >= todayStart) {
          dynamicTag = 'Extended'; tagColor = 'bg-purple-100 text-purple-800 border-purple-200';
        } else if (taskDate && taskDate < todayStart) {
          dynamicTag = 'Overdue'; tagColor = 'bg-rose-100 text-rose-800 border-rose-200';
        } else if (taskDate && taskDate.getTime() === todayStart.getTime()) {
          dynamicTag = 'Today'; tagColor = 'bg-amber-100 text-amber-900 border-amber-300';
        }
        if (!dynamicTag) return null;
        return {
          id: `del-${t.id || t.task_id}`, systemType: 'Delegation', description: t.task_description || t.name || 'Delegation Task',
          shop: t.shop_name || t.shop || 'N/A', assignedTo: t.name || t.assigned_person || 'N/A', givenBy: t.given_by || 'N/A', plannedDate: dateStr, dynamicTag, tagColor
        };
      }).filter(Boolean);

      const workTasks = (workRes.data || []).map(t => {
        const master = t.task_assignments?.master_work_tasks || {};
        return {
          id: `work-${t.id}`, systemType: 'Work', description: t.task_description || master.task_name || 'Work Task',
          shop: t.shop_name || t.shop || 'N/A', assignedTo: t.name || 'N/A', givenBy: t.manager_name || 'N/A', plannedDate: t.current_date, dynamicTag: 'Active', tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-200'
        };
      }).filter(Boolean);

      const allCompiled = [...checklistTasks, ...delegationTasks, ...workTasks];
      setTasks(allCompiled);

      const personalAttendance = attendanceRes.data || [];
      setAttendanceLogs(personalAttendance);

      const totalLogs = personalAttendance.length;
      const presentCount = personalAttendance.filter(log => ['present', 'late'].includes((log.status || '').toLowerCase())).length;
      const absentCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'absent').length;
      const lateCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'late').length;
      const missCount = personalAttendance.filter(log => (log.status || '').toLowerCase() === 'miss').length;
      const attendancePercentage = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 100;

      setAttendanceStats({
        present: presentCount, absent: absentCount, late: lateCount, miss: missCount, total: totalLogs, percentage: attendancePercentage
      });

    } catch (err) {
      console.error('Error fetching database data:', err);
      setError(`Database loading error: ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tutorial videos list for selected main system page
  const fetchMainPageVideos = async (sys) => {
    if (!sys) return;
    setLoadingVideo(true);
    setVideosList([]);

    const targetKey = sys.base;

    try {
      const { data } = await supabase
        .from('page_tutorial_videos')
        .select('*')
        .or(`system_id.eq.${sys.id},page_key.eq.${targetKey}`)
        .order('created_at', { ascending: false });

      let list = data || [];

      // Check localStorage fallback array
      const localKey = `drinqkart_tutorial_videos_${sys.id}`;
      const localRaw = localStorage.getItem(localKey) || localStorage.getItem(`drinqkart_tutorial_video_${targetKey}`);
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          const localItems = Array.isArray(parsed) ? parsed : [parsed];
          localItems.forEach(item => {
            if (item && item.video_url && !list.some(v => v.video_url === item.video_url)) {
              list.push(item);
            }
          });
        } catch (e) {}
      }

      setVideosList(list);
    } catch (err) {
      console.warn('Error fetching videos for main page:', err);
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleDeleteVideo = async (videoItem) => {
    if (!window.confirm('Are you sure you want to delete this training video?')) return;

    try {
      if (videoItem.id) {
        const { error: delErr } = await supabase
          .from('page_tutorial_videos')
          .delete()
          .eq('id', videoItem.id);

        if (delErr) {
          console.error('Error deleting video from database:', delErr);
        }
      }

      const localKey = `drinqkart_tutorial_videos_${selectedSystem.id}`;
      const localRaw = localStorage.getItem(localKey);
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(v => v.video_url !== videoItem.video_url);
            localStorage.setItem(localKey, JSON.stringify(filtered));
          }
        } catch (e) {}
      }

      const targetKey = selectedSystem.base;
      localStorage.removeItem(`drinqkart_tutorial_video_${targetKey}`);

      setVideosList(prev => prev.filter(v => (v.id && v.id !== videoItem.id) || (v.video_url && v.video_url !== videoItem.video_url)));
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  useEffect(() => {
    if (profileMode === 'training' && selectedSystem) {
      fetchMainPageVideos(selectedSystem);
    }
  }, [profileMode, selectedSystem]);

  const getEmbedUrl = (url, type) => {
    if (!url) return '';
    if (type === 'file') return url;
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0`;
    }
    const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vimeoMatch && vimeoMatch[1]) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }
    return url;
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
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-rose-600 text-white rounded-full text-xs font-bold hover:bg-rose-700 shadow-sm">
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const formattedShops = formatList(profile.shopAccess);
  const formattedCounters = formatList(profile.counterAccess);

  const role = (profile.role || localStorage.getItem('role') || 'User').toLowerCase();
  const isAdmin = role === 'admin' || role === 'masteradmin' || profile.userName?.toLowerCase() === 'admin';

  let rawAccess = profile.accessStrings || localStorage.getItem('master_user_system_page_access') || [];
  if (typeof rawAccess === 'string') {
    try { rawAccess = JSON.parse(rawAccess); } catch(e) { rawAccess = []; }
  }
  if (!Array.isArray(rawAccess) && rawAccess && typeof rawAccess === 'object') {
    rawAccess = Object.keys(rawAccess);
  }
  const userPermittedSystems = Array.isArray(rawAccess)
    ? [...new Set(rawAccess.map(item => typeof item === 'string' ? item.split('.')[0].toLowerCase().trim() : '').filter(Boolean))]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 bg-[#f8fafc] min-h-screen font-sans animate-in fade-in duration-300">
      
      {/* --- TOGGLE SWITCH BAR INSIDE PROFILE PAGE CONTAINER DIV --- */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-2xs">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950 tracking-tight">
              User Profile & System Training
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Switch between your profile overview and main system tutorial videos
            </p>
          </div>
        </div>

        {/* Dynamic Mode Toggle Switch inside Profile Page Div */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-inner w-full sm:w-auto">
          <button
            onClick={() => handleModeToggle('overview')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              profileMode === 'overview'
                ? 'bg-slate-900 text-amber-400 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>My Profile Overview</span>
          </button>
          
          <button
            onClick={() => handleModeToggle('training')}
            className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              profileMode === 'training'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Training & Tutorial Videos</span>
          </button>
        </div>
      </div>

      {/* --- CONTENT CONDITIONAL RENDER BASED ON TOGGLE --- */}

      {profileMode === 'training' ? (
        /* --- TRAINING / TUTORIAL VIDEOS MODE (MAIN SYSTEM PAGES ONLY - NO SUB-PAGES) --- */
        <div className="grid grid-cols-1 gap-6 items-start animate-in fade-in duration-200">
          
          {/* Right Viewport: Main System Video Player & YouTube (YT) Cards Grid */}
          <div className="bg-slate-950 rounded-3xl p-6 border border-slate-800 text-white flex flex-col gap-6 relative min-h-[500px] shadow-xl">
            
            {/* Header: Selected Page Title + Add Video Button (Admin Only) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-md">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wider block">
                    System Training Module
                  </span>
                  <h2 className="text-lg font-black text-white tracking-tight">
                    {selectedSystem.label} Training Videos
                  </h2>
                </div>
              </div>

              {/* Add Video Button - Accessible ONLY to Admin */}
              {isAdmin && (
                <button
                  onClick={() => setIsAddVideoModalOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Video</span>
                </button>
              )}
            </div>

            {loadingVideo ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <span className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                <span className="text-xs font-bold">Loading training videos for {selectedSystem.label}...</span>
              </div>
            ) : videosList.length > 0 ? (
              /* --- YOUTUBE (YT) CARD FORMAT GRID --- */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {videosList.map((v, idx) => (
                  <div key={v.id || idx} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-md flex flex-col justify-between hover:border-slate-700 transition-all group">
                    
                    {/* YT Video Thumbnail / Embedded Box */}
                    <div className="w-full bg-black aspect-video relative overflow-hidden">
                      {v.video_type === 'file' ? (
                        <video
                          controls
                          preload="metadata"
                          src={v.video_url}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <iframe
                          src={getEmbedUrl(v.video_url, v.video_type)}
                          title={v.title || v.page_name || 'Tutorial Video'}
                          className="w-full h-full border-0"
                          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}

                      {/* Admin Delete Video Button */}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteVideo(v)}
                          title="Delete Video"
                          className="absolute top-2 right-2 p-1.5 bg-rose-600/90 hover:bg-rose-700 text-white rounded-lg transition-all shadow-md cursor-pointer opacity-90 hover:opacity-100 hover:scale-105"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* YT Card Body Details */}
                    <div className="p-3 flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-black text-white leading-snug group-hover:text-amber-400 transition-colors line-clamp-1">
                          {v.title || `${selectedSystem.label} Guide #${idx + 1}`}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-400">
                        <span>By: <strong className="text-slate-200 font-bold">{v.created_by || 'Admin'}</strong></span>
                        <span className="font-mono text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          {v.updated_at ? new Date(v.updated_at).toLocaleDateString() : 'Active'}
                        </span>
                      </div>

                      {v.description && (
                        <p className="text-[11px] text-slate-300 font-medium line-clamp-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 leading-relaxed">
                          {v.description}
                        </p>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            ) : (
              /* Empty state when no video uploaded */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 border border-dashed border-slate-800 rounded-2xl bg-slate-900/50 my-6">
                <div className="p-4 bg-slate-800/80 rounded-full text-slate-400 border border-slate-700">
                  <Video className="w-10 h-10 text-amber-400/70" />
                </div>
                <div className="max-w-md flex flex-col gap-1">
                  <h4 className="text-base font-black text-white">No Training Videos Uploaded Yet</h4>
                  <p className="text-xs text-slate-400 font-medium">
                    There are currently no training videos available for <strong className="text-amber-400 font-bold">{selectedSystem.label}</strong>. 
                    {isAdmin ? ' Click the "Add Video" button above to upload one.' : ' Admins can add training videos for this page.'}
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* --- MY PROFILE OVERVIEW MODE --- */
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          
          {/* 1. Hero Profile Header */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/90 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-center gap-6 text-center md:text-left w-full">
              <div className="relative shrink-0 group">
                {profile.profileImage && !imageError ? (
                  <img 
                    src={profile.profileImage} 
                    alt={profile.userName} 
                    onError={() => setImageError(true)}
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-slate-200 shadow-md ring-2 ring-slate-100"
                  />
                ) : (
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-3xl sm:text-4xl shadow-md border-2 border-amber-400/40 select-none">
                    {profile.userName?.slice(0, 2) || 'U'}
                  </div>
                )}
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" title="Active Account" />
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

              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight leading-tight">
                  {profile.userName || 'User Name'}
                </h1>

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
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-900 border border-slate-200/90 rounded-xl text-xs font-extrabold shadow-2xs hover:bg-slate-100 transition-colors">
                      <Store className="w-3.5 h-3.5 text-slate-600" /> {shop}
                    </span>
                  ))
                )}
              </div>
            </div>

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
                    <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-950 border border-amber-200 rounded-xl text-xs font-extrabold shadow-2xs hover:bg-amber-100 transition-colors">
                      <Coins className="w-3.5 h-3.5 text-amber-700" /> {counter}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 3. Accessible Systems List */}
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
                permissions.map((sysKey) => {
                  const info = getSystemInfo(sysKey);
                  const Icon = info.icon;
                  return (
                    <div key={sysKey} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-2xs transition-all ${info.color}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{info.name}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Active Tasks Directory */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-2xs">
                  <ClipboardList className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">Active Tasks Directory</h3>
                  <span className="text-xs text-slate-600 font-semibold">Company-Wide Aggregated Tasks</span>
                </div>
              </div>
              <span className="text-xs font-black text-slate-900 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md shadow-2xs">
                {tasks.length} Active Tasks
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
              <span className="font-extrabold text-slate-700">Filter Tasks by Module:</span>
              <div className="flex items-center gap-2">
                {['Checklist', 'Delegation', 'Work'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTaskSystemFilter(type)}
                    className={`px-3 py-1.5 rounded-lg font-extrabold text-xs transition-all cursor-pointer ${
                      taskSystemFilter === type
                        ? 'bg-slate-900 text-amber-400 shadow-2xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-slate-200/70">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-700">No active tasks found in directory.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                {tasks.filter(t => t.systemType === taskSystemFilter).map((t) => (
                  <div key={t.id} className="p-3 bg-slate-50/80 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${t.tagColor}`}>
                        {t.dynamicTag}
                      </span>
                      <span className="font-bold text-slate-900 truncate">{t.description}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">{t.plannedDate || 'N/A'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. Attendance Health */}
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-slate-900 text-amber-400 rounded-xl shadow-2xs">
                  <Clock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-950">My Attendance Health</h3>
                  <span className="text-xs text-slate-600 font-semibold">Individual Logs Performance Overview</span>
                </div>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-md shadow-2xs">
                {attendanceStats.percentage}% Attendance Rate
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-lg font-black text-emerald-900">{attendanceStats.present}</span>
                <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">Present Days</span>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
                <span className="text-lg font-black text-rose-900">{attendanceStats.absent}</span>
                <span className="text-[10px] font-extrabold uppercase text-rose-700 block">Absent Days</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                <span className="text-lg font-black text-amber-900">{attendanceStats.late}</span>
                <span className="text-[10px] font-extrabold uppercase text-amber-700 block">Late Scans</span>
              </div>
              <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-center">
                <span className="text-lg font-black text-slate-900">{attendanceStats.total}</span>
                <span className="text-[10px] font-extrabold uppercase text-slate-700 block">Total Logs</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Admin Add Tutorial Video Modal */}
      <AddTutorialVideoModal
        isOpen={isAddVideoModalOpen}
        onClose={() => {
          setIsAddVideoModalOpen(false);
          if (selectedSystem) fetchMainPageVideos(selectedSystem);
        }}
        targetSystem={selectedSystem}
        currentUser={profile}
      />

      {/* Profile Picture Upload Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-5 relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <Camera className="w-5 h-5 text-amber-500" /> Update Profile Picture
              </div>
              <button onClick={closeImageModal} disabled={uploadingImage} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="w-32 h-32 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400">
                    <Upload className="w-8 h-8" />
                    <span className="text-[10px] font-bold uppercase">No Image Selected</span>
                  </div>
                )}
              </div>
            </div>

            {imageUploadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" /> <span>{imageUploadError}</span>
              </div>
            )}

            {imageUploadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> <span>Profile picture updated successfully!</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploadingImage} className="file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-slate-900 file:text-amber-400 hover:file:bg-slate-800 text-xs text-slate-600 cursor-pointer border border-slate-200 rounded-xl p-1 bg-slate-50/50" />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={closeImageModal} disabled={uploadingImage} className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="button" onClick={handleUploadImage} disabled={!selectedFile || uploadingImage} className="px-5 py-2.5 bg-slate-900 text-amber-400 font-extrabold text-xs rounded-xl shadow-md hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 cursor-pointer">
                {uploadingImage ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Save Profile Picture
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
