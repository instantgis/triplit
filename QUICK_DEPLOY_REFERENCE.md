# Quick Deploy Reference - Triplit Audio Guide PWA

## TL;DR

**You were right!** Netlify DOES support serverless functions (NestJS works), but **NOT WebSocket** (Triplit needs this).

---

## The Problem

| What | Netlify Functions | Triplit Needs |
|------|------------------|---------------|
| **HTTP API** | ✅ Works | ✅ Works |
| **WebSocket** | ❌ NOT supported | ✅ **REQUIRED** for real-time sync |
| **Persistent Storage** | ❌ Ephemeral | ✅ **REQUIRED** for SQLite |
| **Timeout** | 10-26 seconds | ✅ Persistent connections |

**Verdict:** NestJS on Netlify ✅ | Triplit on Netlify ❌

---

## The Solution

### Recommended Architecture:

```
Netlify (Free)                Railway/Render ($5/mo)
├─ Angular PWA        ←──────→  Triplit Server
├─ Console                      ├─ WebSocket ✅
└─ NestJS API (optional)        └─ SQLite storage ✅
```

**Why?**
- ✅ Keep Netlify's free tier for static content
- ✅ Get WebSocket + storage on Railway/Render
- ✅ Total cost: $5/month

---

## Quick Deploy Commands

### 1. Deploy Console to Netlify

```bash
cd packages/console
yarn build:web
netlify deploy --prod --dir=dist/public
```

### 2. Deploy Server to Railway

```bash
# Install CLI
npm install -g @railway/cli

# Login and deploy
cd packages/bun-server
railway login
railway init
railway variables set JWT_SECRET=your-secret-key
railway variables set LOCAL_DATABASE_URL=/data/triplit.db
railway up

# Add volume for storage
# (Do this in Railway dashboard: Settings → Volumes → New Volume → /data)
```

### 3. Connect Angular PWA

```typescript
// src/app/services/triplit.service.ts
import { TriplitClient } from '@triplit/client';

const client = new TriplitClient({
  serverUrl: 'https://your-app.railway.app',
  token: 'your-jwt-token'
});
```

---

## Platform Comparison

| Platform | WebSocket | Storage | Free Tier | Best For |
|----------|-----------|---------|-----------|----------|
| **Netlify** | ❌ | ❌ | ✅ Yes | Static sites, HTTP APIs |
| **Railway** | ✅ | ✅ | $5 credit | **Triplit (recommended)** |
| **Render** | ✅ | ✅ (paid) | ✅ Yes | Triplit (free tier limited) |
| **Fly.io** | ✅ | ✅ | ✅ Yes | Triplit (more complex) |

---

## Cost Breakdown

### Option 1: Hybrid (Recommended)
- **Netlify:** Free (PWA + Console + NestJS)
- **Railway:** $5/mo (Triplit Server)
- **Total:** **$5/month**

### Option 2: All Railway
- **Railway:** $5-10/mo (everything)
- **Total:** **$5-10/month**

---

## Generate Service Token

```javascript
// generate-token.js
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { 'x-triplit-token-type': 'secret', 'x-triplit-project-id': 'audio-guide' },
  'your-jwt-secret', // Same as JWT_SECRET env var
  { expiresIn: '365d' }
);

console.log(token);
```

Run: `node generate-token.js`

---

## Environment Variables

```bash
# Required
JWT_SECRET=your-super-secret-key-here
LOCAL_DATABASE_URL=/data/triplit.db

# Optional
PORT=8080
PROJECT_ID=audio-guide
VERBOSE_LOGS=true
```

---

## Troubleshooting

### Console won't connect
1. Check server URL: `curl https://your-app.railway.app/`
2. Verify JWT_SECRET matches
3. Check WebSocket: `wscat -c wss://your-app.railway.app`

### Data not persisting
1. Add volume in Railway dashboard
2. Mount at `/data`
3. Verify `LOCAL_DATABASE_URL=/data/triplit.db`

### CORS errors
Hono enables CORS by default - should work out of the box

---

## Key Files

- **Server Guide:** `TRIPLIT_SERVER_GUIDE.md` (555 lines)
- **Deployment Guide:** `DEPLOYMENT_GUIDE.md` (552 lines)
- **This Reference:** `QUICK_DEPLOY_REFERENCE.md`

---

## Summary

**Your NestJS on Netlify:** ✅ Works great (serverless functions)  
**Triplit on Netlify:** ❌ Won't work (needs WebSocket)  
**Solution:** Deploy Triplit to Railway/Render ($5/mo)  
**Total Cost:** $5/month for full real-time sync

