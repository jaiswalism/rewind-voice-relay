import WebSocket from 'ws';

const GEMINI_API_KEY = 'AIzaSyAMV_nJ0MIFhjazntC7dnSIWz6B3zElV8o';

// Test v1beta endpoint
const GEMINI_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;

console.log('🧪 Testing DIRECT Gemini Live API WebSocket...');
console.log(`Connecting to: ${GEMINI_URL}\n`);

const ws = new WebSocket(GEMINI_URL);

ws.on('open', () => {
  console.log('✅ Connected to Gemini Live API\n');

  // Send setup in CORRECT wrapper format
  const setup = {
    setup: {
      model: 'models/gemini-3.1-flash-live-preview',
      systemInstruction: {
        parts: [{ text: 'You are a helpful assistant.' }]
      },
      generationConfig: {
        responseModalities: ['TEXT']
      }
    }
  };

  ws.send(JSON.stringify(setup));
  console.log('📤 Sent setup message:', JSON.stringify(setup, null, 2));
});

ws.on('message', (data) => {
  const msg = data.toString();
  console.log('\n📨 Received (' + msg.length + ' chars):', msg.substring(0, 300));

  try {
    const parsed = JSON.parse(msg);
    if (parsed.setupComplete) {
      console.log('✅ Setup complete!');
      
      // Send a test message
      setTimeout(() => {
        const userMsg = {
          clientContent: {
            parts: [{ text: 'I am very sad, what should I do?' }],
            role: 'user'
          }
        };
        ws.send(JSON.stringify(userMsg));
        console.log('\n📤 Sent user message');
      }, 500);
    }
    if (parsed.serverContent?.modelTurn?.parts?.[0]?.text) {
      console.log('\n💬 Response:', parsed.serverContent.modelTurn.parts[0].text);
    }
    if (parsed.serverContent?.turnComplete) {
      console.log('\n✅ Test PASSED! Live API is working!');
      ws.close();
      process.exit(0);
    }
  } catch (e) {
    console.log('Raw message:', msg);
  }
});

ws.on('error', (err) => {
  console.error('\n❌ WebSocket Error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`\n👋 Disconnected (code: ${code})`);
  if (reason && reason.length > 0) {
    console.log('Reason:', reason.toString());
  }
  process.exit(code === 1000 ? 0 : 1);
});

// Timeout
setTimeout(() => {
  console.log('⏰ Timeout after 15s');
  ws.close();
  process.exit(1);
}, 15000);
