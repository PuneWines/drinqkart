import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVisibleSystems, getActiveSystem } from './systemsConfig';
import { LogOut, HelpCircle } from 'lucide-react';
import HelpCenterModal from '../components/help-center/HelpCenterModal';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const visibleSystems = getVisibleSystems(user);
  const activeSystem = getActiveSystem(visibleSystems, location.pathname);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userObj = user || {};
  const userName = userObj.user_name || userObj.username || 'User';

  return (
    <header className="w-full flex flex-col shrink-0 z-30 shadow-md border-b border-[#C9A84C]/20">
      {/* Upper bar: Logo + User Profile & Logout */}
      <div className="bg-white px-6 py-2.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <img src="/logo-clean.png" alt="Drinqkart Logo" className="h-9 w-auto shrink-0 transition-transform group-hover:scale-105" />
          <div className="flex flex-col">
            <span className="text-sm font-serif font-bold tracking-[0.2em] text-[#C9A84C]">
              DRINQKART
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[#2C1D11]/50 font-sans">
              Enterprise Console
            </span>
          </div>
        </Link>

        {/* Right Header: Help Center Button + Welcome User + Logout */}
        <div className="flex items-center gap-4">
          {/* Help Center Button placed to the left of Welcome */}
          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            title="Open Help Center Support"
          >
            <HelpCircle size={15} className="text-white" />
            <span>Help Center</span>
          </button>

          <div className="flex items-center gap-2.5 text-xs text-[#2C1D11]">
            <span className="text-gray-500 font-sans">Welcome,</span>
            <span className="font-semibold capitalize font-sans">{userName}</span>
            <div className="w-8 h-8 rounded-full bg-[#2C1D11] text-[#C9A84C] flex items-center justify-center font-bold text-xs uppercase shadow-sm border border-[#C9A84C]/40">
              {userName.slice(0, 2)}
            </div>
          </div>

          <div className="h-5 w-px bg-gray-200" />

          <button
            onClick={handleLogout}
            title="Logout"
            className="flex items-center justify-center p-2 rounded-full text-[#8C6D23] hover:bg-[#C9A84C]/10 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Help Center Interactive Support Modal */}
      <HelpCenterModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      {/* Main Top Navigation Tabs Bar: Gold Yellow background with Dark Brown text */}
      <nav
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="bg-[#C9A84C] text-[#1c120c] px-2 flex items-center shadow-inner border-t border-[#8C6D23]/30 overflow-x-hidden [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:h-0"
      >
        {/* System Module Tabs */}
        <div
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex items-center overflow-x-hidden [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:h-0"
        >
          {visibleSystems.map((system) => {
            const isActive = activeSystem?.id === system.id && location.pathname !== '/systems/profile';
            const defaultSubtabUrl = system.subtabs.find((s) => s.to)?.to || system.base;

            return (
              <Link
                key={system.id}
                to={defaultSubtabUrl}
                className={`px-4 py-2.5 text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer border-b-2 ${
                  isActive
                    ? 'bg-[#2C1D11] text-[#C9A84C] border-[#1c120c] font-extrabold shadow-md transform scale-[1.01]'
                    : 'text-[#1c120c] hover:bg-black/10 border-transparent'
                }`}
              >
                <span>{system.label}</span>
              </Link>
            );
          })}

          <Link
            to="/systems/profile"
            className={`px-4 py-2.5 text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer border-b-2 ${
              location.pathname === '/systems/profile'
                ? 'bg-[#2C1D11] text-[#C9A84C] border-[#1c120c] font-extrabold shadow-md transform scale-[1.01]'
                : 'text-[#1c120c] hover:bg-black/10 border-transparent'
            }`}
          >
            <span>Profile</span>
          </Link>
        </div>
      </nav>
    </header>
  );
};

export default AppHeader;
