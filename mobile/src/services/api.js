/**
 * API Service Layer
 * Centralized HTTP client with interceptors, error handling, and response normalization
 */

import { getApiUrl, getTimeout, log } from '../config/environment';
import { getToken, clearAuth } from './authStorage';

/**
 * API Error class for standardized error handling
 */
export class ApiError extends Error {
  constructor(message, code, statusCode, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Request interceptor function type
 * @typedef {(config: RequestConfig) => RequestConfig | Promise<RequestConfig>} RequestInterceptor
 */

/**
 * Response interceptor function type
 * @typedef {(response: ApiResponse) => ApiResponse | Promise<ApiResponse>} ResponseInterceptor
 */

/**
 * Error interceptor function type
 * @typedef {(error: Error) => Error | Promise<Error>} ErrorInterceptor
 */

// Interceptor storage
const requestInterceptors = [];
const responseInterceptors = [];
const errorInterceptors = [];

/**
 * Add request interceptor
 */
export const onRequest = (interceptor) => {
  requestInterceptors.push(interceptor);
  return () => {
    const index = requestInterceptors.indexOf(interceptor);
    if (index > -1) requestInterceptors.splice(index, 1);
  };
};

/**
 * Add response interceptor
 */
export const onResponse = (interceptor) => {
  responseInterceptors.push(interceptor);
  return () => {
    const index = responseInterceptors.indexOf(interceptor);
    if (index > -1) responseInterceptors.splice(index, 1);
  };
};

/**
 * Add error interceptor
 */
export const onError = (interceptor) => {
  errorInterceptors.push(interceptor);
  return () => {
    const index = errorInterceptors.indexOf(interceptor);
    if (index > -1) errorInterceptors.splice(index, 1);
  };
};

/**
 * Run interceptors in sequence
 */
const runInterceptors = async (interceptors, value) => {
  let result = value;
  for (const interceptor of interceptors) {
    result = await interceptor(result);
  }
  return result;
};

/**
 * Make API request
 */
export const api = async (endpoint, options = {}) => {
  const {
    method = 'GET',
    body = null,
    headers = {},
    params = null,
    timeout = getTimeout(),
    skipAuth = false,
    skipResponseNormalization = false,
  } = options;

  // Build URL
  let url = `${getApiUrl()}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    url += `?${searchParams.toString()}`;
  }

  // Build request config
  let requestConfig = {
    url,
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : null,
    timeout,
    skipAuth,
  };

  // Add auth header if not skipped
  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      requestConfig.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    // Run request interceptors
    requestConfig = await runInterceptors(requestInterceptors, requestConfig);

    log.debug('API Request:', requestConfig.method, requestConfig.url);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(requestConfig.url, {
      method: requestConfig.method,
      headers: requestConfig.headers,
      body: requestConfig.body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const data = await response.json();

    // Normalize response
    let apiResponse = {
      success: response.ok,
      statusCode: response.status,
      data: data.data || data,
      message: data.message || '',
      meta: data.meta || null,
      error: data.error || null,
      requestId: data.requestId || null,
    };

    // Run response interceptors
    apiResponse = await runInterceptors(responseInterceptors, apiResponse);

    // Handle non-OK responses
    if (!response.ok) {
      const error = new ApiError(
        data.message || 'Request failed',
        data.error?.code || 'API_ERROR',
        response.status,
        data.error?.details || data.details
      );

      // Run error interceptors
      try {
        await runInterceptors(errorInterceptors, error);
      } catch (interceptedError) {
        throw interceptedError;
      }

      throw error;
    }

    // Return normalized response or raw data
    return skipResponseNormalization ? data : apiResponse;

  } catch (error) {
    // Handle timeout
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out', 'TIMEOUT', 408);
    }

    // Handle network errors
    if (error.message === 'Network request failed') {
      throw new ApiError('Network error. Please check your connection.', 'NETWORK_ERROR', 0);
    }

    // Run error interceptors for non-ApiError
    if (!(error instanceof ApiError)) {
      const apiError = new ApiError(
        error.message || 'Unknown error',
        'UNKNOWN_ERROR',
        0
      );
      
      try {
        await runInterceptors(errorInterceptors, apiError);
      } catch (interceptedError) {
        throw interceptedError;
      }
    }

    throw error;
  }
};

/**
 * Convenience methods
 */
export const apiGet = (endpoint, params = null, options = {}) => 
  api(endpoint, { ...options, method: 'GET', params });

export const apiPost = (endpoint, body = null, options = {}) => 
  api(endpoint, { ...options, method: 'POST', body });

export const apiPut = (endpoint, body = null, options = {}) => 
  api(endpoint, { ...options, method: 'PUT', body });

export const apiPatch = (endpoint, body = null, options = {}) => 
  api(endpoint, { ...options, method: 'PATCH', body });

export const apiDelete = (endpoint, options = {}) => 
  api(endpoint, { ...options, method: 'DELETE' });

/**
 * Setup default interceptors
 */
export const setupDefaultInterceptors = () => {
  // Auto-refresh token on 401
  onError(async (error) => {
    if (error.statusCode === 401 && error.code === 'TOKEN_EXPIRED') {
      // Clear token - will redirect to login
      await clearAuth();
    }
    throw error;
  });

  // Log errors in debug mode
  onError(async (error) => {
    log.error('API Error:', error.code, error.message);
    throw error;
  });
};

export default {
  api,
  get: apiGet,
  post: apiPost,
  put: apiPut,
  patch: apiPatch,
  delete: apiDelete,
  onRequest,
  onResponse,
  onError,
  ApiError,
  setupDefaultInterceptors,
};
