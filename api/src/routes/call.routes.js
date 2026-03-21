/**
 * Call Routes
 * Video call and LiveKit token endpoints
 */

const router = require('express').Router();
const { validateBody, validateParams } = require('../middleware/validate');
const { callTokenSchema, incidentIdParamsSchema } = require('../validators/user.validator');
const callController = require('../controllers/call.controller');
const { authenticate } = require('./auth.middleware');

router.use(authenticate);

router.post('/token', validateBody(callTokenSchema), callController.generateToken);

// Session CRUD
router.post('/sessions', callController.createCallSession);
router.get('/sessions/:callSessionId', callController.getCallSession);

// Status transitions
router.patch('/sessions/:callSessionId/accept', callController.acceptCall);
router.patch('/sessions/:callSessionId/decline', callController.declineCall);
router.patch('/sessions/:callSessionId/cancel', callController.cancelCall);
router.patch('/sessions/:callSessionId/end', callController.endCall);

// Polling + active call
router.get('/incoming', callController.getIncomingCall);
router.get('/active/:incidentId', validateParams(incidentIdParamsSchema), callController.getActiveCall);
router.delete('/active/:incidentId', validateParams(incidentIdParamsSchema), callController.endActiveCall);
router.get('/active', callController.getAllActiveCalls);

module.exports = router;
