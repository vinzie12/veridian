/**
 * Validation Middleware
 * Validates request body, params, and query against Zod schemas
 */

const { ValidationError } = require('../utils/errors');

/**
 * Format Zod errors into consistent structure
 */
const formatZodErrors = (zodError) => {
  const issues = zodError?.issues || zodError?.errors || [];
  return issues.map(err => ({
    field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
    message: err.message,
    code: err.code
  }));
};

/**
 * Create validation middleware from Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {string} source - Where to find data ('body', 'params', 'query')
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      
      // Create detailed error message
      const message = errors.map(e => `${e.field}: ${e.message}`).join('; ');
      
      // Attach errors to error object for debugging
      const error = new ValidationError(message);
      error.details = errors;
      
      return next(error);
    }
    
    // Replace with validated/parsed data (includes type coercion)
    req[source] = result.data;
    next();
  };
};

/**
 * Validate request body
 */
const validateBody = (schema) => validate(schema, 'body');

/**
 * Validate route params
 */
const validateParams = (schema) => validate(schema, 'params');

/**
 * Validate query string
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validate multiple sources at once
 * @param {object} schemas - Object with body, params, query schemas
 * @returns {Function} Express middleware
 */
const validateAll = (schemas) => {
  const middlewares = [];
  
  if (schemas.body) {
    middlewares.push(validateBody(schemas.body));
  }
  if (schemas.params) {
    middlewares.push(validateParams(schemas.params));
  }
  if (schemas.query) {
    middlewares.push(validateQuery(schemas.query));
  }
  
  return middlewares;
};

/**
 * Combine multiple validation middlewares into one
 */
const combine = (...middlewares) => {
  return middlewares.flat();
};

module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery,
  validateAll,
  combine
};
