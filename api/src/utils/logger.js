/**
 * Logger Utility
 * Production-friendly structured logging with sensitive data redaction
 */

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

/**
 * Log levels with numeric priority
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

/**
 * Sensitive fields to redact
 * These will be replaced with [REDACTED] in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'newPassword',
  'confirmPassword',
  'currentPassword',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'privateKey',
  'private_key',
  'authorization',
  'Authorization',
  'cookie',
  'Cookie',
  'session',
  'sessionId',
  'session_id',
  'otp',
  'otp_code',
  'magicLink',
  'magic_link',
  'supabaseAnonKey',
  'supabaseServiceKey',
  'supabase_service_role_key',
  'databaseUrl',
  'database_url',
  'connectionString'
];

/**
 * Patterns to detect and redact in strings
 */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /eyJ[A-Za-z0-9\-._~+/]+=*\.[A-Za-z0-9\-._~+/]+=*\.[A-Za-z0-9\-._~+/]+=*/g, // JWTs
  /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi // UUIDs (potential tokens)
];

/**
 * Redact sensitive fields in an object
 */
const redactObject = (obj, depth = 0) => {
  if (depth > 10) return '[MAX_DEPTH]';
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1));
  }
  
  const redacted = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key is sensitive
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  
  return redacted;
};

/**
 * Redact sensitive patterns in a string
 */
const redactString = (str) => {
  if (typeof str !== 'string') return str;
  
  let redacted = str;
  
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  
  return redacted;
};

/**
 * Redact any value (object, string, or primitive)
 */
const redact = (value) => {
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value === 'object' && value !== null) {
    return redactObject(value);
  }
  return value;
};

/**
 * Format timestamp in ISO 8601
 */
const getTimestamp = () => new Date().toISOString();

/**
 * Format log entry for production (JSON)
 */
const formatJson = (level, message, meta = {}) => {
  return JSON.stringify({
    timestamp: getTimestamp(),
    level,
    message,
    ...redact(meta)
  });
};

/**
 * Format log entry for development (human-readable)
 */
const formatPretty = (level, message, meta = {}) => {
  const timestamp = getTimestamp();
  const levelColors = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
    fatal: '\x1b[35m'  // magenta
  };
  const reset = '\x1b[0m';
  const color = levelColors[level] || '';
  
  const levelPad = level.toUpperCase().padEnd(5);
  const prefix = `${color}${levelPad}${reset}`;
  
  // Format meta data
  const redactedMeta = redact(meta);
  const metaStr = Object.keys(redactedMeta).length > 0 
    ? '\n' + JSON.stringify(redactedMeta, null, 2)
    : '';
  
  return `${timestamp} ${prefix} ${message}${metaStr}`;
};

/**
 * Core log function
 */
const log = (level, message, meta = {}) => {
  // Check if this log level is enabled
  const currentLevel = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;
  const messageLevel = LOG_LEVELS[level] ?? LOG_LEVELS.info;
  
  if (messageLevel < currentLevel) return;
  
  // Skip logging in test mode (unless error or fatal)
  if (isTest && messageLevel < LOG_LEVELS.error) return;
  
  const output = isProduction 
    ? formatJson(level, message, meta)
    : formatPretty(level, message, meta);
  
  // Use appropriate console method
  switch (level) {
    case 'fatal':
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
};

/**
 * Create a logger instance with context
 */
const createLogger = (context = {}) => {
  return {
    debug: (message, meta = {}) => log('debug', message, { ...context, ...meta }),
    info: (message, meta = {}) => log('info', message, { ...context, ...meta }),
    warn: (message, meta = {}) => log('warn', message, { ...context, ...meta }),
    error: (message, meta = {}) => log('error', message, { ...context, ...meta }),
    fatal: (message, meta = {}) => log('fatal', message, { ...context, ...meta }),
    
    /**
     * Create child logger with additional context
     */
    child: (childContext = {}) => createLogger({ ...context, ...childContext }),
    
    /**
     * Log with request context
     */
    withRequest: (req) => {
      return createLogger({
        ...context,
        requestId: req.requestId,
        userId: req.user?.id,
        method: req.method,
        path: req.path
      });
    }
  };
};

// Default logger instance
const logger = createLogger();

/**
 * Log levels for external use
 */
const levels = LOG_LEVELS;

/**
 * What to log and what NOT to log
 */
const LOGGING_GUIDELINES = {
  // ✅ ALWAYS LOG
  always: [
    'Request start/end',
    'Request method, path, query params',
    'Response status code',
    'Request duration',
    'Error messages (operational)',
    'Error codes',
    'User ID (after authentication)',
    'Request ID for correlation',
    'Service startup/shutdown',
    'Database connection status',
    'External API calls (success/failure)',
    'Authentication events (login, logout, signup)',
    'Authorization failures',
    'Rate limiting events',
    'Audit-worthy actions (user changes, deletions)'
  ],
  
  // ❌ NEVER LOG
  never: [
    'Passwords (plain or hashed)',
    'JWT tokens (access or refresh)',
    'API keys',
    'Secrets',
    'Credit card numbers',
    'SSN or government IDs',
    'Private keys',
    'Session tokens',
    'OTP codes',
    'Magic link tokens',
    'Full request bodies with sensitive data',
    'Database connection strings',
    'Environment variables containing secrets'
  ],
  
  // ⚠️ LOG CAREFULLY (redact or partial)
  careful: [
    'Email addresses (consider GDPR)',
    'Phone numbers',
    'IP addresses (consider privacy)',
    'User agent strings',
    'Request headers (redact Authorization)',
    'Response bodies (redact sensitive fields)',
    'Stack traces (only in development)',
    'Query parameters (may contain tokens)'
  ]
};

module.exports = {
  logger,
  createLogger,
  log,
  redact,
  redactObject,
  redactString,
  levels,
  LOGGING_GUIDELINES,
  
  // Convenience methods
  debug: (message, meta) => log('debug', message, meta),
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  fatal: (message, meta) => log('fatal', message, meta)
};
