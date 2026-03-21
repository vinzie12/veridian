/**
 * Call Service
 * Business logic for call/verification operations
 * Uses supabaseAdmin to bypass RLS/auth checks
 */

const { env } = require('../config');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { db } = require('../repositories/database');
const { supabaseAdmin } = require('../config/supabase');

const CALL_STATUS = {
  RINGING: 'ringing',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  ENDED: 'ended',
};

const RINGING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes instead of 60 seconds

class CallService {
  async generateToken(incidentId, role, user) {
    if (!incidentId) throw new ValidationError('incidentId is required');
    if (!env.livekit?.apiKey) {
      return {
        token: 'mock_token_' + Date.now(),
        roomName: 'room_' + incidentId.slice(0, 8),
        serverUrl: null,
      };
    }
    const { AccessToken } = require('livekit-server-sdk');
    const roomName = `verification-${incidentId.slice(0, 8)}`;
    const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
      identity: user.id,
      name: user.full_name || user.email,
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    return { token: at.toJwt(), roomName, serverUrl: env.livekit.serverUrl };
  }

  async createCallSession(data, user) {
    const { incidentId, calleeId, callMode, callerName, calleeName } = data;
    if (!incidentId || !calleeId || !callMode) {
      throw new ValidationError('incidentId, calleeId, and callMode are required');
    }
    const timestamp = Date.now().toString(36);
    const roomName = `veridian-${incidentId.slice(0, 8)}-${timestamp}`;
    const expiresAt = new Date(Date.now() + RINGING_TIMEOUT_MS).toISOString();

    console.log('[CallService] Creating call session:', {
      incidentId: incidentId?.slice(0, 8),
      callerId: user?.id?.slice(0, 8),
      calleeId: calleeId?.slice(0, 8),
      callMode,
      callerName,
      calleeName
    });

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

  async getCallSession(callSessionId) {
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .select('*')
      .eq('id', callSessionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundError('Call session not found');
    return data;
  }

  async updateCallStatus(callSessionId, newStatus, userId) {
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('call_sessions')
      .select('*')
      .eq('id', callSessionId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!current) throw new NotFoundError('Call session not found');

    const isCaller = current.caller_id === userId;
    const isCallee = current.callee_id === userId;

    const allowed = {
      accepted:  isCallee && current.status === CALL_STATUS.RINGING,
      declined:  isCallee && current.status === CALL_STATUS.RINGING,
      cancelled: isCaller && current.status === CALL_STATUS.RINGING,
      ended:     (isCaller || isCallee) && current.status === CALL_STATUS.ACCEPTED,
    };

    if (!allowed[newStatus]) {
      throw new ValidationError(
        `Cannot transition from ${current.status} to ${newStatus}` 
      );
    }

    const timestamps = {
      accepted:  { answered_at:   new Date().toISOString() },
      declined:  { declined_at:   new Date().toISOString() },
      cancelled: { cancelled_at:  new Date().toISOString() },
      ended:     { ended_at:      new Date().toISOString() },
    };

    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .update({ status: newStatus, ...timestamps[newStatus] })
      .eq('id', callSessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getActiveCall(incidentId) {
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .select('*')
      .eq('incident_id', incidentId)
      .in('status', [CALL_STATUS.RINGING, CALL_STATUS.ACCEPTED])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async endActiveCall(incidentId) {
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .update({ status: CALL_STATUS.ENDED, ended_at: new Date().toISOString() })
      .eq('incident_id', incidentId)
      .in('status', [CALL_STATUS.RINGING, CALL_STATUS.ACCEPTED])
      .select();
    if (error) throw error;
    return data?.length > 0;
  }

  async getAllActiveCalls() {
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .select('*')
      .in('status', [CALL_STATUS.RINGING, CALL_STATUS.ACCEPTED]);
    if (error) throw error;
    return data || [];
  }

  async getIncomingCallForUser(userId) {
    console.log('[CallService] Checking incoming calls for user:', userId?.slice(0, 8));
    
    // First, clean up expired ringing calls (mark as missed)
    const now = new Date().toISOString();
    const { error: cleanupError } = await supabaseAdmin
      .from('call_sessions')
      .update({ status: CALL_STATUS.MISSED })
      .eq('status', CALL_STATUS.RINGING)
      .lt('expires_at', now);
    
    if (cleanupError) {
      console.error('[CallService] Cleanup error:', cleanupError);
    }
    
    // Now get active incoming calls for this user
    const { data, error } = await supabaseAdmin
      .from('call_sessions')
      .select(`
        id,
        incident_id,
        caller_id,
        callee_id,
        call_mode,
        status,
        room_name,
        caller_name,
        callee_name,
        created_at,
        expires_at
      `)
      .eq('callee_id', userId)
      .eq('status', CALL_STATUS.RINGING)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[CallService] Error fetching incoming call:', error);
      throw error;
    }

    console.log('[CallService] Incoming call result:', data ? {
      id: data.id?.slice(0, 8),
      callee: data.callee_id?.slice(0, 8),
      caller: data.caller_name
    } : null);

    return data;
  }
}

module.exports = new CallService();
