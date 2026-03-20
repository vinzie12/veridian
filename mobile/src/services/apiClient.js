/**
 * API Client for React Native / Expo
 * 
 * Features:
 * - Centralized base URL configuration
 * - Automatic token injection and refresh
 * - Request/retry with exponential backoff
 * - Request deduplication
 * - Standardized error handling
 * - Offline detection
 * - Request cancellation
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetInfo } from 'react-native';

// ============================================
// CONFIGURATION
// ============================================

// Default URL - should be overridden by config from backend
let API_BASE_URL = 'http://192.168.254.104:3000';

// Token storage keys
const TOKEN_KEY = '@veridian:access_token';
const REFRESH_TOKEN_KEY = '@veridian:refresh_token';
const USER_KEY = '@veridian:user';

// Request config
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // 1 second, doubles each retry

// ============================================
// TOKEN MANAGEMENT
// ============================================

let cachedToken = null;
let cachedRefreshToken = null;

/**
 * Get stored access token
 */
export const getAccessToken = async () => {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
    return cachedToken;
  } catch (error) {
    console.error('[API] Failed to get token:', error);
    return null;
  }
};

/**
 * Get stored refresh token
 */
export const getRefreshToken = async () => {
  if (cachedRefreshToken) return cachedRefreshToken;
  try {
    cachedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    return cachedRefreshToken;
  } catch (error) {
    console.error('[API] Failed to get refresh token:', error);
    return null;
  }
};

/**
 * Store tokens after login
 */
export const setTokens = async (accessToken, refreshToken = null) => {
  try {
    cachedToken = accessToken;
    cachedRefreshToken = refreshToken;
    
    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    return true;
  } catch (error) {
    console.error('[API] Failed to store tokens:', error);
    return false;
  }
};

/**
 * Clear all auth data
 */
export const clearAuth = async () => {
  try {
    cachedToken = null;
    cachedRefreshToken = null;
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    return true;
  } catch (error) {
    console.error('[API] Failed to clear auth:', error);
    return false;
  }
};

/**
 * Set API base URL (called after config load)
 */
export const setApiBaseUrl = (url) => {
  API_BASE_URL = url;
  console.log('[API] Base URL set to:', url);
};

/**
 * Get API base URL
 */
export const getApiBaseUrl = () => API_BASE_URL;

// ============================================
// ERROR CLASS
// ============================================

export class ApiError extends Error {
  constructor(message, code, statusCode = 0, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  static fromResponse(data, statusCode) {
    return new ApiError(
      data?.message || data?.error || 'Request failed',
      data?.code || 'API_ERROR',
      statusCode,
      data?.details || null
    );
  }

  static network() {
    return new ApiError('Network error. Please check your connection.', 'NETWORK_ERROR', 0);
  }

  static timeout() {
    return new ApiError('Request timed out. Please try again.', 'TIMEOUT', 408);
  }

  static unauthorized() {
    return new ApiError('Session expired. Please login again.', 'UNAUTHORIZED', 401);
  }
}

// ============================================
// REQUEST DEDUPLICATION
// ============================================

const pendingRequests = new Map();

const getRequestKey = (method, url, body) => {
  const bodyHash = body ? JSON.stringify(body).slice(0, 100) : '';
  return `${method}:${url}:${bodyHash}`;
};

const addPendingRequest = (key, promise) => {
  pendingRequests.set(key, promise);
};

const removePendingRequest = (key) => {
  pendingRequests.delete(key);
};

const getPendingRequest = (key) => {
  return pendingRequests.get(key);
};

// ============================================
// TOKEN REFRESH
// ============================================

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeToRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach(cb => cb(newToken));
  refreshSubscribers = [];
};

const onRefreshFailed = () => {
  refreshSubscribers.forEach(cb => cb(null));
  refreshSubscribers = [];
};

const refreshAccessToken = async () => {
  if (isRefreshing) {
    // Wait for existing refresh
    return new Promise((resolve) => {
      subscribeToRefresh((token) => resolve(token));
    });
  }

  isRefreshing = true;
  const refreshToken = await getRefreshToken();

  if (!refreshToken) {
    isRefreshing = false;
    onRefreshFailed();
    await clearAuth();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error('Refresh failed');
    }

    const newAccessToken = data.access_token || data.session?.access_token;
    const newRefreshToken = data.refresh_token || data.session?.refresh_token;

    await setTokens(newAccessToken, newRefreshToken);
    isRefreshing = false;
    onRefreshed(newAccessToken);
    return newAccessToken;
  } catch (error) {
    console.error('[API] Token refresh failed:', error);
    isRefreshing = false;
    onRefreshFailed();
    await clearAuth();
    return null;
  }
};

// ============================================
// RETRY LOGIC
// ============================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const shouldRetry = (error, attempt) => {
  if (attempt >= MAX_RETRIES) return false;
  
  // Retry on network errors
  if (error.code === 'NETWORK_ERROR') return true;
  
  // Retry on 5xx server errors
  if (error.statusCode >= 500) return true;
  
  // Retry on timeout
  if (error.code === 'TIMEOUT') return true;
  
  return false;
};

const getRetryDelay = (attempt) => {
  return RETRY_DELAY_BASE * Math.pow(2, attempt);
};

// ============================================
// MAIN REQUEST FUNCTION
// ============================================

/**
 * Make an API request
 * 
 * @param {string} endpoint - API endpoint (e.g., '/incidents')
 * @param {Object} options - Request options
 * @param {string} options.method - HTTP method (default: 'GET')
 * @param {Object} options.body - Request body
 * @param {Object} options.headers - Additional headers
 * @param {Object} options.params - Query parameters
 * @param {number} options.timeout - Timeout in ms (default: 30000)
 * @param {boolean} options.skipAuth - Skip token injection
 * @param {boolean} options.skipRetry - Skip retry logic
 * @param {boolean} options.deduplicate - Deduplicate identical requests
 */
export const apiRequest = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {},
    params = null,
    timeout = DEFAULT_TIMEOUT,
    skipAuth = false,
    skipRetry = false,
    deduplicate = true,
  } = options;

  // Build URL
  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  // Check for deduplication
  const requestKey = deduplicate ? getRequestKey(method, url, body) : null;
  if (requestKey) {
    const pending = getPendingRequest(requestKey);
    if (pending) {
      console.log('[API] Deduplicating request:', method, endpoint);
      return pending;
    }
  }

  // Create request promise
  const requestPromise = executeRequest(url, method, body, headers, timeout, skipAuth, skipRetry);

  // Track pending request
  if (requestKey) {
    addPendingRequest(requestKey, requestPromise);
    requestPromise.finally(() => removePendingRequest(requestKey));
  }

  return requestPromise;
};

/**
 * Execute the actual HTTP request with retry logic
 */
const executeRequest = async (url, method, body, headers, timeout, skipAuth, skipRetry, attempt = 0) => {
  // Build headers
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add auth header
  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`[API] ${method} ${url}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : null,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const contentType = response.headers.get('content-type');
    let data = null;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle 401 - try refresh
    if (response.status === 401 && !skipAuth) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        // Retry with new token
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : null,
        });
        
        const retryData = await retryResponse.json();
        
        if (!retryResponse.ok) {
          throw ApiError.fromResponse(retryData, retryResponse.status);
        }
        
        return normalizeResponse(retryData, retryResponse.status);
      } else {
        await clearAuth();
        throw ApiError.unauthorized();
      }
    }

    // Handle errors
    if (!response.ok) {
      throw ApiError.fromResponse(data, response.status);
    }

    return normalizeResponse(data, response.status);

  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error.name === 'AbortError') {
      const apiError = ApiError.timeout();
      if (!skipRetry && shouldRetry(apiError, attempt)) {
        await sleep(getRetryDelay(attempt));
        return executeRequest(url, method, body, headers, timeout, skipAuth, skipRetry, attempt + 1);
      }
      throw apiError;
    }

    // Handle network errors
    if (error.message === 'Network request failed' || error.message === 'Network error') {
      const apiError = ApiError.network();
      if (!skipRetry && shouldRetry(apiError, attempt)) {
        await sleep(getRetryDelay(attempt));
        return executeRequest(url, method, body, headers, timeout, skipAuth, skipRetry, attempt + 1);
      }
      throw apiError;
    }

    // Retry server errors
    if (error instanceof ApiError && !skipRetry && shouldRetry(error, attempt)) {
      await sleep(getRetryDelay(attempt));
      return executeRequest(url, method, body, headers, timeout, skipAuth, skipRetry, attempt + 1);
    }

    throw error;
  }
};

/**
 * Normalize API response
 */
const normalizeResponse = (data, statusCode) => {
  // If response is already normalized
  if (data && typeof data === 'object' && 'success' in data) {
    return data;
  }

  // Normalize standard backend response
  return {
    success: statusCode >= 200 && statusCode < 300,
    statusCode,
    data: data?.data || data,
    message: data?.message || '',
    meta: data?.meta || null,
    error: null,
  };
};

// ============================================
// CONVENIENCE METHODS
// ============================================

export const api = {
  get: (endpoint, params = null, options = {}) => 
    apiRequest(endpoint, { ...options, method: 'GET', params }),
  
  post: (endpoint, body = null, options = {}) => 
    apiRequest(endpoint, { ...options, method: 'POST', body }),
  
  put: (endpoint, body = null, options = {}) => 
    apiRequest(endpoint, { ...options, method: 'PUT', body }),
  
  patch: (endpoint, body = null, options = {}) => 
    apiRequest(endpoint, { ...options, method: 'PATCH', body }),
  
  delete: (endpoint, options = {}) => 
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};

// ============================================
// AUTH SERVICE (Separate from feature requests)
// ============================================

export const authService = {
  /**
   * Login with email and password
   */
  login: async (email, password) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuth: true,
      skipRetry: true,
    });

    if (response.data?.access_token) {
      await setTokens(
        response.data.access_token,
        response.data.refresh_token
      );
    }

    return response;
  },

  /**
   * Login with OTP (magic link)
   */
  sendOtp: async (email) => {
    return apiRequest('/auth/login/otp', {
      method: 'POST',
      body: { email },
      skipAuth: true,
      skipRetry: true,
    });
  },

  /**
   * Verify OTP token
   */
  verifyOtp: async (email, token) => {
    const response = await apiRequest('/auth/login/verify-otp', {
      method: 'POST',
      body: { email, token },
      skipAuth: true,
      skipRetry: true,
    });

    if (response.data?.access_token) {
      await setTokens(
        response.data.access_token,
        response.data.refresh_token
      );
    }

    return response;
  },

  /**
   * Signup new user
   */
  signup: async (userData) => {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: userData,
      skipAuth: true,
      skipRetry: true,
    });
  },

  /**
   * Logout
   */
  logout: async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        skipRetry: true,
      });
    } catch (error) {
      // Continue with local logout even if API fails
      console.warn('[API] Logout API failed:', error.message);
    }
    
    await clearAuth();
  },

  /**
   * Get current user
   */
  getCurrentUser: async () => {
    return apiRequest('/auth/me', { skipRetry: true });
  },

  /**
   * Refresh token
   */
  refresh: async () => {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw ApiError.unauthorized();
    }
    return { success: true, access_token: newToken };
  },

  /**
   * Check if authenticated
   */
  isAuthenticated: async () => {
    const token = await getAccessToken();
    return !!token;
  },
};

// ============================================
// INCIDENT SERVICE (Feature requests)
// ============================================

export const incidentService = {
  /**
   * Get incidents list
   */
  list: async (filters = {}) => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.severity) params.severity = filters.severity;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;
    
    return apiRequest('/incidents', { params });
  },

  /**
   * Get single incident
   */
  get: async (incidentId) => {
    return apiRequest(`/incidents/${incidentId}`);
  },

  /**
   * Create incident
   */
  create: async (incidentData) => {
    return apiRequest('/incidents', {
      method: 'POST',
      body: incidentData,
    });
  },

  /**
   * Create public incident (anonymous)
   */
  createPublic: async (incidentData) => {
    return apiRequest('/incidents/public', {
      method: 'POST',
      body: incidentData,
      skipAuth: true,
    });
  },

  /**
   * Get public incident by tracking ID
   */
  getPublic: async (trackingId) => {
    return apiRequest(`/incidents/public/${trackingId}`, {
      skipAuth: true,
    });
  },

  /**
   * Update incident
   */
  update: async (incidentId, updates) => {
    return apiRequest(`/incidents/${incidentId}`, {
      method: 'PATCH',
      body: updates,
    });
  },

  /**
   * Update incident status
   */
  updateStatus: async (incidentId, status) => {
    return apiRequest(`/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  },

  /**
   * Get incident types
   */
  getTypes: async () => {
    return apiRequest('/incident-types');
  },
};

// ============================================
// CALL SERVICE
// ============================================

export const callService = {
  /**
   * Create call session
   */
  createSession: async (incidentId, calleeId, callMode, callerName, calleeName) => {
    return apiRequest('/call/sessions', {
      method: 'POST',
      body: { incidentId, calleeId, callMode, callerName, calleeName },
    });
  },

  /**
   * Get call status
   */
  getStatus: async (incidentId) => {
    return apiRequest(`/call/status/${incidentId}`);
  },

  /**
   * Notify call started
   */
  notifyStarted: async (incidentId, role = 'caller') => {
    return apiRequest('/call/token', {
      method: 'POST',
      body: { incidentId, role },
    });
  },

  /**
   * Notify call ended
   */
  notifyEnded: async (incidentId) => {
    return apiRequest(`/call/${incidentId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// CONFIG SERVICE
// ============================================

export const configService = {
  /**
   * Load config from backend
   */
  load: async () => {
    const response = await apiRequest('/config', {
      skipAuth: true,
      skipRetry: false,
      deduplicate: false,
    });

    if (response.data?.apiUrl) {
      setApiBaseUrl(response.data.apiUrl);
    }

    return response;
  },
};

// ============================================
// EXPORTS
// ============================================

export default {
  // Core
  apiRequest,
  api,
  ApiError,
  
  // Token management
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearAuth,
  setApiBaseUrl,
  getApiBaseUrl,
  
  // Services
  authService,
  incidentService,
  callService,
  configService,
};
