/**
 * Routes Aggregator
 * Mounts all route modules and defines public endpoints
 */

const authRoutes = require('./auth.routes');
const incidentRoutes = require('./incident.routes');
const userRoutes = require('./user.routes');
const adminRoutes = require('./admin.routes');
const callRoutes = require('./call.routes');
const publicController = require('../controllers/public.controller');

module.exports = (app) => {
  // ============================================
  // PUBLIC ENDPOINTS (no authentication)
  // ============================================
  
  // Health check
  app.get('/', publicController.healthCheck);
  
  // Configuration (for frontend)
  app.get('/config', publicController.getConfig);
  
  // Agencies list (for signup/selection)
  app.get('/agencies', publicController.getAgencies);
  
  // Incident types (for forms)
  app.get('/incident-types', publicController.getIncidentTypes);

  // ============================================
  // PROTECTED ROUTES (authentication required)
  // ============================================
  
  app.use('/auth', authRoutes);
  app.use('/incidents', incidentRoutes);
  app.use('/users', userRoutes);
  app.use('/admin', adminRoutes);
  app.use('/call', callRoutes);
};
