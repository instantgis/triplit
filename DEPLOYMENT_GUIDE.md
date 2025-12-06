# Triplit Deployment Guide for Audio Guide PWA

## Overview

This guide covers deploying a Triplit-powered Angular PWA audio guide application with real-time sync capabilities.

---

## Architecture Options

### Option 1: Hybrid (Netlify + Container Platform) - RECOMMENDED

```
┌─────────────────────────────────────────┐
│  Netlify (Serverless)                   │
│  - Angular PWA (static)                 │
│  - Triplit Console (static)             │
│  - NestJS API (functions) [optional]    │
└──────────────┬──────────────────────────┘
               │
               │ WebSocket (real-time sync)
               ▼
┌─────────────────────────────────────────┐
│  Railway/Render/Fly.io (Container)      │
│  - Triplit Server (Bun/Node)            │
│  - SQLite/LMDB storage                  │
│  - WebSocket support ✅                 │
└─────────────────────────────────────────┘
```

**Pros:**
- ✅ Leverage Netlify's free tier for static content
- ✅ Real-time sync via WebSocket
- ✅ Persistent database storage
- ✅ Low cost ($0-5/month)

**Cons:**
- ⚠️ Two platforms to manage
- ⚠️ CORS configuration needed

---

### Option 2: All-in-One Container Platform

```
┌─────────────────────────────────────────┐
│  Railway/Render/Fly.io                  │
│  - Angular PWA (static)                 │
│  - NestJS API (container)               │
│  - Triplit Server (container)           │
│  - Triplit Console (static)             │
└─────────────────────────────────────────┘
```

**Pros:**
- ✅ Single platform (simpler management)
- ✅ WebSocket support
- ✅ Persistent storage
- ✅ No CORS issues

**Cons:**
- ❌ Lose Netlify's free tier
- ❌ Slightly higher cost ($5-10/month)

---

### Option 3: Netlify Functions Only (NO WEBSOCKET)

```
┌─────────────────────────────────────────┐
│  Netlify (Serverless Functions)         │
│  - Angular PWA (static)                 │
│  - Triplit Server (HTTP-only)           │
│  - NestJS API (functions)               │
└─────────────────────────────────────────┘
```

**Pros:**
- ✅ Single platform
- ✅ Free tier
- ✅ Simple deployment

**Cons:**
- ❌ **NO WebSocket** (no real-time sync)
- ❌ **NO persistent storage** (data lost on cold start)
- ❌ 10-second timeout limit
- ❌ **Defeats Triplit's purpose**

**⚠️ NOT RECOMMENDED** - Triplit without WebSocket is like a car without wheels.

---

## Why Netlify Functions Don't Work for Triplit

### Netlify Functions Limitations:

| Feature | Netlify Functions | Triplit Needs |
|---------|------------------|---------------|
| **WebSocket** | ❌ Not supported | ✅ Required for real-time sync |
| **Persistent Storage** | ❌ Ephemeral | ✅ Required for SQLite/LMDB |
| **Long Connections** | ❌ 10-26 sec timeout | ✅ Persistent WebSocket |
| **HTTP API** | ✅ Supported | ✅ Works but limited |

**Source:** [Netlify Functions Docs](https://docs.netlify.com/functions/overview/)

**Verdict:** You can run NestJS on Netlify Functions, but **NOT Triplit Server** (unless you give up real-time sync).

---

## Recommended Deployment Strategy

### For Audio Guide PWA with Real-Time Sync:

**Use Option 1: Hybrid Deployment**

1. **Netlify** - Static content (Angular PWA, Console)
2. **Railway/Render** - Triplit Server (WebSocket + storage)

---

## Platform Comparison

### Container Platforms (WebSocket-Friendly):

| Platform | Free Tier | WebSocket | Storage | Docker | Cost |
|----------|-----------|-----------|---------|--------|------|
| **Railway** | $5 credit/mo | ✅ | ✅ Volumes | ✅ | $5/mo |
| **Render** | Free tier | ✅ | ✅ Disks (paid) | ✅ | Free → $7/mo |
| **Fly.io** | Free tier | ✅ | ✅ Volumes | ✅ | Free → $5/mo |
| **Hetzner VPS** | No free tier | ✅ | ✅ Full disk | ✅ | €4.5/mo |

**Recommendation:** **Railway** (easiest) or **Render** (most generous free tier)

---

## Deployment Instructions

### Part 1: Deploy Console to Netlify

**Build the console:**

```bash
cd packages/console
yarn build:web
```

**Deploy to Netlify:**

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
cd packages/console
netlify deploy --prod --dir=dist/public
```

**Result:** Console at `https://your-site.netlify.app`

**Alternative:** Connect GitHub repo to Netlify for auto-deploy:
1. Go to Netlify dashboard
2. "New site from Git"
3. Select repo
4. **Base directory:** `packages/console`
5. **Build command:** `yarn build:web`
6. **Publish directory:** `packages/console/dist/public`

---

### Part 2: Deploy Triplit Server to Railway

**Prerequisites:**
- Railway account (free)
- GitHub repo with Triplit code

**Option A: Deploy from GitHub (Recommended)**

1. **Go to Railway:** https://railway.app
2. **New Project** → **Deploy from GitHub repo**
3. **Select repo:** `aspen-cloud/triplit` (or your fork)
4. **Configure service:**
   - **Root directory:** `packages/bun-server` (or `packages/node-server`)
   - **Build command:** (auto-detected from Dockerfile)
   - **Start command:** (auto-detected)

5. **Add environment variables:**
   ```
   JWT_SECRET=your-super-secret-key-here
   LOCAL_DATABASE_URL=/data/triplit.db
   PORT=8080
   ```

6. **Add volume for persistent storage:**
   - Go to service settings
   - **Volumes** → **New Volume**
   - **Mount path:** `/data`
   - **Size:** 1GB (free tier)

7. **Deploy!**

**Result:** Server at `https://your-app.railway.app`

---

**Option B: Deploy with Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd packages/bun-server
railway init

# Add environment variables
railway variables set JWT_SECRET=your-secret-key
railway variables set LOCAL_DATABASE_URL=/data/triplit.db

# Deploy
railway up
```

---

### Part 3: Deploy Triplit Server to Render

**Prerequisites:**
- Render account (free)
- GitHub repo

**Steps:**

1. **Go to Render:** https://render.com
2. **New** → **Web Service**
3. **Connect GitHub repo**
4. **Configure:**
   - **Name:** `triplit-server`
   - **Root Directory:** `packages/bun-server`
   - **Environment:** `Docker`
   - **Region:** Choose closest to your users
   - **Instance Type:** Free (or Starter $7/mo for persistent disk)

5. **Environment Variables:**
   ```
   JWT_SECRET=your-super-secret-key
   LOCAL_DATABASE_URL=/data/triplit.db
   PORT=8080
   ```

6. **Add Persistent Disk (Paid plans only):**
   - **Disks** → **Add Disk**
   - **Mount Path:** `/data`
   - **Size:** 1GB

7. **Deploy!**

**Result:** Server at `https://triplit-server.onrender.com`

**Note:** Free tier has **no persistent storage** - use Railway or upgrade to Starter plan.

---

### Part 4: Connect Angular PWA to Triplit Server

**In your Angular app:**

```typescript
// src/app/services/triplit.service.ts
import { Injectable } from '@angular/core';
import { TriplitClient } from '@triplit/client';

@Injectable({
  providedIn: 'root'
})
export class TriplitService {
  private client: TriplitClient;

  constructor() {
    this.client = new TriplitClient({
      serverUrl: 'https://your-app.railway.app', // Your Railway/Render URL
      token: this.generateUserToken(), // Generate JWT for users
      // OR use service token for admin access:
      // token: 'your-service-token-here'
    });
  }

  // Query audio guides
  async getAudioGuides() {
    return this.client.fetch(
      this.client.query('audio_guides')
        .where('published', '=', true)
        .order('createdAt', 'DESC')
    );
  }

  // Subscribe to real-time updates
  subscribeToGuides(callback: (guides: any[]) => void) {
    return this.client.subscribe(
      this.client.query('audio_guides').where('published', '=', true),
      (results) => callback([...results])
    );
  }

  private generateUserToken(): string {
    // Generate JWT token for users
    // Use your NestJS API to generate tokens server-side
    return 'user-jwt-token';
  }
}
```

**Environment configuration:**

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  triplitServerUrl: 'https://your-app.railway.app',
  triplitToken: 'your-token-here' // Or fetch from auth service
};
```

---

### Part 5: Connect Console to Server

1. **Open console:** `https://your-console.netlify.app`
2. **Click "Import Server"**
3. **Enter details:**
   - **Server URL:** `https://your-app.railway.app`
   - **Display Name:** `Audio Guide Production`
   - **Service Token:** Generate using JWT_SECRET (see below)

**Generate Service Token:**

```javascript
// generate-token.js
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    'x-triplit-token-type': 'secret',
    'x-triplit-project-id': 'audio-guide'
  },
  'your-jwt-secret-from-railway', // Same as JWT_SECRET env var
  { expiresIn: '365d' } // Optional: 1 year expiry
);

console.log('Service Token:', token);
```

Run: `node generate-token.js`

---

## Docker Configuration

### Bun Server Dockerfile

**Check if exists:**

```bash
ls packages/bun-server/Dockerfile
```

**If missing, create `packages/bun-server/Dockerfile`:**

```dockerfile
FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production

# Copy source
COPY . .

# Expose port
EXPOSE 8080

# Create data directory
RUN mkdir -p /data

# Start server
CMD ["bun", "start"]
```

---

### Node Server Dockerfile

**Check if exists:**

```bash
ls packages/node-server/Dockerfile
```

**If missing, create `packages/node-server/Dockerfile`:**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* ./

# Install dependencies
RUN yarn install --production

# Copy source
COPY . .

# Expose port
EXPOSE 8080

# Create data directory
RUN mkdir -p /data

# Start server
CMD ["node", "run.js"]
```

---

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing service tokens | `my-super-secret-key-2024` |
| `LOCAL_DATABASE_URL` | Path to database file | `/data/triplit.db` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `PROJECT_ID` | Project identifier | `undefined` |
| `EXTERNAL_JWT_SECRET` | Secret for user tokens | Same as `JWT_SECRET` |
| `VERBOSE_LOGS` | Enable detailed logging | `false` |

---

## Cost Breakdown

### Option 1: Hybrid (Netlify + Railway)

| Service | Component | Cost |
|---------|-----------|------|
| **Netlify** | Angular PWA + Console | **Free** |
| **Railway** | Triplit Server | **$5/mo** (after free credit) |
| **Total** | | **$5/mo** |

### Option 2: All-in-One (Railway)

| Service | Component | Cost |
|---------|-----------|------|
| **Railway** | PWA + NestJS + Triplit | **$5-10/mo** |
| **Total** | | **$5-10/mo** |

### Option 3: Render (with persistent storage)

| Service | Component | Cost |
|---------|-----------|------|
| **Netlify** | Angular PWA + Console | **Free** |
| **Render** | Triplit Server (Starter) | **$7/mo** |
| **Total** | | **$7/mo** |

---

## Troubleshooting

### Console can't connect to server

**Error:** `Failed to connect to server`

**Fixes:**
1. Check server is running: `curl https://your-app.railway.app/`
2. Verify CORS is enabled (Hono enables by default)
3. Check JWT_SECRET matches between server and token
4. Verify WebSocket upgrade works: `wscat -c wss://your-app.railway.app`

### WebSocket connection fails

**Error:** `WebSocket connection failed`

**Fixes:**
1. Ensure platform supports WebSocket (Railway/Render do, Netlify Functions don't)
2. Check firewall/proxy settings
3. Use `wss://` (secure WebSocket) for HTTPS deployments
4. Verify server logs for WebSocket upgrade errors

### Database file not persisting

**Error:** Data lost after restart

**Fixes:**
1. **Railway:** Add volume mounted at `/data`
2. **Render:** Upgrade to paid plan with persistent disk
3. Verify `LOCAL_DATABASE_URL` points to volume mount path
4. Check volume is properly mounted: `ls -la /data` in server logs

### CORS errors

**Error:** `Access-Control-Allow-Origin` error

**Fix:** Hono enables CORS by default, but if needed:

```typescript
// In server configuration
import { cors } from 'hono/cors';

app.use('/*', cors({
  origin: ['https://your-pwa.netlify.app', 'https://your-console.netlify.app'],
  credentials: true,
}));
```

---

## Summary

### Recommended Setup for Audio Guide PWA:

1. ✅ **Angular PWA** → Netlify (free, static)
2. ✅ **Triplit Console** → Netlify (free, static)
3. ✅ **NestJS API** → Netlify Functions (free, serverless) OR Railway (container)
4. ✅ **Triplit Server** → Railway (WebSocket + storage, $5/mo)

**Total Cost:** **$0-5/month**

**Why this works:**
- ✅ Real-time sync via WebSocket
- ✅ Persistent database storage
- ✅ Leverages Netlify's free tier
- ✅ Simple deployment (Git push)
- ✅ Scalable architecture

**Key Takeaway:** Netlify Functions work great for NestJS HTTP APIs, but **NOT for Triplit** (needs WebSocket). Deploy Triplit to a container platform like Railway or Render.

