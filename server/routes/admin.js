/**
 * ============================================================================
 * FlakeSecure Server - Admin Monitoring, Logging & Backup Routes (/api/admin)
 * ============================================================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { adminLoginLimiter, getClientIp } = require('../middleware/rateLimit');

const router = express.Router();

// Persistent store for recent security / operational events (last 500 events)
// Stored outside the server project tree (os.tmpdir()) so PM2 --watch / nodemon
// never restarts the server when an admin event is logged on login.
const recentServerLogs = [];
const MAX_LOGS = 500;
const LEGACY_LOGS_FILE = path.join(__dirname, '..', 'data', 'admin_events.json');
const LOGS_DIR = process.env.ADMIN_EVENTS_DIR || path.join(os.tmpdir(), 'flakesecure-runtime');
const LOGS_FILE = path.join(LOGS_DIR, 'admin_events.json');

// Load persisted events on startup so restarts do not wipe log history
try {
  const sourceFile = fs.existsSync(LOGS_FILE)
    ? LOGS_FILE
    : (fs.existsSync(LEGACY_LOGS_FILE) ? LEGACY_LOGS_FILE : null);
  if (sourceFile) {
    const data = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    if (Array.isArray(data)) {
      recentServerLogs.push(...data.slice(0, MAX_LOGS));
    }
  }
} catch (_) {}

function saveLogsToFile() {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    fs.writeFileSync(LOGS_FILE, JSON.stringify(recentServerLogs.slice(0, MAX_LOGS), null, 2), 'utf8');
  } catch (_) {}
}

function logServerEvent(level, eventType, message, meta = {}) {
  // Prevent duplicate consecutive identical entries within 3 seconds
  if (recentServerLogs.length > 0) {
    const last = recentServerLogs[0];
    const diffMs = Date.now() - new Date(last.timestamp).getTime();
    if (diffMs < 3000 && last.type === eventType && last.message === message) {
      return;
    }
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level, // 'info', 'warn', 'error', 'security'
    type: eventType,
    message,
    meta
  };
  recentServerLogs.unshift(entry);
  if (recentServerLogs.length > MAX_LOGS) {
    recentServerLogs.pop();
  }
  saveLogsToFile();
}

// Export for usage across other server modules
module.exports.logServerEvent = logServerEvent;
module.exports.recentServerLogs = recentServerLogs;

function safeCompare(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Middleware to enforce Admin Authentication
function requireAdminAuth(req, res, next) {
  const secret = req.headers['x-admin-secret'];
  const authHeader = req.headers.authorization;
  const adminToken = req.headers['x-admin-token'] || (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

  // 1. Check x-admin-secret header
  if (secret && process.env.ADMIN_SECRET && safeCompare(secret, process.env.ADMIN_SECRET)) {
    req.admin = { email: process.env.ADMIN_EMAIL || 'admin', role: 'admin' };
    return next();
  }

  // 2. Check signed Admin JWT token
  if (adminToken) {
    try {
      const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
      if (decoded && decoded.role === 'admin') {
        req.admin = decoded;
        return next();
      }
    } catch (_) {}
  }

  // 3. Check query parameter token (e.g. backup download links)
  const queryToken = req.query?.token;
  if (queryToken) {
    try {
      const decoded = jwt.verify(queryToken, process.env.JWT_SECRET);
      if (decoded && decoded.role === 'admin') {
        req.admin = decoded;
        req.adminUser = decoded;
        return next();
      }
    } catch (e) { /* fall through to 403 */ }
  }

  logServerEvent('security', 'UNAUTHORIZED_ADMIN_ACCESS', 'Unauthorized attempt to access admin endpoint', {
    ip: getClientIp(req),
    path: req.originalUrl
  });

  return res.status(403).json({ error: 'Access denied. Valid admin credentials or secret required.' });
}

// POST /api/admin/login
router.post('/login', adminLoginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    return res.status(500).json({ error: 'Admin credentials not configured in server .env' });
  }

  const emailMatch = safeCompare(email.trim().toLowerCase(), configuredEmail.trim().toLowerCase());
  const passwordMatch = safeCompare(password, configuredPassword);

  if (!emailMatch || !passwordMatch) {
    logServerEvent('security', 'FAILED_ADMIN_LOGIN', `Failed admin login attempt for ${email}`, { ip: getClientIp(req) });
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign(
    { email: configuredEmail, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  logServerEvent('info', 'ADMIN_LOGIN_SUCCESS', `Admin logged in successfully: ${configuredEmail}`, { ip: getClientIp(req) });
  res.json({ success: true, token, email: configuredEmail });
});

// GET /api/admin/metrics
router.get('/metrics', requireAdminAuth, async (req, res) => {
  try {
    const uptimeSeconds = process.uptime();
    const mem = process.memoryUsage();
    const cpus = os.cpus();

    // Query database metrics
    const userCountRes = await db.query('SELECT COUNT(*) FROM users WHERE deleted_at IS NULL');
    const vaultCountRes = await db.query('SELECT COUNT(*) FROM vault');
    const activeSessionsRes = await db.query('SELECT COUNT(*) FROM sessions WHERE expires_at > NOW()');
    const recentLogsCountRes = await db.query("SELECT COUNT(*) FROM login_logs WHERE created_at > NOW() - INTERVAL '24 hours'");

    res.json({
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptimeSeconds: Math.floor(uptimeSeconds),
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'Generic CPU',
        memory: {
          rssMb: Math.round(mem.rss / 1024 / 1024),
          heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
          osTotalMb: Math.round(os.totalmem() / 1024 / 1024),
          osFreeMb: Math.round(os.freemem() / 1024 / 1024)
        }
      },
      database: {
        totalUsers: parseInt(userCountRes.rows[0].count, 10),
        totalVaults: parseInt(vaultCountRes.rows[0].count, 10),
        activeSessions: parseInt(activeSessionsRes.rows[0].count, 10),
        logins24h: parseInt(recentLogsCountRes.rows[0].count, 10),
        pool: {
          totalCount: db.pool.totalCount,
          idleCount: db.pool.idleCount,
          waitingCount: db.pool.waitingCount
        }
      }
    });
  } catch (err) {
    console.error('Admin metrics error:', err);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

// GET /api/admin/logs
router.get('/logs', requireAdminAuth, (req, res) => {
  res.json({ logs: recentServerLogs });
});

// GET /api/admin/backups
router.get('/backups', requireAdminAuth, (req, res) => {
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    return res.json({ backups: [] });
  }

  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.json') || f.endsWith('.sql'))
    .map(f => {
      const stat = fs.statSync(path.join(backupsDir, f));
      return {
        filename: f,
        sizeBytes: stat.size,
        sizeKb: Math.round(stat.size / 1024),
        createdAt: stat.birthtime
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ backups: files });
});

// POST /api/admin/backup
router.post('/backup', requireAdminAuth, async (req, res) => {
  try {
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup_flakesecure_${timestamp}.json`;
    const backupFilePath = path.join(backupsDir, backupFilename);

    // Export core tables safely
    const users = (await db.query('SELECT * FROM users')).rows;
    const vault = (await db.query('SELECT * FROM vault')).rows;
    const allowedRecipients = (await db.query('SELECT * FROM allowed_recipients')).rows;
    const announcements = (await db.query('SELECT * FROM announcements')).rows;
    const maintenance = (await db.query('SELECT * FROM maintenance')).rows;
    const pushTokens = (await db.query('SELECT * FROM push_tokens')).rows;

    const backupData = {
      version: '2.1.0',
      createdAt: new Date().toISOString(),
      counts: {
        users: users.length,
        vault: vault.length,
        allowedRecipients: allowedRecipients.length,
        announcements: announcements.length
      },
      data: {
        users,
        vault,
        allowedRecipients,
        announcements,
        maintenance,
        pushTokens
      }
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    const stats = fs.statSync(backupFilePath);

    logServerEvent('info', 'DATABASE_BACKUP_CREATED', `Database backup created: ${backupFilename} (${Math.round(stats.size / 1024)} KB)`);

    res.json({
      success: true,
      filename: backupFilename,
      sizeKb: Math.round(stats.size / 1024),
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Backup creation error:', err);
    res.status(500).json({ error: 'Database backup failed: ' + err.message });
  }
});

// GET /api/admin/backup/download/:filename
router.get('/backup/download/:filename', requireAdminAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const backupsDir = path.join(__dirname, '..', 'backups');
  const filePath = path.join(backupsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }

  res.download(filePath, filename);
});
// GET /api/admin/pm2-logs
router.get('/pm2-logs', requireAdminAuth, (req, res) => {
  const lines = Math.min(Math.max(parseInt(req.query.lines, 10) || 100, 1), 1000);
  const type = req.query.type === 'error' ? 'error' : 'out'; // 'out' or 'error'
  const suffix = type === 'error' ? 'error' : 'out';
  const targetAppName = (process.env.PM2_APP_NAME || process.env.name || 'flakesecure').trim();

  try {
    let latestLog = null;

    // Priority 1: PM2 runtime environment variables injected directly into this Node process
    const runtimePath = type === 'error' ? process.env.pm_err_log_path : process.env.pm_out_log_path;
    if (runtimePath && fs.existsSync(runtimePath)) {
      latestLog = runtimePath;
    }

    // Priority 2: Explicit env override paths
    if (!latestLog) {
      const envOverridePath = type === 'error' ? process.env.PM2_LOG_FILE_ERR : process.env.PM2_LOG_FILE_OUT;
      if (envOverridePath && fs.existsSync(envOverridePath)) {
        latestLog = envOverridePath;
      }
    }

    // Priority 3: Strictly filter files in PM2_LOG_DIR matching only targetAppName
    if (!latestLog) {
      const pm2LogDir = process.env.PM2_LOG_DIR || path.join(os.homedir(), '.pm2', 'logs');
      if (!fs.existsSync(pm2LogDir)) {
        return res.json({
          logs: [],
          processName: targetAppName,
          message: `Keine PM2-Logdatei für Prozess "${targetAppName}" gefunden.`
        });
      }

      const targetLower = targetAppName.toLowerCase();
      const logFiles = fs.readdirSync(pm2LogDir)
        .filter(f => {
          const lowerName = f.toLowerCase();
          return lowerName.endsWith('.log') && (
            lowerName === `${targetLower}-${suffix}.log` ||
            lowerName.startsWith(`${targetLower}-${suffix}-`)
          );
        })
        .sort((a, b) => {
          try {
            const aStat = fs.statSync(path.join(pm2LogDir, a));
            const bStat = fs.statSync(path.join(pm2LogDir, b));
            return bStat.mtimeMs - aStat.mtimeMs;
          } catch (_) {
            return 0;
          }
        });

      if (logFiles.length > 0) {
        latestLog = path.join(pm2LogDir, logFiles[0]);
      }
    }

    if (!latestLog || !fs.existsSync(latestLog)) {
      return res.json({
        logs: [],
        processName: targetAppName,
        message: `Keine PM2-Logdatei für Prozess "${targetAppName}" gefunden.`
      });
    }

    const stat = fs.statSync(latestLog);
    const MAX_TAIL_BYTES = 128 * 1024; // Read at most the last 128 KB to prevent OOM on large PM2 logs
    const readSize = Math.min(stat.size, MAX_TAIL_BYTES);
    const startOffset = Math.max(0, stat.size - readSize);

    let content = '';
    if (readSize > 0) {
      const fd = fs.openSync(latestLog, 'r');
      try {
        const buffer = Buffer.alloc(readSize);
        fs.readSync(fd, buffer, 0, readSize, startOffset);
        content = buffer.toString('utf8');
      } finally {
        fs.closeSync(fd);
      }
    }

    const rawLines = content.split('\n');
    // Drop potentially truncated first line if we started reading mid-file
    if (startOffset > 0 && rawLines.length > 1) {
      rawLines.shift();
    }
    const allLines = rawLines.filter(l => l.trim());
    const lastLines = allLines.slice(-lines);

    res.json({
      logs: lastLines,
      filename: path.basename(latestLog),
      processName: targetAppName,
      totalLines: allLines.length
    });
  } catch (err) {
    console.error('PM2 log read error:', err);
    res.status(500).json({ error: 'Failed to read PM2 logs: ' + err.message });
  }
});

// DELETE /api/admin/backup/:filename
router.delete('/backup/:filename', requireAdminAuth, (req, res) => {
  const filename = path.basename(req.params.filename);
  const backupsDir = path.join(__dirname, '..', 'backups');
  const filePath = path.join(backupsDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }

  try {
    fs.unlinkSync(filePath);
    logServerEvent('info', 'BACKUP_DELETED', `Backup deleted: ${filename}`);
    res.json({ success: true, message: `Backup ${filename} deleted successfully` });
  } catch (err) {
    console.error('Backup delete error:', err);
    res.status(500).json({ error: 'Failed to delete backup: ' + err.message });
  }
});

module.exports.requireAdminAuth = requireAdminAuth;
module.exports.router = router;
