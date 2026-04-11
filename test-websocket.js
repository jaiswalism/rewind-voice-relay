import WebSocket from 'ws';

const API_KEY = 'rewind-pet-2026-secure-key';
const WS_URL = `ws://localhost:8080/ws?api_key=${API_KEY}`;

console.log('🧪 Testing Pet Talking Service...');
console.log(`Connecting to: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to service\n');
  
  // Send setup (iOS client format)
  const setup = {
    config: {
      model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      systemInstruction: {
        parts: [{ text: 'You are a helpful pet companion.' }]
      },
      generationConfig: {
        responseModalities: ['AUDIO']
      }
    }
  };

  ws.send(JSON.stringify(setup));
  console.log('📤 Sent setup message (iOS format)');
  
  // Wait then send user message
  setTimeout(() => {
    const userMsg = {
      clientContent: {
        parts: [{ text: 'I am very sad, what should I do?' }],
        role: 'user'
      }
    };

    ws.send(JSON.stringify(userMsg));
    console.log('📤 Sent user message (iOS format)\n');
  }, 2000);
});

ws.on('message', (data) => {
  const msg = data.toString();
  console.log('📨 Received (' + msg.length + ' chars):', msg.substring(0, 200));
  
  try {
    const parsed = JSON.parse(msg);
    if (parsed.serverContent?.modelTurn?.parts?.[0]?.text) {
      console.log('\n💬 Response:', parsed.serverContent.modelTurn.parts[0].text);
    }
    if (parsed.serverContent?.turnComplete) {
      console.log('\n✅ Test PASSED!');
      ws.close();
      process.exit(0);
    }
    if (parsed.setupComplete) {
      console.log('✅ Setup complete');
    }
  } catch (e) {
    console.log('Raw message:', msg);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket Error:', err.message);
  console.error('Stack:', err.stack);
});

ws.on('close', (code, reason) => {
  console.log(`👋 Disconnected (code: ${code})`);
  if (code !== 1000) {
    console.log('Reason:', reason?.toString());
  }
});

// Timeout
setTimeout(() => {
  console.log('⏰ Timeout after 15s');
  ws.close();
  process.exit(1);
}, 15000);
