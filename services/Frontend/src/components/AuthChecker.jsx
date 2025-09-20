import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Import useAuth

const AuthChecker = ({ children }) => {
  const navigate = useNavigate();
  const { token, loading } = useAuth(); // Get token and loading state from AuthContext

  useEffect(() => {
    // Only check for token and redirect if authentication state has finished loading
    if (!loading && !token) {
      navigate('/login');
    }
  }, [token, loading, navigate]); // Add token and loading to dependency array

  // Render children only when authentication state is loaded
  if (loading) {
    return <div>Loading authentication...</div>; // Or a spinner, or null
  }

  return <>{children}</>;
};

export default AuthChecker;