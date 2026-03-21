/**
 * In-App Audio Call Provider
 * WebSocket-based real-time audio streaming
 * Uses expo-av + expo-file-system for chunked audio recording/playback
 */

import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// WebSocket server URL — same port as your API
const WS_URL = 'ws://192.168.254.104:3000';

// How long each audio chunk is (ms). Lower = less latency, more overhead.
const CHUNK_DURATION_MS = 500;

// Audio mode configuration for calls
export const configureAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
    return true;
  } catch (error) {
    console.error('Failed to configure audio mode:', error);
    return false;
  }
};

export class InAppCallConnection {
  constructor(roomName, userId, displayName) {
    this.roomName = roomName;
    this.userId = userId;
    this.displayName = displayName;
    this.ws = null;
    this.isMuted = false;
    this.isConnected = false;
    this.streamingTimeout = null;
    this.isStreaming = false;

    // Callbacks — set by InAppCallScreen
    this.onStatusChange = null;
    this.onParticipantJoined = null;
    this.onParticipantLeft = null;
    this.onError = null;
  }

  // ── CONNECT ────────────────────────────────────────────────────────────
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(
          `${WS_URL}/call/${this.roomName}?userId=${this.userId}&name=${encodeURIComponent(this.displayName)}` 
        );

        this.ws.onopen = () => {
          console.log('[InAppCall] WebSocket connected');
          this.isConnected = true;
          if (this.onStatusChange) this.onStatusChange('connected');
          resolve(true);
        };

        this.ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            await this.handleMessage(data);
          } catch (err) {
            console.error('[InAppCall] Failed to handle message:', err);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[InAppCall] WebSocket error:', error);
          if (this.onError) this.onError(error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[InAppCall] WebSocket closed');
          this.isConnected = false;
          if (this.onStatusChange) this.onStatusChange('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // ── HANDLE INCOMING MESSAGES ───────────────────────────────────────────
  async handleMessage(data) {
    switch (data.type) {
      case 'participant_joined':
        console.log('[InAppCall] Participant joined:', data.userId);
        if (this.onParticipantJoined) this.onParticipantJoined(data);
        break;

      case 'participant_left':
        console.log('[InAppCall] Participant left:', data.userId);
        if (this.onParticipantLeft) this.onParticipantLeft(data);
        break;

      case 'audio_chunk':
        await this.playAudioChunk(data.audio);
        break;

      case 'user_muted':
        console.log('[InAppCall] Remote muted:', data.userId);
        break;

      case 'user_unmuted':
        console.log('[InAppCall] Remote unmuted:', data.userId);
        break;

      default:
        console.log('[InAppCall] Unknown message type:', data.type);
    }
  }

  // ── AUDIO STREAMING (chunked record → base64 → WebSocket) ─────────────
  async startStreaming() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Microphone permission not granted');
      }

      await configureAudioMode();
      this.isStreaming = true;

      console.log('[InAppCall] Audio streaming started');
      this._recordNextChunk();
      return true;
    } catch (error) {
      console.error('[InAppCall] Failed to start streaming:', error);
      throw error;
    }
  }

  _recordNextChunk() {
    if (!this.isStreaming || !this.isConnected) return;

    // Schedule the next chunk recording
    this.streamingTimeout = setTimeout(async () => {
      if (!this.isStreaming || !this.isConnected) return;

      let recording = null;
      let uri = null;

      try {
        // 1. Start recording this chunk
        const result = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.LOW_QUALITY
        );
        recording = result.recording;

        // 2. Wait for chunk duration
        await new Promise(resolve => setTimeout(resolve, CHUNK_DURATION_MS));

        // 3. Stop and get the file
        await recording.stopAndUnloadAsync();
        uri = recording.getURI();

        // 4. Only send if not muted and still connected
        if (!this.isMuted && this.isConnected && uri) {
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'audio_chunk',
              audio: base64,
              userId: this.userId,
            }));
          }
        }
      } catch (err) {
        // Don't crash the whole stream on a single failed chunk
        console.warn('[InAppCall] Chunk error:', err.message);
        if (recording) {
          try { await recording.stopAndUnloadAsync(); } catch (_) {}
        }
      } finally {
        // 5. Clean up temp file
        if (uri) {
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }

        // 6. Schedule next chunk
        this._recordNextChunk();
      }
    }, 0); // Start immediately, chunk duration is handled inside
  }

  // ── PLAY INCOMING AUDIO CHUNK ──────────────────────────────────────────
  async playAudioChunk(base64Audio) {
    if (!base64Audio) return;

    let uri = null;
    let sound = null;

    try {
      // Write base64 audio to a temp file
      uri = `${FileSystem.cacheDirectory}chunk_${Date.now()}_${Math.random().toString(36).slice(2)}.m4a`;
      await FileSystem.writeAsStringAsync(uri, base64Audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Play the temp file
      const result = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 }
      );
      sound = result.sound;

      // Clean up after playback finishes
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish || status.error) {
          sound.unloadAsync().catch(() => {});
          FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      });
    } catch (error) {
      console.warn('[InAppCall] Failed to play audio chunk:', error.message);
      if (sound) sound.unloadAsync().catch(() => {});
      if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }

  // ── STOP STREAMING ─────────────────────────────────────────────────────
  async stopStreaming() {
    this.isStreaming = false;

    if (this.streamingTimeout) {
      clearTimeout(this.streamingTimeout);
      this.streamingTimeout = null;
    }

    console.log('[InAppCall] Audio streaming stopped');
  }

  // ── MUTE ───────────────────────────────────────────────────────────────
  async setMuted(muted) {
    this.isMuted = muted;

    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        type: muted ? 'mute' : 'unmute',
        userId: this.userId,
      }));
    }

    return true;
  }

  // ── END CALL ───────────────────────────────────────────────────────────
  async end() {
    await this.stopStreaming();

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'leave', userId: this.userId }));
        }
      } catch (_) {}
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    console.log('[InAppCall] Call ended');
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
