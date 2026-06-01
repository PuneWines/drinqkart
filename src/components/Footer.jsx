import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer id="contact" className="bg-[#0A0508] text-cream border-t border-burgundy pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div>
            <h3 className="text-gold font-serif text-2xl font-bold mb-6 tracking-widest">DRINQKART</h3>
            <p className="text-sm text-cream/70 leading-relaxed">
              Curating the finest spirits and wines for the discerning palate of Pune. Experience luxury in every pour.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-burgundy/50 pb-2 inline-block">Customer Service</h4>
            <ul className="space-y-4 text-sm text-cream/70">
              <li><Link to="/" className="hover:text-gold transition-colors">Contact Us</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">Delivery Information</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">Returns & Refunds</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">FAQ</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-burgundy/50 pb-2 inline-block">About Us</h4>
            <ul className="space-y-4 text-sm text-cream/70">
              <li><Link to="/" className="hover:text-gold transition-colors">Our Story</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">The Cellar</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">Nashik Vineyard Tours</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">Careers</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-6 border-b border-burgundy/50 pb-2 inline-block">Legal</h4>
            <ul className="space-y-4 text-sm text-cream/70">
              <li><Link to="/" className="hover:text-gold transition-colors">Terms & Conditions</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">Privacy Policy</Link></li>
              <li><Link to="/" className="hover:text-gold transition-colors">Age Verification Policy</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-burgundy/30 pt-8 flex flex-col items-center text-center">
          <p className="text-xs text-red-500/80 font-bold uppercase tracking-widest mb-4">
            Alcohol consumption is injurious to health. Be responsible. We serve customers above 21 years only.
          </p>
          <p className="text-xs text-cream/40">
            &copy; {new Date().getFullYear()} Drinqkart. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
