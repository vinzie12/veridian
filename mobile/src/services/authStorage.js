/**
 * Auth Storage
 * Secure token storage using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../config/environment';

const TOKEN_KEY = '@veridian:access_token';
const REFRESH_TOKEN_KEY = '@veridian:refresh_token';
const USER_KEY = '@veridian:user';

/**
 * Get stored access token
 */
export const getToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    log.error('Failed to get token:', error);
    return null;
  }
};

/**
 * Store access token
 */
export const setToken = async (token) => {
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
    return true;
  } catch (error) {
    log.error('Failed to set token:', error);
    return false;
  }
};

/**
 * Get stored refresh token
 */
export const getRefreshToken = async () => {
  try {
    return await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    log.error('Failed to get refresh token:', error);
    return null;
  }
};

/**
 * Store refresh token
 */
export const setRefreshToken = async (token) => {
  try {
    if (token) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    return true;
  } catch (error) {
    log.error('Failed to set refresh token:', error);
    return false;
  }
};

/**
 * Get stored user
 */
export const getUser = async () => {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    log.error('Failed to get user:', error);
    return null;
  }
};

/**
 * Store user
 */
export const setUser = async (user) => {
  try {
    if (user) {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(USER_KEY);
    }
    return true;
  } catch (error) {
    log.error('Failed to set user:', error);
    return false;
  }
};

/**
 * Store auth session (token, refresh token, user)
 */
export const setSession = async (accessToken, refreshToken, user) => {
  const results = await Promise.all([
    setToken(accessToken),
    setRefreshToken(refreshToken),
    setUser(user),
  ]);
  return results.every(Boolean);
};

/**
 * Clear all auth data
 */
export const clearAuth = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    return true;
  } catch (error) {
    log.error('Failed to clear auth:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  const token = await getToken();
  return !!token;
};

export default {
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  getUser,
  setUser,
  setSession,
  clearAuth,
  isAuthenticated,
};
