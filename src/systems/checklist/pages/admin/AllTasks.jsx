"use client";
import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import AdminLayout from "../../components/layout/AdminLayout";
import supabase from "../../SupabaseClient";
import { getUserAssignedShops, isUserShopScoped } from "../../../../utils/permissionUtils";
import {
  ClipboardList,
  Wrench,
  Hammer,
  Search,
  Upload,
  CheckCircle2,
  X,
  History,
  ArrowLeft,
  Edit,
  Save,
  Loader2,
  Camera,
  Users,
  Play,
  Pause,
  BellRing,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building,
  Briefcase,
} from "lucide-react";
import TaskManagementTabs from "../../components/TaskManagementTabs";
import { customDropdownDetails } from "../../redux/slice/settingSlice";
import { updateRepairData } from "../../redux/api/repairApi";
import { sendTaskExtensionNotification, sendUrgentTaskNotification } from "../../services/whatsappService";
import AudioPlayer from "../../components/AudioPlayer";
import { useMagicToast } from "../../context/MagicToastContext";
import RenderDescription from "../../components/RenderDescription";
import WorkTasksTab from "./WorkTasksTab";
import { ViewOnlyBanner, getPagePermission } from "../../../../utils/permissionUtils";

const isAudioUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http') && (
    url.includes('audio-recordings') ||
    url.includes('voice-notes') ||
    url.match(/\.(mp3|wav|ogg|webm|m4a|aac)(\?.*)?$/i)
  );
};


const AllTasks = () => {
  const dispatch = useDispatch();
  const { customDropdowns = [] } = useSelector((state) => state.setting || {});
  const { showToast } = useMagicToast();
  const allTasksPerm = getPagePermission(null, 'checklist', 'All Tasks');
  const isModifyAllowed = allTasksPerm.canModify;
  // Active tab state
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem("alltasks_active_tab") || "checklist";
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem("alltasks_active_tab", activeTab);
    }
  }, [activeTab]);
  const [showHistory, setShowHistory] = useState(false);

  // Data states
  const [tasks, setTasks] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [uploadedImages, setUploadedImages] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [remarksData, setRemarksData] = useState({});
  const [statusData, setStatusData] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [extendedDateData, setExtendedDateData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchTerm]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilter, setDateFilter] = useState("all"); // all, today, overdue, upcoming
  const [workEmployeeFilter, setWorkEmployeeFilter] = useState("all");
  const [selectedShop, setSelectedShop] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [workDepartments, setWorkDepartments] = useState([]);
  const [allShopsList, setAllShopsList] = useState([]);
  const [dbDepartments, setDbDepartments] = useState(["RETAIL", "EXCISE", "TECHNICAL", "GODOWN", "ACCOUNTS", "OFFICE"]);
  const [dropdownOpen, setDropdownOpen] = useState({ dateFilter: false, workEmployee: false, shopFilter: false, departmentFilter: false });
  const shopFilterRef = useRef(null);
  const departmentFilterRef = useRef(null);
  const workEmployeeRef = useRef(null);
  const dateFilterRef = useRef(null);

  const toggleDropdown = useCallback((key) => {
    setDropdownOpen(prev => ({
      dateFilter: false,
      workEmployee: false,
      shopFilter: false,
      departmentFilter: false,
      [key]: !prev[key]
    }));
  }, []);

  const closeAllDropdowns = useCallback(() => {
    setDropdownOpen({ dateFilter: false, workEmployee: false, shopFilter: false, departmentFilter: false });
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      setDropdownOpen(prev => {
        let changed = false;
        const next = { ...prev };

        if (prev.shopFilter && shopFilterRef.current && !shopFilterRef.current.contains(e.target)) {
          next.shopFilter = false;
          changed = true;
        }
        if (prev.departmentFilter && departmentFilterRef.current && !departmentFilterRef.current.contains(e.target)) {
          next.departmentFilter = false;
          changed = true;
        }
        if (prev.workEmployee && workEmployeeRef.current && !workEmployeeRef.current.contains(e.target)) {
          next.workEmployee = false;
          changed = true;
        }
        if (prev.dateFilter && dateFilterRef.current && !dateFilterRef.current.contains(e.target)) {
          next.dateFilter = false;
          changed = true;
        }

        return changed ? next : prev;
      });
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setDropdownOpen({ dateFilter: false, workEmployee: false, shopFilter: false, departmentFilter: false });
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
  const childSubmitRef = useRef(null);
  const handleRegisterSubmit = useCallback((fn) => {
    childSubmitRef.current = fn;
  }, []);
  const [lightboxImage, setLightboxImage] = useState(null); // { url, name }
  const [fetchingProgress, setFetchingProgress] = useState(0);

  // Repair Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUpdateTask, setSelectedUpdateTask] = useState(null);
  const [updateForm, setUpdateForm] = useState({
    partReplaced: "",
    billAmount: "",
    status: "",
    remarks: "",
    workDone: "",
    vendorName: "",
    workPhoto: null,
    billCopy: null
  });

  const getFirstDayOfMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const getCurrentDayOfMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [username, setUsername] = useState(() => localStorage.getItem("user-name") || "");
  const [userRole, setUserRole] = useState(() => localStorage.getItem("role") || "");
  const tabDataCache = useRef({});

  // ---- RBAC: Can the current user submit a given task? ----
  // User role: can only submit tasks where task.name === username
  // Manager role: can only submit tasks where BOTH given_by === username AND name === username
  // Admin/HOD: can submit any task
  const canSubmitTask = useCallback((task) => {
    if (!isModifyAllowed) return false;
    if (!task || !username) return false;
    const role = (userRole || "").toLowerCase();
    const taskName = (task.name || task.assigned_person || task.doer_name || "").toLowerCase().trim();
    const taskGivenBy = (task.given_by || task.filled_by || "").toLowerCase().trim();
    const currentUser = username.toLowerCase().trim();

    if (role === "manager") {
      // Manager can only submit tasks that are assigned TO themselves AND given BY themselves
      return taskName === currentUser && taskGivenBy === currentUser;
    } else if (role === "user" || role === "employee") {
      // User/Employee can only submit tasks assigned to themselves
      return taskName === currentUser;
    }
    // Admin, HOD, masteradmin — can submit all
    return true;
  }, [username, userRole, isModifyAllowed]);
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getCurrentDayOfMonth());

  // Infinite Scroll Tracking
  const [visibleCount, setVisibleCount] = useState(50);
  const loadingRef = useRef(null);

  const statusDateColumn = activeTab === "repair" ? "created_at" : "planned_date";
  // Use planned_date for checklist/delegation sort — task_start_date is same for all occurrences of a recurring task
  const sortDateColumn = activeTab === "repair" ? "created_at" : "planned_date";
  const [holidaysList, setHolidaysList] = useState([]);
  const holidaysRef = useRef([]);
  const [allUsers, setAllUsers] = useState([]);

  const baseEmployeesList = useMemo(() => {
    const role = (userRole || "").toLowerCase();
    const currentUsername = username || "";

    if (role === "superadmin" || role === "masteradmin" || role === "hod") {
      return allUsers.map(u => typeof u === 'object' ? u.user_name : u).filter(Boolean);
    } else if (role === "admin" || role === "manager") {
      const isScoped = isUserShopScoped();
      const allowedShops = isScoped ? getUserAssignedShops().map(s => s.toLowerCase()) : [];
      if (allowedShops.length > 0) {
        const matched = allUsers.filter(u => {
          if (typeof u !== 'object') return false;
          const userShop = ([u.shop_name, u.user_access].filter(Boolean).join(",") || "").toLowerCase();
          const userShopsList = userShop.split(',').map(s => s.trim()).filter(Boolean);
          return userShopsList.some(s => allowedShops.includes(s));
        }).map(u => u.user_name);
        return [...new Set([currentUsername, ...matched])].filter(Boolean);
      }
      return allUsers.map(u => typeof u === 'object' ? u.user_name : u).filter(Boolean);
    } else if (role === "user" || role === "employee") {
      return [currentUsername].filter(Boolean);
    }

    return allUsers.map(u => typeof u === 'object' ? u.user_name : u).filter(Boolean);
  }, [allUsers, userRole, username]);

  // When a shop is selected, list only employees whose PRIMARY shop (users.shop_name) is that shop.
  // Shops in user_access are extra assigned access and must not make someone appear under it.
  const filteredEmployeesList = useMemo(() => {
    const role = (userRole || "").toLowerCase();
    if (!selectedShop || selectedShop === "all" || role === "user" || role === "employee") {
      return baseEmployeesList;
    }
    const target = selectedShop.trim().toLowerCase();
    const primaryNames = new Set(
      allUsers
        .filter((u) => typeof u === "object" && (u.shop_name || "").trim().toLowerCase() === target)
        .map((u) => u.user_name)
    );
    return baseEmployeesList.filter((name) => primaryNames.has(name));
  }, [baseEmployeesList, allUsers, selectedShop, userRole]);

  // Drop a stale employee selection that does not belong to the newly selected shop
  useEffect(() => {
    const role = (userRole || "").toLowerCase();
    if (role === "user" || role === "employee") return;
    if (workEmployeeFilter !== "all" && !filteredEmployeesList.includes(workEmployeeFilter)) {
      setWorkEmployeeFilter("all");
    }
  }, [filteredEmployeesList, workEmployeeFilter, userRole]);

  // Fetch holidays, users, and shops on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [holidaysRes, usersRes, shopsRes, deptsRes] = await Promise.all([
          supabase.from('holidays').select('holiday_date'),
          supabase.from('users').select('user_name, shop_name, user_access').eq('status', 'active').order('user_name', { ascending: true }),
          supabase.from('shop').select('id, shop_name').order('shop_name', { ascending: true }),
          supabase.from('master_work_tasks').select('department').not('department', 'is', null)
        ]);

        if (holidaysRes.data) {
          const hList = holidaysRes.data.map(h => h.holiday_date);
          holidaysRef.current = hList;
          setHolidaysList(hList);
        }
        if (usersRes.data) {
          setAllUsers(usersRes.data);
        }
        if (shopsRes.data) {
          setAllShopsList(shopsRes.data.map(s => s.shop_name).filter(Boolean));
        }
        if (deptsRes?.data) {
          const list = Array.from(new Set(deptsRes.data.map(d => d.department?.trim()).filter(Boolean)));
          if (list.length > 0) {
            setDbDepartments(prev => Array.from(new Set([...prev, ...list])).sort());
          }
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };
    fetchInitialData();
    dispatch(customDropdownDetails());
  }, [dispatch]);

  const uniqueShops = useMemo(() => {
    const set = new Set();
    allShopsList.forEach(s => {
      if (s && s.trim()) set.add(s.trim());
    });
    tasks.forEach(t => {
      const s = (t.shop || t.shop_name || "").trim();
      if (s && s !== "-" && s !== "—") set.add(s);
    });
    historyData.forEach(t => {
      const s = (t.shop || t.shop_name || "").trim();
      if (s && s !== "-" && s !== "—") set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allShopsList, tasks, historyData]);

  const availableDepartments = useMemo(() => {
    if (activeTab === "work") {
      const set = new Set();
      workDepartments.forEach(d => {
        if (d && d.trim()) set.add(d.trim());
      });
      // Fallback to dbDepartments if workDepartments is not yet loaded
      if (set.size === 0) {
        dbDepartments.forEach(d => {
          if (d && d.trim()) set.add(d.trim());
        });
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return [];
  }, [activeTab, workDepartments, dbDepartments]);


  // Check user credentials
  useEffect(() => {
    const role = localStorage.getItem("role") || "";
    const user = localStorage.getItem("user-name") || "";

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (user !== username) setUsername(user);
    if (role !== userRole) setUserRole(role);
    const lowerRole = role.toLowerCase();
    if (lowerRole === "user" || lowerRole === "employee") {
      setShowHistory(false);
      setWorkEmployeeFilter(user);
    }
  }, [username, userRole]);

  // Format date to dd/mm/yyyy
  const formatDate = useCallback((dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return dateString;
    }
  }, []);

  const formatDateWithTime = useCallback((dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, "0");
      const minutes = date.getMinutes().toString().padStart(2, "0");
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      return dateString;
    }
  }, []);

  const formatTimeOnly = useCallback((dateString) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${hours}:${minutes} ${ampm}`;
    } catch (error) {
      return "";
    }
  }, []);

  const getTimeStatus = useCallback((dateString, taskStatus) => {
    if (!dateString) return "—";
    let taskTime;
    if (typeof dateString === 'number') {
      taskTime = dateString;
    } else if (typeof dateString === 'string') {
      if (dateString.length >= 10 && dateString[4] === '-' && dateString[7] === '-') {
        const y = parseInt(dateString.slice(0, 4), 10);
        const m = parseInt(dateString.slice(5, 7), 10) - 1;
        const d = parseInt(dateString.slice(8, 10), 10);
        taskTime = new Date(y, m, d).getTime();
      } else {
        const d = new Date(dateString);
        taskTime = isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }
    } else {
      const d = new Date(dateString);
      taskTime = isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }
    if (taskTime === null || isNaN(taskTime)) return "—";

    const today = new Date();
    const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const isExtended = taskStatus?.toLowerCase() === "extended" || taskStatus?.toLowerCase() === "extend";

    if (isExtended) {
      if (taskTime < todayTime) return "Overdue";
      return "Today";
    }

    if (taskTime < todayTime) return "Overdue";
    if (taskTime === todayTime) return "Today";
    return "Upcoming";
  }, []);

  const calculateNextDueDate = (currentDateStr, frequency) => {
    if (!currentDateStr || !frequency) return null;

    // Safely parse the database date string (might be YYYY-MM-DD or ISO)
    let date = new Date(currentDateStr);
    if (isNaN(date.getTime())) return null;

    const isHoliday = (d) => {
      const dateStr = d.toISOString().split('T')[0];
      return holidaysList.includes(dateStr);
    };

    const freqLower = frequency.toLowerCase();

    switch (freqLower) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        break;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'half-yearly':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        return null;
    }

    // Skip holidays for daily, weekly, monthly tasks
    if (['daily', 'weekly', 'monthly', 'quarterly', 'half-yearly', 'yearly'].includes(freqLower)) {
      let attempts = 0;
      while (isHoliday(date) && attempts < 365) {
        date.setDate(date.getDate() + 1);
        attempts++;
      }
    }

    return date.toISOString();
  };

  // Fetch tasks based on active state (Pending or History)
  const fetchData = useCallback(async (forceRefresh = false) => {
    if (!username) return;

    if (activeTab === "work") {
      setIsLoading(false);
      return;
    }

    const cacheKey = `${activeTab}_${showHistory ? 'hist' : 'pend'}_${selectedShop}_${startDate}_${endDate}`;

    // If cache exists and not forcing a refresh, immediately use cached data for instant render
    if (!forceRefresh && tabDataCache.current[cacheKey]) {
      const cached = tabDataCache.current[cacheKey];
      if (showHistory) {
        setHistoryData(cached);
      } else {
        setTasks(cached);
      }
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      let tableName;
      let dateColumn;
      let completionField;
      let nameField = "name";
      let headers = [];

      switch (activeTab) {
        case "maintenance":
          tableName = "maintenance_tasks";
          dateColumn = "planned_date";
          completionField = "submission_date";
          if (showHistory) {
            headers = [
              { id: "id", label: "ID" },
              { id: "task_description", label: "Description" },
              { id: "shop", label: "Shop" },
              { id: "machine_name", label: "Machine" },
              { id: "part_name", label: "Part" },
              { id: "part_area", label: "Area" },
              { id: "planned_date", label: "Planned" },
              { id: "freq", label: "Freq" },
              { id: "require_attachment", label: "Attach" },
              { id: "submission_date", label: "Actual" },
              { id: "status", label: "Status" },
            ];
          } else {
            headers = [
              { id: "id", label: "ID" },
              { id: "task_description", label: "Description" },
              { id: "shop", label: "Shop" },
              { id: "machine_name", label: "Machine" },
              { id: "part_name", label: "Part" },
              { id: "part_area", label: "Area" },
              { id: "given_by", label: "Given By" },
              { id: "name", label: "Name" },
              { id: "planned_date", label: "Planned" },
              { id: "freq", label: "Freq" },
              { id: "enable_reminders", label: "Remind" },
              { id: "require_attachment", label: "Attach" },
              { id: "status", label: "Status" },
            ];
          }
          break;
        case "repair":
          tableName = "repair_tasks";
          dateColumn = "created_at";
          completionField = "status";
          nameField = "assigned_person";
          if (showHistory) {
            headers = [
              { id: "id", label: "Task ID" },
              { id: "issue_description", label: "Issue Detail" },
              { id: "shop", label: "Shop" },
              { id: "submission_date", label: "Submission Date" },
              { id: "filled_by", label: "Form Filled By" },
              { id: "assigned_person", label: "Assigned To" },
              { id: "machine_name", label: "Machine Name" },
              { id: "status", label: "Status" },
              { id: "attachment", label: "Attach" },
              { id: "part_replaced", label: "Part" },
              { id: "vendor_name", label: "Vendor" },
              { id: "bill_amount", label: "Amount" },
              { id: "duration", label: "Duration" },
            ];
          } else {
            headers = [
              { id: "action", label: "Action" },
              { id: "id", label: "ID" },
              { id: "issue_description", label: "Detail" },
              { id: "shop", label: "Shop" },
              { id: "filled_by", label: "Filled By" },
              { id: "assigned_person", label: "Assigned" },
              { id: "machine_name", label: "Machine" },
              { id: "status", label: "Status" },
              { id: "attachment", label: "Attach" },
              { id: "part_replaced", label: "Part" },
              { id: "vendor_name", label: "Vendor" },
              { id: "bill_amount", label: "Amount" },
              { id: "duration", label: "Duration" },
            ];
          }
          break;
        case "ea":
          tableName = "ea_tasks";
          dateColumn = showHistory ? "updated_at" : "planned_date";
          completionField = "status";
          nameField = "doer_name";
          headers = [
            { id: "task_id", label: "ID" },
            { id: "task_description", label: "Description" },
            { id: "shop", label: "Shop" },
            { id: "doer_name", label: "Name" },
            { id: "phone_number", label: "Phone" },
            { id: "planned_date", label: "Planned" },
            { id: "status", label: "Status" },
            { id: "attachment", label: "Attach" },
          ];
          if (showHistory) {
            headers.push({ id: "updated_at", label: "Submitted" });
          }
          break;
        case "checklist":
        default:
          tableName = "checklist";
          dateColumn = "task_start_date"; // task_start_date = original admin start date; used for lte filter in query
          completionField = "submission_date";
          headers = [
            { id: "id", label: "ID" },
            { id: "task_description", label: "Description" },
            { id: "shop", label: "Shop" },
            { id: "task_level", label: "Level" },
            { id: "given_by", label: "Given By" },
            { id: "name", label: "Name" },
            { id: "planned_date", label: "Planned" },
            { id: "frequency", label: "Freq" },
            { id: "enable_reminder", label: "Remind" },
            { id: "require_attachment", label: "Attach" },
            { id: "status", label: "Status" },
          ];
          break;
      }

      setTableHeaders(headers);

      let query = supabase.from(tableName).select("*");

      const currentUsername = (username || "");
      const currentUserRole = (userRole || "").toLowerCase();
      const isSuperAdmin = currentUserRole === "superadmin" || currentUserRole === "masteradmin";

      let reportingUsers = [currentUsername];
      let applyNameFilter = true;

      if (isSuperAdmin || currentUserRole === "hod") {
        // Superadmin and HOD have multi-shop enterprise access across ALL tasks and shops
        applyNameFilter = false;
      } else if (currentUserRole === "admin") {
        applyNameFilter = false; // Admins see all tasks in their shops, not restricted by user name

        // Shop based logic for admin: strictly scoped to assigned shops
        const isScoped = isUserShopScoped();
        const allowedShops = isScoped ? getUserAssignedShops() : [];
        if (allowedShops.length > 0) {
          if (activeTab === 'regular' || activeTab === 'checklist' || activeTab === 'delegation' || activeTab === 'maintenance') {
            query = query.in('shop_name', allowedShops);
          } else if (activeTab === 'ea' || activeTab === 'repair') {
            const tabNameStr = activeTab === 'ea' ? 'EA' : 'Repair';
            if (!allowedShops.some(s => s.toLowerCase() === tabNameStr.toLowerCase())) {
              query = query.eq('id', -1);
            }
          } else {
            query = query.in('shop_name', allowedShops);
          }
        }
      } else if (currentUserRole === "manager") {
        const userAccess = localStorage.getItem("user_access") || localStorage.getItem("shop_name") || "";
        const rawShops = userAccess.split(',').map(s => s.trim()).filter(Boolean);
        const managerShops = rawShops.map(s => s.toLowerCase());

        const { data: allDbUsers } = await supabase
          .from("users")
          .select("user_name, shop_name, user_access");
        if (allDbUsers) {
          const matchedUsers = allDbUsers.filter(u => {
            const userShop = ([u.shop_name, u.user_access].filter(Boolean).join(",") || "").toLowerCase();
            const userShopsList = userShop.split(',').map(s => s.trim()).filter(Boolean);
            return managerShops.includes("all") || managerShops.includes("admin") || userShopsList.some(s => managerShops.includes(s));
          }).map(u => u.user_name || "");
          reportingUsers = [...new Set([currentUsername, ...matchedUsers])].filter(Boolean);
        }

        if (rawShops.length > 0 && !managerShops.includes("all") && !managerShops.includes("admin")) {
          if (activeTab === "checklist" || activeTab === "regular" || activeTab === "delegation" || activeTab === "maintenance") {
            const allowedShops = [...new Set(
              rawShops.flatMap(s => [
                s,
                s.toUpperCase(),
                s.toLowerCase(),
                s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
              ])
            )];
            query = query.in('shop_name', allowedShops);
          }
        }
      }

      if (applyNameFilter) {
        query = query.in(nameField, reportingUsers);
      }

      // Pushdown shop filter to database when specific shop is selected
      if (selectedShop && selectedShop !== "all") {
        if (activeTab === "checklist" || activeTab === "delegation" || activeTab === "maintenance") {
          query = query.ilike('shop_name', `%${selectedShop.trim()}%`);
        } else if (activeTab === "repair") {
          query = query.or(`shop_name.ilike.%${selectedShop.trim()}%,shop.ilike.%${selectedShop.trim()}%`);
        }
      }

      if (showHistory) {
        const dateField = activeTab === "repair" ? "submission_date" : (activeTab === "ea" ? "created_at" : completionField);
        if (startDate) {
          query = query.gte(dateField, `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte(dateField, `${endDate}T23:59:59`);
        }

        if (activeTab === "repair") {
          query = query.not("submission_date", "is", null).order("submission_date", { ascending: false });
        } else if (activeTab === "ea") {
          query = supabase.from("ea_tasks_done").select("*");
          if (startDate) query = query.gte("created_at", `${startDate}T00:00:00`);
          if (endDate) query = query.lte("created_at", `${endDate}T23:59:59`);
          query = query.order("created_at", { ascending: false });
          if (applyNameFilter) {
            query = query.in('doer_name', reportingUsers);
          }
        } else {
          query = query.not(completionField, "is", null).order(completionField, { ascending: false });
        }
      } else {
        if (activeTab === "repair") {
          query = query.is("submission_date", null).order(dateColumn, { ascending: false });
        } else if (activeTab === "ea") {
          query = query.in("status", ["pending", "extend", "extended"]).order("task_start_date", { ascending: true });
        } else if (activeTab === "checklist" || activeTab === "delegation" || activeTab === "maintenance") {
          // Pre-filter: Focus on active overdue and near-term upcoming tasks to keep UI instantaneous
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - 60); // 60 days overdue window

          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 21); // 3 weeks upcoming window

          query = query
            .is(completionField, null)
            .gte('planned_date', pastDate.toISOString().split('T')[0] + 'T00:00:00')
            .lte('planned_date', futureDate.toISOString().split('T')[0] + 'T23:59:59')
            .order('planned_date', { ascending: true });
        }
      }

      // Apply search across fields directly in the backend query
      if (debouncedSearchTerm && debouncedSearchTerm.trim() !== "") {
        const cleanTerm = debouncedSearchTerm.trim();
        let searchFields = [];

        switch (activeTab) {
          case "maintenance":
            searchFields = ["task_description", "shop_name", "machine_name", "part_name", "part_area", "name", "given_by", "freq"];
            break;
          case "repair":
            searchFields = ["issue_description", "filled_by", "assigned_person", "machine_name", "part_replaced", "vendor_name"];
            break;
          case "ea":
            searchFields = ["task_description", "doer_name", "phone_number"];
            break;
          case "checklist":
          case "delegation":
          default:
            searchFields = ["task_description", "shop_name", "name", "given_by", "task_level", "task_id", "frequency"];
            break;
        }

        if (searchFields.length > 0) {
          const isNumeric = !isNaN(cleanTerm) && !isNaN(parseInt(cleanTerm, 10));
          const orQueryParts = [];

          searchFields.forEach(f => {
            if (f === "task_id") {
              if (isNumeric) {
                orQueryParts.push(`task_id.eq.${parseInt(cleanTerm, 10)}`);
              }
            } else {
              orQueryParts.push(`${f}.ilike.%${cleanTerm}%`);
            }
          });

          if (orQueryParts.length > 0) {
            const orQuery = orQueryParts.join(',');
            query = query.or(orQuery);
          }
        }
      }

      // Fetch with optimized limit
      const queryLimit = showHistory ? 1000 : 2000;
      const { data, error: fetchError } = await query.limit(queryLimit);

      if (fetchError) throw fetchError;

      let allFetchedData = data || [];

      if (allFetchedData.length > 0) {
        // Filter out tasks that fall on holidays (respect the calendar using cached Set)
        const hArr = holidaysRef.current && holidaysRef.current.length > 0 ? holidaysRef.current : holidaysList;
        const holidaySet = new Set(hArr);

        const filteredData = allFetchedData.filter(item => {
          if (activeTab === "repair") return true;

          const taskDate = (item.planned_date || item.task_start_date || item.created_at)?.split('T')[0];
          if (!taskDate) return true;

          return !holidaySet.has(taskDate);
        });

        const mappedData = filteredData.map(item => ({
          ...item,
          id: item.id || item.task_id,
          _table: item._table || tableName,
          shop: item.shop || item.shop_name || (activeTab === "ea" ? "EA" : "-")
        }));

        tabDataCache.current[cacheKey] = mappedData;

        if (showHistory) {
          setHistoryData(mappedData);
        } else {
          setTasks(mappedData);
        }
      } else {
        tabDataCache.current[cacheKey] = [];
        if (showHistory) {
          setHistoryData([]);
        } else {
          setTasks([]);
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [username, userRole, activeTab, showHistory, selectedShop, debouncedSearchTerm, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtering Logic
  const filteredPendingTasks = useMemo(() => {
    const term = (searchTerm || "").trim().toLowerCase();
    const selShop = selectedShop && selectedShop !== "all" ? selectedShop.trim().toLowerCase() : null;
    const selDept = selectedDepartment && selectedDepartment !== "all" ? selectedDepartment.trim().toLowerCase() : null;

    // Step 1: Pre-filter by shop, department, and search term BEFORE sorting
    const candidates = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // Apply shop filter
      if (selShop) {
        const taskShop = (task.shop || task.shop_name || "").trim().toLowerCase();
        if (taskShop !== selShop) continue;
      }

      // Apply department filter
      if (selDept) {
        const taskDept = (task.department || task.dept || task.project_type || task.task_level || "").trim().toLowerCase();
        if (taskDept !== selDept) continue;
      }

      // Search term
      if (term) {
        const matches = Object.values(task).some(
          (val) => val && val.toString().toLowerCase().includes(term)
        );
        if (!matches) continue;
      }

      // Pre-compute date status, rank, and sort time once
      const taskDateValue = task[statusDateColumn];
      const status = taskDateValue ? getTimeStatus(taskDateValue, task.status) : "—";

      // Apply dateFilter dropdown
      if (taskDateValue && status) {
        if (dateFilter === "today") {
          if (status !== "Today") continue;
        } else if (dateFilter === "overdue" || dateFilter === "not_done") {
          if (status !== "Overdue" && status !== "Not Done") continue;
        } else if (dateFilter === "upcoming") {
          if (status !== "Upcoming") continue;
        }
      }

      const rank = status === "Overdue" ? 0 : (status === "Today" ? 1 : (status === "Upcoming" ? 2 : 3));
      const sortDateVal = task[sortDateColumn];
      let sortTime = 0;
      if (sortDateVal) {
        if (typeof sortDateVal === 'string' && sortDateVal.length >= 10 && sortDateVal[4] === '-' && sortDateVal[7] === '-') {
          const y = parseInt(sortDateVal.slice(0, 4), 10);
          const m = parseInt(sortDateVal.slice(5, 7), 10) - 1;
          const d = parseInt(sortDateVal.slice(8, 10), 10);
          sortTime = new Date(y, m, d).getTime();
        } else {
          const parsed = new Date(sortDateVal).getTime();
          sortTime = isNaN(parsed) ? 0 : parsed;
        }
      }

      candidates.push({
        task,
        _status: status,
        _rank: rank,
        _sortTime: sortTime,
        _taskDateValue: taskDateValue
      });
    }

    // Step 2: Ultra-fast numeric sort (Overdue -> Today -> Upcoming, then by Date)
    candidates.sort((a, b) => a._rank - b._rank || a._sortTime - b._sortTime);

    // Step 3: Smart deduplication for checklist, delegation, and maintenance tabs
    const seen = new Set();
    const result = [];

    for (let i = 0; i < candidates.length; i++) {
      const item = candidates[i];
      const task = item.task;

      if (activeTab === "checklist" || activeTab === "delegation" || activeTab === "maintenance") {
        const descKey = task.task_description || task.issue_description || "";
        const nameKey = task.name || task.assigned_person || task.doer_name || "";
        const shopKey = task.shop || task.shop_name || "";
        const seriesBase = task.series_id || task.assignment_id || `${shopKey}::${descKey}::${nameKey}`;

        if (item._status === "Upcoming") {
          // UPCOMING: only show the NEXT (earliest) occurrence per task series
          const key = `upcoming::${seriesBase}`;
          if (seen.has(key)) continue;
          seen.add(key);
        } else {
          // OVERDUE & TODAY: show each day individually
          const dateStr = item._taskDateValue ? (typeof item._taskDateValue === 'string' ? item._taskDateValue.split('T')[0] : new Date(item._taskDateValue).toDateString()) : "";
          const key = `${seriesBase}::${dateStr}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
      }

      result.push(task);
    }

    return result;
  }, [tasks, searchTerm, activeTab, dateFilter, sortDateColumn, statusDateColumn, getTimeStatus, selectedShop, selectedDepartment]);

  const filteredHistoryTasks = useMemo(() => {
    const completionField = "submission_date";
    const term = (searchTerm || "").trim().toLowerCase();
    const selShop = selectedShop && selectedShop !== "all" ? selectedShop.trim().toLowerCase() : null;
    const selDept = selectedDepartment && selectedDepartment !== "all" ? selectedDepartment.trim().toLowerCase() : null;

    const startTs = startDate ? new Date(startDate + "T00:00:00").getTime() : null;
    const endTs = endDate ? new Date(endDate + "T23:59:59").getTime() : null;

    return historyData.filter((task) => {
      // Apply shop filter
      if (selShop) {
        const taskShop = (task.shop || task.shop_name || "").trim().toLowerCase();
        if (taskShop !== selShop) return false;
      }

      // Apply department filter
      if (selDept) {
        const taskDept = (task.department || task.dept || task.project_type || task.task_level || "").trim().toLowerCase();
        if (taskDept !== selDept) return false;
      }

      if (term) {
        const matchesSearch = Object.values(task).some(
          (val) => val && val.toString().toLowerCase().includes(term)
        );
        if (!matchesSearch) return false;
      }

      if (startTs || endTs) {
        const rawDate = task[completionField];
        if (!rawDate) return false;
        const itemTs = new Date(rawDate).getTime();
        if (startTs && itemTs < startTs) return false;
        if (endTs && itemTs > endTs) return false;
      }

      return true;
    });
  }, [historyData, searchTerm, startDate, endDate, activeTab, selectedShop, selectedDepartment]);

  // Handle Selections
  const handleSelectItem = useCallback((id, isChecked) => {
    if (isChecked) {
      if (!isModifyAllowed) {
        toast.error("You have view-only access. Selecting and submitting tasks is restricted.", { icon: "⚠️" });
        return;
      }
      // RBAC: Block selection of tasks that the current user cannot submit
      const task = tasks.find(t => t.id === id || t.task_id === id);
      if (task && !canSubmitTask(task)) {
        if (!isModifyAllowed) {
          toast.error("You have view-only access. Selecting and submitting tasks is restricted.", { icon: "⚠️" });
          return;
        }
        const role = (userRole || "").toLowerCase();
        if (role === "manager") {
          toast.error("You can only submit tasks where BOTH Manager Name and Employee match your username.", { icon: "⚠️" });
        } else {
          toast.error("You can only submit tasks assigned to you.", { icon: "⚠️" });
        }
        return; // Block the selection
      }
    }

    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (isChecked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

    if (!isChecked) {
      setRemarksData((prevR) => {
        const n = { ...prevR };
        delete n[id];
        return n;
      });
      setUploadedImages((prevI) => {
        const n = { ...prevI };
        delete n[id];
        return n;
      });
      setStatusData((prevS) => {
        const n = { ...prevS };
        delete n[id];
        return n;
      });
    }
  }, [tasks, canSubmitTask, userRole, isModifyAllowed]);

  const handleSelectAll = useCallback(
    (e) => {
      if (!isModifyAllowed) return;
      if (e.target.checked) {
        const submittableTasks = filteredPendingTasks.filter(t => {
          const timeStatus = getTimeStatus(t[statusDateColumn], t.status);
          // RBAC: Only select tasks the user can actually submit
          return timeStatus !== "Upcoming" && canSubmitTask(t);
        });
        setSelectedItems(new Set(submittableTasks.map((t) => t.id)));
      } else {
        setSelectedItems(new Set());
        setRemarksData({});
        setUploadedImages({});
        setStatusData({});
      }
    }, [filteredPendingTasks, getTimeStatus, statusDateColumn, canSubmitTask, isModifyAllowed]);

  const paginatedTasks = useMemo(() => {
    return (showHistory ? filteredHistoryTasks : filteredPendingTasks).slice(0, visibleCount);
  }, [showHistory, filteredHistoryTasks, filteredPendingTasks, visibleCount]);

  const totalItemsRendered = paginatedTasks.length;
  const exactTotalAvailable = (showHistory ? filteredHistoryTasks : filteredPendingTasks).length;

  // Intersection Observer for infinite scrolling inside AdminLayout
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          setVisibleCount((prev) => prev + 50);
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    return () => {
      if (loadingRef.current) observer.unobserve(loadingRef.current);
    };
  }, [isLoading, paginatedTasks.length]);

  // Reset visible count when filters or UI scope changes
  useEffect(() => {
    setVisibleCount(50);
  }, [activeTab, showHistory, searchTerm, dateFilter, startDate, endDate, selectedShop, selectedDepartment]);

  // Output pagination definitions successfully hoisted.

  // Pagination loader logic is directly in the return standard JSX now.

  // File Upload
  const handleImageUpload = useCallback((id, e) => {
    const file = e.target.files[0];
    if (file) {
      // Clean up old preview if it exists
      if (imagePreviews[id]) {
        URL.revokeObjectURL(imagePreviews[id]);
      }

      const previewUrl = URL.createObjectURL(file);
      setUploadedImages((prev) => ({ ...prev, [id]: file }));
      setImagePreviews((prev) => ({ ...prev, [id]: previewUrl }));
      setSuccessMessage(`File selected for task ID: ${id}`);
    }
  }, [imagePreviews]);

  // Clean up all object URLs when component unmounts
  useEffect(() => {
    return () => {
      Object.values(imagePreviews).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const uploadFile = async (id, file) => {
    const bucketName = activeTab;
    const fileName = `${id}_${Date.now()}_${file.name}`;
    const { data, error: uploadError } = await supabase.storage.from(bucketName).upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    return publicUrl;
  };


  // Repair Update Handler
  const openUpdateModal = (task) => {
    if (!isModifyAllowed) {
      showToast("You have view-only access. Updating repair tasks is disabled.", "error");
      return;
    }
    setSelectedUpdateTask(task);
    setUpdateForm({
      partReplaced: task.part_replaced || "",
      billAmount: task.bill_amount || "",
      status: task.status || "",
      remarks: task.remarks || "",
      vendorName: task.vendor_name || "",
      workPhoto: null,
      billCopy: null
    });
    setIsModalOpen(true);
  };

  const handleRepairUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!isModifyAllowed) {
      showToast("You have view-only access. Updating repair tasks is disabled.", "error");
      return;
    }
    if (!updateForm.status) {
      toast.error("Please select a status");
      return;
    }

    // If status is Pending, just close modal and return (don't save/submit)
    if (updateForm.status === "Pending") {
      setIsModalOpen(false);
      return;
    }

    // Validation for Mandatory Attachment
    const isAttachmentRequired =
      selectedUpdateTask.require_attachment === true ||
      String(selectedUpdateTask.require_attachment).toLowerCase() === "yes" ||
      String(selectedUpdateTask.require_attachment).toLowerCase() === "true" ||
      selectedUpdateTask.attachment === true;

    const isMarkedDone = ["completed", "done", "approved", "✅ completed"].some(s => updateForm.status.toLowerCase().includes(s));

    if (isAttachmentRequired && isMarkedDone && !updateForm.workPhoto) {
      showToast("Attachment required! Please upload a work photo before completing this repair.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let workPhotoUrl = null;
      let billCopyUrl = null;

      // Upload Work Photo if selected
      if (updateForm.workPhoto) {
        const fileExt = updateForm.workPhoto.name.split('.').pop();
        const fileName = `work_${selectedUpdateTask.id}_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('repair').upload(fileName, updateForm.workPhoto);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('repair').getPublicUrl(fileName);
        workPhotoUrl = publicUrl;
      }

      // Upload Bill Copy if selected
      if (updateForm.billCopy) {
        const fileExt = updateForm.billCopy.name.split('.').pop();
        const fileName = `bill_${selectedUpdateTask.id}_${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage.from('repair').upload(fileName, updateForm.billCopy);
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('repair').getPublicUrl(fileName);
        billCopyUrl = publicUrl;
      }

      await updateRepairData([{
        taskId: selectedUpdateTask.id,
        status: updateForm.status,
        partReplaced: updateForm.partReplaced || null,
        billAmount: updateForm.billAmount ? parseFloat(updateForm.billAmount) : null, // Fix empty string issue
        remarks: updateForm.remarks || null,
        vendorName: updateForm.vendorName || null,
        workPhotoUrl: workPhotoUrl,
        billCopyUrl: billCopyUrl
      }]);

      setIsModalOpen(false);
      showToast("Repair task updated successfully!", "success");
      tabDataCache.current = {};
      fetchData(true); // Refresh list
    } catch (error) {
      console.error(error);
      showToast("Failed to update task: " + error.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!isModifyAllowed) {
      showToast("You have view-only access. Submitting tasks is disabled.", "error");
      return;
    }
    if (selectedItems.size === 0) {
      showToast("Please select at least one task to submit", "error");
      return;
    }

    // RBAC: Double-check server-side that no unauthorized tasks are being submitted
    const unauthorizedTasks = Array.from(selectedItems).filter(id => {
      const task = tasks.find(t => t.id === id || t.task_id === id);
      return task && !canSubmitTask(task);
    });
    if (unauthorizedTasks.length > 0) {
      showToast("You are not authorized to submit one or more selected tasks. Please deselect them and try again.", "error");
      return;
    }

    // =================================================================
    // NEW LOGIC: Check for mandatory attachments across all tabs
    // =================================================================
    const selectedArray = Array.from(selectedItems);

    for (const id of selectedArray) {
      // Find the specific task object from your tasks state
      const task = tasks.find((t) => t.id === id || t.task_id === id);

      if (task) {
        // Check if the task requires an attachment 
        // (handling boolean true, or strings like "yes", "Yes", "true")
        const isAttachmentRequired =
          task.require_attachment === true ||
          String(task.require_attachment).toLowerCase() === "yes" ||
          String(task.require_attachment).toLowerCase() === "true" ||
          task.attachment === true;

        // Check if the user has selected a status of "Done" or "yes"
        // (You might not want to enforce attachment if they mark it "Not Done", but remove this extra condition if you want it strictly required on ANY submission)
        const currentStatus = statusData[id] || ((activeTab === "checklist" || activeTab === "delegation") ? "yes" : "Done");
        const isMarkedDone = ["done", "yes", "completed"].includes(currentStatus.toLowerCase());

        // If attachment is required, status is Done, and NO image is uploaded, block submission
        if (isAttachmentRequired && isMarkedDone && !uploadedImages[id]) {
          showToast(`Attachment required! Please upload an image/file for Task #${id} before submitting.`, "error");
          return; // Instantly stops the submit process
        }
      }
    }
    // =================================================================

    // Validate EA tasks with extended status must have extended date
    // Validate EA tasks with extended status must have extended date AND remarks
    if (activeTab === "ea") {
      for (const id of selectedArray) {
        if (statusData[id] === "extended") {
          if (!extendedDateData[id]) {
            showToast("Please provide an extended date for tasks with 'Extend' status", "error");
            return;
          }
          if (!remarksData[id] || remarksData[id].trim() === "") {
            showToast("Please provide remarks for tasks with 'Extend' status", "error");
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    setSuccessMessage("");

    // ... (Keep the rest of your try-catch submission logic unchanged)

    try {
      const tableName = activeTab === "checklist" ? "checklist" :
        activeTab === "delegation" ? "delegation" :
          activeTab === "maintenance" ? "maintenance_tasks" :
            activeTab === "ea" ? "ea_tasks" :
              "repair_tasks";
      const completionField = "submission_date";

      const selectedArray = Array.from(selectedItems);

      const updatePromises = selectedArray.map(async (id) => {
        let imageUrl = null;
        if (uploadedImages[id]) {
          imageUrl = await uploadFile(id, uploadedImages[id]);
        }

        const remarksField = activeTab === "checklist" ? "remark" : "remarks";
        const imageField = (activeTab === "checklist" || activeTab === "delegation") ? "image" : (activeTab === "maintenance" ? "uploaded_image_url" : "image_url");

        // Handle EA tasks differently - consolidate into ea_tasks
        if (activeTab === "ea") {
          const task = tasks.find(t => t.task_id === id);
          const taskStatus = statusData[id] || "done";

          if (taskStatus === "extended" && extendedDateData[id]) {
            const extendedDate = new Date(extendedDateData[id]).toISOString();

            // 1. Insert extension record into ea_tasks_done (Snapshot - using delegation names)
            const { error: doneError } = await supabase.from("ea_tasks_done").insert([{
              task_id: id,
              doer_name: task?.doer_name, // Aligned with delegation
              phone_number: task?.phone_number,
              planned_date: task?.planned_date,
              task_description: task?.task_description,
              status: "extended", // Lowercase
              audio_url: task?.audio_url || null,
              submission_date: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
              reason: remarksData[id] || null, // Aligned with delegation
              image_url: imageUrl, // Added to store image proof for extensions
              given_by: task?.given_by || localStorage.getItem("user-name") || "Admin",
              next_extend_date: extendedDate, // Aligned with delegation
              task_start_date: task?.task_start_date,
              duration: task?.duration || null,
              admin_done: false
            }]);
            if (doneError) throw doneError;

            // 2. Update ea_tasks
            const { error: updateError = null } = await supabase.from("ea_tasks").update({
              planned_date: extendedDate,
              extended_date: extendedDate, // Added to store extended date explicitly
              status: "extended", // Keep as extended so it's visible as such
              remarks: remarksData[id] || null,
              updated_at: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30')
            }).eq("task_id", id);
            if (updateError) throw updateError;

            if (task) {
              await sendTaskExtensionNotification({
                doerName: task.doer_name,
                taskId: task.task_id,
                givenBy: task.given_by,
                description: task.task_description,
                nextExtendDate: new Date(extendedDate).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })
              });
            }
          } else if (taskStatus === "done") {
            // 1. Insert completion record into ea_tasks_done (Snapshot)
            const { error: doneError = null } = await supabase.from("ea_tasks_done").insert([{
              task_id: id,
              doer_name: task?.doer_name,
              phone_number: task?.phone_number,
              planned_date: task?.planned_date,
              task_description: task?.task_description,
              status: "pending", // Waiting for admin approval (Lowercase)
              audio_url: task?.audio_url || null,
              submission_date: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
              reason: remarksData[id] || null,
              image_url: imageUrl,
              given_by: task?.given_by || localStorage.getItem("user-name") || "Admin",
              task_start_date: task?.task_start_date,
              duration: task?.duration || null,
              admin_done: false
            }]);
            if (doneError) throw doneError;

            // 2. Update ea_tasks
            const updates = {
              status: "done", // Mark as done for admin approval
              remarks: remarksData[id] || null,
              admin_done: false,
              updated_at: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30')
            };
            if (imageUrl) {
              updates.image_url = imageUrl;
            }
            const { error: updateError = null } = await supabase.from("ea_tasks").update(updates).eq("task_id", id);
            if (updateError) throw updateError;
          }
        } else {
          // Original logic for other task types
          const updates = {
            [completionField]: new Date(new Date().getTime() + (330 * 60000)).toISOString().replace('Z', '+05:30'),
            [remarksField]: remarksData[id] || null,
            status: statusData[id] || ((activeTab === "checklist" || activeTab === "delegation") ? "yes" : "Done"),
            admin_done: false
          };
          if (imageUrl) {
            updates[imageField] = imageUrl;
          }

          // Checklist and Delegation tables use `task_id`, all others use `id`
          const idKey = (activeTab === 'checklist' || activeTab === 'delegation') ? 'task_id' : 'id';

          const { error: updateError } = await supabase.from(tableName).update(updates).eq(idKey, id);
          if (updateError) throw updateError;
        }

      });

      await Promise.all(updatePromises);

      setSuccessMessage(`Successfully submitted ${selectedItems.size} task(s)!`);
      setSelectedItems(new Set());
      setRemarksData({});
      setUploadedImages({});
      setStatusData({});
      setExtendedDateData({});
      tabDataCache.current = {};
      fetchData(true);
      toast.success("Tasks submitted successfully!");
    } catch (err) {
      console.error("Submission error:", err);
      toast.error("Failed to submit tasks: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendUrgentWhatsApp = async () => {
    if (selectedItems.size === 0) return;

    setIsSubmitting(true);
    try {
      const selectedTasks = tasks.filter(t => selectedItems.has(t.id));

      for (const task of selectedTasks) {
        const doerName = task.doer_name || task.name || task.assigned_person;
        const taskId = task.task_id || task.id;
        const description = task.task_description || task.issue_description;
        const dueDateRaw = task.planned_date || task.task_start_date || task.created_at;
        const givenBy = task.given_by || task.filled_by;

        await sendUrgentTaskNotification({
          doerName,
          taskId,
          description,
          dueDate: formatDateWithTime(dueDateRaw),
          givenBy,
          taskType: activeTab,
          machineName: task.machine_name,
          partName: task.part_name,
          shop_name: task.shop || task.assigned_shop || task.shop_name,
          taskLevel: task.task_level
        });
      }

      toast.success(`Successfully sent urgent WhatsApp notifications for ${selectedItems.size} task(s)!`);
      setSelectedItems(new Set());
    } catch (err) {
      console.error("WhatsApp error:", err);
      toast.error("Failed to send WhatsApp messages: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const dateColumn = activeTab === "repair" ? "created_at" : (activeTab === "ea" ? (showHistory ? "updated_at" : "planned_date") : "task_start_date");

  return (
    <AdminLayout>
      {!isModifyAllowed && (
        <ViewOnlyBanner isModifyAllowed={isModifyAllowed} pageName="All Tasks" message="You have read-only access to Tasks. Submitting or updating task statuses is restricted." />
      )}
      <div className="space-y-4 sm:space-y-6">
        {/* Sticky Header Section - Solid background prevents scrolled details from bleeding through */}
        <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs py-3 px-2 transition-all duration-300">
          <div className="max-w-7xl mx-auto space-y-2">
            {/* Tab System & Primary Actions */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex-shrink-0">
                <TaskManagementTabs activeTab={activeTab} setActiveTab={(newTab) => {
                  setActiveTab(newTab);
                  setShowHistory(false);
                  setSelectedItems(new Set());
                  setSearchTerm("");
                  setSelectedDepartment("all");
                  setDateFilter("all");
                  setWorkEmployeeFilter((userRole || "").toLowerCase() === "user" ? (username || "") : "all");
                }} />
              </div>

              <div className="flex flex-wrap items-center gap-2 flex-grow justify-start xl:justify-end">
                {/* Search Bar - ALWAYS visible */}
                <div className="relative w-full sm:w-64 min-w-[190px]">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    type="text"
                    placeholder={selectedShop !== "all" ? `Search in ${selectedShop}...` : "Search tasks, description, person..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-1.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 text-xs font-medium bg-white text-gray-700 shadow-2xs transition-all placeholder:text-gray-400"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {userRole && userRole.toLowerCase() !== "user" && (
                  <button
                    onClick={() => {
                      const nextShowHistory = !showHistory;
                      setShowHistory(nextShowHistory);
                      setSearchTerm("");
                      closeAllDropdowns();
                      if (nextShowHistory) {
                        setStartDate(getFirstDayOfMonth());
                        setEndDate(getCurrentDayOfMonth());
                      } else {
                        setStartDate("");
                        setEndDate("");
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200/80 rounded-xl hover:bg-gray-50 hover:text-purple-600 transition-all shadow-sm shrink-0"
                  >
                    {showHistory ? (
                      <><ArrowLeft className="h-4 w-4" /><span>Live</span></>
                    ) : (
                      <><History className="h-4 w-4" /><span>History</span></>
                    )}
                  </button>
                )}

                {/* Shop Filter - for ALL tabs - ALWAYS visible */}
                <div ref={shopFilterRef} className="relative shrink-0">
                  <button
                    onClick={() => toggleDropdown('shopFilter')}
                    className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-sm ${selectedShop !== 'all' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    title="Filter by Shop"
                  >
                    <Building className="h-3.5 w-3.5" />
                    <span>{selectedShop === 'all' ? 'All Shops' : selectedShop}</span>
                    <ChevronDown size={14} className={`transition-transform ${dropdownOpen?.shopFilter ? 'rotate-180' : ''}`} />
                  </button>
                  {dropdownOpen?.shopFilter && (
                    <div className="absolute z-50 mt-2 w-52 right-0 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-y-auto max-h-64 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={() => {
                          setSelectedShop("all");
                          setSelectedDepartment("all");
                          setSearchTerm("");
                          setSelectedItems(new Set());
                          closeAllDropdowns();
                        }}
                        className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${selectedShop === 'all' ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        All Shops
                      </button>
                      {uniqueShops.map((s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSelectedShop(s);
                            setSelectedDepartment("all");
                            setSelectedItems(new Set());
                            closeAllDropdowns();
                          }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${selectedShop === s ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Department Filter - ONLY for Work tab */}
                {activeTab === "work" && (
                  <div ref={departmentFilterRef} className="relative animate-in fade-in duration-200 shrink-0">
                    <button
                      onClick={() => toggleDropdown('departmentFilter')}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-sm ${selectedDepartment !== 'all' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      title="Filter by Department"
                    >
                      <Briefcase className="h-3.5 w-3.5" />
                      <span>{selectedDepartment === 'all' ? 'All Depts' : selectedDepartment}</span>
                      <ChevronDown size={14} className={`transition-transform ${dropdownOpen?.departmentFilter ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen?.departmentFilter && (
                      <div className="absolute z-50 mt-2 w-52 right-0 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-y-auto max-h-64 animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={() => {
                            setSelectedDepartment("all");
                            setSelectedItems(new Set());
                            closeAllDropdowns();
                          }}
                          className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${selectedDepartment === 'all' ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                          All Departments
                        </button>
                        {availableDepartments.length > 0 ? (
                          availableDepartments.map((dept) => (
                            <button
                              key={dept}
                              onClick={() => {
                                setSelectedDepartment(dept);
                                setSelectedItems(new Set());
                                closeAllDropdowns();
                              }}
                              className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${selectedDepartment === dept ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              {dept}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-2 text-xs text-gray-400 italic">
                            No specific departments found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "work" && (
                  <div ref={workEmployeeRef} className="relative shrink-0">
                    <button
                      onClick={() => toggleDropdown('workEmployee')}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-sm ${workEmployeeFilter !== 'all' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{workEmployeeFilter === 'all' ? 'All Employees' : workEmployeeFilter}</span>
                      <ChevronDown size={14} className={`transition-transform ${dropdownOpen?.workEmployee ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen?.workEmployee && (
                      <div className="absolute z-50 mt-2 w-48 right-0 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-y-auto max-h-60 animate-in fade-in slide-in-from-top-2 duration-200">
                        {(userRole || "").toLowerCase() !== "user" && (
                          <button
                            onClick={() => {
                              setWorkEmployeeFilter("all");
                              setSelectedItems(new Set());
                              closeAllDropdowns();
                            }}
                            className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${workEmployeeFilter === 'all' ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            All Employees
                          </button>
                        )}
                        {filteredEmployeesList.map((user) => (
                          <button
                            key={user}
                            onClick={() => {
                              setWorkEmployeeFilter(user);
                              setSelectedItems(new Set());
                              closeAllDropdowns();
                            }}
                            className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${workEmployeeFilter === user ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                          >
                            {user}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!showHistory && (
                  <>
                    <div ref={dateFilterRef} className="relative shrink-0">
                      <button
                        onClick={() => toggleDropdown('dateFilter')}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-sm ${dateFilter !== 'all' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200'}`}
                      >
                        <Filter className="h-3 w-3" />
                        <span className="capitalize">{dateFilter === "not_done" ? "Not Done" : dateFilter}</span>
                        <ChevronDown size={14} className={`transition-transform ${dropdownOpen?.dateFilter ? 'rotate-180' : ''}`} />
                      </button>
                      {dropdownOpen?.dateFilter && (
                        <div className="absolute z-50 mt-2 w-40 right-0 rounded-xl bg-white shadow-xl border border-gray-100 py-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          {(activeTab === "work"
                            ? [
                              { id: 'all', label: 'All Tasks' },
                              { id: 'today', label: 'Today' },
                              { id: 'upcoming', label: 'Upcoming' }
                            ]
                            : [
                              { id: 'all', label: 'All Tasks' },
                              { id: 'overdue', label: 'Overdue' },
                              { id: 'today', label: 'Today' },
                              { id: 'upcoming', label: 'Upcoming' }
                            ]
                          ).map((filter) => (
                            <button
                              key={filter.id}
                              onClick={() => {
                                setDateFilter(filter.id);
                                setSelectedItems(new Set());
                                closeAllDropdowns();
                              }}
                              className={`block w-full text-left px-4 py-2 text-xs font-bold transition-colors ${dateFilter === filter.id ? 'bg-purple-50 text-purple-700 border-l-2 border-purple-500' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                              {filter.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {activeTab !== "repair" && (
                      <button
                        onClick={activeTab === "work" ? () => childSubmitRef.current?.() : handleSubmit}
                        disabled={!isModifyAllowed || selectedItems.size === 0 || isSubmitting}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-40 shadow-md shadow-purple-600/10 transition-all disabled:cursor-not-allowed shrink-0"
                      >
                        {isSubmitting ? "..." : `Submit (${selectedItems.size})`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {activeTab === "work" ? (
          <WorkTasksTab
            username={username}
            userRole={userRole}
            holidaysList={holidaysList}
            allUsers={allUsers}
            formatDate={formatDate}
            formatTimeOnly={formatTimeOnly}
            formatDateWithTime={formatDateWithTime}
            setLightboxImage={setLightboxImage}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showHistory={showHistory}
            setShowHistory={setShowHistory}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            workEmployeeFilter={workEmployeeFilter}
            setWorkEmployeeFilter={setWorkEmployeeFilter}
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            isSubmitting={isSubmitting}
            setIsSubmitting={setIsSubmitting}
            registerSubmit={handleRegisterSubmit}
            isModifyAllowed={isModifyAllowed}
            shopFilter={selectedShop}
            setShopFilter={setSelectedShop}
            departmentFilter={selectedDepartment}
            setDepartmentFilter={setSelectedDepartment}
            onDepartmentsChange={setWorkDepartments}
          />
        ) : (
          <>
            {/* Success Message */}
            {successMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 sm:px-4 py-3 rounded-md flex items-center justify-between text-sm sm:text-base animate-in fade-in duration-300">
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-emerald-600 flex-shrink-0" />
                  <span className="break-words font-black uppercase tracking-wide">{successMessage}</span>
                </div>
                <button onClick={() => setSuccessMessage("")} className="text-emerald-600 hover:text-emerald-800 ml-2 flex-shrink-0">
                  <X className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            )}

            {/* Removed redundant date filter tabs - now in dropdown */}



            {/* Table Container */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">

              {showHistory && (
                <div className="p-3 sm:p-4 border-b border-purple-100 bg-gray-50 flex flex-col sm:flex-row gap-3 items-center">
                  <span className="text-xs sm:text-sm font-medium text-purple-700 whitespace-nowrap">Filter by Range:</span>
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">From</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="text-xs sm:text-sm border border-gray-200 rounded-md p-1 focus:ring-1 focus:ring-purple-400 outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">To</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="text-xs sm:text-sm border border-gray-200 rounded-md p-1 focus:ring-1 focus:ring-purple-400 outline-none"
                      />
                    </div>
                    {(startDate || endDate) && (
                      <button onClick={() => { setStartDate(""); setEndDate(""); }} className="text-xs text-red-500 hover:underline">Clear</button>
                    )}
                  </div>
                </div>
              )}

              <div>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                    <p className="text-purple-600 text-sm font-bold uppercase tracking-wider">Loading data...</p>
                  </div>
                ) : error ? (
                  <div className="py-20 text-center">
                    <p className="text-red-500 mb-2 font-medium">{error}</p>
                    <button onClick={() => fetchData(true)} className="text-sm text-purple-600 underline">Try again</button>
                  </div>
                ) : (
                  <>
                    {/* Desktop view */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-600 text-[11px] font-bold tracking-wider uppercase border-b border-slate-200 select-none">
                          <tr>
                            {!showHistory && (
                              <th className="px-3 py-2.5 text-left font-bold text-gray-900">
                                <input
                                  type="checkbox"
                                  checked={(() => {
                                    const submittableTasks = filteredPendingTasks.filter(t => {
                                      const col = activeTab === "repair" ? "created_at" : "planned_date";
                                      return getTimeStatus(t[col], t.status) !== "Upcoming";
                                    });
                                    return submittableTasks.length > 0 && submittableTasks.every(t => selectedItems.has(t.id));
                                  })()}
                                  onChange={handleSelectAll}
                                  disabled={!isModifyAllowed}
                                  className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </th>
                            )}
                            {tableHeaders.map((header) => (
                              <th key={header.id} className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                {header.label}
                              </th>
                            ))}
                            {!showHistory && activeTab === "ea" && (
                              <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Extended Date</th>
                            )}
                            {!showHistory && activeTab !== "repair" && (
                              <>
                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Image</th>
                              </>
                            )}
                            {showHistory && (
                              <>
                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Remarks</th>
                                <th className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Attachment</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 text-xs">
                          {paginatedTasks.length > 0 ? (
                            paginatedTasks.map((task, index) => {
                              const currentStatus = getTimeStatus(task[statusDateColumn], task.status);
                              const prevStatus = index > 0 ? getTimeStatus(paginatedTasks[index - 1][statusDateColumn], paginatedTasks[index - 1].status) : null;
                              const showGroupHeader = currentStatus !== prevStatus;

                              return (
                                <Fragment key={task.id}>
                                  {showGroupHeader && !showHistory && (
                                    <tr className="bg-gray-100/30">
                                      <td colSpan={tableHeaders.length + 6} className="px-4 sm:px-6 py-2">
                                        <div className="flex items-center gap-2">
                                          <div className={`w-1.5 h-1.5 rounded-full ${(currentStatus === 'Overdue' || currentStatus === 'Not Done') ? 'bg-red-500' : currentStatus === 'Today' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] text-gray-500">
                                            {currentStatus} {activeTab === "ea" && currentStatus === "Today" ? " & Extended" : ""}
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                  <tr className={`hover:bg-gray-50 ${!showHistory && !canSubmitTask(task) ? 'bg-gray-50/50' : ''}`}>
                                    {!showHistory && (() => {
                                      const isUpcoming = getTimeStatus(task[statusDateColumn], task.status) === "Upcoming";
                                      const canSubmit = canSubmitTask(task);
                                      return (
                                        <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                          {canSubmit ? (
                                            <input
                                              type="checkbox"
                                              checked={selectedItems.has(task.id)}
                                              onChange={(e) => handleSelectItem(task.id, e.target.checked)}
                                              disabled={isUpcoming}
                                              className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                            />
                                          ) : (
                                            <button
                                              type="button"
                                              title={(() => {
                                                if (!isModifyAllowed) return "You have view-only access. Submitting tasks is disabled.";
                                                const role = (userRole || "").toLowerCase();
                                                if (role === "manager") return "You can only submit tasks where you are both the Manager and the Employee";
                                                return "You can only submit tasks assigned to you";
                                              })()}
                                              onClick={() => {
                                                if (!isModifyAllowed) {
                                                  toast.error("Submit Restricted: You have view-only access.", { icon: "⚠️" });
                                                  return;
                                                }
                                                const role = (userRole || "").toLowerCase();
                                                if (role === "manager") {
                                                  toast.error("Submit Restricted: Manager Name and Employee must both match your username.", { icon: "⚠️" });
                                                } else {
                                                  toast.error("Submit Restricted: You can only submit tasks assigned to you.", { icon: "⚠️" });
                                                }
                                              }}
                                              className="h-4 w-4 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors cursor-not-allowed"
                                            >
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                            </button>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    {activeTab === "repair" ? (
                                      <>
                                        {!showHistory ? (
                                          <>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                              <button onClick={() => openUpdateModal(task)} disabled={!isModifyAllowed} className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded text-xs font-medium transition-colors flex items-center gap-1">
                                                <Edit className="h-3 w-3" /> Process
                                              </button>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{task.id}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTimeStatus(task.created_at, task.status) === 'Overdue' ? 'bg-red-100 text-red-800' : getTimeStatus(task.created_at, task.status) === 'Today' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                                {getTimeStatus(task.created_at, task.status)}
                                              </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-800 min-w-[200px]">
                                              <RenderDescription text={task.issue_description} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">{task.shop || task.shop_name || "—"}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.filled_by}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                              <span className="font-bold text-gray-900">{task.assigned_person || "—"}</span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.machine_name}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                                                (task.status === "Approved" || task.status === "Completed") ? "bg-green-100 text-green-800" :
                                                  (!task.admin_done && task.submission_date) ? "bg-orange-100 text-orange-800" :
                                                    "bg-gray-100 text-gray-800"}`}>
                                                {(!task.admin_done && task.submission_date) ? "Pending Approval" : task.status}
                                              </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.part_replaced || "—"}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.bill_amount ? `₹${task.bill_amount}` : "—"}</td>
                                          </>
                                        ) : (
                                          <>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{task.id}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-800 min-w-[200px]">
                                              <RenderDescription text={task.issue_description} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">{task.shop || task.shop_name || "—"}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                              {task.submission_date ? new Date(task.submission_date).toLocaleString() : "—"}
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.filled_by}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.assigned_person}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.machine_name}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm">
                                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${task.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                                                (task.status === "Approved" || task.status === "Completed") ? "bg-green-100 text-green-800" :
                                                  task.status === "Pending Approval" ? "bg-orange-100 text-orange-800" :
                                                    "bg-gray-100 text-gray-800"}`}>
                                                {task.status}
                                              </span>
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.part_replaced || "—"}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">{task.bill_amount ? `₹${task.bill_amount}` : "—"}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-800 max-w-xs truncate">{task.remarks || "—"}</td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                              {task.work_photo_url || task.bill_copy_url ? (
                                                <div className="flex flex-col gap-1">
                                                  {task.work_photo_url && (
                                                    <a href={task.work_photo_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-xs">
                                                      View Work Photo
                                                    </a>
                                                  )}
                                                  {task.bill_copy_url && (
                                                    <a href={task.bill_copy_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline text-xs">
                                                      View Bill
                                                    </a>
                                                  )}
                                                </div>
                                              ) : "—"}
                                            </td>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {tableHeaders.map((header) => (
                                          <td key={header.id} className={`px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-800 ${header.id === 'task_description' || header.id === 'issue_description' ? 'min-w-[200px] whitespace-normal' : 'whitespace-nowrap'}`}>
                                            {header.id === "time_status"
                                              ? (
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTimeStatus(task[statusDateColumn], task.status) === 'Overdue' ? 'bg-red-100 text-red-800' :
                                                  getTimeStatus(task[statusDateColumn], task.status) === 'Today' ? 'bg-green-100 text-green-800' :
                                                    'bg-blue-100 text-blue-800'}`}>
                                                  {getTimeStatus(task[statusDateColumn], task.status)}
                                                </span>
                                              )
                                              : header.id === "task_start_date" || header.id === "created_at" || header.id === "planned_date" || header.id === "updated_at" || header.id === "current_date"
                                                ? (
                                                  <div className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                                                    <span className="font-semibold text-slate-800">{formatDate(task[header.id])}</span>
                                                    {(header.id === "current_date" ? (task.task_assignments?.start_datetime ? formatTimeOnly(task.task_assignments.start_datetime) : "") : formatTimeOnly(task[header.id])) ? (
                                                      <span className="text-[11px] text-slate-400 font-mono">
                                                        {header.id === "current_date" ? (task.task_assignments?.start_datetime ? formatTimeOnly(task.task_assignments.start_datetime) : "") : formatTimeOnly(task[header.id])}
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                )
                                                : (header.id === "id" || header.id === "task_id")
                                                  ? (
                                                    <div className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                      <span className="font-mono font-bold text-slate-900 text-xs">{task[header.id]}</span>
                                                      {(task.status?.toLowerCase() === "extended" || task.status?.toLowerCase() === "extend") && (
                                                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-200 uppercase">Extended</span>
                                                      )}
                                                    </div>
                                                  )
                                                : header.id === "submission_date"
                                                  ? (activeTab === "maintenance" && showHistory)
                                                    ? (
                                                      <div className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                                                        <span className="font-semibold text-slate-800">{formatDate(task[header.id])}</span>
                                                        {formatTimeOnly(task[header.id]) ? <span className="text-[11px] text-slate-400 font-mono">{formatTimeOnly(task[header.id])}</span> : null}
                                                      </div>
                                                    )
                                                    : formatDateWithTime(task[header.id])
                                                : header.id === "status"
                                                      ? !showHistory && (activeTab === "maintenance" || activeTab === "checklist" || activeTab === "ea" || activeTab === "delegation")
                                                        ? (
                                                          <select
                                                            value={statusData[task.id] || task.status || ""}
                                                            onChange={(e) => setStatusData(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                            disabled={!selectedItems.has(task.id)}
                                                            className="block w-full py-1.5 pl-3 pr-8 text-xs sm:text-sm text-gray-700 bg-white border border-gray-200 rounded-md focus:border-purple-500 focus:outline-none disabled:bg-gray-50/50 disabled:text-gray-400 appearance-none shadow-sm cursor-pointer hover:border-gray-300 transition-colors"
                                                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                                                          >
                                                            <option value="">Select Status</option>
                                                            {activeTab === "ea" ? (
                                                              <>
                                                                <option value="done">Done</option>
                                                                <option value="extended">Extend</option>
                                                              </>
                                                            ) : (
                                                              <>
                                                                <option value={(activeTab === 'checklist' || activeTab === 'delegation') ? 'yes' : 'Done'}>Done</option>
                                                                <option value={(activeTab === 'checklist' || activeTab === 'delegation') ? 'no' : 'Not Done'}>Not Done</option>
                                                              </>
                                                            )}
                                                          </select>
                                                        )
                                                        : (
                                                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${activeTab === "ea"
                                                            ? (task[header.id]?.toLowerCase() === "approved" ? "bg-green-100 text-green-800" : task[header.id]?.toLowerCase() === "done" ? "bg-orange-100 text-orange-800" : (task[header.id]?.toLowerCase() === "pending" || task[header.id]?.toLowerCase() === "extend" || task[header.id]?.toLowerCase() === "extended") ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-800")
                                                            : (task[header.id] === "Done" || task[header.id] === "yes" || task[header.id] === "done" || task[header.id] === "approved" || task[header.id] === "Completed")
                                                              ? (task.admin_done ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800")
                                                              : (task[header.id] === "extend" || task[header.id] === "pending" || task[header.id] === "extended")
                                                                ? "bg-yellow-100 text-yellow-800"
                                                                : "bg-gray-100 text-gray-800"
                                                            }`}>
                                                            {activeTab === "ea" && showHistory
                                                              ? (task[header.id]?.toLowerCase() === "approved" || (task[header.id]?.toLowerCase() === "done" && task.admin_done) ? "Completed" : task[header.id]?.toLowerCase() === "done" ? "Pending Approval" : (task[header.id]?.toLowerCase() === "extended" || task[header.id]?.toLowerCase() === "extend") ? "Extended" : task[header.id])
                                                              : (showHistory && (task[header.id] === "Done" || task[header.id] === "yes" || task[header.id] === "done" || task[header.id] === "Completed") && !task.admin_done)
                                                                ? "Pending Approval"
                                                                : (showHistory && (task[header.id] === "Done" || task[header.id] === "yes" || task[header.id] === "done" || task[header.id] === "Completed") && task.admin_done)
                                                                  ? "Approved"
                                                                  : task[header.id]}
                                                          </span>
                                                        )
                                                      : (header.id === "enable_reminders" || header.id === "require_attachment" || header.id === "enable_reminder" || header.id === "attachment")
                                                        ? (task[header.id] ? "Yes" : "No")
                                                        : (header.id === 'name' || header.id === 'assigned_person' || header.id === 'doer_name' || header.id === 'manager_name')
                                                          ? <span className="font-bold text-gray-900">{task[header.id] || "—"}</span>
                                                          : header.id === "machine_name"
                                                            ? (task.machine_name || (task.task_description ? task.task_description.split(' - ')[0] : "—"))
                                                            : header.id === "part_name"
                                                              ? (
                                                                <div className="flex flex-col gap-1 min-w-[120px]">
                                                                  <span className="text-gray-900">{task.part_name || "—"}</span>
                                                                  <div className="flex gap-1 flex-wrap">
                                                                    {task.part_name && task.part_name.split(',').map(p => p.trim()).map((part, idx) => {
                                                                      const match = customDropdowns.find(d => d.category === "Part Name" && d.value === part && d.image_url);
                                                                      return match ? (
                                                                        <img
                                                                          key={idx}
                                                                          src={match.image_url}
                                                                          alt={part}
                                                                          className="w-10 h-10 object-cover rounded shadow-sm border border-gray-200 bg-gray-50 flex-shrink-0 cursor-zoom-in hover:ring-2 hover:ring-purple-400 hover:scale-105 transition-all"
                                                                          title={`Click to enlarge: ${part}`}
                                                                          onClick={() => setLightboxImage({ url: match.image_url, name: part })}
                                                                        />
                                                                      ) : null;
                                                                    })}
                                                                  </div>
                                                                </div>
                                                              )
                                                              : (header.id === 'task_description' || header.id === 'issue_description' || header.id === 'remarks')
                                                                ? <RenderDescription text={task[header.id]} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                                                : isAudioUrl(task[header.id])
                                                                  ? <AudioPlayer url={task[header.id]} />
                                                                  : header.id === 'work_photo_url' || header.id === 'bill_copy_url'
                                                                    ? task[header.id] ? <a href={task[header.id]} target="_blank" rel="noopener noreferrer" className="text-purple-600 underline">View</a> : "—"
                                                                    : task[header.id] || "—"}</td>
                                        ))}
                                        {!showHistory && activeTab === "ea" && (
                                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                            <input
                                              type="date"
                                              placeholder="Extended Date"
                                              value={extendedDateData[task.id] || ""}
                                              onChange={(e) => setExtendedDateData((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                              className="w-full min-w-[140px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:border-purple-400 outline-none text-xs text-gray-700 disabled:opacity-50"
                                              disabled={!selectedItems.has(task.id) || statusData[task.id] !== 'extended'}
                                            />
                                          </td>
                                        )}
                                        {!showHistory && activeTab !== "repair" && (
                                          <>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                              <input
                                                type="text"
                                                placeholder="Enter remarks"
                                                value={remarksData[task.id] || ""}
                                                onChange={(e) => setRemarksData((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                                className="w-full min-w-[140px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-md focus:border-purple-400 outline-none text-xs text-gray-700 disabled:opacity-50"
                                                disabled={!selectedItems.has(task.id)}
                                              />
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800 bg-emerald-50/30">
                                              <div className="flex flex-col gap-2">
                                                {imagePreviews[task.id] && (
                                                  <div className="relative w-16 h-16 mb-1 group">
                                                    <img
                                                      src={imagePreviews[task.id]}
                                                      className="w-full h-full object-cover rounded-md border-2 border-purple-200 shadow-sm"
                                                      alt="Preview"
                                                    />
                                                    <button
                                                      onClick={() => {
                                                        URL.revokeObjectURL(imagePreviews[task.id]);
                                                        setImagePreviews(prev => {
                                                          const next = { ...prev };
                                                          delete next[task.id];
                                                          return next;
                                                        });
                                                        setUploadedImages(prev => {
                                                          const next = { ...prev };
                                                          delete next[task.id];
                                                          return next;
                                                        });
                                                      }}
                                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                      <X size={10} />
                                                    </button>
                                                  </div>
                                                )}
                                                {activeTab !== "work" && (
                                                  <label className={`flex items-center gap-2 cursor-pointer text-xs font-medium transition-colors ${selectedItems.has(task.id) ? "text-purple-600 hover:text-purple-800" : "text-gray-400 cursor-not-allowed"}`}>
                                                    <Upload className="h-3.5 w-3.5" />
                                                    <span>
                                                      {uploadedImages[task.id] ? "Change File" : (task.require_attachment || task.attachment) ? <span>Upload Proof <span className="text-red-500 font-bold">*</span></span> : "Upload Proof"}
                                                    </span>
                                                    <input
                                                      type="file"
                                                      className="hidden"
                                                      onChange={(e) => handleImageUpload(task.id, e)}
                                                      disabled={!selectedItems.has(task.id)}
                                                    />
                                                  </label>
                                                )}
                                                <label className={`flex items-center gap-2 cursor-pointer text-xs font-medium transition-colors ${selectedItems.has(task.id) ? "text-cyan-500 hover:text-cyan-700" : "text-gray-400 cursor-not-allowed"}`}>
                                                  <Camera className="h-3.5 w-3.5" />
                                                  <span>
                                                    {uploadedImages[task.id] ? "Retake Photo" : (task.require_attachment || task.attachment) ? <span>Take Photo <span className="text-red-500 font-bold">*</span></span> : "Take Photo"}
                                                  </span>
                                                  <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleImageUpload(task.id, e)}
                                                    disabled={!selectedItems.has(task.id)}
                                                  />
                                                </label>
                                              </div>
                                            </td>
                                          </>
                                        )}
                                        {showHistory && (
                                          <>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 text-sm text-gray-800 max-w-xs truncate">
                                              <RenderDescription text={task.remark || task.remarks} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                            </td>
                                            <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-sm text-gray-800">
                                              {task.image || task.uploaded_image_url || task.image_url ? (
                                                <a href={task.image || task.uploaded_image_url || task.image_url} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">View</a>
                                              ) : "—"}
                                            </td>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </tr>
                                </Fragment>
                              )
                            })
                          ) : (
                            <tr>
                              <td colSpan={tableHeaders.length + 6} className="px-6 py-24 text-center">
                                <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                                    <Search size={22} />
                                  </div>
                                  <p className="text-sm font-bold text-gray-700">No {showHistory ? "history records" : "pending tasks"} found</p>
                                  <p className="text-xs text-gray-400">
                                    {searchTerm 
                                      ? `No matches for "${searchTerm}". Try a different keyword.` 
                                      : selectedShop !== 'all' 
                                        ? `No ${showHistory ? "history records" : "pending tasks"} for ${selectedShop} with current filters.` 
                                        : "All tasks are up to date."}
                                  </p>
                                  {searchTerm && (
                                    <button
                                      onClick={() => setSearchTerm("")}
                                      className="mt-2 text-xs font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg border border-purple-100 transition-colors"
                                    >
                                      Clear Search
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile view Toolbar */}
                    {!showHistory && (
                      <div className="md:hidden sticky top-[header_height] z-30 transition-all duration-300">
                        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="relative flex items-center">
                              <input
                                type="checkbox"
                                checked={(() => {
                                  const submittableTasks = filteredPendingTasks.filter(t => {
                                    const col = activeTab === "repair" ? "created_at" : "planned_date";
                                    return getTimeStatus(t[col], t.status) !== "Upcoming";
                                  });
                                  return submittableTasks.length > 0 && submittableTasks.every(t => selectedItems.has(t.id));
                                })()}
                                onChange={handleSelectAll}
                                disabled={!isModifyAllowed}
                                className="h-5 w-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              />
                            </div>
                            <span className="text-sm font-black text-gray-700 uppercase tracking-tight">Select All Tasks</span>
                          </div>

                          {selectedItems.size > 0 && (
                            <button
                              onClick={() => { setSelectedItems(new Set()); setRemarksData({}); setUploadedImages({}); setStatusData({}); }}
                              className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors"
                            >
                              Clear Selection
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Mobile view Cards */}
                    <div className="md:hidden space-y-4 p-4 bg-gray-50/50 pb-24">
                      {paginatedTasks.length > 0 ? (
                        paginatedTasks.map((task, index) => {
                          const currentStatus = getTimeStatus(task[statusDateColumn], task.status);
                          const prevStatus = index > 0 ? getTimeStatus(paginatedTasks[index - 1][statusDateColumn], paginatedTasks[index - 1].status) : null;
                          const showGroupHeader = currentStatus !== prevStatus;

                          return (
                            <Fragment key={task.id}>
                              {showGroupHeader && !showHistory && (
                                <div className="pt-2 pb-1 px-1">
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                                    <div className={`w-1 h-1 rounded-full ${(currentStatus === 'Overdue' || currentStatus === 'Not Done') ? 'bg-red-500' : currentStatus === 'Today' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                    {currentStatus} {activeTab === "ea" && currentStatus === "Today" ? " & Extended" : ""}
                                  </span>
                                </div>
                              )}
                              <div className="bg-white rounded-xl border border-purple-100 shadow-sm overflow-hidden animate-fade-in">
                                {/* Card Header */}
                                <div className="bg-purple-50/50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                    {!showHistory && (() => {
                                      const isUpcoming = getTimeStatus(task[statusDateColumn], task.status) === "Upcoming";
                                      const canSubmit = canSubmitTask(task);
                                      return canSubmit ? (
                                        <input
                                          type="checkbox"
                                          checked={selectedItems.has(task.id)}
                                          onChange={(e) => handleSelectItem(task.id, e.target.checked)}
                                          disabled={isUpcoming}
                                          className="h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                        />
                                      ) : (
                                        <button
                                          type="button"
                                          title={!isModifyAllowed ? "You have view-only access. Submitting tasks is disabled." : "You cannot submit this task"}
                                          onClick={() => {
                                            if (!isModifyAllowed) {
                                              toast.error("Submit Restricted: You have view-only access.", { icon: "⚠️" });
                                              return;
                                            }
                                            const role = (userRole || "").toLowerCase();
                                            if (role === "manager") {
                                              toast.error("Submit Restricted: Manager Name and Employee must both match your username.", { icon: "⚠️" });
                                            } else {
                                              toast.error("Submit Restricted: You can only submit tasks assigned to you.", { icon: "⚠️" });
                                            }
                                          }}
                                          className="h-4 w-4 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors cursor-not-allowed"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                        </button>
                                      );
                                    })()}
                                    <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">#{task.id}</span>
                                    {(task.status?.toLowerCase() === "extended" || task.status?.toLowerCase() === "extend") && (
                                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase tracking-tighter border border-amber-200 animate-pulse">Extended</span>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 inline-flex text-[10px] leading-5 font-semibold rounded-full ${['Overdue', 'Not Done'].includes(getTimeStatus(task[statusDateColumn] || task.created_at, task.status)) ? 'bg-red-100 text-red-800' :
                                    getTimeStatus(task[statusDateColumn] || task.created_at, task.status) === 'Today' ? 'bg-green-100 text-green-800' :
                                      'bg-blue-100 text-blue-800'}`}>
                                    {getTimeStatus(task[statusDateColumn] || task.created_at, task.status)}
                                  </span>
                                </div>

                                {/* Card Body */}
                                <div className="p-4 space-y-3">
                                  {/* Main Description */}
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-gray-400 uppercase font-semibold">Description</p>
                                    <div className="text-sm text-gray-800">
                                      <RenderDescription text={task.issue_description || task.task_description} audioUrl={task.audio_url} instructionUrl={task.instruction_attachment_url} instructionType={task.instruction_attachment_type} />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Assigned To</p>
                                      <p className="text-sm font-bold text-gray-900">{task.assigned_person || task.name || task.doer_name || "—"}</p>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Status</p>
                                      <div className="text-sm">
                                        {(!showHistory && (activeTab === "maintenance" || activeTab === "checklist" || activeTab === "ea" || activeTab === "delegation")) ? (
                                          <select
                                            value={statusData[task.id] || task.status || ""}
                                            onChange={(e) => setStatusData(prev => ({ ...prev, [task.id]: e.target.value }))}
                                            disabled={!selectedItems.has(task.id)}
                                            className="w-full text-xs border-gray-200 rounded-md py-1 focus:ring-purple-400"
                                          >
                                            <option value="">Status</option>
                                            {activeTab === "ea" ? (
                                              <>
                                                <option value="done">Done</option>
                                                <option value="extended">Extend</option>
                                              </>
                                            ) : (
                                              <>
                                                <option value={(activeTab === 'checklist' || activeTab === 'delegation') ? 'yes' : 'Done'}>Done</option>
                                                <option value={(activeTab === 'checklist' || activeTab === 'delegation') ? 'no' : 'Not Done'}>Not Done</option>
                                              </>
                                            )}
                                          </select>
                                        ) : (
                                          <span className={`px-2 inline-flex text-[10px] leading-5 font-semibold rounded-full ${(task.status === "Done" || task.status === "yes" || task.status === "done" || task.status === "approved" || task.status === "Completed")
                                            ? (task.admin_done ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800")
                                            : (task.status?.toLowerCase() === "extended" || task.status?.toLowerCase() === "extend")
                                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                                              : "bg-gray-100 text-gray-800"
                                            }`}>
                                            {(!task.admin_done && task.submission_date) ? "Pending Approval" : (task.status?.toLowerCase() === "extended" || task.status?.toLowerCase() === "extend") ? "Extended" : task.status}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-50">
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Planned Date</p>
                                      <p className="text-sm font-bold text-purple-700">{formatDate(task.planned_date || task.task_start_date || task.created_at)}</p>
                                    </div>
                                    {(task.shop || task.shop_name) && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Shop</p>
                                        <p className="text-sm text-gray-800 uppercase text-[11px] font-bold">{task.shop || task.shop_name}</p>
                                      </div>
                                    )}
                                    {task.task_level && (
                                      <div className="space-y-1">
                                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Level</p>
                                        <p className="text-sm font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md w-fit uppercase text-[11px]">{task.task_level}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Extra fields based on tab */}
                                  {(activeTab === "repair" || task.machine_name) && (
                                    <div className="space-y-1 pt-1 border-t border-gray-50">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Machine / Unit</p>
                                      <p className="text-sm text-gray-800">{task.machine_name || "—"}</p>
                                    </div>
                                  )}

                                  {task.part_name && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Part</p>
                                      <div className="flex flex-col gap-1">
                                        <span className="text-sm text-gray-800">{task.part_name}</span>
                                        <div className="flex gap-3 flex-wrap mt-2">
                                          {task.part_name.split(',').map(p => p.trim()).map((part, idx) => {
                                            const match = customDropdowns?.find(d => d.category === "Part Name" && d.value === part && d.image_url);
                                            return match ? (
                                              <img
                                                key={idx}
                                                src={match.image_url}
                                                alt={part}
                                                className="w-24 h-24 object-cover rounded-lg shadow-md border-2 border-purple-100 bg-gray-50 flex-shrink-0 cursor-zoom-in transition-all active:scale-95"
                                                title={`Click to enlarge: ${part}`}
                                                onClick={() => setLightboxImage({ url: match.image_url, name: part })}
                                              />
                                            ) : null;
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {activeTab === "repair" && task.bill_amount && (
                                    <div className="space-y-1">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold">Amount</p>
                                      <p className="text-sm font-bold text-gray-900">₹{task.bill_amount}</p>
                                    </div>
                                  )}

                                  {/* Actions for Pending Tasks */}
                                  {!showHistory && activeTab !== "repair" && (
                                    <div className="pt-2 space-y-3 border-t border-gray-50">
                                      {activeTab === "ea" && statusData[task.id] === "extended" && (
                                        <div className="space-y-1">
                                          <p className="text-[10px] text-red-500 uppercase font-bold">Extended Date *</p>
                                          <input
                                            type="date"
                                            value={extendedDateData[task.id] || ""}
                                            onChange={(e) => setExtendedDateData((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                            disabled={!selectedItems.has(task.id)}
                                            className="w-full text-xs border-red-200 rounded-md py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-red-400 bg-red-50/30"
                                          />
                                        </div>
                                      )}
                                      <div className="space-y-1">
                                        <p className="text-[10px] text-gray-400 uppercase font-semibold">Remarks</p>
                                        <input
                                          type="text"
                                          placeholder="Enter remarks"
                                          value={remarksData[task.id] || ""}
                                          onChange={(e) => setRemarksData((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                          disabled={!selectedItems.has(task.id)}
                                          className="w-full text-xs border-gray-200 rounded-md py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-purple-400"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-3">
                                        {imagePreviews[task.id] && (
                                          <div className="relative w-full h-32 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50/30 flex items-center justify-center overflow-hidden">
                                            <img src={imagePreviews[task.id]} className="w-full h-full object-contain" alt="Preview" />
                                            <button
                                              onClick={() => {
                                                URL.revokeObjectURL(imagePreviews[task.id]);
                                                setImagePreviews(prev => {
                                                  const next = { ...prev };
                                                  delete next[task.id];
                                                  return next;
                                                });
                                                setUploadedImages(prev => {
                                                  const next = { ...prev };
                                                  delete next[task.id];
                                                  return next;
                                                });
                                              }}
                                              className="absolute top-2 right-2 bg-red-500/80 backdrop-blur-sm text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>
                                        )}
                                        <div className="flex gap-2">
                                          <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all ${selectedItems.has(task.id) ? "border-purple-200 bg-purple-50 text-purple-600 active:scale-95" : "border-gray-100 bg-gray-50 text-gray-400 grayscale"}`}>
                                            <Upload className="h-3.5 w-3.5" />
                                            <span>{uploadedImages[task.id] ? "Change" : "Upload"}</span>
                                            <input type="file" className="hidden" onChange={(e) => handleImageUpload(task.id, e)} disabled={!selectedItems.has(task.id)} />
                                          </label>
                                          <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs font-medium transition-all ${selectedItems.has(task.id) ? "border-cyan-200 bg-cyan-50 text-cyan-500 active:scale-95" : "border-gray-100 bg-gray-50 text-gray-400 grayscale"}`}>
                                            <Camera className="h-3.5 w-3.5" />
                                            <span>{uploadedImages[task.id] ? "Retake" : "Photo"}</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(task.id, e)} disabled={!selectedItems.has(task.id)} />
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Repair Process Button */}
                                  {!showHistory && activeTab === "repair" && (
                                    <div className="pt-2">
                                      <button
                                        onClick={() => openUpdateModal(task)}
                                        disabled={!isModifyAllowed}
                                        className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95"
                                      >
                                        <Edit className="h-3.5 w-3.5" /> PROCESS REPAIR
                                      </button>
                                    </div>
                                  )}

                                  {/* History attachments */}
                                  {showHistory && (task.work_photo_url || task.bill_copy_url || task.image_url || task.uploaded_image_url) && (
                                    <div className="pt-2 border-t border-gray-50">
                                      <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Attachments</p>
                                      <div className="flex flex-wrap gap-3">
                                        {(task.work_photo_url || task.image_url || task.uploaded_image_url) && (
                                          <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-500 font-medium">Work Photo</span>
                                            <img
                                              src={task.work_photo_url || task.image_url || task.uploaded_image_url}
                                              alt="Work"
                                              className="w-24 h-24 object-cover rounded-lg border-2 border-purple-100 shadow-sm cursor-zoom-in"
                                              onClick={() => setLightboxImage({ url: task.work_photo_url || task.image_url || task.uploaded_image_url, name: "Work Photo" })}
                                            />
                                          </div>
                                        )}
                                        {task.bill_copy_url && (
                                          <div className="flex flex-col gap-1">
                                            <span className="text-[10px] text-gray-500 font-medium">Bill Copy</span>
                                            <img
                                              src={task.bill_copy_url}
                                              alt="Bill"
                                              className="w-24 h-24 object-cover rounded-lg border-2 border-blue-100 shadow-sm cursor-zoom-in"
                                              onClick={() => setLightboxImage({ url: task.bill_copy_url, name: "Bill Copy" })}
                                            />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Fragment>
                          )
                        })
                      ) : (
                        <div className="text-center py-16 px-4 bg-white rounded-2xl border border-gray-100 shadow-2xs">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-2.5">
                            <Search size={22} />
                          </div>
                          <p className="text-sm font-bold text-gray-700 mb-1">No {showHistory ? "history records" : "pending tasks"} found</p>
                          <p className="text-xs text-gray-400 max-w-xs mx-auto">
                            {searchTerm 
                              ? `No matches for "${searchTerm}".` 
                              : selectedShop !== 'all' 
                                ? `No ${showHistory ? "history" : "pending tasks"} for ${selectedShop}.` 
                                : "All tasks are up to date."}
                          </p>
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm("")}
                              className="mt-3 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100"
                            >
                              Clear Search
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Mobile Floating Submit Bar */}
                    {!showHistory && isModifyAllowed && selectedItems.size > 0 && (
                      <div className="md:hidden fixed bottom-6 left-4 right-4 z-40 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-purple-100 p-2 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <div className="pl-4">
                              <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-0.5">Ready to Submit</p>
                              <p className="text-xs font-bold text-gray-500">{selectedItems.size} task{selectedItems.size !== 1 ? 's' : ''} selected</p>
                            </div>
                            <button
                              onClick={handleSubmit}
                              disabled={isSubmitting}
                              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-sm font-black rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-95 flex items-center gap-2"
                            >
                              {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting</>
                              ) : (
                                <><CheckCircle2 className="w-4 h-4" /> Submit Now</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Infinite Scroll Sentinel */}
                    {exactTotalAvailable > 0 && (
                      <div ref={loadingRef} className="flex flex-col items-center justify-center py-2 text-gray-500 text-sm w-full">
                        {totalItemsRendered < exactTotalAvailable ? (
                          <div className="flex items-center space-x-3 bg-white px-6 py-3 rounded-full shadow-sm border border-gray-100">
                            <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="font-medium text-gray-600">Loading more tasks...</span>
                          </div>
                        ) : (
                          <span className="bg-gray-50 text-gray-400 px-4 py-2 rounded-full font-medium text-xs">All tasks loaded.</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Repair Update Modal */}
      {isModalOpen && selectedUpdateTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-fade-in border border-purple-100">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100 flex justify-between items-center">
              <h3 className="text-sm font-bold text-purple-800 uppercase">Update Ticket #{selectedUpdateTask.id}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-purple-400 hover:text-purple-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRepairUpdateSubmit} className="p-6">
              <div className="bg-purple-50 rounded border border-purple-200 p-3 mb-6 flex gap-4 text-sm">
                <div className="flex-1">
                  <span className="block text-xs font-bold text-purple-500 uppercase mb-1">Machine</span>
                  <span className="text-gray-800 font-medium">{selectedUpdateTask.machine_name}</span>
                </div>
                <div className="flex-[2]">
                  <span className="block text-xs font-bold text-purple-500 uppercase mb-1">Issue</span>
                  {isAudioUrl(selectedUpdateTask.issue_description) ? (
                    <AudioPlayer url={selectedUpdateTask.issue_description} />
                  ) : (
                    <span className="text-gray-600">{selectedUpdateTask.issue_description}</span>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Status <span className="text-red-500">*</span></label>
                  <select className="w-full p-2 text-sm border border-gray-300 rounded focus:border-purple-500 outline-none" value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}>
                    <option value="">Select Status...</option>
                    <option value="Completed">✅ Completed (कार्य पूर्ण)</option>
                    <option value="Pending">⏳ Pending (लंबित कार्य)</option>
                    <option value="Observation">🔍 Under Observation (निरीक्षण)</option>
                    <option value="Temporary Fix">🔄 Temporary Fix (अस्थायी/जुगाड़)</option>
                    <option value="Cancelled">🚫 Cancelled (रद्द)</option>
                  </select>
                </div>

                {/* Conditional Fields for Completed Status */}
                {updateForm.status === 'Completed' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Part Replaced</label>
                        <select
                          className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500"
                          value={updateForm.partReplaced}
                          onChange={(e) => setUpdateForm({ ...updateForm, partReplaced: e.target.value })}
                        >
                          <option value="">Select part...</option>
                          <option value="Part Replaced">Part Replaced</option>
                          <option value="Repairing">Repairing</option>
                          <option value="Service/Maintenance">Service/Maintenance</option>
                          <option value="Installation">Installation</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Vendor Name</label>
                        <input
                          className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500"
                          value={updateForm.vendorName}
                          onChange={(e) => setUpdateForm({ ...updateForm, vendorName: e.target.value })}
                          placeholder="Enter vendor name..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Bill Amount (₹)</label>
                      <input
                        type="number"
                        className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500"
                        value={updateForm.billAmount}
                        onChange={(e) => setUpdateForm({ ...updateForm, billAmount: e.target.value })}
                        placeholder="Enter bill amount..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
                      <textarea
                        className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500"
                        rows="2"
                        value={updateForm.remarks}
                        onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                        placeholder="Enter any additional remarks..."
                      ></textarea>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <Upload className="h-6 w-6 text-gray-400 mb-2" />
                        <span className="text-xs font-bold text-gray-500">
                          Photo of Work Done
                          {(selectedUpdateTask.require_attachment || selectedUpdateTask.attachment) && <span className="text-red-500 ml-1">*</span>}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">{updateForm.workPhoto ? updateForm.workPhoto.name : "Click to upload"}</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => setUpdateForm({ ...updateForm, workPhoto: e.target.files[0] })} />
                      </label>
                      <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <Upload className="h-6 w-6 text-gray-400 mb-2" />
                        <span className="text-xs font-bold text-gray-500">Bill Copy</span>
                        <span className="text-[10px] text-gray-400 mt-1">{updateForm.billCopy ? updateForm.billCopy.name : "Click to upload"}</span>
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => setUpdateForm({ ...updateForm, billCopy: e.target.files[0] })} />
                      </label>
                    </div>
                  </div>
                )}

                {updateForm.status && updateForm.status !== 'Completed' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Remarks</label>
                    <textarea
                      className="w-full p-2 text-sm border border-gray-300 rounded outline-none focus:border-purple-500"
                      rows="3"
                      value={updateForm.remarks}
                      onChange={(e) => setUpdateForm({ ...updateForm, remarks: e.target.value })}
                      placeholder="Add remarks..."
                    ></textarea>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded hover:bg-gray-50 text-sm">Cancel</button>
                <button type="submit" disabled={!isModifyAllowed || isSubmitting} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded text-sm flex items-center gap-2">{isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-bold text-gray-800 truncate">{lightboxImage.name}</span>
              <button
                onClick={() => setLightboxImage(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gray-900 flex items-center justify-center" style={{ minHeight: '320px' }}>
              <img
                src={lightboxImage.url}
                alt={lightboxImage.name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-400">Click outside or <span className="font-bold text-gray-600">✕</span> to close</p>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AllTasks;