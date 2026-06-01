import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User, Menu, X, ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = ({ toggleCart }) => {
  const { cartCount } = useCart();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isHomeDropdownOpen, setIsHomeDropdownOpen] = useState(false);
  const [isMobileHomeOpen, setIsMobileHomeOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsHomeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const scrollToSection = (id) => {
    setIsHomeDropdownOpen(false);
    setIsMobileMenuOpen(false);
    setIsMobileHomeOpen(false);
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleNavClick = (e, item) => {
    e.preventDefault();
    setIsMobileMenuOpen(false);
    setIsHomeDropdownOpen(false);

    if (item === 'Home') {
      if (window.location.pathname === '/') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/');
        window.scrollTo(0, 0);
      }
    } else {
      const targetId = item.toLowerCase();
      if (window.location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const homeDropdownItems = [
    { label: 'About Us', id: 'about' },
    { label: 'Our Mission', id: 'mission' },
  ];

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b-[0.5px] border-[#1A1A1A]/10 transition-all duration-300 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-20 relative">

            {/* Far Left: Logo */}
            <div className="flex items-center flex-shrink-0 mr-8">
              <Link to="/" className="flex items-center">
                <img src="/logo-clean.png" alt="Drinqkart" className="h-14 w-auto object-contain" />
              </Link>
            </div>

            {/* Left: Nav Links */}
            <div className="hidden lg:flex items-center space-x-8 flex-1">

              {/* Home with Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsHomeDropdownOpen((v) => !v)}
                  className="flex items-center gap-1 text-[#1A1A1A]/80 hover:text-[#C9A84C] text-xs uppercase tracking-[0.2em] relative group py-2 font-medium transition-colors cursor-pointer"
                >
                  Home
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${isHomeDropdownOpen ? 'rotate-180 text-[#C9A84C]' : ''}`}
                  />
                  <span className="absolute bottom-0 left-0 w-0 h-[0.5px] bg-[#C9A84C] transition-all duration-300 group-hover:w-full"></span>
                </button>

                <AnimatePresence>
                  {isHomeDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-full left-0 mt-2 w-44 bg-white border border-[#1A1A1A]/8 shadow-lg z-50"
                    >
                      {/* Go to top option */}
                      <button
                        onClick={(e) => handleNavClick(e, 'Home')}
                        className="w-full text-left px-5 py-3 text-[11px] uppercase tracking-widest text-[#1A1A1A]/70 hover:text-[#C9A84C] hover:bg-[#FAFAFA] transition-colors border-b border-[#1A1A1A]/5 font-medium"
                      >
                        Home
                      </button>
                      {homeDropdownItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          className="w-full text-left px-5 py-3 text-[11px] uppercase tracking-widest text-[#1A1A1A]/70 hover:text-[#C9A84C] hover:bg-[#FAFAFA] transition-colors border-b border-[#1A1A1A]/5 last:border-0 font-medium"
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Stores */}
              <button
                onClick={(e) => handleNavClick(e, 'Stores')}
                className="text-[#1A1A1A]/80 hover:text-[#C9A84C] text-xs uppercase tracking-[0.2em] relative group py-2 font-medium transition-colors cursor-pointer"
              >
                Stores
                <span className="absolute bottom-0 left-0 w-0 h-[0.5px] bg-[#C9A84C] transition-all duration-300 group-hover:w-full"></span>
              </button>

              {/* Contact */}
              <button
                onClick={(e) => handleNavClick(e, 'Contact')}
                className="text-[#1A1A1A]/80 hover:text-[#C9A84C] text-xs uppercase tracking-[0.2em] relative group py-2 font-medium transition-colors cursor-pointer"
              >
                Contact
                <span className="absolute bottom-0 left-0 w-0 h-[0.5px] bg-[#C9A84C] transition-all duration-300 group-hover:w-full"></span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="lg:hidden flex items-center justify-start flex-1">
              <button
                className="text-[#1A1A1A] hover:text-[#C9A84C] transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Center: Brand Name */}
            <div className="flex items-center justify-center flex-1">
              <Link to="/" className="flex items-center group" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                <span className="text-2xl md:text-3xl font-serif text-[#1A1A1A] tracking-[0.15em] font-bold text-center">
                  DRINQKART
                </span>
              </Link>
            </div>

            {/* Right: Search + Auth */}
            <div className="flex items-center justify-end space-x-6 flex-1">
              <div className="flex items-center">
                <AnimatePresence>
                  {isSearchOpen && (
                    <motion.input
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 180, opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      type="text"
                      placeholder="Search..."
                      className="bg-transparent border-b-[0.5px] border-[#1A1A1A]/20 text-[#1A1A1A] placeholder-[#1A1A1A]/40 focus:outline-none focus:border-[#C9A84C] py-1 pr-2 text-xs mr-2 font-sans"
                      autoFocus
                    />
                  )}
                </AnimatePresence>
                <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-[#1A1A1A]/80 hover:text-[#C9A84C] transition-colors">
                  <Search className="w-5 h-5" />
                </button>
              </div>

              <div className="hidden sm:flex items-center">
                {user ? (
                  <button
                    onClick={logout}
                    className="text-xs text-[#1A1A1A]/80 hover:text-[#C9A84C] transition-colors uppercase tracking-widest font-medium"
                  >
                    Logout
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/login')}
                    className="flex items-center space-x-2 text-[#1A1A1A]/80 hover:text-[#C9A84C] transition-colors duration-300"
                  >
                    <span className="text-xs uppercase tracking-[0.2em] font-medium">Login</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-white flex flex-col"
          >
            <div className="flex justify-between items-center h-20 px-4 border-b-[0.5px] border-[#1A1A1A]/10">
              <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/logo.png" alt="Drinqkart" className="h-12 w-auto object-contain" />
              </Link>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-[#1A1A1A] hover:text-[#C9A84C]">
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="flex flex-col px-6 py-12 space-y-2 bg-[#FAFAFA] flex-1 overflow-y-auto">

              {/* Home with sub-items */}
              <div>
                <button
                  onClick={() => setIsMobileHomeOpen((v) => !v)}
                  className="flex items-center justify-between w-full text-2xl font-serif text-[#1A1A1A] hover:text-[#C9A84C] transition-colors py-3"
                >
                  <span>Home</span>
                  <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isMobileHomeOpen ? 'rotate-180 text-[#C9A84C]' : ''}`} />
                </button>

                <AnimatePresence>
                  {isMobileHomeOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-4 border-l-2 border-[#C9A84C]/30 ml-2"
                    >
                      <button
                        onClick={(e) => handleNavClick(e, 'Home')}
                        className="block w-full text-left py-2 text-base font-sans text-[#1A1A1A]/70 hover:text-[#C9A84C] uppercase tracking-widest transition-colors"
                      >
                        Top
                      </button>
                      {homeDropdownItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          className="block w-full text-left py-2 text-base font-sans text-[#1A1A1A]/70 hover:text-[#C9A84C] uppercase tracking-widest transition-colors"
                        >
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Stores */}
              <button
                onClick={(e) => handleNavClick(e, 'Stores')}
                className="text-2xl font-serif text-[#1A1A1A] hover:text-[#C9A84C] transition-colors text-left py-3"
              >
                Stores
              </button>

              {/* Contact */}
              <button
                onClick={(e) => handleNavClick(e, 'Contact')}
                className="text-2xl font-serif text-[#1A1A1A] hover:text-[#C9A84C] transition-colors text-left py-3"
              >
                Contact
              </button>

              <div className="mt-auto border-t-[0.5px] border-[#1A1A1A]/10 pt-8 flex items-center gap-4">
                {user ? (
                  <button onClick={() => { logout(); setIsMobileMenuOpen(false); }} className="text-sm uppercase tracking-widest text-[#1A1A1A]/60 hover:text-[#1A1A1A]">Logout</button>
                ) : (
                  <button onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }} className="text-sm uppercase tracking-widest text-[#C9A84C] flex items-center gap-2 font-bold">
                    <User className="w-4 h-4" /> Login
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
