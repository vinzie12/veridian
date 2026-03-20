/**
 * Request Logging Middleware
 * Logs HTTP requests with timing, correlation IDs, and safe data
 */

const { logger, redact } = require('../utils/logger');

/**
 * Sensitive headers to redact
 */
const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token'
];

/**
 * Safe headers to log (whitelist approach)
 */
const SAFE_HEADERS = [
  'content-type',
  'content-length',
  'user-agent',
  'x-request-id',
  'x-forwarded-for',
  'x-real-ip',
  'accept',
  'accept-encoding',
  'host',
  'origin',
  'referer'
];

/**
 * Extract safe headers from request
 */
const extractSafeHeaders = (req) => {
  const headers = {};
  
  for (const header of SAFE_HEADERS) {
    if (req.headers[header]) {
      headers[header] = req.headers[header];
    }
  }
  
  return headers;
};

/**
 * Extract safe query parameters
 */
const extractSafeQuery = (query) => {
  const redactedQuery = {};
  
  for (const [key, value] of Object.entries(query || {})) {
    const lowerKey = key.toLowerCase();
    
    // Redact sensitive query params
    if (lowerKey.includes('token') || lowerKey.includes('key') || lowerKey.includes('secret')) {
      redactedQuery[key] = '[REDACTED]';
    } else {
      redactedQuery[key] = value;
    }
  }
  
  return redactedQuery;
};

/**
 * Extract safe body (redact sensitive fields)
 */
const extractSafeBody = (body) => {
  if (!body || typeof body !== 'object') {
    return body ? '[BODY_PRESENT]' : undefined;
  }
  
  return redact(body);
};

/**
 * Request start middleware
 * Logs incoming request and starts timer
 */
const requestStartMiddleware = (req, res, next) => {
  // Store start time
  req.startTime = Date.now();
  
  // Create request-scoped logger
  req.log = logger.child({
    requestId: req.requestId,
    method: req.method,
    path: req.path
  });
  
  // Log request start
  const logData = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? extractSafeQuery(req.query) : undefined,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?.id,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'] || req.headers['referrer']
  };
  
  // Log body for non-GET requests (with size limit)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize < 1000) { // Only log small bodies
      logData.body = extractSafeBody(req.body);
    } else {
      logData.bodySize = `${bodySize} bytes`;
    }
  }
  
  logger.info(`--> ${req.method} ${req.path}`, logData);
  
  next();
};

/**
 * Response finish middleware
 * Logs response status and duration
 */
const responseFinishMiddleware = (req, res, next) => {
  // Store original end function
  const originalEnd = res.end;
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Wrap res.end to log response
  res.end = function(...args) {
    logResponse(req, res);
    return originalEnd.apply(this, args);
  };
  
  // Wrap res.json to log response
  res.json = function(body) {
    logResponse(req, res, body);
    return originalJson.apply(this, arguments);
  };
  
  // Wrap res.send to log response
  res.send = function(body) {
    logResponse(req, res, body);
    return originalSend.apply(this, arguments);
  };
  
  next();
};

/**
 * Log response details
 */
const logResponse = (req, res, body) => {
  // Only log once per request
  if (req.responseLogged) return;
  req.responseLogged = true;
  
  const duration = Date.now() - (req.startTime || Date.now());
  const statusCode = res.statusCode;
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
  
  const logData = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    statusCode,
    duration: `${duration}ms`,
    userId: req.user?.id,
    contentLength: res.getHeader('content-length') || res.get('content-length')
  };
  
  // Include error details for error responses
  if (statusCode >= 400 && body && typeof body === 'object') {
    const safeBody = redact(body);
    
    // Only include error code and message, not full details
    if (safeBody.error || safeBody.code) {
      logData.errorCode = safeBody.code;
      logData.errorMessage = safeBody.error || safeBody.message;
    }
  }
  
  // Log with appropriate level
  const arrow = '<--';
  logger[level](`${arrow} ${req.method} ${req.path} ${statusCode} ${duration}ms`, logData);
};

/**
 * Combined request/response logging middleware
 */
const requestLogger = (req, res, next) => {
  requestStartMiddleware(req, res, () => {
    responseFinishMiddleware(req, res, next);
  });
};

/**
 * Error event logging
 * Logs unhandled errors and rejections
 */
const setupErrorLogging = () => {
  // Uncaught exceptions
  process.on('uncaughtException', (error, origin) => {
    logger.fatal('Uncaught Exception', {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      origin
    });
    
    // Give time for log to flush before exiting
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });
  
  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection', {
      error: reason instanceof Error 
        ? { message: reason.message, name: reason.name, stack: reason.stack }
        : reason
    });
  });
  
  // Warning events
  process.on('warning', (warning) => {
    logger.warn('Node Warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
  
  // Memory warnings
  process.on('maxlisteners', (type, emitter) => {
    logger.warn('Max Event Listeners Warning', { type });
  });
};

/**
 * Graceful shutdown logging
 */
const setupShutdownLogging = (server) => {
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  
  signals.forEach(signal => {
    process.on(signal, () => {
      logger.info(`Received ${signal}, starting graceful shutdown`, {
        signal,
        activeConnections: server?.getConnections ? 'N/A' : undefined
      });
      
      // Give time for logs to flush
      setTimeout(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      }, 500);
    });
  });
};

/**
 * Log startup information
 */
const logStartup = (config = {}) => {
  logger.info('Server starting', {
    nodeVersion: process.version,
    platform: process.platform,
    env: process.env.NODE_ENV || 'development',
    pid: process.pid,
    port: config.port,
    version: config.version
  });
};

/**
 * Log database connection
 */
const logDatabaseConnection = (success, details = {}) => {
  if (success) {
    logger.info('Database connected', details);
  } else {
    logger.error('Database connection failed', details);
  }
};

module.exports = {
  requestLogger,
  requestStartMiddleware,
  responseFinishMiddleware,
  setupErrorLogging,
  setupShutdownLogging,
  logStartup,
  logDatabaseConnection,
  extractSafeHeaders,
  extractSafeQuery,
  extractSafeBody
};
