/**
 * Environment Configuration
 * Centralized config management for different environments
 */

// Environment modes
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// Get current environment from Expo constants or default to development
const getEnvironment = () => {
  // @ts-ignore - Expo global
  if (typeof global !== 'undefined' && global.expo?.config?.extra?.env) {
    return global.expo.config.extra.env;
  }
  return __DEV__ ? ENVIRONMENTS.DEVELOPMENT : ENVIRONMENTS.PRODUCTION;
};

// Environment-specific configurations
const configs = {
  [ENVIRONMENTS.DEVELOPMENT]: {
    apiUrl: 'http://192.168.254.104:3000',
    supabaseUrl: null, // Loaded from backend
    supabaseAnonKey: null, // Loaded from backend
    enableDebug: true,
    enableLogging: true,
    timeout: 30000,
  },
  [ENVIRONMENTS.STAGING]: {
    apiUrl: 'https://staging-api.veridian.app',
    supabaseUrl: null,
    supabaseAnonKey: null,
    enableDebug: true,
    enableLogging: true,
    timeout: 30000,
  },
  [ENVIRONMENTS.PRODUCTION]: {
    apiUrl: 'https://api.veridian.app',
    supabaseUrl: null,
    supabaseAnonKey: null,
    enableDebug: false,
    enableLogging: false,
    timeout: 15000,
  }
};

// Runtime config (can be updated from backend)
let runtimeConfig = {
  apiUrl: null,
  supabaseUrl: null,
  supabaseAnonKey: null,
};

/**
 * Get current config (merged with runtime)
 */
export const getConfig = () => {
  const env = getEnvironment();
  const baseConfig = configs[env] || configs[ENVIRONMENTS.DEVELOPMENT];
  
  return {
    ...baseConfig,
    apiUrl: runtimeConfig.apiUrl || baseConfig.apiUrl,
    supabaseUrl: runtimeConfig.supabaseUrl || baseConfig.supabaseUrl,
    supabaseAnonKey: runtimeConfig.supabaseAnonKey || baseConfig.supabaseAnonKey,
    environment: env,
  };
};

/**
 * Update runtime config from backend
 */
export const updateConfig = (updates) => {
  runtimeConfig = {
    ...runtimeConfig,
    ...updates,
  };
};

/**
 * Get API URL
 */
export const getApiUrl = () => {
  const config = getConfig();
  return config.apiUrl;
};

/**
 * Check if debug mode is enabled
 */
export const isDebugMode = () => {
  const config = getConfig();
  return config.enableDebug;
};

/**
 * Check if logging is enabled
 */
export const isLoggingEnabled = () => {
  const config = getConfig();
  return config.enableLogging;
};

/**
 * Get request timeout
 */
export const getTimeout = () => {
  const config = getConfig();
  return config.timeout;
};

/**
 * Log helper (respects logging config)
 */
export const log = {
  info: (...args) => {
    if (isLoggingEnabled()) {
      console.log('[INFO]', ...args);
    }
  },
  warn: (...args) => {
    if (isLoggingEnabled()) {
      console.warn('[WARN]', ...args);
    }
  },
  error: (...args) => {
    // Always log errors
    console.error('[ERROR]', ...args);
  },
  debug: (...args) => {
    if (isDebugMode()) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default {
  getConfig,
  updateConfig,
  getApiUrl,
  isDebugMode,
  isLoggingEnabled,
  getTimeout,
  log,
  ENVIRONMENTS,
};
