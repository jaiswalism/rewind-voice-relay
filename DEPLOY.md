# 🚀 Deployment Guide

## Option 1: Railway (Recommended - Easiest)

1. **Push to GitHub**
   ```bash
   cd rewind-pet-talking-service
   git init
   git add .
   git commit -m "Initial commit"
   git push
   ```

2. **Deploy on Railway**
   - Go to https://railway.app
   - New Project → Deploy from GitHub
   - Select `rewind-pet-talking-service`
   - Add environment variables:
     - `GEMINI_API_KEY` - Your Gemini API key
     - `API_KEY` - Your custom auth key (same as in iOS app)

3. **Get your Railway URL**
   - Copy the generated URL (e.g., `https://pet-talking-service-production.up.railway.app`)

## Option 2: Render

1. Create `render.yaml`:
   ```yaml
   services:
     - type: web
       name: rewind-pet-talking-service
       runtime: node
       buildCommand: npm install && npm run build
       startCommand: npm start
       envVars:
         - key: GEMINI_API_KEY
           sync: false
         - key: API_KEY
           sync: false
   ```

2. Deploy from GitHub

## Option 3: Docker

```bash
docker build -t pet-talking-service .
docker run -p 8080:8080 \
  -e GEMINI_API_KEY=your_key \
  -e API_KEY=your_auth_key \
  pet-talking-service
```

## iOS App Configuration

After deployment, update your iOS app to connect to:

```swift
// In Info.plist or build settings
PET_TALKING_SERVICE_URL = https://your-service-url.up.railway.app
```

## 🔒 Security Checklist

- ✅ Use HTTPS in production (Railway provides this automatically)
- ✅ Set a strong `API_KEY` (not the default)
- ✅ Rotate `GEMINI_API_KEY` periodically
- ✅ Monitor WebSocket connections
- ✅ Add rate limiting if needed
