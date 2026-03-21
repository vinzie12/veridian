/**
 * Global Error Handler Middleware
 * Centralizes error handling for consistent responses
 */

const { 
  AppError, 
  ValidationError, 
  RateLimitError, 
  TokenError,
  AccountLockedError,
  fromSupabaseError 
} = require('../utils/errors');
const { error, validationError, unauthorized, forbidden, notFound, rateLimited, serverError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Generate unique request ID for tracing
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  const requestId = req.requestId || generateRequestId();
  const isProduction = process.env.NODE_ENV === 'production';

  // Determine error details for logging
  const errorDetails = {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userId: req.user?.id || 'anonymous',
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    error: {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode || 500,
      name: err.name,
      stack: isProduction ? undefined : err.stack,
      details: err.details
    }
  };

  // Log with appropriate level based on status code
  if (err.statusCode >= 500 || (!err.statusCode && !err.isOperational)) {
    logger.error('Unhandled error', errorDetails);
  } else if (err.statusCode >= 400) {
    logger.warn('Client error', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: err.statusCode,
      errorCode: err.code,
      errorMessage: err.message
    });
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    let response;
    
    // Handle special error types with specific helpers
    if (err instanceof RateLimitError) {
      response = rateLimited(err.retryAfter, requestId);
      if (err.retryAfter) {
        res.setHeader('Retry-After', err.retryAfter);
      }
      return res.status(err.statusCode).json(response);
    }
    
    if (err instanceof AccountLockedError) {
      response = error(
        err.message,
        err.code,
        { unlockAt: err.unlockAt },
        requestId
      );
      return res.status(err.statusCode).json(response);
    }
    
    if (err instanceof ValidationError && err.details) {
      response = validationError(err.details, requestId);
      return res.status(err.statusCode).json(response);
    }
    
    // Standard AppError
    response = error(err.message, err.code, err.details, requestId);
    return res.status(err.statusCode).json(response);
  }

  // Handle Supabase/PostgreSQL errors
  if (err.code && (err.code.startsWith('P') || err.code.match(/^23\d{2}$/))) {
    const mappedError = fromSupabaseError(err);
    const response = error(
      mappedError.message,
      mappedError.code,
      !isProduction ? err.details : null,
      requestId
    );
    return res.status(mappedError.statusCode).json(response);
  }

  // Handle Joi/Zod validation errors
  if (err.name === 'ValidationError' || (err.details && Array.isArray(err.details))) {
    const response = validationError(err.details, requestId);
    return res.status(400).json(response);
  }

  // Handle syntax errors (malformed JSON)
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    const response = error(
      'Invalid JSON in request body',
      'INVALID_JSON',
      null,
      requestId
    );
    return res.status(400).json(response);
  }

  // Handle rate limiter errors
  if (err.status === 429 || err.statusCode === 429) {
    return res.status(429).json(rateLimited(60, requestId));
  }

  // Handle CORS errors
  if (err.message?.includes('CORS') || err.code === 'CORS_ERROR') {
    return res.status(403).json(forbidden('Cross-origin request not allowed', requestId));
  }

  // Unknown/Programming error - don't leak details in production
  logger.fatal('Unhandled exception', {
    requestId,
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack
    }
  });
  
  const response = serverError(
    isProduction ? 'Internal server error' : err.message,
    requestId,
    !isProduction,
    err.stack
  );
  
  res.status(500).json(response);
};

/**
 * 404 handler for unknown routes
 */
const notFoundHandler = (req, res) => {
  const requestId = req.requestId || generateRequestId();
  
  logger.warn('Route not found', {
    requestId,
    method: req.method,
    path: req.path
  });
  
  const response = notFound(`Route ${req.method} ${req.path}`, requestId);
  
  // Include available routes in development
  if (process.env.NODE_ENV !== 'production') {
    const routes = getAvailableRoutes(req.app);
    if (routes) {
      response.error.details = { availableRoutes: routes };
    }
  }
  
  res.status(404).json(response);
};

/**
 * Get list of available routes (development only)
 */
const getAvailableRoutes = (app) => {
  if (!app) return undefined;
  
  const routes = [];
  app._router?.stack?.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
      routes.push(`${methods} ${layer.route.path}`);
    }
  });
  
  return routes.length > 0 ? routes : undefined;
};

/**
 * Request ID middleware - adds unique ID to each request
 */
const requestIdMiddleware = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

/**
 * 405 Method Not Allowed handler
 */
const methodNotAllowedHandler = (allowedMethods) => {
  return (req, res) => {
    const requestId = generateRequestId();
    res.setHeader('Allow', allowedMethods);
    
    const response = error(
      `Method ${req.method} not allowed on ${req.path}`,
      'METHOD_NOT_ALLOWED',
      { allowedMethods },
      requestId
    );
    
    res.status(405).json(response);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  requestIdMiddleware,
  methodNotAllowedHandler,
  generateRequestId
};
