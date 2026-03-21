/**
 * Environment Variable Validator
 * Validates required environment variables on startup
 */

const logger = require('./logger');

/**
 * Required environment variables
 */
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

/**
 * Optional but recommended for production
 */
const PRODUCTION_ENV_VARS = [
  'API_URL',
  'CORS_ORIGINS',
  'NODE_ENV'
];

/**
 * Validate a single environment variable
 */
const validateVar = (name, value, required = true) => {
  if (!value) {
    if (required) {
      return { valid: false, error: `${name} is required but not set` };
    }
    return { valid: true, warning: `${name} is not set (optional)` };
  }
  
  // Check for placeholder values
  const placeholders = ['your-', 'changeme', 'example', 'placeholder'];
  const lowerValue = value.toLowerCase();
  for (const placeholder of placeholders) {
    if (lowerValue.includes(placeholder)) {
      return { 
        valid: false, 
        error: `${name} contains placeholder value "${placeholder}"` 
      };
    }
  }
  
  // Specific validations
  if (name === 'SUPABASE_URL' && !value.includes('supabase.co')) {
    return { 
      valid: true, 
      warning: 'SUPABASE_URL does not appear to be a valid Supabase URL' 
    };
  }
  
  return { valid: true };
};

/**
 * Validate all environment variables
 * @returns {Object} { valid, errors, warnings }
 */
const validateEnv = () => {
  const errors = [];
  const warnings = [];
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const result = validateVar(varName, process.env[varName], true);
    if (!result.valid) {
      errors.push(result.error);
    }
    if (result.warning) {
      warnings.push(result.warning);
    }
  }
  
  // Check production-recommended variables
  if (isProduction) {
    for (const varName of PRODUCTION_ENV_VARS) {
      const result = validateVar(varName, process.env[varName], false);
      if (!result.valid) {
        errors.push(result.error);
      }
      if (result.warning) {
        warnings.push(result.warning);
      }
    }
  }
  
  // Production-specific checks
  if (isProduction) {
    // Check CORS_ORIGINS doesn't include localhost
    const corsOrigins = process.env.CORS_ORIGINS || '';
    if (corsOrigins.includes('localhost')) {
      warnings.push('CORS_ORIGINS contains localhost in production');
    }
    
    // Check LOG_LEVEL
    const logLevel = process.env.LOG_LEVEL;
    if (logLevel === 'debug') {
      warnings.push('LOG_LEVEL is debug in production (should be info or warn)');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Log validation results and exit if invalid
 */
const checkEnvOrExit = () => {
  const { valid, errors, warnings } = validateEnv();
  
  // Log warnings
  for (const warning of warnings) {
    logger.warn('Environment warning', { warning });
  }
  
  // Log errors and exit if invalid
  if (!valid) {
    for (const error of errors) {
      logger.error('Environment error', { error });
    }
    
    logger.fatal('Invalid environment configuration', {
      errorCount: errors.length,
      warningCount: warnings.length,
      hint: 'Check your .env file against .env.example'
    });
    
    process.exit(1);
  }
  
  logger.info('Environment validated', {
    nodeEnv: process.env.NODE_ENV || 'development',
    warningCount: warnings.length
  });
  
  return { valid, warnings };
};

module.exports = {
  validateEnv,
  checkEnvOrExit,
  REQUIRED_ENV_VARS,
  PRODUCTION_ENV_VARS
};
