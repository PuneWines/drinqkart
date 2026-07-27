import { Routes, Route, Navigate } from "react-router-dom"
import "./index.css"

// --- Page Imports ---
import AdminDashboard from "./pages/admin/Dashboard"
import AdminAssignTask from "./pages/admin/AssignTask"
import ChecklistTask from "./pages/admin/ChecklistTask"     // New
import MaintenanceTask from "./pages/admin/MaintenanceTask" // New
import RepairTask from "./pages/admin/RepairTask"           // New
import EATask from "./pages/admin/EATask"                   // New
import CalendarPage from "./pages/admin/CalendarPage"       // New
import QuickTask from "./pages/QuickTask"
import Demo from "./pages/user/Demo"
import Setting from "./pages/Setting"
import MisReport from "./pages/MisReport"
import BulkImport from "./pages/BulkImport"
import WorkDetails from "./pages/WorkDetails"
import ScheduledWorkTasks from "./pages/ScheduledWorkTasks"
import MasterWorkBulkImport from "./pages/MasterWorkBulkImport"

// --- Data & Delegation Imports ---
import DataPage from "./pages/admin/DataPage"
import AdminDataPage from "./pages/admin/admin-data-page"
import AccountDataPage from "./pages/delegation"
import AdminDelegationTask from "./pages/delegation-data"
import AllTasks from "./pages/admin/AllTasks"
import HolidayListPage from "./pages/admin/HolidayListPage"         // New
import WorkingDayCalendarPage from "./pages/admin/WorkingDayCalendarPage" // New
import AdminApprovalPage from "./pages/admin/AdminApprovalPage" // New
import NotificationsPage from "./pages/admin/Notifications"

// --- Components ---
import RealtimeLogoutListener from "./components/RealtimeLogoutListener"
import { MagicToastProvider } from "./context/MagicToastContext"

// --- Auth Wrapper ---
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();

    if (!username) {
        return <Navigate to="/login" replace />
    }

    if (allowedRoles.length > 0 && !allowedRoles.map(r => r.toLowerCase()).includes(role)) {
        return <Navigate to="/dashboard/admin" replace />
    }

    return children
}

const SuperAdminRoute = ({ children }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();
    const role = (localStorage.getItem("role") || "").toLowerCase();
    const pageAccessRaw = localStorage.getItem("page_access");
    let pageAccess = [];
    try {
        pageAccess = JSON.parse(pageAccessRaw) || [];
    } catch (e) {
        pageAccess = [];
    }

    const isSuperAdmin = username === "admin";
    const isAdminRole = role === "admin";

    if (isSuperAdmin || isAdminRole) {
        return children;
    }

    const path = window.location.pathname;
    if (path === "/dashboard/setting" && pageAccess.includes("Settings")) {
        return children;
    }
    if (path === "/dashboard/holiday-list" && pageAccess.includes("Holiday List")) {
        return children;
    }

    return <Navigate to="/dashboard/admin" replace />
}

// Mounted at /dashboard/* by the root router (see src/App.jsx) - Checklist is
// the source-of-truth system, so it keeps its native /dashboard/* URLs
// unprefixed. All Route paths below are relative to that /dashboard mount point.
function ChecklistDashboard() {
    return (
        <MagicToastProvider>
            {/* Realtime listener handles logout logic across tabs */}
            <RealtimeLogoutListener />

            <Routes>
                {/* --- Main Dashboard Redirect --- */}
                <Route index element={<Navigate to="admin" replace />} />

                {/* --- Core Dashboard Routes --- */}
                <Route
                    path="admin"
                    element={
                        <ProtectedRoute>
                            <AdminDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="demo"
                    element={
                        <ProtectedRoute>
                            <Demo />
                        </ProtectedRoute>
                    }
                />

                {/* --- Task Management (Admin Only) --- */}
                <Route
                    path="assign-task"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                            <AdminAssignTask />
                        </ProtectedRoute>
                    }
                />

                {/* --- Operational Tasks (All Authenticated Users) --- */}
                <Route
                    path="quick-task"
                    element={
                        <ProtectedRoute>
                            <QuickTask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="checklist"
                    element={
                        <ProtectedRoute>
                            <ChecklistTask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="maintenance"
                    element={
                        <ProtectedRoute>
                            <MaintenanceTask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="repair"
                    element={
                        <ProtectedRoute>
                            <RepairTask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="ea-task"
                    element={
                        <ProtectedRoute>
                            <EATask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="calendar"
                    element={
                        <ProtectedRoute>
                            <CalendarPage />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="task"
                    element={
                        <ProtectedRoute>
                            <AllTasks />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="holiday-list"
                    element={
                        <SuperAdminRoute>
                            <HolidayListPage />
                        </SuperAdminRoute>
                    }
                />

                <Route
                    path="working-day-calendar"
                    element={
                        <ProtectedRoute>
                            <WorkingDayCalendarPage />
                        </ProtectedRoute>
                    }
                />

                {/* --- Data & Reporting (Admin Only) --- */}
                <Route
                    path="data"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                            <DataPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="data/:category"
                    element={
                        <ProtectedRoute>
                            <DataPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="admin-data"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                            <AdminDataPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="delegation"
                    element={
                        <ProtectedRoute>
                            <AccountDataPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="delegation-data"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD"]}>
                            <AdminDelegationTask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="admin-approval"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD", "manager"]}>
                            <AdminApprovalPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="mis-report"
                    element={
                        <ProtectedRoute allowedRoles={["admin"]}>
                            <MisReport />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="notifications"
                    element={
                        <ProtectedRoute>
                            <NotificationsPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="bulk-import"
                    element={
                        <ProtectedRoute allowedRoles={["admin"]}>
                            <BulkImport />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="work-details"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD", "manager"]}>
                            <WorkDetails />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="work-details/scheduled"
                    element={
                        <ProtectedRoute allowedRoles={["admin", "HOD", "manager"]}>
                            <ScheduledWorkTasks />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="work-records/bulk-import"
                    element={
                        <ProtectedRoute allowedRoles={["admin"]}>
                            <MasterWorkBulkImport />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="setting"
                    element={
                        <SuperAdminRoute>
                            <Setting />
                        </SuperAdminRoute>
                    }
                />
            </Routes>
        </MagicToastProvider>
    )
}

export default ChecklistDashboard
