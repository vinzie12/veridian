/**
 * Custom Error Classes
 * Standardized error types for the application
 */

/**
 * Base application error
 * All custom errors extend this class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true; // Distinguishes from programming errors
    this.details = null;
    
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Attach additional details to the error
   */
  withDetails(details) {
    this.details = details;
    return this;
  }
}

/**
 * Validation error (400)
 * Used for input validation failures
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * Unauthorized error (401)
 * Used for missing or invalid authentication
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * Forbidden error (403)
 * Used for insufficient permissions
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Not found error (404)
 * Used for missing resources
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * Conflict error (409)
 * Used for duplicate resources
 */
class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * Rate limit error (429)
 * Used when rate limiting is triggered
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = null) {
    super(message, 429, 'RATE_LIMITED');
    this.retryAfter = retryAfter;
  }
}

/**
 * Token error (401)
 * Used for token-specific errors (expired, invalid, revoked)
 */
class TokenError extends AppError {
  constructor(message = 'Invalid token', tokenType = 'unknown') {
    super(message, 401, 'TOKEN_ERROR');
    this.tokenType = tokenType; // 'access', 'refresh', 'legacy'
  }
}

/**
 * Database error (500)
 * Used for database operation failures
 */
class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

/**
 * Service unavailable error (503)
 * Used for external service failures
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Account locked error (423)
 * Used for account lockout scenarios
 */
class AccountLockedError extends AppError {
  constructor(message = 'Account temporarily locked', unlockAt = null) {
    super(message, 423, 'ACCOUNT_LOCKED');
    this.unlockAt = unlockAt;
  }
}

/**
 * Create an error from Supabase error
 */
const fromSupabaseError = (err) => {
  const errorMap = {
    'P0001': { message: 'Operation not allowed', Class: ForbiddenError },
    'PGRST116': { message: 'Resource not found', Class: NotFoundError },
    '23505': { message: 'Resource already exists', Class: ConflictError },
    '23503': { message: 'Referenced resource not found', Class: NotFoundError },
    '23502': { message: 'Required field missing', Class: ValidationError },
    'P0002': { message: 'Resource not found or no access', Class: NotFoundError }
  };

  const mapped = errorMap[err.code];
  if (mapped) {
    return new mapped.Class(mapped.message);
  }

  // Default to database error
  const error = new DatabaseError(err.message || 'Database operation failed');
  error.code = err.code;
  return error;
};

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  TokenError,
  DatabaseError,
  ServiceUnavailableError,
  AccountLockedError,
  fromSupabaseError
};
