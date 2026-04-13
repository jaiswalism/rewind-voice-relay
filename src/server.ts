import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || 'rewind-pet-2026-secure-key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not set; websocket sessions will be rejected until it is configured');
}

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// Create HTTP server
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0];
  if (path === '/' || path === '') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      service: 'rewind-pet-talking-service',
      version: '1.0.0',
      endpoints: {
        websocket: `ws://localhost:${PORT}/ws`,
      }
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

console.log(`\n🐾 Pet Talking Service starting on ${HOST}:${PORT}`);
console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);

wss.on('connection', async (ws, req) => {
  console.log('✅ iOS client connected');
  
  // Verify API key
  const urlParams = new URLSearchParams(req.url?.split('?')[1]);
  const clientKey = urlParams.get('api_key');
  
  if (clientKey !== API_KEY) {
    console.log('❌ Invalid API key');
    ws.close(1008, 'Invalid API key');
    return;
  }

  const sessionId = Math.random().toString(36).substring(7);
  console.log(`📝 Session started: ${sessionId}`);

  if (!ai) {
    console.error(`❌ GEMINI_API_KEY missing; cannot create live session (${sessionId})`);
    ws.send(JSON.stringify({ error: 'Service is not configured' }));
    ws.close(1011, 'Service not configured');
    return;
  }

  // Start Live API session
  let liveSession: any = null;
  let chunksSent = 0;
  
  try {
    liveSession = await ai.live.connect({
      model: 'gemini-2.5-flash',
      callbacks: {
        onmessage: (event: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(event));
          }
        },
        onerror: (event: any) => {
          console.error(`⚠️ Gemini callback error (${sessionId}):`, event?.error ?? event);
        },
      },
    });

    console.log(`🔗 Connected to Gemini Live API (${sessionId})`);
    console.log(`📋 Session methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(liveSession)).filter(k => !k.startsWith('_')));
    
    // Try using tLiveClientContent which might return a response stream
    try {
      const responsePromise = liveSession.tLiveClientContent();
      console.log(`📋 tLiveClientContent returned:`, typeof responsePromise);
      
      if (responsePromise && typeof responsePromise.then === 'function') {
        responsePromise.then((response: any) => {
          console.log(`💬 tLiveClientContent response (${sessionId}):`, JSON.stringify(response).substring(0, 200));
        }).catch((err: Error) => {
          console.log(`⚠️ tLiveClientContent error:`, err.message);
        });
      }
    } catch (error: any) {
      console.log(`⚠️ tLiveClientContent call failed:`, error.message);
    }

  } catch (error: any) {
    console.error(`❌ Failed to create Live session (${sessionId}):`, error.message);
    ws.send(JSON.stringify({ error: 'Failed to connect to Gemini' }));
    return;
  }

  // Handle messages from iOS client
  ws.on('message', async (message) => {
    const msgStr = message.toString();
    
    try {
      const data = JSON.parse(msgStr);
      // Only log non-realtime inputs to avoid Railway rate limits
      if (!data.realtimeInput && !data.realtime_input) {
        console.log(`📨 iOS -> Service (${sessionId}): ${msgStr.substring(0, 100)}`);
      }
      
      if (liveSession) {
        // Forward to Gemini Live API using correct method
        if (data.setup) {
          console.log(`⏭️ Skipping setup (already connected)`);
          ws.send(JSON.stringify({ setupComplete: true }));
        } else if (data.clientContent) {
          // Use tLiveClientContent which returns the response!
          const turns = data.clientContent.parts ? [data.clientContent] : (data.clientContent.turns || []);
          console.log(`📤 Calling tLiveClientContent with ${turns.length} turns`);
          
          try {
            const response = await liveSession.tLiveClientContent({ turns });
            console.log(`💬 tLiveClientContent response (${sessionId}):`, JSON.stringify(response).substring(0, 300));
            
            // Forward to iOS
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(response));
              console.log(`✅ Forwarded response to iOS`);
            }
          } catch (error: any) {
            console.error(`❌ tLiveClientContent error (${sessionId}):`, error.message);
          }
        } else if (data.realtimeInput || data.realtime_input) {
          const realtimeInput = data.realtimeInput ?? data.realtime_input;
          await liveSession.sendRealtimeInput(realtimeInput);
          chunksSent++;
          if (chunksSent >= 100) {
            console.log(`✅ Forwarded 100 realtime chunks to Gemini (${sessionId})`);
            chunksSent = 0;
          }
        } else {
          console.log(`⚠️ Unknown message type:`, Object.keys(data));
        }
      }
    } catch (error: any) {
      console.error(`❌ Error forwarding (${sessionId}):`, error.message);
    }
  });

  ws.on('close', () => {
    console.log(`👋 iOS client disconnected (${sessionId})`);
    if (liveSession) {
      liveSession.close();
    }
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

process.on('uncaughtException', (error) => {
  console.error('\n💥 UNCAUGHT EXCEPTION:', error.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('\n💥 UNHANDLED REJECTION:', reason);
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Service ready`);
  console.log(`📊 Health check: http://${HOST}:${PORT}`);
});
