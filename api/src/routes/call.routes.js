/**
 * Call Routes
 * Video call and LiveKit token endpoints
 */

const router = require('express').Router();
const { validateBody, validateParams } = require('../middleware/validate');
const { callTokenSchema, incidentIdParamsSchema } = require('../validators/user.validator');
const callController = require('../controllers/call.controller');
const { authenticate } = require('./auth.middleware');

// All call routes require authentication
router.use(authenticate);

// ============================================
// TOKEN GENERATION
// ============================================

router.post('/token', validateBody(callTokenSchema), callController.generateToken);

// ============================================
// CALL SESSIONS
// ============================================

router.post('/sessions', callController.createCallSession);

// ============================================
// ACTIVE CALL MANAGEMENT
// ============================================

router.get('/active/:incidentId', validateParams(incidentIdParamsSchema), callController.getActiveCall);
router.delete('/active/:incidentId', validateParams(incidentIdParamsSchema), callController.endCall);
router.get('/active', callController.getAllActiveCalls);

module.exports = router;
