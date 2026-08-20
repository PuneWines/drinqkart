import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerFeedback from './pages/CustomerFeedback';
import AssignedComplaints from './pages/AssignedComplaints';
import ComplaintResolution from './pages/ComplaintResolution';
import TraderInvoices from './pages/TraderInvoices';
import HelpCenterRecords from './pages/HelpCenterRecords';
import { Toaster } from 'react-hot-toast';

function BusinessOverviewApp() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <main className="flex-1 overflow-auto min-w-0">
          <Routes>
            <Route path="" element={<Navigate to="feedback/customer" replace />} />
            <Route path="feedback" element={<Navigate to="feedback/customer" replace />} />
            <Route path="feedback/customer" element={<CustomerFeedback />} />
            <Route path="feedback/assigned" element={<AssignedComplaints />} />
            <Route path="feedback/resolution" element={<ComplaintResolution />} />
            <Route path="trader-invoices" element={<TraderInvoices />} />
            <Route path="help-center" element={<HelpCenterRecords />} />
            <Route path="*" element={<Navigate to="feedback/customer" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </div>
  );
}

export default BusinessOverviewApp;
