import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Star, Droplets, MapPin, Wine, Beaker, Plus, Minus, ArrowRight } from 'lucide-react';
import { products } from '../data/products';
import { useCart } from '../context/CartContext';
import ProductCard from '../components/ProductCard';
import { motion } from 'framer-motion';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState(null);
  const [suggestedProducts, setSuggestedProducts] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const found = products.find(p => p.id === parseInt(id));
    if (found) {
      setProduct(found);
      setQuantity(1);
      
      // Find 4 suggested products from same category, excluding current
      const suggestions = products
        .filter(p => p.category === found.category && p.id !== found.id)
        .slice(0, 4);
      
      // If not enough in category, pad with top rated
      if (suggestions.length < 4) {
        const fillers = products
          .filter(p => p.id !== found.id && !suggestions.includes(p))
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 4 - suggestions.length);
        setSuggestedProducts([...suggestions, ...fillers]);
      } else {
        setSuggestedProducts(suggestions);
      }
    }
  }, [id]);

  if (!product) return null; // Or a loading spinner

  const handleAddToCart = () => {
    // Add multiple quantities
    for(let i=0; i<quantity; i++) {
      addToCart(product);
    }
    // Optionally open cart drawer here if we passed the toggle function
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* ── Top Navigation Bar ── */}
      <div className="border-b-[0.5px] border-[#1A1A1A]/10 bg-[#FAFAFA] sticky top-20 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-[#1A1A1A]/50 hover:text-[#C9A84C] text-[10px] uppercase tracking-widest transition-colors font-bold"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Cellar
          </button>
        </div>
      </div>

      {/* ── Main Product Section ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
          
          {/* Left: Image */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="relative h-[60vh] lg:h-[80vh] bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/10 flex items-center justify-center p-8 shadow-sm"
          >
            {/* Subtle background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#C9A84C10_0%,_transparent_70%)] pointer-events-none"></div>
            
            <img 
              src={product.imageUrl} 
              alt={product.name} 
              className="relative z-10 max-w-full max-h-full object-contain drop-shadow-2xl"
            />
            
            {/* Badges */}
            <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
              {product.badge && (
                <span className="bg-white/90 text-[#1A1A1A] text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 border-[0.5px] border-[#1A1A1A]/20 backdrop-blur-md shadow-sm font-bold">
                  {product.badge}
                </span>
              )}
            </div>
          </motion.div>

          {/* Right: Product Details */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col justify-center"
          >
            {/* Breadcrumb / Category */}
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#1A1A1A]/40 mb-6 font-bold">
              <Link to="/shop" className="hover:text-[#C9A84C] transition-colors">Shop</Link>
              <span>/</span>
              <Link to={`/shop?category=${product.category}`} className="hover:text-[#C9A84C] transition-colors">{product.category}</Link>
              <span>/</span>
              <span className="text-[#C9A84C]">{product.brand}</span>
            </div>

            <h1 className="text-4xl lg:text-6xl font-serif text-[#1A1A1A] mb-4 leading-[1.1] font-bold">
              {product.name}
            </h1>
            
            {/* Rating & Reviews */}
            <div className="flex items-center gap-4 mb-8 pb-8 border-b-[0.5px] border-[#1A1A1A]/10">
              <div className="flex items-center gap-1 text-[#C9A84C]">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium ml-1">{product.rating}</span>
              </div>
              <span className="text-[#1A1A1A]/20">|</span>
              <span className="text-xs text-[#1A1A1A]/50 uppercase tracking-wider font-medium">{product.reviewCount} Reviews</span>
            </div>

            <p className="text-[#1A1A1A]/70 text-lg mb-12 font-sans leading-relaxed">
              {product.description}
            </p>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-y-8 gap-x-12 mb-12 bg-[#FAFAFA] p-8 border-[0.5px] border-[#1A1A1A]/10 shadow-sm">
              <div className="flex items-start gap-4">
                <MapPin className="w-5 h-5 text-[#C9A84C] mt-0.5" />
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 mb-1 font-bold">Origin</span>
                  <span className="text-[#1A1A1A] font-medium">{product.region}, {product.origin}</span>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Beaker className="w-5 h-5 text-[#C9A84C] mt-0.5" />
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 mb-1 font-bold">ABV</span>
                  <span className="text-[#1A1A1A] font-medium">{product.ABV}%</span>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Wine className="w-5 h-5 text-[#C9A84C] mt-0.5" />
                <div>
                  <span className="block text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 mb-1 font-bold">Style</span>
                  <span className="text-[#1A1A1A] font-medium">{product.subCategory}</span>
                </div>
              </div>
              {product.age && (
                <div className="flex items-start gap-4">
                  <span className="font-serif italic text-[#C9A84C] text-xl leading-none mt-0.5">{product.age}</span>
                  <div>
                    <span className="block text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 mb-1 font-bold">Aged</span>
                    <span className="text-[#1A1A1A] font-medium">{product.age} Years</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tasting Notes */}
            <div className="mb-12">
              <span className="block text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 mb-4 font-bold">Tasting Profile</span>
              <div className="flex flex-wrap gap-2">
                {product.tastingNotes.map((note, idx) => (
                  <span key={idx} className="bg-white border-[0.5px] border-[#1A1A1A]/20 text-[#1A1A1A]/70 text-xs px-4 py-2 font-medium shadow-sm">
                    {note}
                  </span>
                ))}
              </div>
            </div>

            {/* Price & Add to Cart Area */}
            <div className="pt-8 border-t-[0.5px] border-[#1A1A1A]/10 flex flex-col sm:flex-row gap-6 items-start sm:items-end justify-between">
              <div>
                <span className="block text-[9px] uppercase tracking-widest text-[#1A1A1A]/40 mb-2 font-bold">Current Value</span>
                <div className="flex items-end gap-4">
                  <span className="font-serif text-5xl text-[#C9A84C] leading-none font-bold">
                    ₹{product.price.toLocaleString()}
                  </span>
                  {product.originalPrice > product.price && (
                    <span className="text-lg text-[#1A1A1A]/30 line-through mb-1 font-medium">
                      ₹{product.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {product.inStock ? (
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  {/* Quantity Selector */}
                  <div className="flex items-center bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/20 h-14 rounded-sm shadow-sm">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-full flex items-center justify-center text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-[#1A1A1A] font-medium">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-full flex items-center justify-center text-[#1A1A1A]/50 hover:text-[#1A1A1A] transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Add Button */}
                  <button 
                    onClick={handleAddToCart}
                    className="flex-1 sm:flex-none btn-gold h-14 px-8 flex items-center justify-center gap-3 shadow-lg shadow-[#C9A84C]/20"
                  >
                    <span>Acquire</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="bg-red-50 border-[0.5px] border-red-200 text-red-700 px-8 h-14 flex items-center uppercase tracking-widest text-xs font-bold shadow-sm">
                  Currently Unavailable
                </div>
              )}
            </div>
            
          </motion.div>
        </div>
      </div>

      {/* ── Suggestions Section ── */}
      {suggestedProducts.length > 0 && (
        <div className="border-t-[0.5px] border-[#1A1A1A]/10 bg-[#FAFAFA] pt-24 pb-12 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <span className="text-[#C9A84C] uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block border-t-[0.5px] border-[#C9A84C] w-12 pt-2">Similar</span>
                <h2 className="text-3xl font-serif text-[#1A1A1A] font-bold">Curated Matches</h2>
              </div>
              <Link to={`/shop?category=${product.category}`} className="text-[#1A1A1A]/50 hover:text-[#C9A84C] transition-colors text-xs uppercase tracking-widest pb-2 font-bold">
                View Category &rarr;
              </Link>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {suggestedProducts.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <ProductCard product={p} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
