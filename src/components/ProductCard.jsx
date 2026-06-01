import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';

/* ── Per-category theme tokens ───────────────────────────────────── */
const CATEGORY_THEME = {
  Whisky: {
    accent:     '#C9A84C',
    accentRgb:  '201,168,76',
    textClass:  'text-[#C9A84C]',
    borderClass:'border-[#C9A84C]',
    bgClass:    'bg-[#C9A84C]/5',
    icon: (
      <svg viewBox="0 0 64 120" fill="none" className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="4" width="16" height="22" rx="2" fill="#C9A84C" opacity="0.5"/>
        <path d="M18 26 C10 40 8 55 8 70 C8 95 18 116 32 116 C46 116 56 95 56 70 C56 55 54 40 46 26 Z" fill="#C9A84C" opacity="0.1" stroke="#C9A84C" strokeWidth="1.5"/>
        <path d="M20 60 C25 55 39 55 44 60" stroke="#C9A84C" strokeWidth="1" opacity="0.3"/>
        <path d="M16 75 C22 68 42 68 48 75" stroke="#C9A84C" strokeWidth="1" opacity="0.2"/>
        <ellipse cx="32" cy="70" rx="18" ry="6" fill="#C9A84C" opacity="0.05"/>
      </svg>
    ),
    label: 'Whisky',
  },
  Wine: {
    accent:     '#166534',
    accentRgb:  '22,101,52',
    textClass:  'text-[#166534]',
    borderClass:'border-[#166534]',
    bgClass:    'bg-[#166534]/5',
    icon: (
      <svg viewBox="0 0 64 120" fill="none" className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <rect x="26" y="4" width="12" height="30" rx="2" fill="#166534" opacity="0.4"/>
        <path d="M14 34 Q14 70 32 80 Q50 70 50 34 Z" fill="#166534" opacity="0.1" stroke="#166534" strokeWidth="1.5"/>
        <rect x="29" y="80" width="6" height="30" rx="1" fill="#166534" opacity="0.3"/>
        <ellipse cx="32" cy="110" rx="12" ry="3" fill="#166534" opacity="0.1"/>
      </svg>
    ),
    label: 'Wine',
  },
  Beer: {
    accent:     '#D97706',
    accentRgb:  '217,119,6',
    textClass:  'text-[#D97706]',
    borderClass:'border-[#D97706]',
    bgClass:    'bg-[#D97706]/5',
    icon: (
      <svg viewBox="0 0 80 120" fill="none" className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <rect x="18" y="30" width="36" height="80" rx="4" fill="#D97706" opacity="0.1" stroke="#D97706" strokeWidth="1.5"/>
        <path d="M54 45 Q72 45 72 62 Q72 78 54 78" stroke="#D97706" strokeWidth="2" fill="none" opacity="0.4"/>
        <rect x="18" y="30" width="36" height="20" rx="2" fill="#D97706" opacity="0.2"/>
        <path d="M24 55 Q32 50 46 55 Q54 60 46 65 Q32 70 24 65 Z" fill="#D97706" opacity="0.1"/>
      </svg>
    ),
    label: 'Beer',
  },
  Gin: {
    accent:     '#4F46E5',
    accentRgb:  '79,70,229',
    textClass:  'text-[#4F46E5]',
    borderClass:'border-[#4F46E5]',
    bgClass:    'bg-[#4F46E5]/5',
    icon: (
      <svg viewBox="0 0 64 120" fill="none" className="w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
        <rect x="26" y="4" width="12" height="18" rx="2" fill="#4F46E5" opacity="0.5"/>
        <path d="M20 22 L16 50 L16 100 Q16 116 32 116 Q48 116 48 100 L48 50 L44 22 Z" fill="#4F46E5" opacity="0.1" stroke="#4F46E5" strokeWidth="1.5"/>
        <ellipse cx="32" cy="65" rx="14" ry="4" fill="#4F46E5" opacity="0.1"/>
        <line x1="32" y1="4" x2="32" y2="22" stroke="#4F46E5" strokeWidth="2" opacity="0.3"/>
      </svg>
    ),
    label: 'Gin',
  },
};

/* ── Fallback Placeholder ─────────────────────────────────────────── */
const ImageFallback = ({ category, name }) => {
  const theme = CATEGORY_THEME[category] || CATEGORY_THEME.Whisky;

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center select-none ${theme.bgClass}`}
      style={{
        background: `radial-gradient(ellipse at 40% 30%, rgba(${theme.accentRgb},0.08) 0%, #FAFAFA 70%)`,
      }}
    >
      {/* SVG bottle silhouette */}
      <div className="w-20 h-28 mb-3">{theme.icon}</div>

      {/* Category pill */}
      <span
        className="text-[9px] uppercase tracking-[0.25em] px-3 py-1 border-[0.5px] mb-2 font-sans bg-white/50 backdrop-blur-sm"
        style={{ color: theme.accent, borderColor: `${theme.accent}33` }}
      >
        {theme.label}
      </span>

      {/* Product name (truncated) */}
      <p className="text-[10px] text-[#1A1A1A]/50 font-sans text-center px-4 leading-tight line-clamp-2 max-w-[140px]">
        {name}
      </p>
    </div>
  );
};

/* ── ProductCard ──────────────────────────────────────────────────── */
const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const [imgError, setImgError] = useState(false);

  const theme = CATEGORY_THEME[product.category] || CATEGORY_THEME.Whisky;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col bg-white border-[0.5px] border-[#1A1A1A]/10 hover:border-[#C9A84C]/50 transition-all duration-500 overflow-hidden relative hover:-translate-y-1 shadow-sm hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
    >

      {/* ── Top badges ── */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
        {product.badge && (
          <span className="bg-white/90 text-[#1A1A1A] text-[9px] uppercase tracking-[0.18em] px-2.5 py-1 border-[0.5px] border-[#1A1A1A]/20 backdrop-blur-sm shadow-sm font-semibold">
            {product.badge}
          </span>
        )}
      </div>

      {!product.inStock && (
        <div className="absolute top-3 right-3 z-20">
          <span className="bg-red-50 text-red-700 text-[9px] uppercase tracking-[0.15em] px-2 py-1 border-[0.5px] border-red-200 backdrop-blur-sm shadow-sm font-semibold">
            Out of Stock
          </span>
        </div>
      )}

      {/* ── Image / Fallback area ── */}
      <div className={`relative w-full aspect-[4/5] overflow-hidden bg-[#FAFAFA] border-b-[0.5px] border-[#1A1A1A]/5`}>

        {/* Real image — hidden when errored */}
        {!imgError && (
          <img
            src={product.imageUrl}
            alt={product.name}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 ${
              !product.inStock ? 'opacity-90' : 'opacity-100'
            }`}
            loading="lazy"
          />
        )}

        {/* Fallback (shown on error) */}
        {imgError && <ImageFallback category={product.category} name={product.name} />}

        {/* Subtle white gradient overlay at bottom for text legibility if needed */}
        <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-white/60 to-transparent pointer-events-none z-10" />

        {/* Sub-category pill — bottom left */}
        <span
          className={`absolute bottom-3 left-3 z-20 text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 border-[0.5px] backdrop-blur-md bg-white/80 font-semibold shadow-sm ${theme.textClass} ${theme.borderClass}`}
        >
          {product.subCategory}
        </span>

        {/* Quick-add button — bottom right, hover only, in-stock only */}
        {product.inStock && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); addToCart(product); }}
            className="absolute bottom-3 right-3 z-20 w-9 h-9 bg-[#C9A84C] text-white flex items-center justify-center opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:bg-[#1A1A1A] rounded-[2px] shadow-lg"
            aria-label="Add to cart"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* ── Text content ── */}
      <div className="p-5 flex flex-col flex-1 bg-white">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#1A1A1A]/40 mb-1 font-sans font-medium">{product.brand}</p>

        <h3 className="font-serif text-[#1A1A1A] text-lg leading-snug mb-3 line-clamp-2 flex-1 font-semibold">
          {product.name}
        </h3>

        {/* Tasting-note pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {product.tastingNotes.slice(0, 2).map((note, i) => (
            <span key={i} className="text-[9px] text-[#1A1A1A]/60 bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/10 px-1.5 py-0.5 font-sans">
              {note}
            </span>
          ))}
          {product.tastingNotes.length > 2 && (
            <span className="text-[9px] text-[#1A1A1A]/40 px-1 py-0.5 font-sans">
              +{product.tastingNotes.length - 2}
            </span>
          )}
        </div>

        {/* Price row */}
        <div className="flex items-end justify-between pt-4 border-t-[0.5px] border-[#1A1A1A]/10">
          <div>
            <p className="font-serif text-[#C9A84C] text-xl leading-none font-bold">
              ₹{product.price.toLocaleString()}
            </p>
            {product.originalPrice > product.price && (
              <p className="text-[10px] text-[#1A1A1A]/40 line-through mt-0.5 font-sans">
                ₹{product.originalPrice.toLocaleString()}
              </p>
            )}
          </div>

          {!product.inStock && (
            <span className="flex items-center gap-1 text-[10px] text-[#1A1A1A]/40 uppercase tracking-widest font-sans font-medium">
              <ShoppingBag className="w-3 h-3" /> Sold Out
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
