/**
 * Config Aggregator
 * Single entry point for all configuration
 */

const { supabase, supabaseAdmin } = require('./supabase');
const { PERMISSIONS, hasPermission, canCrossAgency } = require('./permissions');

const isProduction = process.env.NODE_ENV === 'production';

// Default CORS origins based on environment
const defaultCorsOrigins = isProduction 
  ? [] // No defaults in production - must be explicitly set
  : ['http://localhost:3000', 'http://localhost:19006', 'http://localhost:8081'];

// Parse CORS origins from env, adding mobile app schemes
const parseCorsOrigins = () => {
  const envOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [];
  
  // Always include mobile app schemes (these are safe to allow)
  const mobileSchemes = ['veridian://', 'exp://', 'exps://'];
  
  // Combine env origins with mobile schemes
  const allOrigins = [...new Set([...envOrigins, ...mobileSchemes])];
  
  // In production, warn if no explicit origins set
  if (isProduction && envOrigins.length === 0) {
    console.warn('[CONFIG] WARNING: No CORS_ORIGINS set in production. Mobile apps only.');
  }
  
  return allOrigins.length > 0 ? allOrigins : defaultCorsOrigins;
};

module.exports = {
  // Supabase
  supabase,
  supabaseAdmin,
  
  // Permissions
  PERMISSIONS,
  hasPermission,
  canCrossAgency,
  
  // Environment
  env: {
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins: parseCorsOrigins(),
    apiUrl: process.env.API_URL,
    inviteRedirectUrl: process.env.INVITE_REDIRECT_URL,
    port: parseInt(process.env.PORT || '3000', 10),
    livekit: {
      apiKey: process.env.LIVEKIT_API_KEY,
      apiSecret: process.env.LIVEKIT_API_SECRET,
      serverUrl: process.env.LIVEKIT_SERVER_URL
    }
  },
  
  // Helpers
  isProduction,
  isDevelopment: !isProduction
};
