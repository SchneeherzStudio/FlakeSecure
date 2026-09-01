/**
 * ============================================================================
 * FlakeSecure Relay Server v2.0
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ARCHITECTURE:
 * 
 * 1. ZERO-KNOWLEDGE RELAY ARCHITECTURE:
 *    - Relays end-to-end encrypted login and registration payloads between mobile app and browser extensions.
 *    - The server processes only ciphertext and never has access to plaintext credential data.
 * 
 * 2. API ROUTES & STATIC ASSETS:
 *    - /api/auth: User registration (with OTP), login (with push notification trigger), session auth.
 *    - /api/account: Account management, recipient whitelisting, active sessions, profile updates.
 *    - /api/logs: Querying and clearing login/access logs with GeoIP geolocation and action labels.
 *    - /api/share: Generating and consuming time-limited / hidden shared payloads.
 *    - /api/system: Server status, version checks, admin-managed announcements, maintenance mode.
 *    - /api/otp: OTP email verification for registration and account deletion.
 *    - /api/vault: Encrypted credential vault sync (client-side encrypted, zero-knowledge).
 *    - /api/notifications: Expo push notification token management and delivery.
 *    - /static / /public: Serves landing page, account management, privacy policy, legal notices.
 *    - /health: Server health status, uptime, and active session counts.
 *    - /share & /auth: Universal link / deep-link fallback pages for mobile devices.
 * 
 * 3. SESSION MANAGEMENT & RELAY PIPELINE:
 *    - activeSessions: In-memory store for temporary socket sessions (TTL: 5 minutes).
 *    - cleanExpiredSessions(): Periodic automated cleanup for expired sessions and shared payloads.
 *    - POST /send-login: Receives encrypted payload from mobile app and broadcasts it to the browser session room.
 *    - GET /session-status/:sid: Polling endpoint for session readiness and status checks.
 *    - Socket.IO Events: join-session, session-ready, login-data, totp-data, session-expired, disconnect.
 *    - TOTP Streaming: Persistent socket connections (2-min TTL) for real-time authenticator code relay.
 * ============================================================================
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const path = require('path');

const db = require('./db');
const authRoutes = require('./routes/auth');
const accountRoutes = require('./routes/account');
const logsRoutes = require('./routes/logs');
const shareRoutes = require('./routes/share');
const systemRoutes = require('./routes/system');
const otpRoutes = require('./routes/otp');
const vaultRoutes = require('./routes/vault');
const { router: notificationRoutes } = require('./routes/notifications');
const { authMiddleware } = require('./middleware/auth');

const PORT = 4000;
const SESSION_TTL_MS = 5 * 60 * 1000;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/notifications', notificationRoutes);

const activeSessions = new Map();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [sid, session] of activeSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      activeSessions.delete(sid);
      console.log(`[FlakeSecure] Session ${sid.slice(0, 8)}... expired and cleaned`);
    }
  }

  db.query("DELETE FROM shared_payloads WHERE created_at < NOW() - INTERVAL '10 minutes'")
    .catch(err => console.error('Error cleaning shared_payloads:', err));

  // Auto-clean audit logs older than 90 days as promised in privacy policy
  db.query("DELETE FROM login_logs WHERE created_at < NOW() - INTERVAL '90 days'")
    .catch(err => console.error('Error cleaning 90-day login_logs:', err));
}

async function purgeExpiredAccounts() {
  try {
    const { rowCount } = await db.query(
      "DELETE FROM users WHERE deleted_at IS NOT NULL AND scheduled_purge_at <= NOW()"
    );
    if (rowCount > 0) {
      console.log(`[FlakeSecure] Permanently purged ${rowCount} expired user account(s) after 30-day retention period.`);
    }
  } catch (err) {
    console.error('[FlakeSecure] Error during expired account purge:', err.message);
  }
}

setInterval(cleanExpiredSessions, 60_000);
setInterval(purgeExpiredAccounts, 6 * 3600 * 1000);
purgeExpiredAccounts();

function isValidSid(sid) {
  return typeof sid === 'string' && /^[a-f0-9]{32}$/.test(sid);
}

function isValidEncryptedPayload(payload) {
  return (
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.iv) &&
    Array.isArray(payload.data) &&
    payload.iv.length === 16 &&
    payload.data.length > 0
  );
}

const STATIC_DIR = path.join(__dirname, 'static');

app.get('/', (req, res) => {
  res.sendFile('index.html', { root: STATIC_DIR });
});

app.get('/account', (req, res) => {
  res.sendFile('account.html', { root: STATIC_DIR });
});

app.get('/imprint', (req, res) => {
  res.sendFile('imprint.html', { root: STATIC_DIR });
});
app.get('/impressum', (req, res) => res.redirect('/imprint'));

app.get('/legal', (req, res) => {
  res.sendFile('legal.html', { root: STATIC_DIR });
});
app.get('/privacy', (req, res) => res.redirect('/legal'));
app.get('/datenschutz', (req, res) => res.redirect('/legal'));

app.get('/terms', (req, res) => {
  res.sendFile('terms.html', { root: STATIC_DIR });
});
app.get('/agb', (req, res) => res.redirect('/terms'));
app.get('/tos', (req, res) => res.redirect('/terms'));

const PUBLIC_DIR = path.join(__dirname, 'public');
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').sendFile('robots.txt', { root: PUBLIC_DIR });
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').sendFile('sitemap.xml', { root: PUBLIC_DIR });
});
app.get('/favicon.ico', (req, res) => {
  res.type('image/png').sendFile('favicon.png', { root: PUBLIC_DIR });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FlakeSecure Relay Server',
    uptime: Math.floor(process.uptime()),
    activeSessions: activeSessions.size,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /send-login
 * Mobile app calls this to push encrypted credentials into the session room.
 * 
 * The server NEVER decrypts the payload – it only forwards it.
 */
app.post('/send-login', async (req, res) => {
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
    return res.status(404).json({ error: 'Session expired or invalid' });
  }

  // Relay the encrypted payload to the browser via Socket.IO
  io.to(sid).emit('login-data', payload);

  // Mark session as fulfilled but keep active briefly for potential TOTP sync
  session.loginFulfilled = true;
  setTimeout(() => {
    if (activeSessions.has(sid) && !activeSessions.get(sid).totpActive) {
      activeSessions.delete(sid);
      console.log(`[FlakeSecure] Session ${sid.slice(0, 8)}... completed and purged`);
    }
  }, 2 * 60 * 1000);

  console.log(`[FlakeSecure] Relayed login data for session ${sid.slice(0, 8)}...`);

  // Optional: log security audit event without logging target browsing domain (Data Minimization / Art. 5 DSGVO)
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const jwt = require('jsonwebtoken');
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const geo = geoip.lookup(ip);
      await db.query(
        'INSERT INTO login_logs (user_id, ip_address, city, region, country, device_info, action, domain) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [decoded.id, ip, geo?.city, geo?.region, geo?.country, req.headers['user-agent'], 'credential_send', null]
      );
    }
  } catch (logErr) {
    console.log('[FlakeSecure] Login log skipped:', logErr.message);
  }

  res.json({ success: true, message: 'Login data relayed successfully' });
});

app.post('/send-totp', async (req, res) => {
  const { sid, payload } = req.body;

  if (!isValidSid(sid)) {
    return res.status(400).json({ error: 'Invalid or missing session ID' });
  }

  if (!isValidEncryptedPayload(payload)) {
    return res.status(400).json({ error: 'Invalid or missing encrypted payload' });
  }

  const session = activeSessions.get(sid);
  if (!session) {
    return res.status(404).json({ error: 'Session expired or invalid' });
  }

  session.totpActive = true;
  io.to(sid).emit('totp-data', payload);
  res.json({ success: true, message: 'TOTP payload relayed successfully' });
});

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

// ─── Socket.IO Relay Logic ───────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[FlakeSecure] Browser connected: ${socket.id}`);

  socket.on('join-session', async ({ sid, domain, token }) => {
    if (!isValidSid(sid)) {
      socket.emit('error', { message: 'Invalid session ID' });
      return;
    }

    const sessionDomain = domain || 'unknown';

    activeSessions.set(sid, {
      socketId: socket.id,
      createdAt: Date.now(),
      domain: sessionDomain
    });

    socket.join(sid);
    socket.sessionId = sid;

    console.log(`[FlakeSecure] Session registered: ${sid.slice(0, 8)}... (socket: ${socket.id})`);

    socket.emit('session-ready', { sid });

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { sendPushToUser } = require('./routes/notifications');
        await sendPushToUser(
          decoded.id,
          '🔐 Login-Anfrage',
          `Anmeldung für ${sessionDomain} auf deinem Computer bestätigen`,
          { type: 'auth_request', sid, domain: sessionDomain }
        );
      } catch (pushErr) {
        console.log('[FlakeSecure] Push on join-session skipped:', pushErr.message);
      }
    }

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
    if (socket.sessionId) {
      activeSessions.delete(socket.sessionId);
    }
  });
});

// ─── Web Redirects for Deep Linking ──────────────────────────────────────────
function renderDeepLinkPage(title, subtitle, defaultAction) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FlakeSecure</title>
  <style>
    body {
      margin: 0; padding: 0;
      background: #090b14; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; padding: 40px 30px; max-width: 400px; margin: 20px;
    }
    .emoji { font-size: 50px; margin-bottom: 10px; }
    h1 { font-size: 24px; margin: 0 0 10px; }
    p { color: rgba(255,255,255,0.6); font-size: 15px; margin: 0 0 25px; line-height: 1.5; }
    .btn {
      display: inline-block; background: linear-gradient(135deg, #6391ff, #7c6aff);
      color: #fff; text-decoration: none; font-weight: 600;
      padding: 14px 28px; border-radius: 12px; font-size: 16px;
    }
  </style>
  <script>
    // Client-side deep link resolution (reads fragment # and fallback search ?)
    function computeDeepLink() {
      var hash = window.location.hash ? window.location.hash.substring(1) : '';
      var search = window.location.search ? window.location.search.substring(1) : '';
      var params = hash || search;
      var action = '${defaultAction || 'auth'}';
      return 'flakesecure://' + action + (params ? '?' + params : '');
    }
    var targetUri = computeDeepLink();
    window.location.href = targetUri;
    window.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('openBtn');
      if (btn) btn.href = targetUri;
    });
  </script>
</head>
<body>
  <div class="card">
    <div class="emoji">❄️</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <a id="openBtn" href="flakesecure://${defaultAction || 'auth'}" class="btn">Open in FlakeSecure App</a>
  </div>
</body>
</html>`;
}

app.get('/share', (req, res) => {
  res.send(renderDeepLinkPage('Import Credentials', 'Tap below to import the credentials into FlakeSecure.', 'share'));
});

app.get('/auth', (req, res) => {
  res.send(renderDeepLinkPage('Confirm Login', 'Confirm login in the FlakeSecure App.', 'auth'));
});

server.listen(PORT, '::', () => {
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