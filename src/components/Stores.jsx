import React from 'react';
import { motion } from 'framer-motion';

const storesData = [
  {
    id: 1,
    title: 'THE LIQUOR STORY - KUNAL WINE',
    image: '/Kunal wine frunt side image.png',
    address: 'Kunal Fine wine South Seas Dist.& Shop No.15&16 Plot No.168 Mahaveer Mannat Panvel',
    mapLink: 'https://www.google.com/search?q=THE+LIQUOR+STORY+KUNAL+WINE+Mahaveer+Mannat+Panvel'
  },
  {
    id: 2,
    title: 'THE LIQUOR STORY - VISHAL WINE',
    image: '',
    address: 'Maga Police Saphron Building No A7 Shop No 1/2 Rajiv Gandhi Infotech Park Hinjewadi Phase 3',
    mapLink: 'https://www.google.com/search?q=THE+LIQUOR+STORY+VISHAL+WINE+Hinjewadi+Phase+3'
  }
];

const Stores = () => {
  return (
    <section id="stores" className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full bg-white">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <span className="text-[#C9A84C] uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block border-t-[0.5px] border-[#C9A84C] w-12 pt-2">Locations</span>
        <h2 className="text-4xl md:text-5xl font-serif text-[#1A1A1A]">Stores</h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {storesData.map((store, idx) => (
          <motion.div 
            key={store.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            className="flex flex-col group"
          >
            <h3 className="text-2xl font-serif text-[#1A1A1A] mb-4 uppercase tracking-wide">
              {store.title}
            </h3>
            
            <div className="overflow-hidden mb-6 relative w-full h-[400px] bg-gray-100">
              {store.image && (
                <img
                  src={store.image}
                  alt={store.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 shadow-xl"
                />
              )}
            </div>
            
            <p className="text-[#1A1A1A]/70 text-sm leading-relaxed mb-6 h-16">
              {store.address}
            </p>
            
            <a 
              href={store.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center w-full md:w-auto px-8 py-3 border border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white transition-colors duration-300 font-sans text-xs uppercase tracking-widest"
            >
              View Map
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default Stores;
