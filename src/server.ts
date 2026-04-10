import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || 'rewind-pet-2026-secure-key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}

// Create HTTP server
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok',
    service: 'rewind-pet-talking-service',
    version: '1.0.0',
    endpoints: {
      websocket: `ws://localhost:${PORT}/ws`,
    }
  }));
});

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

console.log(`🐾 Pet Talking Service starting on ${HOST}:${PORT}`);
console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);

wss.on('connection', (ws, req) => {
  console.log('✅ iOS client connected');
  
  // Verify API key
  const urlParams = new URLSearchParams(req.url?.split('?')[1]);
  const clientKey = urlParams.get('api_key');
  
  if (clientKey !== API_KEY) {
    console.log('❌ Invalid API key');
    ws.close(1008, 'Invalid API key');
    return;
  }

  let sessionId = Math.random().toString(36).substring(7);
  console.log(`📝 Session started: ${sessionId}`);

  // Handle messages from iOS client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log(`📨 Received from iOS (${sessionId}):`, data.type);
      
      // For now, echo back for testing
      // Real implementation will proxy to Gemini Live API
      ws.send(JSON.stringify({
        type: 'ack',
        sessionId,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`👋 Client disconnected: ${sessionId}`);
  });

  ws.on('error', (error) => {
    console.error(`⚠️ WebSocket error (${sessionId}):`, error.message);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  wss.close(() => server.close());
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  wss.close(() => server.close());
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Service ready`);
  console.log(`📊 Health check: http://${HOST}:${PORT}`);
});
