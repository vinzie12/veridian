/**
 * Rate Limiting Middleware
 * Prevents brute force and DoS attacks
 */

const rateLimit = require('express-rate-limit');

// Check if in development/testing mode
const isDev = process.env.NODE_ENV !== 'production';

/**
 * Strict limiter for authentication endpoints
 * 5 attempts per 15 minutes per IP (disabled in dev)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 1000 : 5, // Much higher in dev for testing
  message: { 
    error: 'Too many authentication attempts. Please try again later.', 
    code: 'RATE_LIMITED' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
      code: 'RATE_LIMITED'
    });
  }
});

/**
 * Moderate limiter for password reset and OTP
 * 3 attempts per 15 minutes (disabled in dev)
 */
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 3,
  message: {
    error: 'Too many attempts. Please try again later.',
    code: 'RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * General API limiter
 * 100 requests per minute per IP
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMITED'
  }
});

/**
 * Strict limiter for public endpoints
 * 20 requests per minute per IP
 */
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP.',
    code: 'RATE_LIMITED'
  }
});

/**
 * Create account limiter
 * 3 account creations per hour per IP (disabled in dev)
 */
const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 1000 : 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many accounts created from this IP. Please try again later.',
    code: 'RATE_LIMITED'
  }
});

module.exports = {
  authLimiter,
  sensitiveLimiter,
  apiLimiter,
  publicLimiter,
  createAccountLimiter
};
