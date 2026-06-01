import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // { username: string, role: 'admin' | 'manager' | 'user' }

  const login = (username, password) => {
    // Hardcoded mock credentials
    const credentials = {
      admin: { password: 'admin123', role: 'admin' },
      manager: { password: 'manager123', role: 'manager' },
      user: { password: 'user123', role: 'user' },
    };

    const userRecord = credentials[username.toLowerCase()];

    if (userRecord && userRecord.password === password) {
      setUser({ username, role: userRecord.role });
      return { success: true };
    } else {
      return { success: false, message: 'Invalid username or password' };
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
