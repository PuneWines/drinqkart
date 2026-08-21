import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { ShieldCheck, User, Briefcase, Crown } from 'lucide-react';

const Login = () => {
  const [roleType, setRoleType] = useState('user'); // 'admin' | 'user' | 'manager'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all credential fields');
      return;
    }

    setLoading(true);
    const result = await login(email, password, roleType);
    setLoading(false);

    if (result.success) {
      navigate(result.redirect || '/dashboard/admin');
    } else {
      setError(result.message);
    }
  };

  const roleOptions = [
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
    { id: 'HOD', label: 'HOD', icon: Crown },
    { id: 'manager', label: 'Manager', icon: Briefcase },
    { id: 'user', label: 'User', icon: User },
  ];

  return (
    <div className="min-h-screen flex bg-white font-sans">
      {/* ── Left Side: Branding / Image (Hidden on small screens) ── */}
      <div className="hidden lg:flex w-1/2 relative bg-[#FAFAFA] border-r-[0.5px] border-[#1A1A1A]/10 overflow-hidden flex-col justify-between p-12">
        {/* Background Image with multiply blend for light theme */}
        <div
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center opacity-[0.15] mix-blend-multiply"
        />

        <Link to="/" className="relative z-10 flex items-center gap-3 group">
          <img src="/logo-clean.png" alt="Jagwani Logo" className="h-10 w-auto object-contain" />
          <span className="text-xl font-serif text-[#1A1A1A] tracking-widest font-bold group-hover:text-[#C9A84C] transition-colors">DRINQKART</span>
        </Link>

        {/* Bottom Text */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-serif text-[#1A1A1A] mb-4 font-bold leading-tight">The ultimate destination for fine spirits.</h2>
          <p className="text-[#1A1A1A]/60 text-sm font-medium">Log in to access your curated cellar, manage your preferences, and explore rare vintages from around the globe.</p>
        </div>
      </div>

      {/* ── Right Side: Login Form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 md:p-12 relative overflow-hidden bg-white">

        {/* Decorative subtle gradient for the right side */}
        <div className="absolute top-0 right-0 w-[80%] h-[80%] rounded-full bg-[#C9A84C]/5 blur-[120px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile-only Logo Header */}
          <div className="lg:hidden text-center mb-6 flex flex-col items-center">
            <Link to="/" className="flex flex-col items-center group">
              <img src="/logo-clean.png" alt="Jagwani Logo" className="h-14 w-auto object-contain mb-3" />
              <h1 className="text-3xl font-serif text-[#1A1A1A] tracking-widest font-bold group-hover:text-[#C9A84C] transition-colors">DRINQKART</h1>
            </Link>
          </div>

          <div className="mb-6 lg:mb-8">
            <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]/50 hover:text-[#C9A84C] transition-colors mb-4 group">
              <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
            <h2 className="text-3xl font-serif text-[#1A1A1A] font-bold mb-1">Welcome Back</h2>
            <p className="text-[#1A1A1A]/50 text-xs uppercase tracking-[0.2em] font-bold">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 text-xs p-4 border-[0.5px] border-red-200 text-center uppercase tracking-widest font-bold shadow-sm">
                {error}
              </div>
            )}

            {/* Role / Portal Selector (3 Credential Option) */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 mb-2 font-bold">
                Select Login Role / Portal
              </label>
              <div className="grid grid-cols-4 gap-2 bg-[#FAFAFA] p-1.5 ">
                {roleOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = roleType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRoleType(opt.id)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#C9A84C] text-white shadow-sm border border-[#C9A84C]/30'
                          : 'text-[#1A1A1A]/60 hover:text-[#1A1A1A] hover:bg-white'
                      }`}
                    >
                      <Icon size={14} className={isSelected ? 'text-white' : 'text-[#1A1A1A]/40'} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 mb-1 font-bold">Mobile Number</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/20 text-[#1A1A1A] p-3 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors shadow-inner font-medium"
                placeholder="Enter 10-digit mobile number"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 mb-1 font-bold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/20 text-[#1A1A1A] p-3 text-sm focus:outline-none focus:border-[#C9A84C] transition-colors shadow-inner font-medium"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3 mt-2 shadow-lg shadow-[#C9A84C]/20 text-xs disabled:opacity-50 disabled:cursor-not-allowed uppercase font-bold tracking-widest"
            >
              {loading ? 'Validating Credentials...' : `Log In as ${roleType.toUpperCase()}`}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t-[0.5px] border-[#1A1A1A]/10">
            <p className="text-center text-[10px] text-[#1A1A1A]/40 font-sans uppercase tracking-widest font-bold">
              © {new Date().getFullYear()} Drinqkart. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
