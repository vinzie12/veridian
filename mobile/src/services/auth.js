/**
 * Auth Service
 * Handles all authentication-related API calls
 */

import { apiRequest, setTokens, clearAuth as clearApiClientAuth } from './apiClient';
import { log } from '../config/environment';

/**
 * Login with email and password
 */
export const login = async (email, password) => {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
    skipRetry: true,
  });

  log.info('Login successful:', response.data?.user?.email);

  // Store tokens in apiClient cache
  if (response.data?.access_token) {
    await setTokens(response.data.access_token, response.data.refresh_token);
  }

  return response.data;
};

/**
 * Send OTP (magic link) to email
 */
export const sendOtp = async (email) => {
  const response = await apiRequest('/auth/login/otp', {
    method: 'POST',
    body: { email },
    skipAuth: true,
    skipRetry: true,
  });

  log.info('OTP sent to:', email);

  return response.data;
};

/**
 * Verify OTP token
 */
export const verifyOtp = async (email, token, type = 'magiclink') => {
  const response = await apiRequest('/auth/login/verify-otp', {
    method: 'POST',
    body: { email, token, type },
    skipAuth: true,
    skipRetry: true,
  });

  log.info('OTP verified for:', email);

  // Store tokens in apiClient cache
  if (response.data?.access_token) {
    await setTokens(response.data.access_token, response.data.refresh_token);
  }

  return response.data;
};

/**
 * Sign up new user
 */
export const signup = async (userData) => {
  const response = await apiRequest('/auth/signup', {
    method: 'POST',
    body: userData,
    skipAuth: true,
    skipRetry: true,
  });

  log.info('Signup successful:', userData.email);

  return response.data;
};

/**
 * Logout user
 */
export const logout = async () => {
  try {
    await apiRequest('/auth/logout', {
      method: 'POST',
      skipRetry: true,
    });
    log.info('Logout successful');
  } catch (error) {
    log.warn('Logout API failed, clearing local state');
  }
  await clearApiClientAuth();
};

/**
 * Refresh access token
 */
export const refreshToken = async (refreshTokenValue) => {
  const response = await apiRequest('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshTokenValue },
    skipAuth: true,
  });

  log.info('Token refreshed');

  // Store tokens in apiClient cache
  if (response.data?.access_token) {
    await setTokens(response.data.access_token, response.data.refresh_token);
  }

  return response.data;
};

/**
 * Get current user profile
 */
export const getCurrentUser = async () => {
  const response = await apiRequest('/auth/me', {
    skipRetry: true,
  });
  return response.data;
};

/**
 * Update user profile
 */
export const updateProfile = async (updates) => {
  const response = await apiRequest('/users/me', {
    method: 'PATCH',
    body: updates,
  });

  log.info('Profile updated');

  return response.data;
};

export default {
  login,
  sendOtp,
  verifyOtp,
  signup,
  logout,
  refreshToken,
  getCurrentUser,
  updateProfile,
};
