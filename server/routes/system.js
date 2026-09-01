/**
 * ============================================================================
 * FlakeSecure Server - System & Admin Routes (/api/system)
 * ============================================================================
 * 
 * FUNCTION OVERVIEW & ENDPOINTS:
 * 
 * 1. PUBLIC ENDPOINTS:
 *    - GET /status: Returns server version, active maintenance window, and minimum app version.
 *    - GET /announcements: Returns active announcements; optionally filters out dismissed ones if user is authenticated.
 * 
 * 2. USER ENDPOINTS (AUTH REQUIRED):
 *    - POST /announcements/:id/dismiss: Records that the authenticated user dismissed a specific announcement.
 * 
 * 3. ADMIN ENDPOINTS (x-admin-secret HEADER):
 *    - POST /announcement: Creates a new announcement (popup/banner, once/always, with priority and optional expiry).
 *    - PUT /announcement/:id: Updates fields on an existing announcement.
 *    - DELETE /announcement/:id: Deletes an announcement.
 *    - POST /maintenance: Upserts the single maintenance window row (id=1).
 * 
 * 4. MIDDLEWARE:
 *    - requireAdmin(req, res, next): Validates x-admin-secret header against ADMIN_SECRET env var.
 * ============================================================================
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authMiddleware, hashToken } = require('../middleware/auth');

let serverVersion = '2.0.0';
try {
    const pkg = require('../package.json');
    if (pkg && pkg.version) serverVersion = pkg.version;
} catch (_) {
    try {
        const pkg = require('../../package.json');
        if (pkg && pkg.version) serverVersion = pkg.version;
    } catch (_) {}
}

const router = express.Router();

function requireAdmin(req, res, next) {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
}

router.get('/status', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT active, message, until FROM maintenance WHERE id = 1'
        );
        const maintenance = rows.length > 0
            ? { active: rows[0].active, message: rows[0].message, until: rows[0].until }
            : { active: false, message: null, until: null };

        const minAppVersion = process.env.MIN_APP_VERSION || serverVersion;

        res.json({
            version: serverVersion,
            maintenance,
            minAppVersion
        });
    } catch (error) {
        console.error('System status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/announcements', async (req, res) => {
    try {
        let userId = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const tHash = hashToken(token);
                const { rows } = await db.query(
                    'SELECT * FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
                    [tHash]
                );
                if (rows.length > 0) {
                    userId = decoded.id;
                }
            } catch (_) {}
        }

        let query;
        let params;

        if (userId) {
            query = `SELECT a.id, a.message, a.type, a.display, a.priority, a.created_at
                     FROM announcements a
                     WHERE (a.expires_at IS NULL OR a.expires_at > NOW())
                       AND a.id NOT IN (SELECT announcement_id FROM dismissed_announcements WHERE user_id = $1)
                     ORDER BY a.priority DESC, a.created_at DESC`;
            params = [userId];
        } else {
            query = `SELECT id, message, type, display, priority, created_at
                     FROM announcements
                     WHERE expires_at IS NULL OR expires_at > NOW()
                     ORDER BY priority DESC, created_at DESC`;
            params = [];
        }

        const { rows } = await db.query(query, params);
        res.json({ announcements: rows });
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/announcements/:id/dismiss', authMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
        await db.query(
            'INSERT INTO dismissed_announcements (user_id, announcement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, id]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Dismiss announcement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/announcement', requireAdmin, async (req, res) => {
    const { message, type, display, priority, expires_at } = req.body;

    if (!message || !type || !display) {
        return res.status(400).json({ error: 'Message, type, and display are required' });
    }

    if (!['popup', 'banner'].includes(type)) {
        return res.status(400).json({ error: 'Type must be popup or banner' });
    }

    if (!['once', 'always'].includes(display)) {
        return res.status(400).json({ error: 'Display must be once or always' });
    }

    try {
        const { rows } = await db.query(
            'INSERT INTO announcements (message, type, display, priority, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [message, type, display, priority || 0, expires_at || null]
        );
        res.status(201).json({ announcement: rows[0] });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/announcement/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { message, type, display, priority, expires_at } = req.body;

    try {
        let updateQuery = 'UPDATE announcements SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (message !== undefined) {
            updateQuery += `, message = $${paramCount}`;
            params.push(message);
            paramCount++;
        }
        if (type !== undefined) {
            updateQuery += `, type = $${paramCount}`;
            params.push(type);
            paramCount++;
        }
        if (display !== undefined) {
            updateQuery += `, display = $${paramCount}`;
            params.push(display);
            paramCount++;
        }
        if (priority !== undefined) {
            updateQuery += `, priority = $${paramCount}`;
            params.push(priority);
            paramCount++;
        }
        if (expires_at !== undefined) {
            updateQuery += `, expires_at = $${paramCount}`;
            params.push(expires_at);
            paramCount++;
        }

        updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
        params.push(id);

        const { rows } = await db.query(updateQuery, params);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        res.json({ announcement: rows[0] });
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/announcement/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const { rowCount } = await db.query('DELETE FROM announcements WHERE id = $1', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/maintenance', requireAdmin, async (req, res) => {
    const { active, message, until } = req.body;

    if (active === undefined) {
        return res.status(400).json({ error: 'Active status is required' });
    }

    try {
        const { rows } = await db.query(
            `INSERT INTO maintenance (id, active, message, until)
             VALUES (1, $1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET active = $1, message = $2, until = $3, updated_at = NOW()
             RETURNING *`,
            [active, message || null, until || null]
        );
        res.json({ maintenance: rows[0] });
    } catch (error) {
        console.error('Maintenance update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
