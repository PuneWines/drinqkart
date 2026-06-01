import React, { useState } from 'react';
import { X, Plus, Minus, ArrowRight, Trash2, CheckCircle2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

const CartDrawer = ({ isOpen, toggleCart }) => {
  const { cartItems, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const handleCheckout = () => {
    setIsCheckingOut(true);
    // Simulate API call
    setTimeout(() => {
      setIsCheckingOut(false);
      setCheckoutSuccess(true);
      
      // Auto-close and clear after success
      setTimeout(() => {
        setCheckoutSuccess(false);
        clearCart();
        toggleCart();
      }, 2500);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-[#1A1A1A]/30 backdrop-blur-sm z-50"
            onClick={toggleCart}
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col border-l-[0.5px] border-[#1A1A1A]/10"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b-[0.5px] border-[#1A1A1A]/10 bg-[#FAFAFA]">
              <div>
                <h2 className="text-2xl font-serif text-[#1A1A1A] font-bold">Your Cellar</h2>
                <p className="text-[10px] uppercase tracking-widest text-[#1A1A1A]/50 mt-1 font-semibold">{cartItems.length} Vintages Selected</p>
              </div>
              <button 
                onClick={toggleCart} 
                className="p-2 text-[#1A1A1A]/50 hover:text-[#1A1A1A] hover:bg-white border-[0.5px] border-transparent hover:border-[#1A1A1A]/10 transition-colors rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-[#1A1A1A]/20">
              {cartItems.length === 0 && !checkoutSuccess ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center space-y-6"
                >
                  <div className="w-20 h-20 bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/10 flex items-center justify-center rounded-full shadow-sm">
                    <span className="text-3xl opacity-40">🍷</span>
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl text-[#1A1A1A] mb-2 font-bold">Your Cellar is Empty</h3>
                    <p className="text-sm text-[#1A1A1A]/50 font-medium">Discover our collection of rare finds.</p>
                  </div>
                  <button onClick={toggleCart} className="btn-ghost text-xs px-8 py-3 bg-[#FAFAFA]">
                    Explore Collection
                  </button>
                </motion.div>
              ) : checkoutSuccess ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center justify-center h-full text-center"
                >
                  <div className="text-[#166534] mb-6">
                    <CheckCircle2 className="w-20 h-20 mx-auto stroke-1" />
                  </div>
                  <h3 className="font-serif text-3xl text-[#1A1A1A] mb-2 font-bold">Order Confirmed</h3>
                  <p className="text-sm text-[#1A1A1A]/50 mb-8 max-w-[250px] mx-auto font-medium">Your exquisite selections are being prepared for delivery.</p>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex gap-4 group">
                      {/* Image Thumbnail */}
                      <div className="w-20 h-28 bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/10 relative overflow-hidden flex-shrink-0 shadow-sm">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent"></div>
                      </div>
                      
                      {/* Item Details */}
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[9px] uppercase tracking-[0.2em] text-[#C9A84C] font-bold">{item.brand}</span>
                            <h4 className="font-serif text-lg text-[#1A1A1A] leading-tight mt-1 line-clamp-2 font-bold">{item.name}</h4>
                          </div>
                          <button 
                            onClick={() => removeFromCart(item.id)}
                            className="text-[#1A1A1A]/30 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="flex justify-between items-end mt-4">
                          <div className="flex items-center bg-[#FAFAFA] border-[0.5px] border-[#1A1A1A]/10 rounded-sm">
                            <button 
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs text-[#1A1A1A] font-medium">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="font-serif text-lg text-[#1A1A1A] font-bold">
                            ₹{(item.price * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / Checkout */}
            {cartItems.length > 0 && !checkoutSuccess && (
              <div className="border-t-[0.5px] border-[#1A1A1A]/10 bg-[#FAFAFA] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-xs text-[#1A1A1A]/60 font-medium">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-[#1A1A1A]/60 font-medium">
                    <span>Shipping</span>
                    <span>Complimentary</span>
                  </div>
                  <div className="flex justify-between items-end pt-4 border-t-[0.5px] border-[#1A1A1A]/10">
                    <span className="text-[10px] uppercase tracking-widest text-[#1A1A1A]/60 font-bold">Total</span>
                    <span className="font-serif text-3xl text-[#C9A84C] font-bold">₹{cartTotal.toLocaleString()}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full btn-gold py-4 flex items-center justify-center gap-2 relative overflow-hidden shadow-lg shadow-[#C9A84C]/20"
                >
                  {isCheckingOut ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      <span>Secure Checkout</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
