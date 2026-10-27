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
const geoip = require('geoip-lite');
const db = require('../db');
const { authMiddleware, hashToken } = require('../middleware/auth');
const { getClientIp } = require('../middleware/rateLimit');
const { requireAdminAuth } = require('./admin');
const { sendBroadcastPush } = require('./notifications');

let serverVersion = '2.1.0';
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
    return requireAdminAuth(req, res, next);
}

router.get('/status', async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT active, message, until FROM maintenance WHERE id = 1'
        );
        const maintenance = rows.length > 0
            ? { active: rows[0].active, message: rows[0].message, until: rows[0].until }
            : { active: false, message: null, until: null };

        const minAppVersion = process.env.MIN_APP_VERSION || '2.0.3';

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
            query = `SELECT a.id, a.title, a.message, a.type, a.display, a.priority,
                            a.target_screen, a.regions, a.delivery_mode, a.expires_at, a.created_at
                     FROM announcements a
                     WHERE (a.active IS NULL OR a.active = true)
                       AND (a.expires_at IS NULL OR a.expires_at > NOW())
                       AND (a.display = 'always' OR a.id NOT IN (SELECT announcement_id FROM dismissed_announcements WHERE user_id = $1))
                     ORDER BY a.priority DESC, a.created_at DESC`;
            params = [userId];
        } else {
            query = `SELECT id, title, message, type, display, priority,
                            target_screen, regions, delivery_mode, expires_at, created_at
                     FROM announcements
                     WHERE (active IS NULL OR active = true)
                       AND (expires_at IS NULL OR expires_at > NOW())
                     ORDER BY priority DESC, created_at DESC`;
            params = [];
        }

        const { rows } = await db.query(query, params);

        // Regional filtering in RAM via geoip-lite (DSGVO-compliant: IP is never persisted)
        const ip = getClientIp(req);
        const geo = ip ? geoip.lookup(ip) : null;
        const callerCountry = (geo && geo.country) ? String(geo.country).toUpperCase() : null;

        const filteredRows = rows.filter(row => {
            const rawRegions = row.regions ? String(row.regions).trim().toUpperCase() : 'ALL';
            if (!rawRegions || rawRegions === 'ALL' || rawRegions === '*') return true;
            // If country is null (e.g. localhost / private IP / admin client), include it
            if (!callerCountry) return true;
            const allowedList = rawRegions.split(',').map(s => s.trim()).filter(Boolean);
            return allowedList.includes(callerCountry) || allowedList.includes('ALL') || allowedList.includes('*');
        });

        res.json({ announcements: filteredRows });
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
    const {
        title = null,
        message,
        type = 'popup',
        display = 'once',
        priority = 0,
        expires_at = null,
        target_screen = null,
        regions = 'ALL',
        delivery_mode = 'in_app'
    } = req.body;

    const normalizedMode = ['in_app', 'push', 'both'].includes(delivery_mode) ? delivery_mode : 'in_app';

    if (!message || !String(message).trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }

    if (normalizedMode !== 'push') {
        if (!type || !display) {
            return res.status(400).json({ error: 'Message, type, and display are required' });
        }
        if (!['popup', 'banner'].includes(type)) {
            return res.status(400).json({ error: 'Type must be popup or banner' });
        }
        if (!['once', 'always'].includes(display)) {
            return res.status(400).json({ error: 'Display must be once or always' });
        }
    }

    const cleanTitle = (title && String(title).trim()) ? String(title).trim().slice(0, 150) : null;
    const cleanTargetScreen = (target_screen && String(target_screen).trim()) ? String(target_screen).trim().slice(0, 50) : null;
    const normalizedRegions = (regions && String(regions).trim()) ? String(regions).trim().toUpperCase() : 'ALL';
    const safeType = ['popup', 'banner'].includes(type) ? type : 'popup';
    const safeDisplay = ['once', 'always'].includes(display) ? display : 'once';

    try {
        let announcement = null;
        let pushResult = null;

        if (normalizedMode === 'in_app' || normalizedMode === 'both') {
            const { rows } = await db.query(
                `INSERT INTO announcements (
                    title, message, type, display, priority, expires_at, target_screen, regions, delivery_mode
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [
                    cleanTitle,
                    String(message).trim(),
                    safeType,
                    safeDisplay,
                    parseInt(priority, 10) || 0,
                    expires_at || null,
                    cleanTargetScreen,
                    normalizedRegions,
                    normalizedMode
                ]
            );
            announcement = rows[0];
        }

        if (normalizedMode === 'push' || normalizedMode === 'both') {
            pushResult = await sendBroadcastPush({
                title: cleanTitle || 'FlakeSecure',
                body: String(message).trim(),
                data: {
                    type: 'admin_custom',
                    targetScreen: cleanTargetScreen || 'Home',
                    priority: parseInt(priority, 10) || 0
                },
                regions: normalizedRegions,
                category: 'custom_pushes'
            });
        }

        res.status(201).json({ announcement, pushResult });
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/announcement/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, message, type, display, priority, expires_at, target_screen, regions, delivery_mode } = req.body;

    try {
        let updateQuery = 'UPDATE announcements SET updated_at = NOW()';
        const params = [];
        let paramCount = 1;

        if (title !== undefined) {
            updateQuery += `, title = $${paramCount}`;
            params.push(title);
            paramCount++;
        }
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
        if (target_screen !== undefined) {
            updateQuery += `, target_screen = $${paramCount}`;
            params.push(target_screen);
            paramCount++;
        }
        if (regions !== undefined) {
            updateQuery += `, regions = $${paramCount}`;
            params.push(regions ? String(regions).trim().toUpperCase() : 'ALL');
            paramCount++;
        }
        if (delivery_mode !== undefined) {
            updateQuery += `, delivery_mode = $${paramCount}`;
            params.push(delivery_mode);
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
    const { active, message, until, send_push = true, regions = 'ALL' } = req.body;

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

        let pushResult = null;
        if (active === true && send_push !== false) {
            pushResult = await sendBroadcastPush({
                title: 'Wartungsarbeiten',
                body: message || 'Wartungsarbeiten laufen – Server vorübergehend im Wartungsmodus.',
                data: {
                    type: 'maintenance',
                    until: until || null
                },
                regions: regions || 'ALL',
                category: 'system_announcements'
            });
        }

        res.json({ maintenance: rows[0], pushResult });
    } catch (error) {
        console.error('Maintenance update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
