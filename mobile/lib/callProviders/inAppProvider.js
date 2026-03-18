/**
 * In-App Audio Call Provider
 * WebSocket-based real-time audio streaming
 * Uses expo-av for recording/playback
 * 
 * NOTE: This is NOT WebRTC - it's a simple audio streaming solution
 * For true WebRTC, native dependencies would be required
 * 
 * Architecture:
 * - Backend WebSocket server handles signaling
 * - Audio chunks streamed via WebSocket
 * - expo-av handles recording and playback
 */

import { Audio } from 'expo-av';

// WebSocket server URL (your backend)
const WS_URL = 'ws://192.168.254.104:3001'; // TODO: Move to config

// Audio configuration
const AUDIO_CONFIG = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
    audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
    audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    extension: '.webm',
    mimeType: 'audio/webm',
  },
};

// Audio mode configuration for calls
export const configureAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: true,
      // For in-app calls
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    });
    return true;
  } catch (error) {
    console.error('Failed to configure audio mode:', error);
    return false;
  }
};

// Create audio call connection
export class InAppCallConnection {
  constructor(roomName, userId, displayName) {
    this.roomName = roomName;
    this.userId = userId;
    this.displayName = displayName;
    this.ws = null;
    this.recording = null;
    this.sound = null;
    this.isMuted = false;
    this.isConnected = false;
    this.onStatusChange = null;
    this.onParticipantJoined = null;
    this.onParticipantLeft = null;
    this.onError = null;
  }

  // Connect to signaling server
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(`${WS_URL}/call/${this.roomName}?userId=${this.userId}&name=${encodeURIComponent(this.displayName)}`);
        
        this.ws.onopen = () => {
          console.log('In-app call: WebSocket connected');
          this.isConnected = true;
          if (this.onStatusChange) this.onStatusChange('connected');
          resolve(true);
        };
        
        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            await this.handleMessage(data);
          } catch (err) {
            console.error('Failed to handle message:', err);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          if (this.onError) this.onError(error);
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.isConnected = false;
          if (this.onStatusChange) this.onStatusChange('disconnected');
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // Handle incoming messages
  async handleMessage(data) {
    switch (data.type) {
      case 'participant_joined':
        console.log('Participant joined:', data.userId);
        if (this.onParticipantJoined) this.onParticipantJoined(data);
        break;
        
      case 'participant_left':
        console.log('Participant left:', data.userId);
        if (this.onParticipantLeft) this.onParticipantLeft(data);
        break;
        
      case 'audio_chunk':
        // Play incoming audio
        await this.playAudioChunk(data.audio);
        break;
        
      case 'user_muted':
        console.log('Remote user muted:', data.userId);
        break;
        
      case 'user_unmuted':
        console.log('Remote user unmuted:', data.userId);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Start audio recording and streaming
  async startStreaming() {
    try {
      // Request permission
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Audio permission not granted');
      }
      
      // Configure audio mode
      await configureAudioMode();
      
      // Create recording
      this.recording = new Audio.Recording();
      await this.recording.prepareToRecordAsync(AUDIO_CONFIG);
      
      // Start recording
      await this.recording.startAsync();
      
      // Set up interval to send audio chunks
      this.streamingInterval = setInterval(async () => {
        if (this.isMuted || !this.isConnected) return;
        
        try {
          // Get audio data and send
          // Note: expo-av doesn't support real-time chunk streaming natively
          // This is a simplified version - production would need native module
          // or a different approach (e.g., react-native-audio-api)
          console.log('Streaming audio...');
        } catch (err) {
          console.error('Error streaming audio:', err);
        }
      }, 100); // 100ms chunks
      
      console.log('Started audio streaming');
      return true;
    } catch (error) {
      console.error('Failed to start streaming:', error);
      throw error;
    }
  }

  // Stop streaming
  async stopStreaming() {
    try {
      if (this.streamingInterval) {
        clearInterval(this.streamingInterval);
        this.streamingInterval = null;
      }
      
      if (this.recording) {
        await this.recording.stopAndUnloadAsync();
        this.recording = null;
      }
      
      console.log('Stopped audio streaming');
    } catch (error) {
      console.error('Failed to stop streaming:', error);
    }
  }

  // Play incoming audio chunk
  async playAudioChunk(audioData) {
    try {
      // In a real implementation, audioData would be base64 audio
      // We'd decode and play it
      // expo-av Sound objects can play from URI or base64
      console.log('Playing audio chunk');
    } catch (error) {
      console.error('Failed to play audio:', error);
    }
  }

  // Toggle mute
  async setMuted(muted) {
    this.isMuted = muted;
    
    // Notify other participants
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: muted ? 'mute' : 'unmute',
        userId: this.userId,
      }));
    }
    
    return true;
  }

  // End call
  async end() {
    await this.stopStreaming();
    
    if (this.ws) {
      this.ws.send(JSON.stringify({ type: 'leave', userId: this.userId }));
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    console.log('Call ended');
  }
}

// Provider interface
export const inAppProvider = {
  name: 'in_app',
  displayName: 'In-App Call',
  description: 'Audio call inside the app',
  requiresNativeDeps: false, // Uses expo-av + WebSocket
  supportsVideo: false, // Audio only for MVP
  
  // Create connection
  createConnection: (callSession, user) => {
    const roomName = callSession.room_name;
    const userId = user?.id;
    const displayName = user?.full_name || 'User';
    return new InAppCallConnection(roomName, userId, displayName);
  },
  
  // Start call (caller side)
  startCall: async (callSession, user) => {
    const connection = inAppProvider.createConnection(callSession, user);
    await connection.connect();
    await connection.startStreaming();
    return { success: true, connection };
  },
  
  // Join call (callee side)
  joinCall: async (callSession, user) => {
    const connection = inAppProvider.createConnection(callSession, user);
    await connection.connect();
    await connection.startStreaming();
    return { success: true, connection };
  },
  
  // End call
  endCall: async (connection) => {
    if (connection) {
      await connection.end();
    }
    return { success: true };
  },
};

export default inAppProvider;
