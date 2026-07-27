import { useState, useEffect } from 'react';
import Inventory from './pages/Inventory';
import StockLedger from './pages/StockLedger';
import PurchasedItems from './components/reports/PurchasedItems';
import CurrentStockItems from './components/reports/ClosingStockItems';
import MasterManagement from './pages/MasterManagement';
import SaleHistory from './components/reports/SaleHistory';
import UserManagement from './pages/UserManagement';
import FormEntry from './pages/FormEntry';

// Mounted at /systems/inventory/* by the root router (see src/App.jsx). Auth
// and logout are handled by the unified AuthContext/root sidebar before this
// component ever renders; it only reads the `vishal_snacks_user` localStorage
// key (kept in sync by AuthContext) for the current user's role/page_access.
function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('vishal_snacks_user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      console.error('Error parsing stored user in inventory:', e);
      return null;
    }
  });
  const [currentPage, setCurrentPage] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      if (pageParam) return pageParam;
      return localStorage.getItem('vishal_snacks_page') || 'entry';
    } catch {
      return 'entry';
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load user session on mount
  useEffect(() => {
    setIsLoading(false);
  }, []);

  // Sync state if URL search query changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get('page');
    if (pageParam && pageParam !== currentPage) {
      setCurrentPage(pageParam);
    }
  }, [window.location.search]);

  // Persist current page across refreshes
  useEffect(() => {
    localStorage.setItem('vishal_snacks_page', currentPage);
  }, [currentPage]);

  // Guard routes dynamically based on user's granular page_access & master_user_system_page_access permissions
  useEffect(() => {
    if (currentUser) {
      const allowed = currentUser.page_access || [];
      const userRole = (currentUser.role || '').toLowerCase();
      const isMasterAdmin = (currentUser.user_name || currentUser.username || '').toLowerCase() === 'masteradmin';

      let masterAccessList = [];
      try {
        const rawObj = currentUser.master_user_system_page_access;
        const rawStorage = localStorage.getItem('master_user_system_page_access');
        const parseList = (r) => {
          if (!r) return [];
          let cur = r;
          while (typeof cur === 'string') {
            try {
              const t = JSON.parse(cur);
              if (t === cur) break;
              cur = t;
            } catch { break; }
          }
          if (Array.isArray(cur)) return cur;
          if (cur && typeof cur === 'object') return Object.keys(cur);
          return [];
        };
        masterAccessList = [...parseList(rawObj), ...parseList(rawStorage)];
      } catch (e) {
        console.error('Error parsing master access in App.jsx:', e);
      }

      const hasMasterPerm = (pageName) => {
        const viewKey = `inventory.${pageName}.view`;
        const modifyKey = `inventory.${pageName}.modify`;
        return masterAccessList.includes(viewKey) || masterAccessList.includes(modifyKey);
      };

      const hasAccess = (page) => {
        if (isMasterAdmin || userRole === 'admin') return true;

        if (page === 'entry') {
          return (
            hasMasterPerm('Daily Entry Dashboard Logs') ||
            hasMasterPerm('Dashboard') ||
            allowed.includes('entry_dashboard')
          );
        }
        if (page === 'form_entry') {
          return (
            hasMasterPerm('Purchase Form Entry') ||
            hasMasterPerm('Closing Stock Form Entry') ||
            hasMasterPerm('Cash Tally Form Entry') ||
            hasMasterPerm('Form Entry') ||
            allowed.includes('entry_purchases') ||
            allowed.includes('entry_closing') ||
            allowed.includes('entry_cashtally')
          );
        }
        if (page === 'ledger') {
          return (
            hasMasterPerm('Stock Ledger') ||
            hasMasterPerm('Table View') ||
            hasMasterPerm('Reports & Charts') ||
            hasMasterPerm('Purchase Items') ||
            hasMasterPerm('Sales History') ||
            hasMasterPerm('Current Stock Details') ||
            hasMasterPerm('Manager Report') ||
            allowed.includes('ledger_table') ||
            allowed.includes('ledger_reports') ||
            allowed.includes('ledger_purchases') ||
            allowed.includes('ledger_sales') ||
            allowed.includes('ledger_closing') ||
            allowed.includes('manager_report')
          );
        }
        if (page === 'master') {
          return (
            hasMasterPerm('Master Items') ||
            allowed.includes('master_items') ||
            allowed.includes('master_vendors')
          );
        }
        if (page === 'users') {
          return (
            hasMasterPerm('Users Management') ||
            allowed.includes('users_management')
          );
        }
        return false;
      };

      if (!hasAccess(currentPage)) {
        const pages = ['entry', 'form_entry', 'ledger', 'master', 'users'];
        const firstAllowed = pages.find(p => hasAccess(p)) || 'entry';
        setCurrentPage(firstAllowed);
      }
    }
  }, [currentPage, currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Loading Console Session...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'entry':
        return <Inventory currentUser={currentUser} />;
      case 'form_entry':
        return <FormEntry currentUser={currentUser} />;
      case 'ledger':
        return <StockLedger currentUser={currentUser} />;
      case 'purchases':
        return <PurchasedItems currentUser={currentUser} showActions={false} />;
      case 'sales':
        return <SaleHistory currentUser={currentUser} showActions={false} />;
      case 'closing':
        return <CurrentStockItems currentUser={currentUser} showActions={false} />;
      case 'master':
        return <MasterManagement currentUser={currentUser} />;
      case 'users':
        return <UserManagement currentUser={currentUser} />;
      default:
        return <Inventory currentUser={currentUser} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased font-sans selection:bg-amber-500/20 selection:text-amber-900">
      <div className="min-h-screen flex flex-col transition-all duration-300">
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-4 w-10-xl w-full mx-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
