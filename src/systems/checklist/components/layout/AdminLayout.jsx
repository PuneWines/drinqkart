"use client";
import aceLogo from "../../assets/logo1.png";

import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchNotifications } from "../../redux/slice/notificationSlice";
import supabase from "../../SupabaseClient";
import {
  CheckSquare,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Database,
  ChevronDown,
  ChevronRight,
  Zap,
  Settings,
  CirclePlus,
  UserRound,
  CalendarCheck,
  Calendar as CalendarIcon,
  BookmarkCheck,
  CrossIcon,
  X,
  Bell,
  LayoutGrid,
  BarChart3,
} from "lucide-react";

const parseChecklistAllowedPages = (userData) => {
  if (!userData) return [];
  const pageSet = new Set();

  const mapToRouteLabel = (rawName) => {
    if (!rawName || typeof rawName !== 'string') return;
    const name = rawName.trim();
    if (!name) return;

    const lower = name.toLowerCase();
    if (lower.includes("dashboard")) pageSet.add("Dashboard");
    if (lower.includes("announcement") || lower.includes("notification")) pageSet.add("Announcements");
    if (lower.includes("quick_task") || lower.includes("quick task") || lower.includes("quicktask")) pageSet.add("Quick Task");
    if (lower.includes("assign_task") || lower.includes("assign task") || lower.includes("assigntask")) pageSet.add("Assign Task");
    if (lower.includes("work_records") || lower.includes("work records") || lower.includes("workrecords") || lower.includes("work_details") || lower.includes("work details") || lower.includes("workdetails") || lower.includes("work_tasks") || lower.includes("work tasks") || lower.includes("worktasks")) {
      pageSet.add("Work Records");
      pageSet.add("Work Details");
    }
    if (lower.includes("delegation")) pageSet.add("Delegation");
    if (lower.includes("all_task") || lower.includes("all task") || lower.includes("alltasks") || lower === "task" || lower === "tasks") {
      pageSet.add("Task");
      pageSet.add("All Tasks");
    }
    if (lower.includes("calendar") && !lower.includes("working_day_calendar") && !lower.includes("working day calendar")) pageSet.add("Calendar");
    if (lower.includes("holiday_list") || lower.includes("holiday list") || lower.includes("holidaylist") || lower === "holiday") {
      pageSet.add("Holiday List");
      pageSet.add("Holiday");
      pageSet.add("Working Day Calendar");
    }
    if (lower.includes("working_day_calendar") || lower.includes("working day calendar") || lower.includes("workingdaycalendar")) {
      pageSet.add("Working Day Calendar");
      pageSet.add("Holiday List");
      pageSet.add("Holiday");
    }
    if (lower.includes("admin_approval") || lower.includes("admin approval") || lower.includes("adminapproval") || lower.includes("manager approval")) pageSet.add("Admin Approval");
    if (lower.includes("mis_report") || lower.includes("mis report") || lower.includes("misreport") || lower.includes("mis_reporting")) pageSet.add("MIS Report");
    if (lower.includes("master_setting") || lower.includes("master setting") || lower.includes("setting")) pageSet.add("Settings");
  };

  const processEntry = (entry) => {
    if (typeof entry !== 'string') return;
    const trimmed = entry.trim();
    mapToRouteLabel(trimmed);
    if (trimmed.includes('.')) {
      const parts = trimmed.split('.');
      parts.forEach(part => mapToRouteLabel(part));
    }
  };

  let rawMasterAccess = userData.master_user_system_page_access;
  if (typeof rawMasterAccess === 'string') {
    try {
      let parsed = JSON.parse(rawMasterAccess);
      while (typeof parsed === 'string') parsed = JSON.parse(parsed);
      rawMasterAccess = parsed;
    } catch (e) { }
  }

  if (Array.isArray(rawMasterAccess) && rawMasterAccess.length > 0) {
    rawMasterAccess.forEach(processEntry);
  } else if (rawMasterAccess && typeof rawMasterAccess === 'object' && Object.keys(rawMasterAccess).length > 0) {
    Object.keys(rawMasterAccess).forEach(processEntry);
  }

  if (pageSet.size === 0) {
    let rawPageAccess = userData.page_access;
    if (typeof rawPageAccess === 'string') {
      try {
        let parsed = JSON.parse(rawPageAccess);
        while (typeof parsed === 'string') parsed = JSON.parse(parsed);
        rawPageAccess = parsed;
      } catch (e) { }
    }
    if (Array.isArray(rawPageAccess)) {
      rawPageAccess.forEach(processEntry);
    }
  }

  return Array.from(pageSet);
};

export default function AdminLayout({ children, darkMode, toggleDarkMode, showLayout = true }) {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { list: notifications } = useSelector((state) => state.notifications);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHolidaySubmenuOpen, setIsHolidaySubmenuOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [userRole, setUserRole] = useState(() => localStorage.getItem("role") || "");
  const [userEmail, setUserEmail] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pageAccess, setPageAccess] = useState([]);
  const [profileImage, setProfileImage] = useState("");

  const [isUserPopupOpen, setIsUserPopupOpen] = useState(false);
  const [hasDelegationTasks, setHasDelegationTasks] = useState(true);

  useEffect(() => {
    const checkDelegation = async () => {
      try {
        const { count, error } = await supabase
          .from('delegation')
          .select('*', { count: 'exact', head: true });
        if (!error && count === 0) {
          setHasDelegationTasks(false);
        }
      } catch (e) {
        console.error("Error checking delegation tasks:", e);
      }
    };
    checkDelegation();
  }, []);

  const routes = [
    {
      href: "/dashboard/admin",
      label: "Dashboard",
      icon: Database,
      active: location.pathname === "/dashboard/admin",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/notifications",
      label: "Announcements",
      icon: Bell,
      active: location.pathname === "/dashboard/notifications",
      showFor: ["admin", "user", "hod", "manager"],
      badge: notifications.filter(n => !n.isRead).length || null,
    },
    {
      href: "/dashboard/quick-task",
      label: "Quick Task",
      icon: Zap,
      active: location.pathname === "/dashboard/quick-task",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/assign-task",
      label: "Assign Task",
      icon: CheckSquare,
      active: location.pathname === "/dashboard/assign-task",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/work-details",
      label: "Work Records",
      icon: LayoutGrid,
      active: location.pathname === "/dashboard/work-details",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/delegation",
      label: "Delegation",
      icon: ClipboardList,
      active: location.pathname === "/dashboard/delegation",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/task",
      label: "Task",
      icon: CalendarCheck,
      active: location.pathname === "/dashboard/task",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: CalendarIcon,
      active: location.pathname === "/dashboard/calendar",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      label: "Holiday",
      icon: CalendarIcon,
      showFor: ["admin", "user", "hod", "manager"],
      isSubmenu: true,
      isOpen: isHolidaySubmenuOpen,
      setIsOpen: setIsHolidaySubmenuOpen,
      active: location.pathname.includes("/dashboard/holiday") || location.pathname.includes("/dashboard/working-day"),
      subItems: [
        {
          href: "/dashboard/holiday-list",
          label: "Holiday List",
          active: location.pathname === "/dashboard/holiday-list",
          showFor: ["admin", "user", "hod", "manager"],
        },
        {
          href: "/dashboard/working-day-calendar",
          label: "Working Day Calendar",
          active: location.pathname === "/dashboard/working-day-calendar",
          showFor: ["admin", "user", "hod", "manager"],
        }
      ]
    },
    {
      href: "/dashboard/admin-approval",
      label: "Admin Approval",
      icon: BookmarkCheck,
      active: location.pathname === "/dashboard/admin-approval",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/mis-report",
      label: "MIS Report",
      icon: BarChart3,
      active: location.pathname === "/dashboard/mis-report",
      showFor: ["admin", "user", "hod", "manager"],
    },
    {
      href: "/dashboard/setting",
      label: "Settings",
      icon: Settings,
      active: location.pathname.includes("/dashboard/setting"),
      showFor: ["admin", "user", "hod", "manager"],
    },
  ];

  useEffect(() => {
    const storedUsername = localStorage.getItem("user-name");
    const storedRole = localStorage.getItem("role");
    const storedEmail = localStorage.getItem("email_id");

    if (!storedUsername) {
      navigate("/login");
      return;
    }

    setUsername(storedUsername);
    setUserRole(storedRole || "user");
    setUserEmail(storedEmail);

    const path = location.pathname;

    const storedRoleLower = (storedRole || "user").toLowerCase();
    const pageAccessRaw = localStorage.getItem("page_access");
    let pageAccess = [];
    try {
      pageAccess = JSON.parse(pageAccessRaw) || [];
    } catch (e) {
      pageAccess = [];
    }

    if (pageAccess.length > 0) {
      const isPathAllowed = (path) => {
        if (path === "/dashboard/admin" || path === "/dashboard/notifications") return true;

        const matchedRoute = routes.find(r => r.href === path || (r.subItems && r.subItems.some(s => s.href === path)));
        if (!matchedRoute) return true;

        if (matchedRoute.isSubmenu) {
          const matchedSub = matchedRoute.subItems.find(s => s.href === path);
          return matchedSub ? pageAccess.some(p => p.toLowerCase() === matchedSub.label.toLowerCase()) : false;
        }

        const labelLower = matchedRoute.label.toLowerCase();
        return pageAccess.some(p => {
          const pLower = p.toLowerCase();
          if (pLower === labelLower) return true;
          if ((labelLower === "work records" || labelLower === "work details") && (pLower === "work records" || pLower === "work details")) return true;
          if ((labelLower === "all tasks" || labelLower === "task") && (pLower === "all tasks" || pLower === "task")) return true;
          return false;
        });
      };

      if (!isPathAllowed(path)) {
        console.warn(`🚫 Access denied to ${path}. Redirecting to dashboard.`);
        navigate("/dashboard/admin");
        return;
      }
    }

    const cachedImage = localStorage.getItem("profile_image");
    setProfileImage(cachedImage || "");

    // Fetch reporting users for HOD role check
    let reportingUsers = [storedUsername?.toLowerCase()];
    const currentUserRole = (localStorage.getItem("role") || "").toLowerCase();
    if (currentUserRole === "hod") {
      const fetchReportingUsers = async () => {
        const { data: reports } = await supabase
          .from("users")
          .select("user_name")
          .eq("reported_by", storedUsername);
        if (reports) {
          reportingUsers = [storedUsername.toLowerCase(), ...reports.map(r => (r.user_name || "").toLowerCase())];
        }
      };
      fetchReportingUsers();
    }

    // Sync with database to get the latest image and permissions
    const syncUserData = async () => {
      if (!storedUsername) return;
      try {
        const { data } = await supabase
          .from("users")
          .select("profile_image, page_access, master_user_system_page_access")
          .ilike("user_name", storedUsername)
          .limit(1)
          .maybeSingle();

        if (data) {
          if (data.profile_image) {
            setProfileImage(data.profile_image);
            localStorage.setItem("profile_image", data.profile_image);
          }
          const allowedPages = parseChecklistAllowedPages(data);
          localStorage.setItem("page_access", JSON.stringify(allowedPages));
          if (data.master_user_system_page_access) {
            localStorage.setItem("master_user_system_page_access", typeof data.master_user_system_page_access === 'string' ? data.master_user_system_page_access : JSON.stringify(data.master_user_system_page_access));
          }
          setPageAccess(allowedPages);
        }
      } catch (err) {
        console.error("❌ Error syncing user data:", err);
      }
    };

    // Initial sync from localStorage to avoid flash of no content
    const initPageAccess = () => {
      const stored = localStorage.getItem("page_access");
      const storedMaster = localStorage.getItem("master_user_system_page_access");
      const allowedPages = parseChecklistAllowedPages({ page_access: stored, master_user_system_page_access: storedMaster });
      setPageAccess(allowedPages);
    };
    initPageAccess();

    if (storedUsername) {
      syncUserData();
    }

    // Check if this is the super admin (username = 'admin')
    const normalizedUsername = (storedUsername || "").toLowerCase();
    setIsSuperAdmin(normalizedUsername === "admin");
  }, [navigate, location.pathname, hasDelegationTasks]);

  // Fetch notifications globally for badge count
  useEffect(() => {
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("user-id");
    if (role) {
      dispatch(fetchNotifications({ role: role.toLowerCase(), userId }));
    }
  }, [dispatch, location.pathname]);

  // Set initial submenu state based on current location
  useEffect(() => {
    if (location.pathname.includes("/dashboard/holiday") || location.pathname.includes("/dashboard/working-day")) {
      setIsHolidaySubmenuOpen(true);
    }
  }, [location.pathname]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("user-name");
    localStorage.removeItem("role");
    localStorage.removeItem("email_id");
    localStorage.removeItem("token");
    localStorage.removeItem("profile_image");

    const masterUrl = import.meta.env.VITE_MASTER_PORTAL_URL ||
      (window.location.origin.includes('localhost') ? 'http://localhost:5173' : window.location.origin);
    if (window.parent && window.parent !== window) {
      try {
        window.parent.location.href = `${masterUrl}/login?logout=true`;
      } catch (e) {
        window.location.href = "/login";
      }
    } else {
      window.location.href = "/login";
    }
  };

  // No data categories needed as Task is now a main route


  const getAccessibleShops = () => {
    return [];
  };

  const getRouteDisplayLabel = (route) => {
    if (route.href === "/dashboard/admin-approval" && userRole.toLowerCase() === "manager") {
      return "Manager Approval";
    }
    return route.label;
  };

  // Filter routes strictly based on pageAccess for all users
  const getAccessibleRoutes = () => {
    const userRole = localStorage.getItem("role") || "user";
    const userRoleNormalized = (userRole || "user").toLowerCase();

    return routes
      .filter((route) => {
        if (pageAccess && pageAccess.length > 0) {
          if (route.label === "Settings") {
            return pageAccess.includes("Settings");
          }
          if (route.label === "Holiday") {
            return route.subItems && route.subItems.some(sub => pageAccess.includes(sub.label));
          }
          return pageAccess.includes(route.label);
        }

        // If pageAccess is empty, default to showing only basic pages (Dashboard, Announcements)
        return route.label === "Dashboard" || route.label === "Announcements";
      })
      .map(route => {
        if (route.subItems) {
          return {
            ...route,
            subItems: route.subItems.filter(sub => {
              if (pageAccess && pageAccess.length > 0) {
                return pageAccess.includes(sub.label);
              }
              return sub.showFor.some(role => role.toLowerCase() === userRoleNormalized);
            })
          };
        }
        return route;
      })
      .filter(route => !route.isSubmenu || (route.subItems && route.subItems.length > 0));
  };

  // Submenu logic removed

  // Get accessible routes
  const accessibleRoutes = getAccessibleRoutes();

  const isEmbedded = window.parent !== window;

  if (!showLayout || isEmbedded) {
    return (
      <div className="flex-1 h-screen overflow-y-auto p-4 md:p-6 bg-gradient-to-br from-blue-50 to-purple-50">
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex h-screen overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50`}
    >
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">


        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 md:px-6 md:pb-6 bg-gradient-to-br from-blue-50/50 to-purple-50/50 pb-24 md:pb-6">
          {children}
        </main>



        {/* Premium Bottom Navigation for Mobile */}
        <div className="md:hidden fixed bottom-6 left-4 right-4 h-16 bg-white/80 backdrop-blur-xl border border-white/20 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] z-50 flex items-center justify-around px-2">
          <Link
            to="/dashboard/admin"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/admin"
              ? "text-purple-600 bg-purple-50"
              : "text-gray-400 hover:text-purple-400"
              }`}
          >
            <Home size={22} strokeWidth={location.pathname === "/dashboard/admin" ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-bold">Home</span>
          </Link>



          <Link
            to="/dashboard/task"
            className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/task"
              ? "text-purple-600 bg-purple-50"
              : "text-gray-400 hover:text-purple-400"
              }`}
          >
            <CalendarCheck size={22} strokeWidth={location.pathname === "/dashboard/task" ? 2.5 : 2} />
            <span className="text-[10px] mt-1 font-bold">Tasks</span>
          </Link>

          {(userRole?.toUpperCase() === "ADMIN" || userRole?.toUpperCase() === "HOD") && (
            <div className="relative -mt-12">
              <Link
                to="/dashboard/assign-task"
                className="flex items-center justify-center w-14 h-14 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl shadow-lg shadow-purple-200 text-white transform active:scale-90 transition-all duration-300 border-4 border-blue-50"
              >
                <CirclePlus size={28} strokeWidth={2.5} />
              </Link>
            </div>
          )}

          {!(userRole?.toLowerCase() === "user" && !hasDelegationTasks) && (
            <Link
              to="/dashboard/delegation"
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all duration-300 ${location.pathname === "/dashboard/delegation"
                ? "text-purple-600 bg-purple-50"
                : "text-gray-400 hover:text-purple-400"
                }`}
            >
              <BookmarkCheck size={22} strokeWidth={location.pathname === "/dashboard/delegation" ? 2.5 : 2} />
              <span className="text-[10px] mt-1 font-bold">Status</span>
            </Link>
          )}

          <button
            onClick={() => setIsUserPopupOpen(true)}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-gray-400 hover:text-purple-400 transition-all"
          >
            <UserRound size={22} strokeWidth={2} />
            <span className="text-[10px] mt-1 font-bold">Profile</span>
          </button>
        </div>

        {/* User Popup */}
        {isUserPopupOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-[340px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/50">
              {/* Header Gradient */}
              <div className="h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[2px]"></div>
                <button
                  onClick={() => setIsUserPopupOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white transition-all hover:rotate-90 z-10"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Profile Info */}
              <div className="px-8 pb-8 text-center bg-white">
                <div className="relative -mt-16 mb-6 flex justify-center">
                  <div className="h-28 w-28 rounded-full bg-white p-1.5 shadow-2xl ring-4 ring-white/30">
                    <div className="h-full w-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center overflow-hidden border-2 border-white shadow-inner">
                      {profileImage ? (
                        <img src={profileImage} alt={username} className="h-full w-full object-cover transform hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <span className="text-4xl font-black text-white uppercase tracking-tighter">
                          {username ? username.charAt(0) : "U"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-1">
                      {username || "User"}
                    </h3>
                    <div className="flex justify-center flex-wrap gap-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] px-3 py-1 bg-indigo-50 rounded-full border border-indigo-100/50">
                        {userRole?.toLowerCase() === "admin" ? (isSuperAdmin ? "Super Admin" : "Administrator") : userRole?.toLowerCase() === "hod" ? "HOD / Supervisor" : "Staff"}
                      </span>
                    </div>
                  </div>

                  <div className="py-3 px-4 bg-gray-50 rounded-2xl flex items-center justify-center gap-2 border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-gray-500 truncate">{userEmail || "user@example.com"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setIsUserPopupOpen(false)}
                    className="flex justify-center items-center py-3.5 px-4 rounded-2xl text-xs font-black text-gray-400 border-2 border-gray-50 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex justify-center items-center gap-2 py-3.5 px-4 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-[0_10px_20px_-5px_rgba(79,70,229,0.4)] hover:shadow-indigo-200 transition-all active:scale-95 uppercase tracking-widest"
                  >
                    Logout <LogOut size={14} strokeWidth={3} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
