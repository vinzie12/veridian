/**
 * Call Session Service
 * Unified service for dual-mode calls (Jitsi + In-App)
 * Uses Supabase for state management and realtime sync
 */

import { supabase, apiCall, API_URL } from './supabase';
import jitsiProvider from './callProviders/jitsiProvider';
import inAppProvider from './callProviders/inAppProvider';

// Call status constants
export const CALL_STATUS = {
  RINGING: 'ringing',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
  ENDED: 'ended',
};

// Call mode constants
export const CALL_MODE = {
  JITSI: 'jitsi',
  IN_APP: 'in_app',
};

// Ringing timeout (60 seconds)
const RINGING_TIMEOUT_MS = 60 * 1000;

// ============================================
// CREATE CALL SESSION
// ============================================

export const createCallSession = async (incidentId, calleeId, callMode, callerName, calleeName, callerId) => {
  try {
    // Use provided callerId (from auth context) since we use custom JWT auth, not Supabase Auth
    if (!callerId) {
      throw new Error('Caller ID is required');
    }
    
    // Generate unique room name
    const timestamp = Date.now().toString(36);
    const shortIncident = incidentId?.slice(0, 8) || '';
    const roomName = `veridian-${shortIncident}-${timestamp}`;
    
    // Calculate expiry time (60s from now)
    const expiresAt = new Date(Date.now() + RINGING_TIMEOUT_MS).toISOString();
    
    // Insert call session via Supabase
    const { data, error } = await supabase
      .from('call_sessions')
      .insert({
        incident_id: incidentId,
        caller_id: callerId,
        callee_id: calleeId,
        call_mode: callMode,
        status: CALL_STATUS.RINGING,
        room_name: roomName,
        expires_at: expiresAt,
        caller_name: callerName,
        callee_name: calleeName,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Call session created:', data.id);
    return { success: true, callSession: data };
  } catch (error) {
    console.error('Failed to create call session:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// SUBSCRIBE TO INCOMING CALLS
// ============================================

export const subscribeToIncomingCalls = (userId, onIncomingCall) => {
  // Subscribe to call_sessions where user is callee and status is ringing
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
        console.log('Incoming call:', payload.new);
        if (payload.new.status === CALL_STATUS.RINGING) {
          onIncomingCall(payload.new);
        }
      }
    )
    .subscribe();
  
  return channel;
};

// ============================================
// SUBSCRIBE TO CALL UPDATES
// ============================================

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
        console.log('Call updated:', payload.new);
        onUpdate(payload.new);
      }
    )
    .subscribe();
  
  return channel;
};

// ============================================
// ACCEPT CALL
// Trigger handles answered_at timestamp and authorization
// ============================================

export const acceptCall = async (callSessionId) => {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .update({ status: CALL_STATUS.ACCEPTED })
      .eq('id', callSessionId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Call accepted:', data.id);
    return { success: true, callSession: data };
  } catch (error) {
    console.error('Failed to accept call:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// DECLINE CALL
// Trigger handles declined_at timestamp and authorization
// ============================================

export const declineCall = async (callSessionId) => {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .update({ status: CALL_STATUS.DECLINED })
      .eq('id', callSessionId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Call declined:', data.id);
    return { success: true, callSession: data };
  } catch (error) {
    console.error('Failed to decline call:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// CANCEL CALL (Caller only)
// Trigger handles cancelled_at timestamp and authorization
// ============================================

export const cancelCall = async (callSessionId) => {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .update({ status: CALL_STATUS.CANCELLED })
      .eq('id', callSessionId)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('Call cancelled:', data.id);
    return { success: true, callSession: data };
  } catch (error) {
    console.error('Failed to cancel call:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// END CALL (Both parties)
// Handles both ringing (cancel/decline) and accepted (end) states
// Trigger handles timestamps and authorization
// ============================================

export const endCall = async (callSessionId) => {
  try {
    // First get current call state
    const { data: currentCall, error: fetchError } = await supabase
      .from('call_sessions')
      .select('id, status, caller_id, callee_id')
      .eq('id', callSessionId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Get current user to determine action
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const isCaller = currentCall.caller_id === user.id;
    const isCallee = currentCall.callee_id === user.id;
    
    if (!isCaller && !isCallee) {
      throw new Error('Not authorized to end this call');
    }
    
    // If ringing, caller cancels, callee declines
    if (currentCall.status === CALL_STATUS.RINGING) {
      if (isCaller) {
        // Caller cancels
        const { data, error } = await supabase
          .from('call_sessions')
          .update({ status: CALL_STATUS.CANCELLED })
          .eq('id', callSessionId)
          .select()
          .single();
        
        if (error) throw error;
        console.log('Call cancelled:', data.id);
        return { success: true, callSession: data };
      } else {
        // Callee declines
        const { data, error } = await supabase
          .from('call_sessions')
          .update({ status: CALL_STATUS.DECLINED })
          .eq('id', callSessionId)
          .select()
          .single();
        
        if (error) throw error;
        console.log('Call declined:', data.id);
        return { success: true, callSession: data };
      }
    }
    
    // If accepted, either party can end
    if (currentCall.status === CALL_STATUS.ACCEPTED) {
      const { data, error } = await supabase
        .from('call_sessions')
        .update({ status: CALL_STATUS.ENDED })
        .eq('id', callSessionId)
        .select()
        .single();
      
      if (error) throw error;
      console.log('Call ended:', data.id);
      return { success: true, callSession: data };
    }
    
    // Call is already in terminal state
    throw new Error(`Call is already ${currentCall.status}`);
  } catch (error) {
    console.error('Failed to end call:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// GET ACTIVE CALL FOR INCIDENT
// ============================================

export const getActiveCallForIncident = async (incidentId) => {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('incident_id', incidentId)
      .in('status', [CALL_STATUS.RINGING, CALL_STATUS.ACCEPTED])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw error;
    }
    
    return { success: true, callSession: data || null };
  } catch (error) {
    console.error('Failed to get active call:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// GET CALL SESSION BY ID
// ============================================

export const getCallSession = async (callSessionId) => {
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('*')
      .eq('id', callSessionId)
      .single();
    
    if (error) throw error;
    
    return { success: true, callSession: data };
  } catch (error) {
    console.error('Failed to get call session:', error);
    return { success: false, error: error.message };
  }
};

// ============================================
// START CALL BY MODE
// ============================================

export const startCallByMode = async (callSession, user) => {
  const mode = callSession.call_mode;
  
  if (mode === CALL_MODE.JITSI) {
    return jitsiProvider.startCall(callSession, user);
  } else if (mode === CALL_MODE.IN_APP) {
    return inAppProvider.startCall(callSession, user);
  } else {
    return { success: false, error: `Unknown call mode: ${mode}` };
  }
};

// ============================================
// JOIN CALL BY MODE
// ============================================

export const joinCallByMode = async (callSession, user) => {
  const mode = callSession.call_mode;
  
  if (mode === CALL_MODE.JITSI) {
    return jitsiProvider.joinCall(callSession, user);
  } else if (mode === CALL_MODE.IN_APP) {
    return inAppProvider.joinCall(callSession, user);
  } else {
    return { success: false, error: `Unknown call mode: ${mode}` };
  }
};

// ============================================
// GET PROVIDER FOR MODE
// ============================================

export const getProvider = (mode) => {
  if (mode === CALL_MODE.JITSI) {
    return jitsiProvider;
  } else if (mode === CALL_MODE.IN_APP) {
    return inAppProvider;
  }
  return null;
};

// ============================================
// CLEANUP EXPIRED CALLS (utility)
// Returns count of expired calls
// ============================================

export const cleanupExpiredCalls = async () => {
  try {
    const { data, error } = await supabase.rpc('expire_ringing_calls');
    if (error) throw error;
    console.log(`Expired ${data} ringing calls`);
    return { success: true, count: data };
  } catch (error) {
    console.error('Failed to cleanup expired calls:', error);
    return { success: false, error: error.message };
  }
};

export default {
  CALL_STATUS,
  CALL_MODE,
  createCallSession,
  subscribeToIncomingCalls,
  subscribeToCallUpdates,
  acceptCall,
  declineCall,
  cancelCall,
  endCall,
  getActiveCallForIncident,
  getCallSession,
  startCallByMode,
  joinCallByMode,
  getProvider,
  cleanupExpiredCalls,
};
