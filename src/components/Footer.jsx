import React from 'react';

const Footer = () => {
  return (
    <footer id="contact" className="bg-[#0A0508] text-cream border-t border-burgundy pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-start gap-12 mb-16">
          <div className="flex-1">
            <h3 className="text-gold font-serif text-2xl font-bold mb-6 tracking-widest">DRINQKART</h3>
            <p className="text-sm text-cream/70 leading-relaxed">
              Curating the finest spirits and wines for the discerning palate of Pune. Experience luxury in every pour.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-burgundy/50 pb-2 inline-block">Quick Links</h4>
            <ul className="space-y-4 text-sm text-cream/70">
              <li>
                <a href="mailto:contact@drinqkart.com" className="hover:text-gold transition-colors cursor-pointer">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="mailto:careers@drinqkart.com" className="hover:text-gold transition-colors cursor-pointer">
                  Careers
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-burgundy/30 pt-8 flex flex-col items-center text-center">
          <p className="text-xs text-cream/40">
            &copy; {new Date().getFullYear()} Drinqkart. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
