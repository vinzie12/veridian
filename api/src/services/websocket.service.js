/**
 * WebSocket Service for In-App Audio Calls
 * Handles real-time audio streaming between participants
 */

const { WebSocketServer } = require('ws');
const url = require('url');

// roomName -> Map of userId -> { ws, userId, name }
const rooms = new Map();

/**
 * Setup WebSocket server attached to existing HTTP server
 * @param {http.Server} server - Express HTTP server
 */
const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    const { pathname, query } = url.parse(req.url, true);
    
    // Expected: /call/:roomName?userId=...&name=...
    const match = pathname.match(/^\/call\/(.+)$/);
    if (!match) {
      ws.close(1008, 'Invalid path');
      return;
    }

    const roomName = match[1];
    const userId = query.userId;
    const name = decodeURIComponent(query.name || 'User');

    if (!userId) {
      ws.close(1008, 'userId required');
      return;
    }

    // Join room
    if (!rooms.has(roomName)) rooms.set(roomName, new Map());
    const room = rooms.get(roomName);
    room.set(userId, { ws, userId, name });

    console.log(`[WS] ${name} joined room ${roomName} (${room.size} participants)`);

    // Notify others in room
    broadcast(room, userId, { type: 'participant_joined', userId, name });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(room, userId, msg);
      } catch (e) {
        console.error('[WS] Invalid message:', e.message);
      }
    });

    ws.on('close', () => {
      room.delete(userId);
      console.log(`[WS] ${name} left room ${roomName} (${room.size} remaining)`);
      broadcast(room, userId, { type: 'participant_left', userId, name });
      if (room.size === 0) rooms.delete(roomName);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Error for ${userId}:`, err.message);
    });
  });

  console.log('[WS] WebSocket server attached to HTTP server');
  return wss;
};

/**
 * Broadcast message to all participants except sender
 */
function broadcast(room, senderUserId, message) {
  const payload = JSON.stringify(message);
  for (const [uid, participant] of room.entries()) {
    if (uid !== senderUserId && participant.ws.readyState === 1) {
      participant.ws.send(payload);
    }
  }
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(room, senderUserId, msg) {
  switch (msg.type) {
    case 'mute':
      broadcast(room, senderUserId, { type: 'user_muted', userId: senderUserId });
      break;
    case 'unmute':
      broadcast(room, senderUserId, { type: 'user_unmuted', userId: senderUserId });
      break;
    case 'audio_chunk':
      // Forward audio chunk to all other participants
      broadcast(room, senderUserId, { type: 'audio_chunk', audio: msg.audio, userId: senderUserId });
      break;
    case 'leave':
      broadcast(room, senderUserId, { type: 'participant_left', userId: senderUserId });
      break;
    default:
      console.log(`[WS] Unknown message type: ${msg.type}`);
  }
}

/**
 * Get room statistics
 */
const getRoomStats = () => {
  const stats = [];
  for (const [roomName, room] of rooms.entries()) {
    stats.push({
      roomName,
      participantCount: room.size,
      participants: Array.from(room.values()).map(p => ({ userId: p.userId, name: p.name }))
    });
  }
  return stats;
};

module.exports = { setupWebSocket, getRoomStats };
