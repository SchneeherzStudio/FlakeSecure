/**
 * ============================================================================
 * FlakeSecure Relay Service
 * ============================================================================
 * Handles real-time Socket.IO WebSocket connections and ephemeral encrypted
 * credential and TOTP relays between mobile apps and browser extensions.
 * Operates strictly ZERO-KNOWLEDGE (never sees plaintext data).
 */

const express = require('express');
const { Server } = require('socket.io');
const geoip = require('geoip-lite');
const db = require('../../db');

const SESSION_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isValidSid(sid) {
  return typeof sid === 'string' && /^[a-f0-9]{32}$/i.test(sid);
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

function createRelayService(options = {}) {
  const activeSessions = new Map();
  const router = express.Router();

  // Periodic cleanup of expired in-memory sessions
  function cleanExpiredSessions() {
    const now = Date.now();
    for (const [sid, session] of activeSessions) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        activeSessions.delete(sid);
      }
    }
  }
  const cleanupTimer = setInterval(cleanExpiredSessions, 60_000);

  // Setup Socket.IO on an HTTP server
  let io = null;
  function attachSocketIO(httpServer, corsOptions) {
    io = new Server(httpServer, {
      cors: corsOptions || {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling']
    });

    io.on('connection', (socket) => {
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
        socket.emit('session-ready', { sid });

        if (token) {
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const { sendPushToUser } = require('../../routes/notifications');
            await sendPushToUser(
              decoded.id,
              'Login-Anfrage',
              `Anmeldung für ${sessionDomain} auf deinem Computer bestätigen`,
              { type: 'auth_request', sid, domain: sessionDomain, targetScreen: 'Scan' },
              'login_alerts'
            );
          } catch (_) {}
        }

        setTimeout(() => {
          if (activeSessions.has(sid)) {
            activeSessions.delete(sid);
            io.to(sid).emit('session-expired');
          }
        }, SESSION_TTL_MS);
      });

      socket.on('disconnect', () => {
        if (socket.sessionId) {
          activeSessions.delete(socket.sessionId);
        }
      });
    });

    return io;
  }

  // POST /send-login
  router.post('/send-login', async (req, res) => {
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

    if (io) {
      io.to(sid).emit('login-data', payload);
    }

    session.loginFulfilled = true;
    setTimeout(() => {
      if (activeSessions.has(sid) && !activeSessions.get(sid).totpActive) {
        activeSessions.delete(sid);
      }
    }, 2 * 60 * 1000);

    // Optional audit log
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const jwt = require('jsonwebtoken');
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
        const geo = geoip.lookup(ip);
        await db.query(
          'INSERT INTO login_logs (user_id, ip_address, city, region, country, device_info, action, domain) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [decoded.id, ip, geo?.city, geo?.region, geo?.country, req.headers['user-agent'], 'credential_send', null]
        );
      }
    } catch (_) {}

    res.json({ success: true, message: 'Login data relayed successfully' });
  });

  // POST /send-totp
  router.post('/send-totp', async (req, res) => {
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
    if (io) {
      io.to(sid).emit('totp-data', payload);
    }
    res.json({ success: true, message: 'TOTP payload relayed successfully' });
  });

  // POST /qr-scanned
  router.post('/qr-scanned', (req, res) => {
    const { sid, username } = req.body;
    if (!isValidSid(sid)) return res.status(400).json({ error: 'Invalid session ID' });
    const session = activeSessions.get(sid);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (io) {
      const cleanUsername = (typeof username === 'string' && username.trim() && username.trim().toLowerCase() !== 'user') 
        ? username.trim() 
        : null;
      io.to(sid).emit('qr-scanned', { username: cleanUsername });
    }
    res.json({ success: true });
  });

  // GET /session-status/:sid
  router.get('/session-status/:sid', (req, res) => {
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

  return {
    router,
    attachSocketIO,
    activeSessions,
    cleanupTimer
  };
}

module.exports = { createRelayService };
