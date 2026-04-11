import WebSocket from 'ws';

const API_KEY = 'rewind-pet-2026-secure-key';
const WS_URL = `ws://localhost:8080/ws?api_key=${API_KEY}`;

console.log('🧪 Testing Pet Talking Service (Proxy)...');
console.log(`Connecting to: ${WS_URL}\n`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to service\n');

  // Send setup (iOS client format)
  const setup = {
    config: {
      model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      generationConfig: {
        responseModalities: ['AUDIO']
      }
    }
  };

  ws.send(JSON.stringify(setup));
  console.log('📤 Sent setup message\n');
});

ws.on('message', (data) => {
  const msg = data.toString();
  
  try {
    const parsed = JSON.parse(msg);
    
    if (parsed.setupComplete) {
      console.log('✅ Setup complete from proxy\n');
      
      // Wait a bit then send user message
      setTimeout(() => {
        const userMsg = {
          clientContent: {
            parts: [{ text: 'Hello, how are you?' }],
            role: 'user'
          }
        };

        ws.send(JSON.stringify(userMsg));
        console.log('📤 Sent user message\n');
      }, 1000);
    }
    
    if (parsed.serverContent) {
      if (parsed.serverContent.modelTurn?.parts?.[0]?.text) {
        console.log('💬 Text response:', parsed.serverContent.modelTurn.parts[0].text.substring(0, 100));
      }
      if (parsed.serverContent.modelTurn?.parts?.[0]?.inlineData) {
        console.log('🎵 Audio chunk received (' + parsed.serverContent.modelTurn.parts[0].inlineData.data.length + ' chars)');
      }
      if (parsed.serverContent.generationComplete) {
        console.log('\n✅ Generation complete - TEST PASSED!');
        ws.close();
        process.exit(0);
      }
    }
  } catch (e) {
    console.log('Raw:', msg.substring(0, 100));
  }
});

ws.on('error', (err) => {
  console.error('❌ Error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`👋 Closed (code: ${code})`);
  if (reason?.length > 0) console.log('Reason:', reason.toString());
  process.exit(code === 1000 ? 0 : 1);
});

setTimeout(() => {
  console.log('⏰ Timeout');
  ws.close();
  process.exit(1);
}, 20000);
