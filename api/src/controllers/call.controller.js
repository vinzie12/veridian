/**
 * Call Controller
 * HTTP handlers for call/verification routes
 */

const callService = require('../services/call.service');
const { success, created } = require('../utils/response');
const { asyncHandler } = require('../middleware/asyncHandler');

class CallController {
  generateToken = asyncHandler(async (req, res) => {
    const { incidentId, role } = req.body;
    const result = await callService.generateToken(incidentId, role, req.user);
    res.json(success('Token generated', result));
  });

  createCallSession = asyncHandler(async (req, res) => {
    const { incidentId, calleeId, callMode, callerName, calleeName } = req.body;
    
    console.log('[CallController] Create call session request:', {
      incidentId: incidentId?.slice(0, 8),
      calleeId: calleeId?.slice(0, 8),
      callerId: req.user?.id?.slice(0, 8),
      callerName,
      calleeName
    });
    
    const callSession = await callService.createCallSession(
      { incidentId, calleeId, callMode, callerName, calleeName },
      req.user
    );
    res.status(201).json(created('Call session created', { callSession }));
  });

  getCallSession = asyncHandler(async (req, res) => {
    const callSession = await callService.getCallSession(
      req.params.callSessionId
    );
    res.json(success('Call session fetched', { callSession }));
  });

  acceptCall = asyncHandler(async (req, res) => {
    const callSession = await callService.updateCallStatus(
      req.params.callSessionId, 'accepted', req.user.id
    );
    res.json(success('Call accepted', { callSession }));
  });

  declineCall = asyncHandler(async (req, res) => {
    const callSession = await callService.updateCallStatus(
      req.params.callSessionId, 'declined', req.user.id
    );
    res.json(success('Call declined', { callSession }));
  });

  cancelCall = asyncHandler(async (req, res) => {
    const callSession = await callService.updateCallStatus(
      req.params.callSessionId, 'cancelled', req.user.id
    );
    res.json(success('Call cancelled', { callSession }));
  });

  endCall = asyncHandler(async (req, res) => {
    const callSession = await callService.updateCallStatus(
      req.params.callSessionId, 'ended', req.user.id
    );
    res.json(success('Call ended', { callSession }));
  });

  getActiveCall = asyncHandler(async (req, res) => {
    const callSession = await callService.getActiveCall(req.params.incidentId);
    res.json(success('Call status fetched', { callSession }));
  });

  endActiveCall = asyncHandler(async (req, res) => {
    const ended = await callService.endActiveCall(req.params.incidentId);
    res.json(success(ended ? 'Call ended' : 'No active call found'));
  });

  getAllActiveCalls = asyncHandler(async (req, res) => {
    const calls = await callService.getAllActiveCalls();
    res.json(success('Active calls fetched', { calls }));
  });

  getIncomingCall = asyncHandler(async (req, res) => {
    const callSession = await callService.getIncomingCallForUser(req.user.id);
    res.json(success('Incoming call fetched', { callSession }));
  });
}

module.exports = new CallController();
