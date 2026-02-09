import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, API_BASE } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  // Check authentication status and setup on mount
  useEffect(() => {
    checkSetupAndAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSetupAndAuth = async () => {
    try {
      // First check if setup is required
      // Use api instance to ensure correct backend URL
      const setupResponse = await authAPI.checkSetup();
      const setupData = setupResponse.data;

      if (setupData.setup_required) {
        setSetupRequired(true);
        setLoading(false);
        return;
      }

      // Setup not required, check auth
      setSetupRequired(false);
      await checkAuth();
    } catch (error) {
      // If setup check fails, proceed to auth check
      setSetupRequired(false);
      await checkAuth();
    }
  };

  const checkAuth = async () => {
    try {
      const response = await authAPI.checkAuth();
      if (response.data && response.data.success) {
        setUser(response.data.username);
        setIsAuthenticated(true);
        return { success: true, username: response.data.username };
      } else {
        setUser(null);
        setIsAuthenticated(false);
        return { success: false };
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password, rememberMe = false) => {
    try {
      const response = await authAPI.login(username, password, rememberMe);
      if (response.data && response.data.success) {
        setUser(response.data.username);
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, error: response.data?.message || 'Login failed' };
    } catch (error) {
      // Enhanced error logging for debugging
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      // Handle network errors specifically
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Network error - might be CORS or connection issue
        // But if cookie was set, login might have succeeded
        // Check auth status immediately to see if login actually worked
        try {
          const authCheck = await checkAuth();
          // If auth check succeeds, login actually worked despite network error
          if (authCheck && authCheck.success) {
            // Login was successful, update state
            setUser(authCheck.username || username);
            setIsAuthenticated(true);
            return { success: true };
          }
        } catch (e) {
          // Ignore check auth errors - will return error below
          console.error('Auth check after network error failed:', e);
        }

        // Get the actual API base URL for better error message
        const apiUrl = API_BASE || 'http://localhost:8000';
        return {
          success: false,
          error: `Network error. Please check if the backend server is running at ${apiUrl}.`
        };
      }

      const errorMessage = error.response?.data?.detail?.message ||
        error.response?.data?.message ||
        error.message ||
        'Login failed. Please check your credentials.';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authAPI.changePassword(currentPassword, newPassword);
      if (response.data.success) {
        return { success: true, message: response.data.message };
      }
      return { success: false, error: response.data.message || 'Password change failed' };
    } catch (error) {
      const errorMessage = error.response?.data?.detail?.message ||
        error.response?.data?.message ||
        'Password change failed. Please check your current password.';
      return { success: false, error: errorMessage };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        setupRequired,
        login,
        logout,
        changePassword,
        checkAuth,
        checkSetupAndAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

