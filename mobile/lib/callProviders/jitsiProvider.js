/**
 * Jitsi Meet Provider
 * Browser-based video/audio calls using public Jitsi Meet server
 * FREE - No account required
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Alert, Platform } from 'react-native';

// Generate secure room name from call session
export const generateRoomName = (callSessionId, incidentId) => {
  const shortIncident = incidentId?.slice(0, 8) || '';
  const shortSession = callSessionId?.slice(0, 8) || '';
  return `veridian-${shortIncident}-${shortSession}`;
};

// Get full Jitsi Meet URL
export const getJitsiUrl = (roomName, displayName, audioOnly = true) => {
  const encodedName = encodeURIComponent(displayName || 'User');
  
  const config = new URLSearchParams({
    // Audio settings
    'config.startWithAudioMuted': 'false',
    'config.startAudioMuted': 'false',
    'config.enableAudioProcessing': 'true',
    
    // Video settings (audio-first by default)
    'config.startWithVideoMuted': audioOnly ? 'true' : 'false',
    
    // UX settings
    'config.prejoinPageEnabled': 'false',
    'config.enableLobby': 'false',
    'config.enableWelcomePage': 'false',
    'config.disableNotifications': 'true',
    'config.conferenceTimer': 'false',
    
    // User info
    'userInfo.displayName': encodedName,
  });

  // Use public Jitsi server (free, no account)
  // For production: self-host Jitsi for privacy
  return `https://meet.jit.si/${roomName}#${config.toString()}`;
};

// Open Jitsi call in browser
export const openJitsiCall = async (roomName, displayName, audioOnly = true) => {
  const url = getJitsiUrl(roomName, displayName, audioOnly);
  
  try {
    // Try system browser first (better WebRTC support)
    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
      return { success: true, method: 'system_browser' };
    } else {
      // Fallback to in-app browser
      const result = await WebBrowser.openBrowserAsync(url, {
        enableBarCollapsing: true,
        showTitle: true,
        toolbarColor: '#0a0a0a',
      });
      return { success: true, method: 'in_app_browser', result };
    }
  } catch (error) {
    console.error('Failed to open Jitsi:', error);
    return { success: false, error: error.message };
  }
};

// Copy Jitsi link to clipboard
export const copyJitsiLink = async (roomName) => {
  const url = `https://meet.jit.si/${roomName}`;
  
  try {
    await Clipboard.setStringAsync(url);
    return { success: true, url };
  } catch (error) {
    console.error('Failed to copy link:', error);
    return { success: false, error: error.message };
  }
};

// Get shareable Jitsi link
export const getShareableLink = (roomName) => {
  return `https://meet.jit.si/${roomName}`;
};

// Provider interface
export const jitsiProvider = {
  name: 'jitsi',
  displayName: 'Jitsi Browser Call',
  description: 'Opens in browser, no account needed',
  requiresNativeDeps: false,
  
  // Lifecycle methods
  startCall: async (callSession, user) => {
    const roomName = callSession.room_name || generateRoomName(callSession.id, callSession.incident_id);
    return openJitsiCall(roomName, user?.full_name || 'User', true);
  },
  
  joinCall: async (callSession, user) => {
    const roomName = callSession.room_name || generateRoomName(callSession.id, callSession.incident_id);
    return openJitsiCall(roomName, user?.full_name || 'User', true);
  },
  
  endCall: async () => {
    // Jitsi handles this in the browser
    // User taps hangup in Jitsi UI
    return { success: true };
  },
  
  // Utility methods
  copyLink: async (callSession) => {
    const roomName = callSession.room_name || generateRoomName(callSession.id, callSession.incident_id);
    return copyJitsiLink(roomName);
  },
  
  getLink: (callSession) => {
    const roomName = callSession.room_name || generateRoomName(callSession.id, callSession.incident_id);
    return getShareableLink(roomName);
  },
};

export default jitsiProvider;
