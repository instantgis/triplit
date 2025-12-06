# Triplit Server Architecture Guide

## Overview

Triplit has a **layered server architecture** supporting multiple runtimes (Node.js, Bun, Cloudflare Workers, and theoretically Deno).

---

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│    Runtime-Specific Servers                     │
│    (Node, Bun, Cloudflare Workers)              │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│    @triplit/server (Hono-based)                 │
│    - HTTP/WebSocket routing                     │
│    - JWT authentication                         │
│    - Request/response handling                  │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│    @triplit/server-core (Protocol)              │
│    - TriplitServer class                        │
│    - Session management                         │
│    - Route handling                             │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│    @triplit/db (Database)                       │
│    - Query engine                               │
│    - Schema management                          │
│    - Storage adapters                           │
└─────────────────────────────────────────────────┘
```

---

## Server Packages

### 1. `@triplit/server-core` (Protocol Layer)
**Location:** `packages/server-core/`

**Purpose:** Protocol-agnostic server logic

**Key Components:**
- `TriplitServer` class - Main server logic
- Session management - Authenticated connections
- Route handlers - Business logic for all operations

**Supported Routes:**
- `fetch` - Query data
- `insert` - Insert entity
- `update` - Update entity
- `delete` - Delete entity
- `bulk-insert` - Insert multiple entities
- `schema` - Get/update schema
- `stats` - Collection statistics
- `clear` - Clear database
- `apply-changes` - Apply transaction changes
- `webhooks-get/push/clear` - Webhook management

**No HTTP/WebSocket knowledge** - pure business logic.

---

### 2. `@triplit/server` (HTTP/WebSocket Layer)
**Location:** `packages/server/`

**Purpose:** Wraps server-core with Hono web framework

**Key Files:**
- `src/hono.ts` - Creates Hono app with routes and WebSocket
- `src/server.ts` - Node.js-specific server creation
- `src/bun.ts` - Bun-specific server creation
- `src/cloudflare.ts` - Cloudflare Workers adapter
- `src/storage.ts` - Storage provider factory

**Exports:**
```typescript
// Main Node.js server
export { createServer } from './server.js';

// Storage providers
export { createTriplitStorageProvider } from './storage.js';

// Runtime-specific
export { createBunServer } from './bun.js';
export { createTriplitHonoServer } from './hono.js';
```

---

### 3. Runtime-Specific Servers

#### A. Node.js Server (`@triplit/node-server`)
**Location:** `packages/node-server/`
**Entry Point:** `run.js`

**Dependencies:**
- `@triplit/server` - Core server
- `better-sqlite3` - SQLite driver

**How to Run:**
```powershell
cd packages/node-server

# Set environment variables
$env:PORT = "8080"
$env:JWT_SECRET = "your-secret-key"
$env:LOCAL_DATABASE_URL = "C:/data/triplit.db"

# Start server
yarn start
# or
node run.js
```

**Configuration:**
```javascript
const startServer = await createServer({
  storage: await createTriplitStorageProvider('sqlite'),
  verboseLogs: !!process.env.VERBOSE_LOGS,
  jwtSecret: process.env.JWT_SECRET,
  projectId: process.env.PROJECT_ID,
  externalJwtSecret: process.env.EXTERNAL_JWT_SECRET,
  maxPayloadMb: process.env.MAX_BODY_SIZE,
});
```

---

#### B. Bun Server (`bun-server`)
**Location:** `packages/bun-server/`
**Entry Point:** `index.ts`

**Dependencies:**
- `@triplit/server` - Core server
- `hono` - Web framework
- No SQLite driver needed (Bun has native SQLite)

**How to Run:**
```powershell
cd packages/bun-server

# Set environment variables (same as Node)
$env:PORT = "8080"
$env:JWT_SECRET = "your-secret-key"
$env:LOCAL_DATABASE_URL = "C:/data/triplit.db"

# Start server
bun start
```

**Advantages over Node:**
- ✅ Faster startup (~10x)
- ✅ Native SQLite (no compilation)
- ✅ Lower memory usage
- ✅ Better WebSocket performance

---

#### C. Cloudflare Workers (`@triplit/cf-worker-server`)
**Location:** `packages/cf-worker-server/`

**Uses Durable Objects** for persistent storage.

**How to Deploy:**
```powershell
cd packages/cf-worker-server
npx wrangler deploy
```

**Configuration:** `wrangler.jsonc`

---

#### D. Deno (No Dedicated Package)
**Status:** Theoretically supported via Hono (which runs on Deno)

**How to Use:** Create custom entry point using `@triplit/server/hono`

---

## Storage Adapters

The server supports multiple storage backends via `createTriplitStorageProvider()`:

| Storage | Type | Use Case | Persistence | Performance |
|---------|------|----------|-------------|-------------|
| **`sqlite`** | SQL | Production (Node/Bun) | ✅ Disk | Good |
| **`lmdb`** | Key-Value | High-performance production | ✅ Disk | Excellent |
| **`memory-btree`** | In-Memory | Development/testing | ❌ RAM only | Excellent |
| **`memory`** | In-Memory | Development/testing | ❌ RAM only | Good |
| **`sqlite-worker`** | SQL | Web Workers | ✅ Disk | Good |
| **Cloudflare DO** | Key-Value | Cloudflare Workers | ✅ Durable Objects | Good |

**Storage Selection:**
```typescript
// SQLite (recommended for most cases)
storage: await createTriplitStorageProvider('sqlite')

// LMDB (faster, more memory)
storage: await createTriplitStorageProvider('lmdb')

// Memory (testing only - data lost on restart)
storage: await createTriplitStorageProvider('memory')
```

**Database Path:**
Set via `LOCAL_DATABASE_URL` environment variable:
```powershell
# SQLite
$env:LOCAL_DATABASE_URL = "C:/data/triplit.db"

# LMDB
$env:LOCAL_DATABASE_URL = "C:/data/triplit-lmdb"
```

**Recommendations:**
- **Development:** `memory` or `memory-btree` (fast, no persistence needed)
- **Production (Node):** `sqlite` (reliable, widely supported)
- **Production (Bun):** `sqlite` (native support, no compilation)
- **High Performance:** `lmdb` (faster than SQLite, more memory)
- **Cloudflare:** Durable Objects (only option)

---

## How Sync Works

### WebSocket Connection Flow

```
1. Client connects to ws://server:8080
2. Server upgrades HTTP → WebSocket
3. Client sends JWT token for authentication
4. Server validates token, creates session
5. Client subscribes to queries
6. Server sends initial data snapshot
7. Real-time updates flow bidirectionally:
   - Client mutations → Server → Broadcast to all subscribers
   - Server changes → Push to subscribed clients
```

### HTTP API Routes

All routes are POST requests to `http://server:8080/{route}`:

```
POST /fetch          - Query data
POST /insert         - Insert entity
POST /update         - Update entity
POST /delete         - Delete entity
POST /bulk-insert    - Insert multiple entities
POST /schema         - Get/update schema
POST /stats          - Collection statistics
POST /clear          - Clear database (admin only)
POST /apply-changes  - Apply transaction changes
```

**Example Request:**
```javascript
fetch('http://localhost:8080/fetch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_JWT_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: {
      collectionName: 'todos',
      where: [['status', '=', 'active']],
      order: [['createdAt', 'DESC']],
      limit: 10
    }
  })
});
```

---

## Authentication

### JWT Tokens

The server uses **JWT tokens** for authentication with two types:

#### 1. Service Token (Admin)
- **Purpose:** Full access to all operations
- **Used by:** Triplit Console, admin tools
- **Generated with:** `JWT_SECRET` environment variable
- **Payload:**
  ```json
  {
    "x-triplit-token-type": "secret",
    "x-triplit-project-id": "your-project-id"
  }
  ```

#### 2. External Token (User)
- **Purpose:** Limited by schema rules and permissions
- **Used by:** Client applications
- **Verified with:** `EXTERNAL_JWT_SECRET` environment variable
- **Payload:**
  ```json
  {
    "x-triplit-token-type": "external",
    "x-triplit-project-id": "your-project-id",
    "x-triplit-user-id": "user-123"
  }
  ```

### Generating Tokens

**Service Token (for console):**
```javascript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  {
    'x-triplit-token-type': 'secret',
    'x-triplit-project-id': 'my-project'
  },
  process.env.JWT_SECRET
);
```

**External Token (for users):**
```javascript
const token = jwt.sign(
  {
    'x-triplit-token-type': 'external',
    'x-triplit-project-id': 'my-project',
    'x-triplit-user-id': userId
  },
  process.env.EXTERNAL_JWT_SECRET
);
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for service tokens | `your-secret-key-here` |
| `LOCAL_DATABASE_URL` | Path to database file | `C:/data/triplit.db` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `PROJECT_ID` | Project identifier | `undefined` |
| `EXTERNAL_JWT_SECRET` | Secret for external tokens | Same as `JWT_SECRET` |
| `VERBOSE_LOGS` | Enable detailed logging | `false` |
| `MAX_BODY_SIZE` | Max request payload (MB) | `undefined` |

---

## Comparison: Node vs Bun vs Cloudflare

| Feature | Node.js | Bun | Cloudflare Workers |
|---------|---------|-----|-------------------|
| **Startup Speed** | ~500ms | ~50ms | Instant (edge) |
| **SQLite** | `better-sqlite3` | Native | Durable Objects |
| **WebSocket** | `ws` library | Native | Hibernation API |
| **Memory Usage** | Higher | Lower | Minimal |
| **Deployment** | VPS/Docker | VPS/Docker | Cloudflare |
| **Cost** | $5-20/mo | $5-20/mo | Pay-per-use |
| **Maturity** | ✅ Battle-tested | ⚠️ Newer | ✅ Proven |
| **Best For** | Traditional hosting | Performance | Global edge |

---

## Which Server Should You Use?

### For Self-Hosting (Recommended)

**1. Node.js** (`@triplit/node-server`)
- ✅ Most mature and battle-tested
- ✅ Works everywhere (Windows, Linux, macOS)
- ✅ Easy to deploy (Docker, VPS, any Node host)
- ✅ Extensive ecosystem
- ❌ Slower startup than Bun
- ❌ Requires native module compilation for SQLite

**2. Bun** (`bun-server`)
- ✅ Fastest performance (10x faster startup)
- ✅ Native SQLite (no compilation needed)
- ✅ Lower memory usage
- ✅ Better WebSocket performance
- ❌ Newer runtime (less battle-tested)
- ❌ Smaller ecosystem

### For Cloud Deployment

**3. Cloudflare Workers** (`@triplit/cf-worker-server`)
- ✅ Global edge deployment (low latency worldwide)
- ✅ Auto-scaling (handles traffic spikes)
- ✅ Pay-per-use pricing (can be cheaper)
- ✅ No server management
- ❌ Vendor lock-in
- ❌ More complex setup
- ❌ Durable Objects have limits

---

## Quick Start: Running Node Server

```powershell
# Navigate to server directory
cd packages/node-server

# Install dependencies (if not already done)
yarn install

# Set environment variables
$env:PORT = "8080"
$env:JWT_SECRET = "my-super-secret-key"
$env:LOCAL_DATABASE_URL = "C:/data/triplit.db"

# Start server
yarn start
```

**Expected output:**
```
running on port 8080
```

**Test it:**
```powershell
# Health check (should return 404 - no route defined, but server is running)
curl http://localhost:8080/

# Connect console to http://localhost:8080
```

---

## Quick Start: Running Bun Server

```powershell
# Install Bun (if not already installed)
# https://bun.sh/

# Navigate to server directory
cd packages/bun-server

# Set environment variables
$env:PORT = "8080"
$env:JWT_SECRET = "my-super-secret-key"
$env:LOCAL_DATABASE_URL = "C:/data/triplit.db"

# Start server
bun start
```

---

## Connecting the Console

Once your server is running:

1. **Open the console** at `http://localhost:5173/` (if dev server is running)
2. **Click "Import Server"**
3. **Enter server details:**
   - **Server URL:** `http://localhost:8080`
   - **Service Token:** Generate using the JWT_SECRET (see Authentication section)
4. **Click "Connect"**

The console will now show your database collections and data.

---

## Production Deployment

### Docker (Node.js)

**Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY packages/node-server .
RUN yarn install --production
EXPOSE 8080
CMD ["node", "run.js"]
```

**Build and run:**
```powershell
docker build -t triplit-server .
docker run -p 8080:8080 `
  -e JWT_SECRET=your-secret `
  -e LOCAL_DATABASE_URL=/data/triplit.db `
  -v C:/data:/data `
  triplit-server
```

### Docker (Bun)

See `packages/bun-server/Dockerfile` for official Bun Docker image.

---

## Troubleshooting

### Server won't start

**Error:** `Environment variable LOCAL_DATABASE_URL is not set`
**Fix:** Set the environment variable:
```powershell
$env:LOCAL_DATABASE_URL = "C:/data/triplit.db"
```

**Error:** `EADDRINUSE: address already in use`
**Fix:** Port 8080 is already in use. Change the port:
```powershell
$env:PORT = "8081"
```

### Console can't connect

**Error:** `Failed to connect to server`
**Fix:**
1. Verify server is running: `curl http://localhost:8080/`
2. Check firewall settings
3. Verify JWT_SECRET matches between server and token

### Database file locked

**Error:** `database is locked`
**Fix:**
1. Only one process can write to SQLite at a time
2. Stop other server instances
3. Consider using LMDB for better concurrency

---

## Summary

- **3 server packages:** `node-server`, `bun-server`, `cf-worker-server`
- **2 core packages:** `@triplit/server` (HTTP/WS), `@triplit/server-core` (protocol)
- **Multiple storage options:** SQLite, LMDB, Memory, Cloudflare DO
- **JWT authentication:** Service tokens (admin) and External tokens (users)
- **Real-time sync:** WebSocket-based bidirectional updates
- **HTTP API:** RESTful routes for all database operations

**Recommended for self-hosting:** Start with **Node.js server** for stability, switch to **Bun** for performance.

