const express = require('express');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const http = require('http');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active rooms and connections
const rooms = new Map();
const connections = new Map();

// Generate QR code endpoint
app.get('/api/qr/:roomId', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const url = `${req.protocol}://${req.get('host')}/?room=${roomId}`;
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  const connectionId = uuidv4();
  connections.set(connectionId, { ws, roomId: null });
  
  console.log(`New connection: ${connectionId}`);

  // Send connection ID to client
  ws.send(JSON.stringify({
    type: 'connection',
    connectionId: connectionId
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(connectionId, data);
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    handleDisconnection(connectionId);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    handleDisconnection(connectionId);
  });
});

function handleMessage(connectionId, data) {
  const connection = connections.get(connectionId);
  if (!connection) return;

  switch (data.type) {
    case 'create-room':
      createRoom(connectionId, data);
      break;
    case 'join-room':
      joinRoom(connectionId, data);
      break;
    case 'file-offer':
      handleFileOffer(connectionId, data);
      break;
    case 'file-answer':
      handleFileAnswer(connectionId, data);
      break;
    case 'file-chunk':
      handleFileChunk(connectionId, data);
      break;
    case 'file-complete':
      handleFileComplete(connectionId, data);
      break;
    case 'file-error':
      handleFileError(connectionId, data);
      break;
  }
}

function createRoom(connectionId, data) {
  const roomId = generateRoomId();
  const connection = connections.get(connectionId);
  
  // Create new room
  rooms.set(roomId, {
    id: roomId,
    sender: connectionId,
    receiver: null,
    created: Date.now()
  });
  
  // Update connection
  connection.roomId = roomId;
  
  // Send room created confirmation
  connection.ws.send(JSON.stringify({
    type: 'room-created',
    roomId: roomId,
    role: 'sender'
  }));
  
  console.log(`Room created: ${roomId} by ${connectionId}`);
}

function joinRoom(connectionId, data) {
  const { roomId } = data;
  const room = rooms.get(roomId);
  const connection = connections.get(connectionId);
  
  if (!room) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
    return;
  }
  
  if (room.receiver) {
    connection.ws.send(JSON.stringify({
      type: 'error',
      message: 'Room is full'
    }));
    return;
  }
  
  // Add receiver to room
  room.receiver = connectionId;
  connection.roomId = roomId;
  
  // Notify both participants
  const senderConnection = connections.get(room.sender);
  const receiverConnection = connections.get(room.receiver);
  
  if (senderConnection) {
    senderConnection.ws.send(JSON.stringify({
      type: 'peer-joined',
      role: 'sender'
    }));
  }
  
  if (receiverConnection) {
    receiverConnection.ws.send(JSON.stringify({
      type: 'room-joined',
      roomId: roomId,
      role: 'receiver'
    }));
  }
  
  console.log(`${connectionId} joined room ${roomId}`);
}

function handleFileOffer(connectionId, data) {
  const connection = connections.get(connectionId);
  const room = rooms.get(connection.roomId);
  
  if (!room || room.sender !== connectionId) return;
  
  const receiverConnection = connections.get(room.receiver);
  if (receiverConnection) {
    receiverConnection.ws.send(JSON.stringify({
      type: 'file-offer',
      fileName: data.fileName,
      fileSize: data.fileSize,
      fileType: data.fileType
    }));
  }
}

function handleFileAnswer(connectionId, data) {
  const connection = connections.get(connectionId);
  const room = rooms.get(connection.roomId);
  
  if (!room || room.receiver !== connectionId) return;
  
  const senderConnection = connections.get(room.sender);
  if (senderConnection) {
    senderConnection.ws.send(JSON.stringify({
      type: 'file-answer',
      accepted: data.accepted
    }));
  }
}

function handleFileChunk(connectionId, data) {
  const connection = connections.get(connectionId);
  const room = rooms.get(connection.roomId);
  
  if (!room) return;
  
  // Forward chunk to the other peer
  const targetConnectionId = room.sender === connectionId ? room.receiver : room.sender;
  const targetConnection = connections.get(targetConnectionId);
  
  if (targetConnection) {
    targetConnection.ws.send(JSON.stringify({
      type: 'file-chunk',
      chunk: data.chunk,
      chunkIndex: data.chunkIndex,
      totalChunks: data.totalChunks
    }));
  }
}

function handleFileComplete(connectionId, data) {
  const connection = connections.get(connectionId);
  const room = rooms.get(connection.roomId);
  
  if (!room) return;
  
  // Notify both peers
  const senderConnection = connections.get(room.sender);
  const receiverConnection = connections.get(room.receiver);
  
  if (senderConnection) {
    senderConnection.ws.send(JSON.stringify({
      type: 'file-complete',
      success: data.success
    }));
  }
  
  if (receiverConnection) {
    receiverConnection.ws.send(JSON.stringify({
      type: 'file-complete',
      success: data.success
    }));
  }
}

function handleFileError(connectionId, data) {
  const connection = connections.get(connectionId);
  const room = rooms.get(connection.roomId);
  
  if (!room) return;
  
  // Forward error to the other peer
  const targetConnectionId = room.sender === connectionId ? room.receiver : room.sender;
  const targetConnection = connections.get(targetConnectionId);
  
  if (targetConnection) {
    targetConnection.ws.send(JSON.stringify({
      type: 'file-error',
      error: data.error
    }));
  }
}

function handleDisconnection(connectionId) {
  const connection = connections.get(connectionId);
  if (!connection) return;
  
  const { roomId } = connection;
  if (roomId) {
    const room = rooms.get(roomId);
    if (room) {
      // Notify the other peer
      const otherConnectionId = room.sender === connectionId ? room.receiver : room.sender;
      const otherConnection = connections.get(otherConnectionId);
      
      if (otherConnection) {
        otherConnection.ws.send(JSON.stringify({
          type: 'peer-disconnected'
        }));
      }
      
      // Clean up room
      rooms.delete(roomId);
    }
  }
  
  // Remove connection
  connections.delete(connectionId);
  console.log(`Connection ${connectionId} disconnected`);
}

function generateRoomId() {
  // Generate a 6-character room ID
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Clean up old rooms (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.created > maxAge) {
      rooms.delete(roomId);
      console.log(`Cleaned up old room: ${roomId}`);
    }
  }
}, 5 * 60 * 1000);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Active rooms: ${rooms.size}`);
  console.log(`Active connections: ${connections.size}`);
});
