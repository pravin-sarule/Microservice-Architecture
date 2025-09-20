import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api'; // Import the API service

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem('token');
    console.log('AuthContext: Initializing token from localStorage:', storedToken ? 'Present' : 'Not Present');
    return storedToken;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    console.log('AuthContext: useEffect - storedToken:', storedToken ? 'Present' : 'Not Present');
    if (storedToken && storedToken !== token) { // Only update if different to avoid infinite loops
      setToken(storedToken);
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error('AuthContext: Failed to parse user from localStorage', e);
          setUser(null);
          localStorage.removeItem('user');
        }
      } else {
        setUser(null);
      }
    } else if (!storedToken && token) {
      // If token was in state but not in localStorage, clear state
      setToken(null);
      setUser(null);
    }
    setLoading(false);
  }, [token]); // Depend on token to react to external changes

  const login = async (email, password) => {
    try {
      const response = await api.login({ email, password });
      if (response.token) {
        setToken(response.token);
        setUser(response.user); // Assuming api.login returns user data
        localStorage.setItem('user', JSON.stringify(response.user));
        console.log('AuthContext: Login successful, new token set:', response.token);
        return { success: true, user: response.user, token: response.token };
      }
      return { success: false, message: 'Login failed: No token received.' };
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      return { success: false, message: error.message || 'Login failed.' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('AuthContext: User logged out, token cleared.');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};