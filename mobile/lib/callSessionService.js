/**
 * Call Session Service
 * All operations go through Express API (supabaseAdmin bypasses auth)
 * Only Supabase Realtime subscriptions remain direct
 */

import { supabase } from './supabase';
import { apiRequest } from '../src/services/apiClient';

export const CALL_STATUS = {
  RINGING: 'ringing',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  ENDED: 'ended',
};

export const CALL_MODE = {
  JITSI: 'jitsi',
  IN_APP: 'in_app',
};

// ── CREATE ──────────────────────────────────────────────
export const createCallSession = async (
  incidentId, calleeId, callMode, callerName, calleeName
) => {
  console.log('[CallSessionService] Creating call session:', {
    incidentId: incidentId?.slice(0, 8),
    calleeId: calleeId?.slice(0, 8),
    callMode,
    callerName,
    calleeName
  });
  try {
    const response = await apiRequest('/call/sessions', {
      method: 'POST',
      body: { incidentId, calleeId, callMode, callerName, calleeName },
    });
    console.log('[CallSessionService] Create response:', response);
    const callSession = response?.data?.callSession || response?.data || null;
    if (!callSession) throw new Error('No call session returned');
    return { success: true, callSession };
  } catch (error) {
    console.error('[CallSessionService] Failed to create call session:', error);
    return { success: false, error: error.message };
  }
};

// ── GET SESSION ─────────────────────────────────────────
export const getCallSession = async (callSessionId) => {
  try {
    const response = await apiRequest(`/call/sessions/${callSessionId}`);
    const callSession = response?.data?.callSession || response?.data || null;
    if (!callSession) return { success: false, error: 'Call session not found' };
    return { success: true, callSession };
  } catch (error) {
    console.error('Failed to get call session:', error);
    return { success: false, error: error.message };
  }
};

// ── ACCEPT ──────────────────────────────────────────────
export const acceptCall = async (callSessionId) => {
  try {
    const response = await apiRequest(
      `/call/sessions/${callSessionId}/accept`,
      { method: 'PATCH' }
    );
    const callSession = response?.data?.callSession || response?.data || null;
    return { success: true, callSession };
  } catch (error) {
    console.error('Failed to accept call:', error);
    return { success: false, error: error.message };
  }
};

// ── DECLINE ─────────────────────────────────────────────
export const declineCall = async (callSessionId) => {
  try {
    const response = await apiRequest(
      `/call/sessions/${callSessionId}/decline`,
      { method: 'PATCH' }
    );
    const callSession = response?.data?.callSession || response?.data || null;
    return { success: true, callSession };
  } catch (error) {
    console.error('Failed to decline call:', error);
    return { success: false, error: error.message };
  }
};

// ── CANCEL ──────────────────────────────────────────────
export const cancelCall = async (callSessionId) => {
  try {
    const response = await apiRequest(
      `/call/sessions/${callSessionId}/cancel`,
      { method: 'PATCH' }
    );
    const callSession = response?.data?.callSession || response?.data || null;
    return { success: true, callSession };
  } catch (error) {
    console.error('Failed to cancel call:', error);
    return { success: false, error: error.message };
  }
};

// ── END ─────────────────────────────────────────────────
export const endCall = async (callSessionId) => {
  try {
    const response = await apiRequest(
      `/call/sessions/${callSessionId}/end`,
      { method: 'PATCH' }
    );
    const callSession = response?.data?.callSession || response?.data || null;
    return { success: true, callSession };
  } catch (error) {
    console.error('Failed to end call:', error);
    return { success: false, error: error.message };
  }
};

// ── REALTIME — these stay direct, only reads, no auth needed ──

export const subscribeToIncomingCalls = (userId, onIncomingCall) => {
  try {
    const channel = supabase
      .channel(`incoming_calls:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `callee_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new.status === CALL_STATUS.RINGING) {
            console.log('[CallSessionService] Realtime incoming call:', payload.new.id?.slice(0, 8));
            onIncomingCall(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('[CallSessionService] Realtime subscription status:', status);
        if (status === 'SUBSCRIPTION_ERROR') {
          console.warn('[CallSessionService] Realtime failed - polling will handle calls');
        }
      });
    return channel;
  } catch (err) {
    console.warn('[CallSessionService] Realtime subscription error:', err.message);
    return null; // Polling will handle calls
  }
};

export const subscribeToCallUpdates = (callSessionId, onUpdate) => {
  const channel = supabase
    .channel(`call_updates:${callSessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'call_sessions',
        filter: `id=eq.${callSessionId}`,
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();
  return channel;
};

// ── JOIN CALL ────────────────────────────────────────────
export const joinCallByMode = async (callSession, user) => {
  if (callSession.call_mode === CALL_MODE.IN_APP) {
    const { InAppCallConnection, configureAudioMode } =
      require('./callProviders/inAppProvider');
    const connection = new InAppCallConnection(
      callSession.room_name,
      user?.id,
      user?.full_name || 'User'
    );
    await configureAudioMode();
    await connection.connect();
    return { success: true, connection };
  }
  if (callSession.call_mode === CALL_MODE.JITSI) {
    const jitsiProvider = require('./callProviders/jitsiProvider').default;
    return jitsiProvider.joinCall(callSession, user);
  }
  return { success: false, error: 'Unknown call mode' };
};

export const getActiveCallForIncident = async (incidentId) => {
  try {
    const response = await apiRequest(`/call/active/${incidentId}`);
    const callSession = response?.data?.callSession || null;
    return { success: true, callSession };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  CALL_STATUS, CALL_MODE,
  createCallSession, getCallSession,
  acceptCall, declineCall, cancelCall, endCall,
  subscribeToIncomingCalls, subscribeToCallUpdates,
  joinCallByMode, getActiveCallForIncident,
};
