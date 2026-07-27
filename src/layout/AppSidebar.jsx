import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getVisibleSystems, getActiveSystem } from './systemsConfig';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  LayoutDashboard,
  FileText,
  PlusCircle,
  Clock,
  Share2,
  Award,
  ListTodo,
  Bell,
  Calendar,
  CheckCircle2,
  BarChart2,
  Users,
  Building,
  DollarSign,
  Briefcase,
  Sliders,
  Package,
  ShoppingCart,
  Receipt,
  Truck,
  ShieldAlert,
  UserCheck
} from 'lucide-react';

const getSubtabIcon = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('dashboard')) return LayoutDashboard;
  if (l.includes('add') || l.includes('create')) return PlusCircle;
  if (l.includes('announcement') || l.includes('notification')) return Bell;
  if (l.includes('quick')) return CheckCircle2;
  if (l.includes('assign') || l.includes('delegation')) return ListTodo;
  if (l.includes('work') || l.includes('task')) return FileText;
  if (l.includes('daily')) return Calendar;
  if (l.includes('monthly')) return BarChart2;
  if (l.includes('calendar') || l.includes('roster')) return Calendar;
  if (l.includes('holiday')) return Calendar;
  if (l.includes('mis') || l.includes('report') || l.includes('ledger')) return BarChart2;
  if (l.includes('approval')) return CheckCircle2;
  if (l.includes('employee') || l.includes('user')) return Users;
  if (l.includes('joining') || l.includes('shop')) return Building;
  if (l.includes('leave')) return Clock;
  if (l.includes('attendance')) return Clock;
  if (l.includes('payroll') || l.includes('cash') || l.includes('tally')) return DollarSign;
  if (l.includes('advanced') || l.includes('setting')) return Sliders;
  if (l.includes('master') || l.includes('item')) return Package;
  if (l.includes('indent') || l.includes('order')) return ShoppingCart;
  if (l.includes('po') || l.includes('history')) return Receipt;
  if (l.includes('trader') || l.includes('transporter') || l.includes('receiving')) return Truck;
  if (l.includes('access') || l.includes('shield')) return ShieldAlert;
  if (l.includes('shared')) return Share2;
  if (l.includes('license') || l.includes('renewal')) return Award;

  return FileText;
};

const AppSidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedTabs, setExpandedTabs] = useState({});

  const visibleSystems = getVisibleSystems(user);
  const activeSystem = getActiveSystem(visibleSystems, location.pathname);

  const currentUrl = `${location.pathname}${location.search}`;

  const isSubtabActive = (subTo) => {
    if (!subTo) return false;
    if (subTo === currentUrl) return true;
    if (subTo.includes('?')) {
      return currentUrl === subTo;
    }
    return location.pathname === subTo;
  };

  useEffect(() => {
    if (activeSystem && activeSystem.subtabs) {
      const initialExpanded = {};
      activeSystem.subtabs.forEach((sub) => {
        if (sub.children) {
          const isChildActive = sub.children.some((child) => isSubtabActive(child.to));
          if (isChildActive || isSubtabActive(sub.to)) {
            initialExpanded[sub.label] = true;
          }
        }
      });
      setExpandedTabs((prev) => ({ ...initialExpanded, ...prev }));
    }
  }, [location.pathname]);

  if (!activeSystem) return null;

  const ActiveIcon = activeSystem.icon || Layers;

  const toggleTabExpand = (label, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedTabs((prev) => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 250 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="h-full bg-white border-r border-[#C9A84C]/20 flex flex-col justify-between text-[#1A1A1A] font-sans shrink-0 relative select-none shadow-sm"
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Active System Header Title Card - Brown Yellow & Gold Styling */}
        <div className="p-3 flex items-center justify-between shadow-xs border-b border-[#C9A84C]/30"> 
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-1.5 rounded-md bg-[#C9A84C] text-[#1c120c] shrink-0 font-bold shadow-xs">
              <ActiveIcon size={18} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold leading-tight truncate text-black">
                  {activeSystem.label}
                </h2>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className="text-[#E5D7B7] hover:text-[#C9A84C] p-1 rounded hover:bg-white/10 cursor-pointer transition-colors shrink-0"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        {/* Subtabs Menu */}
        <div className="flex-1 p-3 space-y-1.5 overflow-y-auto overflow-x-hidden [ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {activeSystem.subtabs.map((sub, index) => {
            if (sub.type === 'header') {
              if (isCollapsed) return <div key={`header-${index}`} className="my-2 border-t border-[#C9A84C]/20" />;
              return (
                <div
                  key={`header-${index}`}
                  className="text-[9px] font-extrabold tracking-widest text-[#8C6D23] uppercase pt-3 pb-1 px-3 select-none"
                >
                  {sub.label}
                </div>
              );
            }

            if (sub.children && sub.children.length > 0) {
              const isChildActive = sub.children.some((child) => isSubtabActive(child.to));
              const isParentActive = isSubtabActive(sub.to) || isChildActive;
              const isExpanded = expandedTabs[sub.label] ?? isParentActive;
              const ParentIcon = getSubtabIcon(sub.label);

              return (
                <div key={sub.label || index} className="space-y-1">
                  <div
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                      isParentActive
                        ? 'bg-[#C9A84C]/15 text-[#8C6D23] font-bold'
                        : 'text-[#2C1D11] hover:bg-[#C9A84C]/10 hover:text-[#8C6D23]'
                    }`}
                  >
                    <Link
                      to={sub.to}
                      title={isCollapsed ? sub.label : undefined}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <ParentIcon size={16} className={`shrink-0 ${isParentActive ? 'text-[#8C6D23]' : 'text-[#C9A84C]'}`} />
                      {!isCollapsed && <span className="truncate">{sub.label}</span>}
                    </Link>
                    {!isCollapsed && (
                      <button
                        onClick={(e) => toggleTabExpand(sub.label, e)}
                        className="p-1 text-[#8C6D23] hover:text-[#2C1D11] rounded cursor-pointer"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>

                  {(!isCollapsed && isExpanded) && (
                    <div className="pl-3 space-y-1 border-l-2 border-[#C9A84C]/30 ml-4 my-1">
                      {sub.children.map((child, cIdx) => {
                        const isThisChildActive = isSubtabActive(child.to);
                        const ChildIcon = getSubtabIcon(child.label);

                        return (
                          <Link
                            key={child.to || cIdx}
                            to={child.to}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-150 ${
                              isThisChildActive
                                ? 'bg-gradient-to-r from-[#C9A84C] to-[#d4b457] text-[#1c120c] shadow-sm font-bold'
                                : 'text-[#2C1D11] hover:bg-[#C9A84C]/10 hover:text-[#8C6D23]'
                            }`}
                          >
                            <ChildIcon size={14} className={`shrink-0 ${isThisChildActive ? 'text-[#1c120c]' : 'text-[#C9A84C]'}`} />
                            <span className="truncate">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const isActive = isSubtabActive(sub.to);
            const SubIcon = getSubtabIcon(sub.label);

            return (
              <Link
                key={sub.to || index}
                to={sub.to}
                title={isCollapsed ? sub.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#C9A84C] to-[#d4b457] text-[#1c120c] shadow-md font-bold'
                    : 'text-[#2C1D11] hover:bg-[#C9A84C]/10 hover:text-[#8C6D23]'
                }`}
              >
                <SubIcon size={16} className={`shrink-0 ${isActive ? 'text-[#1c120c]' : 'text-[#C9A84C]'}`} />
                {!isCollapsed && <span className="truncate">{sub.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Bottom Attribution */}
        <div className="p-3 border-t border-[#C9A84C]/20 bg-[#FAFAFA] text-left shrink-0">
          {!isCollapsed ? (
            <p className="text-[10px] text-gray-400 font-sans">
              Powered by{' '}
              <a
                href="https://www.botivate.in"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#8C6D23] hover:text-[#C9A84C] hover:underline"
              >
                Botivate
              </a>
            </p>
          ) : (
            <a
              href="https://www.botivate.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-[#8C6D23] block text-center"
              title="Powered by Botivate"
            >
              B
            </a>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;

