/**
 * Express App Setup
 * Configures Express application with middleware and routes
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { env } = require('./src/config');
const { errorHandler, notFoundHandler, requestIdMiddleware } = require('./src/middleware/errorHandler');
const { requestLogger } = require('./src/middleware/requestLogger');

const app = express();

// Request ID for tracing (add early in middleware chain)
app.use(requestIdMiddleware);

// Request logging (all environments)
app.use(requestLogger);

// SECURITY: Enhanced helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.supabase?.url || process.env.SUPABASE_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  frameguard: { action: 'deny' }
}));

// CORS configuration
app.use(cors({
  origin: env.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

// SECURITY: Reduced body limit to prevent DoS
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Mount routes
require('./src/routes')(app);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;
