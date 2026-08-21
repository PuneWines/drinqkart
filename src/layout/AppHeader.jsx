import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVisibleSystems, getActiveSystem } from './systemsConfig';
import { LogOut, HelpCircle, Menu, X, ChevronDown } from 'lucide-react';
import HelpCenterModal from '../components/help-center/HelpCenterModal';

const AppHeader = ({ isMobileMenuOpen, onToggleMobileMenu }) => {
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
      {/* Mobile Top Header (< 768px): Upper left hamburger button opens sidebar drawer */}
      <div className="md:hidden bg-white px-3 py-2 flex items-center justify-between border-b border-gray-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          {/* Upper Left Hamburger Icon */}
          <button
            onClick={onToggleMobileMenu}
            className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-[#2C1D11] hover:bg-[#C9A84C]/15 active:scale-95 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
            aria-label="Open Sidebar Menu"
            title="Open Menu"
          >
            {isMobileMenuOpen ? <X size={22} className="text-[#8C6D23]" /> : <Menu size={22} className="text-[#2C1D11]" />}
          </button>

          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-clean.png" alt="Drinqkart Logo" className="h-7 w-auto shrink-0" />
            <span className="text-xs font-serif font-bold tracking-wider text-[#C9A84C]">
              DRINQKART
            </span>
          </Link>
        </div>

        {/* Right Header: Active System Indicator Pill + Help & Profile */}
        <div className="flex items-center gap-2">
          {activeSystem && (
            <div className="px-2.5 py-1 bg-[#2C1D11] text-[#C9A84C] rounded-full text-[11px] font-bold shadow-xs">
              <span className="truncate max-w-[100px] block">{activeSystem.label}</span>
            </div>
          )}

          <button
            onClick={() => setIsHelpModalOpen(true)}
            className="p-1.5 bg-rose-600 text-white rounded-full transition-transform active:scale-95 cursor-pointer"
            title="Help Center"
          >
            <HelpCircle size={16} />
          </button>

          <div className="w-7 h-7 rounded-full bg-[#2C1D11] text-[#C9A84C] flex items-center justify-center font-bold text-[10px] uppercase border border-[#C9A84C]/40">
            {userName.slice(0, 2)}
          </div>
        </div>
      </div>

      {/* Desktop Upper Bar (>= 768px): Unchanged desktop view */}
      <div className="hidden md:flex bg-white px-6 py-2.5 items-center justify-between">
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

      {/* Desktop Main Top Navigation Tabs Bar (>= 768px): Unchanged desktop navigation bar */}
      <nav
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="hidden md:flex bg-[#C9A84C] text-[#1c120c] px-2 items-center shadow-inner border-t border-[#8C6D23]/30 overflow-x-hidden [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar]:h-0"
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
