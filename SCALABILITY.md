# FlakeSecure — Scalability & High-Availability Architecture

This document specifies the horizontal scaling, geo-distributed routing, and Socket.IO cluster architecture for the FlakeSecure ecosystem.

---

## 1. Regional Server Infrastructure (GeoDNS)

When scaling FlakeSecure globally, relay latency and socket proximity are optimized using regional edge clusters:

```
                  ┌───────────────────────────────┐
                  │  GeoDNS / Anycast Routing    │
                  │  relay.flakesecure.dev        │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ EU Region (Frankfurt)│    │ US Region (Virginia) │    │ AP Region (Tokyo)    │
│ de.flakesecure...│    │ us.flakesecure...│    │ ap.flakesecure...│
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                        │                        │
         ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Socket.IO Cluster│    │ Socket.IO Cluster│    │ Socket.IO Cluster│
│ + Redis Adapter  │    │ + Redis Adapter  │    │ + Redis Adapter  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### QR Code Regional Encoding
The QR code and deep-link URI format supports regional targeting:
```
flakesecure://auth?s=<SID>&k=<KEY>&d=<DOMAIN>&r=de
```
- `r=de` directs the mobile app to communicate with `de.flakesecure.snowystudio.dev`.
- If omitted or regional server is unreachable, the app automatically falls back to `relay.flakesecure.snowystudio.dev`.

---

## 2. Horizontal Load Balancing for Socket.IO

Socket.IO connections maintain stateful WebSocket sessions. Horizontal scaling across multiple Node.js instances requires:

### A. Redis Pub/Sub Adapter
Using `@socket.io/redis-adapter` / `@socket.io/redis-streams-adapter`, events emitted to a session ID (`io.to(sid).emit(...)`) are broadcasted across all Node.js cluster processes:

```javascript
// server/cluster.js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
});
```

### B. Nginx / HAProxy Sticky Sessions
Nginx terminates SSL and uses IP hash or cookie affinity (`ip_hash` or `sticky cookie`) for HTTP long-polling handshake before upgrading to WebSockets:

```nginx
upstream flakesecure_backend {
    ip_hash;
    server 127.0.0.1:4001;
    server 127.0.0.1:4002;
    server 127.0.0.1:4003;
    server 127.0.0.1:4004;
}

server {
    listen 443 ssl http2;
    server_name de.flakesecure.snowystudio.dev;

    location /socket.io/ {
        proxy_pass http://flakesecure_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location / {
        proxy_pass http://flakesecure_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 3. Database Layer Scaling

1. **PgBouncer Connection Pooling**:
   - Transaction-level connection pooling (`pool_mode = transaction`) reduces PostgreSQL process overhead from thousands of concurrent clients to < 50 database connections.

2. **Read/Write Splitting**:
   - Write operations (User registration, vault sync, session creation, login logging) target Primary PostgreSQL node.
   - Read operations (Status queries, announcement fetching, public keys) target regional Read Replicas.

---

## 4. Zero-Knowledge Preservation

Even in a multi-region cluster:
- **Ciphertext only**: Only AES-256-CTR + HMAC-SHA256 encrypted blobs travel through Redis, Sockets, and PostgreSQL.
- **No private keys on server**: Derivation keys are computed strictly on the client (App / Browser Extension) using PBKDF2 with SHA-256.
