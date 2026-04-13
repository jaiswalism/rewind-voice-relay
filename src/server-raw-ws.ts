import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';
const API_KEY = process.env.API_KEY || 'rewind-pet-2026-secure-key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// For raw WebSocket Live API, use the full models/ prefix.
// gemini-3.1-flash-live-preview is the latest recommended live model (Apr 2026).
// gemini-2.5-flash-native-audio-preview-12-2025 is the prior preview, also valid.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-3.1-flash-live-preview';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not set');
  process.exit(1);
}

// Create HTTP server
const server = createServer((req, res) => {
  const path = req.url?.split('?')[0];
  if (path === '/' || path === '') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok',
      service: 'rewind-pet-talking-service',
      version: '1.0.0-raw-ws',
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

console.log(`\n🐾 Pet Talking Service (Raw WebSocket) starting on ${HOST}:${PORT}`);
console.log(`📡 WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
console.log(`🤖 Gemini model: ${GEMINI_MODEL}`);

// Build the BidiGenerateContentSetup message per the proto spec:
//   { setup: { model, generationConfig: { responseModalities }, systemInstruction } }
// Note: "config" is an SDK abstraction; the raw v1beta API uses "setup" as the outer key.
function buildSetupMessage(source: any) {
  const incoming = source?.config ?? source?.setup ?? {};
  return {
    setup: {
      model: GEMINI_MODEL,
      generationConfig: {
        responseModalities: ['AUDIO'],
      },
      systemInstruction: incoming.systemInstruction ?? {
        parts: [{ text: 'You are a calm virtual companion in a wellness app. Be warm, empathetic, and conversational. Respond with 2-4 complete sentences. Always acknowledge feelings first, then offer gentle support.' }]
      },
    },
  };
}

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

  const sessionId = Math.random().toString(36).substring(7);
  console.log(`📝 Session started: ${sessionId}`);

  // Connect directly to Gemini Live API via raw WebSocket.
  // The standard raw WS endpoint uses v1beta. v1alpha is ONLY for ephemeral tokens.
  const geminiURL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  
  console.log(`🔗 Connecting to Gemini Live API...`);
  const geminiWS = new WebSocket(geminiURL);

  let setupComplete = false;
  let messageQueue: string[] = [];
  let chunksReceived = 0;
  let chunksSent = 0;

  geminiWS.on('open', () => {
    console.log(`✅ Connected to Gemini Live API (${sessionId}) - waiting for client setup`);
    
    // Send any queued messages
    messageQueue.forEach(msg => {
      console.log(`📤 Sending queued message`);
      geminiWS.send(msg);
    });
    messageQueue = [];
  });

  // Forward Gemini responses to iOS
  geminiWS.on('message', (data) => {
    const dataStr = data.toString();
    chunksReceived++;
    if (chunksReceived >= 100) {
      console.log(`💬 Gemini -> Service (${sessionId}): [Received 100 chunks heartbeat]`);
      chunksReceived = 0;
    }
    
    // Check for setupComplete
    try {
      const msg = JSON.parse(dataStr);
      if (msg.setupComplete) {
        setupComplete = true;
        console.log(`✅ Setup complete - ready for messages`);
      }
    } catch (e) {}
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(dataStr);
      // console.log(`✅ Forwarded to iOS`);
    }
  });

  geminiWS.on('error', (error) => {
    console.error(`⚠️ Gemini error (${sessionId}):`, error.message);
  });

  geminiWS.on('close', (code, reason) => {
    const reasonText = reason && reason.length > 0 ? reason.toString() : 'no reason';
    console.log(`👋 Gemini disconnected (${sessionId}) code: ${code} reason: ${reasonText}`);
  });

  // Forward iOS messages to Gemini
  ws.on('message', (message) => {
    const msgStr = message.toString();
    
    try {
      const data = JSON.parse(msgStr);
      // Only log non-realtime inputs to avoid Railway rate limits
      if (!data.realtimeInput && !data.realtime_input) {
        console.log(`📨 iOS -> Service (${sessionId}): ${msgStr.substring(0, 100)}`);
      }
      
      if (data.config) {
        // Convert iOS client format { config: {...} } to Gemini format { setup: {...} }
        const setupMsg = buildSetupMessage(data);

        console.log(`📤 Converting setup to Gemini format:`, JSON.stringify(setupMsg, null, 2));
        if (geminiWS.readyState === WebSocket.OPEN) {
          geminiWS.send(JSON.stringify(setupMsg));
          console.log(`📤 Forwarded setup (converted) to Gemini`);
        } else {
          console.log(`⏳ Queuing setup (Gemini WS state: ${geminiWS.readyState})`);
          messageQueue.push(JSON.stringify(setupMsg));
        }
      } else if (data.setup) {
        // Normalize iOS setup payload to a known-valid model.
        const setupMsg = buildSetupMessage(data);
        if (geminiWS.readyState === WebSocket.OPEN) {
          geminiWS.send(JSON.stringify(setupMsg));
          console.log(`📤 Forwarded normalized setup to Gemini`);
        } else {
          console.log(`⏳ Queuing setup (Gemini WS state: ${geminiWS.readyState})`);
          messageQueue.push(JSON.stringify(setupMsg));
        }
      } else if (data.clientContent) {
        if (!setupComplete) {
          console.log(`⚠️ Setup not complete yet, queuing message`);
          return;
        }

        // Convert iOS format { clientContent: { parts: [...], role: 'user' } }
        // to Gemini format { clientContent: { turns: [{ role, parts }], turnComplete: true } }
        let forwardMsg;
        if (data.clientContent.parts) {
          // Old format - convert to new
          forwardMsg = {
            clientContent: {
              turns: [
                {
                  role: data.clientContent.role || 'user',
                  parts: data.clientContent.parts
                }
              ],
              turnComplete: true
            }
          };
        } else {
          // Already in correct format
          forwardMsg = data;
        }

        if (geminiWS.readyState === WebSocket.OPEN) {
          geminiWS.send(JSON.stringify(forwardMsg));
          const text = forwardMsg.clientContent.turns?.[0]?.parts?.[0]?.text || '';
          console.log(`✅ Forwarded to Gemini: "${text.substring(0, 50)}"`);
        } else {
          console.log(`⚠️ Gemini not ready`);
        }
      } else if (data.realtimeInput || data.realtime_input) {
        if (geminiWS.readyState === WebSocket.OPEN) {
          geminiWS.send(msgStr);
          chunksSent++;
          if (chunksSent >= 100) {
            console.log(`✅ Forwarded 100 realtime chunks to Gemini (${sessionId})`);
            chunksSent = 0;
          }
        } else {
          console.log(`⚠️ Gemini not ready`);
        }
      } else {
        console.log(`⚠️ Unknown message type:`, Object.keys(data));
      }
    } catch (error: any) {
      console.error(`❌ Parse error (${sessionId}):`, error.message);
    }
  });

  ws.on('close', () => {
    console.log(`👋 iOS client disconnected (${sessionId})`);
    if (geminiWS.readyState === WebSocket.OPEN) {
      geminiWS.close();
    }
  });

  ws.on('error', (error) => {
    console.error(`⚠️ iOS WebSocket error (${sessionId}):`, error.message);
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
