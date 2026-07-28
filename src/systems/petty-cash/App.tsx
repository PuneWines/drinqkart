import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Toast from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import PettyCash from "./pages/PettyCash";
import Counter1 from "./pages/Counter1";
import Counter2 from "./pages/Counter2";
import Counter3 from "./pages/Counter3";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Footer from "./components/Footer";

// Global navigation config for routing logic
const ALL_NAV_ITEMS = [
  { id: "cash-tally-1", label: "Counter 1", pageName: "Cash Tally - Counter 1" },
  { id: "cash-tally-2", label: "Counter 2", pageName: "Cash Tally - Counter 2" },
  { id: "cash-tally-3", label: "Counter 3", pageName: "Cash Tally - Counter 3" },
  { id: "petty-cash", label: "Petty Cash Form", pageName: "Petty Cash Form" },
  { id: "dashboard", label: "Dashboard", pageName: "Dashboard" },
  { id: "reports", label: "Reports", pageName: "Reports" },
];

function MainApp() {
  const { isAuthenticated, hasPageAccess, user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') || "cash-tally-1";
    } catch {
      return "cash-tally-1";
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
    "cash-tally-1": "Cash Tally - Counter 1",
    "cash-tally-2": "Cash Tally - Counter 2",
    "cash-tally-3": "Cash Tally - Counter 3",
    "petty-cash": "Petty Cash Form",
    "dashboard": "Dashboard",
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
      case "cash-tally-1":
        return "Cash Tally — Counter 1";
      case "cash-tally-2":
        return "Cash Tally — Counter 2";
      case "cash-tally-3":
        return "Cash Tally — Counter 3";
      case "petty-cash":
        return "Petty Cash Form";
      case "dashboard":
        return "Dashboard Overview";
      case "reports":
        return "Financial Reports";
      case "settings":
        return "Settings — User Management";
      default:
        return "Cash Tally — Counter 1";
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case "cash-tally-1":
        return <Counter1 onClose={() => setActiveTab("cash-tally-1")} />;
      case "cash-tally-2":
        return <Counter2 onClose={() => setActiveTab("cash-tally-2")} />;
      case "cash-tally-3":
        return <Counter3 onClose={() => setActiveTab("cash-tally-3")} />;
      case "petty-cash":
        return <PettyCash onClose={() => setActiveTab("cash-tally-1")} />;
      case "dashboard":
        return <Dashboard />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      default:
        return <Counter1 onClose={() => setActiveTab("cash-tally-1")} />;
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