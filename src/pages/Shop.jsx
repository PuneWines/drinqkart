import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Filter, X, ChevronDown, Star } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { products } from '../data/products';
import { motion, AnimatePresence } from 'framer-motion';

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc',  label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating',    label: 'Top Rated' },
  { value: 'newest',    label: 'Newest' },
];

const ALL_CATEGORIES = [...new Set(products.map(p => p.category))];
const ALL_ORIGINS    = ['All', ...new Set(products.map(p => p.origin))];
const MAX_PRICE      = 40000;
const MAX_ABV        = 50;

/* ──────────────── Sidebar content (shared between desktop & mobile) ──────── */
const FilterPanel = ({
  selectedCategories, toggleCategory,
  priceMax, setPriceMax,
  abvMax, setAbvMax,
  minRating, setMinRating,
  selectedOrigin, setSelectedOrigin,
  onClear,
}) => (
  <div className="space-y-10">
    {/* Categories */}
    <div>
      <h3 className="font-serif text-[#1A1A1A] text-lg mb-5 pb-3 border-b-[0.5px] border-[#1A1A1A]/10 font-bold">Category</h3>
      <div className="space-y-3">
        {ALL_CATEGORIES.map(cat => {
          const dotColor = { Whisky: 'bg-[#C9A84C]', Wine: 'bg-[#166534]', Beer: 'bg-[#D97706]', Gin: 'bg-[#4F46E5]' }[cat] || 'bg-[#1A1A1A]';
          return (
            <label key={cat} className="flex items-center gap-3 cursor-pointer group">
              <span
                onClick={() => toggleCategory(cat)}
                className={`w-4 h-4 border-[0.5px] flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                  selectedCategories.includes(cat)
                    ? 'bg-[#C9A84C] border-[#C9A84C]'
                    : 'bg-white border-[#1A1A1A]/20 group-hover:border-[#1A1A1A]/50'
                }`}
              >
                {selectedCategories.includes(cat) && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className={`text-sm transition-colors flex items-center gap-2 font-medium ${selectedCategories.includes(cat) ? 'text-[#1A1A1A]' : 'text-[#1A1A1A]/60 group-hover:text-[#1A1A1A]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} inline-block`}></span>
                {cat}
              </span>
            </label>
          );
        })}
      </div>
    </div>

    {/* Price Range */}
    <div>
      <h3 className="font-serif text-[#1A1A1A] text-lg mb-5 pb-3 border-b-[0.5px] border-[#1A1A1A]/10 font-bold">Price Range (₹)</h3>
      <input
        type="range"
        min="0" max={MAX_PRICE} step="500"
        value={priceMax}
        onChange={e => setPriceMax(Number(e.target.value))}
        className="w-full h-[2px] bg-[#1A1A1A]/10 appearance-none cursor-pointer accent-[#C9A84C] rounded-none"
        style={{ background: `linear-gradient(to right, #C9A84C ${(priceMax/MAX_PRICE)*100}%, rgba(26,26,26,0.1) 0%)` }}
      />
      <div className="flex justify-between mt-3 text-xs text-[#1A1A1A]/50 font-sans font-medium">
        <span>₹0</span>
        <span className="text-[#C9A84C] font-bold">Up to ₹{priceMax.toLocaleString()}</span>
      </div>
    </div>

    {/* ABV Range */}
    <div>
      <h3 className="font-serif text-[#1A1A1A] text-lg mb-5 pb-3 border-b-[0.5px] border-[#1A1A1A]/10 font-bold">ABV %</h3>
      <input
        type="range"
        min="0" max={MAX_ABV} step="1"
        value={abvMax}
        onChange={e => setAbvMax(Number(e.target.value))}
        className="w-full h-[2px] appearance-none cursor-pointer rounded-none bg-[#1A1A1A]/10"
        style={{ background: `linear-gradient(to right, #C9A84C ${(abvMax/MAX_ABV)*100}%, rgba(26,26,26,0.1) 0%)` }}
      />
      <div className="flex justify-between mt-3 text-xs text-[#1A1A1A]/50 font-sans font-medium">
        <span>0%</span>
        <span className="text-[#C9A84C] font-bold">Up to {abvMax}%</span>
      </div>
    </div>

    {/* Min Rating (Star Selector) */}
    <div>
      <h3 className="font-serif text-[#1A1A1A] text-lg mb-5 pb-3 border-b-[0.5px] border-[#1A1A1A]/10 font-bold">Min Rating</h3>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => setMinRating(minRating === star ? 0 : star)}
            className={`transition-all duration-200 ${star <= minRating ? 'text-[#C9A84C] scale-110' : 'text-[#1A1A1A]/20 hover:text-[#1A1A1A]/40'}`}
          >
            <Star className="w-5 h-5" fill={star <= minRating ? '#C9A84C' : 'none'} strokeWidth={1} />
          </button>
        ))}
        {minRating > 0 && (
          <span className="text-[10px] text-[#1A1A1A]/40 ml-1 self-center font-bold">{minRating}+ stars</span>
        )}
      </div>
    </div>

    {/* Origin */}
    <div>
      <h3 className="font-serif text-[#1A1A1A] text-lg mb-5 pb-3 border-b-[0.5px] border-[#1A1A1A]/10 font-bold">Origin</h3>
      <div className="relative">
        <select
          value={selectedOrigin}
          onChange={e => setSelectedOrigin(e.target.value)}
          className="w-full bg-white border-[0.5px] border-[#1A1A1A]/20 text-[#1A1A1A] text-sm p-3 pr-8 appearance-none focus:outline-none focus:border-[#C9A84C] cursor-pointer transition-colors shadow-sm"
        >
          {ALL_ORIGINS.map(o => (
            <option key={o} value={o} className="bg-white">{o}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-[#1A1A1A]/40 pointer-events-none" />
      </div>
    </div>

    {/* Clear */}
    <button
      onClick={onClear}
      className="w-full text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A]/50 hover:text-[#1A1A1A] py-3 border-[0.5px] border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30 transition-colors font-bold bg-[#FAFAFA] hover:bg-white"
    >
      Clear All Filters
    </button>
  </div>
);

/* ──────────────── Main Page ──────────────── */
const Shop = () => {
  const location  = useLocation();
  const initCat   = new URLSearchParams(location.search).get('category');

  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sortOption,        setSortOption]        = useState('relevance');
  const [selectedCategories, setCategories]       = useState(initCat ? [initCat] : []);
  const [priceMax,           setPriceMax]          = useState(MAX_PRICE);
  const [abvMax,             setAbvMax]            = useState(MAX_ABV);
  const [minRating,          setMinRating]         = useState(0);
  const [selectedOrigin,     setSelectedOrigin]    = useState('All');

  const toggleCategory = (cat) =>
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);

  const clearAll = () => {
    setCategories([]);
    setPriceMax(MAX_PRICE);
    setAbvMax(MAX_ABV);
    setMinRating(0);
    setSelectedOrigin('All');
    setSortOption('relevance');
  };

  const filtered = useMemo(() => {
    let list = products.filter(p => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.category)) return false;
      if (p.price > priceMax) return false;
      if (p.ABV  > abvMax)   return false;
      if (p.rating < minRating) return false;
      if (selectedOrigin !== 'All' && p.origin !== selectedOrigin) return false;
      return true;
    });

    switch (sortOption) {
      case 'price_asc':  list = [...list].sort((a, b) => a.price  - b.price);  break;
      case 'price_desc': list = [...list].sort((a, b) => b.price  - a.price);  break;
      case 'rating':     list = [...list].sort((a, b) => b.rating - a.rating); break;
      case 'newest':     list = [...list].sort((a, b) => b.id     - a.id);     break;
      default: break; // relevance = original order
    }
    return list;
  }, [selectedCategories, priceMax, abvMax, minRating, selectedOrigin, sortOption]);

  const activeFilterCount = [
    selectedCategories.length > 0,
    priceMax < MAX_PRICE,
    abvMax   < MAX_ABV,
    minRating > 0,
    selectedOrigin !== 'All',
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 py-12 flex gap-10">

        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-28 bg-[#FAFAFA] p-6 border-[0.5px] border-[#1A1A1A]/10 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#1A1A1A]/50 font-bold">Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-[#C9A84C] text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-sm">{activeFilterCount}</span>
              )}
            </div>
            <FilterPanel
              selectedCategories={selectedCategories} toggleCategory={toggleCategory}
              priceMax={priceMax} setPriceMax={setPriceMax}
              abvMax={abvMax} setAbvMax={setAbvMax}
              minRating={minRating} setMinRating={setMinRating}
              selectedOrigin={selectedOrigin} setSelectedOrigin={setSelectedOrigin}
              onClear={clearAll}
            />
          </div>
        </aside>

        {/* ── Main Content ── */}
        <div className="flex-1 min-w-0">

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4 border-b-[0.5px] border-[#1A1A1A]/10 pb-8">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#C9A84C] mb-2 block font-bold">The Cellar</span>
              <h1 className="text-5xl font-serif text-[#1A1A1A] font-bold">All Collections</h1>
              <p className="text-[#1A1A1A]/50 text-xs mt-2 font-sans font-medium">{filtered.length} bottles available</p>
            </div>

            {/* Mobile filter button + sort */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileFilterOpen(true)}
                className="lg:hidden flex items-center gap-2 bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/20 text-[#1A1A1A]/80 text-xs uppercase tracking-widest px-4 py-2.5 hover:border-[#C9A84C] hover:text-[#C9A84C] transition-colors relative font-bold shadow-sm"
              >
                <Filter className="w-3.5 h-3.5" /> Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#C9A84C] text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold shadow-sm">{activeFilterCount}</span>
                )}
              </button>

              <div className="relative flex items-center gap-2 border-[0.5px] border-[#1A1A1A]/20 px-3 py-2.5 bg-[#FAFAFA] shadow-sm">
                <span className="text-[10px] text-[#1A1A1A]/50 uppercase tracking-widest hidden sm:inline font-bold">Sort</span>
                <select
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value)}
                  className="bg-transparent text-[#1A1A1A] text-xs font-sans appearance-none focus:outline-none cursor-pointer pr-5 font-semibold"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} className="bg-white">{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#1A1A1A]/40 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Product Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((product, idx) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/10 rounded-sm">
              <div className="w-16 h-16 border-[0.5px] border-[#1A1A1A]/10 bg-white flex items-center justify-center mb-6 rounded-full shadow-sm">
                <Filter className="w-6 h-6 text-[#1A1A1A]/30" />
              </div>
              <h3 className="font-serif text-2xl text-[#1A1A1A] mb-3 font-bold">No vintages found</h3>
              <p className="text-[#1A1A1A]/50 text-sm mb-8 max-w-xs font-medium">Try adjusting your filters to discover more from our collection.</p>
              <button onClick={clearAll} className="btn-ghost text-xs px-8 py-3 bg-white">
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile Filter Drawer ── */}
      <AnimatePresence>
        {mobileFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[#1A1A1A]/20 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileFilterOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.35 }}
              className="fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-2xl flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b-[0.5px] border-[#1A1A1A]/10 bg-[#FAFAFA] flex-shrink-0">
                <span className="font-serif text-[#1A1A1A] text-xl font-bold">Filters</span>
                <button onClick={() => setMobileFilterOpen(false)} className="text-[#1A1A1A]/50 hover:text-[#1A1A1A]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <FilterPanel
                  selectedCategories={selectedCategories} toggleCategory={toggleCategory}
                  priceMax={priceMax} setPriceMax={setPriceMax}
                  abvMax={abvMax} setAbvMax={setAbvMax}
                  minRating={minRating} setMinRating={setMinRating}
                  selectedOrigin={selectedOrigin} setSelectedOrigin={setSelectedOrigin}
                  onClear={clearAll}
                />
              </div>
              <div className="px-6 py-4 border-t-[0.5px] border-[#1A1A1A]/10 bg-[#FAFAFA] flex-shrink-0">
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="btn-gold w-full py-3 text-xs shadow-md"
                >
                  Show {filtered.length} Results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Shop;
