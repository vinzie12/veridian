/**
 * Incident Routes
 * Incident management endpoints with proper authorization
 */

const router = require('express').Router();
const { validateBody, validateParams, validateQuery } = require('../middleware/validate');
const { publicLimiter } = require('../middleware/rateLimiter');
const { 
  createIncidentSchema, 
  createPublicIncidentSchema, 
  updateIncidentSchema, 
  updateStatusSchema,
  incidentIdParamsSchema,
  trackingIdParamsSchema,
  incidentsQuerySchema
} = require('../validators/incident.validator');
const incidentController = require('../controllers/incident.controller');
const { 
  authenticate, 
  requirePermission,
  requireAgencyScope 
} = require('./auth.middleware');

// ============================================
// PUBLIC ROUTES (no authentication required)
// ============================================

router.post('/public', publicLimiter, validateBody(createPublicIncidentSchema), incidentController.createPublicIncident);
router.get('/public/:tracking_id', publicLimiter, validateParams(trackingIdParamsSchema), incidentController.getPublicIncident);

// ============================================
// PROTECTED ROUTES (authentication required)
// ============================================

router.use(authenticate);

// List incidents (with query filters)
router.get('/', requireAgencyScope, validateQuery(incidentsQuerySchema), incidentController.getIncidents);

// Get single incident
router.get('/:id', validateParams(incidentIdParamsSchema), incidentController.getIncident);

// Create incident
router.post('/', requirePermission('incident:create'), validateBody(createIncidentSchema), incidentController.createIncident);

// Update incident
router.patch('/:id', validateParams(incidentIdParamsSchema), requirePermission('incident:update'), validateBody(updateIncidentSchema), incidentController.updateIncident);

// Update incident status (dedicated endpoint)
router.patch('/:id/status', validateParams(incidentIdParamsSchema), requirePermission('incident:update'), validateBody(updateStatusSchema), incidentController.updateIncidentStatus);

// Delete incident
router.delete('/:id', validateParams(incidentIdParamsSchema), requirePermission('incident:delete'), incidentController.deleteIncident);

module.exports = router;
