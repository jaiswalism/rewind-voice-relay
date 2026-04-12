# rewind-voice-relay

WebSocket relay server that proxies real-time audio between the Rewind iOS app and the Gemini Live API.

> Built specifically for Rewind. Not a general-purpose relay.

## What it does

Receives audio from the iOS client over WebSocket, forwards it to Gemini Live in the correct binary format, and streams the response back — enabling low-latency voice conversations with the virtual companion.

## Stack

- Node.js + WebSocket (`ws`)
- Gemini Live API (v1beta)

---

© 2026 Shyam Jaiswal · rewind@shyamjaiswal.in
