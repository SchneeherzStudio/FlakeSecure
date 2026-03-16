/**
 * FlakeSecure Relay Server
 * 
 * Vermittelt verschlüsselte Login-Daten zwischen Smartphone und Browser.
 * Der Server sieht nur verschlüsselten Ciphertext – niemals Klartext-Passwörter.
 * 
 * Start: node server.js
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 80;
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

// CORS: Allow browser extensions (chrome-extension://) and the mobile app
const io = new Server(server, {
  cors: {
    origin: '*', // In production: restrict to your extension ID and app domain
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// ─── Session Store ────────────────────────────────────────────────────────────
// In-memory only – nothing is persisted to disk
const activeSessions = new Map(); // sid -> { socketId, createdAt, domain }

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [sid, session] of activeSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(sid);
      console.log(`[FlakeSecure] Session ${sid.slice(0, 8)}... expired and cleaned`);
    }
  }
}

setInterval(cleanExpiredSessions, 60_000);

// ─── Validation Helpers ───────────────────────────────────────────────────────
function isValidSid(sid) {
  return typeof sid === 'string' && /^[a-f0-9]{32}$/.test(sid);
}

function isValidEncryptedPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.iv) &&
    Array.isArray(payload.data) &&
    payload.iv.length === 16 &&   // AES-CTR uses 16-byte IV (changed from AES-GCM's 12)
    payload.data.length > 0
  );
}

// ─── REST API ─────────────────────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: activeSessions.size,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /send-login
 * 
 * Called by the mobile app to relay encrypted credentials to the browser.
 * Body: { sid: string, payload: { iv: number[], data: number[] } }
 * 
 * The server NEVER decrypts the payload – it only forwards it.
 */
app.post('/send-login', (req, res) => {
  const { sid, payload } = req.body;

  // Validate input
  if (!isValidSid(sid)) {
    return res.status(400).json({ error: 'Invalid or missing session ID' });
  }

  if (!isValidEncryptedPayload(payload)) {
    return res.status(400).json({ error: 'Invalid or missing encrypted payload' });
  }

  // Check if session exists
  const session = activeSessions.get(sid);
  if (!session) {
    return res.status(404).json({ error: 'Session not found or expired' });
  }

  // Check TTL
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    activeSessions.delete(sid);
    return res.status(410).json({ error: 'Session expired' });
  }

  // Relay to the browser socket in the session room
  const delivered = io.to(sid).emit('login-data', payload);

  // Mark session as used (one-time use)
  activeSessions.delete(sid);

  console.log(`[FlakeSecure] Relayed login data for session ${sid.slice(0, 8)}... → domain: ${session.domain}`);

  res.json({ success: true, message: 'Login data relayed successfully' });
});

/**
 * GET /session-status/:sid
 * 
 * Mobile app can poll this to check if the browser is connected and waiting.
 */
app.get('/session-status/:sid', (req, res) => {
  const { sid } = req.params;

  if (!isValidSid(sid)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }

  const session = activeSessions.get(sid);
  if (!session) {
    return res.json({ active: false });
  }

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    activeSessions.delete(sid);
    return res.json({ active: false, reason: 'expired' });
  }

  res.json({
    active: true,
    domain: session.domain,
    age: Math.floor((Date.now() - session.createdAt) / 1000) + 's'
  });
});

// ─── Socket.IO ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[FlakeSecure] Browser connected: ${socket.id}`);

  /**
   * Browser extension joins a session room.
   * The room name IS the sessionId.
   */
  socket.on('join-session', ({ sid }) => {
    if (!isValidSid(sid)) {
      socket.emit('error', { message: 'Invalid session ID' });
      return;
    }

    // Store session info
    activeSessions.set(sid, {
      socketId: socket.id,
      createdAt: Date.now(),
      domain: 'unknown' // Will be updated when login data arrives
    });

    socket.join(sid);
    socket.sessionId = sid;

    console.log(`[FlakeSecure] Session registered: ${sid.slice(0, 8)}... (socket: ${socket.id})`);

    // Confirm to browser
    socket.emit('session-ready', { sid });

    // Auto-expire session
    setTimeout(() => {
      if (activeSessions.has(sid)) {
        activeSessions.delete(sid);
        io.to(sid).emit('session-expired');
        console.log(`[FlakeSecure] Session ${sid.slice(0, 8)}... auto-expired`);
      }
    }, SESSION_TTL_MS);
  });

  socket.on('disconnect', () => {
    console.log(`[FlakeSecure] Browser disconnected: ${socket.id}`);
    // Clean up session if browser disconnects
    if (socket.sessionId) {
      activeSessions.delete(socket.sessionId);
    }
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('  ❄️  FlakeSecure Relay Server');
  console.log('  ────────────────────────────');
  console.log(`  Listening on: http://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  Session TTL:  ${SESSION_TTL_MS / 60000} minutes`);
  console.log('');
  console.log('  Ready to relay encrypted credentials.');
  console.log('');
});

module.exports = { app, server };