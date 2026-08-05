import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Toast from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import PettyCash from "./pages/PettyCash";
import CounterInformation from "./pages/CounterInformation";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Footer from "./components/Footer";

// Global navigation config for routing logic
const ALL_NAV_ITEMS = [
  { id: "cash-tally-counter", label: "Cash Tally Counter", pageName: "Cash Tally Counter" },
  { id: "petty-cash", label: "Petty Cash Form", pageName: "Petty Cash Form" },
  { id: "reports", label: "Reports", pageName: "Reports" },
];

function MainApp() {
  const { isAuthenticated, hasPageAccess, user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') || "cash-tally-counter";
    } catch {
      return "cash-tally-counter";
    }
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Sync state if URL search query changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam && pageParam !== activeTab) {
      setActiveTab(pageParam);
    }
  }, [window.location.search]);

  const PAGE_NAMES: Record<string, string> = {
    "cash-tally-counter": "Cash Tally Counter",
    "petty-cash": "Petty Cash Form",
    "reports": "Reports",
  };

  // ── Landing Page Logic ──
  // If default "cash-tally-1" is not allowed, pick the first allowed page.
  useEffect(() => {
    if (isAuthenticated && user) {
      const currentReqPage = PAGE_NAMES[activeTab];
      if (currentReqPage && !hasPageAccess(currentReqPage)) {
        const firstAllowed = ALL_NAV_ITEMS.find(item => 
          hasPageAccess(item.pageName)
        );
        if (firstAllowed) {
          console.log(`[App] Current tab ${activeTab} not allowed. Switching to landing page: ${firstAllowed.id}`);
          setActiveTab(firstAllowed.id);
        }
      }
    }
  }, [isAuthenticated, user, hasPageAccess]);

  // ── Route Guard ──
  useEffect(() => {
    if (!isAuthenticated) return;
    
    if (activeTab === "transaction-history") return;

    const requiredPage = PAGE_NAMES[activeTab];
    if (requiredPage && !hasPageAccess(requiredPage)) {
      console.warn(`[App] Access denied for page: ${requiredPage}. Falling back.`);
      const firstAllowed = ALL_NAV_ITEMS.find(item => hasPageAccess(item.pageName));
      if (firstAllowed) {
        setActiveTab(firstAllowed.id);
      }
      setToast({ message: "Access Denied", type: "error" });
    }
  }, [activeTab, isAuthenticated, hasPageAccess]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case "cash-tally-counter":
        return "Cash Tally Counter";
      case "petty-cash":
        return "Petty Cash Form";
      case "reports":
        return "Financial Reports";
      case "settings":
        return "Settings — User Management";
      default:
        return "Cash Tally Counter";
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case "cash-tally-counter":
        return <CounterInformation onClose={() => setActiveTab("cash-tally-counter")} />;
      case "petty-cash":
        return <PettyCash onClose={() => setActiveTab("cash-tally-counter")} />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      default:
        return <CounterInformation onClose={() => setActiveTab("cash-tally-counter")} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{getPageTitle()}</h1>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-semibold text-gray-900">{user?.name}</span>
                <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
                {user?.initials || 'U'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto animate-fadeIn">
            {renderPage()}
          </div>
        </main>

        <Footer isExpanded={true} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}