import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast, { useToast } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Indent from './pages/Indent';
import Approval from './pages/Approval';
import PurchaseOrder from './pages/PurchaseOrder';
import POHistory from './pages/POHistory';
import TraderVerification from './pages/TraderVerification';
import TransporterVerification from './pages/TransporterVerification';
import Receiving from './pages/Receiving';
import OrdersPipeline from './pages/OrdersPipeline';
import Settings from './pages/Settings';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attempt) => Math.min(attempt * 1000, 3000),
      staleTime: 1000 * 60 * 5, // 5 minutes fresh time
      refetchOnWindowFocus: false, // avoid redundant fetches when switching tabs
    },
  },
});

// Mounted under /systems/purchase/* by the root router (see src/App.jsx). Auth,
// logout, and navigation are all handled by the unified AuthContext / root
// AppSidebar before this component ever renders. The public vendor/transporter/
// receiver confirmation and portal pages are mounted separately at the app root
// (not here) since they're accessed by external parties without logging in.
function PurchaseApp() {
  const { toasts, removeToast } = useToast();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <main>
          <Routes>
            <Route path="" element={<Dashboard />} />
            <Route path="indent" element={<Indent />} />
            <Route path="approval" element={<Approval />} />
            <Route path="po" element={<PurchaseOrder />} />
            <Route path="po-history" element={<POHistory />} />
            <Route path="trader-verification" element={<TraderVerification />} />
            <Route path="transporter-verification" element={<TransporterVerification />} />
            <Route path="receiving" element={<Receiving />} />
            <Route path="orders-pipeline" element={<OrdersPipeline />} />
            <Route path="settings" element={<Settings />} />
          </Routes>
        </main>
        <Toast toasts={toasts} removeToast={removeToast} />
      </div>
    </QueryClientProvider>
  );
}

export default PurchaseApp;
