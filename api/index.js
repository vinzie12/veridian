/**
 * Veridian API Server
 * Entry point (Clean Architecture)
 */

require('dotenv').config();

const app = require('./app');
const { supabaseAdmin } = require('./src/config/supabase');
const logger = require('./src/utils/logger');
const { checkEnvOrExit } = require('./src/utils/envValidator');
const { setupErrorLogging, setupShutdownLogging, logStartup, logDatabaseConnection } = require('./src/middleware/requestLogger');

const PORT = process.env.PORT || 3000;

// Validate environment variables before starting
checkEnvOrExit();

// Setup global error logging
setupErrorLogging();

// Verify Supabase connection on startup
const verifyConnection = async () => {
  try {
    const { error } = await supabaseAdmin.from('agencies').select('id').limit(1);
    if (error) {
      logDatabaseConnection(false, { error: error.message });
      logger.warn('Supabase connection warning', { error: error.message });
    } else {
      logDatabaseConnection(true);
    }
  } catch (err) {
    logDatabaseConnection(false, { error: err.message });
    logger.error('Could not verify Supabase connection', { error: err.message });
  }
};

// Start server
const startServer = async () => {
  // Log startup info
  logStartup({
    port: PORT,
    version: '2.0.0'
  });
  
  await verifyConnection();
  
  const server = app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      version: '2.0.0',
      architecture: 'Clean Architecture',
      env: process.env.NODE_ENV || 'development'
    });
  });
  
  // Setup graceful shutdown logging
  setupShutdownLogging(server);
  
  return server;
};

startServer().catch(err => {
  logger.fatal('Failed to start server', {
    error: {
      message: err.message,
      name: err.name,
      stack: err.stack
    }
  });
  process.exit(1);
});