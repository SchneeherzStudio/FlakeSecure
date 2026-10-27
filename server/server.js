/**
 * ============================================================================
 * FlakeSecure Master Server v2.1.0
 * ============================================================================
 * 
 * ARCHITECTURAL SUMMARY:
 * 1. ZERO-KNOWLEDGE RELAY ARCHITECTURE:
 *    - Relays end-to-end encrypted login, registration, and TOTP payloads.
 *    - Plaintext data never touches this server.
 * 
 * 2. MODULAR 3-SERVICE SYSTEM:
 *    - Relay Service: WebSocket Socket.IO bridge & ephemeral session forwarding.
 *    - Auth Service: User registration (with OTP), logins, 30-min password resets.
 *    - Data Service: Encrypted vault sync, account settings, activity logs, push tokens.
 *    - Admin Portal & Telemetry: Live metrics, audit logs, 1-click database backups.
 * 
 * 3. ENTERPRISE SECURITY & RESILIENCE:
 *    - Helmet security headers (Content-Security-Policy, HSTS, noSniff, xssFilter).
 *    - Gzip/Brotli HTTP compression on all JSON responses and static assets.
 *    - Multi-tier rate limiting & email spend caps (express-rate-limit).
 *    - Custom HTML error pages (404, 403, 429, 500) and structured JSON error API responses.
 *    - Automated disaster recovery: emergency database backup on uncaught exceptions.
 * ============================================================================
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs');

const db = require('./db');
const { createRelayService } = require('./services/relay/relayService');
const { createAuthService } = require('./services/auth/authService');
const { createDataService } = require('./services/data/dataService');
const embedRoutes = require('./routes/embed');
const { globalLimiter } = require('./middleware/rateLimit');
const { logServerEvent } = require('./routes/admin');
const { sendCriticalAlertEmail } = require('./utils/email');

const PORT = parseInt(process.env.PORT || '4000', 10);
const STATIC_DIR = path.join(__dirname, 'static');
const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);

// ─── 1. Security Headers & Protection (Helmet) ──────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://flakesecure.snowystudio.dev", "wss://flakesecure.snowystudio.dev"],
        frameAncestors: ["'self'", "*"], // Required for embed widget iframe integration
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// ─── 2. HTTP Compression (No uncompressed JSON) ─────────────────────────────
app.use(
  compression({
    threshold: 1024, // Compress responses over 1 KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    }
  })
);

// ─── 3. CORS Configuration ──────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['https://flakesecure.snowystudio.dev'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow mobile apps, browser extensions, curl, or matched origins
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for zero-knowledge API relays
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: false // Correct W3C CORS: do not combine wildcard with credentials
  })
);

// ─── 4. Body Parser with 2MB Limit (Supports large encrypted vaults) ────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ─── 5. Global Rate Limiter ─────────────────────────────────────────────────
app.use(globalLimiter);

// ─── 6. Mount Microservice Subsystems ───────────────────────────────────────
// Service 1: Relay Service (Socket.IO + In-Memory Fast Bridge)
const relayService = createRelayService();
relayService.attachSocketIO(server);
app.use('/', relayService.router);

// Service 2: Auth Service (/api/auth, /api/otp)
const authService = createAuthService();
app.use('/api', authService.router);

// Service 3: Data Service (/api/vault, /api/account, /api/logs, /api/system, /api/notifications, /api/share, /api/admin)
const dataService = createDataService();
app.use('/api', dataService.router);

// Embed routes for third-party websites
app.use('/embed', embedRoutes);
app.get('/embed.js', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile('embed.js', { root: PUBLIC_DIR });
});

// ─── 7. Static Assets & Pages ───────────────────────────────────────────────
app.use(
  express.static(PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.zip')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      } else if (filePath.endsWith('.apk')) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  })
);

// Helper to serve HTML pages without stale disk caching
const sendStaticPage = (res, filename) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(filename, { root: STATIC_DIR });
};

// Static Web Pages
app.get('/', (req, res) => sendStaticPage(res, 'index.html'));
app.get('/downloads', (req, res) => sendStaticPage(res, 'downloads.html'));
app.get('/features', (req, res) => sendStaticPage(res, 'features.html'));
app.get('/account', (req, res) => sendStaticPage(res, 'account.html'));
app.get('/admin', (req, res) => sendStaticPage(res, 'admin.html'));
app.get('/reset-password', (req, res) => sendStaticPage(res, 'reset-password.html'));
app.get('/restore-account', (req, res) => sendStaticPage(res, 'restore-account.html'));
app.get('/imprint', (req, res) => sendStaticPage(res, 'imprint.html'));
app.get('/legal', (req, res) => sendStaticPage(res, 'legal.html'));
app.get('/terms', (req, res) => sendStaticPage(res, 'terms.html'));

// Named download endpoints
app.get('/download/chrome', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  const file = fs.existsSync(path.join(PUBLIC_DIR, 'FlakeSecure_chrome-v2.0.3.zip'))
    ? 'FlakeSecure_chrome-v2.0.3.zip'
    : 'browser-extension.zip';
  res.download(path.join(PUBLIC_DIR, file), 'FlakeSecure_chrome-v2.0.3.zip');
});
app.get('/download/firefox', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  const file = fs.existsSync(path.join(PUBLIC_DIR, 'FlakeSecure_firefox-v2.0.3.zip'))
    ? 'FlakeSecure_firefox-v2.0.3.zip'
    : 'browser-extension-firefox.zip';
  res.download(path.join(PUBLIC_DIR, file), 'FlakeSecure_firefox-v2.0.3.zip');
});
app.get('/download/android', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  const apkPath = path.join(PUBLIC_DIR, 'FlakeSecure_android-v2.0.3.apk');
  const legacyApkPath = path.join(PUBLIC_DIR, 'FlakeSecure_v2-0-2.apk');
  if (fs.existsSync(apkPath)) {
    res.download(apkPath, 'FlakeSecure_android-v2.0.3.apk');
  } else if (fs.existsSync(legacyApkPath)) {
    res.download(legacyApkPath, 'FlakeSecure_android-v2.0.3.apk');
  } else {
    res.status(404).send('Android APK build package currently being prepared.');
  }
});

// Clean redirects
app.get(['/download', '/downloads.html'], (req, res) => res.redirect(301, '/downloads'));
app.get('/features.html', (req, res) => res.redirect(301, '/features'));
app.get(['/impressum', '/imprint.html'], (req, res) => res.redirect(301, '/imprint'));
app.get(['/privacy', '/datenschutz', '/legal.html', '/privacy.html'], (req, res) => res.redirect(301, '/legal'));
app.get(['/agb', '/tos', '/terms.html'], (req, res) => res.redirect(301, '/terms'));
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/account.html', (req, res) => res.redirect(301, '/account'));
app.get('/restore-account.html', (req, res) => res.redirect(301, '/restore-account'));

// SEO & Metadata Assets
app.get('/robots.txt', (req, res) => res.type('text/plain').sendFile('robots.txt', { root: PUBLIC_DIR }));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').sendFile('sitemap.xml', { root: PUBLIC_DIR }));
app.get('/favicon.ico', (req, res) => res.type('image/png').sendFile('favicon.png', { root: PUBLIC_DIR }));

// ─── 8. Health Check ────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FlakeSecure Unified Server',
    version: '2.1.0',
    uptime: Math.floor(process.uptime()),
    activeSessions: relayService.activeSessions.size,
    timestamp: new Date().toISOString()
  });
});

// Deep link fallback handlers for mobile
function renderDeepLinkPage(title, subtitle, defaultAction) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - FlakeSecure</title>
  <style>
    body {
      margin: 0; padding: 0; background: #090b14; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center;
    }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 36px 30px; max-width: 400px; margin: 20px; }
    .brand-mark { width: 44px; height: 44px; margin: 0 auto 16px; background: rgba(232,176,32,0.12); border: 1px solid rgba(232,176,32,0.35); border-radius: 6px; line-height: 44px; text-align: center; color: #E8B020; font-weight: 800; font-size: 16px; font-family: monospace; }
    h1 { font-size: 22px; margin: 0 0 10px; font-family: sans-serif; color: #fff; }
    p { color: rgba(255,255,255,0.6); font-size: 14px; margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-block; background: #E8B020; color: #07090e; text-decoration: none; font-weight: 700; padding: 12px 24px; border-radius: 6px; font-size: 15px; border: 1px solid #C9930A; }
  </style>
  <script>
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
    <div class="brand-mark">FS</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <a id="openBtn" href="flakesecure://${defaultAction || 'auth'}" class="btn">In FlakeSecure App öffnen</a>
  </div>
</body>
</html>`;
}

app.get('/share', (req, res) => {
  res.send(renderDeepLinkPage('Zugangsdaten importieren', 'Tippe unten, um die Zugangsdaten in FlakeSecure zu öffnen.', 'share'));
});

app.get('/auth', (req, res) => {
  res.send(renderDeepLinkPage('Login bestätigen', 'Bestätige den Login in deiner FlakeSecure App.', 'auth'));
});

// ─── 9. Periodic Background Cleanup Jobs & Schema Verification ─────────────
async function initDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await db.query(sql);
      console.log('[DB] Database schema verified and updated successfully.');
    }
  } catch (err) {
    console.warn('[DB] Database schema check note:', err.message);
  }
}

function scheduleBackgroundCleanups() {
  setInterval(async () => {
    try {
      await db.query("DELETE FROM shared_payloads WHERE created_at < NOW() - INTERVAL '10 minutes'");
      await db.query("DELETE FROM login_logs WHERE created_at < NOW() - INTERVAL '90 days'");
      await db.query("DELETE FROM otp_codes WHERE expires_at <= NOW() AND created_at < NOW() - INTERVAL '15 minutes'");
      await db.query("DELETE FROM password_resets WHERE expires_at < NOW() OR used_at IS NOT NULL");
      await db.query("DELETE FROM account_restore_tokens WHERE expires_at < NOW() AND created_at < NOW() - INTERVAL '15 minutes'");
    } catch (err) {
      if (err.message && (err.message.includes('relation "password_resets" does not exist') || err.message.includes('relation "account_restore_tokens" does not exist'))) {
        try {
          await db.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID REFERENCES users(id) ON DELETE CASCADE,
              token_hash VARCHAR(255) NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              used_at TIMESTAMPTZ DEFAULT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
            CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

            CREATE TABLE IF NOT EXISTS account_restore_tokens (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              user_id UUID REFERENCES users(id) ON DELETE CASCADE,
              token_hash VARCHAR(255) NOT NULL,
              expires_at TIMESTAMPTZ NOT NULL,
              used_at TIMESTAMPTZ DEFAULT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_account_restore_tokens_hash ON account_restore_tokens(token_hash);
            CREATE INDEX IF NOT EXISTS idx_account_restore_tokens_user ON account_restore_tokens(user_id);
          `);
        } catch (_) {}
      } else {
        console.error('[Cleanups] Error:', err.message);
      }
    }
  }, 60_000);

  setInterval(async () => {
    try {
      const { rowCount } = await db.query(
        "DELETE FROM users WHERE deleted_at IS NOT NULL AND scheduled_purge_at <= NOW()"
      );
      if (rowCount > 0) {
        logServerEvent('info', 'PURGED_DELETED_USERS', `Permanently purged ${rowCount} user(s) after 30-day retention period.`);
      }
    } catch (err) {
      console.error('[Purge] Error:', err.message);
    }
  }, 6 * 3600 * 1000);
}

initDatabase().then(() => {
  scheduleBackgroundCleanups();
}).catch(err => {
  console.warn('[DB] Init error:', err.message);
  scheduleBackgroundCleanups();
});

// ─── 10. Custom Error Handling (Web & API) ──────────────────────────────────
// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/send-')) {
    return res.status(404).json({
      error: 'Endpoint not found',
      code: 'RESOURCE_NOT_FOUND',
      path: req.originalUrl
    });
  }
  res.status(404).sendFile('404.html', { root: STATIC_DIR });
});

// Centralized 500 / Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  logServerEvent('error', 'SERVER_ERROR', err.message, { stack: err.stack, path: req.originalUrl });

  if (res.headersSent) {
    return next(err);
  }

  if (req.path.startsWith('/api/') || req.path.startsWith('/send-') || req.xhr || req.accepts('json')) {
    const status = err.status || 500;
    return res.status(status).json({
      error: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  res.status(500).sendFile('500.html', { root: STATIC_DIR });
});

// ─── 11. Crash Resilience & Emergency Backups ───────────────────────────────
async function triggerEmergencySnapshot(reason, err) {
  try {
    const backupsDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(backupsDir, `emergency_snapshot_${timestamp}.json`);

    const users = (await db.query('SELECT * FROM users')).rows;
    const vault = (await db.query('SELECT * FROM vault')).rows;
    fs.writeFileSync(filename, JSON.stringify({ reason, timestamp, users, vault }, null, 2), 'utf8');
    console.error(`[CRITICAL] Emergency snapshot saved to ${filename}`);
  } catch (backupErr) {
    console.error('[CRITICAL] Failed to create emergency snapshot:', backupErr.message);
  }

  await sendCriticalAlertEmail(
    `Critical Server Failure: ${reason}`,
    { error: err?.message, stack: err?.stack, time: new Date().toISOString() }
  );
}

process.on('uncaughtException', async (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
  await triggerEmergencySnapshot('uncaughtException', err);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
  logServerEvent('warn', 'UNHANDLED_REJECTION', String(reason));
});

// ─── 12. Server Startup ─────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  [FlakeSecure] Unified Server v2.1.0');
  console.log('  ─────────────────────────────────────');
  console.log(`  Listening on: http://localhost:${PORT}`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log(`  Admin Portal: http://localhost:${PORT}/admin`);
  console.log('  Services Active: Relay (WebSockets), Auth, Data, Static');
  console.log('  Ready to protect credentials with Zero-Knowledge security.');
  console.log('');
});

module.exports = { app, server };