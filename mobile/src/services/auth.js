/**
 * Auth Service
 * Handles all authentication-related API calls
 */

import { apiGet, apiPost, apiDelete } from './api';
import { log } from '../config/environment';

/**
 * Login with email and password
 */
export const login = async (email, password) => {
  const response = await apiPost('/auth/login', { email, password }, { skipAuth: true });
  
  log.info('Login successful:', response.data?.user?.email);
  
  return response.data;
};

/**
 * Send OTP (magic link) to email
 */
export const sendOtp = async (email) => {
  const response = await apiPost('/auth/login/otp', { email }, { skipAuth: true });
  
  log.info('OTP sent to:', email);
  
  return response.data;
};

/**
 * Verify OTP token
 */
export const verifyOtp = async (email, token, type = 'magiclink') => {
  const response = await apiPost('/auth/login/verify-otp', { email, token, type }, { skipAuth: true });
  
  log.info('OTP verified for:', email);
  
  return response.data;
};

/**
 * Sign up new user
 */
export const signup = async (userData) => {
  const response = await apiPost('/auth/signup', userData, { skipAuth: true });
  
  log.info('Signup successful:', userData.email);
  
  return response.data;
};

/**
 * Logout user
 */
export const logout = async () => {
  try {
    await apiPost('/auth/logout');
    log.info('Logout successful');
  } catch (error) {
    // Still clear local state even if API fails
    log.warn('Logout API failed, clearing local state');
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (refreshToken) => {
  const response = await apiPost('/auth/refresh', { refresh_token: refreshToken });
  
  log.info('Token refreshed');
  
  return response.data;
};

/**
 * Get current user profile
 */
export const getCurrentUser = async () => {
  const response = await apiGet('/auth/me');
  return response.data;
};

/**
 * Update user profile
 */
export const updateProfile = async (updates) => {
  const response = await apiPatch('/users/me', updates);
  
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
