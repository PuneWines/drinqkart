import { Routes, Route, Navigate } from 'react-router-dom';
import CustomerFeedback from './pages/CustomerFeedback';
import AssignedComplaints from './pages/AssignedComplaints';
import ComplaintResolution from './pages/ComplaintResolution';
import TraderInvoices from './pages/TraderInvoices';
import HelpCenterRecords from './pages/HelpCenterRecords';
import ShopVisit from './pages/ShopVisit';
import StockBalance from './pages/StockBalance';
import StockBalanceDashboard from './pages/StockBalanceDashboard';
import GiftStockDashboard from './pages/GiftStockDashboard';
import { Toaster } from 'react-hot-toast';

function BusinessOverviewApp({ onCollapseSidebar }) {
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
            <Route path="shop-visit" element={<ShopVisit />} />
            <Route path="sales-analytics" element={<Navigate to="/systems/sales-analytics" replace />} />
            <Route path="stock-report" element={<Navigate to="/systems/stock-report" replace />} />
            <Route path="stock-balance" element={<Navigate to="/systems/sales-analytics" replace />} />
            <Route path="stock-balance/dashboard" element={<Navigate to="/systems/sales-analytics" replace />} />
            <Route path="stock-balance/sheet" element={<Navigate to="/systems/stock-report" replace />} />
            <Route path="help-center" element={<Navigate to="help-center/all" replace />} />
            <Route path="help-center/all" element={<HelpCenterRecords activeTab="all" />} />
            <Route path="help-center/follow-up" element={<HelpCenterRecords activeTab="follow-up" />} />
            <Route path="help-center/completed" element={<HelpCenterRecords activeTab="completed" />} />
            <Route path="gift-stock" element={<Navigate to="gift-stock/dashboard" replace />} />
            <Route path="gift-stock/dashboard" element={<GiftStockDashboard defaultTab="dashboard" />} />
            <Route path="gift-stock/stock-in" element={<GiftStockDashboard defaultTab="stock-in" />} />
            <Route path="gift-stock/stock-out" element={<GiftStockDashboard defaultTab="stock-out" />} />
            <Route path="gift-stock/current-stock" element={<GiftStockDashboard defaultTab="current-stock" />} />
            <Route path="gift-stock/item-master" element={<GiftStockDashboard defaultTab="item-master" />} />
            <Route path="gift-stock/trader-master" element={<GiftStockDashboard defaultTab="trader-master" />} />
            <Route path="gift-stock/:tab" element={<GiftStockDashboard />} />
            <Route path="*" element={<Navigate to="feedback/customer" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
    </div>
  );
}

export default BusinessOverviewApp;
