import { Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import LeaveManagement from './pages/LeaveManagement'
import Payroll from './pages/Payroll'
import MisReport from './pages/MisReport'
import AdminAdvance from './pages/AdminAdvance'
import { Recruitment, Reports, Settings } from './pages/StubPages'
import { Toaster } from 'react-hot-toast'
import JoiningCompany from './pages/JoiningCompany'
import Roaster from './pages/Roaster'
import './index.css'

// Mounted under /systems/hr/* by the root router (see src/App.jsx). Auth,
// logout, and navigation are all handled by the unified AuthContext / root
// AppSidebar before this component ever renders.
function HrApp() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <main className="flex-1 overflow-auto min-w-0">
          <Routes>
            <Route path="" element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="joining-shop" element={<JoiningCompany />} />
            <Route path="attendance" element={<Navigate to="daily" replace />} />
            <Route path="attendance/daily" element={<Attendance />} />
            <Route path="attendance/monthly" element={<Attendance />} />
            <Route path="payroll" element={<Payroll />} />
            <Route path="leave" element={<LeaveManagement />} />
            <Route path="recruitment" element={<Recruitment />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="misreport" element={<MisReport />} />
            <Route path="admin-advance" element={<AdminAdvance />} />
            <Route path="roaster" element={<Roaster />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </div>
  )
}

export default HrApp