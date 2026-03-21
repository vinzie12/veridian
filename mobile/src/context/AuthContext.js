/**
 * Auth Context
 * React Context for authentication state management
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  getToken, 
  setToken, 
  getRefreshToken, 
  setRefreshToken, 
  getUser, 
  setUser, 
  setSession,
  clearAuth,
  isAuthenticated 
} from '../services/authStorage';
import * as authService from '../services/auth';
import { setTokens as setApiClientTokens, clearAuth as clearApiClientAuth } from '../services/apiClient';
import { log } from '../config/environment';

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} full_name
 * @property {string} role
 * @property {string} agency_id
 * @property {string} status
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {User|null} user
 * @property {string|null} token
 * @property {boolean} isLoading
 * @property {boolean} isLoggedIn
 * @property {Error|null} error
 * @property {Function} login
 * @property {Function} loginWithOtp
 * @property {Function} signup
 * @property {Function} logout
 * @property {Function} clearError
 */

const AuthContext = createContext(null);

/**
 * Auth Provider Component
 */
export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [token, setTokenState] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Initialize auth state from storage
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const [storedToken, storedRefreshToken, storedUser] = await Promise.all([
          getToken(),
          getRefreshToken(),
          getUser(),
        ]);

        // Only consider authenticated if BOTH token AND valid user exist
        if (storedToken && storedUser && storedUser.id && storedUser.email) {
          // Verify token is still valid by fetching fresh user data
          try {
            const freshUser = await authService.getCurrentUser();
            
            // Ensure we got a valid user back
            if (!freshUser || !freshUser.id) {
              throw new Error('Invalid user response');
            }
            
            setTokenState(storedToken);
            setUserState(freshUser);
            await setUser(freshUser);
          } catch (err) {
            // Token is invalid/expired/revoked - clear ALL auth data
            log.warn('Token validation failed, clearing auth:', err.message);
            await clearAuth();
            await clearApiClientAuth();
            setTokenState(null);
            setUserState(null);
          }
        } else {
          // No valid stored credentials - make sure storage is clean
          log.info('No valid stored credentials, clearing auth');
          await clearAuth();
          await clearApiClientAuth();
        }
      } catch (err) {
        log.error('Auth initialization failed:', err);
        // Ensure clean state on any error
        await clearAuth();
        await clearApiClientAuth();
        setTokenState(null);
        setUserState(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.login(email, password);
      
      // Store session in authStorage
      await setSession(result.access_token, result.refresh_token, result.user);
      
      // Sync apiClient token cache
      await setApiClientTokens(result.access_token, result.refresh_token);
      
      // Update state
      setTokenState(result.access_token);
      setUserState(result.user);
      
      log.info('Login successful');
      
      return { success: true, user: result.user };
    } catch (err) {
      setError(err);
      log.error('Login failed:', err.message);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login with OTP
   */
  const loginWithOtp = useCallback(async (email, otpToken) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.verifyOtp(email, otpToken);
      
      // Store session in authStorage
      await setSession(result.access_token, result.refresh_token, result.user);
      
      // Sync apiClient token cache
      await setApiClientTokens(result.access_token, result.refresh_token);
      
      // Update state
      setTokenState(result.access_token);
      setUserState(result.user);
      
      log.info('OTP login successful');
      
      return { success: true, user: result.user };
    } catch (err) {
      setError(err);
      log.error('OTP login failed:', err.message);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign up new user
   */
  const signup = useCallback(async (userData) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authService.signup(userData);
      
      // Note: User may need approval, so don't auto-login
      log.info('Signup successful');
      
      return { success: true, user: result.user };
    } catch (err) {
      setError(err);
      log.error('Signup failed:', err.message);
      return { success: false, error: err };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    setIsLoading(true);

    try {
      await authService.logout();
    } catch (err) {
      log.warn('Logout API failed, continuing with local logout');
    }

    // Clear local state regardless of API result
    await clearAuth();
    // Clear apiClient token cache
    await clearApiClientAuth();
    setTokenState(null);
    setUserState(null);
    setError(null);
    
    setIsLoading(false);
    log.info('Logout complete');
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (updates) => {
    try {
      const updatedUser = await authService.updateProfile(updates);
      setUserState(updatedUser);
      await setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (err) {
      setError(err);
      return { success: false, error: err };
    }
  }, []);

  const value = {
    user,
    token,
    isLoading,
    isLoggedIn: !!token && !!user,
    error,
    login,
    loginWithOtp,
    signup,
    logout,
    clearError,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth Hook
 * Access authentication state and methods
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};

/**
 * useAuthGuard Hook
 * Redirect to login if not authenticated
 */
export const useAuthGuard = (navigation) => {
  const { isLoggedIn, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [isLoggedIn, isLoading, navigation]);

  return { isLoggedIn, isLoading };
};

export default AuthContext;
