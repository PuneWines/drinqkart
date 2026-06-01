import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AgeVerificationModal from './components/AgeVerificationModal';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer'; // Assuming this exists or is a placeholder
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';

const AppLayout = () => {
  const { user } = useAuth();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const location = useLocation();

  const toggleCart = () => setIsCartOpen(!isCartOpen);

  // Check if we are on the login page
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="min-h-screen flex flex-col font-sans text-charcoal bg-white">
      {!isLoginPage && <AgeVerificationModal />}
      {!isLoginPage && <Navbar toggleCart={toggleCart} />}
      {!isLoginPage && <CartDrawer isOpen={isCartOpen} toggleCart={toggleCart} />}
      
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          
          {/* Login Route: redirect to home if already logged in */}
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      
      {!isLoginPage && <Footer />}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <AppLayout />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
