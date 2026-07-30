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
const ProtectedRoute = ({ children }) => {
    const username = (localStorage.getItem("user-name") || "").toLowerCase();

    if (!username) {
        return <Navigate to="/login" replace />
    }

    return children
}

const SuperAdminRoute = ({ children }) => {
    const pageAccessRaw = localStorage.getItem("page_access");
    let pageAccess = [];
    try {
        pageAccess = JSON.parse(pageAccessRaw) || [];
    } catch (e) {
        pageAccess = [];
    }

    const path = window.location.pathname;
    if (path.includes("setting") && pageAccess.includes("Settings")) {
        return children;
    }
    if (path.includes("holiday-list") && (pageAccess.includes("Holiday List") || pageAccess.includes("Holiday"))) {
        return children;
    }
    if (path.includes("working-day-calendar") && (pageAccess.includes("Working Day Calendar") || pageAccess.includes("Holiday"))) {
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

                {/* --- Task Management --- */}
                <Route
                    path="assign-task"
                    element={
                        <ProtectedRoute>
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

                {/* --- Data & Reporting --- */}
                <Route
                    path="data"
                    element={
                        <ProtectedRoute>
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
                        <ProtectedRoute>
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
                        <ProtectedRoute>
                            <AdminDelegationTask />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="admin-approval"
                    element={
                        <ProtectedRoute>
                            <AdminApprovalPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="mis-report"
                    element={
                        <ProtectedRoute>
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
                        <ProtectedRoute>
                            <BulkImport />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="work-details"
                    element={
                        <ProtectedRoute>
                            <WorkDetails />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="work-details/scheduled"
                    element={
                        <ProtectedRoute>
                            <ScheduledWorkTasks />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="work-records/bulk-import"
                    element={
                        <ProtectedRoute>
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
