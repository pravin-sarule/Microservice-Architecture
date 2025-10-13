// import React, { createContext, useContext, useState, useEffect } from 'react';
// import api from '../services/api'; // Import the API service

// const AuthContext = createContext(null);

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [token, setToken] = useState(() => {
//     const storedToken = localStorage.getItem('token');
//     console.log('AuthContext: Initializing token from localStorage:', storedToken ? 'Present' : 'Not Present');
//     return storedToken;
//   });
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedToken = localStorage.getItem('token');
//     console.log('AuthContext: useEffect - storedToken:', storedToken ? 'Present' : 'Not Present');
//     if (storedToken && storedToken !== token) { // Only update if different to avoid infinite loops
//       setToken(storedToken);
//       const storedUser = localStorage.getItem('user');
//       if (storedUser) {
//         try {
//           setUser(JSON.parse(storedUser));
//         } catch (e) {
//           console.error('AuthContext: Failed to parse user from localStorage', e);
//           setUser(null);
//           localStorage.removeItem('user');
//         }
//       } else {
//         setUser(null);
//       }
//     } else if (!storedToken && token) {
//       // If token was in state but not in localStorage, clear state
//       setToken(null);
//       setUser(null);
//     }
//     setLoading(false);
//   }, [token]); // Depend on token to react to external changes

//   const login = async (email, password) => {
//     try {
//       const response = await api.login({ email, password });
//       console.log('AuthContext: Response from api.login:', response);

//       if (response.requiresOtp) {
//         console.log('AuthContext: Backend requires OTP for login.');
//         return { success: false, requiresOtp: true, email: email, message: response.message || 'OTP required. Please check your email.' };
//       }
//       if (response.token) {
//         setToken(response.token);
//         setUser(response.user);
//         localStorage.setItem('user', JSON.stringify(response.user));
//         console.log('AuthContext: Login successful, new token set:', response.token);
//         return { success: true, user: response.user, token: response.token };
//       }
//       return { success: false, message: response.message || 'Login failed: No token received.' };
//     } catch (error) {
//       console.error('AuthContext: Login failed:', error);
//       return { success: false, message: error.message || 'Login failed.' };
//     }
//   };

//   const verifyOtp = async (email, otp) => {
//     try {
//       const response = await api.verifyOtp(email, otp);
//       if (response.token) {
//         setToken(response.token);
//         setUser(response.user);
//         localStorage.setItem('user', JSON.stringify(response.user));
//         console.log('AuthContext: OTP verification successful, new token set:', response.token);
//         return { success: true, user: response.user, token: response.token };
//       }
//       return { success: false, message: response.message || 'OTP verification failed.' };
//     } catch (error) {
//       console.error('AuthContext: OTP verification failed:', error);
//       return { success: false, message: error.message || 'OTP verification failed.' };
//     }
//   };

//   const logout = () => {
//     setUser(null);
//     setToken(null);
//     localStorage.removeItem('token');
//     localStorage.removeItem('user');
//     console.log('AuthContext: User logged out, token cleared.');
//   };

//   return (
//     <AuthContext.Provider value={{ user, token, loading, login, logout, verifyOtp }}>
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   return useContext(AuthContext);
// };


import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

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
    if (storedToken) {
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
      }
    }
    setLoading(false);
  }, []); // Run only once on mount

  const login = async (email, password) => {
    try {
      const response = await api.login({ email, password });
      console.log('AuthContext: Response from api.login:', response);

      // Check if OTP is required
      if (response.requiresOtp || response.requires_otp || response.data?.requiresOtp) {
        console.log('AuthContext: Backend requires OTP for login.');
        return { 
          success: false, 
          requiresOtp: true, 
          email: email, 
          message: response.message || response.data?.message || 'OTP required. Please check your email.' 
        };
      }

      // Check for token in response
      const receivedToken = response.token || response.data?.token;
      const receivedUser = response.user || response.data?.user;

      if (receivedToken) {
        setToken(receivedToken);
        setUser(receivedUser);
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));
        console.log('AuthContext: Login successful, new token set:', receivedToken);
        return { success: true, user: receivedUser, token: receivedToken };
      }

      return { success: false, message: response.message || 'Login failed: No token received.' };
    } catch (error) {
      console.error('AuthContext: Login failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Login failed.';
      return { success: false, message: errorMessage };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const response = await api.verifyOtp(email, otp);
      console.log('AuthContext: Response from api.verifyOtp:', response);
      
      const receivedToken = response.token || response.data?.token;
      const receivedUser = response.user || response.data?.user;

      if (receivedToken) {
        setToken(receivedToken);
        setUser(receivedUser);
        localStorage.setItem('token', receivedToken);
        localStorage.setItem('user', JSON.stringify(receivedUser));
        console.log('AuthContext: OTP verification successful, new token set:', receivedToken);
        return { success: true, user: receivedUser, token: receivedToken };
      }

      return { 
        success: false, 
        message: response.message || response.data?.message || 'OTP verification failed.' 
      };
    } catch (error) {
      console.error('AuthContext: OTP verification failed:', error);
      const errorMessage = error.response?.data?.message || error.message || 'OTP verification failed.';
      return { success: false, message: errorMessage };
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
    <AuthContext.Provider value={{ user, token, loading, login, logout, verifyOtp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};