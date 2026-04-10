# 🐾 Rewind Pet Talking Service

Real-time pet companion conversation service using Gemini Live API (WebSocket streaming).

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 3. Run
```bash
npm run dev
```

## 📡 WebSocket API

### Connection
```
ws://localhost:8080/ws?api_key=your_api_key
```

### Message Format
The service proxies audio/text between iOS app and Gemini Live API for real-time conversations.

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Your Gemini API key |
| `PORT` | ❌ | Server port (default: 8080) |
| `HOST` | ❌ | Server host (default: 0.0.0.0) |
| `API_KEY` | ❌ | Client authentication key |

## 🐳 Deployment

Deploy to Railway, Render, or any Node.js hosting platform:

```bash
npm run build
npm start
```

## 🔒 Security

- API key authentication for client connections
- Gemini API key stays server-side (never exposed to clients)
- Secure WebSocket connections (wss://) in production
