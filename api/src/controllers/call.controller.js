/**
 * Call Controller
 * HTTP handlers for call/verification routes
 */

const callService = require('../services/call.service');
const { success, created } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');

class CallController {
  /**
   * Generate call token
   */
  generateToken = asyncHandler(async (req, res) => {
    const { incidentId, role } = req.body;
    const result = await callService.generateToken(incidentId, role, req.user);
    res.json(success('Token generated', result));
  });

  /**
   * Create call session
   */
  createCallSession = asyncHandler(async (req, res) => {
    const { incidentId, calleeId, callMode, callerName, calleeName } = req.body;
    const callSession = await callService.createCallSession({
      incidentId,
      calleeId,
      callMode,
      callerName,
      calleeName,
    }, req.user);
    res.status(201).json(created('Call session created', { callSession }));
  });

  /**
   * Get active call status
   */
  getActiveCall = asyncHandler(async (req, res) => {
    const call = callService.getActiveCall(req.params.incidentId);
    res.json(success('Call status fetched', { call }));
  });

  /**
   * End call
   */
  endCall = asyncHandler(async (req, res) => {
    const ended = callService.endCall(req.params.incidentId);
    res.json(success(ended ? 'Call ended' : 'No active call found'));
  });

  /**
   * Get all active calls
   */
  getAllActiveCalls = asyncHandler(async (req, res) => {
    const calls = callService.getAllActiveCalls();
    res.json(success('Active calls fetched', { calls }));
  });
}

module.exports = new CallController();
