/**
 * Standardized API Response Utilities
 * All responses follow a consistent shape for frontend integration
 */

/**
 * Standard Response Shape:
 * 
 * Success:
 * {
 *   success: true,
 *   message: "Operation completed successfully",
 *   data: { ... } or [ ... ],
 *   meta: { page, limit, total, ... } // optional
 * }
 * 
 * Error:
 * {
 *   success: false,
 *   message: "Error description",
 *   error: {
 *     code: "ERROR_CODE",
 *     details: { ... } // optional
 *   },
 *   requestId: "req_xxx" // for tracing
 * }
 */

/**
 * Success response
 * @param {string} message - Human-readable success message
 * @param {*} data - Response payload (object, array, or primitive)
 * @param {object} meta - Optional metadata (pagination, timestamps, etc.)
 * @returns {object} Standardized success response
 */
const success = (message, data = null, meta = null) => {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  // Always put data under 'data' key for consistency
  if (data !== null && data !== undefined) {
    response.data = data;
  }

  // Add metadata if provided
  if (meta) {
    response.meta = meta;
  }

  return response;
};

/**
 * Error response
 * @param {string} message - Human-readable error message
 * @param {string} code - Machine-readable error code
 * @param {object} details - Optional error details (validation errors, etc.)
 * @param {string} requestId - Optional request ID for tracing
 * @returns {object} Standardized error response
 */
const error = (message, code = 'ERROR', details = null, requestId = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    error: {
      code
    }
  };

  if (details) {
    response.error.details = details;
  }

  if (requestId) {
    response.requestId = requestId;
  }

  return response;
};

/**
 * Paginated response
 * @param {string} message - Success message
 * @param {Array} data - Array of items
 * @param {object} pagination - Pagination metadata
 * @param {number} pagination.page - Current page
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total items
 * @param {number} pagination.totalPages - Total pages (calculated if not provided)
 * @returns {object} Standardized paginated response
 */
const paginated = (message, data, pagination) => {
  const { page = 1, limit = 20, total = 0, totalPages } = pagination;
  
  return {
    success: true,
    message,
    timestamp: new Date().toISOString(),
    data: data || [],
    meta: {
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(total),
        totalPages: totalPages || Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    }
  };
};

/**
 * Created response (201)
 * @param {string} message - Success message
 * @param {object} data - Created resource
 * @returns {object} Standardized created response
 */
const created = (message, data) => {
  return success(message, data);
};

/**
 * No content response (204) - for deletions
 * @param {string} message - Success message
 * @returns {object} Standardized no-content response
 */
const deleted = (message = 'Resource deleted successfully') => {
  return {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
};

/**
 * Updated response
 * @param {string} message - Success message
 * @param {object} data - Updated resource
 * @returns {object} Standardized updated response
 */
const updated = (message, data) => {
  return success(message, data);
};

/**
 * List response with optional pagination
 * @param {string} resourceName - Name of the resource (e.g., 'users', 'incidents')
 * @param {Array} data - Array of items
 * @param {object} pagination - Optional pagination metadata
 * @returns {object} Standardized list response
 */
const list = (resourceName, data, pagination = null) => {
  const message = `${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)} fetched successfully`;
  
  if (pagination) {
    return paginated(message, data, pagination);
  }
  
  return success(message, data);
};

/**
 * Single item response
 * @param {string} resourceName - Name of the resource
 * @param {object} data - Single item
 * @returns {object} Standardized single item response
 */
const item = (resourceName, data) => {
  return success(`${resourceName} fetched successfully`, data);
};

/**
 * Action response (for operations like login, logout, etc.)
 * @param {string} action - Action name (e.g., 'login', 'logout')
 * @param {string} message - Success message
 * @param {object} data - Optional data (tokens, user, etc.)
 * @returns {object} Standardized action response
 */
const action = (actionName, message, data = null) => {
  return success(message, data);
};

/**
 * Validation error response
 * @param {Array} errors - Array of validation errors
 * @param {string} requestId - Request ID for tracing
 * @returns {object} Standardized validation error response
 */
const validationError = (errors, requestId = null) => {
  return error(
    'Validation failed',
    'VALIDATION_ERROR',
    { errors },
    requestId
  );
};

/**
 * Unauthorized response
 * @param {string} message - Error message
 * @param {string} requestId - Request ID for tracing
 * @returns {object} Standardized unauthorized response
 */
const unauthorized = (message = 'Authentication required', requestId = null) => {
  return error(message, 'UNAUTHORIZED', null, requestId);
};

/**
 * Forbidden response
 * @param {string} message - Error message
 * @param {string} requestId - Request ID for tracing
 * @returns {object} Standardized forbidden response
 */
const forbidden = (message = 'Access denied', requestId = null) => {
  return error(message, 'FORBIDDEN', null, requestId);
};

/**
 * Not found response
 * @param {string} resource - Resource name
 * @param {string} requestId - Request ID for tracing
 * @returns {object} Standardized not found response
 */
const notFound = (resource = 'Resource', requestId = null) => {
  return error(`${resource} not found`, 'NOT_FOUND', null, requestId);
};

/**
 * Rate limited response
 * @param {number} retryAfter - Seconds until retry is allowed
 * @param {string} requestId - Request ID for tracing
 * @returns {object} Standardized rate limited response
 */
const rateLimited = (retryAfter = 60, requestId = null) => {
  return error(
    'Too many requests. Please try again later.',
    'RATE_LIMITED',
    { retryAfter },
    requestId
  );
};

/**
 * Server error response
 * @param {string} message - Error message
 * @param {string} requestId - Request ID for tracing
 * @param {boolean} isDevelopment - Whether to include stack trace
 * @param {string} stack - Stack trace (development only)
 * @returns {object} Standardized server error response
 */
const serverError = (message = 'Internal server error', requestId = null, isDevelopment = false, stack = null) => {
  const response = error(message, 'INTERNAL_ERROR', null, requestId);
  
  if (isDevelopment && stack) {
    response.error.stack = stack;
  }
  
  return response;
};

module.exports = {
  // Primary response builders
  success,
  error,
  paginated,
  
  // Convenience methods
  created,
  deleted,
  updated,
  list,
  item,
  action,
  
  // Error helpers
  validationError,
  unauthorized,
  forbidden,
  notFound,
  rateLimited,
  serverError
};
