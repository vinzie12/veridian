/**
 * Call Service
 * Business logic for call/verification operations
 */

const { env } = require('../config');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { db } = require('../repositories/database');

// In-memory store for active calls (in production, use Redis/database)
const activeCalls = new Map();

// Call status constants
const CALL_STATUS = {
  RINGING: 'ringing',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  ENDED: 'ended',
};

// Ringing timeout (60 seconds)
const RINGING_TIMEOUT_MS = 60 * 1000;

class CallService {
  /**
   * Generate call token
   * @param {string} incidentId - Incident ID
   * @param {string} role - User role (admin/reporter)
   * @param {object} user - Current user
   * @returns {object} Token and room info
   */
  async generateToken(incidentId, role, user) {
    if (!incidentId) {
      throw new ValidationError('incidentId is required');
    }

    // Check if LiveKit credentials are configured
    if (!env.livekit.apiKey || !env.livekit.apiSecret || !env.livekit.serverUrl) {
      console.warn('LiveKit credentials not configured, returning mock token');
      return {
        token: 'mock_token_' + Date.now(),
        roomName: 'room_' + incidentId.slice(0, 8),
        serverUrl: null,
        warning: 'Using mock token - configure LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_SERVER_URL in .env'
      };
    }

    // Import LiveKit Server SDK
    const { AccessToken } = require('livekit-server-sdk');

    // Create room name
    const roomName = `verification-${incidentId.slice(0, 8)}`;

    // Determine permissions
    const isAdmin = role === 'admin';

    // Create access token
    const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
      identity: user.id,
      name: user.full_name || user.email
    });

    // Add grants
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: isAdmin
        ? ['camera', 'microphone', 'screen_share', 'screen_share_audio']
        : ['microphone']
    });

    const token = at.toJwt();

    // Track active call
    activeCalls.set(incidentId, {
      roomName,
      startedAt: new Date(),
      participants: [user.id]
    });

    return {
      token,
      roomName,
      serverUrl: env.livekit.serverUrl
    };
  }

  /**
   * Get active call status
   * @param {string} incidentId - Incident ID
   * @returns {object|null} Active call info
   */
  getActiveCall(incidentId) {
    return activeCalls.get(incidentId) || null;
  }

  /**
   * End call
   * @param {string} incidentId - Incident ID
   * @returns {boolean} Success
   */
  endCall(incidentId) {
    if (activeCalls.has(incidentId)) {
      activeCalls.delete(incidentId);
      return true;
    }
    return false;
  }

  /**
   * Get all active calls
   * @returns {Array} Active calls
   */
  getAllActiveCalls() {
    return Array.from(activeCalls.entries()).map(([id, call]) => ({
      incidentId: id,
      ...call
    }));
  }

  /**
   * Create call session in database
   * @param {object} data - Call session data
   * @param {object} user - Current user
   * @returns {object} Created call session
   */
  async createCallSession(data, user) {
    const { incidentId, calleeId, callMode, callerName, calleeName } = data;

    if (!incidentId || !calleeId || !callMode) {
      throw new ValidationError('incidentId, calleeId, and callMode are required');
    }

    // Generate unique room name
    const timestamp = Date.now().toString(36);
    const shortIncident = incidentId?.slice(0, 8) || '';
    const roomName = `veridian-${shortIncident}-${timestamp}`;

    // Calculate expiry time (60s from now)
    const expiresAt = new Date(Date.now() + RINGING_TIMEOUT_MS).toISOString();

    // Insert using admin client (bypasses RLS)
    const result = await db.insert('call_sessions', {
      incident_id: incidentId,
      caller_id: user.id,
      callee_id: calleeId,
      call_mode: callMode,
      status: CALL_STATUS.RINGING,
      room_name: roomName,
      expires_at: expiresAt,
      caller_name: callerName || user.full_name || 'Admin',
      callee_name: calleeName || 'Reporter',
    });

    return result;
  }
}

module.exports = new CallService();
