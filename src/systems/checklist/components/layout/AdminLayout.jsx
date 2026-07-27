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

  const [hasDelegationTasks, setHasDelegationTasks] = useState(() => {
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const storedUsername = localStorage.getItem("user-name") || "";
    if (role !== "user") return true;
    try {
      const cached = sessionStorage.getItem(`user_has_delegation_tasks_${storedUsername}`);
      if (cached !== null) {
        return cached === "true";
      }
    } catch (e) { }
    return true;
  });

  useEffect(() => {
    const storedUsername = localStorage.getItem("user-name");
    const storedRole = localStorage.getItem("role");
    if (!storedUsername || (storedRole || "").toLowerCase() !== "user") return;

    // Skip query if cache is present
    try {
      const cached = sessionStorage.getItem(`user_has_delegation_tasks_${storedUsername}`);
      if (cached !== null) return;
    } catch (e) { }

    const checkDelegation = async () => {
      try {
        const { data, error } = await supabase
          .from('delegation')
          .select('task_id')
          .eq('name', storedUsername)
          .limit(1);

        if (!error) {
          const hasTasks = data && data.length > 0;
          setHasDelegationTasks(hasTasks);
          try {
            sessionStorage.setItem(`user_has_delegation_tasks_${storedUsername}`, String(hasTasks));
          } catch (e) { }
        }
      } catch (err) {
        console.error("Error checking delegation tasks:", err);
      }
    };
    checkDelegation();
  }, []);

  // Update the routes array based on user role and super admin status
  const routes = [
    {
      href: "/dashboard/admin",
      label: "Dashboard",
      icon: Database,
      active: location.pathname === "/dashboard/admin",
      showFor: ["admin", "user", "HOD", "manager"],
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
      // Show for super admin OR anyone with 'admin' role
      showFor: (isSuperAdmin || userRole.toLowerCase() === "admin") ? ["admin"] : [],
    },
    {
      href: "/dashboard/assign-task",
      label: "Assign Task",
      icon: CheckSquare,
      active: location.pathname === "/dashboard/assign-task",
      showFor: ["admin", "HOD", "manager"],
    },
    {
      href: "/dashboard/work-details",
      label: "Work Records",
      icon: LayoutGrid,
      active: location.pathname === "/dashboard/work-details",
      showFor: ["admin", "HOD", "manager"],
    },
    {
      href: "/dashboard/delegation",
      label: "Delegation",
      icon: ClipboardList,
      active: location.pathname === "/dashboard/delegation",
      showFor: ["admin", "user", "HOD", "manager"],
    },
    {
      href: "/dashboard/task",
      label: "Task",
      icon: CalendarCheck,
      active: location.pathname === "/dashboard/task",
      showFor: ["admin", "HOD", "user", "manager"],
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: CalendarIcon,
      active: location.pathname === "/dashboard/calendar",
      showFor: ["admin", "user", "HOD", "manager"],
    },
    {
      label: "Holiday",
      icon: CalendarIcon, // Or a specific holiday icon
      showFor: (isSuperAdmin || userRole.toLowerCase() === "admin") ? ["admin"] : [],
      isSubmenu: true,
      isOpen: isHolidaySubmenuOpen,
      setIsOpen: setIsHolidaySubmenuOpen,
      active: location.pathname.includes("/dashboard/holiday") || location.pathname.includes("/dashboard/working-day"),
      subItems: [
        {
          href: "/dashboard/holiday-list",
          label: "Holiday List",
          active: location.pathname === "/dashboard/holiday-list",
          showFor: ["admin"],
        },
        {
          href: "/dashboard/working-day-calendar",
          label: "Working Day Calendar",
          active: location.pathname === "/dashboard/working-day-calendar",
          showFor: ["admin"],
        }
      ]
    },
    {
      href: "/dashboard/admin-approval",
      label: "Admin Approval",
      icon: BookmarkCheck,
      active: location.pathname === "/dashboard/admin-approval",
      showFor: ["admin", "HOD", "manager"],
    },
    {
      href: "/dashboard/mis-report",
      label: "MIS Report",
      icon: BarChart3,
      active: location.pathname === "/dashboard/mis-report",
      showFor: ["admin"],
    },
    {
      href: "/dashboard/setting",
      label: "Settings",
      icon: Settings,
      active: location.pathname.includes("/dashboard/setting"),
      showFor: ["admin"],
    },
  ];

  // Check authentication on component mount
  useEffect(() => {
    const storedUsername = localStorage.getItem("user-name");
    const storedRole = localStorage.getItem("role");
    const storedEmail = localStorage.getItem("email_id");

    if (!storedUsername) {
      // Redirect to login if not authenticated
      navigate("/login");
      return;
    }

    setUsername(storedUsername);
    setUserRole(storedRole || "user");
    setUserEmail(storedEmail);
    setIsSuperAdmin(storedUsername.toLowerCase() === "admin");

    const path = location.pathname;
    const restrictedPages = [
      "/dashboard/assign-task",
      "/dashboard/admin-approval",
      "/dashboard/checklist",
      "/dashboard/maintenance",
      "/dashboard/repair",
      "/dashboard/ea-task",
      "/dashboard/quick-task",
      "/dashboard/holiday-list",
      "/dashboard/working-day-calendar",
      "/dashboard/setting"
    ];
    if (!hasDelegationTasks) {
      restrictedPages.push("/dashboard/delegation");
      restrictedPages.push("/dashboard/delegation-data");
    }

    const storedRoleLower = (storedRole || "user").toLowerCase();
    const isSuperAdminUser = storedUsername?.toLowerCase() === "admin" || storedRoleLower === "admin";
    const pageAccessRaw = localStorage.getItem("page_access");
    let pageAccess = [];
    try {
      pageAccess = JSON.parse(pageAccessRaw) || [];
    } catch (e) {
      pageAccess = [];
    }

    // Dynamic Security Guard using page_access
    if (!isSuperAdminUser && pageAccess.length > 0) {
      // Find if current path is allowed
      const isPathAllowed = (path) => {
        // Dashboard and Notifications are generally allowed unless explicitly removed
        if (path === "/dashboard/admin" || path === "/dashboard/notifications") return true;

        // Check main routes
        const matchedRoute = routes.find(r => r.href === path || (r.subItems && r.subItems.some(s => s.href === path)));
        if (!matchedRoute) return true; // If route not in our list, allow (could be public or new)

        if (matchedRoute.isSubmenu) {
          const matchedSub = matchedRoute.subItems.find(s => s.href === path);
          return matchedSub ? pageAccess.includes(matchedSub.label) : false;
        }

        return pageAccess.includes(matchedRoute.label);
      };

      if (!isPathAllowed(path)) {
        console.warn(`🚫 Access denied to ${path}. Redirecting to dashboard.`);
        navigate("/dashboard/admin");
        return;
      }
    } else if (storedRoleLower === "user") {
      // Fallback to hardcoded for legacy or if pageAccess is empty
      const restrictedPages = ["/dashboard/assign-task", "/dashboard/admin-approval", "/dashboard/checklist", "/dashboard/maintenance", "/dashboard/repair", "/dashboard/ea-task", "/dashboard/quick-task", "/dashboard/holiday-list", "/dashboard/working-day-calendar", "/dashboard/setting"];
      if (!hasDelegationTasks) {
        restrictedPages.push("/dashboard/delegation");
        restrictedPages.push("/dashboard/delegation-data");
      }
      if (restrictedPages.some(p => path.startsWith(p))) {
        navigate("/dashboard/admin");
        return;
      }
    }

    // Initial load from localStorage
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
      try {
        const { data } = await supabase
          .from("users")
          .select("profile_image, page_access")
          .eq("user_name", storedUsername)
          .single();

        if (data) {
          if (data.profile_image) {
            setProfileImage(data.profile_image);
            localStorage.setItem("profile_image", data.profile_image);
          }
          if (data.page_access) {
            let finalAccess = data.page_access;
            if (typeof finalAccess === 'string') {
              try {
                finalAccess = JSON.parse(finalAccess);
              } catch (e) {
                console.error("Error parsing page_access string:", e);
                finalAccess = [];
              }
            }
            localStorage.setItem("page_access", JSON.stringify(Array.isArray(finalAccess) ? finalAccess : []));
            setPageAccess(Array.isArray(finalAccess) ? finalAccess : []);
          }
          // console.log("✅ User data synced from DB");
        }
      } catch (err) {
        console.error("❌ Error syncing user data:", err);
      }
    };

    // Initial sync from localStorage to avoid flash of no content
    const initPageAccess = () => {
      const stored = localStorage.getItem("page_access");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setPageAccess(Array.isArray(parsed) ? parsed : (typeof parsed === 'string' ? JSON.parse(parsed) : []));
        } catch (e) {
          setPageAccess([]);
        }
      }
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

  // Filter routes based on user role and super admin status
  const getAccessibleRoutes = () => {
    const userRole = localStorage.getItem("role") || "user";
    const username = localStorage.getItem("user-name");
    const userRoleNormalized = (userRole || "user").toLowerCase();
    const usernameNormalized = (username || "").toLowerCase();
    // Admin role users bypass page_access filter (same as superAdmin)
    const isAdminOrSuperAdmin = isSuperAdmin || userRoleNormalized === "admin";

    return routes
      .filter((route) => {
        // If it's the Setting page, show if user is super admin, has admin role, or has explicit "Settings" page access permission
        if (route.label === "Settings") {
          return usernameNormalized === "admin" ||
            userRoleNormalized === "admin" ||
            pageAccess.includes("Settings");
        }

        // Holiday submenu logic handled by showFor in routes
        if (route.label === "Holiday") {
          // Show Holiday submenu if user has access to any of its subItems
          if (isAdminOrSuperAdmin) return true;
          return route.subItems.some(sub => pageAccess.includes(sub.label));
        }

        // Hardcoded role check first
        const hasRoleAccess = route.showFor.some(role => role.toLowerCase() === userRoleNormalized);

        // Hide delegation for users who do not have any tasks in the delegation table
        if (route.href === "/dashboard/delegation" && userRoleNormalized === "user" && !hasDelegationTasks) {
          return false;
        }

        // Admin role users always follow showFor — never filtered by pageAccess
        if (isAdminOrSuperAdmin) {
          return hasRoleAccess;
        }

        // For non-admin users: if dynamic page access is set, use it as the filter
        if (pageAccess.length > 0) {
          return pageAccess.includes(route.label);
        }

        return hasRoleAccess;
      })
      .map(route => {
        if (route.subItems) {
          return {
            ...route,
            subItems: route.subItems.filter(sub => {
              if (!isAdminOrSuperAdmin && pageAccess.length > 0) {
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
        <header className="flex h-16 items-center justify-between border-b border-purple-100 bg-white px-4 md:px-6 shadow-sm z-30">
          <div className="flex md:hidden w-8"></div>
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
              TaskDesk
            </h1>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.2em] -mt-1 hidden xs:block">
              TaskDesk
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Welcome</span>
              <span className="text-sm font-black text-purple-700 -mt-1">Hello, {username || 'User'}</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-lg border-2 border-white ring-2 ring-purple-100/50 overflow-hidden">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={username}
                  className="h-full w-full object-cover"
                  onError={() => {
                    console.error("❌ AdminLayout Image Failed to Load:", profileImage);
                    setProfileImage(""); // Fallback to initials
                  }}
                />
              ) : (
                <span className="text-white text-sm font-black uppercase">{username ? username.charAt(0) : 'U'}</span>
              )}
            </div>
          </div>
        </header>

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
