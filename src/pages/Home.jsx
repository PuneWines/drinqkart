import React from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Stores from '../components/Stores';
import { products } from '../data/products';
import { motion } from 'framer-motion';

const Home = () => {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Promos Section */}
      <section className="pt-12 pb-8 px-4 sm:px-6 lg:px-8 max-w-[90rem] mx-auto w-full bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Promo: Bunnahabhain */}
          <div className="group flex flex-col">
            <div className="overflow-hidden mb-4 relative w-full h-[400px]">
              <img
                src="/A1.png"
                alt="Bunnahabhain Distillery"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <h3 className="text-[26px] text-[#818cf8] font-sans font-light tracking-wide mb-2">
              Bunnahabhain On Pour For Less
            </h3>
            <p className="text-[#1A1A1A] font-serif">
              Indulge in richly sherried Islay drams at special prices
            </p>
          </div>

          {/* Right Promo: Make Father's Day*/}
          <div className="group flex flex-col">
            <div className="overflow-hidden mb-4 relative w-full h-[400px]">
              <img
                src="/A1.png"
                alt="Make Father's Day"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <h3 className="text-[26px] text-[#1A1A1A] font-sans font-light tracking-wide mb-2">
              Into The Small Hours
            </h3>
            <p className="text-[#1A1A1A] font-serif">
              In-depth Father's Day chat needs a truly decent dram
            </p>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col"
          >
            <span className="text-[#C9A84C] uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block border-t-[0.5px] border-[#C9A84C] w-12 pt-2">The Story</span>
            <h2 className="text-4xl md:text-5xl font-serif text-[#1A1A1A] mb-6">About Us</h2>
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed mb-4">
              Drinqkart is a premier destination dedicated to providing an exceptional selection of fine wines, premium spirits, and craft beverages. Founded with a deep passion for quality, we pride ourselves on offering a carefully curated collection that caters to both casual enthusiasts and seasoned connoisseurs.
            </p>
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed mb-4">
              Our beautifully designed retail spaces are built to offer a sophisticated, highly organized, and effortless shopping experience for every customer. Our knowledgeable staff is always on hand to offer personalized recommendations, ensuring you find the exact bottle to suit your taste and occasion.
            </p>
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed">
              Whether you are celebrating a major milestone or simply unwinding after a long day, we are here to help you pour the perfect glass.
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full h-[500px]"
          >
            <img src="/about us image.png" alt="About Drinqkart" className="w-full h-full object-cover shadow-xl" />
          </motion.div>
        </div>
      </section>

      {/* Our Mission Section */}
      <section id="mission" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full bg-[#FAFAFA]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="w-full h-[500px] order-2 md:order-1"
          >
            <img src="/our mission image.png" alt="Our Mission" className="w-full h-full object-cover shadow-xl" />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex flex-col order-1 md:order-2"
          >
            <span className="text-[#C9A84C] uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block border-t-[0.5px] border-[#C9A84C] w-12 pt-2">The Goal</span>
            <h2 className="text-4xl md:text-5xl font-serif text-[#1A1A1A] mb-6">Our Mission</h2>
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed mb-4">
              Our mission at Drinqkart is to elevate the retail beverage experience by providing unparalleled access to the world's finest labels. We are deeply committed to fostering a culture of discovery, helping our customers explore new flavors and regions with absolute confidence.
            </p>
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed mb-4">
              Integrity and responsible service are at the core of our operations, ensuring a safe and reliable environment for our community. We strive to build lasting relationships with respected vineyards and distilleries worldwide to bring you authentic, high-quality products at competitive prices.
            </p>
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed">
              Ultimately, we aim to be more than just a retail store by acting as your trusted partner in celebrating life's most memorable moments.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stores Section */}
      <Stores />

    </div>
  );
};

export default Home;
