import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';

const AgeVerificationModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already verified age
    const isVerified = localStorage.getItem('ageVerified');
    if (!isVerified) {
      setIsOpen(true);
      // Prevent scrolling while modal is open
      document.body.style.overflow = 'hidden';
    }
  }, []);

  const handleVerify = (isOfAge) => {
    if (isOfAge) {
      localStorage.setItem('ageVerified', 'true');
      setIsOpen(false);
      document.body.style.overflow = 'unset';
    } else {
      // Redirect to a safe site if under 21
      window.location.href = 'https://www.google.com';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Glassmorphism Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 bg-white/70 backdrop-blur-xl"
          />
          
          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="relative w-full max-w-lg bg-white border-[0.5px] border-[#1A1A1A]/10 p-10 md:p-14 text-center shadow-2xl overflow-hidden"
          >
            {/* Decorative Corner Accents */}
            <div className="absolute top-0 left-0 w-16 h-16 border-t-[0.5px] border-l-[0.5px] border-[#C9A84C]/50 m-4 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-16 h-16 border-b-[0.5px] border-r-[0.5px] border-[#C9A84C]/50 m-4 pointer-events-none" />
            
            <ShieldAlert className="w-12 h-12 text-[#C9A84C] mx-auto mb-6" strokeWidth={1} />
            
            <h2 className="text-4xl md:text-5xl font-serif text-[#1A1A1A] mb-4 font-bold">Are you of legal drinking age?</h2>
            
            <p className="text-[#1A1A1A]/60 text-sm mb-10 font-sans leading-relaxed">
              You must be of legal drinking age in your country of residence to enter this site. By entering, you agree to our Terms of Service and Privacy Policy.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => handleVerify(true)}
                className="btn-gold px-8 py-4 text-xs w-full sm:w-auto shadow-lg shadow-[#C9A84C]/20"
              >
                Yes, I am
              </button>
              <button 
                onClick={() => handleVerify(false)}
                className="btn-ghost px-8 py-4 text-xs w-full sm:w-auto bg-[#FAFAFA]"
              >
                No, I am not
              </button>
            </div>
            
            <p className="text-[10px] text-[#1A1A1A]/40 uppercase tracking-widest mt-12 font-bold">
              Enjoy Responsibly
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AgeVerificationModal;
