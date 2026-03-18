import { API_URL } from './supabase';

/**
 * Generate a unique room name for Jitsi Meet
 * Jitsi Meet is FREE and requires no account - uses meet.jit.si by default
 * @param {string} incidentId - The incident ID
 * @returns {string} - Unique room name
 */
export const generateRoomName = (incidentId) => {
  // Create a unique room name from incident ID
  const shortId = incidentId?.slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `veridian-${shortId}`;
};

/**
 * Get Jitsi Meet URL for the call
 * @param {string} incidentId - The incident ID
 * @param {string} displayName - User's display name
 * @param {boolean} audioOnly - Start with audio only (no video)
 * @returns {string} - Full Jitsi Meet URL
 */
export const getJitsiMeetUrl = (incidentId, displayName, audioOnly = true) => {
  const roomName = generateRoomName(incidentId);
  const encodedName = encodeURIComponent(displayName || 'User');
  
  // Build URL with config options
  const config = new URLSearchParams({
    // Start with audio muted (user will unmute)
    'config.startWithAudioMuted': 'false',
    // Start with video muted for audio-only calls
    'config.startWithVideoMuted': audioOnly ? 'true' : 'false',
    // Start audio muted
    'config.startAudioMuted': 'false',
    // Enable audio processing
    'config.enableAudioProcessing': 'true',
    // Disable prejoin page for faster join
    'config.prejoinPageEnabled': 'false',
    // Set display name
    'userInfo.displayName': encodedName,
    // Disable lobby/waiting room
    'config.enableLobby': 'false',
    // Enable welcome page
    'config.enableWelcomePage': 'false',
    // Disable notifications
    'config.disableNotifications': 'true',
    // Hide conference timer
    'config.conferenceTimer': 'false',
  });

  // Use public Jitsi Meet server (FREE, no account required)
  // For production, consider self-hosting Jitsi for more control
  return `https://meet.jit.si/${roomName}#${config.toString()}`;
};

/**
 * Fetch call info from backend (for tracking active calls)
 * @param {string} incidentId - The incident ID for the call
 * @param {string} role - User role ('admin' or 'reporter')
 * @param {string} token - Auth token
 * @returns {Promise<{roomName: string, hasActiveCall: boolean}>}
 */
export const fetchCallInfo = async (incidentId, role, token) => {
  try {
    const response = await fetch(`${API_URL}/call/status/${incidentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get call info');
    }

    const data = await response.json();
    return {
      roomName: data.roomName || generateRoomName(incidentId),
      hasActiveCall: data.hasActiveCall || false
    };
  } catch (error) {
    console.error('Failed to fetch call info:', error);
    // Return default room name even if API fails
    return {
      roomName: generateRoomName(incidentId),
      hasActiveCall: false
    };
  }
};

/**
 * Notify backend that call has started
 * @param {string} incidentId - The incident ID
 * @param {string} token - Auth token
 */
export const notifyCallStarted = async (incidentId, token) => {
  try {
    await fetch(`${API_URL}/call/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        incidentId,
        role: 'caller'
      })
    });
  } catch (error) {
    console.error('Failed to notify call start:', error);
    // Non-critical, continue
  }
};

/**
 * Notify backend that call has ended
 * @param {string} incidentId - The incident ID
 * @param {string} token - Auth token
 */
export const notifyCallEnded = async (incidentId, token) => {
  try {
    await fetch(`${API_URL}/call/${incidentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Failed to notify call end:', error);
    // Non-critical, continue
  }
};

// Export empty implementations for compatibility
export const joinRoom = async () => console.log('Using Jitsi Meet WebView');
export const leaveRoom = async () => console.log('Leaving Jitsi Meet');
export const toggleMute = async () => console.log('Mute handled by Jitsi');
export const toggleVideo = async () => console.log('Video handled by Jitsi');
export const getRemoteParticipants = () => [];
export const isAudioEnabled = () => true;
export const isVideoEnabled = () => false;
