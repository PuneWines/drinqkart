import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AgeVerificationModal from './components/AgeVerificationModal';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import AppSidebar from './layout/AppSidebar';
import AppHeader from './layout/AppHeader';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import MasterSetting from './pages/MasterSetting';
import BroadcastDashboard from './pages/BroadcastDashboard';

import ChecklistDashboard from './systems/checklist/App';
import checklistStore from './systems/checklist/redux/store';
import checklistQueryClient from './systems/checklist/queryClient';
import HrApp from './systems/hr/App';
import InventoryApp from './systems/inventory/App';
import PettyCashApp from './systems/petty-cash/App';
import PurchaseApp from './systems/purchase/App';
import PublicRegister from './systems/hr/pages/PublicRegister';
import VendorConfirmation from './systems/purchase/pages/VendorConfirmation';
import TransporterConfirmation from './systems/purchase/pages/TransporterConfirmation';
import ReceiverConfirmation from './systems/purchase/pages/ReceiverConfirmation';
import VendorPortal from './systems/purchase/pages/VendorPortal';
import TransporterPortal from './systems/purchase/pages/TransporterPortal';
import ReceiverPortal from './systems/purchase/pages/ReceiverPortal';

// Wraps a merged system's routes: requires a logged-in user and renders
// the top navigation header and system sub-sidebar alongside content.
const ConsoleRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-100 font-sans">
      <AppHeader />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 bg-gray-100 overflow-auto h-full flex flex-col min-w-0">
          <div className="flex-1 overflow-auto min-h-0 flex flex-col p-2">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const AppLayout = () => {
  const { user } = useAuth();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const location = useLocation();

  const toggleCart = () => setIsCartOpen(!isCartOpen);

  const isLoginPage = location.pathname === '/login';
  const isConsolePage = location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/systems/');
  // Purchase-system links sent to external vendors/transporters/receivers -
  // standalone documents, no storefront chrome.
  const isPurchasePublicPage = [
    '/confirm-po/', '/transporter-confirmation/', '/receiver-confirmation/',
    '/vendor-portal/', '/transporter-portal/', '/receiver-portal/',
  ].some((prefix) => location.pathname.startsWith(prefix));
  const hideChrome = isLoginPage || isConsolePage || isPurchasePublicPage;

  return (
    <div className="min-h-screen flex flex-col font-sans text-charcoal bg-white">
      {!hideChrome && <AgeVerificationModal />}
      {!hideChrome && <Navbar toggleCart={toggleCart} />}
      {!hideChrome && <CartDrawer isOpen={isCartOpen} toggleCart={toggleCart} />}

      <main className={isConsolePage || isPurchasePublicPage ? '' : 'flex-1'}>
        <Routes>
          {/* --- Storefront (public) --- */}
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/register" element={<PublicRegister />} />

          {/* --- Purchase system public links (sent to vendors/transporters/receivers, no login) --- */}
          <Route path="/confirm-po/:id" element={<VendorConfirmation />} />
          <Route path="/transporter-confirmation/:id" element={<TransporterConfirmation />} />
          <Route path="/receiver-confirmation/:id" element={<ReceiverConfirmation />} />
          <Route path="/vendor-portal/:vendorId" element={<VendorPortal />} />
          <Route path="/transporter-portal/:transporterId" element={<TransporterPortal />} />
          <Route path="/receiver-portal/:receiverId" element={<ReceiverPortal />} />
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard/admin" replace /> : <Login />}
          />

          {/* --- Checklist (source-of-truth system, native /dashboard/* URLs) --- */}
          <Route
            path="/dashboard/*"
            element={
              <ConsoleRoute>
                <Provider store={checklistStore}>
                  <QueryClientProvider client={checklistQueryClient}>
                    <ChecklistDashboard />
                  </QueryClientProvider>
                </Provider>
              </ConsoleRoute>
            }
          />

          {/* --- HR / Inventory / Petty Cash --- */}
          <Route
            path="/systems/hr/*"
            element={
              <ConsoleRoute>
                <HrApp />
              </ConsoleRoute>
            }
          />
          <Route
            path="/systems/inventory/*"
            element={
              <ConsoleRoute>
                <InventoryApp />
              </ConsoleRoute>
            }
          />
          <Route
            path="/systems/petty-cash/*"
            element={
              <ConsoleRoute>
                <PettyCashApp />
              </ConsoleRoute>
            }
          />
          <Route
            path="/systems/purchase/*"
            element={
              <ConsoleRoute>
                <PurchaseApp />
              </ConsoleRoute>
            }
          />
          <Route
            path="/systems/master-setting/*"
            element={
              <ConsoleRoute>
                <MasterSetting />
              </ConsoleRoute>
            }
          />
          <Route
            path="/systems/whatsapp/*"
            element={
              <ConsoleRoute>
                <BroadcastDashboard />
              </ConsoleRoute>
            }
          />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!hideChrome && <Footer />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <AppLayout />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
